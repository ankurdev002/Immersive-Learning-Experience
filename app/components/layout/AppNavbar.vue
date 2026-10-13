<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'
import { useSmoothScroll } from '~/composables/useSmoothScroll'
import { useImmersiveRoom } from '~/composables/useImmersiveRoom'

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

const { scrollTo } = useSmoothScroll()
const { openImmersive } = useImmersiveRoom()

const isMenuOpen = ref(false)
const isAudioDropdownOpen = ref(false)
const isScrolled = ref(false)

const navLinks = [
  { label: '3D Study Room', href: '#study-room', badge: '3D', isImmersive: true },
  { label: 'Learning', href: '#learning', badge: null, isImmersive: false },
  { label: 'Games', href: '#games', badge: null, isImmersive: false },
  { label: 'Atlas', href: '#atlas', badge: null, isImmersive: false },
  { label: 'Music', href: '#music', badge: 'Soon', isImmersive: false },
]

const handleScroll = () => {
  if (typeof window !== 'undefined') {
    isScrolled.value = window.scrollY > 20
  }
}

const handleNavClick = (link: typeof navLinks[0] | string) => {
  playClickSound()
  isMenuOpen.value = false
  if (typeof link === 'object' && link.isImmersive) {
    openImmersive()
    return
  }
  const href = typeof link === 'string' ? link : link.href
  if (href.startsWith('#')) {
    scrollTo(href, { offset: -70 })
  }
}

const toggleAudioMenu = () => {
  playClickSound()
  isAudioDropdownOpen.value = !isAudioDropdownOpen.value
}

const handleTrackSelect = (track: typeof tracks[0]) => {
  selectTrack(track)
  isAudioDropdownOpen.value = false
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <header
    class="site-navbar"
    :class="{ 'is-scrolled': isScrolled }"
  >
    <div class="navbar-container">
      <!-- Left: Brand Logo -->
      <a
        href="#"
        class="brand-logo"
        @click.prevent="handleNavClick('#hero')"
        @mouseenter="playHoverSound"
      >
        <span class="brand-text">IRE</span>
      </a>

      <!-- Middle: Navigation Links -->
      <nav class="desktop-nav" aria-label="Main Navigation">
        <a
          v-for="link in navLinks"
          :key="link.label"
          :href="link.href"
          class="nav-item"
          @click.prevent="handleNavClick(link)"
          @mouseenter="playHoverSound"
        >
          <span class="nav-label">{{ link.label }}</span>
          <span v-if="link.badge" class="nav-badge">{{ link.badge }}</span>
        </a>
      </nav>

      <!-- Right: Sound Controller & Actions -->
      <div class="nav-actions">
        <!-- Audio Track Selector Pill -->
        <div class="audio-control-wrapper">
          <button
            class="audio-pill-btn"
            :class="{ 'is-active': isPlaying }"
            aria-label="Select soundscape theme"
            @click="toggleAudioMenu"
            @mouseenter="playHoverSound"
          >
            <span class="audio-icon">{{ currentTrack.icon }}</span>
            <span class="audio-label">{{ currentTrack.name }}</span>
            <svg
              class="chevron-icon"
              :class="{ 'is-open': isAudioDropdownOpen }"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Audio Dropdown Menu -->
          <transition name="dropdown-fade">
            <div v-if="isAudioDropdownOpen" class="audio-dropdown-panel">
              <div class="dropdown-header">
                <span>Soundscapes</span>
                <button
                  class="dropdown-playback-btn"
                  @click="togglePlay"
                >
                  {{ isPlaying ? 'Pause Ambient' : 'Play Ambient' }}
                </button>
              </div>
              <div class="track-list">
                <button
                  v-for="track in tracks"
                  :key="track.id"
                  class="track-option"
                  :class="{ 'is-selected': currentTrack.id === track.id }"
                  @click="handleTrackSelect(track)"
                  @mouseenter="playHoverSound"
                >
                  <span class="track-icon">{{ track.icon }}</span>
                  <div class="track-info">
                    <span class="track-title">{{ track.name }}</span>
                    <span class="track-desc">{{ track.description }}</span>
                  </div>
                  <span v-if="currentTrack.id === track.id" class="check-mark">✓</span>
                </button>
              </div>
            </div>
          </transition>
        </div>

        <!-- Mute/Unmute Toggle -->
        <button
          class="audio-mute-btn"
          :class="{ 'is-muted': isMuted }"
          :aria-label="isMuted ? 'Unmute sounds' : 'Mute sounds'"
          :title="isMuted ? 'Sound: Off' : 'Sound: On'"
          @click="toggleMute(); playClickSound()"
          @mouseenter="playHoverSound"
        >
          <svg
            v-if="!isMuted"
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <svg
            v-else
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <line x1="17" y1="9" x2="23" y2="15" stroke-linecap="round" />
            <line x1="23" y1="9" x2="17" y2="15" stroke-linecap="round" />
          </svg>
        </button>

        <!-- Log In Link -->
        <a
          href="#login"
          class="login-link"
          @click.prevent="handleNavClick('#cta')"
          @mouseenter="playHoverSound"
        >
          Log in
        </a>

        <!-- Sign Up CTA Button -->
        <a
          href="#signup"
          class="cta-pill-button"
          @click.prevent="handleNavClick('#cta')"
          @mouseenter="playHoverSound"
        >
          <span>Sign Up Free</span>
          <span class="arrow-icon">→</span>
        </a>

        <!-- Mobile Menu Toggle -->
        <button
          class="mobile-menu-toggle"
          :aria-expanded="isMenuOpen"
          aria-label="Toggle navigation menu"
          @click="isMenuOpen = !isMenuOpen; playClickSound()"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path v-if="!isMenuOpen" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Mobile Drawer -->
    <transition name="drawer-slide">
      <div v-if="isMenuOpen" class="mobile-drawer">
        <nav class="mobile-nav-links">
          <a
            v-for="link in navLinks"
            :key="link.label"
            :href="link.href"
            class="mobile-nav-item"
            @click.prevent="handleNavClick(link)"
          >
            <span>{{ link.label }}</span>
            <span v-if="link.badge" class="nav-badge">{{ link.badge }}</span>
          </a>
        </nav>
        <div class="mobile-cta-section">
          <a
            href="#signup"
            class="cta-pill-button w-full"
            @click.prevent="handleNavClick('#cta')"
          >
            Sign Up Free →
          </a>
        </div>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.site-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 58px;
  background: rgba(10, 6, 25, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition: background-color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}

.site-navbar.is-scrolled {
  background: rgba(8, 4, 20, 0.94);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(168, 85, 247, 0.16);
}

.navbar-container {
  max-width: 1320px;
  height: 100%;
  margin: 0 auto;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

/* Brand Logo */
.brand-logo {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}

.brand-text {
  font-size: 21px;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(180deg, #ffffff 20%, #c4b5fd 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: opacity 0.2s ease;
}

.brand-logo:hover .brand-text {
  opacity: 0.9;
}

/* Desktop Navigation */
.desktop-nav {
  display: none;
  align-items: center;
  gap: 32px;
}

@media (min-width: 860px) {
  .desktop-nav {
    display: flex;
  }
}

.nav-item {
  font-size: 14.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.76);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: color 0.2s ease, transform 0.2s ease;
}

.nav-item:hover {
  color: #ffffff;
}

.nav-badge {
  font-size: 10px;
  font-weight: 700;
  color: rgba(196, 181, 253, 0.75);
  background: rgba(196, 181, 253, 0.08);
  border: 1px solid rgba(196, 181, 253, 0.24);
  border-radius: 99px;
  padding: 1px 7px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Nav Actions */
.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Audio Control */
.audio-control-wrapper {
  position: relative;
}

.audio-pill-btn {
  display: none;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 99px;
  padding: 6px 12px;
  color: rgba(226, 222, 245, 0.88);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

@media (min-width: 640px) {
  .audio-pill-btn {
    display: inline-flex;
  }
}

.audio-pill-btn:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(168, 85, 247, 0.35);
  color: #ffffff;
}

.audio-pill-btn.is-active {
  background: rgba(168, 85, 247, 0.14);
  border-color: rgba(168, 85, 247, 0.45);
  color: #ffffff;
}

.chevron-icon {
  transition: transform 0.2s ease;
  color: rgba(255, 255, 255, 0.5);
}

.chevron-icon.is-open {
  transform: rotate(180deg);
}

/* Audio Dropdown */
.audio-dropdown-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  background: rgba(15, 9, 35, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 12px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  z-index: 1100;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(226, 222, 245, 0.55);
}

.dropdown-playback-btn {
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  color: #c4b5fd;
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.dropdown-playback-btn:hover {
  background: rgba(168, 85, 247, 0.28);
}

.track-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.track-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  width: 100%;
}

.track-option:hover {
  background: rgba(255, 255, 255, 0.06);
}

.track-option.is-selected {
  background: rgba(168, 85, 247, 0.12);
  border-color: rgba(168, 85, 247, 0.3);
}

.track-title {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.track-desc {
  display: block;
  font-size: 11px;
  color: rgba(226, 222, 245, 0.5);
}

.check-mark {
  margin-left: auto;
  color: #a855f7;
  font-weight: 800;
}

/* Mute Button */
.audio-mute-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.audio-mute-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.audio-mute-btn.is-muted {
  color: rgba(255, 255, 255, 0.35);
}

/* Log In Link */
.login-link {
  display: none;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  transition: color 0.15s ease;
}

@media (min-width: 768px) {
  .login-link {
    display: inline-block;
  }
}

.login-link:hover {
  color: #ffffff;
}

/* CTA Pill Button */
.cta-pill-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 700;
  padding: 8px 18px;
  border-radius: 99px;
  text-decoration: none;
  box-shadow: 0 4px 18px rgba(168, 85, 247, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.cta-pill-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(168, 85, 247, 0.5);
  background: linear-gradient(135deg, #b066ff, #8b5cf6);
}

.arrow-icon {
  transition: transform 0.2s ease;
}

.cta-pill-button:hover .arrow-icon {
  transform: translateX(3px);
}

/* Mobile Toggle */
.mobile-menu-toggle {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  padding: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (min-width: 860px) {
  .mobile-menu-toggle {
    display: none;
  }
}

/* Mobile Drawer */
.mobile-drawer {
  background: rgba(11, 7, 26, 0.98);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  backdrop-filter: blur(20px);
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mobile-nav-item {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.mobile-cta-section {
  padding-top: 8px;
}

.w-full {
  width: 100%;
  justify-content: center;
}

/* Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
