import { computed, ref, shallowRef } from 'vue'
import { ensureConnected, useProgress } from '@/api/hub'
import type { ModelResult } from '@/api/types'

/** Runs a model generation request with server progress, cancellation and error state. */
export function useGenerate() {
  const { progress, reset } = useProgress('generate')
  const busy = ref(false)
  const error = ref<string | null>(null)
  const result = shallowRef<ModelResult | null>(null)
  let controller: AbortController | null = null

  async function run(call: (connectionId: string | null, signal: AbortSignal) => Promise<ModelResult>) {
    controller?.abort()
    controller = new AbortController()
    busy.value = true
    error.value = null
    result.value = null
    reset()
    try {
      const id = await ensureConnected()
      result.value = await call(id, controller.signal)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') error.value = (e as Error).message
    } finally {
      busy.value = false
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  const status = computed(() => progress.value?.message ?? 'Sending request…')
  const percent = computed(() => progress.value?.percent ?? 0)

  return { run, cancel, busy, error, result, status, percent }
}
