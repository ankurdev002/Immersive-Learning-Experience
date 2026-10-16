import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PbrTextureLibrary } from './PbrTextures'
import { projectWoodUVs, type RoomPalette } from './Props'
import { GALLERY_EXHIBITS, type GalleryExhibitInfo } from './GalleryCatalog'

/**
 * Upstairs art gallery, built only when the visitor creates an "Art Gallery" room.
 *
 * - A stair annex east of the corridor (x 14..20): a doorway in the corridor's east wall opens
 *   onto a ground-floor walkway beside a solid timber staircase that climbs to a mezzanine.
 * - From the mezzanine, an opening leads into a 28 m long exhibition hall over the corridor and
 *   rooms, walled on every side, in the style of a Japanese museum: light-wood glass vitrine along
 *   the back wall with folding screens and hanging scrolls, freestanding white partition walls with
 *   framed prints and photographs, a samurai armour case, a katana display and a handscroll case.
 * - Every piece has a small lectern with an open book; standing near it offers its history.
 */

export const GALLERY_FLOOR = 4.3
const CEIL = 8.4
/** Inner face of the stair annex's east wall */
const ANNEX_X1 = 20.0
/** The staircase stands free in the annex: walkway on its west side, ~1.9 m of open floor to the east */
const STAIR = { x0: 16.25, x1: 18.05, z0: 0.3, z1: 6.54 }
/** Doorway in the corridor's east end wall (corridor ↔ annex walkway) */
export const GALLERY_OPENING = { z0: 5.15, z1: 6.95 }
/** Opening from the mezzanine into the hall */
const ENTRANCE = { z0: 5.4, z1: 7.0 }

export interface ExhibitStand {
  info: GalleryExhibitInfo
  x: number
  z: number
}

interface Collider {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ArtGalleryOptions {
  palette: RoomPalette
  pbr: PbrTextureLibrary
  /** Shared window glass */
  glass: THREE.Material
  /** Corridor plaster (so the new end-wall pieces match) */
  corridorPlaster: THREE.Material
  lowTier: boolean
  anisotropy: number
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function canvasTexture(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class ArtGallery {
  /** Stair annex: walkway, staircase, mezzanine (visible from the corridor) */
  readonly annex = new THREE.Group()
  /** Exhibition hall interior (only drawn when you're up there) */
  readonly hall = new THREE.Group()
  /** Hall floor slab, outer walls and roof */
  readonly shell = new THREE.Group()
  /** New corridor east end wall with the doorway to the stairs (replaces the solid one) */
  readonly corridorEnd = new THREE.Group()
  readonly stands: ExhibitStand[] = []
  /** Where real (pooled) spotlights should hang and what they aim at */
  readonly spotPlacements: Array<{ position: THREE.Vector3; target: THREE.Vector3 }> = []
  /** Light washes and lamp glow that follow the gallery's light switch */
  readonly washMaterials: THREE.MeshBasicMaterial[] = []
  readonly glowMaterials: THREE.MeshStandardMaterial[] = []
  /** Self-lit pictures, panels and lectern books (userData.onEmissive = their lit level) */
  readonly artMaterials: THREE.MeshStandardMaterial[] = []

  private readonly colliders: Collider[] = []
  private readonly p: RoomPalette
  private readonly pbr: PbrTextureLibrary
  private readonly glass: THREE.Material
  private readonly lowTier: boolean
  private readonly anisotropy: number
  private readonly loader = new THREE.TextureLoader()
  private readonly mats: ReturnType<ArtGallery['createMaterials']>
  private washTexture: THREE.CanvasTexture | null = null

  constructor(opts: ArtGalleryOptions) {
    this.p = opts.palette
    this.pbr = opts.pbr
    this.glass = opts.glass
    this.lowTier = opts.lowTier
    this.anisotropy = opts.anisotropy
    this.mats = this.createMaterials(opts.corridorPlaster)
    this.annex.name = 'gallery-annex'
    this.hall.name = 'gallery-hall'
    this.shell.name = 'gallery-shell'
    this.corridorEnd.name = 'gallery-corridor-end'

    this.buildCorridorEnd()
    this.buildAnnex()
    this.buildShell()
    this.buildHall()

    for (const g of [this.annex, this.hall, this.shell, this.corridorEnd]) mergeStatic(g)
  }

  // =========================================================
  // Materials
  // =========================================================

  private createMaterials(corridorPlaster: THREE.Material) {
    const pbr = this.pbr
    return {
      corridorPlaster,
      wall: pbr.material('plaster', { noColorMap: true, color: '#e6d9c2', normalScale: 0.6, name: 'gallery-wall' }),
      partition: pbr.material('plaster', { noColorMap: true, color: '#f3f0e9', normalScale: 0.35, name: 'gallery-partition' }),
      floor: pbr.material('darkWalnut', { color: '#7a5f4c', roughness: 0.55, name: 'gallery-floor' }),
      stairWood: pbr.material('cedar', { color: '#a68a72', roughness: 0.6, name: 'gallery-stair' }),
      riser: pbr.material('cedar', { color: '#7d6552', roughness: 0.7, name: 'gallery-riser' }),
      lightWood: pbr.material('walnut', { color: '#f0cf9f', roughness: 0.55, name: 'gallery-light-wood' }),
      darkWood: this.p.walnutDark,
      fabric: pbr.material('hessian', { noColorMap: true, color: '#e8dcc4', name: 'gallery-fabric' }),
      ceiling: new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.9, name: 'gallery-ceiling' }),
      black: new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.45, metalness: 0.4, name: 'gallery-black' }),
      lacquer: new THREE.MeshStandardMaterial({ color: '#100d0b', roughness: 0.22, name: 'gallery-lacquer' }),
      gold: new THREE.MeshStandardMaterial({ color: '#c9a24a', roughness: 0.35, metalness: 1, name: 'gallery-gold' }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.5, metalness: 0.7, name: 'gallery-iron' }),
      roof: new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.85, name: 'gallery-roof' }),
      mat: new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.95, name: 'gallery-mat' }),
    }
  }

  /** Box with real-world UVs (tile in metres). */
  private box(parent: THREE.Object3D, mat: THREE.Material | THREE.Material[], w: number, h: number, d: number, x: number, y: number, z: number, tile = 0.8, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d)
    projectWoodUVs(g, tile)
    g.userData.worldUV = true
    const m = new THREE.Mesh(g, mat)
    m.position.set(x, y, z)
    m.rotation.y = rotY
    m.receiveShadow = true
    parent.add(m)
    return m
  }

  private art(url: string): THREE.MeshStandardMaterial {
    const tex = this.loader.load(url, (t) => {
      // Low tier: keep GPU memory small by downsizing the scans
      const img = t.image as HTMLImageElement
      if (this.lowTier && img && Math.max(img.width, img.height) > 768) {
        const s = 768 / Math.max(img.width, img.height)
        const [c, ctx] = canvas(Math.round(img.width * s), Math.round(img.height * s))
        ctx.drawImage(img, 0, 0, c.width, c.height)
        t.image = c as unknown as HTMLImageElement
        t.needsUpdate = true
      }
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = this.anisotropy
    // Lit as if by its own spotlight: a share of the picture is emitted, so every piece reads clearly
    const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.42, roughness: 0.85, name: `gallery-art-${url}` })
    m.userData.onEmissive = 0.42
    this.artMaterials.push(m)
    return m
  }

  /** Register a self-lit panel so the gallery light switch dims it too. */
  private dimmable<T extends THREE.MeshStandardMaterial>(m: T): T {
    m.userData.onEmissive = m.emissiveIntensity
    this.artMaterials.push(m)
    return m
  }

  /** Soft cone of light thrown on a wall by a track spotlight (additive decal). */
  private wash(parent: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, rotY: number, strength = 0.42) {
    if (!this.washTexture) {
      const [c, ctx] = canvas(128, 256)
      const g = ctx.createRadialGradient(64, 40, 4, 64, 120, 140)
      g.addColorStop(0, 'rgba(255,240,215,1)')
      g.addColorStop(0.45, 'rgba(255,236,205,0.55)')
      g.addColorStop(1, 'rgba(255,230,200,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 256)
      this.washTexture = canvasTexture(c)
    }
    const mat = new THREE.MeshBasicMaterial({
      map: this.washTexture,
      transparent: true,
      opacity: strength,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      name: 'gallery-wash',
    })
    mat.userData.onOpacity = strength
    this.washMaterials.push(mat)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    m.position.set(x, y, z)
    m.rotation.y = rotY
    m.renderOrder = 1
    parent.add(m)
  }

  // =========================================================
  // Corridor end, stair annex, shell
  // =========================================================

  private buildCorridorEnd() {
    const g = this.corridorEnd
    const m = this.mats.corridorPlaster
    const { z0, z1 } = GALLERY_OPENING
    this.box(g, m, 0.12, 3.9, z0 - 3.88, 14.0, 1.95, (3.88 + z0) / 2, 0.5)
    this.box(g, m, 0.12, 3.9, 7.3 - z1, 14.0, 1.95, (z1 + 7.3) / 2, 0.5)
    this.box(g, m, 0.12, 1.0, z1 - z0, 14.0, 3.4, (z0 + z1) / 2, 0.5)
    // Door frame
    const d = this.mats.darkWood
    this.box(g, d, 0.16, 2.95, 0.1, 14.0, 1.45, z0 - 0.03, 0.6)
    this.box(g, d, 0.16, 2.95, 0.1, 14.0, 1.45, z1 + 0.03, 0.6)
    this.box(g, d, 0.16, 0.14, z1 - z0 + 0.16, 14.0, 2.93, (z0 + z1) / 2, 0.6)

    // Sign over the doorway, facing the corridor
    const [c, ctx] = canvas(512, 160)
    ctx.fillStyle = '#1a1512'
    ctx.fillRect(0, 0, 512, 160)
    ctx.strokeStyle = '#c9a24a'
    ctx.lineWidth = 4
    ctx.strokeRect(8, 8, 496, 144)
    ctx.fillStyle = '#f3e7cf'
    ctx.textAlign = 'center'
    ctx.font = 'bold 54px serif'
    ctx.fillText('美術館 ↑ 2F', 256, 78)
    ctx.font = '30px sans-serif'
    ctx.fillStyle = '#d8c39a'
    ctx.fillText('ART GALLERY · UPSTAIRS', 256, 128)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.47), new THREE.MeshStandardMaterial({ map: canvasTexture(c), emissiveMap: canvasTexture(c), emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.7, name: 'gallery-sign' }))
    sign.position.set(13.93, 3.38, (z0 + z1) / 2)
    sign.rotation.y = -Math.PI / 2
    g.add(sign)
  }

  private buildAnnex() {
    const g = this.annex
    const F = GALLERY_FLOOR
    const wall = this.mats.wall
    // Ground floor
    const annexW = ANNEX_X1 - 14.06
    const annexCx = (ANNEX_X1 + 14.06) / 2
    const floorGeo = new THREE.BoxGeometry(annexW, 0.02, 7.6)
    projectWoodUVs(floorGeo, 1.0)
    const floor = new THREE.Mesh(floorGeo, this.mats.stairWood)
    floor.position.set(annexCx, -0.008, 3.5)
    floor.receiveShadow = true
    g.add(floor)
    // Ground-floor wall shared with the room slot next door, and the full-height outer walls
    this.box(g, wall, 0.12, 3.9, 4.18, 14.0, 1.95, 1.79, 0.8)
    this.box(g, wall, 0.12, 8.95, 7.84, ANNEX_X1 + 0.06, 4.1, 3.5, 0.8)
    this.box(g, wall, ANNEX_X1 + 0.12 - 14.0, 8.95, 0.12, (14.0 + ANNEX_X1 + 0.12) / 2, 4.1, -0.36, 0.8)
    this.box(g, wall, ANNEX_X1 + 0.12 - 14.0, 8.95, 0.12, (14.0 + ANNEX_X1 + 0.12) / 2, 4.1, 7.36, 0.8)
    // Mezzanine over the walkway and the landing at the head of the stairs
    // (walnut floor on top; the edges round the stairwell and the underside are plastered)
    const slabMats = [this.mats.wall, this.mats.wall, this.mats.floor, this.mats.wall, this.mats.wall, this.mats.wall]
    this.box(g, slabMats, 2.19, 0.35, 7.6, 15.155, F - 0.175, 3.5, 1.2)
    this.box(g, slabMats, ANNEX_X1 - STAIR.x0, 0.35, 7.3 - STAIR.z1, (STAIR.x0 + ANNEX_X1) / 2, F - 0.175, (STAIR.z1 + 7.3) / 2, 1.2)
    // Annex ceiling high above the stairwell
    this.box(g, this.mats.ceiling, annexW, 0.1, 7.6, annexCx, CEIL + 0.05, 3.5, 1.5)

    // Timber staircase rising toward +z: separate treads (with a nosing lip over the step below)
    // and slightly recessed risers, each with its own wood grain running across the stair
    const risers = 24
    const rise = F / risers
    const run = (STAIR.z1 - STAIR.z0) / risers
    const width = STAIR.x1 - STAIR.x0
    const cx = (STAIR.x0 + STAIR.x1) / 2
    const treadT = 0.04
    const nosing = 0.03
    const treadGeos: THREE.BufferGeometry[] = []
    const riserGeos: THREE.BufferGeometry[] = []
    for (let k = 0; k < risers; k++) {
      const top = (k + 1) * rise
      const front = STAIR.z0 + k * run
      const tread = new THREE.BoxGeometry(width, treadT, run + nosing)
      projectWoodUVs(tread, 0.9)
      tread.translate(cx, top - treadT / 2, front + run / 2 - nosing / 2)
      treadGeos.push(tread)
      const riserH = rise - treadT + 0.002
      const riser = new THREE.BoxGeometry(width, riserH, 0.02)
      projectWoodUVs(riser, 0.9)
      riser.translate(cx, k * rise + riserH / 2, front + 0.012)
      riserGeos.push(riser)
    }
    for (const [geos, mat] of [
      [treadGeos, this.mats.stairWood],
      [riserGeos, this.mats.riser],
    ] as const) {
      const merged = mergeGeometries(geos, false)!
      geos.forEach((gg) => gg.dispose())
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      g.add(mesh)
    }

    // Closed strings: a smooth sloped board on each side hides the stepped ends of the treads, and
    // a plastered panel fills the space below it on the walkway side (as in a real closed stair)
    // The string rides just above the treads' nosings so no step corner pokes through it
    const stringCap = F + 0.08
    const stringTop = (z: number) => Math.min(stringCap, ((z - STAIR.z0) / run) * rise + rise * 0.6 + 0.1)
    const zTop = STAIR.z0 + ((stringCap - 0.1 - rise * 0.6) / rise) * run
    const zFoot = STAIR.z0 - 0.03
    // Plastered panel under each string (the stair stands free, so both sides are finished).
    // `dir` = -1 for the west side (faces the walkway), +1 for the east side (faces the open floor)
    const sidePanel = (dir: -1 | 1) => {
      const shape = new THREE.Shape()
      const zc = (z: number) => -dir * z // mirrored for the east side so the face points outward
      shape.moveTo(zc(zFoot), 0)
      shape.lineTo(zc(7.3), 0)
      shape.lineTo(zc(7.3), F)
      shape.lineTo(zc(zTop), stringCap)
      shape.lineTo(zc(zFoot), stringTop(STAIR.z0))
      shape.lineTo(zc(zFoot), 0)
      const panel = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.mats.wall)
      panel.rotation.y = dir * Math.PI / 2
      panel.position.x = dir < 0 ? STAIR.x0 - 0.012 : STAIR.x1 + 0.012
      panel.receiveShadow = true
      g.add(panel)
    }
    sidePanel(-1)
    sidePanel(1)
    const slopeLen = Math.hypot(zTop - zFoot, stringCap - stringTop(STAIR.z0))
    const slopeAngle = Math.atan2(stringCap - stringTop(STAIR.z0), zTop - zFoot)
    const yMid = (stringTop(STAIR.z0) + stringCap) / 2 - 0.09
    const rail = (x: number, z0: number, y0: number, z1: number, y1: number) => {
      const len = Math.hypot(z1 - z0, y1 - y0)
      const r = this.box(g, this.mats.darkWood, 0.06, 0.07, len, x, (y0 + y1) / 2, (z0 + z1) / 2, 0.6)
      r.rotation.x = -Math.atan2(y1 - y0, z1 - z0)
    }
    for (const side of [-1, 1] as const) {
      const stringX = side < 0 ? STAIR.x0 - 0.03 : STAIR.x1 + 0.03
      const board = this.box(g, this.mats.darkWood, 0.045, 0.24, slopeLen + 0.02, stringX, yMid, (zFoot + zTop) / 2, 0.6)
      board.rotation.x = -slopeAngle
      // Skirting along the foot of the panel
      this.box(g, this.mats.darkWood, 0.03, 0.1, 7.3 - zFoot, stringX + side * 0.002, 0.05, (zFoot + 7.3) / 2, 0.6)
      // Handrail on the string, with balusters and a newel post at the foot
      const railX = side < 0 ? STAIR.x0 - 0.04 : STAIR.x1 + 0.04
      rail(railX, zFoot, stringTop(STAIR.z0) + 0.9, zTop, stringCap + 0.9)
      this.box(g, this.mats.darkWood, 0.1, stringTop(STAIR.z0) + 1.0, 0.1, railX, (stringTop(STAIR.z0) + 1.0) / 2, zFoot, 0.6)
      for (let z = STAIR.z0 + 0.45; z < zTop - 0.1; z += 0.52) {
        this.box(g, this.mats.darkWood, 0.035, 0.9, 0.035, railX, stringTop(z) + 0.45, z, 0.6)
      }
    }
    // Upstairs: railing along the mezzanine edge over the stairwell, and along the landing's edge
    // above the open floor east of the stairs
    const westRailX = STAIR.x0 - 0.04
    rail(westRailX, -0.25, F + 0.95, STAIR.z1, F + 0.95)
    for (let z = -0.2; z < STAIR.z1; z += 0.52) this.box(g, this.mats.darkWood, 0.04, 0.95, 0.04, westRailX, F + 0.475, z, 0.6)
    const edgeZ = STAIR.z1 + 0.04
    const edge = this.box(g, this.mats.darkWood, ANNEX_X1 - STAIR.x1, 0.07, 0.06, (STAIR.x1 + ANNEX_X1) / 2, F + 0.95, edgeZ, 0.6)
    void edge
    for (let x = STAIR.x1 + 0.3; x < ANNEX_X1 - 0.1; x += 0.5) this.box(g, this.mats.darkWood, 0.04, 0.95, 0.04, x, F + 0.475, edgeZ, 0.6)

    // A welcome panel on the east wall, beside the open floor at the foot of the stairs
    this.textPanel(g, ['美', 'Art Gallery · 2F', 'Japanese masterworks, ink, gold and the samurai, one floor up.'], 1.5, 1.05, ANNEX_X1 - 0.01, 1.75, 3.6, -Math.PI / 2)

    // Big paper lantern hanging in the stairwell
    const paper = new THREE.MeshStandardMaterial({ color: '#f6ead2', emissive: '#ffcf8f', emissiveIntensity: 1.1, roughness: 0.9, name: 'gallery-lantern' })
    paper.userData.onIntensity = 1.1
    this.glowMaterials.push(paper)
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 20), paper)
    lantern.position.set((STAIR.x1 + ANNEX_X1) / 2, 6.6, 3.2)
    g.add(lantern)
    this.box(g, this.mats.darkWood, 0.7, 0.05, 0.7, (STAIR.x1 + ANNEX_X1) / 2, 7.07, 3.2, 0.6)
    this.box(g, this.mats.darkWood, 0.7, 0.05, 0.7, (STAIR.x1 + ANNEX_X1) / 2, 6.13, 3.2, 0.6)
    this.box(g, this.mats.black, 0.015, CEIL - 7.1, 0.015, (STAIR.x1 + ANNEX_X1) / 2, (CEIL + 7.1) / 2, 3.2, 0.6)
    this.spotPlacements.push({ position: new THREE.Vector3(15.2, CEIL - 0.1, 3.4), target: new THREE.Vector3(15.2, F, 3.4) })
    this.spotPlacements.push({ position: new THREE.Vector3(19.0, CEIL - 0.1, 3.6), target: new THREE.Vector3(19.4, 0, 3.6) })
  }

  private buildShell() {
    const s = this.shell
    const F = GALLERY_FLOOR
    const wall = this.mats.wall
    // Floor slab over the corridor and rooms (its underside is above their 3.9 m ceilings)
    this.box(s, this.mats.floor, 28.24, 0.38, 7.84, 0, F - 0.19, 3.5, 1.2)
    // Outer walls of the upper storey (boxes: both faces show, so they're also the outside walls)
    const top = CEIL + 0.2
    const wy = (3.92 + top) / 2
    const wh = top - 3.92
    this.box(s, wall, 28.24, wh, 0.12, 0, wy, -0.36, 0.8)
    this.box(s, wall, 28.24, wh, 0.12, 0, wy, 7.36, 0.8)
    this.box(s, wall, 0.12, wh, 7.84, -14.12, wy, 3.5, 0.8)
    // Wall between the hall and the stair annex, with the entrance
    const { z0, z1 } = ENTRANCE
    this.box(s, wall, 0.12, wh, z0 + 0.3, 14.0, wy, (z0 - 0.3) / 2, 0.8)
    this.box(s, wall, 0.12, wh, 7.3 - z1, 14.0, wy, (z1 + 7.3) / 2, 0.8)
    this.box(s, wall, 0.12, top - (F + 2.8), z1 - z0, 14.0, (F + 2.8 + top) / 2, (z0 + z1) / 2, 0.8)
    this.box(s, this.mats.darkWood, 0.18, 2.85, 0.1, 14.0, F + 1.42, z0 - 0.03, 0.6)
    this.box(s, this.mats.darkWood, 0.18, 2.85, 0.1, 14.0, F + 1.42, z1 + 0.03, 0.6)
    this.box(s, this.mats.darkWood, 0.18, 0.14, z1 - z0 + 0.16, 14.0, F + 2.82, (z0 + z1) / 2, 0.6)

    // Hipped tile roof over the hall and annex
    const x0 = -14.8
    const x1 = ANNEX_X1 + 0.7
    const zA = -1.0
    const zB = 8.0
    const eave = CEIL + 0.25
    const ridge = eave + 2.2
    const inset = (zB - zA) / 2
    const r0 = new THREE.Vector3(x0 + inset, ridge, (zA + zB) / 2)
    const r1 = new THREE.Vector3(x1 - inset, ridge, (zA + zB) / 2)
    const a = new THREE.Vector3(x0, eave, zA)
    const b = new THREE.Vector3(x1, eave, zA)
    const c = new THREE.Vector3(x1, eave, zB)
    const d = new THREE.Vector3(x0, eave, zB)
    const verts = [a, b, r1, r0, b, c, r1, c, d, r0, r1, d, a, r0]
    const pos: number[] = []
    const tri = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3) => pos.push(...p.toArray(), ...q.toArray(), ...r.toArray())
    tri(a, r1, b)
    tri(a, r0, r1)
    tri(b, r1, c)
    tri(c, r1, r0)
    tri(c, r0, d)
    tri(d, r0, a)
    void verts
    const roofGeo = new THREE.BufferGeometry()
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    roofGeo.computeVertexNormals()
    const roof = new THREE.Mesh(roofGeo, this.mats.roof)
    roof.material.side = THREE.DoubleSide
    s.add(roof)
    this.box(s, this.mats.roof, x1 - x0 - 2 * inset + 0.3, 0.22, 0.32, (x0 + x1) / 2, ridge + 0.06, (zA + zB) / 2, 1)
  }

  // =========================================================
  // Exhibition hall
  // =========================================================

  private buildHall() {
    const h = this.hall
    const F = GALLERY_FLOOR
    // Ceiling with dark beams and two lighting tracks
    this.box(h, this.mats.ceiling, 28, 0.1, 7.6, 0, CEIL + 0.05, 3.5, 1.5)
    for (let x = -12; x <= 12; x += 3) this.box(h, this.mats.darkWood, 0.16, 0.22, 7.6, x, CEIL - 0.11, 3.5, 0.8)
    for (const z of [1.9, 5.5]) this.box(h, this.mats.black, 27.4, 0.05, 0.06, 0, CEIL - 0.28, z, 1)
    // Skirting
    this.box(h, this.mats.darkWood, 28, 0.12, 0.03, 0, F + 0.06, -0.285, 0.8)
    this.box(h, this.mats.darkWood, 28, 0.12, 0.03, 0, F + 0.06, 7.285, 0.8)

    const ex = new Map(GALLERY_EXHIBITS.map((e) => [e.id, e]))
    const get = (id: string) => ex.get(id)!

    // --- Back wall: long light-wood glass vitrine (x -13.6 .. 4.5) ---
    const vx0 = -13.6
    const vx1 = 4.5
    const vLen = vx1 - vx0
    const vcx = (vx0 + vx1) / 2
    const deck = F + 0.55
    const glassZ = 0.95
    this.box(h, this.mats.lightWood, vLen, 0.55, glassZ + 0.3, vcx, F + 0.275, (glassZ - 0.3) / 2, 0.9)
    this.box(h, this.mats.fabric, vLen, 0.01, glassZ + 0.28, vcx, deck + 0.005, (glassZ - 0.3) / 2, 1)
    this.box(h, this.mats.fabric, vLen, 3.0, 0.02, vcx, deck + 1.5, -0.28, 1)
    this.box(h, this.mats.lightWood, vLen, 0.55, 0.1, vcx, F + 3.75, glassZ - 0.02, 0.9)
    this.box(h, this.mats.lightWood, vLen, 0.06, glassZ + 0.3, vcx, F + 3.47, (glassZ - 0.3) / 2, 0.9)
    // Light strip inside the vitrine head
    const strip = new THREE.MeshStandardMaterial({ color: '#fff7e8', emissive: '#fff1da', emissiveIntensity: 1.6, name: 'gallery-strip' })
    strip.userData.onIntensity = 1.6
    this.glowMaterials.push(strip)
    const stripMesh = new THREE.Mesh(new THREE.BoxGeometry(vLen - 0.2, 0.02, 0.05), strip)
    stripMesh.position.set(vcx, F + 3.43, glassZ - 0.25)
    h.add(stripMesh)
    // Glass with light-wood mullions every ~3m
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(vLen, 2.92), this.glass)
    glassPane.position.set(vcx, deck + 1.46, glassZ)
    glassPane.renderOrder = 2
    h.add(glassPane)
    for (let i = 0; i <= 6; i++) {
      const x = vx0 + (vLen * i) / 6
      this.box(h, this.mats.lightWood, 0.07, 2.95, 0.08, x, deck + 1.47, glassZ, 0.9)
    }
    this.colliders.push({ minX: vx0 - 0.2, maxX: vx1 + 0.2, minZ: -1, maxZ: glassZ + 0.25 })

    const screenAt = (id: string, cx: number) => {
      const info = get(id)
      this.foldingScreen(h, this.art(info.image!), 3.6, 1.62, cx, deck, 0.25)
      this.wash(h, 3.8, 2.9, cx, deck + 1.45, -0.26, 0, 0.35)
      this.stands.push({ info, x: cx + 1.1, z: 1.5 })
      this.lectern(h, info, cx + 1.1, 1.5, 0)
    }
    const scrollAt = (id: string, cx: number) => {
      const info = get(id)
      this.hangingScroll(h, this.art(info.image!), info.aspect, cx, deck + 2.75, -0.24)
      this.wash(h, 1.5, 2.9, cx, deck + 1.45, -0.26, 0, 0.4)
      this.stands.push({ info, x: cx, z: 1.5 })
      this.lectern(h, info, cx, 1.5, 0)
    }
    screenAt('pine-trees', -11.4)
    scrollAt('haboku', -8.45)
    screenAt('wind-thunder-gods', -5.5)
    scrollAt('sudden-shower', -2.55)
    screenAt('irises', 0.4)
    scrollAt('yoritomo', 3.45)

    // --- Freestanding white partition walls down the middle ---
    const partition = (px: number, leftId: string | null, rightId: string | null, panelText?: [string, string, string]) => {
      const z0 = 2.5
      const z1 = 5.0
      this.box(h, this.mats.partition, 0.24, 3.2, z1 - z0, px, F + 1.6, (z0 + z1) / 2, 1.2)
      this.box(h, this.mats.lightWood, 0.26, 0.08, z1 - z0 + 0.02, px, F + 0.04, (z0 + z1) / 2, 0.8)
      this.colliders.push({ minX: px - 0.4, maxX: px + 0.4, minZ: z0 - 0.25, maxZ: z1 + 0.25 })
      for (const side of [-1, 1] as const) {
        const id = side < 0 ? leftId : rightId
        const faceX = px + side * 0.125
        const rot = side < 0 ? -Math.PI / 2 : Math.PI / 2
        if (id) {
          const info = get(id)
          const maxW = 2.0
          const maxH = 1.5
          let w = maxW
          let hh = w / info.aspect
          if (hh > maxH) {
            hh = maxH
            w = hh * info.aspect
          }
          this.framedPicture(h, this.art(info.image!), w, hh, faceX + side * 0.02, F + 1.7, (z0 + z1) / 2, rot)
          this.wash(h, Math.max(1.6, w + 0.8), 3.0, faceX + side * 0.006, F + 1.75, (z0 + z1) / 2, rot, 0.42)
          const sx = px + side * 0.95
          this.stands.push({ info, x: sx, z: z1 + 0.35 })
          this.lectern(h, info, sx, z1 + 0.35, side < 0 ? -Math.PI / 2 : Math.PI / 2)
          this.spotPlacements.push({
            position: new THREE.Vector3(px + side * 2.2, CEIL - 0.3, (z0 + z1) / 2),
            target: new THREE.Vector3(faceX, F + 1.7, (z0 + z1) / 2),
          })
        } else if (panelText) {
          this.textPanel(h, panelText, 1.9, 1.3, faceX + side * 0.01, F + 1.75, (z0 + z1) / 2, rot)
          this.wash(h, 2.4, 3.0, faceX + side * 0.006, F + 1.75, (z0 + z1) / 2, rot, 0.36)
        }
      }
    }
    partition(-8.5, 'great-wave', 'red-fuji')
    partition(-2.5, 'samurai-beato', 'samurai-armour')
    partition(3.5, 'mongol-invasion', null, ['侍', 'The Way of the Samurai', 'Armour and swords of the warrior class, from the Kamakura shogunate to the Meiji Restoration.'])

    // --- Samurai armour in a glass case ---
    this.armourCase(h, 8.0, 3.9)
    this.stands.push({ info: get('armour'), x: 6.75, z: 2.85 })
    this.lectern(h, get('armour'), 6.75, 2.85, -Math.PI / 2)
    this.spotPlacements.push({ position: new THREE.Vector3(8.0, CEIL - 0.3, 2.6), target: new THREE.Vector3(8.0, F + 1.4, 3.9) })

    // --- Katana display ---
    this.katanaCase(h, 11.0, 2.3)
    this.stands.push({ info: get('katana'), x: 11.0, z: 3.45 })
    this.lectern(h, get('katana'), 11.0, 3.45, 0)
    this.spotPlacements.push({ position: new THREE.Vector3(11.0, CEIL - 0.3, 3.2), target: new THREE.Vector3(11.0, F + 0.9, 2.3) })

    // --- Chōjū-giga handscroll in a low sloped case along the front wall ---
    this.handscrollCase(h, this.art(get('choju-giga').image!), -4.0, 6.75, 4.2)
    this.stands.push({ info: get('choju-giga'), x: -1.25, z: 5.75 })
    this.lectern(h, get('choju-giga'), -1.25, 5.75, Math.PI)
    this.wash(h, 4.8, 2.6, -4.0, F + 1.6, 7.29, Math.PI, 0.3)

    // --- Title wall at the far (west) end ---
    this.titleWall(h)

    // --- Benches ---
    for (const bx of [-5.5, 0.5]) {
      this.bench(h, bx, 3.75)
      this.colliders.push({ minX: bx - 0.9, maxX: bx + 0.9, minZ: 3.45, maxZ: 4.05 })
    }

    // Spot heads on the tracks aimed at each lit piece (decorative; light comes from the washes + pool)
    const heads: THREE.Matrix4[] = []
    const targets = [-11.4, -8.45, -5.5, -2.55, 0.4, 3.45]
    for (const x of targets) heads.push(this.spotHead(x, 1.9, new THREE.Vector3(x, F + 1.8, 0)))
    for (const { position, target } of this.spotPlacements) {
      if (position.x < 14) heads.push(this.spotHead(position.x, position.z < 3.7 ? 1.9 : 5.5, target))
    }
    const headGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.2, 12)
    headGeo.rotateX(Math.PI / 2)
    const headMesh = new THREE.InstancedMesh(headGeo, this.mats.black, heads.length)
    heads.forEach((m, i) => headMesh.setMatrixAt(i, m))
    headMesh.computeBoundingSphere()
    h.add(headMesh)

    // Lectern colliders
    for (const s of this.stands) this.colliders.push({ minX: s.x - 0.28, maxX: s.x + 0.28, minZ: s.z - 0.28, maxZ: s.z + 0.28 })
  }

  private spotHead(x: number, z: number, target: THREE.Vector3): THREE.Matrix4 {
    const pos = new THREE.Vector3(x, CEIL - 0.42, z)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), target.clone().sub(pos).normalize())
    return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1))
  }

  /** Six-panel byōbu standing in a zigzag; the picture runs across all panels. */
  private foldingScreen(parent: THREE.Object3D, art: THREE.Material, width: number, height: number, cx: number, baseY: number, cz: number) {
    const panels = 6
    const ang = 0.3
    const pw = width / panels
    const step = pw * Math.cos(ang)
    const start = cx - (step * panels) / 2
    const border = 0.035
    for (let i = 0; i < panels; i++) {
      const rot = i % 2 === 0 ? ang : -ang
      const px = start + step * (i + 0.5)
      const g = new THREE.PlaneGeometry(pw - 0.01, height)
      const uv = g.getAttribute('uv') as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / panels)
      const panel = new THREE.Mesh(g, art)
      panel.position.set(px, baseY + 0.06 + height / 2, cz)
      panel.rotation.y = rot
      parent.add(panel)
      // Dark lacquered frame of each panel
      const frame = new THREE.Group()
      frame.position.copy(panel.position)
      frame.rotation.y = rot
      this.box(frame, this.mats.lacquer, pw + 0.01, border, 0.03, 0, height / 2 + border / 2, -0.012, 0.5)
      this.box(frame, this.mats.lacquer, pw + 0.01, border, 0.03, 0, -height / 2 - border / 2, -0.012, 0.5)
      this.box(frame, this.mats.lacquer, border * 0.6, height + border * 2, 0.03, -pw / 2, 0, -0.012, 0.5)
      this.box(frame, this.mats.lacquer, border * 0.6, height + border * 2, 0.03, pw / 2, 0, -0.012, 0.5)
      parent.add(frame)
    }
  }

  private brocadeTexture: THREE.CanvasTexture | null = null
  private brocade(): THREE.CanvasTexture {
    if (!this.brocadeTexture) {
      const [c, ctx] = canvas(128, 128)
      ctx.fillStyle = '#3b4a52'
      ctx.fillRect(0, 0, 128, 128)
      ctx.strokeStyle = 'rgba(214,190,128,0.45)'
      ctx.lineWidth = 2
      for (let y = 0; y < 128; y += 16) {
        for (let x = (y / 16) % 2 ? 8 : 0; x < 136; x += 16) {
          ctx.beginPath()
          ctx.moveTo(x, y + 4)
          ctx.lineTo(x + 4, y + 8)
          ctx.lineTo(x, y + 12)
          ctx.lineTo(x - 4, y + 8)
          ctx.closePath()
          ctx.stroke()
        }
      }
      const t = canvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(3, 8)
      this.brocadeTexture = t
    }
    return this.brocadeTexture
  }

  /** Kakejiku: picture in a brocade mounting with a top rod, a weighted bottom roller and a cord. */
  private hangingScroll(parent: THREE.Object3D, art: THREE.Material, aspect: number, cx: number, topY: number, z: number) {
    const artH = 1.32
    const artW = artH * aspect
    const mountW = artW + 0.2
    const top = 0.5
    const bottom = 0.32
    const mountH = artH + top + bottom
    const mountMat = new THREE.MeshStandardMaterial({ map: this.brocade(), roughness: 0.8, name: 'gallery-brocade' })
    const mount = new THREE.Mesh(new THREE.PlaneGeometry(mountW, mountH), mountMat)
    mount.position.set(cx, topY - mountH / 2, z)
    parent.add(mount)
    // Gold paper border (ichimonji) and the picture
    const border = new THREE.Mesh(new THREE.PlaneGeometry(artW + 0.04, artH + 0.04), this.mats.gold)
    border.position.set(cx, topY - top - artH / 2, z + 0.002)
    parent.add(border)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(artW, artH), art)
    pic.position.set(cx, topY - top - artH / 2, z + 0.004)
    parent.add(pic)
    // Futai: two narrow strips hanging from the top
    for (const s of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.36), this.mats.mat)
      strip.position.set(cx + s * artW * 0.22, topY - 0.2, z + 0.005)
      parent.add(strip)
    }
    // Top rod, bottom roller with knobs, hanging cord
    this.box(parent, this.mats.darkWood, mountW + 0.02, 0.025, 0.025, cx, topY, z + 0.01, 0.5)
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, mountW + 0.12, 12), this.mats.lacquer)
    roller.rotation.z = Math.PI / 2
    roller.position.set(cx, topY - mountH - 0.01, z + 0.015)
    parent.add(roller)
    for (const s of [-1, 1]) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 12), this.mats.gold)
      knob.rotation.z = Math.PI / 2
      knob.position.set(cx + s * (mountW / 2 + 0.085), topY - mountH - 0.01, z + 0.015)
      parent.add(knob)
    }
    const cordH = 0.16
    for (const s of [-1, 1]) {
      const cord = this.box(parent, this.mats.black, 0.008, Math.hypot(cordH, mountW * 0.3), 0.008, cx + s * mountW * 0.15, topY + cordH / 2, z + 0.01, 0.5)
      cord.rotation.z = s * Math.atan2(mountW * 0.3, cordH)
    }
  }

  /** Picture in a thin dark wood frame with a wide off-white mat. */
  private framedPicture(parent: THREE.Object3D, art: THREE.Material, w: number, h: number, x: number, y: number, z: number, rotY: number) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = rotY
    const matW = w + 0.24
    const matH = h + 0.24
    const fw = 0.045
    this.box(g, this.mats.darkWood, matW + fw * 2, fw, 0.04, 0, matH / 2 + fw / 2, 0.02, 0.5)
    this.box(g, this.mats.darkWood, matW + fw * 2, fw, 0.04, 0, -matH / 2 - fw / 2, 0.02, 0.5)
    this.box(g, this.mats.darkWood, fw, matH, 0.04, -matW / 2 - fw / 2, 0, 0.02, 0.5)
    this.box(g, this.mats.darkWood, fw, matH, 0.04, matW / 2 + fw / 2, 0, 0.02, 0.5)
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(matW, matH), this.mats.mat)
    mat.position.z = 0.005
    g.add(mat)
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), art)
    pic.position.z = 0.008
    g.add(pic)
    parent.add(g)
  }

  private textPanel(parent: THREE.Object3D, [glyph, title, body]: [string, string, string], w: number, h: number, x: number, y: number, z: number, rotY: number) {
    const [c, ctx] = canvas(768, 520)
    ctx.fillStyle = '#f3efe6'
    ctx.fillRect(0, 0, 768, 520)
    ctx.fillStyle = '#7a1f1a'
    ctx.font = 'bold 200px serif'
    ctx.textAlign = 'center'
    ctx.fillText(glyph, 384, 220)
    ctx.fillStyle = '#1d1a17'
    ctx.font = 'bold 46px serif'
    ctx.fillText(title, 384, 320)
    ctx.font = '28px sans-serif'
    ctx.fillStyle = '#4a443d'
    wrapText(ctx, body, 384, 375, 640, 38)
    const tex = canvasTexture(c)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.dimmable(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.3, roughness: 0.95, name: 'gallery-text-panel' })))
    m.position.set(x, y, z)
    m.rotation.y = rotY
    parent.add(m)
  }

  private titleWall(parent: THREE.Object3D) {
    const F = GALLERY_FLOOR
    const [c, ctx] = canvas(1024, 600)
    ctx.fillStyle = '#16120f'
    ctx.fillRect(0, 0, 1024, 600)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f2e6cd'
    ctx.font = 'bold 190px serif'
    ctx.fillText('日本の美', 512, 270)
    ctx.fillStyle = '#c9a24a'
    ctx.fillRect(312, 315, 400, 3)
    ctx.fillStyle = '#efe4cc'
    ctx.font = '600 58px serif'
    ctx.fillText('TREASURES OF JAPAN', 512, 400)
    ctx.fillStyle = '#b9a988'
    ctx.font = '32px sans-serif'
    ctx.fillText('Ink · Gold · Ukiyo-e · The Samurai', 512, 470)
    const tex = canvasTexture(c)
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.7),
      this.dimmable(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6, name: 'gallery-title' }))
    )
    m.position.set(-13.97, F + 2.2, 3.5)
    m.rotation.y = Math.PI / 2
    parent.add(m)
    this.wash(parent, 5.6, 3.8, -13.985, F + 2.2, 3.5, Math.PI / 2, 0.3)
    this.spotPlacements.push({ position: new THREE.Vector3(-11.5, CEIL - 0.3, 3.5), target: new THREE.Vector3(-13.9, F + 2.2, 3.5) })
  }

  private bench(parent: THREE.Object3D, x: number, z: number) {
    const F = GALLERY_FLOOR
    this.box(parent, this.mats.darkWood, 1.7, 0.07, 0.5, x, F + 0.44, z, 0.7)
    for (const s of [-1, 1]) this.box(parent, this.mats.darkWood, 0.08, 0.42, 0.42, x + s * 0.72, F + 0.2, z, 0.6)
  }

  /** Small lectern with an open book showing the piece's title. */
  private lectern(parent: THREE.Object3D, info: GalleryExhibitInfo, x: number, z: number, rotY: number) {
    const F = GALLERY_FLOOR
    const g = new THREE.Group()
    g.position.set(x, F, z)
    g.rotation.y = rotY
    this.box(g, this.mats.darkWood, 0.34, 0.03, 0.3, 0, 0.015, 0, 0.5)
    this.box(g, this.mats.darkWood, 0.05, 0.86, 0.05, 0, 0.45, 0, 0.5)
    const board = new THREE.Group()
    board.position.set(0, 0.9, 0)
    // Tilted up at the back, toward the reader standing on the lectern's +Z side
    board.rotation.x = 0.45
    this.box(board, this.mats.darkWood, 0.46, 0.022, 0.34, 0, 0, 0, 0.5)
    // Open book: two pages in a shallow V, with the title painted on
    const [c, ctx] = canvas(512, 256)
    ctx.fillStyle = '#f4ecdc'
    ctx.fillRect(0, 0, 512, 256)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(252, 0, 8, 256)
    ctx.fillStyle = '#7a1f1a'
    ctx.textAlign = 'center'
    ctx.font = 'bold 44px serif'
    ctx.fillText(info.titleJp.slice(0, 6), 128, 110)
    ctx.fillStyle = '#2a241e'
    ctx.font = 'bold 22px serif'
    wrapText(ctx, info.title, 384, 70, 220, 26)
    ctx.font = '16px sans-serif'
    ctx.fillStyle = '#5b5248'
    ctx.fillText('Read the history', 384, 210)
    ctx.fillStyle = '#5b5248'
    ctx.font = '15px sans-serif'
    ctx.fillText(info.date.split(',')[0]!, 128, 170)
    const tex = canvasTexture(c)
    const pageMat = this.dimmable(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.9, name: 'gallery-lectern-book' }))
    for (const s of [-1, 1]) {
      const page = new THREE.PlaneGeometry(0.2, 0.28)
      const uv = page.getAttribute('uv') as THREE.BufferAttribute
      for (let k = 0; k < uv.count; k++) uv.setX(k, (s < 0 ? 0 : 0.5) + uv.getX(k) * 0.5)
      const m = new THREE.Mesh(page, pageMat)
      m.rotation.x = -Math.PI / 2
      m.rotation.y = s * 0.12
      m.position.set(s * 0.1, 0.02, 0)
      board.add(m)
    }
    g.add(board)
    parent.add(g)
  }

  // =========================================================
  // Samurai armour, swords, handscroll case
  // =========================================================

  private lacingTexture(color: string): THREE.CanvasTexture {
    const [c, ctx] = canvas(256, 256)
    ctx.fillStyle = '#151210'
    ctx.fillRect(0, 0, 256, 256)
    const rows = 8
    const cols = 16
    const rh = 256 / rows
    const cw = 256 / cols
    for (let r = 0; r < rows; r++) {
      // Lacquered scales
      for (let k = 0; k < cols; k++) {
        ctx.fillStyle = (r + k) % 2 ? '#211c19' : '#1b1715'
        ctx.fillRect(k * cw + 1, r * rh + 2, cw - 2, rh * 0.42)
      }
      // Silk lacing (odoshi) running down between scales
      ctx.fillStyle = color
      for (let k = 0; k < cols; k++) ctx.fillRect(k * cw + cw * 0.3, r * rh + rh * 0.4, cw * 0.4, rh * 0.62)
      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      for (let k = 0; k < cols; k++) ctx.fillRect(k * cw + cw * 0.35, r * rh + rh * 0.45, cw * 0.08, rh * 0.5)
    }
    const t = canvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }

  private armourCase(parent: THREE.Object3D, x: number, z: number) {
    const F = GALLERY_FLOOR
    const g = new THREE.Group()
    g.position.set(x, F, z)
    parent.add(g)
    // Plinth and glass case
    this.box(g, this.mats.darkWood, 1.5, 0.28, 1.5, 0, 0.14, 0, 0.8)
    const glassH = 2.25
    for (const [w, d, px, pz, ry] of [
      [1.44, 0, 0, 0.72, 0],
      [1.44, 0, 0, -0.72, 0],
      [1.44, 0, 0.72, 0, Math.PI / 2],
      [1.44, 0, -0.72, 0, Math.PI / 2],
    ] as const) {
      void d
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, glassH), this.glass)
      pane.position.set(px, 0.28 + glassH / 2, pz)
      pane.rotation.y = ry
      pane.renderOrder = 2
      g.add(pane)
    }
    this.box(g, this.mats.darkWood, 1.5, 0.08, 1.5, 0, 0.28 + glassH + 0.04, 0, 0.8)
    this.colliders.push({ minX: x - 0.95, maxX: x + 0.95, minZ: z - 0.95, maxZ: z + 0.95 })

    const a = new THREE.Group()
    a.position.y = 0.28
    a.rotation.y = -0.35
    g.add(a)
    const lace = new THREE.MeshStandardMaterial({ map: this.lacingTexture('#a8322a'), roughness: 0.55, name: 'gallery-odoshi' })
    const laceMap = lace.map!
    laceMap.repeat.set(4, 2)
    // Armour box (yoroi-bitsu) the armour sits on
    this.box(a, this.mats.lacquer, 0.56, 0.42, 0.46, 0, 0.21, 0, 0.5)
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), this.mats.gold)
    crest.position.set(0, 0.24, 0.232)
    a.add(crest)
    // Kusazuri (skirt of laced plates) hanging over the box
    for (let i = 0; i < 4; i++) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.4, 10, 1, true, i * (Math.PI / 2) - 0.7, 1.4), lace)
      skirt.position.y = 0.62
      skirt.scale.z = 0.8
      a.add(skirt)
    }
    // Dō (cuirass)
    const doProfile = [
      [0.21, 0.0], [0.23, 0.12], [0.25, 0.26], [0.24, 0.36], [0.19, 0.44], [0.12, 0.47],
    ].map(([r, y]) => new THREE.Vector2(r!, y!))
    const dou = new THREE.Mesh(new THREE.LatheGeometry(doProfile, 20), lace)
    dou.position.y = 0.8
    dou.scale.z = 0.72
    a.add(dou)
    // Leather-covered breastplate panel (tsurubashiri)
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.24, 0.3, 14, 1, true, -0.55, 1.1), this.mats.lacquer)
    chest.position.set(0, 1.03, 0)
    chest.scale.z = 0.73
    a.add(chest)
    // Sode (great shoulder guards) and kote (armoured sleeves)
    for (const s of [-1, 1]) {
      const sode = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 8, 1, true, -0.35, 0.7), lace)
      sode.position.set(s * 0.06, 1.08, 0)
      sode.rotation.y = s * Math.PI / 2
      sode.rotation.z = s * 0.25
      a.add(sode)
      const kote = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.42, 10), this.brocadeMat())
      kote.position.set(s * 0.33, 0.95, 0.05)
      kote.rotation.z = s * 0.12
      a.add(kote)
    }
    // Kabuto (helmet): iron bowl, laced neck guard, gilded horns; face mask below
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mats.iron)
    bowl.position.y = 1.45
    a.add(bowl)
    this.box(a, this.mats.gold, 0.02, 0.004, 0.27, 0, 1.585, 0, 0.3)
    for (let i = 0; i < 3; i++) {
      const shikoro = new THREE.Mesh(new THREE.CylinderGeometry(0.15 + i * 0.03, 0.18 + i * 0.03, 0.06, 18, 1, true, Math.PI * 0.32, Math.PI * 1.36), lace)
      shikoro.position.y = 1.43 - i * 0.055
      a.add(shikoro)
    }
    for (const s of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 0.03, 1.52, 0.13), new THREE.Vector3(s * 0.05, 1.68, 0.17), new THREE.Vector3(s * 0.15, 1.78, 0.12))
      const horn = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.012, 6), this.mats.gold)
      a.add(horn)
      this.box(a, this.mats.lacquer, 0.07, 0.07, 0.015, s * 0.15, 1.42, 0.1, 0.3).rotation.y = s * 0.6
    }
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10, -Math.PI / 2, Math.PI, Math.PI * 0.35, Math.PI * 0.45), this.mats.lacquer)
    mask.position.set(0, 1.4, 0.03)
    a.add(mask)
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.08, 12, 1, true, -0.9, 1.8), lace)
    throat.position.set(0, 1.3, 0.02)
    a.add(throat)
  }

  private brocadeMatCache: THREE.MeshStandardMaterial | null = null
  private brocadeMat() {
    this.brocadeMatCache ??= new THREE.MeshStandardMaterial({ map: this.brocade(), roughness: 0.75, name: 'gallery-kote' })
    return this.brocadeMatCache
  }

  private ito: THREE.MeshStandardMaterial | null = null
  /** Silk-wrapped sword handle: diamond pattern of dark cord over pale ray skin. */
  private handleMaterial(): THREE.MeshStandardMaterial {
    if (!this.ito) {
      const [c, ctx] = canvas(64, 128)
      ctx.fillStyle = '#e9e1cf'
      ctx.fillRect(0, 0, 64, 128)
      ctx.fillStyle = '#1b1f2e'
      for (let y = -32; y < 160; y += 32) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(64, y + 32)
        ctx.lineTo(64, y + 44)
        ctx.lineTo(0, y + 12)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(64, y)
        ctx.lineTo(0, y + 32)
        ctx.lineTo(0, y + 44)
        ctx.lineTo(64, y + 12)
        ctx.fill()
      }
      const t = canvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(2, 4)
      this.ito = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, name: 'gallery-tsuka' })
    }
    return this.ito
  }

  /** A sword in its scabbard, lying along +X (handle at -X), base at the origin. */
  private sword(length: number, sheathed: boolean): THREE.Group {
    const g = new THREE.Group()
    const handle = length * 0.27
    const bladeLen = length - handle
    const sori = length * 0.025
    // Scabbard / blade follow a gentle arc
    const arc = (t: number) => new THREE.Vector3(t * bladeLen, Math.sin(t * Math.PI * 0.5) * sori * 2 - sori * 0.2, 0)
    if (sheathed) {
      const curve = new THREE.CatmullRomCurve3([0, 0.33, 0.66, 1].map(arc))
      const saya = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.016, 8), this.mats.lacquer)
      saya.scale.z = 0.6
      g.add(saya)
      const kojiri = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), this.mats.gold)
      kojiri.position.copy(arc(1))
      g.add(kojiri)
    } else {
      // Bare blade: steel with the frosty hamon along the edge
      const [c, ctx] = canvas(256, 32)
      const grd = ctx.createLinearGradient(0, 0, 0, 32)
      grd.addColorStop(0, '#9aa1a8')
      grd.addColorStop(0.55, '#c7ccd1')
      grd.addColorStop(1, '#f2f4f6')
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, 256, 32)
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      for (let x = 0; x < 256; x += 2) {
        const y = 20 + Math.sin(x * 0.18) * 3 + Math.sin(x * 0.05) * 2
        ctx.fillRect(x, y, 2, 32 - y)
      }
      const tex = canvasTexture(c)
      const steel = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.95, roughness: 0.18, name: 'gallery-blade' })
      const shape = new THREE.Shape()
      const w = 0.03
      shape.moveTo(0, 0)
      const n = 12
      for (let i = 0; i <= n; i++) {
        const p = arc(i / n)
        shape.lineTo(p.x, p.y - w / 2)
      }
      const tip = arc(1)
      shape.lineTo(tip.x + 0.04, tip.y + w * 0.1)
      for (let i = n; i >= 0; i--) {
        const p = arc(i / n)
        shape.lineTo(p.x, p.y + w / 2 * (i === n ? 0.6 : 1))
      }
      const blade = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 })
      blade.translate(0, 0, -0.002)
      const pos = blade.getAttribute('position') as THREE.BufferAttribute
      const uv = blade.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (bladeLen + 0.04), (pos.getY(i) - (arc(pos.getX(i) / bladeLen).y - w / 2)) / w)
      g.add(new THREE.Mesh(blade, steel))
      const habaki = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.034, 0.012), this.mats.gold)
      habaki.position.set(0.015, 0, 0)
      g.add(habaki)
    }
    // Tsuba (guard), tsuka (handle), kashira (pommel)
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 20), this.mats.iron)
    tsuba.rotation.z = Math.PI / 2
    tsuba.scale.set(1, 1, 0.8)
    g.add(tsuba)
    const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, handle, 10), this.handleMaterial())
    tsuka.rotation.z = Math.PI / 2
    tsuka.scale.set(1, 1, 0.75)
    tsuka.position.x = -handle / 2 - 0.004
    g.add(tsuka)
    const kashira = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), this.mats.gold)
    kashira.scale.set(0.6, 1, 0.75)
    kashira.position.x = -handle - 0.004
    g.add(kashira)
    return g
  }

  private katanaCase(parent: THREE.Object3D, x: number, z: number) {
    const F = GALLERY_FLOOR
    const g = new THREE.Group()
    g.position.set(x, F, z)
    parent.add(g)
    // Low plinth table with glass hood
    this.box(g, this.mats.darkWood, 2.1, 0.75, 0.9, 0, 0.375, 0, 0.8)
    this.box(g, this.mats.fabric, 2.0, 0.01, 0.82, 0, 0.755, 0, 1)
    const hoodH = 0.62
    for (const [w, px, pz, ry] of [
      [2.04, 0, 0.43, 0],
      [2.04, 0, -0.43, 0],
      [0.86, 1.02, 0, Math.PI / 2],
      [0.86, -1.02, 0, Math.PI / 2],
    ] as const) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, hoodH), this.glass)
      pane.position.set(px, 0.76 + hoodH / 2, pz)
      pane.rotation.y = ry
      pane.renderOrder = 2
      g.add(pane)
    }
    const topPane = new THREE.Mesh(new THREE.PlaneGeometry(2.04, 0.86), this.glass)
    topPane.rotation.x = -Math.PI / 2
    topPane.position.y = 0.76 + hoodH
    topPane.renderOrder = 2
    g.add(topPane)
    this.colliders.push({ minX: x - 1.25, maxX: x + 1.25, minZ: z - 0.65, maxZ: z + 0.65 })

    // Katana-kake: lacquered two-tier stand holding the daishō in scabbards
    const kake = new THREE.Group()
    kake.position.set(0, 0.76, -0.18)
    g.add(kake)
    this.box(kake, this.mats.lacquer, 1.0, 0.035, 0.2, 0, 0.018, 0, 0.5)
    for (const s of [-1, 1]) {
      this.box(kake, this.mats.lacquer, 0.04, 0.4, 0.16, s * 0.42, 0.22, 0, 0.5)
      this.box(kake, this.mats.gold, 0.042, 0.02, 0.165, s * 0.42, 0.42, 0, 0.3)
    }
    const katana = this.sword(1.0, true)
    katana.position.set(-0.23, 0.37, 0)
    kake.add(katana)
    const waki = this.sword(0.68, true)
    waki.position.set(-0.16, 0.2, 0)
    kake.add(waki)
    // A bare blade on low rests in front, showing its hamon
    for (const s of [-1, 1]) this.box(g, this.mats.lacquer, 0.05, 0.05, 0.08, s * 0.35, 0.785, 0.16, 0.4)
    const blade = this.sword(1.0, false)
    blade.rotation.x = -Math.PI / 2
    blade.position.set(-0.23, 0.82, 0.16)
    g.add(blade)
  }

  private handscrollCase(parent: THREE.Object3D, art: THREE.Material, cx: number, cz: number, length: number) {
    const F = GALLERY_FLOOR
    const g = new THREE.Group()
    g.position.set(cx, F, cz)
    parent.add(g)
    const depth = 0.85
    this.box(g, this.mats.lightWood, length + 0.2, 0.8, depth, 0, 0.4, 0, 0.9)
    // Sloped board covered in fabric, the scroll unrolled on it
    const board = new THREE.Group()
    board.position.set(0, 0.86, 0)
    board.rotation.x = -0.3
    g.add(board)
    this.box(board, this.mats.fabric, length, 0.02, depth - 0.12, 0, 0, 0, 1)
    const scrollH = 0.5
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(length - 0.3, scrollH), art)
    paper.rotation.x = -Math.PI / 2
    paper.position.set(0, 0.012, 0)
    board.add(paper)
    for (const s of [-1, 1]) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, scrollH + 0.04, 14), this.mats.mat)
      roll.rotation.x = Math.PI / 2
      roll.position.set(s * (length / 2 - 0.12), 0.03, 0)
      board.add(roll)
    }
    // Sloped glass lid
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(length + 0.2, depth + 0.05), this.glass)
    lid.rotation.x = -Math.PI / 2 - 0.3
    lid.position.set(0, 1.0, 0)
    lid.renderOrder = 2
    g.add(lid)
    this.colliders.push({ minX: cx - length / 2 - 0.35, maxX: cx + length / 2 + 0.35, minZ: cz - depth / 2 - 0.3, maxZ: 7.4 })
  }

  // =========================================================
  // Walking: floors, stairs and collisions
  // =========================================================

  private inStair(x: number, z: number) {
    return x > STAIR.x0 && x < STAIR.x1 && z > STAIR.z0 - 0.02 && z < STAIR.z1
  }

  private stairHeight(z: number) {
    return THREE.MathUtils.clamp((z - STAIR.z0) / (STAIR.z1 - STAIR.z0), 0, 1) * GALLERY_FLOOR
  }

  /** Floor height under the player (0 = ground level, 1 = gallery level). */
  floorAt(level: number, x: number, z: number): number {
    if (this.inStair(x, z)) return this.stairHeight(z)
    return level === 1 ? GALLERY_FLOOR : 0
  }

  private walkable(level: number, x: number, z: number): boolean {
    const walkway = x >= 14.18 && x <= 16.1 && z >= -0.1 && z <= 7.1
    if (level === 0) {
      // Walkway, the floor in front of the stairs' foot, and the open floor east of the stairs
      const foot = x >= 16.1 && x <= ANNEX_X1 - 0.18 && z >= -0.1 && z <= STAIR.z0
      const east = x >= STAIR.x1 + 0.15 && x <= ANNEX_X1 - 0.18 && z >= -0.1 && z <= 7.1
      return walkway || foot || east
    }
    if (walkway) return true
    if (x >= 16.1 && x <= ANNEX_X1 - 0.18 && z >= STAIR.z1 + 0.12 && z <= 7.1) return true
    if (x >= 13.7 && x < 14.18) return z >= ENTRANCE.z0 + 0.1 && z <= ENTRANCE.z1 - 0.02
    if (x >= -13.75 && x < 13.7 && z >= 0.05 && z <= 7.05) {
      for (const c of this.colliders) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return false
      return true
    }
    return false
  }

  /**
   * One walking step inside the gallery / annex. `exitToCorridor` means the player has walked back
   * out through the corridor doorway.
   */
  move(level: number, x: number, z: number, nx: number, nz: number): { allowed: boolean; level: number; exitToCorridor?: boolean } {
    const blocked = { allowed: false, level }
    if (level === 0 && nx < 14.18 && !this.inStair(nx, nz)) {
      const inDoor = nz > GALLERY_OPENING.z0 + 0.2 && nz < GALLERY_OPENING.z1 - 0.2
      return inDoor && nx > 13.3 ? { allowed: true, level: 0, exitToCorridor: nx < 13.95 } : blocked
    }
    const fromStair = this.inStair(x, z)
    if (this.inStair(nx, nz)) {
      const h = this.stairHeight(nz)
      if (!fromStair) {
        // Step on only at the foot (from below) or the head (from above); elsewhere it's the handrail
        if (level === 0 && h > 0.45) return blocked
        if (level === 1 && h < GALLERY_FLOOR - 0.45) return blocked
      }
      return { allowed: true, level: h > GALLERY_FLOOR / 2 ? 1 : 0 }
    }
    if (fromStair) {
      const h = this.stairHeight(z)
      const lv = h > GALLERY_FLOOR / 2 ? 1 : 0
      if (lv === 0 && h > 0.45) return blocked
      if (lv === 1 && h < GALLERY_FLOOR - 0.45) return blocked
      return this.walkable(lv, nx, nz) ? { allowed: true, level: lv } : blocked
    }
    return this.walkable(level, nx, nz) ? { allowed: true, level } : blocked
  }

  /** True once the player is high enough on the stairs (or upstairs) to see into the hall. */
  canSeeHall(level: number, x: number, z: number): boolean {
    return level === 1 || this.floorAt(level, x, z) > 2.2
  }

  nearestStand(x: number, z: number, maxDist = 1.6): ExhibitStand | null {
    let best: ExhibitStand | null = null
    let bestD = maxDist
    for (const s of this.stands) {
      const d = Math.hypot(s.x - x, s.z - z)
      if (d < bestD) {
        bestD = d
        best = s
      }
    }
    return best
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy)
      line = w
      yy += lineH
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

/**
 * Merge every static, opaque, non-instanced mesh under `root` into one mesh per material (baked in
 * root space), cutting the gallery's few hundred parts to a few dozen draw calls.
 */
function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map<string, { material: THREE.Material; meshes: THREE.Mesh[] }>()
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh || (m as any).isInstancedMesh || Array.isArray(m.material)) return
    if (m.material.transparent) return
    const g = m.geometry
    const key = `${m.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${!!g.index}`
    let b = buckets.get(key)
    if (!b) {
      b = { material: m.material, meshes: [] }
      buckets.set(key, b)
    }
    b.meshes.push(m)
  })
  const tmp = new THREE.Matrix4()
  for (const { material, meshes } of buckets.values()) {
    if (meshes.length < 2) continue
    const geos = meshes.map((m) => {
      const g = m.geometry.clone()
      g.clearGroups()
      g.applyMatrix4(tmp.multiplyMatrices(inv, m.matrixWorld))
      return g
    })
    const merged = mergeGeometries(geos, false)
    geos.forEach((g) => g.dispose())
    if (!merged) continue
    const mesh = new THREE.Mesh(merged, material)
    mesh.receiveShadow = true
    mesh.userData.mergedStatic = true
    for (const m of meshes) m.removeFromParent()
    root.add(mesh)
  }
}
