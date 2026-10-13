import type Lenis from 'lenis'
import type { ScrollToOptions } from 'lenis'

export const useSmoothScroll = () => {
  const nuxtApp = useNuxtApp()
  const lenis = (import.meta.client ? (nuxtApp.$lenis as Lenis | undefined) : undefined)

  const scrollTo = (
    target: string | number | HTMLElement,
    options?: ScrollToOptions
  ) => {
    if (import.meta.client && lenis) {
      lenis.scrollTo(target, options)
    }
  }

  const stop = () => {
    if (import.meta.client && lenis) {
      lenis.stop()
    }
  }

  const start = () => {
    if (import.meta.client && lenis) {
      lenis.start()
    }
  }

  const resize = () => {
    if (import.meta.client && lenis) {
      lenis.resize()
    }
  }

  return {
    lenis,
    scrollTo,
    stop,
    start,
    resize,
  }
}
