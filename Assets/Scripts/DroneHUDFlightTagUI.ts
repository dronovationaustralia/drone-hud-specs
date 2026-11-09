// DroneHUDFlightTagUI.ts
// Owns: the flight tag — ONE line of text, no panel or background box, ~20 cm to the right of
//       the drone, always turned to face the user. Presentation only: text, colour (white
//       semi-transparent / solid amber), opacity, follow + billboard.
// Expects: target = the "Drone" SceneObject, viewer = the camera SceneObject. Sits on the
//          authored "FlightTag" SceneObject; the text lives on its child "TagText".
// Must not: compute telemetry or decide when to warn. The controller pushes values in via
//           setTelemetry / setWarning / showLanded / setOpacity.
//
// Hard Rule 3 note: the tag is deliberately a bare Component.Text (the brief asks for "no panel
// or background box, just text"), so it uses no BackPlate/Frame. A single line needs no layout.

@component
export class DroneHUDFlightTagUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDFlightTagUI – billboarded H / D / battery tag beside the drone</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The drone the tag follows.")
  target!: SceneObject

  @input
  @hint("The user's camera — the tag turns to face it and sits to its right of the drone.")
  viewer!: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Letter height in cm (font em height; capitals are ~70% of this). Brief suggested ~8 cm; 6 cm keeps the whole line inside the ~32 deg view at 3 m.")
  @widget(new SliderWidget(2, 15, 0.5))
  letterHeightCm: number = 6

  @input
  @hint("Gap between the drone's right side and the start of the text, in cm (text starts ~23 cm from the drone centre by default).")
  @widget(new SliderWidget(0, 60, 1))
  gapFromDroneCm: number = 6

  @input
  @hint("Half the drone's width in cm, so the gap is measured from its side.")
  @widget(new SliderWidget(0, 40, 0.5))
  droneHalfWidthCm: number = 17.5

  @input('vec4', '{1,1,1,0.75}')
  @widget(new ColorWidget())
  @hint("Normal tag colour: white, slightly transparent.")
  normalColor: vec4 = new vec4(1, 1, 1, 0.75)

  @input('vec4', '{1,0.69,0.1,1}')
  @widget(new ColorWidget())
  @hint("Warning colour at and below the return threshold: solid amber.")
  warningColor: vec4 = new vec4(1, 0.69, 0.1, 1)

  @input
  @hint("Text shown on touchdown.")
  landedText: string = "Landed"
  @ui.group_end

  private text!: Text
  private textObj!: SceneObject
  private amber = false
  private opacity = 0

  onAwake(): void {
    this.textObj = global.scene.createSceneObject("TagText")
    this.textObj.setParent(this.sceneObject)
    this.text = this.textObj.createComponent("Component.Text") as Text
    this.text.depthTest = true
    // em-square cm = size / 43.886 (specs-build-ui type-scale calibration)
    this.text.size = this.letterHeightCm * 43.886
    this.text.horizontalAlignment = HorizontalAlignment.Left
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Overflow
    this.text.verticalOverflow = VerticalOverflow.Overflow
    const h = this.letterHeightCm
    this.text.layoutRect = Rect.create(0, 200, -h, h)
    this.text.text = ""
    this.applyColor()
    this.textObj.enabled = false

    this.createEvent("LateUpdateEvent").bind(() => this.follow())
  }

  // ── Public API (controller → tag) ────────────────────────────────

  setTelemetry(heightM: number, distanceM: number, batteryPct: number): void {
    this.text.text = `H ${heightM.toFixed(1)} m · D ${distanceM.toFixed(1)} m · ${Math.round(batteryPct)}%`
  }

  setWarning(on: boolean): void {
    this.amber = on
    this.applyColor()
  }

  showLanded(): void {
    this.amber = false
    this.text.text = this.landedText
    this.applyColor()
  }

  /** 0 hides the tag entirely; >0 shows it at that opacity. */
  setOpacity(a: number): void {
    this.opacity = Math.max(0, Math.min(1, a))
    this.textObj.enabled = this.opacity > 0.001
    this.applyColor()
  }

  isVisible(): boolean {
    return this.textObj.enabled
  }

  getText(): string {
    return this.text.text
  }

  isAmber(): boolean {
    return this.amber
  }

  getColor(): vec4 {
    return this.text.textFill.color
  }

  // ── Internals ─────────────────────────────────────────────────────

  private applyColor(): void {
    const c = this.amber ? this.warningColor : this.normalColor
    this.text.textFill.color = new vec4(c.x, c.y, c.z, c.w * this.opacity)
  }

  private follow(): void {
    if (!this.target || !this.viewer) return
    const dronePos = this.target.getTransform().getWorldPosition()
    const camPos = this.viewer.getTransform().getWorldPosition()
    const toDrone = dronePos.sub(camPos)
    let right = toDrone.cross(vec3.up())
    if (right.length < 1e-4) right = vec3.right()
    right = right.normalize()
    // Text block starts gapFromDroneCm beyond the drone's right side, vertically centred on it.
    const anchor = dronePos
      .add(right.uniformScale(this.droneHalfWidthCm + this.gapFromDroneCm))
      .add(new vec3(0, 9, 0)) // drone mesh is grounded; its visual centre is ~9 cm above its origin
    const t = this.sceneObject.getTransform()
    t.setWorldPosition(anchor)
    // Billboard: local +Z (text front) points at the user, kept upright.
    const toCam = camPos.sub(anchor)
    if (toCam.length > 1e-3) t.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
  }
}
