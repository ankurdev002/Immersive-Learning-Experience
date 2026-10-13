import * as THREE from 'three'
import { BookCatalogService } from './BookCatalogService'
import type { BookPageData } from '~/types/learning-journey'

// High-performance global texture caches to prevent redundant 40MB canvas allocations & GPU uploads
export const pageTextureCache = new Map<string, THREE.CanvasTexture>()
export const insideCoverTextureCache = new Map<string, THREE.CanvasTexture>()
export const coverTextureCache = new Map<string, THREE.CanvasTexture>()
export const spineTextureCache = new Map<string, THREE.CanvasTexture>()
let cachedPageEdgesTexture: THREE.CanvasTexture | null = null

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxY = 1380
): number {
  if (y > maxY) return y
  const words = text.split(/\s+/)
  let line = ''
  let currentY = y

  for (let n = 0; n < words.length; n++) {
    const testLine = line ? `${line} ${words[n]}` : words[n]!
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      if (currentY + lineHeight > maxY) {
        const lastLine = (line.length > 3 ? line.slice(0, -3) : line) + '...'
        ctx.fillText(lastLine, x, currentY)
        return currentY + lineHeight
      }
      ctx.fillText(line, x, currentY)
      line = words[n]!
      currentY += lineHeight
    } else {
      line = testLine
    }
  }

  if (line && currentY <= maxY) {
    ctx.fillText(line, x, currentY)
    currentY += lineHeight
  }

  return currentY
}

/**
 * Procedural canvas-based textures for the Japanese Study Room
 */

export function createWoodTexture(colorHex = '#3e271a', grainColorHex = '#27160c'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = colorHex
  ctx.fillRect(0, 0, 512, 512)

  // Grain lines
  ctx.fillStyle = grainColorHex
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const len = 30 + Math.random() * 120
    const alpha = 0.04 + Math.random() * 0.12

    ctx.globalAlpha = alpha
    ctx.fillRect(x, y, 1.5, len)
  }
  ctx.globalAlpha = 1.0

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  cachedPageEdgesTexture = texture
  return texture
}

export function createModernWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Warm Japandi cream plaster
  ctx.fillStyle = '#f4efe6'
  ctx.fillRect(0, 0, 512, 512)

  // Subtle sand/plaster texture stippling
  ctx.fillStyle = 'rgba(180, 165, 145, 0.08)'
  for (let i = 0; i < 2000; i++) {
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }

  // Soft vertical wood slats accent on right side
  ctx.fillStyle = '#3a2416'
  for (let x = 360; x < 512; x += 18) {
    ctx.fillRect(x, 0, 10, 512)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function createGlassShojiDoorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Semi-transparent glass tint
  ctx.fillStyle = 'rgba(235, 245, 255, 0.22)'
  ctx.fillRect(0, 0, 512, 512)

  // Dark matte cedar door frame
  ctx.strokeStyle = '#1e140d'
  ctx.lineWidth = 14
  ctx.strokeRect(0, 0, 512, 512)

  // Clean vertical division (sliding door split)
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(256, 0)
  ctx.lineTo(256, 512)
  ctx.stroke()

  // Elegant horizontal Japanese transom bars
  ctx.lineWidth = 5
  for (let y = 80; y < 512; y += 96) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}

export function createGardenBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Warm blue sky gradient (daylight horizon)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 512)
  skyGrad.addColorStop(0, '#38bdf8')
  skyGrad.addColorStop(0.35, '#7dd3fc')
  skyGrad.addColorStop(0.65, '#bae6fd')
  skyGrad.addColorStop(1, '#fef08a')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, 1024, 512)

  // Soft morning sun disc & radiant sunburst rays
  const sunGlow = ctx.createRadialGradient(480, 220, 10, 480, 220, 320)
  sunGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  sunGlow.addColorStop(0.15, 'rgba(254, 240, 138, 0.75)')
  sunGlow.addColorStop(0.5, 'rgba(253, 224, 71, 0.25)')
  sunGlow.addColorStop(1, 'rgba(254, 240, 138, 0)')
  ctx.fillStyle = sunGlow
  ctx.fillRect(0, 0, 1024, 512)

  // Distant misty mountains (soft layered mountain ranges)
  ctx.fillStyle = '#94a3b8'
  ctx.beginPath()
  ctx.moveTo(0, 360)
  ctx.bezierCurveTo(180, 270, 320, 320, 480, 260)
  ctx.bezierCurveTo(640, 210, 820, 300, 1024, 250)
  ctx.lineTo(1024, 512)
  ctx.lineTo(0, 512)
  ctx.fill()

  ctx.fillStyle = '#64748b'
  ctx.beginPath()
  ctx.moveTo(0, 370)
  ctx.bezierCurveTo(220, 290, 400, 340, 600, 280)
  ctx.bezierCurveTo(760, 240, 900, 320, 1024, 300)
  ctx.lineTo(1024, 512)
  ctx.lineTo(0, 512)
  ctx.fill()

  // Midground rolling green hills
  ctx.fillStyle = '#16a34a'
  ctx.beginPath()
  ctx.moveTo(0, 410)
  ctx.bezierCurveTo(240, 340, 460, 370, 720, 330)
  ctx.bezierCurveTo(860, 310, 960, 350, 1024, 340)
  ctx.lineTo(1024, 512)
  ctx.lineTo(0, 512)
  ctx.fill()

  // Foreground rolling hills & lush foliage
  ctx.fillStyle = '#15803d'
  ctx.beginPath()
  ctx.moveTo(0, 440)
  ctx.bezierCurveTo(280, 380, 520, 410, 800, 370)
  ctx.bezierCurveTo(920, 350, 980, 380, 1024, 370)
  ctx.lineTo(1024, 512)
  ctx.lineTo(0, 512)
  ctx.fill()

  // Japanese Temple Pagoda on hillside (traditional silhouette)
  ctx.fillStyle = '#1e293b'
  const px = 280, py = 290
  ctx.fillRect(px + 14, py - 30, 4, 30)
  ctx.beginPath()
  ctx.moveTo(px - 10, py)
  ctx.quadraticCurveTo(px + 16, py - 12, px + 42, py)
  ctx.lineTo(px + 32, py + 14)
  ctx.lineTo(px, py + 14)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px - 16, py + 22)
  ctx.quadraticCurveTo(px + 16, py + 10, px + 48, py + 22)
  ctx.lineTo(px + 38, py + 38)
  ctx.lineTo(px - 6, py + 38)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(px - 22, py + 46)
  ctx.quadraticCurveTo(px + 16, py + 34, px + 54, py + 46)
  ctx.lineTo(px + 44, py + 66)
  ctx.lineTo(px - 12, py + 66)
  ctx.fill()

  // Japanese Cherry Blossom (Sakura) clusters & lush green trees
  const trees = [
    { x: 120, y: 410, r: 35, color: '#f472b6' },
    { x: 160, y: 400, r: 28, color: '#fbcfe8' },
    { x: 440, y: 380, r: 32, color: '#166534' },
    { x: 480, y: 370, r: 24, color: '#22c55e' },
    { x: 740, y: 350, r: 30, color: '#f472b6' },
    { x: 780, y: 340, r: 25, color: '#fbcfe8' },
    { x: 880, y: 360, r: 36, color: '#166534' },
  ]
  trees.forEach(t => {
    ctx.beginPath()
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2)
    ctx.fillStyle = t.color
    ctx.fill()
  })

  // Fluffy sunny cumulus clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)'
  const drawCloud = (cx: number, cy: number, w: number) => {
    ctx.beginPath()
    ctx.arc(cx, cy, w * 0.35, 0, Math.PI * 2)
    ctx.arc(cx + w * 0.3, cy - w * 0.1, w * 0.45, 0, Math.PI * 2)
    ctx.arc(cx + w * 0.65, cy, w * 0.35, 0, Math.PI * 2)
    ctx.fill()
  }
  drawCloud(160, 130, 80)
  drawCloud(620, 100, 110)
  drawCloud(860, 140, 75)

  return new THREE.CanvasTexture(canvas)
}

export function createSpineTexture(subject: string, title: string, colorHex: string): THREE.CanvasTexture {
  const cacheKey = `${subject}_${title}_${colorHex}`
  const cached = spineTextureCache.get(cacheKey)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Leather / cloth spine base
  ctx.fillStyle = colorHex
  ctx.fillRect(0, 0, 128, 512)

  // Spine edge curvature shadow (cylindrical highlight)
  const grad = ctx.createLinearGradient(0, 0, 128, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.45)')
  grad.addColorStop(0.2, 'rgba(255,255,255,0.18)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.02)')
  grad.addColorStop(0.8, 'rgba(0,0,0,0.25)')
  grad.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 512)

  // Gold foil ribs / bands
  ctx.fillStyle = '#d4af37'
  const ribY = [35, 42, 130, 370, 465, 472]
  ribY.forEach((y) => {
    ctx.fillRect(8, y, 112, 3)
  })

  // Subject title running vertically down the spine
  ctx.save()
  ctx.translate(64, 250)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'

  // Subject
  ctx.fillStyle = '#fef08a'
  ctx.font = 'bold 20px sans-serif'
  ctx.fillText(subject.toUpperCase(), 0, -4)

  // Volume / Subtitle
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = '13px sans-serif'
  ctx.fillText(title, 0, 16)

  ctx.restore()

  // Grade badge / IRE glyph at top
  ctx.fillStyle = '#fde68a'
  ctx.font = 'bold 15px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('M', 64, 82)

  ctx.strokeStyle = '#d4af37'
  ctx.lineWidth = 1.5
  ctx.strokeRect(46, 64, 36, 26)

  const texture = new THREE.CanvasTexture(canvas)
  spineTextureCache.set(cacheKey, texture)
  return texture
}

export function createTatamiTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Warm greenish-straw base
  ctx.fillStyle = '#b7b483'
  ctx.fillRect(0, 0, 512, 512)

  // Straw weave horizontal lines
  ctx.strokeStyle = 'rgba(128, 122, 85, 0.35)'
  ctx.lineWidth = 1.5
  for (let y = 0; y < 512; y += 4) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }

  // Cross-weave subtle texture
  ctx.strokeStyle = 'rgba(95, 90, 60, 0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x < 512; x += 12) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }

  // Dark cloth border on edges (heri)
  ctx.fillStyle = '#1e1c18'
  ctx.fillRect(0, 0, 16, 512)
  ctx.fillRect(496, 0, 16, 512)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

export function createShojiTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Translucent washi paper background
  ctx.fillStyle = '#f8f4eb'
  ctx.fillRect(0, 0, 512, 512)

  // Paper fiber texture
  ctx.fillStyle = 'rgba(215, 205, 185, 0.25)'
  for (let i = 0; i < 600; i++) {
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }

  // Kumiko wood grid frame
  ctx.strokeStyle = '#4a2d18'
  ctx.lineWidth = 10
  ctx.strokeRect(0, 0, 512, 512)

  // Inner lattice grid
  ctx.lineWidth = 6
  for (let x = 64; x < 512; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 512)
    ctx.stroke()
  }
  for (let y = 64; y < 512; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(512, y)
    ctx.stroke()
  }

  return new THREE.CanvasTexture(canvas)
}


function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map((x) => x + x).join('')
  const num = parseInt(c, 16) || 0
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  }
}

function shadeColor(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex)
  const t = percent < 0 ? 0 : 255
  const p = Math.abs(percent) / 100
  const R = Math.round((t - r) * p) + r
  const G = Math.round((t - g) * p) + g
  const B = Math.round((t - b) * p) + b
  return `rgb(${R}, ${G}, ${B})`
}

export function createBookCoverTexture(
  title: string,
  subject: string,
  classGrade: string,
  bgHex = '#1e40af'
): THREE.CanvasTexture {
  const cacheKey = `${title}_${subject}_${classGrade}_${bgHex}`
  const cached = coverTextureCache.get(cacheKey)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 700
  const ctx = canvas.getContext('2d')!

  // Dynamic rich gradient based on the selected book's cover color
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 700)
  bgGrad.addColorStop(0, shadeColor(bgHex, -20))
  bgGrad.addColorStop(0.5, bgHex)
  bgGrad.addColorStop(1, shadeColor(bgHex, -35))
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 512, 700)

  // Subtle tactile linen cover weave
  for (let i = 0; i < 700; i += 4) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)'
    ctx.fillRect(0, i, 512, 1)
  }

  // Rounded golden outer cover accent
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'
  ctx.lineWidth = 2
  ctx.strokeRect(18, 18, 476, 664)

  // Inner golden hairline border
  ctx.strokeStyle = 'rgba(245, 215, 130, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(24, 24, 464, 652)

  // Central Hero Card
  const cardX = 46, cardY = 65, cardW = 420, cardH = 565, cardR = 24
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(cardX, cardY, cardW, cardH, cardR)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = shadeColor(bgHex, 35)
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()

  // Subject Header (e.g. "MATHEMATICS", "NATURE", "SCIENCE", "ENGLISH", "ART")
  ctx.fillStyle = bgHex
  ctx.font = '800 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(subject.toUpperCase(), 256, 136)

  // Subtitle / Class Grade (e.g. "Class 1", "Class 2", "Class 3")
  ctx.fillStyle = '#64748b'
  ctx.font = '700 19px sans-serif'
  ctx.fillText(classGrade, 256, 172)

  // Thin separator line
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(90, 196)
  ctx.lineTo(422, 196)
  ctx.stroke()

  // Dynamic 2x2 Grid / Emblems tailored to Subject & Content
  const sLower = subject.toLowerCase()
  const tLower = title.toLowerCase()

  interface BadgeItem {
    symbol: string
    label: string
    color: string
  }

  let badges: [BadgeItem, BadgeItem, BadgeItem, BadgeItem] = [
    { symbol: '+', label: 'Sum', color: '#0284c7' },
    { symbol: '−', label: 'Minus', color: '#f97316' },
    { symbol: '×', label: 'Product', color: '#16a34a' },
    { symbol: '÷', label: 'Divide', color: '#9333ea' },
  ]

  if (sLower.includes('math') || tLower.includes('number') || tLower.includes('count') || tLower.includes('fraction') || tLower.includes('arithmetic')) {
    badges = [
      { symbol: '+', label: 'Add', color: '#0284c7' },
      { symbol: '−', label: 'Subtract', color: '#f97316' },
      { symbol: '×', label: 'Multiply', color: '#16a34a' },
      { symbol: '÷', label: 'Divide', color: '#9333ea' },
    ]
  } else if (sLower.includes('nature') || tLower.includes('pet') || tLower.includes('animal') || tLower.includes('plant') || tLower.includes('tree')) {
    badges = [
      { symbol: '🐾', label: 'Friends', color: '#8b5cf6' },
      { symbol: '🌱', label: 'Flora', color: '#16a34a' },
      { symbol: '☀️', label: 'Sunlight', color: '#f59e0b' },
      { symbol: '🦋', label: 'Fauna', color: '#06b6d4' },
    ]
  } else if (sLower.includes('science') || tLower.includes('living') || tLower.includes('optics') || tLower.includes('light') || tLower.includes('energy') || tLower.includes('force')) {
    badges = [
      { symbol: '⚛️', label: 'Matter', color: '#6366f1' },
      { symbol: '🧪', label: 'Lab', color: '#10b981' },
      { symbol: '🔬', label: 'Optics', color: '#3b82f6' },
      { symbol: '⚡', label: 'Energy', color: '#f59e0b' },
    ]
  } else if (sLower.includes('english') || sLower.includes('grammar') || tLower.includes('stor') || tLower.includes('word') || tLower.includes('alphabet') || tLower.includes('poet')) {
    badges = [
      { symbol: '📖', label: 'Read', color: '#b45309' },
      { symbol: '✍️', label: 'Write', color: '#0284c7' },
      { symbol: '✨', label: 'Stories', color: '#9333ea' },
      { symbol: '💬', label: 'Words', color: '#15803d' },
    ]
  } else if (sLower.includes('art') || sLower.includes('music') || tLower.includes('rhyme') || tLower.includes('tune') || tLower.includes('color')) {
    badges = [
      { symbol: '🎨', label: 'Color', color: '#ec4899' },
      { symbol: '🎵', label: 'Music', color: '#eab308' },
      { symbol: '🖌️', label: 'Paint', color: '#06b6d4' },
      { symbol: '🎼', label: 'Tunes', color: '#8b5cf6' },
    ]
  } else if (sLower.includes('social') || sLower.includes('history') || sLower.includes('geography')) {
    badges = [
      { symbol: '🌍', label: 'World', color: '#0284c7' },
      { symbol: '🧭', label: 'Places', color: '#d97706' },
      { symbol: '🏛️', label: 'History', color: '#7c3aed' },
      { symbol: '👥', label: 'People', color: '#059669' },
    ]
  } else if (sLower.includes('computer') || tLower.includes('digital')) {
    badges = [
      { symbol: '💻', label: 'Code', color: '#0284c7' },
      { symbol: '🌐', label: 'Web', color: '#0d9488' },
      { symbol: '🤖', label: 'AI', color: '#6366f1' },
      { symbol: '💾', label: 'Data', color: '#f97316' },
    ]
  } else {
    badges = [
      { symbol: '📘', label: 'Study', color: '#0284c7' },
      { symbol: '💡', label: 'Learn', color: '#f59e0b' },
      { symbol: '🎯', label: 'Focus', color: '#10b981' },
      { symbol: '⭐', label: 'Master', color: '#8b5cf6' },
    ]
  }

  const boxSize = 96
  const gap = 20
  const startBX = 256 - boxSize - gap / 2
  const startBY = 216

  const positions = [
    { x: startBX, y: startBY },
    { x: startBX + boxSize + gap, y: startBY },
    { x: startBX, y: startBY + boxSize + gap },
    { x: startBX + boxSize + gap, y: startBY + boxSize + gap },
  ]

  badges.forEach((b, i) => {
    const pos = positions[i]
    if (!pos) return
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(pos.x, pos.y, boxSize, boxSize, 16)
    ctx.fillStyle = b.color
    ctx.fill()

    // Symbol / Icon
    ctx.fillStyle = '#ffffff'
    ctx.font = '900 46px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(b.symbol, pos.x + boxSize / 2, pos.y + 54)

    // Sub-label
    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.fillText(b.label, pos.x + boxSize / 2, pos.y + 80)
    ctx.restore()
  })

  // Dynamic Book Title (prominently centered in bold high-contrast font)
  ctx.fillStyle = '#0f172a'
  ctx.font = '800 24px sans-serif'
  ctx.textAlign = 'center'

  const titleWords = title.split(' ')
  if (titleWords.length > 3 && ctx.measureText(title).width > 360) {
    const mid = Math.ceil(titleWords.length / 2)
    const line1 = titleWords.slice(0, mid).join(' ')
    const line2 = titleWords.slice(mid).join(' ')
    ctx.fillText(line1, 256, 475)
    ctx.fillText(line2, 256, 505)
  } else {
    ctx.fillText(title, 256, 490)
  }

  // Curriculum Tag
  ctx.fillStyle = '#64748b'
  ctx.font = '600 14px sans-serif'
  ctx.fillText(`NCERT · ${subject} Curriculum`, 256, 538)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 12px sans-serif'
  ctx.fillText('Interactive Experience Edition', 256, 564)

  // Publisher at bottom
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 15px sans-serif'
  ctx.fillText('IRE ARCHIVE', 256, 660)

  const texture = new THREE.CanvasTexture(canvas)
  coverTextureCache.set(cacheKey, texture)
  return texture
}

const pageImageCache = new Map<string, HTMLImageElement>()

function renderPageImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number
): number {
  if (!img || !img.complete || img.naturalWidth === 0) return 0
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  const scale = Math.min(boxW / nw, boxH / nh)
  const dw = Math.round(nw * scale)
  const dh = Math.round(nh * scale)
  const dx = Math.round(boxX + (boxW - dw) / 2)
  const dy = Math.round(boxY + (boxH - dh) / 2)

  // Clean subtle card backing and crisp border on parchment
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(dx - 6, dy - 6, dw + 12, dh + 12)
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.strokeRect(dx - 6, dy - 6, dw + 12, dh + 12)

  // Draw figure image with high quality smoothing
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, dx, dy, dw, dh)
  return dh
}

export function createBookPageTexture(
  pageNumber: number,
  subject = 'Mathematics',
  bookId?: string
): THREE.CanvasTexture {
  const cacheKey = `${bookId || subject}_p${pageNumber}`
  const cached = pageTextureCache.get(cacheKey)
  if (cached) return cached
  // High-DPI 1200x1600 canvas for pin-sharp typography and diagram readability
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const ctx = canvas.getContext('2d')!

  // Lookup data dynamically from BookCatalogService
  let pageData: BookPageData | undefined
  if (bookId) {
    pageData = BookCatalogService.getPageData(bookId, pageNumber)
  }
  if (!pageData) {
    const book =
      BookCatalogService.getAllBooks().find((b) => b.subject.toLowerCase() === subject.toLowerCase()) ||
      BookCatalogService.getDefaultBook()
    pageData = book?.chapters?.[0]?.pages?.find((p) => p.pageNumber === pageNumber)
  }

  // Warm cream parchment paper background
  ctx.fillStyle = '#fdfbf7'
  ctx.fillRect(0, 0, 1200, 1600)

  // Subtle page margin border
  ctx.strokeStyle = 'rgba(180, 160, 130, 0.35)'
  ctx.lineWidth = 2
  ctx.strokeRect(60, 60, 1080, 1480)

  // Header band: Do NOT repeat page number on top since it is already in the footer
  const rawHeader = pageData?.header || `Chapter 1: ${subject}`
  const headerText = /^Page\s+\d+$/i.test(rawHeader.trim()) ? subject : rawHeader

  const rawSubHeader = pageData?.subHeader || 'Core Learning Module'
  const subHeaderText = rawSubHeader
    .replace(/\s*·\s*Page\s+\d+/gi, '')
    .replace(/Page\s+\d+\s*·\s*/gi, '')
    .trim()

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 36px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(headerText, 90, 135)

  if (subHeaderText) {
    ctx.fillStyle = '#475569'
    ctx.font = '500 24px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
    ctx.fillText(subHeaderText, 90, 178)
  }

  // Header Divider
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(90, 210)
  ctx.lineTo(1110, 210)
  ctx.stroke()

  let currentY = 270
  const MAX_CONTENT_Y = 1380 // Clean bottom boundary to prevent footer overlap

  // Section Title: Do NOT render title if it just says 'Page X'
  const rawTitle = (pageData?.title || '').trim()
  const isPageNumberTitle = /^Page\s+\d+$/i.test(rawTitle)
  if (rawTitle && !isPageNumberTitle) {
    ctx.fillStyle = '#0a0f1d'
    ctx.font = 'bold 32px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
    currentY = wrapText(ctx, rawTitle, 90, currentY, 1020, 46, MAX_CONTENT_Y)
    currentY += 16
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 16

  // Render Real Book Diagrams & Illustrations (e.g. Page 24, Page 27, Page 34, etc.)
  if (pageData?.imageUrl) {
    const url = pageData.imageUrl
    let img = pageImageCache.get(url)
    if (!img) {
      img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = url
      pageImageCache.set(url, img)
    }

    const hasNoBullets = !pageData.bulletPoints || pageData.bulletPoints.length === 0

    if (hasNoBullets) {
      // Full-Page Diagram (e.g. Page 24 Part I Illustration)
      const boxX = 90
      const boxY = currentY + 10
      const boxW = 1020
      const boxH = Math.max(300, MAX_CONTENT_Y - boxY - 20)

      if (img.complete && img.naturalWidth > 0) {
        renderPageImage(ctx, img, boxX, boxY, boxW, boxH)
      } else {
        img.onload = () => {
          renderPageImage(ctx, img!, boxX, boxY, boxW, boxH)
          texture.needsUpdate = true
        }
      }
      currentY = MAX_CONTENT_Y
    } else {
      // Mixed layout: diagram in figure box, text below
      const boxX = 90
      const boxY = currentY + 10
      const boxW = 1020
      const boxH = 540

      if (img.complete && img.naturalWidth > 0) {
        const dh = renderPageImage(ctx, img, boxX, boxY, boxW, boxH)
        currentY += dh + 28
      } else {
        img.onload = () => {
          renderPageImage(ctx, img!, boxX, boxY, boxW, boxH)
          texture.needsUpdate = true
        }
        currentY += 500
      }

      // Bullet Points / Text below diagram
      if (pageData.bulletPoints && pageData.bulletPoints.length > 0) {
        ctx.fillStyle = '#1e293b'
        ctx.font = '500 26px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
        for (const bp of pageData.bulletPoints) {
          if (currentY > MAX_CONTENT_Y - 30) break
          currentY = wrapText(ctx, `• ${bp}`, 100, currentY, 1000, 44, MAX_CONTENT_Y)
        }
        currentY += 20
      }
    }
  } else {
    // Normal Text Pages
    // Learning Objectives (if defined)
    if (pageData?.objectives && pageData.objectives.length > 0) {
      ctx.fillStyle = '#1e293b'
      ctx.font = '500 26px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
      for (const obj of pageData.objectives) {
        if (currentY > MAX_CONTENT_Y - 30) break
        currentY = wrapText(ctx, `• ${obj}`, 100, currentY, 1000, 44, MAX_CONTENT_Y)
      }
      currentY += 20
    }

    // Bullet Points (if defined)
    if (pageData?.bulletPoints && pageData.bulletPoints.length > 0) {
      ctx.fillStyle = '#1e293b'
      ctx.font = '500 26px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
      for (const bp of pageData.bulletPoints) {
        if (currentY > MAX_CONTENT_Y - 30) break
        currentY = wrapText(ctx, `• ${bp}`, 100, currentY, 1000, 44, MAX_CONTENT_Y)
      }
      currentY += 20
    }

    // Formula or Summary Box (if defined)
    if (pageData?.formulaOrSummary && currentY + 120 <= MAX_CONTENT_Y) {
      ctx.fillStyle = '#eff6ff'
      ctx.fillRect(90, currentY, 1020, 110)
      ctx.strokeStyle = '#93c5fd'
      ctx.lineWidth = 2
      ctx.strokeRect(90, currentY, 1020, 110)
      ctx.fillStyle = '#1e40af'
      ctx.font = 'bold 30px monospace'
      ctx.fillText(pageData.formulaOrSummary, 130, currentY + 68)
      currentY += 140
    }

    // Interactive Procedural Diagrams (for school curriculum books)
    if (pageData?.diagramType === 'math-counting') {
      const boxY = Math.min(currentY, 620)
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(90, boxY, 1020, 380)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.strokeRect(90, boxY, 1020, 380)

      const bubbleDefs = [
        { num: '1', x: 220, y: boxY + 170, r: 68, fill: '#f97316', label: 'One' },
        { num: '2', x: 410, y: boxY + 170, r: 68, fill: '#eab308', label: 'Two' },
        { num: '3', x: 600, y: boxY + 170, r: 68, fill: '#22c55e', label: 'Three' },
        { num: '4', x: 790, y: boxY + 170, r: 68, fill: '#06b6d4', label: 'Four' },
        { num: '5', x: 980, y: boxY + 170, r: 68, fill: '#8b5cf6', label: 'Five' },
      ]

      bubbleDefs.forEach(({ num, x, y, r, fill, label }) => {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 6
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 50px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(num, x, y + 18)

        ctx.fillStyle = '#475569'
        ctx.font = '600 24px sans-serif'
        ctx.fillText(label, x, y + r + 38)
      })
      ctx.textAlign = 'left'
      currentY = boxY + 420
    } else if (pageData?.diagramType === 'math-addition') {
      ctx.fillStyle = '#f0fdf4'
      ctx.fillRect(90, 360, 1020, 190)
      ctx.strokeStyle = '#86efac'
      ctx.lineWidth = 2
      ctx.strokeRect(90, 360, 1020, 190)
      ctx.fillStyle = '#166534'
      ctx.font = 'bold 44px monospace'
      ctx.fillText('◆  5  +  3  =  8', 130, 440)
      ctx.fillStyle = '#15803d'
      ctx.font = '24px sans-serif'
      ctx.fillText('Example: 5 green apples combined with 3 green apples gives 8 apples in total.', 130, 500)

      ctx.fillStyle = '#eff6ff'
      ctx.fillRect(90, 590, 1020, 190)
      ctx.strokeStyle = '#93c5fd'
      ctx.lineWidth = 2
      ctx.strokeRect(90, 590, 1020, 190)
      ctx.fillStyle = '#1e40af'
      ctx.font = 'bold 44px monospace'
      ctx.fillText('◆  7  +  2  =  9', 130, 670)
      ctx.fillStyle = '#1d4ed8'
      ctx.font = '24px sans-serif'
      ctx.fillText('Strategy: Start at 7 on the number line and count up 2 steps: 8, then 9!', 130, 730)

      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(90, 820, 1020, 240)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.strokeRect(90, 820, 1020, 240)
      ctx.fillStyle = '#0f172a'
      ctx.font = 'bold 28px sans-serif'
      ctx.fillText('Place Value Chart', 130, 875)
      ctx.font = 'bold 26px sans-serif'
      ctx.fillStyle = '#64748b'
      ctx.fillText('Hundreds (100s)', 150, 940)
      ctx.fillText('Tens (10s)', 500, 940)
      ctx.fillText('Ones (1s)', 830, 940)
      ctx.fillStyle = '#0284c7'
      ctx.font = 'bold 40px monospace'
      ctx.fillText('0', 250, 1010)
      ctx.fillText('1', 560, 1010)
      ctx.fillText('2', 890, 1010)
      currentY = 1110
    } else if (pageData?.diagramType === 'ray-optics') {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(90, 460, 1020, 460)
      ctx.strokeStyle = '#94a3b8'
      ctx.lineWidth = 2
      ctx.strokeRect(90, 460, 1020, 460)
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 7
      ctx.beginPath()
      ctx.arc(940, 690, 350, 0.8 * Math.PI, 1.2 * Math.PI)
      ctx.stroke()
      ctx.strokeStyle = '#64748b'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 8])
      ctx.beginPath()
      ctx.moveTo(110, 690)
      ctx.lineTo(960, 690)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#dc2626'
      ctx.beginPath()
      ctx.arc(770, 690, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText('F (Focus)', 735, 735)
      ctx.fillStyle = '#2563eb'
      ctx.beginPath()
      ctx.arc(570, 690, 8, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillText('C (Center)', 535, 735)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.moveTo(190, 580)
      ctx.lineTo(810, 580)
      ctx.lineTo(630, 800)
      ctx.stroke()
      ctx.fillStyle = '#d97706'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText('Incident Ray →', 310, 560)
      ctx.fillStyle = '#475569'
      ctx.font = 'italic 25px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Figure 4.1: Ray parallel to principal axis reflects through Focus (F)', 600, 890)
      ctx.textAlign = 'left'
      currentY = 960
    }

    // Tip Card (if defined)
    if (pageData?.tip && currentY + 120 <= MAX_CONTENT_Y) {
      const tipBoxY = Math.min(Math.max(currentY + 24, 1140), MAX_CONTENT_Y - 140)
      ctx.fillStyle = '#fef3c7'
      ctx.fillRect(90, tipBoxY, 1020, 130)
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 2
      ctx.strokeRect(90, tipBoxY, 1020, 130)
      ctx.fillStyle = '#92400e'
      ctx.font = 'bold 26px sans-serif'
      ctx.fillText('💡 Study Mate Tip:', 120, tipBoxY + 44)
      ctx.font = '24px sans-serif'
      const cleanTip = pageData.tip.replace('💡', '').replace('Study Mate Tip:', '').replace('Tip:', '').trim()
      wrapText(ctx, cleanTip, 120, tipBoxY + 84, 960, 36, tipBoxY + 124)
    }
  }

  // Clean horizontal divider above footer
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(90, 1450)
  ctx.lineTo(1110, 1450)
  ctx.stroke()

  // Footer page number
  const footerText = pageData?.footerText || `Page ${pageNumber} · ${subject}`
  ctx.fillStyle = '#64748b'
  ctx.font = 'bold 24px "Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(footerText, 600, 1515)

  pageTextureCache.set(cacheKey, texture)
  return texture
}

export function createBookInsideCoverTexture(
  title = 'Numbers and Counting',
  subtitle = 'Foundations of Mathematics · Class 3'
): THREE.CanvasTexture {
  const cacheKey = `${title}_${subtitle}`
  const cached = insideCoverTextureCache.get(cacheKey)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 1600
  const ctx = canvas.getContext('2d')!

  // Warm cream parchment paper background
  ctx.fillStyle = '#fdfaf3'
  ctx.fillRect(0, 0, 1200, 1600)

  // Outer decorative border
  ctx.strokeStyle = 'rgba(160, 140, 110, 0.45)'
  ctx.lineWidth = 4
  ctx.strokeRect(60, 60, 1080, 1480)

  // Inner subtle border
  ctx.strokeStyle = 'rgba(160, 140, 110, 0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(80, 80, 1040, 1440)

  // Classical corner ornaments
  const corners = [
    { x: 80, y: 80 },
    { x: 1120, y: 80 },
    { x: 80, y: 1520 },
    { x: 1120, y: 1520 },
  ]
  ctx.strokeStyle = 'rgba(180, 140, 60, 0.6)'
  ctx.lineWidth = 4
  corners.forEach(({ x, y }) => {
    ctx.beginPath()
    const sx = x <= 600 ? 1 : -1
    const sy = y <= 800 ? 1 : -1
    ctx.moveTo(x, y + sy * 40)
    ctx.lineTo(x, y)
    ctx.lineTo(x + sx * 40, y)
    ctx.stroke()
  })

  // Classical Header Medallion / Ex Libris
  ctx.save()
  ctx.beginPath()
  ctx.arc(600, 300, 84, 0, Math.PI * 2)
  ctx.fillStyle = '#f4efe4'
  ctx.fill()
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(600, 300, 74, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(180, 140, 60, 0.4)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Open book icon inside medallion
  ctx.strokeStyle = '#78350f'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(600, 316)
  ctx.quadraticCurveTo(570, 300, 552, 306)
  ctx.lineTo(552, 274)
  ctx.quadraticCurveTo(570, 268, 600, 284)
  ctx.quadraticCurveTo(630, 268, 648, 274)
  ctx.lineTo(648, 306)
  ctx.quadraticCurveTo(630, 300, 600, 316)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(600, 284)
  ctx.lineTo(600, 316)
  ctx.stroke()
  ctx.restore()

  // EX LIBRIS label
  ctx.fillStyle = '#b45309'
  ctx.font = 'bold 24px serif'
  ctx.textAlign = 'center'
  ctx.fillText('•  EX LIBRIS  •', 600, 436)

  ctx.fillStyle = '#64748b'
  ctx.font = 'italic 26px serif'
  ctx.fillText('Study Chamber Special Collection', 600, 476)

  // Elegant divider rule with diamond
  ctx.strokeStyle = 'rgba(180, 140, 60, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(240, 520)
  ctx.lineTo(570, 520)
  ctx.moveTo(630, 520)
  ctx.lineTo(960, 520)
  ctx.stroke()

  ctx.fillStyle = '#b45309'
  ctx.beginPath()
  ctx.moveTo(600, 510)
  ctx.lineTo(614, 520)
  ctx.lineTo(600, 530)
  ctx.lineTo(586, 520)
  ctx.closePath()
  ctx.fill()

  // Title in dignified serif typography
  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 52px serif'
  ctx.textAlign = 'center'
  const titleY = wrapText(ctx, title, 600, 620, 920, 68, 840)

  // Subtitle
  ctx.fillStyle = '#475569'
  ctx.font = 'italic 32px serif'
  wrapText(ctx, subtitle, 600, Math.max(titleY + 28, 760), 920, 48, 960)

  // Decorative center vignette box
  ctx.fillStyle = '#f8f5ee'
  ctx.fillRect(200, 1000, 800, 260)
  ctx.strokeStyle = 'rgba(180, 140, 60, 0.3)'
  ctx.lineWidth = 2
  ctx.strokeRect(200, 1000, 800, 260)

  ctx.fillStyle = '#78350f'
  ctx.font = 'bold 26px serif'
  ctx.fillText('AUTHENTIC EDITION', 600, 1064)

  ctx.fillStyle = '#64748b'
  ctx.font = '26px sans-serif'
  ctx.fillText('Complete Unabridged Academic Edition', 600, 1120)
  ctx.fillText('Bound for Immersive Interactive Study', 600, 1168)
  ctx.fillText('Daylight Zen Chamber Archive', 600, 1216)

  // Lower divider
  ctx.strokeStyle = 'rgba(180, 140, 60, 0.3)'
  ctx.beginPath()
  ctx.moveTo(300, 1350)
  ctx.lineTo(900, 1350)
  ctx.stroke()

  // Footer label
  ctx.fillStyle = '#94a3b8'
  ctx.font = '22px sans-serif'
  ctx.fillText('Endpaper · Preliminary Leaf', 600, 1490)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.anisotropy = 16
  insideCoverTextureCache.set(cacheKey, texture)
  return texture
}

export function createPencilCupTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, '#5a3825')
  grad.addColorStop(0.5, '#784c31')
  grad.addColorStop(1, '#4a2d1d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)

  // Wood grain vertical striations
  for (let x = 0; x < 256; x += 4) {
    ctx.fillStyle = `rgba(35, 20, 10, ${0.1 + Math.random() * 0.15})`
    ctx.fillRect(x, 0, 2, 256)
  }

  // Brass rim band at top and bottom
  ctx.fillStyle = '#d4af37'
  ctx.fillRect(0, 0, 256, 10)
  ctx.fillRect(0, 246, 256, 10)

  return new THREE.CanvasTexture(canvas)
}

export function createPlantPotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Clean glazed white ceramic with terracotta rim base
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, 256, 220)

  // Terracotta bottom accent
  ctx.fillStyle = '#c2410c'
  ctx.fillRect(0, 220, 256, 36)

  // Subtle ceramic speckled glaze
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 220
    ctx.fillStyle = 'rgba(100, 116, 139, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, 1, 0, Math.PI * 2)
    ctx.fill()
  }

  return new THREE.CanvasTexture(canvas)
}

export function createShelfPlaqueTexture(label: string, sublabel = ''): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  // Dark brass background
  ctx.fillStyle = '#221910'
  ctx.fillRect(0, 0, 512, 128)

  // Burnished gold metallic border
  ctx.strokeStyle = '#d4af37'
  ctx.lineWidth = 4
  ctx.strokeRect(8, 8, 496, 112)
  ctx.lineWidth = 1.5
  ctx.strokeRect(16, 16, 480, 96)

  // Corner rivets
  ctx.fillStyle = '#fde68a'
  const rivetPoints = [[24, 24], [488, 24], [24, 104], [488, 104]] as const
  rivetPoints.forEach(([rx, ry]) => {
    ctx.beginPath()
    ctx.arc(rx, ry, 3.5, 0, Math.PI * 2)
    ctx.fill()
  })

  // Label text
  ctx.fillStyle = '#fef08a'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, 256, sublabel ? 58 : 74)

  if (sublabel) {
    ctx.fillStyle = '#ca8a04'
    ctx.font = '600 18px sans-serif'
    ctx.fillText(sublabel, 256, 92)
  }

  return new THREE.CanvasTexture(canvas)
}

export function createBookPageEdgesTexture(): THREE.CanvasTexture {
  if (cachedPageEdgesTexture) return cachedPageEdgesTexture
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#f6f3eb'
  ctx.fillRect(0, 0, 256, 256)

  // Paper stack fine horizontal striations
  for (let y = 0; y < 256; y += 2) {
    const alpha = 0.04 + Math.random() * 0.12
    ctx.fillStyle = `rgba(130, 110, 85, ${alpha})`
    ctx.fillRect(0, y, 256, 1)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120)
  grad.addColorStop(0, 'rgba(15, 8, 4, 0.8)')
  grad.addColorStop(0.35, 'rgba(15, 8, 4, 0.5)')
  grad.addColorStop(0.7, 'rgba(15, 8, 4, 0.14)')
  grad.addColorStop(1, 'rgba(15, 8, 4, 0)')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)

  return new THREE.CanvasTexture(canvas)
}

export function createCeramicCupTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Warm Mino/Hagi earthenware clay gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#f2ece1')
  grad.addColorStop(0.3, '#f9f6f0')
  grad.addColorStop(0.7, '#f0e8dc')
  grad.addColorStop(1, '#e3d7c5')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 512)

  // Iron oxide rim glaze wash at the top rim
  const rimGrad = ctx.createLinearGradient(0, 0, 0, 56)
  rimGrad.addColorStop(0, '#2b190f')
  rimGrad.addColorStop(0.35, '#4a2d1a')
  rimGrad.addColorStop(0.75, '#825434')
  rimGrad.addColorStop(1, 'rgba(130, 84, 52, 0)')
  ctx.fillStyle = rimGrad
  ctx.fillRect(0, 0, 512, 56)

  // Subtle potter's wheel horizontal ridges
  for (let y = 30; y < 512; y += 8) {
    const alpha = 0.02 + Math.random() * 0.035
    ctx.fillStyle = `rgba(90, 60, 40, ${alpha})`
    ctx.fillRect(0, y, 512, 2)
  }

  // Iron speckles (tetsuko / natural iron spots in Japanese clay)
  for (let i = 0; i < 280; i++) {
    const sx = Math.random() * 512
    const sy = 20 + Math.random() * 480
    const sr = 0.5 + Math.random() * 1.6
    const a = 0.25 + Math.random() * 0.45
    ctx.fillStyle = `rgba(55, 34, 20, ${a})`
    ctx.beginPath()
    ctx.arc(sx, sy, sr, 0, Math.PI * 2)
    ctx.fill()
  }

  // Faint kannyu (crackle glaze) network lines
  ctx.strokeStyle = 'rgba(140, 110, 85, 0.12)'
  ctx.lineWidth = 0.75
  for (let i = 0; i < 35; i++) {
    ctx.beginPath()
    let cx = Math.random() * 512
    let cy = Math.random() * 512
    ctx.moveTo(cx, cy)
    for (let s = 0; s < 4; s++) {
      cx += (Math.random() - 0.5) * 60
      cy += (Math.random() - 0.5) * 60
      ctx.lineTo(cx, cy)
    }
    ctx.stroke()
  }

  return new THREE.CanvasTexture(canvas)
}

export function createMatchaTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // Deep rich Uji Matcha liquid radial depth
  const grad = ctx.createRadialGradient(256, 256, 15, 256, 256, 256)
  grad.addColorStop(0, '#5a8c24')
  grad.addColorStop(0.45, '#416a18')
  grad.addColorStop(0.78, '#2e4c10')
  grad.addColorStop(0.96, '#1e330a')
  grad.addColorStop(1, '#152406')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 512, 512)

  // Chasen (bamboo whisk) circular swirl pattern
  for (let r = 30; r < 230; r += 16) {
    ctx.beginPath()
    ctx.arc(256, 256, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(130, 195, 65, ${0.07 + Math.random() * 0.08})`
    ctx.lineWidth = 3 + Math.random() * 3
    ctx.stroke()
  }

  // Whisked matcha foam ring (crema/froth) along the rim and outer swirl
  for (let i = 0; i < 380; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = 140 + Math.random() * 95
    const bx = 256 + Math.cos(angle) * dist
    const by = 256 + Math.sin(angle) * dist
    const br = 1.2 + Math.random() * 3.8

    const frothGrad = ctx.createRadialGradient(bx, by, 0.2, bx, by, br)
    frothGrad.addColorStop(0, 'rgba(217, 249, 157, 0.85)')
    frothGrad.addColorStop(0.65, 'rgba(163, 230, 53, 0.65)')
    frothGrad.addColorStop(1, 'rgba(74, 120, 29, 0)')
    ctx.fillStyle = frothGrad
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fill()
  }

  // Center fine whisk froth cluster
  for (let i = 0; i < 140; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * 65
    const bx = 256 + Math.cos(angle) * dist
    const by = 256 + Math.sin(angle) * dist
    const br = 0.8 + Math.random() * 2.2

    ctx.fillStyle = `rgba(190, 242, 100, ${0.4 + Math.random() * 0.35})`
    ctx.beginPath()
    ctx.arc(bx, by, br, 0, Math.PI * 2)
    ctx.fill()
  }

  // Subtle liquid specular highlight crescent
  ctx.beginPath()
  ctx.ellipse(220, 210, 80, 40, -Math.PI / 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.fill()

  return new THREE.CanvasTexture(canvas)
}

export function createTeaSaucerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Deep lacquer/chestnut wood
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
  grad.addColorStop(0, '#2d180d')
  grad.addColorStop(0.6, '#221008')
  grad.addColorStop(0.9, '#190a04')
  grad.addColorStop(1, '#0f0502')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)

  // Concentric turned wood grain rings
  for (let r = 10; r < 125; r += 5) {
    ctx.beginPath()
    ctx.arc(128, 128, r, 0, Math.PI * 2)
    ctx.strokeStyle = `rgba(75, 42, 22, ${0.12 + Math.random() * 0.15})`
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Recessed center cup-seat ring
  ctx.beginPath()
  ctx.arc(128, 128, 62, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(12, 6, 2, 0.65)'
  ctx.lineWidth = 3
  ctx.stroke()

  return new THREE.CanvasTexture(canvas)
}

export function createSteamVaporTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 62)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)')
  grad.addColorStop(0.35, 'rgba(240, 245, 255, 0.28)')
  grad.addColorStop(0.7, 'rgba(220, 235, 245, 0.08)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)

  return new THREE.CanvasTexture(canvas)
}

/**
 * Procedural luminous firefly / star glow texture
 * Renders a soft bioluminescent radial orb with a delicate central starlight twinkle flare,
 * eliminating all hardcoded square quad artifacts.
 */
let cachedFireflyTexture: THREE.CanvasTexture | null = null

export function createFireflyTexture(): THREE.CanvasTexture {
  if (cachedFireflyTexture) return cachedFireflyTexture

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  const cx = 64
  const cy = 64

  // 1. Soft spherical bioluminescent radial glow (Japanese Hotaru / Starlight)
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 62)
  glowGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')        // Ultra-bright starlight core
  glowGrad.addColorStop(0.12, 'rgba(255, 248, 190, 0.95)')    // Warm incandescent center
  glowGrad.addColorStop(0.26, 'rgba(255, 220, 85, 0.75)')     // Warm firefly amber
  glowGrad.addColorStop(0.48, 'rgba(195, 238, 90, 0.40)')     // Bioluminescent Japanese Hotaru green-gold
  glowGrad.addColorStop(0.72, 'rgba(145, 215, 65, 0.14)')     // Ethereal feathered halo
  glowGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)')            // Feathered fade to transparent

  ctx.fillStyle = glowGrad
  ctx.fillRect(0, 0, 128, 128)

  // 2. Delicate 4-point star lens flare twinkle at the core
  // Horizontal streak
  const hGrad = ctx.createLinearGradient(cx - 38, cy, cx + 38, cy)
  hGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  hGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)')
  hGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = hGrad
  ctx.fillRect(cx - 38, cy - 1.5, 76, 3)

  // Vertical streak
  const vGrad = ctx.createLinearGradient(cx, cy - 38, cx, cy + 38)
  vGrad.addColorStop(0, 'rgba(255, 255, 255, 0)')
  vGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)')
  vGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = vGrad
  ctx.fillRect(cx - 1.5, cy - 38, 3, 76)

  // 3. Central pin-point white star core
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7)
  coreGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  coreGrad.addColorStop(0.6, 'rgba(255, 255, 230, 0.9)')
  coreGrad.addColorStop(1, 'rgba(255, 240, 180, 0)')
  ctx.fillStyle = coreGrad
  ctx.beginPath()
  ctx.arc(cx, cy, 7, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  cachedFireflyTexture = texture
  return texture
}
