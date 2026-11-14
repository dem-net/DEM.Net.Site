<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowRight, Layers, Mountain, Route, Spline } from '@lucide/vue'
import NewBadge from '@/components/NewBadge.vue'
import SupportBlock from '@/components/SupportBlock.vue'

const tools = [
  {
    to: '/terrain',
    icon: Mountain,
    title: 'Map to 3D',
    text: 'Draw an area anywhere on Earth and get a textured terrain model, with OpenStreetMap buildings if you like.',
  },
  {
    to: '/gpx',
    icon: Route,
    title: 'GPX to 3D',
    text: 'Upload a hike, ride or run and see it in 3D on the terrain around it.',
  },
  {
    to: '/textures',
    icon: Layers,
    title: 'Textures',
    text: 'Get the georeferenced satellite texture, normal map and height map of any area.',
    isNew: true,
  },
  {
    to: '/elevation',
    icon: Spline,
    title: 'Elevation',
    text: 'Click for the elevation of a point, or draw a path for its elevation profile.',
  },
]
</script>

<template>
  <div>
    <section class="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
      <div>
        <h1 class="text-4xl font-semibold tracking-tight text-balance md:text-5xl">3D terrain models from any place on Earth</h1>
        <p class="mt-4 text-lg text-ink-2">
          A free, open source API for global elevation data, with live generation of textured 3D terrain in glTF and STL.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/terrain" class="btn btn-primary px-5 py-2.5">Start on the map <ArrowRight class="size-4" /></RouterLink>
          <RouterLink to="/faq" class="btn btn-secondary px-5 py-2.5">Use the API</RouterLink>
        </div>
      </div>
      <div class="aspect-video overflow-hidden rounded-2xl bg-subtle shadow-lg">
        <iframe
          src="https://player.vimeo.com/video/416024952?dnt=1"
          title="Elevation API demo"
          class="size-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          loading="lazy"
        />
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 pb-16">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <RouterLink v-for="t in tools" :key="t.to" :to="t.to" class="card group p-6 transition-colors hover:border-accent">
          <component :is="t.icon" class="size-6 text-accent" />
          <h2 class="mt-4 flex items-center gap-1 font-semibold">
            {{ t.title }}
            <NewBadge v-if="'isNew' in t && t.isNew" class="ml-1" />
            <ArrowRight class="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </h2>
          <p class="mt-1 text-sm text-ink-3">{{ t.text }}</p>
        </RouterLink>
      </div>
      <SupportBlock class="mt-10" />
    </section>
  </div>
</template>
