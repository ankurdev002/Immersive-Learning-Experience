<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    tag?: string
    staggerMs?: number
    active?: boolean
  }>(),
  {
    tag: 'span',
    staggerMs: 20,
    active: false,
  }
)

const characters = computed(() => props.text.split(''))
</script>

<template>
  <component
    :is="tag"
    class="animated-roll-container"
    :class="{ 'is-active': active }"
  >
    <span
      v-for="(char, index) in characters"
      :key="index"
      class="roll-char-wrapper"
      :style="{ '--char-index': index, '--stagger-delay': `${index * staggerMs}ms` }"
    >
      <span class="roll-char primary-char" aria-hidden="true">
        {{ char === ' ' ? '&nbsp;' : char }}
      </span>
      <span class="roll-char duplicate-char" aria-hidden="true">
        {{ char === ' ' ? '&nbsp;' : char }}
      </span>
    </span>
    <span class="sr-only">{{ text }}</span>
  </component>
</template>

<style scoped>
.animated-roll-container {
  display: inline-flex;
  overflow: hidden;
  position: relative;
  line-height: 1.15;
  cursor: pointer;
}

.roll-char-wrapper {
  position: relative;
  display: inline-block;
  overflow: hidden;
}

.roll-char {
  display: inline-block;
  transition: transform 0.45s cubic-bezier(0.76, 0, 0.24, 1);
  transition-delay: var(--stagger-delay, 0ms);
  will-change: transform;
}

.primary-char {
  transform: translateY(0%);
}

.duplicate-char {
  position: absolute;
  top: 0;
  left: 0;
  transform: translateY(105%);
}

/* Hover & Active triggers */
.animated-roll-container:hover .primary-char,
.animated-roll-container.is-active .primary-char {
  transform: translateY(-105%);
}

.animated-roll-container:hover .duplicate-char,
.animated-roll-container.is-active .duplicate-char {
  transform: translateY(0%);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
