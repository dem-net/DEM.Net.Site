<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MapPinned, TriangleAlert, X } from '@lucide/vue'
import type { ModelOptions } from '@/api/types'
import { useCatalog } from '@/composables/useCatalog'
import { datasetRegion, imageryRegion, SWISS_COUNTRIES } from '@/composables/region'

/**
 * - Inside Switzerland: offer swisstopo's high-resolution data in one click.
 * - Regional dataset/imagery used outside its country: warn.
 * Based on the country at the centre of the area, so an area straddling a border may be misjudged.
 */
const options = defineModel<ModelOptions>({ required: true })
const props = defineProps<{ country: string | null }>()

const { datasets, imagery, datasetByName } = useCatalog()
const dismissed = ref(false)
watch(() => props.country, () => (dismissed.value = false))

const usesTexture = computed(() => options.value.format === 'glTF' && options.value.textured)

const swissDataset = computed(() => {
  const swiss = datasets.value.filter((d) => d.extentInfo === 'Switzerland')
  // Prefer the 2 m model: 50 cm quickly exceeds the size limit.
  return swiss.find((d) => /2\s*m/i.test(d.name)) ?? swiss[0]
})
const swissImagery = computed(() => imagery.value.find((i) => imageryRegion(i.name)?.name === 'Switzerland'))

const inSwitzerland = computed(() => !!props.country && SWISS_COUNTRIES.includes(props.country))

const suggestion = computed(() => {
  if (!inSwitzerland.value || dismissed.value || !swissDataset.value) return null
  const needDataset = datasetRegion(datasetByName(options.value.dataset))?.name !== 'Switzerland'
  const needImagery = usesTexture.value && !!swissImagery.value && options.value.imageryProvider !== swissImagery.value.name
  if (!needDataset && !needImagery) return null
  return { needDataset, needImagery }
})

function useSwissData() {
  if (suggestion.value?.needDataset && swissDataset.value) options.value.dataset = swissDataset.value.name
  if (suggestion.value?.needImagery && swissImagery.value) options.value.imageryProvider = swissImagery.value.name
}

const outOfRegion = computed(() => {
  if (!props.country) return []
  const issues: string[] = []
  const dr = datasetRegion(datasetByName(options.value.dataset))
  if (dr && !dr.countries.includes(props.country)) issues.push(`${options.value.dataset} elevation data only covers ${dr.name}`)
  const ir = usesTexture.value ? imageryRegion(options.value.imageryProvider) : null
  if (ir && !ir.countries.includes(props.country)) issues.push(`this imagery only covers ${ir.name}`)
  return issues
})
</script>

<template>
  <div v-if="suggestion" class="relative rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm" role="status">
    <button type="button" class="absolute top-2 right-2 text-ink-3 hover:text-ink" aria-label="Dismiss suggestion" @click="dismissed = true">
      <X class="size-4" />
    </button>
    <p class="flex items-center gap-1.5 pr-5 font-medium"><MapPinned class="size-4 text-accent" /> This area is in Switzerland</p>
    <p class="mt-1 text-xs text-ink-2">
      swisstopo has much more precise data here:
      <template v-if="suggestion.needDataset">{{ swissDataset?.name }} elevation</template>
      <template v-if="suggestion.needDataset && suggestion.needImagery"> and </template>
      <template v-if="suggestion.needImagery">SwissImage aerial imagery</template>.
    </p>
    <button type="button" class="btn btn-primary mt-2 w-full py-1.5" @click="useSwissData">Use Swiss data</button>
  </div>
  <p v-else-if="outOfRegion.length" class="flex gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn" role="alert">
    <TriangleAlert class="size-4 shrink-0" />
    <span>This area is outside the coverage: {{ outOfRegion.join(', and ') }}. Choose a global option for this area.</span>
  </p>
</template>
