<script setup lang="ts">
import { useCatalog } from '@/composables/useCatalog'

/** Imagery provider and texture quality (number of imagery tiles), shared by Map to 3D and Textures. */
const provider = defineModel<string>('provider', { required: true })
const quality = defineModel<1 | 2 | 3>('quality', { required: true })

const { imagery } = useCatalog()
const qualityLabels = { 1: 'Low', 2: 'Medium', 3: 'High' } as const
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="field-label" for="imagery">Imagery</label>
      <select id="imagery" v-model="provider" class="input">
        <option v-for="p in imagery" :key="p.name" :value="p.name">{{ p.attribution?.text || p.name }}</option>
      </select>
    </div>
    <div>
      <label class="field-label" for="quality">Texture quality</label>
      <input
        id="quality"
        v-model.number="quality"
        type="range"
        min="1"
        max="3"
        step="1"
        class="w-full accent-[var(--c-accent)]"
        :aria-valuetext="qualityLabels[quality]"
        aria-describedby="quality-hint"
      />
      <!-- Tick labels under the slider, as in the previous site; clicking one selects it. -->
      <div class="mt-0.5 grid grid-cols-3 text-xs" aria-hidden="true">
        <button
          v-for="q in ([1, 2, 3] as const)"
          :key="q"
          type="button"
          tabindex="-1"
          class="hover:text-ink"
          :class="[
            q === 1 ? 'text-left' : q === 2 ? 'text-center' : 'text-right',
            quality === q ? 'font-medium text-ink' : 'text-ink-3',
          ]"
          @click="quality = q"
        >
          {{ qualityLabels[q] }}
        </button>
      </div>
      <p id="quality-hint" class="mt-1 text-xs text-ink-3">Higher quality means sharper imagery, bigger files and longer generation.</p>
    </div>
  </div>
</template>
