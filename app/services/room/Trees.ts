import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural garden trees. Each builder returns two merged geometries (wood + foliage cards) in a
 * tree-local frame with the base at the origin, meant to be drawn as InstancedMeshes: a whole grove
 * of one species is then two draw calls. Foliage normals point out of the canopy (not along the
 * card) so the cut-out cards shade like a rounded crown instead of a pile of flat planes.
 */

export interface TreeGeometry {
  wood: THREE.BufferGeometry
  leaves: THREE.BufferGeometry
}

type Rand = () => number

function rng(seed: number): Rand {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const UP = new THREE.Vector3(0, 1, 0)

/** Tapered open cylinder from a to b; bark UVs scaled so the texture keeps its real size. */
function limb(parts: THREE.BufferGeometry[], a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, radial: number) {
  const dir = b.clone().sub(a)
  const len = dir.length()
  if (len < 1e-4) return
  dir.normalize()
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true)
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  const tile = Math.max(2 * Math.PI * r0, 0.12)
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * len) / tile)
  g.translate(0, len / 2, 0)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir))
  g.translate(a.x, a.y, a.z)
  parts.push(g)
}

/** Any unit vector perpendicular to `v`. */
function perpendicular(v: THREE.Vector3): THREE.Vector3 {
  const p = Math.abs(v.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  return p.cross(v).normalize()
}

/**
 * A square foliage card. `normalOf` gives the shading normal for each vertex position (canopy-style
 * normals), so the flat card lights like part of a rounded mass.
 */
function card(
  parts: THREE.BufferGeometry[],
  center: THREE.Vector3,
  size: number,
  rotation: THREE.Euler,
  normalOf: (p: THREE.Vector3) => THREE.Vector3
) {
  const g = new THREE.PlaneGeometry(size, size)
  g.applyQuaternion(new THREE.Quaternion().setFromEuler(rotation))
  g.translate(center.x, center.y, center.z)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const n = normalOf(p)
    nrm.setXYZ(i, n.x, n.y, n.z)
  }
  parts.push(g)
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry()
  parts.forEach((g) => g.dispose())
  merged.computeBoundingSphere()
  return merged
}

/** Japanese maple: short trunk splitting into a wide, layered dome. About 5 m tall, 6 m across. */
export function buildMaple(seed: number, detail: 'low' | 'high'): TreeGeometry {
  const r = rng(seed)
  const wood: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const maxDepth = detail === 'high' ? 4 : 3
  const radial = detail === 'high' ? 7 : 5
  const crown = new THREE.Vector3(0, 3.4, 0)
  const crownNormal = (p: THREE.Vector3) =>
    p.clone().sub(crown).multiply(new THREE.Vector3(1, 1.4, 1)).normalize().lerp(UP, 0.18).normalize()
  const leafSize = detail === 'high' ? 1.25 : 1.6

  const grow = (start: THREE.Vector3, dir: THREE.Vector3, len: number, radius: number, depth: number) => {
    // Two segments with a slight kink so limbs aren't ruler-straight
    const bend = perpendicular(dir).applyAxisAngle(dir, r() * Math.PI * 2).multiplyScalar(len * 0.12)
    const mid = start.clone().addScaledVector(dir, len * 0.5).add(bend)
    const end = start.clone().addScaledVector(dir, len).add(bend.clone().multiplyScalar(0.4))
    const rMid = radius * 0.82
    const rEnd = radius * 0.66
    limb(wood, start, mid, radius, rMid, radial)
    limb(wood, mid, end, rMid, rEnd, radial)

    if (depth >= maxDepth) {
      for (let k = 0; k < 2; k++) {
        const c = end.clone().add(new THREE.Vector3(r() - 0.5, r() * 0.4, r() - 0.5).multiplyScalar(0.5))
        card(leaves, c, leafSize * (0.8 + r() * 0.45), new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI), crownNormal)
      }
      return
    }
    if (depth >= maxDepth - 1) {
      const c = mid.clone().add(new THREE.Vector3(r() - 0.5, 0.15, r() - 0.5).multiplyScalar(0.4))
      card(leaves, c, leafSize * 0.85, new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI), crownNormal)
    }

    const children = depth === 0 ? 3 : 2 + (r() < 0.45 ? 1 : 0)
    const base = perpendicular(dir)
    const phase = r() * Math.PI * 2
    for (let k = 0; k < children; k++) {
      const axis = base.clone().applyAxisAngle(dir, phase + (k / children) * Math.PI * 2 + (r() - 0.5) * 0.6)
      const spread = (depth === 0 ? 0.55 : 0.5) + r() * 0.35
      const child = dir.clone().applyAxisAngle(axis, spread)
      // Maples spread wide: flatten the climb of the outer limbs
      child.y = child.y * (depth === 0 ? 0.9 : 0.72) + 0.08
      child.normalize()
      const decay = 0.68 + r() * 0.12
      grow(end.clone().addScaledVector(dir, -rEnd * 0.6), child, len * decay, radius * 0.62, depth + 1)
    }
  }

  const lean = new THREE.Vector3((r() - 0.5) * 0.25, 1, (r() - 0.5) * 0.25).normalize()
  grow(new THREE.Vector3(0, -0.05, 0), lean, 1.75 + r() * 0.4, 0.15, 0)
  return { wood: merge(wood), leaves: merge(leaves) }
}

/**
 * Japanese black pine (kuromatsu), niwaki style: a leaning, curving trunk with near-horizontal limbs
 * ending in flat cloud pads of needles. About 5 m tall.
 */
export function buildPine(seed: number, detail: 'low' | 'high'): TreeGeometry {
  const r = rng(seed)
  const wood: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const radial = detail === 'high' ? 7 : 5
  const padCards = detail === 'high' ? 6 : 4

  // Trunk: a few segments drifting in a lean direction then curving back up
  const leanAz = r() * Math.PI * 2
  const leanDir = new THREE.Vector3(Math.cos(leanAz), 0, Math.sin(leanAz))
  const height = 4.6 + r() * 0.8
  const segs = 6
  const trunk: THREE.Vector3[] = [new THREE.Vector3(0, -0.05, 0)]
  for (let i = 1; i <= segs; i++) {
    const t = i / segs
    const drift = Math.sin(t * Math.PI * 0.9) * 0.9 + (r() - 0.5) * 0.2
    trunk.push(
      new THREE.Vector3(leanDir.x * drift + (r() - 0.5) * 0.15, t * height, leanDir.z * drift + (r() - 0.5) * 0.15)
    )
  }
  const trunkR = (t: number) => 0.2 * (1 - t) + 0.05 * t
  for (let i = 0; i < segs; i++) limb(wood, trunk[i]!, trunk[i + 1]!, trunkR(i / segs), trunkR((i + 1) / segs), radial)

  const pad = (center: THREE.Vector3, radius: number) => {
    const padNormal = (p: THREE.Vector3) => p.clone().sub(center).multiply(new THREE.Vector3(0.6, 1.6, 0.6)).add(new THREE.Vector3(0, 0.35, 0)).normalize()
    for (let k = 0; k < padCards; k++) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * radius * 0.55
      const c = center.clone().add(new THREE.Vector3(Math.cos(a) * d, (r() - 0.3) * 0.18, Math.sin(a) * d))
      card(leaves, c, radius * (0.9 + r() * 0.35), new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.7, r() * Math.PI * 2, (r() - 0.5) * 0.5, 'YXZ'), padNormal)
    }
  }

  const trunkAt = (h: number) => {
    const f = Math.min(segs - 1e-3, (h / height) * segs)
    const i = Math.floor(f)
    return trunk[i]!.clone().lerp(trunk[i + 1]!, f - i)
  }

  let az = r() * Math.PI * 2
  for (let h = 1.7; h < height - 0.5; h += 0.42 + r() * 0.2) {
    az += 2.4 // golden-angle spiral
    const t = h / height
    const len = 1.9 * (1 - t) + 0.55 + r() * 0.3
    const start = trunkAt(h)
    const dir = new THREE.Vector3(Math.cos(az), -0.12 + r() * 0.25, Math.sin(az)).normalize()
    const mid = start.clone().addScaledVector(dir, len * 0.55).add(new THREE.Vector3(0, -0.08, 0))
    const end = mid.clone().addScaledVector(dir, len * 0.45).add(new THREE.Vector3(0, 0.15, 0))
    const br = trunkR(t) * 0.45
    limb(wood, start, mid, br, br * 0.75, Math.max(4, radial - 2))
    limb(wood, mid, end, br * 0.75, br * 0.45, Math.max(4, radial - 2))
    pad(end.clone().add(new THREE.Vector3(0, 0.12, 0)), 0.75 + len * 0.32)
    if (len > 1.5) pad(mid.clone().add(new THREE.Vector3(0, 0.14, 0)), 0.6)
  }
  pad(trunk[segs]!.clone().add(new THREE.Vector3(0, 0.1, 0)), 0.95)
  return { wood: merge(wood), leaves: merge(leaves) }
}

/** A clump of tall bamboo culms with leaf sprays over their upper half. About 7-8 m tall. */
export function buildBambooClump(seed: number, detail: 'low' | 'high'): TreeGeometry {
  const r = rng(seed)
  const wood: THREE.BufferGeometry[] = []
  const leaves: THREE.BufferGeometry[] = []
  const culms = detail === 'high' ? 11 : 7
  const centre = new THREE.Vector3(0, 5.6, 0)
  const normalOf = (p: THREE.Vector3) => p.clone().sub(centre).multiply(new THREE.Vector3(1, 0.35, 1)).normalize().lerp(UP, 0.25).normalize()

  for (let i = 0; i < culms; i++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.75
    const base = new THREE.Vector3(Math.cos(a) * d, -0.05, Math.sin(a) * d)
    const lean = new THREE.Vector3(Math.cos(a) * (0.05 + r() * 0.08), 1, Math.sin(a) * (0.05 + r() * 0.08))
    const h = 6.2 + r() * 2.2
    const radius = 0.032 + r() * 0.018
    const pts: THREE.Vector3[] = []
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      // Culms arc outward more and more toward the tip
      pts.push(new THREE.Vector3(base.x + lean.x * h * t * t * 1.4, t * h, base.z + lean.z * h * t * t * 1.4))
    }
    const curve = new THREE.CatmullRomCurve3(pts)
    const tube = new THREE.TubeGeometry(curve, detail === 'high' ? 10 : 6, radius, detail === 'high' ? 6 : 5, false)
    const uv = tube.getAttribute('uv') as THREE.BufferAttribute
    for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) * h) / 0.34)
    wood.push(tube)

    const sprays = detail === 'high' ? 9 : 6
    for (let k = 0; k < sprays; k++) {
      const t = 0.45 + (k / sprays) * 0.55
      const p = curve.getPointAt(Math.min(1, t))
      const sa = r() * Math.PI * 2
      const off = 0.2 + r() * 0.35
      const c = p.clone().add(new THREE.Vector3(Math.cos(sa) * off, -0.2, Math.sin(sa) * off))
      card(leaves, c, 1.0 + r() * 0.5, new THREE.Euler((r() - 0.5) * 0.6, sa, (r() - 0.5) * 0.4, 'YXZ'), normalOf)
    }
  }
  return { wood: merge(wood), leaves: merge(leaves) }
}

/** Clipped karikomi shrub: a lumpy flattened dome, base at y = 0, 1 m across before scaling. */
export function buildShrub(seed: number, detail: 'low' | 'high'): THREE.BufferGeometry {
  const r = rng(seed)
  const g = new THREE.SphereGeometry(0.5, detail === 'high' ? 18 : 12, detail === 'high' ? 10 : 7, 0, Math.PI * 2, 0, Math.PI * 0.62)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const lumps = Array.from({ length: 5 }, () => new THREE.Vector3(r() - 0.5, r() * 0.5, r() - 0.5).normalize())
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    const n = p.clone().normalize()
    let bump = 0
    for (const l of lumps) bump += Math.max(0, n.dot(l)) ** 4 * 0.06
    p.multiplyScalar(1 + bump)
    pos.setXYZ(i, p.x, p.y * 0.72, p.z)
  }
  // The cap's open rim sits just below ground so the shrub reads as rooted
  g.translate(0, -0.06, 0)
  g.computeVertexNormals()
  return g
}
