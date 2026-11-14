<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Grid3x3, LoaderCircle } from '@lucide/vue'
import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { setWireframe } from './wireframe'

/** Minimal STL preview (model-viewer only reads glTF). */
const props = defineProps<{ src: string }>()

const host = ref<HTMLDivElement>()
const progress = ref(0)
const loaded = ref(false)
const failed = ref(false)
const wireframe = ref(false)

let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let mesh: THREE.Mesh | null = null
let observer: ResizeObserver | null = null
let raf = 0
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1e7)

function resize() {
  if (!host.value || !renderer) return
  const { clientWidth: w, clientHeight: h } = host.value
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

function load(url: string) {
  loaded.value = false
  failed.value = false
  progress.value = 0
  new STLLoader().load(
    url,
    (geometry) => {
      if (mesh) {
        scene.remove(mesh)
        mesh.geometry.dispose()
      }
      geometry.computeVertexNormals()
      // STL from DEM.Net is Z-up; three.js is Y-up.
      geometry.rotateX(-Math.PI / 2)
      geometry.center()
      mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc9c2b4, roughness: 0.9, flatShading: false }))
      scene.add(mesh)
      if (wireframe.value) setWireframe(mesh, true)
      geometry.computeBoundingSphere()
      const r = geometry.boundingSphere!.radius
      camera.near = r / 100
      camera.far = r * 100
      camera.position.set(r * 1.2, r * 1.1, r * 1.6)
      camera.updateProjectionMatrix()
      controls!.target.set(0, 0, 0)
      controls!.update()
      loaded.value = true
    },
    (e) => {
      if (e.lengthComputable) progress.value = e.loaded / e.total
    },
    () => (failed.value = true),
  )
}

onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  host.value!.appendChild(renderer.domElement)
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2)
  sun.position.set(1, 2, 1.5)
  scene.add(sun)
  observer = new ResizeObserver(resize)
  observer.observe(host.value!)
  resize()
  const tick = () => {
    controls!.update()
    renderer!.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  tick()
  load(props.src)
})

watch(() => props.src, load)
watch(wireframe, (on) => mesh && setWireframe(mesh, on))

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  controls?.dispose()
  mesh?.geometry.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-subtle">
    <div ref="host" class="absolute inset-0" />
    <div v-if="!loaded && !failed" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
      <LoaderCircle class="size-6 animate-spin text-accent" />
      <span class="text-xs text-ink-2">Loading STL · {{ Math.round(progress * 100) }}%</span>
    </div>
    <p v-if="failed" class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-danger">
      The preview could not be loaded. You can still download the model.
    </p>
    <div v-if="loaded" class="absolute right-2 bottom-2 flex gap-1">
      <button
        type="button"
        class="rounded-md bg-surface/80 p-1.5 text-ink-2 backdrop-blur hover:text-ink"
        :class="wireframe ? 'text-accent' : ''"
        :aria-pressed="wireframe"
        title="Wireframe"
        @click="wireframe = !wireframe"
      >
        <Grid3x3 class="size-4" />
      </button>
    </div>
  </div>
</template>
