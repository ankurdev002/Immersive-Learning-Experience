<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { GalleryExhibitInfo } from '~/services/room/GalleryCatalog'
import { GalleryBook3D } from '~/services/room/GalleryBook3D'

/**
 * History book for a gallery exhibit: a real 3D book (curved pages, hinged cover, bending page
 * turns) rendered in its own small WebGL view. ← / → or clicking the left / right page turns it;
 * Esc or the close button closes it.
 */
const props = defineProps<{ exhibit: GalleryExhibitInfo }>()
const emit = defineEmits<{ close: []; flip: [] }>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const spread = ref(0)
const lastSpread = ref(3)
const closing = ref(false)
let book: GalleryBook3D | null = null
let openTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null

const next = () => book?.next()
const prev = () => book?.prev()

function close() {
  if (closing.value) return
  closing.value = true
  closeTimer = setTimeout(() => emit('close'), 280)
}

function onCanvasClick(e: MouseEvent) {
  const el = canvasRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (e.clientX - r.left < r.width / 2) prev()
  else next()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') next()
  else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') prev()
  else if (e.key === 'Escape') close()
  else return
  e.preventDefault()
  e.stopPropagation()
}

onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  if (!canvasRef.value) return
  book = new GalleryBook3D(canvasRef.value, props.exhibit, {
    onFlip: () => emit('flip'),
    onSpread: (s, last) => {
      spread.value = s
      lastSpread.value = last
    },
  })
  // Open the cover shortly after the book appears
  openTimer = setTimeout(() => book?.next(), 450)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  if (openTimer) clearTimeout(openTimer)
  if (closeTimer) clearTimeout(closeTimer)
  book?.dispose()
  book = null
})
</script>

<template>
  <div class="gbr-backdrop" :class="{ 'gbr-closing': closing }" @click.self="close">
    <div class="gbr-stage">
      <canvas ref="canvasRef" class="gbr-canvas" @click="onCanvasClick" />
      <div class="gbr-controls">
        <button class="gbr-btn" :disabled="spread <= 1" @click="prev">← Previous</button>
        <span class="gbr-hint">{{ props.exhibit.titleJp }} · {{ props.exhibit.title }}</span>
        <button class="gbr-btn" :disabled="spread >= lastSpread" @click="next">Next →</button>
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
  background: radial-gradient(ellipse at center, rgba(20, 14, 8, 0.5), rgba(8, 6, 4, 0.86));
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
  gap: 10px;
  animation: gbr-rise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes gbr-rise {
  from {
    transform: translateY(30px) scale(0.95);
  }
}
.gbr-canvas {
  display: block;
  width: min(1180px, 96vw);
  height: min(80vh, 66vw);
  cursor: pointer;
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
