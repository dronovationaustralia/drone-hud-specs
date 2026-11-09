// DroneHUDController.ts  (entry point — on the authored "DroneHUDController" SceneObject)
// Owns: orchestration only. Each frame it advances the FlightModel and pushes its state into
//       the scene: drone transform, flight tag, return line, off-view arrow, pre-flight card,
//       and the one spatial chime at the return threshold. Also places ContentRoot on the
//       floor in front of the user once at Lens start.
// Expects (wired in the scene): the UI modules, the authored Drone / HomePad / ContentRoot
//       objects, the drone's AudioComponent, and the camera.
// Must not: build UI or text (that lives in DroneHUDPreflightCardUI / DroneHUDFlightTagUI),
//       or duplicate flight state (the FlightModel is the single source of truth).
//
// Test surface (LEAF): getFlightState(), getBattery(), isCardVisible(), isTagVisible(),
//       getTagText(), isTagAmber(), isReturnLineVisible(), getReturnLineOpacity(),
//       isArrowVisible(), getChimeCount(), getFlightCount(), getDroneWorldPosition(),
//       getPadWorldPosition(), getTagWorldPosition(), getHeightM(), getDistanceM(),
//       getSnapshot(), startFlight(), setTimeScale().
// Length note (~360 lines): roughly a third is the read-only LEAF test surface above plus
//       Inspector decorators; flight logic itself lives in DroneHUDFlightModel.ts.

import {FlightConfig, FlightModel, FlightState} from "./DroneHUDFlightModel"
import {DroneHUDPreflightCardUI} from "./DroneHUDPreflightCardUI"
import {DroneHUDFlightTagUI} from "./DroneHUDFlightTagUI"
import {DroneHUDReturnLine} from "./DroneHUDReturnLine"
import {DroneHUDOffViewArrow} from "./DroneHUDOffViewArrow"

@component
export class DroneHUDController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDController – drone flight overlay orchestrator</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Pre-flight card UI (Start flight button + battery).")
  preflightCard!: DroneHUDPreflightCardUI

  @input
  @hint("Billboarded flight tag beside the drone.")
  flightTag!: DroneHUDFlightTagUI

  @input
  @hint("Amber return line from drone to home pad.")
  returnLine!: DroneHUDReturnLine

  @input
  @hint("Off-view edge arrow.")
  offViewArrow!: DroneHUDOffViewArrow

  @input
  @hint("Stand-in drone root (moved along the scripted path).")
  drone!: SceneObject

  @input
  @hint("Home pad root (origin = pad centre on the floor). The drone takes off from and lands on it.")
  homePad!: SceneObject

  @input
  @hint("Root of all world content. Placed on the floor in front of the user at Lens start.")
  contentRoot!: SceneObject

  @input
  @hint("The user's camera object.")
  viewer!: SceneObject

  @input
  @hint("AudioComponent on the drone that plays the return chime (spatial, from the drone's position).")
  droneAudio!: AudioComponent
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Seconds from takeoff until the battery drains from 100% to the return threshold.")
  @widget(new SliderWidget(10, 120, 1))
  drainSeconds: number = 40

  @input
  @hint("Battery % at which the drone returns home (tag turns amber, line + chime).")
  @widget(new SliderWidget(10, 60, 1))
  returnBatteryPercent: number = 30

  @input
  @hint("Cruise height above the floor in cm (about head height).")
  @widget(new SliderWidget(100, 300, 5))
  cruiseAltitudeCm: number = 175

  @input
  @hint("Mean distance of the arc from the user in cm (stays roughly 2-4 m away).")
  @widget(new SliderWidget(200, 400, 5))
  arcRadiusCm: number = 300

  @input
  @hint("How far the arc swings either side of straight ahead, in degrees.")
  @widget(new SliderWidget(5, 30, 1))
  arcHalfAngleDeg: number = 15

  @input
  @hint("User eye height in cm, used to find the floor when placing content at Lens start.")
  @widget(new SliderWidget(120, 200, 1))
  eyeHeightCm: number = 165
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Simulation speed multiplier for testing only (1 = real time). Not exposed in the HUD.")
  @widget(new SliderWidget(0.25, 10, 0.25))
  debugTimeScale: number = 1

  @input
  @hint("Place ContentRoot relative to the user's head at Lens start (off = keep authored placement).")
  placeContentAtStart: boolean = true
  @ui.group_end

  private model!: FlightModel
  private padTopLocal = new vec3(0, 0, -200)
  private chimeCount = 0
  private placed = false
  private framesSinceStart = 0
  private lastDronePos: vec3 | null = null
  private timeScale = 1

  onAwake(): void {
    this.timeScale = this.debugTimeScale
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    const missing: string[] = []
    if (!this.preflightCard) missing.push("preflightCard")
    if (!this.flightTag) missing.push("flightTag")
    if (!this.returnLine) missing.push("returnLine")
    if (!this.offViewArrow) missing.push("offViewArrow")
    if (!this.drone) missing.push("drone")
    if (!this.homePad) missing.push("homePad")
    if (!this.contentRoot) missing.push("contentRoot")
    if (!this.viewer) missing.push("viewer")
    if (missing.length > 0) {
      print("[DroneHUDController] ERROR: inputs not wired: " + missing.join(", "))
      return
    }
    const padLocal = this.homePad.getTransform().getLocalPosition()
    this.padTopLocal = new vec3(padLocal.x, padLocal.y + 1, padLocal.z)
    this.model = new FlightModel(this.buildConfig())

    this.setupAudio()
    this.preflightCard.onStartFlight.add(() => this.startFlight())
    this.preflightCard.setBatteryPercent(100)
    this.preflightCard.show()
    this.flightTag.setOpacity(0)
    this.returnLine.setOpacity(0)
    this.offViewArrow.setTracking(false)
    this.applyDrone(0)
    print("[DroneHUDController] ready — state PREFLIGHT")
  }

  // ── Public test/control surface ───────────────────────────────────

  /** Same path as pinching "Start flight". Returns false if a flight is in progress. */
  startFlight(): boolean {
    if (!this.model) return false
    if (!this.model.start()) return false
    this.preflightCard.hide()
    this.flightTag.setWarning(false)
    this.flightTag.setOpacity(1)
    this.offViewArrow.setTracking(true)
    print("[DroneHUDController] Start flight #" + this.model.flightCount)
    return true
  }

  setTimeScale(s: number): void {
    this.timeScale = Math.max(0.01, s)
  }

  getFlightState(): FlightState {
    return this.model ? this.model.state : "PREFLIGHT"
  }
  getBattery(): number {
    return this.model ? this.model.battery : 100
  }
  isCardVisible(): boolean {
    return this.preflightCard ? this.preflightCard.isVisible() : false
  }
  isTagVisible(): boolean {
    return this.flightTag ? this.flightTag.isVisible() : false
  }
  getTagText(): string {
    return this.flightTag ? this.flightTag.getText() : ""
  }
  isTagAmber(): boolean {
    return this.flightTag ? this.flightTag.isAmber() : false
  }
  isReturnLineVisible(): boolean {
    return this.returnLine ? this.returnLine.isVisible() : false
  }
  getReturnLineOpacity(): number {
    return this.returnLine ? this.returnLine.getOpacity() : 0
  }
  isArrowVisible(): boolean {
    return this.offViewArrow ? this.offViewArrow.isShowing() : false
  }
  isDroneInView(): boolean {
    return this.offViewArrow ? this.offViewArrow.isTargetInView() : true
  }
  getChimeCount(): number {
    return this.chimeCount
  }
  getFlightCount(): number {
    return this.model ? this.model.flightCount : 0
  }
  getDroneWorldPosition(): vec3 {
    return this.drone.getTransform().getWorldPosition()
  }
  getPadWorldPosition(): vec3 {
    return this.homePad.getTransform().getWorldPosition()
  }
  getTagWorldPosition(): vec3 {
    return this.flightTag.getSceneObject().getTransform().getWorldPosition()
  }
  /** Height of the drone above the home pad, metres. */
  getHeightM(): number {
    return this.model ? Math.max(0, this.model.position.y - this.padTopLocal.y) / 100 : 0
  }
  /** Horizontal distance from the user to the drone, metres. */
  getDistanceM(): number {
    const a = this.viewer.getTransform().getWorldPosition()
    const b = this.getDroneWorldPosition()
    const dx = b.x - a.x
    const dz = b.z - a.z
    return Math.sqrt(dx * dx + dz * dz) / 100
  }
  getSnapshot(): string {
    return JSON.stringify({
      state: this.getFlightState(),
      battery: Math.round(this.getBattery() * 10) / 10,
      cardVisible: this.isCardVisible(),
      tagVisible: this.isTagVisible(),
      tagText: this.getTagText(),
      tagAmber: this.isTagAmber(),
      lineVisible: this.isReturnLineVisible(),
      arrowVisible: this.isArrowVisible(),
      droneInView: this.isDroneInView(),
      chimeCount: this.chimeCount,
      flightCount: this.getFlightCount(),
    })
  }

  // ── Frame loop ────────────────────────────────────────────────────

  private onUpdate(): void {
    if (!this.model) return
    this.framesSinceStart++
    if (!this.placed && this.framesSinceStart >= 3) this.placeContent()

    const dt = getDeltaTime() * this.timeScale
    const ev = this.model.update(dt)

    if (ev.returnStarted) {
      this.flightTag.setWarning(true)
      this.playChime()
      print("[DroneHUDController] Battery " + Math.round(this.model.battery) + "% — returning home")
    }
    if (ev.touchedDown) {
      this.flightTag.showLanded()
      this.offViewArrow.setTracking(false)
      print("[DroneHUDController] Touchdown — Landed")
    }
    if (ev.resetToPreflight && this.model.state === "PREFLIGHT") {
      this.flightTag.setOpacity(0)
      this.preflightCard.setBatteryPercent(100)
      this.preflightCard.show()
      print("[DroneHUDController] Ready to fly again — battery 100%")
    }

    this.applyDrone(dt)

    if (this.model.isFlying) {
      this.flightTag.setTelemetry(this.getHeightM(), this.getDistanceM(), this.model.battery)
      if (this.model.isWarning) this.flightTag.setWarning(true)
    }
    if (this.model.state === "LANDED" || this.model.isFlying) this.flightTag.setOpacity(this.model.tagOpacity)
    this.returnLine.setOpacity(this.model.lineOpacity)
  }

  private applyDrone(dt: number): void {
    const t = this.drone.getTransform()
    const p = this.model.position
    t.setLocalPosition(p)
    // Gentle bank toward the direction of travel (max ~12 degrees) so motion reads as flight.
    let tilt = quat.quatIdentity()
    if (this.lastDronePos && dt > 1e-4) {
      const v = p.sub(this.lastDronePos).uniformScale(1 / dt)
      const k = 0.25 * (Math.PI / 180)
      const maxTilt = 12 * (Math.PI / 180)
      const pitch = Math.max(-maxTilt, Math.min(maxTilt, v.z * k)) // nose dips toward travel
      const roll = Math.max(-maxTilt, Math.min(maxTilt, -v.x * k))
      tilt = quat.fromEulerAngles(pitch, 0, roll)
    }
    t.setLocalRotation(tilt)
    this.lastDronePos = p
  }

  private placeContent(): void {
    this.placed = true
    if (!this.placeContentAtStart) return
    const camT = this.viewer.getTransform()
    const camPos = camT.getWorldPosition()
    // Transform.forward is local +Z; the camera looks along -forward. Yaw ContentRoot so its
    // local -Z points the way the user is looking (horizontally).
    const fwd = camT.forward
    let yaw = Math.atan2(fwd.x, fwd.z)
    if (!isFinite(yaw)) yaw = 0
    const root = this.contentRoot.getTransform()
    root.setWorldPosition(new vec3(camPos.x, camPos.y - this.eyeHeightCm, camPos.z))
    root.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    print(
      "[DroneHUDController] ContentRoot placed: camera at " + camPos.toString() +
      ", floor y=" + (camPos.y - this.eyeHeightCm).toFixed(1)
    )
  }

  private setupAudio(): void {
    if (!this.droneAudio) {
      print("[DroneHUDController] WARN: droneAudio not wired — chime will be silent")
      return
    }
    const a = this.droneAudio
    a.playbackMode = Audio.PlaybackMode.LowLatency
    a.spatialAudio.enabled = true
    a.spatialAudio.positionEffect.enabled = true
    a.spatialAudio.distanceEffect.enabled = true
    a.spatialAudio.distanceEffect.type = Audio.DistanceCurveType.Logarithm
    a.spatialAudio.distanceEffect.minDistance = 100
    a.spatialAudio.distanceEffect.maxDistance = 2000
    a.spatialAudio.directivityEffect.enabled = false
  }

  private playChime(): void {
    this.chimeCount++
    if (this.droneAudio && this.droneAudio.audioTrack) this.droneAudio.play(1)
  }

  private buildConfig(): FlightConfig {
    return {
      padTop: this.padTopLocal,
      cruiseAltitudeCm: this.cruiseAltitudeCm,
      arcRadiusCm: this.arcRadiusCm,
      arcRadiusSwingCm: 40,
      arcHalfAngleDeg: this.arcHalfAngleDeg,
      arcPeriodSec: 14,
      takeoffRiseSec: 4,
      takeoffTransitSec: 3,
      drainSeconds: this.drainSeconds,
      warnPercent: this.returnBatteryPercent,
      returnSpeedCmPerSec: 40,
      lineFadeSec: 0.5,
      landedHoldSec: 3,
      tagFadeSec: 0.8,
    }
  }
}
