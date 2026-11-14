import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { api } from '@/api/client'
import type { BBox, TextureEstimate, TextureKind, TextureOptions } from '@/api/types'

export interface TextureEstimateInput {
  bbox: BBox
  options: TextureOptions
}

/** Fields that change the image sizes. */
export function textureKey(i: TextureEstimateInput): string {
  return JSON.stringify([i.bbox, i.options.dataset, i.options.imageryProvider, i.options.textureQuality])
}

/**
 * Images are estimated in two requests: the texture depends on the imagery provider (which can fail, e.g. a
 * provider without token), the normal map and height map only on the dataset. One failing keeps the other.
 */
const GROUPS: readonly (readonly TextureKind[])[] = [['texture'], ['normalmap', 'heightmap']]

/** Live, debounced server-side size estimate of every image, with an error per image. */
export function useTextureEstimate(source: () => TextureEstimateInput | null) {
  const estimates = shallowRef<Partial<Record<TextureKind, TextureEstimate>>>({})
  const errors = shallowRef<Partial<Record<TextureKind, string>>>({})
  const maxMB = ref<number | null>(null)
  const loading = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  async function run(input: TextureEstimateInput) {
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    loading.value = true
    const results = await Promise.allSettled(GROUPS.map((kinds) => api.estimateTextures(input.bbox, input.options, kinds, signal)))
    if (signal.aborted) return
    const est: Partial<Record<TextureKind, TextureEstimate>> = {}
    const err: Partial<Record<TextureKind, string>> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        for (const e of r.value.estimates) est[e.kind] = e
        maxMB.value = r.value.maxMB
      } else {
        for (const k of GROUPS[i]) err[k] = (r.reason as Error).message
      }
    })
    estimates.value = est
    errors.value = err
    loading.value = false
  }

  watch(
    () => {
      const i = source()
      return i ? textureKey(i) : null
    },
    (key) => {
      clearTimeout(timer)
      if (!key) {
        controller?.abort()
        estimates.value = {}
        errors.value = {}
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

  return { estimates, errors, maxMB, loading }
}
