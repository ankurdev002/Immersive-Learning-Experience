<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { BookCatalogService, SHELF_BOOKS_CONFIG } from '~/services/BookCatalogService'
import { JapaneseRoomService, type InteractiveHoverData } from '~/services/JapaneseRoomService'
import { useImmersiveAudio } from '~/composables/useImmersiveAudio'
import type { ImmersiveBookData } from '~/types/learning-journey'

const emit = defineEmits<{
  (e: 'exit'): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let roomService: JapaneseRoomService | null = null

const {
  playRoomAmbience,
  playBookSelect,
  playBookMove,
  playBookLand,
  playBookOpen,
  playPageFlip,
  stopImmersiveAudio,
  playTargetHover,
  playLightSwitch,
  playTeaCupClink,
  playTeaDrink,
  playDoorSlide,
  playFootstep,
} = useImmersiveAudio()

const roomState = ref<'room-view' | 'book-flying' | 'on-table' | 'book-open'>('room-view')
const isLoading = ref(true)
const loadingProgress = ref(0)
let progressTimer: ReturnType<typeof setInterval> | null = null
const currentPage = ref(1)
const pageInputValue = ref<number | string>(1)
const pageInputRef = ref<HTMLInputElement | null>(null)

watch(
  currentPage,
  (val) => {
    pageInputValue.value = val
  },
  { immediate: true }
)
const selectedBookId = ref('ddia')
const selectedBook = computed(() => {
  return BookCatalogService.getBookById(selectedBookId.value)
})
const currentBookTitle = computed(() => selectedBook.value?.title || 'Study Book')
const currentBookSubject = computed(() => selectedBook.value?.subject || '')
const totalPages = computed(() => {
  return selectedBook.value?.chapters?.[0]?.pages?.length || 2
})
const readerControlsReady = ref(false)
const isLightOn = ref(true)
const isDrinkingTea = ref(false)
const selectedClass = ref(3)

// Explore Mode & Multi-Room State
const isExploreMode = ref(false)
const currentZone = ref('study-room')
const currentZoneName = ref('Study Room')
const currentRoomLight = ref(true)
const nearDoorPrompt = ref<{ show: boolean; text: string; roomId: string; isOpen: boolean }>({
  show: false,
  text: '',
  roomId: '',
  isOpen: false,
})
const isCreateRoomModalOpen = ref(false)
const newRoomName = ref('')
const newRoomSubtitle = ref('')
const newRoomIcon = ref('📚')
const newRoomTheme = ref<'library' | 'meditation' | 'gallery' | 'science'>('library')
const customRoomsList = ref<Array<{ id: string; name: string; icon: string; theme: string }>>([
  { id: 'study-room', name: 'Study Room', icon: '📖', theme: 'study' },
  { id: 'hallway', name: 'Grand Corridor', icon: '⛩️', theme: 'hallway' as any },
  { id: 'room-lib', name: 'Library Chamber', icon: '📚', theme: 'library' },
  { id: 'room-zen', name: 'Meditation Dojo', icon: '🧘', theme: 'meditation' },
])
const createdNotification = ref('')

const availableIcons = ['📚', '🧘', '🍵', '🎨', '🔭', '🌿', '🏛️', '🏮', '💾', '🧪', '🌸', '🔮']
const availableThemes: Array<{ id: 'library' | 'meditation' | 'gallery' | 'science'; label: string; desc: string }> = [
  { id: 'library', label: 'Library Chamber', desc: 'Cedar bookshelves & reading armchairs' },
  { id: 'meditation', label: 'Zen Meditation Dojo', desc: 'Tatami mats, stone lantern & bonsai' },
  { id: 'gallery', label: 'Art Gallery', desc: 'Painted landscape canvases & track lighting' },
  { id: 'science', label: 'Observatory & Lab', desc: 'Celestial globe & brass instruments' },
]

// Floating Tooltip / Interactive Hover State
const hoveredTarget = ref<'lamp' | 'cup' | 'book' | null>(null)
const hoveredBookData = ref<ImmersiveBookData | undefined>(undefined)
const tooltipX = ref(0)
const tooltipY = ref(0)

const classTabs = [
  { id: 1, label: 'Class 1' },
  { id: 2, label: 'Class 2' },
  { id: 3, label: 'Class 3 · Systems' },
  { id: 4, label: 'Class 4' },
  { id: 5, label: 'Class 5 · Architecture' },
]

const handleSelectClass = (classLevel: number) => {
  selectedClass.value = classLevel
  const books = BookCatalogService.getBooksByClass(classLevel)
  if (books.length > 0 && books[0]) {
    const bookData =
      BookCatalogService.getShelfBookById(books[0]!.id) ||
      SHELF_BOOKS_CONFIG.find((b) => b.id === books[0]!.id)
    if (bookData && roomService) {
      roomService.selectBook(bookData)
    }
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (roomState.value === 'book-open' || roomState.value === 'on-table') {
      handleReturnToShelf()
    } else {
      handleExitRoom()
    }
  } else if (e.key === 'ArrowRight' && roomState.value === 'book-open') {
    handleFlipNext()
  } else if (e.key === 'ArrowLeft' && roomState.value === 'book-open') {
    handleFlipPrev()
  } else if (e.key.toLowerCase() === 'l') {
    handleToggleLight()
  } else if (e.key.toLowerCase() === 't') {
    handleDrinkTea()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)

  // Drive smooth zen loading sequence
  let currentProg = 20
  loadingProgress.value = 20
  progressTimer = setInterval(() => {
    currentProg += Math.floor(Math.random() * 20) + 15
    if (currentProg >= 100) {
      currentProg = 100
      loadingProgress.value = 100
      if (progressTimer) clearInterval(progressTimer)
      progressTimer = null
      setTimeout(() => {
        isLoading.value = false
      }, 250)
    } else {
      loadingProgress.value = currentProg
    }
  }, 45)

  // Start subtle room tone and outdoor garden ambience upon entry
  playRoomAmbience()

  // Unlock browser audio context on first user pointer/key interaction if suspended by autoplay policy
  const unlockAudio = () => {
    playRoomAmbience()
    window.removeEventListener('pointerdown', unlockAudio)
    window.removeEventListener('keydown', unlockAudio)
  }
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
  window.addEventListener('keydown', unlockAudio, { passive: true })

  if (canvasRef.value) {
    roomService = new JapaneseRoomService(canvasRef.value, {
      onBookSelected: (data?: ImmersiveBookData) => {
        roomState.value = 'book-flying'
        readerControlsReady.value = false
        playBookSelect()
        if (data) {
          selectedBookId.value = data.id
          selectedClass.value = data.classLevel
        }
        currentPage.value = 1
      },
      onBookFlightStarted: () => {
        playBookMove()
      },
      onBookLanded: () => {
        roomState.value = 'on-table'
        readerControlsReady.value = false
        playBookLand()
      },
      onBookOpeningStarted: () => {
        playBookOpen()
      },
      onBookOpened: () => {
        roomState.value = 'book-open'
        readerControlsReady.value = true
      },
      onPageFlipStarted: (page) => {
        currentPage.value = page
        playPageFlip()
      },
      onPageFlipped: (page) => {
        currentPage.value = page
      },
      onBookClosed: () => {
        roomState.value = 'room-view'
        readerControlsReady.value = false
        currentPage.value = 1
      },
      onHoverInteractive: (data: InteractiveHoverData) => {
        hoveredTarget.value = data.target
        hoveredBookData.value = data.bookData
        isLightOn.value = data.isLightOn
        if (data.screenPos) {
          tooltipX.value = data.screenPos.x
          tooltipY.value = data.screenPos.y
        }
        if (data.target) {
          playTargetHover()
        }
      },
      onLightToggled: (lightOn: boolean) => {
        isLightOn.value = lightOn
        playLightSwitch()
      },
      onTeaDrinkingStarted: () => {
        isDrinkingTea.value = true
      },
      onTeaDrinkingSip: () => {
        playTeaDrink()
      },
      onTeaDrinkingCompleted: () => {
        isDrinkingTea.value = false
        playTeaCupClink()
      },
      onExploreModeChanged: (explore: boolean) => {
        isExploreMode.value = explore
      },
      onCurrentZoneChanged: (zone: string, zoneName: string) => {
        currentZone.value = zone
        currentZoneName.value = zoneName
        if (roomService) {
          if (zone === 'study-room') currentRoomLight.value = roomService.isLightOn
          else if (zone === 'hallway') currentRoomLight.value = roomService.isHallwayLightOn
          else {
            const cr = roomService.customRooms.get(zone)
            currentRoomLight.value = cr ? cr.isLightOn : true
          }
        }
      },
      onNearDoorPrompt: (p) => {
        nearDoorPrompt.value = p
      },
      onRoomLightToggled: (roomId: string, state: boolean) => {
        if (roomId === currentZone.value || (roomId === 'study-room' && currentZone.value === 'study-room')) {
          currentRoomLight.value = state
        }
        playLightSwitch()
      },
      onPlayFootstep: () => {
        playFootstep()
      },
      onPlayDoorSlide: () => {
        playDoorSlide()
      },
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  stopImmersiveAudio()
  if (roomService) {
    roomService.destroy()
    roomService = null
  }
})

// Control Handlers
const handleToggleLight = () => {
  if (roomService) {
    const nextState = roomService.toggleRoomLight()
    isLightOn.value = nextState
  }
}

const handleDrinkTea = () => {
  if (roomService && !isDrinkingTea.value) {
    roomService.drinkTea()
  }
}

const handleTriggerBookFlight = () => {
  if (roomService && roomState.value === 'room-view') {
    if (hoveredBookData.value) {
      roomService.selectBook(hoveredBookData.value)
    } else {
      roomService.selectAndFlyBook()
    }
  }
}

const handleBookClick = () => {
  if (roomState.value === 'room-view') {
    handleTriggerBookFlight()
  } else if (roomState.value === 'on-table') {
    handleOpenBook()
  } else if (roomState.value === 'book-open') {
    if (currentPage.value < totalPages.value) {
      handleFlipNext()
    } else {
      handleFlipPrev()
    }
  }
}

const handleOpenBook = () => {
  if (roomService && roomState.value === 'on-table') {
    readerControlsReady.value = false
    roomState.value = 'book-open'
    roomService.openBook()
  }
}

const handleFlipNext = () => {
  if (roomService && roomState.value === 'book-open') {
    if (currentPage.value < totalPages.value) {
      roomService.flipPage(currentPage.value + 1)
    }
  }
}

const handleFlipPrev = () => {
  if (roomService && roomState.value === 'book-open') {
    if (currentPage.value > 1) {
      roomService.flipPage(currentPage.value - 1)
    }
  }
}

const submitPageJump = () => {
  const valStr = String(pageInputValue.value ?? '').trim()
  if (!valStr) {
    pageInputValue.value = currentPage.value
    return
  }
  let pageNum = parseInt(valStr, 10)
  if (isNaN(pageNum)) {
    pageInputValue.value = currentPage.value
    return
  }

  // Restrict / clamp to allowed pages (less than or equal to totalPages, min 1)
  if (pageNum < 1) pageNum = 1
  if (pageNum > totalPages.value) pageNum = totalPages.value

  pageInputValue.value = pageNum
  if (pageNum !== currentPage.value && roomService && roomState.value === 'book-open') {
    roomService.flipPage(pageNum)
  }
}

const handleJumpToPage = submitPageJump

const handleReturnToShelf = () => {
  if (roomService) {
    readerControlsReady.value = false
    playBookSelect()
    roomService.returnToShelf()
  }
}

// Explore Mode & Hallway Handlers
const handleToggleExploreMode = () => {
  if (roomService) {
    if (roomState.value === 'book-open' || roomState.value === 'on-table') {
      handleReturnToShelf()
      setTimeout(() => {
        roomService?.setExploreMode(true)
      }, 500)
    } else {
      roomService.setExploreMode(!isExploreMode.value)
    }
  }
}

const handleInteractDoor = () => {
  if (roomService && nearDoorPrompt.value.roomId) {
    roomService.toggleDoor(nearDoorPrompt.value.roomId)
  }
}

const handleToggleActiveLight = () => {
  if (roomService) {
    const nextState = roomService.toggleRoomLight(currentZone.value)
    currentRoomLight.value = nextState
    if (currentZone.value === 'study-room') {
      isLightOn.value = nextState
    }
  }
}

const handleTeleportToZone = (zoneId: string) => {
  if (roomService) {
    if (!isExploreMode.value) {
      roomService.setExploreMode(true)
    }
    roomService.teleportToZone(zoneId)
  }
}

const handleOpenCreateModal = () => {
  newRoomName.value = ''
  newRoomSubtitle.value = ''
  newRoomIcon.value = '📚'
  newRoomTheme.value = 'library'
  isCreateRoomModalOpen.value = true
}

const handleConfirmCreateRoom = () => {
  const name = newRoomName.value.trim() || 'New Chamber'
  const subtitle = newRoomSubtitle.value.trim() || 'Custom Learning Space'
  if (roomService) {
    const room = roomService.createCustomRoom(
      name,
      subtitle,
      newRoomIcon.value,
      newRoomTheme.value
    )
    if (room) {
      customRoomsList.value.push({
        id: room.id,
        name: room.name,
        icon: room.icon,
        theme: room.theme,
      })
      isCreateRoomModalOpen.value = false
      createdNotification.value = `Chamber "${name}" Created in the Corridor!`
      setTimeout(() => {
        createdNotification.value = ''
      }, 4000)

      // Teleport or open door
      if (!isExploreMode.value) {
        roomService.setExploreMode(true)
      }
      roomService.teleportToZone(room.id)
    }
  }
}

// Touch joystick helper for mobile/tablets
const handleTouchMove = (dir: 'forward' | 'backward' | 'left' | 'right', active: boolean) => {
  if (roomService && isExploreMode.value) {
    roomService.keys[dir] = active
  }
}

const handleTouchSprint = () => {
  if (roomService && isExploreMode.value) {
    roomService.keys.shift = !roomService.keys.shift
    roomService.isRunning = roomService.keys.shift
  }
}

const handleExitRoom = () => {
  stopImmersiveAudio()
  emit('exit')
}
</script>

<template>
  <div class="immersive-room-wrapper" :class="{ 'is-night-mode': !isLightOn }">
    <!-- WebGL Canvas -->
    <canvas ref="canvasRef" class="webgl-canvas" />

    <!-- Zen Immersive Loading Screen -->
    <transition name="zen-loader-fade">
      <div v-if="isLoading" class="zen-loader-screen" role="status" aria-live="polite">
        <div class="zen-loader-card">
          <div class="zen-enso-container">
            <div class="zen-enso-pulse" />
            <span class="zen-enso-glyph">書</span>
          </div>
          <h2 class="zen-loader-heading">Preparing your study room...</h2>
          <p class="zen-loader-caption">Modern Japanese Chamber · Initializing Curated Library &amp; Acoustics</p>
          <div class="zen-progress-track">
            <div class="zen-progress-fill" :style="{ width: `${loadingProgress}%` }" />
          </div>
          <span class="zen-progress-counter">{{ loadingProgress }}%</span>
        </div>
      </div>
    </transition>

    <!-- Top HUD Navigation -->
    <header class="room-hud-header">
      <button
        class="exit-chamber-btn"
        aria-label="Exit study room"
        @click="handleExitRoom"
      >
        <span>← Exit Chamber</span>
      </button>

      <!-- Dynamic Current Chamber Indicator -->
      <div class="chamber-info-card" :title="`Current location: ${currentZoneName}`">
        <span class="chamber-dot" :class="{ 'is-dim': !currentRoomLight }" />
        <span class="chamber-title">{{ currentZoneName }}</span>
        <span class="chamber-badge">{{ currentRoomLight ? 'Daylight Zen' : 'Night Mode' }}</span>
      </div>

      <!-- Quick Room Feature Toggles in Header -->
      <div class="room-utility-controls">
        <!-- Explore Mode Free Walk (WASD + Shift Run) Toggle -->
        <button
          class="hud-util-btn explore-toggle-btn"
          :class="{ 'is-active': isExploreMode }"
          :title="isExploreMode ? 'Sit down at Desk / Read Book' : 'Walk around chamber with WASD + Shift Run'"
          @click="handleToggleExploreMode"
        >
          <span class="util-icon">{{ isExploreMode ? '🛋️' : '🧭' }}</span>
          <span>{{ isExploreMode ? 'Sit at Desk' : 'Explore Chamber (WASD)' }}</span>
        </button>

        <!-- Dynamic Chamber Light Switch Toggle -->
        <button
          class="hud-util-btn"
          :class="{ 'is-off': !currentRoomLight }"
          :title="currentRoomLight ? `Turn off ${currentZoneName} light` : `Turn on ${currentZoneName} light`"
          @click="handleToggleActiveLight"
        >
          <span class="util-icon">{{ currentRoomLight ? '💡' : '🌙' }}</span>
          <span>{{ currentRoomLight ? 'Light: ON' : 'Light: OFF' }}</span>
        </button>

        <!-- Create New Chamber Button (Hallway & Explore) -->
        <button
          v-if="currentZone === 'hallway' || isExploreMode"
          class="hud-util-btn create-room-btn"
          title="Create a new room in the corridor"
          @click="handleOpenCreateModal"
        >
          <span class="util-icon">✨</span>
          <span>+ Add Room</span>
        </button>

        <!-- Drink Tea Button (Available in Study Room) -->
        <button
          v-if="currentZone === 'study-room' && !isExploreMode"
          class="hud-util-btn"
          :disabled="isDrinkingTea"
          title="Sip fresh green matcha tea"
          @click="handleDrinkTea"
        >
          <span class="util-icon">🍵</span>
          <span>{{ isDrinkingTea ? 'Sipping...' : 'Drink Tea' }}</span>
        </button>
      </div>

      <!-- Class Shelf Tabs (Class 1 to 5) -->
      <div class="class-shelf-pills">
        <button
          v-for="c in classTabs"
          :key="c.id"
          class="shelf-pill"
          :class="{ 'is-active': selectedClass === c.id }"
          @click="handleSelectClass(c.id)"
        >
          {{ c.label }}
        </button>
      </div>
    </header>

    <!-- Floating 3D Interactive Tooltips Anchored to Objects -->
    <!-- 1. Lamp Hover Button -->
    <transition name="pop-fade">
      <div
        v-if="hoveredTarget === 'lamp'"
        class="floating-3d-chip lamp-chip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
        @click.stop="handleToggleLight"
      >
        <span class="chip-glow" />
        <span class="chip-icon">{{ isLightOn ? '💡' : '🌙' }}</span>
        <span class="chip-text">{{ isLightOn ? 'Click to Turn Off Light' : 'Click to Turn On Light' }}</span>
      </div>
    </transition>

    <!-- 2. Tea Cup Hover Button -->
    <transition name="pop-fade">
      <div
        v-if="hoveredTarget === 'cup'"
        class="floating-3d-chip cup-chip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
        @click.stop="handleDrinkTea"
      >
        <span class="chip-glow" />
        <span class="chip-icon">🍵</span>
        <span class="chip-text">{{ isDrinkingTea ? 'Sipping Matcha...' : 'Click to Drink Matcha Tea' }}</span>
      </div>
    </transition>

    <!-- 3. Book Hover Tag -->
    <transition name="pop-fade">
      <div
        v-if="hoveredTarget === 'book'"
        class="floating-3d-chip book-chip"
        :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
        @click.stop="handleBookClick"
      >
        <span class="chip-glow" />
        <span class="chip-icon">📘</span>
        <span class="chip-text">
          {{ roomState === 'room-view'
              ? (hoveredBookData ? `${hoveredBookData.title} · ${hoveredBookData.subject}` : 'Explore Book')
              : (roomState === 'on-table' ? 'Click to Open Book' : 'Click to Flip Page') }}
        </span>
      </div>
    </transition>

    <!-- Bottom Interactive Control Dock -->
    <div class="room-action-dock">
      <!-- 1. Room View Phase: Sleek compact floating action bar -->
      <transition name="dock-fade">
        <div v-if="roomState === 'room-view'" class="action-card action-card-compact">
          <div class="action-info">
            <span class="card-icon">📚</span>
            <div>
              <h4 class="action-heading">{{ hoveredBookData ? hoveredBookData.title : (selectedBook ? selectedBook.title : 'Study Bookshelf') }}</h4>
              <p class="action-sub">{{ hoveredBookData ? `${hoveredBookData.subject} · Class ${hoveredBookData.classLevel}` : 'Click any book on the shelf to read' }}</p>
            </div>
          </div>
          <div class="dock-btn-group">
            <button class="primary-dock-btn" @click="handleTriggerBookFlight">
              <span>Explore Book</span>
              <span class="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </transition>

      <!-- 2. On Table Phase -->
      <transition name="dock-fade">
        <div v-if="roomState === 'on-table'" class="action-card action-card-table">
          <div class="action-info">
            <span class="card-icon">📖</span>
            <div>
              <h4 class="action-heading">{{ currentBookTitle }} · Class {{ selectedClass }}</h4>
              <p class="action-sub">{{ currentBookSubject ? `${currentBookSubject} · Click book to read` : 'Click book to read' }}</p>
            </div>
          </div>
          <div class="dock-btn-group">
            <button class="primary-dock-btn" @click="handleOpenBook">
              <span>Open Book</span>
              <span class="btn-arrow">📖</span>
            </button>
            <button class="secondary-dock-btn" @click="handleDrinkTea">
              <span>🍵 Sip Tea</span>
            </button>
            <button class="secondary-dock-btn" @click="handleReturnToShelf">
              <span>Return</span>
            </button>
          </div>
        </div>
      </transition>

      <!-- 3. Book Open Phase: Minimal Floating Page Controls -->
      <transition name="dock-fade">
        <div v-if="roomState === 'book-open' && readerControlsReady" class="minimal-page-controls">
          <div class="minimal-controls-pill">
            <button
              class="minimal-ctrl-btn"
              :disabled="currentPage <= 1"
              aria-label="Previous Page"
              @click="handleFlipPrev"
            >
              <span class="ctrl-arrow">←</span>
              <span>Previous</span>
            </button>

            <div
              class="minimal-page-fraction"
              title="Type page number (1 to {{ totalPages }}) and press Enter to jump directly"
            >
              <input
                ref="pageInputRef"
                v-model="pageInputValue"
                type="number"
                min="1"
                :max="totalPages"
                class="page-number-input"
                aria-label="Current Page Number"
                @keydown.enter="($event.target as HTMLElement)?.blur()"
                @blur="submitPageJump"
                @focus="($event.target as HTMLInputElement)?.select()"
              />
              <span class="fraction-slash">/</span>
              <span class="fraction-den">{{ totalPages }}</span>
            </div>

            <button
              class="minimal-ctrl-btn"
              :disabled="currentPage >= totalPages"
              aria-label="Next Page"
              @click="handleFlipNext"
            >
              <span>Next</span>
              <span class="ctrl-arrow">→</span>
            </button>

            <div class="minimal-separator" aria-hidden="true" />

            <!-- Future-Ready Deep Dive Control -->
            <div
              class="minimal-deep-dive is-disabled"
              aria-disabled="true"
              title="Interactive Deep Dive module is coming soon"
            >
              <span class="deep-dive-icon">🎯</span>
              <span class="deep-dive-title">Deep Dive</span>
              <span class="deep-dive-tag">Coming Soon</span>
            </div>

            <div class="minimal-separator" aria-hidden="true" />

            <!-- Put Back on Shelf Button -->
            <button
              class="minimal-return-btn"
              title="Put book back onto shelf (Esc)"
              @click="handleReturnToShelf"
            >
              <span class="return-icon">📚</span>
              <span class="return-text">Put Back on Shelf</span>
              <kbd class="kbd-badge">Esc</kbd>
            </button>
          </div>
        </div>
      </transition>
    </div>
    <!-- ========================================== -->
    <!-- EXPLORE MODE FIRST-PERSON HUD OVERLAY      -->
    <!-- ========================================== -->
    <div v-if="isExploreMode" class="explore-hud-container" pointer-events="none">
      <!-- Subtle Crosshair in Center Screen -->
      <div class="explore-crosshair">
        <div class="ch-dot" />
        <div class="ch-line ch-top" />
        <div class="ch-line ch-bottom" />
        <div class="ch-line ch-left" />
        <div class="ch-line ch-right" />
      </div>

      <!-- Controls Helper Badge in Bottom-Left -->
      <div class="explore-controls-card">
        <div class="ctrl-header">
          <span class="ctrl-badge-dot" />
          <span class="ctrl-mode-text">EXPLORE MODE ACTIVE</span>
        </div>
        <div class="ctrl-row">
          <span class="key-cap">W</span>
          <span class="key-cap">A</span>
          <span class="key-cap">S</span>
          <span class="key-cap">D</span>
          <span class="ctrl-label">Walk</span>
          <span class="key-cap key-wide">Shift</span>
          <span class="ctrl-label">Run / Sprint</span>
        </div>
        <div class="ctrl-row sub-row">
          <span class="key-cap key-mouse">Drag Mouse</span>
          <span class="ctrl-label">Look 360°</span>
          <span class="key-cap">E</span>
          <span class="ctrl-label">Open / Close Door</span>
        </div>
      </div>

      <!-- Door Proximity Action Banner (Floating interactive chip) -->
      <transition name="pop-fade">
        <div
          v-if="nearDoorPrompt.show"
          class="floating-door-prompt"
          @click="handleInteractDoor"
        >
          <div class="fd-icon-box">🚪</div>
          <div class="fd-content">
            <span class="fd-title">{{ nearDoorPrompt.text }}</span>
            <span class="fd-sub">Click here or press [E] key</span>
          </div>
          <button class="fd-btn">
            {{ nearDoorPrompt.isOpen ? 'Slide Shut' : 'Slide Open' }}
          </button>
        </div>
      </transition>

      <!-- Corridor Chamber Fast-Navigator (Bottom-Right) -->
      <div class="corridor-nav-dock">
        <span class="dock-title">CHAMBERS</span>
        <div class="dock-chips">
          <button
            v-for="rm in customRoomsList"
            :key="rm.id"
            class="dock-chip-btn"
            :class="{ 'is-current': currentZone === rm.id }"
            :title="`Walk or teleport to ${rm.name}`"
            @click="handleTeleportToZone(rm.id)"
          >
            <span class="chip-emoji">{{ rm.icon }}</span>
            <span class="chip-name">{{ rm.name }}</span>
          </button>
        </div>
      </div>

      <!-- Mobile / Tablet On-Screen Touch Controls -->
      <div class="mobile-touch-dpad">
        <div class="dpad-cross">
          <button
            class="dpad-btn dpad-up"
            @touchstart.prevent="handleTouchMove('forward', true)"
            @touchend.prevent="handleTouchMove('forward', false)"
          >▲</button>
          <div class="dpad-middle">
            <button
              class="dpad-btn dpad-left"
              @touchstart.prevent="handleTouchMove('left', true)"
              @touchend.prevent="handleTouchMove('left', false)"
            >◀</button>
            <button class="dpad-btn dpad-center" @click="handleTouchSprint">
              RUN
            </button>
            <button
              class="dpad-btn dpad-right"
              @touchstart.prevent="handleTouchMove('right', true)"
              @touchend.prevent="handleTouchMove('right', false)"
            >▶</button>
          </div>
          <button
            class="dpad-btn dpad-down"
            @touchstart.prevent="handleTouchMove('backward', true)"
            @touchend.prevent="handleTouchMove('backward', false)"
          >▼</button>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- CREATE NEW CHAMBER MODAL                   -->
    <!-- ========================================== -->
    <transition name="modal-fade">
      <div
        v-if="isCreateRoomModalOpen"
        class="create-chamber-backdrop"
        @click.self="isCreateRoomModalOpen = false"
      >
        <div class="create-chamber-modal">
          <div class="modal-top">
            <div class="modal-title-group">
              <span class="modal-avatar-badge">{{ newRoomIcon }}</span>
              <div>
                <h3 class="modal-h3">Construct New Chamber</h3>
                <p class="modal-p">Add an authentic architectural room to the Grand Corridor</p>
              </div>
            </div>
            <button class="modal-close" @click="isCreateRoomModalOpen = false">✕</button>
          </div>

          <div class="modal-form">
            <!-- Room Name -->
            <div class="form-group">
              <label class="form-label">Chamber Title / Name</label>
              <input
                v-model="newRoomName"
                type="text"
                class="modern-input"
                placeholder="e.g. Library Chamber, Tea Pavilion, Astronomy Lab"
                maxlength="32"
                autofocus
              />
            </div>

            <!-- Subtitle -->
            <div class="form-group">
              <label class="form-label">Sublabel / Knowledge Purpose</label>
              <input
                v-model="newRoomSubtitle"
                type="text"
                class="modern-input"
                placeholder="e.g. Classical Literature, Mindfulness & Tea, Star Charts"
                maxlength="45"
              />
            </div>

            <!-- Icon Picker -->
            <div class="form-group">
              <label class="form-label">Emblem / Icon</label>
              <div class="emblem-grid">
                <button
                  v-for="ic in availableIcons"
                  :key="ic"
                  type="button"
                  class="emblem-opt"
                  :class="{ 'is-active': newRoomIcon === ic }"
                  @click="newRoomIcon = ic"
                >
                  {{ ic }}
                </button>
              </div>
            </div>

            <!-- Theme Selector -->
            <div class="form-group">
              <label class="form-label">Architectural Theme &amp; Furnishings</label>
              <div class="themes-grid">
                <div
                  v-for="th in availableThemes"
                  :key="th.id"
                  class="theme-card"
                  :class="{ 'is-active': newRoomTheme === th.id }"
                  @click="newRoomTheme = th.id"
                >
                  <span class="theme-card-name">{{ th.label }}</span>
                  <span class="theme-card-desc">{{ th.desc }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-bottom">
            <button class="btn-cancel" @click="isCreateRoomModalOpen = false">Cancel</button>
            <button class="btn-construct" @click="handleConfirmCreateRoom">
              ✨ Construct Chamber in Corridor
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Creation Success Toast Notification -->
    <transition name="pop-fade">
      <div v-if="createdNotification" class="creation-toast-card">
        <span class="toast-icon">⛩️</span>
        <span class="toast-text">{{ createdNotification }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.immersive-room-wrapper {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: #080410;
  overflow: hidden;
  user-select: none;
  transition: background-color 0.6s ease;
}

.immersive-room-wrapper.is-night-mode {
  background: #04020a;
}

.webgl-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
}

/* Top HUD Header */
.room-hud-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px 26px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  background: linear-gradient(180deg, rgba(8, 4, 18, 0.92) 0%, rgba(8, 4, 18, 0.4) 70%, transparent 100%);
  backdrop-filter: blur(14px);
  z-index: 20;
}

.exit-chamber-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.exit-chamber-btn:hover {
  background: rgba(239, 68, 68, 0.22);
  border-color: rgba(239, 68, 68, 0.45);
  transform: translateX(-2px);
}

.chamber-info-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 99px;
  padding: 6px 16px;
}

.chamber-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fbbf24;
  box-shadow: 0 0 8px #fbbf24;
  transition: all 0.4s ease;
}

.chamber-dot.is-dim {
  background: #60a5fa;
  box-shadow: 0 0 8px #60a5fa;
}

.chamber-title {
  color: #ffffff;
  font-size: 13.5px;
  font-weight: 700;
}

.chamber-badge {
  font-size: 10px;
  font-weight: 800;
  color: #a855f7;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 99px;
  padding: 1px 7px;
  text-transform: uppercase;
}

/* Room Utility Controls in Header */
.room-utility-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hud-util-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.hud-util-btn:hover {
  background: rgba(251, 191, 36, 0.2);
  border-color: rgba(251, 191, 36, 0.5);
  color: #fde68a;
  transform: translateY(-1px);
}

.hud-util-btn.is-off {
  background: rgba(96, 165, 250, 0.15);
  border-color: rgba(96, 165, 250, 0.4);
  color: #93c5fd;
}

.class-shelf-pills {
  display: none;
  gap: 6px;
}

@media (min-width: 1024px) {
  .class-shelf-pills {
    display: flex;
  }
}

.shelf-pill {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(226, 222, 245, 0.7);
  font-size: 11.5px;
  font-weight: 600;
  border-radius: 99px;
  padding: 5px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.shelf-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.shelf-pill.is-active {
  background: rgba(251, 191, 36, 0.18);
  border-color: rgba(251, 191, 36, 0.5);
  color: #fde68a;
  font-weight: 700;
}

/* Floating 3D Tooltips / Interactive Chips */
.floating-3d-chip {
  position: absolute;
  transform: translate(-50%, -100%) translateY(-14px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(15, 10, 28, 0.88);
  border: 1px solid rgba(251, 191, 36, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(251, 191, 36, 0.35);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 99px;
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
  z-index: 50;
  pointer-events: auto;
  backdrop-filter: blur(12px);
  white-space: nowrap;
  transition: transform 0.15s ease;
}

.floating-3d-chip:hover {
  transform: translate(-50%, -100%) translateY(-16px) scale(1.05);
}

.lamp-chip {
  border-color: rgba(251, 191, 36, 0.8);
}

.cup-chip {
  border-color: rgba(132, 204, 22, 0.8);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(132, 204, 22, 0.35);
}

.book-chip {
  border-color: rgba(168, 85, 247, 0.8);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(168, 85, 247, 0.35);
}

.chip-icon {
  font-size: 14px;
}

.chip-text {
  letter-spacing: 0.02em;
}

/* Pop Fade Transition for Floating Tooltips */
.pop-fade-enter-active,
.pop-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.pop-fade-enter-from,
.pop-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -100%) translateY(-4px) scale(0.88);
}

/* Bottom Interactive Action Dock */
.room-action-dock {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 95vw;
  z-index: 20;
  pointer-events: none;
}

.action-card {
  pointer-events: auto;
  background: rgba(14, 10, 24, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.55),
    0 0 1px rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-radius: 999px;
  padding: 8px 16px 8px 18px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  white-space: nowrap;
}

.action-card-compact {
  max-width: 420px;
}

.action-card-table {
  max-width: 520px;
  border-radius: 20px;
  padding: 10px 18px;
}

.action-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-icon {
  font-size: 22px;
}

.action-heading {
  margin: 0;
  font-size: 13.5px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
}

.action-sub {
  margin: 1px 0 0;
  font-size: 11px;
  color: rgba(226, 222, 245, 0.65);
  line-height: 1.2;
}

.dock-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.primary-dock-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  border: none;
  color: #241400;
  font-size: 12.5px;
  font-weight: 800;
  padding: 8px 16px;
  border-radius: 99px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(251, 191, 36, 0.4);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.primary-dock-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(251, 191, 36, 0.55);
}

.secondary-dock-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: 99px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.secondary-dock-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

/* Minimal Floating Page Controls */
.minimal-page-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  pointer-events: auto;
}

.minimal-controls-pill {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  background: rgba(14, 10, 24, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.6),
    0 0 1px rgba(255, 255, 255, 0.25);
  white-space: nowrap;
}

.minimal-ctrl-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.minimal-ctrl-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-1px);
}

.minimal-ctrl-btn:disabled {
  opacity: 0.32;
  cursor: not-allowed;
  border-color: transparent;
  background: transparent;
}

.ctrl-arrow {
  font-size: 13px;
  line-height: 1;
}

.minimal-page-fraction {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: #e2e8f0;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.minimal-page-fraction:hover,
.minimal-page-fraction:focus-within {
  background: rgba(0, 0, 0, 0.48);
  border-color: rgba(56, 189, 248, 0.45);
}

.page-number-input {
  width: 44px;
  padding: 1px 2px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  color: #38bdf8;
  text-align: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  outline: none;
  cursor: text;
  transition: all 0.15s ease;
  -moz-appearance: textfield;
}

.page-number-input::-webkit-inner-spin-button,
.page-number-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.page-number-input:hover {
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
}

.page-number-input:focus {
  background: rgba(15, 23, 42, 0.9);
  border-color: #38bdf8;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
}

.fraction-slash {
  color: rgba(255, 255, 255, 0.35);
  font-weight: 400;
  user-select: none;
}

.fraction-den {
  color: #94a3b8;
  user-select: none;
  padding-right: 2px;
}

.minimal-separator {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.16);
  flex-shrink: 0;
}

.minimal-deep-dive {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
}

.minimal-deep-dive.is-disabled {
  opacity: 0.85;
  cursor: default;
}

.deep-dive-icon {
  font-size: 13px;
  line-height: 1;
}

.deep-dive-title {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  letter-spacing: 0.01em;
}

.deep-dive-tag {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.18);
  border: 1px solid rgba(245, 158, 11, 0.35);
  padding: 2px 7px;
  border-radius: 99px;
}

.minimal-return-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #f1f5f9;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 99px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  flex-shrink: 0;
}

.minimal-return-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  border-color: rgba(255, 255, 255, 0.28);
  color: #ffffff;
  transform: translateY(-1px);
}

.return-icon {
  font-size: 13px;
  line-height: 1;
}

.return-text {
  white-space: nowrap;
}

.kbd-badge {
  font-size: 10px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.14);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
  line-height: 1.2;
}

/* Dock transition */
.dock-fade-enter-active,
.dock-fade-leave-active {
  transition: all 0.25s ease;
}

.dock-fade-enter-from,
.dock-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

/* Zen Immersive Loader Screen */
.zen-loader-screen {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at center, #171126 0%, #0a0614 100%);
  backdrop-filter: blur(24px);
}

.zen-loader-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 44px;
  background: rgba(22, 17, 38, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  max-width: 420px;
  width: 90%;
}

.zen-enso-container {
  position: relative;
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.zen-enso-pulse {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(217, 119, 6, 0.4);
  border-top-color: #f59e0b;
  animation: enso-spin 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.zen-enso-glyph {
  font-size: 26px;
  font-family: serif;
  color: #fbbf24;
  text-shadow: 0 0 16px rgba(245, 158, 11, 0.5);
  user-select: none;
}

@keyframes enso-spin {
  0% { transform: rotate(0deg); border-width: 2px; }
  50% { transform: rotate(180deg); border-width: 3px; }
  100% { transform: rotate(360deg); border-width: 2px; }
}

.zen-loader-heading {
  font-size: 16px;
  font-weight: 600;
  color: #f8fafc;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
}

.zen-loader-caption {
  font-size: 11px;
  color: #94a3b8;
  margin: 0 0 22px;
  line-height: 1.4;
}

.zen-progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 10px;
}

.zen-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #d97706, #fbbf24, #38bdf8);
  border-radius: 99px;
  transition: width 0.15s ease-out;
}

.zen-progress-counter {
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fbbf24;
  letter-spacing: 0.05em;
}

/* Zen Loader Transition */
.zen-loader-fade-enter-active,
.zen-loader-fade-leave-active {
  transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

.zen-loader-fade-enter-from,
.zen-loader-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

/* =========================================================
   EXPLORE MODE, MULTI-ROOM & GRAND CORRIDOR STYLES
   ========================================================= */

/* Header Explore & Room Buttons */
.explore-toggle-btn.is-active {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%) !important;
  color: #ffffff !important;
  border-color: #38bdf8 !important;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.45) !important;
}

.create-room-btn {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(126, 34, 206, 0.25) 100%) !important;
  color: #e9d5ff !important;
  border-color: rgba(192, 132, 252, 0.45) !important;
}

.create-room-btn:hover {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.4) 0%, rgba(126, 34, 206, 0.4) 100%) !important;
  box-shadow: 0 0 14px rgba(192, 132, 252, 0.4) !important;
}

/* Explore Mode Crosshair */
.explore-hud-container {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
}

.explore-crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  pointer-events: none;
}

.ch-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.9);
}

.ch-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.45);
}

.ch-top {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 6px;
}

.ch-bottom {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 6px;
}

.ch-left {
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 1px;
}

.ch-right {
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 1px;
}

/* Controls Guide Card in Bottom-Left */
.explore-controls-card {
  position: absolute;
  bottom: 32px;
  left: 32px;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}

.ctrl-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ctrl-badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulse 2s infinite;
}

.ctrl-mode-text {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #7dd3fc;
}

.ctrl-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sub-row {
  margin-top: 2px;
}

.key-cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.key-wide {
  min-width: 48px;
}

.key-mouse {
  min-width: 74px;
}

.ctrl-label {
  font-size: 12px;
  color: #94a3b8;
  margin-right: 10px;
}

/* Floating Door Proximity Prompt */
.floating-door-prompt {
  position: absolute;
  top: 75%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(16px);
  border: 1.5px solid rgba(56, 189, 248, 0.6);
  border-radius: 36px;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(56, 189, 248, 0.35);
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
}

.floating-door-prompt:hover {
  transform: translate(-50%, -54%) scale(1.03);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7), 0 0 32px rgba(56, 189, 248, 0.55);
}

.fd-icon-box {
  font-size: 24px;
}

.fd-content {
  display: flex;
  flex-direction: column;
}

.fd-title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
}

.fd-sub {
  font-size: 11px;
  color: #94a3b8;
}

.fd-btn {
  background: #0284c7;
  color: #ffffff;
  border: none;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
}

/* Corridor Chamber Dock in Bottom-Right */
.corridor-nav-dock {
  position: absolute;
  bottom: 32px;
  right: 32px;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: auto;
}

.dock-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #64748b;
}

.dock-chips {
  display: flex;
  gap: 8px;
}

.dock-chip-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  padding: 6px 12px;
  font-size: 12px;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dock-chip-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}

.dock-chip-btn.is-current {
  background: rgba(2, 132, 199, 0.35);
  border-color: #38bdf8;
  color: #38bdf8;
  font-weight: 700;
}

/* Mobile D-pad */
.mobile-touch-dpad {
  display: none;
  position: absolute;
  bottom: 32px;
  left: 32px;
  pointer-events: auto;
}

@media (pointer: coarse), (max-width: 768px) {
  .mobile-touch-dpad {
    display: block;
  }
}

.dpad-cross {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dpad-middle {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dpad-btn {
  width: 46px;
  height: 46px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.dpad-btn:active {
  background: #0284c7;
}

.dpad-center {
  font-size: 10px;
}

/* =========================================================
   CREATE CHAMBER MODAL
   ========================================================= */
.create-chamber-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 18, 0.75);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}

.create-chamber-modal {
  width: 100%;
  max-width: 540px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 24px;
  padding: 28px;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65), 0 0 32px rgba(56, 189, 248, 0.15);
  display: flex;
  flex-direction: column;
  gap: 20px;
  color: #ffffff;
}

.modal-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.modal-avatar-badge {
  font-size: 34px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.modal-h3 {
  font-size: 20px;
  font-weight: 800;
  margin: 0;
  color: #f8fafc;
}

.modal-p {
  font-size: 13px;
  color: #94a3b8;
  margin: 2px 0 0;
}

.modal-close {
  background: transparent;
  border: none;
  font-size: 20px;
  color: #94a3b8;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
}

.modal-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #cbd5e1;
}

.modern-input {
  background: rgba(15, 23, 42, 0.8);
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  color: #ffffff;
  outline: none;
  transition: all 0.2s ease;
}

.modern-input:focus {
  border-color: #38bdf8;
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.3);
}

.emblem-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emblem-opt {
  font-size: 22px;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.emblem-opt:hover {
  background: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.emblem-opt.is-active {
  background: rgba(2, 132, 199, 0.35);
  border-color: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
}

.themes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.2s ease;
}

.theme-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.25);
}

.theme-card.is-active {
  background: rgba(2, 132, 199, 0.25);
  border-color: #38bdf8;
  box-shadow: 0 0 16px rgba(56, 189, 248, 0.25);
}

.theme-card-name {
  font-size: 13px;
  font-weight: 700;
  color: #f8fafc;
}

.theme-card-desc {
  font-size: 11px;
  color: #94a3b8;
  line-height: 1.3;
}

.modal-bottom {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.btn-cancel {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #cbd5e1;
  border-radius: 12px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
}

.btn-construct {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: 1px solid #38bdf8;
  color: #ffffff;
  border-radius: 12px;
  padding: 10px 24px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(2, 132, 199, 0.45);
  transition: all 0.2s ease;
}

.btn-construct:hover {
  box-shadow: 0 8px 24px rgba(56, 189, 248, 0.6);
  transform: translateY(-1px);
}

/* Toast Card */
.creation-toast-card {
  position: absolute;
  top: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  border: 1.5px solid #4ade80;
  border-radius: 30px;
  padding: 12px 28px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #f0fdf4;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(74, 222, 128, 0.35);
  z-index: 110;
}
</style>
