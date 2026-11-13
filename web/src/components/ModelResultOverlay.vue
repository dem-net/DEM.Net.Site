<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { Download, ExternalLink, Map as MapIcon } from '@lucide/vue'
import { sketchfabLoginUrl } from '@/api/client'
import type { ModelResult } from '@/api/types'
import sketchfabLogo from '@/assets/sketchfablogo.png'
import GlbViewer from './viewers/GlbViewer.vue'

const StlViewer = defineAsyncComponent(() => import('./viewers/StlViewer.vue'))

const props = defineProps<{ result: ModelResult }>()
const emit = defineEmits<{ close: [] }>()

const downloads = computed(() =>
  [
    { label: props.result.format === 'STL' ? 'Model (STL)' : 'Model (GLB)', url: props.result.modelUrl, primary: true },
    { label: 'OBJ (zip)', url: props.result.objUrl },
    { label: 'Texture', url: props.result.albedoUrl },
    { label: 'Height map', url: props.result.heightMapUrl },
    { label: 'Normal map', url: props.result.normalMapUrl },
  ].filter((d): d is { label: string; url: string; primary?: boolean } => !!d.url),
)

const sketchfabUrl = computed(() => (props.result.format === 'glTF' ? sketchfabLoginUrl(props.result.id) : null))
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
      <GlbViewer v-else :src="result.modelUrl" :size-m-b="result.sizeMB" />

      <div class="mt-4 flex flex-wrap gap-2">
        <a
          v-for="d in downloads"
          :key="d.url"
          :href="d.url"
          download
          class="btn"
          :class="d.primary ? 'btn-primary' : 'btn-secondary'"
        >
          <Download class="size-4" /> {{ d.label }}
        </a>
        <a v-if="sketchfabUrl" :href="sketchfabUrl" class="btn btn-secondary sm:ml-auto">
          <img :src="sketchfabLogo" alt="" class="size-4" /> Publish on Sketchfab
        </a>
      </div>

      <div v-if="result.attributions.length" class="mt-4 border-t border-line pt-3">
        <p class="field-label">Credits</p>
        <ul class="space-y-1 text-xs text-ink-3">
          <li v-for="a in result.attributions" :key="a.subject + a.text">
            <span class="font-medium text-ink-2">{{ a.subject }}:</span>
            <a v-if="a.url" :href="a.url" target="_blank" rel="noopener noreferrer" class="ml-1 inline-flex items-center gap-0.5 underline">
              {{ a.text }} <ExternalLink class="size-3" />
            </a>
            <span v-else class="ml-1">{{ a.text }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
