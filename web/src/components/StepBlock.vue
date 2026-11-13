<script setup lang="ts">
defineProps<{ n: number; title: string; done?: boolean }>()
</script>

<template>
  <section class="mb-6 last:mb-0">
    <h2 class="mb-3 flex items-center gap-2 text-sm font-semibold">
      <span
        class="flex size-6 items-center justify-center rounded-full text-xs"
        :class="done ? 'bg-accent text-on-accent' : 'bg-subtle text-ink-2'"
        >{{ n }}</span
      >
      {{ title }}
    </h2>
    <slot />
  </section>
</template>
