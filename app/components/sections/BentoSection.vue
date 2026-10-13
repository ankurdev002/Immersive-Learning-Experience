<script setup lang="ts">
import { ref } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

const { playHoverSound, playClickSound } = useAudioPlayer()

const activeDifficulty = ref('Med')
const selectedQuizOption = ref<number | null>(null)

const difficulties = ['Easy', 'Med', 'Hard', 'Challenge']
const quizQuestions = [
  { id: 1, label: 'Virtual & Erect', correct: true },
  { id: 2, label: 'Real & Inverted', correct: false },
]

const handleSelectQuizOption = (id: number) => {
  playClickSound()
  selectedQuizOption.value = id
}
</script>

<template>
  <section id="learning" class="bento-section">
    <div class="bento-container">
      <!-- Section Header -->
      <div class="section-heading">
        <h2 class="section-title">What's inside IRE.</h2>
        <p class="section-subtitle">
          CBSE-aligned content and tools to help your child from first read to getting exam-ready — with an AI tutor at every step.
        </p>
      </div>

      <!-- Feature Banner Label -->
      <div class="feature-band">
        <span class="band-indicator" />
        <span class="band-text">5 Ways to Learn & Practice Every Chapter</span>
        <span class="band-line" />
      </div>

      <!-- The 5-way Bento Grid -->
      <div class="bento-grid">
        <!-- Tile 1: Large Mind Maps (Span 2x2 on desktop) -->
        <div class="bento-card card-large" @mouseenter="playHoverSound">
          <div class="mindmap-preview-screen">
            <svg viewBox="0 0 280 160" class="mindmap-svg" fill="none">
              <!-- Connector curved lines -->
              <path d="M140 80 C90 80 90 35 70 35" stroke="#fbbf24" stroke-width="2" opacity="0.4" />
              <path d="M140 80 C90 80 90 125 70 125" stroke="#67e8f9" stroke-width="2" opacity="0.8" />
              <path d="M140 80 C190 80 190 35 210 35" stroke="#fbbf24" stroke-width="2" opacity="0.4" />
              <path d="M140 80 C190 80 190 125 210 125" stroke="#a78bfa" stroke-width="2" opacity="0.6" />

              <!-- Branch nodes Left -->
              <g>
                <rect x="15" y="22" width="65" height="26" rx="13" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.4)" stroke-width="1.2" />
                <text x="47" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#fde68a">Reflection</text>
              </g>
              <g>
                <rect x="15" y="112" width="65" height="26" rx="13" fill="rgba(103,232,249,0.14)" stroke="rgba(103,232,249,0.6)" stroke-width="1.2" />
                <text x="47" y="128" text-anchor="middle" font-size="9" font-weight="700" fill="#67e8f9">Refraction</text>
              </g>

              <!-- Branch nodes Right -->
              <g>
                <rect x="200" y="22" width="65" height="26" rx="13" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.4)" stroke-width="1.2" />
                <text x="232" y="38" text-anchor="middle" font-size="9" font-weight="700" fill="#fde68a">Mirrors</text>
              </g>
              <g>
                <rect x="200" y="112" width="65" height="26" rx="13" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.6)" stroke-width="1.2" />
                <text x="232" y="128" text-anchor="middle" font-size="9" font-weight="700" fill="#c4b5fd">Lenses</text>
              </g>

              <!-- Central Core Bubble -->
              <rect x="95" y="62" width="90" height="36" rx="18" fill="url(#coreGradient)" />
              <text x="140" y="78" text-anchor="middle" font-size="9.5" font-weight="900" fill="#1b1100">Light &amp; Optics</text>
              <text x="140" y="90" text-anchor="middle" font-size="8" font-weight="700" fill="#452c00">Chapter Core</text>

              <defs>
                <linearGradient id="coreGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#fde68a" />
                  <stop offset="100%" stop-color="#f59e0b" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div class="card-caption">
            <h3 class="card-title text-cyan">Mind maps</h3>
            <p class="card-desc">The whole chapter visually mapped and connected on one screen</p>
          </div>
        </div>

        <!-- Tile 2: Chapter Notes -->
        <div class="bento-card" @mouseenter="playHoverSound">
          <div class="notes-preview-screen">
            <div class="note-header-pill" />
            <div class="note-row">
              <span class="note-bullet bullet-amber" />
              <span class="note-bar bar-wide" />
            </div>
            <div class="note-row">
              <span class="note-bullet bullet-amber" />
              <span class="note-bar bar-medium" />
            </div>
            <div class="note-row">
              <span class="note-bullet bullet-amber" />
              <span class="note-bar bar-long" />
            </div>
          </div>
          <div class="card-caption">
            <h3 class="card-title text-amber">Chapter notes</h3>
            <p class="card-desc">Key concepts, equations and definitions in bite-sized points</p>
          </div>
        </div>

        <!-- Tile 3: Quizzes with Answers -->
        <div class="bento-card" @mouseenter="playHoverSound">
          <div class="quiz-preview-screen">
            <div class="format-tags-row">
              <span class="format-pill">MCQ</span>
              <span class="format-pill">True/False</span>
              <span class="format-pill">Fill-blank</span>
              <span class="format-pill">Match</span>
            </div>
            <div class="interactive-quiz-options">
              <button
                v-for="opt in quizQuestions"
                :key="opt.id"
                class="quiz-opt-btn"
                :class="{
                  'is-correct': selectedQuizOption === opt.id && opt.correct,
                  'is-selected': selectedQuizOption === opt.id,
                }"
                @click="handleSelectQuizOption(opt.id)"
              >
                <span class="opt-check">{{ selectedQuizOption === opt.id ? '✓' : '' }}</span>
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>
          <div class="card-caption">
            <h3 class="card-title text-cyan">Quizzes with Answers</h3>
            <p class="card-desc">Practice questions with instant explanations across 5 formats</p>
          </div>
        </div>

        <!-- Tile 4: Subjective Q&A -->
        <div class="bento-card" @mouseenter="playHoverSound">
          <div class="subjective-preview-screen">
            <div class="qa-badge-bar" />
            <div class="qa-point">
              <span class="point-num">1</span>
              <span class="qa-line w-85" />
            </div>
            <div class="qa-point">
              <span class="point-num">2</span>
              <span class="qa-line w-70" />
            </div>
            <div class="qa-point">
              <span class="point-num">3</span>
              <span class="qa-line w-90" />
            </div>
          </div>
          <div class="card-caption">
            <h3 class="card-title text-purple">Subjective Q&amp;A</h3>
            <p class="card-desc">Clear breakdown of what a full-mark textbook answer contains</p>
          </div>
        </div>

        <!-- Tile 5: Practice Worksheets -->
        <div class="bento-card" @mouseenter="playHoverSound">
          <div class="worksheet-preview-screen">
            <div class="difficulty-pills-row">
              <button
                v-for="diff in difficulties"
                :key="diff"
                class="diff-btn"
                :class="[
                  `diff-${diff.toLowerCase()}`,
                  { 'is-active': activeDifficulty === diff },
                ]"
                @click="activeDifficulty = diff; playClickSound()"
              >
                {{ diff }}
              </button>
            </div>
            <div class="worksheet-status">
              <span>Filter by topic &amp; difficulty</span>
            </div>
          </div>
          <div class="card-caption">
            <h3 class="card-title text-amber">Practice worksheets</h3>
            <p class="card-desc">Printable or interactive worksheets graded from easy to challenge</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bento-section {
  padding: 80px 24px 90px;
  background: #0a0616;
  position: relative;
}

.bento-container {
  max-width: 1040px;
  margin: 0 auto;
}

.section-heading {
  text-align: center;
  margin-bottom: 50px;
}

.section-title {
  color: #ffffff;
  font-size: clamp(28px, 4.4vw, 44px);
  font-weight: 900;
  letter-spacing: -0.03em;
  margin: 0 0 12px;
}

.section-subtitle {
  color: rgba(226, 222, 245, 0.65);
  font-size: clamp(15px, 2vw, 17px);
  line-height: 1.65;
  max-width: 620px;
  margin: 0 auto;
}

/* Feature band */
.feature-band {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.band-indicator {
  width: 4px;
  height: 22px;
  border-radius: 99px;
  background: #fde68a;
  box-shadow: 0 0 14px rgba(253, 230, 138, 0.55);
}

.band-text {
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.band-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(253, 230, 138, 0.4), rgba(255, 255, 255, 0.05));
}

/* Bento Grid */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 900px) {
  .bento-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.bento-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: all 0.25s ease;
}

.bento-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-3px);
}

.card-large {
  grid-column: span 2;
  border-color: rgba(103, 232, 249, 0.28);
}

@media (min-width: 900px) {
  .card-large {
    grid-row: span 2;
  }
}

/* Previews inside tiles */
.mindmap-preview-screen,
.notes-preview-screen,
.quiz-preview-screen,
.subjective-preview-screen,
.worksheet-preview-screen {
  background: rgba(6, 4, 16, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 140px;
  overflow: hidden;
}

.mindmap-svg {
  width: 100%;
  height: auto;
  display: block;
}

/* Notes Tile */
.note-header-pill {
  width: 58%;
  height: 6px;
  border-radius: 99px;
  background: rgba(251, 191, 36, 0.55);
  margin-bottom: 12px;
}

.note-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.note-bullet {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bullet-amber {
  background: #fbbf24;
  box-shadow: 0 0 6px #fbbf24;
}

.note-bar {
  height: 5px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.15);
}

.bar-wide { width: 92%; }
.bar-medium { width: 76%; }
.bar-long { width: 84%; }

/* Quiz Tile */
.format-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 12px;
}

.format-pill {
  background: rgba(103, 232, 249, 0.12);
  border: 1px solid rgba(103, 232, 249, 0.35);
  color: #67e8f9;
  border-radius: 99px;
  padding: 2px 7px;
  font-size: 9px;
  font-weight: 800;
}

.interactive-quiz-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.quiz-opt-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 6px 10px;
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.quiz-opt-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.quiz-opt-btn.is-correct {
  background: rgba(74, 222, 128, 0.15);
  border-color: rgba(74, 222, 128, 0.5);
  color: #4ade80;
}

.opt-check {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 900;
}

.quiz-opt-btn.is-correct .opt-check {
  background: #4ade80;
  color: #052e14;
  border: none;
}

/* Subjective Tile */
.qa-badge-bar {
  width: 65%;
  height: 6px;
  border-radius: 99px;
  background: rgba(167, 139, 250, 0.5);
  margin-bottom: 12px;
}

.qa-point {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.point-num {
  font-size: 10px;
  font-weight: 900;
  color: #a78bfa;
}

.qa-line {
  height: 5px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.14);
}

.w-85 { width: 85%; }
.w-70 { width: 70%; }
.w-90 { width: 90%; }

/* Worksheets Tile */
.difficulty-pills-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-bottom: 10px;
}

.diff-btn {
  background: transparent;
  border-radius: 99px;
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.15s ease;
}

.diff-easy {
  border: 1px solid rgba(110, 231, 183, 0.4);
  color: #6ee7b7;
}
.diff-easy.is-active { background: rgba(110, 231, 183, 0.25); }

.diff-med {
  border: 1px solid rgba(252, 211, 77, 0.4);
  color: #fcd34d;
}
.diff-med.is-active { background: rgba(252, 211, 77, 0.25); }

.diff-hard {
  border: 1px solid rgba(253, 164, 175, 0.4);
  color: #fda4af;
}
.diff-hard.is-active { background: rgba(253, 164, 175, 0.25); }

.diff-challenge {
  border: 1px solid rgba(196, 181, 253, 0.4);
  color: #c4b5fd;
}
.diff-challenge.is-active { background: rgba(196, 181, 253, 0.25); }

.worksheet-status {
  font-size: 11px;
  color: rgba(226, 222, 245, 0.5);
}

/* Captions */
.card-caption {
  margin-top: 4px;
}

.card-title {
  font-size: 14.5px;
  font-weight: 800;
  margin: 0 0 4px;
}

.text-cyan { color: #67e8f9; }
.text-amber { color: #fbbf24; }
.text-purple { color: #a78bfa; }

.card-desc {
  font-size: 12.5px;
  color: rgba(226, 222, 245, 0.6);
  line-height: 1.45;
  margin: 0;
}
</style>
