// DroneHUDHomePad.ts
// Owns: the glowing home pad visual on the floor — a faint filled disc, a bright outer ring and
//       an "H" landing mark, gently pulsing. Always visible, always glowing.
// Expects: to sit on the authored "HomePad" SceneObject (its origin = pad centre on the floor);
//          glowMaterial = an unlit material (cloned + set additive at runtime).
// Must not: hold flight state.

import {GeometryBuilder, attachMesh, makeGlowMaterial, setGlow} from "./DroneHUDGeometry"

@component
export class DroneHUDHomePad extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDHomePad – glowing ~60 cm landing pad</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Unlit base material; cloned and switched to additive blending at runtime.")
  glowMaterial!: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Pad diameter in cm.")
  @widget(new SliderWidget(30, 120, 1))
  diameterCm: number = 60

  @input('vec4', '{0.35,0.9,1,1}')
  @widget(new ColorWidget())
  @hint("Glow colour of the pad (cyan by default, so amber stays reserved for warnings).")
  glowColor: vec4 = new vec4(0.35, 0.9, 1, 1)

  @input
  @hint("Seconds per glow pulse. 0 = steady glow.")
  @widget(new SliderWidget(0, 6, 0.1))
  pulsePeriodSec: number = 2.5
  @ui.group_end

  private ringMat!: Material
  private fillMat!: Material
  private time = 0

  onAwake(): void {
    if (!this.glowMaterial) {
      print("[DroneHUDHomePad] ERROR: glowMaterial not assigned")
      return
    }
    const r = this.diameterCm / 2

    const fill = new GeometryBuilder()
    fill.ring(0, r * 0.93, 0.6, 48)
    this.fillMat = makeGlowMaterial(this.glowMaterial, this.glowColor)
    attachMesh(this.child("PadFill"), fill.build(), this.fillMat)

    const ring = new GeometryBuilder()
    ring.ring(r * 0.9, r, 0.8, 64)
    // "H" landing mark
    const hw = r * 0.5, hh = r * 0.62, bar = r * 0.12
    ring.flatRect(-hw / 2, 0, bar, hh, 0.8)
    ring.flatRect(hw / 2, 0, bar, hh, 0.8)
    ring.flatRect(0, 0, hw, bar, 0.8)
    this.ringMat = makeGlowMaterial(this.glowMaterial, this.glowColor)
    attachMesh(this.child("PadRing"), ring.build(), this.ringMat)

    this.applyGlow(1)
    this.createEvent("UpdateEvent").bind(() => {
      this.time += getDeltaTime()
      const p = this.pulsePeriodSec > 0 ? 0.5 + 0.5 * Math.sin((2 * Math.PI * this.time) / this.pulsePeriodSec) : 1
      this.applyGlow(0.75 + 0.25 * p)
    })
  }

  private applyGlow(k: number): void {
    setGlow(this.ringMat, this.glowColor, k)
    setGlow(this.fillMat, this.glowColor, 0.22 * k)
  }

  private child(name: string): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    return so
  }
}
