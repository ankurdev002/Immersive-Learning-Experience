<script setup lang="ts">
import { computed } from 'vue'
import type { GalleryExhibitInfo } from '~/services/room/GalleryCatalog'

/**
 * One page of an exhibit's history book. `kind` is 'cover', 'image', 'title', 's1'..'s3' (the
 * catalogue's sections) or 'colophon'.
 */
const props = defineProps<{ kind: string; exhibit: GalleryExhibitInfo; folio?: number }>()

const section = computed(() => {
  const m = /^s(\d)$/.exec(props.kind)
  return m ? props.exhibit.sections[Number(m[1])] : undefined
})
const isPhoto = computed(() => props.exhibit.medium.toLowerCase().includes('photograph'))
</script>

<template>
  <div class="gb-page" :class="`gb-${kind}`">
    <!-- Closed book: cloth cover with a title slip -->
    <template v-if="kind === 'cover'">
      <div class="gb-cover-slip">
        <span class="gb-cover-jp">{{ exhibit.titleJp }}</span>
        <span class="gb-cover-en">{{ exhibit.title }}</span>
      </div>
      <span class="gb-cover-mark">日本美術</span>
    </template>

    <!-- The artwork (or a calligraphy plate for the armour and swords) -->
    <template v-else-if="kind === 'image'">
      <div class="gb-plate" :class="{ 'gb-plate-photo': isPhoto }">
        <img v-if="exhibit.image" :src="exhibit.image" :alt="exhibit.title" draggable="false" />
        <span v-else class="gb-glyph">{{ exhibit.glyph }}</span>
      </div>
      <p class="gb-caption">
        <span class="gb-caption-jp">{{ exhibit.titleJp }}</span>
        {{ exhibit.artist }}
      </p>
    </template>

    <template v-else-if="kind === 'title'">
      <span class="gb-kicker">Gallery of Japanese Art</span>
      <h2 class="gb-title">{{ exhibit.title }}</h2>
      <span class="gb-title-jp">{{ exhibit.titleJp }}</span>
      <dl class="gb-meta">
        <dt>Artist</dt><dd>{{ exhibit.artist }}</dd>
        <dt>Date</dt><dd>{{ exhibit.date }}</dd>
        <dt>Medium</dt><dd>{{ exhibit.medium }}</dd>
        <dt>Collection</dt><dd>{{ exhibit.collection }}</dd>
      </dl>
      <h3 class="gb-heading">{{ exhibit.sections[0]?.heading }}</h3>
      <p class="gb-body">{{ exhibit.sections[0]?.body }}</p>
    </template>

    <template v-else-if="section">
      <h3 class="gb-heading gb-heading-lg">{{ section.heading }}</h3>
      <p class="gb-body gb-body-lg">{{ section.body }}</p>
      <span class="gb-seal" aria-hidden="true">印</span>
    </template>

    <template v-else-if="kind === 'colophon'">
      <h3 class="gb-heading">About this book</h3>
      <p class="gb-body">
        A short guide to <em>{{ exhibit.title }}</em>, written for the visitors of this gallery.
      </p>
      <p v-if="exhibit.image" class="gb-body gb-small">
        Image: public-domain reproduction from Wikimedia Commons.
      </p>
      <p v-else class="gb-body gb-small">The piece on display is a modelled reconstruction in the historical style.</p>
      <div class="gb-colophon-mark">終</div>
      <p class="gb-small gb-center">Use ← → to turn the pages · Esc to close</p>
    </template>

    <span v-if="folio && kind !== 'cover'" class="gb-folio">{{ folio }}</span>
  </div>
</template>

<style scoped>
.gb-page {
  position: absolute;
  inset: 0;
  padding: 7% 9% 9%;
  display: flex;
  flex-direction: column;
  color: #2a231c;
  font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
  overflow: hidden;
}
.gb-cover {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.06), transparent 60%),
    repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.025) 0 2px, transparent 2px 5px),
    #2c3a3f;
  align-items: center;
  justify-content: center;
  color: #efe3c8;
}
.gb-cover-slip {
  background: #f1e6cf;
  color: #2a231c;
  padding: 1.4em 1em;
  writing-mode: vertical-rl;
  display: flex;
  gap: 0.6em;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  max-height: 70%;
}
.gb-cover-jp {
  font-size: clamp(18px, 2.4vw, 30px);
  font-weight: 700;
}
.gb-cover-en {
  font-size: clamp(10px, 1vw, 13px);
  letter-spacing: 0.06em;
}
.gb-cover-mark {
  position: absolute;
  bottom: 7%;
  font-size: clamp(12px, 1.1vw, 15px);
  letter-spacing: 0.4em;
  color: #c9a24a;
}
.gb-plate {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 4%;
  background: #efe5d1;
  box-shadow: inset 0 0 0 1px rgba(80, 60, 30, 0.15);
}
.gb-plate img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 3px 10px rgba(40, 25, 10, 0.35);
}
.gb-plate-photo img {
  border: 6px solid #fbf7ee;
}
.gb-glyph {
  font-size: clamp(90px, 13vw, 190px);
  color: #7a1f1a;
  font-weight: 700;
  line-height: 1;
}
.gb-caption {
  margin: 0.9em 0 0;
  font-size: clamp(11px, 1vw, 14px);
  color: #5a4f43;
  text-align: center;
  font-style: italic;
}
.gb-caption-jp {
  display: block;
  font-style: normal;
  font-weight: 700;
  color: #7a1f1a;
  margin-bottom: 0.2em;
}
.gb-kicker {
  font-family: system-ui, sans-serif;
  font-size: clamp(9px, 0.8vw, 11px);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #9a7b3e;
}
.gb-title {
  margin: 0.35em 0 0.1em;
  font-size: clamp(17px, 1.9vw, 27px);
  line-height: 1.15;
}
.gb-title-jp {
  font-size: clamp(13px, 1.25vw, 18px);
  color: #7a1f1a;
  font-weight: 700;
}
.gb-meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.15em 0.8em;
  margin: 0.9em 0 0.8em;
  padding: 0.6em 0;
  border-top: 1px solid rgba(90, 70, 40, 0.25);
  border-bottom: 1px solid rgba(90, 70, 40, 0.25);
  font-size: clamp(10px, 0.9vw, 12.5px);
}
.gb-meta dt {
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9a7b3e;
  font-size: 0.85em;
  padding-top: 0.12em;
}
.gb-meta dd {
  margin: 0;
}
.gb-heading {
  margin: 0.2em 0 0.35em;
  font-size: clamp(13px, 1.2vw, 17px);
  color: #7a1f1a;
}
.gb-heading-lg {
  font-size: clamp(16px, 1.6vw, 23px);
  margin-top: 0.6em;
  padding-bottom: 0.35em;
  border-bottom: 1px solid rgba(122, 31, 26, 0.25);
}
.gb-body {
  margin: 0 0 0.7em;
  font-size: clamp(11px, 1.02vw, 14.5px);
  line-height: 1.6;
}
.gb-body-lg {
  font-size: clamp(14px, 1.45vw, 21px);
  line-height: 1.75;
  margin-top: 0.4em;
}
.gb-body-lg::first-letter {
  font-size: 2.3em;
  float: left;
  line-height: 0.9;
  margin: 0.06em 0.08em 0 0;
  color: #7a1f1a;
}
.gb-seal {
  margin-top: auto;
  align-self: flex-end;
  width: 2em;
  height: 2em;
  display: grid;
  place-items: center;
  background: #b3261e;
  color: #fff4e6;
  border-radius: 3px;
  font-size: clamp(12px, 1.1vw, 16px);
  opacity: 0.85;
  transform: rotate(-4deg);
}
.gb-small {
  font-size: clamp(10px, 0.85vw, 12px);
  color: #6b6054;
}
.gb-center {
  text-align: center;
}
.gb-colophon-mark {
  margin: auto auto 0.6em;
  font-size: clamp(36px, 4vw, 60px);
  color: #7a1f1a;
  opacity: 0.8;
}
.gb-folio {
  position: absolute;
  bottom: 3.5%;
  left: 0;
  right: 0;
  text-align: center;
  font-size: clamp(9px, 0.8vw, 11px);
  color: #8a7b68;
}
</style>
