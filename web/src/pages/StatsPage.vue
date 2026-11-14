<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  LngLatBounds,
  Popup,
  type ExpressionSpecification,
  type FilterSpecification,
  type Map as MlMap,
  type MapMouseEvent,
} from 'maplibre-gl'
import { Box, ChartColumn, Download, ExternalLink, History, List, LoaderCircle, Map as MapIcon, Pause, Play, RotateCw, X } from '@lucide/vue'
import { api } from '@/api/client'
import type { GenerationDetail, GenerationStats } from '@/api/types'
import BaseMap from '@/components/map/BaseMap.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import GlbViewer from '@/components/viewers/GlbViewer.vue'
import { regenerateLink } from '@/composables/regenerate'
import { useCatalog } from '@/composables/useCatalog'
import {
  datasetColors,
  datasetFeatures,
  dayNumber,
  dayToDate,
  formatBytes,
  formatDate,
  KIND_LABELS,
  totals,
  totalsByDataset,
  type DatasetTotals,
} from '@/composables/generationStats'

const StlViewer = defineAsyncComponent(() => import('@/components/viewers/StlViewer.vue'))

const { datasetByName } = useCatalog()
const router = useRouter()

const stats = shallowRef<GenerationStats | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    stopReplay()
    stats.value = await api.generationStats()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)

const gens = computed(() => stats.value?.generations ?? [])
/** Day number of each generation (same order as `gens`). */
const days = computed(() => gens.value.map((g) => dayNumber(g.date)))
const firstDay = computed(() => Math.min(...days.value.filter(Number.isFinite)))
const lastDay = computed(() => Math.max(...days.value.filter(Number.isFinite)))

// ---------- Replay: the map and the numbers as they were on a given day ----------

/** Last day shown while replaying; null shows everything. */
const replayDay = ref<number | null>(null)
const playing = ref(false)
const REPLAY_MS = 20_000
let frame = 0

/** Generations up to the replay day (all of them outside a replay). */
const shown = computed(() => {
  const day = replayDay.value
  return day === null ? gens.value : gens.value.filter((_, i) => days.value[i] <= day)
})

/** The whole history plays in REPLAY_MS, whatever its length. `startTime` is when the first day was shown. */
function tick(startTime: number) {
  frame = requestAnimationFrame((now) => {
    const spanDays = lastDay.value - firstDay.value + 1
    const day = Math.min(lastDay.value, firstDay.value + Math.floor(((now - startTime) / REPLAY_MS) * spanDays))
    replayDay.value = day
    if (day >= lastDay.value) playing.value = false
    else tick(startTime)
  })
}

function play() {
  if (!gens.value.length) return
  // Restart from the beginning unless paused halfway.
  const from = replayDay.value === null || replayDay.value >= lastDay.value ? firstDay.value : replayDay.value
  replayDay.value = from
  playing.value = true
  popup?.remove()
  const elapsed = ((from - firstDay.value) / (lastDay.value - firstDay.value + 1)) * REPLAY_MS
  tick(performance.now() - elapsed)
}

function pause() {
  cancelAnimationFrame(frame)
  playing.value = false
}

function stopReplay() {
  pause()
  replayDay.value = null
}

function scrub(e: Event) {
  pause()
  replayDay.value = Number((e.target as HTMLInputElement).value)
}

onBeforeUnmount(pause)

// ---------- Panel ----------

const all = computed(() => totals(shown.value))
/** Order and colors come from all generations, so they stay put during a replay. */
const ranking = computed(() => totalsByDataset(gens.value))
const colors = computed(() => datasetColors(ranking.value.map((d) => d.dataset)))
const maxCount = computed(() => ranking.value[0]?.count ?? 1)
const byDataset = computed<DatasetTotals[]>(() => {
  const current = new Map(totalsByDataset(shown.value).map((d) => [d.dataset, d]))
  return ranking.value.map(
    (d) => current.get(d.dataset) ?? { ...d, count: 0, models: 0, textures: 0, sizeBytes: 0, unsized: 0, unmapped: 0 },
  )
})

const hidden = reactive(new Set<string>())
const toggle = (d: string) => (hidden.has(d) ? hidden.delete(d) : hidden.add(d))
const showAll = () => hidden.clear()
const hideAll = () => ranking.value.forEach((d) => hidden.add(d.dataset))

const fmtInt = (n: number) => n.toLocaleString('en')
const plural = (n: number, word: string) => `${fmtInt(n)} ${word}${n === 1 ? '' : 's'}`
const updatedAt = computed(() => {
  const d = stats.value ? new Date(stats.value.updatedAt) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : null
})
function resolution(dataset: string) {
  const m = datasetByName(dataset)?.resolutionMeters
  return m === undefined ? null : m >= 1000 ? `${+(m / 1000).toFixed(1)} km` : `${m} m`
}
const totalsNote = computed(() => {
  const t = all.value
  const parts: string[] = []
  if (replayDay.value !== null) parts.push(`Up to ${formatDate(dayToDate(replayDay.value))}.`)
  else if (t.firstDate) parts.push(`Since ${formatDate(t.firstDate)}.`)
  if (t.unsized) parts.push(`Size unknown for ${fmtInt(t.unsized)} of them.`)
  if (t.unmapped) parts.push(`${plural(t.unmapped, 'older GPX model')} ${t.unmapped === 1 ? 'has' : 'have'} no area on the map.`)
  return parts.join(' ')
})

// ---------- Map: one source pair and three layers per dataset ----------

const map = shallowRef<MlMap | null>(null)
/** Per dataset: its source ids and layer ids. */
let mapLayers = new Map<string, { fp: string; pt: string; layers: string[] }>()
let popup: Popup | null = null
let hovered: { dataset: string; id: number } | null = null

const HOVER = ['boolean', ['feature-state', 'hover'], false] as ExpressionSpecification

/** While replaying, generations after this day (the last few days) stand out as they appear. Outside a replay, none do. */
function recentFrom(): number {
  const day = replayDay.value
  return day === null ? 1e9 : day - Math.max(2, Math.round((lastDay.value - firstDay.value) / 25))
}

function paint(color: string) {
  const recent = ['>', ['get', 'd'], recentFrom()] as ExpressionSpecification
  return {
    // Outlines only at rest: fills add up where hundreds of areas overlap (even 2.5 % turns opaque).
    // The hovered area, and the ones appearing during a replay, are filled.
    fill: {
      'fill-color': color,
      'fill-opacity': ['case', HOVER, 0.3, recent, 0.12, 0] as ExpressionSpecification,
    },
    line: {
      'line-color': color,
      'line-width': ['case', HOVER, 2.5, recent, 1.5, 0.75] as ExpressionSpecification,
      'line-opacity': ['case', HOVER, 1, recent, 0.9, 0.45] as ExpressionSpecification,
    },
    circle: {
      'circle-color': color,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['case', recent, 4.5, 2.5], 8, ['case', recent, 6.5, 4.5]] as ExpressionSpecification,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1,
      // Centres keep small areas visible at world zoom, and fade out once footprints are readable.
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 10, 0] as ExpressionSpecification,
      'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 10, 0] as ExpressionSpecification,
    },
  }
}

function replayFilter(): FilterSpecification | null {
  return replayDay.value === null ? null : ['<=', ['get', 'd'], replayDay.value]
}

function clearLayers(m: MlMap) {
  for (const { layers } of mapLayers.values()) layers.forEach((id) => m.getLayer(id) && m.removeLayer(id))
  for (const id of Object.keys(m.getStyle().sources)) if (id.startsWith('gen-')) m.removeSource(id)
  mapLayers = new Map()
  hovered = null
}

function render() {
  const m = map.value
  if (!m || !stats.value) return
  clearLayers(m)
  // Most used first, so the smaller datasets are drawn on top of them.
  ranking.value.forEach(({ dataset }, n) => {
    const p = paint(colors.value.get(dataset)!)
    const { footprints, centres } = datasetFeatures(gens.value, dataset)
    const fp = `gen-${n}-fp`
    const pt = `gen-${n}-pt`
    m.addSource(fp, { type: 'geojson', data: footprints })
    m.addSource(pt, { type: 'geojson', data: centres })
    const layout = { visibility: hidden.has(dataset) ? ('none' as const) : ('visible' as const) }
    // No `filter` key at all outside a replay: MapLibre's validation rejects `filter: undefined`.
    const f = replayFilter()
    const filter = f ? { filter: f } : {}
    m.addLayer({ id: `${fp}-fill`, type: 'fill', source: fp, layout, paint: p.fill, ...filter })
    m.addLayer({ id: `${fp}-line`, type: 'line', source: fp, layout, paint: p.line, ...filter })
    m.addLayer({ id: `${pt}-circle`, type: 'circle', source: pt, layout, paint: p.circle, ...filter })
    mapLayers.set(dataset, { fp, pt, layers: [`${fp}-fill`, `${fp}-line`, `${pt}-circle`] })
  })
}

/** Applies the replay day: filter, and the "recent" emphasis. Only runs when the day changes. */
function applyReplay() {
  const m = map.value
  if (!m) return
  setHovered(null)
  for (const [dataset, { layers }] of mapLayers) {
    const p = paint(colors.value.get(dataset)!)
    for (const id of layers) m.setFilter(id, replayFilter())
    const [fill, line, circle] = layers
    m.setPaintProperty(fill, 'fill-opacity', p.fill['fill-opacity'])
    m.setPaintProperty(line, 'line-width', p.line['line-width'])
    m.setPaintProperty(line, 'line-opacity', p.line['line-opacity'])
    m.setPaintProperty(circle, 'circle-radius', p.circle['circle-radius'])
  }
}

function setHovered(next: { dataset: string; id: number } | null) {
  const m = map.value
  if (!m || (hovered?.dataset === next?.dataset && hovered?.id === next?.id)) return
  for (const [h, on] of [
    [hovered, false],
    [next, true],
  ] as const) {
    const src = h && mapLayers.get(h.dataset)
    if (!h || !src) continue
    m.setFeatureState({ source: src.fp, id: h.id }, { hover: on })
    m.setFeatureState({ source: src.pt, id: h.id }, { hover: on })
  }
  hovered = next
}

function onReady(m: MlMap) {
  map.value = m
  render()
  m.on('click', onClick)
  m.on('mousemove', (e) => {
    const found = featuresAt(e)
    m.getCanvas().style.cursor = found.length ? 'pointer' : ''
    const top = smallest(found)
    setHovered(top === null ? null : { dataset: gens.value[top].dataset, id: top })
  })
  m.on('mouseout', () => setHovered(null))
}

watch(stats, render)
watch(replayDay, applyReplay)
watch(
  () => [...hidden],
  () => {
    const m = map.value
    if (!m) return
    for (const [dataset, { layers }] of mapLayers) {
      for (const id of layers) m.setLayoutProperty(id, 'visibility', hidden.has(dataset) ? 'none' : 'visible')
    }
    popup?.remove()
  },
)

/** Generation indexes under the pointer (a few pixels of slack), newest first. */
function featuresAt(e: MapMouseEvent): number[] {
  const m = map.value!
  const layers = [...mapLayers.entries()].filter(([d]) => !hidden.has(d)).flatMap(([, v]) => v.layers)
  if (!layers.length) return []
  const r = 4
  const box: [[number, number], [number, number]] = [
    [e.point.x - r, e.point.y - r],
    [e.point.x + r, e.point.y + r],
  ]
  const ids = new Set(m.queryRenderedFeatures(box, { layers }).map((f) => f.properties.i as number))
  return [...ids].sort((a, b) => gens.value[b].date.localeCompare(gens.value[a].date) || b - a)
}

/** The smallest area among these generation indexes: the one hovered and clicked (big ones would cover everything). */
function smallest(found: number[]): number | null {
  const area = (i: number) => {
    const b = gens.value[i].bbox!
    return (b.east - b.west) * (b.north - b.south)
  }
  return found.length ? found.reduce((a, b) => (area(b) < area(a) ? b : a)) : null
}

/** Other generations listed under the clicked one. */
const POPUP_ROWS = 6

// The popup content is rendered by Vue (hidden element below) and handed to MapLibre, so it updates
// when the details (options, model URL) arrive.
const popupEl = ref<HTMLElement>()
/** The clicked generation first, then (some of) the others at that place, newest first. */
const picked = ref<number[]>([])
/** Number of other generations at that place (not counting the clicked one). */
const othersTotal = ref(0)
/** Details by generation id (kept for the session). */
const details = reactive(new Map<number, GenerationDetail>())
const detailsState = ref<'idle' | 'loading' | 'failed'>('idle')
let detailsAbort: AbortController | null = null

async function loadDetails(ids: number[]) {
  const missing = ids.filter((id) => !details.has(id))
  detailsAbort?.abort()
  if (!missing.length) return (detailsState.value = 'idle')
  detailsAbort = new AbortController()
  detailsState.value = 'loading'
  try {
    for (const d of await api.generationDetails(missing, detailsAbort.signal)) details.set(d.id, d)
    detailsState.value = 'idle'
  } catch (e) {
    if ((e as Error).name !== 'AbortError') detailsState.value = 'failed'
  }
}

/** Opens the popup at `at` for generation `top`, followed by the `others` at that place (newest first). */
function openPopup(top: number | null, others: number[], at: [number, number] | MapMouseEvent['lngLat']) {
  popup?.remove()
  if (top === null || !popupEl.value || !map.value) return
  const rest = others.filter((i) => i !== top)
  picked.value = [top, ...rest.slice(0, POPUP_ROWS)]
  othersTotal.value = rest.length
  loadDetails(picked.value.map((i) => gens.value[i].id).filter((id): id is number => id !== null))
  popup = new Popup({ className: 'stats-popup', maxWidth: '300px' }).setLngLat(at).setDOMContent(popupEl.value).addTo(map.value)
}

function onClick(e: MapMouseEvent) {
  const found = featuresAt(e)
  // The clicked one is the highlighted one (computed again here: touch screens have no hover).
  openPopup(smallest(found), found, e.lngLat)
}

function detailOf(i: number): GenerationDetail | undefined {
  const id = gens.value[i].id
  return id === null ? undefined : details.get(id)
}

/** "Generate again" link (opens in a new tab), once the generation's options are known. */
function regenerate(i: number): { href: string; areaOnly: boolean } | null {
  const d = detailOf(i)
  const link = d && regenerateLink(gens.value[i], d.options)
  return link ? { href: router.resolve({ path: link.path, query: link.query }).href, areaOnly: link.areaOnly } : null
}

// ---------- Model viewer (over the map, on this page) ----------

const viewing = ref<{ i: number; url: string } | null>(null)
const viewed = computed(() => (viewing.value ? gens.value[viewing.value.i] : null))

function view(i: number) {
  const url = detailOf(i)?.modelUrl
  if (!url) return
  popup?.remove()
  pause()
  viewing.value = { i, url }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && viewing.value) viewing.value = null
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/** Zooms to every footprint of a dataset (and shows it). */
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

// ---------- Latest generations (panel tab) ----------

const tab = ref<'overview' | 'latest'>('overview')
const LATEST_COUNT = 100

/**
 * The latest generations (up to the replay day), newest first, grouped by day.
 * The API lists generations oldest first, by creation time, so the list order is the time order.
 */
const latestByDay = computed(() => {
  const day = replayDay.value
  const groups: { date: string; items: number[] }[] = []
  let n = 0
  for (let i = gens.value.length - 1; i >= 0 && n < LATEST_COUNT; i--) {
    if (day !== null && !(days.value[i] <= day)) continue
    const date = gens.value[i].date
    if (groups.at(-1)?.date !== date) groups.push({ date, items: [] })
    groups.at(-1)!.items.push(i)
    n++
  }
  return groups
})

/** Zooms to a generation's area and opens its popup. */
async function focus(i: number) {
  const m = map.value
  const b = gens.value[i].bbox
  if (!m || !b) return
  pause()
  if (hidden.has(gens.value[i].dataset)) {
    hidden.delete(gens.value[i].dataset)
    // Let the visibility watcher run first: it closes the popup.
    await nextTick()
  }
  m.fitBounds(
    [
      [b.west, b.south],
      [b.east, b.north],
    ],
    { padding: 60, maxZoom: 13, duration: 800 },
  )
  openPopup(i, [], [(b.west + b.east) / 2, (b.south + b.north) / 2])
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

      <div v-if="stats" class="mb-5 grid grid-cols-2 rounded-lg bg-subtle p-1" role="tablist" aria-label="Statistics view">
        <button
          v-for="t in (['overview', 'latest'] as const)"
          :id="`stats-tab-${t}`"
          :key="t"
          type="button"
          role="tab"
          :aria-selected="tab === t"
          :aria-controls="`stats-panel-${t}`"
          class="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium"
          :class="tab === t ? 'bg-surface text-ink shadow-sm' : 'text-ink-3 hover:text-ink'"
          @click="tab = t"
        >
          <ChartColumn v-if="t === 'overview'" class="size-4" />
          <List v-else class="size-4" />
          {{ t === 'overview' ? 'Overview' : 'Latest' }}
        </button>
      </div>

      <div v-if="stats && tab === 'latest'" id="stats-panel-latest" role="tabpanel" aria-labelledby="stats-tab-latest" class="space-y-4">
        <p class="text-xs text-ink-3">
          The {{ LATEST_COUNT }} latest generations, newest first<template v-if="replayDay !== null">, up to {{ formatDate(dayToDate(replayDay)) }}</template>.
          Click one to see it on the map.
        </p>
        <p v-if="!latestByDay.length" class="text-sm text-ink-3">Nothing generated yet.</p>
        <section v-for="g in latestByDay" :key="g.date" :aria-label="formatDate(g.date)">
          <h2 class="field-label mb-1">{{ formatDate(g.date) }}</h2>
          <ul class="-mx-2 space-y-0.5">
            <li v-for="i in g.items" :key="i">
              <button
                type="button"
                class="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left enabled:hover:bg-subtle"
                :disabled="!gens[i].bbox"
                :title="gens[i].bbox ? 'Show on the map' : 'No area recorded for this generation'"
                @click="focus(i)"
              >
                <span class="mt-1.5 size-2.5 shrink-0 rounded-sm" :style="{ background: colors.get(gens[i].dataset) }" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <span class="flex items-baseline justify-between gap-2 text-sm">
                    <span class="truncate font-medium text-ink">{{ gens[i].dataset }}</span>
                    <span v-if="gens[i].sizeBytes !== null" class="shrink-0 text-xs text-ink-3 tabular-nums">{{ formatBytes(gens[i].sizeBytes!) }}</span>
                  </span>
                  <span class="block truncate text-xs text-ink-3">
                    {{ [KIND_LABELS[gens[i].kind], gens[i].format.replaceAll(',', ', ')].filter(Boolean).join(' · ') }}
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </section>
        <p v-if="updatedAt" class="text-xs text-ink-3">Updated at {{ updatedAt }}.</p>
      </div>

      <div v-if="stats && tab === 'overview'" id="stats-panel-overview" role="tabpanel" aria-labelledby="stats-tab-overview" class="space-y-6">
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
          <p class="mt-2 text-xs text-ink-3">{{ totalsNote }}</p>
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
                :disabled="hidden.size === ranking.length"
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
                      <template v-if="resolution(d.dataset)">{{ resolution(d.dataset) }} · </template>{{ plural(d.models, 'model') }} ·
                      {{ plural(d.textures, 'texture') }}
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
      <!-- Popup content: rendered here, moved into the MapLibre popup on click -->
      <div class="hidden">
        <div ref="popupEl" class="space-y-2 text-xs">
          <ul class="space-y-2">
            <template v-for="(i, n) in picked" :key="i">
              <li v-if="n === 1" class="border-t border-line pt-2 font-semibold text-ink-2" role="separator">
                {{ othersTotal === 1 ? '1 other generation here' : `${fmtInt(othersTotal)} other generations here` }}
              </li>
              <li class="flex items-start gap-2">
                <span class="mt-0.5 size-2.5 shrink-0 rounded-sm" :style="{ background: colors.get(gens[i].dataset) }" />
                <span class="min-w-0 flex-1">
                  <span class="block font-medium text-ink">{{ gens[i].dataset }} · {{ KIND_LABELS[gens[i].kind] }}</span>
                  <span class="block text-ink-3">
                    {{
                      [gens[i].format.replaceAll(',', ', '), gens[i].sizeBytes !== null ? formatBytes(gens[i].sizeBytes!) : null, formatDate(gens[i].date)]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </span>
                  <span v-if="regenerate(i) || detailOf(i)?.modelUrl" class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <button
                      v-if="detailOf(i)?.modelUrl"
                      type="button"
                      class="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                      @click="view(i)"
                    >
                      <Box class="size-3.5" /> View 3D
                    </button>
                    <a
                      v-if="regenerate(i)"
                      :href="regenerate(i)!.href"
                      target="_blank"
                      rel="noopener"
                      class="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                      :title="regenerate(i)!.areaOnly ? 'The GPX track is not kept: opens the same area in Map to 3D' : 'Opens a new tab with the same area and settings'"
                    >
                      <ExternalLink class="size-3.5" /> {{ regenerate(i)!.areaOnly ? 'Same area in Map to 3D' : 'Generate again' }}
                    </a>
                  </span>
                </span>
              </li>
            </template>
          </ul>
          <p v-if="detailsState === 'loading'" class="flex items-center gap-1.5 text-ink-3">
            <LoaderCircle class="size-3 animate-spin" /> Loading options…
          </p>
          <p v-else-if="detailsState === 'failed'" class="text-ink-3">Options unavailable right now.</p>
          <p v-if="othersTotal > picked.length - 1" class="text-ink-3">
            and {{ fmtInt(othersTotal - (picked.length - 1)) }} more. Zoom in to separate them.
          </p>
        </div>
      </div>

      <!-- Streets by default: the topo relief competes with the colored footprints -->
      <BaseMap :center="[10, 30]" :zoom="1.4" :initial="{ basemap: 'streets' }" @ready="onReady" />

      <!-- Replay: plays the history day by day (map and numbers) -->
      <!-- px-14 keeps it clear of the scale bar and the zoom buttons on narrow screens -->
      <div v-if="stats && gens.length" class="pointer-events-none absolute inset-x-0 bottom-9 z-10 flex justify-center px-14">
        <div
          class="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-surface py-1 pr-2 pl-1 shadow-sm"
          :class="replayDay === null ? '' : 'w-full max-w-md'"
        >
          <button
            type="button"
            class="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium hover:bg-subtle"
            :class="playing ? 'text-accent' : 'text-ink-2'"
            :aria-label="playing ? 'Pause the replay' : 'Replay the history'"
            @click="playing ? pause() : play()"
          >
            <Pause v-if="playing" class="size-3.5" />
            <Play v-else-if="replayDay !== null" class="size-3.5" />
            <History v-else class="size-3.5" />
            <span v-if="replayDay === null">Replay</span>
          </button>
          <template v-if="replayDay !== null">
            <input
              type="range"
              class="min-w-0 flex-1 accent-accent"
              :min="firstDay"
              :max="lastDay"
              step="1"
              :value="replayDay"
              aria-label="Replay date"
              :aria-valuetext="formatDate(dayToDate(replayDay))"
              @input="scrub"
            />
            <span class="w-24 shrink-0 text-right text-xs text-ink tabular-nums">{{ formatDate(dayToDate(replayDay)) }}</span>
            <button
              type="button"
              class="shrink-0 rounded-full p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
              aria-label="Close the replay and show everything"
              title="Show everything"
              @click="stopReplay"
            >
              <X class="size-3.5" />
            </button>
          </template>
        </div>
      </div>

      <!-- Model viewer over the map (Escape or "Back to map" closes it) -->
      <div v-if="viewing && viewed" class="absolute inset-0 z-20 overflow-y-auto bg-page/80 p-3 backdrop-blur-sm sm:p-6">
        <div class="card mx-auto max-w-4xl p-3 shadow-xl sm:p-4" role="dialog" aria-modal="true" aria-labelledby="viewer-title">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <h2 id="viewer-title" class="font-semibold">{{ viewed.dataset }} · {{ KIND_LABELS[viewed.kind] }}</h2>
              <p class="text-xs text-ink-3">
                {{ [viewed.format, viewed.sizeBytes !== null ? formatBytes(viewed.sizeBytes) : null, formatDate(viewed.date)].filter(Boolean).join(' · ') }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <a
                v-if="regenerate(viewing.i)"
                :href="regenerate(viewing.i)!.href"
                target="_blank"
                rel="noopener"
                class="btn btn-secondary"
              >
                <ExternalLink class="size-4" /> Generate again
              </a>
              <button type="button" class="btn btn-secondary" @click="viewing = null"><MapIcon class="size-4" /> Back to map</button>
            </div>
          </div>
          <StlViewer v-if="viewed.format === 'STL'" :key="viewing.url" :src="viewing.url" />
          <GlbViewer v-else :key="viewing.url" :src="viewing.url" :size-m-b="(viewed.sizeBytes ?? 0) / 1e6" />
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
            <span>Generated models are kept for a limited time, then deleted.</span>
            <a :href="viewing.url" target="_blank" rel="noopener" class="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              <Download class="size-3.5" /> {{ viewed.format === 'STL' ? 'STL' : 'GLB' }} file
            </a>
          </div>
        </div>
      </div>
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
