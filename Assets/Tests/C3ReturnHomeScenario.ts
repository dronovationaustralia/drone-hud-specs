// Done criterion 3: About 40 seconds in, at 30% battery, the tag turns amber, a line appears
// from the drone down to the pad, a chime plays from the drone's position, and the drone flies
// back along the line and lands on the pad. REAL TIME (no setTimeScale) so the ~40 s is measured.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {fmt, getController, log, waitFor} from "./DroneHUDLeafHelpers"

function distToSegment(p: vec3, a: vec3, b: vec3): number {
  const ab = b.sub(a)
  const len2 = ab.dot(ab)
  const t = len2 < 1e-6 ? 0 : Math.max(0, Math.min(1, p.sub(a).dot(ab) / len2))
  return p.distance(a.add(ab.uniformScale(t)))
}

@component
export class C3ReturnHomeScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const chime0 = c.getChimeCount()
    expect(c.startFlight(), "startFlight accepted").toBe(true)
    const t0 = getTime()

    // Before the threshold: not amber, no line, no chime.
    await sleep(34000)
    log(`C3 t+${(getTime() - t0).toFixed(1)}s pre-threshold ${c.getSnapshot()}`)
    expect(c.getFlightState(), "still flying the arc at ~34 s").toBe("ARC")
    expect(c.isTagAmber(), "tag not amber before threshold").toBe(false)
    expect(c.isReturnLineVisible(), "no return line before threshold").toBe(false)
    expect(c.getChimeCount(), "no chime before threshold").toBe(chime0)

    await waitFor(() => c.getFlightState() === "RETURNING", 15000, "state RETURNING", 20)
    const tTrig = getTime() - t0
    const batt = c.getBattery()
    const from = c.getDroneWorldPosition()
    const pad = c.getPadWorldPosition()
    log(`C3 RETURN triggered at t+${tTrig.toFixed(2)} s, battery ${batt.toFixed(2)}%, drone ${fmt(from)} pad ${fmt(pad)}`)
    expect(tTrig > 37 && tTrig < 43, `return triggers ~40 s in (${tTrig.toFixed(2)} s)`).toBe(true)
    expect(batt > 28.5 && batt <= 30.01, `return at 30% battery (${batt.toFixed(2)})`).toBe(true)
    await sleep(60)
    log("C3 at trigger " + c.getSnapshot())
    expect(c.isTagAmber(), "tag amber at threshold").toBe(true)
    const tagColor = c.flightTag.getColor()
    log(`C3 tag colour rgba(${tagColor.x.toFixed(2)}, ${tagColor.y.toFixed(2)}, ${tagColor.z.toFixed(2)}, ${tagColor.w.toFixed(2)})`)
    expect(tagColor.x > 0.9 && tagColor.y > 0.5 && tagColor.y < 0.8 && tagColor.z < 0.3, "tag text colour is amber").toBe(true)
    expect(c.isReturnLineVisible(), "return line visible").toBe(true)
    expect(c.getReturnLineOpacity(), "return line full opacity").toBe(1)
    expect(c.getChimeCount(), "exactly one chime at threshold").toBe(chime0 + 1)

    // Line spans drone -> pad: its mesh AABB contains both endpoints.
    const lineRoot = c.returnLine.getSceneObject()
    let lineVis: SceneObject = null
    for (let i = 0; i < lineRoot.getChildrenCount(); i++) {
      if (lineRoot.getChild(i).name === "LineVisual") lineVis = lineRoot.getChild(i)
    }
    expect(!!lineVis, "LineVisual child found").toBe(true)
    const rmv = lineVis.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const mn = rmv.worldAabbMin(), mx = rmv.worldAabbMax()
    const droneNow = c.getDroneWorldPosition()
    const inBox = (p: vec3) =>
      p.x > mn.x - 4 && p.x < mx.x + 4 && p.y > mn.y - 6 && p.y < mx.y + 6 && p.z > mn.z - 4 && p.z < mx.z + 4
    log(`C3 line '${lineVis.name}' AABB ${fmt(mn)}..${fmt(mx)} drone ${fmt(droneNow)} pad ${fmt(pad)}`)
    expect(inBox(pad) && inBox(droneNow), "return line spans drone to pad").toBe(true)
    expect(mx.y - mn.y > 100, "line reaches down from drone height to the pad").toBe(true)

    // Chime source: AudioComponent on the Drone, spatialised, with a track.
    const audio = c.droneAudio
    expect(!!audio, "droneAudio wired").toBe(true)
    log(`C3 audio on '${audio.getSceneObject().name}', track=${audio.audioTrack ? audio.audioTrack.name : "null"}, spatial=${audio.spatialAudio.enabled}, position=${audio.spatialAudio.positionEffect.enabled}, isPlaying=${audio.isPlaying()}`)
    expect(audio.getSceneObject().name, "chime AudioComponent lives on Drone").toBe("Drone")
    expect(!!audio.audioTrack, "chime audio track assigned").toBe(true)
    expect(audio.spatialAudio.enabled && audio.spatialAudio.positionEffect.enabled, "chime is spatial (from drone position)").toBe(true)

    // Fly back along the line to the pad.
    let maxOff = 0, prevD = from.distance(pad), monotonic = true, n = 0
    while (c.getFlightState() === "RETURNING") {
      await sleep(100)
      const p = c.getDroneWorldPosition()
      maxOff = Math.max(maxOff, distToSegment(p, from, pad))
      const d = p.distance(pad)
      if (d > prevD + 0.5) monotonic = false
      prevD = d
      n++
      if (n > 300) throw new Error("RETURNING did not finish within 30 s")
    }
    const tLand = getTime() - t0
    const landPos = c.getDroneWorldPosition()
    log(`C3 return: ${n} samples, max deviation from line ${maxOff.toFixed(2)} cm, monotonic approach ${monotonic}, landed at t+${tLand.toFixed(2)} s, drone ${fmt(landPos)}, state ${c.getFlightState()}`)
    expect(maxOff < 3, `drone follows the line (max off ${maxOff.toFixed(2)} cm)`).toBe(true)
    expect(monotonic, "drone approaches the pad monotonically").toBe(true)
    expect(c.getFlightState(), "LANDED after return").toBe("LANDED")
    expect(landPos.distance(pad) < 3, `landed on pad (${landPos.distance(pad).toFixed(2)} cm)`).toBe(true)
    log("C3 PASS-DATA " + c.getSnapshot())
  }
}
