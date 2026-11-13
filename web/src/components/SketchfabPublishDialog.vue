<script setup lang="ts">
import { ref } from 'vue'
import { X } from '@lucide/vue'
import { beginSketchfabLogin, PopupBlockedError, popupSketchfabLogin } from '@/api/sketchfabAuth'
import sketchfabLogo from '@/assets/sketchfablogo.png'
import SketchfabPublishForm from './SketchfabPublishForm.vue'

/**
 * Publish dialog shown over the model view, so the 3D preview is not lost.
 * Sign-in happens in a popup; the token is kept in memory for further uploads.
 * Stays mounted while closed, so an upload in progress keeps its state.
 */
const props = defineProps<{ modelId: string }>()

const dialog = ref<HTMLDialogElement>()
const blocked = ref(false)
let token: string | null = null
let pending: AbortController | null = null

function open() {
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

function onClose() {
  pending?.abort() // stop waiting for a sign-in the user walked away from
}

async function authorize(): Promise<string> {
  if (token) return token
  blocked.value = false
  pending = new AbortController()
  try {
    token = await popupSketchfabLogin(pending.signal)
    return token
  } catch (e) {
    if (e instanceof PopupBlockedError) blocked.value = true
    throw e
  } finally {
    pending = null
  }
}

/** Fallback: full-page redirect (leaves the model view). */
function signInInThisTab() {
  window.location.assign(beginSketchfabLogin(props.modelId))
}

defineExpose({ open })
</script>

<template>
  <dialog
    ref="dialog"
    class="card m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 text-ink shadow-xl backdrop:bg-page/70 backdrop:backdrop-blur-sm"
    aria-labelledby="sf-dialog-title"
    @close="onClose"
  >
    <div class="flex items-center gap-3 border-b border-line px-5 py-3">
      <img :src="sketchfabLogo" alt="" class="size-7" />
      <div class="min-w-0 flex-1">
        <h2 id="sf-dialog-title" class="font-semibold">Publish on Sketchfab</h2>
        <p class="text-xs text-ink-3">Elevation API adds the data credits automatically.</p>
      </div>
      <button type="button" class="rounded-md p-1.5 text-ink-3 hover:text-ink" aria-label="Close" @click="close">
        <X class="size-5" />
      </button>
    </div>
    <SketchfabPublishForm :model-id="modelId" :authorize="authorize">
      <template #error>
        <p v-if="blocked" class="mt-2">
          Allow pop-ups for this site and try again, or
          <button type="button" class="font-medium underline" @click="signInInThisTab">sign in in this tab</button>
          (this leaves the model view).
        </p>
      </template>
      <template #footer>
        <p class="text-center text-xs text-ink-3">Sketchfab sign-in opens in a separate window.</p>
      </template>
    </SketchfabPublishForm>
  </dialog>
</template>
