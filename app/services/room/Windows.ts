import * as THREE from 'three'

/**
 * Real glass windows and sliding glass doors (garasudo). The glass is a cheap transparent standard
 * material (no transmission pass) whose opacity rises with the Fresnel term, so panes are nearly
 * invisible head-on and pick up environment reflections at grazing angles, like real float glass.
 */
export function createWindowGlass(name = 'window-glass'): THREE.MeshStandardMaterial {
  const glass = new THREE.MeshStandardMaterial({
    name,
    color: '#eef5f2',
    roughness: 0.04,
    metalness: 0,
    transparent: true,
    opacity: 0.05,
    envMapIntensity: 1.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  glass.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float glassFresnel = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 4.0);
      diffuseColor.a = clamp(opacity + glassFresnel * 0.6, 0.0, 0.8);
      #include <opaque_fragment>`
    )
  }
  glass.customProgramCacheKey = () => 'window-glass-fresnel'
  return glass
}

function bar(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = true
  parent.add(m)
  return m
}

export interface GlassDoorOptions {
  /** Height of the door head (kamoi) */
  doorHeight?: number
  /** Full wall height; the band above the doors is filled with `transom` */
  height?: number
  panels?: number
  transom?: THREE.Material
  /** Height of the wooden kick panel (koshi) at the foot of each door, 0 for none */
  koshi?: number
}

/**
 * A run of sliding glass doors in the local XY plane, centred on x = 0, the room on local -Z (the
 * same convention as createShojiWall). Alternate leaves run in two tracks a few centimetres apart,
 * exactly as real sliding doors overlap.
 */
export function createGlassDoorWall(length: number, frame: THREE.Material, glass: THREE.Material, opts: GlassDoorOptions = {}): THREE.Group {
  const g = new THREE.Group()
  const doorH = opts.doorHeight ?? 2.9
  const height = opts.height ?? 3.9
  const panels = opts.panels ?? Math.max(2, Math.round(length / 1.75))
  const koshi = opts.koshi ?? 0.36
  const panelW = length / panels
  const half = length / 2

  // Kamoi (head), shikii (sill with its two grooves) and the transom wall above
  bar(g, frame, length, 0.1, 0.14, 0, doorH + 0.05, 0)
  bar(g, frame, length, 0.045, 0.16, 0, 0.0225, 0, false)
  if (opts.transom && height > doorH + 0.1) {
    const th = height - doorH - 0.1
    const transom = new THREE.Mesh(new THREE.BoxGeometry(length, th, 0.1), opts.transom)
    transom.position.set(0, doorH + 0.1 + th / 2, 0)
    g.add(transom)
  }

  const panes: THREE.BufferGeometry[] = []
  const stile = 0.055
  const railTop = 0.06
  const railBottom = 0.07
  for (let i = 0; i < panels; i++) {
    const x0 = -half + i * panelW
    const cx = x0 + panelW / 2
    const z = i % 2 === 0 ? -0.025 : 0.025
    // A leaf is 2cm wider than its slot so neighbours overlap where they meet
    const w = panelW + 0.02
    const top = doorH - 0.005
    bar(g, frame, stile, top - 0.045, 0.035, cx - w / 2 + stile / 2, 0.045 + (top - 0.045) / 2, z)
    bar(g, frame, stile, top - 0.045, 0.035, cx + w / 2 - stile / 2, 0.045 + (top - 0.045) / 2, z)
    bar(g, frame, w - stile * 2, railTop, 0.035, cx, top - railTop / 2, z)
    bar(g, frame, w - stile * 2, railBottom, 0.035, cx, 0.045 + railBottom / 2, z)
    let glassBottom = 0.045 + railBottom
    if (koshi > 0) {
      // Solid wooden kick panel with a rail on top
      bar(g, frame, w - stile * 2, koshi - railBottom, 0.018, cx, glassBottom + (koshi - railBottom) / 2, z, false)
      bar(g, frame, w - stile * 2, 0.04, 0.035, cx, 0.045 + koshi + 0.02, z)
      glassBottom = 0.045 + koshi + 0.04
    }
    const glassTop = top - railTop
    const pane = new THREE.PlaneGeometry(w - stile * 2, glassTop - glassBottom)
    pane.translate(cx, (glassTop + glassBottom) / 2, z)
    panes.push(pane)
  }
  const glassGeo = mergePlanes(panes)
  const glassMesh = new THREE.Mesh(glassGeo, glass)
  glassMesh.renderOrder = 2
  g.add(glassMesh)
  return g
}

/**
 * Glazed window filling a wall opening `w` x `h` centred on the origin of the local XY plane, the
 * wall thickness `depth` along Z: a casing lining the reveal, a deep sill on the room side (+Z) and
 * two sliding glass sashes.
 */
export function createPictureWindow(w: number, h: number, depth: number, frame: THREE.Material, glass: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const c = 0.05 // casing board thickness
  // Casing boards lining the opening, plus a proud architrave on the room side
  bar(g, frame, w, c, depth, 0, h / 2 - c / 2, 0)
  bar(g, frame, w + 0.04, c, depth + 0.14, 0, -h / 2 + c / 2, 0.07, false) // sill ledge into the room
  bar(g, frame, c, h, depth, -w / 2 + c / 2, 0, 0)
  bar(g, frame, c, h, depth, w / 2 - c / 2, 0, 0)
  const trimZ = depth / 2 + 0.012
  bar(g, frame, w + 0.16, 0.08, 0.024, 0, h / 2 + 0.04, trimZ, false)
  bar(g, frame, 0.08, h + 0.16, 0.024, -w / 2 - 0.04, 0, trimZ, false)
  bar(g, frame, 0.08, h + 0.16, 0.024, w / 2 + 0.04, 0, trimZ, false)

  // Two sashes in parallel tracks, overlapping in the middle
  const innerW = w - c * 2
  const innerH = h - c * 2
  const sashW = innerW / 2 + 0.025
  const panes: THREE.BufferGeometry[] = []
  const s = 0.045
  for (const side of [-1, 1]) {
    const cx = side * (innerW / 4 - 0.0125)
    const z = side * 0.022
    bar(g, frame, s, innerH, 0.032, cx - sashW / 2 + s / 2, 0, z)
    bar(g, frame, s, innerH, 0.032, cx + sashW / 2 - s / 2, 0, z)
    bar(g, frame, sashW - s * 2, s, 0.032, cx, innerH / 2 - s / 2, z)
    bar(g, frame, sashW - s * 2, s, 0.032, cx, -innerH / 2 + s / 2, z)
    const pane = new THREE.PlaneGeometry(sashW - s * 2, innerH - s * 2)
    pane.translate(cx, 0, z)
    panes.push(pane)
  }
  const glassMesh = new THREE.Mesh(mergePlanes(panes), glass)
  glassMesh.renderOrder = 2
  g.add(glassMesh)
  return g
}

function mergePlanes(planes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let offset = 0
  for (const p of planes) {
    const pos = p.getAttribute('position')
    const nrm = p.getAttribute('normal')
    const uv = p.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      normals.push(nrm.getX(i), nrm.getY(i), nrm.getZ(i))
      uvs.push(uv.getX(i), uv.getY(i))
    }
    const index = p.getIndex()!
    for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset)
    offset += pos.count
    p.dispose()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  return g
}
