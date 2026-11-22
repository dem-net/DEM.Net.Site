import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Dataset, ImageryProvider } from '@/api/types'

/** Dataset and imagery lists are fetched once per session and shared by every page. */
const datasets = ref<Dataset[]>([])
const imagery = ref<ImageryProvider[]>([])
const error = ref<string | null>(null)
let loading: Promise<void> | null = null
const labels = computed(() => imageryLabels(imagery.value))

function load() {
  loading ??= Promise.all([api.datasets(), api.imagery()])
    .then(([d, i]) => {
      datasets.value = d.filter((x) => x.isListed !== false)
      imagery.value = i.filter((x) => !x.privateUseOnly)
      error.value = null
    })
    .catch((e: Error) => {
      error.value = e.message
      loading = null
    })
  return loading
}

/**
 * Display label for each imagery provider: its attribution text, or its name when that text is shared by several
 * providers (the three Thunderforest styles are all credited "ThunderForest").
 */
export function imageryLabels(list: ImageryProvider[]): Map<string, string> {
  const count = new Map<string, number>()
  for (const p of list) if (p.attribution?.text) count.set(p.attribution.text, (count.get(p.attribution.text) ?? 0) + 1)
  return new Map(
    list.map((p) => {
      const text = p.attribution?.text
      return [p.name, text && count.get(text) === 1 ? text : p.name.replace(/-/g, ' ')]
    }),
  )
}

export const DEFAULT_DATASET = 'Mapterhorn'
export const DEFAULT_IMAGERY = 'MapBox-SatelliteStreet'

export function useCatalog() {
  load()
  return {
    datasets,
    imagery,
    error,
    retry: load,
    loaded: computed(() => datasets.value.length > 0),
    datasetByName: (name: string) => datasets.value.find((d) => d.name === name),
    imageryByName: (name: string) => imagery.value.find((i) => i.name === name),
    imageryLabel: (name: string) => labels.value.get(name) ?? name,
  }
}
