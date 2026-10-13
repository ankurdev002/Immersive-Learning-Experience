<script setup lang="ts">
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSmoothScroll } from '~/composables/useSmoothScroll'

const { playHoverSound, playClickSound } = useAudioPlayer()
const { scrollTo } = useSmoothScroll()
</script>

<template>
  <section id="cta" class="cta-banner-section">
    <div class="banner-container">
      <div class="banner-inner">
        <h2 class="banner-title">
          Start with five free chapters.
        </h2>
        <p class="banner-subtitle">
          No credit card required. Runs right in your browser on phone, tablet or desktop.
        </p>

        <div class="banner-btn-group">
          <a
            href="#signup"
            class="banner-primary-btn"
            @mouseenter="playHoverSound"
            @click.prevent="playClickSound"
          >
            <span>Start free now</span>
            <span class="btn-arrow">→</span>
          </a>
        </div>

        <div class="districts-divider">
          <p class="districts-heading">
            IRE is one part of IRE — a world of learning and play for children.
          </p>
          <div class="district-pills">
            <a
              href="#games"
              class="district-pill"
              @mouseenter="playHoverSound"
              @click.prevent="scrollTo('#hero', { offset: -70 })"
            >
              🎮 Games District
            </a>
            <span class="district-pill pill-upcoming" @mouseenter="playHoverSound">
              🎵 Music Amphitheatre <span class="badge-mini">Soon</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cta-banner-section {
  position: relative;
  padding: 90px 24px 80px;
  background: radial-gradient(ellipse 100% 70% at 50% 120%, #201047 0%, #0a0616 65%);
  overflow: hidden;
}

.banner-container {
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 2;
}

.banner-title {
  color: #ffffff;
  font-size: clamp(30px, 4.8vw, 48px);
  font-weight: 900;
  letter-spacing: -0.03em;
  margin: 0 0 14px;
}

.banner-subtitle {
  color: rgba(226, 222, 245, 0.65);
  font-size: clamp(15px, 2vw, 18px);
  line-height: 1.6;
  max-width: 480px;
  margin: 0 auto 30px;
}

.banner-btn-group {
  display: flex;
  justify-content: center;
  margin-bottom: 50px;
}

.banner-primary-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #241400;
  font-size: 17px;
  font-weight: 900;
  padding: 16px 42px;
  border-radius: 99px;
  text-decoration: none;
  box-shadow: 0 10px 40px rgba(251, 191, 36, 0.42);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.banner-primary-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 45px rgba(251, 191, 36, 0.6);
  background: linear-gradient(135deg, #fcd34d, #fbbf24);
}

.btn-arrow {
  transition: transform 0.2s ease;
}

.banner-primary-btn:hover .btn-arrow {
  transform: translateX(4px);
}

.districts-divider {
  padding-top: 36px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.districts-heading {
  color: rgba(226, 222, 245, 0.6);
  font-size: 14.5px;
  line-height: 1.6;
  margin: 0 0 18px;
}

.district-pills {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.district-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 99px;
  padding: 9px 20px;
  color: rgba(240, 238, 252, 0.88);
  font-size: 13.5px;
  font-weight: 700;
  text-decoration: none;
  transition: all 0.2s ease;
}

.district-pill:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(168, 85, 247, 0.4);
  color: #ffffff;
  transform: translateY(-1px);
}

.pill-upcoming {
  cursor: default;
}

.badge-mini {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(226, 222, 245, 0.5);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  padding: 2px 6px;
}
</style>
