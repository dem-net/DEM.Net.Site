<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { completeSketchfabLogin, isPopupState, sendPopupResult } from '@/api/sketchfabAuth'
import sketchfabLogo from '@/assets/sketchfablogo.png'
import SketchfabPublishForm from '@/components/SketchfabPublishForm.vue'

/**
 * OAuth implicit-grant callback. Sketchfab redirects here with
 *   #access_token=…&state=<nonce>&…   on success
 *   ?error=access_denied&state=…      on refusal
 *
 * Popup login (`state` starts with "popup."): hand the result to the model view that opened
 * the popup, then close. That window checks `state` against the nonce it holds in memory.
 *
 * Redirect login (fallback when popups are blocked): `state` must match the nonce stored by
 * beginSketchfabLogin(), so a crafted link carrying someone else's token is refused.
 */
const route = useRoute()
const router = useRouter()

const hash = new URLSearchParams(route.hash.replace(/^#/, ''))
const token = hash.get('access_token')
const state = hash.get('state') ?? (route.query.state as string | undefined) ?? null
const queryError = route.query.error as string | undefined
const popup = isPopupState(state)

if (popup) {
  sendPopupResult({ state, token: token ?? undefined, error: queryError ?? (token ? undefined : 'missing access token') })
}

const modelId = popup ? null : completeSketchfabLogin(state)
const authError = popup
  ? null
  : (queryError ??
    (!token ? 'missing access token' : !modelId ? 'the sign-in could not be verified, please start again from your model' : null))

const authorize = () => (token ? Promise.resolve(token) : Promise.reject(new Error('missing access token')))

onMounted(() => {
  // Keep the token in memory only; drop it from the address bar and history.
  if (route.hash) router.replace({ ...route, hash: '' })
  if (popup) window.close()
})
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

    <div v-if="popup" class="card p-5" role="status">
      <p class="font-medium">{{ token ? 'Signed in to Sketchfab.' : 'Sketchfab sign-in did not complete.' }}</p>
      <p class="mt-2 text-sm text-ink-2">You can close this window and return to your model.</p>
    </div>

    <div v-else-if="authError" class="card p-5" role="alert">
      <p class="font-medium text-danger">Sketchfab sign-in did not complete ({{ authError }}).</p>
      <p class="mt-2 text-sm text-ink-2">
        You can try again from your model, or download it and upload it to Sketchfab yourself.
      </p>
      <RouterLink to="/terrain" class="btn btn-secondary mt-4">Back to Map to 3D</RouterLink>
    </div>

    <div v-else-if="token && modelId" class="card">
      <SketchfabPublishForm :model-id="modelId" :authorize="authorize">
        <template #done>
          <div class="mt-4"><RouterLink to="/" class="text-sm text-ink-3 underline">Back to home</RouterLink></div>
        </template>
      </SketchfabPublishForm>
    </div>
  </div>
</template>
