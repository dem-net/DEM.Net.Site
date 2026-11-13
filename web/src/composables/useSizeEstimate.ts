import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { api, MIN_MESH_DETAIL } from '@/api/client'
import type { BBox, ModelOptions, OsmOptions, SizeEstimate } from '@/api/types'

export interface EstimateInput {
  bbox: BBox
  options: ModelOptions
  osm: OsmOptions | null
}

/** Keep a little headroom under the limit, since the estimate is approximate. */
const FIT_MARGIN = 0.95

/**
 * Highest mesh detail (%) whose estimate fits under the limit, by linear interpolation
 * between the estimates at minimum and full detail (the server's estimate is linear in
 * meshReduceFactor). Returns null when even minimum detail is too large.
 */
export function detailToFit(minDetailMB: number, fullDetailMB: number, maxMB: number): number | null {
  const target = maxMB * FIT_MARGIN
  if (minDetailMB > target) return null
  if (fullDetailMB <= target) return 100
  const span = fullDetailMB - minDetailMB
  const d = MIN_MESH_DETAIL + ((100 - MIN_MESH_DETAIL) * (target - minDetailMB)) / span
  return Math.max(MIN_MESH_DETAIL, Math.min(100, Math.floor(d)))
}

/** Fields that change the generated file size (zFactor does not). */
function sizeKey(i: EstimateInput) {
  const o = i.options
  return JSON.stringify([i.bbox, o.dataset, o.format, o.textured, o.imageryProvider, o.textureQuality, o.generateTIN, o.meshDetail, i.osm])
}

/** Live, debounced server-side size estimate for a terrain model request. */
export function useSizeEstimate(source: () => EstimateInput | null) {
  const estimate = shallowRef<SizeEstimate | null>(null)
  /** Mesh detail that would fit under the limit (only computed when over it). */
  const fitDetail = ref<number | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  async function run(input: EstimateInput) {
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    loading.value = true
    error.value = null
    try {
      const e = await api.estimateTerrainSize(input.bbox, input.options, input.osm, signal)
      let fit: number | null = null
      if (!e.allowed) {
        const min = await api.estimateTerrainSize(
          input.bbox,
          { ...input.options, meshDetail: MIN_MESH_DETAIL },
          input.osm,
          signal,
        )
        fit = detailToFit(min.sizeMB, e.fullDetailMB, e.maxMB)
      }
      estimate.value = e
      fitDetail.value = fit
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      estimate.value = null
      error.value = (err as Error).message
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  watch(
    () => {
      const i = source()
      return i ? sizeKey(i) : null
    },
    (key) => {
      clearTimeout(timer)
      if (!key) {
        controller?.abort()
        estimate.value = null
        fitDetail.value = null
        loading.value = false
        return
      }
      loading.value = true
      timer = setTimeout(() => {
        const i = source()
        if (i) run(i)
      }, 300)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    clearTimeout(timer)
    controller?.abort()
  })

  const overLimit = computed(() => !!estimate.value && !estimate.value.allowed)

  return { estimate, fitDetail, loading, error, overLimit }
}
