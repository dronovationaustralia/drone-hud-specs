// Done criterion 4: If I turn the view away from the drone at any point during the flight, a
// small amber arrow appears at the edge of my view pointing towards it, and it disappears when
// the drone is back in view. Real time. The view is turned by holding the camera rotation each
// frame (yaw about the camera's own position).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CameraHold, fmt, getCamera, getCameraObject, getController, log, waitFor} from "./DroneHUDLeafHelpers"
import {DroneHUDController} from "../Scripts/DroneHUDController"

@component
export class C4OffViewArrowScenario extends Scenario {
  private arrowVisual(): SceneObject {
    const so = findSceneObjectByName("ArrowVisual")
    if (!so) throw new Error("ArrowVisual not found")
    return so
  }

  /** Turn by yawDeg, then verify arrow visible, at edge, pointing at drone, amber. */
  private async checkTurnedAway(c: DroneHUDController, hold: CameraHold, base: quat, yawDeg: number, label: string): Promise<void> {
    const camT = getCameraObject().getTransform()
    const pos = camT.getWorldPosition()
    hold.set(pos, quat.angleAxis((yawDeg * Math.PI) / 180, vec3.up()).multiply(base))
    const ms = await waitFor(() => c.isArrowVisible(), 1500, `[${label}] arrow visible`)
    await sleep(100)
    const cam = getCamera()
    const inv = camT.getInvertedWorldTransform()
    const droneL = inv.multiplyPoint(c.getDroneWorldPosition().add(new vec3(0, 9, 0)))
    const av = this.arrowVisual()
    const at = av.getTransform()
    const arrowUpWorld = at.up
    const arrowUpL = inv.multiplyDirection(arrowUpWorld)
    let dx = droneL.x, dy = droneL.y
    const len = Math.sqrt(dx * dx + dy * dy)
    dx /= len; dy /= len
    const ul = Math.sqrt(arrowUpL.x * arrowUpL.x + arrowUpL.y * arrowUpL.y)
    const pointDot = (arrowUpL.x * dx + arrowUpL.y * dy) / ul
    const sp = cam.worldSpaceToScreenSpace(at.getWorldPosition())
    const edgeDist = Math.min(sp.x, 1 - sp.x, sp.y, 1 - sp.y)
    const rmv = av.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const col = rmv.mainMaterial.mainPass.baseColor as vec4
    const aabbSize = rmv.worldAabbMax().sub(rmv.worldAabbMin())
    log(`C4 [${label}] yaw ${yawDeg} deg: arrow shown after ${ms.toFixed(0)} ms, droneInView=${c.isDroneInView()}, droneCamLocal ${fmt(droneL)}, arrowUpCamLocal ${fmt(arrowUpL)}, pointDot=${pointDot.toFixed(4)}, arrowScreen (${sp.x.toFixed(3)}, ${sp.y.toFixed(3)}) edgeDist=${edgeDist.toFixed(3)}, colour rgba(${col.x.toFixed(2)}, ${col.y.toFixed(2)}, ${col.z.toFixed(2)}, ${col.w.toFixed(2)}), size ${fmt(aabbSize)} cm`)
    expect(c.isDroneInView(), `[${label}] drone reported out of view`).toBe(false)
    expect(av.enabled, `[${label}] ArrowVisual enabled`).toBe(true)
    expect(pointDot > 0.95, `[${label}] arrow points towards drone (dot ${pointDot.toFixed(4)})`).toBe(true)
    expect(edgeDist < 0.15 && edgeDist >= 0, `[${label}] arrow near view edge (edgeDist ${edgeDist.toFixed(3)})`).toBe(true)
    expect(col.x > 0.9 && col.y > 0.55 && col.y < 0.8 && col.z < 0.25, `[${label}] arrow colour amber`).toBe(true)
    expect(Math.max(aabbSize.x, aabbSize.y, aabbSize.z) < 8, `[${label}] arrow is small (<8 cm at 1 m)`).toBe(true)
  }

  private async checkBack(c: DroneHUDController, hold: CameraHold, base: quat, label: string): Promise<void> {
    const camT = getCameraObject().getTransform()
    hold.set(camT.getWorldPosition(), base)
    const ms = await waitFor(() => !c.isArrowVisible(), 1500, `[${label}] arrow hidden`)
    await sleep(50)
    log(`C4 [${label}] view restored: arrow hidden after ${ms.toFixed(0)} ms, droneInView=${c.isDroneInView()}, ArrowVisual.enabled=${this.arrowVisual().enabled}`)
    expect(c.isDroneInView(), `[${label}] drone back in view`).toBe(true)
    expect(this.arrowVisual().enabled, `[${label}] ArrowVisual disabled`).toBe(false)
  }

  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const camT = getCameraObject().getTransform()
    const hold = new CameraHold(this)
    try {
      // Baseline: the user's heading at test start, held LEVEL (eyes on the horizon, where the
      // drone flies). The preview camera may have been left pitched down at the pad; using that
      // raw pitch as "forward" would put the head-height arc above the view.
      const startRot = camT.getWorldRotation()
      const startFwd = startRot.multiplyVec3(new vec3(0, 0, -1))
      const pitchDeg = (Math.asin(Math.max(-1, Math.min(1, startFwd.y))) * 180) / Math.PI
      const flatFwd = new vec3(startFwd.x, 0, startFwd.z).normalize()
      const base = quat.lookAt(flatFwd.uniformScale(-1), vec3.up())
      log(`C4 baseline: start camera pitch ${pitchDeg.toFixed(1)} deg -> levelled to 0 deg (heading kept)`)
      hold.set(camT.getWorldPosition(), base)
      await sleep(200)

      // PREFLIGHT: turning away must NOT show the arrow (tracking only during flight).
      hold.set(camT.getWorldPosition(), quat.angleAxis(Math.PI / 2, vec3.up()).multiply(base))
      await sleep(400)
      log(`C4 [preflight] turned away: arrowVisible=${c.isArrowVisible()} droneInView=${c.isDroneInView()}`)
      expect(c.isArrowVisible(), "no arrow in PREFLIGHT").toBe(false)
      hold.set(camT.getWorldPosition(), base)
      await sleep(200)

      expect(c.startFlight(), "startFlight accepted").toBe(true)
      await sleep(1500)
      // During TAKEOFF.
      expect(c.getFlightState(), "in TAKEOFF").toBe("TAKEOFF")
      // During the climb the drone is low over the pad, so "back in view" = look at the drone.
      const lookDrone = quat.lookAt(camT.getWorldPosition().sub(c.getDroneWorldPosition().add(new vec3(0, 9, 0))).normalize(), vec3.up())
      await this.checkTurnedAway(c, hold, lookDrone, 90, "takeoff-left90")
      const lookDrone2 = quat.lookAt(camT.getWorldPosition().sub(c.getDroneWorldPosition().add(new vec3(0, 9, 0))).normalize(), vec3.up())
      await this.checkBack(c, hold, lookDrone2, "takeoff-back")

      // Restore the authored forward view (the takeoff check left the camera aimed down at the pad).
      hold.set(camT.getWorldPosition(), base)
      await waitFor(() => c.getFlightState() === "ARC", 9000, "state ARC")
      await sleep(500)
      expect(c.isDroneInView(), "drone in view on the arc when facing forward").toBe(true)
      expect(c.isArrowVisible(), "no arrow while drone in view").toBe(false)

      await this.checkTurnedAway(c, hold, base, 90, "arc-left90")
      await this.checkBack(c, hold, base, "arc-back1")
      await this.checkTurnedAway(c, hold, base, -90, "arc-right90")
      await this.checkBack(c, hold, base, "arc-back2")
      await this.checkTurnedAway(c, hold, base, 180, "arc-behind")
      await this.checkBack(c, hold, base, "arc-back3")
      // Look up (pitch) away from the drone.
      const pitchUp = quat.angleAxis((60 * Math.PI) / 180, camT.right).multiply(base)
      hold.set(camT.getWorldPosition(), pitchUp)
      await waitFor(() => c.isArrowVisible(), 1500, "[arc-up60] arrow visible")
      await sleep(100)
      const inv = camT.getInvertedWorldTransform()
      const upL = inv.multiplyDirection(this.arrowVisual().getTransform().up)
      const dL = inv.multiplyPoint(c.getDroneWorldPosition())
      log(`C4 [arc-up60] arrowUpCamLocal ${fmt(upL)} droneCamLocal ${fmt(dL)}`)
      expect(upL.y < -0.7, "[arc-up60] arrow points down towards drone").toBe(true)
      await this.checkBack(c, hold, base, "arc-back4")
    } finally {
      hold.release()
    }
    log("C4 PASS-DATA " + c.getSnapshot())
  }
}
