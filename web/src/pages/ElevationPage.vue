<script setup lang="ts">
import { Marker, type Map as MlMap, type MapMouseEvent } from 'maplibre-gl'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoaderCircle, MapPin, Spline, Trash2 } from '@lucide/vue'
import { api } from '@/api/client'
import type { ElevationResponse, GeoPoint } from '@/api/types'
import AddressSearch from '@/components/map/AddressSearch.vue'
import BaseMap from '@/components/map/BaseMap.vue'
import { createDraw } from '@/components/map/createDraw'
import DatasetSelect from '@/components/DatasetSelect.vue'
import ElevationProfile from '@/components/ElevationProfile.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { DEFAULT_DATASET, useCatalog } from '@/composables/useCatalog'

type Mode = 'point' | 'line'

const route = useRoute()
const router = useRouter()
const { datasetByName } = useCatalog()

const mode = ref<Mode>(route.query.mode === 'line' ? 'line' : 'point')
const dataset = ref(DEFAULT_DATASET)
const reduce = ref(50)
const busy = ref(false)
const error = ref<string | null>(null)

const point = shallowRef<{ lat: number; lon: number } | null>(null)
const pointResult = shallowRef<ElevationResponse | null>(null)
const line = shallowRef<GeoJSON.LineString | null>(null)
const lineResult = shallowRef<ElevationResponse | null>(null)

let map: MlMap | null = null
let draw: ReturnType<typeof createDraw> | null = null
const drawing = ref(false)
const pin = new Marker({ color: '#2f6f4f' })
const cursor = new Marker({ color: '#d97706', scale: 0.7 })

watch(mode, (m) => {
  router.replace({ query: { ...route.query, mode: m } })
  error.value = null
  if (m === 'point') {
    draw?.clear()
    drawing.value = false
  } else {
    pin.remove()
    cursor.remove()
  }
})

function onReady(m: MlMap) {
  map = m
  draw = createDraw(m, 'linestring', (f) => {
    drawing.value = false
    line.value = f && f.geometry.type === 'LineString' ? (f.geometry as GeoJSON.LineString) : null
  })
  m.on('click', onMapClick)
}

function onMapClick(e: MapMouseEvent) {
  if (mode.value !== 'point' || !map) return
  point.value = { lat: e.lngLat.lat, lon: e.lngLat.lng }
  pin.setLngLat(e.lngLat).addTo(map)
}

async function guarded<T>(fn: () => Promise<T>): Promise<T | null> {
  busy.value = true
  error.value = null
  try {
    return await fn()
  } catch (e) {
    error.value = (e as Error).message
    return null
  } finally {
    busy.value = false
  }
}

watch([point, dataset], async ([p, ds]) => {
  if (!p) return
  pointResult.value = await guarded(() => api.pointElevation(p.lat, p.lon, ds))
})

watch([line, dataset, reduce], async ([l, ds, r]) => {
  cursor.remove()
  if (!l || l.coordinates.length < 2) {
    lineResult.value = null
    return
  }
  lineResult.value = await guarded(() => api.lineElevation(l, ds, r))
})

function startLine() {
  draw?.startDrawing()
  drawing.value = true
  lineResult.value = null
}

function clearLine() {
  draw?.clear()
  drawing.value = false
}

function onProfileHover(p: GeoPoint | null) {
  if (!map) return
  if (!p) cursor.remove()
  else cursor.setLngLat([p.longitude, p.latitude]).addTo(map)
}

const pointElevation = computed(() => pointResult.value?.geoPoints[0]?.elevation)
const metrics = computed(() => lineResult.value?.metrics)
const datasetLabel = computed(() => datasetByName(dataset.value)?.attribution.text)
const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`)

onBeforeUnmount(() => {
  map?.off('click', onMapClick)
  draw?.destroy()
  pin.remove()
  cursor.remove()
})
</script>

<template>
  <ToolLayout title="Elevation" subtitle="Get the elevation of any point, or the profile of a path.">
    <template #panel>
      <div class="mb-5 grid grid-cols-2 rounded-lg bg-subtle p-1" role="tablist">
        <button
          v-for="m in (['point', 'line'] as const)"
          :key="m"
          type="button"
          role="tab"
          :aria-selected="mode === m"
          class="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium"
          :class="mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'"
          @click="mode = m"
        >
          <MapPin v-if="m === 'point'" class="size-4" />
          <Spline v-else class="size-4" />
          {{ m === 'point' ? 'Point' : 'Profile' }}
        </button>
      </div>

      <div class="space-y-5">
        <DatasetSelect v-model="dataset" />

        <template v-if="mode === 'point'">
          <div v-if="!point" class="rounded-lg border border-dashed border-line p-4 text-center text-sm text-ink-3">
            Click anywhere on the map.
          </div>
          <div v-else class="card p-4">
            <p class="field-label">Elevation</p>
            <p class="flex items-baseline gap-2 text-3xl font-semibold tabular-nums">
              <LoaderCircle v-if="busy" class="size-5 animate-spin self-center text-accent" />
              <template v-else-if="pointElevation !== undefined">{{ Math.round(pointElevation) }} <span class="text-base font-normal text-ink-3">m</span></template>
              <template v-else>–</template>
            </p>
            <p class="mt-2 text-xs text-ink-3 tabular-nums">{{ point.lat.toFixed(5) }}, {{ point.lon.toFixed(5) }}</p>
            <p v-if="datasetLabel" class="mt-1 text-xs text-ink-3">Source: {{ datasetLabel }}</p>
          </div>
        </template>

        <template v-else>
          <div class="flex gap-2">
            <button type="button" class="btn btn-secondary flex-1" :class="drawing ? 'border-accent text-accent' : ''" @click="startLine">
              <Spline class="size-4" /> {{ line ? 'Draw a new path' : 'Draw a path' }}
            </button>
            <button v-if="line" type="button" class="btn btn-secondary" aria-label="Remove path" @click="clearLine">
              <Trash2 class="size-4" />
            </button>
          </div>
          <p v-if="drawing" class="text-xs text-ink-3">Click to add points, click the last point again to finish.</p>
          <p v-else-if="line" class="text-xs text-ink-3">Drag the points to reshape the path.</p>

          <div>
            <label class="field-label" for="reduce">Simplify · {{ reduce }} m</label>
            <input id="reduce" v-model.number="reduce" type="range" min="0" max="500" step="10" class="w-full accent-[var(--c-accent)]" />
          </div>

          <div v-if="busy" class="flex items-center gap-2 text-sm text-ink-3">
            <LoaderCircle class="size-4 animate-spin text-accent" /> Computing profile…
          </div>
          <template v-else-if="lineResult && metrics">
            <ElevationProfile :points="lineResult.geoPoints" @hover="onProfileHover" />
            <dl class="grid grid-cols-2 gap-2 text-sm">
              <div class="rounded-lg bg-subtle p-2"><dt class="text-xs text-ink-3">Distance</dt><dd class="font-semibold tabular-nums">{{ fmtKm(metrics.distance) }}</dd></div>
              <div class="rounded-lg bg-subtle p-2"><dt class="text-xs text-ink-3">Min / max</dt><dd class="font-semibold tabular-nums">{{ Math.round(metrics.minElevation) }} / {{ Math.round(metrics.maxElevation) }} m</dd></div>
              <div class="rounded-lg bg-subtle p-2"><dt class="text-xs text-ink-3">Climb</dt><dd class="font-semibold tabular-nums">+{{ Math.round(metrics.climb) }} m</dd></div>
              <div class="rounded-lg bg-subtle p-2"><dt class="text-xs text-ink-3">Descent</dt><dd class="font-semibold tabular-nums">{{ Math.round(metrics.descent) }} m</dd></div>
            </dl>
          </template>
        </template>

        <p v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>
      </div>
    </template>

    <template #map>
      <BaseMap :class="mode === 'point' ? '[&_canvas]:cursor-crosshair' : ''" @ready="onReady">
        <template #search><AddressSearch /></template>
      </BaseMap>
    </template>
  </ToolLayout>
</template>
