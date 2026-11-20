<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue'
import { Camera, Check, Copy, Images, LoaderCircle, RotateCcw, Send, X } from '@lucide/vue'
import {
  api,
  GALLERY_DESCRIPTION_MAX,
  GALLERY_PSEUDONYM_MAX,
  GALLERY_TITLE_MAX,
  galleryOwnerLink,
} from '@/api/client'
import type { PublishContext } from '@/api/types'
import type { ViewCapture } from './viewers/turntable'
import { placeNameAt } from '@/composables/region'
import { coordinatesLabel } from '@/composables/sketchfabPrefill'

/**
 * "Publish to gallery", shown under the model view: the user turns the model to the view they like, captures a poster
 * and a turntable clip in the browser, writes a title, and gets a private link that can delete the model later.
 * The owner reviews every submission before it is shown.
 */
const props = defineProps<{
  modelId: string
  /** Prefill of the title (place at the centre of the area). */
  publish?: PublishContext | null
  /** GPX models show the track: say so before it becomes public. */
  gpx?: boolean
  /** The model viewer's capture (TerrainViewer.capture). */
  capture: (onProgress: (fraction: number) => void, signal: AbortSignal) => Promise<ViewCapture>
}>()
const emit = defineEmits<{ close: [] }>()

interface Shot extends ViewCapture {
  posterUrl: string
  clipUrl: string | null
}

const shot = shallowRef<Shot | null>(null)
const capturing = ref(false)
const progress = ref(0)
const sending = ref(false)
const error = ref<string | null>(null)
const link = ref<string | null>(null)
const copied = ref(false)
const form = reactive({ title: '', description: '', pseudonym: '' })
let job: AbortController | undefined // capture or send
let placeLookup: AbortController | undefined

const lookingUpPlace = ref(false)
onMounted(async () => {
  const ctx = props.publish
  if (!ctx) return
  lookingUpPlace.value = true
  placeLookup = new AbortController()
  try {
    const name = (await placeNameAt(ctx.lon, ctx.lat, placeLookup.signal)) ?? coordinatesLabel(ctx.lon, ctx.lat)
    if (!form.title.trim()) form.title = name.slice(0, GALLERY_TITLE_MAX)
  } catch {
    /* cancelled, or the lookup failed: the title stays empty */
  } finally {
    lookingUpPlace.value = false
  }
})

function release(s: Shot | null) {
  if (!s) return
  URL.revokeObjectURL(s.posterUrl)
  if (s.clipUrl) URL.revokeObjectURL(s.clipUrl)
}

onBeforeUnmount(() => {
  job?.abort()
  placeLookup?.abort()
  release(shot.value)
})

async function record() {
  job?.abort()
  job = new AbortController()
  capturing.value = true
  progress.value = 0
  error.value = null
  try {
    const result = await props.capture((f) => (progress.value = f), job.signal)
    release(shot.value)
    shot.value = {
      ...result,
      posterUrl: URL.createObjectURL(result.poster),
      clipUrl: result.clip && URL.createObjectURL(result.clip),
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') error.value = (e as Error).message
  } finally {
    capturing.value = false
  }
}

const canSend = computed(() => !!shot.value && form.title.trim().length > 0 && !sending.value && !capturing.value)

async function send() {
  if (!shot.value || !canSend.value) return
  job = new AbortController()
  sending.value = true
  error.value = null
  try {
    const receipt = await api.galleryPublish(
      { modelId: props.modelId, ...form, poster: shot.value.poster, clip: shot.value.clip, viewer: shot.value.viewer },
      job.signal,
    )
    link.value = galleryOwnerLink(receipt.id, receipt.token, window.location.origin)
  } catch (e) {
    if ((e as Error).name !== 'AbortError') error.value = (e as Error).message
  } finally {
    sending.value = false
  }
}

async function copyLink() {
  if (!link.value) return
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* clipboard refused: the link stays selectable */
  }
}

function selectAll(e: FocusEvent) {
  ;(e.target as HTMLInputElement).select()
}
</script>

<template>
  <section class="mt-4 rounded-xl border border-line p-4" aria-labelledby="gallery-publish-title">
    <div class="mb-3 flex items-start gap-3">
      <Images class="mt-0.5 size-5 shrink-0 text-accent" />
      <div class="min-w-0 flex-1">
        <h3 id="gallery-publish-title" class="font-semibold">Publish to the gallery</h3>
        <p class="text-xs text-ink-3">Share your model with everyone on elevationapi.com. The site owner reviews it first.</p>
      </div>
      <button v-if="!sending" type="button" class="rounded-md p-1 text-ink-3 hover:text-ink" aria-label="Close" @click="emit('close')">
        <X class="size-5" />
      </button>
    </div>

    <!-- Done: the private link, shown once -->
    <div v-if="link" class="space-y-3" role="status">
      <p class="text-sm">
        <Check class="mr-1 inline size-4 text-accent" /><strong>Thank you!</strong> Your model will appear in the gallery once the
        owner has approved it.
      </p>
      <div>
        <label class="field-label" for="gallery-link">Your private link</label>
        <div class="flex gap-2">
          <input id="gallery-link" :value="link" readonly class="input min-w-0 flex-1 font-mono text-xs" @focus="selectAll" />
          <button type="button" class="btn btn-secondary shrink-0" @click="copyLink">
            <component :is="copied ? Check : Copy" class="size-4" /> {{ copied ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <p class="mt-2 text-xs text-ink-3">
          Keep this link: it is the only way to delete your model from the gallery, and it won't be shown again. Anyone who has it
          can delete the model.
        </p>
      </div>
    </div>

    <form v-else class="space-y-4" @submit.prevent="send">
      <!-- 1. Capture -->
      <div>
        <p class="text-sm text-ink-2">
          <span class="font-medium text-ink">1. Choose the view.</span> Turn and zoom the model above, then capture it: a poster
          image and a 4-second turntable are made in your browser.
        </p>
        <div v-if="capturing" class="mt-3" role="status" aria-live="polite">
          <div class="flex items-center gap-2 text-sm">
            <LoaderCircle class="size-4 animate-spin text-accent" /> Recording… {{ Math.round(progress * 100) }}%
          </div>
          <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
            <div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${Math.max(3, progress * 100)}%` }" />
          </div>
        </div>
        <div v-else-if="shot" class="mt-3 grid gap-3 sm:grid-cols-2">
          <figure>
            <img :src="shot.posterUrl" alt="Poster of your model" class="aspect-[4/3] w-full rounded-lg object-cover" />
            <figcaption class="mt-1 text-xs text-ink-3">Poster</figcaption>
          </figure>
          <figure v-if="shot.clipUrl">
            <video :src="shot.clipUrl" class="aspect-[4/3] w-full rounded-lg object-cover" muted loop autoplay playsinline />
            <figcaption class="mt-1 text-xs text-ink-3">Turntable</figcaption>
          </figure>
          <p v-else class="self-center text-xs text-ink-3">
            This browser can't record video, so only the poster will be published.
          </p>
        </div>
        <button type="button" class="btn btn-secondary mt-3" :disabled="capturing || sending" @click="record">
          <component :is="shot ? RotateCcw : Camera" class="size-4" /> {{ shot ? 'Capture again' : 'Capture this view' }}
        </button>
      </div>

      <!-- 2. Texts -->
      <fieldset class="space-y-3" :disabled="sending">
        <p class="text-sm font-medium">2. Describe it.</p>
        <div>
          <label class="field-label" for="gallery-title">Title</label>
          <input
            id="gallery-title"
            v-model="form.title"
            class="input"
            :maxlength="GALLERY_TITLE_MAX"
            required
            :placeholder="lookingUpPlace ? 'Looking up the place…' : 'Mont Blanc massif'"
          />
        </div>
        <div>
          <label class="field-label" for="gallery-description">Description</label>
          <textarea
            id="gallery-description"
            v-model="form.description"
            class="input min-h-20"
            :maxlength="GALLERY_DESCRIPTION_MAX"
            placeholder="Optional: what it shows, how you made it"
          />
        </div>
        <div>
          <label class="field-label" for="gallery-pseudonym">Your name or pseudonym</label>
          <input id="gallery-pseudonym" v-model="form.pseudonym" class="input" :maxlength="GALLERY_PSEUDONYM_MAX" placeholder="Optional" />
        </div>
      </fieldset>

      <div class="space-y-1 rounded-lg bg-subtle px-3 py-2 text-xs text-ink-2">
        <p>
          Once approved, everyone can see and download the model, the poster, the turntable, your texts, the area, the dataset and
          the options it was made with. The gallery shows it with the lighting you captured.
        </p>
        <p v-if="gpx" class="font-medium text-ink">Your GPX track is part of the model: it will be public too.</p>
        <p>
          No account, email or IP address is stored.
          <RouterLink to="/privacy#gallery" class="underline" target="_blank">Privacy</RouterLink>
        </p>
      </div>

      <div v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</div>

      <button type="submit" class="btn btn-primary w-full" :disabled="!canSend">
        <LoaderCircle v-if="sending" class="size-4 animate-spin" /><Send v-else class="size-4" />
        {{ sending ? 'Sending…' : shot ? 'Submit for review' : 'Capture the view first' }}
      </button>
    </form>
  </section>
</template>
