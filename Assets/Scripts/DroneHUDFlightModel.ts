// DroneHUDFlightModel.ts
// Owns: the simulated flight. State machine (PREFLIGHT -> TAKEOFF -> ARC -> RETURNING -> LANDED
//       -> PREFLIGHT), the simulated battery, and the scripted drone path. Everything is in
//       ContentRoot-local centimetres: user at the origin facing -Z, floor at y = 0.
// Expects: a FlightConfig from DroneHUDController (the Inspector-tunable values live there).
// Must not: touch the scene, UI, audio, or time sources. Pure logic so it can be reasoned
//           about (and tested) in isolation.

export type FlightState = "PREFLIGHT" | "TAKEOFF" | "ARC" | "RETURNING" | "LANDED"

export interface FlightConfig {
  padTop: vec3              // landing point = centre of the home pad's top surface
  cruiseAltitudeCm: number  // drone height above the floor during the arc
  arcRadiusCm: number       // mean distance from the user during the arc
  arcRadiusSwingCm: number  // +/- radius variation (keeps the drone within ~2-4 m)
  arcHalfAngleDeg: number   // arc extends this far either side of straight ahead
  arcPeriodSec: number      // one full left-right-left sweep
  takeoffRiseSec: number    // vertical climb off the pad
  takeoffTransitSec: number // climb-out from above the pad to the start of the arc
  drainSeconds: number      // time from takeoff until the battery reaches warnPercent
  warnPercent: number       // battery level that triggers return-to-home
  returnSpeedCmPerSec: number
  lineFadeSec: number
  landedHoldSec: number
  tagFadeSec: number
}

export interface FlightEvents {
  tookOff: boolean
  returnStarted: boolean
  touchedDown: boolean
  resetToPreflight: boolean
}

const START_BATTERY = 100
const MIN_BATTERY = 5

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function lerpVec(a: vec3, b: vec3, t: number): vec3 {
  return new vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
}

export class FlightModel {
  state: FlightState = "PREFLIGHT"
  battery = START_BATTERY
  /** Seconds since entering the current state. */
  stateTime = 0
  /** Seconds since takeoff (drives the battery drain). */
  flightTime = 0
  position: vec3
  /** 0..1 opacity of the amber return line. */
  lineOpacity = 0
  /** 0..1 opacity of the flight tag. */
  tagOpacity = 0
  flightCount = 0

  private returnFrom: vec3
  private returnDuration = 1
  private arcTime = 0

  constructor(private cfg: FlightConfig) {
    this.position = cfg.padTop
    this.returnFrom = cfg.padTop
  }

  setConfig(cfg: FlightConfig): void {
    this.cfg = cfg
    if (this.state === "PREFLIGHT") this.position = cfg.padTop
  }

  get isFlying(): boolean {
    return this.state === "TAKEOFF" || this.state === "ARC" || this.state === "RETURNING"
  }

  get isWarning(): boolean {
    return this.battery <= this.cfg.warnPercent + 1e-6
  }

  get drainRatePerSec(): number {
    return (START_BATTERY - this.cfg.warnPercent) / Math.max(1, this.cfg.drainSeconds)
  }

  /** Begins a flight. Returns false if a flight is already in progress. */
  start(): boolean {
    if (this.state !== "PREFLIGHT") return false
    this.battery = START_BATTERY
    this.flightTime = 0
    this.arcTime = 0
    this.lineOpacity = 0
    this.tagOpacity = 1
    this.flightCount++
    this.enter("TAKEOFF")
    return true
  }

  update(dt: number): FlightEvents {
    const ev: FlightEvents = {tookOff: false, returnStarted: false, touchedDown: false, resetToPreflight: false}
    this.stateTime += dt
    const c = this.cfg

    if (this.isFlying) {
      this.flightTime += dt
      this.battery = Math.max(MIN_BATTERY, START_BATTERY - this.drainRatePerSec * this.flightTime)
    }

    switch (this.state) {
      case "PREFLIGHT":
        this.position = c.padTop
        this.lineOpacity = 0
        this.tagOpacity = 0
        break

      case "TAKEOFF": {
        const above = new vec3(c.padTop.x, c.cruiseAltitudeCm, c.padTop.z)
        if (this.stateTime <= c.takeoffRiseSec) {
          this.position = lerpVec(c.padTop, above, smoothstep(this.stateTime / c.takeoffRiseSec))
        } else {
          const t = (this.stateTime - c.takeoffRiseSec) / c.takeoffTransitSec
          this.position = lerpVec(above, this.arcPoint(0), smoothstep(t))
          if (t >= 1) {
            this.enter("ARC")
            ev.tookOff = true
          }
        }
        if (this.isWarning) this.beginReturn(ev)
        break
      }

      case "ARC":
        this.arcTime += dt
        this.position = this.arcPoint(this.arcTime)
        if (this.isWarning) this.beginReturn(ev)
        break

      case "RETURNING": {
        this.lineOpacity = 1
        const t = this.stateTime / this.returnDuration
        this.position = lerpVec(this.returnFrom, c.padTop, smoothstep(t))
        if (t >= 1) {
          this.position = c.padTop
          this.enter("LANDED")
          ev.touchedDown = true
        }
        break
      }

      case "LANDED": {
        this.position = c.padTop
        // Return line fades straight away on touchdown.
        this.lineOpacity = Math.max(0, 1 - this.stateTime / Math.max(0.01, c.lineFadeSec))
        // "Landed" holds at full opacity, then fades.
        const fadeT = (this.stateTime - c.landedHoldSec) / Math.max(0.01, c.tagFadeSec)
        this.tagOpacity = fadeT <= 0 ? 1 : Math.max(0, 1 - fadeT)
        if (fadeT >= 1) {
          this.battery = START_BATTERY
          this.tagOpacity = 0
          this.lineOpacity = 0
          this.enter("PREFLIGHT")
          ev.resetToPreflight = true
        }
        break
      }
    }
    return ev
  }

  private beginReturn(ev: FlightEvents): void {
    this.returnFrom = this.position
    const dist = this.returnFrom.distance(this.cfg.padTop)
    // smoothstep peaks at 1.5x average speed; average = returnSpeed
    this.returnDuration = Math.max(2, dist / Math.max(1, this.cfg.returnSpeedCmPerSec))
    this.lineOpacity = 1
    this.enter("RETURNING")
    ev.returnStarted = true
  }

  /** Point on the slow back-and-forth arc in front of the user (never a full loop). */
  arcPoint(t: number): vec3 {
    const c = this.cfg
    const w = (2 * Math.PI) / Math.max(1, c.arcPeriodSec)
    const theta = (c.arcHalfAngleDeg * Math.PI) / 180 * Math.sin(w * t)
    const r = c.arcRadiusCm + c.arcRadiusSwingCm * Math.sin(w * 0.5 * t)
    const y = c.cruiseAltitudeCm + 8 * Math.sin(w * 1.3 * t)
    return new vec3(r * Math.sin(theta), y, -r * Math.cos(theta))
  }

  private enter(s: FlightState): void {
    this.state = s
    this.stateTime = 0
  }
}
