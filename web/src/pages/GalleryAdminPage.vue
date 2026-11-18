<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Inbox, LoaderCircle, LogOut, Mail, RefreshCw } from '@lucide/vue'
import { ApiError, galleryAdmin, hashParam } from '@/api/client'
import type { GalleryItem } from '@/api/types'
import GalleryReviewItem from '@/components/GalleryReviewItem.vue'
import { useGalleryAdmin } from '@/composables/gallery'

/**
 * Moderation of the gallery, for the site owner. Sign-in: the API emails a one-time link to the configured admin
 * address (/gallery/admin#login=…), exchanged here for a session kept in memory only.
 */
const route = useRoute()
const router = useRouter()
const admin = useGalleryAdmin()

const email = ref('')
const requesting = ref(false)
const linkSent = ref(false)
const signingIn = ref(false)
const error = ref<string | null>(null)

const pending = shallowRef<GalleryItem[]>([])
const loading = ref(false)
const loaded = ref(false)
const reviewed = ref(0)
let abort: AbortController | undefined

async function requestLink() {
  if (!email.value.trim()) return
  requesting.value = true
  error.value = null
  try {
    await galleryAdmin.requestLink(email.value)
    linkSent.value = true
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0
    error.value =
      status === 429
        ? 'Wait a few seconds before asking for another link.'
        : status === 404
          ? 'Moderation is not set up on the Elevation API.'
          : (e as Error).message
  } finally {
    requesting.value = false
  }
}

async function loadPending() {
  abort?.abort()
  abort = new AbortController()
  const signal = abort.signal
  loading.value = true
  error.value = null
  try {
    pending.value = await admin.call((s) => galleryAdmin.pending(s, signal))
    loaded.value = true
  } catch (e) {
    if (!signal.aborted) error.value = (e as Error).message
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function onDone(id: string) {
  pending.value = pending.value.filter((i) => i.id !== id)
  reviewed.value++
}

async function signOut() {
  abort?.abort()
  await admin.signOut()
  pending.value = []
  loaded.value = false
  linkSent.value = false
}

/** Signs in with a link's token: when the page opens with it, or when the link is opened in a tab already on it. */
async function signInWithLink(hash: string) {
  const login = hashParam(hash, 'login')
  if (!login) return
  // The link works once: take it out of the address bar and the history at once.
  router.replace({ path: route.path, hash: '' })
  error.value = null
  linkSent.value = false
  signingIn.value = true
  try {
    await admin.signIn(login)
  } catch (e) {
    error.value =
      e instanceof ApiError && e.status === 401
        ? 'This sign-in link has expired or was already used. Ask for a new one.'
        : (e as Error).message
  } finally {
    signingIn.value = false
  }
  if (admin.signedIn.value) loadPending()
}

watch(() => route.hash, signInWithLink, { immediate: true })
onMounted(() => {
  if (admin.signedIn.value && !hashParam(route.hash, 'login')) loadPending()
})

// A call that finds the session expired signs out: show the sign-in form again, with the reason.
watch(admin.signedIn, (signedIn) => {
  if (!signedIn) {
    pending.value = []
    loaded.value = false
  }
})

onBeforeUnmount(() => abort?.abort())
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <div class="flex flex-wrap items-start gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-3xl font-semibold tracking-tight">Gallery review</h1>
        <p class="mt-2 text-ink-2">
          Submissions to the <RouterLink to="/gallery" class="text-accent hover:underline">gallery</RouterLink> wait here until
          you approve them.
        </p>
      </div>
      <template v-if="admin.signedIn.value">
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="loadPending">
          <RefreshCw class="size-4" :class="{ 'animate-spin': loading }" /> Refresh
        </button>
        <button type="button" class="btn btn-secondary" @click="signOut"><LogOut class="size-4" /> Sign out</button>
      </template>
    </div>

    <div v-if="error" role="alert" class="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{{ error }}</div>

    <div v-if="signingIn" class="mt-8 flex items-center gap-2 text-ink-3" role="status">
      <LoaderCircle class="size-5 animate-spin" /> Signing in…
    </div>

    <!-- Sign-in -->
    <section v-else-if="!admin.signedIn.value" class="mt-8 max-w-md">
      <div v-if="linkSent" role="status" class="rounded-xl border border-line p-4">
        <p class="flex items-center gap-2 font-medium"><Mail class="size-4 text-accent" /> Check your inbox</p>
        <p class="mt-1 text-sm text-ink-2">
          If this is the owner's address, a sign-in link is on its way. It works once, for a few minutes, in this browser or
          any other.
        </p>
        <button type="button" class="btn btn-secondary mt-3" @click="linkSent = false">Use another address</button>
      </div>
      <form v-else class="space-y-3" @submit.prevent="requestLink">
        <div>
          <label class="field-label" for="admin-email">Owner's email address</label>
          <input id="admin-email" v-model="email" type="email" class="input" autocomplete="email" required />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="requesting || !email.trim()">
          <LoaderCircle v-if="requesting" class="size-4 animate-spin" /><Mail v-else class="size-4" /> Email me a sign-in link
        </button>
        <p class="text-xs text-ink-3">You stay signed in until you close or reload this page.</p>
      </form>
    </section>

    <!-- Review -->
    <section v-else class="mt-8">
      <p v-if="loaded" class="mb-4 text-sm text-ink-3" role="status">
        {{ pending.length ? `${pending.length} waiting for review, oldest first.` : 'Nothing waiting for review.' }}
        <span v-if="reviewed"> {{ reviewed }} reviewed in this session.</span>
      </p>
      <div v-if="loading && !loaded" class="flex items-center gap-2 text-ink-3"><LoaderCircle class="size-5 animate-spin" /> Loading…</div>
      <div v-else-if="loaded && !pending.length" class="rounded-xl border border-dashed border-line p-10 text-center">
        <Inbox class="mx-auto size-8 text-ink-3" />
      </div>
      <div class="space-y-4">
        <GalleryReviewItem v-for="item in pending" :key="item.id" :item="item" @done="onDone" />
      </div>
    </section>
  </div>
</template>
