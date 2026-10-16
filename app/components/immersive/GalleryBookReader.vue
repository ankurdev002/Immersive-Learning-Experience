<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import type { GalleryExhibitInfo } from '~/services/room/GalleryCatalog'
import GalleryBookPage from './GalleryBookPage.vue'

/**
 * History book for a gallery exhibit: opens from its closed cover, then turns its pages with a 3D
 * page-turn (a leaf hinged on the spine, printed on both faces). ← / → or clicking a page turns it;
 * Esc or the close button closes the book.
 */
const props = defineProps<{ exhibit: GalleryExhibitInfo }>()
const emit = defineEmits<{ close: []; flip: [] }>()

type Slot = string | null
/** Spread 0 is the closed book (cover on the right); the rest are open spreads */
const spreads: Array<[Slot, Slot]> = [
  [null, 'cover'],
  ['image', 'title'],
  ['s1', 's2'],
  ['s3', 'colophon'],
]
const FLIP_MS = 850

const spread = ref(0)
const flip = ref<null | { dir: 'next' | 'prev'; front: Slot; back: Slot; left: Slot; right: Slot }>(null)
const closing = ref(false)

const folioOf = (kind: Slot) => {
  for (let s = 1; s < spreads.length; s++) {
    const i = spreads[s]!.indexOf(kind)
    if (i >= 0) return (s - 1) * 2 + i + 1
  }
  return undefined
}

const leftPage = computed<Slot>(() => (flip.value ? flip.value.left : spreads[spread.value]![0]))
const rightPage = computed<Slot>(() => (flip.value ? flip.value.right : spreads[spread.value]![1]))
const isClosed = computed(() => spread.value === 0 && (!flip.value || flip.value.dir !== 'next'))
const canNext = computed(() => spread.value < spreads.length - 1)
const canPrev = computed(() => spread.value > 1)

let timer: ReturnType<typeof setTimeout> | null = null

function turn(dir: 'next' | 'prev') {
  if (flip.value || closing.value) return
  const s = spread.value
  if (dir === 'next' && s < spreads.length - 1) {
    flip.value = { dir, front: spreads[s]![1], back: spreads[s + 1]![0], left: spreads[s]![0], right: spreads[s + 1]![1] }
  } else if (dir === 'prev' && s > 1) {
    flip.value = { dir, front: spreads[s - 1]![1], back: spreads[s]![0], left: spreads[s - 1]![0], right: spreads[s]![1] }
  } else {
    return
  }
  emit('flip')
  timer = setTimeout(() => {
    spread.value = s + (dir === 'next' ? 1 : -1)
    flip.value = null
  }, FLIP_MS)
}

function close() {
  if (closing.value) return
  closing.value = true
  timer = setTimeout(() => emit('close'), 280)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') turn('next')
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') turn('prev')
  else if (e.key === 'Escape') close()
  else return
  e.preventDefault()
  e.stopPropagation()
}

onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  // Open the cover shortly after the book appears
  timer = setTimeout(() => turn('next'), 420)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="gbr-backdrop" :class="{ 'gbr-closing': closing }" @click.self="close">
    <div class="gbr-stage">
      <div class="gbr-book" :class="{ 'gbr-book-closed': isClosed }">
        <!-- Under-pages: the left and right pages of the spread (or the ones being revealed) -->
        <div class="gbr-half gbr-left" :class="{ 'gbr-empty': !leftPage }" @click="turn('prev')">
          <GalleryBookPage v-if="leftPage" :key="`l-${leftPage}`" :kind="leftPage" :exhibit="props.exhibit" :folio="folioOf(leftPage)" />
          <div v-if="leftPage" class="gbr-gutter gbr-gutter-left" />
        </div>
        <div class="gbr-half gbr-right" :class="{ 'gbr-cover-half': rightPage === 'cover' }" @click="turn('next')">
          <GalleryBookPage v-if="rightPage" :key="`r-${rightPage}`" :kind="rightPage" :exhibit="props.exhibit" :folio="folioOf(rightPage)" />
          <div v-if="rightPage && rightPage !== 'cover'" class="gbr-gutter gbr-gutter-right" />
        </div>

        <!-- The turning leaf, hinged on the spine -->
        <div v-if="flip" class="gbr-leaf" :class="`gbr-leaf-${flip.dir}`" :style="{ animationDuration: `${FLIP_MS}ms` }">
          <div class="gbr-face gbr-front" :class="{ 'gbr-cover-half': flip.front === 'cover' }">
            <GalleryBookPage v-if="flip.front" :kind="flip.front" :exhibit="props.exhibit" :folio="folioOf(flip.front)" />
            <div class="gbr-leaf-shade gbr-shade-front" :style="{ animationDuration: `${FLIP_MS}ms` }" />
          </div>
          <div class="gbr-face gbr-back">
            <GalleryBookPage v-if="flip.back" :kind="flip.back" :exhibit="props.exhibit" :folio="folioOf(flip.back)" />
            <div class="gbr-leaf-shade gbr-shade-back" :style="{ animationDuration: `${FLIP_MS}ms` }" />
          </div>
        </div>
      </div>

      <div class="gbr-controls">
        <button class="gbr-btn" :disabled="!canPrev || !!flip" @click="turn('prev')">← Previous</button>
        <span class="gbr-hint">{{ props.exhibit.titleJp }} · {{ props.exhibit.title }}</span>
        <button class="gbr-btn" :disabled="!canNext || !!flip" @click="turn('next')">Next →</button>
        <button class="gbr-btn gbr-close" @click="close">Close ✕</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gbr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse at center, rgba(20, 14, 8, 0.55), rgba(8, 6, 4, 0.85));
  backdrop-filter: blur(3px);
  animation: gbr-in 0.35s ease-out;
}
.gbr-closing {
  animation: gbr-out 0.28s ease-in forwards;
}
@keyframes gbr-in {
  from {
    opacity: 0;
  }
}
@keyframes gbr-out {
  to {
    opacity: 0;
  }
}
.gbr-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  animation: gbr-rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes gbr-rise {
  from {
    transform: translateY(30px) scale(0.94);
  }
}
.gbr-book {
  position: relative;
  width: min(1040px, 92vw);
  aspect-ratio: 1.45;
  max-height: 78vh;
  display: flex;
  perspective: 2600px;
  transition: transform 0.6s cubic-bezier(0.3, 0.7, 0.2, 1);
}
/* Closed: only the right half (the cover) shows, centred */
.gbr-book-closed {
  transform: translateX(-25%);
}
.gbr-half {
  position: relative;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, #f6eedd, #f3e9d4);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
  cursor: pointer;
}
.gbr-left {
  border-radius: 6px 0 0 6px;
  background: linear-gradient(270deg, #efe4cc, #f6eedd 12%, #f3e9d4);
}
.gbr-right {
  border-radius: 0 6px 6px 0;
}
.gbr-empty {
  background: transparent;
  box-shadow: none;
  cursor: default;
}
.gbr-cover-half {
  border-radius: 0 8px 8px 0;
  overflow: hidden;
}
.gbr-gutter {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12%;
  pointer-events: none;
}
.gbr-gutter-left {
  right: 0;
  background: linear-gradient(270deg, rgba(60, 40, 20, 0.22), transparent);
}
.gbr-gutter-right {
  left: 0;
  background: linear-gradient(90deg, rgba(60, 40, 20, 0.2), transparent);
}
.gbr-leaf {
  position: absolute;
  top: 0;
  left: 50%;
  width: 50%;
  height: 100%;
  transform-origin: left center;
  transform-style: preserve-3d;
  animation-timing-function: cubic-bezier(0.45, 0.05, 0.3, 1);
  animation-fill-mode: forwards;
  z-index: 3;
}
.gbr-leaf-next {
  animation-name: gbr-flip-next;
}
.gbr-leaf-prev {
  animation-name: gbr-flip-prev;
}
@keyframes gbr-flip-next {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(-180deg);
  }
}
@keyframes gbr-flip-prev {
  from {
    transform: rotateY(-180deg);
  }
  to {
    transform: rotateY(0deg);
  }
}
.gbr-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: linear-gradient(90deg, #f3e9d4, #f6eedd);
  border-radius: 0 6px 6px 0;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}
.gbr-back {
  transform: rotateY(180deg);
  border-radius: 6px 0 0 6px;
  background: linear-gradient(270deg, #efe4cc, #f6eedd 12%, #f3e9d4);
}
/* Light falling off the curling page as it turns */
.gbr-leaf-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  animation-fill-mode: forwards;
  animation-timing-function: ease-in-out;
}
.gbr-leaf-next .gbr-shade-front,
.gbr-leaf-prev .gbr-shade-back {
  animation-name: gbr-shade-out;
}
.gbr-leaf-next .gbr-shade-back,
.gbr-leaf-prev .gbr-shade-front {
  animation-name: gbr-shade-in;
}
@keyframes gbr-shade-out {
  from {
    background: rgba(0, 0, 0, 0);
  }
  to {
    background: rgba(0, 0, 0, 0.28);
  }
}
@keyframes gbr-shade-in {
  from {
    background: rgba(0, 0, 0, 0.28);
  }
  to {
    background: rgba(0, 0, 0, 0);
  }
}
.gbr-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.gbr-btn {
  font: 600 13px system-ui, sans-serif;
  color: #f3e7cf;
  background: rgba(40, 30, 22, 0.85);
  border: 1px solid rgba(201, 162, 74, 0.5);
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
}
.gbr-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.gbr-btn:not(:disabled):hover {
  background: rgba(70, 52, 34, 0.95);
}
.gbr-close {
  border-color: rgba(255, 255, 255, 0.25);
}
.gbr-hint {
  font: 13px system-ui, sans-serif;
  color: #d9c9a8;
  max-width: 50vw;
  text-align: center;
}
</style>
