<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Download, ExternalLink, KeyRound, LoaderCircle, RefreshCw, Trash2 } from '@lucide/vue'
import { ApiError, GALLERY_ID, api, galleryAdmin, hashParam, safeUrl } from '@/api/client'
import type { GalleryItem } from '@/api/types'
import GlbViewer from '@/components/viewers/GlbViewer.vue'
import { GALLERY_KIND_LABELS, formatGalleryDate, galleryRegenerateLink, useGalleryAdmin } from '@/composables/gallery'
import { formatBytes } from '@/composables/generationStats'
import { SITE_NAME } from '@/seo'

const route = useRoute()
const router = useRouter()
const admin = useGalleryAdmin()

const item = shallowRef<GalleryItem | null>(null)
const loading = ref(true)
/** Not published: unknown, waiting for review, rejected or deleted (the API doesn't tell which). */
const missing = ref(false)
const error = ref<string | null>(null)
let abort: AbortController | undefined

/**
 * The publisher's delete token, from their private link (/gallery/<id>#token=…). Kept in memory and removed from
 * the address bar at once, so copying the address to share the model doesn't share the power to delete it.
 */
const token = ref<string | null>(null)

const id = computed(() => String(route.params.id ?? ''))

async function load() {
  abort?.abort()
  abort = new AbortController()
  item.value = null
  missing.value = false
  error.value = null
  deleted.value = false
  confirming.value = false
  if (!GALLERY_ID.test(id.value)) {
    missing.value = true
    loading.value = false
    return
  }
  loading.value = true
  try {
    const found = await api.galleryItem(id.value, abort.signal)
    if (abort.signal.aborted) return
    item.value = found
    missing.value = !found
    if (found) document.title = `${found.title} · Gallery · ${SITE_NAME}`
  } catch (e) {
    if (!abort.signal.aborted) error.value = (e as Error).message
  } finally {
    if (!abort.signal.aborted) loading.value = false
  }
}

const regenerate = computed(() => {
  const link = item.value && galleryRegenerateLink(item.value)
  return link ? { to: router.resolve({ path: link.path, query: link.query }).href, areaOnly: link.areaOnly } : null
})

const textured = computed(() => item.value?.options.textured?.toLowerCase() === 'true')

// ---------- Deletion: by the publisher (token), or by the signed-in owner ----------

const canDelete = computed(() => !!token.value || admin.signedIn.value)
const confirming = ref(false)
const deleting = ref(false)
const deleted = ref(false)
const deleteError = ref<string | null>(null)

async function remove() {
  deleting.value = true
  deleteError.value = null
  try {
    if (token.value) await api.galleryDelete(id.value, token.value)
    else await admin.call((s) => galleryAdmin.remove(s, id.value))
    deleted.value = true
    item.value = null
    token.value = null
  } catch (e) {
    deleteError.value =
      e instanceof ApiError && e.status === 404
        ? 'No model matches this link: it was already deleted, or the link is incomplete.'
        : (e as Error).message
  } finally {
    deleting.value = false
    confirming.value = false
  }
}

// Last: load() resets the state declared above. Another model forgets the token; a private link opened in this
// tab (same page, new #token=) is read too, not only the one the page opened with.
watch(id, () => {
  token.value = null
  load()
})
watch(
  () => route.hash,
  (hash) => {
    const t = hashParam(hash, 'token')
    if (!t) return
    token.value = t
    router.replace({ path: route.path, query: route.query, hash: '' })
  },
  { immediate: true },
)
load()
onBeforeUnmount(() => abort?.abort())
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8">
    <RouterLink to="/gallery" class="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
      <ArrowLeft class="size-4" /> Gallery
    </RouterLink>

    <div v-if="loading" class="mt-10 flex items-center gap-2 text-ink-3" role="status">
      <LoaderCircle class="size-5 animate-spin" /> Loading the model…
    </div>

    <div v-else-if="deleted" class="mt-8 max-w-2xl" role="status">
      <h1 class="text-2xl font-semibold">Model deleted</h1>
      <p class="mt-2 text-ink-2">It is no longer in the gallery, and its files are removed from the server.</p>
      <RouterLink to="/gallery" class="btn btn-secondary mt-4">Back to the gallery</RouterLink>
    </div>

    <div v-else-if="error" role="alert" class="mt-8 flex flex-wrap items-center gap-3 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
      {{ error }}
      <button type="button" class="btn btn-secondary" @click="load">Try again</button>
    </div>

    <div v-else-if="missing" class="mt-8 max-w-2xl">
      <h1 class="text-2xl font-semibold">{{ token ? 'Your model is not in the gallery yet' : 'Model not found' }}</h1>
      <p class="mt-2 text-ink-2">
        <template v-if="token">
          It is waiting for the site owner's review, or it was not accepted or was deleted. It appears here once approved: keep
          your private link, it still works.
        </template>
        <template v-else>This model isn't in the gallery: it may be waiting for review, or it was removed.</template>
      </p>
      <RouterLink to="/gallery" class="btn btn-secondary mt-4">See the gallery</RouterLink>
    </div>

    <div v-else-if="item" class="mt-4 grid gap-8 lg:grid-cols-5">
      <div class="lg:col-span-3">
        <GlbViewer :src="item.modelUrl" :size-m-b="item.modelBytes / 1e6" :alt="`${item.title}, 3D model`" />
      </div>

      <div class="min-w-0 lg:col-span-2">
        <h1 class="text-2xl font-semibold tracking-tight break-words">{{ item.title }}</h1>
        <p class="mt-1 text-sm text-ink-3">
          <span v-if="item.pseudonym">By {{ item.pseudonym }} · </span>
          <span v-if="item.publishedAt">{{ formatGalleryDate(item.publishedAt) }}</span>
        </p>
        <p v-if="item.description" class="mt-4 break-words whitespace-pre-line text-ink-2">{{ item.description }}</p>

        <dl class="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <template v-if="item.place">
            <dt class="text-ink-3">Place</dt>
            <dd>{{ item.place }}</dd>
          </template>
          <dt class="text-ink-3">Made with</dt>
          <dd>{{ GALLERY_KIND_LABELS[item.kind] }}</dd>
          <dt class="text-ink-3">Elevation data</dt>
          <dd>{{ item.dataset }}</dd>
          <template v-if="textured && item.imagery">
            <dt class="text-ink-3">Imagery</dt>
            <dd>{{ item.imagery }}</dd>
          </template>
          <dt class="text-ink-3">Size</dt>
          <dd>{{ formatBytes(item.modelBytes) }} (glTF binary)</dd>
        </dl>

        <div class="mt-5 flex flex-wrap gap-2">
          <a :href="item.modelUrl" class="btn btn-primary" download><Download class="size-4" /> Download</a>
          <RouterLink v-if="regenerate" :to="regenerate.to" class="btn btn-secondary">
            <RefreshCw class="size-4" /> Generate again
          </RouterLink>
        </div>
        <p v-if="regenerate?.areaOnly" class="mt-2 text-xs text-ink-3">
          GPX tracks are not reused: "Generate again" opens the same area on Map to 3D.
        </p>

        <div v-if="item.attributions.length" class="mt-5 border-t border-line pt-3">
          <p class="field-label">Credits</p>
          <ul class="space-y-1 text-xs text-ink-3">
            <li v-for="a in item.attributions" :key="a.subject + a.text">
              <span class="font-medium text-ink-2">{{ a.subject }}:</span>
              <a
                v-if="safeUrl(a.url)"
                :href="safeUrl(a.url)"
                target="_blank"
                rel="noopener noreferrer"
                class="ml-1 inline-flex items-center gap-0.5 underline"
              >
                {{ a.text }} <ExternalLink class="size-3" />
              </a>
              <span v-else class="ml-1">{{ a.text }}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Deletion: also offered when the model isn't published (yet), to the holder of the private link -->
    <section v-if="canDelete && !loading && !deleted && (item || (missing && GALLERY_ID.test(id)))" class="mt-10 max-w-2xl rounded-xl border border-line p-4">
      <h2 class="flex items-center gap-2 font-semibold">
        <KeyRound class="size-4 text-accent" /> {{ token ? 'You published this model' : 'Moderation' }}
      </h2>
      <p class="mt-1 text-sm text-ink-2">
        {{
          token
            ? 'Your private link lets you delete it from the gallery at any time.'
            : 'You are signed in as the site owner: you can remove this model.'
        }}
      </p>
      <div v-if="deleteError" role="alert" class="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ deleteError }}</div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <template v-if="confirming">
          <span class="text-sm font-medium">Delete it for good?</span>
          <button type="button" class="btn btn-danger" :disabled="deleting" @click="remove">
            <LoaderCircle v-if="deleting" class="size-4 animate-spin" /><Trash2 v-else class="size-4" /> Yes, delete
          </button>
          <button type="button" class="btn btn-secondary" :disabled="deleting" @click="confirming = false">Cancel</button>
        </template>
        <button v-else type="button" class="btn btn-secondary" @click="confirming = true">
          <Trash2 class="size-4" /> Delete this model
        </button>
      </div>
    </section>
  </div>
</template>
