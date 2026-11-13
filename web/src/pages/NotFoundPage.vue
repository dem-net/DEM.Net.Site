<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="mx-auto max-w-xl px-4 py-24 text-center">
    <p class="text-sm font-semibold text-accent">404</p>
    <h1 class="mt-2 text-3xl font-semibold tracking-tight">This page does not exist</h1>
    <p class="mt-3 text-ink-3">It may have moved when the site was redesigned.</p>
    <RouterLink to="/" class="btn btn-primary mt-8">Go to the home page</RouterLink>
  </div>
</template>
