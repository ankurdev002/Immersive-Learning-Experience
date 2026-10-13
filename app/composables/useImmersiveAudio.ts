import { Howl, Howler } from 'howler'
import { gsap } from 'gsap'

/**
 * Procedural PCM 16-bit Mono WAV Generator for Browser Audio.
 * Fast (<1ms), lightweight, and 100% self-contained with zero external asset dependencies.
 */
function createWavBlobUrl(sampleRate: number, samples: Float32Array): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF Chunk Descriptor
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, 'WAVE')

  // "fmt " Subchunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // Audio format 1 = PCM
  view.setUint16(22, 1, true) // Mono
  view.setUint32(24, sampleRate, true) // Sample rate
  view.setUint32(28, sampleRate * 2, true) // Byte rate (sampleRate * 1 channel * 2 bytes)
  view.setUint16(32, 2, true) // Block align (1 * 2)
  view.setUint16(34, 16, true) // Bits per sample
  writeString(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // Write 16-bit PCM integer samples
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  const blob = new Blob([buffer], { type: 'audio/wav' })
  return URL.createObjectURL(blob)
}

// Low-pass filter helper for realistic natural acoustic damping
function applyLowPass(samples: Float32Array, cutoffAlpha: number) {
  let prev = 0
  for (let i = 0; i < samples.length; i++) {
    prev += cutoffAlpha * (samples[i]! - prev)
    samples[i] = prev
  }
}

/**
 * 1. Room Ambience Waveform (8.0s seamless loop)
 * - Subtle warm room tone (55Hz / 110Hz tatami resonance)
 * - Soft outdoor breeze through Japanese garden shoji doors
 * - Very distant garden birds chirping faintly in the distance
 * - Gentle environmental acoustic stillness
 */
function generateRoomAmbienceWavUrl(): string {
  const sr = 22050
  const duration = 8.0
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr

    // Subtle low-frequency room tone
    const roomTone =
      Math.sin(2 * Math.PI * 55 * t) * 0.018 +
      Math.sin(2 * Math.PI * 110 * t) * 0.008

    // Soft outdoor breeze (slow sinusoidal wind variations)
    const breezeMod =
      0.5 +
      0.35 * Math.sin(2 * Math.PI * 0.28 * t) +
      0.15 * Math.sin(2 * Math.PI * 0.12 * t)
    const breezeNoise = (Math.random() * 2 - 1) * 0.022 * breezeMod

    // Very distant morning birds in garden outside shoji doors (at t = 1.8s and t = 5.2s)
    let bird = 0
    if (t > 1.8 && t < 2.2) {
      const bt = t - 1.8
      const env = Math.sin((Math.PI * bt) / 0.4)
      bird = Math.sin(2 * Math.PI * (2900 + 450 * Math.sin(bt * 42)) * bt) * 0.009 * env
    } else if (t > 5.1 && t < 5.5) {
      const bt = t - 5.1
      const env = Math.sin((Math.PI * bt) / 0.4)
      bird = Math.sin(2 * Math.PI * (3250 + 350 * Math.sin(bt * 38)) * bt) * 0.007 * env
    }

    // Distant garden bamboo/wind resonance (at t = 3.4s)
    let envResonance = 0
    if (t > 3.4 && t < 4.2) {
      const ct = t - 3.4
      envResonance = Math.sin(2 * Math.PI * 880 * ct) * Math.exp(-ct * 5) * 0.005
    }

    samples[i] = roomTone + breezeNoise + bird + envResonance
  }

  // Smooth low-pass filter to eliminate harshness
  applyLowPass(samples, 0.25)

  // Seamless crossfade loop between start and end (0.35s)
  const fadeLen = Math.floor(sr * 0.35)
  for (let i = 0; i < fadeLen; i++) {
    const factor = i / fadeLen
    const startVal = samples[i]!
    const endVal = samples[len - fadeLen + i]!
    samples[i] = startVal * factor + endVal * (1 - factor)
    samples[len - fadeLen + i] = samples[i]!
  }

  return createWavBlobUrl(sr, samples)
}

/**
 * 2. Book Interaction Sound (`playBookSelect`)
 * Soft tactile interaction: parchment friction & smooth shelf slide as book is extracted.
 */
function generateBookSelectWavUrl(): string {
  const sr = 22050
  const duration = 0.34
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    const env = Math.exp(-t * 9) * Math.sin((Math.PI * t) / duration)
    const friction = (Math.random() * 2 - 1) * 0.22 * env
    const woodSlide = Math.sin(2 * Math.PI * (140 - t * 120) * t) * Math.exp(-t * 16) * 0.14
    samples[i] = friction + woodSlide
  }

  applyLowPass(samples, 0.4)
  return createWavBlobUrl(sr, samples)
}

/**
 * 3. Book Movement Sound (`playBookMove`)
 * Subtle cinematic whoosh: smooth low-mid aerodynamic air displacement.
 * Natural physical velocity sweep, zero fantasy/magical sparkles.
 */
function generateBookMoveWavUrl(): string {
  const sr = 22050
  const duration = 1.15
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    // Symmetrical aerodynamic velocity curve
    const env = Math.pow(Math.sin((Math.PI * t) / duration), 2.2)
    const noise = (Math.random() * 2 - 1) * 0.20
    const airRumble = Math.sin(2 * Math.PI * (70 + 40 * Math.sin((Math.PI * t) / duration)) * t) * 0.08
    samples[i] = (noise + airRumble) * env
  }

  applyLowPass(samples, 0.28)
  return createWavBlobUrl(sr, samples)
}

/**
 * 4. Book Landing Sound (`playBookLand`)
 * Soft physical impact: cushioned contact transient & warm wooden desk body resonance.
 */
function generateBookLandWavUrl(): string {
  const sr = 22050
  const duration = 0.30
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    // Initial paper/cover slap transient
    const slap = (Math.random() * 2 - 1) * Math.exp(-t * 55) * 0.28
    // Chabudai tabletop wooden resonance
    const wood = Math.sin(2 * Math.PI * (115 - t * 220) * t) * Math.exp(-t * 18) * 0.35
    // Soft settle bounce
    let secondary = 0
    if (t > 0.08) {
      secondary = Math.sin(2 * Math.PI * 65 * (t - 0.08)) * Math.exp(-(t - 0.08) * 35) * 0.09
    }
    samples[i] = slap + wood + secondary
  }

  applyLowPass(samples, 0.5)
  return createWavBlobUrl(sr, samples)
}

/**
 * 5. Book Opening Sound (`playBookOpen`)
 * Subtle cover/book sound: clothbound spine flex and paper separation.
 */
function generateBookOpenWavUrl(): string {
  const sr = 22050
  const duration = 0.65
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    const env = Math.sin((Math.PI * t) / duration)
    // Spine flex creak
    const creak = Math.sin(2 * Math.PI * 260 * t) * (Math.random() * 0.12) * Math.exp(-t * 6)
    // Cover gliding open through air
    const airGlide = (Math.random() * 2 - 1) * 0.12 * env
    samples[i] = creak + airGlide
  }

  applyLowPass(samples, 0.35)
  return createWavBlobUrl(sr, samples)
}

/**
 * 6. Page Flip Sound (`playPageFlip`)
 * Realistic crisp textbook paper peel, aerodynamic flutter, and settling onto page stack.
 */
function generatePageFlipWavUrl(): string {
  const sr = 22050
  const duration = 0.28
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)

  for (let i = 0; i < len; i++) {
    const t = i / sr
    const env = Math.sin((Math.PI * t) / duration)
    // Dynamic air flutter waves
    const flutter = 1.0 + 0.45 * Math.sin(2 * Math.PI * 26 * t)
    const paper = (Math.random() * 2 - 1) * 0.22 * env * flutter
    samples[i] = paper
  }

  applyLowPass(samples, 0.48)
  return createWavBlobUrl(sr, samples)
}

/**
 * 7. Room Interactions (Chime, Light switch, Matcha cup)
 */
function generateHoverChimeWavUrl(): string {
  const sr = 22050
  const len = Math.floor(sr * 0.12)
  const samples = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    samples[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 30) * 0.06
  }
  return createWavBlobUrl(sr, samples)
}

function generateLightSwitchWavUrl(): string {
  const sr = 22050
  const len = Math.floor(sr * 0.06)
  const samples = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const click1 = (Math.random() * 2 - 1) * Math.exp(-t * 90) * 0.25
    let click2 = 0
    if (t > 0.02) {
      click2 = (Math.random() * 2 - 1) * Math.exp(-(t - 0.02) * 80) * 0.18
    }
    samples[i] = click1 + click2
  }
  return createWavBlobUrl(sr, samples)
}

function generateTeaCupWavUrl(): string {
  const sr = 22050
  const len = Math.floor(sr * 0.35)
  const samples = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    samples[i] = Math.sin(2 * Math.PI * 2637 * t) * Math.exp(-t * 12) * 0.18
  }
  return createWavBlobUrl(sr, samples)
}

function generateTeaDrinkWavUrl(): string {
  const sr = 22050
  const duration = 0.42
  const len = Math.floor(sr * duration)
  const samples = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const t = i / sr
    const env = Math.sin((Math.PI * t) / duration)
    samples[i] = (Math.random() * 2 - 1) * 0.12 * env
  }
  applyLowPass(samples, 0.3)
  return createWavBlobUrl(sr, samples)
}

/**
 * Singleton Audio Architecture
 * Preloads reusable Howl objects once. Avoids instantiating Howl repeatedly.
 */
let isPreloaded = false
let ambienceHowl: Howl | null = null
let bookSelectHowl: Howl | null = null
let bookMoveHowl: Howl | null = null
let bookLandHowl: Howl | null = null
let bookOpenHowl: Howl | null = null
let pageFlipHowl: Howl | null = null
let hoverHowl: Howl | null = null
let lightSwitchHowl: Howl | null = null
let teaCupHowl: Howl | null = null
let teaDrinkHowl: Howl | null = null

function preloadReusableSounds() {
  if (isPreloaded || !import.meta.client) return

  try {
    const ambUrl = generateRoomAmbienceWavUrl()
    ambienceHowl = new Howl({
      src: [ambUrl],
      format: ['wav'],
      loop: true,
      volume: 0,
      html5: false,
    })

    const selectUrl = generateBookSelectWavUrl()
    bookSelectHowl = new Howl({
      src: [selectUrl],
      format: ['wav'],
      volume: 0.22,
    })

    const moveUrl = generateBookMoveWavUrl()
    bookMoveHowl = new Howl({
      src: [moveUrl],
      format: ['wav'],
      volume: 0.20,
    })

    const landUrl = generateBookLandWavUrl()
    bookLandHowl = new Howl({
      src: [landUrl],
      format: ['wav'],
      volume: 0.32,
    })

    const openUrl = generateBookOpenWavUrl()
    bookOpenHowl = new Howl({
      src: [openUrl],
      format: ['wav'],
      volume: 0.26,
    })

    const flipUrl = generatePageFlipWavUrl()
    pageFlipHowl = new Howl({
      src: [flipUrl],
      format: ['wav'],
      volume: 0.24,
    })

    const hoverUrl = generateHoverChimeWavUrl()
    hoverHowl = new Howl({
      src: [hoverUrl],
      format: ['wav'],
      volume: 0.08,
    })

    const lightUrl = generateLightSwitchWavUrl()
    lightSwitchHowl = new Howl({
      src: [lightUrl],
      format: ['wav'],
      volume: 0.20,
    })

    const cupUrl = generateTeaCupWavUrl()
    teaCupHowl = new Howl({
      src: [cupUrl],
      format: ['wav'],
      volume: 0.16,
    })

    const drinkUrl = generateTeaDrinkWavUrl()
    teaDrinkHowl = new Howl({
      src: [drinkUrl],
      format: ['wav'],
      volume: 0.15,
    })

    isPreloaded = true
  } catch (err) {
    console.warn('Audio preloading notice:', err)
  }
}

function ensureAudioContextResumed() {
  if (!import.meta.client) return
  try {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      Howler.ctx.resume()
    }
  } catch {
    // Autoplay policy handled gracefully
  }
}

export const useImmersiveAudio = () => {
  // 1. Room Ambience (Fade in low-volume room tone + wind + distant birds)
  const playRoomAmbience = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()

    if (!ambienceHowl) return
    if (!ambienceHowl.playing()) {
      ambienceHowl.volume(0)
      ambienceHowl.play()

      // Smooth GSAP fade-in to subtle level (0.11) over 2.0s
      const volTracker = { vol: 0 }
      gsap.to(volTracker, {
        vol: 0.11,
        duration: 2.0,
        ease: 'power2.out',
        onUpdate: () => {
          ambienceHowl?.volume(volTracker.vol)
        },
      })
    }
  }

  // 2. Stop Immersive Audio (Smooth GSAP fade-out on exit)
  const stopImmersiveAudio = () => {
    if (!import.meta.client || !ambienceHowl) return
    if (!ambienceHowl.playing()) return

    const currentVol = ambienceHowl.volume()
    const volTracker = { vol: currentVol }
    gsap.to(volTracker, {
      vol: 0,
      duration: 1.4,
      ease: 'power2.in',
      onUpdate: () => {
        ambienceHowl?.volume(volTracker.vol)
      },
      onComplete: () => {
        ambienceHowl?.stop()
      },
    })
  }

  // 3. Book Selection (Extracting from shelf slot)
  const playBookSelect = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    bookSelectHowl?.play()
  }

  // 4. Book Flight (Subtle cinematic whoosh through room air)
  const playBookMove = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    bookMoveHowl?.play()
  }

  // 5. Book Landing (Soft physical impact on wooden desk)
  const playBookLand = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    bookLandHowl?.play()
  }

  // 6. Book Opening (Subtle cover lift & spine flex)
  const playBookOpen = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    bookOpenHowl?.play()
  }

  // 7. Page Flip (Realistic crisp textbook paper sound)
  const playPageFlip = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    pageFlipHowl?.play()
  }

  // Chamber Props: Hover Chime
  const playTargetHover = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    hoverHowl?.play()
  }

  // Chamber Props: Light Switch Toggle Click
  const playLightSwitch = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    lightSwitchHowl?.play()
  }

  // Chamber Props: Ceramic Tea Cup Clink
  const playTeaCupClink = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    teaCupHowl?.play()
  }

  // Chamber Props: Matcha Tea Sip
  const playTeaDrink = () => {
    if (!import.meta.client) return
    ensureAudioContextResumed()
    preloadReusableSounds()
    teaDrinkHowl?.play()
  }

  return {
    playRoomAmbience,
    playBookSelect,
    playBookMove,
    playBookLand,
    playBookOpen,
    playPageFlip,
    stopImmersiveAudio,

    // Backwards-compatible aliases & props
    playBookSlide: playBookSelect,
    playTargetHover,
    playLightSwitch,
    playTeaCupClink,
    playTeaDrink,
  }
}
