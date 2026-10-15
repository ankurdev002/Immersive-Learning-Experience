import * as THREE from 'three'
import { gsap } from 'gsap'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { PbrTextureLibrary } from './room/PbrTextures'
import { HandRig, type HandPose } from './room/HandRig'
import { CurvedStack, CurvedSheet, stackSurfaceHeight, gutterShade } from './room/BookGeometry'
import {
  createSeatedMonk,
  type SeatedMonk,
  projectWoodUVs,
  createDesk,
  createChair,
  createTeaSet,
  createIncenseHolder,
  createBonsai,
  createSmallAndon,
  createFloorAndon,
  createIkebana,
  createTokonoma,
  createShojiWall,
  createNoren,
  createStoneLantern,
  createZabuton,
  createChabudai,
  createArmchair,
  createFloorLamp,
  createBookWall,
  createFramedPainting,
  createBench,
  createEasel,
  createGlobe,
  createTelescope,
  type RoomPalette,
} from './room/Props'
import {
  createGardenFarLayer,
  createGardenMidLayer,
  createGardenNearLayer,
  createRugTexture,
  createSandGardenTexture,
  createGlobeTexture,
  createWallMapTexture,
  createSoftShadowTexture,
  createPaintingTexture,
} from './room/ArtTextures'
import {
  createModernRoomLabelTexture,
  createLightSwitchTexture,
  createShojiDoorPanelTexture,
  createSpineTexture,
  createBookCoverTexture,
  createBookPageTexture,
  createBookInsideCoverTexture,
  createShelfPlaqueTexture,
  createBookPageEdgesTexture,
  createContactShadowTexture,
  createCeramicCupTexture,
  createMatchaTexture,
  createTeaSaucerTexture,
  createSteamVaporTexture,
  createPencilCupTexture,
  createPlantPotTexture,
  createFireflyTexture,
  configurePageTextures,
} from './JapaneseTextures'
import {
  SHELF_BOOKS_CONFIG,
  getShelfTierStacks,
  getShelfBookById,
  type ShelfBookConfig,
} from './BookshelfConfig'
import { BookCatalogService } from './BookCatalogService'
import type { ImmersiveBookData } from '~/types/learning-journey'

export interface InteractiveHoverData {
  target: 'lamp' | 'cup' | 'book' | null
  bookData?: ImmersiveBookData
  screenPos?: { x: number; y: number }
  isLightOn: boolean
}

export interface CustomRoomData {
  id: string
  name: string
  subtitle: string
  icon: string
  theme: 'study' | 'library' | 'meditation' | 'gallery' | 'science'
  doorX: number
  doorZ: number
  isLightOn: boolean
  group: THREE.Group
  /** Room contents behind the door (hidden unless inside or the door is open) */
  interior: THREE.Group
  doorGroup: THREE.Group
  doorLeft: THREE.Mesh
  doorRight: THREE.Mesh
  isDoorOpen: boolean
  labelMesh: THREE.Mesh
  switchMesh: THREE.Mesh
  lights: RoomLight[]
  roomIndex: number
  /** Axis-aligned furniture footprints (centre x/z and half-extents) for explore-mode collisions */
  colliders: RoomCollider[]
  /** Lamp / lantern paper that dims with the room's light switch */
  glowMaterials: THREE.MeshStandardMaterial[]
}

export interface RoomCollider {
  x: number
  z: number
  hx: number
  hz: number
}

/**
 * A light fixture that is not a real THREE.Light. Fixtures are mapped onto a small, fixed pool of real
 * lights every frame (nearest first), so the scene's light count never changes. Changing the number of
 * visible lights forces three.js to recompile every shader, which caused 50-300ms hitches when walking
 * between rooms or flipping switches.
 */
export interface VirtualLight {
  kind: 'spot' | 'point'
  position: THREE.Vector3
  target: THREE.Vector3
  color: THREE.Color
  intensity: number
  distance: number
  decay: number
  angle: number
  penumbra: number
  active: boolean
}

export type RoomLight = THREE.AmbientLight | VirtualLight

export type QualityTier = 'low' | 'medium' | 'high'

interface QualityPreset {
  maxDPR: number
  minDPR: number
  antialias: boolean
  shadowMapSize: number
  sunShadow: boolean
  spotPoolSize: number
  pointPoolSize: number
  lightRadius: number
  anisotropy: number
  throttleWhenIdle: boolean
}

const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: {
    maxDPR: 1.0,
    minDPR: 0.6,
    antialias: false,
    shadowMapSize: 512,
    sunShadow: false,
    spotPoolSize: 3,
    pointPoolSize: 2,
    lightRadius: 6.0,
    anisotropy: 2,
    throttleWhenIdle: true,
  },
  medium: {
    maxDPR: 1.25,
    minDPR: 0.75,
    antialias: true,
    shadowMapSize: 1024,
    sunShadow: true,
    spotPoolSize: 4,
    pointPoolSize: 2,
    lightRadius: 7.5,
    anisotropy: 4,
    throttleWhenIdle: false,
  },
  high: {
    maxDPR: 2.0,
    minDPR: 1.0,
    antialias: true,
    shadowMapSize: 2048,
    sunShadow: true,
    spotPoolSize: 5,
    pointPoolSize: 2,
    lightRadius: 9.0,
    anisotropy: 8,
    throttleWhenIdle: false,
  },
}

const QUALITY_STORAGE_KEY = 'ire-quality-tier'
const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high']

function readStoredQualityTier(): QualityTier | null {
  try {
    const stored = localStorage.getItem(QUALITY_STORAGE_KEY)
    return stored === 'low' || stored === 'medium' || stored === 'high' ? stored : null
  } catch {
    return null
  }
}

function createVirtualLight(
  kind: 'spot' | 'point',
  color: THREE.ColorRepresentation,
  intensity: number,
  distance: number,
  decay: number,
  position: THREE.Vector3,
  target = new THREE.Vector3(),
  angle = Math.PI / 3,
  penumbra = 0
): VirtualLight {
  return {
    kind,
    position,
    target,
    color: new THREE.Color(color),
    intensity,
    distance,
    decay,
    angle,
    penumbra,
    active: false,
  }
}

export interface SwitchPromptData {
  show: boolean
  /** Zone whose lights this switch controls ('study-room', 'hallway' or a room id) */
  targetId: string
  zoneName: string
  isOn: boolean
}

export interface DoorPromptData {
  show: boolean
  text: string
  roomId: string
  isOpen: boolean
}

export interface PerformanceStats {
  fps: number
  dpr: number
  tier: QualityTier
  isManualTier: boolean
  isOptimized: boolean
}

export interface RoomServiceCallbacks {
  onBookSelected?: (bookData?: ImmersiveBookData) => void
  onBookFlightStarted?: () => void
  onBookLanded?: () => void
  onBookOpeningStarted?: () => void
  onBookOpened?: () => void
  onPageFlipStarted?: (page: number) => void
  onPageFlipped?: (page: number) => void
  onBookClosed?: () => void
  onHoverInteractive?: (data: InteractiveHoverData) => void
  onLightToggled?: (isLightOn: boolean) => void
  onTeaDrinkingStarted?: () => void
  onTeaDrinkingSip?: () => void
  onTeaDrinkingCompleted?: () => void
  onExploreModeChanged?: (isExplore: boolean) => void
  onCurrentZoneChanged?: (zone: string, zoneName: string) => void
  onDoorInteracted?: (roomId: string, isOpen: boolean) => void
  onRoomLightToggled?: (roomId: string, isLightOn: boolean) => void
  onRoomCreated?: (room: { id: string; name: string; icon: string; theme: string }) => void
  onNearDoorPrompt?: (prompt: DoorPromptData) => void
  onNearSwitchPrompt?: (prompt: SwitchPromptData) => void
  /** Standing near a dojo monk (show = false when walking away) */
  onNearMonk?: (near: { show: boolean; roomId: string }) => void
  /** Player pressed [E] / clicked the monk: open the conversation */
  onMonkInteract?: (roomId: string) => void
  onMeditationChanged?: (meditating: boolean) => void
  onPlayFootstep?: () => void
  onPlayDoorSlide?: () => void
  onPerformanceUpdate?: (stats: PerformanceStats) => void
}

export class JapaneseRoomService {
  private canvas: HTMLCanvasElement
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private raycaster = new THREE.Raycaster()
  private mouse = new THREE.Vector2()

  private animationFrameId: number | null = null
  private callbacks: RoomServiceCallbacks

  // Lighting System
  public isLightOn = true
  public isHallwayLightOn = true
  public isExploreMode = false
  public currentZone: string = 'study-room'
  public playerPos = new THREE.Vector3(0, 1.65, 1.8)
  public playerYaw = 0
  public playerPitch = 0
  public isRunning = false
  public readonly walkSpeed = 2.4
  public readonly runSpeed = 5.2
  private headBobTimer = 0
  private stepDistanceAccumulator = 0
  public keys = { forward: false, backward: false, left: false, right: false, shift: false }
  private isMouseDragging = false
  private prevMousePos = { x: 0, y: 0 }

  // Multi-Room & Hallway System
  public customRooms = new Map<string, CustomRoomData>()
  public availableSlots = [5.5, -5.5, 11.0, -11.0]
  private hallwayGroup = new THREE.Group()
  private hallwayInnerWallGroup = new THREE.Group()
  private hallwayWallMat: THREE.MeshStandardMaterial | null = null
  private hallwayLights: Array<THREE.AmbientLight | VirtualLight> = []
  private studyDoorGroup = new THREE.Group()
  private studyDoorLeft!: THREE.Mesh
  private studyDoorRight!: THREE.Mesh
  public isStudyDoorOpen = false
  private studyDoorPlaque!: THREE.Mesh
  private studyWallSwitch!: THREE.Mesh
  private hallwayWallSwitch!: THREE.Mesh
  private interactiveDoors: { mesh: THREE.Object3D; roomId: string }[] = []
  private interactiveSwitches: { mesh: THREE.Object3D; targetId: string }[] = []
  private currentNearPrompt: DoorPromptData = { show: false, text: '', roomId: '', isOpen: false }
  private ambientLight!: THREE.AmbientLight
  private sunLight!: THREE.DirectionalLight
  private lampLight!: THREE.SpotLight
  private moonLight!: THREE.DirectionalLight
  private lampShadeMesh!: THREE.Mesh
  private heroBookGlow!: VirtualLight
  private textureLoader = new THREE.TextureLoader()

  // Assets (PBR scans, hand models) + shared material palette for the redesigned rooms
  private loadingManager = new THREE.LoadingManager()
  private pbr!: PbrTextureLibrary
  private palette!: RoomPalette
  private readonly swayUniforms = { uTime: { value: 0 } }
  private studyGardenGroup = new THREE.Group()
  private hallwayLanternPaper!: THREE.MeshStandardMaterial
  private studyPaperGlow!: THREE.MeshStandardMaterial
  private lampBulbMaterial: THREE.MeshStandardMaterial | null = null
  /** Environment (bounce / reflection) light per zone, so a switched-off zone actually goes dark */
  private envLevels = new Map<string, { value: number }>([
    ['study-room', { value: 0.45 }],
    ['hallway', { value: 0.45 }],
  ])
  private studyGardenMaterials: THREE.MeshBasicMaterial[] = []
  private hallwayEmissives: THREE.MeshStandardMaterial[] = []
  private hallwayFixtureMaterial: THREE.MeshBasicMaterial | null = null
  /** Every wall switch, with the zone it sits in and the zone it controls */
  private wallSwitches: { mesh: THREE.Mesh; zone: string; targetId: string }[] = []
  private currentSwitchPrompt: SwitchPromptData = { show: false, targetId: '', zoneName: '', isOn: true }
  /** Resolves once textures and hand models are loaded (or failed / timed out) */
  public readonly ready: Promise<void>
  private resolveReady!: () => void
  private coverTextures = new Map<string, THREE.Texture>()

  // Tweenable light levels for the always-present study lights. The renderer sees
  // level * zoneMask, so leaving the study zone dims these without removing them from the scene.
  private lightLevels = { sun: 1.4, lamp: 3.2, moon: 0 }
  private zoneMask = { sun: 1, lamp: 1, moon: 1 }

  // Fixed-size real light pools that virtual fixtures are mapped onto each frame
  private spotPool: THREE.SpotLight[] = []
  private pointPool: THREE.PointLight[] = []
  private spotFixtures: VirtualLight[] = []
  private pointFixtures: VirtualLight[] = []
  private readonly _fixtureCandidates: { light: VirtualLight; dist: number }[] = []

  // Interactive Book System
  private heroBookGroup = new THREE.Group()
  private bookCoverPivot = new THREE.Group()
  private pagePivot = new THREE.Group()
  private bookTargetMesh!: THREE.Mesh
  private pageMesh!: THREE.Mesh
  private pageBlockMesh!: THREE.Mesh
  private leftPageBlockMesh!: THREE.Mesh
  private rightPageBlockMesh!: THREE.Mesh
  private pageFrontMesh!: THREE.Mesh
  private pageBackMesh!: THREE.Mesh
  private pageFrontBasePositions!: Float32Array
  private pageBackBasePositions!: Float32Array
  private isFlipping = false
  private frontCoverMesh!: THREE.Mesh
  private backCoverMesh!: THREE.Mesh
  private spineMesh!: THREE.Mesh
  private leftCurvedPageMesh!: THREE.Mesh
  private rightCurvedPageMesh!: THREE.Mesh
  private gutterShadowMesh!: THREE.Mesh
  public currentBookData: ImmersiveBookData = SHELF_BOOKS_CONFIG.find((b) => b.isInteractive)!

  // =========================================================
  // ADAPTIVE QUALITY TIERS (LOW / MEDIUM / HIGH) & 60 FPS ENGINE
  // =========================================================
  public qualityTier: QualityTier = 'medium'
  public isManualTier = false
  private preset: QualityPreset = QUALITY_PRESETS.medium
  public baseDPR = 1.0
  public currentDPR = 1.0
  public currentFps = 60
  private avgFrameDelta = 0.0166
  private consecutiveSlowFrames = 0
  private consecutiveFastFrames = 0
  private slowFramesAtMinDPR = 0
  private framesSinceStatsEmit = 0
  private lastDprDropTime = -Infinity
  private shadowUpdateFrames = 25
  private lastRaycastTime = 0
  private lastSpatialCheckZone = ''
  private lastSpatialCheckX = 9999
  private lastActivityTime = 0
  private idleFrameToggle = false

  // Dedicated Hallway Light References for Spatial Light Culling
  private hallwaySpotLights: VirtualLight[] = []
  private hallwayAmbientLight: THREE.AmbientLight | null = null
  private hallwayLeftLight: VirtualLight | null = null
  private hallwayRightLight: VirtualLight | null = null

  // Zero-Allocation Reusable Scratch Vectors for Render Loop
  private readonly _scratchForward = new THREE.Vector3()
  private readonly _scratchRight = new THREE.Vector3()
  private readonly _scratchMoveVector = new THREE.Vector3()

  // Physical Book Geometry Constants
  private readonly bookWidth = 0.35
  private readonly bookLength = 0.48
  private readonly bookThickness = 0.046
  private readonly coverThickness = 0.005
  private readonly pageBlockThickness = 0.038
  private readonly minStackH = 0.0015

  // Soft Tactile Contact Shadows on Desk
  private contactShadowRight!: THREE.Mesh
  private contactShadowLeft!: THREE.Mesh

  // Bookshelf Data-Driven Meshes
  private shelfInteractiveMeshes: THREE.Mesh[] = []
  private shelfBooksMap = new Map<string, THREE.Mesh>()
  private interactiveShelfBookMesh: THREE.Mesh | null = null
  private hoveredBookMesh: THREE.Mesh | null = null
  private shelfBookMaterial!: THREE.MeshStandardMaterial
  private shelfBookHighlightMaterial!: THREE.MeshStandardMaterial

  // Interactive Table Props
  private lampTargetMesh!: THREE.Mesh
  private cupGroup = new THREE.Group()
  private cupTargetMesh!: THREE.Mesh
  private isDrinking = false
  private isOpenPending = false

  // Curved open-book surfaces (driven from the logical stack meshes each frame)
  private rightStack!: CurvedStack
  private leftStack!: CurvedStack
  private rightStackMesh!: THREE.Mesh
  private leftStackMesh!: THREE.Mesh
  private rightSheet!: CurvedSheet
  private leftSheet!: CurvedSheet
  /** 0 = closed flat block, 1 = fully open curved pages */
  private pageOpenness = { value: 0 }
  private lastSurfaceKey = ''

  // Meditation dojo monks and the player's seated meditation
  private monks: Array<SeatedMonk & { roomId: string; seat: THREE.Vector3 }> = []
  private nearMonkRoomId = ''
  public isMeditating = false
  private meditationStand: { x: number; z: number; yaw: number } | null = null

  // Page-turning hands
  private handRight: HandRig | null = null
  private handLeft: HandRig | null = null
  private curlRest = { fromH: 0, toH: 0 }
  private leafCornerIndex = -1
  private leafSpineNeighborIndex = -1
  private leafUpNeighborIndex = -1
  private staticMeshesOptimized = false

  // Environmental Atmospheric Particles & Props
  private dustParticles: THREE.Points | null = null
  private dustPositions: Float32Array | null = null
  private gardenBackdropMesh: THREE.Mesh | null = null
  private teaSteamParticles: THREE.Points | null = null

  // Positions & Coordinates
  // Front Bookshelf slot for Class 3 Mathematics (standing on shelf in front of table, facing viewer)
  private shelfBookPos = new THREE.Vector3(0.45, 2.115, -2.48)
  private shelfBookRot = new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2)

  // Center Study Desk & Shokendai Reading Stand (tilted at ~78° - 80° for ergonomic screen centering)
  private tableBookPos = new THREE.Vector3(0, 1.070, -0.440)
  private tableBookRot = new THREE.Euler((78 * Math.PI) / 180, 0, 0)

  // Camera views
  // Wide chamber view framing center standing desk with chair, and front bookshelf directly in front
  private initialCamPos = new THREE.Vector3(0, 1.82, 2.85)
  private initialCamTarget = new THREE.Vector3(0, 1.25, -0.9)

  // Overview on Desk (Storyboard Frame 4)
  private deskCamPos = new THREE.Vector3(0, 1.52, 0.65)
  private deskCamTarget = new THREE.Vector3(0, 1.070, -0.440)

  // Intimate Reading Camera for Two-Page Spread (Storyboard Frame 5, 6)
  // Positioned directly perpendicular to the 78° tilted reading stand for centered, distortion-free viewing
  private readCamPos = new THREE.Vector3(0, 1.249, 0.401)
  private readCamTarget = new THREE.Vector3(0, 1.070, -0.440)

  // State
  public state: 'room-view' | 'book-flying' | 'on-table' | 'book-open' | 'explore' = 'room-view'
  public currentPage = 1
  private currentHoveredTarget: 'lamp' | 'cup' | 'book' | null = null

  constructor(canvas: HTMLCanvasElement, callbacks: RoomServiceCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks

    // 1. Scene & Camera
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0a0614')
    // Light haze only: the old density darkened the far end of the 28m corridor into murk
    this.scene.fog = new THREE.FogExp2('#0a0614', 0.012)

    const aspect = canvas.clientWidth / canvas.clientHeight
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 50)
    this.camera.position.copy(this.initialCamPos)
    this.camera.lookAt(this.initialCamTarget)

    // Pick a quality tier (manual override > GPU/device heuristics); antialias must be decided before
    // the WebGL context exists, everything else can still adapt at runtime.
    this.applyQualityPreset(this.detectQualityTier())

    this.ready = new Promise<void>((resolve) => {
      this.resolveReady = resolve
    })
    this.loadingManager.onLoad = () => this.resolveReady()
    this.loadingManager.onError = (url) => console.warn('[JapaneseRoomService] asset failed to load:', url)
    // Never hold the loading screen hostage to a slow network
    setTimeout(() => this.resolveReady(), 9000)

    // 2. High-Fidelity & Low-End Optimized WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.preset.antialias,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
      alpha: false,
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setPixelRatio(this.currentDPR)
    this.renderer.shadowMap.enabled = true
    // PCFShadowMap provides 3x faster filtering on Intel UHD / Iris Xe / mobile GPUs than PCFSoft
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    // Selective shadow updates: renders static shadows once, eliminating ~120 shadow render passes/sec
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    // Image-based lighting: a pre-filtered room environment gives brass, ceramic, glass and varnished
    // wood real reflections and soft bounce light on every tier (one small cubemap, built once).
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.45
    pmrem.dispose()

    // Sharper book pages on capable GPUs (1536x2048), lean memory budget on low-end ones
    if (this.qualityTier === 'low') configurePageTextures(1, 6)
    else configurePageTextures(1.28, 8)

    this.pbr = new PbrTextureLibrary(this.loadingManager, this.qualityTier === 'low', this.preset.anisotropy)
    this.pbr.preload(['tatami', 'walnut', 'darkWalnut', 'cedar', 'plaster', 'hessian'])
    this.palette = this.createPalette()
    this.loadHands()

    // Start fetching the default book's curriculum right away (it is no longer bundled into the JS)
    void BookCatalogService.ensureBookLoaded(this.currentBookData.id)

    // 3. Build Room Architecture & Props
    this.setupLighting()
    this.buildRoomArchitecture()
    this.buildEntranceDoorAndPlaque()
    this.buildGrandHallway()
    this.buildDefaultRooms()
    this.buildJapaneseDesk()
    this.buildFrontBookshelf()
    this.buildHeroBook()
    this.setupAtmosphere()

    // Collapse static furniture & architecture into one mesh per material (hundreds fewer draw calls)
    this.optimizeStaticMeshes()

    // 4. Events & Render Loop
    this.bindEvents()
    // Initial static shadow bake (25 frames)
    this.triggerShadowUpdate(25)
    // Initial spatial lighting culling pass
    this.updateSpatialLights(true)
    this.syncLightPools()
    // Compile every shader now (behind the loading screen) instead of mid-interaction
    this.warmUpShaders()
    this.startLoop()
  }

  // =========================================================
  // HARDWARE DETECTION, QUALITY TIERS & ADAPTIVE 60 FPS ENGINE
  // =========================================================

  private detectQualityTier(): QualityTier {
    const stored = readStoredQualityTier()
    if (stored) {
      this.isManualTier = true
      return stored
    }
    this.isManualTier = false

    // Probe on a throwaway canvas: calling getContext() on the real canvas first would lock in default
    // context attributes and silently override the renderer's antialias / alpha settings.
    let rendererStr = ''
    try {
      const probe = document.createElement('canvas')
      const gl = (probe.getContext('webgl2') || probe.getContext('webgl')) as WebGLRenderingContext | null
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
        rendererStr = String(
          (debugInfo && gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''
        ).toLowerCase()
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      // Fall through to device heuristics
    }

    const nav = typeof navigator !== 'undefined' ? navigator : undefined
    const ua = nav?.userAgent || ''
    const memory = (nav as any)?.deviceMemory as number | undefined
    const cores = nav?.hardwareConcurrency
    const isMobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1)

    if (/swiftshader|llvmpipe|software|microsoft basic/.test(rendererStr)) return 'low'
    if (isMobile || /mali|adreno|powervr/.test(rendererStr)) return 'low'
    if ((memory && memory <= 2) || (cores && cores <= 2)) return 'low'

    if (/nvidia|geforce|rtx|gtx|quadro|radeon (rx|pro)|arc\(tm\)|apple m\d+ (pro|max|ultra)/.test(rendererStr)) {
      return 'high'
    }
    if (/hd graphics|uhd graphics/.test(rendererStr)) return 'low'
    if (/iris|radeon|vega|apple/.test(rendererStr)) return 'medium'
    if ((memory && memory <= 4) || (cores && cores <= 4)) return 'low'
    return 'medium'
  }

  private applyQualityPreset(tier: QualityTier) {
    const previousDPR = this.renderer ? this.currentDPR : Infinity
    this.qualityTier = tier
    this.preset = QUALITY_PRESETS[tier]
    const deviceDPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    this.baseDPR = Math.max(this.preset.minDPR, Math.min(deviceDPR, this.preset.maxDPR))
    this.currentDPR = this.baseDPR
    this.consecutiveSlowFrames = 0
    this.consecutiveFastFrames = 0
    this.slowFramesAtMinDPR = 0
    return previousDPR
  }

  private applyShadowSettings() {
    const size = this.preset.shadowMapSize
    for (const light of [this.sunLight, this.lampLight]) {
      if (light.shadow.mapSize.x !== size) {
        light.shadow.mapSize.set(size, size)
        light.shadow.map?.dispose()
        light.shadow.map = null
      }
    }
    // Changing the shadow-caster count recompiles shaders once; only happens on a tier change
    this.sunLight.castShadow = this.preset.sunShadow
    this.triggerShadowUpdate(10)
  }

  private switchQualityTier(tier: QualityTier, keepCurrentDPR: boolean) {
    const previousDPR = this.applyQualityPreset(tier)
    if (keepCurrentDPR) {
      // When stepping down for performance, never jump to a higher resolution than we were already at
      this.currentDPR = Math.max(this.preset.minDPR, Math.min(this.currentDPR, previousDPR))
    }
    this.renderer.setPixelRatio(this.currentDPR)
    // Manual tier changes keep the reading boost; automatic step-downs must not undo themselves
    if (this.readingBoost && !keepCurrentDPR) this.setReadingResolution(true)
    this.applyShadowSettings()
    this.emitPerformanceStats()
  }

  /** Manually choose a quality tier, or 'auto' to go back to detection. Antialiasing applies on next visit. */
  public setQualityTier(tier: QualityTier | 'auto') {
    try {
      if (tier === 'auto') localStorage.removeItem(QUALITY_STORAGE_KEY)
      else localStorage.setItem(QUALITY_STORAGE_KEY, tier)
    } catch {
      // Storage unavailable (private mode): still apply for this session
    }
    const nextTier = tier === 'auto' ? this.detectQualityTier() : tier
    this.isManualTier = tier !== 'auto'
    this.switchQualityTier(nextTier, false)
  }

  public triggerShadowUpdate(frames = 30) {
    this.shadowUpdateFrames = Math.max(this.shadowUpdateFrames, frames)
  }

  private emitPerformanceStats() {
    this.callbacks.onPerformanceUpdate?.({
      fps: this.currentFps,
      dpr: this.currentDPR,
      tier: this.qualityTier,
      isManualTier: this.isManualTier,
      isOptimized: true,
    })
  }

  private monitorPerformance(rawDelta: number) {
    if (rawDelta <= 0.0001 || rawDelta > 0.5) return
    // Background / hidden tabs get throttled frame rates: never mistake that for a slow GPU
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      this.consecutiveSlowFrames = 0
      this.slowFramesAtMinDPR = 0
      return
    }

    // Exponential moving average of frame time
    this.avgFrameDelta = this.avgFrameDelta * 0.94 + rawDelta * 0.06
    this.currentFps = Math.max(15, Math.min(120, Math.round(1 / this.avgFrameDelta)))

    if (this.avgFrameDelta > 0.0182) {
      // < 55 FPS: step resolution down, then (automatic tiers only) the quality tier itself
      this.consecutiveSlowFrames++
      this.consecutiveFastFrames = 0
      if (this.consecutiveSlowFrames > 30) {
        this.consecutiveSlowFrames = 0
        if (this.currentDPR > this.preset.minDPR + 0.001) {
          this.currentDPR = Math.max(this.preset.minDPR, Math.round((this.currentDPR - 0.1) * 100) / 100)
          this.renderer.setPixelRatio(this.currentDPR)
          this.lastDprDropTime = performance.now()
        } else if (!this.isManualTier && this.qualityTier !== 'low') {
          this.slowFramesAtMinDPR++
          if (this.slowFramesAtMinDPR >= 6) {
            const lowerTier = TIER_ORDER[TIER_ORDER.indexOf(this.qualityTier) - 1]!
            this.switchQualityTier(lowerTier, true)
          }
        }
      }
    } else if (this.avgFrameDelta < 0.0152) {
      // > 65 FPS headroom: gently step resolution back up toward the tier's target
      this.consecutiveFastFrames++
      this.consecutiveSlowFrames = 0
      this.slowFramesAtMinDPR = 0
      // Only step back up after ~4s of headroom and well after the last drop, so resolution doesn't
      // oscillate (each change resizes the canvas, which reads as a visible pop / seam)
      if (
        this.consecutiveFastFrames > 240 &&
        this.currentDPR < this.baseDPR &&
        performance.now() - this.lastDprDropTime > 15000
      ) {
        this.currentDPR = Math.min(this.baseDPR, Math.round((this.currentDPR + 0.05) * 100) / 100)
        this.renderer.setPixelRatio(this.currentDPR)
        this.consecutiveFastFrames = 0
      }
    }

    // Periodic stats emission to UI (~2x per second)
    this.framesSinceStatsEmit++
    if (this.framesSinceStatsEmit >= 30) {
      this.framesSinceStatsEmit = 0
      this.emitPerformanceStats()
    }
  }

  private setRoomLightsActive(room: CustomRoomData, active: boolean) {
    for (const light of room.lights) {
      if (light instanceof THREE.AmbientLight) light.visible = active
      else light.active = active
    }
  }

  /**
   * Zone-based light culling. Only toggles ambient lights (which never affect shader compilation),
   * zone masks on the always-present study lights, and the `active` flag of virtual fixtures.
   */
  public updateSpatialLights(force = false) {
    const px = this.isExploreMode ? this.playerPos.x : 0
    const zone = this.currentZone

    if (!force && zone === this.lastSpatialCheckZone && Math.abs(px - this.lastSpatialCheckX) < 0.7) {
      return
    }
    this.lastSpatialCheckZone = zone
    this.lastSpatialCheckX = px

    // Occlusion by zone: interiors render only when you're inside or can see in through an open door
    this.studyGardenGroup.visible = zone === 'study-room'
    for (const room of this.customRooms.values()) {
      room.interior.visible = zone === room.id || (zone !== 'study-room' && room.isDoorOpen)
    }

    if (zone === 'study-room') {
      for (const spot of this.hallwaySpotLights) spot.active = false
      if (this.hallwayLeftLight) this.hallwayLeftLight.active = false
      if (this.hallwayRightLight) this.hallwayRightLight.active = false
      // Ambient light is global, so only the zone you're in contributes it
      if (this.hallwayAmbientLight) this.hallwayAmbientLight.visible = false

      for (const room of this.customRooms.values()) this.setRoomLightsActive(room, false)

      this.ambientLight.visible = true
      this.zoneMask.sun = 1
      this.zoneMask.lamp = 1
      this.zoneMask.moon = 1
      this.heroBookGlow.active = this.state === 'room-view' && !this.isExploreMode
    } else if (zone === 'hallway') {
      this.zoneMask.sun = 0
      this.zoneMask.lamp = 0
      this.zoneMask.moon = 0
      this.heroBookGlow.active = false

      if (this.hallwayAmbientLight) this.hallwayAmbientLight.visible = true
      // The pool lights the nearest fixtures; switching the corridor off fades them via intensity
      for (const spot of this.hallwaySpotLights) spot.active = true
      if (this.hallwayLeftLight) this.hallwayLeftLight.active = true
      if (this.hallwayRightLight) this.hallwayRightLight.active = true

      // Custom room lights: only spill into the corridor if the door is open or the player is near it
      for (const room of this.customRooms.values()) {
        this.setRoomLightsActive(room, room.isDoorOpen || Math.abs(room.doorX - px) < 3.5)
      }

      this.ambientLight.visible = false
    } else {
      // Inside a custom room
      this.zoneMask.sun = 0
      this.zoneMask.lamp = 0
      this.zoneMask.moon = 0
      this.heroBookGlow.active = false
      this.ambientLight.visible = false

      for (const [id, room] of this.customRooms.entries()) {
        this.setRoomLightsActive(room, id === zone)
      }

      // Corridor light only spills in through an open door
      const here = this.customRooms.get(zone)
      for (const spot of this.hallwaySpotLights) {
        spot.active = !!here?.isDoorOpen && Math.abs(spot.position.x - px) < 4.5
      }
      if (this.hallwayLeftLight) this.hallwayLeftLight.active = false
      if (this.hallwayRightLight) this.hallwayRightLight.active = false
      if (this.hallwayAmbientLight) this.hallwayAmbientLight.visible = false
    }
  }

  /** Applies zone masks and maps the nearest active virtual fixtures onto the fixed real light pools. */
  private syncLightPools() {
    this.sunLight.intensity = this.lightLevels.sun * this.zoneMask.sun
    this.lampLight.intensity = this.lightLevels.lamp * this.zoneMask.lamp
    this.moonLight.intensity = this.lightLevels.moon * this.zoneMask.moon

    this.assignLightPool(this.spotFixtures, this.spotPool)
    this.assignLightPool(this.pointFixtures, this.pointPool)
  }

  private assignLightPool(fixtures: VirtualLight[], pool: Array<THREE.SpotLight | THREE.PointLight>) {
    const origin = this.camera.position
    const radius = this.preset.lightRadius
    const candidates = this._fixtureCandidates
    let count = 0

    for (const light of fixtures) {
      if (!light.active || light.intensity <= 0.001) continue
      const dist = light === this.heroBookGlow
        ? 0
        : Math.hypot(light.position.x - origin.x, light.position.z - origin.z)
      if (dist >= radius) continue
      const slot = candidates[count] || (candidates[count] = { light, dist })
      slot.light = light
      slot.dist = dist
      count++
    }

    // Insertion sort by distance (a handful of entries, no allocation)
    for (let i = 1; i < count; i++) {
      const item = candidates[i]!
      const { light, dist } = item
      let j = i - 1
      while (j >= 0 && candidates[j]!.dist > dist) {
        candidates[j + 1]!.light = candidates[j]!.light
        candidates[j + 1]!.dist = candidates[j]!.dist
        j--
      }
      candidates[j + 1]!.light = light
      candidates[j + 1]!.dist = dist
    }

    for (let i = 0; i < pool.length; i++) {
      const real = pool[i]!
      if (i >= count) {
        real.intensity = 0
        continue
      }
      const { light: v, dist } = candidates[i]!
      // Fade fixtures out over the last 1.5m of the radius so pool hand-offs never pop
      const fade = THREE.MathUtils.clamp((radius - dist) / 1.5, 0, 1)
      real.intensity = v.intensity * fade
      real.color.copy(v.color)
      real.distance = v.distance
      real.decay = v.decay
      real.position.copy(v.position)
      if (real instanceof THREE.SpotLight) {
        real.angle = v.angle
        real.penumbra = v.penumbra
        real.target.position.copy(v.target)
      }
    }
  }

  // =========================================================
  // MATERIAL PALETTE, ASSETS & SHADER HELPERS
  // =========================================================

  private createPalette(): RoomPalette {
    const pbr = this.pbr
    const flat = (params: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(params)
    // Shoji / lantern paper glows a little, as if lit from behind; dims when the lights go out
    this.studyPaperGlow = flat({
      name: 'study-paper-glow',
      color: '#f3ead6',
      emissive: '#ffe4b8',
      emissiveIntensity: 0.55,
      roughness: 0.92,
      side: THREE.DoubleSide,
    })
    return {
      // The veneer scans are neutral grey / beige: tint them into warm walnut and a dark smoked oak
      walnut: pbr.material('walnut', { color: '#c58457', roughness: 0.85, worldUV: true, name: 'walnut' }),
      walnutDark: pbr.material('darkWalnut', { color: '#6e4b33', roughness: 0.9, worldUV: true, name: 'walnut-dark' }),
      brass: flat({ color: '#c9a24a', metalness: 1, roughness: 0.32, name: 'brass' }),
      ceramic: flat({ color: '#efe9df', roughness: 0.3, name: 'ceramic' }),
      celadon: flat({ color: '#93b09c', roughness: 0.22, name: 'celadon' }),
      paperGlow: this.studyPaperGlow,
      paper: flat({ color: '#efe7d6', roughness: 0.92, name: 'paper' }),
      stone: pbr.material('plaster', { noColorMap: true, color: '#8f8b83', repeat: [2, 2], roughness: 1, name: 'stone' }),
      cushionIndigo: pbr.material('hessian', { noColorMap: true, color: '#2e3d63', repeat: [3, 3], name: 'cushion-indigo' }),
      cushionRust: pbr.material('hessian', { noColorMap: true, color: '#7a3a26', repeat: [3, 3], name: 'cushion-rust' }),
      linenGreen: pbr.material('hessian', { noColorMap: true, color: '#2c4636', repeat: [7, 4], normalScale: 0.6, name: 'linen-green' }),
      leaf: flat({ color: '#4f7a3a', roughness: 0.7, name: 'leaf' }),
      leafDark: flat({ color: '#2d5428', roughness: 0.75, name: 'leaf-dark' }),
      blossom: flat({ color: '#f2b8c6', roughness: 0.6, name: 'blossom' }),
      bark: pbr.material('darkWalnut', { color: '#5a3d2b', roughness: 1, worldUV: true, name: 'bark' }),
      iron: flat({ color: '#2b2b2b', metalness: 0.6, roughness: 0.5, name: 'iron' }),
      glass: flat({
        color: '#dfe9ee',
        transparent: true,
        opacity: 0.1,
        roughness: 0.04,
        metalness: 0,
        depthWrite: false,
        name: 'glass',
      }),
    }
  }

  /** Cream plaster walls: the clay scan's relief under a light colour, tiled every ~1.2m. */
  private plasterMaterial(width: number, height: number): THREE.MeshStandardMaterial {
    return this.pbr.material('plaster', {
      noColorMap: true,
      color: '#efe6d6',
      repeat: [width / 1.2, height / 1.2],
      normalScale: 0.7,
    })
  }

  private _worldPlaster: THREE.MeshStandardMaterial | null = null

  /** Plaster for box walls of any size: UVs projected in metres (one tile per 1.2m). */
  private get worldPlaster(): THREE.MeshStandardMaterial {
    if (!this._worldPlaster) {
      this._worldPlaster = this.pbr.material('plaster', {
        noColorMap: true,
        color: '#efe6d6',
        normalScale: 0.7,
        worldUV: true,
        name: 'plaster-world',
      })
      this._worldPlaster.userData.worldUVTile = 1.2
    }
    return this._worldPlaster
  }

  private darkCedarCeiling(width: number, depth: number): THREE.MeshStandardMaterial {
    return this.pbr.material('cedar', {
      color: '#5e4130',
      repeat: [width / 0.9, depth / 0.9],
      rotation: Math.PI / 2,
      roughness: 1,
    })
  }

  private static readonly NOREN_COLORS = ['#2e3d63', '#2e3d63', '#2d4a36', '#6b2430', '#7a5a1f', '#2f4f5f', '#5a2d5f']

  /** Split noren curtain over a corridor doorway, coloured per room so doors are easy to tell apart. */
  private addDoorwayNoren(parent: THREE.Object3D, doorX: number, roomIndex: number) {
    const colors = JapaneseRoomService.NOREN_COLORS
    const cloth = this.pbr.material('hessian', {
      noColorMap: true,
      color: colors[roomIndex % colors.length],
      repeat: [2, 1],
      side: THREE.DoubleSide,
      name: `noren-${roomIndex}-${doorX}`,
    })
    this.applySway(cloth, '(1.0 - uv.y) * (1.0 - uv.y)', 0.035, 1.3, 'z')
    const noren = createNoren(this.palette, cloth, 1.5, 0.7)
    noren.position.set(doorX, 2.86, 3.99)
    parent.add(noren)
  }

  /** Themed chamber furniture with explore-mode colliders and contact shadows. */
  private furnishRoom(
    group: THREE.Group,
    theme: CustomRoomData['theme'],
    sx: number,
    lights: RoomLight[],
    colliders: RoomCollider[],
    glowMaterials: THREE.MeshStandardMaterial[]
  ) {
    const p = this.palette
    const decals: Array<[number, number, number, number]> = []
    const place = <T extends THREE.Object3D>(obj: T, x: number, z: number, rotY = 0, y = obj.position.y): T => {
      obj.position.set(x, y, z)
      obj.rotation.y = rotY
      group.add(obj)
      return obj
    }
    const collide = (x: number, z: number, hx: number, hz: number) => colliders.push({ x, z, hx, hz })
    const glow = (emissive: string, intensity: number) => {
      const m = new THREE.MeshStandardMaterial({
        name: `room-glow-${sx}-${glowMaterials.length}`,
        color: '#f3ead6',
        emissive,
        emissiveIntensity: intensity,
        roughness: 0.9,
        side: THREE.DoubleSide,
      })
      m.userData.onIntensity = intensity
      glowMaterials.push(m)
      return m
    }
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.castShadow = true
      m.receiveShadow = true
      group.add(m)
      return m
    }

    // Trim: baseboards and ceiling cornice on three walls
    box(5.0, 0.09, 0.02, p.walnutDark, sx, 0.045, -0.29)
    box(0.02, 0.09, 4.18, p.walnutDark, sx - 2.49, 0.045, 1.79)
    box(0.02, 0.09, 4.18, p.walnutDark, sx + 2.49, 0.045, 1.79)
    box(5.0, 0.07, 0.05, p.walnutDark, sx, 3.86, -0.275)
    box(0.05, 0.07, 4.18, p.walnutDark, sx - 2.475, 3.86, 1.79)
    box(0.05, 0.07, 4.18, p.walnutDark, sx + 2.475, 3.86, 1.79)

    if (theme === 'library') {
      place(createBookWall(p, 3.6, 2.6, 0.4), sx, 0.12)
      collide(sx, -0.1, 1.9, 0.32)
      place(createArmchair(p, p.cushionRust), sx + 1.25, 1.45, -0.45)
      collide(sx + 1.25, 1.45, 0.5, 0.5)
      place(createFloorLamp(p, glow('#ffd29a', 0.9)), sx + 1.95, 0.75)
      collide(sx + 1.95, 0.75, 0.2, 0.2)
      const rug = new THREE.Mesh(
        new THREE.PlaneGeometry(1.7, 2.5),
        new THREE.MeshStandardMaterial({ map: createRugTexture(), roughness: 1 })
      )
      rug.rotation.x = -Math.PI / 2
      rug.position.set(sx - 0.3, 0.006, 1.9)
      rug.receiveShadow = true
      group.add(rug)
      decals.push([sx, -0.05, 3.9, 0.8], [sx + 1.25, 1.45, 1.1, 1.0], [sx + 1.95, 0.75, 0.45, 0.45])
    } else if (theme === 'meditation') {
      place(createStoneLantern(p, glow('#ffc878', 1.0)), sx - 1.7, 1.0)
      collide(sx - 1.7, 1.0, 0.32, 0.32)
      const candle = createVirtualLight('point', '#fef08a', 0.8, 5, 2, new THREE.Vector3(sx - 1.7, 0.62, 1.0))
      lights.push(candle)
      this.pointFixtures.push(candle)

      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 28), p.walnut)
      pedestal.castShadow = true
      place(pedestal, sx + 1.7, 0.75, 0, 0.35)
      place(createBonsai(p, 1.5), sx + 1.7, 0.75, 0.4, 0.7)
      collide(sx + 1.7, 0.75, 0.38, 0.38)

      // Low table with tea off to the side, clear of the walk from the door to the cushions
      place(createChabudai(p), sx + 1.45, 2.55)
      const tea = createTeaSet(p)
      place(tea, sx + 1.45, 2.55, 0.6, 0.3375)
      collide(sx + 1.45, 2.55, 0.48, 0.48)

      // The monk sits facing the door; an empty zabuton waits opposite for the visitor
      const robe = this.pbr.material('hessian', { noColorMap: true, color: '#2b2b31', repeat: [3, 3], normalScale: 0.5, name: `monk-robe-${sx}` })
      const kesa = this.pbr.material('hessian', { noColorMap: true, color: '#7d5a28', repeat: [2, 2], name: `monk-kesa-${sx}` })
      const skin = new THREE.MeshStandardMaterial({ color: '#c79a78', roughness: 0.55, name: `monk-skin-${sx}` })
      const monk = createSeatedMonk(p.cushionIndigo, robe, kesa, skin)
      place(monk.group, sx, 0.95)
      collide(sx, 0.95, 0.5, 0.45)
      this.monks.push({ ...monk, roomId: '', seat: new THREE.Vector3(sx, 0, 2.25) })
      place(createZabuton(p.cushionIndigo), sx, 2.25)

      // Picture window onto a raked karesansui garden
      box(3.1, 1.5, 0.06, p.walnutDark, sx, 1.55, -0.27)
      const sand = new THREE.Mesh(new THREE.PlaneGeometry(2.92, 1.32), this.gardenLayerMaterial(createSandGardenTexture(), false))
      sand.position.set(sx, 1.55, -0.235)
      group.add(sand)
      box(0.04, 1.32, 0.03, p.walnutDark, sx - 0.97, 1.55, -0.225)
      box(0.04, 1.32, 0.03, p.walnutDark, sx + 0.97, 1.55, -0.225)
      box(3.2, 0.04, 0.14, p.walnutDark, sx, 0.79, -0.22)
      decals.push([sx - 1.7, 1.0, 0.75, 0.75], [sx + 1.7, 0.75, 0.85, 0.85], [sx + 1.45, 2.55, 1.3, 1.3], [sx, 0.95, 1.0, 1.0])
    } else if (theme === 'gallery') {
      place(createFramedPainting(p, 'mountains', 0.8, 1.0), sx - 1.1, -0.3, 0, 1.65)
      place(createFramedPainting(p, 'enso', 0.8, 1.0), sx + 1.1, -0.3, 0, 1.65)
      place(createFramedPainting(p, 'bamboo', 0.7, 0.95), sx - 2.5, 1.8, Math.PI / 2, 1.65)
      place(createFramedPainting(p, 'wave', 0.7, 0.95), sx + 2.5, 1.8, -Math.PI / 2, 1.65)
      const easelCanvas = new THREE.MeshStandardMaterial({ map: createPaintingTexture('wave'), roughness: 0.9 })
      place(createEasel(p, easelCanvas), sx, 1.25)
      collide(sx, 1.25, 0.55, 0.45)
      place(createBench(p, 1.6), sx + 1.5, 2.6, Math.PI / 2)
      collide(sx + 1.5, 2.6, 0.25, 0.85)
      decals.push([sx, 1.25, 1.0, 0.8], [sx + 1.5, 2.6, 0.6, 1.8])
    } else {
      // Observatory & study: writing desk, chair, globe, telescope, star chart
      place(createDesk(p, { width: 1.6, depth: 0.75, drawers: 2, mat: false }), sx, 0.35)
      collide(sx, 0.35, 0.85, 0.42)
      place(createChair(p), sx, 1.0)
      collide(sx, 1.0, 0.3, 0.28)
      place(createGlobe(p, new THREE.MeshStandardMaterial({ map: createGlobeTexture(), roughness: 0.45 })), sx - 1.6, 1.5)
      collide(sx - 1.6, 1.5, 0.35, 0.35)
      place(createTelescope(p), sx + 1.7, 1.7)
      collide(sx + 1.7, 1.7, 0.3, 0.3)
      box(1.7, 1.15, 0.04, p.walnutDark, sx, 1.85, -0.28)
      const chartTex = createWallMapTexture()
      const chart = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.05),
        new THREE.MeshStandardMaterial({ map: chartTex, emissiveMap: chartTex, emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.95 })
      )
      chart.position.set(sx, 1.85, -0.257)
      group.add(chart)
      decals.push([sx, 0.35, 1.9, 1.1], [sx, 1.0, 0.75, 0.7], [sx - 1.6, 1.5, 0.8, 0.8], [sx + 1.7, 1.7, 0.7, 0.7])
    }

    this.buildShadowDecals(group, decals)
  }

  /**
   * renderer.compile() skips hidden objects, so briefly reveal everything (hero book, room interiors,
   * hands) and compile every shader up front instead of stuttering the first time each appears.
   */
  private warmUpShaders() {
    const hidden: THREE.Object3D[] = []
    this.scene.traverse((obj) => {
      if (!obj.visible) {
        hidden.push(obj)
        obj.visible = true
      }
    })
    this.renderer.compile(this.scene, this.camera)
    for (const obj of hidden) obj.visible = false
  }

  private loadHands() {
    const skin = new THREE.MeshStandardMaterial({ color: '#d39b78', roughness: 0.55, name: 'hand-skin' })
    const sleeve = this.pbr.material('hessian', { noColorMap: true, color: '#2e3d63', repeat: [2, 3], name: 'hand-sleeve' })
    void HandRig.load('/models/hands/hand_right.glb', skin, sleeve, this.loadingManager).then((rig) => {
      if (!rig) return
      this.handRight = rig
      this.heroBookGroup.add(rig.root)
      this.warmUpShaders()
    })
    void HandRig.load('/models/hands/hand_left.glb', skin, sleeve, this.loadingManager).then((rig) => {
      if (!rig) return
      this.handLeft = rig
      this.heroBookGroup.add(rig.root)
      this.warmUpShaders()
    })
  }

  /**
   * Gentle wind sway in the vertex shader (no CPU cost): bamboo, noren curtains. `weight` is a GLSL
   * expression of `uv` giving how strongly each vertex moves (0 = pinned).
   */
  private applySway(material: THREE.Material, weight: string, amplitude: number, speed: number, axis: 'x' | 'z') {
    const uniforms = this.swayUniforms
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float swayW = ${weight};
        float swayPhase = position.x * 1.7 + position.z * 1.3;
        transformed.${axis} += swayW * ${amplitude.toFixed(4)} * (sin(uTime * ${speed.toFixed(3)} + swayPhase) + 0.35 * sin(uTime * ${(speed * 2.3).toFixed(3)} + swayPhase * 2.1));`
      )
    }
    material.customProgramCacheKey = () => `sway-${weight}-${amplitude}-${speed}-${axis}`
  }

  private gardenLayerMaterial(
    map: THREE.Texture,
    transparentCutout: boolean,
    nightList?: THREE.MeshBasicMaterial[]
  ): THREE.MeshBasicMaterial {
    const mat = new THREE.MeshBasicMaterial({
      map,
      alphaTest: transparentCutout ? 0.45 : 0,
      side: THREE.FrontSide,
      fog: false,
    })
    nightList?.push(mat)
    return mat
  }

  /**
   * Three parallax planes (sky/mountains, maples, swaying bamboo) behind a window. `origin` is the
   * window centre, `outward` the unit direction away from the room.
   */
  private buildGardenLayers(
    parent: THREE.Object3D,
    origin: THREE.Vector3,
    outward: THREE.Vector3,
    width: number,
    clampAlong?: [number, number],
    nightList?: THREE.MeshBasicMaterial[]
  ) {
    const yaw = Math.atan2(-outward.x, -outward.z) // plane faces back into the room
    // Horizontal axis of the window wall (world X or Z)
    const alongZ = Math.abs(outward.x) > Math.abs(outward.z)
    const originAlong = alongZ ? origin.z : origin.x
    const layers: Array<{ tex: THREE.Texture; dist: number; w: number; h: number; y: number; cutout: boolean; sway?: boolean; repeat: number }> = [
      // Widths cover the steep viewing angles from the far end of the room through the window
      { tex: createGardenFarLayer(), dist: 4.2, w: width * 3.6 + 10, h: 8, y: 2.6, cutout: false, repeat: Math.max(2, Math.round((width * 3.6 + 10) / 12)) },
      { tex: createGardenMidLayer(), dist: 2.4, w: width * 2.6 + 6, h: 4.2, y: 2.0, cutout: true, repeat: Math.max(2, Math.round((width * 2.6 + 6) / 9)) },
      { tex: createGardenNearLayer(), dist: 0.9, w: width * 1.9 + 2, h: 6, y: 2.9, cutout: true, sway: true, repeat: Math.max(2, Math.round((width * 1.9 + 2) / 5)) },
    ]
    // Mossy ground running out from the window under all layers: looking down through the glass
    // used to show empty background beneath the garden planes
    {
      let lo = originAlong - (width * 3.6 + 10) / 2
      let hi = originAlong + (width * 3.6 + 10) / 2
      if (clampAlong) {
        lo = Math.max(lo, clampAlong[0])
        hi = Math.min(hi, clampAlong[1])
      }
      const groundMat = new THREE.MeshBasicMaterial({ color: '#5a7a45', fog: false })
      nightList?.push(groundMat)
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(hi - lo, 4.6), groundMat)
      ground.rotation.x = -Math.PI / 2
      ground.rotation.z = alongZ ? Math.PI / 2 : 0
      ground.position.copy(origin).addScaledVector(outward, 2.35)
      ground.position.y = -0.02
      if (alongZ) ground.position.z = (lo + hi) / 2
      else ground.position.x = (lo + hi) / 2
      parent.add(ground)
    }
    for (const layer of layers) {
      layer.tex.wrapS = THREE.RepeatWrapping
      layer.tex.repeat.set(layer.repeat, 1)
      const mat = this.gardenLayerMaterial(layer.tex, layer.cutout, nightList)
      if (layer.sway) this.applySway(mat, 'uv.y * uv.y', 0.06, 0.9, 'x')
      let lo = originAlong - layer.w / 2
      let hi = originAlong + layer.w / 2
      if (clampAlong) {
        lo = Math.max(lo, clampAlong[0])
        hi = Math.min(hi, clampAlong[1])
      }
      const w = hi - lo
      layer.tex.repeat.x = Math.max(1, Math.round((layer.repeat * w) / layer.w))
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, layer.h, layer.sway ? 24 : 1, layer.sway ? 6 : 1), mat)
      mesh.position.copy(origin).addScaledVector(outward, layer.dist)
      if (alongZ) mesh.position.z = (lo + hi) / 2
      else mesh.position.x = (lo + hi) / 2
      mesh.position.y = layer.y
      mesh.rotation.y = yaw
      parent.add(mesh)
    }
  }

  /** One merged, transparent mesh of soft contact-shadow blobs on a floor (or desk) plane. */
  private buildShadowDecals(parent: THREE.Object3D, decals: Array<[x: number, z: number, w: number, d: number]>, y = 0.004, opacity = 0.55) {
    if (decals.length === 0) return
    const geometries = decals.map(([x, z, w, d]) => {
      const g = new THREE.PlaneGeometry(w, d)
      g.rotateX(-Math.PI / 2)
      g.translate(x, y, z)
      return g
    })
    const merged = mergeGeometries(geometries, false)
    geometries.forEach((g) => g.dispose())
    if (!merged) return
    const mat = new THREE.MeshBasicMaterial({
      map: createSoftShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
    const mesh = new THREE.Mesh(merged, mat)
    mesh.renderOrder = 1
    parent.add(mesh)
  }

  private setupLighting() {
    // Warm atmospheric ambient fill
    this.ambientLight = new THREE.AmbientLight(0xffeed8, 0.75)
    this.scene.add(this.ambientLight)

    const shadowSize = this.preset.shadowMapSize

    // Shoji Screen Sunlight (soft directional streaming from left garden terrace)
    this.sunLight = new THREE.DirectionalLight(0xfffae5, this.lightLevels.sun)
    this.sunLight.position.set(-4.5, 4.2, 0.5)
    this.sunLight.castShadow = this.preset.sunShadow
    this.sunLight.shadow.mapSize.width = shadowSize
    this.sunLight.shadow.mapSize.height = shadowSize
    this.sunLight.shadow.camera.near = 0.5
    this.sunLight.shadow.camera.far = 18
    this.sunLight.shadow.camera.left = -5
    this.sunLight.shadow.camera.right = 5
    this.sunLight.shadow.camera.top = 5
    this.sunLight.shadow.camera.bottom = -5
    this.sunLight.shadow.bias = -0.0005
    this.scene.add(this.sunLight)

    // Warm Gooseneck Desk Lamp (Optimized SpotLight with single 2D shadow map instead of 6-sided cubemap)
    this.lampLight = new THREE.SpotLight(0xffa534, this.lightLevels.lamp, 5.0, Math.PI / 3.0, 0.45, 1.2)
    this.lampLight.position.set(-0.65, 1.22, -0.45)
    this.lampLight.target.position.set(0, 0.85, -0.44)
    this.scene.add(this.lampLight.target)
    this.lampLight.castShadow = true
    this.lampLight.shadow.bias = -0.0015
    this.lampLight.shadow.mapSize.width = shadowSize
    this.lampLight.shadow.mapSize.height = shadowSize
    this.lampLight.shadow.camera.near = 0.2
    this.lampLight.shadow.camera.far = 4.0
    this.scene.add(this.lampLight)

    // Cool Moonlight (streaming from left garden; fades in when the study lights are switched off)
    this.moonLight = new THREE.DirectionalLight(0x60a5fa, this.lightLevels.moon)
    this.moonLight.position.set(-5, 3.5, -1)
    this.scene.add(this.moonLight)

    // Magical blue glow over the hero book section on the front bookshelf
    this.heroBookGlow = createVirtualLight('point', 0x38bdf8, 1.1, 2.0, 1.0, new THREE.Vector3(0.45, 2.2, -2.35))
    this.pointFixtures.push(this.heroBookGlow)

    // Fixed pools of real lights for corridor / room fixtures. Their count never changes at runtime.
    for (let i = 0; i < this.preset.spotPoolSize; i++) {
      const spot = new THREE.SpotLight(0xffffff, 0)
      this.scene.add(spot)
      this.scene.add(spot.target)
      this.spotPool.push(spot)
    }
    for (let i = 0; i < this.preset.pointPoolSize; i++) {
      const point = new THREE.PointLight(0xffffff, 0)
      this.scene.add(point)
      this.pointPool.push(point)
    }
  }

  private buildRoomArchitecture() {
    const p = this.palette

    // 1. Tatami floor (one texture tile = two 0.9 x 1.8m mats)
    const floorMat = this.pbr.material('tatami', { repeat: [6.0 / 1.8, 6.98 / 1.8], roughness: 0.95 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 6.98), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, 0.001, 0.39)
    floor.receiveShadow = true
    this.scene.add(floor)

    // 2. Back wall (behind the bookshelf) and right wall: cream clay plaster
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 3.9), this.plasterMaterial(6.0, 3.9))
    backWall.position.set(0, 1.95, -3.1)
    backWall.receiveShadow = true
    this.scene.add(backWall)

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6.98, 3.9), this.plasterMaterial(6.98, 3.9))
    rightWall.position.set(3.0, 1.95, 0.39)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.receiveShadow = true
    this.scene.add(rightWall)

    // 3. Left wall: yukimi-shoji screens with a clear band looking onto the garden
    const shoji = createShojiWall(p, 6.98, { transom: this.plasterMaterial(6.98, 1.0) })
    shoji.rotation.y = Math.PI / 2
    // Set 6cm into the study: the dojo's wall shares the x = -3 plane, so nothing may poke through it
    shoji.position.set(-2.94, 0, 0.39)
    this.scene.add(shoji)

    // Parallax garden: sky + mountains, maples, swaying bamboo
    // Clamped so the layers never reach the corridor (z > 3.85); shown only from inside the study
    // because the meditation dojo occupies the space beyond this window.
    this.scene.add(this.studyGardenGroup)
    this.buildGardenLayers(this.studyGardenGroup, new THREE.Vector3(-3.0, 0, 0.39), new THREE.Vector3(-1, 0, 0), 6.98, [-30, 3.85], this.studyGardenMaterials)

    // 4. Tokonoma alcove on the right wall holding the calligraphy scroll, ikebana and a small andon
    const tokonoma = createTokonoma(p, 1.6, 0.5)
    tokonoma.rotation.y = -Math.PI / 2
    tokonoma.position.set(3.0, 0, 0.4)
    const ikebana = createIkebana(p)
    ikebana.position.set(0.45, 0.14, 0.24)
    tokonoma.add(ikebana)
    const alcoveAndon = createSmallAndon(p)
    alcoveAndon.position.set(-0.5, 0.14, 0.26)
    tokonoma.add(alcoveAndon)
    this.scene.add(tokonoma)

    // Hanging Japanese Calligraphy Scroll on Right Wall
    const scrollWoodMat = new THREE.MeshStandardMaterial({ color: '#27160c' })
    const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 16), scrollWoodMat)
    topRod.rotation.z = Math.PI / 2
    topRod.position.set(2.96, 2.7, 0.4)
    this.scene.add(topRod)

    const scrollGeo = new THREE.PlaneGeometry(0.85, 1.4)
    const scrollCanvas = document.createElement('canvas')
    scrollCanvas.width = 256
    scrollCanvas.height = 512
    const sCtx = scrollCanvas.getContext('2d')!
    sCtx.fillStyle = '#f8f4ec'
    sCtx.fillRect(0, 0, 256, 512)
    sCtx.strokeStyle = '#c5a059'
    sCtx.lineWidth = 4
    sCtx.strokeRect(12, 12, 232, 488)
    sCtx.fillStyle = '#1e1c18'
    sCtx.font = 'bold 54px serif'
    sCtx.textAlign = 'center'
    sCtx.fillText('学', 128, 160)
    sCtx.fillText('問', 128, 235)
    sCtx.font = 'bold 36px serif'
    sCtx.fillText('探求', 128, 320)
    sCtx.fillStyle = '#b91c1c'
    sCtx.fillRect(108, 380, 40, 40)
    sCtx.fillStyle = '#ffffff'
    sCtx.font = 'bold 20px serif'
    sCtx.fillText('印', 128, 408)

    const scrollTex = new THREE.CanvasTexture(scrollCanvas)
    scrollTex.colorSpace = THREE.SRGBColorSpace
    const scrollMesh = new THREE.Mesh(scrollGeo, new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.9 }))
    scrollMesh.position.set(2.97, 2.05, 0.4)
    scrollMesh.rotation.y = -Math.PI / 2
    this.scene.add(scrollMesh)

    // 5. Ceiling: dark cedar boards with walnut beams, plus perimeter trim and baseboards
    const ceilingMat = this.pbr.material('cedar', {
      color: '#6b4a36',
      repeat: [6.0 / 0.9, 6.98 / 0.9],
      rotation: Math.PI / 2,
      roughness: 1,
    })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(6.0, 6.98), ceilingMat)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(0, 3.9, 0.39)
    this.scene.add(ceiling)

    for (let x = -2.0; x <= 2.0; x += 1.0) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 6.98), p.walnutDark)
      beam.position.set(x, 3.82, 0.39)
      beam.castShadow = true
      this.scene.add(beam)
    }

    const trim = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), p.walnutDark)
      m.position.set(x, y, z)
      m.receiveShadow = true
      this.scene.add(m)
    }
    trim(6.0, 0.09, 0.02, 0, 0.045, -3.09) // habaki baseboards
    trim(0.02, 0.09, 6.98, 2.99, 0.045, 0.39)
    trim(6.0, 0.07, 0.05, 0, 3.86, -3.075) // mawaribuchi ceiling trim
    trim(0.05, 0.07, 6.98, 2.975, 3.86, 0.39)
    trim(6.0, 0.4, 0.1, 0, 3.7, -3.05) // top beam over the bookshelf wall

    // Soft contact shadows grounding the furniture
    this.buildShadowDecals(this.scene, [
      [0, -0.5, 2.7, 1.5], // desk
      [0, 0.28, 0.8, 0.75], // chair
      [0, -2.5, 3.8, 0.7], // bookshelf
      [2.75, 0.4, 0.7, 1.8], // tokonoma
    ])
  }

  private buildJapaneseDesk() {
    // Solid walnut writing desk (top surface at y = 0.795) and Ming-style yoke-back chair
    const desk = createDesk(this.palette)
    desk.position.set(0, 0, -0.5)
    this.scene.add(desk)

    const chair = createChair(this.palette)
    chair.position.set(0, 0, 0.28)
    this.scene.add(chair)

    // Kyusu teapot on a tray beside the tea cup
    const teaSet = createTeaSet(this.palette)
    teaSet.position.set(1.0, 0.795, -0.45)
    teaSet.rotation.y = -0.35
    this.scene.add(teaSet)

    // Shokendai Wooden Reading Stand
    this.buildBookStand()

    // Tactile Contact Shadows on Desk Surface (beneath book at y = 0.798, z = -0.42)
    const shadowTex = createContactShadowTexture()
    const shadowGeo = new THREE.PlaneGeometry(0.44, 0.56)

    const shadowMatRight = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.contactShadowRight = new THREE.Mesh(shadowGeo, shadowMatRight)
    this.contactShadowRight.rotation.x = -Math.PI / 2
    this.contactShadowRight.position.set(0.175, 0.820, -0.44)
    this.scene.add(this.contactShadowRight)

    const shadowMatLeft = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    this.contactShadowLeft = new THREE.Mesh(shadowGeo, shadowMatLeft)
    this.contactShadowLeft.rotation.x = -Math.PI / 2
    this.contactShadowLeft.position.set(-0.175, 0.820, -0.44)
    this.scene.add(this.contactShadowLeft)

    // 1. Curved Brass / Gooseneck Desk Lamp (Left of Desk - Frame 1, 3, 4, 8, 9)
    const lampGroup = new THREE.Group()
    lampGroup.position.set(-0.78, 0.795, -0.48)

    // Heavy Circular Brass Base
    const lampBaseGeo = new THREE.CylinderGeometry(0.10, 0.11, 0.024, 24)
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      metalness: 0.8,
      roughness: 0.28,
    })
    const lampBase = new THREE.Mesh(lampBaseGeo, brassMat)
    lampBase.position.y = 0.012
    lampBase.castShadow = true
    lampGroup.add(lampBase)

    // Curved Gooseneck Arm
    const curvePoints = []
    for (let t = 0; t <= 1; t += 0.1) {
      const ay = 0.02 + Math.sin(t * Math.PI * 0.8) * 0.42
      const ax = Math.sin(t * Math.PI * 0.5) * 0.12
      const az = Math.sin(t * Math.PI * 0.5) * 0.08
      curvePoints.push(new THREE.Vector3(ax, ay, az))
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints)
    const armGeo = new THREE.TubeGeometry(curve, 20, 0.012, 12, false)
    const armMesh = new THREE.Mesh(armGeo, brassMat)
    armMesh.castShadow = true
    lampGroup.add(armMesh)

    // Conic Lamp Shade (pointed down at book)
    const shadeGeo = new THREE.ConeGeometry(0.11, 0.16, 24, 1, true)
    const shadeMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      emissive: new THREE.Color('#ffaa33'),
      emissiveIntensity: 0.85,
      roughness: 0.35,
      side: THREE.DoubleSide,
    })
    this.lampShadeMesh = new THREE.Mesh(shadeGeo, shadeMat)
    this.lampShadeMesh.position.set(0.12, 0.42, 0.08)
    this.lampShadeMesh.rotation.z = -Math.PI * 0.25
    this.lampShadeMesh.rotation.x = Math.PI * 0.15
    this.lampShadeMesh.castShadow = true
    lampGroup.add(this.lampShadeMesh)

    // Glowing bulb inside the shade (emissive only; the SpotLight does the lighting)
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#fff4dc', emissive: '#ffd7a0', emissiveIntensity: 2.2, name: 'lamp-bulb' })
    )
    bulb.position.set(0.105, 0.395, 0.07)
    lampGroup.add(bulb)
    this.lampBulbMaterial = bulb.material as THREE.MeshStandardMaterial

    // Lamp Hit Box for clicking/hovering
    const lampHitGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.6, 16)
    const lampHitMat = new THREE.MeshBasicMaterial({ visible: false })
    this.lampTargetMesh = new THREE.Mesh(lampHitGeo, lampHitMat)
    this.lampTargetMesh.position.set(0.06, 0.28, 0.04)
    lampGroup.add(this.lampTargetMesh)

    this.scene.add(lampGroup)

    // 2. Wooden Pencil Cup with Colored Pencils (Left-Mid Desk - Frame 3, 4)
    const pencilCupGroup = new THREE.Group()
    pencilCupGroup.position.set(-0.46, 0.795, -0.62)

    const pCupGeo = new THREE.CylinderGeometry(0.044, 0.038, 0.11, 24)
    const pCupMat = new THREE.MeshStandardMaterial({
      map: createPencilCupTexture(),
      roughness: 0.45,
    })
    const pencilCup = new THREE.Mesh(pCupGeo, pCupMat)
    pencilCup.position.y = 0.055
    pencilCup.castShadow = true
    pencilCupGroup.add(pencilCup)

    // Colorful Pencils / Brushes sticking out
    const pencilColors = ['#0284c7', '#dc2626', '#eab308', '#16a34a', '#8b5cf6', '#475569']
    pencilColors.forEach((pColor, pIdx) => {
      const pLen = 0.16 + (pIdx % 3) * 0.02
      const pGeo = new THREE.CylinderGeometry(0.005, 0.005, pLen, 8)
      const pMat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.5 })
      const pencil = new THREE.Mesh(pGeo, pMat)
      const angle = (pIdx / pencilColors.length) * Math.PI * 2
      pencil.position.set(Math.cos(angle) * 0.018, 0.08 + pLen / 2, Math.sin(angle) * 0.018)
      pencil.rotation.z = Math.cos(angle) * 0.15
      pencil.rotation.x = Math.sin(angle) * 0.15
      pencilCupGroup.add(pencil)
    })
    this.scene.add(pencilCupGroup)

    // 3. Small Potted Succulent Plant (Right-Rear Desk - Frame 3, 4)
    const plantGroup = new THREE.Group()
    plantGroup.position.set(0.78, 0.795, -0.62)

    const potGeo = new THREE.CylinderGeometry(0.065, 0.048, 0.09, 24)
    const potMat = new THREE.MeshStandardMaterial({
      map: createPlantPotTexture(),
      roughness: 0.3,
    })
    const pot = new THREE.Mesh(potGeo, potMat)
    pot.position.y = 0.045
    pot.castShadow = true
    plantGroup.add(pot)

    // Soil
    const soilGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16)
    const soilMat = new THREE.MeshStandardMaterial({ color: '#27160c', roughness: 0.9 })
    const soil = new THREE.Mesh(soilGeo, soilMat)
    soil.position.y = 0.086
    plantGroup.add(soil)

    // Succulent Leaves (green rosettes)
    const leafMat1 = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.4 })
    const leafMat2 = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.35 })
    for (let ring = 0; ring < 8; ring++) {
      const lAngle = (ring / 8) * Math.PI * 2
      const leafGeo = new THREE.SphereGeometry(0.022, 12, 12)
      leafGeo.scale(1, 0.4, 2)
      const leaf = new THREE.Mesh(leafGeo, ring % 2 === 0 ? leafMat1 : leafMat2)
      leaf.position.set(Math.cos(lAngle) * 0.038, 0.105, Math.sin(lAngle) * 0.038)
      leaf.rotation.y = lAngle
      leaf.rotation.x = -0.3
      plantGroup.add(leaf)
    }
    this.scene.add(plantGroup)

    // 4. Authentic Ceramic Matcha Cup (Yunomi) & Coaster (Right-Front Desk)
    const saucerTex = createTeaSaucerTexture()
    const saucerMat = new THREE.MeshStandardMaterial({
      map: saucerTex,
      roughness: 0.5,
      metalness: 0.05,
    })

    const saucerGeo = new THREE.CylinderGeometry(0.075, 0.062, 0.014, 32)
    const saucer = new THREE.Mesh(saucerGeo, saucerMat)
    saucer.position.set(0.72, 0.802, -0.25)
    saucer.receiveShadow = true
    this.scene.add(saucer)

    // Interactive Tea Cup Group
    this.cupGroup = new THREE.Group()
    this.cupGroup.position.set(0.72, 0.809, -0.25)

    const cupPoints: THREE.Vector2[] = [
      new THREE.Vector2(0, 0.016),
      new THREE.Vector2(0.036, 0.016),
      new THREE.Vector2(0.041, 0.045),
      new THREE.Vector2(0.045, 0.082),
      new THREE.Vector2(0.047, 0.086),
      new THREE.Vector2(0.049, 0.084),
      new THREE.Vector2(0.050, 0.065),
      new THREE.Vector2(0.047, 0.035),
      new THREE.Vector2(0.041, 0.012),
      new THREE.Vector2(0.037, 0.008),
      new THREE.Vector2(0.036, 0.000),
      new THREE.Vector2(0.030, 0.000),
      new THREE.Vector2(0.029, 0.006),
      new THREE.Vector2(0, 0.006),
    ]
    const cupGeo = new THREE.LatheGeometry(cupPoints, 36)
    const cupTex = createCeramicCupTexture()
    const ceramicMat = new THREE.MeshStandardMaterial({
      map: cupTex,
      roughness: 0.22,
      metalness: 0.04,
      side: THREE.DoubleSide,
    })
    const cupMesh = new THREE.Mesh(cupGeo, ceramicMat)
    cupMesh.castShadow = true
    cupMesh.receiveShadow = true
    this.cupGroup.add(cupMesh)

    // Matcha liquid inside cup
    const matchaTex = createMatchaTexture()
    const teaGeo = new THREE.CylinderGeometry(0.0425, 0.040, 0.006, 36)
    const teaMat = new THREE.MeshStandardMaterial({
      map: matchaTex,
      roughness: 0.15,
      metalness: 0.05,
    })
    const teaMesh = new THREE.Mesh(teaGeo, teaMat)
    teaMesh.position.y = 0.064
    this.cupGroup.add(teaMesh)

    // Steam particles
    const steamTex = createSteamVaporTexture()
    const steamCount = 28
    const steamGeo = new THREE.BufferGeometry()
    const steamPositions = new Float32Array(steamCount * 3)
    for (let i = 0; i < steamCount; i++) {
      steamPositions[i * 3] = (Math.random() - 0.5) * 0.045
      steamPositions[i * 3 + 1] = 0.068 + Math.random() * 0.18
      steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.045
    }
    steamGeo.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3))
    const steamMat = new THREE.PointsMaterial({
      map: steamTex,
      size: 0.045,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })
    this.teaSteamParticles = new THREE.Points(steamGeo, steamMat)
    this.cupGroup.add(this.teaSteamParticles)

    // Tea Hit Box for clicking/hovering
    const cupHitGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.20, 16)
    const cupHitMat = new THREE.MeshBasicMaterial({ visible: false })
    this.cupTargetMesh = new THREE.Mesh(cupHitGeo, cupHitMat)
    this.cupTargetMesh.position.y = 0.07
    this.cupGroup.add(this.cupTargetMesh)

    this.scene.add(this.cupGroup)
  }

  // Authentic Japanese Shokendai (Wooden Book Reading Stand tilted at ~78° - 80°)
  private buildBookStand() {
    const standGroup = new THREE.Group()
    standGroup.position.set(0, 0.795, -0.48) // Rests securely on study desk surface

    const standWoodMat = this.palette.walnut
    const brassMat = this.palette.brass

    // 1. Base Plate (Horizontal board on desk)
    const baseGeo = new THREE.BoxGeometry(0.82, 0.024, 0.40)
    const baseMesh = new THREE.Mesh(baseGeo, standWoodMat)
    baseMesh.position.set(0, 0.012, 0.04)
    baseMesh.castShadow = true
    baseMesh.receiveShadow = true
    standGroup.add(baseMesh)

    // Brass corner protectors on base plate
    const cornerGeo = new THREE.BoxGeometry(0.045, 0.026, 0.045)
    const corners: [number, number][] = [
      [-0.39, -0.14],
      [0.39, -0.14],
      [-0.39, 0.22],
      [0.39, 0.22],
    ]
    corners.forEach(([cx, cz]) => {
      const cornerMesh = new THREE.Mesh(cornerGeo, brassMat)
      cornerMesh.position.set(cx, 0.012, cz)
      standGroup.add(cornerMesh)
    })

    // 2. Tilted Backrest Board (Shokendai easel backrest tilted at 78°)
    const tiltAngle = (78 * Math.PI) / 180
    const backrestGroup = new THREE.Group()
    backrestGroup.position.set(0, 0.035, 0.08)
    backrestGroup.rotation.x = tiltAngle

    // Backrest main board
    const backrestGeo = new THREE.BoxGeometry(0.78, 0.018, 0.48)
    const backrestMesh = new THREE.Mesh(backrestGeo, standWoodMat)
    backrestMesh.position.set(0, -0.01, -0.22)
    backrestMesh.castShadow = true
    backrestMesh.receiveShadow = true
    backrestGroup.add(backrestMesh)

    // Slatted Japanese Kumiko horizontal inlays on backrest
    const slatGeo = new THREE.BoxGeometry(0.74, 0.006, 0.015)
    const slatWoodMat = this.palette.walnutDark
    for (let sz = -0.40; sz <= -0.06; sz += 0.07) {
      const slatMesh = new THREE.Mesh(slatGeo, slatWoodMat)
      slatMesh.position.set(0, 0.002, sz)
      backrestGroup.add(slatMesh)
    }

    // 3. Bottom Retaining Ledge (Holds open book pages and spine in place)
    const ledgeGeo = new THREE.BoxGeometry(0.78, 0.036, 0.055)
    const ledgeMesh = new THREE.Mesh(ledgeGeo, standWoodMat)
    ledgeMesh.position.set(0, 0.015, 0.02)
    ledgeMesh.castShadow = true
    ledgeMesh.receiveShadow = true
    backrestGroup.add(ledgeMesh)

    // Brass trim strip along the front of the retaining ledge
    const trimGeo = new THREE.BoxGeometry(0.782, 0.008, 0.01)
    const trimMesh = new THREE.Mesh(trimGeo, brassMat)
    trimMesh.position.set(0, 0.032, 0.046)
    backrestGroup.add(trimMesh)

    // Classic brass page clip weights (swivel page holders at left and right)
    const clipGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.07, 12)
    const clipLeft = new THREE.Mesh(clipGeo, brassMat)
    clipLeft.position.set(-0.33, 0.038, 0.01)
    clipLeft.rotation.x = Math.PI / 2
    backrestGroup.add(clipLeft)

    const clipRight = new THREE.Mesh(clipGeo, brassMat)
    clipRight.position.set(0.33, 0.038, 0.01)
    clipRight.rotation.x = Math.PI / 2
    backrestGroup.add(clipRight)

    standGroup.add(backrestGroup)

    // 4. Rear A-Frame Kickstand Struts
    const strutGeo = new THREE.BoxGeometry(0.03, 0.28, 0.02)
    const strutLeft = new THREE.Mesh(strutGeo, standWoodMat)
    strutLeft.position.set(-0.25, 0.16, -0.06)
    strutLeft.rotation.x = -0.45
    strutLeft.castShadow = true
    standGroup.add(strutLeft)

    const strutRight = new THREE.Mesh(strutGeo, standWoodMat)
    strutRight.position.set(0.25, 0.16, -0.06)
    strutRight.rotation.x = -0.45
    strutRight.castShadow = true
    standGroup.add(strutRight)

    // Brass hinge connecting rear struts to backrest
    const hingeGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.58, 16)
    const hingeMesh = new THREE.Mesh(hingeGeo, brassMat)
    hingeMesh.position.set(0, 0.27, -0.12)
    hingeMesh.rotation.z = Math.PI / 2
    standGroup.add(hingeMesh)

    this.scene.add(standGroup)
  }

  // Feature: Data-Driven Bookshelf with Sections: Class 1, 2, 3, 4, 5 (Right Wall - Frame 1, 2)
  private buildFrontBookshelf() {
    const shelfMat = this.palette.walnut

    // Bookshelf Group situated directly in front of the table facing the viewer
    const shelfGroup = new THREE.Group()
    shelfGroup.position.set(0, 0, -2.5)
    shelfGroup.rotation.y = 0

    const shelfWidth = 3.4
    const shelfHeight = 3.1
    const shelfDepth = 0.38

    // Left and Right Outer Panels
    const sideGeo = new THREE.BoxGeometry(0.06, shelfHeight, shelfDepth)
    const leftSide = new THREE.Mesh(sideGeo, shelfMat)
    leftSide.position.set(-shelfWidth / 2, shelfHeight / 2, 0)
    leftSide.castShadow = true
    shelfGroup.add(leftSide)

    const rightSide = new THREE.Mesh(sideGeo, shelfMat)
    rightSide.position.set(shelfWidth / 2, shelfHeight / 2, 0)
    rightSide.castShadow = true
    shelfGroup.add(rightSide)

    // Center Vertical Bay Divider
    const centerDivider = new THREE.Mesh(sideGeo, shelfMat)
    centerDivider.position.set(0, shelfHeight / 2, 0)
    centerDivider.castShadow = true
    shelfGroup.add(centerDivider)

    // Back Panel
    const backPanelGeo = new THREE.BoxGeometry(shelfWidth, shelfHeight, 0.02)
    const backPanel = new THREE.Mesh(backPanelGeo, this.palette.walnutDark)
    backPanel.position.set(0, shelfHeight / 2, -shelfDepth / 2 + 0.01)
    shelfGroup.add(backPanel)

    // Horizontal Shelves (4 Rows / Tiers for Class 1 to Class 5)
    // Shelf outer dimensions: height = 3.10m, width = 3.40m, depth = 0.38m
    // Bottom kickplate plank at 0.10m, top ceiling enclosure plank at 3.08m
    // 4 book compartments at h = 0.38m (Row 1), 1.05m (Row 2), 1.72m (Row 3), 2.38m (Row 4)
    // Headroom for top row = 3.08 - (2.38 + 0.48) = 0.22m (zero books protruding!)
    const plankGeo = new THREE.BoxGeometry(shelfWidth, 0.045, shelfDepth)
    const shelfHeights = [0.10, 0.38, 1.05, 1.72, 2.38, 3.08]

    shelfHeights.forEach((h) => {
      const plank = new THREE.Mesh(plankGeo, shelfMat)
      plank.position.set(0, h, 0)
      plank.castShadow = true
      plank.receiveShadow = true
      shelfGroup.add(plank)
    })

    // Crown moulding and recessed plinth so the case reads as furniture, not a box
    const crown = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth + 0.14, 0.07, shelfDepth + 0.06), this.palette.walnutDark)
    crown.position.set(0, shelfHeight + 0.035, 0.01)
    crown.castShadow = true
    shelfGroup.add(crown)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(shelfWidth - 0.04, 0.09, shelfDepth - 0.04), this.palette.walnutDark)
    plinth.position.set(0, 0.045, -0.01)
    shelfGroup.add(plinth)

    // Class Section Brass Plaques (4 Tiers)
    const classSectionDefs = [
      { h: 0.38, label: 'CLASS 1', sub: 'Foundations & Early Reading' },
      { h: 1.05, label: 'CLASS 2', sub: 'Discovery & Natural Sciences' },
      { h: 1.72, label: 'CLASS 3 & 4', sub: 'Mathematics & Distributed Systems' },
      { h: 2.38, label: 'CLASS 5', sub: 'Computer Systems & Architecture' },
    ]

    classSectionDefs.forEach(({ h, label, sub }) => {
      // Plaque on left bay
      const leftPlaqueTex = createShelfPlaqueTexture(label, sub)
      const plaqueGeo = new THREE.PlaneGeometry(0.68, 0.040)
      const leftPlaque = new THREE.Mesh(
        plaqueGeo,
        new THREE.MeshStandardMaterial({ map: leftPlaqueTex, roughness: 0.3, metalness: 0.8 })
      )
      leftPlaque.position.set(-shelfWidth / 4, h, shelfDepth / 2 + 0.002)
      shelfGroup.add(leftPlaque)

      // Matching plaque on right bay
      const rightPlaqueTex = createShelfPlaqueTexture(label, sub)
      const rightPlaque = new THREE.Mesh(
        plaqueGeo,
        new THREE.MeshStandardMaterial({ map: rightPlaqueTex, roughness: 0.3, metalness: 0.8 })
      )
      rightPlaque.position.set(shelfWidth / 4, h, shelfDepth / 2 + 0.002)
      shelfGroup.add(rightPlaque)
    })

    // Data-Driven Books Placement across 4 Tiers with Authentic Library Stacking (Zero Artificial Gaps)
    const classTierHeights: Record<number, number> = {
      1: 0.38,
      2: 1.05,
      3: 1.72,
      4: 2.38,
    }

    // Helper to get bookData from unified SHELF_BOOKS_CONFIG
    const getBookConfig = (id: string) => getShelfBookById(id)

    // Shelf Stacks by 4 Tiers and Bays driven by unified single-source-of-truth BookshelfConfig!
    const shelfTierStacks = getShelfTierStacks()

    // Realistic Wooden / Brass Bookend Material
    const bookendMat = this.palette.walnutDark

    // Every shelf book shares ONE material: spines are packed into a texture atlas and the cover /
    // page-edge colours ride in vertex colours, so each book is a single draw call (was 6).
    const atlasCols = 16
    const cellW = 128
    const cellH = 512
    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = atlasCols * cellW
    atlasCanvas.height = cellH * 4
    const atlasCtx = atlasCanvas.getContext('2d')!
    // Last cell stays plain white: non-spine faces sample it and take their colour from vertex colours
    atlasCtx.fillStyle = '#ffffff'
    atlasCtx.fillRect(atlasCanvas.width - cellW, atlasCanvas.height - cellH, cellW, cellH)
    const whiteU = 1 - 0.5 / atlasCols
    const whiteV = 0.5 / 4
    let atlasSlot = 0
    const atlasTexture = new THREE.CanvasTexture(atlasCanvas)
    atlasTexture.colorSpace = THREE.SRGBColorSpace
    atlasTexture.anisotropy = this.preset.anisotropy
    this.shelfBookMaterial = new THREE.MeshStandardMaterial({ map: atlasTexture, vertexColors: true, roughness: 0.55, name: 'shelf-books' })
    this.shelfBookHighlightMaterial = this.shelfBookMaterial.clone()
    this.shelfBookHighlightMaterial.name = 'shelf-books-highlight'
    this.shelfBookHighlightMaterial.emissive.setHex(0x0e2f56)
    this.shelfBookHighlightMaterial.emissiveIntensity = 0.35
    const paperColor = new THREE.Color('#f5f5f4')

    // Construct tightly packed rows of books without artificial gaps!
    shelfTierStacks.forEach(({ tier, bay, books }) => {
      const tierH = classTierHeights[tier] || 1.72
      const bayCenter = bay === 'left' ? -0.85 : 0.85
      const bDepth = 0.28
      const bookSpacing = 0.002 // 2mm flush spacing between adjacent touching books

      // Total width of all books in this row
      const totalRowWidth =
        books.reduce((sum, b) => sum + b.thickness, 0) + (books.length - 1) * bookSpacing
      let curX = bayCenter - totalRowWidth / 2

      // Left Bookend
      const bookendGeo = new THREE.BoxGeometry(0.022, 0.24, bDepth * 0.88)
      const leftBookend = new THREE.Mesh(bookendGeo, bookendMat)
      leftBookend.position.set(curX - 0.016, tierH + 0.12 + 0.0225, 0.01)
      leftBookend.castShadow = true
      shelfGroup.add(leftBookend)

      books.forEach((bookItem) => {
        const bookX = curX + bookItem.thickness / 2
        curX += bookItem.thickness + bookSpacing

        const spineTex = createSpineTexture(
          bookItem.subject.toUpperCase(),
          bookItem.title,
          bookItem.coverColor
        )

        // Pack this spine into the atlas
        // 63 usable cells (the last one is the white swatch); wrap defensively if the shelf ever grows
        const slot = atlasSlot++ % (atlasCols * 4 - 1)
        const col = slot % atlasCols
        const row = Math.floor(slot / atlasCols)
        atlasCtx.drawImage(spineTex.image as CanvasImageSource, col * cellW, row * cellH, cellW, cellH)
        const u0 = col / atlasCols
        const v0 = 1 - (row + 1) / 4

        // BoxGeometry: 4 vertices per face in order +X,-X,+Y,-Y,+Z (spine),-Z
        const bGeo = new THREE.BoxGeometry(bookItem.thickness, bookItem.height, bDepth)
        const uvAttr = bGeo.getAttribute('uv') as THREE.BufferAttribute
        const colors = new Float32Array(24 * 3)
        const coverColor = new THREE.Color(bookItem.coverColor)
        for (let v = 0; v < 24; v++) {
          const face = Math.floor(v / 4)
          if (face === 4) {
            uvAttr.setXY(v, u0 + uvAttr.getX(v) / atlasCols, v0 + uvAttr.getY(v) / 4)
            colors.set([1, 1, 1], v * 3)
          } else {
            uvAttr.setXY(v, whiteU, whiteV)
            const c = face === 2 || face === 3 ? paperColor : coverColor
            colors.set([c.r, c.g, c.b], v * 3)
          }
        }
        bGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        const bMesh = new THREE.Mesh(bGeo, this.shelfBookMaterial)
        bMesh.position.set(bookX, tierH + bookItem.height / 2 + 0.0225, 0.01)
        bMesh.castShadow = true

        const resolvedBookData: ImmersiveBookData = (bookItem.id && getBookConfig(bookItem.id)) || {
          id: bookItem.id,
          classLevel: bookItem.classLevel,
          subject: bookItem.subject,
          title: bookItem.title,
          coverColor: bookItem.coverColor,
          coverImage: bookItem.coverImage,
          isInteractive: true,
        }

        bMesh.userData = {
          bookData: resolvedBookData,
          restingPos: bMesh.position.clone(),
          restingRot: bMesh.rotation.clone(),
        }

        shelfGroup.add(bMesh)

        // Make ALL books interactive and register into raycaster & selection maps!
        this.shelfInteractiveMeshes.push(bMesh)
        this.shelfBooksMap.set(resolvedBookData.id, bMesh)

        if (bookItem.id === 'ddia') {
          this.interactiveShelfBookMesh = bMesh
          this.shelfBookPos.set(bookX, tierH + bookItem.height / 2 + 0.0225, -2.48)
        }
      })

      // Right Bookend
      const rightBookend = new THREE.Mesh(bookendGeo, bookendMat)
      rightBookend.position.set(curX + 0.014, tierH + 0.12 + 0.0225, 0.01)
      rightBookend.castShadow = true
      shelfGroup.add(rightBookend)

      // Decor in the free space beside the row (outer side of each bay)
      const rowStart = bayCenter - totalRowWidth / 2 - 0.03
      const rowEnd = bayCenter + totalRowWidth / 2 + 0.03
      const bayInner = bay === 'left' ? -0.06 : 0.06
      const bayOuter = bay === 'left' ? -shelfWidth / 2 + 0.06 : shelfWidth / 2 - 0.06
      const freeOuter = bay === 'left' ? rowStart - bayOuter : bayOuter - rowEnd
      const freeInner = bay === 'left' ? bayInner - rowEnd : rowStart - bayInner
      const decorY = tierH + 0.0225
      const pickDecor = (slot: number) => {
        const kind = (tier * 2 + slot + (bay === 'left' ? 0 : 1)) % 4
        if (kind === 0) return createBonsai(this.palette, 0.8)
        if (kind === 1) return createIncenseHolder(this.palette)
        if (kind === 2) return createSmallAndon(this.palette)
        // Two books lying flat
        const stack = new THREE.Group()
        const colors = ['#5b1f1a', '#1f3a5f', '#6b4a1f']
        for (let k = 0; k < 2; k++) {
          const b = new THREE.Mesh(
            new THREE.BoxGeometry(0.2 - k * 0.02, 0.035, 0.15 - k * 0.01),
            new THREE.MeshStandardMaterial({ color: colors[(tier + k) % 3], roughness: 0.6 })
          )
          b.position.y = 0.0175 + k * 0.035
          b.rotation.y = k * 0.2
          b.castShadow = true
          stack.add(b)
        }
        return stack
      }
      if (freeOuter >= 0.22) {
        const decor = pickDecor(0)
        decor.position.set(bay === 'left' ? bayOuter + freeOuter / 2 : bayOuter - freeOuter / 2, decorY, 0.02)
        shelfGroup.add(decor)
      }
      if (freeInner >= 0.22) {
        const decor = pickDecor(1)
        decor.position.set(bay === 'left' ? bayInner - freeInner / 2 : bayInner + freeInner / 2, decorY, 0.02)
        shelfGroup.add(decor)
      }
    })
    // Trailing Ivy Plant on top shelf (Storyboard Frame 1, 2)
    this.buildShelfTopPlant(shelfGroup, shelfWidth, shelfHeight, shelfDepth)

    shelfGroup.updateMatrixWorld(true)
    this.scene.add(shelfGroup)
  }

  // Trailing Ivy Plant cascading down the bookshelf (Storyboard Frame 1, 2)
  private buildShelfTopPlant(shelfGroup: THREE.Group, shelfWidth: number, shelfHeight: number, shelfDepth: number) {
    const plantGroup = new THREE.Group()
    const plantX = shelfWidth / 2 - 0.28
    const plantY = shelfHeight
    const plantZ = shelfDepth / 2 - 0.12
    plantGroup.position.set(plantX, plantY, plantZ)

    // Planter Pot (Modern White Matte Ceramic)
    const potGeo = new THREE.CylinderGeometry(0.12, 0.09, 0.16, 24)
    const potMat = new THREE.MeshStandardMaterial({
      color: '#f8fafc',
      roughness: 0.35,
    })
    const potMesh = new THREE.Mesh(potGeo, potMat)
    potMesh.position.y = 0.08
    potMesh.castShadow = true
    plantGroup.add(potMesh)

    // Dark Potting Soil
    const soilGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.015, 20)
    const soilMat = new THREE.MeshStandardMaterial({ color: '#27160c', roughness: 0.9 })
    const soilMesh = new THREE.Mesh(soilGeo, soilMat)
    soilMesh.position.y = 0.155
    plantGroup.add(soilMesh)

    // Cascading Ivy Vine Stems & Foliage
    const vineMat = new THREE.MeshStandardMaterial({ color: '#166534', roughness: 0.6 })
    const leafMat1 = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.4, side: THREE.DoubleSide })
    const leafMat2 = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.35, side: THREE.DoubleSide })
    const leafMat3 = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.45, side: THREE.DoubleSide })
    const leafMaterials = [leafMat1, leafMat2, leafMat3]

    // 4 Distinct trailing ivy branches that cascade down the side & front of shelf
    const vineConfigs = [
      { length: 0.85, angle: 0.2, droopX: 0.08, droopZ: 0.15, segments: 14 },
      { length: 1.15, angle: 0.5, droopX: 0.14, droopZ: 0.05, segments: 18 },
      { length: 0.65, angle: -0.3, droopX: 0.05, droopZ: 0.18, segments: 10 },
      { length: 0.95, angle: 1.1, droopX: 0.16, droopZ: -0.06, segments: 15 },
    ]

    vineConfigs.forEach((cfg) => {
      const curvePoints: THREE.Vector3[] = []
      const start = new THREE.Vector3(0, 0.15, 0)
      curvePoints.push(start)

      for (let s = 1; s <= cfg.segments; s++) {
        const t = s / cfg.segments
        const px = Math.sin(cfg.angle) * 0.12 + cfg.droopX * t + Math.sin(s * 1.2) * 0.02
        const py = 0.15 - Math.pow(t, 1.4) * cfg.length
        const pz = Math.cos(cfg.angle) * 0.12 + cfg.droopZ * t + Math.cos(s * 1.1) * 0.025
        const pt = new THREE.Vector3(px, py, pz)
        curvePoints.push(pt)

        // Cluster 2 delicate ivy leaves along each segment
        for (let l = 0; l < 2; l++) {
          const lGeo = new THREE.SphereGeometry(0.028 + Math.random() * 0.012, 8, 8)
          lGeo.scale(1, 0.15, 1.8)
          const mat = leafMaterials[(s + l) % leafMaterials.length]!
          const leaf = new THREE.Mesh(lGeo, mat)
          leaf.position.set(
            px + (Math.random() - 0.5) * 0.04,
            py + (Math.random() - 0.5) * 0.02,
            pz + (Math.random() - 0.5) * 0.04
          )
          leaf.rotation.set(
            0.4 + Math.random() * 0.6,
            Math.random() * Math.PI * 2,
            (Math.random() - 0.5) * 0.8
          )
          plantGroup.add(leaf)
        }
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints)
      const stemGeo = new THREE.TubeGeometry(curve, cfg.segments * 2, 0.006, 6, false)
      const stem = new THREE.Mesh(stemGeo, vineMat)
      plantGroup.add(stem)
    })

    shelfGroup.add(plantGroup)
  }

  /** Cover images are loaded once and shared by the shelf book and the hero book. */
  private loadCoverTexture(url: string): THREE.Texture {
    let tex = this.coverTextures.get(url)
    if (!tex) {
      tex = this.textureLoader.load(url)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = this.preset.anisotropy
      this.coverTextures.set(url, tex)
    }
    return tex
  }

  private getTotalPages(): number {
    const bookItem = BookCatalogService.getBookById(this.currentBookData.id)
    return bookItem?.chapters?.[0]?.pages?.length || 2
  }

  // Dynamic Page Stack Thickness Calculator
  private getStackHeights(page: number): { leftH: number; rightH: number } {
    const total = this.getTotalPages()
    const fraction = total > 1 ? (page - 1) / (total - 1) : 0
    const maxStackH = this.pageBlockThickness - this.minStackH
    const leftH = this.minStackH + fraction * maxStackH
    const rightH = this.minStackH + (1 - fraction) * maxStackH
    return { leftH, rightH }
  }

  // Advanced Fluid Paper Curvature Engine: Cylindrical Peel, Conical Corner Roll & Aerodynamic Billow
  private applyPageCurl(progress: number, isForward: boolean) {
    if (!this.pageFrontMesh || !this.pageBackMesh) return

    const p = Math.max(0, Math.min(1, progress))
    const bend = Math.sin(Math.PI * p)

    const geoF = this.pageFrontMesh.geometry as THREE.BufferGeometry
    const geoB = this.pageBackMesh.geometry as THREE.BufferGeometry

    const posAttrF = geoF.getAttribute('position') as THREE.BufferAttribute | undefined
    const posAttrB = geoB.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!posAttrF || !posAttrB) return

    const posF = posAttrF.array as Float32Array
    const posB = posAttrB.array as Float32Array

    const baseF = this.pageFrontBasePositions
    const baseB = this.pageBackBasePositions
    if (!baseF || !baseB) return

    const count = Math.floor(baseF.length / 3)
    const bookWidth = 0.35
    const pageWidth = bookWidth * 0.96
    const bookLength = 0.48
    const pageLength = bookLength * 0.96
    const profileWidth = bookWidth * 0.97

    // Resting shape: the leaf leaves one curved stack and lands on the other. In pivot space the
    // landing side is upside down (the pivot has turned 180°), hence the sign flip. It also floats
    // 0.7mm above the page sheet (which sits 0.3mm up), so the page underneath can never show
    // through it before it lifts.
    const settle = (1 - Math.cos(Math.PI * p)) / 2
    const fromSign = isForward ? 1 : -1
    const fromH = this.curlRest.fromH
    const toH = this.curlRest.toH
    const lift = 0.0007 * (1 - 2 * settle)

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const x0 = baseF[idx] ?? 0
      const z0 = baseF[idx + 2] ?? 0

      // Normalized coordinates:
      // u in [0, 1]: 0 = spine binding, 1 = free fore-edge
      // v in [-0.5, 0.5]: -0.5 = top edge, +0.5 = bottom edge
      const u = Math.max(0, Math.min(1, x0 / pageWidth))
      const v = z0 / pageLength
      const uRest = x0 / profileWidth
      const offFrom = stackSurfaceHeight(uRest, fromH) - fromH
      const offTo = stackSurfaceHeight(uRest, toH) - toH
      const dyRest = fromSign * ((1 - settle) * offFrom - settle * offTo + lift)

      let dy = 0
      if (isForward) {
        // Forward turn (Right to Left):
        // 1. Dynamic Angular Peel & Roll: free outer edge leads lift-off ($p < 0.5$), then lags as it lands on cushion of air
        const peelAngle = p < 0.5
          ? 0.55 * bend * (1.0 - 0.3 * p) * Math.pow(u, 1.35)
          : -0.38 * bend * (p - 0.2) * Math.pow(u, 1.35)

        // 2. Conical Diagonal Corner Twist: the bottom-outer corner (held by the fingers) leads the peel
        const cornerTwist = 0.22 * bend * Math.pow(u, 2.0) * (0.5 + v)

        // 3. Aerodynamic Billow Dome: paper catches air in mid-flight and bulges like a sail
        const billowDome = 0.026 * Math.pow(bend, 1.15) * Math.pow(Math.sin(Math.PI * u * 0.95), 0.85) * (1.0 - 0.25 * v * v)

        // 4. Subtle Hydrodynamic Wave / Flutter in mid-flight transition
        const waveFlutter = 0.009 * Math.sin(2.0 * Math.PI * p) * Math.sin(1.5 * Math.PI * u) * u

        // Combine into unified 3D paper deflection
        const totalAngle = peelAngle + cornerTwist
        dy = u * pageWidth * Math.sin(totalAngle * 0.5) + billowDome + waveFlutter
      } else {
        // Backward turn (Left to Right): Symmetric reverse curl
        const peelAngle = p < 0.5
          ? 0.55 * bend * (1.0 - 0.3 * p) * Math.pow(u, 1.35)
          : -0.38 * bend * (p - 0.2) * Math.pow(u, 1.35)

        const cornerTwist = 0.22 * bend * Math.pow(u, 2.0) * (0.5 + v)
        const billowDome = 0.026 * Math.pow(bend, 1.15) * Math.pow(Math.sin(Math.PI * u * 0.95), 0.85) * (1.0 - 0.25 * v * v)
        const waveFlutter = 0.009 * Math.sin(2.0 * Math.PI * p) * Math.sin(1.5 * Math.PI * u) * u

        const totalAngle = peelAngle + cornerTwist
        dy = -(u * pageWidth * Math.sin(totalAngle * 0.5) + billowDome + waveFlutter)
      }

      // Exact inextensibility conservation: preserves paper width along the curve
      const dx = -(dy * dy) / (2.0 * pageWidth)
      dy += dyRest

      // Apply to Front face
      posF[idx] = (baseF[idx] ?? 0) + dx
      posF[idx + 1] = (baseF[idx + 1] ?? 0) + dy
      posF[idx + 2] = baseF[idx + 2] ?? 0

      // Apply to Back face (exact same 3D deflection, unified single sheet)
      posB[idx] = (baseB[idx] ?? 0) + dx
      posB[idx + 1] = (baseB[idx + 1] ?? 0) + dy
      posB[idx + 2] = baseB[idx + 2] ?? 0
    }

    posAttrF.needsUpdate = true
    posAttrB.needsUpdate = true
    geoF.computeVertexNormals()
    geoB.computeVertexNormals()
  }

  private buildHeroBook() {
    this.heroBookGroup = new THREE.Group()

    const bookWidth = this.bookWidth
    const bookLength = this.bookLength
    const bookThickness = this.bookThickness
    const coverThickness = this.coverThickness
    const pageBlockThickness = this.pageBlockThickness
    const blockWidth = bookWidth * 0.97
    const blockLength = bookLength * 0.97
    const pageWidth = bookWidth * 0.96
    const pageLength = bookLength * 0.96

    // Materials configured for current book
    let coverTex: THREE.Texture
    if (this.currentBookData.coverImage) {
      coverTex = this.loadCoverTexture(this.currentBookData.coverImage)
    } else {
      coverTex = createBookCoverTexture(
        this.currentBookData.title,
        this.currentBookData.subject,
        `Class ${this.currentBookData.classLevel}`,
        this.currentBookData.coverColor || '#0284c7'
      )
    }
    const coverMat = new THREE.MeshStandardMaterial({
      map: coverTex,
      roughness: 0.4,
      metalness: 0.15,
    })

    const insideCoverTex = createBookInsideCoverTexture(
      this.currentBookData.title,
      `${this.currentBookData.subject} · Class ${this.currentBookData.classLevel}`
    )
    // Inside cover texture remains standard upright orientation (rotation = 0)
    const insideCoverMat = new THREE.MeshStandardMaterial({
      map: insideCoverTex,
      roughness: 0.75,
    })

    const goldSpineMat = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      metalness: 0.5,
      roughness: 0.3,
    })

    const heroSpineTex = createSpineTexture(
      this.currentBookData.subject.toUpperCase(),
      this.currentBookData.title,
      this.currentBookData.coverColor || '#0284c7'
    )

    // 1. Back Cover (Rests flat on desk: y from 0 to coverThickness)
    const backCoverGeo = new THREE.BoxGeometry(bookWidth, coverThickness, bookLength)
    const backCoverMaterials = [
      goldSpineMat, // +X
      goldSpineMat, // -X
      insideCoverMat, // +Y (inside facing pages)
      coverMat, // -Y (outside back cover facing table)
      goldSpineMat, // +Z
      goldSpineMat, // -Z
    ]
    const backCover = new THREE.Mesh(backCoverGeo, backCoverMaterials)
    backCover.position.set(bookWidth / 2, coverThickness / 2, 0)
    backCover.castShadow = true
    backCover.receiveShadow = true
    this.backCoverMesh = backCover
    this.heroBookGroup.add(backCover)

    // 2. Base Page Stacks: Dual-Stack Physics
    const pageEdgesTex = createBookPageEdgesTexture()
    const pageEdgesMat = new THREE.MeshStandardMaterial({
      map: pageEdgesTex,
      roughness: 0.8,
    })

    const page1Tex = createBookPageTexture(1, this.currentBookData.subject, this.currentBookData.id)

    // 2a. Page stacks. The *logical* block meshes keep the existing animation contract (scale.y =
    // stack height / thickness, visibility) but never render (layer 31). What you see are curved
    // stacks + page sheets rebuilt from that state each frame (syncBookSurfaces), following the
    // open-book gull-wing curve into the binding.
    const stackOpts = { profileWidth: blockWidth, length: blockLength }
    const rightBlockGeo = new THREE.BoxGeometry(blockWidth, pageBlockThickness, blockLength)
    const rightBlockMaterials = [
      pageEdgesMat, // +X (fore-edge: paper stack striations)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -X (spine gutter)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +Y (underlying paper block)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -Y
      pageEdgesMat, // +Z (bottom edges)
      pageEdgesMat, // -Z (top edges)
    ]
    this.rightPageBlockMesh = new THREE.Mesh(rightBlockGeo, rightBlockMaterials)
    this.rightPageBlockMesh.position.set(0, coverThickness + pageBlockThickness / 2, 0)
    this.rightPageBlockMesh.layers.set(31)
    this.pageBlockMesh = this.rightPageBlockMesh
    this.heroBookGroup.add(this.rightPageBlockMesh)

    this.rightStack = new CurvedStack({ ...stackOpts, innerX: 0.002, outerX: blockWidth })
    this.rightStackMesh = new THREE.Mesh(this.rightStack.geometry, rightBlockMaterials)
    this.rightStackMesh.position.y = coverThickness
    this.rightStackMesh.castShadow = true
    this.rightStackMesh.receiveShadow = true
    this.heroBookGroup.add(this.rightStackMesh)

    // 2b. Left Page Block (Visibly grows in height on left cover as reader flips forward)
    const leftBlockGeo = new THREE.BoxGeometry(blockWidth, pageBlockThickness, blockLength)
    const leftBlockMaterials = [
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +X (spine gutter)
      pageEdgesMat, // -X (fore-edge on left: paper stack striations)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +Y (underlying paper block)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -Y
      pageEdgesMat, // +Z (bottom edges)
      pageEdgesMat, // -Z (top edges)
    ]
    this.leftPageBlockMesh = new THREE.Mesh(leftBlockGeo, leftBlockMaterials)
    this.leftPageBlockMesh.position.set(0, coverThickness + this.minStackH / 2, 0)
    this.leftPageBlockMesh.layers.set(31)
    this.leftPageBlockMesh.visible = false
    this.leftPageBlockMesh.scale.set(1, this.minStackH / pageBlockThickness, 1)
    this.heroBookGroup.add(this.leftPageBlockMesh)

    this.leftStack = new CurvedStack({ ...stackOpts, innerX: -0.002, outerX: -blockWidth })
    this.leftStackMesh = new THREE.Mesh(this.leftStack.geometry, leftBlockMaterials)
    this.leftStackMesh.position.y = coverThickness
    this.leftStackMesh.castShadow = true
    this.leftStackMesh.receiveShadow = true
    this.leftStackMesh.visible = false
    this.heroBookGroup.add(this.leftStackMesh)

    // 2c. Flat Open Pages (Completely flat and flush on the page stacks, eliminating all text cut-offs)
    // Right Page: spans from x = 0 to +blockWidth flush on top of the right page block
    // Visible page sheets ride on the curved stacks (scaled on Y to the stack height every frame) and
    // carry vertex-colour shading that darkens the paper as it dives into the gutter.
    this.rightSheet = new CurvedSheet(blockWidth, blockLength, 'right')
    const geoRight = this.rightSheet.geometry

    const rightCurvedMat = new THREE.MeshStandardMaterial({
      map: page1Tex,
      roughness: 0.85,
      side: THREE.FrontSide,
      vertexColors: true,
    })
    this.rightCurvedPageMesh = new THREE.Mesh(geoRight, rightCurvedMat)
    this.rightCurvedPageMesh.position.set(0, coverThickness + pageBlockThickness + 0.0003, 0)
    this.rightCurvedPageMesh.castShadow = true
    this.rightCurvedPageMesh.receiveShadow = true
    this.rightCurvedPageMesh.visible = false
    this.heroBookGroup.add(this.rightCurvedPageMesh)

    // Left Page: spans from x = -blockWidth to 0 flush on top of the left page block
    this.leftSheet = new CurvedSheet(blockWidth, blockLength, 'left')
    const geoLeft = this.leftSheet.geometry

    const leftCurvedMat = new THREE.MeshStandardMaterial({
      map: insideCoverTex,
      roughness: 0.85,
      side: THREE.FrontSide,
      vertexColors: true,
    })
    this.leftCurvedPageMesh = new THREE.Mesh(geoLeft, leftCurvedMat)
    this.leftCurvedPageMesh.position.set(0, coverThickness + this.minStackH + 0.0003, 0)
    this.leftCurvedPageMesh.castShadow = true
    this.leftCurvedPageMesh.receiveShadow = true
    this.leftCurvedPageMesh.visible = false
    this.heroBookGroup.add(this.leftCurvedPageMesh)

    // 2d. Subtle, Natural Midline Binding Crease Shadow (Soft neutral gradient, eliminates red stripe & clipping)
    const shadowCanvas = document.createElement('canvas')
    shadowCanvas.width = 128
    shadowCanvas.height = 32
    const sCtx = shadowCanvas.getContext('2d')!
    const sGrad = sCtx.createLinearGradient(0, 0, 128, 0)
    sGrad.addColorStop(0, 'rgba(30, 20, 10, 0)')
    sGrad.addColorStop(0.35, 'rgba(30, 20, 10, 0.06)')
    sGrad.addColorStop(0.48, 'rgba(25, 15, 8, 0.22)')
    sGrad.addColorStop(0.50, 'rgba(20, 10, 5, 0.35)') // Soft natural sewn crease
    sGrad.addColorStop(0.52, 'rgba(25, 15, 8, 0.22)')
    sGrad.addColorStop(0.65, 'rgba(30, 20, 10, 0.06)')
    sGrad.addColorStop(1, 'rgba(30, 20, 10, 0)')
    sCtx.fillStyle = sGrad
    sCtx.fillRect(0, 0, 128, 32)
    const gutterShadowTex = new THREE.CanvasTexture(shadowCanvas)

    const gutterShadowGeo = new THREE.PlaneGeometry(0.010, blockLength, 1, 1)
    gutterShadowGeo.rotateX(-Math.PI / 2)

    const gutterShadowMat = new THREE.MeshBasicMaterial({
      map: gutterShadowTex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      // Superseded by the curved pages' own gutter shading; kept so existing toggles stay harmless
      visible: false,
    })
    this.gutterShadowMesh = new THREE.Mesh(gutterShadowGeo, gutterShadowMat)
    this.gutterShadowMesh.position.set(0, coverThickness + pageBlockThickness + 0.0005, 0)
    this.gutterShadowMesh.visible = false
    this.heroBookGroup.add(this.gutterShadowMesh)

    // 3. Book Spine (Rounded clothbound cylinder resting at y = 0 to bookThickness when closed, lowered behind covers when open)
    const spineRadius = bookThickness / 2
    const spineGeo = new THREE.CylinderGeometry(spineRadius, spineRadius, bookLength, 16)
    const spineMeshMat = new THREE.MeshStandardMaterial({
      map: heroSpineTex,
      roughness: 0.4,
      metalness: 0.15,
    })
    this.spineMesh = new THREE.Mesh(spineGeo, spineMeshMat)
    this.spineMesh.rotation.x = Math.PI / 2
    this.spineMesh.position.set(0, spineRadius, 0)
    this.spineMesh.castShadow = true
    this.heroBookGroup.add(this.spineMesh)

    // 4. Front Cover (Hinged at x = 0 along Z axis at top of book)
    this.bookCoverPivot = new THREE.Group()
    this.bookCoverPivot.position.set(0, bookThickness - coverThickness / 2, 0)

    const frontCoverGeo = new THREE.BoxGeometry(bookWidth, coverThickness, bookLength)
    // Correct UV coordinates for face 3 (-Y, inside endpaper) so that when rotated 180° around Z (hinge)
    // when opening, the endpaper text and borders are 100% upright throughout the entire opening arc!
    const frontCoverUvs = frontCoverGeo.getAttribute('uv') as THREE.BufferAttribute
    frontCoverUvs.setXY(12, 1, 0)
    frontCoverUvs.setXY(13, 0, 0)
    frontCoverUvs.setXY(14, 1, 1)
    frontCoverUvs.setXY(15, 0, 1)
    frontCoverUvs.needsUpdate = true

    const frontCoverMaterials = [
      goldSpineMat, // +X
      goldSpineMat, // -X
      coverMat, // +Y (Front outside cover)
      insideCoverMat, // -Y (Inside endpaper)
      goldSpineMat, // +Z
      goldSpineMat, // -Z
    ]
    this.frontCoverMesh = new THREE.Mesh(frontCoverGeo, frontCoverMaterials)
    this.frontCoverMesh.position.set(bookWidth / 2, 0, 0)
    this.frontCoverMesh.castShadow = true
    this.frontCoverMesh.receiveShadow = true
    this.bookCoverPivot.add(this.frontCoverMesh)
    this.heroBookGroup.add(this.bookCoverPivot)

    // 5. Flippable Page Sheet with Subdivided Geometry for Realistic 3D Bending
    this.pagePivot = new THREE.Group()
    this.pagePivot.position.set(0, coverThickness + pageBlockThickness, 0)

    // Front face (facing up at start on right stack)
    const geoFront = new THREE.PlaneGeometry(pageWidth, pageLength, 48, 24)
    geoFront.translate(pageWidth / 2, 0, 0)
    geoFront.rotateX(-Math.PI / 2)

    const frontMat = new THREE.MeshStandardMaterial({
      map: page1Tex,
      roughness: 0.85,
      side: THREE.FrontSide,
      vertexColors: true,
    })
    this.pageFrontMesh = new THREE.Mesh(geoFront, frontMat)
    this.pageFrontMesh.position.set(0, 0, 0)
    this.pageFrontMesh.castShadow = true
    this.pageFrontMesh.receiveShadow = true
    this.pageMesh = this.pageFrontMesh

    // Back face: Cloned geometry with inverted index winding and horizontal UV flip (zero separation, unified single sheet)
    const posAttrFront = geoFront.getAttribute('position') as THREE.BufferAttribute
    this.pageFrontBasePositions = new Float32Array(posAttrFront.array)

    // Same gutter shading as the resting pages, so the turning leaf matches them where it bends
    const leafColors = new Float32Array(posAttrFront.count * 3)
    for (let i = 0; i < posAttrFront.count; i++) {
      const shade = gutterShade(posAttrFront.getX(i) / blockWidth)
      leafColors.set([shade, shade, shade], i * 3)
    }
    geoFront.setAttribute('color', new THREE.BufferAttribute(leafColors, 3))
    this.locateLeafCorner(posAttrFront)

    const geoBack = geoFront.clone()
    if (geoBack.index) {
      const indexArray = geoBack.index.array as Uint16Array | Uint32Array
      for (let i = 0; i < indexArray.length; i += 3) {
        const tmp = indexArray[i] ?? 0
        indexArray[i] = indexArray[i + 1] ?? 0
        indexArray[i + 1] = tmp
      }
      geoBack.index.needsUpdate = true
    }
    geoBack.computeVertexNormals()

    const uvAttrBack = geoBack.getAttribute('uv') as THREE.BufferAttribute | undefined
    if (uvAttrBack) {
      const backUVs = uvAttrBack.array as Float32Array
      for (let i = 0; i < backUVs.length; i += 2) {
        backUVs[i] = 1 - (backUVs[i] ?? 0)
      }
      uvAttrBack.needsUpdate = true
    }
    const posAttrBack = geoBack.getAttribute('position') as THREE.BufferAttribute
    this.pageBackBasePositions = new Float32Array(posAttrBack.array)

    const backMat = new THREE.MeshStandardMaterial({
      map: insideCoverTex,
      roughness: 0.85,
      side: THREE.FrontSide,
      vertexColors: true,
    })
    this.pageBackMesh = new THREE.Mesh(geoBack, backMat)
    this.pageBackMesh.position.set(0, 0, 0)
    this.pageBackMesh.castShadow = true
    this.pageBackMesh.receiveShadow = true

    this.pagePivot.add(this.pageFrontMesh)
    this.pagePivot.add(this.pageBackMesh)
    this.pagePivot.visible = false
    this.heroBookGroup.add(this.pagePivot)

    // 6. Raycast hit box for clicking Hero Book on desk
    const hitGeo = new THREE.BoxGeometry(bookWidth * 1.3, bookThickness * 2.5, bookLength * 1.2)
    const hitMat = new THREE.MeshBasicMaterial({ visible: false })
    this.bookTargetMesh = new THREE.Mesh(hitGeo, hitMat)
    this.bookTargetMesh.position.set(bookWidth / 2, bookThickness / 2, 0)
    this.heroBookGroup.add(this.bookTargetMesh)

    // Place Hero Book initially on shelf
    this.heroBookGroup.position.copy(this.shelfBookPos)
    this.heroBookGroup.rotation.copy(this.shelfBookRot)
    this.heroBookGroup.visible = false
    this.scene.add(this.heroBookGroup)
  }

  private setupAtmosphere() {
    const fireflyTex = createFireflyTexture()
    const particleCount = 60
    const dustGeo = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)

    let placed = 0
    let attempts = 0
    while (placed < particleCount && attempts < 600) {
      attempts++
      // Japanese garden terrace & chamber atmospheric distribution
      // Naturally floating in the sunlit garden breeze and tatami space
      const x = -3.6 + Math.random() * 4.6 // X: -3.6 to 1.0 (from garden to room)
      const y = 0.55 + Math.random() * 2.2 // Y: 0.55 to 2.75 (above floor, atmospheric height)
      const z = -2.4 + Math.random() * 3.6 // Z: -2.4 to 1.2 (depth)

      // Clearance exclusion zone around desk reading stand & camera viewport
      // so no firefly collides or sits directly on the reading book surface or pots
      const distToDeskBook = Math.hypot(x - 0, y - 1.07, z - (-0.44))
      const distToDeskTop = Math.hypot(x - 0, y - 0.73, z - (-0.45))
      if (distToDeskBook < 0.62 || distToDeskTop < 0.45) {
        continue
      }

      positions[placed * 3] = x
      positions[placed * 3 + 1] = y
      positions[placed * 3 + 2] = z
      placed++
    }

    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.dustPositions = positions

    // Bioluminescent Firefly (Hotaru, 蛍) & Starlight Point Material
    // Fully textured with smooth feathered radial alpha and twinkling core lens flare
    const dustMat = new THREE.PointsMaterial({
      map: fireflyTex,
      color: 0xfff6cf, // Warm luminous starlight gold
      size: 0.08,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    })

    // GPU-Accelerated Hardware Vertex Shader Hook:
    // Computes independent 3D organic floating and individual starlight twinkling 100% on the GPU
    // Zero CPU looping, zero buffer uploads, guaranteed locked 60fps on all devices!
    dustMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      dustMat.userData.shader = shader
      shader.vertexShader = `
        uniform float uTime;
      ` + shader.vertexShader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        // Natural independent 3D wandering & floating for each individual firefly
        float fx = sin(uTime * 0.75 + position.y * 3.2 + position.z * 1.5);
        float fy = sin(uTime * 1.15 + position.x * 2.8 + position.z * 2.1);
        float fz = cos(uTime * 0.85 + position.x * 2.4 + position.y * 1.8);
        transformed.x += fx * 0.045;
        transformed.y += fy * 0.055;
        transformed.z += fz * 0.045;
        `
      )

      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        // Independent bioluminescent breathing & twinkle pulsation per firefly
        float twinkle = 0.82 + 0.35 * sin(uTime * 2.2 + position.x * 5.1 + position.y * 3.7);
        gl_PointSize *= twinkle;
        `
      )
    }

    this.dustParticles = new THREE.Points(dustGeo, dustMat)
    this.scene.add(this.dustParticles)
  }

  // =========================================================
  // STATIC MESH MERGING (DRAW CALL REDUCTION)
  // =========================================================

  /** Objects that move, animate, get raycast, or have materials mutated at runtime. Never merged. */
  private collectDynamicObjects(): Set<THREE.Object3D> {
    const dynamic = new Set<THREE.Object3D>()
    const add = (obj: THREE.Object3D | null | undefined) => {
      if (obj) dynamic.add(obj)
    }
    add(this.studyDoorGroup)
    add(this.studyDoorPlaque)
    add(this.studyWallSwitch)
    add(this.hallwayWallSwitch)
    add(this.hallwayInnerWallGroup)
    add(this.lampShadeMesh)
    add(this.lampTargetMesh)
    add(this.heroBookGroup)
    add(this.cupGroup)
    add(this.contactShadowLeft)
    add(this.contactShadowRight)
    add(this.gardenBackdropMesh)
    add(this.dustParticles)
    add(this.teaSteamParticles)
    this.shelfInteractiveMeshes.forEach(add)
    this.interactiveDoors.forEach((d) => add(d.mesh))
    this.interactiveSwitches.forEach((s) => add(s.mesh))
    for (const monk of this.monks) add(monk.group)
    for (const room of this.customRooms.values()) {
      add(room.doorGroup)
      add(room.labelMesh)
      add(room.switchMesh)
    }
    return dynamic
  }

  private staticMaterialKey(material: THREE.Material): string {
    const m = material as THREE.MeshStandardMaterial
    const isMergeableType = m.type === 'MeshStandardMaterial' || m.type === 'MeshBasicMaterial'
    // Named materials are referenced elsewhere (tweened) and shader-patched ones must stay distinct
    if (m.name || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return material.uuid
    const extraMaps = m.normalMap || m.roughnessMap || m.metalnessMap || m.aoMap || m.emissiveMap || m.alphaMap
    if (!isMergeableType || extraMaps) return material.uuid

    const texKey = (t: THREE.Texture | null) =>
      t
        ? [t.source.uuid, t.repeat.x, t.repeat.y, t.offset.x, t.offset.y, t.wrapS, t.wrapT, t.rotation, t.anisotropy].join(',')
        : '-'
    return [
      m.type,
      m.color?.getHexString(),
      m.roughness,
      m.metalness,
      m.emissive?.getHexString(),
      m.emissiveIntensity,
      m.side,
      m.opacity,
      m.transparent,
      m.depthWrite,
      m.flatShading,
      m.vertexColors,
      texKey(m.map),
    ].join('|')
  }

  /**
   * Bakes every static mesh into one merged mesh per (zone, material, shadow flags), in world space.
   * Furniture, walls, shelf frame, plants etc. go from several hundred draw calls to a few dozen,
   * which is the main CPU cost on low-end devices. Zones (study / corridor / each room) stay separate
   * so frustum culling still skips rooms that are out of view.
   */
  /** Real-world box-projected UVs for every (non-instanced) mesh whose material asks for them. */
  private applyWorldUVs() {
    const done = new Set<THREE.BufferGeometry>()
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || (mesh as any).isInstancedMesh || Array.isArray(mesh.material)) return
      if (!mesh.material.userData.worldUV || mesh.userData.mergedStatic || done.has(mesh.geometry)) return
      if (mesh.geometry.userData.worldUV) return
      projectWoodUVs(mesh.geometry, mesh.material.userData.worldUVTile ?? 0.5)
      mesh.geometry.userData.worldUV = true
      done.add(mesh.geometry)
    })
  }

  private optimizeStaticMeshes() {
    this.applyWorldUVs()
    this.scene.updateMatrixWorld(true)
    const dynamic = this.collectDynamicObjects()

    const zoneOf = new Map<THREE.Object3D, { key: string; parent: THREE.Object3D }>()
    zoneOf.set(this.hallwayGroup, { key: 'hallway', parent: this.hallwayGroup })
    for (const room of this.customRooms.values()) {
      zoneOf.set(room.group, { key: `${room.id}-shell`, parent: room.group })
      zoneOf.set(room.interior, { key: room.id, parent: room.interior })
    }
    zoneOf.set(this.studyGardenGroup, { key: 'study-garden', parent: this.studyGardenGroup })
    const studyZone = { key: 'study', parent: this.scene as THREE.Object3D }

    const canonicalMaterials = new Map<string, THREE.Material>()
    const buckets = new Map<string, { meshes: THREE.Mesh[]; material: THREE.Material; parent: THREE.Object3D }>()

    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || (mesh as any).isInstancedMesh || (mesh as any).isSkinnedMesh) return
      if (mesh.userData.mergedStatic) return
      const material = mesh.material
      if (Array.isArray(material) || !material.visible || material.transparent) return
      const geometry = mesh.geometry
      if (!geometry.attributes.position || Object.keys(geometry.morphAttributes).length > 0) return
      if (mesh.matrixWorld.determinant() <= 0) return

      let zone = studyZone
      for (let node: THREE.Object3D | null = mesh; node; node = node.parent) {
        if (dynamic.has(node) || !node.visible) return
        const z = zoneOf.get(node)
        // Innermost zone wins (walking up from the mesh)
        if (z && zone === studyZone) zone = z
      }

      const matKey = this.staticMaterialKey(material)
      let canonical = canonicalMaterials.get(matKey)
      if (!canonical) {
        canonical = material
        canonicalMaterials.set(matKey, material)
      }

      const attrSignature = Object.keys(geometry.attributes).sort().join(',')
      const bucketKey = [zone.key, canonical.uuid, mesh.castShadow, mesh.receiveShadow, attrSignature, !!geometry.index].join('#')
      let bucket = buckets.get(bucketKey)
      if (!bucket) {
        bucket = { meshes: [], material: canonical, parent: zone.parent }
        buckets.set(bucketKey, bucket)
      }
      bucket.meshes.push(mesh)
    })

    const identity = new THREE.Matrix4()
    for (const { meshes, material, parent } of buckets.values()) {
      // Geometry is baked in world space, so the merged mesh's parent must have an identity transform
      if (meshes.length < 2 || !parent.matrixWorld.equals(identity)) continue

      const geometries = meshes.map((mesh) => {
        const g = mesh.geometry.clone()
        g.clearGroups()
        g.applyMatrix4(mesh.matrixWorld)
        return g
      })
      const merged = mergeGeometries(geometries, false)
      geometries.forEach((g) => g.dispose())
      if (!merged) continue

      const first = meshes[0]!
      const mergedMesh = new THREE.Mesh(merged, material)
      mergedMesh.castShadow = first.castShadow
      mergedMesh.receiveShadow = first.receiveShadow
      mergedMesh.userData.mergedStatic = true

      for (const mesh of meshes) mesh.removeFromParent()
      parent.add(mergedMesh)
    }

    this.staticMeshesOptimized = true
  }

  // Interactive Raycasting & Mouse Events
  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousedown', this.onWindowMouseDown)
    window.addEventListener('mouseup', this.onWindowMouseUp)
    window.addEventListener('mousemove', this.onWindowMouseMove)
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('click', this.onClick)
    window.addEventListener('resize', this.onResize)
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousedown', this.onWindowMouseDown)
    window.removeEventListener('mouseup', this.onWindowMouseUp)
    window.removeEventListener('mousemove', this.onWindowMouseMove)
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('click', this.onClick)
    window.removeEventListener('resize', this.onResize)
  }

  /** Marks the scene as active so low-tier idle throttling doesn't kick in. */
  private markActivity() {
    this.lastActivityTime = performance.now()
  }

  // Keyboard listeners for Explore Mode (WASD + Shift)
  private onKeyDown = (e: KeyboardEvent) => {
    this.markActivity()
    if (!this.isExploreMode) return
    // Ignore if user is typing in an input/textarea
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

    const k = e.key ? e.key.toLowerCase() : ''
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w') this.keys.forward = true
    if (e.code === 'KeyS' || e.code === 'ArrowDown' || k === 's') this.keys.backward = true
    if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a') this.keys.left = true
    if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd') this.keys.right = true
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey || k === 'shift') {
      this.keys.shift = true
      this.isRunning = true
    }
    if (e.code === 'KeyE' || k === 'e') {
      this.interactNearest()
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key ? e.key.toLowerCase() : ''
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || k === 'w') this.keys.forward = false
    if (e.code === 'KeyS' || e.code === 'ArrowDown' || k === 's') this.keys.backward = false
    if (e.code === 'KeyA' || e.code === 'ArrowLeft' || k === 'a') this.keys.left = false
    if (e.code === 'KeyD' || e.code === 'ArrowRight' || k === 'd') this.keys.right = false
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || !e.shiftKey) {
      this.keys.shift = false
      this.isRunning = false
    }
  }

  // Mouse drag for explore mode camera look (works smoothly across entire window)
  private onWindowMouseDown = (e: MouseEvent) => {
    this.markActivity()
    if (this.isExploreMode) {
      const target = e.target as HTMLElement
      if (target && (target.closest('button') || target.closest('input') || target.closest('.create-chamber-modal') || target.closest('.floating-door-prompt') || target.closest('.corridor-nav-dock'))) {
        return
      }
      this.isMouseDragging = true
      this.prevMousePos = { x: e.clientX, y: e.clientY }
    }
  }

  private onWindowMouseUp = () => {
    this.isMouseDragging = false
  }

  private onWindowMouseMove = (e: MouseEvent) => {
    if (this.isExploreMode && this.isMouseDragging && !this.isMeditating) {
      const dx = e.clientX - this.prevMousePos.x
      const dy = e.clientY - this.prevMousePos.y
      this.prevMousePos = { x: e.clientX, y: e.clientY }

      const sensitivity = 0.0032
      this.playerYaw -= dx * sensitivity
      this.playerPitch -= dy * sensitivity
      // Clamp pitch between -70° and +70°
      this.playerPitch = Math.max(-1.22, Math.min(1.22, this.playerPitch))
    }
  }

  private getScreenCoords(worldPos: THREE.Vector3): { x: number; y: number } {
    const v = worldPos.clone().project(this.camera)
    return {
      x: ((v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((-v.y + 1) / 2) * this.canvas.clientHeight,
    }
  }

  private resetHoveredBook() {
    if (!this.hoveredBookMesh) return
    const restingPos = this.hoveredBookMesh.userData.restingPos as THREE.Vector3 | undefined
    const restingRot = this.hoveredBookMesh.userData.restingRot as THREE.Euler | undefined

    this.hoveredBookMesh.material = this.shelfBookMaterial

    if (restingPos) {
      gsap.to(this.hoveredBookMesh.position, {
        z: restingPos.z,
        duration: 0.25,
        ease: 'power2.out',
      })
    }
    if (restingRot) {
      gsap.to(this.hoveredBookMesh.rotation, {
        z: restingRot.z,
        duration: 0.25,
        ease: 'power2.out',
      })
    }

    this.hoveredBookMesh = null
  }

  private onMouseMove = (event: MouseEvent) => {
    this.markActivity()
    if (this.state === 'book-flying') return
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Explore mode: Skip heavy object raycasting during WASD / mouse-look walking
    if (this.isExploreMode) return

    // Throttle raycasting to ~30Hz (33ms) to save CPU/GPU cycles on high-polling mice
    const now = performance.now()
    if (now - this.lastRaycastTime < 33) return
    this.lastRaycastTime = now

    this.raycaster.setFromCamera(this.mouse, this.camera)

    // 1. Check Lamp Hover
    const lampIntersects = this.raycaster.intersectObject(this.lampTargetMesh)
    if (lampIntersects.length > 0) {
      this.resetHoveredBook()
      this.currentHoveredTarget = 'lamp'
      this.canvas.style.cursor = 'pointer'
      const pos = this.getScreenCoords(new THREE.Vector3(-0.72, 1.15, -0.45))
      this.callbacks.onHoverInteractive?.({
        target: 'lamp',
        screenPos: pos,
        isLightOn: this.isLightOn,
      })
      return
    }

    // 2. Check Cup Hover
    const cupIntersects = this.raycaster.intersectObject(this.cupTargetMesh)
    if (cupIntersects.length > 0) {
      this.resetHoveredBook()
      this.currentHoveredTarget = 'cup'
      this.canvas.style.cursor = 'pointer'
      const pos = this.getScreenCoords(new THREE.Vector3(0.72, 0.98, -0.25))
      this.callbacks.onHoverInteractive?.({
        target: 'cup',
        screenPos: pos,
        isLightOn: this.isLightOn,
      })
      return
    }

    // 3. Check Shelf Books Hover (Room-View mode)
    if (this.state === 'room-view') {
      const shelfIntersects = this.raycaster.intersectObjects(this.shelfInteractiveMeshes)
      if (shelfIntersects.length > 0) {
        const hitMesh = shelfIntersects[0]!.object as THREE.Mesh
        const bookData = hitMesh.userData.bookData as ImmersiveBookData | undefined

        if (bookData) {
          if (this.hoveredBookMesh !== hitMesh) {
            this.resetHoveredBook()
            this.hoveredBookMesh = hitMesh

            // Subtle highlight: soft tasteful blue/cyan sheen (No neon outlines, no excessive glow)
            hitMesh.material = this.shelfBookHighlightMaterial

            // Slightly move forward and tilt on hover
            const restingPos = hitMesh.userData.restingPos as THREE.Vector3
            gsap.to(hitMesh.position, {
              z: restingPos.z + 0.06,
              duration: 0.25,
              ease: 'power2.out',
            })
            gsap.to(hitMesh.rotation, {
              z: -0.04,
              duration: 0.25,
              ease: 'power2.out',
            })
          }

          this.currentHoveredTarget = 'book'
          this.canvas.style.cursor = 'pointer'

          const worldPos = new THREE.Vector3()
          hitMesh.getWorldPosition(worldPos)
          worldPos.y += 0.28
          const pos = this.getScreenCoords(worldPos)

          this.callbacks.onHoverInteractive?.({
            target: 'book',
            bookData,
            screenPos: pos,
            isLightOn: this.isLightOn,
          })
          return
        }
      }
    }

    // 4. Check Book on Desk Hover (On-Table / Book-Open mode)
    if (this.state === 'on-table' || this.state === 'book-open') {
      const deskBookIntersects = this.raycaster.intersectObject(this.bookTargetMesh)
      if (deskBookIntersects.length > 0) {
        this.resetHoveredBook()
        this.currentHoveredTarget = 'book'
        this.canvas.style.cursor = 'pointer'
        const pos = this.getScreenCoords(new THREE.Vector3(0, 0.95, -0.42))
        this.callbacks.onHoverInteractive?.({
          target: 'book',
          bookData: this.currentBookData,
          screenPos: pos,
          isLightOn: this.isLightOn,
        })
        return
      }
    }

    // Default: Clear hover states
    this.resetHoveredBook()
    if (this.currentHoveredTarget !== null) {
      this.currentHoveredTarget = null
      this.canvas.style.cursor = 'default'
      this.callbacks.onHoverInteractive?.({
        target: null,
        isLightOn: this.isLightOn,
      })
    }
  }

  private onClick = () => {
    this.markActivity()
    this.raycaster.setFromCamera(this.mouse, this.camera)

    // Explore Mode: 3D interactive door & light switch clicking
    if (this.isExploreMode) {
      for (const doorItem of this.interactiveDoors) {
        const intersects = this.raycaster.intersectObject(doorItem.mesh, true)
        if (intersects.length > 0 && intersects[0]!.distance < 4.5) {
          this.toggleDoor(doorItem.roomId)
          return
        }
      }
      if (!this.isMeditating) {
        for (const monk of this.monks) {
          if (monk.roomId !== this.currentZone) continue
          const hit = this.raycaster.intersectObject(monk.hitBox, false)
          if (hit.length > 0 && hit[0]!.distance < 4) {
            this.callbacks.onMonkInteract?.(monk.roomId)
            return
          }
        }
      }
      for (const switchItem of this.interactiveSwitches) {
        const intersects = this.raycaster.intersectObject(switchItem.mesh, true)
        if (intersects.length > 0 && intersects[0]!.distance < 3.5) {
          this.toggleRoomLight(switchItem.targetId)
          return
        }
      }
    }

    // 1. Lamp Click: Toggle Light On/Off
    const lampIntersects = this.raycaster.intersectObject(this.lampTargetMesh)
    if (lampIntersects.length > 0) {
      this.toggleRoomLight()
      return
    }

    // 2. Cup Click: Animate Drinking Tea
    const cupIntersects = this.raycaster.intersectObject(this.cupTargetMesh)
    if (cupIntersects.length > 0) {
      this.drinkTea()
      return
    }

    // 3. Bookshelf Book Click: Emit selectBook(bookData)
    if (this.state === 'room-view') {
      const shelfIntersects = this.raycaster.intersectObjects(this.shelfInteractiveMeshes)
      if (shelfIntersects.length > 0) {
        const hitMesh = shelfIntersects[0]!.object as THREE.Mesh
        const bookData = hitMesh.userData.bookData as ImmersiveBookData | undefined
        if (bookData) {
          this.selectBook(bookData)
          return
        }
      }
    }

    // 4. Desk Book Click: Open Book or Flip Pages
    if (this.state === 'on-table') {
      const deskIntersects = this.raycaster.intersectObject(this.bookTargetMesh)
      if (deskIntersects.length > 0) {
        this.openBook()
      }
    } else if (this.state === 'book-open') {
      const deskIntersects = this.raycaster.intersectObject(this.bookTargetMesh)
      if (deskIntersects.length > 0) {
        const hitPoint = deskIntersects[0]!.point
        const localPoint = this.heroBookGroup.worldToLocal(hitPoint.clone())
        const total = this.getTotalPages()
        if (localPoint.x < 0) {
          // Clicked left stack -> flip backward
          if (this.currentPage > 1) {
            this.flipPage(this.currentPage - 1)
          }
        } else {
          // Clicked right stack -> flip forward
          if (this.currentPage < total) {
            this.flipPage(this.currentPage + 1)
          }
        }
      }
    }
  }

  // Feature: Data-Driven Book Selection & Connection to Existing Immersive Experience
  public selectBook(bookData: ImmersiveBookData) {
    this.triggerShadowUpdate(45)
    this.resetHoveredBook()
    this.currentBookData = bookData
    this.pageOpenness.value = 0
    // Fetch the curriculum while the book flies to the desk
    void BookCatalogService.ensureBookLoaded(bookData.id)
    this.callbacks.onBookSelected?.(bookData)

    // Apply selected book outer appearance to Hero Book rig for flight
    let coverTex: THREE.Texture
    if (bookData.coverImage) {
      coverTex = this.loadCoverTexture(bookData.coverImage)
    } else {
      coverTex = createBookCoverTexture(
        bookData.title,
        bookData.subject,
        `Class ${bookData.classLevel}`,
        bookData.coverColor || '#0284c7'
      )
    }
    const spineTex = createSpineTexture(
      bookData.subject.toUpperCase(),
      bookData.title,
      bookData.coverColor || '#0284c7'
    )
    this.currentPage = 1
    if (this.pagePivot) {
      this.pagePivot.rotation.z = 0
    }

    const insideCoverTex = createBookInsideCoverTexture(
      bookData.title,
      `${bookData.subject} · Class ${bookData.classLevel}`
    )

    // Outer front cover (+Y) and inside endpaper (-Y)
    if (this.frontCoverMesh) {
      const mats = this.frontCoverMesh.material as THREE.MeshStandardMaterial[]
      if (Array.isArray(mats)) {
        if (mats[2]) {
          mats[2].map = coverTex
          mats[2].needsUpdate = true
        }
        if (mats[3]) {
          mats[3].map = insideCoverTex
          mats[3].needsUpdate = true
        }
      }
    }

    // Outer back cover
    if (this.backCoverMesh) {
      const mats = this.backCoverMesh.material as THREE.MeshStandardMaterial[]
      if (Array.isArray(mats) && mats[3]) {
        mats[3].map = coverTex
        mats[3].needsUpdate = true
      }
    }

    // Spine
    if (this.spineMesh) {
      const spineMat = this.spineMesh.material as THREE.MeshStandardMaterial
      spineMat.map = spineTex
      spineMat.needsUpdate = true
    }

    // Prepare page blocks & turning leaf
    const coverThickness = 0.006
    const pageBlockThickness = 0.034
    if (this.rightPageBlockMesh) {
      this.rightPageBlockMesh.scale.set(1, 1, 1)
      this.rightPageBlockMesh.position.y = coverThickness + pageBlockThickness / 2
    }
    if (this.leftPageBlockMesh) {
      this.leftPageBlockMesh.visible = false
      const minH = 0.0006
      this.leftPageBlockMesh.scale.set(1, minH / pageBlockThickness, 1)
      this.leftPageBlockMesh.position.y = coverThickness + minH / 2
    }
    if (this.pagePivot) {
      this.pagePivot.visible = false
    }

    // Delegate directly to physical extraction and 60fps aerodynamic flight!
    this.selectAndFlyBook()
  }

  public selectAndFlyBook() {
    if (this.state !== 'room-view') return
    this.state = 'book-flying'

    // Identify shelf book mesh and starting coordinates
    const shelfMesh = this.shelfBooksMap.get(this.currentBookData.id) || this.interactiveShelfBookMesh
    const shelfWorldPos = new THREE.Vector3()
    if (shelfMesh) {
      shelfMesh.getWorldPosition(shelfWorldPos)
      this.shelfBookPos.copy(shelfWorldPos)
    } else {
      shelfWorldPos.copy(this.shelfBookPos)
    }

    // Dim the shelf ambient glow light
    gsap.to(this.heroBookGlow, { intensity: 0.15, duration: 0.3 })

    // Camera focal tracking point: begins at the shelf book and tracks smoothly
    const camFocus = {
      x: shelfWorldPos.x,
      y: shelfWorldPos.y,
      z: shelfWorldPos.z,
    }

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = 'on-table'
        this.callbacks.onBookLanded?.()
      },
    })

    // Dynamic camera tracking: locked smoothly onto the book flight path
    tl.eventCallback('onUpdate', () => {
      this.camera.lookAt(camFocus.x, camFocus.y, camFocus.z)
    })

    // Camera Position: sweeps smoothly from wide chamber perspective to intimate desk perspective
    tl.to(
      this.camera.position,
      {
        x: this.deskCamPos.x,
        y: this.deskCamPos.y,
        z: this.deskCamPos.z,
        duration: 1.15,
        ease: 'power2.inOut',
      },
      0
    )

    // Stage 1: Book pulls smoothly forward out of the shelf slot (0 to 0.28s)
    if (shelfMesh) {
      const restingZ = (shelfMesh.userData.restingPos as THREE.Vector3)?.z ?? 0.01
      tl.to(
        shelfMesh.position,
        {
          z: restingZ + 0.36,
          duration: 0.28,
          ease: 'power2.out',
        },
        0
      )
    }

    // Camera focal point tracks the book pulling forward out of shelf
    tl.to(
      camFocus,
      {
        x: shelfWorldPos.x,
        y: shelfWorldPos.y,
        z: shelfWorldPos.z + 0.36,
        duration: 0.28,
        ease: 'power2.out',
      },
      0
    )

    // Stage 2: Hand off seamlessly from shelfMesh to heroBookGroup at t = 0.26s
    const startHeroX = shelfWorldPos.x + 0.021
    const startHeroY = shelfWorldPos.y
    const startHeroZ = shelfWorldPos.z + 0.36 + 0.14

    tl.call(() => {
      if (shelfMesh) {
        shelfMesh.visible = false
      }
      this.heroBookGroup.position.set(startHeroX, startHeroY, startHeroZ)
      this.heroBookGroup.rotation.copy(this.shelfBookRot)
      this.heroBookGroup.visible = true
      this.callbacks.onBookFlightStarted?.()
    }, [], 0.26)

    // Stage 3: Smooth, continuous 3D aerodynamic flight arc (0.26s to 1.15s, duration = 0.89s)
    // Synchronized horizontal translation
    tl.to(
      this.heroBookGroup.position,
      {
        x: this.tableBookPos.x,
        z: this.tableBookPos.z,
        duration: 0.89,
        ease: 'power2.inOut',
      },
      0.26
    )

    // Smooth aerodynamic rotation: tilts from upright standing to angled reading stand (78°)
    tl.to(
      this.heroBookGroup.rotation,
      {
        x: this.tableBookRot.x,
        y: this.tableBookRot.y,
        z: this.tableBookRot.z,
        duration: 0.89,
        ease: 'power2.inOut',
      },
      0.26
    )

    // Continuous vertical parabolic arc: Y(p) = lerp(startY, endY, p) + sin(pi * p) * 0.36
    // Guaranteed zero velocity hitch at peak, silky-smooth glide into the stand
    const flightObj = { progress: 0 }
    tl.to(
      flightObj,
      {
        progress: 1,
        duration: 0.89,
        ease: 'power2.inOut',
        onUpdate: () => {
          const p = flightObj.progress
          const verticalArc = Math.sin(Math.PI * p) * 0.36
          this.heroBookGroup.position.y = THREE.MathUtils.lerp(startHeroY, this.tableBookPos.y, p) + verticalArc
        },
      },
      0.26
    )

    // Camera focal tracking transitions smoothly to focus closely on desk book
    tl.to(
      camFocus,
      {
        x: this.deskCamTarget.x,
        y: this.deskCamTarget.y,
        z: this.deskCamTarget.z,
        duration: 0.89,
        ease: 'power2.inOut',
      },
      0.26
    )

    // Stage 4: Contact shadow fades in gently beneath book as it settles on the reading stand
    tl.call(() => {
      this.contactShadowRight.visible = true
    }, [], 0.82)

    tl.fromTo(
      this.contactShadowRight.scale,
      { x: 0.7, y: 0.7 },
      { x: 1.0, y: 1.0, duration: 0.33, ease: 'power2.out' },
      0.82
    )

    tl.to(
      this.contactShadowRight.material,
      { opacity: 0.55, duration: 0.33, ease: 'power2.out' },
      0.82
    )
  }

  public openBook() {
    if (this.state !== 'on-table' || this.isOpenPending) return
    const bookId = this.currentBookData.id
    if (BookCatalogService.isBookLoaded(bookId)) {
      this.runOpenBook()
      return
    }
    // Curriculum still downloading (rare: it starts when the book is picked): open as soon as it lands
    this.isOpenPending = true
    void BookCatalogService.ensureBookLoaded(bookId).finally(() => {
      this.isOpenPending = false
      if (this.state === 'on-table' && this.currentBookData.id === bookId) this.runOpenBook()
    })
  }

  private runOpenBook() {
    this.triggerShadowUpdate(45)
    this.setReadingResolution(true)
    this.state = 'book-open'
    this.currentPage = 1
    this.isFlipping = false

    const coverThickness = this.coverThickness
    const pageBlockThickness = this.pageBlockThickness
    const minStackH = this.minStackH

    const tl = gsap.timeline({
      onComplete: () => {
        // Expand hit box across both open page stacks
        this.bookTargetMesh.position.set(0, coverThickness + pageBlockThickness / 2, 0)
        this.bookTargetMesh.scale.set(2.2, 1, 1)

        // Step 6: Book controls appear
        this.callbacks.onBookOpened?.()
        this.prefetchPages(this.currentPage)
      },
    })

    // Step 1: Camera approaches the desk into intimate reading perspective
    tl.to(this.camera.position, {
      x: this.readCamPos.x,
      y: this.readCamPos.y,
      z: this.readCamPos.z,
      duration: 1.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.lookAt(this.readCamTarget)
      },
    }, 0)

    // Step 2: Cover lifts with physical weight (accelerating upward to vertical)
    tl.call(() => {
      this.callbacks.onBookOpeningStarted?.()
    }, [], 0.25)

    tl.to(this.bookCoverPivot.rotation, {
      z: Math.PI * 0.52, // 94 degrees (stands vertical)
      duration: 0.7,
      ease: 'power2.in',
    }, 0.25)

    // Lower spine cylinder underneath the open book so the jointer bar does not protrude between pages
    tl.to(this.spineMesh.position, {
      y: -0.020,
      duration: 0.8,
      ease: 'power2.inOut',
    }, 0.25)

    // Step 3: Pages reveal as cover passes vertical and falls under gravity to the left
    tl.call(() => {
      // Left stack is initialized at minimal thickness resting on opened front cover
      this.leftPageBlockMesh.visible = true
      this.leftPageBlockMesh.scale.set(1, minStackH / pageBlockThickness, 1)
      this.leftPageBlockMesh.position.y = coverThickness + minStackH / 2

      const insideCoverTex = createBookInsideCoverTexture(
        this.currentBookData.title,
        `${this.currentBookData.subject} · Class ${this.currentBookData.classLevel}`
      )
      // Inside cover texture remains standard upright orientation (rotation = 0)
      const leftMats = this.leftPageBlockMesh.material as THREE.MeshStandardMaterial[]
      if (Array.isArray(leftMats) && leftMats[2]) {
        leftMats[2].map = insideCoverTex
        leftMats[2].needsUpdate = true
      }

      // Right stack has full page thickness at Page 1, displaying Page 1
      this.rightPageBlockMesh.scale.set(1, 1, 1)
      this.rightPageBlockMesh.position.y = coverThickness + pageBlockThickness / 2
      const rightMats = this.rightPageBlockMesh.material as THREE.MeshStandardMaterial[]
      if (Array.isArray(rightMats) && rightMats[2]) {
        rightMats[2].map = createBookPageTexture(1, this.currentBookData.subject, this.currentBookData.id)
        rightMats[2].needsUpdate = true
      }

      if (this.rightCurvedPageMesh) {
        this.rightCurvedPageMesh.visible = true
        this.rightCurvedPageMesh.position.y = coverThickness + pageBlockThickness + 0.0003
        const rMat = this.rightCurvedPageMesh.material as THREE.MeshStandardMaterial
        rMat.map = createBookPageTexture(1, this.currentBookData.subject, this.currentBookData.id)
        rMat.needsUpdate = true
      }

      if (this.leftCurvedPageMesh) {
        this.leftCurvedPageMesh.visible = true
        this.leftCurvedPageMesh.position.y = coverThickness + minStackH + 0.0003
        const lMat = this.leftCurvedPageMesh.material as THREE.MeshStandardMaterial
        lMat.map = insideCoverTex
        lMat.needsUpdate = true
      }

      if (this.gutterShadowMesh) {
        this.gutterShadowMesh.visible = true
        this.gutterShadowMesh.position.y = coverThickness + pageBlockThickness + 0.0004
      }


      this.pagePivot.visible = false
      this.contactShadowLeft.visible = true
    }, [], 0.95)

    tl.to(this.bookCoverPivot.rotation, {
      z: Math.PI, // Resting flat on left desk
      duration: 0.8,
      ease: 'power3.out',
    }, 0.95)

    // Pages relax from the flat closed block into the curved open-book shape
    tl.to(this.pageOpenness, { value: 1, duration: 0.9, ease: 'power2.out' }, 0.9)

    // Flexible cloth hinge lowers cover pivot so front cover lies flat on the desk
    tl.to(this.bookCoverPivot.position, {
      y: coverThickness / 2,
      duration: 0.75,
      ease: 'power2.inOut',
    }, 0.95)

    // Left contact shadow expands and darkens under opened front cover
    tl.to(this.contactShadowLeft.material, {
      opacity: 0.55,
      duration: 0.65,
      ease: 'power2.out',
    }, 1.1)

    // Step 4: Pages settle (physical damping of cover and paper relaxation)
    tl.to(this.bookCoverPivot.rotation, {
      z: Math.PI,
      duration: 0.3,
      ease: 'power1.out',
    }, 1.75)
  }

  // Book Controller: Physical Page Flipping Animation with Realistic 3D Paper Curvature & Proportional Stack Thickness
  private readingBoost = false

  /**
   * While reading, the view is just the book on its stand, so render at the display's real pixel
   * density (text stays crisp on retina screens). The adaptive monitor still steps it down if a
   * device can't hold 60fps.
   */
  private setReadingResolution(on: boolean) {
    this.readingBoost = on
    const deviceDPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const readingMax = this.qualityTier === 'low' ? 1.5 : 2
    const cap = on ? Math.max(this.preset.maxDPR, readingMax) : this.preset.maxDPR
    this.baseDPR = Math.max(this.preset.minDPR, Math.min(deviceDPR, cap))
    this.currentDPR = on ? this.baseDPR : Math.min(this.currentDPR, this.baseDPR)
    this.consecutiveSlowFrames = 0
    this.consecutiveFastFrames = 0
    this.renderer.setPixelRatio(this.currentDPR)
  }

  /** Build + upload the neighbouring pages during idle time so turning never waits on canvas work. */
  private prefetchPages(around: number) {
    const bookId = this.currentBookData.id
    const subject = this.currentBookData.subject
    const total = this.getTotalPages()
    const pages = [around + 1, around + 2, around - 1].filter((p) => p >= 1 && p <= total)
    const idle: (cb: () => void) => void =
      typeof (window as any).requestIdleCallback === 'function'
        ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 400 })
        : (cb) => setTimeout(cb, 60)
    const next = () => {
      const page = pages.shift()
      if (page === undefined || this.currentBookData.id !== bookId || this.state !== 'book-open') return
      const tex = createBookPageTexture(page, subject, bookId)
      this.renderer.initTexture(tex)
      idle(next)
    }
    idle(next)
  }

  /** Rebuild the curved stacks / page sheets from the logical stack state (only when it changed). */
  private syncBookSurfaces() {
    const T = this.pageBlockThickness
    const leftH = this.leftPageBlockMesh.scale.y * T
    const rightH = this.rightPageBlockMesh.scale.y * T
    const open = this.pageOpenness.value
    this.leftStackMesh.visible = this.leftPageBlockMesh.visible
    this.rightStackMesh.visible = this.rightPageBlockMesh.visible

    const key = `${leftH.toFixed(5)}|${rightH.toFixed(5)}|${open.toFixed(4)}`
    if (key !== this.lastSurfaceKey) {
      this.lastSurfaceKey = key
      this.leftStack.update(leftH, open)
      this.rightStack.update(rightH, open)
      this.leftSheet.update(leftH, open)
      this.rightSheet.update(rightH, open)
    }
    // Sheet geometry already carries the absolute height; neutralise the legacy flat offsets
    this.leftCurvedPageMesh.position.y = this.coverThickness
    this.rightCurvedPageMesh.position.y = this.coverThickness
  }

  // =========================================================
  // PAGE-TURNING HANDS
  // =========================================================

  /**
   * Find the grip point on the leaf's fore-edge (~13cm above the bottom corner, where a reader's
   * fingers naturally slip under the page and where the hand stays in the reading camera's frame),
   * plus neighbours toward the spine and up the page.
   */
  private locateLeafCorner(pos: THREE.BufferAttribute) {
    let maxX = -Infinity
    let maxZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      maxX = Math.max(maxX, pos.getX(i))
      maxZ = Math.max(maxZ, pos.getZ(i))
    }
    const targetZ = maxZ - 0.13
    let corner = 0
    let bestGrip = Infinity
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(pos.getX(i) - maxX) > 1e-6) continue
      const d = Math.abs(pos.getZ(i) - targetZ)
      if (d < bestGrip) {
        bestGrip = d
        corner = i
      }
    }
    const cx = pos.getX(corner)
    const cz = pos.getZ(corner)
    let spine = -1
    let up = -1
    let bestSpine = Infinity
    let bestUp = Infinity
    for (let i = 0; i < pos.count; i++) {
      if (i === corner) continue
      const dx = cx - pos.getX(i)
      const dz = cz - pos.getZ(i)
      // ~6cm in toward the spine along the bottom edge, ~8cm up along the fore-edge
      if (Math.abs(dz) < 1e-6 && dx > 0) {
        const d = Math.abs(dx - 0.06)
        if (d < bestSpine) { bestSpine = d; spine = i }
      }
      if (Math.abs(dx) < 1e-6 && dz > 0) {
        const d = Math.abs(dz - 0.08)
        if (d < bestUp) { bestUp = d; up = i }
      }
    }
    this.leafCornerIndex = corner
    this.leafSpineNeighborIndex = spine
    this.leafUpNeighborIndex = up
  }

  private readonly _gripA = new THREE.Vector3()
  private readonly _gripB = new THREE.Vector3()
  private readonly _gripC = new THREE.Vector3()

  /** Leaf vertex (current, deformed) → hero-book local space. */
  private leafPointToBook(index: number, out: THREE.Vector3): THREE.Vector3 {
    const pos = this.pageFrontMesh.geometry.getAttribute('position') as THREE.BufferAttribute
    out.fromBufferAttribute(pos, index)
    out.applyAxisAngle(new THREE.Vector3(0, 0, 1), this.pagePivot.rotation.z)
    return out.add(this.pagePivot.position)
  }

  /**
   * Where the index fingertip goes and how the hand is oriented so the fingers slip just under the
   * page corner: palm toward the paper, fingers pointing in toward the spine and up the page.
   */
  private computeLeafGrip(isForward: boolean) {
    const c = this.leafPointToBook(this.leafCornerIndex, this._gripA)
    const towardSpine = this.leafPointToBook(this.leafSpineNeighborIndex, this._gripB).sub(c).normalize()
    const upPage = this.leafPointToBook(this.leafUpNeighborIndex, this._gripC).sub(c).normalize()
    const frontNormal = new THREE.Vector3().crossVectors(upPage, towardSpine).normalize()
    // The face that was on top when the turn began: the fingers stay under it the whole way over
    const upNormal = isForward ? frontNormal : frontNormal.negate()
    const point = c.clone()
      .addScaledVector(towardSpine, 0.022)
      .addScaledVector(upPage, 0.03)
      .addScaledVector(upNormal, -0.009)
    const finger = towardSpine.clone().multiplyScalar(0.8).addScaledVector(upPage, 0.5).normalize()
    const back = upNormal.clone().negate()
    return { point, finger, back }
  }

  private handTurn: {
    rig: HandRig
    isForward: boolean
    approach: { t: number }
    retreat: { t: number }
    released: boolean
    releaseFrom: { point: THREE.Vector3; finger: THREE.Vector3; back: THREE.Vector3 } | null
  } | null = null

  private static readonly HAND_RELAXED: HandPose = { thumb: 0.3, index: 0.32, middle: 0.36, ring: 0.45, pinky: 0.52 }
  private static readonly HAND_GRIP: HandPose = { thumb: 0.18, index: 0.06, middle: 0.12, ring: 0.5, pinky: 0.62 }
  private static readonly HAND_FLIP_START = 0.24

  private blendPose(a: HandPose, b: HandPose, t: number): HandPose {
    return {
      thumb: THREE.MathUtils.lerp(a.thumb, b.thumb, t),
      index: THREE.MathUtils.lerp(a.index, b.index, t),
      middle: THREE.MathUtils.lerp(a.middle, b.middle, t),
      ring: THREE.MathUtils.lerp(a.ring, b.ring, t),
      pinky: THREE.MathUtils.lerp(a.pinky, b.pinky, t),
    }
  }

  /** Off-page rest position the hand comes from and returns to (bottom-outer, just off the book). */
  private handRestInputs(isForward: boolean) {
    const side = isForward ? 1 : -1
    return {
      point: new THREE.Vector3(side * (this.bookWidth + 0.24), 0.08, this.bookLength / 2 + 0.16),
      finger: new THREE.Vector3(-side * 0.8, 0, -0.5).normalize(),
      back: new THREE.Vector3(0, -1, 0),
    }
  }

  /**
   * Adds the reach-in to the flip timeline. Returns when the page itself should start moving
   * (0 when no hand model is available, so turns still work without one).
   */
  private beginHandTurn(tl: gsap.core.Timeline, isForward: boolean): number {
    const rig = isForward ? this.handRight : this.handLeft
    const previous = this.handTurn
    if (previous) {
      gsap.killTweensOf(previous.approach)
      gsap.killTweensOf(previous.retreat)
      previous.rig.root.visible = false
    }
    this.handTurn = null
    if (!rig || this.leafCornerIndex < 0) return 0

    const turn = {
      rig,
      isForward,
      approach: { t: 0 },
      retreat: { t: 0 },
      released: false,
      releaseFrom: null,
    }
    this.handTurn = turn
    rig.root.visible = true
    tl.to(turn.approach, { t: 1, duration: 0.3, ease: 'power2.out' }, 0)
    tl.eventCallback('onUpdate', () => this.updateHandTurn())
    this.updateHandTurn()
    return JapaneseRoomService.HAND_FLIP_START
  }

  /** Called from the flip tween with the leaf's progress; lets go of the page once it is past vertical. */
  private onHandTurnProgress(p: number) {
    const turn = this.handTurn
    if (!turn || turn.released || p < 0.7) return
    turn.released = true
    const grip = this.computeLeafGrip(turn.isForward)
    turn.releaseFrom = grip
    gsap.to(turn.retreat, {
      t: 1,
      duration: 0.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.updateHandTurn()
        this.triggerShadowUpdate(2)
      },
      onComplete: () => {
        if (this.handTurn === turn) {
          turn.rig.root.visible = false
          this.handTurn = null
        }
      },
    })
  }

  private updateHandTurn() {
    const turn = this.handTurn
    if (!turn) return
    const rest = this.handRestInputs(turn.isForward)

    if (!turn.released) {
      const grip = this.computeLeafGrip(turn.isForward)
      const a = turn.approach.t
      // Arc in from the rest pose, sliding the fingertips under the corner
      const point = rest.point.clone().lerp(grip.point, a)
      point.y += Math.sin(Math.PI * a) * 0.035
      const finger = rest.finger.clone().lerp(grip.finger, a).normalize()
      const back = rest.back.clone().lerp(grip.back, a).normalize()
      turn.rig.place(point, finger, back)
      turn.rig.setPose(this.blendPose(JapaneseRoomService.HAND_RELAXED, JapaneseRoomService.HAND_GRIP, a))
      return
    }

    // Let go and return to rest, lifting clear of the pages on the way back
    const from = turn.releaseFrom!
    const r = turn.retreat.t
    const point = from.point.clone().lerp(rest.point, r)
    point.y += Math.sin(Math.PI * r) * 0.09
    const finger = from.finger.clone().lerp(rest.finger, r).normalize()
    const back = from.back.clone().lerp(rest.back, r)
    if (back.lengthSq() < 1e-4) back.set(0, -1, 0)
    turn.rig.place(point, finger, back.normalize())
    turn.rig.setPose(this.blendPose(JapaneseRoomService.HAND_GRIP, JapaneseRoomService.HAND_RELAXED, r))
  }

  public flipPage(pageNumber: number) {
    if (this.state !== 'book-open') return
    if (this.isFlipping) return

    const prevPage = this.currentPage
    const total = this.getTotalPages()
    const targetPage = Math.max(1, Math.min(total, pageNumber))
    if (targetPage === prevPage) return

    this.isFlipping = true
    this.currentPage = targetPage
    this.callbacks.onPageFlipStarted?.(targetPage)

    const isFlippingForward = targetPage > prevPage
    const coverThickness = this.coverThickness
    const pageBlockThickness = this.pageBlockThickness

    const { leftH: prevLeftH, rightH: prevRightH } = this.getStackHeights(prevPage)
    const { leftH: targetLeftH, rightH: targetRightH } = this.getStackHeights(targetPage)

    // Textures configuration
    const insideCoverTex = createBookInsideCoverTexture(
      this.currentBookData.title,
      `${this.currentBookData.subject} · Class ${this.currentBookData.classLevel}`
    )

    const getPageTex = (p: number) => {
      if (p <= 0) return insideCoverTex
      return createBookPageTexture(p, this.currentBookData.subject, this.currentBookData.id)
    }

    const frontMeshMat = this.pageFrontMesh.material as THREE.MeshStandardMaterial
    const backMeshMat = this.pageBackMesh.material as THREE.MeshStandardMaterial
    const rightBlockMats = this.rightPageBlockMesh.material as THREE.MeshStandardMaterial[]
    const leftBlockMats = this.leftPageBlockMesh.material as THREE.MeshStandardMaterial[]

    if (isFlippingForward) {
      // FORWARD FLIP: Turning leaf lifts from right stack and turns to left stack
      // Front face: page being turned away (prevPage)
      frontMeshMat.map = getPageTex(prevPage)
      frontMeshMat.needsUpdate = true

      // Back face: verso page that will face up on left stack (targetPage - 1)
      const targetVerso = targetPage - 1
      backMeshMat.map = getPageTex(targetVerso)
      backMeshMat.needsUpdate = true

      // The page underneath is swapped only once the turning leaf has lifted and covers it, so the
      // next page's content can't flash on the right before the turn
      let revealed = false
      const revealUnderneath = () => {
        if (revealed) return
        revealed = true
        if (Array.isArray(rightBlockMats) && rightBlockMats[2]) {
          rightBlockMats[2].map = getPageTex(targetPage)
          rightBlockMats[2].needsUpdate = true
        }
        if (this.rightCurvedPageMesh) {
          const rMat = this.rightCurvedPageMesh.material as THREE.MeshStandardMaterial
          rMat.map = getPageTex(targetPage)
          rMat.needsUpdate = true
        }
      }

      // Initialize turning leaf on top of right stack
      this.pagePivot.rotation.z = 0
      this.pagePivot.position.set(0, coverThickness + prevRightH, 0)
      this.pagePivot.visible = true
      this.curlRest.fromH = prevRightH
      this.curlRest.toH = targetLeftH
      this.applyPageCurl(0, true)

      let hasPreloadedLeft = false
      const anim = { p: 0 }
      const tl = gsap.timeline({
        onComplete: () => {
          revealUnderneath()
          // When landed on left stack: ensure top face of left stack has targetVerso
          if (Array.isArray(leftBlockMats) && leftBlockMats[2]) {
            leftBlockMats[2].map = getPageTex(targetVerso)
            leftBlockMats[2].needsUpdate = true
          }

          this.leftPageBlockMesh.scale.y = targetLeftH / pageBlockThickness
          this.leftPageBlockMesh.position.y = coverThickness + targetLeftH / 2

          this.rightPageBlockMesh.scale.y = targetRightH / pageBlockThickness
          this.rightPageBlockMesh.position.y = coverThickness + targetRightH / 2

          if (this.leftCurvedPageMesh) {
            const lMat = this.leftCurvedPageMesh.material as THREE.MeshStandardMaterial
            lMat.map = getPageTex(targetVerso)
            lMat.needsUpdate = true
            this.leftCurvedPageMesh.position.y = coverThickness + targetLeftH + 0.0003
          }
          if (this.rightCurvedPageMesh) {
            this.rightCurvedPageMesh.position.y = coverThickness + targetRightH + 0.0003
          }
          const maxStackH = Math.max(targetLeftH, targetRightH)
          if (this.gutterShadowMesh) {
            this.gutterShadowMesh.position.y = coverThickness + maxStackH + 0.0004
          }

          // Double-buffered frame synchronization:
          // Keep pagePivot visible for one frame while WebGL commits the new leftCurvedPageMesh texture
          // to eliminate any 1-frame flash/flicker of the earlier left page content!
          requestAnimationFrame(() => {
            this.pagePivot.visible = false
            this.applyPageCurl(0, true)
            this.isFlipping = false
            this.callbacks.onPageFlipped?.(targetPage)
            this.prefetchPages(targetPage)
          })
        },
      })

      const flipStart = this.beginHandTurn(tl, isFlippingForward)
      tl.to(anim, {
        p: 1,
        duration: flipStart > 0 ? 0.95 : 0.88,
        ease: 'power2.inOut',
        onUpdate: () => {
          const p = anim.p
          const curLeftH = prevLeftH + (targetLeftH - prevLeftH) * p
          const curRightH = prevRightH + (targetRightH - prevRightH) * p

          this.leftPageBlockMesh.scale.y = curLeftH / pageBlockThickness
          this.leftPageBlockMesh.position.y = coverThickness + curLeftH / 2

          this.rightPageBlockMesh.scale.y = curRightH / pageBlockThickness
          this.rightPageBlockMesh.position.y = coverThickness + curRightH / 2

          // Continuous elevation for curved page meshes to eliminate any Z-fighting or clipping
          if (this.leftCurvedPageMesh) {
            this.leftCurvedPageMesh.position.y = coverThickness + curLeftH + 0.0003
          }
          if (this.rightCurvedPageMesh) {
            this.rightCurvedPageMesh.position.y = coverThickness + curRightH + 0.0003
          }

          // Preload targetVerso onto leftCurvedPageMesh as turning page descends over the left stack (p >= 0.65)
          // so by the time it lands, the underlying page already has the new texture ready in WebGL!
          if (!hasPreloadedLeft && p >= 0.65) {
            hasPreloadedLeft = true
            if (this.leftCurvedPageMesh) {
              const lMat = this.leftCurvedPageMesh.material as THREE.MeshStandardMaterial
              lMat.map = getPageTex(targetVerso)
              lMat.needsUpdate = true
            }
            if (Array.isArray(leftBlockMats) && leftBlockMats[2]) {
              leftBlockMats[2].map = getPageTex(targetVerso)
              leftBlockMats[2].needsUpdate = true
            }
          }

          // Continuous organic page turnover from 0 to 180 deg
          this.pagePivot.rotation.z = p * Math.PI

          // Dynamic elevation: rises from right stack, arches in flight, lands flush onto left stack
          const baseY = (1 - p) * curRightH + p * curLeftH
          const airLift = 0.018 * Math.sin(Math.PI * p)
          this.pagePivot.position.y = coverThickness + baseY + airLift

          // Deform paper vertices with unified 3D bending physics
          this.applyPageCurl(p, true)
          this.onHandTurnProgress(p)
          if (p >= 0.05) revealUnderneath()
        },
      }, flipStart)
    } else {
      // BACKWARD FLIP: Turning leaf lifts from left stack and turns to right stack
      // Back face (revealed while on left): page lifting off from left (prevPage - 1)
      const prevVerso = prevPage - 1
      backMeshMat.map = getPageTex(prevVerso)
      backMeshMat.needsUpdate = true

      // Front face: lands facing up on right stack (targetPage)
      frontMeshMat.map = getPageTex(targetPage)
      frontMeshMat.needsUpdate = true

      const targetVerso = targetPage - 1
      let revealed = false
      const revealUnderneath = () => {
        if (revealed) return
        revealed = true
        if (Array.isArray(leftBlockMats) && leftBlockMats[2]) {
          leftBlockMats[2].map = getPageTex(targetVerso)
          leftBlockMats[2].needsUpdate = true
        }
        if (this.leftCurvedPageMesh) {
          const lMat = this.leftCurvedPageMesh.material as THREE.MeshStandardMaterial
          lMat.map = getPageTex(targetVerso)
          lMat.needsUpdate = true
        }
      }

      // Initialize turning leaf on top of left stack
      this.pagePivot.rotation.z = Math.PI
      this.pagePivot.position.set(0, coverThickness + prevLeftH, 0)
      this.pagePivot.visible = true
      this.curlRest.fromH = prevLeftH
      this.curlRest.toH = targetRightH
      this.applyPageCurl(0, false)

      let hasPreloadedRight = false
      const anim = { p: 0 }
      const tl = gsap.timeline({
        onComplete: () => {
          revealUnderneath()
          // When landed on right stack:
          if (Array.isArray(rightBlockMats) && rightBlockMats[2]) {
            rightBlockMats[2].map = getPageTex(targetPage)
            rightBlockMats[2].needsUpdate = true
          }

          this.leftPageBlockMesh.scale.y = targetLeftH / pageBlockThickness
          this.leftPageBlockMesh.position.y = coverThickness + targetLeftH / 2

          this.rightPageBlockMesh.scale.y = targetRightH / pageBlockThickness
          this.rightPageBlockMesh.position.y = coverThickness + targetRightH / 2

          if (this.rightCurvedPageMesh) {
            const rMat = this.rightCurvedPageMesh.material as THREE.MeshStandardMaterial
            rMat.map = getPageTex(targetPage)
            rMat.needsUpdate = true
            this.rightCurvedPageMesh.position.y = coverThickness + targetRightH + 0.0003
          }
          if (this.leftCurvedPageMesh) {
            this.leftCurvedPageMesh.position.y = coverThickness + targetLeftH + 0.0003
          }
          const maxStackHBwd = Math.max(targetLeftH, targetRightH)
          if (this.gutterShadowMesh) {
            this.gutterShadowMesh.position.y = coverThickness + maxStackHBwd + 0.0004
          }

          // Double-buffered frame synchronization:
          requestAnimationFrame(() => {
            this.pagePivot.visible = false
            this.applyPageCurl(0, false)
            this.isFlipping = false
            this.callbacks.onPageFlipped?.(targetPage)
            this.prefetchPages(targetPage)
          })
        },
      })

      const flipStart = this.beginHandTurn(tl, isFlippingForward)
      tl.to(anim, {
        p: 1,
        duration: flipStart > 0 ? 0.95 : 0.88,
        ease: 'power2.inOut',
        onUpdate: () => {
          const p = anim.p
          const curLeftH = prevLeftH + (targetLeftH - prevLeftH) * p
          const curRightH = prevRightH + (targetRightH - prevRightH) * p

          this.leftPageBlockMesh.scale.y = curLeftH / pageBlockThickness
          this.leftPageBlockMesh.position.y = coverThickness + curLeftH / 2

          this.rightPageBlockMesh.scale.y = curRightH / pageBlockThickness
          this.rightPageBlockMesh.position.y = coverThickness + curRightH / 2

          if (this.leftCurvedPageMesh) {
            this.leftCurvedPageMesh.position.y = coverThickness + curLeftH + 0.0003
          }
          if (this.rightCurvedPageMesh) {
            this.rightCurvedPageMesh.position.y = coverThickness + curRightH + 0.0003
          }

          if (!hasPreloadedRight && p >= 0.65) {
            hasPreloadedRight = true
            if (this.rightCurvedPageMesh) {
              const rMat = this.rightCurvedPageMesh.material as THREE.MeshStandardMaterial
              rMat.map = getPageTex(targetPage)
              rMat.needsUpdate = true
            }
            if (Array.isArray(rightBlockMats) && rightBlockMats[2]) {
              rightBlockMats[2].map = getPageTex(targetPage)
              rightBlockMats[2].needsUpdate = true
            }
          }

          this.pagePivot.rotation.z = (1 - p) * Math.PI

          const baseY = p * curRightH + (1 - p) * curLeftH
          const airLift = 0.018 * Math.sin(Math.PI * p)
          this.pagePivot.position.y = coverThickness + baseY + airLift

          this.applyPageCurl(p, false)
          this.onHandTurnProgress(p)
          if (p >= 0.05) revealUnderneath()
        },
      }, flipStart)
    }
  }

  // Book Controller: Return to Shelf Animation
  public returnToShelf() {
    if (this.state === 'room-view' || this.state === 'book-flying') return

    const wasOpen = this.state === 'book-open'
    this.state = 'book-flying'
    if (this.readingBoost) this.setReadingResolution(false)

    const shelfMesh = this.shelfBooksMap.get(this.currentBookData.id) || this.interactiveShelfBookMesh
    const shelfWorldPos = new THREE.Vector3()
    if (shelfMesh) {
      shelfMesh.getWorldPosition(shelfWorldPos)
    } else {
      shelfWorldPos.copy(this.shelfBookPos)
    }

    const camFocus = {
      x: this.deskCamTarget.x,
      y: this.deskCamTarget.y,
      z: this.deskCamTarget.z,
    }

    const bookWidth = this.bookWidth
    const bookThickness = this.bookThickness
    const coverThickness = this.coverThickness
    const pageBlockThickness = this.pageBlockThickness

    const tl = gsap.timeline({
      onComplete: () => {
        this.state = 'room-view'
        this.heroBookGroup.visible = false
        this.leftPageBlockMesh.visible = false
        this.pagePivot.visible = false
        this.currentPage = 1
        this.isFlipping = false
        if (this.rightCurvedPageMesh) this.rightCurvedPageMesh.visible = false
        if (this.leftCurvedPageMesh) this.leftCurvedPageMesh.visible = false
        if (this.gutterShadowMesh) this.gutterShadowMesh.visible = false
        this.contactShadowRight.visible = false
        this.contactShadowLeft.visible = false
        this.callbacks.onBookClosed?.()

        // Restore shelf glow
        gsap.to(this.heroBookGlow, { intensity: 1.1, duration: 0.4 })
      },
    })

    // Dynamic camera tracking during return flight
    tl.eventCallback('onUpdate', () => {
      this.camera.lookAt(camFocus.x, camFocus.y, camFocus.z)
    })

    // Park any active flipping leaf immediately
    this.pagePivot.visible = false

    // STAGE 1: Smoothly fold the book COMPLETELY on the reading stand itself
    // If the book was open, fold all pages and cover neatly over the reading stand before taking off
    const foldDuration = wasOpen ? 0.45 : 0.0
    const flightStartTime = foldDuration

    if (wasOpen) {
      // 1a. Fade out open left contact shadow
      tl.to(this.contactShadowLeft.material, { opacity: 0, duration: 0.25, ease: 'power2.out' }, 0)

      // 1b. Smoothly collapse left page stack and restore right page stack to full thickness
      tl.to(this.leftPageBlockMesh.scale, { y: 0.0001, duration: 0.38, ease: 'power2.inOut' }, 0)
      tl.to(this.rightPageBlockMesh.scale, { y: 1.0, duration: 0.38, ease: 'power2.inOut' }, 0)
      tl.to(
        this.rightPageBlockMesh.position,
        { y: coverThickness + pageBlockThickness / 2, duration: 0.38, ease: 'power2.inOut' },
        0
      )

      tl.to(this.pageOpenness, { value: 0, duration: 0.3, ease: 'power2.in' }, 0)

      // 1c. Swing front cover smoothly from left (open = PI) to right (closed = 0) over the book holder
      tl.to(this.bookCoverPivot.rotation, { z: 0, duration: 0.42, ease: 'power2.inOut' }, 0)
      tl.to(
        this.bookCoverPivot.position,
        { y: bookThickness - coverThickness / 2, duration: 0.42, ease: 'power2.inOut' },
        0
      )
      tl.to(this.spineMesh.position, { y: bookThickness / 2, duration: 0.42, ease: 'power2.inOut' }, 0)

      // 1d. As front cover swings past 90 degrees (t = 0.22s), tuck and hide open curved pages inside
      // so NO page protrudes or sticks outside the book!
      tl.call(
        () => {
          if (this.leftCurvedPageMesh) this.leftCurvedPageMesh.visible = false
          if (this.rightCurvedPageMesh) this.rightCurvedPageMesh.visible = false
          if (this.gutterShadowMesh) this.gutterShadowMesh.visible = false
          if (this.leftPageBlockMesh) this.leftPageBlockMesh.visible = false
        },
        [],
        0.22
      )
    }

    // Reset book target hit box
    this.bookTargetMesh.position.set(bookWidth / 2, bookThickness / 2, 0)
    this.bookTargetMesh.scale.set(1, 1, 1)

    // STAGE 2: Only after fully folded and closed on the stand, take flight smoothly to the bookshelf!
    tl.call(() => {
      this.callbacks.onBookFlightStarted?.()
    }, [], flightStartTime)

    const flightDuration = 0.90
    const targetReturnX = shelfWorldPos.x + 0.021
    const targetReturnZ = shelfWorldPos.z + 0.38 + 0.14
    const startFlightY = this.tableBookPos.y

    // Fade out desk contact shadow as the closed book lifts off the stand
    tl.to(
      this.contactShadowRight.material,
      { opacity: 0, duration: 0.25, ease: 'power2.out' },
      flightStartTime
    )

    // Smooth horizontal translation (desk -> shelf)
    tl.to(
      this.heroBookGroup.position,
      {
        x: targetReturnX,
        z: targetReturnZ,
        duration: flightDuration,
        ease: 'power2.inOut',
      },
      flightStartTime
    )

    // Aerodynamic tilt: reading stand angle (78°) -> upright shelf slot angle
    tl.to(
      this.heroBookGroup.rotation,
      {
        x: this.shelfBookRot.x,
        y: this.shelfBookRot.y,
        z: this.shelfBookRot.z,
        duration: flightDuration,
        ease: 'power2.inOut',
      },
      flightStartTime
    )

    // Continuous parabolic vertical lift arc: Y(p) = lerp(startY, targetY, p) + sin(pi * p) * 0.36
    const returnObj = { p: 0 }
    tl.to(
      returnObj,
      {
        p: 1,
        duration: flightDuration,
        ease: 'power2.inOut',
        onUpdate: () => {
          const t = returnObj.p
          const verticalArc = Math.sin(Math.PI * t) * 0.36
          this.heroBookGroup.position.y =
            THREE.MathUtils.lerp(startFlightY, shelfWorldPos.y, t) + verticalArc
        },
      },
      flightStartTime
    )

    // STAGE 3: Camera smoothly returns to chamber overview in sync with the flight
    tl.to(
      this.camera.position,
      {
        x: this.initialCamPos.x,
        y: this.initialCamPos.y,
        z: this.initialCamPos.z,
        duration: flightDuration,
        ease: 'power2.inOut',
      },
      flightStartTime
    )

    tl.to(
      camFocus,
      {
        x: this.initialCamTarget.x,
        y: this.initialCamTarget.y,
        z: this.initialCamTarget.z,
        duration: flightDuration,
        ease: 'power2.inOut',
      },
      flightStartTime
    )

    // STAGE 4: Hand off at shelf position and slide gently into shelf slot
    const handoffTime = flightStartTime + flightDuration
    tl.call(
      () => {
        this.heroBookGroup.visible = false
        if (shelfMesh) {
          const restingZ = (shelfMesh.userData.restingPos as THREE.Vector3)?.z ?? 0.01
          shelfMesh.position.z = restingZ + 0.38
          shelfMesh.visible = true
          gsap.to(shelfMesh.position, {
            z: restingZ,
            duration: 0.27,
            ease: 'power2.out',
          })
        }
      },
      [],
      handoffTime
    )
  }



  // Realistic Drinking Green Tea Animation
  public drinkTea() {
    this.triggerShadowUpdate(45)
    if (this.isDrinking) return
    this.isDrinking = true
    this.callbacks.onTeaDrinkingStarted?.()

    const startPos = { x: 0.72, y: 0.809, z: -0.25 }
    const targetLiftPos = { x: 0.28, y: 1.48, z: 1.6 }
    const targetDrinkPos = { x: 0.22, y: 1.56, z: 1.85 }

    const tl = gsap.timeline({
      onComplete: () => {
        this.isDrinking = false
        this.callbacks.onTeaDrinkingCompleted?.()
      },
    })

    // 1. Lift smoothly towards the viewer / mouth
    tl.to(this.cupGroup.position, {
      x: targetLiftPos.x,
      y: targetLiftPos.y,
      z: targetLiftPos.z,
      duration: 0.92,
      ease: 'power2.out',
    })

    // Gentle camera lean to meet the cup in first-person
    if (this.camera) {
      tl.to(this.camera.position, {
        z: this.initialCamPos.z - 0.12,
        y: this.initialCamPos.y - 0.04,
        duration: 0.92,
        ease: 'power2.out',
      }, '<')
    }

    tl.to(this.cupGroup.rotation, {
      x: -0.28,
      y: 0.14,
      z: 0.06,
      duration: 0.75,
      ease: 'power2.out',
    }, '-=0.5')

    // 2. Tip cup up to drink and trigger sip audio callback right at the lips
    tl.to(this.cupGroup.position, {
      x: targetDrinkPos.x,
      y: targetDrinkPos.y,
      z: targetDrinkPos.z,
      duration: 0.45,
      ease: 'power1.inOut',
      onStart: () => {
        this.callbacks.onTeaDrinkingSip?.()
      },
    })

    tl.to(this.cupGroup.rotation, {
      x: -0.62,
      y: 0.18,
      z: 0.10,
      duration: 0.45,
      ease: 'power1.inOut',
    }, '<')

    // Savor the warm matcha tea (pause)
    tl.to({}, { duration: 0.75 })

    // 3. Lower cup back down & restore rotation
    tl.to(this.cupGroup.rotation, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.65,
      ease: 'power2.inOut',
    })

    if (this.camera) {
      tl.to(this.camera.position, {
        x: this.initialCamPos.x,
        y: this.initialCamPos.y,
        z: this.initialCamPos.z,
        duration: 0.75,
        ease: 'power2.inOut',
      }, '<')
    }

    tl.to(this.cupGroup.position, {
      x: startPos.x,
      y: startPos.y,
      z: startPos.z,
      duration: 0.75,
      ease: 'power2.inOut',
    }, '-=0.45')

    // Tiny tactile settle bounce upon touching the wooden coaster
    tl.to(this.cupGroup.position, {
      y: startPos.y - 0.002,
      duration: 0.08,
      ease: 'power1.out',
    })
    tl.to(this.cupGroup.position, {
      y: startPos.y,
      duration: 0.12,
      ease: 'power1.out',
    })
  }

  private onResize = () => {
    if (!this.canvas) return
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.currentDPR)
    this.renderer.setSize(width, height, false)
    this.triggerShadowUpdate(15)
  }


  // =========================================================
  // MULTI-ROOM, HALLWAY & EXPLORE MODE 3D ARCHITECTURE
  // =========================================================

  private buildEntranceDoorAndPlaque() {
    // Architectural Cedar Frame Pillars for Study Room Door (X = 0, Z = 3.88)
    const frameMat = this.palette.walnutDark

    const pillarGeo = new THREE.BoxGeometry(0.12, 3.0, 0.14)
    const leftPillar = new THREE.Mesh(pillarGeo, frameMat)
    leftPillar.position.set(-0.86, 1.45, 3.89)
    this.scene.add(leftPillar)

    const rightPillar = new THREE.Mesh(pillarGeo, frameMat)
    rightPillar.position.set(0.86, 1.45, 3.89)
    this.scene.add(rightPillar)

    const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.16, 0.16), frameMat)
    headerBeam.position.set(0, 2.95, 3.89)
    this.scene.add(headerBeam)

    // Sliding Shoji Door Leaves (Left & Right)
    const doorTex = createShojiDoorPanelTexture()
    const doorMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.5,
      metalness: 0.05,
    })
    const doorGeo = new THREE.BoxGeometry(0.82, 2.85, 0.04)

    this.studyDoorLeft = new THREE.Mesh(doorGeo, doorMat)
    this.studyDoorLeft.position.set(-0.41, 1.43, 3.87)
    this.studyDoorLeft.castShadow = true

    this.studyDoorRight = new THREE.Mesh(doorGeo, doorMat)
    this.studyDoorRight.position.set(0.41, 1.43, 3.87)
    this.studyDoorRight.castShadow = true

    this.studyDoorGroup.add(this.studyDoorLeft)
    this.studyDoorGroup.add(this.studyDoorRight)
    this.scene.add(this.studyDoorGroup)

    this.interactiveDoors.push({ mesh: this.studyDoorGroup, roomId: 'study-room' })

    // Modern Illuminated Room Plaque (Mounted outside in hallway beside the door)
    const plaqueTex = createModernRoomLabelTexture(
      'Study Room',
      'Class 1-5 Knowledge Archive · 44 Volumes',
      '📖',
      this.isLightOn,
      1
    )
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      transparent: true,
      roughness: 0.25,
      metalness: 0.1,
    })
    const plaqueGeo = new THREE.PlaneGeometry(1.0, 0.5)
    this.studyDoorPlaque = new THREE.Mesh(plaqueGeo, plaqueMat)
    this.studyDoorPlaque.position.set(1.48, 1.65, 3.96) // Facing into hallway (+Z)
    this.scene.add(this.studyDoorPlaque)

    // Physical 3D Light Switch (Mounted inside Study Room beside the door)
    // Study light switch, inside the study beside the door
    this.studyWallSwitch = this.addWallSwitch(this.scene, 0.98, 3.83, Math.PI, 'study-room', 'study-room', this.isLightOn)
  }

  private buildGrandHallway() {
    // Grand Japanese Corridor (engawa): Width 28m (X: -14 to +14), Depth 3.42m (Z: 3.88 to 7.30), Height 3.9m
    const wallMat = this.worldPlaster
    this.hallwayWallMat = wallMat
    const p = this.palette

    // 1. Polished Cedar Plank Floor
    // Polished cedar boards running down the corridor; low roughness so the environment reflects
    const floorGeo = new THREE.PlaneGeometry(28, 3.42)
    const floorMat = this.pbr.material('cedar', {
      repeat: [28 / 1.0, 3.42 / 1.0],
      rotation: Math.PI / 2,
      color: '#a68a72',
      roughness: 0.55,
    })
    const hallFloor = new THREE.Mesh(floorGeo, floorMat)
    hallFloor.rotation.x = -Math.PI / 2
    hallFloor.position.set(0, 0.002, 5.59)
    hallFloor.receiveShadow = true
    this.hallwayGroup.add(hallFloor)

    // Tatami Runner carpet along center corridor
    const runnerGeo = new THREE.PlaneGeometry(26, 1.4)
    const runnerMat = this.pbr.material('tatami', { repeat: [26 / 1.8, 1.4 / 1.8], roughness: 0.95 })
    const runner = new THREE.Mesh(runnerGeo, runnerMat)
    runner.rotation.x = -Math.PI / 2
    runner.position.set(0, 0.005, 5.59)
    runner.receiveShadow = true
    this.hallwayGroup.add(runner)

    // 2. Ceiling with Recessed Cedar Beams
    const beamMat = p.walnutDark
    const hallCeilingGeo = new THREE.PlaneGeometry(28, 3.42)
    const hallCeiling = new THREE.Mesh(hallCeilingGeo, this.darkCedarCeiling(28, 3.42))
    hallCeiling.rotation.x = Math.PI / 2
    hallCeiling.position.set(0, 3.9, 5.59)
    this.hallwayGroup.add(hallCeiling)

    for (let x = -13; x <= 13; x += 2.6) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 3.42), beamMat)
      b.position.set(x, 3.79, 5.59)
      b.castShadow = true
      this.hallwayGroup.add(b)
    }

    // 3. Corridor Solid End Walls at X = -14 and X = +14 (Eliminates black void!)
    const endWallGeo = new THREE.BoxGeometry(0.12, 3.9, 3.42)
    const leftEndWall = new THREE.Mesh(endWallGeo, wallMat)
    leftEndWall.position.set(-14.0, 1.95, 5.59)
    this.hallwayGroup.add(leftEndWall)

    const rightEndWall = new THREE.Mesh(endWallGeo, wallMat)
    rightEndWall.position.set(14.0, 1.95, 5.59)
    this.hallwayGroup.add(rightEndWall)

    // 4. Master Solid Inner Wall along Z = 3.88 with a doorway for every room (rebuilt as rooms are added)
    this.hallwayGroup.add(this.hallwayInnerWallGroup)
    this.rebuildHallwayInnerWall()

    // 5. Outer yukimi-shoji wall looking onto the garden (Z = 7.3) + parallax garden layers
    // Daylit washi: its own material so switching the study light off doesn't dim the corridor
    const corridorPaper = this.studyPaperGlow.clone()
    corridorPaper.name = 'corridor-paper'
    const outerShoji = createShojiWall(p, 28, { panels: 16, transom: this.plasterMaterial(28, 1.0), paper: corridorPaper })
    outerShoji.rotation.y = Math.PI
    outerShoji.position.set(0, 0, 7.3)
    this.hallwayGroup.add(outerShoji)
    this.buildGardenLayers(this.hallwayGroup, new THREE.Vector3(0, 0, 7.3), new THREE.Vector3(0, 0, 1), 28)

    // Timber posts along the inner wall, between the doorway slots
    for (const x of [-13.85, -8.25, -2.75, 2.75, 8.25, 13.85]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.13, 3.9, 0.1), p.walnutDark)
      post.position.set(x, 1.95, 3.97)
      post.castShadow = true
      this.hallwayGroup.add(post)
    }
    // Baseboards and ceiling trim
    for (const z of [3.93, 7.24]) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(28, 0.09, 0.02), p.walnutDark)
      base.position.set(0, 0.045, z)
      this.hallwayGroup.add(base)
    }

    // Paper floor andon lanterns along the garden side, opposite each doorway (emissive only)
    this.hallwayLanternPaper = new THREE.MeshStandardMaterial({
      name: 'hallway-lantern-paper',
      color: '#f3ead6',
      emissive: '#ffcf8f',
      emissiveIntensity: 0.9,
      roughness: 0.92,
    })
    this.hallwayEmissives.push(this.hallwayLanternPaper)
    const andonXs = [-11, -5.5, 0, 5.5, 11]
    for (const x of andonXs) {
      const andon = createFloorAndon(p, this.hallwayLanternPaper)
      andon.position.set(x, 0, 6.95)
      this.hallwayGroup.add(andon)
    }
    this.buildShadowDecals(this.hallwayGroup, andonXs.map((x) => [x, 6.95, 0.6, 0.6] as [number, number, number, number]))

    // Indigo noren over the study doorway
    this.addDoorwayNoren(this.hallwayGroup, 0, 1)

    // 6. Hallway Lighting System (Warm Japanese Ryokan Illumination)
    const hallAmbient = new THREE.AmbientLight('#fff1e6', 0.65)
    this.hallwayAmbientLight = hallAmbient
    this.hallwayLights.push(hallAmbient)
    this.hallwayGroup.add(hallAmbient)

    // Recessed ceiling LED spotlights down the corridor (virtual fixtures lit by the spot pool)
    this.hallwaySpotLights = []
    const spotPositions = [-11.0, -7.5, -4.0, 0, 4.0, 7.5, 11.0]
    for (const sx of spotPositions) {
      const spot = createVirtualLight(
        'spot',
        '#fed7aa',
        1.45,
        14,
        1.2,
        new THREE.Vector3(sx, 3.8, 5.59),
        new THREE.Vector3(sx, 0, 5.59),
        Math.PI / 3.2,
        0.45
      )
      this.spotFixtures.push(spot)
      this.hallwayLights.push(spot)
      this.hallwaySpotLights.push(spot)

      this.hallwayFixtureMaterial ??= new THREE.MeshBasicMaterial({ color: '#fff7ed', name: 'hallway-fixture' })
      const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), this.hallwayFixtureMaterial)
      fixture.position.set(sx, 3.88, 5.59)
      this.hallwayGroup.add(fixture)
    }

    // Illuminated Cedar & Washi Wall Sconces on Left and Right End Walls
    const lanternGeo = new THREE.BoxGeometry(0.18, 0.45, 0.28)
    const lanternMat = new THREE.MeshStandardMaterial({
      name: 'hallway-sconce',
      color: '#fff7ed',
      emissive: '#fed7aa',
      emissiveIntensity: 0.9,
      roughness: 0.3,
    })
    this.hallwayEmissives.push(lanternMat)

    const leftLantern = new THREE.Mesh(lanternGeo, lanternMat)
    leftLantern.position.set(-13.88, 2.2, 5.59)
    this.hallwayGroup.add(leftLantern)

    const leftEndLight = createVirtualLight('point', '#fed7aa', 1.4, 9, 1.2, new THREE.Vector3(-13.5, 2.2, 5.59))
    this.hallwayLeftLight = leftEndLight
    this.hallwayLights.push(leftEndLight)
    this.pointFixtures.push(leftEndLight)

    const rightLantern = new THREE.Mesh(lanternGeo, lanternMat)
    rightLantern.position.set(13.88, 2.2, 5.59)
    this.hallwayGroup.add(rightLantern)

    const rightEndLight = createVirtualLight('point', '#fed7aa', 1.4, 9, 1.2, new THREE.Vector3(13.5, 2.2, 5.59))
    this.hallwayRightLight = rightEndLight
    this.hallwayLights.push(rightEndLight)
    this.pointFixtures.push(rightEndLight)

    // Hallway Light Switch (Beside Study Room door in the hallway)
    // Corridor light switches: beside the study door and on both end walls (every room door gets
    // one too, see createCustomRoom), so there's always one within reach in the hall
    this.hallwayWallSwitch = this.addWallSwitch(this.hallwayGroup, -1.48, 3.96, 0, 'hallway', 'hallway', this.isHallwayLightOn)
    this.addWallSwitch(this.hallwayGroup, -13.93, 4.7, Math.PI / 2, 'hallway', 'hallway', this.isHallwayLightOn)
    this.addWallSwitch(this.hallwayGroup, 13.93, 4.7, -Math.PI / 2, 'hallway', 'hallway', this.isHallwayLightOn)

    this.scene.add(this.hallwayGroup)
  }

  /**
   * Corridor partition wall (Z = 3.88) with a 1.6m doorway + lintel at the study door and at every
   * custom room door. Previously the openings were hard-coded for X = ±5.5 only, so rooms created in
   * the outer slots (X = ±11) sat behind a solid wall.
   */
  private rebuildHallwayInnerWall() {
    const wallMat = this.hallwayWallMat
    if (!wallMat) return

    for (const child of [...this.hallwayInnerWallGroup.children]) {
      this.hallwayInnerWallGroup.remove(child)
      ;(child as THREE.Mesh).geometry?.dispose()
    }

    const halfDoor = 0.8
    const wallMinX = -14.0
    const wallMaxX = 14.0
    const doorXs = [0, ...Array.from(this.customRooms.values(), (r) => r.doorX)]
      .filter((x) => x - halfDoor > wallMinX && x + halfDoor < wallMaxX)
      .sort((a, b) => a - b)

    const addSegment = (fromX: number, toX: number) => {
      const width = toX - fromX
      if (width <= 0.001) return
      const seg = new THREE.Mesh(new THREE.BoxGeometry(width, 3.9, 0.08), wallMat)
      seg.position.set((fromX + toX) / 2, 1.95, 3.88)
      this.hallwayInnerWallGroup.add(seg)
    }

    let cursor = wallMinX
    for (const doorX of doorXs) {
      addSegment(cursor, doorX - halfDoor)
      // Lintel above the doorway (Y: 2.9 to 3.9)
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(halfDoor * 2, 1.0, 0.08), wallMat)
      lintel.position.set(doorX, 3.4, 3.88)
      this.hallwayInnerWallGroup.add(lintel)
      cursor = doorX + halfDoor
    }
    addSegment(cursor, wallMaxX)
  }

  private buildDefaultRooms() {
    // Pre-create Room 2: Library Chamber (fixed ID matching Vue chips)
    this.createCustomRoom(
      'Library Chamber',
      'Curated Academic Literature & Reference',
      '📚',
      'library',
      5.5,
      'room-lib'
    )

    // Pre-create Room 3: Meditation Dojo (fixed ID matching Vue chips)
    this.createCustomRoom(
      'Meditation Dojo',
      'Zen Mindfulness, Bonsai & Tea Pavilion',
      '🧘',
      'meditation',
      -5.5,
      'room-zen'
    )
  }

  public createCustomRoom(
    name: string,
    subtitle = 'Custom Chamber',
    icon = '✨',
    theme: 'study' | 'library' | 'meditation' | 'gallery' | 'science' = 'library',
    requestedSlot?: number,
    fixedId?: string
  ): CustomRoomData | null {
    const roomId = fixedId || `room-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const slotX = requestedSlot !== undefined ? requestedSlot : this.getNextAvailableSlot()
    // Every corridor slot is taken (a further room would overlap an existing one)
    if (slotX === null) return null
    const roomIndex = this.customRooms.size + 2

    const roomGroup = new THREE.Group()
    // Everything behind the door lives in `interior`, which is only rendered while you're inside the
    // room or its door is open. Door frame, leaves and noren stay in `roomGroup` (seen from the corridor).
    const interior = new THREE.Group()
    roomGroup.add(interior)
    const doorGroup = new THREE.Group()
    const roomLights: RoomLight[] = []

    const wallMat = this.worldPlaster
    const frameMat = this.palette.walnutDark

    // 1. Room Floor (Width 5.0m, Depth 4.18m from Z: -0.3 to 3.88)
    const floorMat =
      theme === 'meditation'
        ? this.pbr.material('tatami', { repeat: [5.0 / 1.8, 4.18 / 1.8], roughness: 0.95 })
        : this.pbr.material('cedar', {
            repeat: [5.0 / 1.0, 4.18 / 1.0],
            rotation: Math.PI / 2,
            color: theme === 'gallery' ? '#e6d3c2' : '#b98d70',
            roughness: 0.75,
          })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 4.18), floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.position.set(slotX, 0.002, 1.79)
    floor.receiveShadow = true
    interior.add(floor)

    // Back wall at Z = -0.3
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 3.9), wallMat)
    backWall.position.set(slotX, 1.95, -0.3)
    backWall.receiveShadow = true
    interior.add(backWall)

    // Left wall at X = slotX - 2.5
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(4.18, 3.9), wallMat)
    leftWall.position.set(slotX - 2.5, 1.95, 1.79)
    leftWall.rotation.y = Math.PI / 2
    interior.add(leftWall)

    // Right wall at X = slotX + 2.5
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(4.18, 3.9), wallMat)
    rightWall.position.set(slotX + 2.5, 1.95, 1.79)
    rightWall.rotation.y = -Math.PI / 2
    interior.add(rightWall)

    // Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(5.0, 4.18)
    const ceiling = new THREE.Mesh(ceilingGeo, this.darkCedarCeiling(5.0, 4.18))
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.set(slotX, 3.9, 1.79)
    interior.add(ceiling)

    // Door Frame Pillars
    const lp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 0.14), frameMat)
    lp.position.set(slotX - 0.86, 1.45, 3.89)
    roomGroup.add(lp)

    const rp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 0.14), frameMat)
    rp.position.set(slotX + 0.86, 1.45, 3.89)
    roomGroup.add(rp)

    const hb = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.16, 0.16), frameMat)
    hb.position.set(slotX, 2.95, 3.89)
    roomGroup.add(hb)

    // Sliding Shoji Door Leaves
    const doorTex = createShojiDoorPanelTexture()
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.5 })
    const doorGeo = new THREE.BoxGeometry(0.82, 2.85, 0.04)

    const doorLeft = new THREE.Mesh(doorGeo, doorMat)
    doorLeft.position.set(slotX - 0.41, 1.43, 3.87)

    const doorRight = new THREE.Mesh(doorGeo, doorMat)
    doorRight.position.set(slotX + 0.41, 1.43, 3.87)

    doorGroup.add(doorLeft)
    doorGroup.add(doorRight)
    roomGroup.add(doorGroup)

    this.interactiveDoors.push({ mesh: doorGroup, roomId })

    // 2. Themed furnishings, trim, noren and contact shadows
    const colliders: RoomCollider[] = []
    const glowMaterials: THREE.MeshStandardMaterial[] = []
    this.furnishRoom(interior, theme, slotX, roomLights, colliders, glowMaterials)
    for (const monk of this.monks) if (!monk.roomId) monk.roomId = roomId
    this.addDoorwayNoren(roomGroup, slotX, roomIndex)

    // 3. Room Dedicated Lighting System
    const roomAmbient = new THREE.AmbientLight('#f1f5f9', 0.5)
    roomLights.push(roomAmbient)
    roomGroup.add(roomAmbient)

    const roomSpot = createVirtualLight(
      'spot',
      '#fed7aa',
      1.6,
      10,
      2,
      new THREE.Vector3(slotX, 3.6, 1.79),
      new THREE.Vector3(slotX, 0, 1.79),
      Math.PI / 3,
      0.35
    )
    roomLights.push(roomSpot)
    this.spotFixtures.push(roomSpot)

    // 4. Modern Illuminated Room Plaque (in Hallway beside door)
    const plaqueTex = createModernRoomLabelTexture(name, subtitle, icon, true, roomIndex)
    const plaqueMat = new THREE.MeshStandardMaterial({
      map: plaqueTex,
      transparent: true,
      roughness: 0.25,
      metalness: 0.1,
    })
    const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), plaqueMat)
    labelMesh.position.set(slotX + 1.48, 1.65, 3.96)
    this.scene.add(labelMesh)

    // 5. 3D Light Switch (inside the room facing -Z)
    const switchMesh = this.addWallSwitch(interior, slotX + 0.98, 3.83, Math.PI, roomId, roomId, true)
    // Corridor switch beside this room's door (hall side)
    this.addWallSwitch(roomGroup, slotX - 1.2, 3.96, 0, 'hallway', 'hallway', this.isHallwayLightOn)
    this.envLevels.set(roomId, { value: 0.45 })

    this.scene.add(roomGroup)

    const roomData: CustomRoomData = {
      id: roomId,
      name,
      subtitle,
      icon,
      theme,
      doorX: slotX,
      doorZ: 3.88,
      isLightOn: true,
      group: roomGroup,
      interior,
      doorGroup,
      doorLeft,
      doorRight,
      isDoorOpen: false,
      labelMesh,
      switchMesh,
      lights: roomLights,
      roomIndex,
      colliders,
      glowMaterials,
    }

    this.customRooms.set(roomId, roomData)
    this.rebuildHallwayInnerWall()
    if (this.staticMeshesOptimized) {
      // Rooms added after startup get the same static-mesh merging as the initial scene
      this.optimizeStaticMeshes()
      this.warmUpShaders()
    }
    this.updateSpatialLights(true)
    this.triggerShadowUpdate(10)
    this.callbacks.onRoomCreated?.({ id: roomId, name, icon, theme })
    return roomData
  }

  private getNextAvailableSlot(): number | null {
    const usedSlots = new Set<number>([0])
    for (const r of this.customRooms.values()) {
      usedSlots.add(r.doorX)
    }
    for (const slot of this.availableSlots) {
      if (!usedSlots.has(slot)) return slot
    }
    return null
  }

  public toggleDoor(roomId = 'study-room') {
    let doorLeft: THREE.Mesh | undefined
    let doorRight: THREE.Mesh | undefined
    let isOpen = false
    let doorCenterX = 0

    if (roomId === 'study-room') {
      doorLeft = this.studyDoorLeft
      doorRight = this.studyDoorRight
      this.isStudyDoorOpen = !this.isStudyDoorOpen
      isOpen = this.isStudyDoorOpen
      doorCenterX = 0
    } else {
      const room = this.customRooms.get(roomId)
      if (room) {
        doorLeft = room.doorLeft
        doorRight = room.doorRight
        room.isDoorOpen = !room.isDoorOpen
        isOpen = room.isDoorOpen
        doorCenterX = room.doorX
      }
    }

    if (!doorLeft || !doorRight) return

    const leftClosed = doorCenterX - 0.41
    const rightClosed = doorCenterX + 0.41
    // Leaves slide fully into the wall pocket (0.84m) so no half-open panel hangs in the doorway
    const leftTarget = isOpen ? leftClosed - 0.84 : leftClosed
    const rightTarget = isOpen ? rightClosed + 0.84 : rightClosed

    this.callbacks.onPlayDoorSlide?.()
    // Reveal the room as the door starts opening; hide it only once the door has fully closed
    if (isOpen) this.updateSpatialLights(true)

    gsap.to(doorLeft.position, {
      x: leftTarget,
      duration: 0.75,
      ease: 'power2.inOut',
    })

    gsap.to(doorRight.position, {
      x: rightTarget,
      duration: 0.75,
      ease: 'power2.inOut',
      onComplete: () => {
        if (!isOpen) this.updateSpatialLights(true)
        this.callbacks.onDoorInteracted?.(roomId, isOpen)
      },
    })
  }

  /**
   * Wall light switch: lit plate on a walnut back-plate with a generous invisible hit area so it's
   * easy to click. `zone` is where it hangs (for the proximity prompt), `targetId` the lights it runs.
   */
  private addWallSwitch(
    parent: THREE.Object3D,
    x: number,
    z: number,
    rotationY: number,
    zone: string,
    targetId: string,
    isOn: boolean
  ): THREE.Mesh {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.24),
      new THREE.MeshStandardMaterial({ map: createLightSwitchTexture(isOn), roughness: 0.4, name: `switch-${targetId}-${x}` })
    )
    plate.position.set(x, 1.4, z)
    plate.rotation.y = rotationY
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.02), this.palette.walnutDark)
    back.position.z = -0.012
    plate.add(back)
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.6), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.z = 0.01
    plate.add(hit)
    parent.add(plate)
    this.interactiveSwitches.push({ mesh: plate, targetId })
    this.wallSwitches.push({ mesh: plate, zone, targetId })
    return plate
  }

  private updateSwitchPlates(targetId: string, isOn: boolean) {
    for (const sw of this.wallSwitches) {
      if (sw.targetId === targetId) this.swapMaterialMap(sw.mesh, createLightSwitchTexture(isOn))
    }
  }

  private lightStateOf(targetId: string): boolean {
    if (targetId === 'study-room') return this.isLightOn
    if (targetId === 'hallway') return this.isHallwayLightOn
    return this.customRooms.get(targetId)?.isLightOn ?? true
  }

  /** Shows "turn the light on/off" when standing next to a switch in the current zone. */
  private checkSwitchProximity(force = false) {
    let prompt: SwitchPromptData = { show: false, targetId: '', zoneName: '', isOn: true }
    if (this.isExploreMode) {
      let best = 1.6
      for (const sw of this.wallSwitches) {
        if (sw.zone !== this.currentZone) continue
        const p = sw.mesh.getWorldPosition(this._gripA)
        const d = Math.hypot(p.x - this.playerPos.x, p.z - this.playerPos.z)
        if (d < best) {
          best = d
          prompt = { show: true, targetId: sw.targetId, zoneName: this.getZoneName(sw.targetId), isOn: this.lightStateOf(sw.targetId) }
        }
      }
    }
    const prev = this.currentSwitchPrompt
    if (force || prompt.show !== prev.show || prompt.targetId !== prev.targetId || prompt.isOn !== prev.isOn) {
      this.currentSwitchPrompt = prompt
      this.callbacks.onNearSwitchPrompt?.(prompt)
    }
  }

  /** Swaps a material's texture, releasing the GPU copy of the one it replaces. */
  private swapMaterialMap(mesh: THREE.Mesh, map: THREE.Texture) {
    const mat = mesh.material as THREE.MeshStandardMaterial
    const previous = mat.map
    mat.map = map
    if (previous && previous !== map) previous.dispose()
  }

  public toggleRoomLight(targetId?: string): boolean {
    this.triggerShadowUpdate(45)
    this.markActivity()
    const activeTarget = targetId || this.currentZone
    // Refresh the "near a switch" prompt once the state has flipped
    queueMicrotask(() => this.checkSwitchProximity(true))

    if (activeTarget === 'study-room' || activeTarget === 'current') {
      this.isLightOn = !this.isLightOn
      const state = this.isLightOn

      // Full atmospheric lighting transitions
      if (!state) {
        gsap.to(this.lightLevels, { lamp: 0, duration: 0.35 })
        gsap.to(this.lightLevels, { sun: 0.04, moon: 0.85, duration: 0.5 })
        gsap.to(this.ambientLight, { intensity: 0.08, duration: 0.5 })
        gsap.to(this.ambientLight.color, { r: 0.08, g: 0.12, b: 0.24, duration: 0.5 })
        gsap.to(this.envLevels.get('study-room')!, { value: 0.07, duration: 0.5 })
        gsap.to(this.studyPaperGlow, { emissiveIntensity: 0.06, duration: 0.5 })
        if (this.lampBulbMaterial) gsap.to(this.lampBulbMaterial, { emissiveIntensity: 0.05, duration: 0.35 })
        for (const mat of this.studyGardenMaterials) gsap.to(mat.color, { r: 0.22, g: 0.28, b: 0.45, duration: 0.6 })

        if (this.lampShadeMesh) {
          const shadeMat = this.lampShadeMesh.material as THREE.MeshStandardMaterial
          gsap.to(shadeMat, { emissiveIntensity: 0.03, duration: 0.35 })
        }
        if (this.dustParticles) {
          const mat = this.dustParticles.material as THREE.PointsMaterial
          gsap.to(mat, { opacity: 0.95, size: 0.085, duration: 0.4 })
        }
      } else {
        gsap.to(this.lightLevels, { lamp: 3.2, duration: 0.35 })
        gsap.to(this.lightLevels, { sun: 1.6, moon: 0, duration: 0.5 })
        gsap.to(this.ambientLight, { intensity: 0.75, duration: 0.5 })
        gsap.to(this.ambientLight.color, { r: 1.0, g: 0.93, b: 0.85, duration: 0.5 })
        gsap.to(this.envLevels.get('study-room')!, { value: 0.45, duration: 0.5 })
        gsap.to(this.studyPaperGlow, { emissiveIntensity: 0.55, duration: 0.5 })
        if (this.lampBulbMaterial) gsap.to(this.lampBulbMaterial, { emissiveIntensity: 2.2, duration: 0.35 })
        for (const mat of this.studyGardenMaterials) gsap.to(mat.color, { r: 1, g: 1, b: 1, duration: 0.6 })

        if (this.lampShadeMesh) {
          const shadeMat = this.lampShadeMesh.material as THREE.MeshStandardMaterial
          gsap.to(shadeMat, { emissiveIntensity: 0.85, duration: 0.35 })
        }
        if (this.dustParticles) {
          const mat = this.dustParticles.material as THREE.PointsMaterial
          gsap.to(mat, { opacity: 0.85, size: 0.075, duration: 0.4 })
        }
      }

      // Update 3D Switch Plate
      this.updateSwitchPlates('study-room', state)

      // Update Study Room Plaque
      if (this.studyDoorPlaque) {
        this.swapMaterialMap(
          this.studyDoorPlaque,
          createModernRoomLabelTexture('Study Room', 'Class 1-5 Knowledge Archive · 44 Volumes', '📖', state, 1)
        )
      }

      this.callbacks.onLightToggled?.(state)
      this.callbacks.onRoomLightToggled?.('study-room', state)
      return state
    }

    if (activeTarget === 'hallway') {
      this.isHallwayLightOn = !this.isHallwayLightOn
      const state = this.isHallwayLightOn

      for (const light of this.hallwayLights) {
        const on = light instanceof THREE.AmbientLight ? 0.65 : light.kind === 'spot' ? 1.45 : 1.4
        gsap.to(light, { intensity: state ? on : light instanceof THREE.AmbientLight ? 0.05 : 0, duration: 0.4 })
      }
      gsap.to(this.envLevels.get('hallway')!, { value: state ? 0.45 : 0.05, duration: 0.4 })
      for (const mat of this.hallwayEmissives) {
        gsap.to(mat, { emissiveIntensity: state ? (mat.userData.onIntensity ?? 0.9) : 0.06, duration: 0.4 })
      }
      if (this.hallwayFixtureMaterial) {
        const c = state ? new THREE.Color('#fff7ed') : new THREE.Color('#3a352f')
        gsap.to(this.hallwayFixtureMaterial.color, { r: c.r, g: c.g, b: c.b, duration: 0.4 })
      }

      this.updateSwitchPlates('hallway', state)

      this.callbacks.onRoomLightToggled?.('hallway', state)
      return state
    }

    // Custom Room Light Toggle
    const custom = this.customRooms.get(activeTarget)
    if (custom) {
      custom.isLightOn = !custom.isLightOn
      const state = custom.isLightOn

      for (const light of custom.lights) {
        const mult = light instanceof THREE.AmbientLight ? (state ? 0.5 : 0.06) : state ? 1.6 : 0.0
        gsap.to(light, { intensity: mult, duration: 0.4 })
      }
      for (const mat of custom.glowMaterials) {
        gsap.to(mat, { emissiveIntensity: state ? (mat.userData.onIntensity ?? 0.8) : 0.08, duration: 0.4 })
      }

      this.updateSwitchPlates(activeTarget, state)
      const roomEnv = this.envLevels.get(activeTarget)
      if (roomEnv) gsap.to(roomEnv, { value: state ? 0.45 : 0.05, duration: 0.4 })

      if (custom.labelMesh) {
        this.swapMaterialMap(
          custom.labelMesh,
          createModernRoomLabelTexture(custom.name, custom.subtitle, custom.icon, state, custom.roomIndex)
        )
      }

      this.callbacks.onRoomLightToggled?.(activeTarget, state)
      return state
    }

    return this.isLightOn
  }

  public setExploreMode(enabled: boolean) {
    if (this.isExploreMode === enabled) return
    this.isExploreMode = enabled

    gsap.killTweensOf(this.camera.position)
    gsap.killTweensOf(this.camera.rotation)

    if (enabled) {
      // Enter First-Person Explore Mode
      this.state = 'explore'
      this.currentZone = 'study-room'
      this.playerPos.set(0, 1.65, 1.8)
      this.playerYaw = 0 // Facing into the room & bookshelf
      this.playerPitch = 0

      gsap.to(this.camera.position, {
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        duration: 0.8,
        ease: 'power2.inOut',
        onComplete: () => {
          this.camera.rotation.set(0, 0, 0, 'YXZ')
          this.callbacks.onExploreModeChanged?.(true)
          this.callbacks.onCurrentZoneChanged?.('study-room', 'Study Room')
          this.checkDoorProximity()
        },
      })
    } else {
      // Return to Desk / Shelf overview
      if (this.isMeditating) {
        this.isMeditating = false
        this.playerPos.y = 1.65
        this.callbacks.onMeditationChanged?.(false)
      }
      this.keys.forward = false
      this.keys.backward = false
      this.keys.left = false
      this.keys.right = false
      this.keys.shift = false
      this.isMouseDragging = false
      this.currentNearPrompt = { show: false, text: '', roomId: '', isOpen: false }
      this.callbacks.onNearDoorPrompt?.(this.currentNearPrompt)
      this.currentSwitchPrompt = { show: false, targetId: '', zoneName: '', isOn: true }
      this.callbacks.onNearSwitchPrompt?.(this.currentSwitchPrompt)

      gsap.to(this.camera.position, {
        x: this.initialCamPos.x,
        y: this.initialCamPos.y,
        z: this.initialCamPos.z,
        duration: 0.9,
        ease: 'power2.inOut',
        onUpdate: () => {
          this.camera.lookAt(this.initialCamTarget)
        },
        onComplete: () => {
          this.state = 'room-view'
          this.currentZone = 'study-room'
          this.camera.lookAt(this.initialCamTarget)
          this.callbacks.onExploreModeChanged?.(false)
          this.callbacks.onCurrentZoneChanged?.('study-room', 'Study Room')
        },
      })
    }
  }

  public teleportToZone(zoneId: string) {
    gsap.killTweensOf(this.camera.position)
    gsap.killTweensOf(this.camera.rotation)

    if (zoneId === 'study-room') {
      if (!this.isExploreMode) {
        return
      }
      this.state = 'explore'
      this.currentZone = 'study-room'
      this.playerPos.set(0, 1.65, 1.8)
      this.playerYaw = 0
      this.playerPitch = 0
      this.camera.position.set(0, 1.65, 1.8)
      this.camera.rotation.set(0, 0, 0, 'YXZ')
      this.callbacks.onExploreModeChanged?.(true)
      this.callbacks.onCurrentZoneChanged?.('study-room', 'Study Room')
      this.checkDoorProximity()
      return
    }

    this.isExploreMode = true
    this.state = 'explore'
    this.callbacks.onExploreModeChanged?.(true)

    let targetX = 0
    let targetZ = 5.5
    let yaw = -Math.PI / 2 // Facing down the Grand Corridor

    if (zoneId === 'hallway') {
      targetX = 0
      targetZ = 5.5
      yaw = -Math.PI / 2
      this.currentZone = 'hallway'
    } else {
      let room = this.customRooms.get(zoneId)
      if (!room) {
        for (const r of this.customRooms.values()) {
          if (r.id === zoneId || r.name.toLowerCase() === zoneId.toLowerCase()) {
            room = r
            break
          }
        }
      }
      if (room) {
        targetX = room.doorX
        targetZ = 1.9
        yaw = 0 // Inside chamber facing interior
        this.currentZone = room.id
      }
    }

    this.playerPos.set(targetX, 1.65, targetZ)
    this.playerYaw = yaw
    this.playerPitch = 0
    this.camera.position.set(targetX, 1.65, targetZ)
    this.camera.rotation.set(0, yaw, 0, 'YXZ')
    this.callbacks.onCurrentZoneChanged?.(this.currentZone, this.getZoneName(this.currentZone))
    this.checkDoorProximity()
  }

  public walkThroughDoor() {
    gsap.killTweensOf(this.playerPos)

    if (this.currentZone === 'study-room' && this.isStudyDoorOpen) {
      // Walk smoothly from inside study room out into grand corridor
      this.playerYaw = Math.PI
      this.playerPitch = 0
      gsap.to(this.playerPos, {
        x: 0,
        z: 5.2,
        duration: 1.1,
        ease: 'power2.inOut',
        onComplete: () => {
          this.currentZone = 'hallway'
          this.callbacks.onCurrentZoneChanged?.('hallway', 'Grand Corridor')
          this.checkDoorProximity()
        },
      })
    } else if (this.currentZone === 'hallway') {
      // If near study room door
      if (Math.abs(this.playerPos.x) < 1.3 && this.isStudyDoorOpen) {
        this.playerYaw = 0
        this.playerPitch = 0
        gsap.to(this.playerPos, {
          x: 0,
          z: 2.0,
          duration: 1.1,
          ease: 'power2.inOut',
          onComplete: () => {
            this.currentZone = 'study-room'
            this.callbacks.onCurrentZoneChanged?.('study-room', 'Study Room')
            this.checkDoorProximity()
          },
        })
      } else {
        // Check which custom room door
        for (const room of this.customRooms.values()) {
          if (Math.abs(this.playerPos.x - room.doorX) < 1.3 && room.isDoorOpen) {
            this.playerYaw = 0
            this.playerPitch = 0
            gsap.to(this.playerPos, {
              x: room.doorX,
              z: 2.0,
              duration: 1.1,
              ease: 'power2.inOut',
              onComplete: () => {
                this.currentZone = room.id
                this.callbacks.onCurrentZoneChanged?.(room.id, room.name)
                this.checkDoorProximity()
              },
            })
            break
          }
        }
      }
    } else {
      // Inside a custom room, walk out to hallway
      const room = this.customRooms.get(this.currentZone)
      if (room && room.isDoorOpen) {
        this.playerYaw = Math.PI
        this.playerPitch = 0
        gsap.to(this.playerPos, {
          x: room.doorX,
          z: 5.2,
          duration: 1.1,
          ease: 'power2.inOut',
          onComplete: () => {
            this.currentZone = 'hallway'
            this.callbacks.onCurrentZoneChanged?.('hallway', 'Grand Corridor')
            this.checkDoorProximity()
          },
        })
      }
    }
  }

  private getZoneName(zoneId: string): string {
    if (zoneId === 'study-room') return 'Study Room'
    if (zoneId === 'hallway') return 'Grand Corridor'
    const custom = this.customRooms.get(zoneId)
    return custom?.name || 'Chamber'
  }

  private interactNearest() {
    if (this.isMeditating) return
    if (this.nearMonkRoomId) {
      this.callbacks.onMonkInteract?.(this.nearMonkRoomId)
      return
    }
    if (this.currentNearPrompt.show && this.currentNearPrompt.roomId) {
      this.toggleDoor(this.currentNearPrompt.roomId)
    }
  }

  private checkMonkProximity() {
    let near = ''
    if (this.isExploreMode && !this.isMeditating) {
      for (const monk of this.monks) {
        if (monk.roomId !== this.currentZone) continue
        const d = Math.hypot(monk.group.position.x - this.playerPos.x, monk.group.position.z - this.playerPos.z)
        if (d < 2.1) near = monk.roomId
      }
    }
    if (near !== this.nearMonkRoomId) {
      this.nearMonkRoomId = near
      this.callbacks.onNearMonk?.({ show: !!near, roomId: near })
    }
  }

  /** Sit down on the visitor's cushion facing the monk and hand the camera over to stillness. */
  public startMeditation(roomId: string) {
    const monk = this.monks.find((m) => m.roomId === roomId)
    if (!monk || this.isMeditating) return
    this.isMeditating = true
    this.keys.forward = this.keys.backward = this.keys.left = this.keys.right = this.keys.shift = false
    this.isMouseDragging = false
    // Unwind the yaw so the turn toward the monk takes the short way round
    this.playerYaw = Math.atan2(Math.sin(this.playerYaw), Math.cos(this.playerYaw))
    this.meditationStand = { x: this.playerPos.x, z: this.playerPos.z, yaw: this.playerYaw }
    this.nearMonkRoomId = ''
    this.callbacks.onNearMonk?.({ show: false, roomId })

    gsap.killTweensOf(this.playerPos)
    const seat = monk.seat
    const tl = gsap.timeline()
    // Step onto the cushion, then lower down into a seated posture facing the monk
    tl.to(this.playerPos, { x: seat.x, z: seat.z + 0.12, duration: 0.9, ease: 'power2.inOut' }, 0)
    tl.to(this, { playerYaw: 0, playerPitch: -0.16, duration: 0.9, ease: 'power2.inOut' }, 0)
    tl.to(this.playerPos, { y: 0.92, duration: 1.1, ease: 'power3.inOut' }, 0.6)
    const env = this.envLevels.get(roomId)
    const room = this.customRooms.get(roomId)
    if (env && room?.isLightOn) tl.to(env, { value: 0.28, duration: 2.0 }, 0.6)
    tl.call(() => this.callbacks.onMeditationChanged?.(true), [], 1.5)
  }

  /** Stand up from the cushion and return control to the player. */
  public endMeditation() {
    if (!this.isMeditating) return
    gsap.killTweensOf(this.playerPos)
    const roomId = this.currentZone
    const env = this.envLevels.get(roomId)
    const room = this.customRooms.get(roomId)
    const tl = gsap.timeline({
      onComplete: () => {
        this.isMeditating = false
        this.callbacks.onMeditationChanged?.(false)
        this.checkDoorProximity()
      },
    })
    tl.to(this.playerPos, { y: 1.65, duration: 1.0, ease: 'power2.inOut' }, 0)
    tl.to(this.playerPos, { z: this.playerPos.z + 0.45, duration: 0.8, ease: 'power2.out' }, 0.6)
    // Stand and keep a respectful downward glance toward the monk
    tl.to(this, { playerPitch: -0.28, duration: 0.8, ease: 'power2.inOut' }, 0)
    if (env) tl.to(env, { value: room?.isLightOn === false ? 0.05 : 0.45, duration: 1.2 }, 0)
  }


  private checkAllowedPosition(nextX: number, nextZ: number): { allowed: boolean; newZone?: string } {
    if (this.currentZone === 'study-room') {
      // Study Room Bounds: X [-2.85, 2.85], Z [-2.15, 3.88]
      // 1. Desk Obstacle: X [-1.25, 1.25], Z [-1.15, 0.15]
      if (Math.abs(nextX) < 1.25 && nextZ > -1.15 && nextZ < 0.15) {
        return { allowed: false }
      }
      // 2. Front Bookshelf Obstacle: Z < -2.15
      if (nextZ < -2.15) {
        return { allowed: false }
      }
      // 3. Tokonoma alcove platform on the right wall
      if (nextX > 2.3 && nextZ > -0.55 && nextZ < 1.35) {
        return { allowed: false }
      }
      // 4. Side Walls: X < -2.85 or X > 2.85
      if (nextX < -2.85 || nextX > 2.85) {
        return { allowed: false }
      }
      // 4. Doorway passage to hallway at X [-0.8, 0.8], Z = 3.88
      if (nextZ > 3.75) {
        const isDoor = Math.abs(nextX) < 0.8
        if (isDoor && this.isStudyDoorOpen) {
          if (nextZ > 4.0) {
            return { allowed: true, newZone: 'hallway' }
          }
          return { allowed: true }
        }
        return { allowed: false }
      }
      return { allowed: true }
    } else if (this.currentZone === 'hallway') {
      // Hallway Bounds: X [-13.6, 13.6], Z [4.05, 7.05]
      // 1. Outer Glass Shoji Wall & End Walls
      if (nextX < -13.6 || nextX > 13.6 || nextZ > 7.05) {
        return { allowed: false }
      }
      // 2. Inner Partition Wall along Z = 3.88
      if (nextZ < 4.1) {
        // Study Room Door (X: 0)
        if (Math.abs(nextX) < 0.8) {
          if (this.isStudyDoorOpen) {
            if (nextZ < 3.85) {
              return { allowed: true, newZone: 'study-room' }
            }
            return { allowed: true }
          }
          return { allowed: false }
        }
        // Custom Room Doors (Meditation Dojo at -5.5, Library Chamber at 5.5, etc.)
        for (const room of this.customRooms.values()) {
          if (Math.abs(nextX - room.doorX) < 0.8) {
            if (room.isDoorOpen) {
              if (nextZ < 3.85) {
                return { allowed: true, newZone: room.id }
              }
              return { allowed: true }
            }
            return { allowed: false }
          }
        }
        return { allowed: false }
      }
      return { allowed: true }
    } else {
      // Inside Custom Room
      const room = this.customRooms.get(this.currentZone)
      if (room) {
        const rx = room.doorX

        // 1. Outer Room Boundary Walls
        if (nextX < rx - 2.3 || nextX > rx + 2.3 || nextZ < 0.0) {
          return { allowed: false }
        }

        // 2. Furniture colliders (registered by furnishRoom)
        for (const c of room.colliders) {
          if (Math.abs(nextX - c.x) < c.hx && Math.abs(nextZ - c.z) < c.hz) {
            return { allowed: false }
          }
        }

        // 3. Doorway passage back to hallway
        if (nextZ > 3.75) {
          if (Math.abs(nextX - rx) < 0.8 && room.isDoorOpen) {
            if (nextZ > 4.0) {
              return { allowed: true, newZone: 'hallway' }
            }
            return { allowed: true }
          }
          return { allowed: false }
        }
      }
      return { allowed: true }
    }
  }

  private updateExploreMovement(delta: number, elapsedTime: number) {
    if (!this.isExploreMode) return

    // Ensure delta is valid and realistic (guaranteed > 0)
    const safeDelta = (delta > 0.0005 && delta < 0.15) ? delta : (1 / 60)

    if (this.isMeditating) {
      // Seated: no walking, just a slow breath rising and falling (12s, like the on-screen guide)
      const breath = Math.sin((elapsedTime / 12) * Math.PI * 2) * 0.006
      this.camera.position.set(this.playerPos.x, this.playerPos.y + breath, this.playerPos.z)
      this.camera.rotation.set(this.playerPitch, this.playerYaw, 0, 'YXZ')
      return
    }

    // 1. Calculate Horizontal Movement Vectors using zero-allocation scratch objects
    this._scratchForward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw))
    this._scratchRight.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw))

    this._scratchMoveVector.set(0, 0, 0)
    if (this.keys.forward) this._scratchMoveVector.add(this._scratchForward)
    if (this.keys.backward) this._scratchMoveVector.sub(this._scratchForward)
    if (this.keys.left) this._scratchMoveVector.sub(this._scratchRight)
    if (this.keys.right) this._scratchMoveVector.add(this._scratchRight)

    const isMoving = this._scratchMoveVector.lengthSq() > 0.0001
    if (isMoving) {
      this._scratchMoveVector.normalize()
      const speed = this.keys.shift ? this.runSpeed : this.walkSpeed
      const step = speed * safeDelta

      const testX = this.playerPos.x + this._scratchMoveVector.x * step
      const testZ = this.playerPos.z + this._scratchMoveVector.z * step

      // Smooth Wall Sliding: test X and Z independently
      const checkFull = this.checkAllowedPosition(testX, testZ)
      if (checkFull.allowed) {
        this.playerPos.x = testX
        this.playerPos.z = testZ
        if (checkFull.newZone && checkFull.newZone !== this.currentZone) {
          this.currentZone = checkFull.newZone
          this.updateSpatialLights(true)
          this.callbacks.onCurrentZoneChanged?.(checkFull.newZone, this.getZoneName(checkFull.newZone))
        }
      } else {
        // Slide on X
        const checkX = this.checkAllowedPosition(testX, this.playerPos.z)
        if (checkX.allowed) {
          this.playerPos.x = testX
          if (checkX.newZone && checkX.newZone !== this.currentZone) {
            this.currentZone = checkX.newZone
            this.updateSpatialLights(true)
            this.callbacks.onCurrentZoneChanged?.(checkX.newZone, this.getZoneName(checkX.newZone))
          }
        }
        // Slide on Z
        const checkZ = this.checkAllowedPosition(this.playerPos.x, testZ)
        if (checkZ.allowed) {
          this.playerPos.z = testZ
          if (checkZ.newZone && checkZ.newZone !== this.currentZone) {
            this.currentZone = checkZ.newZone
            this.updateSpatialLights(true)
            this.callbacks.onCurrentZoneChanged?.(checkZ.newZone, this.getZoneName(checkZ.newZone))
          }
        }
      }

      // Footstep Audio Trigger
      this.stepDistanceAccumulator += step
      const stepThreshold = this.keys.shift ? 1.35 : 0.95
      if (this.stepDistanceAccumulator >= stepThreshold) {
        this.stepDistanceAccumulator = 0
        this.callbacks.onPlayFootstep?.()
      }

      // Smooth Head Bobbing Effect
      this.headBobTimer += delta * (this.keys.shift ? 16 : 10)
    }

    const bobOffset = isMoving ? Math.sin(this.headBobTimer) * 0.03 : 0
    this.camera.position.x = this.playerPos.x
    this.camera.position.z = this.playerPos.z
    this.camera.position.y = this.playerPos.y + bobOffset
    this.camera.rotation.set(this.playerPitch, this.playerYaw, 0, 'YXZ')

    // 3. Check Door Proximity for Interactive Prompts
    this.checkDoorProximity()
  }

  private checkDoorProximity() {
    this.checkSwitchProximity()
    this.checkMonkProximity()
    if (this.isMeditating) return
    let nearPrompt: DoorPromptData = { show: false, text: '', roomId: '', isOpen: false }

    // Check Study Room Door (X: 0, Z: 3.87)
    const dxStudy = this.playerPos.x - 0
    const dzStudy = this.playerPos.z - 3.87
    const distToStudy = Math.sqrt(dxStudy * dxStudy + dzStudy * dzStudy)

    if (distToStudy < 1.35) {
      const isInside = this.playerPos.z < 3.87
      const dest = isInside ? 'Hallway' : 'Study Room'
      const action = this.isStudyDoorOpen ? 'Close Door' : `Open Door to ${dest}`
      nearPrompt = {
        show: true,
        text: `Press [E] or Click to ${action}`,
        roomId: 'study-room',
        isOpen: this.isStudyDoorOpen,
      }
    } else {
      // Check Custom Room Doors (doorX, Z: 3.87)
      for (const room of this.customRooms.values()) {
        const dx = this.playerPos.x - room.doorX
        const dz = this.playerPos.z - 3.87
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < 1.35) {
          const isInside = this.playerPos.z < 3.87
          const dest = isInside ? 'Hallway' : room.name
          const action = room.isDoorOpen ? 'Close Door' : `Open Door to ${dest}`
          nearPrompt = {
            show: true,
            text: `Press [E] or Click to ${action}`,
            roomId: room.id,
            isOpen: room.isDoorOpen,
          }
          break
        }
      }
    }

    if (nearPrompt.show !== this.currentNearPrompt.show || nearPrompt.text !== this.currentNearPrompt.text) {
      this.currentNearPrompt = nearPrompt
      this.callbacks.onNearDoorPrompt?.(nearPrompt)
    }
  }

  private isSceneIdle(): boolean {
    if (this.isExploreMode || this.isFlipping || this.isDrinking || this.state === 'book-flying') return false
    if (this.shadowUpdateFrames > 0) return false
    if (performance.now() - this.lastActivityTime < 4000) return false
    return !gsap.globalTimeline.getChildren(true, true, false).some((tween) => tween.isActive())
  }

  private startLoop() {
    const clock = new THREE.Clock()
    let frameCount = 0

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)

      // CRITICAL: Call getDelta() FIRST before getElapsedTime()!
      const rawDelta = clock.getDelta()
      const delta = (rawDelta > 0.0005 && rawDelta < 0.15) ? rawDelta : (1 / 60)
      const elapsedTime = clock.getElapsedTime()

      // Real-time Adaptive Performance & 60 FPS monitor
      this.monitorPerformance(rawDelta)

      // Low tier only: once nothing has happened for a few seconds (no input, no camera move, no
      // animation), render every other frame. The idle scene only has slow ambient motion, and this
      // halves GPU load / heat on weak laptops and phones.
      if (this.preset.throttleWhenIdle && this.isSceneIdle()) {
        this.idleFrameToggle = !this.idleFrameToggle
        if (this.idleFrameToggle) return
      }

      // First-Person WASD + Shift Run Explore Controller
      if (this.isExploreMode) {
        this.updateExploreMovement(delta, elapsedTime)
      }

      // Throttled Spatial Lighting Culling (Every 10 frames)
      frameCount++
      if (frameCount % 10 === 0) {
        this.updateSpatialLights()
      }

      // 1. Environmental atmospheric micro-animations (GPU-driven fireflies & tea steam)
      // Only animate if player is inside study room or near entrance to save CPU/GPU cycles!
      if (this.currentZone === 'study-room' || (this.isExploreMode && Math.abs(this.playerPos.x) < 3.2 && this.playerPos.z < 4.5)) {
        if (this.dustParticles) {
          this.dustParticles.rotation.y = elapsedTime * 0.012
          const mat = this.dustParticles.material as THREE.PointsMaterial
          if (mat?.userData?.shader) {
            mat.userData.shader.uniforms.uTime.value = elapsedTime
          }
        }

        if (this.teaSteamParticles) {
          this.teaSteamParticles.rotation.y = elapsedTime * 0.15
          this.teaSteamParticles.position.y = 0.005 + Math.sin(elapsedTime * 0.8) * 0.004
        }

        if (this.gardenBackdropMesh) {
          this.gardenBackdropMesh.position.y = 2.0 + Math.sin(elapsedTime * 0.22) * 0.008
        }
      }

      // 2. Room View Camera Breathing (Smooth, natural 1.8cm arc, zero robotic shake)
      if (this.state === 'room-view' && !this.isExploreMode) {
        this.camera.position.x = this.initialCamPos.x + Math.sin(elapsedTime * 0.25) * 0.018
        this.camera.position.y = this.initialCamPos.y + Math.cos(elapsedTime * 0.2) * 0.012
        this.camera.lookAt(this.initialCamTarget)

        if (this.heroBookGlow.active) {
          this.heroBookGlow.intensity = 0.8 + Math.sin(elapsedTime * 2.0) * 0.2
        }
      }

      // Selective / Event-Driven Shadow Map Updates:
      // Only updates when hero book is moving, page flipping, or during lighting transitions
      if (this.state === 'book-flying' || this.isFlipping || this.shadowUpdateFrames > 0) {
        this.renderer.shadowMap.needsUpdate = true
        if (this.shadowUpdateFrames > 0) {
          this.shadowUpdateFrames--
        }
      }

      this.syncLightPools()
      this.swayUniforms.uTime.value = elapsedTime
      for (const monk of this.monks) {
        if (!monk.group.parent?.visible) continue
        const breath = Math.sin(elapsedTime * 0.52)
        monk.torso.scale.set(1 + breath * 0.008, 1 + breath * 0.014, 1 + breath * 0.01)
        monk.head.rotation.x = 0.12 + breath * 0.012
      }
      this.scene.environmentIntensity = (this.envLevels.get(this.currentZone) ?? this.envLevels.get('hallway')!).value
      if (this.heroBookGroup.visible) this.syncBookSurfaces()
      this.renderer.render(this.scene, this.camera)
    }

    animate()
  }

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Kill all active GSAP timelines and tweens on chamber objects
    gsap.killTweensOf(this.camera.position)
    gsap.killTweensOf(this.heroBookGroup.position)
    gsap.killTweensOf(this.heroBookGroup.rotation)
    gsap.killTweensOf(this.bookCoverPivot.position)
    gsap.killTweensOf(this.bookCoverPivot.rotation)
    gsap.killTweensOf(this.pagePivot.position)
    gsap.killTweensOf(this.pagePivot.rotation)
    if (this.leftPageBlockMesh) {
      gsap.killTweensOf(this.leftPageBlockMesh.scale)
      gsap.killTweensOf(this.leftPageBlockMesh.position)
    }
    if (this.rightPageBlockMesh) {
      gsap.killTweensOf(this.rightPageBlockMesh.scale)
      gsap.killTweensOf(this.rightPageBlockMesh.position)
    }
    if (this.contactShadowRight) {
      gsap.killTweensOf(this.contactShadowRight.scale)
      gsap.killTweensOf(this.contactShadowRight.material)
    }
    if (this.contactShadowLeft) {
      gsap.killTweensOf(this.contactShadowLeft.material)
    }
    gsap.killTweensOf(this.heroBookGlow)
    gsap.killTweensOf(this.lightLevels)
    for (const level of this.envLevels.values()) gsap.killTweensOf(level)
    if (this.handTurn) {
      gsap.killTweensOf(this.handTurn.approach)
      gsap.killTweensOf(this.handTurn.retreat)
    }
    gsap.killTweensOf(this.ambientLight)
    gsap.killTweensOf(this.ambientLight.color)
    for (const light of this.hallwayLights) gsap.killTweensOf(light)
    for (const room of this.customRooms.values()) {
      for (const light of room.lights) gsap.killTweensOf(light)
    }

    // Detach event listeners
    this.unbindEvents()

    // Traverse scene graph and dispose all geometries, materials, and textures
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        if (obj.geometry) {
          obj.geometry.dispose()
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => {
              if (mat.map) mat.map.dispose()
              mat.dispose()
            })
          } else {
            if (obj.material.map) obj.material.map.dispose()
            obj.material.dispose()
          }
        }
      }
    })

    // Clear maps and data arrays
    this.shelfBooksMap.clear()
    this.shelfInteractiveMeshes = []
    this.dustParticles = null
    this.dustPositions = null
    this.teaSteamParticles = null
    this.gardenBackdropMesh = null

    // Dispose WebGL renderer and release GPU contexts
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
