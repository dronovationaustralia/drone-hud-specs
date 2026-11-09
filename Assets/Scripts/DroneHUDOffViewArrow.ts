// DroneHUDOffViewArrow.ts
// Owns: the small amber off-view arrow. Each frame while tracking is enabled it checks whether
//       the target is inside the camera's view; if not, it shows an arrowhead at the edge of the
//       view pointing toward the target, and hides it as soon as the target is back in view.
// Expects: camera = the main Camera component, target = "Drone". Sits on the authored
//          "OffViewArrow" SceneObject; the arrow mesh lives on its child "ArrowVisual".
// Must not: decide when tracking applies — the controller calls setTracking(true) only during
//           flight.

import {GeometryBuilder, attachMesh, makeGlowMaterial, setGlow} from "./DroneHUDGeometry"

@component
export class DroneHUDOffViewArrow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDOffViewArrow – edge-of-view arrow toward the drone</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The user's main camera (used for the in-view test and edge placement).")
  camera!: Camera

  @input
  @hint("What the arrow points at (the drone).")
  target!: SceneObject

  @input
  @hint("Unlit base material; cloned and switched to additive blending at runtime.")
  glowMaterial!: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input('vec4', '{1,0.69,0.1,1}')
  @widget(new ColorWidget())
  @hint("Arrow colour (amber by default).")
  arrowColor: vec4 = new vec4(1, 0.69, 0.1, 1)

  @input
  @hint("How far in from the view edge the arrow sits (normalized screen units, 0-0.4).")
  @widget(new SliderWidget(0.02, 0.4, 0.01))
  edgeInset: number = 0.1

  @input
  @hint("Arrow length in cm at 100 cm from the eye.")
  @widget(new SliderWidget(1, 10, 0.5))
  arrowSizeCm: number = 4
  @ui.group_end

  private visual!: SceneObject
  private mat!: Material
  private tracking = false
  private showing = false
  private targetInView = true
  private readonly depthCm = 100

  onAwake(): void {
    if (!this.glowMaterial) {
      print("[DroneHUDOffViewArrow] ERROR: glowMaterial not assigned")
      return
    }
    this.visual = global.scene.createSceneObject("ArrowVisual")
    this.visual.setParent(this.sceneObject)
    const s = this.arrowSizeCm
    const g = new GeometryBuilder()
    const n = new vec3(0, 0, 1)
    // Arrowhead pointing +Y in the local XY plane.
    g.tri(new vec3(0, s * 0.5, 0), new vec3(-s * 0.45, -s * 0.4, 0), new vec3(0, -s * 0.15, 0), n)
    g.tri(new vec3(0, s * 0.5, 0), new vec3(0, -s * 0.15, 0), new vec3(s * 0.45, -s * 0.4, 0), n)
    this.mat = makeGlowMaterial(this.glowMaterial, this.arrowColor)
    this.mat.mainPass.depthTest = false // always readable over the world
    setGlow(this.mat, this.arrowColor, 1)
    attachMesh(this.visual, g.build(), this.mat)
    this.visual.enabled = false
    this.createEvent("LateUpdateEvent").bind(() => this.tick())
  }

  setTracking(on: boolean): void {
    this.tracking = on
    if (!on) this.setShowing(false)
  }

  isShowing(): boolean {
    return this.showing
  }

  /** Last in-view test result (true when the target is inside the camera view). */
  isTargetInView(): boolean {
    return this.targetInView
  }

  private setShowing(on: boolean): void {
    this.showing = on
    if (this.visual) this.visual.enabled = on
  }

  private tick(): void {
    if (!this.camera || !this.target || !this.visual) return
    const camT = this.camera.getSceneObject().getTransform()
    const p = this.target.getTransform().getWorldPosition().add(new vec3(0, 9, 0))
    const local = camT.getInvertedWorldTransform().multiplyPoint(p)
    const inFront = local.z < 0
    let inView = false
    if (inFront) {
      const sp = this.camera.worldSpaceToScreenSpace(p)
      inView = sp.x >= 0 && sp.x <= 1 && sp.y >= 0 && sp.y <= 1
    }
    this.targetInView = inView

    if (!this.tracking || inView) {
      this.setShowing(false)
      return
    }
    this.setShowing(true)

    // Direction toward the target in the view plane (camera-local x right, y up).
    let dx = local.x
    let dy = local.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-3) {
      dx = 1
      dy = 0
    } else {
      dx /= len
      dy /= len
    }
    const half = 0.5 - this.edgeInset
    const t = Math.min(Math.abs(dx) > 1e-4 ? half / Math.abs(dx) : 1e6, Math.abs(dy) > 1e-4 ? half / Math.abs(dy) : 1e6)
    const screen = new vec2(0.5 + dx * t, 0.5 - dy * t) // screen y grows downward
    const world = this.camera.screenSpaceToWorldSpace(screen, this.depthCm)
    const vt = this.visual.getTransform()
    vt.setWorldPosition(world)
    const angle = Math.atan2(-dx, dy)
    vt.setWorldRotation(camT.getWorldRotation().multiply(quat.angleAxis(angle, vec3.forward())))
  }
}
