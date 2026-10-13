<script setup lang="ts">
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSmoothScroll } from '~/composables/useSmoothScroll'
import { useImmersiveRoom } from '~/composables/useImmersiveRoom'

const { playHoverSound, playClickSound } = useAudioPlayer()
const { scrollTo } = useSmoothScroll()
const { openImmersive } = useImmersiveRoom()

// Generate deterministic background stars
const stars = Array.from({ length: 42 }).map((_, i) => ({
  id: i,
  left: `${(i * 17) % 96 + 2}%`,
  top: `${(i * 23) % 92 + 4}%`,
  size: (i % 3 === 0 ? 2.2 : i % 2 === 0 ? 1.6 : 1.1),
  duration: `${2.4 + (i % 5) * 0.7}s`,
  delay: `${(i % 7) * 0.4}s`,
  opacity: 0.2 + (i % 5) * 0.15,
}))
</script>

<template>
  <section id="hero" class="hero-section">
    <!-- Starfield twinkle layer -->
    <div class="starfield" aria-hidden="true">
      <span
        v-for="star in stars"
        :key="star.id"
        class="star-dot"
        :style="{
          left: star.left,
          top: star.top,
          width: `${star.size}px`,
          height: `${star.size}px`,
          animationDuration: star.duration,
          animationDelay: star.delay,
          opacity: star.opacity,
        }"
      />
    </div>

    <!-- Radial golden-violet ambient light -->
    <div class="hero-glow-layer" aria-hidden="true" />

    <div class="hero-content">
      <!-- Eyebrow Badge -->
      <div class="hero-eyebrow" @mouseenter="playHoverSound">
        <span class="eyebrow-dot" />
        <span>IRE (Immersive Reading Experience)</span>
      </div>

      <!-- Main Headline -->
      <h1 class="hero-title">
        Everything your child needs <br class="title-br" />
        <span class="gradient-headline">to master a subject.</span>
      </h1>

      <!-- Subheadline -->
      <p class="hero-subtitle">
        Chapter notes, interactive mind maps, practice worksheets, exam packs, and an AI Study Mate — built on the syllabus they are already being taught.
      </p>

      <!-- Action Buttons -->
      <div class="hero-cta-group">
        <a
          href="#signup"
          class="btn-primary-glow"
          @mouseenter="playHoverSound"
          @click.prevent="playClickSound(); scrollTo('#cta', { offset: -60 })"
        >
          <span>Start free</span>
          <span class="arrow-glyph">→</span>
        </a>

        <button
          class="btn-secondary-glass"
          @mouseenter="playHoverSound"
          @click="playClickSound(); openImmersive()"
        >
          <span>Look inside a chapter</span>
          <span class="badge-tag">3D Chamber</span>
        </button>
      </div>

      <!-- Trust note -->
      <p class="hero-caption">
        First 5 chapters free · No card needed · Instant browser access
      </p>
    </div>

    <!-- Illustrated Horizon Horizon Graphic -->
    <div class="hero-scene-container" aria-hidden="true">
      <svg
        viewBox="0 0 1100 240"
        class="scene-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Floating book 1 -->
        <g class="float-item-1">
          <g transform="rotate(-12 250 82)">
            <rect x="228" y="66" width="44" height="32" rx="4" fill="#fbbf24" opacity="0.88" />
            <line x1="250" y1="66" x2="250" y2="98" stroke="#1a1000" stroke-width="2" opacity="0.6" />
          </g>
        </g>

        <!-- Floating tablet 2 -->
        <g class="float-item-2">
          <g transform="rotate(10 858 56)">
            <rect x="836" y="42" width="44" height="30" rx="4" fill="#67e8f9" opacity="0.75" />
            <line x1="858" y1="42" x2="858" y2="72" stroke="#04141a" stroke-width="2" opacity="0.5" />
          </g>
        </g>

        <!-- Floating central orb -->
        <g class="float-item-3">
          <circle cx="550" cy="50" r="14" fill="#fde68a" opacity="0.95" />
          <circle cx="550" cy="50" r="28" fill="#fbbf24" opacity="0.18" />
        </g>

        <!-- Skyline Buildings & Horizon Dome -->
        <ellipse cx="90" cy="210" rx="52" ry="60" fill="#070c18" />
        <ellipse cx="1015" cy="215" rx="48" ry="58" fill="#070c18" />
        
        <path d="M405 130 Q550 45 695 130 Z" fill="#0d1428" />
        <rect x="405" y="128" width="290" height="112" fill="#090e1f" />
        <rect x="235" y="160" width="170" height="80" fill="#070a17" />
        <rect x="695" y="160" width="170" height="80" fill="#070a17" />

        <!-- Lit Arches & Windows -->
        <path d="M448 240 L448 186 Q473 160 498 186 L498 240 Z" fill="#fbbf24" opacity="0.25" />
        <path d="M518 240 L518 178 Q550 148 582 178 L582 240 Z" fill="#fbbf24" opacity="0.32" />
        <path d="M602 240 L602 186 Q627 160 652 186 L652 240 Z" fill="#fbbf24" opacity="0.25" />

        <rect x="430" y="142" width="24" height="28" rx="3" fill="#fbbf24" opacity="0.7" />
        <rect x="470" y="142" width="24" height="28" rx="3" fill="#67e8f9" opacity="0.55" />
        <rect x="510" y="142" width="24" height="28" rx="3" fill="#fbbf24" opacity="0.7" />
        <rect x="590" y="142" width="24" height="28" rx="3" fill="#fbbf24" opacity="0.7" />
        <rect x="630" y="142" width="24" height="28" rx="3" fill="#67e8f9" opacity="0.55" />
        <rect x="670" y="142" width="24" height="28" rx="3" fill="#fbbf24" opacity="0.7" />

        <!-- Horizon Ground Glow -->
        <ellipse cx="550" cy="238" rx="460" ry="20" fill="#fbbf24" opacity="0.12" />
      </svg>
    </div>
  </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 94vh;
  padding: 130px 24px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  text-align: center;
  background: radial-gradient(ellipse 130% 90% at 50% 100%, #291708 0%, #150b28 42%, #070314 100%);
  overflow: hidden;
}

/* Starfield */
.starfield {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.star-dot {
  position: absolute;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
  animation: twinkle 3s ease-in-out infinite alternate;
}

/* Glowing layer */
.hero-glow-layer {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 120%;
  height: 45%;
  background: radial-gradient(ellipse at 50% 100%, rgba(251, 191, 36, 0.24) 0%, rgba(251, 191, 36, 0.05) 50%, transparent 75%);
  pointer-events: none;
}

.hero-content {
  position: relative;
  z-index: 2;
  max-width: 820px;
  margin: 0 auto;
}

/* Eyebrow */
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 99px;
  padding: 6px 16px;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #fde68a;
  margin-bottom: 22px;
  box-shadow: 0 0 20px rgba(251, 191, 36, 0.15);
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 8px #fbbf24;
}

/* Titles */
.hero-title {
  margin: 0;
  font-size: clamp(34px, 5.8vw, 64px);
  font-weight: 900;
  letter-spacing: -0.035em;
  line-height: 1.1;
  color: #ffffff;
}

.gradient-headline {
  background: linear-gradient(180deg, #ffffff 40%, #fed7aa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-subtitle {
  color: rgba(255, 237, 213, 0.78);
  font-size: clamp(16px, 2.2vw, 19.5px);
  line-height: 1.6;
  font-weight: 500;
  max-width: 640px;
  margin: 22px auto 0;
}

/* Buttons */
.hero-cta-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 32px;
  flex-wrap: wrap;
}

.btn-primary-glow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #241400;
  font-size: 16px;
  font-weight: 900;
  padding: 15px 34px;
  border-radius: 99px;
  text-decoration: none;
  box-shadow: 0 8px 30px rgba(251, 191, 36, 0.42);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-primary-glow:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(251, 191, 36, 0.58);
  background: linear-gradient(135deg, #fcd34d, #fbbf24);
}

.arrow-glyph {
  transition: transform 0.2s ease;
}

.btn-primary-glow:hover .arrow-glyph {
  transform: translateX(3px);
}

.btn-secondary-glass {
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  padding: 15px 30px;
  border-radius: 99px;
  text-decoration: none;
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
}

.badge-tag {
  font-size: 10.5px;
  font-weight: 800;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.35);
  border-radius: 99px;
  padding: 2px 8px;
  margin-left: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.btn-secondary-glass:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: rgba(251, 191, 36, 0.4);
  transform: translateY(-2px);
}

.hero-caption {
  color: rgba(255, 237, 213, 0.45);
  font-size: 13.5px;
  font-weight: 600;
  margin: 20px 0 0;
}

/* Scene */
.hero-scene-container {
  width: 100%;
  max-width: 1100px;
  margin-top: auto;
  position: relative;
  z-index: 1;
}

.scene-svg {
  width: 100%;
  height: auto;
  display: block;
}

.float-item-1 {
  animation: floatGentle 6s ease-in-out infinite;
}
.float-item-2 {
  animation: floatGentle 7.5s ease-in-out 0.8s infinite;
}
.float-item-3 {
  animation: floatGentle 6.5s ease-in-out 1.5s infinite;
}

@media (max-width: 580px) {
  .title-br {
    display: none;
  }
  .btn-primary-glow,
  .btn-secondary-glass {
    width: 100%;
    justify-content: center;
  }
}
</style>
