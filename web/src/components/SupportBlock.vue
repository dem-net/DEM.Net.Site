<script setup lang="ts">
import { Heart } from '@lucide/vue'
import { sponsorLinks } from '@/content/links'
import BrandIcon from './BrandIcon.vue'
</script>

<template>
  <section id="support" class="card scroll-mt-20 p-6">
    <h2 class="flex items-center gap-2 text-lg font-semibold">
      <Heart class="size-5 text-[#ea4aaa]" aria-hidden="true" /> Support the project
    </h2>
    <p class="mt-2 text-sm text-ink-2">
      Elevation API is free and open source, but its servers cost about <strong class="text-ink">€100 a month</strong>. If it helps
      you, please consider sponsoring. Thank you!
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <a v-for="l in sponsorLinks" :key="l.brand" :href="l.url" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
        <BrandIcon :brand="l.brand" class="size-4" :class="l.brand === 'githubSponsors' ? 'text-[#ea4aaa]' : ''" />
        {{ l.label }}
      </a>
    </div>
  </section>
</template>
