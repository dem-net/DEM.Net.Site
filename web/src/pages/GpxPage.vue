<script setup lang="ts">
import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl'
import { computed, ref, shallowRef } from 'vue'
import { FileUp, Route, X } from '@lucide/vue'
import { api } from '@/api/client'
import BaseMap from '@/components/map/BaseMap.vue'
import { bboxSizeKm, fitBBox, padBBox } from '@/components/map/mapContext'
import GenerateBlock from '@/components/GenerateBlock.vue'
import SizeGauge from '@/components/SizeGauge.vue'
import ModelOptionsForm from '@/components/ModelOptionsForm.vue'
import ModelResultOverlay from '@/components/ModelResultOverlay.vue'
import StepBlock from '@/components/StepBlock.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { parseGpx, type GpxSummary } from '@/composables/gpx'
import { useGenerate } from '@/composables/useGenerate'
import { useModelOptions } from '@/composables/useModelOptions'
import { useSizeEstimate } from '@/composables/useSizeEstimate'
import { useCountry } from '@/composables/region'

const SAMPLES = [
  { file: 'lauzannier.gpx', label: 'Lauzanier lake hike' },
  { file: 'avignon ventoux.gpx', label: 'Avignon – Mont Ventoux' },
  { file: 'trail.gpx', label: 'Trail run' },
]

const options = useModelOptions()
const track3D = ref(true)
const gen = useGenerate()
const showResult = ref(false)

const file = shallowRef<File | null>(null)
const summary = shallowRef<GpxSummary | null>(null)
const fileError = ref<string | null>(null)
const dragOver = ref(false)
const input = ref<HTMLInputElement>()
let map: MlMap | null = null

/**
 * The GPX endpoint has no estimate mode, so estimate with the bbox endpoint over the track's
 * bounds plus the ~1 km margin the server adds around tracks. Approximate: warns, never blocks.
 */
const GPX_MARGIN_KM = 1
const country = useCountry(() => {
  const b = summary.value?.bbox
  return b ? { lon: (b.west + b.east) / 2, lat: (b.south + b.north) / 2 } : null
})
const size = useSizeEstimate(() =>
  summary.value ? { bbox: padBBox(summary.value.bbox, GPX_MARGIN_KM), options, osm: null } : null,
)

const SOURCE = 'gpx-track'

function onReady(m: MlMap) {
  map = m
  m.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  m.addLayer({
    id: `${SOURCE}-casing`,
    type: 'line',
    source: SOURCE,
    paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.9 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  m.addLayer({
    id: SOURCE,
    type: 'line',
    source: SOURCE,
    paint: { 'line-color': '#d9480f', 'line-width': 3 },
    layout: { 'line-cap': 'round', 'line-join': 'round' },
  })
  if (summary.value) showTrack(summary.value)
}

function showTrack(s: GpxSummary | null) {
  const src = map?.getSource<GeoJSONSource>(SOURCE)
  if (!map || !src) return
  src.setData({
    type: 'FeatureCollection',
    features: s ? [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: s.lines } }] : [],
  })
  if (s) fitBBox(map, s.bbox)
}

async function setFile(f: File) {
  fileError.value = null
  try {
    const s = parseGpx(await f.text())
    file.value = f
    summary.value = s
    showTrack(s)
  } catch (e) {
    fileError.value = (e as Error).message
  }
}

function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) setFile(f)
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) setFile(f)
}

async function loadSample(name: string) {
  const res = await fetch(`/samples/${encodeURIComponent(name)}`)
  await setFile(new File([await res.blob()], name, { type: 'application/gpx+xml' }))
}

function removeFile() {
  file.value = null
  summary.value = null
  if (input.value) input.value.value = ''
  showTrack(null)
}

const sizeLabel = computed(() => {
  if (!summary.value) return ''
  const s = bboxSizeKm(summary.value.bbox)
  return `${s.width.toFixed(1)} × ${s.height.toFixed(1)} km`
})

async function generate() {
  const f = file.value
  if (!f) return
  showResult.value = false
  await gen.run((id, signal) => api.gpxModel(f, options, track3D.value, id, signal))
  if (gen.result.value) showResult.value = true
}
</script>

<template>
  <ToolLayout title="GPX to 3D" subtitle="Upload a track and get a 3D model of the terrain around it.">
    <template #panel>
      <StepBlock :n="1" title="Your GPX track" :done="!!file">
        <div
          v-if="!file"
          class="rounded-xl border-2 border-dashed p-5 text-center transition-colors"
          :class="dragOver ? 'border-accent bg-accent-soft' : 'border-line'"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="onDrop"
        >
          <FileUp class="mx-auto mb-2 size-6 text-ink-3" />
          <p class="text-sm">Drop a .gpx file here</p>
          <button type="button" class="btn btn-secondary mt-3" @click="input?.click()">Choose a file</button>
          <input ref="input" type="file" accept=".gpx,application/gpx+xml" class="sr-only" @change="onPick" />
        </div>
        <div v-else class="flex items-center gap-3 rounded-lg bg-subtle px-3 py-2">
          <Route class="size-5 shrink-0 text-accent" />
          <div class="min-w-0 flex-1 text-sm">
            <p class="truncate font-medium">{{ summary?.name ?? file.name }}</p>
            <p class="text-xs text-ink-3">{{ summary?.points }} points · {{ sizeLabel }}</p>
          </div>
          <button type="button" class="p-1 text-ink-3 hover:text-danger" aria-label="Remove file" @click="removeFile">
            <X class="size-4" />
          </button>
        </div>
        <p v-if="fileError" role="alert" class="mt-2 text-sm text-danger">{{ fileError }}</p>
        <p v-if="!file" class="mt-3 text-xs text-ink-3">
          No file at hand? Try
          <template v-for="(s, i) in SAMPLES" :key="s.file">
            <button type="button" class="underline hover:text-ink" @click="loadSample(s.file)">{{ s.label }}</button
            >{{ i < SAMPLES.length - 1 ? ', ' : '.' }}
          </template>
        </p>
      </StepBlock>

      <StepBlock :n="2" title="Options">
        <ModelOptionsForm v-model="options" :country="country" />
        <div class="mt-4">
          <ToggleSwitch v-model="track3D" label="Show the track in 3D" hint="Draws the path on the model" />
        </div>
      </StepBlock>
    </template>

    <template #footer>
        <SizeGauge
          v-if="file"
          class="mb-3"
          :estimate="size.estimate.value"
          :loading="size.loading.value"
          :fit-detail="size.fitDetail.value"
          @fit="(d) => (options.meshDetail = d)"
        />
        <GenerateBlock
          :disabled="!file"
          disabled-reason="Add a GPX file first."
          :busy="gen.busy.value"
          :status="gen.status.value"
          :percent="gen.percent.value"
          :error="gen.error.value"
          :has-result="!!gen.result.value && !showResult"
          @generate="generate"
          @cancel="gen.cancel()"
          @show="showResult = true"
        />
    </template>

    <template #map>
      <BaseMap @ready="onReady" />
      <ModelResultOverlay v-if="showResult && gen.result.value" :result="gen.result.value" @close="showResult = false" />
    </template>
  </ToolLayout>
</template>
