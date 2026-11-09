---
status: approved
---

# Design brief: Drone HUD

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->

## The one spatial moment
The drone is coming back on low battery, about 3 metres away and a bit above me. I'm watching it, not the controller. Right beside it a small tag shows just three numbers: height, distance, battery. At 30% the tag turns amber, a line appears from the drone down to a glowing home pad on the floor where I took off, and I hear one soft chime. The drone flies back along that line and lands on the pad. The whole time, my eyes stay up on the drone.

## Why it belongs on glasses
- Uses: **draws in the world** (the flight info sits next to the drone, and the return line runs to the real take-off spot) and **leaves your body free** (eyes stay up and hands stay on the controls).
- Why it's better than the phone or laptop version: CASA rules require pilots to keep the drone in visual line of sight, but battery, height and distance live on the controller screen. Pilots keep looking down and back up, and that's when they lose track of the drone. On a phone you'd have to look down to see the battery warning. On glasses it appears next to the drone.

## Product or overlay
- Type: **overlay**. It responds to a real drone in flight.
- What the real version would sense: the real drone's position in the sky, plus live telemetry (height, distance, battery) from the drone or controller.
- Stand-in for the preview: a simple, generic quadcopter model (nothing branded) that flies a scripted path. Height and distance come from where the virtual drone actually is. The battery is simulated: it starts at 100% and drains on its own to 30% in about 40 seconds, so the whole demo fits in one uncut take. There's no skip button, to keep the HUD clean.

## Where things live
- Where the user is looking during the main task: up and ahead at the drone, about 2 to 4 m away, from roughly head height down to the pad on the floor.
- **Home pad:** on the floor about 2 m in front of the user, glowing. About 60 cm across (default). It stays visible the whole time.
- **Drone:** generic quadcopter, about 35 cm across (default). It starts on the home pad. In flight it rises to about head height (about 1.7 m, default) and flies a slow back-and-forth arc in front of the user, staying roughly 2 to 4 m away and mostly inside the glasses' view, the way a real pilot keeps line of sight. Arc about 15 to 20° to either side of straight ahead, so the drone stays inside the 32° view most of the time. Not a full loop.
- **Flight tag:** just to the right of the drone, about 20 cm away. It follows the drone and always turns to face the user. One compact line with units, for example `H 2.1 m · D 3.4 m · 64%`. No panel or background box, just text. Large enough to read at 4 m (letters about 8 cm tall, default). White and slightly transparent normally, solid amber at 30% and below.
- **Return line:** from the drone down to the centre of the home pad, amber (default). It appears at 30% and fades out when the drone lands.
- **Off-view arrow:** a small amber arrow at the edge of the user's view, pointing toward the drone.
- **Pre-flight card:** next to the home pad, at about waist height (about 1 m, default) so it's within easy reach and in view while looking at the pad. It has one big "Start flight" button and shows the battery at 100%.

## Hands and input
- Start flight: pinch the big "Start flight" button on the pre-flight card (UI Kit button).
- That's the only interaction. Everything else happens automatically.
- Targets are big and highlight when aimed at.
- Voice: none.

## When things show
- Pre-flight card: shows at Lens start and again after each landing. Hides as soon as "Start flight" is pinched.
- Home pad: always visible, always glowing.
- Flight tag: shows from takeoff, updates live during the flight (battery counts down), and turns solid amber at 30%. On touchdown it changes to "Landed" in white for about 3 seconds, then fades away.
- Return line: shows at 30%. Fades out straight away when the drone touches down.
- Chime: one soft chime at 30%, played from the drone's position (spatial sound), so the sound also tells the user which way to turn.
- Off-view arrow: shows any time during the flight that the drone is out of view. Hides as soon as the drone is back in view.
- After the "Landed" message fades, the pre-flight card comes back with the battery reset to 100%, so the user can fly again without restarting the Lens.
- If something needs attention out of view: the spatial chime plus the small amber edge arrow.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching "Start flight" makes the card disappear, and the drone takes off from the pad and flies a slow back-and-forth arc in front of me.
2. During the flight, the tag stays just to the right of the drone, turns to face me as I walk around, and shows height, distance and battery with units, with the battery counting down.
3. About 40 seconds in, at 30% battery, the tag turns amber, a line appears from the drone down to the pad, a chime plays from the drone's position, and the drone flies back along the line and lands on the pad.
4. If I turn the view away from the drone at any point during the flight, a small amber arrow appears at the edge of my view pointing towards it, and it disappears when the drone is back in view.
5. After landing, the line fades, "Landed" shows for about 3 seconds, and then the Start flight card comes back with the battery at 100%, so I can fly again without restarting.

## Out of scope
- Finding or tracking a real drone, or reading real telemetry. The virtual drone and simulated battery stand in for both.
- Manual flight control of the virtual drone.
- A skip or speed-up button for the battery drain.
- Other warnings (wind, signal loss, airspace, other aircraft), and any other flight data beyond height, distance and battery.
- Saving flight history between sessions.

## Risks and open questions
- Feel unproven: whether the tag stays readable against a bright real sky at 3 to 4 m, and how well real glasses would track a small, fast drone at distance. Only real glasses and a real drone can answer these.
- The real product depends on detecting the drone and getting live telemetry from it. Neither can be shown in the preview, so the demo shows the response, not the sensing.
- The glasses' view is narrow (about 32° wide). The 15 to 20° arc keeps the drone in view most of the time, but at the ends of the arc it can drift near or past the edge, so the user may still turn their head a little.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
