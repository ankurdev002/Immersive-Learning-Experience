import * as THREE from 'three'

/** CC0 Poly Haven sets shipped in /public/textures (see CREDITS.md), each at 1024px and 512px. */
const PBR_SETS = {
  tatami: 'tatami_mat',
  walnut: 'american_walnut_veneer',
  darkWalnut: 'black_walnut_veneer_01',
  cedar: 'japanese_cedar_planks',
  plaster: 'clay_plaster',
  hessian: 'hessian_230',
  linen: 'rough_linen',
  poplin: 'stretch_poplin',
} as const

export type PbrSetName = keyof typeof PBR_SETS

interface PbrBaseMaps {
  map: THREE.Texture
  normalMap: THREE.Texture
  armMap: THREE.Texture
}

export interface PbrMaterialOptions {
  /** Texture repeats across the surface (world-size aware callers pass metres / tile size) */
  repeat?: [number, number]
  rotation?: number
  /** Multiplies the base colour (lets one wood scan serve several finishes) */
  color?: THREE.ColorRepresentation
  /** Multiplies the roughness map */
  roughness?: number
  metalness?: number
  normalScale?: number
  envMapIntensity?: number
  side?: THREE.Side
  /** Use only the scan's relief (normal + AO/roughness) under a flat colour */
  noColorMap?: boolean
  /** Cloth sheen (soft grazing-angle highlight of woven fabric); ignored on the low tier */
  sheen?: { color: THREE.ColorRepresentation; roughness: number; intensity?: number }
  /** Mark geometry using this material for real-world box-projected UVs (see projectWoodUVs) */
  worldUV?: boolean
  name?: string
}

/**
 * Loads each PBR set once and hands out materials whose textures are clones sharing a single image
 * (one download, one GPU upload) but with their own tiling. Low-end tiers load the 512px set, the
 * rest the 1024px set for large / close-up surfaces and 512px for secondary ones.
 */
export class PbrTextureLibrary {
  private readonly loader: THREE.TextureLoader
  private readonly base = new Map<PbrSetName, PbrBaseMaps>()

  constructor(
    manager: THREE.LoadingManager,
    private readonly isLowTier: boolean,
    private readonly anisotropy: number
  ) {
    this.loader = new THREE.TextureLoader(manager)
  }

  /** Close-up / large surfaces get 1K on medium+ tiers; everything is 512px on low tier. */
  private resolutionFor(set: PbrSetName): 512 | 1024 {
    if (this.isLowTier) return 512
    return set === 'plaster' || set === 'hessian' || set === 'darkWalnut' || set === 'linen' || set === 'poplin' ? 512 : 1024
  }

  private getBase(set: PbrSetName): PbrBaseMaps {
    let maps = this.base.get(set)
    if (!maps) {
      const dir = `/textures/${PBR_SETS[set]}/${this.resolutionFor(set)}`
      const load = (file: string, color: boolean) => {
        const tex = this.loader.load(`${dir}/${file}.webp`)
        tex.wrapS = THREE.RepeatWrapping
        tex.wrapT = THREE.RepeatWrapping
        tex.anisotropy = this.anisotropy
        if (color) tex.colorSpace = THREE.SRGBColorSpace
        return tex
      }
      maps = { map: load('diff', true), normalMap: load('nor', false), armMap: load('arm', false) }
      this.base.set(set, maps)
    }
    return maps
  }

  /** Start fetching sets up front so they're ready by the time the loading screen lifts. */
  preload(sets: PbrSetName[]) {
    sets.forEach((set) => this.getBase(set))
  }

  material(set: PbrSetName, opts: PbrMaterialOptions = {}): THREE.MeshStandardMaterial {
    const base = this.getBase(set)
    const [rx, ry] = opts.repeat ?? [1, 1]
    const tile = (tex: THREE.Texture) => {
      const t = tex.clone()
      t.repeat.set(rx, ry)
      t.rotation = opts.rotation ?? 0
      return t
    }
    const arm = tile(base.armMap)
    const normalScale = opts.normalScale ?? 1
    const useSheen = !!opts.sheen && !this.isLowTier
    const Material = useSheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
    const material = new Material({
      name: opts.name ?? `pbr-${set}`,
      map: opts.noColorMap ? null : tile(base.map),
      normalMap: tile(base.normalMap),
      normalScale: new THREE.Vector2(normalScale, normalScale),
      aoMap: arm,
      roughnessMap: arm,
      color: opts.color ?? 0xffffff,
      roughness: opts.roughness ?? 1,
      metalness: opts.metalness ?? 0,
      envMapIntensity: opts.envMapIntensity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    })
    if (useSheen && material instanceof THREE.MeshPhysicalMaterial) {
      material.sheen = opts.sheen!.intensity ?? 1
      material.sheenColor = new THREE.Color(opts.sheen!.color)
      material.sheenRoughness = opts.sheen!.roughness
    }
    if (opts.worldUV) material.userData.worldUV = true
    return material
  }

  /** Tiled clones of a set's relief maps, for materials that bring their own colour map. */
  reliefMaps(set: PbrSetName, repeat: [number, number]): { normalMap: THREE.Texture; armMap: THREE.Texture } {
    const base = this.getBase(set)
    const tile = (tex: THREE.Texture) => {
      const t = tex.clone()
      t.repeat.set(repeat[0], repeat[1])
      return t
    }
    return { normalMap: tile(base.normalMap), armMap: tile(base.armMap) }
  }
}
