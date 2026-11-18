<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Images, LoaderCircle } from '@lucide/vue'
import { ApiError, api } from '@/api/client'
import type { GalleryItem } from '@/api/types'
import GalleryCard from '@/components/GalleryCard.vue'

const PAGE_SIZE = 24

const items = shallowRef<GalleryItem[]>([])
const next = ref<string | null>(null)
const started = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const sentinel = ref<HTMLElement>()
let abort: AbortController | undefined
let observer: IntersectionObserver | undefined

async function load() {
  if (loading.value || (started.value && !next.value)) return
  loading.value = true
  error.value = null
  abort = new AbortController()
  try {
    const page = await api.galleryList(next.value, PAGE_SIZE, abort.signal)
    const seen = new Set(items.value.map((i) => i.id))
    items.value = [...items.value, ...page.items.filter((i) => !seen.has(i.id))]
    next.value = page.next
    started.value = true
  } catch (e) {
    if (abort.signal.aborted) return
    error.value =
      e instanceof ApiError && e.status === 503 ? 'The gallery is not available right now. Try again later.' : (e as Error).message
  } finally {
    loading.value = false
  }
  // Observing again reports the current state: a page that didn't fill the screen loads the next one.
  if (observer && sentinel.value && next.value && !error.value) {
    observer.unobserve(sentinel.value)
    observer.observe(sentinel.value)
  }
}

onMounted(load)

// Infinite scroll: the next page loads as the end of the grid comes near. The "Show more" button does the same.
watch(sentinel, (el) => {
  observer?.disconnect()
  if (!el || typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && !error.value && load(), {
    rootMargin: '600px',
  })
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  abort?.abort()
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <section class="max-w-3xl">
      <h1 class="text-3xl font-semibold tracking-tight">Gallery</h1>
      <p class="mt-3 text-ink-2">
        3D models made with Elevation API and shared by the people who made them. Open one to turn it around, download it, or
        generate it again with your own settings.
      </p>
      <p class="mt-2 text-sm text-ink-3">
        Share yours: make a glTF model on <RouterLink to="/terrain" class="text-accent hover:underline">Map to 3D</RouterLink> or
        <RouterLink to="/gpx" class="text-accent hover:underline">GPX to 3D</RouterLink>, then choose "Publish to gallery". Every
        model is reviewed before it appears here.
      </p>
    </section>

    <div v-if="items.length" class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <GalleryCard v-for="item in items" :key="item.id" :item="item" />
    </div>

    <div v-else-if="started && !error" class="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
      <Images class="mx-auto size-8 text-ink-3" />
      <p class="mt-3 font-medium">No models yet</p>
      <p class="mt-1 text-sm text-ink-3">Be the first: generate a model and publish it to the gallery.</p>
      <RouterLink to="/terrain" class="btn btn-primary mt-4">Start on the map</RouterLink>
    </div>

    <div v-if="error" role="alert" class="mt-8 flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
      {{ error }}
      <button type="button" class="btn btn-secondary" @click="load">Try again</button>
    </div>

    <div ref="sentinel" class="mt-8 flex justify-center" :class="{ hidden: started && !next }">
      <span v-if="loading" class="flex items-center gap-2 text-sm text-ink-3" role="status">
        <LoaderCircle class="size-4 animate-spin" /> Loading models…
      </span>
      <button v-else-if="next && !error" type="button" class="btn btn-secondary" @click="load">Show more</button>
    </div>
  </div>
</template>
