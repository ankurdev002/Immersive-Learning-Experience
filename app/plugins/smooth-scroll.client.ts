import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default defineNuxtPlugin((nuxtApp) => {
  gsap.registerPlugin(ScrollTrigger)

  const lenis = new Lenis({
    autoRaf: false,
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
  })

  // Synchronize Lenis scroll with GSAP ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update)

  // Use GSAP's ticker to drive Lenis's RAF loop for seamless synchronization
  const updateTicker = (time: number) => {
    lenis.raf(time * 1000)
  }

  gsap.ticker.add(updateTicker)
  gsap.ticker.lagSmoothing(0)

  // Recalculate dimensions on page navigation
  nuxtApp.hook('page:finish', () => {
    lenis.resize()
    ScrollTrigger.refresh()
  })

  // Provide lenis instance to the application
  return {
    provide: {
      lenis,
    },
  }
})
