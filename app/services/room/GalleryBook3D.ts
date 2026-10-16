import * as THREE from 'three'
import { CurvedSheet, CurvedStack, gutterShade, stackSurfaceHeight } from './BookGeometry'
import type { GalleryExhibitInfo } from './GalleryCatalog'

/**
 * The gallery's history book as a real 3D book (its own small WebGL scene inside the reader
 * overlay), built from the same page geometry as the study-room books: both page stacks curve down
 * into the binding ("gull wing") with soft shading in the gutter, the hard cover swings open on its
 * hinge, and each page turn is a bending, inextensible leaf that grows out of the spine's valley:
 * the part near the binding lifts first while the free edge lags behind, the lower corner leads as
 * if pulled by a hand, and the leaf casts a soft shadow on the page beneath.
 */

type Kind = 'cover' | 'image' | 'title' | 's1' | 's2' | 's3' | 'colophon'

/** Spread 0 is the closed book; the rest are open spreads [left page, right page] */
const SPREADS: Array<[Kind | null, Kind]> = [
  [null, 'cover'],
  ['image', 'title'],
  ['s1', 's2'],
  ['s3', 'colophon'],
]

// Real-world size, the same proportions as the study-room book
const PAGE_W = 0.336
const PAGE_L = 0.46
const BOARD_T = 0.003
const BOARD_OVER = 0.008
const STACK_TOTAL = 0.026
const LEAF_COLS = 44
const LEAF_ROWS = 12
const LEAF_MS = 1150
const COVER_MS = 1250
/** How far the free edge lags behind the binding during a turn (0 = a stiff board) */
const LAG = 0.75

const TEX_W = 1024
const TEX_H = Math.round((TEX_W * PAGE_L) / PAGE_W)

const leftHeight = (spread: number) => (spread < 1 ? 0 : 0.003 + 0.0065 * (spread - 1))
const rightHeight = (spread: number) => STACK_TOTAL - leftHeight(spread)
const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x))
  return t * t * (3 - 2 * t)
}

interface Turn {
  kind: 'leaf' | 'cover'
  dir: 1 | -1
  from: number
  to: number
  start: number
}

export interface GalleryBookOptions {
  onFlip?: () => void
  /** Called whenever the visible spread changes (after a turn completes) */
  onSpread?: (spread: number, last: number) => void
}

export class GalleryBook3D {
  readonly spreadCount = SPREADS.length
  spread = 0

  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.01, 10)
  private readonly book = new THREE.Group()
  private readonly textures = new Map<Kind, THREE.CanvasTexture>()
  private readonly painter: PagePainter

  private readonly rightStack: CurvedStack
  private readonly leftStack: CurvedStack
  private readonly rightSheet: CurvedSheet
  private readonly leftSheet: CurvedSheet
  private readonly rightStackMesh: THREE.Mesh
  private readonly leftStackMesh: THREE.Mesh
  private readonly rightSheetMesh: THREE.Mesh
  private readonly leftSheetMesh: THREE.Mesh
  private readonly rightSheetMat: THREE.MeshStandardMaterial
  private readonly leftSheetMat: THREE.MeshStandardMaterial

  private readonly cover = new THREE.Group()
  private readonly coverBoard: THREE.Mesh

  private readonly leafGeo = new THREE.BufferGeometry()
  private readonly leafBackGeo = new THREE.BufferGeometry()
  private readonly leafFront: THREE.Mesh
  private readonly leafBack: THREE.Mesh
  private readonly leafFrontMat: THREE.MeshStandardMaterial
  private readonly leafBackMat: THREE.MeshStandardMaterial

  private turn: Turn | null = null
  private raf = 0
  private disposed = false
  private readonly resizeObserver: ResizeObserver

  constructor(
    private readonly canvas: HTMLCanvasElement,
    exhibit: GalleryExhibitInfo,
    private readonly opts: GalleryBookOptions = {}
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.painter = new PagePainter(exhibit, (kind) => {
      const tex = this.textures.get(kind)
      if (tex) tex.needsUpdate = true
    })

    // Lighting: soft sky fill + a warm key from the upper left that throws the leaf's shadow
    this.scene.add(new THREE.HemisphereLight('#fff8ec', '#4a3c30', 1.25))
    const key = new THREE.DirectionalLight('#fff3e0', 1.6)
    key.position.set(-0.35, 1.1, 0.45)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -0.5
    key.shadow.camera.right = 0.5
    key.shadow.camera.top = 0.4
    key.shadow.camera.bottom = -0.4
    key.shadow.camera.near = 0.2
    key.shadow.camera.far = 2.5
    key.shadow.bias = -0.0004
    key.shadow.radius = 4
    this.scene.add(key)

    this.scene.add(this.book)

    // Soft contact shadow under the book (the overlay behind is transparent)
    const [sc, sctx] = makeCanvas(256, 256)
    const g = sctx.createRadialGradient(128, 128, 10, 128, 128, 128)
    g.addColorStop(0, 'rgba(0,0,0,0.55)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    sctx.fillStyle = g
    sctx.fillRect(0, 0, 256, 256)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(PAGE_W * 2 + 0.2, PAGE_L + 0.16),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -BOARD_T - 0.001
    this.book.add(shadow)

    // Cloth boards: the back cover under the right stack, and the front cover that opens over
    const cloth = new THREE.MeshStandardMaterial({ map: this.painter.clothTexture(), roughness: 0.85 })
    const boardGeo = new THREE.BoxGeometry(PAGE_W + BOARD_OVER, BOARD_T, PAGE_L + BOARD_OVER * 1.5)
    const backBoard = new THREE.Mesh(boardGeo, cloth)
    backBoard.position.set((PAGE_W + BOARD_OVER) / 2, -BOARD_T / 2, 0)
    backBoard.receiveShadow = true
    this.book.add(backBoard)
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, PAGE_L + BOARD_OVER * 1.5, 16, 1, true, Math.PI / 2, Math.PI), cloth)
    spine.rotation.x = Math.PI / 2
    spine.position.set(0, -0.0035, 0)
    spine.scale.set(1, 1, 0.45)
    this.book.add(spine)

    // Page stacks with their page-edge texture, topped by the visible curved sheets
    const edges = new THREE.MeshStandardMaterial({ map: this.painter.edgeTexture(), roughness: 0.95 })
    const paperTop = new THREE.MeshStandardMaterial({ color: '#f3ead8', roughness: 0.95 })
    const stackMats = [edges, edges, paperTop, paperTop, edges, edges]
    this.rightStack = new CurvedStack({ innerX: 0, outerX: PAGE_W * 0.99, profileWidth: PAGE_W, length: PAGE_L * 0.985 })
    this.leftStack = new CurvedStack({ innerX: 0, outerX: -PAGE_W * 0.99, profileWidth: PAGE_W, length: PAGE_L * 0.985 })
    this.rightStackMesh = new THREE.Mesh(this.rightStack.geometry, stackMats)
    this.leftStackMesh = new THREE.Mesh(this.leftStack.geometry, stackMats)
    for (const m of [this.rightStackMesh, this.leftStackMesh]) {
      m.receiveShadow = true
      m.castShadow = true
      this.book.add(m)
    }
    this.rightSheet = new CurvedSheet(PAGE_W, PAGE_L, 'right', 56)
    this.leftSheet = new CurvedSheet(PAGE_W, PAGE_L, 'left', 56)
    // Every page material starts with a page texture, so turning pages only swaps textures and
    // never makes the GPU rebuild a shader mid-turn
    this.rightSheetMat = new THREE.MeshStandardMaterial({ map: this.tex('title'), vertexColors: true, roughness: 0.9 })
    this.leftSheetMat = new THREE.MeshStandardMaterial({ map: this.tex('image'), vertexColors: true, roughness: 0.9 })
    this.rightSheetMesh = new THREE.Mesh(this.rightSheet.geometry, this.rightSheetMat)
    this.leftSheetMesh = new THREE.Mesh(this.leftSheet.geometry, this.leftSheetMat)
    for (const m of [this.rightSheetMesh, this.leftSheetMesh]) {
      m.receiveShadow = true
      this.book.add(m)
    }

    // Front cover: a stiff board hinged at the spine; cover design outside, the plate inside
    const coverMats = [
      cloth,
      cloth,
      new THREE.MeshStandardMaterial({ map: this.tex('cover'), roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ map: this.coverInsideTexture(), roughness: 0.9 }),
      cloth,
      cloth,
    ]
    this.coverBoard = new THREE.Mesh(boardGeo, coverMats)
    this.coverBoard.castShadow = true
    this.coverBoard.receiveShadow = true
    this.cover.add(this.coverBoard)
    this.book.add(this.cover)

    // The turning leaf: one grid, two faces (front shows the page being turned, back the next one)
    this.buildLeafGeometry()
    this.leafFrontMat = new THREE.MeshStandardMaterial({ map: this.tex('title'), vertexColors: true, roughness: 0.9, side: THREE.FrontSide })
    this.leafBackMat = new THREE.MeshStandardMaterial({ map: this.tex('s1'), vertexColors: true, roughness: 0.9, side: THREE.BackSide })
    this.leafFront = new THREE.Mesh(this.leafGeo, this.leafFrontMat)
    this.leafBack = new THREE.Mesh(this.leafBackGeo, this.leafBackMat)
    for (const m of [this.leafFront, this.leafBack]) {
      m.castShadow = true
      m.receiveShadow = true
      m.visible = false
      m.frustumCulled = false
      this.book.add(m)
    }

    this.layout(0, 0)
    this.resize()
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.loop()
  }

  // =========================================================
  // Public controls
  // =========================================================

  get busy() {
    return !!this.turn
  }

  next() {
    if (this.turn || this.spread >= SPREADS.length - 1) return
    this.startTurn(this.spread === 0 ? 'cover' : 'leaf', 1)
  }

  prev() {
    if (this.turn || this.spread <= 1) return
    this.startTurn('leaf', -1)
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.resizeObserver.disconnect()
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.geometry.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        ;(mat as THREE.MeshStandardMaterial).map?.dispose()
        mat.dispose()
      }
    })
    for (const t of this.textures.values()) t.dispose()
    this.renderer.dispose()
  }

  // =========================================================
  // Internals
  // =========================================================

  private tex(kind: Kind): THREE.CanvasTexture {
    let t = this.textures.get(kind)
    if (!t) {
      t = new THREE.CanvasTexture(this.painter.page(kind))
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = this.renderer.capabilities.getMaxAnisotropy()
      this.textures.set(kind, t)
    }
    return t
  }

  /** The plate on the inside of the front cover is the same picture page, laid out for the board. */
  private coverInsideTexture(): THREE.CanvasTexture {
    const t = this.tex('image').clone()
    // The board's underside is seen after the cover has rotated 180° about the spine
    t.center.set(0.5, 0.5)
    t.rotation = Math.PI
    t.repeat.set(-1, 1)
    t.needsUpdate = true
    // Shares the picture page's image source, but repaint it too once the artwork has loaded
    this.painter.onRepaint('image', () => (t.needsUpdate = true))
    return t
  }

  private resize() {
    const w = this.canvas.clientWidth || 1
    const h = this.canvas.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Frame the open book (2 pages wide) looking down at a comfortable reading angle
    const halfW = PAGE_W + BOARD_OVER + 0.015
    const halfH = PAGE_L / 2 + 0.03
    const vfov = THREE.MathUtils.degToRad(this.camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect)
    const tilt = THREE.MathUtils.degToRad(24)
    const d = Math.max(halfW / Math.tan(hfov / 2), (halfH * Math.cos(tilt)) / Math.tan(vfov / 2)) + 0.03
    this.camera.position.set(0, Math.cos(tilt) * d, Math.sin(tilt) * d)
    this.camera.lookAt(0, 0, 0.012)
    this.camera.updateProjectionMatrix()
  }

  private startTurn(kind: 'leaf' | 'cover', dir: 1 | -1) {
    const from = this.spread
    const to = from + dir
    this.turn = { kind, dir, from, to, start: performance.now() }
    this.opts.onFlip?.()
    if (kind === 'leaf') {
      // Front = page being turned over, back = the page that lands on the other side
      const front = dir > 0 ? SPREADS[from]![1] : SPREADS[to]![1]
      const back = dir > 0 ? SPREADS[to]![0]! : SPREADS[from]![0]!
      this.leafFrontMat.map = this.tex(front)
      this.leafBackMat.map = this.tex(back)
      // Underneath: the pages revealed once the leaf has moved
      this.setSheetMap(this.rightSheetMat, this.tex(SPREADS[dir > 0 ? to : from]![1]))
      this.setSheetMap(this.leftSheetMat, this.tex(SPREADS[dir > 0 ? from : to]![0]!))
    } else {
      this.setSheetMap(this.rightSheetMat, this.tex(SPREADS[1]![1]))
    }
  }

  private setSheetMap(mat: THREE.MeshStandardMaterial, map: THREE.Texture) {
    if (mat.map === map) return
    mat.map = map
  }

  /** Poses everything for a spread `s` blended toward `s2` by `k` (used by page turns). */
  private layout(s: number, coverOpen: number, s2 = s, k = 0) {
    const lh = THREE.MathUtils.lerp(leftHeight(s), leftHeight(s2), k)
    const rh = THREE.MathUtils.lerp(rightHeight(s), rightHeight(s2), k)
    const open = coverOpen
    this.rightStack.update(rh, open)
    this.rightSheet.update(rh, open)
    this.rightStackMesh.visible = true
    const leftVisible = open > 0.999 && Math.max(s, s2) >= 1
    this.leftStack.update(Math.max(lh, 0.0006), 1)
    this.leftSheet.update(Math.max(lh, 0.0006), 1)
    this.leftStackMesh.visible = leftVisible
    this.leftSheetMesh.visible = leftVisible

    // Cover hinged about the middle of the closed block, swinging over the top to the left
    const pivotY = rightHeight(0) / 2
    this.cover.position.set(0, pivotY, 0)
    this.cover.rotation.z = Math.PI * open
    this.coverBoard.position.set((PAGE_W + BOARD_OVER) / 2, rightHeight(0) / 2 + BOARD_T / 2, 0)
    // A closed book sits centred; as it opens it slides so the spread is centred
    this.book.position.x = -((PAGE_W + BOARD_OVER) / 2) * (1 - open)
    if (!this.turn && s >= 1) {
      this.setSheetMap(this.rightSheetMat, this.tex(SPREADS[s]![1]))
      this.setSheetMap(this.leftSheetMat, this.tex(SPREADS[s]![0]!))
    }
    return { lh, rh }
  }

  private buildLeafGeometry() {
    const verts = (LEAF_COLS + 1) * (LEAF_ROWS + 1)
    const pos = new THREE.BufferAttribute(new Float32Array(verts * 3), 3)
    pos.setUsage(THREE.DynamicDrawUsage)
    const nrm = new THREE.BufferAttribute(new Float32Array(verts * 3), 3)
    const col = new THREE.BufferAttribute(new Float32Array(verts * 3), 3)
    col.setUsage(THREE.DynamicDrawUsage)
    const uvF = new Float32Array(verts * 2)
    const uvB = new Float32Array(verts * 2)
    for (let r = 0; r <= LEAF_ROWS; r++) {
      for (let c = 0; c <= LEAF_COLS; c++) {
        const i = r * (LEAF_COLS + 1) + c
        const u = c / LEAF_COLS
        const v = 1 - r / LEAF_ROWS
        uvF[i * 2] = u
        uvF[i * 2 + 1] = v
        // The back face is read from the other side: mirror across the page
        uvB[i * 2] = 1 - u
        uvB[i * 2 + 1] = v
      }
    }
    const index: number[] = []
    for (let r = 0; r < LEAF_ROWS; r++) {
      for (let c = 0; c < LEAF_COLS; c++) {
        const a = r * (LEAF_COLS + 1) + c
        const b = a + 1
        const d = a + LEAF_COLS + 1
        const e = d + 1
        index.push(a, d, b, b, d, e)
      }
    }
    for (const [geo, uv] of [
      [this.leafGeo, uvF],
      [this.leafBackGeo, uvB],
    ] as const) {
      geo.setAttribute('position', pos)
      geo.setAttribute('normal', nrm)
      geo.setAttribute('color', col)
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      geo.setIndex(index)
    }
  }

  /**
   * Shapes the turning leaf. Each row is integrated along the paper from the spine, so the sheet
   * never stretches. Its tangent angle blends from the curve of the stack it leaves to the curve
   * of the stack it lands on, with every point running its own slightly delayed progress (more
   * delay toward the free edge, less at the lower corner): that delay is the curl.
   */
  private shapeLeaf(t: number, dir: 1 | -1, fromH: number, toH: number) {
    const pos = this.leafGeo.getAttribute('position') as THREE.BufferAttribute
    const col = this.leafGeo.getAttribute('color') as THREE.BufferAttribute
    const ds = 1 / LEAF_COLS
    // Right-hand stack height and left-hand stack height during this turn
    const rh = dir > 0 ? fromH : toH
    const lh = dir > 0 ? toH : fromH
    const slope = (h: number, u: number) => {
      const du = 0.004
      const a = stackSurfaceHeight(Math.max(0, u - du), h)
      const b = stackSurfaceHeight(u + du, h)
      return Math.atan((b - a) / ((u + du - Math.max(0, u - du)) * PAGE_W))
    }
    const root = stackSurfaceHeight(0, rh) // the binding pins both stacks at the same valley
    // Height above the page beneath. With the rest poses below matching the sheets' own curve, this
    // clears the sheets' straight segments across the gutter dip, so the page underneath can never
    // show through the turning page (which looked as if its text were being erased)
    const lift = 0.0012
    const progress = (s: number, lag: number) => {
      const g = smooth(t * (1 + LAG) - lag * Math.pow(s, 1.15))
      return dir > 0 ? g : 1 - g // 0 = lying on the right-hand stack, 1 = lying on the left-hand one
    }
    let flight = 0
    for (let r = 0; r <= LEAF_ROWS; r++) {
      const v = r / LEAF_ROWS - 0.5
      // The lower corner (nearest the reader) is where a hand turns the page: it leads
      const lag = LAG * (1 - 0.5 * (v + 0.5))
      let x = 0
      let y = root
      for (let c = 0; c <= LEAF_COLS; c++) {
        const s = c / LEAF_COLS
        const i = r * (LEAF_COLS + 1) + c
        // Where the paper is still lying on (or has just landed on) a stack, it takes exactly the
        // shape of the page sheet there; in between it follows the bending curl
        const Ev = progress(s, lag)
        const onRight = 1 - smooth(Ev / 0.14)
        const onLeft = 1 - smooth((1 - Ev) / 0.14)
        const curl = 1 - onRight - onLeft
        const px = x * curl + s * PAGE_W * onRight - s * PAGE_W * onLeft
        const py = y * curl + stackSurfaceHeight(s, rh) * onRight + stackSurfaceHeight(s, lh) * onLeft
        pos.setXYZ(i, px, py + lift, v * PAGE_L)
        // Integrate the curl along the paper (inextensible): tangent from the stack it leaves to
        // the stack it lands on, each bit of paper on its own slightly delayed progress
        const sm = s + ds / 2
        const E = progress(sm, lag)
        const phi = slope(rh, sm) * (1 - E) + (Math.PI - slope(lh, sm)) * E
        x += Math.cos(phi) * ds * PAGE_W
        y += Math.sin(phi) * ds * PAGE_W
        flight = Math.max(flight, Math.sin(Math.PI * Ev))
        // Gutter shading fades out as the paper lifts into the light
        const rest = 1 - Math.sin(Math.PI * Ev)
        const shade = 1 - (1 - gutterShade(s)) * rest
        col.setXYZ(i, shade, shade, shade)
      }
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    this.leafGeo.computeVertexNormals()
    this.leafGeo.computeBoundingSphere()
    return flight
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const turn = this.turn
    if (turn) {
      const dur = turn.kind === 'cover' ? COVER_MS : LEAF_MS
      const t = Math.min(1, (performance.now() - turn.start) / dur)
      if (turn.kind === 'cover') {
        // A stiff board: one smooth swing with a soft landing
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        this.layout(0, e)
      } else {
        const k = smooth(t)
        const { lh, rh } = this.layout(turn.from, 1, turn.to, k)
        const fromH = turn.dir > 0 ? rh : lh
        const toH = turn.dir > 0 ? lh : rh
        this.leafFront.visible = this.leafBack.visible = true
        this.shapeLeaf(t, turn.dir, fromH, toH)
      }
      if (t >= 1) {
        this.turn = null
        this.spread = turn.to
        this.leafFront.visible = this.leafBack.visible = false
        this.layout(this.spread, 1)
        this.opts.onSpread?.(this.spread, SPREADS.length - 1)
      }
    }
    this.renderer.render(this.scene, this.camera)
  }
}

// =========================================================
// Page painting (Canvas 2D)
// =========================================================

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"
const SANS = 'system-ui, -apple-system, Segoe UI, sans-serif'
const INK = '#2a231c'
const RED = '#7a1f1a'
const GOLD = '#9a7b3e'

class PagePainter {
  private readonly canvases = new Map<Kind, HTMLCanvasElement>()
  private readonly repaintHooks = new Map<Kind, Array<() => void>>()
  private image: HTMLImageElement | null = null
  private paperNoise: HTMLCanvasElement | null = null

  constructor(
    private readonly ex: GalleryExhibitInfo,
    private readonly repainted: (kind: Kind) => void
  ) {
    if (ex.image) {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        this.image = img
        this.draw('image')
        this.repainted('image')
        for (const fn of this.repaintHooks.get('image') ?? []) fn()
      }
      img.src = ex.image
    }
  }

  onRepaint(kind: Kind, fn: () => void) {
    const list = this.repaintHooks.get(kind) ?? []
    list.push(fn)
    this.repaintHooks.set(kind, list)
  }

  page(kind: Kind): HTMLCanvasElement {
    let c = this.canvases.get(kind)
    if (!c) {
      c = makeCanvas(TEX_W, TEX_H)[0]
      this.canvases.set(kind, c)
      this.draw(kind)
    }
    return c
  }

  clothTexture(): THREE.CanvasTexture {
    const [c, ctx] = makeCanvas(256, 256)
    ctx.fillStyle = '#2c3a3f'
    ctx.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  }

  /** Fine horizontal lines of the page block's edges. */
  edgeTexture(): THREE.CanvasTexture {
    const [c, ctx] = makeCanvas(64, 256)
    ctx.fillStyle = '#eee3cc'
    ctx.fillRect(0, 0, 64, 256)
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = `rgba(120,95,60,${0.08 + Math.random() * 0.1})`
      ctx.fillRect(0, y, 64, 1)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.rotation = Math.PI / 2
    return t
  }

  private paper(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#f6eedd'
    ctx.fillRect(0, 0, TEX_W, TEX_H)
    if (!this.paperNoise) {
      const [n, nctx] = makeCanvas(256, 256)
      for (let i = 0; i < 5000; i++) {
        nctx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,95,60' : '255,255,255'},${Math.random() * 0.05})`
        nctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1)
      }
      this.paperNoise = n
    }
    ctx.fillStyle = ctx.createPattern(this.paperNoise, 'repeat')!
    ctx.fillRect(0, 0, TEX_W, TEX_H)
  }

  private wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, firstIndent = 0): number {
    const words = text.split(' ')
    let line = ''
    let yy = y
    let indent = firstIndent
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxW - indent && line) {
        ctx.fillText(line, x + indent, yy)
        line = w
        yy += lineH
        indent = 0
      } else {
        line = test
      }
    }
    if (line) ctx.fillText(line, x + indent, yy)
    return yy + lineH
  }

  private folio(ctx: CanvasRenderingContext2D, kind: Kind) {
    const order: Kind[] = ['image', 'title', 's1', 's2', 's3', 'colophon']
    const n = order.indexOf(kind) + 1
    if (n <= 0) return
    ctx.fillStyle = '#8a7b68'
    ctx.font = `28px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.fillText(String(n), TEX_W / 2, TEX_H - 52)
    ctx.textAlign = 'left'
  }

  private draw(kind: Kind) {
    const c = this.page(kind)
    const ctx = c.getContext('2d')!
    const ex = this.ex
    const M = 92
    const W = TEX_W - M * 2
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'

    if (kind === 'cover') {
      ctx.fillStyle = '#2c3a3f'
      ctx.fillRect(0, 0, TEX_W, TEX_H)
      for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.045)`
        ctx.fillRect(Math.random() * TEX_W, Math.random() * TEX_H, 3, 1)
      }
      // Title slip with vertical Japanese title
      const sw = 220
      const sh = TEX_H * 0.62
      const sx = TEX_W / 2 - sw / 2
      const sy = TEX_H * 0.14
      ctx.fillStyle = '#f1e6cf'
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = 14
      ctx.fillRect(sx, sy, sw, sh)
      ctx.shadowBlur = 0
      ctx.strokeStyle = '#c9a24a'
      ctx.lineWidth = 3
      ctx.strokeRect(sx + 12, sy + 12, sw - 24, sh - 24)
      ctx.fillStyle = INK
      ctx.textAlign = 'center'
      const chars = [...ex.titleJp]
      const step = Math.min(96, (sh - 80) / chars.length)
      ctx.font = `700 ${Math.round(step * 0.82)}px ${SERIF}`
      chars.forEach((ch, i) => ctx.fillText(ch, TEX_W / 2, sy + 60 + step * (i + 0.8)))
      ctx.fillStyle = '#c9a24a'
      ctx.font = `30px ${SERIF}`
      ctx.fillText('日 本 美 術', TEX_W / 2, TEX_H - 110)
      return
    }

    this.paper(ctx)
    if (kind === 'image') {
      const px = M
      const py = M
      const pw = W
      const ph = TEX_H - M * 2 - 190
      ctx.fillStyle = '#efe5d1'
      ctx.fillRect(px, py, pw, ph)
      ctx.strokeStyle = 'rgba(80,60,30,0.18)'
      ctx.lineWidth = 2
      ctx.strokeRect(px, py, pw, ph)
      if (this.image) {
        const img = this.image
        const s = Math.min((pw - 70) / img.width, (ph - 70) / img.height)
        const w = img.width * s
        const h = img.height * s
        const ix = px + (pw - w) / 2
        const iy = py + (ph - h) / 2
        ctx.shadowColor = 'rgba(40,25,10,0.38)'
        ctx.shadowBlur = 22
        ctx.shadowOffsetY = 6
        if (ex.medium.toLowerCase().includes('photograph')) {
          ctx.fillStyle = '#fbf7ee'
          ctx.fillRect(ix - 14, iy - 14, w + 28, h + 28)
        }
        ctx.drawImage(img, ix, iy, w, h)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0
      } else if (ex.glyph) {
        ctx.fillStyle = RED
        ctx.font = `700 380px ${SERIF}`
        ctx.textAlign = 'center'
        ctx.fillText(ex.glyph, TEX_W / 2, py + ph / 2 + 130)
      }
      ctx.textAlign = 'center'
      ctx.fillStyle = RED
      ctx.font = `700 40px ${SERIF}`
      ctx.fillText(ex.titleJp, TEX_W / 2, TEX_H - M - 120)
      ctx.fillStyle = '#5a4f43'
      ctx.font = `italic 32px ${SERIF}`
      ctx.fillText(ex.artist, TEX_W / 2, TEX_H - M - 72)
      this.folio(ctx, kind)
      return
    }

    if (kind === 'title') {
      let y = M + 30
      ctx.fillStyle = GOLD
      ctx.font = `600 24px ${SANS}`
      ctx.fillText('G A L L E R Y   O F   J A P A N E S E   A R T', M, y)
      y += 78
      ctx.fillStyle = INK
      ctx.font = `700 60px ${SERIF}`
      y = this.wrap(ctx, ex.title, M, y, W, 66)
      ctx.fillStyle = RED
      ctx.font = `700 42px ${SERIF}`
      ctx.fillText(ex.titleJp, M, y + 4)
      y += 50
      ctx.strokeStyle = 'rgba(90,70,40,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(M, y)
      ctx.lineTo(M + W, y)
      ctx.stroke()
      y += 44
      const rows: Array<[string, string]> = [
        ['ARTIST', ex.artist],
        ['DATE', ex.date],
        ['MEDIUM', ex.medium],
        ['COLLECTION', ex.collection],
      ]
      for (const [k, v] of rows) {
        ctx.fillStyle = GOLD
        ctx.font = `600 20px ${SANS}`
        ctx.fillText(k, M, y)
        ctx.fillStyle = INK
        ctx.font = `29px ${SERIF}`
        y = this.wrap(ctx, v, M + 190, y, W - 190, 36) + 6
      }
      ctx.beginPath()
      ctx.moveTo(M, y - 10)
      ctx.lineTo(M + W, y - 10)
      ctx.stroke()
      y += 48
      const sec = ex.sections[0]
      if (sec) {
        ctx.fillStyle = RED
        ctx.font = `700 40px ${SERIF}`
        ctx.fillText(sec.heading, M, y)
        y += 56
        ctx.fillStyle = INK
        ctx.font = `33px ${SERIF}`
        this.wrap(ctx, sec.body, M, y, W, 50)
      }
      this.folio(ctx, kind)
      return
    }

    const m = /^s(\d)$/.exec(kind)
    if (m) {
      const sec = ex.sections[Number(m[1])]
      let y = M + 70
      if (sec) {
        ctx.fillStyle = RED
        ctx.font = `700 54px ${SERIF}`
        y = this.wrap(ctx, sec.heading, M, y, W, 62)
        ctx.strokeStyle = 'rgba(122,31,26,0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(M, y - 30)
        ctx.lineTo(M + W, y - 30)
        ctx.stroke()
        y += 40
        // Drop cap
        const first = sec.body.charAt(0)
        ctx.fillStyle = RED
        ctx.font = `700 120px ${SERIF}`
        ctx.fillText(first, M, y + 52)
        const capW = ctx.measureText(first).width + 14
        ctx.fillStyle = INK
        ctx.font = `38px ${SERIF}`
        // First two lines wrap beside the drop cap
        const words = sec.body.slice(1).split(' ')
        let line = ''
        let lineNo = 0
        const lineH = 60
        for (const w of words) {
          const avail = lineNo < 2 ? W - capW : W
          const test = line ? `${line} ${w}` : w
          if (ctx.measureText(test).width > avail && line) {
            ctx.fillText(line, M + (lineNo < 2 ? capW : 0), y)
            line = w
            y += lineH
            lineNo++
          } else {
            line = test
          }
        }
        if (line) ctx.fillText(line, M + (lineNo < 2 ? capW : 0), y)
      }
      // Red seal
      ctx.save()
      ctx.translate(TEX_W - M - 46, TEX_H - M - 120)
      ctx.rotate(-0.07)
      ctx.fillStyle = 'rgba(179,38,30,0.85)'
      ctx.fillRect(-36, -36, 72, 72)
      ctx.fillStyle = '#fff4e6'
      ctx.font = `700 46px ${SERIF}`
      ctx.textAlign = 'center'
      ctx.fillText('印', 0, 16)
      ctx.restore()
      this.folio(ctx, kind)
      return
    }

    if (kind === 'colophon') {
      let y = M + 70
      ctx.fillStyle = RED
      ctx.font = `700 46px ${SERIF}`
      ctx.fillText('About this book', M, y)
      y += 70
      ctx.fillStyle = INK
      ctx.font = `33px ${SERIF}`
      y = this.wrap(ctx, `A short guide to "${ex.title}", written for the visitors of this gallery.`, M, y, W, 50) + 20
      ctx.fillStyle = '#6b6054'
      ctx.font = `28px ${SERIF}`
      this.wrap(
        ctx,
        ex.image ? 'Image: public-domain reproduction from Wikimedia Commons.' : 'The piece on display is a modelled reconstruction in the historical style.',
        M,
        y,
        W,
        42
      )
      ctx.fillStyle = 'rgba(122,31,26,0.85)'
      ctx.font = `700 150px ${SERIF}`
      ctx.textAlign = 'center'
      ctx.fillText('終', TEX_W / 2, TEX_H - 300)
      ctx.fillStyle = '#6b6054'
      ctx.font = `26px ${SANS}`
      ctx.fillText('← → to turn the pages  ·  Esc to close', TEX_W / 2, TEX_H - 170)
      this.folio(ctx, kind)
    }
  }
}
