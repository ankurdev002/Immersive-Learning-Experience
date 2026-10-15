import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/**
 * Rigged hand built on the WebXR "generic-hand" model. Its 25 joints are NOT parented to each other
 * (every joint is posed directly in armature space, like XR hand tracking), so finger curls are done
 * with a tiny forward-kinematics pass: bending a joint rotates every joint further down that finger.
 */

const FINGER_CHAINS = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: [
    'index-finger-metacarpal',
    'index-finger-phalanx-proximal',
    'index-finger-phalanx-intermediate',
    'index-finger-phalanx-distal',
    'index-finger-tip',
  ],
  middle: [
    'middle-finger-metacarpal',
    'middle-finger-phalanx-proximal',
    'middle-finger-phalanx-intermediate',
    'middle-finger-phalanx-distal',
    'middle-finger-tip',
  ],
  ring: [
    'ring-finger-metacarpal',
    'ring-finger-phalanx-proximal',
    'ring-finger-phalanx-intermediate',
    'ring-finger-phalanx-distal',
    'ring-finger-tip',
  ],
  pinky: [
    'pinky-finger-metacarpal',
    'pinky-finger-phalanx-proximal',
    'pinky-finger-phalanx-intermediate',
    'pinky-finger-phalanx-distal',
    'pinky-finger-tip',
  ],
} as const

type FingerName = keyof typeof FINGER_CHAINS

/** Curl amount per finger, 0 = straight, 1 = fully curled. */
export type HandPose = Record<FingerName, number>

export interface ArmOptions {
  forearmLength?: number
  sleeveLength?: number
  /** Sleeve radius at the cuff and at the far end */
  sleeveRadius?: [number, number]
}

// Max flexion (radians) per joint, starting at the metacarpal
const FINGER_MAX_FLEX = [0.08, 1.25, 1.45, 0.95]
const THUMB_MAX_FLEX = [0.35, 0.55, 0.85]

const _axis = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _v = new THREE.Vector3()
const _m = new THREE.Matrix4()

export class HandRig {
  /** Place this group (in the parent's space) with {@link place}. */
  readonly root = new THREE.Group()
  private readonly bones = new Map<string, THREE.Object3D>()
  private readonly rest = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion }>()
  private readonly modelBasisInverse = new THREE.Matrix4()
  private readonly modelBack = new THREE.Vector3()

  private readonly armLength: number

  private constructor(gltfScene: THREE.Object3D, skin: THREE.Material, sleeve: THREE.Material, arm: ArmOptions = {}) {
    gltfScene.traverse((obj) => {
      if ((obj as THREE.Bone).isBone || FINGER_NAMES.has(obj.name)) {
        this.bones.set(obj.name, obj)
        this.rest.set(obj.name, { p: obj.position.clone(), q: obj.quaternion.clone() })
      }
      const mesh = obj as THREE.SkinnedMesh
      if (mesh.isMesh) {
        mesh.material = skin
        mesh.castShadow = true
        // The skinned pose moves far from the bind-pose bounds; it's small, so never cull it
        mesh.frustumCulled = false
      }
    })
    this.root.add(gltfScene)

    // Model-space axes of the hand: fingers point from the index knuckle to its tip, the back of the
    // hand is the joint's +Y (WebXR convention), and the third axis completes the basis.
    const knuckle = this.restPosition('index-finger-phalanx-proximal')
    const tip = this.restPosition('index-finger-tip')
    const finger = tip.clone().sub(knuckle).normalize()
    const back = new THREE.Vector3(0, 1, 0).applyQuaternion(this.rest.get('index-finger-phalanx-proximal')!.q)
    back.addScaledVector(finger, -back.dot(finger)).normalize()
    const side = new THREE.Vector3().crossVectors(finger, back)
    this.modelBack.copy(back)
    this.modelBasisInverse.makeBasis(finger, back, side).invert()

    // Forearm + sleeve so the hand never ends in a cut-off wrist
    const wrist = this.restPosition('wrist')
    const armBasis = new THREE.Matrix4().makeBasis(side, finger.clone().negate(), back)
    const armQuat = new THREE.Quaternion().setFromRotationMatrix(armBasis)

    const forearmLength = arm.forearmLength ?? 0.2
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.03, forearmLength, 18, 1, true), skin)
    forearm.scale.set(1.3, 1, 0.82)
    forearm.quaternion.copy(armQuat)
    forearm.position.copy(wrist).addScaledVector(finger, -forearmLength / 2 + 0.012)
    forearm.castShadow = true
    this.root.add(forearm)

    const sleeveLength = arm.sleeveLength ?? 0.32
    const [cuffR, farR] = arm.sleeveRadius ?? [0.042, 0.05]
    this.armLength = 0.11 + sleeveLength
    const sleeveMesh = new THREE.Mesh(new THREE.CylinderGeometry(cuffR, farR, sleeveLength, 20), sleeve)
    sleeveMesh.scale.set(1.2, 1, 0.9)
    sleeveMesh.quaternion.copy(armQuat)
    sleeveMesh.position.copy(wrist).addScaledVector(finger, -(0.11 + sleeveLength / 2))
    sleeveMesh.castShadow = true
    this.root.add(sleeveMesh)

    this.root.visible = false
  }

  static async load(
    url: string,
    skin: THREE.Material,
    sleeve: THREE.Material,
    manager?: THREE.LoadingManager,
    arm?: ArmOptions
  ): Promise<HandRig | null> {
    try {
      const gltf = await new GLTFLoader(manager).loadAsync(url)
      return new HandRig(gltf.scene, skin, sleeve, arm)
    } catch (err) {
      console.warn('[HandRig] hand model unavailable, page turns continue without hands:', err)
      return null
    }
  }

  private restPosition(name: string): THREE.Vector3 {
    return this.rest.get(name)?.p.clone() ?? new THREE.Vector3()
  }

  /** Far end of the sleeve (where an upper arm should meet it), in the parent's space. */
  sleeveEnd(fingerDir: THREE.Vector3): THREE.Vector3 {
    const wrist = (this.bones.get('wrist')?.position ?? new THREE.Vector3()).clone()
    wrist.applyQuaternion(this.root.quaternion).add(this.root.position)
    return wrist.addScaledVector(fingerDir.clone().normalize(), -this.armLength)
  }

  /** Curl the fingers (forward kinematics from the rest pose). */
  setPose(pose: HandPose) {
    for (const finger of Object.keys(FINGER_CHAINS) as FingerName[]) {
      const chain = FINGER_CHAINS[finger]
      const joints = chain.map((name) => this.bones.get(name)).filter(Boolean) as THREE.Object3D[]
      if (joints.length !== chain.length) continue

      chain.forEach((name, i) => {
        const rest = this.rest.get(name)!
        joints[i]!.position.copy(rest.p)
        joints[i]!.quaternion.copy(rest.q)
      })

      const flex = finger === 'thumb' ? THUMB_MAX_FLEX : FINGER_MAX_FLEX
      const curl = THREE.MathUtils.clamp(pose[finger], 0, 1)
      for (let k = 0; k < flex.length && k < joints.length - 1; k++) {
        const angle = curl * flex[k]!
        if (angle === 0) continue
        const pivot = joints[k]!.position
        // Flexion is about the joint's local X; negative rotation folds -Z (finger) toward -Y (palm)
        _axis.set(1, 0, 0).applyQuaternion(joints[k]!.quaternion).normalize()
        _q.setFromAxisAngle(_axis, -angle)
        for (let j = k; j < joints.length; j++) {
          const joint = joints[j]!
          if (j > k) joint.position.sub(pivot).applyQuaternion(_q).add(pivot)
          joint.quaternion.premultiply(_q)
        }
      }
    }
  }

  /**
   * Orient the hand so its fingers point along `fingerDir` with the back of the hand facing `backDir`,
   * then move it so the index fingertip lands exactly on `tipTarget` (all in the parent's space).
   */
  place(tipTarget: THREE.Vector3, fingerDir: THREE.Vector3, backDir: THREE.Vector3) {
    const b = _v.copy(backDir).normalize()
    const f = fingerDir.clone().addScaledVector(b, -fingerDir.dot(b)).normalize()
    const s = new THREE.Vector3().crossVectors(f, b)
    _m.makeBasis(f, b, s).multiply(this.modelBasisInverse)
    this.root.quaternion.setFromRotationMatrix(_m)

    const tip = this.bones.get('index-finger-tip')?.position ?? new THREE.Vector3()
    this.root.position.copy(tipTarget).sub(tip.clone().applyQuaternion(this.root.quaternion))
  }
}

const FINGER_NAMES = new Set<string>(['wrist', ...Object.values(FINGER_CHAINS).flat()])
