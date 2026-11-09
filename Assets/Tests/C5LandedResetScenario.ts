// Done criterion 5: After landing, the line fades, "Landed" shows for about 3 seconds, and then
// the Start flight card comes back with the battery at 100%, so I can fly again without restarting.
// setTimeScale(6) is used ONLY to fast-forward the cruise until the return starts; it is reset
// to 1 before landing, so the line fade, the "Landed" hold and the reset are measured in real time.
// The second flight is started with a LEAF right-hand pinch on StartFlightButton.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {getController, log, waitFor} from "./DroneHUDLeafHelpers"

@component
export class C5LandedResetScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1500)
    const c = getController()
    const flights0 = c.getFlightCount()
    expect(c.startFlight(), "startFlight accepted").toBe(true)
    c.setTimeScale(6)
    try {
      await waitFor(() => c.getFlightState() === "RETURNING", 20000, "state RETURNING (x6)")
    } finally {
      c.setTimeScale(1)
    }
    log("C5 returning (time scale back to 1) " + c.getSnapshot())
    await waitFor(() => c.getFlightState() === "LANDED", 30000, "state LANDED", 10)
    const tLand = getTime()
    log("C5 touchdown " + c.getSnapshot() + ` lineOpacity=${c.getReturnLineOpacity().toFixed(3)}`)

    // Sample until PREFLIGHT.
    let lineZeroAt = -1
    let landedFirst = -1, landedLast = -1
    let cardDuringLanded = false
    let lineSamples = ""
    let lastOp = 2
    let fadeMonotonic = true
    while (c.getFlightState() === "LANDED") {
      const t = getTime() - tLand
      const op = c.getReturnLineOpacity()
      if (op > lastOp + 1e-4) fadeMonotonic = false
      lastOp = op
      if (t < 0.8) lineSamples += `${t.toFixed(2)}s:${op.toFixed(2)} `
      if (lineZeroAt < 0 && op <= 0.001 && !c.isReturnLineVisible()) lineZeroAt = t
      if (c.isTagVisible() && c.getTagText() === "Landed") {
        if (landedFirst < 0) landedFirst = t
        landedLast = t
      }
      if (c.isCardVisible()) cardDuringLanded = true
      if (t > 10) throw new Error("LANDED did not end within 10 s")
      await sleep(20)
    }
    const tReset = getTime() - tLand
    log(`C5 line opacity samples: ${lineSamples}`)
    log(`C5 line hidden at +${lineZeroAt.toFixed(2)} s (monotonic fade ${fadeMonotonic}); "Landed" visible from +${landedFirst.toFixed(2)} to +${landedLast.toFixed(2)} s (${(landedLast - landedFirst).toFixed(2)} s); PREFLIGHT at +${tReset.toFixed(2)} s; card shown during LANDED: ${cardDuringLanded}`)
    expect(lineZeroAt >= 0 && lineZeroAt < 1.0, `line fades out after touchdown (${lineZeroAt.toFixed(2)} s)`).toBe(true)
    expect(fadeMonotonic, "line opacity decreases monotonically").toBe(true)
    expect(landedFirst >= 0 && landedFirst < 0.1, `"Landed" shown at touchdown (+${landedFirst.toFixed(2)} s)`).toBe(true)
    const landedDur = landedLast - landedFirst
    expect(landedDur > 2.7 && landedDur < 4.3, `"Landed" shows ~3 s (${landedDur.toFixed(2)} s)`).toBe(true)
    expect(cardDuringLanded, "card not shown while Landed").toBe(false)

    await sleep(100)
    const cardText = c.preflightCard.getBatteryText()
    log(`C5 after reset ${c.getSnapshot()} cardBatteryText="${cardText}"`)
    expect(c.getFlightState(), "back to PREFLIGHT").toBe("PREFLIGHT")
    expect(c.isCardVisible(), "Start flight card back").toBe(true)
    expect(c.getBattery(), "battery reset to 100").toBe(100)
    expect(cardText, "card shows Battery 100%").toBe("Battery 100%")
    expect(c.isTagVisible(), "tag hidden").toBe(false)
    expect(c.isReturnLineVisible(), "line hidden").toBe(false)
    expect(c.isArrowVisible(), "arrow hidden").toBe(false)

    // Fly again without restarting — via a real LEAF pinch on the button.
    const button = findInteractableByName("StartFlightButton", undefined, true)
    expect(button !== undefined && button !== null, "StartFlightButton enabled again").toBe(true)
    const right = LeafHandInteractor.get("right")
    await right.trigger(button)
    await sleep(300)
    await right.hand.hide()
    log("C5 second flight " + c.getSnapshot())
    expect(c.getFlightCount(), "second flight started (count +2 total)").toBe(flights0 + 2)
    expect(c.getFlightState(), "second flight TAKEOFF").toBe("TAKEOFF")
    expect(c.isCardVisible(), "card hidden on second flight").toBe(false)
    // ~1-1.5 s have elapsed since the pinch (drain 1.75 %/s), so a fresh 100% start reads 95-100.
    expect(c.getBattery() > 95 && c.getBattery() < 100, `second flight draining from 100% (${c.getBattery().toFixed(1)})`).toBe(true)
    expect(c.isTagAmber(), "tag not amber on second flight").toBe(false)
  }
}
