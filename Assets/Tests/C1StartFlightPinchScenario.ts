// Done criterion 1: Pinching "Start flight" makes the card disappear, and the drone takes off
// from the pad and flies a slow back-and-forth arc in front of me.
// Real time (no setTimeScale). Flight is started by a LEAF simulated right-hand pinch on the
// UIKit "StartFlightButton" — NOT by calling startFlight().
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {fmt, getController, log, toCameraLocal, waitFor} from "./DroneHUDLeafHelpers"

@component
export class C1StartFlightPinchScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    log("C1 initial " + c.getSnapshot())
    expect(c.getFlightState(), "starts in PREFLIGHT").toBe("PREFLIGHT")
    expect(c.isCardVisible(), "card visible before pinch").toBe(true)
    const flights0 = c.getFlightCount()
    const pad = c.getPadWorldPosition()
    const d0 = c.getDroneWorldPosition()
    log(`C1 pad ${fmt(pad)} drone ${fmt(d0)}`)
    expect(d0.distance(pad) < 5, `drone on pad before flight (dist ${d0.distance(pad).toFixed(1)} cm)`).toBe(true)

    const button = findInteractableByName("StartFlightButton", undefined, true)
    expect(button !== undefined && button !== null, "StartFlightButton interactable found & enabled").toBe(true)
    log("C1 button world pos " + fmt(button.getSceneObject().getTransform().getWorldPosition()))

    const right = LeafHandInteractor.get("right")
    await right.trigger(button)
    await sleep(100)
    log("C1 after pinch " + c.getSnapshot())
    expect(c.isCardVisible(), "card hidden after pinch").toBe(false)
    expect(c.getFlightCount(), "flight count +1 after pinch").toBe(flights0 + 1)
    expect(c.getFlightState(), "TAKEOFF after pinch").toBe("TAKEOFF")
    await right.hand.hide()

    // Takeoff: vertical climb off the pad.
    await sleep(2500)
    const d1 = c.getDroneWorldPosition()
    const rise = d1.y - pad.y
    const horiz = Math.sqrt((d1.x - pad.x) ** 2 + (d1.z - pad.z) ** 2)
    log(`C1 t+2.6s drone ${fmt(d1)} rise ${rise.toFixed(1)} cm horiz ${horiz.toFixed(1)} cm`)
    expect(rise > 30, `drone climbed off pad (rise ${rise.toFixed(1)} cm)`).toBe(true)
    expect(horiz < 10, `climb is vertical above pad (horiz ${horiz.toFixed(1)} cm)`).toBe(true)

    const msToArc = await waitFor(() => c.getFlightState() === "ARC", 8000, "state ARC")
    log(`C1 reached ARC ${msToArc.toFixed(0)} ms later`)

    // Sample one full arc period (14 s) in camera space.
    let minAng = 1e9, maxAng = -1e9, minDist = 1e9, maxDist = -1e9, maxSpeed = 0, allFront = true
    let prev = c.getDroneWorldPosition()
    let prevT = getTime()
    let minY = 1e9, maxY = -1e9
    const tEnd = getTime() + 14.5
    while (getTime() < tEnd) {
      await sleep(100)
      const p = c.getDroneWorldPosition()
      const now = getTime()
      const l = toCameraLocal(p)
      if (l.z >= 0) allFront = false
      const ang = (Math.atan2(l.x, -l.z) * 180) / Math.PI
      const dist = Math.sqrt(l.x * l.x + l.z * l.z) / 100
      minAng = Math.min(minAng, ang); maxAng = Math.max(maxAng, ang)
      minDist = Math.min(minDist, dist); maxDist = Math.max(maxDist, dist)
      minY = Math.min(minY, p.y - pad.y); maxY = Math.max(maxY, p.y - pad.y)
      const dt = now - prevT
      if (dt > 0.02) maxSpeed = Math.max(maxSpeed, p.distance(prev) / dt)
      prev = p; prevT = now
    }
    log(`C1 arc: angle ${minAng.toFixed(1)}..${maxAng.toFixed(1)} deg, dist ${minDist.toFixed(2)}..${maxDist.toFixed(2)} m, height ${minY.toFixed(0)}..${maxY.toFixed(0)} cm, max speed ${maxSpeed.toFixed(1)} cm/s, allInFront ${allFront}, state ${c.getFlightState()}`)
    expect(allFront, "drone stays in front of the user").toBe(true)
    expect(minAng < -8, `arc swings left (min ${minAng.toFixed(1)} deg)`).toBe(true)
    expect(maxAng > 8, `arc swings right (max ${maxAng.toFixed(1)} deg)`).toBe(true)
    expect(maxAng - minAng < 45, "arc is not a loop (span < 45 deg)").toBe(true)
    expect(minDist > 1.8 && maxDist < 4.2, "arc stays ~2-4 m away").toBe(true)
    expect(maxSpeed < 120, `slow flight (max ${maxSpeed.toFixed(1)} cm/s)`).toBe(true)
    expect(c.getFlightState(), "still on ARC").toBe("ARC")
    log("C1 PASS-DATA " + c.getSnapshot())
  }
}
