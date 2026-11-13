<script setup lang="ts">
import { safeUrl } from '@/api/client'
import BrandIcon from '@/components/BrandIcon.vue'
import SupportBlock from '@/components/SupportBlock.vue'
import { useCatalog } from '@/composables/useCatalog'
import { socialLinks } from '@/content/links'

const SWISSTOPO_TERMS = 'https://www.swisstopo.admin.ch/en/home/meta/conditions/geodata/ogd.html'

const { datasets, imagery, loaded } = useCatalog()
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-12 px-4 py-10">
    <section>
      <h1 class="text-3xl font-semibold tracking-tight">About</h1>
      <div class="mt-4 space-y-3 text-ink-2">
        <p>
          Hi! I'm Xavier Fischer, a developer from France. DEM.Net was created in 2018: I wanted to get elevation profiles using my
          stack, Microsoft .NET.
        </p>
        <p>
          It quickly became a great opportunity to explore Digital Elevation Models and build an open API for elevation requests, and
          it led me to 3D quite fast: generating 3D models from real data.
        </p>
        <p>
          Then, with contagious enthusiasm, I called for help Frédéric Aubin, who helped me with Triangulated Irregular Network (TIN)
          generation and added this great brick to DEM.Net for geomorphology purposes.
        </p>
        <p>
          All contributions are welcome! The core library and samples are open source on
          <a class="text-accent underline" href="https://github.com/dem-net/DEM.Net" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      </div>
    </section>

    <section>
      <h2 class="text-xl font-semibold">Get in touch</h2>
      <ul class="mt-4 grid gap-2 sm:grid-cols-2">
        <li v-for="l in socialLinks" :key="l.brand">
          <a
            :href="l.url"
            target="_blank"
            rel="noopener noreferrer"
            class="card flex items-center gap-3 px-4 py-3 transition-colors hover:border-accent"
          >
            <BrandIcon :brand="l.brand" class="size-5 shrink-0 text-ink-2" />
            <span class="min-w-0">
              <span class="block font-medium">{{ l.label }}</span>
              <span class="block truncate text-sm text-ink-3">{{ l.detail }}</span>
            </span>
          </a>
        </li>
      </ul>
    </section>

    <SupportBlock />

    <section>
      <h2 class="text-xl font-semibold">Model formats</h2>
      <ul class="mt-3 space-y-2 text-ink-2">
        <li><strong class="text-ink">glTF (GLB)</strong>: open 3D exchange format, textured, supported by most software and viewers.</li>
        <li><strong class="text-ink">STL</strong>: the standard format for 3D printing. Supported by every 3D printer, no colours.</li>
        <li>
          <strong class="text-ink">OBJ</strong>: available as a download (ZIP with the mesh, material and texture) for glTF models,
          for software that doesn't read glTF.
        </li>
      </ul>
    </section>

    <section>
      <h2 class="text-xl font-semibold">Elevation datasets</h2>
      <p class="mt-3 text-sm text-ink-2">
        Access to data provided by the
        <a class="text-accent underline" href="https://opentopography.org/" target="_blank" rel="noopener noreferrer">OpenTopography Facility</a>
        with support from the National Science Foundation under NSF Award Numbers 1833703, 1833643, and 1833632.
      </p>
      <p class="mt-2 text-sm text-ink-2">
        ETOPO1 data: Amante, C. and B.W. Eakins, 2009. ETOPO1 1 Arc-Minute Global Relief Model: Procedures, Data Sources and Analysis.
        NOAA Technical Memorandum NESDIS NGDC-24. National Geophysical Data Center, NOAA. doi:10.7289/V5C8276M.
      </p>
      <p v-if="!loaded" class="mt-4 text-sm text-ink-3">Loading datasets…</p>
      <div v-else class="mt-4 space-y-2">
        <details v-for="d in datasets" :key="d.name" class="card group px-4 py-3">
          <summary class="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="font-semibold">{{ d.name }}</span>
            <span class="text-sm text-ink-3">{{ d.resolutionMeters }} m · {{ d.extentInfo ?? 'Global' }}</span>
            <span class="ml-auto text-xs text-accent group-open:hidden">Details</span>
          </summary>
          <p class="mt-2 text-sm text-ink-2">{{ d.description }}</p>
          <p class="mt-2 text-sm">
            Source:
            <a :href="safeUrl(d.attribution.url)" target="_blank" rel="noopener noreferrer" class="text-accent underline">{{ d.attribution.text }}</a>
          </p>
          <p v-if="d.attribution.acknowledgement" class="mt-2 text-xs whitespace-pre-line text-ink-3">{{ d.attribution.acknowledgement }}</p>
        </details>
      </div>
    </section>

    <section id="swiss">
      <h2 class="text-xl font-semibold">Swiss data</h2>
      <p class="mt-3 text-sm text-ink-2">
        The swissALTI3D elevation models (2 m and 50 cm) and SwissImage aerial imagery are open government data from the
        <a class="text-accent underline" href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener noreferrer"
          >Federal Office of Topography swisstopo</a
        >. They cover Switzerland and Liechtenstein. Models made with them must credit
        <strong class="text-ink">© swisstopo</strong>, as described in swisstopo's
        <a class="text-accent underline" :href="SWISSTOPO_TERMS" target="_blank" rel="noopener noreferrer">terms of use for open geodata</a>.
      </p>
    </section>

    <section id="imagery">
      <h2 class="text-xl font-semibold">Imagery providers</h2>
      <div class="mt-4 space-y-2">
        <details v-for="p in imagery" :key="p.name" class="card group px-4 py-3">
          <summary class="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="font-semibold">{{ p.attribution?.text || p.name }}</span>
            <span class="text-sm text-ink-3">max zoom {{ p.maxZoom }}</span>
            <span class="ml-auto text-xs text-accent group-open:hidden">Details</span>
          </summary>
          <p class="mt-2 text-sm">
            <a :href="safeUrl(p.attribution?.url)" target="_blank" rel="noopener noreferrer" class="text-accent underline">{{ p.attribution?.url }}</a>
          </p>
          <p v-if="p.attribution?.acknowledgement" class="mt-1 text-xs text-ink-3">{{ p.attribution?.acknowledgement }}</p>
        </details>
      </div>
    </section>
  </div>
</template>
