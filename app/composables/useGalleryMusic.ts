import { ref } from 'vue'

/**
 * Background music for the upstairs Art Gallery, streamed through SoundCloud's official embedded
 * player and its Widget API (the track stays on SoundCloud; nothing is copied into the app). The
 * player is created lazily the first time the gallery is entered, plays quietly while you're in
 * the gallery, fades in and out, loops, and pauses when you leave.
 */

const TRACK_URL = 'https://soundcloud.com/rursache/fitgirl-repacks-setup-music'
export const GALLERY_TRACK = { title: 'FitGirl Repacks Setup Music', uploader: 'rursache', url: TRACK_URL }
/** Soft enough to sit under a quiet gallery (percent of the player's full volume) */
const GALLERY_VOLUME = 14

interface ScWidget {
  bind(event: string, cb: () => void): void
  play(): void
  pause(): void
  seekTo(ms: number): void
  setVolume(v: number): void
}

let iframe: HTMLIFrameElement | null = null
let widget: ScWidget | null = null
let readyPromise: Promise<ScWidget> | null = null
let fadeTimer: ReturnType<typeof setInterval> | null = null
let currentVolume = 0

const playing = ref(false)
const enabled = ref(true)
const failed = ref(false)

function loadApi(): Promise<void> {
  const w = window as unknown as { SC?: { Widget?: unknown } }
  if (w.SC?.Widget) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-sc-widget-api]')
    const script = existing ?? document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('SoundCloud widget API failed to load')))
    if (!existing) {
      script.src = 'https://w.soundcloud.com/player/api.js'
      script.async = true
      script.dataset.scWidgetApi = 'true'
      document.head.appendChild(script)
    }
  })
}

function ensureWidget(): Promise<ScWidget> {
  if (readyPromise) return readyPromise
  readyPromise = loadApi().then(
    () =>
      new Promise<ScWidget>((resolve) => {
        const params = new URLSearchParams({
          url: TRACK_URL,
          auto_play: 'false',
          buying: 'false',
          sharing: 'false',
          download: 'false',
          show_artwork: 'false',
          show_comments: 'false',
          show_playcount: 'false',
          show_user: 'false',
          hide_related: 'true',
          visual: 'false',
        })
        iframe = document.createElement('iframe')
        iframe.title = `${GALLERY_TRACK.title} (SoundCloud)`
        iframe.allow = 'autoplay'
        iframe.setAttribute('aria-hidden', 'true')
        iframe.tabIndex = -1
        // Kept in the page (some browsers won't play from display:none frames) but invisible
        Object.assign(iframe.style, {
          position: 'fixed',
          left: '0',
          bottom: '0',
          width: '1px',
          height: '1px',
          opacity: '0',
          border: '0',
          pointerEvents: 'none',
        })
        iframe.src = `https://w.soundcloud.com/player/?${params.toString()}`
        document.body.appendChild(iframe)
        const SC = (window as unknown as { SC: { Widget: ((el: HTMLIFrameElement) => ScWidget) & { Events: Record<string, string> } } }).SC
        const w = SC.Widget(iframe)
        w.bind(SC.Widget.Events.READY!, () => {
          widget = w
          w.setVolume(0)
          // Loop: start again from the top when the track ends
          w.bind(SC.Widget.Events.FINISH!, () => {
            if (!playing.value) return
            w.seekTo(0)
            w.play()
          })
          resolve(w)
        })
      })
  )
  readyPromise.catch(() => {
    failed.value = true
    readyPromise = null
  })
  return readyPromise
}

function fadeTo(target: number, ms: number, done?: () => void) {
  if (fadeTimer) clearInterval(fadeTimer)
  const w = widget
  if (!w) return
  const start = currentVolume
  const steps = Math.max(1, Math.round(ms / 80))
  let k = 0
  fadeTimer = setInterval(() => {
    k++
    currentVolume = start + ((target - start) * k) / steps
    w.setVolume(Math.round(currentVolume))
    if (k >= steps) {
      if (fadeTimer) clearInterval(fadeTimer)
      fadeTimer = null
      done?.()
    }
  }, 80)
}

export function useGalleryMusic() {
  /** Entering the gallery: fade the music in (if it isn't switched off). */
  async function start(muted = false) {
    playing.value = true
    if (!enabled.value) return
    try {
      const w = await ensureWidget()
      if (!playing.value) return // left the gallery while it loaded
      failed.value = false
      w.play()
      fadeTo(muted ? 0 : GALLERY_VOLUME, 2600)
    } catch {
      failed.value = true
    }
  }

  /** Leaving the gallery: fade out, then pause (it resumes where it was next time). */
  function stop() {
    playing.value = false
    if (!widget) return
    fadeTo(0, 1400, () => {
      if (!playing.value) widget?.pause()
    })
  }

  /** The app's global mute. */
  function setMuted(muted: boolean) {
    if (!widget || !playing.value || !enabled.value) return
    fadeTo(muted ? 0 : GALLERY_VOLUME, 400)
  }

  /** The gallery's own music on / off switch. */
  function toggle(muted = false) {
    enabled.value = !enabled.value
    if (enabled.value) {
      if (playing.value) void start(muted)
    } else if (widget) {
      fadeTo(0, 700, () => widget?.pause())
    }
  }

  function dispose() {
    if (fadeTimer) clearInterval(fadeTimer)
    fadeTimer = null
    widget?.pause()
    iframe?.remove()
    iframe = null
    widget = null
    readyPromise = null
    currentVolume = 0
    playing.value = false
  }

  return { playing, enabled, failed, start, stop, setMuted, toggle, dispose }
}
