import * as THREE from 'three'

/**
 * Per-area indoor lighting.
 *
 * three.js ambient light and image-based (environment) light are global, so they can't be "on in the
 * dojo, off in the corridor". Switching them by the camera's zone made rooms look dark from a dark
 * corridor and then pop on as you stepped in. Instead, every lit material gets a tiny shader
 * extension: each surface finds which area (study, corridor, a room) it belongs to from its world
 * position, nudged a few cm along its normal so the two faces of a shared wall land on their own
 * sides. It then receives that area's ambient light and environment level, only study surfaces get
 * the study's window sun / moon (the scene's directional lights), and every open door adds a soft
 * pool of its room's light just outside it (and the corridor's light just inside).
 *
 * Cost: two short loops of uniform maths per pixel, no extra passes, no shader recompiles at runtime.
 */

export const MAX_REGIONS = 6
export const MAX_DOORS = 6
/** Upper bound for real spot / point lights in the scene (lamp + pools) */
export const MAX_LOCAL_LIGHTS = 8

const PARS = /* glsl */ `
uniform vec4 uIreBox[${MAX_REGIONS}];
uniform vec4 uIreLight[${MAX_REGIONS}];
uniform vec4 uIreOutside;
uniform vec4 uIreDoor[${MAX_DOORS}];
uniform vec3 uIreDoorIn[${MAX_DOORS}];
uniform vec3 uIreDoorOut[${MAX_DOORS}];
uniform float uIreSpotRegion[${MAX_LOCAL_LIGHTS}];
uniform float uIrePointRegion[${MAX_LOCAL_LIGHTS}];`

const REGION_COMPUTE = /* glsl */ `
vec3 ireWorldN = inverseTransformDirection( geometryNormal, viewMatrix );
vec3 ireP = cameraPosition + ( vec4( geometryPosition, 0.0 ) * viewMatrix ).xyz + ireWorldN * 0.05;
float ireSum = 0.0;
vec3 ireAmb = vec3( 0.0 );
float ireEnv = 0.0;
float ireDirMask = 0.0;
float ireW[ ${MAX_REGIONS} ];
for ( int i = 0; i < ${MAX_REGIONS}; i ++ ) {
  vec4 b = uIreBox[ i ];
  vec2 lo = ireP.xz - b.xz;
  vec2 hi = b.yw - ireP.xz;
  float w = smoothstep( -0.04, 0.04, min( min( lo.x, lo.y ), min( hi.x, hi.y ) ) );
  ireW[ i ] = w;
  ireSum += w;
  ireAmb += w * uIreLight[ i ].rgb;
  ireEnv += w * uIreLight[ i ].a;
  if ( i == 0 ) ireDirMask = w;
}
if ( ireSum > 1.0 ) {
  ireAmb /= ireSum;
  ireEnv /= ireSum;
  ireDirMask /= ireSum;
  for ( int i = 0; i < ${MAX_REGIONS}; i ++ ) ireW[ i ] /= ireSum;
}
float ireOut = max( 0.0, 1.0 - ireSum );
ireAmb += ireOut * uIreOutside.rgb;
ireEnv += ireOut * uIreOutside.a;
ireDirMask += ireOut;
for ( int i = 0; i < ${MAX_DOORS}; i ++ ) {
  vec4 d = uIreDoor[ i ];
  if ( d.w <= 0.001 ) continue;
  vec2 q = vec2( ireP.x - d.x, ireP.z - d.y );
  // Light leaving the doorway: falls off with distance and only reaches surfaces that face the
  // opening (the floor in front of it, the far wall), not the wall the door is set in
  vec3 ireToDoor = vec3( d.x, 1.2, d.y ) - ireP;
  float ireFacing = clamp( dot( ireWorldN, normalize( ireToDoor ) ) * 0.9 + 0.1, 0.0, 1.0 );
  float fall = exp( - ( q.x * q.x * 0.8 + q.y * q.y ) / ( d.z * d.z ) ) * d.w * ireFacing;
  vec3 spill = mix( uIreDoorOut[ i ], uIreDoorIn[ i ], smoothstep( -0.05, 0.05, q.y ) ) * fall;
  ireAmb += spill;
  ireEnv += fall * 0.35 * dot( spill, vec3( 0.3333 ) );
}
IncidentLight directLight;`

const REGION_APPLY = /* glsl */ `
#if defined( RE_IndirectDiffuse )
  irradiance += ireAmb;
  iblIrradiance *= ireEnv;
#endif
#if defined( RE_IndirectSpecular )
  radiance *= ireEnv;
#endif
#include <lights_fragment_end>`

let patchedBegin: string | null = null
function lightsBegin(): string {
  if (!patchedBegin) {
    let chunk = THREE.ShaderChunk.lights_fragment_begin
    chunk = chunk.replace('IncidentLight directLight;', REGION_COMPUTE)
    // The scene's directional lights are the study's window sun and moon
    chunk = chunk.replace(
      'getDirectionalLightInfo( directionalLight, directLight );',
      'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= ireDirMask;'
    )
    // Spot / point lights only light their own area (they cast no shadows, so walls can't stop them);
    // a region of -1 means the light isn't inside any area and lights everything
    const mask = (uniform: string) =>
      `\n\t\t{ float ireR = ${uniform}[ i ]; directLight.color *= ireR < -0.5 ? 1.0 : ireW[ int( ireR ) ]; }`
    chunk = chunk.replace(
      'getSpotLightInfo( spotLight, geometryPosition, directLight );',
      'getSpotLightInfo( spotLight, geometryPosition, directLight );' + mask('uIreSpotRegion')
    )
    chunk = chunk.replace(
      'getPointLightInfo( pointLight, geometryPosition, directLight );',
      'getPointLightInfo( pointLight, geometryPosition, directLight );' + mask('uIrePointRegion')
    )
    patchedBegin = chunk
  }
  return patchedBegin
}

export interface RegionLight {
  /** World-space XZ extent */
  box: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** Ambient light colour already multiplied by its intensity */
  ambient: THREE.Color
  /** Environment (IBL) level */
  env: number
}

export class RegionLighting {
  readonly uniforms = {
    uIreBox: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector4(1e5, -1e5, 1e5, -1e5)) },
    uIreLight: { value: Array.from({ length: MAX_REGIONS }, () => new THREE.Vector4()) },
    uIreOutside: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.45) },
    uIreDoor: { value: Array.from({ length: MAX_DOORS }, () => new THREE.Vector4()) },
    uIreDoorIn: { value: Array.from({ length: MAX_DOORS }, () => new THREE.Vector3()) },
    uIreDoorOut: { value: Array.from({ length: MAX_DOORS }, () => new THREE.Vector3()) },
    uIreSpotRegion: { value: new Array<number>(MAX_LOCAL_LIGHTS).fill(-1) },
    uIrePointRegion: { value: new Array<number>(MAX_LOCAL_LIGHTS).fill(-1) },
  }
  private boxes: RegionLight['box'][] = []

  /** Region 0 must be the study: only it (and anything outside every region) receives directional light. */
  setRegions(regions: RegionLight[], outside: { ambient: THREE.Color; env: number }) {
    const { uIreBox, uIreLight, uIreOutside } = this.uniforms
    for (let i = 0; i < MAX_REGIONS; i++) {
      const r = regions[i]
      if (!r) {
        uIreBox.value[i]!.set(1e5, -1e5, 1e5, -1e5)
        uIreLight.value[i]!.set(0, 0, 0, 0)
        this.boxes.length = Math.min(this.boxes.length, i)
        continue
      }
      uIreBox.value[i]!.set(r.box.minX, r.box.maxX, r.box.minZ, r.box.maxZ)
      this.boxes[i] = r.box
      uIreLight.value[i]!.set(r.ambient.r, r.ambient.g, r.ambient.b, r.env)
    }
    uIreOutside.value.set(outside.ambient.r, outside.ambient.g, outside.ambient.b, outside.env)
  }

  /** Index of the region containing a world position, or -1. */
  regionOf(x: number, z: number): number {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i]
      if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return i
    }
    return -1
  }

  /**
   * Area of each real spot / point light, in the order three.js uploads them (shadow-casting lights
   * first, then scene order).
   */
  setLightRegions(spots: THREE.Light[], points: THREE.Light[]) {
    const assign = (lights: THREE.Light[], out: number[]) => {
      for (let i = 0; i < MAX_LOCAL_LIGHTS; i++) {
        const l = lights[i]
        out[i] = l ? this.regionOf(l.position.x, l.position.z) : -1
      }
    }
    assign(spots, this.uniforms.uIreSpotRegion.value)
    assign(points, this.uniforms.uIrePointRegion.value)
  }

  /**
   * `open` 0..1 (eased door opening), `inside` = light leaving the room into the corridor,
   * `outside` = corridor light entering the room. Doors sit on the corridor wall (z = doorZ).
   */
  setDoors(doors: Array<{ x: number; z: number; open: number; inside: THREE.Color; outside: THREE.Color }>) {
    const { uIreDoor, uIreDoorIn, uIreDoorOut } = this.uniforms
    for (let i = 0; i < MAX_DOORS; i++) {
      const d = doors[i]
      if (!d) {
        uIreDoor.value[i]!.set(0, 0, 1, 0)
        continue
      }
      uIreDoor.value[i]!.set(d.x, d.z, 2.1, d.open)
      uIreDoorIn.value[i]!.set(d.inside.r, d.inside.g, d.inside.b)
      uIreDoorOut.value[i]!.set(d.outside.r, d.outside.g, d.outside.b)
    }
  }

  /** Add the region extension to one lit material (idempotent). */
  patch(material: THREE.Material) {
    const m = material as THREE.Material & { isMeshStandardMaterial?: boolean; isMeshLambertMaterial?: boolean; isMeshPhongMaterial?: boolean }
    if (m.userData.ireRegion || m.userData.ireSkip) return
    if (!m.isMeshStandardMaterial && !m.isMeshLambertMaterial && !m.isMeshPhongMaterial) return
    m.userData.ireRegion = true
    const previous = m.onBeforeCompile
    // The default cache key is the onBeforeCompile source, which we're about to wrap: capture it first
    const baseKey =
      m.customProgramCacheKey === THREE.Material.prototype.customProgramCacheKey ? previous.toString() : null
    const previousKey = m.customProgramCacheKey
    const uniforms = this.uniforms
    m.onBeforeCompile = (shader, renderer) => {
      previous.call(m, shader, renderer)
      Object.assign(shader.uniforms, uniforms)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PARS}`)
        .replace('#include <lights_fragment_begin>', lightsBegin())
        .replace('#include <lights_fragment_end>', REGION_APPLY)
    }
    m.customProgramCacheKey = () => `${baseKey ?? previousKey.call(m)}|ire-region`
    m.needsUpdate = true
  }

  /** Patch every lit material under `root` that isn't patched yet. Cheap enough to call periodically. */
  patchScene(root: THREE.Object3D) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      if (Array.isArray(mesh.material)) mesh.material.forEach((mat) => this.patch(mat))
      else this.patch(mesh.material)
    })
  }
}
