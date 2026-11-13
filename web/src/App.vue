<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { Heart, Menu, X } from '@lucide/vue'
import BrandIcon from '@/components/BrandIcon.vue'
import { socialLinks } from '@/content/links'
import logo from '@/assets/DEMnet_logo_long.png'
import { useCatalog } from '@/composables/useCatalog'

const route = useRoute()
const fullBleed = computed(() => route.meta.fullBleed === true)
const menuOpen = ref(false)
watch(() => route.fullPath, () => (menuOpen.value = false))

const { error: catalogError, retry } = useCatalog()

const tools = [
  { to: '/terrain', label: 'Map to 3D' },
  { to: '/gpx', label: 'GPX to 3D' },
  { to: '/elevation', label: 'Elevation' },
]
/** Header shows contact channels; the footer also lists Sketchfab. */
const headerSocial = socialLinks.filter((l) => l.brand !== 'sketchfab')
const pages = [
  { to: '/expo', label: 'Expo' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
]
</script>

<template>
  <div class="flex min-h-full flex-col" :class="fullBleed ? 'h-dvh' : ''">
    <header
      class="sticky top-0 z-30 border-b border-line bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur"
    >
      <nav class="mx-auto flex h-14 items-center gap-6 px-4" :class="fullBleed ? '' : 'max-w-6xl'">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2" aria-label="Elevation API home">
          <img :src="logo" alt="" class="h-7 w-auto" />
          <span class="text-sm font-semibold tracking-tight">Elevation API</span>
        </RouterLink>

        <div class="hidden flex-1 items-center gap-1 md:flex">
          <RouterLink
            v-for="l in [...tools, ...pages]"
            :key="l.to"
            :to="l.to"
            class="rounded-md px-3 py-1.5 text-sm text-ink-2 hover:bg-subtle hover:text-ink"
            active-class="!bg-accent-soft !text-accent font-medium"
          >
            {{ l.label }}
          </RouterLink>
        </div>

        <div class="ml-auto hidden items-center gap-0.5 lg:flex">
          <a
            v-for="l in headerSocial"
            :key="l.brand"
            :href="l.url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md p-2 text-ink-3 hover:bg-subtle hover:text-ink"
            :aria-label="l.label"
            :title="l.label"
          >
            <BrandIcon :brand="l.brand" class="size-[18px]" />
          </a>
        </div>

        <button
          type="button"
          class="ml-auto rounded-md p-2 text-ink-2 hover:bg-subtle md:hidden"
          :aria-expanded="menuOpen"
          aria-controls="mobile-menu"
          aria-label="Menu"
          @click="menuOpen = !menuOpen"
        >
          <X v-if="menuOpen" class="size-5" />
          <Menu v-else class="size-5" />
        </button>
      </nav>

      <div v-show="menuOpen" id="mobile-menu" class="border-t border-line px-4 py-3 md:hidden">
        <p class="field-label">Tools</p>
        <RouterLink
          v-for="l in tools"
          :key="l.to"
          :to="l.to"
          class="block rounded-md px-2 py-2 text-ink"
          active-class="text-accent font-medium"
        >
          {{ l.label }}
        </RouterLink>
        <div class="my-2 border-t border-line" />
        <RouterLink v-for="l in pages" :key="l.to" :to="l.to" class="block rounded-md px-2 py-2 text-ink-2">
          {{ l.label }}
        </RouterLink>
        <div class="mt-2 flex gap-1 border-t border-line pt-3">
          <a
            v-for="l in headerSocial"
            :key="l.brand"
            :href="l.url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md p-2 text-ink-2 hover:bg-subtle"
            :aria-label="l.label"
          >
            <BrandIcon :brand="l.brand" class="size-5" />
          </a>
        </div>
      </div>
    </header>

    <div
      v-if="catalogError"
      role="alert"
      class="flex flex-wrap items-center justify-center gap-3 bg-danger-soft px-4 py-2 text-sm text-danger"
    >
      The Elevation API is not responding ({{ catalogError }}).
      <button type="button" class="font-medium underline" @click="retry()">Try again</button>
    </div>

    <main class="flex-1" :class="fullBleed ? 'min-h-0' : ''">
      <RouterView />
    </main>

    <footer v-if="!fullBleed" class="border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-3">
        <span>© Elevation API · built on <a class="hover:text-ink" href="https://github.com/dem-net/DEM.Net">DEM.Net</a></span>
        <RouterLink to="/about#support" class="inline-flex items-center gap-1.5 hover:text-ink">
          <Heart class="size-4 text-[#ea4aaa]" aria-hidden="true" /> Sponsor
        </RouterLink>
        <span class="flex flex-wrap gap-1 sm:ml-auto">
          <a
            v-for="l in socialLinks"
            :key="l.brand"
            :href="l.url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md p-2 hover:bg-subtle hover:text-ink"
            :aria-label="l.label"
            :title="l.label"
          >
            <BrandIcon :brand="l.brand" class="size-[18px]" />
          </a>
        </span>
      </div>
    </footer>
  </div>
</template>
