<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useImmersiveRoom } from '~/composables/useImmersiveRoom'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

const { openImmersive } = useImmersiveRoom()
const {
  tracks,
  currentTrack,
  isPlaying,
  isMuted,
  selectTrack,
  togglePlay,
  toggleMute,
  playHoverSound,
  playClickSound,
} = useAudioPlayer()

const isAudioDropdownOpen = ref(false)

// Animated kinetic typography words
const rotatingWords = [
  'Tactile 3D Study',
  'Real Page Flipping',
  'Authentic Diagrams',
  'Daylight Zen Chamber',
  'Curated Knowledge',
]
const currentWordIndex = ref(0)
const isWordFlipping = ref(false)
let wordInterval: ReturnType<typeof setInterval> | null = null

// Launch Immersive Chamber
const handleEnter = () => {
  playClickSound()
  openImmersive()
}

// Global keyboard shortcut to launch
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault()
    handleEnter()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  wordInterval = setInterval(() => {
    isWordFlipping.value = true
    setTimeout(() => {
      currentWordIndex.value = (currentWordIndex.value + 1) % rotatingWords.length
      isWordFlipping.value = false
    }, 350)
  }, 2800)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (wordInterval) clearInterval(wordInterval)
})

const activeWord = computed(() => rotatingWords[currentWordIndex.value])
</script>

<template>
  <div class="ire-home-container">
    <!-- Ambient Aurora Background Elements -->
    <div class="ambient-glow glow-top-left" aria-hidden="true" />
    <div class="ambient-glow glow-center" aria-hidden="true" />
    <div class="ambient-glow glow-bottom-right" aria-hidden="true" />
    <div class="grid-overlay" aria-hidden="true" />

    <!-- Minimalist Glass Header -->
    <header class="portal-header">
      <div class="brand-badge">
        <div class="brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div class="brand-titles">
          <span class="brand-acronym">IRE</span>
          <span class="brand-full">Immersive Reading Experience</span>
        </div>
      </div>

      <!-- Right Audio & Chamber Status -->
      <div class="header-actions">
        <!-- Audio Track Selector Pill -->
        <div class="audio-control-wrapper">
          <button
            class="audio-pill-btn"
            :class="{ 'is-active': isPlaying }"
            aria-label="Soundscape Selector"
            @click="isAudioDropdownOpen = !isAudioDropdownOpen"
            @mouseenter="playHoverSound"
          >
            <span class="audio-icon">{{ currentTrack?.icon || '🎵' }}</span>
            <span class="audio-track-name">{{ currentTrack?.name || 'Soundscape' }}</span>
            <span class="chevron-icon">▾</span>
          </button>

          <!-- Audio Dropdown -->
          <transition name="dropdown-fade">
            <div v-if="isAudioDropdownOpen" class="audio-dropdown-panel">
              <div class="dropdown-header">
                <span>Select Ambient Soundscape</span>
                <button
                  class="mute-toggle-btn"
                  :title="isMuted ? 'Unmute' : 'Mute'"
                  @click="toggleMute"
                >
                  {{ isMuted ? '🔇' : '🔊' }}
                </button>
              </div>
              <div class="dropdown-track-list">
                <button
                  v-for="track in tracks"
                  :key="track.id"
                  class="dropdown-track-item"
                  :class="{ 'is-selected': currentTrack?.id === track.id }"
                  @click="selectTrack(track); isAudioDropdownOpen = false"
                >
                  <span class="item-icon">{{ track.icon }}</span>
                  <div class="item-info">
                    <span class="item-title">{{ track.name }}</span>
                    <span class="item-desc">{{ track.description }}</span>
                  </div>
                </button>
              </div>
            </div>
          </transition>
        </div>

        <!-- Mute Quick Toggle -->
        <button
          class="icon-action-btn"
          :title="isPlaying ? 'Pause Soundscape' : 'Play Soundscape'"
          @click="togglePlay"
        >
          <span>{{ isPlaying ? (isMuted ? '🔇' : '🔊') : '▶️' }}</span>
        </button>

        <!-- Status Dot -->
        <div class="status-indicator-pill">
          <span class="pulse-dot" />
          <span class="status-label">3D Engine Ready</span>
        </div>
      </div>
    </header>

    <!-- Main Center Hero Portal Stage -->
    <main class="portal-main">
      <div class="hero-content">
        <!-- Eyebrow Pill -->
        <div class="eyebrow-pill">
          <span class="sparkle">✦</span>
          <span>IRE · IMMERSIVE READING EXPERIENCE</span>
          <span class="sparkle">✦</span>
        </div>

        <!-- Animated Kinetic Headline -->
        <h1 class="portal-headline">
          <span class="headline-primary">Immersive Learning Experience</span>
          <span class="headline-rotating-wrapper">
            <span
              class="headline-rotating"
              :class="{ 'word-out': isWordFlipping, 'word-in': !isWordFlipping }"
            >
              {{ activeWord }}
            </span>
          </span>
        </h1>

        <!-- Subtitle Description -->
        <p class="portal-subheading">
          Step into a tranquil Japanese study chamber. Rest classic volumes on a handcrafted
          Shokendai reading stand tilted at 80°, flip tactile paper pages with authentic physics,
          and explore deep architectural diagrams in daylight zen.
        </p>

        <!-- THE SINGLE HERO BUTTON -->
        <div class="cta-wrapper">
          <button
            class="single-hero-btn"
            aria-label="Enter Immersive Reading Experience"
            @click="handleEnter"
            @mouseenter="playHoverSound"
          >
            <!-- Glowing Breathing Halo -->
            <div class="btn-outer-glow" aria-hidden="true" />
            <div class="btn-shimmer-sweep" aria-hidden="true" />

            <!-- Icon -->
            <div class="btn-icon-wrapper">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>

            <!-- Button Label -->
            <span class="btn-primary-text">Enter Immersive Experience</span>

            <!-- Arrow Indicator -->
            <span class="btn-arrow-icon" aria-hidden="true">→</span>
          </button>

          <!-- Interaction Hint -->
          <div class="cta-hint">
            <kbd class="key-badge">Space</kbd> or <kbd class="key-badge">Enter</kbd> to launch chamber · Real-time 3D WebGL
          </div>
        </div>

        <!-- Chamber Feature Badges -->
        <div class="feature-strip">
          <div class="feature-tag">
            <span class="tag-icon">📐</span>
            <span>80° Shokendai Stand</span>
          </div>
          <div class="feature-divider" />
          <div class="feature-tag">
            <span class="tag-icon">📖</span>
            <span>Dynamic Page Flipping</span>
          </div>
          <div class="feature-divider" />
          <div class="feature-tag">
            <span class="tag-icon">🔍</span>
            <span>High-DPI Readability & Diagrams</span>
          </div>
          <div class="feature-divider" />
          <div class="feature-tag">
            <span class="tag-icon">🍵</span>
            <span>Daylight Zen Ambience</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Minimalist Footer -->
    <footer class="portal-footer">
      <div class="footer-copy">
        © {{ new Date().getFullYear() }} <strong>IRE (Immersive Reading Experience)</strong> · Designed for curious, focused minds.
      </div>
      <div class="footer-badges">
        <span>WebGL 2.0</span>
        <span class="dot">·</span>
        <span>High-DPI Canvas</span>
        <span class="dot">·</span>
        <span>Spatial Audio</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.ire-home-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #060813;
  color: #f8fafc;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

/* Ambient Radial Glows */
.ambient-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  pointer-events: none;
  opacity: 0.55;
  animation: glowFloat 12s ease-in-out infinite alternate;
}

.glow-top-left {
  top: -15%;
  left: 10%;
  width: 600px;
  height: 500px;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, rgba(99, 102, 241, 0) 70%);
}

.glow-center {
  top: 35%;
  left: 45%;
  transform: translate(-50%, -50%);
  width: 750px;
  height: 600px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.28) 0%, rgba(236, 72, 153, 0.12) 45%, rgba(0, 0, 0, 0) 70%);
  animation-duration: 16s;
}

.glow-bottom-right {
  bottom: -15%;
  right: 10%;
  width: 650px;
  height: 550px;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(234, 88, 12, 0) 70%);
  animation-duration: 14s;
}

@keyframes glowFloat {
  0% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.12) translateY(-25px); }
  100% { transform: scale(0.95) translateY(20px); }
}

/* Subtle Grid Dot Overlay */
.grid-overlay {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
  background-size: 36px 36px;
  pointer-events: none;
  opacity: 0.6;
}

/* Header */
.portal-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 3rem;
  backdrop-filter: blur(12px);
  background: rgba(6, 8, 19, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand-badge {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
}

.brand-titles {
  display: flex;
  flex-direction: column;
}

.brand-acronym {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.brand-full {
  font-size: 0.78rem;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

/* Audio Pill Button */
.audio-control-wrapper {
  position: relative;
}

.audio-pill-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
  padding: 0.45rem 0.9rem;
  border-radius: 9999px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.audio-pill-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
}

.audio-pill-btn.is-active {
  border-color: rgba(99, 102, 241, 0.5);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.25);
}

.chevron-icon {
  font-size: 0.7rem;
  color: #94a3b8;
}

/* Audio Dropdown */
.audio-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 290px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 0.85rem;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.5);
  z-index: 50;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.78rem;
  color: #94a3b8;
  font-weight: 600;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 0.5rem;
}

.mute-toggle-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.dropdown-track-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dropdown-track-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: transparent;
  border: none;
  padding: 0.55rem 0.65rem;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  width: 100%;
  color: #cbd5e1;
  transition: all 0.15s ease;
}

.dropdown-track-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.dropdown-track-item.is-selected {
  background: rgba(99, 102, 241, 0.2);
  color: #a5b4fc;
  border: 1px solid rgba(99, 102, 241, 0.35);
}

.item-icon {
  font-size: 1.2rem;
}

.item-info {
  display: flex;
  flex-direction: column;
}

.item-title {
  font-size: 0.84rem;
  font-weight: 600;
}

.item-desc {
  font-size: 0.72rem;
  color: #64748b;
}

/* Icon Action Button */
.icon-action-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-action-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

/* Status Pill */
.status-indicator-pill {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.76rem;
  color: #6ee7b7;
  font-weight: 600;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

/* Main Hero Stage */
.portal-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  position: relative;
  z-index: 10;
}

.hero-content {
  max-width: 920px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

/* Eyebrow */
.eyebrow-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 1.25rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-bottom: 2rem;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
}

.sparkle {
  color: #fbbf24;
}

/* Kinetic Animated Headline */
.portal-headline {
  font-size: clamp(2.6rem, 5.5vw, 4.8rem);
  font-weight: 850;
  line-height: 1.15;
  letter-spacing: -0.035em;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.headline-primary {
  background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 45%, #94a3b8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.headline-rotating-wrapper {
  display: inline-block;
  min-height: 1.3em;
  position: relative;
}

.headline-rotating {
  display: inline-block;
  background: linear-gradient(135deg, #818cf8 0%, #c084fc 45%, #f472b6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.word-out {
  opacity: 0;
  transform: translateY(-20px) scale(0.96);
}

.word-in {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Subheading */
.portal-subheading {
  font-size: clamp(1.05rem, 1.8vw, 1.3rem);
  line-height: 1.65;
  color: #94a3b8;
  max-width: 680px;
  margin-bottom: 3.2rem;
}

/* Single Hero Button */
.cta-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.1rem;
  margin-bottom: 3.5rem;
  position: relative;
}

.single-hero-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 1.1rem;
  padding: 1.35rem 3.4rem;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #d946ef 100%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 9999px;
  color: #ffffff;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: 0 12px 38px rgba(124, 58, 237, 0.45), 0 0 60px rgba(99, 102, 241, 0.25);
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.single-hero-btn:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 18px 48px rgba(124, 58, 237, 0.6), 0 0 80px rgba(217, 70, 239, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
}

.single-hero-btn:active {
  transform: translateY(1px) scale(0.99);
}

/* Outer Breathing Glow */
.btn-outer-glow {
  position: absolute;
  inset: -4px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899);
  z-index: -1;
  filter: blur(14px);
  opacity: 0.65;
  transition: opacity 0.35s ease;
  animation: glowPulse 4s ease-in-out infinite alternate;
}

@keyframes glowPulse {
  0% { opacity: 0.45; transform: scale(0.98); }
  100% { opacity: 0.85; transform: scale(1.03); }
}

/* Shimmer Sweep Animation */
.btn-shimmer-sweep {
  position: absolute;
  top: 0;
  left: -100%;
  width: 60%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.35), transparent);
  transform: skewX(-25deg);
  animation: shimmerSweep 3.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes shimmerSweep {
  0% { left: -100%; }
  35%, 100% { left: 160%; }
}

.btn-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s ease;
}

.single-hero-btn:hover .btn-icon-wrapper {
  transform: rotate(-8deg) scale(1.15);
}

.btn-primary-text {
  position: relative;
  z-index: 2;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.btn-arrow-icon {
  font-size: 1.5rem;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.single-hero-btn:hover .btn-arrow-icon {
  transform: translateX(6px);
}

/* Key Hint */
.cta-hint {
  font-size: 0.84rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.key-badge {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #cbd5e1;
  padding: 0.15rem 0.45rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-family: inherit;
  font-weight: 600;
}

/* Feature Badges Strip */
.feature-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.25rem;
  padding: 0.9rem 1.6rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(12px);
}

.feature-tag {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.84rem;
  color: #94a3b8;
  font-weight: 500;
}

.tag-icon {
  font-size: 1rem;
}

.feature-divider {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
}

/* Footer */
.portal-footer {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 3rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.82rem;
  color: #64748b;
  background: rgba(6, 8, 19, 0.5);
  backdrop-filter: blur(8px);
}

.footer-copy strong {
  color: #cbd5e1;
  font-weight: 600;
}

.footer-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #64748b;
}

.dot {
  color: rgba(255, 255, 255, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .portal-header {
    padding: 1.2rem 1.5rem;
  }
  .portal-footer {
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.2rem 1.5rem;
    text-align: center;
  }
  .single-hero-btn {
    padding: 1.15rem 2.2rem;
    font-size: 1.15rem;
  }
  .feature-strip {
    border-radius: 16px;
    gap: 0.8rem;
  }
  .feature-divider {
    display: none;
  }
}
</style>
