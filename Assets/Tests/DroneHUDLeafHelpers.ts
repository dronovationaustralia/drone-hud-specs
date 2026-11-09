// DroneHUDLeafHelpers.ts — shared helpers for the Drone HUD LEAF scenarios (test-only).
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DroneHUDController} from "../Scripts/DroneHUDController"

export function getController(): DroneHUDController {
  const so = findSceneObjectByName("DroneHUDController")
  if (!so) throw new Error("SceneObject 'DroneHUDController' not found")
  const c = so.getComponent(DroneHUDController.getTypeName()) as DroneHUDController
  if (!c) throw new Error("DroneHUDController component not found")
  return c
}

export function getCameraObject(): SceneObject {
  const so = findSceneObjectByName("Camera Object")
  if (!so) throw new Error("SceneObject 'Camera Object' not found")
  return so
}

export function getCamera(): Camera {
  return getCameraObject().getComponent("Component.Camera") as Camera
}

/** Point in camera-local space (x right, y up, -z forward). */
export function toCameraLocal(p: vec3): vec3 {
  return getCameraObject().getTransform().getInvertedWorldTransform().multiplyPoint(p)
}

export function log(msg: string): void {
  print("[DroneHUDLeaf] " + msg)
}

/** Polls cond every pollMs until true or timeout. Returns elapsed ms; throws on timeout. */
export async function waitFor(
  cond: () => boolean,
  timeoutMs: number,
  what: string,
  pollMs: number = 50,
): Promise<number> {
  const t0 = getTime()
  while (!cond()) {
    if ((getTime() - t0) * 1000 > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${what}`)
    }
    await sleep(pollMs)
  }
  return (getTime() - t0) * 1000
}

export function fmt(v: vec3): string {
  return `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
}

/**
 * Holds the camera at a given world pose every frame (UpdateEvent on the owning script),
 * so DeviceTracking / preview navigation cannot pull it back mid-check. Call release() to stop.
 */
export class CameraHold {
  private ev: SceneEvent | null = null
  private pos: vec3
  private rot: quat

  constructor(private owner: BaseScriptComponent) {
    const t = getCameraObject().getTransform()
    this.pos = t.getWorldPosition()
    this.rot = t.getWorldRotation()
  }

  private tracking: DeviceTracking | null = null

  set(pos: vec3, rot: quat): void {
    this.pos = pos
    this.rot = rot
    if (!this.tracking) {
      // DeviceTracking rewrites the camera pose every frame; pause it while simulating a head pose.
      this.tracking = getCameraObject().getComponent("Component.DeviceTracking") as DeviceTracking
      if (this.tracking) this.tracking.enabled = false
    }
    this.apply()
    if (!this.ev) {
      this.ev = this.owner.createEvent("UpdateEvent")
      this.ev.bind(() => this.apply())
    }
  }

  private apply(): void {
    const t = getCameraObject().getTransform()
    t.setWorldPosition(this.pos)
    t.setWorldRotation(this.rot)
  }

  release(): void {
    if (this.ev) {
      this.owner.removeEvent(this.ev)
      this.ev = null
    }
    if (this.tracking) {
      this.tracking.enabled = true
      this.tracking = null
    }
  }
}
