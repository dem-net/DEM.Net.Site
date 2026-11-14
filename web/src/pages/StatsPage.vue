<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { LngLatBounds, Popup, type Map as MlMap, type MapMouseEvent } from 'maplibre-gl'
import { LoaderCircle, RotateCw } from '@lucide/vue'
import { api } from '@/api/client'
import type { GenerationStats } from '@/api/types'
import BaseMap from '@/components/map/BaseMap.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { useCatalog } from '@/composables/useCatalog'
import {
  datasetColors,
  datasetFeatures,
  formatBytes,
  formatDate,
  KIND_LABELS,
  totals,
  totalsByDataset,
} from '@/composables/generationStats'

const { datasetByName } = useCatalog()

const stats = shallowRef<GenerationStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    stats.value = await api.generationStats()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const gens = computed(() => stats.value?.generations ?? [])
const all = computed(() => totals(gens.value))
const byDataset = computed(() => totalsByDataset(gens.value))
const colors = computed(() => datasetColors(byDataset.value.map((d) => d.dataset)))
const maxCount = computed(() => byDataset.value[0]?.count ?? 1)

const hidden = reactive(new Set<string>())
const toggle = (d: string) => (hidden.has(d) ? hidden.delete(d) : hidden.add(d))
const showAll = () => hidden.clear()
const hideAll = () => byDataset.value.forEach((d) => hidden.add(d.dataset))

const fmtInt = (n: number) => n.toLocaleString('en')
const updatedAt = computed(() => {
  const d = stats.value ? new Date(stats.value.updatedAt) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null
})
function resolution(dataset: string) {
  const m = datasetByName(dataset)?.resolutionMeters
  return m === undefined ? null : m >= 1000 ? `${+(m / 1000).toFixed(1)} km` : `${m} m`
}

// ---------- Map: one source pair and three layers per dataset ----------

const map = shallowRef<MlMap | null>(null)
/** Layer ids per dataset, for visibility toggles and click queries. */
let layersByDataset = new Map<string, string[]>()
let popup: Popup | null = null

function clearLayers(m: MlMap) {
  for (const [, ids] of layersByDataset) ids.forEach((id) => m.getLayer(id) && m.removeLayer(id))
  for (const id of Object.keys(m.getStyle().sources)) if (id.startsWith('gen-')) m.removeSource(id)
  layersByDataset = new Map()
}

function render() {
  const m = map.value
  if (!m || !stats.value) return
  clearLayers(m)
  // Most used first, so the smaller datasets are drawn on top of them.
  byDataset.value.forEach(({ dataset }, n) => {
    const color = colors.value.get(dataset)!
    const { footprints, centres } = datasetFeatures(gens.value, dataset)
    const fp = `gen-${n}-fp`
    const pt = `gen-${n}-pt`
    m.addSource(fp, { type: 'geojson', data: footprints })
    m.addSource(pt, { type: 'geojson', data: centres })
    const visibility = hidden.has(dataset) ? 'none' : 'visible'
    m.addLayer({
      id: `${fp}-fill`,
      type: 'fill',
      source: fp,
      layout: { visibility },
      paint: { 'fill-color': color, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.06, 10, 0.2] },
    })
    m.addLayer({
      id: `${fp}-line`,
      type: 'line',
      source: fp,
      layout: { visibility },
      paint: {
        'line-color': color,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.75, 10, 1.75],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 0.95],
      },
    })
    // Centres keep small areas visible at world zoom, and fade out once footprints are readable.
    m.addLayer({
      id: `${pt}-circle`,
      type: 'circle',
      source: pt,
      layout: { visibility },
      paint: {
        'circle-color': color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 8, 4.5],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 10, 0],
        'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 10, 0],
      },
    })
    layersByDataset.set(dataset, [`${fp}-fill`, `${fp}-line`, `${pt}-circle`])
  })
}

function onReady(m: MlMap) {
  map.value = m
  render()
  m.on('click', onClick)
  m.on('mousemove', (e) => {
    m.getCanvas().style.cursor = featuresAt(e).length ? 'pointer' : ''
  })
}

watch(stats, render)
watch(
  () => [...hidden],
  () => {
    const m = map.value
    if (!m) return
    for (const [dataset, ids] of layersByDataset) {
      for (const id of ids) m.setLayoutProperty(id, 'visibility', hidden.has(dataset) ? 'none' : 'visible')
    }
    popup?.remove()
  },
)

/** Generation indexes under the pointer (a few pixels of slack), newest first. */
function featuresAt(e: MapMouseEvent): number[] {
  const m = map.value!
  const layers = [...layersByDataset.entries()].filter(([d]) => !hidden.has(d)).flatMap(([, ids]) => ids)
  if (!layers.length) return []
  const r = 4
  const box: [[number, number], [number, number]] = [
    [e.point.x - r, e.point.y - r],
    [e.point.x + r, e.point.y + r],
  ]
  const ids = new Set(m.queryRenderedFeatures(box, { layers }).map((f) => f.properties.i as number))
  return [...ids].sort((a, b) => gens.value[b].date.localeCompare(gens.value[a].date) || b - a)
}

const POPUP_ROWS = 6

function onClick(e: MapMouseEvent) {
  const found = featuresAt(e)
  popup?.remove()
  if (!found.length) return
  // Built with textContent: dataset names and formats come from the API.
  const root = document.createElement('div')
  root.className = 'space-y-2 text-xs'
  const title = document.createElement('div')
  title.className = 'font-semibold text-ink'
  title.textContent = found.length === 1 ? '1 generation here' : `${fmtInt(found.length)} generations here`
  root.append(title)
  const list = document.createElement('ul')
  list.className = 'space-y-1.5'
  for (const i of found.slice(0, POPUP_ROWS)) {
    const g = gens.value[i]
    const li = document.createElement('li')
    li.className = 'flex items-start gap-2'
    const swatch = document.createElement('span')
    swatch.className = 'mt-0.5 size-2.5 shrink-0 rounded-sm'
    swatch.style.background = colors.value.get(g.dataset) ?? ''
    const text = document.createElement('span')
    const name = document.createElement('span')
    name.className = 'block font-medium text-ink'
    name.textContent = `${g.dataset} · ${KIND_LABELS[g.kind]}`
    const detail = document.createElement('span')
    detail.className = 'block text-ink-3'
    detail.textContent = [g.format.replaceAll(',', ', '), g.sizeBytes !== null ? formatBytes(g.sizeBytes) : null, formatDate(g.date)]
      .filter(Boolean)
      .join(' · ')
    text.append(name, detail)
    li.append(swatch, text)
    list.append(li)
  }
  root.append(list)
  if (found.length > POPUP_ROWS) {
    const more = document.createElement('div')
    more.className = 'text-ink-3'
    more.textContent = `and ${fmtInt(found.length - POPUP_ROWS)} more. Zoom in to separate them.`
    root.append(more)
  }
  popup = new Popup({ className: 'stats-popup', maxWidth: '280px' }).setLngLat(e.lngLat).setDOMContent(root).addTo(map.value!)
}

/** Zooms to every visible footprint of a dataset. */
function zoomTo(dataset: string) {
  const m = map.value
  if (!m) return
  const bounds = new LngLatBounds()
  for (const g of gens.value) {
    if (g.dataset === dataset && g.bbox) bounds.extend([g.bbox.west, g.bbox.south]).extend([g.bbox.east, g.bbox.north])
  }
  if (bounds.isEmpty()) return
  hidden.delete(dataset)
  m.fitBounds(bounds, { padding: 40, maxZoom: 12, duration: 800 })
}
</script>

<template>
  <ToolLayout title="Statistics" subtitle="Every 3D model and texture set generated with the Elevation API.">
    <template #panel>
      <div v-if="loading && !stats" class="flex items-center gap-2 text-sm text-ink-3">
        <LoaderCircle class="size-4 animate-spin" /> Loading statistics…
      </div>
      <div v-else-if="error" class="space-y-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger" role="alert">
        <p>{{ error }}</p>
        <button type="button" class="btn btn-secondary" @click="load"><RotateCw class="size-4" /> Retry</button>
      </div>

      <div v-if="stats" class="space-y-6">
        <section aria-label="Totals">
          <dl class="grid grid-cols-3 gap-2">
            <div class="rounded-lg border border-line p-3">
              <dt class="text-xs text-ink-3">3D models</dt>
              <dd class="mt-1 text-xl font-semibold tabular-nums">{{ fmtInt(all.models) }}</dd>
            </div>
            <div class="rounded-lg border border-line p-3">
              <dt class="text-xs text-ink-3">Texture sets</dt>
              <dd class="mt-1 text-xl font-semibold tabular-nums">{{ fmtInt(all.textures) }}</dd>
            </div>
            <div class="rounded-lg border border-line p-3">
              <dt class="text-xs text-ink-3">Total size</dt>
              <dd class="mt-1 text-xl font-semibold tabular-nums">{{ formatBytes(all.sizeBytes) }}</dd>
            </div>
          </dl>
          <p class="mt-2 text-xs text-ink-3">
            <template v-if="all.firstDate">Since {{ formatDate(all.firstDate) }}.</template>
            <template v-if="all.unsized"> Size unknown for {{ fmtInt(all.unsized) }} of them.</template>
            <template v-if="all.unmapped"> {{ fmtInt(all.unmapped) }} older GPX models have no area on the map.</template>
          </p>
        </section>

        <section aria-labelledby="datasets-title">
          <div class="mb-2 flex items-baseline justify-between gap-2">
            <h2 id="datasets-title" class="field-label mb-0">By dataset</h2>
            <span class="flex gap-3 text-xs">
              <button type="button" class="text-accent hover:underline disabled:text-ink-3 disabled:no-underline" :disabled="!hidden.size" @click="showAll">
                Show all
              </button>
              <button
                type="button"
                class="text-accent hover:underline disabled:text-ink-3 disabled:no-underline"
                :disabled="hidden.size === byDataset.length"
                @click="hideAll"
              >
                Hide all
              </button>
            </span>
          </div>
          <p v-if="!byDataset.length" class="text-sm text-ink-3">Nothing generated yet.</p>
          <ul class="-mx-2 space-y-0.5">
            <li v-for="d in byDataset" :key="d.dataset" class="group flex items-center gap-1">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-subtle"
                :aria-pressed="!hidden.has(d.dataset)"
                :title="hidden.has(d.dataset) ? 'Show on the map' : 'Hide from the map'"
                @click="toggle(d.dataset)"
              >
                <span
                  class="size-3.5 shrink-0 rounded-[3px] border-2"
                  :style="{ borderColor: colors.get(d.dataset), background: hidden.has(d.dataset) ? 'transparent' : colors.get(d.dataset) }"
                  aria-hidden="true"
                />
                <span class="min-w-0 flex-1" :class="hidden.has(d.dataset) ? 'opacity-55' : ''">
                  <span class="flex items-baseline justify-between gap-2 text-sm">
                    <span class="truncate font-medium text-ink">{{ d.dataset }}</span>
                    <span class="shrink-0 text-ink tabular-nums">{{ fmtInt(d.count) }}</span>
                  </span>
                  <span class="mt-1 block h-1 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                    <span class="block h-full rounded-full" :style="{ width: `${(d.count / maxCount) * 100}%`, background: colors.get(d.dataset) }" />
                  </span>
                  <span class="mt-1 flex justify-between gap-2 text-xs text-ink-3">
                    <span class="truncate">
                      <template v-if="resolution(d.dataset)">{{ resolution(d.dataset) }} · </template>{{ fmtInt(d.models) }} models ·
                      {{ fmtInt(d.textures) }} textures
                    </span>
                    <span class="shrink-0 tabular-nums">{{ formatBytes(d.sizeBytes) }}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="shrink-0 rounded-md px-1.5 py-1 text-xs text-ink-3 hover:bg-subtle hover:text-ink"
                :aria-label="`Zoom to ${d.dataset}`"
                title="Zoom to this dataset"
                @click="zoomTo(d.dataset)"
              >
                Zoom
              </button>
            </li>
          </ul>
        </section>

        <p class="text-xs text-ink-3">
          Click an area on the map to see what was generated there.
          <template v-if="updatedAt">Updated at {{ updatedAt }}.</template>
        </p>
      </div>
    </template>

    <template #map>
      <!-- Streets by default: the topo relief competes with the colored footprints -->
      <BaseMap :center="[10, 30]" :zoom="1.4" :initial="{ basemap: 'streets' }" @ready="onReady" />
    </template>
  </ToolLayout>
</template>

<style>
/* MapLibre popups are created outside this component's DOM: unscoped, but namespaced. */
.stats-popup .maplibregl-popup-content {
  background: var(--c-surface);
  color: var(--c-ink);
  border: 1px solid var(--c-line);
  border-radius: 0.5rem;
  padding: 0.625rem 0.75rem;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
}
.stats-popup .maplibregl-popup-close-button {
  color: var(--c-ink-3);
  font-size: 1rem;
  padding: 0 0.375rem;
}
.stats-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip,
.stats-popup.maplibregl-popup-anchor-top-left .maplibregl-popup-tip,
.stats-popup.maplibregl-popup-anchor-top-right .maplibregl-popup-tip {
  border-bottom-color: var(--c-surface);
}
.stats-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip,
.stats-popup.maplibregl-popup-anchor-bottom-left .maplibregl-popup-tip,
.stats-popup.maplibregl-popup-anchor-bottom-right .maplibregl-popup-tip {
  border-top-color: var(--c-surface);
}
.stats-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
  border-right-color: var(--c-surface);
}
.stats-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
  border-left-color: var(--c-surface);
}
</style>
