import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PbrSetName, PbrTextureLibrary } from './PbrTextures'
import { projectWoodUVs } from './Props'
import { buildBambooClump, buildMaple, buildPine, buildShrub, type TreeGeometry } from './Trees'
import {
  createBambooLeafTexture,
  createCulmTexture,
  createGraniteTexture,
  createHedgeTexture,
  createMapleLeafTexture,
  createPineNeedleTexture,
  seasonOf,
} from './GardenTextures'

/**
 * The world outside the windows: a real 3D Japanese garden around the building under a sky that
 * follows the visitor's clock (sun and moon positions, sunrise / sunset colours, stars at night,
 * drifting clouds).
 *
 * - `front`: the garden seen through the corridor's glass doors (z > 7.3) with a pond, fountain,
 *   stone lanterns, maples, pines, bamboo and clipped shrubs, closed by a tiled garden wall.
 * - `back`: the courtyard behind the rooms with a raked-gravel karesansui, seen from the study's
 *   glass window and the meditation dojo's window.
 * - Distant forested hills and the sky are always present (they only draw where nothing else does).
 *
 * Everything outdoors uses one shared, very cheap lighting model (hemisphere sky light + sun or
 * moon + stone-lantern glow, applied in a patched Lambert shader) driven by the time of day, so it
 * never touches the interior's light pools and costs the same on every device.
 */

export type OutdoorTier = 'low' | 'medium' | 'high'

export interface OutdoorOptions {
  pbr: PbrTextureLibrary
  manager: THREE.LoadingManager
  tier: OutdoorTier
  antialias: boolean
  /** X of the meditation dojo, whose back wall has a window onto the courtyard */
  dojoX: number
  /** Called when the glTF rocks / ferns have been added (new shaders to warm up) */
  onModelsReady?: () => void
}

const GROUND_Y = -0.3
const GARDEN = { minX: -24, maxX: 24, minZ: -13, maxZ: 25 }
const POND = { x: 2, z: 15.2, rx: 5.2, rz: 3.3 }
const FOUNTAIN = { x: 2.2, z: 15.3 }
const WATER_Y = GROUND_Y + 0.07
const KARESANSUI = { minX: -12, maxX: -3.4, minZ: -5.6, maxZ: -0.7 }
const DEG = Math.PI / 180

// ---------------------------------------------------------------------------
// Noise (JS side, for terrain and silhouettes)
// ---------------------------------------------------------------------------

function hash2(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy)
  const b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1)
  const d = hash2(ix + 1, iy + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
function fbm2(x: number, y: number, octaves = 4) {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < octaves; i++) {
    s += a * vnoise(x * f, y * f)
    f *= 2.03
    a *= 0.5
  }
  return s / (1 - Math.pow(0.5, octaves))
}
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Terrain height: flat around the building, soft tsukiyama mounds in the open garden, rising hills outside the walls. */
export function groundHeight(x: number, z: number): number {
  const dx = Math.max(GARDEN.minX - x, x - GARDEN.maxX, 0)
  const dz = Math.max(GARDEN.minZ - z, z - GARDEN.maxZ, 0)
  const out = Math.hypot(dx, dz)
  if (out > 0) return GROUND_Y + smooth(0, 40, out) * 5 + fbm2(x * 0.04, z * 0.04) * 2.5 * smooth(0, 12, out)
  if (z > 10.5 || z < -7.5) {
    const pond = Math.hypot((x - POND.x) / (POND.rx + 2.2), (z - POND.z) / (POND.rz + 2.2))
    const edge = Math.min(x - GARDEN.minX, GARDEN.maxX - x, z - GARDEN.minZ, GARDEN.maxZ - z)
    const w = smooth(1, 1.5, pond) * smooth(0.5, 3, edge) * (z > 0 ? smooth(10.5, 13, z) : smooth(-7.5, -9.5, z))
    return GROUND_Y + w * Math.max(0, fbm2(x * 0.11 + 5, z * 0.11 - 3) - 0.42) * 2.2
  }
  return GROUND_Y
}

// ---------------------------------------------------------------------------
// Time of day
// ---------------------------------------------------------------------------

interface SkyKey {
  el: number
  zenith: string
  horizon: string
  light: string
  lightI: number
  sky: string
  skyI: number
  ground: string
  groundI: number
  cloudLit: string
  cloudShade: string
}

/** Sky palette keyed by sun elevation in degrees (night → twilight → golden hour → day). */
const SKY_KEYS: SkyKey[] = [
  { el: -90, zenith: '#020409', horizon: '#060a16', light: '#8fa6d6', lightI: 0.3, sky: '#1c2a4f', skyI: 0.3, ground: '#0b0e14', groundI: 0.1, cloudLit: '#1a2236', cloudShade: '#090c16' },
  { el: -14, zenith: '#03060f', horizon: '#0a1024', light: '#8fa6d6', lightI: 0.3, sky: '#1c2a4f', skyI: 0.3, ground: '#0b0e14', groundI: 0.1, cloudLit: '#1d263c', cloudShade: '#0b0f1a' },
  { el: -7, zenith: '#0b1532', horizon: '#252b52', light: '#8fa6d6', lightI: 0.28, sky: '#28365e', skyI: 0.34, ground: '#0e1118', groundI: 0.12, cloudLit: '#2d3354', cloudShade: '#131729' },
  { el: -3, zenith: '#1c2c5c', horizon: '#b4646a', light: '#ff9a6a', lightI: 0.3, sky: '#5a5a86', skyI: 0.42, ground: '#2a2228', groundI: 0.14, cloudLit: '#e08a7a', cloudShade: '#3a3050' },
  { el: 2, zenith: '#34589a', horizon: '#f0a466', light: '#ffab66', lightI: 1.15, sky: '#8a96b8', skyI: 0.75, ground: '#5a4a38', groundI: 0.34, cloudLit: '#ffc890', cloudShade: '#6a6080' },
  { el: 9, zenith: '#3a6cb8', horizon: '#f0c9a0', light: '#ffd9a8', lightI: 2.0, sky: '#a2bce0', skyI: 0.95, ground: '#6a6048', groundI: 0.45, cloudLit: '#fff0dc', cloudShade: '#8a90a8' },
  { el: 25, zenith: '#2f6ac0', horizon: '#aecfeb', light: '#fff2df', lightI: 2.5, sky: '#a9c8ee', skyI: 1.05, ground: '#6c6a52', groundI: 0.5, cloudLit: '#ffffff', cloudShade: '#9aa4b8' },
  { el: 90, zenith: '#2a62bd', horizon: '#b4d3ef', light: '#fff6ea', lightI: 2.7, sky: '#aac9ef', skyI: 1.1, ground: '#6c6a52', groundI: 0.52, cloudLit: '#ffffff', cloudShade: '#a3acc0' },
]

// ---------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------

const GLSL_NOISE = /* glsl */ `
float oHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float oNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(oHash(i), oHash(i + vec2(1.0, 0.0)), u.x), mix(oHash(i + vec2(0.0, 1.0)), oHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`

const OUT_VERT_PARS = /* glsl */ `
uniform float uTime;
varying vec3 vOutPos;`

const OUT_FRAG_PARS = /* glsl */ `
uniform float uTime;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uSkyLight;
uniform vec3 uGroundLight;
uniform float uNight;
uniform vec3 uLampPos[4];
uniform vec3 uLampColor;
uniform vec3 uSpill;
uniform vec4 uRake[4];
varying vec3 vOutPos;
${GLSL_NOISE}`

const OUT_WORLD_POS = /* glsl */ `
{
  vec4 outWp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  outWp = instanceMatrix * outWp;
  #endif
  vOutPos = (modelMatrix * outWp).xyz;
}`

function swayChunk(start: number, amp: number, flutter: number) {
  return /* glsl */ `
#include <begin_vertex>
{
  vec3 swayOrigin = vec3(0.0);
  #ifdef USE_INSTANCING
  swayOrigin = instanceMatrix[3].xyz;
  #endif
  float swayH = max(position.y - ${start.toFixed(3)}, 0.0);
  float swayW = swayH * swayH * ${amp.toFixed(5)};
  float ph = swayOrigin.x * 0.37 + swayOrigin.z * 0.29;
  transformed.x += swayW * (sin(uTime * 0.9 + ph) + 0.35 * sin(uTime * 2.1 + ph * 1.7));
  transformed.z += swayW * 0.6 * sin(uTime * 0.7 + ph * 1.3);
  float fl = ${flutter.toFixed(4)} * min(swayH, 1.0);
  transformed += fl * vec3(sin(uTime * 5.3 + position.x * 7.0 + position.z * 3.0), 0.5 * sin(uTime * 4.1 + position.y * 6.0), cos(uTime * 4.7 + position.z * 7.0 + position.x * 2.0));
}`
}

const OUT_LIGHTING = /* glsl */ `
{
  #ifdef OUT_FOLIAGE
  vec3 oN = normalize(inverseTransformDirection(normalize(vNormal), viewMatrix));
  #else
  vec3 oN = normalize(inverseTransformDirection(normal, viewMatrix));
  #endif
  #ifdef OUT_MACRO
  // Large-scale colour variation hides texture tiling on big ground planes
  float macro = oNoise(vOutPos.xz * 0.11) * 0.6 + oNoise(vOutPos.xz * 0.37) * 0.4;
  diffuseColor.rgb *= mix(1.0 - OUT_MACRO, 1.0 + OUT_MACRO * 0.6, macro);
  #endif
  #ifdef OUT_RAKE
  {
    // Raked furrows: straight lines across the garden, concentric rings around each rock
    vec2 q = vOutPos.xz;
    float phase = q.y * 88.0;
    vec2 grad = vec2(0.0, 1.0);
    for (int i = 0; i < 4; i++) {
      vec2 d = q - uRake[i].xy;
      float dist = length(d);
      float ring = smoothstep(uRake[i].z + 0.8, uRake[i].z + 0.6, dist);
      phase = mix(phase, dist * 88.0, ring);
      grad = normalize(mix(grad, d / max(dist, 1e-3), ring));
    }
    float fade = clamp(1.0 - fwidth(phase) * 0.3, 0.0, 1.0);
    oN = normalize(oN + vec3(grad.x, 0.0, grad.y) * cos(phase) * 0.5 * fade);
    diffuseColor.rgb *= 1.0 - 0.12 * fade * (0.5 - 0.5 * sin(phase));
  }
  #endif
  float oAo = 1.0;
  #ifdef USE_AOMAP
  oAo = (texture2D(aoMap, vAoMapUv).r - 1.0) * aoMapIntensity + 1.0;
  #endif
  float ndl = dot(oN, uLightDir);
  #ifdef OUT_FOLIAGE
  float sunT = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
  #else
  float sunT = max(ndl, 0.0);
  #endif
  vec3 hemi = mix(uGroundLight, uSkyLight, oN.y * 0.5 + 0.5);
  vec3 lamps = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 L = uLampPos[i] - vOutPos;
    float dd = dot(L, L);
    lamps += uLampColor * (max(dot(oN, L * inversesqrt(dd + 1e-4)), 0.0) * 0.7 + 0.3) / (1.0 + dd * 0.9);
  }
  // Warm light from the lit corridor spilling out through its glass doors onto the veranda
  float spill = smoothstep(11.5, 7.3, vOutPos.z) * step(7.2, vOutPos.z) * smoothstep(15.5, 13.5, abs(vOutPos.x));
  lamps += uSpill * spill * (0.45 + 0.55 * max(-oN.z, max(oN.y, 0.0)));
  vec3 oEmissive = totalEmissiveRadiance;
  #ifdef OUT_GLOW
  oEmissive *= uNight;
  #endif
  outgoingLight = diffuseColor.rgb * (hemi * oAo + uLightColor * sunT * (0.5 + 0.5 * oAo) + lamps) + oEmissive;
}
#include <opaque_fragment>`

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // Pinned to the far plane: the sky only fills pixels nothing else has drawn
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`

const SKY_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uCloudLit;
uniform vec3 uCloudShade;
uniform float uTime;
uniform float uNight;
uniform float uSunUp;
uniform float uCloudCover;
varying vec3 vDir;
${GLSL_NOISE}
float fbm(vec2 p) {
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < SKY_OCTAVES; i++) { s += a * oNoise(p); p = p * 2.02 + vec2(17.1, 3.7); a *= 0.5; }
  return s;
}
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  float up = max(y, 0.0);
  vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
  col = mix(col, uHorizon * 0.72, smoothstep(0.0, -0.2, y));

  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (0.16 * pow(sd, 8.0) + 0.4 * pow(sd, 90.0)) * uSunUp;
  col += uSunColor * pow(sd, 3.0) * (1.0 - smoothstep(0.0, 0.35, up)) * 0.22 * uSunUp;
  col += uSunColor * smoothstep(0.99955, 0.99978, sd) * 9.0 * uSunUp;

  if (uNight > 0.001 && y > 0.0) {
    vec3 sp = d * 260.0;
    float r = hash3(floor(sp));
    if (r > 0.9968) {
      float star = smoothstep(0.24, 0.0, length(fract(sp) - 0.5));
      float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 5.0) + r * 200.0);
      col += vec3(0.9, 0.94, 1.0) * star * tw * uNight * smoothstep(0.02, 0.3, y) * 1.8;
    }
  }
  float md = dot(d, uMoonDir);
  float moon = smoothstep(0.99935, 0.99962, md) * uNight;
  vec3 moonCol = vec3(0.95, 0.94, 0.88) * (0.78 + 0.22 * oNoise(d.xz * 1800.0 + 3.0));
  col += vec3(0.3, 0.4, 0.65) * pow(max(md, 0.0), 500.0) * 0.5 * uNight;
  col = mix(col, moonCol * 1.6, moon);

  if (y > 0.0) {
    vec2 uv = d.xz / (y + 0.1) * 0.55 + vec2(uTime * 0.006, uTime * 0.0025);
    float n = fbm(uv * 1.7);
    float cov = uCloudCover;
    float a = smoothstep(1.0 - cov, 1.0 - cov + 0.3, n) * smoothstep(0.0, 0.12, y);
    #ifdef SKY_CHEAP
    // One fbm only: fake self-shadowing from the cloud density itself
    float lit = clamp(1.15 - a * 0.55, 0.0, 1.0);
    #else
    float n2 = fbm(uv * 1.7 + uSunDir.xz * 0.06);
    float lit = clamp(0.62 + (n - n2) * 3.0, 0.0, 1.0);
    #endif
    vec3 cloud = mix(uCloudShade, uCloudLit, lit);
    cloud += uSunColor * pow(sd, 6.0) * 0.5 * uSunUp;
    col = mix(col, cloud, a * 0.94);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const HILL_VERT = /* glsl */ `
attribute vec3 color;
varying vec3 vCol;
varying float vY;
#include <fog_pars_vertex>
void main() {
  vCol = color;
  vY = position.y;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const HILL_FRAG = /* glsl */ `
uniform vec3 uSkyLight;
uniform vec3 uLightColor;
uniform vec3 uHorizon;
uniform float uHaze;
varying vec3 vCol;
varying float vY;
#include <fog_pars_fragment>
void main() {
  vec3 col = vCol * (uSkyLight * 0.9 + uLightColor * 0.28);
  col = mix(col, uHorizon, uHaze + (1.0 - uHaze) * 0.4 * smoothstep(14.0, -1.0, vY));
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

const WATER_VERT = /* glsl */ `
varying vec3 vWp;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uSunColor;
uniform vec3 uSkyLight;
uniform vec3 uLightColor;
uniform float uNight;
uniform float uSunUp;
uniform vec3 uLampPos[4];
uniform vec3 uLampColor;
uniform vec2 uFountain;
varying vec3 vWp;
${GLSL_NOISE}
float waves(vec2 p) {
  return oNoise(p * 2.2 + vec2(uTime * 0.25, uTime * 0.12)) * 0.6 + oNoise(p * 5.3 - vec2(uTime * 0.31, -uTime * 0.2)) * 0.4;
}
#include <fog_pars_fragment>
void main() {
  vec2 p = vWp.xz;
  float e = 0.04;
  float h = waves(p);
  vec2 g = vec2(waves(p + vec2(e, 0.0)) - h, waves(p + vec2(0.0, e)) - h) / e * 0.035;
  // Rings spreading from the fountain's splash
  vec2 fd = p - uFountain;
  float fdist = length(fd);
  g *= 0.6;
  g += fd / max(fdist, 1e-3) * sin(fdist * 24.0 - uTime * 5.5) * 0.04 * exp(-max(fdist - 1.45, 0.0) * 0.8) * step(1.4, fdist);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vWp);
  vec3 R = reflect(-V, n);
  float rh = max(R.y, 0.0);
  vec3 sky = mix(uHorizon, uZenith, pow(rh, 0.5));
  float F = 0.03 + 0.97 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 deep = vec3(0.018, 0.045, 0.04) * (uSkyLight + uLightColor * 0.25) * 1.6;
  vec3 col = mix(deep, sky * 0.6, F * 0.75);
  col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 350.0) * 6.0 * uSunUp;
  col += vec3(0.8, 0.85, 1.0) * pow(max(dot(R, uMoonDir), 0.0), 700.0) * 2.0 * uNight;
  for (int i = 0; i < 4; i++) {
    vec3 L = uLampPos[i] - vWp;
    float dd = dot(L, L);
    col += uLampColor * pow(max(dot(R, L * inversesqrt(dd + 1e-4)), 0.0), 60.0) * 1.5 / (1.0 + dd * 0.05);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

const FALL_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FALL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uSkyLight;
uniform vec3 uLightColor;
uniform vec3 uLampColor;
uniform float uSpeed;
varying vec2 vUv;
${GLSL_NOISE}
void main() {
  float s = oNoise(vec2(vUv.x * 70.0, vUv.y * 5.0 - uTime * uSpeed)) * 0.6 + oNoise(vec2(vUv.x * 160.0, vUv.y * 11.0 - uTime * uSpeed * 1.5)) * 0.4;
  vec3 lightCol = uSkyLight * 0.75 + uLightColor * 0.3 + uLampColor * 0.04;
  // Thin sheets of water are mostly transparent; they only catch light where it's bright
  float lum = clamp(dot(lightCol, vec3(0.3, 0.5, 0.2)), 0.0, 1.0);
  float a = mix(0.12, 0.7, smoothstep(0.35, 0.85, s)) * mix(0.35, 1.0, lum);
  vec3 col = mix(lightCol * 0.55, lightCol * 1.25 + 0.04, s);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

interface OutFlags {
  foliage?: boolean
  sway?: { start: number; amp: number; flutter?: number }
  macro?: number
  rake?: boolean
  glow?: boolean
}

interface Placement {
  x: number
  z: number
  s: number
  /** Extra height offset (negative sinks it) */
  y?: number
  rot?: number
  /** Non-uniform vertical scale factor */
  sy?: number
  tilt?: number
  tint?: THREE.ColorRepresentation
  /** Woodland outside the walls: drawn with cheaper geometry and thinned on lower tiers */
  far?: boolean
}

export class OutdoorWorld {
  readonly front = new THREE.Group()
  readonly back = new THREE.Group()
  /** Hills + sky: always present, they only fill pixels left empty */
  readonly far = new THREE.Group()
  readonly sky: THREE.Mesh
  /** 0 = night, 1 = full day */
  daylight = 1
  /** 0 = day, 1 = full night */
  night = 0

  private readonly u = {
    uTime: { value: 0 },
    uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
    uLightColor: { value: new THREE.Color() },
    uSkyLight: { value: new THREE.Color() },
    uGroundLight: { value: new THREE.Color() },
    uNight: { value: 0 },
    uSunUp: { value: 1 },
    uLampPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, -100, 0)) },
    uLampColor: { value: new THREE.Color() },
    uSpill: { value: new THREE.Color(0, 0, 0) },
    uRake: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, -10, 0)) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uCloudLit: { value: new THREE.Color() },
    uCloudShade: { value: new THREE.Color() },
    uCloudCover: { value: 0.45 },
    uFountain: { value: new THREE.Vector2(FOUNTAIN.x, FOUNTAIN.z) },
  }

  private readonly pbr: PbrTextureLibrary
  private tier: OutdoorTier
  private readonly detail: 'low' | 'high'
  private readonly antialias: boolean
  private readonly dojoX: number
  private readonly hourOverride: number | null
  private lastSkyUpdate = -Infinity
  private lampCount = 0
  private corridorSpill = 0
  private readonly shadowMaterials: THREE.MeshBasicMaterial[] = []
  /** Distant-forest instanced meshes with their full instance counts (thinned per tier) */
  private readonly farForest: Array<{ mesh: THREE.InstancedMesh; total: number }> = []
  private readonly fernMeshes: THREE.InstancedMesh[] = []
  private skyMaterial: THREE.ShaderMaterial | null = null
  /** Stand-in for the dojo interior, seen through its window from outside (see buildBuildingExterior) */
  dojoInteriorProxy: THREE.Mesh | null = null
  private readonly mats: ReturnType<OutdoorWorld['createMaterials']>
  private readonly treePlacements = {
    front: { maple: [] as Placement[], pine: [] as Placement[], bamboo: [] as Placement[] },
    back: { maple: [] as Placement[], pine: [] as Placement[], bamboo: [] as Placement[] },
  }
  private readonly rockPlacements = { front: [] as Placement[], back: [] as Placement[] }
  private readonly fernPlacements = { front: [] as Placement[], back: [] as Placement[] }
  private readonly shadowSpots = { front: [] as Placement[], back: [] as Placement[] }

  constructor(opts: OutdoorOptions) {
    this.pbr = opts.pbr
    this.tier = opts.tier
    this.detail = opts.tier === 'low' ? 'low' : 'high'
    this.antialias = opts.antialias
    this.dojoX = opts.dojoX
    this.front.name = 'outdoor-front'
    this.back.name = 'outdoor-back'
    this.far.name = 'outdoor-far'

    // ?ireHour=20.5 previews any time of day
    const param = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ireHour') : null
    const hour = param !== null ? Number(param) : NaN
    this.hourOverride = Number.isFinite(hour) ? ((hour % 24) + 24) % 24 : null

    this.mats = this.createMaterials()
    this.sky = this.buildSky()
    this.far.add(this.sky)
    this.buildHills()
    this.buildGround()
    this.buildGardenWalls()
    this.buildBuildingExterior()
    this.buildFrontGarden()
    this.buildBackGarden()
    this.buildForestBeyondWalls()
    this.buildTrees()
    this.buildShrubs()
    this.buildShadowBlobs()
    this.loadModels(opts.manager, opts.onModelsReady)
    this.setTier(this.tier)
    this.updateSky(true)
  }

  // =========================================================
  // Materials
  // =========================================================

  private patch<T extends THREE.Material>(mat: T, flags: OutFlags = {}): T {
    const u = this.u
    const defines: Record<string, string> = {}
    if (flags.foliage) defines.OUT_FOLIAGE = ''
    if (flags.macro) defines.OUT_MACRO = flags.macro.toFixed(3)
    if (flags.rake) defines.OUT_RAKE = ''
    if (flags.glow) defines.OUT_GLOW = ''
    ;(mat as any).defines = { ...((mat as any).defines ?? {}), ...defines }
    const sway = flags.sway
    // Lit by its own outdoor model, never by the indoor per-area lighting
    mat.userData.ireSkip = true
    mat.onBeforeCompile = (shader) => {
      for (const key of ['uTime', 'uLightDir', 'uLightColor', 'uSkyLight', 'uGroundLight', 'uNight', 'uLampPos', 'uLampColor', 'uSpill', 'uRake'] as const) {
        shader.uniforms[key] = u[key]
      }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${OUT_VERT_PARS}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${OUT_WORLD_POS}`)
      if (sway) shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', swayChunk(sway.start, sway.amp, sway.flutter ?? 0))
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${OUT_FRAG_PARS}`)
        .replace('#include <opaque_fragment>', OUT_LIGHTING)
    }
    const key = `outdoor-${JSON.stringify(flags)}`
    mat.customProgramCacheKey = () => key
    return mat
  }

  private lambert(params: THREE.MeshLambertMaterialParameters, flags: OutFlags = {}): THREE.MeshLambertMaterial {
    return this.patch(new THREE.MeshLambertMaterial(params), flags)
  }

  /** Outdoor Lambert material from a PBR scan (colour, normal and AO from the ARM map). */
  private scan(
    set: PbrSetName,
    repeat: [number, number],
    color: THREE.ColorRepresentation,
    flags: OutFlags = {},
    rotation = 0,
    reliefOnly = false
  ): THREE.MeshLambertMaterial {
    const maps = this.pbr.tiledMaps(set, repeat)
    for (const t of [maps.map, maps.normalMap, maps.armMap]) t.rotation = rotation
    return this.lambert({ map: reliefOnly ? null : maps.map, normalMap: maps.normalMap, aoMap: maps.armMap, color }, flags)
  }

  private createMaterials() {
    const season = seasonOf()
    const leafSize = this.tier === 'low' ? 256 : 512
    const cutout = (map: THREE.Texture, sway: OutFlags['sway']) => {
      map.anisotropy = 4
      return this.lambert(
        { map, alphaTest: 0.5, alphaToCoverage: this.antialias, side: THREE.DoubleSide },
        { foliage: true, sway }
      )
    }
    const culm = createCulmTexture()
    culm.anisotropy = 4
    const graniteTex = createGraniteTexture()
    graniteTex.anisotropy = 4
    const hedgeTex = createHedgeTexture()
    hedgeTex.repeat.set(4, 2)
    return {
      grass: this.scan('grass', [48 / 2.6, 38 / 2.6], '#b4cc98', { macro: 0.32 }),
      grassFar: this.scan('grass', [240 / 5, 240 / 5], '#9fb48a', { macro: 0.4 }),
      gravel: this.scan('gravel', [1, 1], '#e8e2d6'),
      karesansui: this.scan('gravel', [8.6 / 1.4, 4.9 / 1.4], '#f3efe6', { rake: true }),
      granite: this.scan('granite', [1, 1], '#b9b5ae'),
      carved: this.lambert({ map: graniteTex, color: '#d8d6d0' }),
      stoneWall: this.scan('stoneWall', [1, 1], '#c9c3b8'),
      // The clay scan is used for its relief only, under a lime-white colour (as indoors)
      plaster: this.scan('plaster', [1, 1], '#fbe9cf', {}, 0, true),
      plasterShape: this.scan('plaster', [1 / 1.2, 1 / 1.2], '#fbe9cf', {}, 0, true),
      deck: this.scan('cedar', [28.2 / 1.0, 1.45 / 1.0], '#8e7864', {}, Math.PI / 2),
      darkWood: this.scan('cedar', [1, 1], '#5a3b28'),
      eaveWood: this.scan('cedar', [29 / 0.9, 2.3 / 0.9], '#7a5640', {}, Math.PI / 2),
      tile: this.lambert({ color: '#3a3d42' }),
      bark: this.scan('bark', [1, 1], '#d2c8bc'),
      pineBark: this.scan('bark', [1, 1], '#b09888'),
      mapleLeaves: cutout(createMapleLeafTexture(season, leafSize), { start: 1.2, amp: 0.0035, flutter: 0.012 }),
      pineLeaves: cutout(createPineNeedleTexture(leafSize), { start: 1.5, amp: 0.0022, flutter: 0.006 }),
      bambooLeaves: cutout(createBambooLeafTexture(leafSize), { start: 0.5, amp: 0.0011, flutter: 0.02 }),
      culm: this.lambert({ map: culm }, { sway: { start: 0.5, amp: 0.0011 } }),
      hedge: this.lambert({ map: hedgeTex }),
      lanternGlow: this.lambert({ color: '#2a2622', emissive: '#ffb468', emissiveIntensity: 2.4 }, { glow: true }),
      pond: this.waterMaterial(),
      fall: this.fallMaterial(2.6),
      jet: this.fallMaterial(-3.5),
    }
  }

  private fogUniforms() {
    return THREE.UniformsUtils.clone(THREE.UniformsLib.fog)
  }

  private waterMaterial(): THREE.ShaderMaterial {
    const u = this.u
    return new THREE.ShaderMaterial({
      name: 'garden-water',
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      fog: true,
      uniforms: {
        ...this.fogUniforms(),
        uTime: u.uTime,
        uZenith: u.uZenith,
        uHorizon: u.uHorizon,
        uSunDir: u.uSunDir,
        uMoonDir: u.uMoonDir,
        uSunColor: u.uSunColor,
        uSkyLight: u.uSkyLight,
        uLightColor: u.uLightColor,
        uNight: u.uNight,
        uSunUp: u.uSunUp,
        uLampPos: u.uLampPos,
        uLampColor: u.uLampColor,
        uFountain: u.uFountain,
      },
    })
  }

  private fallMaterial(speed: number): THREE.ShaderMaterial {
    const u = this.u
    return new THREE.ShaderMaterial({
      name: 'garden-falling-water',
      vertexShader: FALL_VERT,
      fragmentShader: FALL_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: u.uTime,
        uSkyLight: u.uSkyLight,
        uLightColor: u.uLightColor,
        uLampColor: u.uLampColor,
        uSpeed: { value: speed },
      },
    })
  }

  // =========================================================
  // Sky, hills, ground
  // =========================================================

  private buildSky(): THREE.Mesh {
    const u = this.u
    const mat = new THREE.ShaderMaterial({
      name: 'sky-dome',
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      defines: OutdoorWorld.skyDefines(this.tier),
      uniforms: {
        uSunDir: u.uSunDir,
        uMoonDir: u.uMoonDir,
        uZenith: u.uZenith,
        uHorizon: u.uHorizon,
        uSunColor: u.uSunColor,
        uCloudLit: u.uCloudLit,
        uCloudShade: u.uCloudShade,
        uTime: u.uTime,
        uNight: u.uNight,
        uSunUp: u.uSunUp,
        uCloudCover: u.uCloudCover,
      },
    })
    this.skyMaterial = mat
    const sky = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat)
    sky.name = 'sky-dome'
    sky.frustumCulled = false
    // Drawn after every other opaque object so depth testing skips all covered pixels
    sky.renderOrder = 10000
    sky.onBeforeRender = (_r, _s, camera) => {
      sky.position.copy(camera.position)
      sky.updateMatrixWorld()
    }
    return sky
  }

  private buildHills() {
    const centre = new THREE.Vector2(0, 6)
    const autumn = seasonOf() === 'autumn'
    const rings = [
      { R: 74, lo: 7, hi: 18, haze: 0.18, seed: 1.3 },
      { R: 98, lo: 15, hi: 32, haze: 0.42, seed: 7.9 },
    ]
    const segs = this.tier === 'low' ? 128 : 256
    for (const ring of rings) {
      const positions: number[] = []
      const colors: number[] = []
      const indices: number[] = []
      const c = new THREE.Color()
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2
        const x = centre.x + Math.cos(a) * ring.R
        const z = centre.y + Math.sin(a) * ring.R
        const n = fbm2(Math.cos(a) * 2.2 + ring.seed, Math.sin(a) * 2.2 - ring.seed, 5)
        // Forest canopy breaks the ridge line into small bumps
        const canopy = vnoise(i * 0.9 + ring.seed, ring.seed) * 0.9
        const top = ring.lo + (ring.hi - ring.lo) * n + canopy
        positions.push(x, -2, z, x, top, z)
        const tone = vnoise(i * 0.15, ring.seed * 3)
        c.set('#2b4426').lerp(new THREE.Color(autumn ? '#7a4a26' : '#3f5a2c'), autumn ? tone * 0.6 : tone * 0.4)
        colors.push(c.r * 0.6, c.g * 0.6, c.b * 0.6, c.r, c.g, c.b)
        if (i < segs) {
          const k = i * 2
          indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
        }
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      g.setIndex(indices)
      g.computeBoundingSphere()
      const mat = new THREE.ShaderMaterial({
        name: 'distant-hills',
        vertexShader: HILL_VERT,
        fragmentShader: HILL_FRAG,
        fog: true,
        side: THREE.DoubleSide,
        uniforms: {
          ...this.fogUniforms(),
          uSkyLight: this.u.uSkyLight,
          uLightColor: this.u.uLightColor,
          uHorizon: this.u.uHorizon,
          uHaze: { value: ring.haze },
        },
      })
      const mesh = new THREE.Mesh(g, mat)
      mesh.renderOrder = 9000
      this.far.add(mesh)
    }
  }

  private buildGround() {
    // Fine mesh inside the garden walls, coarse one for the land beyond
    const seg = this.tier === 'low' ? 1.6 : 1.0
    const w = GARDEN.maxX - GARDEN.minX
    const d = GARDEN.maxZ - GARDEN.minZ
    const inner = new THREE.PlaneGeometry(w, d, Math.round(w / seg), Math.round(d / seg))
    inner.rotateX(-Math.PI / 2)
    inner.translate((GARDEN.minX + GARDEN.maxX) / 2, 0, (GARDEN.minZ + GARDEN.maxZ) / 2)
    this.displace(inner, (x, z) => groundHeight(x, z))
    // The garden ground is shared by both gardens; both groups get a copy so each can be hidden
    const frontGround = new THREE.Mesh(inner, this.mats.grass)
    const backGround = new THREE.Mesh(inner, this.mats.grass)
    this.front.add(frontGround)
    this.back.add(backGround)

    const outerSegs = this.tier === 'low' ? 48 : 80
    const outer = new THREE.PlaneGeometry(240, 240, outerSegs, outerSegs)
    outer.rotateX(-Math.PI / 2)
    outer.translate(0, 0, 6)
    this.displace(outer, (x, z) => {
      const inside = x > GARDEN.minX && x < GARDEN.maxX && z > GARDEN.minZ && z < GARDEN.maxZ
      return inside ? GROUND_Y - 0.12 : groundHeight(x, z)
    })
    this.far.add(new THREE.Mesh(outer, this.mats.grassFar))
  }

  private displace(g: THREE.BufferGeometry, height: (x: number, z: number) => number) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)))
    g.computeVertexNormals()
    g.computeBoundingSphere()
  }

  // =========================================================
  // Architecture: garden walls, building exterior, veranda, eaves
  // =========================================================

  private box(parent: THREE.Object3D, mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, uvTile = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d)
    if (uvTile > 0) projectWoodUVs(g, uvTile)
    const m = new THREE.Mesh(g, mat)
    m.position.set(x, y, z)
    m.rotation.y = rotY
    parent.add(m)
    return m
  }

  /** Tiled-cap garden wall (tsuiji-bei): dry-stone base, plaster body, dark tile cap. */
  private gardenWall(parent: THREE.Object3D, x0: number, z0: number, x1: number, z1: number) {
    const len = Math.hypot(x1 - x0, z1 - z0)
    const cx = (x0 + x1) / 2
    const cz = (z0 + z1) / 2
    const rot = -Math.atan2(z1 - z0, x1 - x0)
    const base = GROUND_Y - 0.1
    this.box(parent, this.mats.stoneWall, len, 0.95, 0.58, cx, base + 0.475, cz, 1.6, rot)
    this.box(parent, this.mats.plaster, len, 1.3, 0.42, cx, base + 0.95 + 0.65, cz, 1.2, rot)
    const top = base + 2.25
    this.box(parent, this.mats.darkWood, len, 0.08, 0.5, cx, top + 0.04, cz, 0.8, rot)
    this.box(parent, this.mats.tile, len + 0.1, 0.1, 0.74, cx, top + 0.13, cz, 0, rot)
    this.box(parent, this.mats.tile, len + 0.1, 0.14, 0.26, cx, top + 0.25, cz, 0, rot)
  }

  private buildGardenWalls() {
    const { minX, maxX, minZ, maxZ } = GARDEN
    const split = 3.88
    this.gardenWall(this.front, minX, maxZ, maxX, maxZ)
    this.gardenWall(this.front, minX, split, minX, maxZ)
    this.gardenWall(this.front, maxX, split, maxX, maxZ)
    this.gardenWall(this.back, minX, minZ, maxX, minZ)
    this.gardenWall(this.back, minX, minZ, minX, split)
    this.gardenWall(this.back, maxX, minZ, maxX, split)
  }

  /** A sloping eave: board soffit, exposed rafters and a fascia, from a wall line out to `depth`. */
  private eave(parent: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3, outward: THREE.Vector3, depth: number) {
    const along = end.clone().sub(start)
    const len = along.length()
    const a = start.clone().setY(3.98)
    const b = end.clone().setY(3.98)
    const drop = 0.13 * depth
    const c = end.clone().addScaledVector(outward, depth).setY(3.98 - drop)
    const d = start.clone().addScaledVector(outward, depth).setY(3.98 - drop)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, len / 29, 0, len / 29, depth / 2.3, 0, depth / 2.3], 2))
    // Wind the soffit so it faces down
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), d.clone().sub(a))
    g.setIndex(n.y < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2])
    g.computeVertexNormals()
    parent.add(new THREE.Mesh(g, this.mats.eaveWood))

    // Rafters every 45cm
    const count = Math.floor(len / 0.45)
    const rafter = new THREE.BoxGeometry(0.07, 0.1, depth + 0.1)
    projectWoodUVs(rafter, 0.8)
    const mesh = new THREE.InstancedMesh(rafter, this.mats.darkWood, count)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward.clone().setY(-drop / depth).normalize())
    const dir = along.clone().normalize()
    for (let i = 0; i < count; i++) {
      const p = start.clone().addScaledVector(dir, (i + 0.5) * (len / count)).addScaledVector(outward, depth / 2)
      p.y = 3.98 - drop / 2 - 0.06
      m.compose(p, q, new THREE.Vector3(1, 1, 1))
      mesh.setMatrixAt(i, m)
    }
    mesh.computeBoundingSphere()
    parent.add(mesh)

    // Fascia board along the eave edge
    const fasciaCentre = start.clone().add(end).multiplyScalar(0.5).addScaledVector(outward, depth + 0.03)
    this.box(parent, this.mats.darkWood, len + 0.1, 0.24, 0.06, fasciaCentre.x, 3.98 - drop - 0.04, fasciaCentre.z, 0.8, -Math.atan2(dir.z, dir.x))
  }

  /** Plaster wall plane facing out of the building, with an optional window hole (world XY coords). */
  private exteriorWall(parent: THREE.Object3D, x0: number, x1: number, z: number, hole?: [number, number, number, number]) {
    const shape = new THREE.Shape()
    shape.moveTo(x0, GROUND_Y - 0.05)
    shape.lineTo(x1, GROUND_Y - 0.05)
    shape.lineTo(x1, 4.0)
    shape.lineTo(x0, 4.0)
    shape.lineTo(x0, GROUND_Y - 0.05)
    if (hole) {
      const [hx0, hx1, hy0, hy1] = hole
      const path = new THREE.Path()
      path.moveTo(hx0, hy0)
      path.lineTo(hx0, hy1)
      path.lineTo(hx1, hy1)
      path.lineTo(hx1, hy0)
      path.lineTo(hx0, hy0)
      shape.holes.push(path)
    }
    const g = new THREE.ShapeGeometry(shape)
    // ShapeGeometry faces +Z; reverse the winding so the wall faces -Z (out to the courtyard)
    const index = g.getIndex()!
    for (let i = 0; i < index.count; i += 3) {
      const t = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, t)
    }
    g.translate(0, 0, z)
    g.computeVertexNormals()
    // UVs straight from the world XY position, in metres
    const pos = g.getAttribute('position') as THREE.BufferAttribute
    const uv = g.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getY(i))
    parent.add(new THREE.Mesh(g, this.mats.plasterShape))
    // Granite plinth along the foot
    this.box(parent, this.mats.carved, Math.abs(x1 - x0), 0.42, 0.12, (x0 + x1) / 2, GROUND_Y + 0.13, z - 0.04, 0.7)
  }

  private buildBuildingExterior() {
    const back = this.back
    const dojoHole: [number, number, number, number] = [this.dojoX - 1.45, this.dojoX + 1.45, 0.45, 2.21]
    // Room back walls (z = -0.3) and the study's back wall (z = -3.1), seen from the courtyard
    this.exteriorWall(back, -14.06, -3.06, -0.36, dojoHole)
    // The dojo's interior isn't drawn while you're elsewhere, so from outside its window would look
    // straight through an empty shell. This dim stand-in room (inside faces only, unlit) fills it;
    // the room service shows it exactly when the real interior is hidden.
    const shell = new THREE.BoxGeometry(4.98, 3.88, 4.14)
    const wallTone = new THREE.MeshBasicMaterial({ color: '#4a3d31', side: THREE.BackSide, name: 'dojo-proxy-wall' })
    const proxyMaterials = [
      wallTone,
      wallTone,
      new THREE.MeshBasicMaterial({ color: '#2e241c', side: THREE.BackSide, name: 'dojo-proxy-ceiling' }),
      new THREE.MeshBasicMaterial({ color: '#6b5a3c', side: THREE.BackSide, name: 'dojo-proxy-floor' }),
      wallTone,
      wallTone,
    ]
    this.dojoInteriorProxy = new THREE.Mesh(shell, proxyMaterials)
    this.dojoInteriorProxy.position.set(this.dojoX, 1.95, 1.79)
    back.add(this.dojoInteriorProxy)
    this.exteriorWall(back, 3.06, 14.06, -0.36)
    this.exteriorWall(back, -3.06, 3.06, -3.16)
    // The study's left wall below and beside its window is built with the study (both faces)
    this.box(back, this.mats.carved, 0.12, 0.42, 2.9, -3.1, GROUND_Y + 0.13, -1.7, 0.7)

    // The building's two end walls (rooms + corridor, z -0.36..7.36): without them the far ends of
    // the courtyard looked straight into the open side of the building
    for (const side of [-1, 1]) {
      // 2cm proud of the corridor end walls' outer faces (x = ±14.06) so the two never z-fight
      const x = side * 14.08
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(7.72, 4.0 - (GROUND_Y - 0.05)), this.mats.plasterShape)
      const uv = wall.geometry.getAttribute('uv') as THREE.BufferAttribute
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7.72, uv.getY(i) * 4.35)
      wall.rotation.y = side * Math.PI / 2
      wall.position.set(x, (4.0 + GROUND_Y - 0.05) / 2, 3.5)
      back.add(wall)
      this.box(back, this.mats.carved, 0.12, 0.42, 7.72, x + side * 0.04, GROUND_Y + 0.13, 3.5, 0.7)
      this.eave(back, new THREE.Vector3(x, 0, -1.51), new THREE.Vector3(x, 0, 7.36), new THREE.Vector3(side, 0, 0), 1.15)
    }

    // Eaves around the courtyard side of the building
    this.eave(back, new THREE.Vector3(-14.1, 0, -0.36), new THREE.Vector3(-3.06, 0, -0.36), new THREE.Vector3(0, 0, -1), 1.15)
    this.eave(back, new THREE.Vector3(-3.06, 0, -3.16), new THREE.Vector3(-3.06, 0, -1.51), new THREE.Vector3(-1, 0, 0), 1.15)
    this.eave(back, new THREE.Vector3(-4.21, 0, -3.16), new THREE.Vector3(3.1, 0, -3.16), new THREE.Vector3(0, 0, -1), 1.15)
    this.eave(back, new THREE.Vector3(3.06, 0, -0.36), new THREE.Vector3(14.1, 0, -0.36), new THREE.Vector3(0, 0, -1), 1.15)

    // Front veranda (engawa) outside the corridor's glass doors, under a deep eave on posts
    const front = this.front
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(28.2, 1.45), this.mats.deck)
    deck.rotation.x = -Math.PI / 2
    deck.position.set(0, -0.035, 8.025)
    front.add(deck)
    this.box(front, this.mats.darkWood, 28.2, 0.3, 0.06, 0, -0.19, 8.76, 0.8)
    // Closed ends: deck end boards and a barge board under each end of the veranda eave
    for (const side of [-1, 1]) {
      this.box(front, this.mats.darkWood, 0.06, 0.3, 1.46, side * 14.1, -0.19, 8.03, 0.8)
      const barge = this.box(front, this.mats.darkWood, 0.06, 0.3, 2.2, side * 14.42, 3.98 - 0.137 - 0.08, 8.41, 0.8)
      barge.rotation.x = Math.atan2(0.273, 2.1)
    }
    this.box(front, this.mats.granite, 28.6, 0.36, 0.5, 0, GROUND_Y - 0.06, 8.45, 0.8)
    for (let x = -14; x <= 14.01; x += 3.5) this.box(front, this.mats.darkWood, 0.13, 3.62, 0.13, x, 1.775, 8.62, 0.6)
    this.box(front, this.mats.darkWood, 28.6, 0.2, 0.15, 0, 3.66, 8.62, 0.8)
    this.eave(front, new THREE.Vector3(-14.4, 0, 7.36), new THREE.Vector3(14.4, 0, 7.36), new THREE.Vector3(0, 0, 1), 2.1)
    // Shoe stone (kutsunugi-ishi) at the foot of the veranda
    this.box(front, this.mats.carved, 0.95, 0.22, 0.55, 0, GROUND_Y + 0.08, 9.1, 0.7)

    // Drip-line gravel band under the eave edge, with granite curbs
    const band = new THREE.Mesh(new THREE.PlaneGeometry(28.6, 0.9), this.gravelOf(28.6, 0.9))
    band.rotation.x = -Math.PI / 2
    band.position.set(0, GROUND_Y + 0.012, 9.2 + 0.45)
    front.add(band)
    this.box(front, this.mats.granite, 28.7, 0.1, 0.1, 0, GROUND_Y + 0.03, 10.15, 0.7)
  }

  private gravelOf(w: number, d: number): THREE.MeshLambertMaterial {
    const mat = this.mats.gravel.clone()
    for (const key of ['map', 'normalMap', 'aoMap'] as const) {
      const t = (mat[key] as THREE.Texture).clone()
      t.repeat.set(w / 1.3, d / 1.3)
      mat[key] = t
    }
    mat.onBeforeCompile = this.mats.gravel.onBeforeCompile
    mat.customProgramCacheKey = this.mats.gravel.customProgramCacheKey
    return mat
  }

  // =========================================================
  // Front garden: pond, fountain, lanterns, stepping stones
  // =========================================================

  private stoneLantern(parent: THREE.Object3D, style: 'kasuga' | 'yukimi', x: number, z: number, rot = 0) {
    const g = new THREE.Group()
    const s = this.mats.carved
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, px = 0, pz = 0) => {
      projectWoodUVs(geo, 0.6)
      const m = new THREE.Mesh(geo, mat)
      m.position.set(px, y, pz)
      g.add(m)
    }
    let fire = 0
    if (style === 'kasuga') {
      add(new THREE.CylinderGeometry(0.36, 0.42, 0.18, 6), s, 0.09)
      add(new THREE.CylinderGeometry(0.12, 0.15, 0.82, 12), s, 0.59)
      add(new THREE.CylinderGeometry(0.32, 0.2, 0.17, 6), s, 1.085)
      fire = 1.34
      add(new THREE.CylinderGeometry(0.19, 0.19, 0.32, 6), this.mats.lanternGlow, fire)
      add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 6), s, fire - 0.17)
      add(new THREE.CylinderGeometry(0.25, 0.25, 0.04, 6), s, fire + 0.17)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        add(new THREE.BoxGeometry(0.055, 0.32, 0.055), s, fire, Math.sin(a) * 0.215, Math.cos(a) * 0.215)
      }
      add(new THREE.CylinderGeometry(0.5, 0.5, 0.035, 6), s, fire + 0.205)
      add(new THREE.CylinderGeometry(0.07, 0.48, 0.24, 6), s, fire + 0.34)
      add(new THREE.SphereGeometry(0.09, 12, 8), s, fire + 0.52)
      add(new THREE.ConeGeometry(0.05, 0.1, 10), s, fire + 0.63)
    } else {
      // Snow-viewing lantern: three splayed legs, low firebox and a broad umbrella roof
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + rot
        const leg = new THREE.BoxGeometry(0.1, 0.55, 0.12)
        leg.rotateZ(0.32)
        leg.rotateY(-a)
        add(leg, s, 0.26, Math.cos(a) * 0.3, Math.sin(a) * 0.3)
      }
      add(new THREE.CylinderGeometry(0.34, 0.3, 0.1, 6), s, 0.55)
      fire = 0.74
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 6), this.mats.lanternGlow, fire)
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2
        add(new THREE.BoxGeometry(0.05, 0.26, 0.05), s, fire, Math.sin(a) * 0.19, Math.cos(a) * 0.19)
      }
      add(new THREE.CylinderGeometry(0.62, 0.62, 0.035, 6), s, fire + 0.16)
      add(new THREE.CylinderGeometry(0.09, 0.6, 0.2, 6), s, fire + 0.27)
      add(new THREE.SphereGeometry(0.085, 12, 8), s, fire + 0.43)
    }
    g.position.set(x, groundHeight(x, z) - 0.02, z)
    g.rotation.y = rot
    parent.add(g)
    if (this.lampCount < 4) this.u.uLampPos.value[this.lampCount++]!.set(x, g.position.y + fire, z)
    this.fernPlacements[parent === this.front ? 'front' : 'back'].push(
      { x: x + 0.55, z: z + 0.25, s: 0.9, rot: 1 },
      { x: x - 0.45, z: z + 0.45, s: 0.75, rot: 4 }
    )
  }

  private pondOutline(): THREE.Vector2[] {
    const pts: THREE.Vector2[] = []
    const n = 48
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const wobble = 1 + (vnoise(Math.cos(a) * 1.6 + 4, Math.sin(a) * 1.6 + 2) - 0.5) * 0.28
      pts.push(new THREE.Vector2(POND.x + Math.cos(a) * POND.rx * wobble, POND.z + Math.sin(a) * POND.rz * wobble))
    }
    return pts
  }

  private buildPond() {
    const outline = this.pondOutline()
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.y)))
    const g = new THREE.ShapeGeometry(shape, 4)
    g.rotateX(-Math.PI / 2)
    g.translate(0, WATER_Y, 0)
    const water = new THREE.Mesh(g, this.mats.pond)
    this.front.add(water)

    // Rocks set along the bank, larger ones every few metres
    const r = rng(41)
    const step = this.tier === 'low' ? 3 : 2
    outline.forEach((p, i) => {
      if (i % step !== 0) return
      const big = i % 6 === 0
      this.rockPlacements.front.push({ x: p.x, z: p.y, s: big ? 2.6 + r() * 0.8 : 1.4 + r() * 0.8, y: -0.06, rot: r() * 6.28, sy: 0.6 + r() * 0.3, tilt: (r() - 0.5) * 0.3 })
    })
  }

  private buildFountain() {
    const g = new THREE.Group()
    const s = this.mats.carved
    const profile: Array<[number, number]> = [
      [0, -0.35], [1.35, -0.35], [1.35, 0.3], [1.42, 0.34], [1.42, 0.4], [1.24, 0.4], [1.22, 0.3], [0.22, 0.3],
      [0.24, 0.36], [0.16, 0.5], [0.16, 0.8], [0.22, 0.88], [0.16, 0.98], [0.17, 1.04],
      [0.4, 1.12], [0.62, 1.26], [0.66, 1.32], [0.6, 1.34], [0.56, 1.26], [0.3, 1.22], [0.1, 1.24],
      [0.07, 1.3], [0.08, 1.36], [0.04, 1.42], [0, 1.43],
    ]
    const stone = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), this.tier === 'low' ? 24 : 40)
    const uv = stone.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 3)
    g.add(new THREE.Mesh(stone, s))

    const disc = (radius: number, y: number) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 32), this.mats.pond)
      m.rotation.x = -Math.PI / 2
      m.position.y = y
      g.add(m)
    }
    disc(1.23, 0.355)
    disc(0.575, 1.27)

    const sheet = (pts: Array<[number, number]>, mat: THREE.Material) => {
      const lathe = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), this.tier === 'low' ? 24 : 40)
      const m = new THREE.Mesh(lathe, mat)
      m.renderOrder = 3
      g.add(m)
    }
    // Overflow curtains from the upper bowl and the basin rim, and a bubbling jet on top
    sheet([[0.665, 1.32], [0.69, 1.25], [0.72, 1.1], [0.76, 0.8], [0.8, 0.55], [0.83, 0.36]], this.mats.fall)
    sheet([[1.435, 0.4], [1.46, 0.3], [1.5, 0.15], [1.53, 0.05], [1.55, 0.0]], this.mats.fall)
    sheet([[0.0, 1.4], [0.05, 1.46], [0.045, 1.62], [0.03, 1.74], [0.0, 1.78]], this.mats.jet)
    sheet([[0.02, 1.76], [0.14, 1.72], [0.28, 1.62], [0.4, 1.46], [0.5, 1.3]], this.mats.fall)

    g.position.set(FOUNTAIN.x, WATER_Y, FOUNTAIN.z)
    this.front.add(g)
  }

  private steppingStones(parent: THREE.Object3D, path: Array<[number, number]>) {
    const geo = new THREE.CylinderGeometry(0.3, 0.34, 0.14, 11)
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const a = Math.atan2(z, x)
      const f = 1 + (vnoise(Math.cos(a) * 1.5 + 2, Math.sin(a) * 1.5) - 0.5) * 0.35
      pos.setX(i, x * f)
      pos.setZ(i, z * f)
    }
    geo.computeVertexNormals()
    projectWoodUVs(geo, 0.7)
    const mesh = new THREE.InstancedMesh(geo, this.mats.carved, path.length)
    const r = rng(path.length * 13)
    const m = new THREE.Matrix4()
    path.forEach(([x, z], i) => {
      const s = 0.9 + r() * 0.35
      m.compose(
        new THREE.Vector3(x, groundHeight(x, z) + 0.02, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)),
        new THREE.Vector3(s * (0.9 + r() * 0.3), 1, s)
      )
      mesh.setMatrixAt(i, m)
    })
    mesh.computeBoundingSphere()
    parent.add(mesh)
  }

  private buildFrontGarden() {
    this.buildPond()
    this.buildFountain()
    this.stoneLantern(this.front, 'yukimi', -3.8, 13.3, 0.4)
    this.stoneLantern(this.front, 'kasuga', 9.9, 12.9, 0.3)
    this.steppingStones(this.front, [
      [0.2, 10.6], [0.5, 11.3], [-0.5, 11.6], [-1.5, 11.85], [-2.5, 12.25],
      [1.4, 11.2], [2.4, 11.0], [3.4, 11.1], [4.4, 11.35], [5.3, 11.8],
    ])

    const t = this.treePlacements.front
    t.maple.push(
      { x: -7.2, z: 11.6, s: 1.0 }, { x: 11.6, z: 10.9, s: 0.9 }, { x: -12.5, z: 17.5, s: 1.15 }, { x: 15.5, z: 18.0, s: 1.05 },
      { x: -1.0, z: 21.6, s: 0.95 }, { x: 7.0, z: 22.0, s: 1.1 }, { x: 19.2, z: 13.6, s: 0.95 }, { x: -18.6, z: 14.2, s: 1.0 }
    )
    t.pine.push({ x: -5.4, z: 17.9, s: 1.0 }, { x: 16.8, z: 11.0, s: 0.9 }, { x: -16.4, z: 10.8, s: 0.95 }, { x: 11.6, z: 21.8, s: 1.0 })
    for (const z of [10.2, 14.4, 18.6, 22.6]) {
      t.bamboo.push({ x: -21.8 + Math.sin(z) * 0.4, z, s: 1 }, { x: 21.8 + Math.cos(z) * 0.4, z: z + 0.6, s: 1 })
    }

    const rocks = this.rockPlacements.front
    rocks.push(
      { x: -5.8, z: 14.7, s: 5.0, y: -0.12, rot: 0.4 }, { x: 8.7, z: 15.7, s: 4.2, y: -0.1, rot: 2.1 },
      { x: 0.3, z: 19.5, s: 3.6, y: -0.08, rot: 1.2 }, { x: 12.6, z: 12.4, s: 3.0, y: -0.08, rot: 3.3 },
      { x: -9.6, z: 12.9, s: 2.6, y: -0.06, rot: 5.1 }
    )
    const ferns = this.fernPlacements.front
    for (const rock of rocks.slice(-5)) {
      ferns.push({ x: rock.x + 0.8, z: rock.z + 0.3, s: 1.0, rot: rock.x }, { x: rock.x - 0.6, z: rock.z - 0.55, s: 0.85, rot: rock.z })
    }
  }

  // =========================================================
  // Back courtyard: karesansui
  // =========================================================

  private buildBackGarden() {
    const k = KARESANSUI
    const w = k.maxX - k.minX
    const d = k.maxZ - k.minZ
    const gravel = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mats.karesansui)
    gravel.rotation.x = -Math.PI / 2
    gravel.position.set((k.minX + k.maxX) / 2, GROUND_Y + 0.02, (k.minZ + k.maxZ) / 2)
    this.back.add(gravel)
    // Granite curbs
    this.box(this.back, this.mats.granite, w + 0.16, 0.12, 0.08, (k.minX + k.maxX) / 2, GROUND_Y + 0.04, k.minZ - 0.04, 0.7)
    this.box(this.back, this.mats.granite, w + 0.16, 0.12, 0.08, (k.minX + k.maxX) / 2, GROUND_Y + 0.04, k.maxZ + 0.04, 0.7)
    this.box(this.back, this.mats.granite, 0.08, 0.12, d, k.minX - 0.04, GROUND_Y + 0.04, (k.minZ + k.maxZ) / 2, 0.7)
    this.box(this.back, this.mats.granite, 0.08, 0.12, d, k.maxX + 0.04, GROUND_Y + 0.04, (k.minZ + k.maxZ) / 2, 0.7)

    // Rock groups with raked rings (rock model is ~0.26 m across at scale 1)
    const rakeRocks: Array<[number, number, number]> = [
      [-6.3, -2.9, 5.2], [-4.6, -4.5, 3.4], [-9.1, -3.3, 4.2], [-10.9, -1.7, 2.8],
    ]
    rakeRocks.forEach(([x, z, s], i) => {
      this.rockPlacements.back.push({ x, z, s, y: -0.06, rot: i * 1.9, sy: 0.85 })
      this.u.uRake.value[i]!.set(x, z, 0.14 * s, 0)
    })

    this.stoneLantern(this.back, 'kasuga', -4.3, -6.5, 0.2)
    const t = this.treePlacements.back
    t.maple.push({ x: -8.2, z: -7.9, s: 1.05 }, { x: -14.6, z: -3.6, s: 1.0 }, { x: 1.2, z: -6.7, s: 0.9 }, { x: -17.2, z: -8.6, s: 1.1 })
    t.pine.push({ x: -11.7, z: -8.8, s: 0.95 }, { x: 5.6, z: -8.9, s: 1.0 }, { x: -1.9, z: -9.7, s: 0.9 })
    for (let x = -22; x <= 8; x += this.tier === 'low' ? 5 : 3.4) t.bamboo.push({ x, z: -11.5 + Math.sin(x) * 0.4, s: 1 })
    this.fernPlacements.back.push({ x: -2.6, z: -5.2, s: 1.0, rot: 0.3 }, { x: -12.8, z: -6.0, s: 0.9, rot: 2 }, { x: -13.0, z: -1.0, s: 0.8, rot: 4 })
  }

  /** Mixed woodland on the slopes outside the walls (instances of the garden species). */
  private buildForestBeyondWalls() {
    const r = rng(97)
    const count = 48
    for (let i = 0; i < count; i++) {
      let x = 0
      let z = 0
      const band = r()
      if (band < 0.5) {
        x = -46 + r() * 92
        z = 27.5 + r() * 10
      } else if (band < 0.8) {
        x = -46 + r() * 92
        z = -15.5 - r() * 9
      } else {
        x = (r() < 0.5 ? -1 : 1) * (26.5 + r() * 9)
        z = -13 + r() * 38
      }
      const kind = r()
      const side = z > 3.88 ? 'front' : 'back'
      const p: Placement = { x, z, s: 1.25 + r() * 0.6, far: true }
      if (kind < 0.4) this.treePlacements[side].pine.push(p)
      else if (kind < 0.8) this.treePlacements[side].maple.push(p)
      else this.treePlacements[side].bamboo.push({ ...p, s: 1.1 })
    }
  }

  // =========================================================
  // Instanced vegetation, rocks and ferns
  // =========================================================

  private instances(geo: THREE.BufferGeometry, mat: THREE.Material, items: Placement[], parent: THREE.Object3D, tints?: THREE.ColorRepresentation[]) {
    if (items.length === 0) return null
    const mesh = new THREE.InstancedMesh(geo, mat, items.length)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const r = rng(items.length * 31 + 7)
    items.forEach((it, i) => {
      e.set(it.tilt ?? 0, it.rot ?? r() * Math.PI * 2, (it.tilt ?? 0) * 0.5)
      q.setFromEuler(e)
      m.compose(
        new THREE.Vector3(it.x, groundHeight(it.x, it.z) + (it.y ?? 0), it.z),
        q,
        new THREE.Vector3(it.s, it.s * (it.sy ?? 1), it.s)
      )
      mesh.setMatrixAt(i, m)
      if (tints) mesh.setColorAt(i, new THREE.Color(tints[i % tints.length]!))
    })
    mesh.computeBoundingSphere()
    parent.add(mesh)
    return mesh
  }

  private buildTrees() {
    const variants = this.tier === 'low' ? 1 : 2
    const species: Array<{
      key: 'maple' | 'pine' | 'bamboo'
      build: (seed: number, detail: 'low' | 'high') => TreeGeometry
      wood: THREE.Material
      leaves: THREE.Material
      tints: string[]
    }> = [
      { key: 'maple', build: buildMaple, wood: this.mats.bark, leaves: this.mats.mapleLeaves, tints: ['#ffffff', '#f2d8b0', '#ffc8b8', '#e8e0c8'] },
      { key: 'pine', build: buildPine, wood: this.mats.pineBark, leaves: this.mats.pineLeaves, tints: ['#ffffff', '#e4ecd8', '#d8e0d0'] },
      { key: 'bamboo', build: buildBambooClump, wood: this.mats.culm, leaves: this.mats.bambooLeaves, tints: ['#ffffff', '#eef2d8'] },
    ]
    for (const sp of species) {
      const geos = Array.from({ length: variants }, (_, v) => sp.build(101 + v * 57 + sp.key.length, this.detail))
      // Trees beyond the garden wall are 30-50 m away: the low-detail build is indistinguishable there
      const farGeo = this.detail === 'low' ? geos[0]! : sp.build(301 + sp.key.length, 'low')
      for (const side of ['front', 'back'] as const) {
        const near = this.treePlacements[side][sp.key].filter((it) => !it.far)
        const far = this.treePlacements[side][sp.key].filter((it) => it.far)
        for (let v = 0; v < variants; v++) {
          const subset = near.filter((_, i) => i % variants === v)
          const geo = geos[v]!
          this.instances(geo.wood, sp.wood, subset, this[side])
          this.instances(geo.leaves, sp.leaves, subset, this[side], sp.tints)
          for (const it of subset) this.shadowSpots[side].push({ x: it.x, z: it.z, s: sp.key === 'bamboo' ? 2.2 : 4.2 * it.s })
        }
        for (const [g, mat, tints] of [[farGeo.wood, sp.wood, undefined], [farGeo.leaves, sp.leaves, sp.tints]] as const) {
          const mesh = this.instances(g, mat, far, this[side], tints ? [...tints] : undefined)
          if (mesh) this.farForest.push({ mesh, total: far.length })
        }
      }
    }
  }

  private buildShrubs() {
    const geo = buildShrub(5, this.detail)
    const front: Placement[] = [
      { x: -1.8, z: 10.5, s: 1.1 }, { x: 3.9, z: 10.2, s: 0.9 }, { x: -4.6, z: 10.5, s: 1.3 }, { x: 7.3, z: 11.7, s: 1.2 },
      { x: -7.6, z: 15.8, s: 1.0 }, { x: 9.8, z: 17.0, s: 1.1 }, { x: 5.4, z: 19.4, s: 0.9 }, { x: -2.6, z: 19.1, s: 1.0 },
      { x: 13.8, z: 14.6, s: 1.2 }, { x: -11.2, z: 13.6, s: 1.1 }, { x: 4.6, z: 12.4, s: 0.7 },
    ]
    const step = this.tier === 'low' ? 2.4 : 1.5
    for (let x = -19; x <= 19; x += step) front.push({ x, z: 23.9, s: 1.5, sy: 0.85 })
    const back: Placement[] = [
      { x: -2.5, z: -5.0, s: 0.9 }, { x: -13.3, z: -5.4, s: 1.1 }, { x: -13.4, z: -1.3, s: 0.9 },
    ]
    for (let x = -11.6; x <= -6; x += 1.25) back.push({ x, z: -6.35, s: 1.15, sy: 0.75 })
    const tints = ['#ffffff', '#e2ebd2', '#f4f8e6', '#d6e2c8']
    this.instances(geo, this.mats.hedge, front, this.front, tints)
    this.instances(geo, this.mats.hedge, back, this.back, tints)
    for (const s of front) this.shadowSpots.front.push({ x: s.x, z: s.z, s: 1.4 * s.s })
    for (const s of back) this.shadowSpots.back.push({ x: s.x, z: s.z, s: 1.4 * s.s })
  }

  /** Soft dark blobs under trees and shrubs (the garden has no real-time shadows). */
  private buildShadowBlobs() {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.5, 'rgba(0,0,0,0.55)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    for (const side of ['front', 'back'] as const) {
      const spots = this.shadowSpots[side]
      if (spots.length === 0) continue
      const geos = spots.map((s) => {
        const g = new THREE.PlaneGeometry(s.s, s.s)
        g.rotateX(-Math.PI / 2)
        g.translate(s.x, groundHeight(s.x, s.z) + 0.03, s.z)
        return g
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) continue
      const mat = new THREE.MeshBasicMaterial({
        name: `garden-shade-${side}`,
        map: tex,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      })
      this.shadowMaterials.push(mat)
      const mesh = new THREE.Mesh(merged, mat)
      mesh.renderOrder = 1
      this[side].add(mesh)
    }
  }

  private loadModels(manager: THREE.LoadingManager, onReady?: () => void) {
    const loader = new GLTFLoader(manager)
    const flatten = (scene: THREE.Object3D) => {
      scene.updateMatrixWorld(true)
      const geos: THREE.BufferGeometry[] = []
      let source: THREE.MeshStandardMaterial | null = null
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
        for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key)
        geos.push(g)
        source ??= mesh.material as THREE.MeshStandardMaterial
      })
      const merged = mergeGeometries(geos, false)
      geos.forEach((g) => g.dispose())
      if (!merged) return null
      merged.computeBoundingBox()
      const box = merged.boundingBox!
      merged.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
      return { geometry: merged, source: source as THREE.MeshStandardMaterial | null }
    }

    const rocksReady = loader.loadAsync('/models/garden/moon_rock_02/model.gltf').then((gltf) => {
      const flat = flatten(gltf.scene)
      if (!flat) return
      const mat = this.lambert({
        map: flat.source?.map ?? null,
        normalMap: flat.source?.normalMap ?? null,
        normalScale: flat.source?.normalScale,
        color: new THREE.Color(1.1, 1.06, 1.02),
      })
      this.instances(flat.geometry, mat, this.rockPlacements.front, this.front)
      this.instances(flat.geometry, mat, this.rockPlacements.back, this.back)
    })
    const fernsReady = loader.loadAsync('/models/garden/fern_02/model.gltf').then((gltf) => {
      const flat = flatten(gltf.scene)
      if (!flat) return
      // Normalise to ~0.6 m tall
      const h = flat.geometry.boundingBox!.max.y - flat.geometry.boundingBox!.min.y
      flat.geometry.scale(0.6 / h, 0.6 / h, 0.6 / h)
      const map = flat.source?.map ?? null
      const mat = this.lambert(
        { map, alphaTest: 0.5, alphaToCoverage: this.antialias, side: THREE.DoubleSide, color: '#e6eed8' },
        { foliage: true, sway: { start: 0.05, amp: 0.05, flutter: 0.008 } }
      )
      for (const side of ['front', 'back'] as const) {
        const mesh = this.instances(flat.geometry, mat, this.fernPlacements[side], this[side])
        if (mesh) this.fernMeshes.push(mesh)
      }
      this.setTier(this.tier)
    })
    void Promise.allSettled([rocksReady, fernsReady]).then((results) => {
      for (const r of results) if (r.status === 'rejected') console.warn('[OutdoorWorld] garden model unavailable:', r.reason)
      onReady?.()
    })
  }

  // =========================================================
  // Time of day
  // =========================================================

  private static skyDefines(tier: OutdoorTier): Record<string, number | string> {
    if (tier === 'low') return { SKY_OCTAVES: 3, SKY_CHEAP: '' }
    return { SKY_OCTAVES: tier === 'medium' ? 4 : 5 }
  }

  /**
   * Runtime detail scaling, called when the adaptive quality engine changes tier: thins the distant
   * woodland, drops the fern scans and simplifies the cloud shader (one recompile of the sky).
   */
  setTier(tier: OutdoorTier) {
    const changed = tier !== this.tier
    this.tier = tier
    const share = tier === 'low' ? 0.4 : tier === 'medium' ? 0.7 : 1
    for (const { mesh, total } of this.farForest) mesh.count = Math.max(1, Math.round(total * share))
    for (const fern of this.fernMeshes) fern.visible = tier !== 'low'
    if (changed && this.skyMaterial) {
      this.skyMaterial.defines = OutdoorWorld.skyDefines(tier)
      this.skyMaterial.needsUpdate = true
    }
  }

  /** Warm light from the corridor spilling onto the veranda at night (0 = corridor lights off). */
  setCorridorSpill(level: number) {
    this.corridorSpill = level
    this.applySpill()
  }

  private applySpill() {
    this.u.uSpill.value.set('#ffcf8f').multiplyScalar(this.corridorSpill * (0.12 + 0.6 * this.night))
  }

  private updateSky(force = false, scene?: THREE.Scene) {
    const now = new Date()
    const hour = this.hourOverride ?? now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
    const t = (hour - 6) / 12
    const el = Math.sin(t * Math.PI) * 62
    const az = t * Math.PI
    const elR = el * DEG
    const sun = this.u.uSunDir.value.set(Math.cos(az) * Math.cos(elR), Math.sin(elR), Math.sin(az) * Math.cos(elR))
    const mEl = Math.min(38, -el * 0.62) * DEG
    const moon = this.u.uMoonDir.value.set(-Math.cos(az) * Math.cos(mEl), Math.sin(mEl), -Math.sin(az) * Math.cos(mEl)).normalize()

    let i = 0
    while (i < SKY_KEYS.length - 2 && el > SKY_KEYS[i + 1]!.el) i++
    const a = SKY_KEYS[i]!
    const b = SKY_KEYS[i + 1]!
    const f = Math.min(1, Math.max(0, (el - a.el) / (b.el - a.el)))
    const mix = (ca: string, cb: string, out: THREE.Color, scale = 1) => out.set(ca).lerp(new THREE.Color(cb), f).multiplyScalar(scale)
    const u = this.u
    mix(a.zenith, b.zenith, u.uZenith.value)
    mix(a.horizon, b.horizon, u.uHorizon.value)
    mix(a.light, b.light, u.uLightColor.value, a.lightI + (b.lightI - a.lightI) * f)
    mix(a.sky, b.sky, u.uSkyLight.value, a.skyI + (b.skyI - a.skyI) * f)
    mix(a.ground, b.ground, u.uGroundLight.value, a.groundI + (b.groundI - a.groundI) * f)
    mix(a.cloudLit, b.cloudLit, u.uCloudLit.value)
    mix(a.cloudShade, b.cloudShade, u.uCloudShade.value)
    mix(a.light, b.light, u.uSunColor.value)

    // Sun lights the garden from dawn to dusk, the moon at night (switching while both are faint)
    if (el > -4) u.uLightDir.value.set(sun.x, Math.max(sun.y, Math.sin(5 * DEG)), sun.z).normalize()
    else u.uLightDir.value.copy(moon)

    this.daylight = smooth(-4, 10, el)
    this.night = 1 - smooth(-10, 1, el)
    u.uNight.value = this.night
    u.uSunUp.value = smooth(-3, 1, el)
    u.uLampColor.value.set('#ffb35c').multiplyScalar(1.5 * this.night)
    this.applySpill()

    // Cloud cover changes from day to day
    const day = Math.floor(now.getTime() / 86400000)
    u.uCloudCover.value = 0.36 + 0.24 * (0.5 + 0.5 * Math.sin(day * 1.7))

    for (const m of this.shadowMaterials) m.opacity = 0.18 + 0.32 * this.daylight
    if (scene?.fog) scene.fog.color.copy(u.uHorizon.value).multiplyScalar(0.85)
    if (force) this.lastSkyUpdate = performance.now()
  }

  /** Per frame: animate wind / water / clouds; re-evaluate the time of day every couple of seconds. */
  update(elapsed: number, scene: THREE.Scene) {
    this.u.uTime.value = elapsed
    const now = performance.now()
    if (now - this.lastSkyUpdate > 2000) {
      this.lastSkyUpdate = now
      this.updateSky(false, scene)
    }
  }
}
