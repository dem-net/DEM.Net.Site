<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string; hint?: string; disabled?: boolean }>()
</script>

<template>
  <label class="flex cursor-pointer items-start justify-between gap-4" :class="disabled ? 'cursor-not-allowed opacity-50' : ''">
    <span class="text-sm">
      <span class="block font-medium">{{ label }}</span>
      <span v-if="hint" class="block text-xs text-ink-3">{{ hint }}</span>
    </span>
    <input v-model="model" type="checkbox" role="switch" class="peer sr-only" :disabled="disabled" />
    <span
      aria-hidden="true"
      class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-line transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4"
    />
  </label>
</template>
