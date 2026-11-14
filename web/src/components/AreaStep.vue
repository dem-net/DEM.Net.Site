<script setup lang="ts">
import { Crosshair, Scan, Trash2 } from '@lucide/vue'
import StepBlock from './StepBlock.vue'
import type { useAreaPicker } from '@/composables/useAreaPicker'

/** Step 1 of the bbox tools: draw a rectangle or use the map view. */
defineProps<{ area: ReturnType<typeof useAreaPicker>; n?: number }>()
</script>

<template>
  <StepBlock :n="n ?? 1" title="Choose an area" :done="!!area.bbox.value">
    <div class="grid grid-cols-2 gap-2">
      <button type="button" class="btn btn-secondary" :class="area.isDrawing.value ? 'border-accent text-accent' : ''" @click="area.startDrawing()">
        <Scan class="size-4" /> Draw area
      </button>
      <button type="button" class="btn btn-secondary" @click="area.useView()">
        <Crosshair class="size-4" /> Use map view
      </button>
    </div>
    <p v-if="area.isDrawing.value" class="mt-2 text-xs text-ink-3">Click and drag on the map to draw a rectangle.</p>
    <div v-else-if="area.bbox.value" class="mt-2 flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
      <span>
        {{ area.sizeLabel.value }}
        <span class="block text-xs text-ink-3">Drag the corners to adjust</span>
      </span>
      <button type="button" class="p-1 text-ink-3 hover:text-danger" aria-label="Remove area" @click="area.clear()">
        <Trash2 class="size-4" />
      </button>
    </div>
    <p v-else class="mt-2 text-xs text-ink-3">Search a place on the map, then draw a rectangle around it.</p>
  </StepBlock>
</template>
