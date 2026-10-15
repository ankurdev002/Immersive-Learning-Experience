import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { createPaintingTexture, type PaintingStyle } from './ArtTextures'

/**
 * Furniture & decor builders for the redesigned chambers. Every builder returns a Group in its own
 * local space (floor at y = 0) so callers just position it. Static pieces are later merged into one
 * mesh per material by JapaneseRoomService.optimizeStaticMeshes, so the detail here costs very few
 * draw calls; repeated small items (library books, lattice bars) use InstancedMesh.
 */

export interface RoomPalette {
  walnut: THREE.MeshStandardMaterial
  walnutDark: THREE.MeshStandardMaterial
  brass: THREE.MeshStandardMaterial
  ceramic: THREE.MeshStandardMaterial
  celadon: THREE.MeshStandardMaterial
  paperGlow: THREE.MeshStandardMaterial
  paper: THREE.MeshStandardMaterial
  stone: THREE.MeshStandardMaterial
  cushionIndigo: THREE.MeshStandardMaterial
  cushionRust: THREE.MeshStandardMaterial
  linenGreen: THREE.MeshStandardMaterial
  leaf: THREE.MeshStandardMaterial
  leafDark: THREE.MeshStandardMaterial
  blossom: THREE.MeshStandardMaterial
  bark: THREE.MeshStandardMaterial
  iron: THREE.MeshStandardMaterial
  glass: THREE.MeshStandardMaterial
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

/**
 * Box-projected UVs in real-world units (one texture tile = `tile` metres), with the wood grain
 * (texture U axis for the veneer scans) aligned to each piece's longest dimension. Gives every
 * board, leg and rail consistent grain scale instead of the stretched 0..1 UVs of primitives.
 */
export function projectWoodUVs<T extends THREE.BufferGeometry>(geometry: T, tile = 0.5): T {
  geometry.computeBoundingBox()
  const size = geometry.boundingBox!.getSize(new THREE.Vector3())
  const dims = [size.x, size.y, size.z]
  const longest = dims.indexOf(Math.max(...dims))
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const nrm = geometry.getAttribute('normal') as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  const p = [0, 0, 0]
  for (let i = 0; i < pos.count; i++) {
    p[0] = pos.getX(i)
    p[1] = pos.getY(i)
    p[2] = pos.getZ(i)
    const ax = Math.abs(nrm.getX(i))
    const ay = Math.abs(nrm.getY(i))
    const az = Math.abs(nrm.getZ(i))
    const dominant = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2
    let uAxis = dominant === 0 ? 2 : 0
    let vAxis = dominant === 1 ? 2 : 1
    if (vAxis === longest) {
      const t = uAxis
      uAxis = vAxis
      vAxis = t
    }
    uv[i * 2] = p[uAxis]! / tile
    uv[i * 2 + 1] = p[vAxis]! / tile
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return geometry
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  opts: { cast?: boolean; receive?: boolean } = {}
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = opts.cast ?? true
  mesh.receiveShadow = opts.receive ?? true
  return mesh
}

const woodBox = (w: number, h: number, d: number, radius = 0) =>
  projectWoodUVs(radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d))

/** Square leg tapering toward the floor (a 4-sided cylinder turned 45°). */
function taperedLeg(topSide: number, bottomSide: number, height: number) {
  const g = new THREE.CylinderGeometry(topSide / Math.SQRT2, bottomSide / Math.SQRT2, height, 4, 1)
  g.rotateY(Math.PI / 4)
  // Non-indexed + recomputed normals = crisp flat faces instead of a smooth-shaded "round" square
  const flat = g.toNonIndexed()
  flat.computeVertexNormals()
  return projectWoodUVs(flat)
}

function tube(points: THREE.Vector3[], radius: number, segments = 24, radial = 8) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, radial, false)
}

// ---------------------------------------------------------------------------
// Study room
// ---------------------------------------------------------------------------

/** Solid walnut writing desk: rounded slab top, tapered legs, aprons, drawers, linen desk mat. */
export function createDesk(
  p: RoomPalette,
  opts: { width?: number; depth?: number; topY?: number; drawers?: number; mat?: boolean } = {}
): THREE.Group {
  const width = opts.width ?? 2.3
  const depth = opts.depth ?? 1.1
  const topY = opts.topY ?? 0.795
  const g = new THREE.Group()
  const slab = 0.06

  g.add(part(woodBox(width, slab, depth, 0.012), p.walnut, 0, topY - slab / 2, 0))

  const legH = topY - slab
  const lx = width / 2 - 0.13
  const lz = depth / 2 - 0.1
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]] as const) {
    g.add(part(taperedLeg(0.07, 0.045, legH), p.walnut, x, legH / 2, z))
  }

  const apronY = topY - slab - 0.055
  g.add(part(woodBox(width - 0.3, 0.1, 0.024), p.walnut, 0, apronY, -lz))
  g.add(part(woodBox(width - 0.3, 0.1, 0.024), p.walnut, 0, apronY, lz))
  g.add(part(woodBox(0.024, 0.1, depth - 0.24), p.walnut, -lx, apronY, 0))
  g.add(part(woodBox(0.024, 0.1, depth - 0.24), p.walnut, lx, apronY, 0))

  // Drawer fronts with brass bar pulls on the sitter's side (+Z)
  const drawers = opts.drawers ?? 2
  const drawerW = (width - 0.5) / drawers - 0.06
  for (let i = 0; i < drawers; i++) {
    const x = -((drawers - 1) / 2) * (drawerW + 0.06) + i * (drawerW + 0.06)
    g.add(part(woodBox(drawerW, 0.072, 0.01), p.walnutDark, x, apronY, lz + 0.016, { cast: false }))
    const pull = new THREE.CylinderGeometry(0.0055, 0.0055, Math.min(0.12, drawerW * 0.3), 10)
    pull.rotateZ(Math.PI / 2)
    g.add(part(pull, p.brass, x, apronY, lz + 0.034, { cast: false }))
    for (const s of [-1, 1]) {
      g.add(part(new THREE.CylinderGeometry(0.004, 0.004, 0.016, 6).rotateX(Math.PI / 2), p.brass, x + s * Math.min(0.05, drawerW * 0.13), apronY, lz + 0.026, { cast: false }))
    }
  }

  // H-stretcher near the floor
  g.add(part(woodBox(0.03, 0.034, depth - 0.2), p.walnut, -lx, 0.13, 0))
  g.add(part(woodBox(0.03, 0.034, depth - 0.2), p.walnut, lx, 0.13, 0))
  g.add(part(woodBox(width - 0.26, 0.034, 0.03), p.walnut, 0, 0.13, 0))

  if (opts.mat !== false) {
    const deskMat = new RoundedBoxGeometry(1.25, 0.004, 0.66, 2, 0.0018)
    g.add(part(deskMat, p.linenGreen, 0, topY + 0.002, 0.07, { cast: false }))
  }
  return g
}

/** Ming-style yoke-back chair facing -Z (towards the desk), seat at 0.45m with an indigo cushion. */
export function createChair(p: RoomPalette): THREE.Group {
  const g = new THREE.Group()
  const seatY = 0.45
  const lx = 0.22
  const lz = 0.2

  for (const [x, z] of [[-lx, -lz], [lx, -lz]] as const) {
    g.add(part(projectWoodUVs(new THREE.CylinderGeometry(0.019, 0.015, seatY, 12)), p.walnut, x, seatY / 2, z))
  }
  // Rear legs continue upward into the back posts with a gentle backward rake
  for (const x of [-lx, lx]) {
    g.add(part(projectWoodUVs(tube([
      new THREE.Vector3(x, 0, lz),
      new THREE.Vector3(x, seatY, lz),
      new THREE.Vector3(x * 0.98, 0.72, lz + 0.035),
      new THREE.Vector3(x * 0.95, 0.93, lz + 0.03),
    ], 0.017, 28, 10)), p.walnut))
  }

  g.add(part(woodBox(0.52, 0.035, 0.48, 0.008), p.walnut, 0, seatY, 0))
  g.add(part(new RoundedBoxGeometry(0.46, 0.04, 0.42, 3, 0.016), p.cushionIndigo, 0, seatY + 0.036, -0.01))

  // Yoke crest rail with upturned ends
  g.add(part(projectWoodUVs(tube([
    new THREE.Vector3(-0.3, 0.965, lz + 0.02),
    new THREE.Vector3(-0.21, 0.945, lz + 0.03),
    new THREE.Vector3(0, 0.955, lz + 0.04),
    new THREE.Vector3(0.21, 0.945, lz + 0.03),
    new THREE.Vector3(0.3, 0.965, lz + 0.02),
  ], 0.019, 32, 10)), p.walnut))

  // S-curved splat (shaped to the sitter's back)
  const splat = new THREE.BoxGeometry(0.16, 0.44, 0.014, 1, 14, 1)
  const sp = splat.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < sp.count; i++) {
    const t = (sp.getY(i) + 0.22) / 0.44
    sp.setZ(i, sp.getZ(i) + 0.03 * Math.sin(Math.PI * 1.2 * t) - 0.012 * t)
  }
  splat.computeVertexNormals()
  g.add(part(projectWoodUVs(splat), p.walnutDark, 0, seatY + 0.255, lz + 0.03))

  // Stretchers and a shaped front apron
  for (const z of [-lz, lz]) {
    g.add(part(new THREE.CylinderGeometry(0.008, 0.008, lx * 2, 8).rotateZ(Math.PI / 2), p.walnut, 0, 0.15, z, { cast: false }))
  }
  for (const x of [-lx, lx]) {
    g.add(part(new THREE.CylinderGeometry(0.008, 0.008, lz * 2, 8).rotateX(Math.PI / 2), p.walnut, x, 0.2, 0, { cast: false }))
  }
  g.add(part(woodBox(0.42, 0.045, 0.014), p.walnutDark, 0, seatY - 0.04, -lz, { cast: false }))
  return g
}

/** Side-handled kyusu teapot on a walnut tray. Origin = tray bottom centre. */
export function createTeaSet(p: RoomPalette): THREE.Group {
  const g = new THREE.Group()
  g.add(part(woodBox(0.26, 0.014, 0.18, 0.005), p.walnutDark, 0, 0.007, 0, { cast: false }))
  g.add(part(woodBox(0.26, 0.012, 0.012), p.walnutDark, 0, 0.018, -0.084, { cast: false }))
  g.add(part(woodBox(0.26, 0.012, 0.012), p.walnutDark, 0, 0.018, 0.084, { cast: false }))

  const body = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.038, 0),
    new THREE.Vector2(0.055, 0.02),
    new THREE.Vector2(0.06, 0.045),
    new THREE.Vector2(0.052, 0.072),
    new THREE.Vector2(0.036, 0.082),
    new THREE.Vector2(0, 0.082),
  ], 32)
  const pot = new THREE.Group()
  pot.position.set(0.02, 0.014, 0)
  pot.add(part(body, p.celadon))
  pot.add(part(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.098),
    new THREE.Vector2(0.035, 0.088),
    new THREE.Vector2(0.038, 0.082),
    new THREE.Vector2(0, 0.082),
  ], 24), p.celadon))
  pot.add(part(new THREE.SphereGeometry(0.009, 12, 8), p.celadon, 0, 0.1, 0))
  pot.add(part(tube([
    new THREE.Vector3(0.05, 0.03, 0),
    new THREE.Vector3(0.075, 0.05, 0),
    new THREE.Vector3(0.088, 0.075, 0),
  ], 0.008, 12, 8), p.celadon))
  // Kyusu side handle at 90° to the spout
  const handle = new THREE.CylinderGeometry(0.009, 0.012, 0.075, 10)
  handle.rotateX(Math.PI / 2)
  pot.add(part(handle, p.celadon, 0, 0.045, -0.085))
  g.add(pot)

  const cupL = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.002),
    new THREE.Vector2(0.024, 0.002),
    new THREE.Vector2(0.028, 0.03),
    new THREE.Vector2(0.026, 0.032),
    new THREE.Vector2(0.022, 0.006),
    new THREE.Vector2(0, 0.006),
  ], 20)
  g.add(part(cupL, p.ceramic, -0.085, 0.014, 0.035))
  return g
}

let emberMaterial: THREE.MeshStandardMaterial | undefined

/** Ceramic incense dish with a smouldering stick. */
export function createIncenseHolder(p: RoomPalette): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.CylinderGeometry(0.05, 0.04, 0.02, 20), p.celadon, 0, 0.01, 0))
  const stick = new THREE.CylinderGeometry(0.0015, 0.0015, 0.16, 5)
  stick.rotateZ(0.12)
  g.add(part(stick, p.bark, -0.008, 0.095, 0, { cast: false }))
  emberMaterial ??= new THREE.MeshStandardMaterial({ color: '#ff7a2f', emissive: '#ff5a1f', emissiveIntensity: 2 })
  g.add(part(new THREE.SphereGeometry(0.0028, 6, 4), emberMaterial, -0.0175, 0.174, 0, { cast: false }))
  return g
}

/** Bonsai in a shallow rectangular pot. Origin = pot bottom centre. */
export function createBonsai(p: RoomPalette, scale = 1): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new RoundedBoxGeometry(0.24, 0.06, 0.16, 2, 0.01), p.stone, 0, 0.03, 0))
  g.add(part(new THREE.BoxGeometry(0.22, 0.008, 0.14), p.bark, 0, 0.061, 0, { cast: false }))
  g.add(part(tube([
    new THREE.Vector3(0.02, 0.06, 0),
    new THREE.Vector3(-0.03, 0.12, 0.01),
    new THREE.Vector3(0.03, 0.19, -0.01),
    new THREE.Vector3(-0.02, 0.25, 0),
  ], 0.012, 16, 8), p.bark))
  g.add(part(tube([
    new THREE.Vector3(0.0, 0.16, 0),
    new THREE.Vector3(0.08, 0.19, 0.02),
    new THREE.Vector3(0.12, 0.2, 0.03),
  ], 0.006, 10, 6), p.bark))
  const pad = (x: number, y: number, z: number, r: number) => {
    const geo = new THREE.IcosahedronGeometry(r, 1)
    geo.scale(1.2, 0.55, 1)
    g.add(part(geo, p.leafDark, x, y, z))
  }
  pad(-0.02, 0.27, 0, 0.065)
  pad(0.11, 0.215, 0.03, 0.05)
  pad(-0.07, 0.2, -0.02, 0.045)
  pad(0.03, 0.235, -0.03, 0.04)
  g.scale.setScalar(scale)
  return g
}

/** Small table andon (paper lantern) used as shelf / tokonoma decor. */
export function createSmallAndon(p: RoomPalette, paper: THREE.Material = p.paperGlow): THREE.Group {
  const g = new THREE.Group()
  g.add(part(woodBox(0.14, 0.012, 0.14), p.walnutDark, 0, 0.006, 0))
  g.add(part(new THREE.BoxGeometry(0.11, 0.18, 0.11), paper, 0, 0.1, 0, { cast: false }))
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.add(part(woodBox(0.012, 0.2, 0.012), p.walnutDark, x * 0.058, 0.1, z * 0.058, { cast: false }))
  }
  g.add(part(woodBox(0.14, 0.012, 0.14), p.walnutDark, 0, 0.2, 0, { cast: false }))
  return g
}

/** Floor-standing andon for the corridor. */
export function createFloorAndon(p: RoomPalette, paper: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    g.add(part(woodBox(0.024, 0.66, 0.024), p.walnutDark, x * 0.13, 0.33, z * 0.13))
  }
  g.add(part(new THREE.BoxGeometry(0.25, 0.42, 0.25), paper, 0, 0.4, 0, { cast: false }))
  g.add(part(woodBox(0.3, 0.02, 0.3), p.walnutDark, 0, 0.67, 0))
  g.add(part(woodBox(0.3, 0.02, 0.3), p.walnutDark, 0, 0.17, 0))
  for (const y of [0.25, 0.4, 0.55]) {
    g.add(part(new THREE.BoxGeometry(0.256, 0.006, 0.256), p.walnutDark, 0, y, 0, { cast: false }))
  }
  return g
}

/** Ikebana: celadon vase with a flowering branch. */
export function createIkebana(p: RoomPalette): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.06, 0),
    new THREE.Vector2(0.075, 0.08),
    new THREE.Vector2(0.045, 0.2),
    new THREE.Vector2(0.03, 0.26),
    new THREE.Vector2(0.036, 0.28),
  ], 28), p.celadon))
  const branch = [
    new THREE.Vector3(0, 0.26, 0),
    new THREE.Vector3(0.05, 0.45, 0.02),
    new THREE.Vector3(0.18, 0.6, 0.03),
    new THREE.Vector3(0.32, 0.66, 0.0),
  ]
  g.add(part(tube(branch, 0.007, 24, 6), p.bark))
  g.add(part(tube([new THREE.Vector3(0.04, 0.4, 0.02), new THREE.Vector3(-0.08, 0.52, 0.0), new THREE.Vector3(-0.14, 0.6, -0.02)], 0.005, 12, 5), p.bark))
  const curve = new THREE.CatmullRomCurve3(branch)
  const blossomGeo = new THREE.IcosahedronGeometry(0.014, 0)
  for (let i = 0; i < 18; i++) {
    const pt = curve.getPoint(0.25 + (i / 18) * 0.75)
    g.add(part(blossomGeo, p.blossom, pt.x + Math.sin(i * 2.1) * 0.025, pt.y + Math.cos(i * 1.7) * 0.02, pt.z + Math.sin(i * 3.3) * 0.02, { cast: false }))
  }
  return g
}

/**
 * Tokonoma alcove (built against a wall at local z = 0, room interior towards +z, centred on x).
 * Raised platform, natural log toko-bashira, square post and lintel.
 */
export function createTokonoma(p: RoomPalette, width = 1.6, depth = 0.5): THREE.Group {
  const g = new THREE.Group()
  g.add(part(woodBox(width, 0.14, depth, 0.008), p.walnut, 0, 0.07, depth / 2))
  g.add(part(woodBox(width + 0.04, 0.02, 0.04), p.walnutDark, 0, 0.13, depth))
  // Natural log post (toko-bashira) and squared post
  g.add(part(projectWoodUVs(new THREE.CylinderGeometry(0.052, 0.06, 2.9, 14)), p.bark, -width / 2 - 0.05, 1.45, depth))
  g.add(part(woodBox(0.1, 2.9, 0.1), p.walnutDark, width / 2 + 0.05, 1.45, depth - 0.02))
  // Otoshigake lintel
  g.add(part(woodBox(width + 0.2, 0.08, 0.07), p.walnutDark, 0, 2.86, depth))
  // Side return walls of the alcove
  return g
}

// ---------------------------------------------------------------------------
// Shoji screens
// ---------------------------------------------------------------------------

/**
 * Wall of yukimi-shoji panels along local X (centred), facing +Z: paper lower and upper zones with
 * real kumiko lattice, clear glass band in the middle so the garden stays visible. Lattice bars are
 * one InstancedMesh.
 */
export function createShojiWall(
  p: RoomPalette,
  length: number,
  opts: { height?: number; panels?: number; glassFrom?: number; glassTo?: number; transom?: THREE.Material; paper?: THREE.Material } = {}
): THREE.Group {
  const g = new THREE.Group()
  const doorH = 2.9
  const height = opts.height ?? 3.9
  const panels = opts.panels ?? Math.max(2, Math.round(length / 1.75))
  const glassFrom = opts.glassFrom ?? 0.72
  const glassTo = opts.glassTo ?? 2.05
  const panelW = length / panels
  const half = length / 2

  // Kamoi (lintel), shikii (sill) and transom wall above
  g.add(part(woodBox(length, 0.08, 0.1), p.walnutDark, 0, doorH + 0.04, 0))
  g.add(part(woodBox(length, 0.04, 0.12), p.walnutDark, 0, 0.02, 0, { cast: false }))
  if (opts.transom && height > doorH + 0.08) {
    const th = height - doorH - 0.08
    g.add(part(new THREE.PlaneGeometry(length, th), opts.transom, 0, doorH + 0.08 + th / 2, -0.02, { cast: false }))
  }

  // Paper zones (backlit washi) and the glass band
  const paper = opts.paper ?? p.paperGlow
  const paperLowH = glassFrom - 0.06
  const paperHighH = doorH - 0.05 - glassTo
  g.add(part(new THREE.PlaneGeometry(length, paperLowH), paper, 0, 0.04 + paperLowH / 2, -0.004, { cast: false }))
  g.add(part(new THREE.PlaneGeometry(length, paperHighH), paper, 0, glassTo + paperHighH / 2, -0.004, { cast: false }))
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(length, glassTo - glassFrom), p.glass)
  glass.position.set(0, (glassFrom + glassTo) / 2, -0.006)
  glass.renderOrder = 2
  g.add(glass)

  // Panel frames (stiles + rails) and kumiko lattice as instances
  type Bar = [number, number, number, number, number] // x, y, w, h, depth
  const bars: Bar[] = []
  for (let i = 0; i < panels; i++) {
    const x0 = -half + i * panelW
    const cx = x0 + panelW / 2
    // Stiles
    bars.push([x0 + 0.025, doorH / 2, 0.05, doorH, 0.035])
    bars.push([x0 + panelW - 0.025, doorH / 2, 0.05, doorH, 0.035])
    // Rails at bottom, top and around the glass band
    for (const y of [0.07, glassFrom - 0.02, glassTo + 0.02, doorH - 0.04]) bars.push([cx, y, panelW, 0.04, 0.035])
    // Kumiko: verticals through paper zones, horizontals every ~0.3m
    for (let k = 1; k <= 2; k++) {
      const vx = x0 + (panelW * k) / 3
      bars.push([vx, (0.09 + glassFrom - 0.04) / 2, 0.016, glassFrom - 0.13, 0.02])
      bars.push([vx, (glassTo + 0.04 + doorH - 0.06) / 2, 0.016, doorH - 0.1 - glassTo, 0.02])
    }
    for (let y = glassTo + 0.3; y < doorH - 0.12; y += 0.27) bars.push([cx, y, panelW - 0.04, 0.016, 0.02])
    bars.push([cx, (0.09 + glassFrom) / 2, panelW - 0.04, 0.016, 0.02])
  }
  const lattice = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), p.walnutDark, bars.length)
  const m = new THREE.Matrix4()
  bars.forEach(([x, y, w, h, d], i) => {
    m.compose(new THREE.Vector3(x, y, 0.01), new THREE.Quaternion(), new THREE.Vector3(w, h, d))
    lattice.setMatrixAt(i, m)
  })
  lattice.castShadow = true
  g.add(lattice)
  return g
}

// ---------------------------------------------------------------------------
// Corridor
// ---------------------------------------------------------------------------

/**
 * Split noren curtain hung in a doorway (local plane XY facing +Z, top edge at y = 0). The cloth
 * material should carry the sway shader so the hem moves gently.
 */
export function createNoren(p: RoomPalette, cloth: THREE.Material, width = 1.5, height = 0.7): THREE.Group {
  const g = new THREE.Group()
  const panelW = width / 2 - 0.012
  for (const s of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(panelW, height, 4, 8)
    g.add(part(geo, cloth, s * (panelW / 2 + 0.012), -height / 2, 0, { cast: false }))
  }
  const rod = new THREE.CylinderGeometry(0.012, 0.012, width + 0.12, 10)
  rod.rotateZ(Math.PI / 2)
  g.add(part(rod, p.walnutDark, 0, 0.012, 0.004, { cast: false }))
  return g
}

// ---------------------------------------------------------------------------
// Themed chamber furniture
// ---------------------------------------------------------------------------

export function createStoneLantern(p: RoomPalette, paper: THREE.Material = p.paperGlow): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 6), p.stone, 0, 0.04, 0))
  g.add(part(new THREE.CylinderGeometry(0.07, 0.085, 0.38, 6), p.stone, 0, 0.27, 0))
  g.add(part(new THREE.CylinderGeometry(0.18, 0.13, 0.07, 6), p.stone, 0, 0.495, 0))
  // Fire box with glowing windows
  g.add(part(new THREE.BoxGeometry(0.2, 0.17, 0.2), p.stone, 0, 0.615, 0))
  g.add(part(new THREE.BoxGeometry(0.12, 0.1, 0.205), paper, 0, 0.615, 0, { cast: false }))
  g.add(part(new THREE.BoxGeometry(0.205, 0.1, 0.12), paper, 0, 0.615, 0, { cast: false }))
  g.add(part(new THREE.CylinderGeometry(0.03, 0.27, 0.13, 6), p.stone, 0, 0.765, 0))
  g.add(part(new THREE.SphereGeometry(0.045, 10, 8), p.stone, 0, 0.865, 0))
  return g
}

export function createZabuton(material: THREE.Material): THREE.Mesh {
  const mesh = part(new RoundedBoxGeometry(0.6, 0.07, 0.64, 3, 0.03), material, 0, 0.035, 0)
  return mesh
}

/** Round low chabudai table. */
export function createChabudai(p: RoomPalette, radius = 0.42): THREE.Group {
  const g = new THREE.Group()
  g.add(part(projectWoodUVs(new THREE.CylinderGeometry(radius, radius, 0.035, 48)), p.walnut, 0, 0.32, 0))
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    g.add(part(woodBox(0.04, 0.3, 0.04), p.walnut, Math.cos(a) * radius * 0.65, 0.15, Math.sin(a) * radius * 0.65))
  }
  return g
}

/** Upholstered reading armchair facing +Z. */
export function createArmchair(p: RoomPalette, fabric: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new RoundedBoxGeometry(0.76, 0.18, 0.72, 3, 0.05), fabric, 0, 0.3, 0))
  g.add(part(new RoundedBoxGeometry(0.62, 0.1, 0.56, 3, 0.04), fabric, 0, 0.42, 0.05))
  g.add(part(new RoundedBoxGeometry(0.76, 0.62, 0.17, 3, 0.06), fabric, 0, 0.62, -0.28))
  for (const s of [-1, 1]) g.add(part(new RoundedBoxGeometry(0.14, 0.26, 0.72, 3, 0.05), fabric, s * 0.38, 0.5, 0))
  for (const [x, z] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.28], [0.32, 0.28]] as const) {
    g.add(part(projectWoodUVs(new THREE.CylinderGeometry(0.022, 0.016, 0.21, 10)), p.walnut, x, 0.105, z))
  }
  return g
}

export function createFloorLamp(p: RoomPalette, shade: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  g.add(part(new THREE.CylinderGeometry(0.14, 0.16, 0.025, 28), p.brass, 0, 0.0125, 0))
  g.add(part(new THREE.CylinderGeometry(0.012, 0.012, 1.45, 10), p.brass, 0, 0.74, 0))
  const shadeGeo = new THREE.CylinderGeometry(0.17, 0.23, 0.28, 28, 1, true)
  g.add(part(shadeGeo, shade, 0, 1.5, 0, { cast: false }))
  return g
}

/**
 * Library wall: walnut case with shelves and ~150 instanced books (one draw call) in muted colours.
 * Faces +Z; origin = floor centre of the case front.
 */
export function createBookWall(p: RoomPalette, width = 3.6, height = 2.6, depth = 0.4): THREE.Group {
  const g = new THREE.Group()
  const shelves = 5
  g.add(part(woodBox(0.04, height, depth), p.walnut, -width / 2, height / 2, -depth / 2))
  g.add(part(woodBox(0.04, height, depth), p.walnut, width / 2, height / 2, -depth / 2))
  g.add(part(woodBox(width, 0.02, depth), p.walnutDark, 0, height / 2, -depth + 0.01, { cast: false }))
  const back = new THREE.PlaneGeometry(width, height)
  g.add(part(projectWoodUVs(back), p.walnutDark, 0, height / 2, -depth + 0.005, { cast: false }))
  for (let i = 0; i <= shelves; i++) {
    const y = 0.06 + (i * (height - 0.1)) / shelves
    g.add(part(woodBox(width, 0.03, depth), p.walnut, 0, y, -depth / 2))
  }
  g.add(part(woodBox(width + 0.1, 0.06, depth + 0.04), p.walnutDark, 0, height + 0.03, -depth / 2))

  const palette = ['#5b1f1a', '#1f3a5f', '#2f4a2c', '#6b4a1f', '#3c2a4f', '#7a6a4f', '#253238', '#8a3b1e']
  const matrices: THREE.Matrix4[] = []
  const colors: THREE.Color[] = []
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < shelves; i++) {
    const baseY = 0.06 + (i * (height - 0.1)) / shelves + 0.015
    const maxH = (height - 0.1) / shelves - 0.06
    let x = -width / 2 + 0.04
    while (x < width / 2 - 0.08) {
      const t = 0.022 + rand() * 0.03
      const h = Math.min(maxH, 0.2 + rand() * 0.12)
      const d = 0.2 + rand() * 0.07
      if (rand() < 0.06) {
        x += 0.06 + rand() * 0.1 // occasional gap
        continue
      }
      const lean = rand() < 0.04 ? 0.18 : 0
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x + t / 2, baseY + h / 2, -depth + 0.03 + d / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -lean),
        new THREE.Vector3(t, h, d)
      )
      matrices.push(m)
      colors.push(new THREE.Color(palette[Math.floor(rand() * palette.length)]!).multiplyScalar(0.75 + rand() * 0.4))
      x += t + 0.002 + (lean ? 0.04 : 0)
    }
  }
  const books = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.65, name: 'library-books' }),
    matrices.length
  )
  matrices.forEach((m, i) => {
    books.setMatrixAt(i, m)
    books.setColorAt(i, colors[i]!)
  })
  books.receiveShadow = true
  g.add(books)
  return g
}

/** Framed ink painting with a brass picture light; the canvas is faintly self-lit as if lamp-lit. */
export function createFramedPainting(p: RoomPalette, style: PaintingStyle, w = 0.8, h = 1.0): THREE.Group {
  const g = new THREE.Group()
  g.add(part(woodBox(w + 0.1, h + 0.1, 0.035), p.walnutDark, 0, 0, 0.0175))
  const tex = createPaintingTexture(style)
  const canvas = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: '#ffffff',
    emissiveIntensity: 0.22,
    roughness: 0.92,
    name: `painting-${style}`,
  })
  g.add(part(new THREE.PlaneGeometry(w, h), canvas, 0, 0, 0.037, { cast: false }))
  // Picture light
  const bar = new THREE.CylinderGeometry(0.014, 0.014, w * 0.6, 12)
  bar.rotateZ(Math.PI / 2)
  g.add(part(bar, p.brass, 0, h / 2 + 0.1, 0.12, { cast: false }))
  g.add(part(new THREE.BoxGeometry(0.012, 0.012, 0.11), p.brass, 0, h / 2 + 0.09, 0.07, { cast: false }))
  return g
}

export function createBench(p: RoomPalette, length = 1.6): THREE.Group {
  const g = new THREE.Group()
  g.add(part(woodBox(length, 0.05, 0.38, 0.01), p.walnut, 0, 0.44, 0))
  for (const s of [-1, 1]) g.add(part(woodBox(0.05, 0.42, 0.34), p.walnut, s * (length / 2 - 0.12), 0.21, 0))
  g.add(part(woodBox(length - 0.3, 0.04, 0.03), p.walnut, 0, 0.12, 0))
  return g
}

export function createEasel(p: RoomPalette, canvasMaterial: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(woodBox(0.04, 1.9, 0.04), p.walnut)
    leg.position.set(s * 0.32, 0.93, 0)
    leg.rotation.z = -s * 0.12
    leg.castShadow = true
    g.add(leg)
  }
  const backLeg = new THREE.Mesh(woodBox(0.04, 1.8, 0.04), p.walnut)
  backLeg.position.set(0, 0.88, -0.28)
  backLeg.rotation.x = 0.3
  backLeg.castShadow = true
  g.add(backLeg)
  g.add(part(woodBox(0.8, 0.04, 0.08), p.walnut, 0, 0.72, 0.04))
  g.add(part(woodBox(0.86, 0.68, 0.03), p.paper, 0, 1.08, 0.05))
  g.add(part(new THREE.PlaneGeometry(0.82, 0.64), canvasMaterial, 0, 1.08, 0.066, { cast: false }))
  return g
}

export function createGlobe(p: RoomPalette, surface: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(woodBox(0.03, 0.62, 0.03), p.walnut)
    leg.position.set(Math.cos(a) * 0.16, 0.3, Math.sin(a) * 0.16)
    leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22)
    leg.castShadow = true
    g.add(leg)
  }
  g.add(part(projectWoodUVs(new THREE.TorusGeometry(0.3, 0.025, 8, 40)).rotateX(Math.PI / 2), p.walnut, 0, 0.62, 0))
  const tilt = new THREE.Group()
  tilt.position.set(0, 0.88, 0)
  tilt.rotation.z = 0.41
  tilt.add(part(new THREE.SphereGeometry(0.25, 40, 28), surface))
  tilt.add(part(new THREE.TorusGeometry(0.272, 0.007, 8, 48), p.brass))
  g.add(tilt)
  return g
}

export function createTelescope(p: RoomPalette): THREE.Group {
  const g = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const leg = new THREE.Mesh(woodBox(0.025, 1.25, 0.025), p.walnut)
    leg.position.set(Math.cos(a) * 0.2, 0.6, Math.sin(a) * 0.2)
    leg.rotation.set(Math.sin(a) * 0.17, 0, -Math.cos(a) * 0.17)
    leg.castShadow = true
    g.add(leg)
  }
  const tubeGeo = new THREE.CylinderGeometry(0.035, 0.05, 0.85, 20)
  const scope = part(tubeGeo, p.brass, 0, 1.3, 0)
  scope.rotation.set(0.5, 0, -1.05)
  g.add(scope)
  return g
}

// ---------------------------------------------------------------------------
// Meditation dojo: seated zen monk
// ---------------------------------------------------------------------------

export interface SeatedMonk {
  group: THREE.Group
  /** Breathes (scaled on Y) and carries the head and arms */
  torso: THREE.Group
  head: THREE.Group
  /** Invisible box used for click / proximity interaction */
  hitBox: THREE.Mesh
}

/**
 * Zen monk in full lotus on a zabuton, hands in the cosmic mudra, eyes closed. Faces +Z; origin at
 * the floor under the cushion. Built from a dozen light primitives (one shared skin and robe material).
 */
export function createSeatedMonk(
  cushion: THREE.Material,
  robe: THREE.Material,
  kesa: THREE.Material,
  skin: THREE.Material
): SeatedMonk {
  const group = new THREE.Group()
  const dark = new THREE.MeshStandardMaterial({ color: '#2a1d17', roughness: 0.6 })

  group.add(part(new RoundedBoxGeometry(0.62, 0.07, 0.62, 3, 0.03), cushion, 0, 0.035, 0))
  // Round zafu sitting cushion on the zabuton
  group.add(part(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 28), cushion, 0, 0.11, -0.05))

  // Crossed legs: a soft mound of robe
  const legs = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0.07),
    new THREE.Vector2(0.34, 0.07),
    new THREE.Vector2(0.39, 0.11),
    new THREE.Vector2(0.37, 0.16),
    new THREE.Vector2(0.26, 0.205),
    new THREE.Vector2(0, 0.215),
  ], 32)
  legs.scale(1, 1, 0.78)
  group.add(part(legs, robe, 0, 0, 0.03))

  const torso = new THREE.Group()
  torso.position.set(0, 0.19, -0.03)
  group.add(torso)

  const body = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.19, 0),
    new THREE.Vector2(0.205, 0.09),
    new THREE.Vector2(0.18, 0.24),
    new THREE.Vector2(0.205, 0.37),
    new THREE.Vector2(0.175, 0.45),
    new THREE.Vector2(0.07, 0.5),
    new THREE.Vector2(0, 0.5),
  ], 32)
  body.scale(1, 1, 0.7)
  torso.add(part(body, robe))

  // Rakusu (bib-like kesa) and its straps
  torso.add(part(new RoundedBoxGeometry(0.2, 0.2, 0.012, 2, 0.004), kesa, 0, 0.3, 0.135))
  for (const s of [-1, 1]) {
    const strap = new THREE.BoxGeometry(0.025, 0.2, 0.01)
    const m = part(strap, kesa, s * 0.075, 0.43, 0.105, { cast: false })
    m.rotation.z = s * 0.25
    m.rotation.x = -0.35
    torso.add(m)
  }

  // Sleeves down to the lap and hands in the cosmic mudra
  for (const s of [-1, 1]) {
    torso.add(part(tube([
      new THREE.Vector3(s * 0.19, 0.42, 0),
      new THREE.Vector3(s * 0.25, 0.24, 0.05),
      new THREE.Vector3(s * 0.19, 0.11, 0.16),
      new THREE.Vector3(s * 0.08, 0.08, 0.2),
    ], 0.055, 20, 12), robe))
    const hand = new THREE.SphereGeometry(0.05, 16, 12)
    hand.scale(1.25, 0.45, 0.85)
    torso.add(part(hand, skin, s * 0.03, 0.075 + (s > 0 ? 0.012 : 0), 0.21))
  }
  // Thumbs lightly touching above the palms
  torso.add(part(tube([
    new THREE.Vector3(-0.045, 0.1, 0.235),
    new THREE.Vector3(0, 0.12, 0.245),
    new THREE.Vector3(0.045, 0.1, 0.235),
  ], 0.011, 10, 8), skin))

  // Neck and head
  torso.add(part(new THREE.CylinderGeometry(0.045, 0.052, 0.09, 16), skin, 0, 0.53, 0))
  const head = new THREE.Group()
  head.position.set(0, 0.66, 0.01)
  head.rotation.x = 0.12 // gaze lowered
  torso.add(head)
  const skull = new THREE.SphereGeometry(0.1, 32, 24)
  skull.scale(0.9, 1.06, 0.97)
  head.add(part(skull, skin))
  for (const s of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.026, 12, 10)
    ear.scale(0.45, 1, 0.7)
    head.add(part(ear, skin, s * 0.09, -0.005, -0.005))
    // Closed eyes: soft downward arcs
    const eye = new THREE.TorusGeometry(0.017, 0.0028, 6, 16, Math.PI)
    const eyeMesh = part(eye, dark, s * 0.034, 0.008, 0.088, { cast: false })
    eyeMesh.rotation.z = Math.PI
    head.add(eyeMesh)
    const brow = new THREE.BoxGeometry(0.03, 0.005, 0.006)
    const browMesh = part(brow, dark, s * 0.035, 0.034, 0.088, { cast: false })
    browMesh.rotation.z = -s * 0.12
    head.add(browMesh)
  }
  head.add(part(new THREE.SphereGeometry(0.013, 10, 8), skin, 0, -0.012, 0.098, { cast: false }))
  const mouth = new THREE.TorusGeometry(0.016, 0.0022, 6, 14, Math.PI * 0.7)
  const mouthMesh = part(mouth, dark, 0, -0.04, 0.086, { cast: false })
  mouthMesh.rotation.z = Math.PI * 1.15
  head.add(mouthMesh)

  const hitBox = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), new THREE.MeshBasicMaterial({ visible: false }))
  hitBox.position.set(0, 0.5, 0)
  group.add(hitBox)

  return { group, torso, head, hitBox }
}
