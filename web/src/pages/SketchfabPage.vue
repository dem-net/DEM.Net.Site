<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ExternalLink, LoaderCircle, Upload, X } from '@lucide/vue'
import { api } from '@/api/client'
import { ensureConnected, useProgress } from '@/api/hub'
import sketchfabLogo from '@/assets/sketchfablogo.png'
import ToggleSwitch from '@/components/ToggleSwitch.vue'

/**
 * OAuth implicit-grant callback. Sketchfab redirects here with
 *   #access_token=…&state=<modelId>&…   on success
 *   ?error=access_denied&state=…        on refusal
 */
const route = useRoute()
const router = useRouter()

const hash = new URLSearchParams(route.hash.replace(/^#/, ''))
const token = hash.get('access_token')
const modelId = hash.get('state') ?? (route.query.state as string | undefined) ?? null
const authError = (route.query.error as string | undefined) ?? (!token ? 'missing access token' : null)

const form = reactive({
  modelName: '',
  description: '',
  tags: [] as string[],
  isInspectable: true,
  isPublished: false,
  isPrivate: false,
  password: '',
})
const tagDraft = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const viewerUrl = ref<string | null>(null)
const { progress } = useProgress('export')

onMounted(() => {
  // Keep the token in memory only; drop it from the address bar and history.
  if (route.hash) router.replace({ ...route, hash: '' })
})

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

const canSubmit = computed(() => !!token && !!modelId && form.modelName.trim().length > 0 && !busy.value)

async function upload() {
  if (!token || !modelId) return
  addTag()
  busy.value = true
  error.value = null
  try {
    const clientConnectionId = await ensureConnected()
    const res = await api.sketchfabExport({
      ...form,
      password: form.isPrivate ? form.password : '',
      userToken: token,
      modelId,
      clientConnectionId,
    })
    viewerUrl.value = res.viewModelUrl
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10">
    <div class="mb-6 flex items-center gap-3">
      <img :src="sketchfabLogo" alt="" class="size-9" />
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Publish on Sketchfab</h1>
        <p class="text-sm text-ink-3">Elevation API adds the data credits automatically.</p>
      </div>
    </div>

    <div v-if="authError" class="card p-5" role="alert">
      <p class="font-medium text-danger">Sketchfab sign-in did not complete ({{ authError }}).</p>
      <p class="mt-2 text-sm text-ink-2">
        You can try again from your model, or download it and upload it to Sketchfab yourself.
      </p>
      <RouterLink to="/terrain" class="btn btn-secondary mt-4">Back to Map to 3D</RouterLink>
    </div>

    <div v-else-if="viewerUrl" class="card p-6 text-center">
      <p class="text-lg font-semibold">Upload complete</p>
      <p class="mt-1 text-sm text-ink-3">Sketchfab may take a few minutes to process your model.</p>
      <a :href="viewerUrl" target="_blank" rel="noopener noreferrer" class="btn btn-primary mt-5">
        View on Sketchfab <ExternalLink class="size-4" />
      </a>
      <div class="mt-4"><RouterLink to="/" class="text-sm text-ink-3 underline">Back to home</RouterLink></div>
    </div>

    <form v-else class="card space-y-5 p-5" @submit.prevent="upload">
      <div>
        <label class="field-label" for="sf-name">Model name</label>
        <input id="sf-name" v-model="form.modelName" class="input" maxlength="48" required placeholder="Mont Blanc massif" />
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
          <LoaderCircle class="size-4 animate-spin text-accent" /> {{ progress?.message ?? 'Uploading…' }}
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div class="h-full rounded-full bg-accent transition-[width]" :style="{ width: `${progress?.percent ?? 5}%` }" />
        </div>
      </div>
      <p v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

      <button type="submit" class="btn btn-primary w-full" :disabled="!canSubmit">
        <Upload class="size-4" /> Upload to Sketchfab
      </button>
    </form>
  </div>
</template>
