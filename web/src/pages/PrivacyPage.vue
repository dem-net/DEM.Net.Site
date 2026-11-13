<script setup lang="ts">
// The opt-out button is handled by https://m.elevationapi.com/script.js (delegated click on [data-analytics-optout]).
// The script only labels the button when the page first loads; in this SPA the page usually mounts later,
// so the initial label and state are computed here from the script's own opt-out cookie (read only).
const LABEL_IN = 'Stop measuring my visits'
const LABEL_OUT = 'Measure my visits again'
const optedOut = document.cookie.split('; ').includes('analytics_optout=1')
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-10 px-4 py-10">
    <section>
      <h1 class="text-3xl font-semibold tracking-tight">Privacy</h1>
      <p class="mt-4 text-ink-2">
        This site uses no advertising, no tracking cookies and no user accounts. Here is what it measures, stores and sends.
      </p>
    </section>

    <section id="analytics">
      <h2 class="text-xl font-semibold">Audience measurement</h2>
      <p class="mt-3 text-ink-2">
        This site measures its audience anonymously, without cookies or identifiers, with a tool hosted by the association in the
        European Union. Recorded: the page viewed, the site you came from (its name only), the type of device, browser and system,
        the browser language and the approximate city derived from the IP address. The IP address is never kept: it is only used to
        count each visitor once a day, in a non-reversible form renewed daily. Statistics are kept for at most 25 months and are
        neither shared nor combined with other data. You can object to this measurement with the button below (a cookie without any
        identifier remembers your choice for 13 months).
      </p>
      <button
        type="button"
        class="btn btn-secondary mt-4"
        data-analytics-optout
        :data-label-in="LABEL_IN"
        :data-label-out="LABEL_OUT"
        :data-analytics-optout-state="optedOut ? 'out' : 'in'"
      >
        {{ optedOut ? LABEL_OUT : LABEL_IN }}
      </button>
    </section>

    <section id="storage">
      <h2 class="text-xl font-semibold">Stored in your browser</h2>
      <p class="mt-3 text-ink-2">
        Nothing that identifies you. The map style you choose and the width of the side panel are kept in your browser's local
        storage so they stay as you left them. While you publish a model on Sketchfab, a one-time sign-in check is kept for that tab
        and deleted when you come back.
      </p>
    </section>

    <section id="services">
      <h2 class="text-xl font-semibold">Services this site uses</h2>
      <p class="mt-3 text-ink-2">Your browser connects to these services, which therefore see your IP address:</p>
      <ul class="mt-3 list-disc space-y-1 pl-5 text-ink-2">
        <li>the Elevation API (api.elevationapi.com), for elevations and 3D models;</li>
        <li>OpenFreeMap, OpenTopoMap and the AWS terrain tiles, for the map;</li>
        <li>Photon (komoot), for place search;</li>
        <li>Google Fonts, for the font;</li>
        <li>Vimeo, for the video on the home page (embedded with "do not track");</li>
        <li>Sketchfab, only when you choose to publish a model there.</li>
      </ul>
    </section>
  </div>
</template>
