import { Howler } from 'howler'

export interface Track {
  id: string
  name: string
  icon: string
  description: string
  baseFreq: number
}

const TRACKS: Track[] = [
  { id: 'bouncy', name: 'Bouncy Beats', icon: '🎵', description: 'Upbeat playful rhythm', baseFreq: 330 },
  { id: 'cosmic', name: 'Cosmic Drift', icon: '✨', description: 'Deep ambient resonance', baseFreq: 220 },
  { id: 'focus', name: 'Deep Focus', icon: '🪐', description: 'Gentle harmonic waves', baseFreq: 174 },
]

export const useAudioPlayer = () => {
  const currentTrack = useState<Track>('audio-current-track', () => TRACKS[0]!)
  const isPlaying = useState<boolean>('audio-is-playing', () => false)
  const isMuted = useState<boolean>('audio-is-muted', () => false)
  const volume = useState<number>('audio-volume', () => 0.5)

  let audioCtx: AudioContext | null = null
  let ambientOsc: OscillatorNode | null = null
  let ambientGain: GainNode | null = null

  const getAudioContext = (): AudioContext | null => {
    if (!import.meta.client) return null
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioContextClass) {
        audioCtx = new AudioContextClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
    }
    return audioCtx
  }

  const startAmbientTone = (freq: number) => {
    if (!import.meta.client) return
    const ctx = getAudioContext()
    if (!ctx) return

    stopAmbientTone()

    try {
      ambientOsc = ctx.createOscillator()
      ambientGain = ctx.createGain()

      ambientOsc.type = 'sine'
      ambientOsc.frequency.setValueAtTime(freq, ctx.currentTime)

      const targetGain = isMuted.value ? 0 : volume.value * 0.08
      ambientGain.gain.setValueAtTime(0.001, ctx.currentTime)
      ambientGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), ctx.currentTime + 1.2)

      ambientOsc.connect(ambientGain)
      ambientGain.connect(ctx.destination)
      ambientOsc.start()
    } catch {
      // Audio autoplay policy handled gracefully
    }
  }

  const stopAmbientTone = () => {
    if (ambientOsc) {
      try {
        ambientOsc.stop()
        ambientOsc.disconnect()
      } catch {
        // Ignored
      }
      ambientOsc = null
    }
  }

  const playTone = (freq = 440, duration = 0.15, type: OscillatorType = 'sine', gainMultiplier = 0.06) => {
    if (!import.meta.client || isMuted.value) return
    const ctx = getAudioContext()
    if (!ctx) return

    try {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, ctx.currentTime)

      const actualGain = volume.value * gainMultiplier
      gain.gain.setValueAtTime(actualGain, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // Audio autoplay policy
    }
  }

  const playHoverSound = () => {
    playTone(587.33, 0.06, 'sine', 0.02) // D5 light chime
  }

  const playClickSound = () => {
    playTone(880, 0.1, 'triangle', 0.04) // A5 bright pop
  }

  const selectTrack = (track: Track) => {
    currentTrack.value = track
    playClickSound()
    if (isPlaying.value) {
      startAmbientTone(track.baseFreq)
    }
  }

  const togglePlay = () => {
    isPlaying.value = !isPlaying.value
    if (isPlaying.value) {
      startAmbientTone(currentTrack.value.baseFreq)
    } else {
      stopAmbientTone()
    }
  }

  const toggleMute = () => {
    isMuted.value = !isMuted.value
    Howler.mute(isMuted.value)
    if (ambientGain && audioCtx) {
      const target = isMuted.value ? 0.0001 : volume.value * 0.08
      ambientGain.gain.setValueAtTime(ambientGain.gain.value, audioCtx.currentTime)
      ambientGain.gain.exponentialRampToValueAtTime(target, audioCtx.currentTime + 0.15)
    }
  }

  return {
    tracks: TRACKS,
    currentTrack,
    isPlaying,
    isMuted,
    volume,
    selectTrack,
    togglePlay,
    toggleMute,
    playHoverSound,
    playClickSound,
  }
}
