<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Expand, LoaderCircle, RotateCw, TriangleAlert } from '@lucide/vue'

const props = defineProps<{ src: string; sizeMB: number; alt?: string }>()

/** Above this size, ask before loading: big GLBs can exhaust memory, mobile Safari kills the tab. */
const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const PROMPT_ABOVE_MB = isTouch ? 40 : 120

const ready = ref(false) // custom element registered
const confirmed = ref(props.sizeMB <= PROMPT_ABOVE_MB)
const progress = ref(0)
const loaded = ref(false)
const failed = ref(false)
const autoRotate = ref(true)
const el = ref<HTMLElement>()

/**
 * Default look, after the Sketchfab terrain setup: SSAO for relief, a light sharpen pass,
 * ground shadow, matte terrain (metallic 0, Specular F0 0, see matteTerrain.ts).
 * Touch devices get the cheaper render mode (SSAO's normal pass is costly on mobile GPUs).
 */
const renderMode = isTouch ? 'performance' : 'quality'

onMounted(async () => {
  await import('@google/model-viewer')
  await Promise.all([import('@google/model-viewer-effects'), import('./sharpenEffect')])
  ready.value = true
})

watch(
  () => props.src,
  () => {
    confirmed.value = props.sizeMB <= PROMPT_ABOVE_MB
    progress.value = 0
    loaded.value = false
    failed.value = false
  },
)

function onProgress(e: Event) {
  progress.value = (e as CustomEvent<{ totalProgress: number }>).detail.totalProgress
}

async function onLoad() {
  loaded.value = true
  const { makeTerrainMatte } = await import('./matteTerrain')
  if (el.value) makeTerrainMatte(el.value)
}

const pct = computed(() => Math.round(progress.value * 100))

function fullscreen() {
  const target = el.value?.parentElement
  if (!target) return
  if (document.fullscreenElement) document.exitFullscreen()
  else target.requestFullscreen?.()
}
</script>

<template>
  <div class="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-subtle">
    <div v-if="!confirmed" class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <TriangleAlert class="size-6 text-ink-3" />
      <p class="text-sm text-ink-2">
        This model is <strong>{{ sizeMB.toFixed(0) }} MB</strong>. Previewing it in the browser may be slow{{
          isTouch ? ' or crash on this device' : ''
        }}.
      </p>
      <button type="button" class="btn btn-secondary" @click="confirmed = true">Preview anyway</button>
    </div>

    <template v-else-if="ready">
      <model-viewer
        ref="el"
        :src="src"
        :alt="alt ?? '3D terrain model'"
        camera-controls
        touch-action="pan-y"
        :auto-rotate="autoRotate || undefined"
        auto-rotate-delay="0"
        rotation-per-second="12deg"
        interaction-prompt="none"
        camera-orbit="-25deg 58deg auto"
        shadow-intensity="1"
        shadow-softness="0.6"
        exposure="0.9"
        tone-mapping="neutral"
        environment-image="neutral"
        max-camera-orbit="auto 88deg auto"
        style="width: 100%; height: 100%; background: transparent; --poster-color: transparent"
        @progress="onProgress"
        @load="onLoad"
        @error="failed = true"
      >
        <effect-composer :render-mode="renderMode" msaa="4">
          <ssao-effect strength="1.5" />
          <sharpen-effect amount="0.3" />
        </effect-composer>
      </model-viewer>
      <div v-if="!loaded && !failed" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
        <LoaderCircle class="size-6 animate-spin text-accent" />
        <span class="text-xs text-ink-2">Loading model · {{ pct }}% of {{ sizeMB.toFixed(1) }} MB</span>
        <div class="h-1 w-40 overflow-hidden rounded-full bg-line">
          <div class="h-full bg-accent transition-[width]" :style="{ width: `${pct}%` }" />
        </div>
      </div>
      <p v-if="failed" class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-danger">
        The preview could not be loaded. You can still download the model.
      </p>
      <div v-if="loaded" class="absolute right-2 bottom-2 flex gap-1">
        <button
          type="button"
          class="rounded-md bg-surface/80 p-1.5 text-ink-2 backdrop-blur hover:text-ink"
          :class="autoRotate ? 'text-accent' : ''"
          :aria-pressed="autoRotate"
          title="Auto-rotate"
          @click="autoRotate = !autoRotate"
        >
          <RotateCw class="size-4" />
        </button>
        <button
          type="button"
          class="rounded-md bg-surface/80 p-1.5 text-ink-2 backdrop-blur hover:text-ink"
          title="Fullscreen"
          @click="fullscreen"
        >
          <Expand class="size-4" />
        </button>
      </div>
    </template>
  </div>
</template>
