<script setup lang="ts">
import { useImmersiveRoom } from '~/composables/useImmersiveRoom'
import JapaneseStudyRoom from '~/components/immersive/JapaneseStudyRoom.vue'
import IreHomePortal from '~/components/home/IreHomePortal.vue'

const { isImmersiveOpen, closeImmersive } = useImmersiveRoom()
</script>

<template>
  <div class="site-root">
    <NuxtRouteAnnouncer />
    
    <!-- Redesigned Home Page: Single Button & Kinetic Typography -->
    <IreHomePortal />

    <!-- Fullscreen 3D Japanese Study Chamber -->
    <client-only>
      <transition name="chamber-fade">
        <JapaneseStudyRoom
          v-if="isImmersiveOpen"
          @exit="closeImmersive"
        />
      </transition>
    </client-only>
  </div>
</template>

<style scoped>
.site-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary, #060813);
  color: var(--text-primary, #f8fafc);
}

/* Chamber Fade Transition */
.chamber-fade-enter-active,
.chamber-fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.chamber-fade-enter-from,
.chamber-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}
</style>
