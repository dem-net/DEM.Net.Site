<script setup lang="ts">
import { computed } from 'vue'
import { siBluesky, siDiscord, siGithub, siGithubsponsors, siPatreon, siPaypal, siSketchfab } from 'simple-icons'
import type { Brand } from '@/content/links'

/** Brand logos (Simple Icons, CC0) drawn in currentColor; LinkedIn is hand-drawn since Simple Icons dropped it. */
const props = defineProps<{ brand: Brand }>()

const paths: Record<Exclude<Brand, 'linkedin'>, string> = {
  github: siGithub.path,
  discord: siDiscord.path,
  bluesky: siBluesky.path,
  sketchfab: siSketchfab.path,
  githubSponsors: siGithubsponsors.path,
  patreon: siPatreon.path,
  paypal: siPaypal.path,
}

const path = computed(() => (props.brand === 'linkedin' ? null : paths[props.brand]))
const maskId = `li-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <path v-if="path" :d="path" />
    <template v-else>
      <mask :id="maskId">
        <rect width="24" height="24" fill="white" />
        <circle cx="6.9" cy="6.9" r="1.75" fill="black" />
        <rect x="5.4" y="9.4" width="3" height="9.4" fill="black" />
        <path
          d="M10.6 9.4h2.9v1.3c.45-.8 1.5-1.55 3.05-1.55 3.1 0 3.65 2 3.65 4.65v4.99h-3v-4.43c0-1.06-.02-2.42-1.48-2.42-1.48 0-1.7 1.15-1.7 2.34v4.51h-3.42z"
          fill="black"
        />
      </mask>
      <rect width="24" height="24" rx="3.5" :mask="`url(#${maskId})`" />
    </template>
  </svg>
</template>
