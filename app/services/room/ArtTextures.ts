import * as THREE from 'three'

/**
 * Procedural canvas art for the redesigned rooms: parallax garden layers, paintings, rug, sand
 * garden, globe and wall map. Generated once (seeded, so identical every visit) and shared.
 */

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cache = new Map<string, THREE.CanvasTexture>()

function canvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void
): THREE.CanvasTexture {
  let base = cache.get(key)
  if (!base) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
    draw(ctx, seeded(hash))
    base = new THREE.CanvasTexture(canvas)
    base.colorSpace = THREE.SRGBColorSpace
    base.anisotropy = 4
    cache.set(key, base)
  }
  return base.clone()
}

// ---------------------------------------------------------------------------
// Parallax garden layers
// ---------------------------------------------------------------------------

/** Far layer: dusk sky, layered misty mountains and a still pond line. Opaque. */
export function createGardenFarLayer(): THREE.CanvasTexture {
  return canvasTexture('garden-far', 1024, 512, (ctx, rand) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 512)
    sky.addColorStop(0, '#9cc3e4')
    sky.addColorStop(0.55, '#e9dccb')
    sky.addColorStop(1, '#d9e3cf')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, 1024, 512)

    // Soft sun glow
    const sun = ctx.createRadialGradient(760, 150, 4, 760, 150, 180)
    sun.addColorStop(0, 'rgba(255,244,214,0.9)')
    sun.addColorStop(1, 'rgba(255,244,214,0)')
    ctx.fillStyle = sun
    ctx.fillRect(0, 0, 1024, 512)

    const ranges = [
      { base: 300, amp: 90, color: 'rgba(122,146,170,0.55)' },
      { base: 340, amp: 70, color: 'rgba(96,124,128,0.7)' },
      { base: 385, amp: 45, color: 'rgba(78,108,88,0.9)' },
    ]
    for (const r of ranges) {
      ctx.fillStyle = r.color
      ctx.beginPath()
      ctx.moveTo(0, 512)
      let y = r.base
      for (let x = 0; x <= 1024; x += 16) {
        y += (rand() - 0.5) * 22
        y = Math.max(r.base - r.amp, Math.min(r.base + 20, y))
        ctx.lineTo(x, y)
      }
      ctx.lineTo(1024, 512)
      ctx.closePath()
      ctx.fill()
    }

    // Moss ground
    const ground = ctx.createLinearGradient(0, 420, 0, 512)
    ground.addColorStop(0, '#5f7f4a')
    ground.addColorStop(1, '#3d5a33')
    ctx.fillStyle = ground
    ctx.fillRect(0, 430, 1024, 82)
  })
}

/** Mid layer: Japanese maples and stone lantern silhouettes. Transparent background. */
export function createGardenMidLayer(): THREE.CanvasTexture {
  return canvasTexture('garden-mid', 1024, 512, (ctx, rand) => {
    ctx.clearRect(0, 0, 1024, 512)
    const trees = [
      { x: 170, y: 250, r: 120, hue: '#b8432f' },
      { x: 520, y: 230, r: 140, hue: '#cf6a32' },
      { x: 860, y: 260, r: 110, hue: '#a3352a' },
    ]
    for (const t of trees) {
      // Trunk
      ctx.strokeStyle = '#3b2a20'
      ctx.lineWidth = 16
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(t.x, 512)
      ctx.quadraticCurveTo(t.x - 20, 380, t.x + 10, t.y + 30)
      ctx.stroke()
      ctx.lineWidth = 7
      for (let b = 0; b < 4; b++) {
        ctx.beginPath()
        ctx.moveTo(t.x, t.y + 80)
        ctx.lineTo(t.x + (rand() - 0.5) * t.r * 1.4, t.y + (rand() - 0.6) * t.r * 0.6)
        ctx.stroke()
      }
      // Foliage clusters
      for (let i = 0; i < 140; i++) {
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * t.r
        const cx = t.x + Math.cos(a) * d * 1.3
        const cy = t.y + Math.sin(a) * d * 0.7
        const size = 10 + rand() * 18
        ctx.fillStyle = t.hue
        ctx.globalAlpha = 0.55 + rand() * 0.4
        ctx.beginPath()
        ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    // Stone lantern silhouette
    ctx.fillStyle = '#6f6d66'
    ctx.fillRect(680, 420, 30, 70)
    ctx.fillRect(664, 400, 62, 22)
    ctx.beginPath()
    ctx.moveTo(650, 402)
    ctx.lineTo(695, 370)
    ctx.lineTo(740, 402)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(660, 488, 70, 14)
  })
}

/** Near layer: bamboo stalks with nodes and leaf sprays. Transparent; swayed in the vertex shader. */
export function createGardenNearLayer(): THREE.CanvasTexture {
  return canvasTexture('garden-near', 1024, 1024, (ctx, rand) => {
    ctx.clearRect(0, 0, 1024, 1024)
    const stalks = 11
    for (let i = 0; i < stalks; i++) {
      const x = 40 + (i / stalks) * 960 + (rand() - 0.5) * 50
      const w = 14 + rand() * 12
      const green = 90 + Math.floor(rand() * 50)
      const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0)
      grad.addColorStop(0, `rgb(${40}, ${green - 20}, ${40})`)
      grad.addColorStop(0.45, `rgb(${110}, ${green + 60}, ${70})`)
      grad.addColorStop(1, `rgb(${35}, ${green - 30}, ${35})`)
      ctx.fillStyle = grad
      ctx.fillRect(x - w / 2, 0, w, 1024)
      // Nodes
      ctx.fillStyle = 'rgba(30,50,25,0.75)'
      for (let y = 60 + rand() * 80; y < 1024; y += 110 + rand() * 40) {
        ctx.fillRect(x - w / 2 - 1, y, w + 2, 4)
      }
      // Leaf sprays in the upper half
      for (let l = 0; l < 7; l++) {
        const ly = 40 + rand() * 520
        const dir = rand() > 0.5 ? 1 : -1
        for (let k = 0; k < 4; k++) {
          const len = 50 + rand() * 60
          const ang = dir * (0.2 + rand() * 0.6) + (rand() - 0.5) * 0.3
          ctx.save()
          ctx.translate(x, ly + k * 12)
          ctx.rotate(Math.PI / 2 - ang)
          ctx.fillStyle = `rgba(${50 + rand() * 30}, ${120 + rand() * 50}, ${50}, 0.92)`
          ctx.beginPath()
          ctx.ellipse(len / 2, 0, len / 2, 6, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Room art
// ---------------------------------------------------------------------------

export type PaintingStyle = 'mountains' | 'bamboo' | 'enso' | 'wave'

/** Sumi-e style ink paintings on warm washi. */
export function createPaintingTexture(style: PaintingStyle): THREE.CanvasTexture {
  return canvasTexture(`painting-${style}`, 512, 640, (ctx, rand) => {
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(0, 0, 512, 640)
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = `rgba(150,130,100,${rand() * 0.05})`
      ctx.fillRect(rand() * 512, rand() * 640, 2, 2)
    }
    ctx.strokeStyle = '#1f1c19'
    ctx.fillStyle = '#1f1c19'
    ctx.lineCap = 'round'
    if (style === 'mountains') {
      for (let layer = 0; layer < 3; layer++) {
        ctx.globalAlpha = 0.25 + layer * 0.25
        ctx.beginPath()
        ctx.moveTo(0, 640)
        let y = 380 + layer * 70
        for (let x = 0; x <= 512; x += 12) {
          y += (rand() - 0.5) * 34
          ctx.lineTo(x, Math.min(600, Math.max(200 + layer * 60, y)))
        }
        ctx.lineTo(512, 640)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = '#b3261e'
      ctx.beginPath()
      ctx.arc(390, 150, 42, 0, Math.PI * 2)
      ctx.fill()
    } else if (style === 'bamboo') {
      for (let s = 0; s < 3; s++) {
        const x = 150 + s * 110
        ctx.lineWidth = 14 - s * 3
        ctx.globalAlpha = 0.9 - s * 0.25
        for (let y = 640; y > 60; y -= 90) {
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x + 4, y - 80)
          ctx.stroke()
        }
        for (let l = 0; l < 6; l++) {
          const ly = 100 + rand() * 300
          ctx.save()
          ctx.translate(x, ly)
          ctx.rotate((rand() - 0.5) * 1.6)
          ctx.beginPath()
          ctx.ellipse(40, 0, 42, 7, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1
    } else if (style === 'enso') {
      ctx.lineWidth = 34
      ctx.globalAlpha = 0.92
      ctx.beginPath()
      ctx.arc(256, 300, 160, -0.3, Math.PI * 1.78)
      ctx.stroke()
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 12
      ctx.beginPath()
      ctx.arc(256, 300, 172, 0.1, Math.PI * 1.6)
      ctx.stroke()
      ctx.globalAlpha = 1
    } else {
      ctx.fillStyle = '#21405f'
      for (let w = 0; w < 5; w++) {
        const baseY = 300 + w * 60
        ctx.globalAlpha = 0.25 + w * 0.15
        ctx.beginPath()
        ctx.moveTo(0, 640)
        for (let x = 0; x <= 512; x += 8) {
          ctx.lineTo(x, baseY + Math.sin(x / 40 + w) * 26 - Math.max(0, Math.sin(x / 90 + w * 2)) * 40)
        }
        ctx.lineTo(512, 640)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    // Artist seal
    ctx.fillStyle = '#b3261e'
    ctx.fillRect(430, 560, 34, 34)
  })
}

/** Geometric wool rug in indigo and madder red. */
export function createRugTexture(): THREE.CanvasTexture {
  return canvasTexture('rug', 512, 768, (ctx, rand) => {
    ctx.fillStyle = '#7a2a22'
    ctx.fillRect(0, 0, 512, 768)
    ctx.fillStyle = '#1f2f4f'
    ctx.fillRect(28, 28, 456, 712)
    ctx.fillStyle = '#d9c8a5'
    ctx.fillRect(48, 48, 416, 672)
    ctx.fillStyle = '#7a2a22'
    ctx.fillRect(64, 64, 384, 640)
    for (let i = 0; i < 6; i++) {
      const cy = 120 + i * 105
      ctx.fillStyle = i % 2 ? '#1f2f4f' : '#c9a35a'
      ctx.beginPath()
      ctx.moveTo(256, cy - 40)
      ctx.lineTo(330, cy)
      ctx.lineTo(256, cy + 40)
      ctx.lineTo(182, cy)
      ctx.closePath()
      ctx.fill()
    }
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.08})`
      ctx.fillRect(rand() * 512, rand() * 768, 1, 3)
    }
  })
}

/** Raked karesansui sand garden with rocks and moss, seen through the dojo's picture window. */
export function createSandGardenTexture(): THREE.CanvasTexture {
  return canvasTexture('sand-garden', 1024, 512, (ctx, rand) => {
    ctx.fillStyle = '#e4dccb'
    ctx.fillRect(0, 0, 1024, 512)
    const rocks = [
      { x: 300, y: 300, r: 60 },
      { x: 640, y: 250, r: 80 },
      { x: 820, y: 360, r: 45 },
    ]
    ctx.strokeStyle = 'rgba(150,138,115,0.55)'
    ctx.lineWidth = 3
    for (let y = 12; y < 512; y += 14) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(1024, y)
      ctx.stroke()
    }
    for (const r of rocks) {
      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r + ring * 16, (r.r + ring * 16) * 0.55, 0, 0, Math.PI * 2)
        ctx.fillStyle = '#e4dccb'
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = '#4f7a3a'
      ctx.beginPath()
      ctx.ellipse(r.x, r.y + r.r * 0.15, r.r * 1.2, r.r * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
      const g = ctx.createRadialGradient(r.x - r.r * 0.3, r.y - r.r * 0.4, 4, r.x, r.y, r.r)
      g.addColorStop(0, '#8f8a80')
      g.addColorStop(1, '#3f3c37')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(r.x, r.y - r.r * 0.1, r.r * 0.8, r.r * 0.55, rand() * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    const wall = ctx.createLinearGradient(0, 0, 0, 70)
    wall.addColorStop(0, '#6f5a43')
    wall.addColorStop(1, '#8d7558')
    ctx.fillStyle = wall
    ctx.fillRect(0, 0, 1024, 60)
  })
}

/** Stylised antique globe surface (equirectangular). */
export function createGlobeTexture(): THREE.CanvasTexture {
  return canvasTexture('globe', 1024, 512, (ctx, rand) => {
    ctx.fillStyle = '#c9b48a'
    ctx.fillRect(0, 0, 1024, 512)
    ctx.fillStyle = '#7d8f6a'
    const continents = [
      [180, 160, 120, 90], [260, 330, 70, 110], [520, 150, 110, 70], [560, 300, 90, 120], [780, 180, 150, 90], [860, 380, 70, 45],
    ]
    for (const [cx, cy, rx, ry] of continents) {
      ctx.beginPath()
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.25) {
        const k = 0.75 + rand() * 0.45
        const x = cx! + Math.cos(a) * rx! * k
        const y = cy! + Math.sin(a) * ry! * k
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(80,60,40,0.35)'
    ctx.lineWidth = 1.5
    for (let x = 0; x < 1024; x += 64) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 512)
      ctx.stroke()
    }
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(1024, y)
      ctx.stroke()
    }
  })
}

/** Aged parchment wall chart of the heavens. */
export function createWallMapTexture(): THREE.CanvasTexture {
  return canvasTexture('wall-map', 768, 512, (ctx, rand) => {
    const g = ctx.createRadialGradient(384, 256, 50, 384, 256, 460)
    g.addColorStop(0, '#efe0bd')
    g.addColorStop(1, '#b89a68')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 768, 512)
    ctx.strokeStyle = 'rgba(70,50,30,0.6)'
    ctx.lineWidth = 2
    for (const cx of [210, 558]) {
      ctx.beginPath()
      ctx.arc(cx, 256, 170, 0, Math.PI * 2)
      ctx.stroke()
      for (let r = 40; r < 170; r += 42) {
        ctx.beginPath()
        ctx.arc(cx, 256, r, 0, Math.PI * 2)
        ctx.stroke()
      }
      for (let i = 0; i < 70; i++) {
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * 160
        ctx.fillStyle = 'rgba(60,40,20,0.8)'
        ctx.beginPath()
        ctx.arc(cx + Math.cos(a) * d, 256 + Math.sin(a) * d, 1 + rand() * 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#4a3320'
    ctx.font = 'bold 30px serif'
    ctx.textAlign = 'center'
    ctx.fillText('天球図', 384, 50)
  })
}

/** Soft radial contact-shadow blob (alpha in the red channel is unnecessary: plain alpha). */
export function createSoftShadowTexture(): THREE.CanvasTexture {
  return canvasTexture('soft-shadow', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
    g.addColorStop(0, 'rgba(0,0,0,0.85)')
    g.addColorStop(0.55, 'rgba(0,0,0,0.38)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  })
}
