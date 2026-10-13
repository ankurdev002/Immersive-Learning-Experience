<script setup lang="ts">
import { ref } from 'vue'
import AnimatedTextRoll from '~/components/ui/AnimatedTextRoll.vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSmoothScroll } from '~/composables/useSmoothScroll'

const { currentTrack, isPlaying, togglePlay, playHoverSound, playClickSound } = useAudioPlayer()
const { scrollTo } = useSmoothScroll()

const isGiantTitleHovered = ref(false)
const emailInput = ref('')
const isSubscribed = ref(false)
const giantWord = 'IRE'.split('')

const handleTitleEnter = () => {
  isGiantTitleHovered.value = true
  playHoverSound()
}

const handleTitleLeave = () => {
  isGiantTitleHovered.value = false
}

const footerLinks = {
  learning: [
    { label: 'Chapter Notes', href: '#learning' },
    { label: 'Interactive Mind Maps', href: '#learning' },
    { label: 'Practice Worksheets', href: '#learning' },
    { label: 'Subjective Q&A', href: '#learning' },
    { label: 'AI Study Mate', href: '#ai' },
  ],
  subjects: [
    { label: 'Mathematics', href: '#subjects' },
    { label: 'Science & Physics', href: '#subjects' },
    { label: 'Social Science', href: '#subjects' },
    { label: 'English Literature', href: '#subjects' },
    { label: 'Hindi Grammar', href: '#subjects' },
  ],
  explore: [
    { label: 'Games District', href: '#games' },
    { label: 'World Atlas', href: '#atlas' },
    { label: 'Music Amphitheatre', href: '#music' },
    { label: 'Curious Creatures', href: '#creatures' },
  ],
  company: [
    { label: 'Our Philosophy', href: '#about' },
    { label: 'Child Safety First', href: '#safety' },
    { label: 'Syllabus Alignment', href: '#syllabus' },
    { label: 'Privacy & Terms', href: '#privacy' },
  ],
}

const handleSubscribe = () => {
  if (emailInput.value.trim()) {
    playClickSound()
    isSubscribed.value = true
    setTimeout(() => {
      emailInput.value = ''
    }, 2000)
  }
}

const scrollToTop = () => {
  playClickSound()
  scrollTo(0, { duration: 1.2 })
}
</script>

<template>
  <footer class="app-footer">
    <!-- Cosmic background glow -->
    <div class="footer-ambient-glow" aria-hidden="true" />

    <div class="footer-container">
      <!-- Upper Section: Newsletter & Brand Value -->
      <div class="footer-top-grid">
        <div class="footer-brand-col">
          <div class="footer-brand-badge">
            <span class="pulse-dot" />
            <span>A World for Curious Creatures</span>
          </div>
          <h3 class="footer-heading">
            Inspiring curiosity, one chapter at a time.
          </h3>
          <p class="footer-bio">
            Syllabus-aligned learning tools, interactive mind maps, and an AI study companion designed to make deep learning a joyful everyday habit.
          </p>

          <!-- Ambient soundtrack equalizer widget -->
          <div
            class="footer-soundtrack-card"
            @click="togglePlay"
            @mouseenter="playHoverSound"
          >
            <div class="soundtrack-icon">{{ currentTrack.icon }}</div>
            <div class="soundtrack-text">
              <span class="soundtrack-caption">Background Atmosphere</span>
              <span class="soundtrack-title">{{ currentTrack.name }}</span>
            </div>
            <div class="equalizer-bars" :class="{ 'is-playing': isPlaying }">
              <span class="bar bar-1" />
              <span class="bar bar-2" />
              <span class="bar bar-3" />
              <span class="bar bar-4" />
            </div>
          </div>
        </div>

        <!-- Newsletter Subscription Box -->
        <div class="footer-newsletter-card">
          <h4 class="newsletter-title">Stay in the orbit</h4>
          <p class="newsletter-sub">
            Receive free weekend study mind maps, parent learning tips, and early access to new chapters.
          </p>
          <form class="newsletter-form" @submit.prevent="handleSubscribe">
            <div class="input-wrapper">
              <input
                v-model="emailInput"
                type="email"
                placeholder="Enter your email"
                required
                class="newsletter-input"
              />
              <button
                type="submit"
                class="newsletter-submit-btn"
                @mouseenter="playHoverSound"
              >
                <AnimatedTextRoll
                  :text="isSubscribed ? 'Subscribed!' : 'Subscribe →'"
                  :stagger-ms="18"
                />
              </button>
            </div>
            <span v-if="isSubscribed" class="newsletter-success">
              ✨ Welcome aboard curious explorer!
            </span>
          </form>
        </div>
      </div>

      <!-- Middle: Category Links with Animated Text Roll -->
      <div class="footer-nav-grid">
        <div class="footer-col">
          <h5 class="col-title">Learning Tools</h5>
          <ul class="col-links">
            <li v-for="item in footerLinks.learning" :key="item.label">
              <a
                :href="item.href"
                class="animated-footer-link"
                @mouseenter="playHoverSound"
                @click.prevent="scrollTo(item.href, { offset: -60 })"
              >
                <AnimatedTextRoll :text="item.label" :stagger-ms="15" />
              </a>
            </li>
          </ul>
        </div>

        <div class="footer-col">
          <h5 class="col-title">Subjects</h5>
          <ul class="col-links">
            <li v-for="item in footerLinks.subjects" :key="item.label">
              <a
                :href="item.href"
                class="animated-footer-link"
                @mouseenter="playHoverSound"
                @click.prevent="scrollTo(item.href, { offset: -60 })"
              >
                <AnimatedTextRoll :text="item.label" :stagger-ms="15" />
              </a>
            </li>
          </ul>
        </div>

        <div class="footer-col">
          <h5 class="col-title">Districts</h5>
          <ul class="col-links">
            <li v-for="item in footerLinks.explore" :key="item.label">
              <a
                :href="item.href"
                class="animated-footer-link"
                @mouseenter="playHoverSound"
                @click.prevent="scrollTo(item.href, { offset: -60 })"
              >
                <AnimatedTextRoll :text="item.label" :stagger-ms="15" />
              </a>
            </li>
          </ul>
        </div>

        <div class="footer-col">
          <h5 class="col-title">Values & Trust</h5>
          <ul class="col-links">
            <li v-for="item in footerLinks.company" :key="item.label">
              <a
                :href="item.href"
                class="animated-footer-link"
                @mouseenter="playHoverSound"
                @click.prevent="scrollTo(item.href, { offset: -60 })"
              >
                <AnimatedTextRoll :text="item.label" :stagger-ms="15" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Giant Interactive Kinetic Animated Statement Banner -->
      <div
        class="giant-title-banner"
        @mouseenter="handleTitleEnter"
        @mouseleave="handleTitleLeave"
      >
        <div
          class="giant-letters-row"
          :class="{ 'is-hovered': isGiantTitleHovered }"
          aria-label="IRE"
        >
          <span
            v-for="(char, index) in giantWord"
            :key="index"
            class="giant-char-wrapper"
            :style="{
              '--char-idx': index,
              '--stagger-delay': `${index * 40}ms`,
            }"
          >
            <!-- Primary letter: visible initially, rolls up on hover -->
            <span class="giant-char primary-char" aria-hidden="true">
              {{ char }}
            </span>
            <!-- Duplicate letter: rolls up from bottom on hover in glowing violet -->
            <span class="giant-char duplicate-char" aria-hidden="true">
              {{ char }}
            </span>
          </span>
        </div>
        <p class="giant-caption">
          Hover over the title to trigger the kinetic cascade
        </p>
      </div>

      <!-- Bottom Bar -->
      <div class="footer-bottom-bar">
        <div class="copyright-info">
          © {{ new Date().getFullYear() }} IRE (Immersive Reading Experience). Built for curious minds everywhere.
        </div>

        <div class="bottom-actions">
          <span class="status-indicator">
            <span class="status-dot" />
            <span>Systems Online</span>
          </span>

          <button
            class="back-to-top-btn"
            aria-label="Scroll back to top"
            @click="scrollToTop"
            @mouseenter="playHoverSound"
          >
            <span>Back to top</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  position: relative;
  background: radial-gradient(ellipse 120% 80% at 50% 100%, #150933 0%, #0a0518 55%, #05020c 100%);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 90px 24px 40px;
  overflow: hidden;
  color: var(--text-primary);
}

.footer-ambient-glow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  height: 380px;
  background: radial-gradient(ellipse at 50% 100%, rgba(168, 85, 247, 0.16) 0%, rgba(99, 102, 241, 0.06) 45%, transparent 70%);
  pointer-events: none;
}

.footer-container {
  max-width: 1280px;
  margin: 0 auto;
  position: relative;
  z-index: 2;
}

/* Upper Section */
.footer-top-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  margin-bottom: 70px;
}

@media (min-width: 960px) {
  .footer-top-grid {
    grid-template-columns: 1.3fr 1fr;
    gap: 80px;
    align-items: start;
  }
}

.footer-brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.28);
  border-radius: 99px;
  padding: 4px 12px;
  font-size: 11.5px;
  font-weight: 700;
  color: #c4b5fd;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 18px;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a855f7;
  box-shadow: 0 0 10px #a855f7;
}

.footer-heading {
  font-size: clamp(26px, 3.2vw, 38px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.2;
  margin: 0 0 16px;
  background: linear-gradient(180deg, #ffffff 30%, #e0d5fe 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.footer-bio {
  color: rgba(226, 222, 245, 0.65);
  font-size: 15px;
  line-height: 1.65;
  max-width: 540px;
  margin: 0 0 24px;
}

/* Soundtrack card */
.footer-soundtrack-card {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.footer-soundtrack-card:hover {
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.35);
  transform: translateY(-2px);
}

.soundtrack-icon {
  font-size: 20px;
}

.soundtrack-text {
  display: flex;
  flex-direction: column;
}

.soundtrack-caption {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226, 222, 245, 0.5);
}

.soundtrack-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #ffffff;
}

.equalizer-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 18px;
  margin-left: 8px;
}

.bar {
  width: 3px;
  border-radius: 99px;
  background: #a855f7;
  height: 4px;
  transition: height 0.2s ease;
}

.equalizer-bars.is-playing .bar-1 {
  animation: eqBounce 0.8s ease-in-out infinite alternate;
}
.equalizer-bars.is-playing .bar-2 {
  animation: eqBounce 1.1s ease-in-out 0.2s infinite alternate;
}
.equalizer-bars.is-playing .bar-3 {
  animation: eqBounce 0.9s ease-in-out 0.4s infinite alternate;
}
.equalizer-bars.is-playing .bar-4 {
  animation: eqBounce 1.2s ease-in-out 0.1s infinite alternate;
}

@keyframes eqBounce {
  0% { height: 4px; }
  100% { height: 18px; }
}

/* Newsletter Box */
.footer-newsletter-card {
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 28px;
  backdrop-filter: blur(14px);
}

.newsletter-title {
  font-size: 19px;
  font-weight: 800;
  margin: 0 0 8px;
}

.newsletter-sub {
  color: rgba(226, 222, 245, 0.6);
  font-size: 14px;
  line-height: 1.55;
  margin: 0 0 20px;
}

.newsletter-form {
  position: relative;
}

.input-wrapper {
  display: flex;
  background: rgba(10, 6, 25, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 99px;
  padding: 5px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input-wrapper:focus-within {
  border-color: #a855f7;
  box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
}

.newsletter-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 18px;
  color: #ffffff;
  font-size: 14px;
  font-family: inherit;
}

.newsletter-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.newsletter-submit-btn {
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  border: none;
  border-radius: 99px;
  padding: 9px 18px;
  color: #ffffff;
  font-weight: 700;
  font-size: 13.5px;
  cursor: pointer;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.newsletter-submit-btn:hover {
  opacity: 0.95;
  transform: scale(1.02);
}

.newsletter-success {
  display: block;
  font-size: 12.5px;
  color: #4ade80;
  margin-top: 10px;
}

/* Nav Grid */
.footer-nav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 36px 24px;
  padding: 48px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

@media (min-width: 768px) {
  .footer-nav-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 32px;
  }
}

.col-title {
  font-size: 12.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(226, 222, 245, 0.5);
  margin: 0 0 18px;
}

.col-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.animated-footer-link {
  color: rgba(255, 255, 255, 0.78);
  font-size: 14.5px;
  font-weight: 500;
  text-decoration: none;
  display: inline-block;
  transition: color 0.2s ease;
}

.animated-footer-link:hover {
  color: #c4b5fd;
}

/* Giant Statement Title Banner */
.giant-title-banner {
  padding: 65px 0 35px;
  text-align: center;
  user-select: none;
  cursor: pointer;
  position: relative;
}

.giant-letters-row {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: clamp(14px, 3.2vw, 42px);
  position: relative;
  transition: filter 0.35s ease, opacity 0.35s ease;
}

/* Container for each character that clips the vertical roll */
.giant-char-wrapper {
  position: relative;
  display: inline-flex;
  overflow: hidden;
  line-height: 1;
  font-size: clamp(60px, 13vw, 150px);
  font-weight: 900;
  letter-spacing: -0.02em;
  height: 1.05em;
  cursor: pointer;
}

/* Shared styling for both primary and duplicate characters */
.giant-char {
  display: inline-block;
  will-change: transform;
  transition: transform 0.52s cubic-bezier(0.76, 0, 0.24, 1);
  transition-delay: var(--stagger-delay, 0ms);
}

/* Primary character (Initial / resting state: crisp metallic silver-white) */
.giant-char.primary-char {
  background: linear-gradient(180deg, #ffffff 18%, #c8c2db 60%, #766d91 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transform: translateY(0%);
}

/* Duplicate character (Hover state: radiant cosmic purple / violet with glow) */
.giant-char.duplicate-char {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(180deg, #ffffff 0%, #c084fc 42%, #9333ea 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 35px rgba(168, 85, 247, 0.6), 0 0 70px rgba(147, 51, 234, 0.4);
  transform: translateY(105%);
}

/* Hover triggers: each character rolls up with smooth stagger */
.giant-letters-row.is-hovered .primary-char,
.giant-title-banner:hover .primary-char {
  transform: translateY(-105%);
}

.giant-letters-row.is-hovered .duplicate-char,
.giant-title-banner:hover .duplicate-char {
  transform: translateY(0%);
}

.giant-caption {
  font-size: 12px;
  color: rgba(226, 222, 245, 0.38);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 22px;
}

/* Bottom Bar */
.footer-bottom-bar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  color: rgba(226, 222, 245, 0.5);
}

@media (min-width: 640px) {
  .footer-bottom-bar {
    flex-direction: row;
  }
}

.bottom-actions {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: rgba(226, 222, 245, 0.7);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px #4ade80;
}

.back-to-top-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  padding: 6px 14px;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-to-top-btn:hover {
  background: rgba(168, 85, 247, 0.2);
  border-color: rgba(168, 85, 247, 0.4);
  transform: translateY(-2px);
}
</style>
