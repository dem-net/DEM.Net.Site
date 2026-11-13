<script setup lang="ts">
import { GeolocateControl, Map as MlMap, NavigationControl, ScaleControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre resolves its worker relative to its own module, which breaks once Vite bundles it:
// hand it the emitted worker file explicitly (works in dev and in production builds).
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

setWorkerUrl(workerUrl)
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { Layers, Mountain } from '@lucide/vue'
import { provideMap, type Basemap, type MapState, type MapView } from './mapContext'

const props = withDefaults(
  defineProps<{
    center?: [number, number]
    zoom?: number
    /** Initial state from a share link; each part overrides the default (or the saved basemap). */
    initial?: Partial<MapState>
  }>(),
  { center: () => [6.87, 45.92], zoom: 9, initial: () => ({}) },
)
const emit = defineEmits<{ ready: [map: MlMap] }>()

const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const DEM_SOURCE = 'dem'
const TOPO = 'opentopomap'

const container = ref<HTMLDivElement>()
const map = provideMap()
const basemap = ref<Basemap>(props.initial.basemap ?? (readPref('basemap', 'topo') as Basemap))
const terrain3d = ref(false)

function readPref(key: string, fallback: string) {
  try {
    return localStorage.getItem(`dem.${key}`) ?? fallback
  } catch {
    return fallback
  }
}
function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`dem.${key}`, value)
  } catch {
    /* storage unavailable */
  }
}

function firstSymbolLayer(m: MlMap) {
  return m.getStyle().layers.find((l) => l.type === 'symbol')?.id
}

/** Adds the extra layers once on top of the vector style; switching basemap only toggles visibility,
 *  so drawing layers added by child components are never wiped by setStyle(). */
function addExtraLayers(m: MlMap) {
  m.addSource(DEM_SOURCE, {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 14,
    attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS</a>',
  })
  m.addSource(TOPO, {
    type: 'raster',
    tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
    tileSize: 256,
    maxzoom: 17,
    attribution:
      'Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  })
  const beforeId = firstSymbolLayer(m)
  m.addLayer({ id: TOPO, type: 'raster', source: TOPO, layout: { visibility: 'none' } }, beforeId)
  m.addLayer(
    {
      id: 'hillshade',
      type: 'hillshade',
      source: DEM_SOURCE,
      paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#3d3d3d' },
    },
    beforeId,
  )
}

function applyBasemap(m: MlMap, b: Basemap) {
  m.setLayoutProperty(TOPO, 'visibility', b === 'topo' ? 'visible' : 'none')
  m.setLayoutProperty('hillshade', 'visibility', b === 'streets' ? 'visible' : 'none')
}

const TERRAIN = { source: DEM_SOURCE, exaggeration: 1.3 }

onMounted(() => {
  const view: MapView = props.initial.view ?? { center: props.center, zoom: props.zoom, bearing: 0, pitch: 0 }
  const m = new MlMap({
    container: container.value!,
    style: STREETS_STYLE,
    center: view.center,
    zoom: view.zoom,
    bearing: view.bearing,
    pitch: view.pitch,
    attributionControl: { compact: true },
    maxPitch: 75,
  })
  m.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
  m.addControl(new GeolocateControl({ fitBoundsOptions: { maxZoom: 12 } }), 'bottom-right')
  m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
  m.once('load', () => {
    addExtraLayers(m)
    applyBasemap(m, basemap.value)
    if (props.initial.relief) {
      // Applied directly so the shared pitch is kept (the toggle's watcher would tilt to 60°).
      m.setTerrain(TERRAIN)
      terrain3d.value = true
    }
    // Compact attribution starts expanded; on small screens it covers the map, so start collapsed.
    if (m.getContainer().clientWidth < 640) {
      m.getContainer().querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
    }
    map.value = m
    emit('ready', m)
  })
})

watch(basemap, (b) => {
  writePref('basemap', b)
  if (map.value) applyBasemap(map.value, b)
})

watch(terrain3d, (on) => {
  const m = map.value
  if (!m || on === !!m.getTerrain()) return
  if (on) {
    m.setTerrain(TERRAIN)
    if (m.getPitch() < 30) m.easeTo({ pitch: 60, duration: 800 })
  } else {
    m.setTerrain(null)
    m.easeTo({ pitch: 0, duration: 600 })
  }
})

/** Current camera, basemap and relief, for share links. Null until the map has loaded. */
function getState(): MapState | null {
  const m = map.value
  if (!m) return null
  const c = m.getCenter()
  return {
    view: { center: [c.lng, c.lat], zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch() },
    basemap: basemap.value,
    relief: terrain3d.value,
  }
}
defineExpose({ getState })

// onUnmounted (not onBeforeUnmount): children such as drawing tools detach from the map first.
onUnmounted(() => {
  map.value?.remove()
  map.value = null
})
</script>

<template>
  <div class="relative h-full w-full">
    <!-- Sized with h-full, not absolute+inset: MapLibre's CSS forces position:relative on this element. -->
    <div ref="container" class="h-full w-full" />
    <div class="absolute top-16 right-3 z-10 flex flex-col items-end gap-2 sm:top-3">
      <div class="flex overflow-hidden rounded-lg border border-line bg-surface shadow-sm" role="group" aria-label="Basemap">
        <button
          v-for="b in (['topo', 'streets'] as const)"
          :key="b"
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
          :class="basemap === b ? 'bg-accent text-on-accent' : 'text-ink-2 hover:bg-subtle'"
          :aria-pressed="basemap === b"
          @click="basemap = b"
        >
          <Layers v-if="b === 'topo'" class="size-3.5" />
          {{ b === 'topo' ? 'Topo' : 'Streets' }}
        </button>
      </div>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium shadow-sm"
        :class="terrain3d ? 'text-accent' : 'text-ink-2 hover:bg-subtle'"
        :aria-pressed="terrain3d"
        title="Tilt the map and show relief in 3D"
        @click="terrain3d = !terrain3d"
      >
        <Mountain class="size-3.5" /> 3D relief
      </button>
    </div>
    <div class="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3 sm:justify-start">
      <div class="pointer-events-auto w-full max-w-sm">
        <slot name="search" />
      </div>
    </div>
    <slot v-if="map" />
  </div>
</template>
