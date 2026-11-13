<script setup lang="ts">
import Faq from '@/content/faq.md'
import { discordLink } from '@/content/links'
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="text-3xl font-semibold tracking-tight">FAQ</h1>
    <p class="mt-2 text-ink-3">
      Answers to common questions. Need more? Ask the community on
      <a class="underline" :href="discordLink.url" target="_blank" rel="noopener noreferrer">Discord</a>.
    </p>
    <Faq class="mt-6" />
  </div>
</template>
