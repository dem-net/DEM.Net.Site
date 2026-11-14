<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown } from '@lucide/vue'
import { MIN_MESH_DETAIL } from '@/api/client'
import type { ModelOptions } from '@/api/types'
import DatasetSelect from './DatasetSelect.vue'
import ImageryFields from './ImageryFields.vue'
import RegionHint from './RegionHint.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const options = defineModel<ModelOptions>({ required: true })
const props = withDefaults(
  defineProps<{
    allowStl?: boolean
    /** Country at the centre of the area (ISO code), for Swiss-data suggestions and coverage warnings. */
    country?: string | null
  }>(),
  { allowStl: true, country: null },
)

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
    <RegionHint
      v-model:dataset="options.dataset"
      v-model:imagery-provider="options.imageryProvider"
      :country="props.country"
      :uses-imagery="isGltf && options.textured"
    />

    <fieldset v-if="formats.length > 1">
      <legend class="field-label">Format</legend>
      <div class="grid grid-cols-2 gap-2">
        <label
          v-for="f in formats"
          :key="f.value"
          class="cursor-pointer rounded-lg border px-3 py-2 text-sm"
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
      </div>
    </div>
  </div>
</template>
