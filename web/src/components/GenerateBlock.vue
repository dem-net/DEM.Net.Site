<script setup lang="ts">
import { Box, LoaderCircle } from '@lucide/vue'

defineProps<{
  disabled?: boolean
  disabledReason?: string
  busy: boolean
  status: string
  percent: number
  error: string | null
  hasResult?: boolean
}>()
const emit = defineEmits<{ generate: []; cancel: []; show: [] }>()
</script>

<template>
  <div class="space-y-3">
    <button v-if="!busy" type="button" class="btn btn-primary w-full py-2.5" :disabled="disabled" @click="emit('generate')">
      <Box class="size-4" /> Generate 3D model
    </button>
    <p v-if="!busy && disabled && disabledReason" class="text-center text-xs text-ink-3">{{ disabledReason }}</p>

    <div v-if="busy" class="rounded-lg border border-line p-3" role="status" aria-live="polite">
      <div class="flex items-center gap-2 text-sm">
        <LoaderCircle class="size-4 shrink-0 animate-spin text-accent" />
        <span class="min-w-0 flex-1 truncate">{{ status }}</span>
        <button type="button" class="text-xs text-ink-3 underline hover:text-ink" @click="emit('cancel')">Cancel</button>
      </div>
      <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-subtle">
        <div
          class="h-full rounded-full bg-accent transition-[width] duration-500"
          :class="percent ? '' : 'w-1/3 animate-pulse'"
          :style="percent ? { width: `${percent}%` } : undefined"
        />
      </div>
    </div>

    <p v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{{ error }}</p>

    <button v-if="hasResult && !busy" type="button" class="btn btn-secondary w-full" @click="emit('show')">
      Show last model
    </button>
  </div>
</template>
