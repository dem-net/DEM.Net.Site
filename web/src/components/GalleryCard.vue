<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import type { GalleryItem } from '@/api/types'
import { GALLERY_KIND_LABELS } from '@/composables/gallery'

/** A published model in the grid: its poster, and its turntable while hovered or focused. */
const props = defineProps<{ item: GalleryItem }>()

const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
/** The video is only created while wanted: a page of cards must not download every clip. */
const wanted = ref(false)
const playing = ref(false)

function start(e: Event) {
  if (reducedMotion || !props.item.clipUrl) return
  if (e instanceof PointerEvent && e.pointerType !== 'mouse') return // touch: a tap opens the model
  wanted.value = true
}

function stop() {
  wanted.value = false
  playing.value = false
}
</script>

<template>
  <RouterLink
    :to="`/gallery/${item.id}`"
    class="card group block overflow-hidden transition-colors hover:border-accent focus-visible:border-accent"
    @pointerenter="start"
    @pointerleave="stop"
    @focus="start"
    @blur="stop"
  >
    <div class="relative aspect-[4/3] bg-[#e9ebe6]">
      <img :src="item.posterUrl" :alt="`${item.title}, 3D model`" class="size-full object-cover" loading="lazy" decoding="async" />
      <video
        v-if="wanted && item.clipUrl"
        :src="item.clipUrl"
        class="absolute inset-0 size-full object-cover transition-opacity duration-300"
        :class="playing ? 'opacity-100' : 'opacity-0'"
        muted
        loop
        autoplay
        playsinline
        preload="auto"
        aria-hidden="true"
        @playing="playing = true"
      />
    </div>
    <div class="p-3">
      <h2 class="truncate font-semibold" :title="item.title">{{ item.title }}</h2>
      <p class="mt-0.5 truncate text-xs text-ink-3">
        <span v-if="item.place">{{ item.place }} · </span>{{ GALLERY_KIND_LABELS[item.kind] }}
        <span v-if="item.pseudonym"> · by {{ item.pseudonym }}</span>
      </p>
    </div>
  </RouterLink>
</template>
