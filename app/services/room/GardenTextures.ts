import * as THREE from 'three'

/**
 * Procedurally painted foliage for the outdoor garden: leaf-cluster cards with real alpha cut-outs
 * (maple, pine needle pads, bamboo), a tileable clipped-hedge surface and bamboo culm bark. All are
 * small canvases painted once at start-up, so there's nothing to download and no per-frame cost.
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** Japanese seasons by month: maples turn from mid-October and hold their red through November. */
export function seasonOf(date = new Date()): Season {
  const m = date.getMonth()
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 8) return 'summer'
  if (m >= 9 && m <= 10) return 'autumn'
  return 'winter'
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function toTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
  }
  return tex
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

/** Shade a hex colour by a factor (0.8 = darker, 1.2 = lighter). */
function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex)
  c.r = Math.min(1, c.r * f)
  c.g = Math.min(1, c.g * f)
  c.b = Math.min(1, c.b * f)
  return `#${c.getHexString()}`
}

const MAPLE_COLORS: Record<Season, string[]> = {
  autumn: ['#b8321f', '#cf4420', '#e0662a', '#a8261c', '#e9963a', '#c73a24', '#8f2418'],
  winter: ['#7a3b22', '#8c4a2a', '#6a3420', '#93552c'],
  spring: ['#8fbf4a', '#a6cf5c', '#7aa83c', '#b7d870', '#a8603a'],
  summer: ['#4f7d2c', '#5d8c34', '#3f6b25', '#6b9a3c', '#557f30'],
}

function mapleLeafPath(ctx: CanvasRenderingContext2D, size: number) {
  // Five pointed lobes with deep notches (Acer palmatum)
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? size * (i === 4 || i === 6 ? 0.78 : 1) : size * 0.32
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

/** A cluster of maple leaves on twigs, alpha cut-out around the leaves. */
export function createMapleLeafTexture(season: Season, size = 512, seed = 7): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const r = rng(seed)
  const colors = MAPLE_COLORS[season]
  const s = size / 512
  const half = size / 2

  // Twigs radiating from the middle
  ctx.strokeStyle = '#4a3326'
  ctx.lineCap = 'round'
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2
    const len = (120 + r() * 90) * s
    ctx.lineWidth = (2 + r() * 2) * s
    ctx.beginPath()
    ctx.moveTo(half, half)
    ctx.quadraticCurveTo(half + Math.cos(a + 0.3) * len * 0.5, half + Math.sin(a + 0.3) * len * 0.5, half + Math.cos(a) * len, half + Math.sin(a) * len)
    ctx.stroke()
  }

  const count = season === 'winter' ? 140 : 300
  // Back-to-front: darker shaded leaves first, sunlit ones on top
  for (let i = 0; i < count; i++) {
    const t = i / count
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 0.44 * size
    const x = half + Math.cos(a) * d
    const y = half + Math.sin(a) * d
    const leaf = (11 + r() * 15) * s
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(r() * Math.PI * 2)
    ctx.fillStyle = shade(pick(r, colors), 0.62 + t * 0.55 + r() * 0.12)
    mapleLeafPath(ctx, leaf)
    ctx.fill()
    // Midribs
    ctx.strokeStyle = 'rgba(40,10,5,0.35)'
    ctx.lineWidth = Math.max(0.6, 0.8 * s)
    ctx.beginPath()
    for (let k = 0; k < 5; k++) {
      const la = -Math.PI / 2 + (k * 2 * Math.PI) / 5
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(la) * leaf * 0.8, Math.sin(la) * leaf * 0.8)
    }
    ctx.stroke()
    ctx.restore()
  }
  return toTexture(c)
}

/** Cloud-pruned pine pad: dense tufts of needles, alpha cut-out. */
export function createPineNeedleTexture(size = 512, seed = 11): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const r = rng(seed)
  const s = size / 512
  const half = size / 2
  const colors = ['#2f4a22', '#3b5a2a', '#26401c', '#4a6a32', '#355226']
  ctx.lineCap = 'round'
  const tufts = 170
  for (let i = 0; i < tufts; i++) {
    const t = i / tufts
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const x = half + Math.cos(a) * d * 0.44 * size
    const y = half + Math.sin(a) * d * 0.36 * size
    const base = pick(r, colors)
    const needles = 22
    for (let k = 0; k < needles; k++) {
      const na = (k / needles) * Math.PI * 2 + r() * 0.3
      const len = (14 + r() * 20) * s
      ctx.strokeStyle = shade(base, 0.7 + t * 0.6 + r() * 0.15)
      ctx.lineWidth = Math.max(1, 1.6 * s)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(na) * len, y + Math.sin(na) * len * 0.8)
      ctx.stroke()
    }
  }
  return toTexture(c)
}

/** Sprays of narrow bamboo leaves hanging off thin twigs, alpha cut-out. */
export function createBambooLeafTexture(size = 512, seed = 23): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const r = rng(seed)
  const s = size / 512
  const colors = ['#5f8a34', '#6f9a3c', '#4d7a2a', '#86a84a', '#58803a']
  ctx.lineCap = 'round'
  for (let spray = 0; spray < 7; spray++) {
    const x0 = (90 + r() * 330) * s
    const y0 = (40 + r() * 160) * s
    const dir = (r() - 0.5) * 1.2 + Math.PI / 2
    const len = (180 + r() * 140) * s
    ctx.strokeStyle = '#6b6a3a'
    ctx.lineWidth = 1.6 * s
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    const x1 = x0 + Math.cos(dir) * len
    const y1 = y0 + Math.sin(dir) * len
    ctx.lineTo(x1, y1)
    ctx.stroke()
    const leaves = 9 + Math.floor(r() * 5)
    for (let i = 0; i < leaves; i++) {
      const f = 0.15 + (i / leaves) * 0.85
      const px = x0 + (x1 - x0) * f
      const py = y0 + (y1 - y0) * f
      const la = dir + (i % 2 === 0 ? 1 : -1) * (0.35 + r() * 0.5)
      const ll = (62 + r() * 54) * s
      const lw = (8 + r() * 5) * s
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(la)
      ctx.fillStyle = shade(pick(r, colors), 0.75 + f * 0.4 + r() * 0.1)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(ll * 0.35, -lw, ll, 0)
      ctx.quadraticCurveTo(ll * 0.35, lw, 0, 0)
      ctx.fill()
      ctx.strokeStyle = 'rgba(30,50,15,0.4)'
      ctx.lineWidth = 0.8 * s
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(ll * 0.95, 0)
      ctx.stroke()
      ctx.restore()
    }
  }
  return toTexture(c)
}

/** Tileable surface of small clipped azalea / boxwood leaves for karikomi hedges (opaque). */
export function createHedgeTexture(size = 256, seed = 31): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const r = rng(seed)
  ctx.fillStyle = '#22381a'
  ctx.fillRect(0, 0, size, size)
  const colors = ['#2d4a1f', '#3a5a26', '#46692c', '#517634', '#36532a', '#5e8238']
  const count = Math.round(size * size * 0.016)
  for (let i = 0; i < count; i++) {
    const t = i / count
    const x = r() * size
    const y = r() * size
    const w = 3 + r() * 5
    const h = 1.8 + r() * 2.4
    const rot = r() * Math.PI
    ctx.fillStyle = shade(pick(r, colors), 0.75 + t * 0.5)
    // Draw wrapped copies so the tile has no seams
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox
        const py = y + oy
        if (px < -10 || px > size + 10 || py < -10 || py > size + 10) continue
        ctx.beginPath()
        ctx.ellipse(px, py, w, h, rot, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  return toTexture(c, true)
}

/**
 * Bamboo culm bark, one internode per tile with the growth axis along U (TubeGeometry runs its U
 * coordinate along the tube).
 */
export function createCulmTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(256, 64)
  const g = ctx.createLinearGradient(0, 0, 0, 64)
  g.addColorStop(0, '#5a7a2e')
  g.addColorStop(0.45, '#8aa64a')
  g.addColorStop(1, '#4e6c28')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 64)
  const r = rng(5)
  // Fine fibres along the culm
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '40,60,20' : '170,190,110'},0.12)`
    ctx.fillRect(0, r() * 64, 256, 1)
  }
  // Node: pale waxy ring with a dark sheath line
  ctx.fillStyle = 'rgba(210,215,170,0.55)'
  ctx.fillRect(0, 0, 7, 64)
  ctx.fillStyle = 'rgba(40,45,20,0.75)'
  ctx.fillRect(7, 0, 3, 64)
  ctx.fillStyle = 'rgba(120,130,70,0.5)'
  ctx.fillRect(10, 0, 4, 64)
  return toTexture(c, true)
}

/** Tileable speckled granite for carved stone (lanterns, fountain, stepping stones). */
export function createGraniteTexture(size = 256, seed = 47): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(size, size)
  const r = rng(seed)
  ctx.fillStyle = '#8f8c86'
  ctx.fillRect(0, 0, size, size)
  const dot = (x: number, y: number, rad: number, color: string) => {
    ctx.fillStyle = color
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = x + ox
        const py = y + oy
        if (px < -rad || px > size + rad || py < -rad || py > size + rad) continue
        ctx.beginPath()
        ctx.arc(px, py, rad, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // Soft mottling, then mineral grains (dark mica, pale feldspar, the odd pink grain)
  for (let i = 0; i < 60; i++) dot(r() * size, r() * size, 10 + r() * 26, `rgba(${r() < 0.5 ? '60,58,55' : '190,186,178'},0.08)`)
  const grains = size * size * 0.05
  for (let i = 0; i < grains; i++) {
    const t = r()
    const color = t < 0.45 ? 'rgba(40,40,42,0.55)' : t < 0.9 ? 'rgba(205,202,195,0.5)' : 'rgba(170,130,120,0.45)'
    dot(r() * size, r() * size, 0.5 + r() * 1.3, color)
  }
  return toTexture(c, true)
}
