import {
  BackSide,
  Box3,
  BufferAttribute,
  Color,
  DirectionalLight,
  HalfFloatType,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  Spherical,
  Texture,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Object3D,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { makeTerrainMatte } from './matteTerrain'
import { setWireframe } from './wireframe'
import { fitDistance, MAX_PHI, START_PHI, START_THETA, sunDirection, type Orbit } from './lighting'
import { DEFAULT_VIEWER, type ViewerSettings } from '@/api/viewerSettings'

/**
 * The 3D preview's three.js scene: a sky environment, a sun with shadows, ambient occlusion (GTAO), and orbit controls.
 *
 * Built to stay light on the GPU, because SSAO in model-viewer was once dropped for crashing tabs:
 * - Frames are rendered only when something changes (camera, sun, options), not at 60 fps.
 * - AO is computed at half resolution, and is off by default on touch devices.
 * - A lost WebGL context is reported (`onContextLost`) instead of leaving a frozen canvas.
 * - `dispose()` frees every GPU resource and the context itself, so opening many models doesn't pile them up.
 *
 * Every size (shadow bias, AO radius, clipping planes) is relative to the model's bounding sphere, because models
 * range from a city block to a mountain range in the same units.
 */

export type ModelFormat = 'GLB' | 'STL'

export interface SceneOptions {
  settings: ViewerSettings
  touch: boolean
}

/** AO at half resolution: a quarter of the fragment work, and the denoise hides the difference. */
class HalfResGTAOPass extends GTAOPass {
  override setSize(width: number, height: number) {
    super.setSize(Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(height / 2)))
  }
}

const SUN_COLOR = new Color('#fff3e2')
const STL_COLOR = 0xc9c2b4

/**
 * Outdoor light without an HDR file: a gradient dome (blue zenith, pale horizon, earthy ground) pre-filtered into an
 * environment map. It gives the soft sky fill and bounce that the sun alone doesn't.
 */
function skyEnvironment(renderer: WebGLRenderer): WebGLRenderTarget {
  const R = 10
  const geometry = new SphereGeometry(R, 48, 24)
  const pos = geometry.attributes.position!
  const colors = new Float32Array(pos.count * 3)
  const zenith = new Color('#8fb2dc')
  const horizon = new Color('#e4e8ea')
  const ground = new Color('#8a8172')
  const c = new Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / R
    if (y >= 0) c.lerpColors(horizon, zenith, Math.pow(y, 0.6))
    else c.lerpColors(horizon, ground, Math.min(1, -y * 5))
    c.toArray(colors, i * 3)
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  const material = new MeshBasicMaterial({ vertexColors: true, side: BackSide })
  const dome = new Scene()
  dome.add(new Mesh(geometry, material))
  const pmrem = new PMREMGenerator(renderer)
  const target = pmrem.fromScene(dome, 0.02)
  pmrem.dispose()
  geometry.dispose()
  material.dispose()
  return target
}

function disposeMaterial(m: Material) {
  for (const value of Object.values(m)) if (value instanceof Texture) value.dispose()
  m.dispose()
}

/** Frees a model's geometries, materials and textures (e.g. one that finished loading after the viewer moved on). */
export function disposeObject(root: Object3D) {
  setWireframe(root, false) // the overlays share geometry and a session-wide material
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return
    o.geometry.dispose()
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) disposeMaterial(m)
  })
}

/** Loads a GLB (terrain made matte) or an STL (Z-up in DEM.Net, turned Y-up). */
export async function loadModel(
  url: string,
  format: ModelFormat,
  onProgress?: (e: ProgressEvent) => void,
): Promise<Object3D> {
  if (format === 'STL') {
    const geometry = await new STLLoader().loadAsync(url, onProgress)
    geometry.computeVertexNormals()
    geometry.rotateX(-Math.PI / 2)
    return new Mesh(geometry, new MeshStandardMaterial({ color: STL_COLOR, roughness: 0.9 }))
  }
  const gltf = await new GLTFLoader().loadAsync(url, onProgress)
  makeTerrainMatte(gltf.scene)
  return gltf.scene
}

export class TerrainScene {
  readonly canvas: HTMLCanvasElement
  /** Called once if the browser drops the WebGL context (GPU memory pressure, driver reset). */
  onContextLost?: () => void

  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(30, 4 / 3, 0.1, 1000)
  private readonly controls: OrbitControls
  private readonly composer: EffectComposer
  private readonly aoPass: HalfResGTAOPass
  private readonly sun = new DirectionalLight(SUN_COLOR)
  private readonly ground: Mesh<PlaneGeometry, ShadowMaterial>
  private readonly env: WebGLRenderTarget
  private readonly observer: ResizeObserver
  private readonly pixelRatio: number

  private model: Object3D | null = null
  private readonly center = new Vector3()
  private radius = 1
  private settings: ViewerSettings = { ...DEFAULT_VIEWER }
  private wireframe = false
  private dirty = true
  private capturing = false
  private raf = 0
  private last = 0
  private disposed = false

  private readonly host: HTMLElement

  constructor(host: HTMLElement, options: SceneOptions) {
    this.host = host
    this.renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    this.pixelRatio = Math.min(devicePixelRatio, options.touch ? 1.5 : 2)
    this.renderer.setPixelRatio(this.pixelRatio)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.toneMapping = NeutralToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = PCFShadowMap

    this.canvas = this.renderer.domElement
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.display = 'block'
    this.canvas.addEventListener('webglcontextlost', this.contextLost)
    host.appendChild(this.canvas)

    this.env = skyEnvironment(this.renderer)
    this.scene.environment = this.env.texture

    const shadowSize = options.touch ? 1024 : 2048
    this.sun.shadow.mapSize.set(shadowSize, shadowSize)
    this.sun.shadow.radius = 2
    this.sun.shadow.bias = -0.0002
    this.scene.add(this.sun, this.sun.target)

    // Catches the model's shadow under it (model-viewer had a contact shadow); invisible elsewhere.
    this.ground = new Mesh(new PlaneGeometry(1, 1), new ShadowMaterial({ opacity: 0.2 }))
    this.ground.rotation.x = -Math.PI / 2
    this.ground.receiveShadow = true
    this.scene.add(this.ground)

    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.maxPolarAngle = MAX_PHI
    this.controls.screenSpacePanning = false // pans across the ground, like a map
    this.controls.autoRotateSpeed = 2 // 12°/s with a frame delta: one turn in 30 s
    this.controls.addEventListener('change', this.invalidate)

    // MSAA in the composer's buffers: the canvas itself is not antialiased.
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, target)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.aoPass = new HalfResGTAOPass(this.scene, this.camera, 1, 1)
    this.composer.addPass(this.aoPass)
    this.composer.addPass(new OutputPass()) // tone mapping and sRGB

    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    this.resize()
    this.setSettings(options.settings)
    this.raf = requestAnimationFrame(this.tick)
  }

  /** Shows `model` (and takes ownership of it), framed from the start view. The previous model is disposed. */
  setModel(model: Object3D) {
    if (this.model) {
      this.scene.remove(this.model)
      disposeObject(this.model)
    }
    this.model = model
    model.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    this.scene.add(model)
    if (this.wireframe) setWireframe(model, true)

    const box = new Box3().setFromObject(model)
    box.getCenter(this.center)
    const R = (this.radius = Math.max(box.getSize(new Vector3()).length() / 2, 1e-6))

    this.ground.position.set(this.center.x, box.min.y, this.center.z)
    this.ground.scale.setScalar(R * 6)

    this.camera.near = R / 200
    this.camera.far = R * 40
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(this.center)
    this.controls.minDistance = R * 0.15
    this.controls.maxDistance = R * 5

    const shadow = this.sun.shadow
    // A bit wider than the model, so a low sun's long shadows on the ground aren't cut at once.
    const S = R * 1.25
    Object.assign(shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 0, far: R * 4 })
    shadow.camera.updateProjectionMatrix()
    shadow.normalBias = (S * 2 * 1.5) / shadow.mapSize.x // about 1.5 shadow texels

    this.aoPass.setSceneClipBox(box.clone().expandByScalar(R * 0.02))
    this.setSettings(this.settings) // the sun's position and the AO radius depend on the model's size

    this.applyOrbit({ theta: START_THETA, phi: START_PHI, radius: 0.9 * fitDistance(R, this.camera.fov, this.camera.aspect) })
  }

  /** Lighting from the viewer's panel (or a gallery item). Cheap: no shader is recompiled. */
  setSettings(s: ViewerSettings) {
    this.settings = { ...s }
    const [x, y, z] = sunDirection({ azimuth: s.sunAzimuth, elevation: s.sunElevation })
    this.sun.position.set(x, y, z).multiplyScalar(this.radius * 2).add(this.center)
    this.sun.target.position.copy(this.center)
    this.sun.target.updateMatrixWorld()
    this.sun.intensity = s.sunIntensity
    // The shadow map stays enabled on the renderer (toggling it recompiles every material): only the sun stops casting.
    this.sun.castShadow = s.shadows
    this.ground.visible = s.shadows
    this.scene.environmentIntensity = s.skyIntensity
    this.renderer.toneMappingExposure = s.exposure
    this.aoPass.enabled = s.ao
    this.aoPass.blendIntensity = s.aoIntensity
    const radius = this.radius * s.aoRadius
    this.aoPass.updateGtaoMaterial({ radius, thickness: radius, distanceExponent: 1, scale: 1, samples: 16 })
    this.invalidate()
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on
    this.invalidate()
  }

  setWireframe(on: boolean) {
    this.wireframe = on
    if (this.model) setWireframe(this.model, on)
    this.invalidate()
  }

  getOrbit(): Orbit {
    const s = new Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target))
    return { theta: s.theta, phi: s.phi, radius: s.radius }
  }

  /** Keyboard orbit and zoom. */
  nudge(dTheta: number, dPhi: number, zoom = 1) {
    const o = this.getOrbit()
    this.applyOrbit({
      theta: o.theta + dTheta,
      phi: Math.min(MAX_PHI, Math.max(0.05, o.phi + dPhi)),
      radius: Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, o.radius * zoom)),
    })
  }

  /**
   * Fixes the output size (the clip's, whatever the viewer's) and freezes the controls until `endCapture`.
   * Between the two, `renderFrame` is the only thing that draws.
   */
  beginCapture(width: number, height: number) {
    this.capturing = true
    this.controls.enabled = false
    this.renderer.setPixelRatio(1)
    this.composer.setPixelRatio(1)
    this.setRenderSize(width, height)
  }

  /** Renders `orbit` and returns the canvas: read it right away, before yielding (the buffer is not preserved). */
  renderFrame(orbit: Orbit): HTMLCanvasElement {
    this.placeCamera(orbit)
    this.render()
    return this.canvas
  }

  endCapture(orbit: Orbit) {
    this.renderer.setPixelRatio(this.pixelRatio)
    this.composer.setPixelRatio(this.pixelRatio)
    this.capturing = false
    this.controls.enabled = true
    this.resize()
    this.applyOrbit(orbit)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    this.controls.removeEventListener('change', this.invalidate)
    this.controls.dispose()
    if (this.model) disposeObject(this.model)
    this.ground.geometry.dispose()
    this.ground.material.dispose()
    this.sun.shadow.dispose()
    this.env.dispose()
    for (const pass of this.composer.passes) pass.dispose()
    this.composer.dispose()
    this.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.canvas.remove()
  }

  private readonly invalidate = () => {
    this.dirty = true
  }

  private readonly contextLost = (e: Event) => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
    this.onContextLost?.()
  }

  private readonly tick = (time: number) => {
    this.raf = requestAnimationFrame(this.tick)
    const dt = this.last ? Math.min((time - this.last) / 1000, 0.1) : 0
    this.last = time
    if (this.capturing) return
    // update() returns true while damping or auto-rotation moves the camera
    if (this.controls.update(dt) || this.dirty) this.render()
  }

  private render() {
    this.dirty = false
    if (this.model) this.composer.render()
  }

  private placeCamera(orbit: Orbit) {
    this.camera.position.setFromSpherical(new Spherical(orbit.radius, orbit.phi, orbit.theta)).add(this.controls.target)
    this.camera.lookAt(this.controls.target)
  }

  private applyOrbit(orbit: Orbit) {
    this.placeCamera(orbit)
    this.controls.update()
    this.invalidate()
  }

  private setRenderSize(width: number, height: number) {
    this.renderer.setSize(width, height, false)
    this.composer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.invalidate()
  }

  private resize() {
    if (this.capturing) return
    const { clientWidth: w, clientHeight: h } = this.host
    if (w > 0 && h > 0) this.setRenderSize(w, h)
  }
}
