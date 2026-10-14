import * as THREE from 'three'
import { gsap } from 'gsap'
import { getProject, type IProject, type ISheet } from '@theatre/core'
import {
  createWoodTexture,
  createTatamiTexture,
  createModernWallTexture,
  createGlassShojiDoorTexture,
  createGardenBackdropTexture,
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
} from './JapaneseTextures'
import { SHELF_BOOKS_CONFIG, BookCatalogService } from './BookCatalogService'
import type { ImmersiveBookData } from '~/types/learning-journey'

export interface InteractiveHoverData {
  target: 'lamp' | 'cup' | 'book' | null
  bookData?: ImmersiveBookData
  screenPos?: { x: number; y: number }
  isLightOn: boolean
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
}

// Stable Theatre.js Project Singleton across HMR cycles
const THEATRE_CONFIG = Object.freeze({
  state: {
    sheetsById: {},
    definitionVersion: '0.4.0',
    revisionHistory: [],
  },
})

let cachedTheatreProject: IProject | null = null

function getChamberTheatreProject(): IProject | null {
  if (cachedTheatreProject) return cachedTheatreProject
  try {
    cachedTheatreProject = getProject('IREJapaneseChamber', THEATRE_CONFIG)
  } catch {
    try {
      cachedTheatreProject = getProject('IREJapaneseChamber')
    } catch (e) {
      console.warn('Theatre.js project initialization notice:', e)
    }
  }
  return cachedTheatreProject
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
  private ambientLight!: THREE.AmbientLight
  private sunLight!: THREE.DirectionalLight
  private lampLight!: THREE.SpotLight
  private moonLight!: THREE.DirectionalLight
  private lampShadeMesh!: THREE.Mesh
  private heroBookGlowLight!: THREE.PointLight
  private textureLoader = new THREE.TextureLoader()

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

  // Interactive Table Props
  private lampTargetMesh!: THREE.Mesh
  private cupGroup = new THREE.Group()
  private cupTargetMesh!: THREE.Mesh
  private isDrinking = false

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
  public state: 'room-view' | 'book-flying' | 'on-table' | 'book-open' = 'room-view'
  public currentPage = 1
  private currentHoveredTarget: 'lamp' | 'cup' | 'book' | null = null

  // Theatre.js integration
  private theatreProject: IProject | null = getChamberTheatreProject()
  private theatreSheet: ISheet | null = this.theatreProject ? this.theatreProject.sheet('ChamberCinematics') : null

  constructor(canvas: HTMLCanvasElement, callbacks: RoomServiceCallbacks = {}) {
    this.canvas = canvas
    this.callbacks = callbacks

    // 1. Scene & Camera
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#0a0614')
    this.scene.fog = new THREE.FogExp2('#0a0614', 0.05)

    const aspect = canvas.clientWidth / canvas.clientHeight
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 50)
    this.camera.position.copy(this.initialCamPos)
    this.camera.lookAt(this.initialCamTarget)

    // 2. High-Fidelity WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.15

    // 3. Build Room Architecture & Props
    this.setupLighting()
    this.buildRoomArchitecture()
    this.buildJapaneseDesk()
    this.buildFrontBookshelf()
    this.buildHeroBook()
    this.setupAtmosphere()

    // 4. Events & Render Loop
    this.bindEvents()
    this.startLoop()
  }

  private setupLighting() {
    // Warm atmospheric ambient fill
    this.ambientLight = new THREE.AmbientLight(0xffeed8, 0.75)
    this.scene.add(this.ambientLight)

    // Shoji Screen Sunlight (soft directional streaming from left garden terrace)
    this.sunLight = new THREE.DirectionalLight(0xfffae5, 1.4)
    this.sunLight.position.set(-4.5, 4.2, 0.5)
    this.sunLight.castShadow = true
    this.sunLight.shadow.mapSize.width = 1024
    this.sunLight.shadow.mapSize.height = 1024
    this.sunLight.shadow.camera.near = 0.5
    this.sunLight.shadow.camera.far = 18
    this.sunLight.shadow.camera.left = -5
    this.sunLight.shadow.camera.right = 5
    this.sunLight.shadow.camera.top = 5
    this.sunLight.shadow.camera.bottom = -5
    this.sunLight.shadow.bias = -0.0005
    this.scene.add(this.sunLight)

    // Warm Gooseneck Desk Lamp (Optimized SpotLight with single 2D shadow map instead of 6-sided cubemap)
    this.lampLight = new THREE.SpotLight(0xffa534, 3.2, 5.0, Math.PI / 3.0, 0.45, 1.2)
    this.lampLight.position.set(-0.65, 1.22, -0.45)
    this.lampLight.target.position.set(0, 0.85, -0.44)
    this.scene.add(this.lampLight.target)
    this.lampLight.castShadow = true
    this.lampLight.shadow.bias = -0.0015
    this.lampLight.shadow.mapSize.width = 1024
    this.lampLight.shadow.mapSize.height = 1024
    this.lampLight.shadow.camera.near = 0.2
    this.lampLight.shadow.camera.far = 4.0
    this.scene.add(this.lampLight)

    // Cool Moonlight (streaming from left garden for nighttime ambience)
    this.moonLight = new THREE.DirectionalLight(0x60a5fa, 0.25)
    this.moonLight.position.set(-5, 3.5, -1)
    this.scene.add(this.moonLight)

    // Magical blue glow over Class 3 Mathematics section on the front bookshelf
    this.heroBookGlowLight = new THREE.PointLight(0x38bdf8, 1.1, 2.0, 1.0)
    this.heroBookGlowLight.position.set(0.45, 2.2, -2.35)
    this.scene.add(this.heroBookGlowLight)
  }

  private buildRoomArchitecture() {
    // 1. Oak Wood Planks & Tatami Floor
    const tatamiTexture = createTatamiTexture()
    const floorGeo = new THREE.PlaneGeometry(8, 8)
    const floorMat = new THREE.MeshStandardMaterial({
      map: tatamiTexture,
      roughness: 0.85,
      metalness: 0.05,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    this.scene.add(floor)

    // 2. Back Wall (Modern Japandi Plaster backdrop behind the Front Bookshelf)
    const wallTexture = createModernWallTexture()
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.8 })

    const backWallGeo = new THREE.PlaneGeometry(8, 4)
    const backWall = new THREE.Mesh(backWallGeo, wallMat)
    backWall.position.set(0, 1.9, -3.1)
    backWall.receiveShadow = true
    this.scene.add(backWall)

    const darkWood = createWoodTexture('#2b170c', '#150a04')
    const frameMat = new THREE.MeshStandardMaterial({ map: darkWood, roughness: 0.65 })

    // Horizontal architectural top beam
    const topBeamGeo = new THREE.BoxGeometry(8, 0.45, 0.1)
    const topBeam = new THREE.Mesh(topBeamGeo, frameMat)
    topBeam.position.set(0, 3.55, -3.05)
    this.scene.add(topBeam)

    // 3. Left Wall: Japanese Sliding Glass Doors & Scenic Window to Zen Garden
    const glassDoorTex = createGlassShojiDoorTexture()
    const glassDoorGeo = new THREE.PlaneGeometry(8, 4)
    const glassDoorMat = new THREE.MeshStandardMaterial({
      map: glassDoorTex,
      transparent: true,
      opacity: 0.9,
      roughness: 0.15,
      metalness: 0.1,
    })
    const glassDoor = new THREE.Mesh(glassDoorGeo, glassDoorMat)
    glassDoor.position.set(-3.9, 1.9, 0)
    glassDoor.rotation.y = Math.PI / 2
    this.scene.add(glassDoor)

    // Scenic Garden Backdrop behind the left glass doors (rolling hills, sakura trees, pagoda)
    const gardenTex = createGardenBackdropTexture()
    const gardenGeo = new THREE.PlaneGeometry(10, 4.8)
    const gardenMat = new THREE.MeshBasicMaterial({ map: gardenTex })
    this.gardenBackdropMesh = new THREE.Mesh(gardenGeo, gardenMat)
    this.gardenBackdropMesh.position.set(-4.6, 2.0, 0)
    this.gardenBackdropMesh.rotation.y = Math.PI / 2
    this.scene.add(this.gardenBackdropMesh)

    // 4. Right Wall: Japandi Wall with Hanging Japanese Calligraphy Scroll
    const rightWallGeo = new THREE.PlaneGeometry(8, 4)
    const rightWall = new THREE.Mesh(rightWallGeo, wallMat)
    rightWall.position.set(4, 1.9, 0)
    rightWall.rotation.y = -Math.PI / 2
    rightWall.receiveShadow = true
    this.scene.add(rightWall)

    // Hanging Japanese Calligraphy Scroll on Right Wall
    const scrollWoodMat = new THREE.MeshStandardMaterial({ color: '#27160c' })
    const topRod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 16), scrollWoodMat)
    topRod.rotation.z = Math.PI / 2
    topRod.position.set(3.96, 2.7, 0.4)
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
    const scrollMesh = new THREE.Mesh(scrollGeo, new THREE.MeshStandardMaterial({ map: scrollTex, roughness: 0.9 }))
    scrollMesh.position.set(3.97, 2.05, 0.4)
    scrollMesh.rotation.y = -Math.PI / 2
    this.scene.add(scrollMesh)

    // 5. Ceiling Wooden Beams
    const beamMat = new THREE.MeshStandardMaterial({ map: darkWood, roughness: 0.7 })
    const beamGeo = new THREE.BoxGeometry(0.2, 0.18, 8)
    for (let x = -3; x <= 3; x += 1.5) {
      const beam = new THREE.Mesh(beamGeo, beamMat)
      beam.position.set(x, 3.8, 0)
      beam.castShadow = true
      this.scene.add(beam)
    }
  }

  private buildJapaneseDesk() {
    const darkWood = createWoodTexture('#3a2113', '#1f1008')
    const woodMat = new THREE.MeshStandardMaterial({
      map: darkWood,
      roughness: 0.45,
      metalness: 0.08,
    })

    // Standing Study Desk (Storyboard Frame 1, 4, 8, 9) placed directly in front of the center window
    // Top surface at y = 0.795, centered at x = 0, z = -0.5
    const tableTopGeo = new THREE.BoxGeometry(2.3, 0.07, 1.1)
    const tableTop = new THREE.Mesh(tableTopGeo, woodMat)
    tableTop.position.set(0, 0.76, -0.5)
    tableTop.castShadow = true
    tableTop.receiveShadow = true
    this.scene.add(tableTop)

    // 4 Wooden Desk Legs reaching the floor (y = 0 to 0.76)
    const legGeo = new THREE.BoxGeometry(0.075, 0.76, 0.075)
    const legPositions: [number, number, number][] = [
      [-1.04, 0.38, -0.95],
      [1.04, 0.38, -0.95],
      [-1.04, 0.38, -0.05],
      [1.04, 0.38, -0.05],
    ]
    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, woodMat)
      leg.position.set(x, y, z)
      leg.castShadow = true
      leg.receiveShadow = true
      this.scene.add(leg)
    })

    // Under-desk Drawer Apron
    const apronGeo = new THREE.BoxGeometry(2.14, 0.12, 0.96)
    const apron = new THREE.Mesh(apronGeo, woodMat)
    apron.position.set(0, 0.67, -0.5)
    apron.castShadow = true
    this.scene.add(apron)

    // Drawer Brass Knobs
    const knobGeo = new THREE.CylinderGeometry(0.015, 0.012, 0.02, 16)
    const knobMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.8, roughness: 0.25 })
    const leftKnob = new THREE.Mesh(knobGeo, knobMat)
    leftKnob.rotation.x = Math.PI / 2
    leftKnob.position.set(-0.5, 0.67, -0.01)
    this.scene.add(leftKnob)

    const rightKnob = new THREE.Mesh(knobGeo, knobMat)
    rightKnob.rotation.x = Math.PI / 2
    rightKnob.position.set(0.5, 0.67, -0.01)
    this.scene.add(rightKnob)

    // Study Chair (Dark Wood Chair tucked at desk - Frame 1, 8, 9)
    const chairGroup = new THREE.Group()
    chairGroup.position.set(0, 0, 0.28)

    const chairWoodMat = new THREE.MeshStandardMaterial({ color: '#24140b', roughness: 0.5 })
    // Chair 4 Legs
    const chairLegGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.44, 16)
    const cLegPos: [number, number, number][] = [
      [-0.24, 0.22, -0.22],
      [0.24, 0.22, -0.22],
      [0.24, 0.22, 0.22],
      [-0.24, 0.22, 0.22],
    ]
    cLegPos.forEach(([cx, cy, cz]) => {
      const cLeg = new THREE.Mesh(chairLegGeo, chairWoodMat)
      cLeg.position.set(cx, cy, cz)
      cLeg.castShadow = true
      chairGroup.add(cLeg)
    })

    // Chair Seat
    const seatGeo = new THREE.BoxGeometry(0.56, 0.045, 0.52)
    const seat = new THREE.Mesh(seatGeo, chairWoodMat)
    seat.position.set(0, 0.44, 0)
    seat.castShadow = true
    chairGroup.add(seat)

    // Chair Backrest Spindles (vertical rods reaching up to 0.82)
    const spindleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.36, 12)
    for (let sx = -0.18; sx <= 0.18; sx += 0.09) {
      const spindle = new THREE.Mesh(spindleGeo, chairWoodMat)
      spindle.position.set(sx, 0.64, 0.23)
      spindle.castShadow = true
      chairGroup.add(spindle)
    }

    // Chair Top Curved Crest Rail
    const crestGeo = new THREE.BoxGeometry(0.58, 0.05, 0.04)
    const crest = new THREE.Mesh(crestGeo, chairWoodMat)
    crest.position.set(0, 0.82, 0.23)
    crest.castShadow = true
    chairGroup.add(crest)

    this.scene.add(chairGroup)

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
      pencil.castShadow = true
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
      leaf.castShadow = true
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

    const standDarkWood = createWoodTexture('#2e1a10', '#180d07')
    const standWoodMat = new THREE.MeshStandardMaterial({
      map: standDarkWood,
      roughness: 0.45,
      metalness: 0.08,
    })
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#d4af37',
      metalness: 0.85,
      roughness: 0.25,
    })

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
    const slatWoodMat = new THREE.MeshStandardMaterial({
      color: '#452718',
      roughness: 0.5,
    })
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
    const woodTexture = createWoodTexture('#382315', '#1d0f07')
    const shelfMat = new THREE.MeshStandardMaterial({
      map: woodTexture,
      roughness: 0.6,
    })

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
    const backPanel = new THREE.Mesh(backPanelGeo, shelfMat)
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

    interface ShelfStackItem {
      id: string
      title: string
      subject: string
      classLevel: number
      coverColor: string
      coverImage?: string
      isInteractive: boolean
      thickness: number
      height: number
    }

    // Helper to get bookData from SHELF_BOOKS_CONFIG
    const getBookConfig = (id: string) => SHELF_BOOKS_CONFIG.find((b) => b.id === id)

    // Shelf Stacks by 4 Tiers and Bays: Books sit flush side-by-side touching each other!
    // Every single book is interactive, hoverable, and clickable to fly to the desk!
    const shelfTierStacks: Array<{
      tier: number
      bay: 'left' | 'right'
      books: ShelfStackItem[]
    }> = [
      // =============================================================
      // TIER 4 (Row 4, y = 2.38m): Class 5 Computer Systems & Architecture
      // =============================================================
      {
        tier: 4,
        bay: 'right',
        books: [
          {
            id: 'system-arch',
            title: 'Systems Architecting',
            subject: 'System Architecture',
            classLevel: 5,
            coverColor: '#1e3a8a',
            coverImage: '/books/system-arch/cover.png',
            isInteractive: true,
            thickness: 0.068,
            height: 0.47,
          },
          {
            id: 'comp-arch',
            title: 'Computer System Architecture',
            subject: 'Computer Systems',
            classLevel: 5,
            coverColor: '#065f46',
            coverImage: '/books/comp-arch/cover.png',
            isInteractive: true,
            thickness: 0.072,
            height: 0.48,
          },
          {
            id: 'mpmc',
            title: 'Microprocessors & Microcontrollers',
            subject: 'Microprocessors',
            classLevel: 5,
            coverColor: '#9a3412',
            coverImage: '/books/mpmc/cover.png',
            isInteractive: true,
            thickness: 0.074,
            height: 0.48,
          },
          {
            id: 'dsa-aho',
            title: 'Data Structures and Algorithms',
            subject: 'Algorithms',
            classLevel: 5,
            coverColor: '#4338ca',
            coverImage: '/books/dsa-aho/cover.png',
            isInteractive: true,
            thickness: 0.066,
            height: 0.47,
          },
          {
            id: 'compilers',
            title: 'Compilers: Principles & Tools',
            subject: 'Compilers',
            classLevel: 5,
            coverColor: '#831843',
            isInteractive: true,
            thickness: 0.070,
            height: 0.47,
          },
          {
            id: 'os-concepts',
            title: 'Operating System Concepts',
            subject: 'Computer Systems',
            classLevel: 5,
            coverColor: '#1e293b',
            isInteractive: true,
            thickness: 0.072,
            height: 0.48,
          },
        ],
      },
      {
        tier: 4,
        bay: 'left',
        books: [
          {
            id: 'comp-org',
            title: 'Computer Organization & Design',
            subject: 'Hardware',
            classLevel: 5,
            coverColor: '#0369a1',
            isInteractive: true,
            thickness: 0.070,
            height: 0.47,
          },
          {
            id: 'clrs-algo',
            title: 'Introduction to Algorithms (CLRS)',
            subject: 'Algorithms',
            classLevel: 5,
            coverColor: '#14532d',
            isInteractive: true,
            thickness: 0.076,
            height: 0.48,
          },
          {
            id: 'sicp',
            title: 'Structure & Interpretation (SICP)',
            subject: 'Computer Science',
            classLevel: 5,
            coverColor: '#4a044e',
            isInteractive: true,
            thickness: 0.064,
            height: 0.46,
          },
          {
            id: 'db-concepts',
            title: 'Database System Concepts',
            subject: 'Databases',
            classLevel: 5,
            coverColor: '#064e3b',
            isInteractive: true,
            thickness: 0.070,
            height: 0.47,
          },
          {
            id: 'dist-algos',
            title: 'Distributed Algorithms',
            subject: 'Distributed Systems',
            classLevel: 5,
            coverColor: '#0f766e',
            isInteractive: true,
            thickness: 0.066,
            height: 0.46,
          },
          {
            id: 'networks',
            title: 'Computer Networks',
            subject: 'Networking',
            classLevel: 5,
            coverColor: '#1c1917',
            isInteractive: true,
            thickness: 0.068,
            height: 0.47,
          },
        ],
      },

      // =============================================================
      // TIER 3 (Row 3, y = 1.72m): Class 3 & 4 + Distributed Systems (DDIA Eye Level)
      // =============================================================
      {
        tier: 3,
        bay: 'left',
        books: [
          {
            id: 'ddia',
            title: 'Designing Data-Intensive Applications',
            subject: 'Distributed Systems',
            classLevel: 3,
            coverColor: '#b91c1c',
            coverImage: '/books/ddia/cover.png',
            isInteractive: true,
            thickness: 0.078,
            height: 0.48,
          },
          {
            id: 'db-internals',
            title: 'Database Internals',
            subject: 'Databases',
            classLevel: 3,
            coverColor: '#1e1b4b',
            isInteractive: true,
            thickness: 0.068,
            height: 0.47,
          },
          {
            id: 'sre-google',
            title: 'Site Reliability Engineering',
            subject: 'DevOps & Reliability',
            classLevel: 3,
            coverColor: '#1e3a8a',
            isInteractive: true,
            thickness: 0.068,
            height: 0.47,
          },
          {
            id: 'streaming-sys',
            title: 'Streaming Systems',
            subject: 'Real-Time Data',
            classLevel: 3,
            coverColor: '#0f766e',
            isInteractive: true,
            thickness: 0.066,
            height: 0.46,
          },
          {
            id: 'hpbn',
            title: 'High Performance Browser Networking',
            subject: 'Networking',
            classLevel: 3,
            coverColor: '#0369a1',
            isInteractive: true,
            thickness: 0.064,
            height: 0.46,
          },
          {
            id: 'kafka-guide',
            title: 'Kafka: The Definitive Guide',
            subject: 'Distributed Logs',
            classLevel: 3,
            coverColor: '#312e81',
            isInteractive: true,
            thickness: 0.066,
            height: 0.46,
          },
        ],
      },
      {
        tier: 3,
        bay: 'right',
        books: [
          {
            id: 'ncert-c3-math',
            title: 'Math Magic 3',
            subject: 'Mathematics',
            classLevel: 3,
            coverColor: '#0284c7',
            coverImage: '/books/ncert-c3-math/cover.png',
            isInteractive: true,
            thickness: 0.064,
            height: 0.46,
          },
          {
            id: 'ncert-c3-evs',
            title: 'Looking Around 3',
            subject: 'Environmental Studies',
            classLevel: 3,
            coverColor: '#059669',
            coverImage: '/books/ncert-c3-evs/cover.png',
            isInteractive: true,
            thickness: 0.064,
            height: 0.46,
          },
          {
            id: 'ncert-c4-math',
            title: 'Math Magic 4',
            subject: 'Mathematics',
            classLevel: 4,
            coverColor: '#0284c7',
            coverImage: '/books/ncert-c4-math/cover.png',
            isInteractive: true,
            thickness: 0.066,
            height: 0.47,
          },
          {
            id: 'ncert-c4-evs',
            title: 'Looking Around 4',
            subject: 'Environmental Studies',
            classLevel: 4,
            coverColor: '#059669',
            coverImage: '/books/ncert-c4-evs/cover.png',
            isInteractive: true,
            thickness: 0.066,
            height: 0.47,
          },
          {
            id: 'clean-arch',
            title: 'Clean Architecture',
            subject: 'Software Craft',
            classLevel: 3,
            coverColor: '#1e293b',
            isInteractive: true,
            thickness: 0.064,
            height: 0.46,
          },
          {
            id: 'science-exp',
            title: 'Hands-on Science Explorations',
            subject: 'Science',
            classLevel: 4,
            coverColor: '#b45309',
            isInteractive: true,
            thickness: 0.062,
            height: 0.45,
          },
        ],
      },

      // =============================================================
      // TIER 2 (Row 2, y = 1.05m): Class 2 Numbers & Nature Discovery
      // =============================================================
      {
        tier: 2,
        bay: 'left',
        books: [
          {
            id: 'ncert-c2-math',
            title: 'Joyful Mathematics 2',
            subject: 'Mathematics',
            classLevel: 2,
            coverColor: '#0284c7',
            coverImage: '/books/ncert-c2-math/cover.png',
            isInteractive: true,
            thickness: 0.062,
            height: 0.45,
          },
          {
            id: 'ncert-c2-english',
            title: 'Mridang 2',
            subject: 'English & Language',
            classLevel: 2,
            coverColor: '#7c3aed',
            coverImage: '/books/ncert-c2-english/cover.png',
            isInteractive: true,
            thickness: 0.062,
            height: 0.45,
          },
          {
            id: 'plants-trees',
            title: 'Plants & Forest Trees',
            subject: 'Botany',
            classLevel: 2,
            coverColor: '#15803d',
            isInteractive: true,
            thickness: 0.058,
            height: 0.44,
          },
          {
            id: 'animal-kingdom',
            title: 'Animals & Wildlife Safari',
            subject: 'Zoology',
            classLevel: 2,
            coverColor: '#c2410c',
            isInteractive: true,
            thickness: 0.058,
            height: 0.44,
          },
          {
            id: 'weather-seasons',
            title: 'Weather, Rain & Seasons',
            subject: 'Earth Science',
            classLevel: 2,
            coverColor: '#0284c7',
            isInteractive: true,
            thickness: 0.056,
            height: 0.44,
          },
        ],
      },
      {
        tier: 2,
        bay: 'right',
        books: [
          {
            id: 'mental-math-2',
            title: 'Mental Math & Puzzles',
            subject: 'Mathematics',
            classLevel: 2,
            coverColor: '#d97706',
            isInteractive: true,
            thickness: 0.058,
            height: 0.44,
          },
          {
            id: 'storyland-2',
            title: 'Tales from Storyland',
            subject: 'Literature',
            classLevel: 2,
            coverColor: '#be185d',
            isInteractive: true,
            thickness: 0.058,
            height: 0.44,
          },
          {
            id: 'shapes-art-2',
            title: 'Shapes, Geometry & Art',
            subject: 'Art & Geometry',
            classLevel: 2,
            coverColor: '#4f46e5',
            isInteractive: true,
            thickness: 0.056,
            height: 0.44,
          },
          {
            id: 'water-rivers',
            title: 'Water Cycle & Oceans',
            subject: 'Geography',
            classLevel: 2,
            coverColor: '#0d9488',
            isInteractive: true,
            thickness: 0.056,
            height: 0.44,
          },
          {
            id: 'curious-kids',
            title: 'Curious Questions for Kids',
            subject: 'General Knowledge',
            classLevel: 2,
            coverColor: '#4338ca',
            isInteractive: true,
            thickness: 0.058,
            height: 0.44,
          },
        ],
      },

      // =============================================================
      // TIER 1 (Row 1, y = 0.38m): Class 1 Foundations & Early Reading
      // =============================================================
      {
        tier: 1,
        bay: 'left',
        books: [
          {
            id: 'ncert-c1-math',
            title: 'Joyful Mathematics 1',
            subject: 'Mathematics',
            classLevel: 1,
            coverColor: '#0284c7',
            coverImage: '/books/ncert-c1-math/cover.png',
            isInteractive: true,
            thickness: 0.060,
            height: 0.44,
          },
          {
            id: 'ncert-c1-english',
            title: 'Mridang 1',
            subject: 'English & Language',
            classLevel: 1,
            coverColor: '#7c3aed',
            coverImage: '/books/ncert-c1-english/cover.png',
            isInteractive: true,
            thickness: 0.060,
            height: 0.44,
          },
          {
            id: 'alphabet-book',
            title: 'Alphabet & First Phonics',
            subject: 'Language',
            classLevel: 1,
            coverColor: '#0891b2',
            isInteractive: true,
            thickness: 0.056,
            height: 0.43,
          },
          {
            id: 'numbers-1-50',
            title: 'Numbers & Counting 1-50',
            subject: 'Mathematics',
            classLevel: 1,
            coverColor: '#e11d48',
            isInteractive: true,
            thickness: 0.056,
            height: 0.43,
          },
          {
            id: 'colors-drawing',
            title: 'Rainbow Colors & Drawing',
            subject: 'Creative Art',
            classLevel: 1,
            coverColor: '#ea580c',
            isInteractive: true,
            thickness: 0.054,
            height: 0.43,
          },
        ],
      },
      {
        tier: 1,
        bay: 'right',
        books: [
          {
            id: 'nursery-melodies',
            title: 'Nursery Rhymes & Poems',
            subject: 'Poetry & Music',
            classLevel: 1,
            coverColor: '#8b5cf6',
            isInteractive: true,
            thickness: 0.056,
            height: 0.43,
          },
          {
            id: 'first-words',
            title: 'My First 100 Words',
            subject: 'Vocabulary',
            classLevel: 1,
            coverColor: '#16a34a',
            isInteractive: true,
            thickness: 0.054,
            height: 0.43,
          },
          {
            id: 'counting-friends',
            title: 'Counting with Animal Friends',
            subject: 'Numbers',
            classLevel: 1,
            coverColor: '#ca8a04',
            isInteractive: true,
            thickness: 0.054,
            height: 0.43,
          },
          {
            id: 'green-garden',
            title: 'Our Green Little Garden',
            subject: 'Nature Studies',
            classLevel: 1,
            coverColor: '#059669',
            isInteractive: true,
            thickness: 0.054,
            height: 0.43,
          },
          {
            id: 'lullabies-music',
            title: 'Gentle Music & Songs',
            subject: 'Music',
            classLevel: 1,
            coverColor: '#7c2d12',
            isInteractive: true,
            thickness: 0.054,
            height: 0.43,
          },
        ],
      },
    ]

    // Realistic Wooden / Brass Bookend Material
    const bookendMat = new THREE.MeshStandardMaterial({
      color: '#451a03',
      roughness: 0.4,
      metalness: 0.35,
    })

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

        let shelfCoverMat: THREE.Material
        if (bookItem.coverImage) {
          const cTex = this.textureLoader.load(bookItem.coverImage)
          cTex.colorSpace = THREE.SRGBColorSpace
          shelfCoverMat = new THREE.MeshStandardMaterial({ map: cTex, roughness: 0.5 })
        } else {
          shelfCoverMat = new THREE.MeshStandardMaterial({
            color: bookItem.coverColor,
            roughness: 0.6,
          })
        }

        const bookMatArray = [
          shelfCoverMat, // +X
          shelfCoverMat, // -X
          new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.8 }), // +Y
          new THREE.MeshStandardMaterial({ color: '#f5f5f4', roughness: 0.8 }), // -Y
          new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.45 }), // +Z (Spine facing camera!)
          new THREE.MeshStandardMaterial({ color: bookItem.coverColor, roughness: 0.6 }), // -Z
        ]

        const bGeo = new THREE.BoxGeometry(bookItem.thickness, bookItem.height, bDepth)
        const bMesh = new THREE.Mesh(bGeo, bookMatArray)
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
          leaf.castShadow = true
          plantGroup.add(leaf)
        }
      }

      const curve = new THREE.CatmullRomCurve3(curvePoints)
      const stemGeo = new THREE.TubeGeometry(curve, cfg.segments * 2, 0.006, 6, false)
      const stem = new THREE.Mesh(stemGeo, vineMat)
      stem.castShadow = true
      plantGroup.add(stem)
    })

    shelfGroup.add(plantGroup)
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

    for (let i = 0; i < count; i++) {
      const idx = i * 3
      const x0 = baseF[idx] ?? 0
      const z0 = baseF[idx + 2] ?? 0

      // Normalized coordinates:
      // u in [0, 1]: 0 = spine binding, 1 = free fore-edge
      // v in [-0.5, 0.5]: -0.5 = top edge, +0.5 = bottom edge
      const u = Math.max(0, Math.min(1, x0 / pageWidth))
      const v = z0 / pageLength

      let dy = 0
      if (isForward) {
        // Forward turn (Right to Left):
        // 1. Dynamic Angular Peel & Roll: free outer edge leads lift-off ($p < 0.5$), then lags as it lands on cushion of air
        const peelAngle = p < 0.5
          ? 0.55 * bend * (1.0 - 0.3 * p) * Math.pow(u, 1.35)
          : -0.38 * bend * (p - 0.2) * Math.pow(u, 1.35)

        // 2. Conical Diagonal Corner Twist: top-outer corner is gripped and leads the peel
        const cornerTwist = 0.22 * bend * Math.pow(u, 2.0) * (0.5 - v)

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

        const cornerTwist = 0.22 * bend * Math.pow(u, 2.0) * (0.5 - v)
        const billowDome = 0.026 * Math.pow(bend, 1.15) * Math.pow(Math.sin(Math.PI * u * 0.95), 0.85) * (1.0 - 0.25 * v * v)
        const waveFlutter = 0.009 * Math.sin(2.0 * Math.PI * p) * Math.sin(1.5 * Math.PI * u) * u

        const totalAngle = peelAngle + cornerTwist
        dy = -(u * pageWidth * Math.sin(totalAngle * 0.5) + billowDome + waveFlutter)
      }

      // Exact inextensibility conservation: preserves paper width along the curve
      const dx = -(dy * dy) / (2.0 * pageWidth)

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
      coverTex = this.textureLoader.load(this.currentBookData.coverImage)
      coverTex.colorSpace = THREE.SRGBColorSpace
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

    // 2a. Base Paper Stacks (Physical bulk block edges without center jointer intrusion)
    const gutterInset = 0.024
    const adjustedBlockW = blockWidth - gutterInset

    const rightBlockGeo = new THREE.BoxGeometry(adjustedBlockW, pageBlockThickness, blockLength)
    const rightBlockMaterials = [
      pageEdgesMat, // +X (fore-edge: paper stack striations)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -X (spine gutter)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +Y (underlying paper block)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -Y
      pageEdgesMat, // +Z (bottom edges)
      pageEdgesMat, // -Z (top edges)
    ]
    this.rightPageBlockMesh = new THREE.Mesh(rightBlockGeo, rightBlockMaterials)
    this.rightPageBlockMesh.position.set(gutterInset + adjustedBlockW / 2, coverThickness + pageBlockThickness / 2, 0)
    this.rightPageBlockMesh.castShadow = true
    this.rightPageBlockMesh.receiveShadow = true
    this.pageBlockMesh = this.rightPageBlockMesh
    this.heroBookGroup.add(this.rightPageBlockMesh)

    // 2b. Left Page Block (Visibly grows in height on left cover as reader flips forward)
    const leftBlockGeo = new THREE.BoxGeometry(adjustedBlockW, pageBlockThickness, blockLength)
    const leftBlockMaterials = [
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +X (spine gutter)
      pageEdgesMat, // -X (fore-edge on left: paper stack striations)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // +Y (underlying paper block)
      new THREE.MeshStandardMaterial({ color: '#fdfbf7', roughness: 0.85 }), // -Y
      pageEdgesMat, // +Z (bottom edges)
      pageEdgesMat, // -Z (top edges)
    ]
    this.leftPageBlockMesh = new THREE.Mesh(leftBlockGeo, leftBlockMaterials)
    this.leftPageBlockMesh.position.set(-(gutterInset + adjustedBlockW / 2), coverThickness + this.minStackH / 2, 0)
    this.leftPageBlockMesh.castShadow = true
    this.leftPageBlockMesh.receiveShadow = true
    this.leftPageBlockMesh.visible = false
    this.leftPageBlockMesh.scale.set(1, this.minStackH / pageBlockThickness, 1)
    this.heroBookGroup.add(this.leftPageBlockMesh)

    // 2c. Flat Open Pages (Completely flat and flush on the page stacks, eliminating all text cut-offs)
    // Right Page: spans from x = 0 to +blockWidth flush on top of the right page block
    const geoRight = new THREE.PlaneGeometry(blockWidth, blockLength, 4, 4)
    geoRight.translate(blockWidth / 2, 0, 0)
    geoRight.rotateX(-Math.PI / 2)
    geoRight.computeVertexNormals()

    const rightCurvedMat = new THREE.MeshStandardMaterial({
      map: page1Tex,
      roughness: 0.85,
      side: THREE.FrontSide,
    })
    this.rightCurvedPageMesh = new THREE.Mesh(geoRight, rightCurvedMat)
    this.rightCurvedPageMesh.position.set(0, coverThickness + pageBlockThickness + 0.0003, 0)
    this.rightCurvedPageMesh.castShadow = true
    this.rightCurvedPageMesh.receiveShadow = true
    this.rightCurvedPageMesh.visible = false
    this.heroBookGroup.add(this.rightCurvedPageMesh)

    // Left Page: spans from x = -blockWidth to 0 flush on top of the left page block
    const geoLeft = new THREE.PlaneGeometry(blockWidth, blockLength, 4, 4)
    geoLeft.translate(-blockWidth / 2, 0, 0)
    geoLeft.rotateX(-Math.PI / 2)
    geoLeft.computeVertexNormals()

    const leftCurvedMat = new THREE.MeshStandardMaterial({
      map: insideCoverTex,
      roughness: 0.85,
      side: THREE.FrontSide,
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
    })
    this.pageFrontMesh = new THREE.Mesh(geoFront, frontMat)
    this.pageFrontMesh.position.set(0, 0, 0)
    this.pageFrontMesh.castShadow = true
    this.pageFrontMesh.receiveShadow = true
    this.pageMesh = this.pageFrontMesh

    // Back face: Cloned geometry with inverted index winding and horizontal UV flip (zero separation, unified single sheet)
    const posAttrFront = geoFront.getAttribute('position') as THREE.BufferAttribute
    this.pageFrontBasePositions = new Float32Array(posAttrFront.array)

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

  // Interactive Raycasting & Mouse Events
  private bindEvents() {
    this.canvas.addEventListener('mousemove', this.onMouseMove)
    this.canvas.addEventListener('click', this.onClick)
    window.addEventListener('resize', this.onResize)
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

    const spineMat = (this.hoveredBookMesh.material as THREE.Material[])[4] as THREE.MeshStandardMaterial
    if (spineMat && spineMat.emissive) {
      spineMat.emissive.setHex(0x000000)
      spineMat.emissiveIntensity = 0
    }

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
    if (this.state === 'book-flying') return
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

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
            const spineMat = (hitMesh.material as THREE.Material[])[4] as THREE.MeshStandardMaterial
            if (spineMat && spineMat.emissive) {
              spineMat.emissive.setHex(0x0e2f56)
              spineMat.emissiveIntensity = 0.35
            }

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
    this.raycaster.setFromCamera(this.mouse, this.camera)

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
    this.resetHoveredBook()
    this.currentBookData = bookData
    this.callbacks.onBookSelected?.(bookData)

    // Apply selected book outer appearance to Hero Book rig for flight
    let coverTex: THREE.Texture
    if (bookData.coverImage) {
      coverTex = this.textureLoader.load(bookData.coverImage)
      coverTex.colorSpace = THREE.SRGBColorSpace
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
    gsap.to(this.heroBookGlowLight, { intensity: 0.15, duration: 0.3 })

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
    if (this.state !== 'on-table') return
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

      // Underneath on the right stack: immediately reveal the new targetPage
      if (Array.isArray(rightBlockMats) && rightBlockMats[2]) {
        rightBlockMats[2].map = getPageTex(targetPage)
        rightBlockMats[2].needsUpdate = true
      }
      if (this.rightCurvedPageMesh) {
        const rMat = this.rightCurvedPageMesh.material as THREE.MeshStandardMaterial
        rMat.map = getPageTex(targetPage)
        rMat.needsUpdate = true
      }

      // Initialize turning leaf on top of right stack
      this.pagePivot.rotation.z = 0
      this.pagePivot.position.set(0, coverThickness + prevRightH, 0)
      this.pagePivot.visible = true
      this.applyPageCurl(0, true)

      let hasPreloadedLeft = false
      const anim = { p: 0 }
      const tl = gsap.timeline({
        onComplete: () => {
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
          })
        },
      })

      tl.to(anim, {
        p: 1,
        duration: 0.88,
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
        },
      })
    } else {
      // BACKWARD FLIP: Turning leaf lifts from left stack and turns to right stack
      // Back face (revealed while on left): page lifting off from left (prevPage - 1)
      const prevVerso = prevPage - 1
      backMeshMat.map = getPageTex(prevVerso)
      backMeshMat.needsUpdate = true

      // Front face: lands facing up on right stack (targetPage)
      frontMeshMat.map = getPageTex(targetPage)
      frontMeshMat.needsUpdate = true

      // Underneath on left stack: reveal targetPage - 1
      const targetVerso = targetPage - 1
      if (Array.isArray(leftBlockMats) && leftBlockMats[2]) {
        leftBlockMats[2].map = getPageTex(targetVerso)
        leftBlockMats[2].needsUpdate = true
      }
      if (this.leftCurvedPageMesh) {
        const lMat = this.leftCurvedPageMesh.material as THREE.MeshStandardMaterial
        lMat.map = getPageTex(targetVerso)
        lMat.needsUpdate = true
      }

      // Initialize turning leaf on top of left stack
      this.pagePivot.rotation.z = Math.PI
      this.pagePivot.position.set(0, coverThickness + prevLeftH, 0)
      this.pagePivot.visible = true
      this.applyPageCurl(0, false)

      let hasPreloadedRight = false
      const anim = { p: 0 }
      const tl = gsap.timeline({
        onComplete: () => {
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
          })
        },
      })

      tl.to(anim, {
        p: 1,
        duration: 0.88,
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
        },
      })
    }
  }

  // Book Controller: Return to Shelf Animation
  public returnToShelf() {
    if (this.state === 'room-view' || this.state === 'book-flying') return

    const wasOpen = this.state === 'book-open'
    this.state = 'book-flying'

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
        gsap.to(this.heroBookGlowLight, { intensity: 1.1, duration: 0.4 })
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

  public toggleRoomLight(): boolean {
    this.isLightOn = !this.isLightOn

    if (!this.isLightOn) {
      gsap.to(this.lampLight, { intensity: 0, duration: 0.35 })
      gsap.to(this.sunLight, { intensity: 0.04, duration: 0.5 })
      gsap.to(this.ambientLight, { intensity: 0.08, duration: 0.5 })
      gsap.to(this.ambientLight.color, { r: 0.08, g: 0.12, b: 0.24, duration: 0.5 })
      gsap.to(this.moonLight, { intensity: 0.75, duration: 0.5 })

      const shadeMat = this.lampShadeMesh.material as THREE.MeshStandardMaterial
      gsap.to(shadeMat, { emissiveIntensity: 0.03, duration: 0.35 })

      if (this.dustParticles) {
        const mat = this.dustParticles.material as THREE.PointsMaterial
        gsap.to(mat, { opacity: 0.95, size: 0.085, duration: 0.4 })
      }
    } else {
      gsap.to(this.lampLight, { intensity: 3.2, duration: 0.35 })
      gsap.to(this.sunLight, { intensity: 1.4, duration: 0.5 })
      gsap.to(this.ambientLight, { intensity: 0.75, duration: 0.5 })
      gsap.to(this.ambientLight.color, { r: 1.0, g: 0.93, b: 0.85, duration: 0.5 })
      gsap.to(this.moonLight, { intensity: 0.25, duration: 0.5 })

      const shadeMat = this.lampShadeMesh.material as THREE.MeshStandardMaterial
      gsap.to(shadeMat, { emissiveIntensity: 0.85, duration: 0.35 })

      if (this.dustParticles) {
        const mat = this.dustParticles.material as THREE.PointsMaterial
        gsap.to(mat, { opacity: 0.85, size: 0.075, duration: 0.4 })
      }
    }

    this.callbacks.onLightToggled?.(this.isLightOn)
    return this.isLightOn
  }

  // Realistic Drinking Green Tea Animation
  public drinkTea() {
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(width, height, false)
  }

  private startLoop() {
    const clock = new THREE.Clock()

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate)
      const elapsedTime = clock.getElapsedTime()

      // 1. Environmental atmospheric micro-animations (GPU-driven fireflies & tea steam)
      if (this.dustParticles) {
        // Slow ambient room circulation drift
        this.dustParticles.rotation.y = elapsedTime * 0.012

        // Feed global time to GPU shader for 100% hardware-accelerated independent firefly motion
        const mat = this.dustParticles.material as THREE.PointsMaterial
        if (mat?.userData?.shader) {
          mat.userData.shader.uniforms.uTime.value = elapsedTime
        }
      }

      // Rising delicate steam from freshly whisked hot matcha tea
      if (this.teaSteamParticles) {
        this.teaSteamParticles.rotation.y = elapsedTime * 0.15
        this.teaSteamParticles.position.y = 0.005 + Math.sin(elapsedTime * 0.8) * 0.004
      }

      // Subtle outdoor garden leaf sway
      if (this.gardenBackdropMesh) {
        this.gardenBackdropMesh.position.y = 2.0 + Math.sin(elapsedTime * 0.22) * 0.008
      }

      // 2. Room View Camera Breathing (Smooth, natural 1.8cm arc, zero robotic shake)
      if (this.state === 'room-view') {
        this.camera.position.x = this.initialCamPos.x + Math.sin(elapsedTime * 0.25) * 0.018
        this.camera.position.y = this.initialCamPos.y + Math.cos(elapsedTime * 0.2) * 0.012
        this.camera.lookAt(this.initialCamTarget)

        if (this.heroBookGlowLight) {
          this.heroBookGlowLight.intensity = 0.8 + Math.sin(elapsedTime * 2.0) * 0.2
        }
      }

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
    if (this.heroBookGlowLight) gsap.killTweensOf(this.heroBookGlowLight)
    if (this.sunLight) gsap.killTweensOf(this.sunLight)
    if (this.lampLight) gsap.killTweensOf(this.lampLight)

    // Detach event listeners
    this.canvas.removeEventListener('mousemove', this.onMouseMove)
    this.canvas.removeEventListener('click', this.onClick)
    window.removeEventListener('resize', this.onResize)

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
