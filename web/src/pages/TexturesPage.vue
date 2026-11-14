<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Download, ExternalLink, FileArchive, Image as ImageIcon, LoaderCircle, Mountain, Sparkles } from '@lucide/vue'
import { api, safeUrl } from '@/api/client'
import { saveFile } from '@/api/download'
import { TEXTURE_KINDS, type TextureFile, type TextureKind, type TextureOptions, type TextureSetResult } from '@/api/types'
import AddressSearch from '@/components/map/AddressSearch.vue'
import BaseMap from '@/components/map/BaseMap.vue'
import AreaStep from '@/components/AreaStep.vue'
import DatasetSelect from '@/components/DatasetSelect.vue'
import GenerateBlock from '@/components/GenerateBlock.vue'
import ImageryFields from '@/components/ImageryFields.vue'
import RegionHint from '@/components/RegionHint.vue'
import StepBlock from '@/components/StepBlock.vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAreaPicker } from '@/composables/useAreaPicker'
import { DEFAULT_DATASET, DEFAULT_IMAGERY } from '@/composables/useCatalog'
import { useCountry } from '@/composables/region'
import { useGenerate } from '@/composables/useGenerate'
import { textureKey, useTextureEstimate } from '@/composables/useTextureEstimate'

const area = useAreaPicker()
const options = reactive<TextureOptions>({ dataset: DEFAULT_DATASET, imageryProvider: DEFAULT_IMAGERY, textureQuality: 2 })

const country = useCountry(() => {
  const b = area.bbox.value
  return b ? { lon: (b.west + b.east) / 2, lat: (b.south + b.north) / 2 } : null
})

const estimateInput = () => (area.bbox.value ? { bbox: area.bbox.value, options } : null)
const size = useTextureEstimate(estimateInput)

const KINDS: Record<TextureKind, { label: string; icon: typeof ImageIcon; format: string; worldExt: string }> = {
  texture: { label: 'Texture', icon: ImageIcon, format: 'JPEG · imagery', worldExt: '.jgw' },
  normalmap: { label: 'Normal map', icon: Sparkles, format: 'PNG · surface normals', worldExt: '.pgw' },
  heightmap: { label: 'Height map', icon: Mountain, format: '16-bit PNG · elevation', worldExt: '.pgw' },
}

// One job at a time: the server allows a single running generation per client.
type Target = TextureKind | 'all'
const gen = useGenerate<TextureSetResult>()
const running = ref<Target | null>(null)
const lastTarget = ref<Target | null>(null)
const results = reactive<Partial<Record<Target, TextureSetResult>>>({})

// Results are only valid for the options they were generated with.
watch(
  () => (estimateInput() ? textureKey(estimateInput()!) : null),
  () => {
    for (const k of Object.keys(results) as Target[]) delete results[k]
    gen.error.value = null
  },
)

function fileFor(kind: TextureKind): TextureFile | undefined {
  return (results[kind] ?? results.all)?.files.find((f) => f.kind === kind)
}
function zipFor(kind: TextureKind): string | undefined {
  return (results[kind] ?? results.all)?.zipUrl
}

const credits = computed(() => {
  const seen = new Map<string, TextureSetResult['attributions'][number]>()
  for (const r of Object.values(results)) for (const a of r?.attributions ?? []) seen.set(a.subject + a.text, a)
  return [...seen.values()]
})
const elevationRange = computed(() => {
  const r = Object.values(results).find((x) => x?.minElevation != null)
  return r ? `${Math.round(r.minElevation!)} – ${Math.round(r.maxElevation!)} m` : null
})

function blockedReason(kinds: readonly TextureKind[]): string | undefined {
  if (!area.bbox.value) return 'Draw an area on the map first.'
  if (kinds.some((k) => size.estimates.value[k]?.allowed === false)) return 'Too large: choose a smaller area or a lower-resolution dataset.'
  const failed = kinds.find((k) => size.errors.value[k])
  if (failed) return size.errors.value[failed]
  return undefined
}

async function generate(target: Target) {
  const b = area.bbox.value
  if (!b || running.value) return
  running.value = target
  lastTarget.value = target
  const kinds = target === 'all' ? TEXTURE_KINDS : [target]
  await gen.run((id, signal) => api.textures(b, { ...options }, kinds, id, signal))
  if (gen.result.value) results[target] = gen.result.value
  running.value = null
}

const fmtMB = (mb: number) => (mb < 1 ? `${Math.max(0.01, mb).toFixed(2)} MB` : `${mb.toFixed(1)} MB`)
const sridLabel = (srid: number) => (srid === 3857 ? 'Web Mercator (EPSG:3857)' : `EPSG:${srid}`)
</script>

<template>
  <ToolLayout title="Textures" subtitle="Georeferenced texture, normal map and height map of any area.">
    <template #panel>
      <AreaStep :area="area" />

      <StepBlock :n="2" title="Sources">
        <div class="space-y-4">
          <div>
            <DatasetSelect v-model="options.dataset" />
            <p class="mt-1 text-xs text-ink-3">Used for the normal map and the height map.</p>
          </div>
          <RegionHint v-model:dataset="options.dataset" v-model:imagery-provider="options.imageryProvider" :country="country" uses-imagery />
          <ImageryFields v-model:provider="options.imageryProvider" v-model:quality="options.textureQuality" />
        </div>
      </StepBlock>

      <StepBlock :n="3" title="Images">
        <p class="mb-3 text-xs text-ink-3">
          Every image comes with its georeferencing: a world file and a projection (.prj), for QGIS, ArcGIS, Blender GIS…
        </p>
        <ul class="space-y-3">
          <li v-for="kind in TEXTURE_KINDS" :key="kind" class="rounded-lg border border-line p-3">
            <div class="flex items-start gap-3">
              <img
                v-if="fileFor(kind) && safeUrl(fileFor(kind)!.imageUrl)"
                :src="safeUrl(fileFor(kind)!.imageUrl)"
                alt=""
                class="size-12 shrink-0 rounded-md border border-line bg-subtle object-cover"
              />
              <span v-else class="grid size-12 shrink-0 place-items-center rounded-md bg-subtle text-ink-3">
                <component :is="KINDS[kind].icon" class="size-5" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{{ KINDS[kind].label }}</p>
                <p class="text-xs text-ink-3">
                  {{ KINDS[kind].format }}
                  <template v-if="fileFor(kind)"> · {{ sridLabel(fileFor(kind)!.srid) }}</template>
                </p>
                <p v-if="fileFor(kind)" class="text-xs text-ink-3">
                  {{ fileFor(kind)!.width }}×{{ fileFor(kind)!.height }} px · {{ fmtMB(fileFor(kind)!.sizeMB) }}
                </p>
                <p v-else-if="size.estimates.value[kind]" class="text-xs" :class="size.estimates.value[kind]!.allowed ? 'text-ink-3' : 'text-danger'">
                  ≈ {{ size.estimates.value[kind]!.width }}×{{ size.estimates.value[kind]!.height }} px · ≈ {{ fmtMB(size.estimates.value[kind]!.sizeMB) }}
                  <template v-if="!size.estimates.value[kind]!.allowed"> · over the {{ size.maxMB.value }} MB limit</template>
                </p>
                <p v-else-if="size.errors.value[kind]" class="text-xs text-danger">{{ size.errors.value[kind] }}</p>
              </div>
              <button
                v-if="running !== kind"
                type="button"
                class="btn btn-secondary shrink-0 px-3 py-1.5"
                :disabled="!!running || !!blockedReason([kind])"
                :title="blockedReason([kind])"
                @click="generate(kind)"
              >
                {{ fileFor(kind) ? 'Regenerate' : 'Generate' }}
              </button>
              <LoaderCircle v-else class="mt-1 size-5 shrink-0 animate-spin text-accent" aria-label="Generating" />
            </div>

            <div v-if="running === kind" class="mt-2" role="status" aria-live="polite">
              <div class="flex items-center gap-2 text-xs">
                <span class="min-w-0 flex-1 truncate text-ink-2">{{ gen.status.value }}</span>
                <button type="button" class="text-ink-3 underline hover:text-ink" @click="gen.cancel()">Cancel</button>
              </div>
              <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-subtle">
                <div
                  class="h-full rounded-full bg-accent transition-[width] duration-500"
                  :class="gen.percent.value ? '' : 'w-1/3 animate-pulse'"
                  :style="gen.percent.value ? { width: `${gen.percent.value}%` } : undefined"
                />
              </div>
            </div>
            <p v-else-if="gen.error.value && lastTarget === kind" role="alert" class="mt-2 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
              {{ gen.error.value }}
            </p>

            <div v-if="fileFor(kind)" class="mt-3 flex flex-wrap gap-1.5">
              <button type="button" class="btn btn-primary px-2.5 py-1 text-xs" @click="saveFile(fileFor(kind)!.imageUrl)">
                <Download class="size-3.5" /> Image
              </button>
              <button type="button" class="btn btn-secondary px-2.5 py-1 text-xs" @click="saveFile(fileFor(kind)!.worldFileUrl)">
                World file ({{ KINDS[kind].worldExt }})
              </button>
              <button type="button" class="btn btn-secondary px-2.5 py-1 text-xs" @click="saveFile(fileFor(kind)!.prjUrl)">Projection (.prj)</button>
              <a v-if="safeUrl(zipFor(kind))" :href="safeUrl(zipFor(kind))" class="btn btn-secondary px-2.5 py-1 text-xs" download>
                <FileArchive class="size-3.5" /> All (.zip)
              </a>
            </div>
          </li>
        </ul>

        <div v-if="elevationRange || credits.length" class="mt-4 border-t border-line pt-3 text-xs text-ink-3">
          <p v-if="elevationRange" class="mb-2">
            Elevation {{ elevationRange }}. The height map maps this range to black–white; the exact values are in metadata.json (in the zip).
          </p>
          <template v-if="credits.length">
            <p class="field-label">Credits</p>
            <ul class="space-y-1">
              <li v-for="a in credits" :key="a.subject + a.text">
                <span class="font-medium text-ink-2">{{ a.subject }}:</span>
                <a v-if="safeUrl(a.url)" :href="safeUrl(a.url)" target="_blank" rel="noopener noreferrer" class="ml-1 inline-flex items-center gap-0.5 underline">
                  {{ a.text }} <ExternalLink class="size-3" />
                </a>
                <span v-else class="ml-1">{{ a.text }}</span>
              </li>
            </ul>
          </template>
        </div>
      </StepBlock>
    </template>

    <template #footer>
      <GenerateBlock
        label="Generate all (.zip)"
        :disabled="!!running || !!blockedReason(TEXTURE_KINDS)"
        :disabled-reason="running ? undefined : blockedReason(TEXTURE_KINDS)"
        :busy="running === 'all'"
        :status="gen.status.value"
        :percent="gen.percent.value"
        :error="lastTarget === 'all' ? gen.error.value : null"
        @generate="generate('all')"
        @cancel="gen.cancel()"
      />
      <a
        v-if="results.all && safeUrl(results.all.zipUrl) && running !== 'all'"
        :href="safeUrl(results.all.zipUrl)"
        download
        class="btn btn-secondary mt-3 w-full"
      >
        <FileArchive class="size-4" /> Download all (.zip)
      </a>
    </template>

    <template #map>
      <BaseMap @ready="area.onReady">
        <template #search><AddressSearch /></template>
      </BaseMap>
    </template>
  </ToolLayout>
</template>
