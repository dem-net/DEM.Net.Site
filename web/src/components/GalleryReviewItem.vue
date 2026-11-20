<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Check, LoaderCircle, MapPinned, Play, Trash2, X } from '@lucide/vue'
import { galleryAdmin, type GalleryFile } from '@/api/client'
import type { GalleryItem } from '@/api/types'
import TerrainViewer from '@/components/viewers/TerrainViewer.vue'
import { GALLERY_KIND_LABELS, formatGalleryDate, galleryRegenerateLink, useGalleryAdmin } from '@/composables/gallery'
import { formatBytes } from '@/composables/generationStats'

/**
 * A submission waiting for review. Its files are only served with the session (Authorization header), so they are
 * fetched and shown from object URLs: the poster at once, the turntable and the model when asked.
 */
const props = defineProps<{ item: GalleryItem }>()
const emit = defineEmits<{ done: [id: string, outcome: 'approved' | 'rejected' | 'deleted'] }>()

const router = useRouter()
const admin = useGalleryAdmin()
const urls = ref<Partial<Record<GalleryFile, string>>>({})
const fetching = ref<GalleryFile | null>(null)
const busy = ref(false)
const confirming = ref<'reject' | 'delete' | null>(null)
const error = ref<string | null>(null)
const abort = new AbortController()

async function fetchFile(file: GalleryFile) {
  if (urls.value[file] || fetching.value) return
  fetching.value = file
  error.value = null
  try {
    const blob = await admin.call((s) => galleryAdmin.file(s, props.item.id, file, abort.signal))
    urls.value = { ...urls.value, [file]: URL.createObjectURL(blob) }
  } catch (e) {
    if (!abort.signal.aborted) error.value = (e as Error).message
  } finally {
    fetching.value = null
  }
}

onMounted(() => fetchFile('poster'))
onBeforeUnmount(() => {
  abort.abort()
  for (const u of Object.values(urls.value)) if (u) URL.revokeObjectURL(u)
})

const area = computed(() => {
  const link = galleryRegenerateLink(props.item)
  return link && router.resolve({ path: link.path, query: link.query }).href
})

async function act(action: 'approve' | 'reject' | 'delete') {
  busy.value = true
  error.value = null
  try {
    if (action === 'approve') await admin.call((s) => galleryAdmin.approve(s, props.item.id))
    else if (action === 'reject') await admin.call((s) => galleryAdmin.reject(s, props.item.id))
    else await admin.call((s) => galleryAdmin.remove(s, props.item.id))
    emit('done', props.item.id, action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'deleted')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
    confirming.value = null
  }
}
</script>

<template>
  <article class="card overflow-hidden">
    <div class="grid gap-4 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div class="space-y-2">
        <TerrainViewer
          v-if="urls.model"
          :src="urls.model"
          :size-m-b="item.modelBytes / 1e6"
          :alt="item.title"
          :settings="item.viewer"
        />
        <video
          v-else-if="urls.clip"
          :src="urls.clip"
          class="aspect-[4/3] w-full rounded-lg bg-[#e9ebe6] object-cover"
          muted
          loop
          autoplay
          playsinline
        />
        <div v-else class="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-[#e9ebe6]">
          <img v-if="urls.poster" :src="urls.poster" :alt="`Poster of ${item.title}`" class="size-full object-cover" />
          <LoaderCircle v-else-if="fetching === 'poster'" class="size-5 animate-spin text-ink-3" />
        </div>
        <div class="flex flex-wrap gap-2">
          <button v-if="item.clipUrl && !urls.clip && !urls.model" type="button" class="btn btn-secondary" :disabled="!!fetching" @click="fetchFile('clip')">
            <LoaderCircle v-if="fetching === 'clip'" class="size-4 animate-spin" /><Play v-else class="size-4" /> Turntable
          </button>
          <button v-if="!urls.model" type="button" class="btn btn-secondary" :disabled="!!fetching" @click="fetchFile('model')">
            <LoaderCircle v-if="fetching === 'model'" class="size-4 animate-spin" /><Box v-else class="size-4" />
            Model ({{ formatBytes(item.modelBytes) }})
          </button>
        </div>
      </div>

      <div class="min-w-0">
        <h2 class="text-lg font-semibold break-words">{{ item.title }}</h2>
        <p class="text-sm text-ink-3">
          <span v-if="item.pseudonym">By {{ item.pseudonym }} · </span>Submitted {{ formatGalleryDate(item.createdAt) }}
        </p>
        <p v-if="item.description" class="mt-3 break-words whitespace-pre-line text-sm text-ink-2">{{ item.description }}</p>
        <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          <dt class="text-ink-3">Place</dt>
          <dd>{{ item.place ?? 'Unknown' }}</dd>
          <dt class="text-ink-3">Made with</dt>
          <dd>{{ GALLERY_KIND_LABELS[item.kind] }}</dd>
          <dt class="text-ink-3">Data</dt>
          <dd>{{ item.dataset }}<span v-if="item.imagery">, {{ item.imagery }}</span></dd>
        </dl>
        <a v-if="area" :href="area" target="_blank" class="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <MapPinned class="size-4" /> Open the area on the map
        </a>

        <div v-if="error" role="alert" class="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <template v-if="confirming">
            <span class="text-sm font-medium">
              {{ confirming === 'reject' ? 'Reject it? Its files are deleted.' : 'Delete it for good?' }}
            </span>
            <button type="button" class="btn btn-danger" :disabled="busy" @click="act(confirming)">
              <LoaderCircle v-if="busy" class="size-4 animate-spin" />
              {{ confirming === 'reject' ? 'Yes, reject' : 'Yes, delete' }}
            </button>
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="confirming = null">Cancel</button>
          </template>
          <template v-else>
            <button type="button" class="btn btn-primary" :disabled="busy" @click="act('approve')">
              <LoaderCircle v-if="busy" class="size-4 animate-spin" /><Check v-else class="size-4" /> Approve
            </button>
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="confirming = 'reject'">
              <X class="size-4" /> Reject
            </button>
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="confirming = 'delete'">
              <Trash2 class="size-4" /> Delete
            </button>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>
