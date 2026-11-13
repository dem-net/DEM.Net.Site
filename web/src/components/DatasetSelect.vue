<script setup lang="ts">
import { computed } from 'vue'
import { useCatalog } from '@/composables/useCatalog'

const model = defineModel<string>({ required: true })
const { datasets, datasetByName } = useCatalog()
const selected = computed(() => datasetByName(model.value))
</script>

<template>
  <div>
    <label class="field-label" for="dataset">Elevation data</label>
    <select id="dataset" v-model="model" class="input" :disabled="!datasets.length">
      <option v-if="!datasets.length" :value="model">Loading datasets…</option>
      <option v-for="d in datasets" :key="d.name" :value="d.name">
        {{ d.name }} · {{ d.resolutionMeters }} m
      </option>
    </select>
    <p v-if="selected" class="mt-1 text-xs text-ink-3">
      {{ selected.description }}
      <a v-if="selected.publicUrl" :href="selected.publicUrl" target="_blank" rel="noopener noreferrer" class="underline">Source</a>
    </p>
  </div>
</template>
