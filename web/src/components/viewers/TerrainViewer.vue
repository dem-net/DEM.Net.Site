<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Expand, Grid3x3, LoaderCircle, RotateCw, Sun as SunIcon, TriangleAlert, Video } from '@lucide/vue'
import type { ModelFormat, TerrainScene } from './terrainScene'
import type { ViewCapture } from './turntable'
import { DEFAULT_VIEWER, VIEWER_RANGES, type ViewerSettings } from '@/api/viewerSettings'

/**
 * 3D preview of a generated model (GLB or STL), drawn by our own three.js scene (terrainScene.ts): sky light, a sun
 * with shadows, and ambient occlusion, all adjustable from the Lighting panel. three.js is loaded only when a preview
 * is shown. `settings` starts the panel from saved values (a gallery item's); the capture returns the ones it used.
 */
const props = withDefaults(
  defineProps<{ src: string; format?: ModelFormat; sizeMB?: number; alt?: string; settings?: ViewerSettings | null }>(),
  { format: 'GLB', sizeMB: undefined, alt: undefined, settings: null },
)

/** Above this size, ask before loading: big models can exhaust memory, mobile Safari kills the tab. */
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const PROMPT_ABOVE_MB = isTouch ? 40 : 120
const needsConfirm = () => (props.sizeMB ?? 0) > PROMPT_ABOVE_MB

const root = ref<HTMLDivElement>()
const host = ref<HTMLDivElement>()
const confirmed = ref(!needsConfirm())
const progress = ref(0)
const loaded = ref(false)
const failed = ref(false)
const lost = ref(false)
const autoRotate = ref(true)
const wireframe = ref(false)
const lightingOpen = ref(false)

/** Saved settings, or the defaults. AO starts off on phones and tablets (tighter GPU and memory budget): one tap enables it. */
function initialSettings(): ViewerSettings {
  const s = { ...(props.settings ?? DEFAULT_VIEWER) }
  if (isTouch) s.ao = false
  return s
}
const lighting = reactive<ViewerSettings>(initialSettings())
function resetSettings() {
  Object.assign(lighting, { ...(props.settings ?? DEFAULT_VIEWER), ao: lighting.ao })
}

let scene: TerrainScene | null = null
let loadId = 0
let unmounted = false

async function show() {
  if (!confirmed.value || !host.value) return
  const id = ++loadId
  loaded.value = false
  failed.value = false
  progress.value = 0
  try {
    const mod = await import('./terrainScene')
    if (id !== loadId || unmounted || !host.value) return
    if (!scene) {
      scene = new mod.TerrainScene(host.value, { settings: { ...lighting }, touch: isTouch })
      scene.onContextLost = () => (lost.value = true)
      scene.setAutoRotate(autoRotate.value)
      scene.setWireframe(wireframe.value)
    }
    const model = await mod.loadModel(props.src, props.format, (e) => {
      const total = e.lengthComputable ? e.total : (props.sizeMB ?? 0) * 1e6
      if (total > 0) progress.value = Math.min(e.loaded / total, 0.99)
    })
    if (id !== loadId || unmounted || !scene) {
      mod.disposeObject(model)
      return
    }
    scene.setModel(model)
    loaded.value = true
  } catch {
    if (id === loadId) failed.value = true
  }
}

function destroyScene() {
  scene?.dispose()
  scene = null
}

/** After a lost WebGL context: start again with a fresh context. */
function reload() {
  destroyScene()
  lost.value = false
  show()
}

watch(
  () => props.src,
  () => (confirmed.value = !needsConfirm()),
)
// One load per change: the host element appears on mount, or once a large size is confirmed.
watch([() => props.src, confirmed, host], show, { flush: 'post' })
watch(autoRotate, (on) => scene?.setAutoRotate(on))
watch(wireframe, (on) => scene?.setWireframe(on))
watch(lighting, (s) => scene?.setSettings({ ...s }))
watch(
  () => props.settings,
  () => Object.assign(lighting, initialSettings()),
)

onBeforeUnmount(() => {
  unmounted = true
  loadId++
  destroyScene()
})

/** Poster and turntable clip for the gallery, from the current view and lighting (see turntable.ts). */
const capturing = ref(false)
async function capture(onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<ViewCapture> {
  if (!scene || !loaded.value) throw new Error('Wait for the model to load, then capture it.')
  capturing.value = true
  lightingOpen.value = false
  try {
    const { captureTurntable } = await import('./turntable')
    const viewer = { ...lighting } // the panel is closed and frozen during the capture
    return { ...(await captureTurntable(scene, onProgress, signal)), viewer }
  } finally {
    capturing.value = false
  }
}

defineExpose({ capture, loaded })

const pct = computed(() => Math.round(progress.value * 100))

function fullscreen() {
  if (!root.value) return
  if (document.fullscreenElement) document.exitFullscreen()
  else root.value.requestFullscreen?.()
}

const STEP = Math.PI / 24 // 7.5°
function onKey(e: KeyboardEvent) {
  if (!scene || !loaded.value || capturing.value) return
  const moves: Record<string, [number, number, number]> = {
    ArrowLeft: [-STEP, 0, 1],
    ArrowRight: [STEP, 0, 1],
    ArrowUp: [0, -STEP, 1],
    ArrowDown: [0, STEP, 1],
    '+': [0, 0, 0.85],
    '=': [0, 0, 0.85],
    '-': [0, 0, 1 / 0.85],
  }
  const move = moves[e.key]
  if (!move) return
  e.preventDefault()
  autoRotate.value = false
  scene.nudge(...move)
}

const compass = (deg: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]

type SliderKey = keyof typeof VIEWER_RANGES
const sunSliders: { key: SliderKey; label: string; format: (v: number) => string }[] = [
  { key: 'sunAzimuth', label: 'Sun direction', format: (v) => `${compass(v)} · ${v}°` },
  { key: 'sunElevation', label: 'Sun height', format: (v) => `${v}°` },
  { key: 'sunIntensity', label: 'Sun strength', format: (v) => v.toFixed(1) },
  { key: 'skyIntensity', label: 'Sky light', format: (v) => v.toFixed(2) },
  { key: 'exposure', label: 'Exposure', format: (v) => v.toFixed(2) },
]
const aoSliders: typeof sunSliders = [
  { key: 'aoIntensity', label: 'Strength', format: (v) => `${Math.round(v * 100)} %` },
  { key: 'aoRadius', label: 'Radius', format: (v) => `${(v * 100).toFixed(1)} % of the model` },
]
const iconButton = 'rounded-md bg-surface/80 p-1.5 text-ink-2 backdrop-blur hover:text-ink'
</script>

<template>
  <div ref="root" class="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-subtle">
    <div v-if="!confirmed" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert class="size-6 text-ink-3" />
      <p class="text-sm text-ink-2">
        This model is <strong>{{ (sizeMB ?? 0).toFixed(0) }} MB</strong>. Previewing it in the browser may be slow{{
          isTouch ? ' or crash on this device' : ''
        }}.
      </p>
      <button type="button" class="btn btn-secondary" @click="confirmed = true">Preview anyway</button>
    </div>

    <template v-else>
      <div
        ref="host"
        class="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        role="img"
        :aria-label="`${alt ?? '3D terrain model'}. Drag to turn, scroll to zoom, or use the arrow keys and + / −.`"
        tabindex="0"
        @keydown="onKey"
        @pointerdown="lightingOpen = false"
      />
      <div v-if="!loaded && !failed && !lost" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
        <LoaderCircle class="size-6 animate-spin text-accent" />
        <span class="text-xs text-ink-2">
          Loading model · {{ pct }}%<template v-if="sizeMB"> of {{ sizeMB.toFixed(1) }} MB</template>
        </span>
        <div class="h-1 w-40 overflow-hidden rounded-full bg-line">
          <div class="h-full bg-accent transition-[width]" :style="{ width: `${pct}%` }" />
        </div>
      </div>
      <p v-if="failed" class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-danger">
        The preview could not be loaded. You can still download the model.
      </p>
      <div v-if="lost" class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-subtle p-6 text-center">
        <TriangleAlert class="size-6 text-ink-3" />
        <p class="text-sm text-ink-2">The preview stopped: your browser ran short of graphics memory.</p>
        <button type="button" class="btn btn-secondary" @click="reload">Reload the preview</button>
      </div>
      <p
        v-if="capturing"
        class="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-md bg-surface/80 px-2 py-1 text-xs text-ink-2 backdrop-blur"
      >
        <Video class="size-3.5 text-accent" /> Recording the turntable…
      </p>

      <div
        v-if="lightingOpen && loaded && !capturing"
        class="absolute top-2 right-2 bottom-11 w-60 space-y-2.5 overflow-y-auto rounded-lg bg-surface/90 p-3 text-xs text-ink-2 shadow-lg backdrop-blur"
      >
        <label v-for="sl in sunSliders" :key="sl.key" class="block">
          <span class="flex justify-between gap-2"><span>{{ sl.label }}</span><span class="tabular-nums">{{ sl.format(lighting[sl.key]) }}</span></span>
          <input
            v-model.number="lighting[sl.key]"
            type="range"
            :min="VIEWER_RANGES[sl.key].min"
            :max="VIEWER_RANGES[sl.key].max"
            :step="VIEWER_RANGES[sl.key].step"
            class="mt-1 w-full accent-accent"
          />
        </label>
        <label class="flex items-center gap-2">
          <input v-model="lighting.shadows" type="checkbox" class="accent-accent" />
          <span>Shadows</span>
        </label>
        <label class="flex items-center gap-2">
          <input v-model="lighting.ao" type="checkbox" class="accent-accent" />
          <span>Ambient occlusion</span>
        </label>
        <label v-for="sl in aoSliders" :key="sl.key" class="block" :class="lighting.ao ? '' : 'opacity-50'">
          <span class="flex justify-between gap-2"><span>{{ sl.label }}</span><span class="tabular-nums">{{ sl.format(lighting[sl.key]) }}</span></span>
          <input
            v-model.number="lighting[sl.key]"
            type="range"
            :min="VIEWER_RANGES[sl.key].min"
            :max="VIEWER_RANGES[sl.key].max"
            :step="VIEWER_RANGES[sl.key].step"
            :disabled="!lighting.ao"
            class="mt-1 w-full accent-accent"
          />
        </label>
        <button type="button" class="text-accent hover:underline" @click="resetSettings">
          {{ props.settings ? 'Back to the published lighting' : 'Reset the lighting' }}
        </button>
      </div>

      <div v-if="loaded && !capturing && !lost" class="absolute right-2 bottom-2 flex gap-1">
        <button
          type="button"
          :class="[iconButton, lightingOpen ? 'text-accent' : '']"
          :aria-expanded="lightingOpen"
          title="Lighting"
          @click="lightingOpen = !lightingOpen"
        >
          <SunIcon class="size-4" />
        </button>
        <button
          type="button"
          :class="[iconButton, autoRotate ? 'text-accent' : '']"
          :aria-pressed="autoRotate"
          title="Auto-rotate"
          @click="autoRotate = !autoRotate"
        >
          <RotateCw class="size-4" />
        </button>
        <button
          type="button"
          :class="[iconButton, wireframe ? 'text-accent' : '']"
          :aria-pressed="wireframe"
          title="Wireframe"
          @click="wireframe = !wireframe"
        >
          <Grid3x3 class="size-4" />
        </button>
        <button type="button" :class="iconButton" title="Fullscreen" @click="fullscreen">
          <Expand class="size-4" />
        </button>
      </div>
    </template>
  </div>
</template>
