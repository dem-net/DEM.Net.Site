<script setup lang="ts">
import helladic from '@/assets/expo/Helladic.jpg'
import multimapas from '@/assets/expo/Multimapas.jpg'
import patopalpana from '@/assets/expo/Patopalpana.jpg'

interface Showcase {
  title: string
  field?: string
  image: string
  link: string
  linkLabel: string
  social?: { label: string; url: string }
  text: string
  extra?: { label: string; url: string }
  date: string
}

const items: Showcase[] = [
  {
    title: 'The Mycenaean Atlas Project',
    field: 'Archaeology, cultural heritage',
    image: helladic,
    link: 'http://www.helladic.info/',
    linkLabel: 'helladic.info',
    social: { label: '@Squinchpix', url: 'https://twitter.com/Squinchpix' },
    text: 'Very detailed Helladic (Mycenaean) site information. All 3,800 site elevations were updated using the Elevation API on the ASTER GDEM v3 dataset.',
    extra: { label: 'Blog post', url: 'http://mycenaeanatlasproject.blogspot.com/2019/11/a-convenient-api-for-retrieving.html' },
    date: 'Nov 2019',
  },
  {
    title: 'Patricio Romero',
    field: 'Archaeology, cultural heritage',
    image: patopalpana,
    link: 'https://www.nunatak.cl/',
    linkLabel: 'nunatak.cl',
    social: { label: '@pfromero', url: 'https://twitter.com/pfromero' },
    text: 'Patricio is mapping a Chilean region, helping with climate analysis from fossil trees left by local peoples at ceremonial sites. The API was used to map custom satellite imagery onto 3D models.',
    date: 'Oct 2019',
  },
  {
    title: 'Roy Rodenhaeuser · dymonlab',
    field: 'Augmented research',
    image: 'https://i.vimeocdn.com/video/825336768_540x303.jpg',
    link: 'https://www.dymonlab.com',
    linkLabel: 'dymonlab.com',
    social: { label: '@RoyRodenhaeuser', url: 'https://twitter.com/RoyRodenhaeuser' },
    text: 'Roy used the API to generate a 3D base map giving context to an archaeological piece in an augmented reality setup.',
    date: 'Oct 2019',
  },
  {
    title: 'Multimapas',
    image: multimapas,
    link: 'http://javier.jimenezshaw.com/mapas',
    linkLabel: 'javier.jimenezshaw.com/mapas',
    text: 'Javier Jiménez Shaw integrated the Elevation API for elevation profiles, and helped point out several bugs that were fixed. Check out his site, very helpful!',
    date: 'Nov 2019',
  },
]
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <h1 class="text-3xl font-semibold tracking-tight">Expo</h1>
    <p class="mt-2 text-ink-3">People and projects using the API. Thank you for getting in touch!</p>
    <div class="mt-8 grid gap-6 md:grid-cols-2">
      <article v-for="i in items" :key="i.title" class="card overflow-hidden">
        <a :href="i.link" target="_blank" rel="noopener noreferrer" class="block aspect-[2/1] bg-subtle">
          <img :src="i.image" :alt="i.title" class="size-full object-cover" loading="lazy" />
        </a>
        <div class="p-5">
          <h2 class="font-semibold">{{ i.title }}</h2>
          <p v-if="i.field" class="text-sm text-ink-3">{{ i.field }}</p>
          <p class="mt-3 text-sm text-ink-2">{{ i.text }}</p>
          <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a :href="i.link" target="_blank" rel="noopener noreferrer" class="text-accent underline">{{ i.linkLabel }}</a>
            <a v-if="i.social" :href="i.social.url" target="_blank" rel="noopener noreferrer" class="text-accent underline">{{ i.social.label }}</a>
            <a v-if="i.extra" :href="i.extra.url" target="_blank" rel="noopener noreferrer" class="text-accent underline">{{ i.extra.label }}</a>
            <span class="ml-auto text-ink-3">{{ i.date }}</span>
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
