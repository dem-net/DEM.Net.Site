<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { MIN_MESH_DETAIL } from '@/api/client'
import { MESH_QUALITIES } from '@/api/types'
import type { MeshQuality, ModelOptions, QualityEstimate } from '@/api/types'
import { useCatalog } from '@/composables/useCatalog'
import DatasetSelect from './DatasetSelect.vue'
import ImageryFields from './ImageryFields.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const options = defineModel<ModelOptions>({ required: true })
const props = withDefaults(
  defineProps<{
    allowStl?: boolean
    /** Size estimate per resolution (adaptive datasets), from the size estimate. */
    qualities?: QualityEstimate[] | null
  }>(),
  { allowStl: true, qualities: null },
)

const { datasetByName } = useCatalog()
/** Mapterhorn picks the tile zoom per area: the resolution is a choice. */
const adaptive = computed(() => !!datasetByName(options.value.dataset)?.isMapterhorn)

const QUALITY_LABELS: Record<MeshQuality, string> = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Best' }
const qualityEstimate = (q: MeshQuality) => props.qualities?.find((e) => e.quality === q)
const fmtMeters = (m: number) => (m >= 10 ? `${Math.round(m)} m` : m >= 1 ? `${m.toFixed(1)} m` : `${Math.round(m * 100)} cm`)
const fmtMB = (mb: number) => (mb >= 10 ? `${Math.round(mb).toLocaleString()} MB` : `${mb.toFixed(1)} MB`)

const advanced = ref(false)
const isGltf = computed(() => options.value.format === 'glTF')

const formats = computed(() => [
  { value: 'glTF' as const, label: 'glTF (GLB)', hint: 'Textured, for viewers & 3D apps' },
  ...(props.allowStl ? [{ value: 'STL' as const, label: 'STL', hint: 'For 3D printing' }] : []),
])
</script>

<template>
  <div class="space-y-4">
    <DatasetSelect v-model="options.dataset" />

    <fieldset v-if="adaptive">
      <legend class="field-label">Resolution</legend>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="q in MESH_QUALITIES"
          :key="q"
          class="relative cursor-pointer rounded-lg border px-3 py-2 text-sm"
          :class="options.meshQuality === q ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle'"
        >
          <input v-model="options.meshQuality" type="radio" :value="q" class="sr-only" />
          <span class="block font-medium">{{ QUALITY_LABELS[q] }}</span>
          <span v-if="qualityEstimate(q)" class="block text-xs tabular-nums" :class="qualityEstimate(q)!.allowed ? 'text-ink-3' : 'text-danger'">
            {{ fmtMeters(qualityEstimate(q)!.resolutionMeters) }} · {{ qualityEstimate(q)!.allowed ? fmtMB(qualityEstimate(q)!.sizeMB) : 'too large' }}
          </span>
          <span v-else class="block text-xs text-ink-3">–</span>
        </label>
      </div>
      <p class="mt-1 text-xs text-ink-3">Distance between elevation samples, for this area. Higher means more detail and a larger model.</p>
    </fieldset>

    <fieldset v-if="formats.length > 1">
      <legend class="field-label">Format</legend>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="f in formats"
          :key="f.value"
          class="relative cursor-pointer rounded-lg border px-3 py-2 text-sm"
          :class="options.format === f.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-subtle'"
        >
          <input v-model="options.format" type="radio" :value="f.value" class="sr-only" />
          <span class="block font-medium">{{ f.label }}</span>
          <span class="block text-xs text-ink-3">{{ f.hint }}</span>
        </label>
      </div>
    </fieldset>

    <div>
      <label class="field-label" for="mesh-detail">Mesh detail · {{ options.meshDetail }}%</label>
      <input
        id="mesh-detail"
        v-model.number="options.meshDetail"
        type="range"
        :min="MIN_MESH_DETAIL"
        max="100"
        step="1"
        class="w-full accent-[var(--c-accent)]"
        aria-describedby="mesh-detail-hint"
      />
      <p id="mesh-detail-hint" class="mt-1 text-xs text-ink-3">
        Share of triangles kept. Lower means a smaller, faster model with smoother relief.
      </p>
    </div>

    <template v-if="isGltf">
      <ToggleSwitch v-model="options.textured" label="Satellite texture" hint="Drape imagery over the terrain" />
      <ImageryFields v-if="options.textured" v-model:provider="options.imageryProvider" v-model:quality="options.textureQuality" />
    </template>

    <div>
      <button
        type="button"
        class="flex w-full items-center justify-between py-1 text-sm font-medium text-ink-2 hover:text-ink"
        :aria-expanded="advanced"
        @click="advanced = !advanced"
      >
        Advanced
        <ChevronDown class="size-4 transition-transform" :class="advanced ? 'rotate-180' : ''" />
      </button>
      <div v-show="advanced" class="mt-3 space-y-4">
        <div>
          <label class="field-label" for="zfactor">Vertical exaggeration · ×{{ options.zFactor }}</label>
          <input id="zfactor" v-model.number="options.zFactor" type="range" min="1" max="10" step="0.5" class="w-full accent-[var(--c-accent)]" />
        </div>
        <ToggleSwitch
          v-if="isGltf"
          v-model="options.adornments"
          label="Scale bar & north arrow"
          hint="Add a 3D scale bar and a north arrow next to the terrain"
        />
        <ToggleSwitch
          v-if="isGltf"
          v-model="options.boxed"
          label="Boxed model"
          hint="Close the terrain with walls and a bottom, like a block (STL models always are)"
        />
        <ToggleSwitch
          v-if="isGltf && options.boxed"
          v-model="options.boxMonuments"
          label="Monuments on the walls"
          hint="Draw well-known monuments (Eiffel Tower, Burj Khalifa…) on the walls at the model's scale, as a height reference. Only those that fit and are large enough to read"
        />
      </div>
    </div>
  </div>
</template>
