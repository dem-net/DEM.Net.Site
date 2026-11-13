<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Check, Share2, X } from '@lucide/vue'

/**
 * Copies a link to the clipboard; on touch devices, opens the system share sheet instead.
 * If the clipboard is unavailable, shows the link in a field to copy by hand.
 */
const props = defineProps<{ getUrl: () => string; title?: string }>()

const copied = ref(false)
const manualUrl = ref<string | null>(null)
const manualInput = ref<HTMLInputElement>()
let timer: ReturnType<typeof setTimeout> | undefined

async function share() {
  const url = props.getUrl()
  manualUrl.value = null
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ url, title: props.title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // closed by the user
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied.value = false), 2500)
  } catch {
    manualUrl.value = url
    await nextTick()
    manualInput.value?.select()
  }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="relative shrink-0">
    <button
      type="button"
      class="btn btn-secondary px-2.5 py-1.5 text-xs"
      title="Copy a link to this map view and these settings"
      @click="share"
    >
      <Check v-if="copied" class="size-3.5 text-accent" aria-hidden="true" />
      <Share2 v-else class="size-3.5" aria-hidden="true" />
      {{ copied ? 'Link copied' : 'Share' }}
    </button>
    <span class="sr-only" aria-live="polite">{{ copied ? 'Link copied to the clipboard' : '' }}</span>

    <div
      v-if="manualUrl"
      class="card absolute top-full right-0 z-30 mt-2 w-72 p-3 shadow-lg"
      role="dialog"
      aria-label="Link to share"
    >
      <div class="mb-1.5 flex items-center justify-between">
        <label for="share-url" class="field-label mb-0">Copy this link</label>
        <button type="button" class="p-1 text-ink-3 hover:text-ink" aria-label="Close" @click="manualUrl = null">
          <X class="size-3.5" />
        </button>
      </div>
      <input id="share-url" ref="manualInput" :value="manualUrl" readonly class="input text-xs" @focus="manualInput?.select()" />
    </div>
  </div>
</template>
