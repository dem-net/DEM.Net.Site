<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ExternalLink, LoaderCircle, Upload, X } from '@lucide/vue'
import { api, safeUrl } from '@/api/client'
import { ensureConnected, useProgress } from '@/api/hub'
import type { PublishContext } from '@/api/types'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { placeNameAt } from '@/composables/region'
import { coordinatesLabel, publishDescription } from '@/composables/sketchfabPrefill'

/**
 * Sketchfab upload form, used by the publish dialog (model view) and the OAuth callback page.
 * `authorize()` returns the user's access token. In the dialog it opens the sign-in popup,
 * so upload() calls it before any `await`: the popup must open within the submit gesture.
 */
const props = defineProps<{
  modelId: string
  authorize: () => Promise<string>
  /** Prefill: the name from the place at the centre of the area, the description with a link back to the model. */
  publish?: PublishContext | null
}>()

const form = reactive({
  modelName: '',
  description: props.publish ? publishDescription(props.publish) : '',
  tags: [] as string[],
  isInspectable: true,
  isPublished: false,
  isPrivate: false,
  password: '',
})
const tagDraft = ref('')
const busy = ref(false)
const status = ref<string | null>(null)
const error = ref<string | null>(null)
const viewerUrl = ref<string | null>(null)
const { progress } = useProgress('export')

// The place lookup fills the name unless the user typed one meanwhile
const lookingUpPlace = ref(false)
let placeLookup: AbortController | undefined
onMounted(async () => {
  const ctx = props.publish
  if (!ctx) return
  lookingUpPlace.value = true
  placeLookup = new AbortController()
  try {
    const name = (await placeNameAt(ctx.lon, ctx.lat, placeLookup.signal)) ?? coordinatesLabel(ctx.lon, ctx.lat)
    if (!form.modelName.trim()) form.modelName = name
  } catch {
    /* cancelled: the form was closed */
  } finally {
    lookingUpPlace.value = false
  }
})
onBeforeUnmount(() => placeLookup?.abort())

function addTag() {
  const t = tagDraft.value.trim().replace(/,$/, '')
  if (t && !form.tags.includes(t) && form.tags.length < 42) form.tags.push(t.slice(0, 64))
  tagDraft.value = ''
}

function onTagKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addTag()
  } else if (e.key === 'Backspace' && !tagDraft.value) {
    form.tags.pop()
  }
}

const canSubmit = computed(() => form.modelName.trim().length > 0 && !busy.value)

async function upload() {
  addTag()
  busy.value = true
  error.value = null
  status.value = 'Waiting for Sketchfab sign-in…'
  try {
    const userToken = await props.authorize()
    status.value = null
    const clientConnectionId = await ensureConnected()
    const res = await api.sketchfabExport({
      ...form,
      password: form.isPrivate ? form.password : '',
      userToken,
      modelId: props.modelId,
      clientConnectionId,
    })
    viewerUrl.value = safeUrl(res.viewModelUrl) ?? null
  } catch (e) {
    if ((e as Error).name !== 'AbortError') error.value = (e as Error).message
  } finally {
    busy.value = false
    status.value = null
  }
}

defineExpose({ busy })
</script>

<template>
  <div v-if="viewerUrl" class="p-6 text-center">
    <p class="text-lg font-semibold">Upload complete</p>
    <p class="mt-1 text-sm text-ink-3">Sketchfab may take a few minutes to process your model.</p>
    <a :href="viewerUrl" target="_blank" rel="noopener noreferrer" class="btn btn-primary mt-5">
      View on Sketchfab <ExternalLink class="size-4" />
    </a>
    <slot name="done" />
  </div>

  <form v-else class="space-y-5 p-5" @submit.prevent="upload">
    <div>
      <label class="field-label" for="sf-name">Model name</label>
      <input
        id="sf-name"
        v-model="form.modelName"
        class="input"
        maxlength="48"
        required
        :placeholder="lookingUpPlace ? 'Looking up the place…' : 'Mont Blanc massif'"
      />
    </div>
    <div>
      <label class="field-label" for="sf-desc">Description</label>
      <textarea id="sf-desc" v-model="form.description" class="input min-h-24" maxlength="720" placeholder="Optional" />
    </div>
    <div>
      <label class="field-label" for="sf-tags">Tags</label>
      <div class="input flex flex-wrap items-center gap-1.5">
        <span v-for="t in form.tags" :key="t" class="inline-flex items-center gap-1 rounded-md bg-subtle px-2 py-0.5 text-xs">
          {{ t }}
          <button type="button" :aria-label="`Remove tag ${t}`" @click="form.tags = form.tags.filter((x) => x !== t)">
            <X class="size-3" />
          </button>
        </span>
        <input
          id="sf-tags"
          v-model="tagDraft"
          class="min-w-24 flex-1 bg-transparent outline-none"
          placeholder="Type and press Enter"
          @keydown="onTagKey"
          @blur="addTag"
        />
      </div>
    </div>
    <div class="space-y-3">
      <ToggleSwitch v-model="form.isInspectable" label="Inspectable" hint="Visitors can view textures and wireframe" />
      <ToggleSwitch v-model="form.isPublished" label="Publish right away" hint="Leave off to set up views and lighting first" />
      <ToggleSwitch v-model="form.isPrivate" label="Private" hint="Requires a Sketchfab PRO plan" />
      <div v-if="form.isPrivate">
        <label class="field-label" for="sf-pass">Password (optional)</label>
        <input id="sf-pass" v-model="form.password" type="password" class="input" maxlength="64" autocomplete="new-password" />
      </div>
    </div>

    <div v-if="busy" class="rounded-lg border border-line p-3" role="status" aria-live="polite">
      <div class="flex items-center gap-2 text-sm">
        <LoaderCircle class="size-4 animate-spin text-accent" /> {{ status ?? progress?.message ?? 'Uploading…' }}
      </div>
      <div v-if="!status" class="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
        <div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${progress?.percent ?? 5}%` }" />
      </div>
    </div>
    <div v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
      {{ error }}
      <slot name="error" />
    </div>

    <button type="submit" class="btn btn-primary w-full" :disabled="!canSubmit">
      <Upload class="size-4" /> Upload to Sketchfab
    </button>
    <slot name="footer" />
  </form>
</template>
