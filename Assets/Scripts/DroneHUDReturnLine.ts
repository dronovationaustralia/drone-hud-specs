// DroneHUDReturnLine.ts
// Owns: the amber return line — a thin glowing column stretched each frame from the drone down
//       to the centre of the home pad. Presentation only (geometry, colour, opacity).
// Expects: from = "Drone" SceneObject, to = "HomePad" SceneObject, glowMaterial = an unlit
//          material (cloned + set to additive at runtime). Sits on the authored "ReturnLine"
//          SceneObject; the mesh lives on its child "LineVisual".
// Must not: decide when it shows — the controller calls setOpacity().

import {GeometryBuilder, attachMesh, makeGlowMaterial, setGlow} from "./DroneHUDGeometry"

@component
export class DroneHUDReturnLine extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDReturnLine – amber line from drone to home pad</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Line start (the drone).")
  from!: SceneObject

  @input
  @hint("Line end (the home pad — the line lands on its centre).")
  to!: SceneObject

  @input
  @hint("Unlit base material; cloned and switched to additive blending at runtime.")
  glowMaterial!: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input('vec4', '{1,0.55,0.05,1}')
  @widget(new ColorWidget())
  @hint("Line colour (amber by default).")
  lineColor: vec4 = new vec4(1, 0.55, 0.05, 1)

  @input
  @hint("Line thickness in cm.")
  @widget(new SliderWidget(0.3, 5, 0.1))
  thicknessCm: number = 1.4
  @ui.group_end

  private visual!: SceneObject
  private mat!: Material
  private opacity = 0

  onAwake(): void {
    if (!this.glowMaterial) {
      print("[DroneHUDReturnLine] ERROR: glowMaterial not assigned")
      return
    }
    this.visual = global.scene.createSceneObject("LineVisual")
    this.visual.setParent(this.sceneObject)
    const g = new GeometryBuilder()
    g.unitColumn()
    this.mat = makeGlowMaterial(this.glowMaterial, this.lineColor)
    attachMesh(this.visual, g.build(), this.mat)
    this.visual.enabled = false
    this.createEvent("LateUpdateEvent").bind(() => this.layout())
  }

  setOpacity(a: number): void {
    this.opacity = Math.max(0, Math.min(1, a))
    if (!this.visual) return
    this.visual.enabled = this.opacity > 0.001
    setGlow(this.mat, this.lineColor, this.opacity)
  }

  getOpacity(): number {
    return this.opacity
  }

  isVisible(): boolean {
    return !!this.visual && this.visual.enabled
  }

  private layout(): void {
    if (!this.visual || !this.visual.enabled || !this.from || !this.to) return
    // Start a little below the drone body centre, end on the pad surface centre.
    const a = this.to.getTransform().getWorldPosition().add(new vec3(0, 1.5, 0))
    const b = this.from.getTransform().getWorldPosition().add(new vec3(0, 4, 0))
    const d = b.sub(a)
    const len = d.length
    const t = this.visual.getTransform()
    t.setWorldPosition(a)
    if (len < 0.5) {
      t.setWorldScale(new vec3(this.thicknessCm, 0.01, this.thicknessCm))
      return
    }
    // Rotate the column's +Y onto the pad->drone direction.
    t.setWorldRotation(quat.rotationFromTo(vec3.up(), d.normalize()))
    t.setWorldScale(new vec3(this.thicknessCm, len, this.thicknessCm))
  }
}
