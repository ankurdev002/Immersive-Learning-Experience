import * as THREE from 'three'

/**
 * Cross-section of an open book's page stacks.
 *
 * The binding pins every page at one valley height in the middle of the book, so BOTH stacks dive
 * into that gutter: the thick side curves down into it and even the thin side swells up into a
 * soft crest before folding in (the "gull wing" of a real open hardback). Away from the spine the
 * surface settles to the stack's true thickness at the fore-edge.
 */
const GUTTER = {
  /** Height of the binding valley above the cover board (≈ half-way into a 38mm book block) */
  valley: 0.0068,
  /** Extra swell of the paper just outside the gutter */
  crest: 0.0085,
  /** Width of the curl region as a fraction of the page width */
  k: 0.075,
}

/**
 * Height of the top page above the cover at fraction `u` across the page (0 = spine, 1 = fore-edge)
 * for a stack of thickness `h`. `openness` blends from a flat closed block (0) to the open curve (1).
 */
export function stackSurfaceHeight(u: number, h: number, openness = 1): number {
  const t = THREE.MathUtils.clamp(u, 0, 1)
  const e = Math.exp(-t / GUTTER.k)
  const crest = GUTTER.crest * (t / GUTTER.k) * Math.exp(1 - t / GUTTER.k)
  const curved = h * (1 - e) + GUTTER.valley * e + crest
  return Math.max(0.0004, h + openness * (curved - h))
}

/** Soft ambient-occlusion darkening of the paper as it dives into the gutter (1 = unshaded). */
export function gutterShade(u: number): number {
  const t = Math.max(0, u)
  return 1 - 0.45 * Math.exp(-t / 0.032) - 0.12 * Math.exp(-t / 0.15)
}

interface StackOptions {
  /** Spine-side X and fore-edge X in book-local units (fore-edge negative for the left stack) */
  innerX: number
  outerX: number
  /** Page width used to normalise u, shared with the page sheets so all surfaces match */
  profileWidth: number
  length: number
  segments?: number
}

/**
 * Page block whose top follows {@link stackSurfaceHeight}. Geometry sits on y = 0 (the cover board);
 * call {@link update} when the stack height or openness changes (a few hundred vertices: cheap).
 *
 * Material groups match BoxGeometry so existing material arrays keep their meaning:
 * 0 = +X face, 1 = -X face, 2 = top, 3 = bottom, 4 = +Z face, 5 = -Z face.
 */
export class CurvedStack {
  readonly geometry = new THREE.BufferGeometry()
  /** u for vertices on the top surface, -1 for vertices pinned to the bottom */
  private readonly topU: Float32Array
  private readonly profileWidth: number

  constructor(opts: StackOptions) {
    const { innerX, outerX, profileWidth, length: L } = opts
    const segments = opts.segments ?? 32
    const halfL = L / 2
    const dir = Math.sign(outerX - innerX) || 1
    this.profileWidth = profileWidth

    const positions: number[] = []
    const uvs: number[] = []
    const topU: number[] = []
    const indices: number[] = []
    let groupStart = 0

    const vertex = (x: number, top: boolean, z: number, uvU: number, uvV: number) => {
      positions.push(x, 0, z)
      uvs.push(uvU, uvV)
      topU.push(top ? Math.abs(x) / profileWidth : -1)
      return topU.length - 1
    }
    const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
      if (flip) indices.push(a, d, c, a, c, b)
      else indices.push(a, b, c, a, c, d)
    }
    const closeGroup = (materialIndex: number) => {
      this.geometry.addGroup(groupStart, indices.length - groupStart, materialIndex)
      groupStart = indices.length
    }

    const xs: number[] = []
    for (let i = 0; i <= segments; i++) xs.push(innerX + ((outerX - innerX) * i) / segments)

    const sideFace = (x: number, outward: number) => {
      const a = vertex(x, false, -halfL, 0, 0)
      const b = vertex(x, false, halfL, 1, 0)
      const c = vertex(x, true, halfL, 1, 1)
      const d = vertex(x, true, -halfL, 0, 1)
      quad(a, b, c, d, outward > 0)
    }
    sideFace(dir > 0 ? outerX : innerX, 1)
    closeGroup(0)
    sideFace(dir > 0 ? innerX : outerX, -1)
    closeGroup(1)

    const far: number[] = []
    const near: number[] = []
    for (let i = 0; i <= segments; i++) {
      far.push(vertex(xs[i]!, true, -halfL, i / segments, 1))
      near.push(vertex(xs[i]!, true, halfL, i / segments, 0))
    }
    for (let i = 0; i < segments; i++) quad(near[i]!, near[i + 1]!, far[i + 1]!, far[i]!, dir < 0)
    closeGroup(2)

    {
      const a = vertex(innerX, false, -halfL, 0, 0)
      const b = vertex(outerX, false, -halfL, 1, 0)
      const c = vertex(outerX, false, halfL, 1, 1)
      const d = vertex(innerX, false, halfL, 0, 1)
      quad(a, b, c, d, dir < 0)
    }
    closeGroup(3)

    const endFace = (z: number, outward: number) => {
      const bottom: number[] = []
      const top: number[] = []
      for (let i = 0; i <= segments; i++) {
        bottom.push(vertex(xs[i]!, false, z, i / segments, 0))
        top.push(vertex(xs[i]!, true, z, i / segments, 1))
      }
      for (let i = 0; i < segments; i++) {
        quad(bottom[i]!, bottom[i + 1]!, top[i + 1]!, top[i]!, (outward < 0) !== (dir < 0))
      }
    }
    endFace(halfL, 1)
    closeGroup(4)
    endFace(-halfL, -1)
    closeGroup(5)

    this.topU = new Float32Array(topU)
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    this.geometry.setIndex(indices)
    this.update(0.038, 0)
  }

  update(height: number, openness: number) {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.topU.length; i++) {
      const u = this.topU[i]!
      pos.setY(i, u < 0 ? 0 : stackSurfaceHeight(u, height, openness))
    }
    pos.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.geometry.computeBoundingSphere()
  }
}

/**
 * Visible page sheet riding on a {@link CurvedStack}, a hair above it, with vertex-colour shading
 * that darkens the paper as it folds into the gutter.
 */
export class CurvedSheet {
  readonly geometry: THREE.BufferGeometry
  private readonly u: Float32Array

  constructor(width: number, length: number, side: 'left' | 'right', segments = 48) {
    const geometry = new THREE.PlaneGeometry(width, length, segments, 2)
    geometry.translate(side === 'right' ? width / 2 : -width / 2, 0, 0)
    geometry.rotateX(-Math.PI / 2)
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute
    this.u = new Float32Array(pos.count)
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const u = Math.abs(pos.getX(i)) / width
      this.u[i] = u
      const shade = gutterShade(u)
      colors.set([shade, shade, shade], i * 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geometry = geometry
    this.update(0.038, 0)
  }

  update(height: number, openness: number, lift = 0.0003) {
    const pos = this.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.u.length; i++) {
      pos.setY(i, stackSurfaceHeight(this.u[i]!, height, openness) + lift)
    }
    pos.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.geometry.computeBoundingSphere()
  }
}
