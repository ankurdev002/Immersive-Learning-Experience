<script setup lang="ts">
import { ref } from 'vue'
import { useAudioPlayer } from '~/composables/useAudioPlayer'

const { playHoverSound, playClickSound } = useAudioPlayer()

const topics = [
  { name: 'Laws of Reflection', score: 88, color: '#4ade80' },
  { name: 'Concave Mirrors', score: 71, color: '#fbbf24' },
  { name: 'Image Formation', score: 42, color: '#fb7185' },
]

const aiMessages = [
  {
    sender: 'student',
    text: 'why does the image flip in a concave mirror??',
  },
  {
    sender: 'ai',
    text: 'Because the rays cross! A ray from the top reflects through the focus heading downwards — they meet below the principal axis, so the top ends up at the bottom.',
  },
  {
    sender: 'student',
    text: 'ok cool! also who won the world cup??',
  },
  {
    sender: 'ai',
    isRestricted: true,
    text: "That one's outside this chapter — I only know Curved Mirrors & Lenses so we can keep our focus sharp!",
  },
]

const chatQuestionInput = ref('')
const customMessages = ref([...aiMessages])

const handleSendChat = () => {
  if (!chatQuestionInput.value.trim()) return
  playClickSound()

  const question = chatQuestionInput.value.trim()
  chatQuestionInput.value = ''

  customMessages.value.push({
    sender: 'student',
    text: question,
  })

  // Simulated AI response
  setTimeout(() => {
    playHoverSound()
    customMessages.value.push({
      sender: 'ai',
      text: `Great curious question about "${question}"! Notice how incident rays obey the law of reflection at every single curvature point.`,
    })
  }, 600)
}
</script>

<template>
  <section id="atlas" class="progress-ai-section">
    <div class="section-container">
      <!-- Part 1: Progress Tracking Card -->
      <div class="split-row">
        <div class="copy-col">
          <div class="band-indicator-group">
            <span class="dot-amber" />
            <span class="band-tag">Personalized progress, over time</span>
          </div>
          <h2 class="headline-bold">
            Know exactly what your child has learned.
          </h2>
          <p class="copy-body">
            Topic-level mastery breakdown, not just broad chapter scores. And an intelligent mentor that guides constructively to turn weak spots into strengths.
          </p>
        </div>

        <div class="card-col" @mouseenter="playHoverSound">
          <div class="progress-card">
            <div class="progress-card-header">
              <div>
                <h4 class="student-name">Aarav · Science</h4>
                <p class="date-range">Last 30 days activity</p>
              </div>
              <span class="growth-chip">↑ 12% this week</span>
            </div>

            <!-- Topic Progress Bars -->
            <div class="topics-list">
              <div
                v-for="topic in topics"
                :key="topic.name"
                class="topic-row"
              >
                <div class="topic-meta">
                  <span class="topic-label">{{ topic.name }}</span>
                  <span class="topic-score" :style="{ color: topic.color }">
                    {{ topic.score }}%
                  </span>
                </div>
                <div class="progress-track">
                  <div
                    class="progress-fill"
                    :style="{
                      width: `${topic.score}%`,
                      background: `linear-gradient(90deg, ${topic.color}88, ${topic.color})`,
                      boxShadow: `0 0 10px ${topic.color}66`,
                    }"
                  />
                </div>
              </div>
            </div>

            <!-- AI Coach Tip Box -->
            <div class="coach-tip-box">
              <span class="flame-icon">🔥</span>
              <p class="coach-tip-text">
                <strong>Working hard on Image Formation.</strong> Getting these right, just taking a moment longer than usual — worth reviewing the ray diagram together.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Part 2: AI Study Mate Interactive Chat Preview -->
      <div id="ai" class="ai-study-banner">
        <div class="ai-info-col">
          <div class="ai-badge-row">
            <span class="ai-pulse-orb">AI</span>
            <span class="ai-badge-label">AI Study Mate</span>
          </div>

          <h2 class="ai-title">
            Study Mate, an AI tutor that has read the chapter.
          </h2>
          <p class="ai-desc">
            Your child can ask anything about what's in front of them, at any hour. It explains the concept step-by-step rather than handing over answers — and it strictly declines off-topic prompts.
          </p>

          <div class="ai-pills-row">
            <span class="safety-pill">✓ Only uses the chapter</span>
            <span class="safety-pill">✓ Explains, never just gives answers</span>
            <span class="safety-pill">✓ Child-safe &amp; verified</span>
          </div>
        </div>

        <!-- Chat Conversation Simulator -->
        <div class="chat-col" @mouseenter="playHoverSound">
          <div class="chat-screen">
            <div class="chat-header">
              <span class="chat-status-dot" />
              <span>Study Mate · Optics Chapter 4</span>
            </div>

            <div class="messages-flow">
              <div
                v-for="(msg, index) in customMessages"
                :key="index"
                class="chat-bubble-wrapper"
                :class="[
                  msg.sender === 'student' ? 'bubble-student' : 'bubble-ai',
                  { 'bubble-restricted': msg.isRestricted },
                ]"
              >
                <div class="bubble-content">
                  {{ msg.text }}
                </div>
              </div>
            </div>

            <!-- Interactive prompt test input -->
            <form class="chat-input-bar" @submit.prevent="handleSendChat">
              <input
                v-model="chatQuestionInput"
                type="text"
                placeholder="Ask Study Mate a question..."
                class="chat-input"
              />
              <button type="submit" class="chat-send-btn" aria-label="Send question">
                ↑
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.progress-ai-section {
  padding: 90px 24px 100px;
  background: radial-gradient(ellipse 100% 70% at 50% 50%, #110926 0%, #070314 75%);
}

.section-container {
  max-width: 1080px;
  margin: 0 auto;
}

/* Split Row */
.split-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  align-items: center;
  margin-bottom: 90px;
}

@media (min-width: 860px) {
  .split-row {
    grid-template-columns: 1fr 1.1fr;
    gap: 60px;
  }
}

.band-indicator-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.dot-amber {
  width: 5px;
  height: 18px;
  border-radius: 99px;
  background: #fbbf24;
  box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
}

.band-tag {
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.headline-bold {
  color: #ffffff;
  font-size: clamp(26px, 3.8vw, 38px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.22;
  margin: 0 0 16px;
}

.copy-body {
  color: rgba(226, 222, 245, 0.65);
  font-size: 15.5px;
  line-height: 1.65;
  margin: 0;
}

/* Progress Card */
.progress-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  padding: 26px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(16px);
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.progress-card:hover {
  transform: translateY(-3px);
  border-color: rgba(251, 191, 36, 0.35);
}

.progress-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.student-name {
  margin: 0;
  font-size: 17px;
  font-weight: 800;
  color: #ffffff;
}

.date-range {
  margin: 3px 0 0;
  font-size: 12px;
  color: rgba(226, 222, 245, 0.45);
}

.growth-chip {
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #4ade80;
  font-size: 12px;
  font-weight: 800;
  border-radius: 99px;
  padding: 4px 12px;
}

.topics-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 22px;
}

.topic-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13.5px;
}

.topic-label {
  color: rgba(232, 228, 250, 0.88);
  font-weight: 600;
}

.topic-score {
  font-weight: 800;
}

.progress-track {
  height: 7px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.coach-tip-box {
  background: rgba(251, 191, 36, 0.09);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.flame-icon {
  font-size: 16px;
}

.coach-tip-text {
  margin: 0;
  color: rgba(255, 244, 222, 0.85);
  font-size: 12.5px;
  line-height: 1.55;
}

.coach-tip-text strong {
  color: #fde68a;
}

/* AI Study Banner */
.ai-study-banner {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(103, 232, 249, 0.06));
  border: 1px solid rgba(168, 85, 247, 0.35);
  border-radius: 26px;
  padding: clamp(24px, 4vw, 40px);
  display: grid;
  grid-template-columns: 1fr;
  gap: 36px;
  align-items: center;
  box-shadow: 0 20px 60px rgba(88, 40, 180, 0.18);
}

@media (min-width: 860px) {
  .ai-study-banner {
    grid-template-columns: 1fr 1fr;
    gap: 50px;
  }
}

.ai-badge-row {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 14px;
}

.ai-pulse-orb {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #67e8f9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 900;
  color: #160c2b;
}

.ai-badge-label {
  color: #c4b5fd;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.ai-title {
  color: #ffffff;
  font-size: clamp(24px, 3.2vw, 34px);
  font-weight: 900;
  letter-spacing: -0.025em;
  line-height: 1.22;
  margin: 0 0 14px;
}

.ai-desc {
  color: rgba(226, 222, 245, 0.68);
  font-size: 15px;
  line-height: 1.65;
  margin: 0 0 22px;
}

.ai-pills-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.safety-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(74, 222, 128, 0.1);
  border: 1px solid rgba(74, 222, 128, 0.3);
  border-radius: 99px;
  padding: 5px 12px;
  color: #4ade80;
  font-size: 12.5px;
  font-weight: 700;
  width: fit-content;
}

/* Chat Screen */
.chat-screen {
  background: rgba(8, 4, 20, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  backdrop-filter: blur(14px);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(226, 222, 245, 0.55);
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
}

.messages-flow {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 270px;
  overflow-y: auto;
  padding-right: 4px;
}

.chat-bubble-wrapper {
  display: flex;
}

.bubble-student {
  justify-content: flex-end;
}

.bubble-student .bubble-content {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: #ffffff;
  border-radius: 14px 14px 4px 14px;
  max-width: 80%;
  font-size: 12.5px;
  padding: 8px 12px;
  font-weight: 500;
}

.bubble-ai {
  justify-content: flex-start;
}

.bubble-ai .bubble-content {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(232, 228, 250, 0.9);
  border-radius: 14px 14px 14px 4px;
  max-width: 88%;
  font-size: 12.5px;
  line-height: 1.5;
  padding: 8px 12px;
}

.bubble-restricted .bubble-content {
  background: rgba(251, 191, 36, 0.1);
  border-color: rgba(251, 191, 36, 0.4);
  color: #fde68a;
}

.chat-input-bar {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 99px;
  padding: 4px;
}

.chat-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 6px 12px;
  color: #ffffff;
  font-size: 12.5px;
  font-family: inherit;
}

.chat-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.chat-send-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #a855f7;
  border: none;
  color: #ffffff;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.chat-send-btn:hover {
  transform: scale(1.08);
}
</style>
