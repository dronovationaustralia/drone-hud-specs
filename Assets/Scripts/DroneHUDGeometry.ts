// DroneHUDGeometry.ts
// Owns: tiny MeshBuilder helpers for the code-authored HUD geometry (home pad disc/ring/"H",
//       return-line box, off-view arrowhead) and the shared glow-material setup.
// Expects: nothing (plain module, no @component).
// Must not: touch scene state or hold game state.
//
// All glow materials are drawn two-sided with additive blending, so winding order never
// matters and black reads as transparent (matches the Specs additive display).

const LAYOUT = [
  {name: "position", components: 3},
  {name: "normal", components: 3},
  {name: "texture0", components: 2},
]

export class GeometryBuilder {
  private builder: MeshBuilder
  private count = 0

  constructor() {
    this.builder = new MeshBuilder(LAYOUT)
    this.builder.topology = MeshTopology.Triangles
    this.builder.indexType = MeshIndexType.UInt16
  }

  /** Adds a quad p0-p1-p2-p3 (any winding — materials are two-sided). */
  quad(p0: vec3, p1: vec3, p2: vec3, p3: vec3, n: vec3): void {
    const v = [p0, p1, p2, p3]
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]]
    for (let i = 0; i < 4; i++) {
      this.builder.appendVerticesInterleaved([v[i].x, v[i].y, v[i].z, n.x, n.y, n.z, uv[i][0], uv[i][1]])
    }
    const b = this.count
    this.builder.appendIndices([b, b + 1, b + 2, b, b + 2, b + 3])
    this.count += 4
  }

  tri(p0: vec3, p1: vec3, p2: vec3, n: vec3): void {
    for (const p of [p0, p1, p2]) {
      this.builder.appendVerticesInterleaved([p.x, p.y, p.z, n.x, n.y, n.z, 0.5, 0.5])
    }
    const b = this.count
    this.builder.appendIndices([b, b + 1, b + 2])
    this.count += 3
  }

  /** Flat ring in the XZ plane (y = height), facing +Y. inner = 0 gives a filled disc. */
  ring(inner: number, outer: number, height: number, segments: number): void {
    const up = vec3.up()
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2
      const a1 = ((i + 1) / segments) * Math.PI * 2
      const o0 = new vec3(Math.cos(a0) * outer, height, Math.sin(a0) * outer)
      const o1 = new vec3(Math.cos(a1) * outer, height, Math.sin(a1) * outer)
      const i0 = new vec3(Math.cos(a0) * inner, height, Math.sin(a0) * inner)
      const i1 = new vec3(Math.cos(a1) * inner, height, Math.sin(a1) * inner)
      this.quad(i0, o0, o1, i1, up)
    }
  }

  /** Flat axis-aligned rectangle in the XZ plane centred at (cx, height, cz). */
  flatRect(cx: number, cz: number, w: number, d: number, height: number): void {
    const hw = w / 2
    const hd = d / 2
    this.quad(
      new vec3(cx - hw, height, cz - hd),
      new vec3(cx + hw, height, cz - hd),
      new vec3(cx + hw, height, cz + hd),
      new vec3(cx - hw, height, cz + hd),
      vec3.up()
    )
  }

  /** Unit box spanning x,z in [-0.5, 0.5] and y in [0, 1] (scale y = length). */
  unitColumn(): void {
    const x0 = -0.5, x1 = 0.5, z0 = -0.5, z1 = 0.5, y0 = 0, y1 = 1
    this.quad(new vec3(x0, y0, z1), new vec3(x1, y0, z1), new vec3(x1, y1, z1), new vec3(x0, y1, z1), new vec3(0, 0, 1))
    this.quad(new vec3(x1, y0, z0), new vec3(x0, y0, z0), new vec3(x0, y1, z0), new vec3(x1, y1, z0), new vec3(0, 0, -1))
    this.quad(new vec3(x1, y0, z1), new vec3(x1, y0, z0), new vec3(x1, y1, z0), new vec3(x1, y1, z1), new vec3(1, 0, 0))
    this.quad(new vec3(x0, y0, z0), new vec3(x0, y0, z1), new vec3(x0, y1, z1), new vec3(x0, y1, z0), new vec3(-1, 0, 0))
  }

  build(): RenderMesh {
    this.builder.updateMesh()
    return this.builder.getMesh()
  }
}

/** Clones the glow material and configures it for an additive, two-sided, no-depth-write glow. */
export function makeGlowMaterial(base: Material, color: vec4): Material {
  const mat = base.clone()
  const pass = mat.mainPass
  pass.blendMode = BlendMode.Add
  pass.twoSided = true
  pass.depthWrite = false
  pass.depthTest = true
  pass.baseColor = color
  return mat
}

/** Sets an additive glow colour scaled by intensity (additive: fading toward black = fading out). */
export function setGlow(mat: Material, color: vec4, intensity: number): void {
  const k = Math.max(0, Math.min(1, intensity))
  mat.mainPass.baseColor = new vec4(color.x * k, color.y * k, color.z * k, k)
}

export function attachMesh(target: SceneObject, mesh: RenderMesh, mat: Material): RenderMeshVisual {
  const rmv = target.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  rmv.mesh = mesh
  rmv.mainMaterial = mat
  return rmv
}
