// DroneHUDPreflightCardUI.ts
// Owns: the pre-flight card (UIKit BackPlate + FlexLayout column): small battery row
//       (icon + "Battery 100%") above a big pill-shaped UIKit "Start flight" Button
//       (Capsule shape, clear outline, hover/press highlight, icon + label inside).
// Expects: to sit on the authored "PreflightCard" SceneObject (~1 m height beside the home pad).
//          Icons at Assets/Icons/{flight_takeoff,battery_full}.png, ImageMaterial at
//          Assets/Materials/ImageMaterial.mat.
// Must not: hold flight state or decide anything. Passive view: the controller calls
//           show()/hide()/setBatteryPercent(); the card reports intent via onStartFlight.
//
// Stable names for testing: "CardVisual" (toggled by show/hide) and "StartFlightButton".
// Length note (~280 lines): the shared type-scale block + per-row UIKit composition; one panel.

import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {
  FlexAlign,
  FlexAlignSelf,
  FlexDirection,
  FlexJustify,
} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {RoundedRectangleVisual} from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangleVisual"

// ── Type scale — single source of truth (specs-build-ui patterns.md → Typography)
const FONT_SIZE_SCALE = 1.0
type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

const ICON_TAKEOFF: Texture = requireAsset("../Icons/flight_takeoff.png") as Texture
const ICON_BATTERY: Texture = requireAsset("../Icons/battery_full.png") as Texture
const imageMaterial = requireAsset("../Materials/ImageMaterial.mat") as Material

const BUTTON_LABEL_Z = 0.08

@component
export class DroneHUDPreflightCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">DroneHUDPreflightCardUI – pre-flight card with Start flight button</span>')
  @ui.separator

  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Viewing distance (cm) the text is sized for. The card sits ~1.9 m from the user, so text scales up from the 110 cm baseline.")
  @widget(new SliderWidget(80, 300, 5))
  viewingDistanceCm: number = 190

  @input
  @hint("Card width in cm.")
  @widget(new SliderWidget(20, 60, 1))
  panelWidthCm: number = 34

  @input
  @hint("Label on the big start button.")
  buttonLabel: string = "Start flight"

  @input
  @hint("Start button pill size (width, height) in cm. Big target, easy to pinch.")
  startPillSizeCm: vec2 = new vec2(18, 7)

  @input
  @hint("Start button outline thickness in cm (thicker on hover/press).")
  @widget(new SliderWidget(0.1, 1.0, 0.05))
  startButtonOutlineCm: number = 0.5

  @input('vec4', '{1,1,1,1}')
  @widget(new ColorWidget())
  @hint("Text colour (keep light — the display is additive, dark colours disappear).")
  textColor: vec4 = new vec4(1, 1, 1, 1)
  @ui.group_end

  private _onStartFlight = new Event<void>()
  get onStartFlight(): PublicApi<void> {
    return this._onStartFlight.publicApi()
  }

  private visual!: SceneObject
  private batteryText: Text | null = null
  private pendingBattery = 100
  private visible = true

  onAwake(): void {
    this.buildCard()
  }

  // ── Public API (controller → card) ────────────────────────────────

  show(): void {
    this.visible = true
    if (this.visual) this.visual.enabled = true
  }

  hide(): void {
    this.visible = false
    if (this.visual) this.visual.enabled = false
  }

  isVisible(): boolean {
    return this.visible
  }

  setBatteryPercent(pct: number): void {
    this.pendingBattery = Math.round(pct)
    if (this.batteryText) this.batteryText.text = `Battery ${this.pendingBattery}%`
  }

  getBatteryText(): string {
    return this.batteryText ? this.batteryText.text : `Battery ${this.pendingBattery}%`
  }

  // ── Build ─────────────────────────────────────────────────────────

  private buildCard(): void {
    const d = this.viewingDistanceCm
    const pad = 2.4 * (d / 110) * 0.6

    this.visual = this.obj(this.sceneObject, "CardVisual")
    this.visual.createComponent("Component.Canvas")
    const backPlate = this.visual.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = this.obj(this.visual, "Content", new vec3(0, 0, 0.6))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.width = this.panelWidthCm
    flex.height = -1
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Start
    flex.alignItems = FlexAlign.Center
    flex.rowGap = 1.4
    flex.paddingTop = pad
    flex.paddingBottom = pad
    flex.paddingLeft = pad
    flex.paddingRight = pad
    flex.onLayoutComplete.add((r) => {
      backPlate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    this.addBatteryRow(content)
    this.addStartButton(content)
  }

  private addBatteryRow(parent: SceneObject): void {
    const iconCm = 3.5
    const textW = 14
    const rowH = 4
    const row = this.obj(parent, "BatteryRow")
    const f = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    f.direction = FlexDirection.Row
    f.justifyContent = FlexJustify.Center
    f.alignItems = FlexAlign.Center
    f.columnGap = 1.0
    f.width = iconCm + 1 + textW
    f.height = rowH
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = iconCm + 1 + textW
    rowItem.overrideHeight = rowH

    this.addImage(row, ICON_BATTERY, iconCm, "BatteryIcon")

    const so = this.obj(row, "BatteryText")
    const t = so.createComponent("Component.Text") as Text
    t.text = `Battery ${this.pendingBattery}%`
    t.depthTest = true
    applyTextRole(t, "Caption", this.viewingDistanceCm)
    t.textFill.color = new vec4(this.textColor.x, this.textColor.y, this.textColor.z, 0.85)
    t.horizontalAlignment = HorizontalAlignment.Left
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-textW / 2, textW / 2, -rowH / 2, rowH / 2)
    const ti = so.createComponent(FlexItem.getTypeName()) as FlexItem
    ti.overrideWidth = textW
    ti.overrideHeight = rowH
    this.batteryText = t
  }

  private addStartButton(parent: SceneObject): void {
    const w = this.startPillSizeCm.x
    const h = this.startPillSizeCm.y
    const so = this.obj(parent, "StartFlightButton")
    const btn = so.createComponent(Button.getTypeName()) as Button
    // BEFORE init: pill (Capsule) shape + a style that ships with an outline and
    // hover/press background highlights.
    btn.setVariant({theme: "SnapOS2", shape: "Capsule", style: "Primary"})
    btn.size = new vec3(w, h, 1)
    btn.onInitialized.add(() => this.styleStartButtonOutline(btn))
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = w
    item.overrideHeight = h

    // Face content: icon + label in a row, lifted in front of the button face.
    const iconCm = 4.2
    const labelW = w - iconCm - 1 - 4 // ~2 cm clear of each rounded end of the pill
    const face = this.obj(so, "Face", new vec3(0, 0, BUTTON_LABEL_Z))
    const ff = face.createComponent(FlexLayout.getTypeName()) as FlexLayout
    ff.direction = FlexDirection.Row
    ff.justifyContent = FlexJustify.Center
    ff.alignItems = FlexAlign.Center
    ff.columnGap = 1.0
    ff.width = iconCm + 1 + labelW
    ff.height = h

    this.addImage(face, ICON_TAKEOFF, iconCm, "TakeoffIcon")

    const lo = this.obj(face, "ButtonLabel")
    const t = lo.createComponent("Component.Text") as Text
    t.text = this.buttonLabel
    t.depthTest = true
    applyTextRole(t, "Headline1", this.viewingDistanceCm)
    t.textFill.color = this.textColor
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink // fit the label inside the pill
    t.verticalOverflow = VerticalOverflow.Shrink
    t.layoutRect = Rect.create(-labelW / 2, labelW / 2, -h / 2, h / 2)
    const li = lo.createComponent(FlexItem.getTypeName()) as FlexItem
    li.overrideWidth = labelW
    li.overrideHeight = h

    btn.onTriggerUp.add(() => {
      if (!this.visible) return
      this.hide() // card disappears as soon as Start flight is pinched
      this._onStartFlight.invoke()
    })
  }

  // Clear, light outline on the pill (additive display: light reads, dark vanishes).
  // Thicker, warm-white outline on hover; bright white while pressed.
  private styleStartButtonOutline(btn: Button): void {
    const v = btn.visual
    if (!(v instanceof RoundedRectangleVisual)) return
    const o = this.startButtonOutlineCm
    v.defaultHasBorder = true
    v.hoveredHasBorder = true
    v.triggeredHasBorder = true
    v.defaultBorderType = "Color"
    v.hoveredBorderType = "Color"
    v.triggeredBorderType = "Color"
    v.borderDefaultColor = new vec4(0.95, 0.97, 1.0, 1.0)
    v.borderHoveredColor = new vec4(1.0, 0.9, 0.55, 1.0)
    v.borderTriggeredColor = new vec4(1.0, 1.0, 1.0, 1.0)
    v.defaultBorderSize = o
    v.hoveredBorderSize = o * 1.6
    v.triggeredBorderSize = o * 1.6
  }

  private addImage(parent: SceneObject, texture: Texture, sizeCM: number, name: string): void {
    const so = this.obj(parent, name)
    const img = so.createComponent("Component.Image") as Image
    const mat = imageMaterial.clone()
    mat.mainPass.baseTex = texture
    mat.mainPass.depthTest = true
    mat.mainPass.depthWrite = false
    img.clearMaterials()
    img.addMaterial(mat)
    so.getTransform().setLocalScale(new vec3(sizeCM, sizeCM, 1))
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = sizeCM
    item.overrideHeight = sizeCM
  }

  private obj(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    if (position) so.getTransform().setLocalPosition(position)
    return so
  }
}
