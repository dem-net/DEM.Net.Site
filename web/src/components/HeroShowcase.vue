<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import type { GalleryItem } from '@/api/types'
import cover from '@/assets/DEMNet-cover.jpg'

/**
 * Home page hero: the latest published gallery models, each playing its 4 s turntable once before the next one fades
 * in. Only the current clip is loaded, and only while the hero is on screen. With reduced motion: posters only, no
 * auto-advance. If the gallery can't be read or is empty, a static cover is shown instead.
 */
const COUNT = 6
/** How long a model without a clip (or whose clip failed) stays on screen. */
const STILL_MS = 4000

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

const items = ref<GalleryItem[]>([])
const state = ref<'loading' | 'ready' | 'fallback'>('loading')
const index = ref(0)
const visible = ref(false)
const playing = ref(false)
const clipFailed = ref(false)

const current = computed(() => items.value[index.value] ?? null)
const showClip = computed(() => !reducedMotion && visible.value && !clipFailed.value && !!current.value?.clipUrl)

const root = ref<HTMLElement>()
const video = ref<HTMLVideoElement>()
let observer: IntersectionObserver | undefined
let timer: ReturnType<typeof setTimeout> | undefined
const abort = new AbortController()

onMounted(async () => {
  if (root.value && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => (visible.value = entries.some((e) => e.isIntersecting)))
    observer.observe(root.value)
  } else {
    visible.value = true
  }
  try {
    const page = await api.galleryList(null, COUNT, abort.signal)
    items.value = page.items
    state.value = page.items.length ? 'ready' : 'fallback'
  } catch {
    if (!abort.signal.aborted) state.value = 'fallback'
  }
})

onBeforeUnmount(() => {
  abort.abort()
  observer?.disconnect()
  clearTimeout(timer)
})

function next() {
  if (items.value.length > 1) go((index.value + 1) % items.value.length)
  else video.value?.play().catch(() => {}) // a single model: replay its turntable
}

function go(i: number) {
  clearTimeout(timer)
  playing.value = false
  clipFailed.value = false
  index.value = i
}

/** Models shown as a still (no clip, failed clip) advance on a timer; clips advance when they end. */
function schedule() {
  clearTimeout(timer)
  if (reducedMotion || !visible.value || state.value !== 'ready' || showClip.value) return
  timer = setTimeout(next, STILL_MS)
}
watch([index, visible, state, showClip], schedule)

// Off screen: the clip element is removed (and stops downloading); back on screen, the current model plays again.
watch(visible, (v) => {
  if (!v) playing.value = false
})

/** Posters around the current one, so the next fade has its image ready. */
function posterWanted(i: number) {
  const n = items.value.length
  return i === index.value || i === (index.value + 1) % n
}
</script>

<template>
  <div ref="root" class="relative aspect-[4/3] overflow-hidden rounded-2xl bg-subtle shadow-lg">
    <img
      v-if="state === 'fallback'"
      :src="cover"
      alt="A 3D terrain model generated with the Elevation API"
      class="size-full object-cover"
    />

    <template v-else-if="state === 'ready' && current">
      <RouterLink
        :to="`/gallery/${current.id}`"
        class="absolute inset-0 block bg-[#e9ebe6]"
        :aria-label="`${current.title}, in the gallery`"
      >
        <template v-for="(item, i) in items" :key="item.id">
          <img
            v-if="posterWanted(i)"
            :src="item.posterUrl"
            :alt="i === index ? `${item.title}, 3D model` : ''"
            class="absolute inset-0 size-full object-cover"
            :class="[i === index ? 'opacity-100' : 'opacity-0', reducedMotion ? '' : 'transition-opacity duration-700']"
            decoding="async"
          />
        </template>
        <video
          v-if="showClip"
          ref="video"
          :key="current.id"
          :src="current.clipUrl!"
          class="absolute inset-0 size-full object-cover transition-opacity duration-300"
          :class="playing ? 'opacity-100' : 'opacity-0'"
          muted
          autoplay
          playsinline
          preload="auto"
          aria-hidden="true"
          @playing="playing = true"
          @ended="next"
          @error="clipFailed = true"
        />
      </RouterLink>

      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12 text-white"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold" :title="current.title">{{ current.title }}</p>
          <p class="truncate text-xs text-white/80">
            <span v-if="current.place">{{ current.place }}</span>
            <span v-if="current.place && current.pseudonym"> · </span>
            <span v-if="current.pseudonym">by {{ current.pseudonym }}</span>
          </p>
        </div>
        <div v-if="items.length > 1" class="pointer-events-auto flex shrink-0 gap-1">
          <button
            v-for="(item, i) in items"
            :key="item.id"
            type="button"
            class="grid size-6 place-items-center rounded-full"
            :aria-label="`Show ${item.title}`"
            :aria-current="i === index"
            @click="go(i)"
          >
            <span class="size-2 rounded-full bg-white transition-opacity" :class="i === index ? 'opacity-100' : 'opacity-50'" />
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
