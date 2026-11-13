<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { LoaderCircle, MapPin, Search, X } from '@lucide/vue'
import { parseLatLon, searchPlaces, type Place } from '@/composables/geocoder'
import { useMap } from './mapContext'

const emit = defineEmits<{ select: [place: Place] }>()

const map = useMap()
const q = ref('')
const results = ref<Place[]>([])
const active = ref(-1)
const open = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const listId = `place-list-${Math.random().toString(36).slice(2, 8)}`

let timer: ReturnType<typeof setTimeout> | undefined
let controller: AbortController | undefined
/** Set when we write the chosen label into the input, so that doesn't trigger a new search. */
let skipNext = false

watch(q, (text) => {
  if (skipNext) {
    skipNext = false
    return
  }
  clearTimeout(timer)
  controller?.abort()
  error.value = null
  const trimmed = text.trim()
  const coord = parseLatLon(trimmed)
  if (coord) {
    results.value = [coord]
    active.value = 0
    open.value = true
    return
  }
  if (trimmed.length < 3) {
    results.value = []
    open.value = false
    return
  }
  timer = setTimeout(() => run(trimmed), 300)
})

async function run(text: string) {
  controller = new AbortController()
  busy.value = true
  try {
    const c = map.value?.getCenter()
    results.value = await searchPlaces(text, c ? { lon: c.lng, lat: c.lat } : null, controller.signal)
    active.value = results.value.length ? 0 : -1
    open.value = true
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      error.value = 'Search is unavailable right now.'
      open.value = true
    }
  } finally {
    busy.value = false
  }
}

function choose(place: Place) {
  const m = map.value
  if (m) {
    if (place.bounds) {
      const [w, s, e, n] = place.bounds
      m.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, maxZoom: 14, duration: 1200 },
      )
    } else {
      m.flyTo({ center: [place.lon, place.lat], zoom: Math.max(m.getZoom(), 13), duration: 1200 })
    }
  }
  clearTimeout(timer)
  controller?.abort()
  if (q.value !== place.label) skipNext = true
  q.value = place.label
  open.value = false
  emit('select', place)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!results.value.length) return
    e.preventDefault()
    open.value = true
    const n = results.value.length
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const pick = results.value[active.value] ?? results.value[0]
    if (pick) choose(pick)
    else if (q.value.trim().length >= 3) run(q.value.trim())
  } else if (e.key === 'Escape') {
    open.value = false
  }
}

function clear() {
  q.value = ''
  results.value = []
  open.value = false
}

const activeId = computed(() => (active.value >= 0 && open.value ? `${listId}-${active.value}` : undefined))

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <div class="relative">
    <label class="sr-only" :for="`${listId}-input`">Search for a place</label>
    <div class="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-md focus-within:border-accent">
      <LoaderCircle v-if="busy" class="size-4 shrink-0 animate-spin text-ink-3" />
      <Search v-else class="size-4 shrink-0 text-ink-3" />
      <input
        :id="`${listId}-input`"
        v-model="q"
        type="text"
        inputmode="search"
        enterkeyhint="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Search a place or lat, lon"
        class="h-10 w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        role="combobox"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="activeId"
        aria-autocomplete="list"
        @keydown="onKey"
        @focus="open = results.length > 0"
        @blur="open = false"
      />
      <button v-if="q" type="button" class="text-ink-3 hover:text-ink" aria-label="Clear search" @click="clear">
        <X class="size-4" />
      </button>
    </div>
    <ul
      v-show="open && (results.length || error)"
      :id="listId"
      role="listbox"
      class="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg"
    >
      <li v-if="error" class="px-3 py-2 text-sm text-danger">{{ error }}</li>
      <li v-else-if="!results.length" class="px-3 py-2 text-sm text-ink-3">No place found.</li>
      <li
        v-for="(r, i) in results"
        :id="`${listId}-${i}`"
        :key="r.id + i"
        role="option"
        :aria-selected="i === active"
        class="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm"
        :class="i === active ? 'bg-subtle' : ''"
        @mousedown.prevent="choose(r)"
        @mouseenter="active = i"
      >
        <MapPin class="mt-0.5 size-4 shrink-0 text-accent" />
        <span class="min-w-0">
          <span class="block truncate font-medium text-ink">{{ r.label }}</span>
          <span v-if="r.detail" class="block truncate text-xs text-ink-3">{{ r.detail }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>
