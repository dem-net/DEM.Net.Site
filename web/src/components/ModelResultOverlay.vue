<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { Download, ExternalLink, Images, Layers, Map as MapIcon } from '@lucide/vue'
import { safeUrl } from '@/api/client'
import type { ModelResult, PublishContext } from '@/api/types'
import sketchfabLogo from '@/assets/sketchfablogo.png'
import GalleryPublishPanel from './GalleryPublishPanel.vue'
import SketchfabPublishDialog from './SketchfabPublishDialog.vue'
import GlbViewer from './viewers/GlbViewer.vue'
import type { TurntableResult } from './viewers/turntable'

const StlViewer = defineAsyncComponent(() => import('./viewers/StlViewer.vue'))

const props = defineProps<{
  result: ModelResult
  /** Textures page for the same area (texture, normal map, height map). */
  texturesLink?: RouteLocationRaw
  /** Sketchfab form prefill (place and link), captured when the model was generated. */
  publish?: PublishContext | null
  /** Made from a GPX file: the gallery form says the track becomes public. */
  gpx?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const downloads = computed(() =>
  [
    { label: props.result.format === 'STL' ? 'Model (STL)' : 'Model (GLB)', url: props.result.modelUrl, primary: true },
    { label: 'OBJ (zip)', url: props.result.objUrl },
  ].filter((d): d is { label: string; url: string; primary?: boolean } => !!d.url),
)

const canPublish = computed(() => props.result.format === 'glTF')

const publishDialog = ref<InstanceType<typeof SketchfabPublishDialog>>()

const viewer = ref<InstanceType<typeof GlbViewer>>()
const galleryOpen = ref(false)
const galleryPanel = ref<InstanceType<typeof GalleryPublishPanel>>()
watch(() => props.result.id, () => (galleryOpen.value = false))

async function openGallery() {
  galleryOpen.value = true
  await nextTick()
  galleryPanel.value?.$el?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
}

function captureView(onProgress: (fraction: number) => void, signal: AbortSignal): Promise<TurntableResult> {
  if (!viewer.value) return Promise.reject(new Error('Open the 3D preview first.'))
  return viewer.value.capture(onProgress, signal)
}
const elevationRange = computed(
  () => `${Math.round(props.result.minElevation)} – ${Math.round(props.result.maxElevation)} m`,
)
</script>

<template>
  <div class="absolute inset-0 z-20 overflow-y-auto bg-page/80 p-3 backdrop-blur-sm sm:p-6">
    <div class="card mx-auto max-w-4xl p-3 shadow-xl sm:p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Your 3D model</h2>
          <p class="text-xs text-ink-3">{{ result.sizeMB.toFixed(1) }} MB · elevation {{ elevationRange }}</p>
        </div>
        <button type="button" class="btn btn-secondary" @click="emit('close')">
          <MapIcon class="size-4" /> Back to map
        </button>
      </div>

      <StlViewer v-if="result.format === 'STL'" :src="result.modelUrl" />
      <GlbViewer v-else ref="viewer" :src="result.modelUrl" :size-m-b="result.sizeMB" />

      <div class="mt-4 flex flex-wrap gap-2">
        <a
          v-for="d in downloads"
          :key="d.url"
          :href="d.url"
          download
          target="_blank"
          rel="noopener"
          class="btn"
          :class="d.primary ? 'btn-primary' : 'btn-secondary'"
        >
          <Download class="size-4" /> {{ d.label }}
        </a>
        <button
          v-if="canPublish"
          type="button"
          class="btn btn-secondary sm:ml-auto"
          :aria-expanded="galleryOpen"
          @click="galleryOpen ? (galleryOpen = false) : openGallery()"
        >
          <Images class="size-4" /> Publish to gallery
        </button>
        <button v-if="canPublish" type="button" class="btn btn-secondary" @click="publishDialog?.open()">
          <img :src="sketchfabLogo" alt="" class="size-4" /> Publish on Sketchfab
        </button>
      </div>
      <GalleryPublishPanel
        v-if="canPublish && galleryOpen"
        ref="galleryPanel"
        :key="result.id"
        :model-id="result.id"
        :publish="publish"
        :gpx="gpx"
        :capture="captureView"
        @close="galleryOpen = false"
      />
      <p v-if="texturesLink" class="mt-3 text-xs text-ink-3">
        Need the texture, a normal map or a height map, georeferenced?
        <RouterLink :to="texturesLink" class="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          <Layers class="size-3.5" /> Get them on the Textures page
        </RouterLink>
      </p>
      <SketchfabPublishDialog v-if="canPublish" :key="result.id" ref="publishDialog" :model-id="result.id" :publish="publish" />

      <div v-if="result.attributions.length" class="mt-4 border-t border-line pt-3">
        <p class="field-label">Credits</p>
        <ul class="space-y-1 text-xs text-ink-3">
          <li v-for="a in result.attributions" :key="a.subject + a.text">
            <span class="font-medium text-ink-2">{{ a.subject }}:</span>
            <a v-if="safeUrl(a.url)" :href="safeUrl(a.url)" target="_blank" rel="noopener noreferrer" class="ml-1 inline-flex items-center gap-0.5 underline">
              {{ a.text }} <ExternalLink class="size-3" />
            </a>
            <span v-else class="ml-1">{{ a.text }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
