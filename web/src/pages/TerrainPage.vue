<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Crosshair, Scan, Trash2 } from '@lucide/vue'
import { api, bboxToPath } from '@/api/client'
import AddressSearch from '@/components/map/AddressSearch.vue'
import BaseMap from '@/components/map/BaseMap.vue'
import GenerateBlock from '@/components/GenerateBlock.vue'
import SizeGauge from '@/components/SizeGauge.vue'
import ModelOptionsForm from '@/components/ModelOptionsForm.vue'
import ModelResultOverlay from '@/components/ModelResultOverlay.vue'
import ShareButton from '@/components/ShareButton.vue'
import StepBlock from '@/components/StepBlock.vue'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAreaPicker } from '@/composables/useAreaPicker'
import { DEFAULT_DATASET, DEFAULT_IMAGERY, useCatalog } from '@/composables/useCatalog'
import { mapStateFromQuery, mapStateToQuery, optionsFromQuery, optionsToQuery, SHARE_KEYS } from '@/composables/shareLink'
import { useGenerate } from '@/composables/useGenerate'
import { useModelOptions, useOsmOptions } from '@/composables/useModelOptions'
import { useSizeEstimate } from '@/composables/useSizeEstimate'
import { useCountry } from '@/composables/region'

const route = useRoute()
const router = useRouter()

// A share link restores the map view, basemap, relief and model options (the area comes from ?bbox=).
const sharedMap = mapStateFromQuery(route.query)
const area = useAreaPicker({ fitOnLoad: !sharedMap.view })
const options = useModelOptions(optionsFromQuery(route.query))
const baseMap = ref<InstanceType<typeof BaseMap>>()

// Names from a link are only trusted once the catalog confirms them.
const catalog = useCatalog()
watch(
  catalog.loaded,
  (loaded) => {
    if (!loaded) return
    if (!catalog.datasetByName(options.dataset)) options.dataset = DEFAULT_DATASET
    if (!catalog.imageryByName(options.imageryProvider)) options.imageryProvider = DEFAULT_IMAGERY
  },
  { immediate: true },
)

// Once applied, drop the share parameters from the address bar: they'd be stale after the next change.
onMounted(() => {
  if (!SHARE_KEYS.some((k) => k in route.query)) return
  const query = { ...route.query }
  for (const k of SHARE_KEYS) delete query[k]
  router.replace({ query })
})

function shareUrl(): string {
  const state = baseMap.value?.getState()
  const query = {
    ...(area.bbox.value && { bbox: bboxToPath(area.bbox.value) }),
    ...(withOsm.value && { osm: '1' }),
    ...(state && mapStateToQuery(state)),
    ...optionsToQuery(options),
  }
  return new URL(router.resolve({ path: route.path, query }).href, location.origin).href
}
const osm = useOsmOptions()
/** OSM features (buildings, ski pistes) are temporarily disabled. Set to true to bring them back. */
const OSM_AVAILABLE = false
const withOsm = ref(OSM_AVAILABLE && route.query.osm === '1')
const gen = useGenerate()
const showResult = ref(false)

// The OSM endpoint only produces glTF
watch(withOsm, (on) => {
  if (on) options.format = 'glTF'
})

// Live server-side size estimate; the server refuses models over its limit (100 MB).
const size = useSizeEstimate(() =>
  area.bbox.value ? { bbox: area.bbox.value, options, osm: withOsm.value ? osm : null } : null,
)

const country = useCountry(() => {
  const b = area.bbox.value
  return b ? { lon: (b.west + b.east) / 2, lat: (b.south + b.north) / 2 } : null
})

const disabledReason = computed(() => {
  if (!area.bbox.value) return 'Draw an area on the map first.'
  if (size.overLimit.value) return 'Too large: see the estimated size above.'
  return undefined
})

async function generate() {
  const b = area.bbox.value
  if (!b) return
  showResult.value = false
  await gen.run((id, signal) => api.terrainModel(b, options, withOsm.value ? osm : null, id, signal))
  if (gen.result.value) showResult.value = true
}
</script>

<template>
  <ToolLayout title="Map to 3D" subtitle="Turn any area on Earth into a 3D terrain model.">
    <template #actions>
      <ShareButton :get-url="shareUrl" title="Map to 3D · Elevation API" />
    </template>
    <template #panel>
      <StepBlock :n="1" title="Choose an area" :done="!!area.bbox.value">
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="btn btn-secondary" :class="area.isDrawing.value ? 'border-accent text-accent' : ''" @click="area.startDrawing()">
            <Scan class="size-4" /> Draw area
          </button>
          <button type="button" class="btn btn-secondary" @click="area.useView()">
            <Crosshair class="size-4" /> Use map view
          </button>
        </div>
        <p v-if="area.isDrawing.value" class="mt-2 text-xs text-ink-3">Click and drag on the map to draw a rectangle.</p>
        <div v-else-if="area.bbox.value" class="mt-2 flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
          <span>
            {{ area.sizeLabel.value }}
            <span class="block text-xs text-ink-3">Drag the corners to adjust</span>
          </span>
          <button type="button" class="p-1 text-ink-3 hover:text-danger" aria-label="Remove area" @click="area.clear()">
            <Trash2 class="size-4" />
          </button>
        </div>
        <p v-else class="mt-2 text-xs text-ink-3">Search a place on the map, then draw a rectangle around it.</p>
      </StepBlock>

      <StepBlock :n="2" title="Options">
        <ModelOptionsForm v-model="options" :allow-stl="!withOsm" :country="country" />

        <div class="mt-4 rounded-lg border border-line p-3">
          <ToggleSwitch
            v-model="withOsm"
            label="Add OpenStreetMap features"
            hint="Buildings and ski pistes on top of the terrain"
            :disabled="!OSM_AVAILABLE"
          />
          <p v-if="!OSM_AVAILABLE" class="mt-2 rounded-md bg-subtle px-2.5 py-1.5 text-xs text-ink-2" role="note">
            This feature is temporarily unavailable. It will be back soon!
          </p>
          <div v-if="withOsm" class="mt-3 space-y-3 border-t border-line pt-3">
            <ToggleSwitch v-model="osm.osmBuildings" label="Buildings" />
            <template v-if="osm.osmBuildings">
              <ToggleSwitch v-model="osm.useOsmBuildingsColor" label="Use OSM building colours" hint="When mapped" />
              <label v-if="!osm.useOsmBuildingsColor" class="flex items-center justify-between text-sm">
                <span class="font-medium">Building colour</span>
                <input v-model="osm.buildingsColor" type="color" class="h-8 w-12 cursor-pointer rounded border border-line bg-transparent" />
              </label>
            </template>
            <ToggleSwitch v-model="osm.osmPistesSki" label="Ski pistes" />
            <ToggleSwitch v-model="osm.osmOnly" label="Features only" hint="Leave out the terrain mesh" />
          </div>
        </div>
      </StepBlock>
    </template>

    <template #footer>
        <SizeGauge
          v-if="area.bbox.value"
          class="mb-3"
          :estimate="size.estimate.value"
          :loading="size.loading.value"
          :fit-detail="size.fitDetail.value"
          blocking
          @fit="(d) => (options.meshDetail = d)"
        />
        <GenerateBlock
          :disabled="!!disabledReason"
          :disabled-reason="disabledReason"
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
      <BaseMap ref="baseMap" :initial="sharedMap" @ready="area.onReady">
        <template #search><AddressSearch /></template>
      </BaseMap>
      <ModelResultOverlay v-if="showResult && gen.result.value" :result="gen.result.value" @close="showResult = false" />
    </template>
  </ToolLayout>
</template>
