// Done criterion 2: During the flight, the tag stays just to the right of the drone, turns to
// face me as I walk around, and shows height, distance and battery with units, with the battery
// counting down. Real time. Flight started with startFlight() (the pinch is covered by C1).
// "Walking around" is simulated by holding the camera at new world poses each frame.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CameraHold, fmt, getCameraObject, getController, log, waitFor} from "./DroneHUDLeafHelpers"
import {DroneHUDController} from "../Scripts/DroneHUDController"

const TAG_RE = /^H (\d+\.\d) m · D (\d+\.\d) m · (\d+)%$/

@component
export class C2FlightTagScenario extends Scenario {
  private checkTag(c: DroneHUDController, label: string): void {
    const camT = getCameraObject().getTransform()
    const inv = camT.getInvertedWorldTransform()
    const camPos = camT.getWorldPosition()
    const drone = c.getDroneWorldPosition()
    const tag = c.getTagWorldPosition()
    const dl = inv.multiplyPoint(drone)
    const tl = inv.multiplyPoint(tag)
    const dx = tl.x - dl.x
    const dy = tl.y - dl.y
    const gap = tag.distance(drone)
    const tagFwd = findTagForward()
    const toCam = camPos.sub(tag).normalize()
    const facing = tagFwd.dot(toCam)
    log(`C2 [${label}] cam ${fmt(camPos)} drone ${fmt(drone)} tag ${fmt(tag)} camSpace dx=${dx.toFixed(1)} dy=${dy.toFixed(1)} dist=${gap.toFixed(1)} facingDot=${facing.toFixed(4)} text="${c.getTagText()}"`)
    expect(c.isTagVisible(), `[${label}] tag visible`).toBe(true)
    expect(dx > 10 && dx < 60, `[${label}] tag right of drone in camera space (dx ${dx.toFixed(1)} cm)`).toBe(true)
    expect(Math.abs(dy) < 20, `[${label}] tag level with drone (dy ${dy.toFixed(1)} cm)`).toBe(true)
    expect(gap < 60, `[${label}] tag close to drone (${gap.toFixed(1)} cm)`).toBe(true)
    expect(facing > 0.99, `[${label}] tag front faces camera (dot ${facing.toFixed(4)})`).toBe(true)
  }

  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    expect(c.isTagVisible(), "tag hidden in PREFLIGHT").toBe(false)
    expect(c.startFlight(), "startFlight accepted").toBe(true)
    await waitFor(() => c.getFlightState() === "ARC", 9000, "state ARC")
    await sleep(500)

    // Text format with units, values consistent with test API.
    const txt1 = c.getTagText()
    const m1 = TAG_RE.exec(txt1)
    log(`C2 text1 "${txt1}" heightM=${c.getHeightM().toFixed(2)} distM=${c.getDistanceM().toFixed(2)} battery=${c.getBattery().toFixed(1)}`)
    expect(m1 !== null, `tag text matches H/D/battery with units: "${txt1}"`).toBe(true)
    expect(Math.abs(parseFloat(m1[1]) - c.getHeightM()) < 0.15, "height value matches getHeightM").toBe(true)
    expect(Math.abs(parseFloat(m1[2]) - c.getDistanceM()) < 0.15, "distance value matches getDistanceM").toBe(true)

    // Placement + billboard from the start position, at several arc points.
    for (let i = 0; i < 4; i++) {
      this.checkTag(c, `start#${i}`)
      await sleep(1200)
    }

    // Battery counts down.
    const b1 = c.getBattery()
    const pct1 = parseInt(TAG_RE.exec(c.getTagText())[3])
    await sleep(3000)
    const b2 = c.getBattery()
    const txt2 = c.getTagText()
    const pct2 = parseInt(TAG_RE.exec(txt2)[3])
    log(`C2 battery ${b1.toFixed(2)} -> ${b2.toFixed(2)} over 3 s; text % ${pct1} -> ${pct2} ("${txt2}")`)
    expect(b2 < b1 - 3, "battery decreased by >3% in 3 s").toBe(true)
    expect(pct2 < pct1, "battery % in tag text decreased").toBe(true)

    // Walk around: hold the camera at poses offset to the side, looking at the drone.
    const hold = new CameraHold(this)
    const camT = getCameraObject().getTransform()
    const start = camT.getWorldPosition()
    const offsets = [new vec3(150, 0, 0), new vec3(-150, 0, 50), new vec3(100, 0, -120)]
    let idx = 0
    try {
      for (const off of offsets) {
        const pos = start.add(off)
        const drone = c.getDroneWorldPosition()
        const back = pos.sub(drone)
        back.y = 0
        const rot = quat.lookAt(back.normalize(), vec3.up())
        hold.set(pos, rot)
        await sleep(400)
        const actual = camT.getWorldPosition()
        log(`C2 walk#${idx} requested cam ${fmt(pos)} actual ${fmt(actual)}`)
        expect(actual.distance(pos) < 1, `camera override took effect (walk#${idx})`).toBe(true)
        // Re-aim at the (moving) drone and check.
        const d2 = c.getDroneWorldPosition()
        const back2 = pos.sub(d2)
        back2.y = 0
        hold.set(pos, quat.lookAt(back2.normalize(), vec3.up()))
        await sleep(150)
        this.checkTag(c, `walk#${idx}`)
        idx++
      }
    } finally {
      hold.release()
    }
    log("C2 PASS-DATA " + c.getSnapshot())
  }
}

function findTagForward(): vec3 {
  const c = getController()
  return c.flightTag.getSceneObject().getTransform().forward
}
