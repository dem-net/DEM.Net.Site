import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { Dataset, ImageryProvider } from '@/api/types'

/** Dataset and imagery lists are fetched once per session and shared by every page. */
const datasets = ref<Dataset[]>([])
const imagery = ref<ImageryProvider[]>([])
const error = ref<string | null>(null)
let loading: Promise<void> | null = null

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

export const DEFAULT_DATASET = 'SRTM_GL3'
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
  }
}
