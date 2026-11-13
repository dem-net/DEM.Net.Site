# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Front end for elevationapi.com: a Vue 3 + Vite + TypeScript SPA (Tailwind CSS v4, MapLibre GL) that calls the DEM.Net Elevation API. The API is a separate ASP.NET backend that is not in this repo. All app code is in `web/`. The previous Vue 2 app (`dem-net-vue/`) was removed and is still available in git history.

## Commands

Run from `web/`. Node 22+ is required. On this machine, the `node` in `/usr/local/bin` is an Intel build that won't run, so put Homebrew's first on PATH: `export PATH=/opt/homebrew/opt/node@22/bin:$PATH`. `~/.npm` is root-owned; if npm fails with EACCES, set `npm_config_cache` to a writable directory.

```
npm run dev          # dev server, http://localhost:5173
npm test             # Vitest (unit tests: src/**/*.test.ts)
npx vitest run src/api/client.test.ts   # single test file
npm run lint         # ESLint flat config (eslint.config.js)
npm run typecheck    # vue-tsc -b
npm run build        # vue-tsc -b && vite build → web/dist (also writes 404.html)
```

The API base URL defaults to `https://api.elevationapi.com` in `src/api/client.ts`. To use a local backend, set `VITE_API_BASEURL` in `web/.env.development.local`. Don't rely on `web/.env`: the root `.gitignore` excludes `.env`, so CI never sees it. The API sends CORS headers for any origin, so there's no dev proxy.

Deploy: `.github/workflows/deploy.yml` tests, builds and publishes `web/dist` to GitHub Pages (custom domain elevationapi.com) on pushes to `master` that touch `web/`. The Pages source must be set to "GitHub Actions".

## Architecture

- **API layer** (`src/api/`):
  - `client.ts` is the only place that builds API URLs: endpoints, query parameters and `toModelResult()`, which turns response file paths into absolute URLs.
  - Bbox path segments are ordered **west,east,south,north**.
  - API errors can be plain text (e.g. "Extent is too big … Maximum size is 100.00 MB") or JSON `{message}`; `readError()` handles both.
  - The hosted API refuses to generate models over 100 MB.
  - **Size estimate:**
    - Adding `onlyEstimateSize=true` to the bbox and OSM endpoints returns `{success, estimatedModelFileSizeMB, estimatedModelFileSizeAfterReduceMB, maximumAllowedFileSizeMB}` in about 0.25 s. An over-limit request still returns HTTP 200, with `success: false`.
    - The estimate is approximate: real files differ by 2–3× in either direction. The server uses the same number to refuse requests, so it's the right gate.
    - The GPX endpoint ignores `onlyEstimateSize`. The GPX page estimates with the bbox endpoint over the track bounds plus 1 km, and only warns.
    - `useSizeEstimate()` handles the debouncing and the "Reduce to fit" detail level (`detailToFit`, linear in `meshReduceFactor`).
  - `meshReduceFactor` (0.1–1) is the UI's "Mesh detail" (10–100 %, default 50 %).
- **SignalR progress** (`src/api/hub.ts`):
  - One shared `@microsoft/signalr` connection to `/elevation-hub`.
  - `useProgress('generate' | 'export')` joins and leaves the server group (`Join/LeaveGeneratorGroup`, `Join/LeaveExportGroup`) and listens for `ReportGenerateProgress` / `ReportExportProgress`. Group membership is ref-counted and re-joined after a reconnect.
  - Generation calls pass `clientConnectionId` (from `ensureConnected()`) so the server knows where to push progress. `useGenerate()` (`src/composables/useGenerate.ts`) wraps this with busy, error, cancel and result state.
- **Shared catalog** (`src/composables/useCatalog.ts`): the dataset and imagery lists are fetched once per session as module-level refs. There is no Vuex or Pinia.
- **Map** (`src/components/map/`):
  - `BaseMap.vue` creates the MapLibre map: OpenFreeMap vector style, plus an OpenTopoMap raster layer and AWS Terrarium hillshade/3D terrain, both added once and switched by toggling visibility.
    - Never call `setStyle()`: it would wipe the drawing layers.
  - `BaseMap.vue` emits `ready(map)` for pages and also provides the map to slot children through `useMap()`.
  - `setWorkerUrl()` with a `?url` import of `maplibre-gl-worker.mjs` is required. Without it, MapLibre 6's worker fails to load under Vite.
  - The map container must be sized with `h-full`, not `absolute inset-0`, because MapLibre's CSS forces `position: relative` on it.
  - `createDraw.ts` wraps terra-draw for drawing one shape at a time (rectangle or line). Coordinates must be rounded (see `round6`), or terra-draw silently rejects the feature.
  - `AddressSearch.vue` uses Photon (`src/composables/geocoder.ts`). Nominatim's usage policy forbids autocomplete.
- **Pages** (`src/pages/`):
  - Tool pages use `ToolLayout` (a side panel with a sticky footer for the primary action, and the map).
  - `TerrainPage` covers both plain terrain and OSM models: the OSM switch selects `/api/model/3d/bbox/osm/…`.
  - The selected area is stored in `?bbox=`.
  - Old URLs (`/playground_*`) redirect in `src/router.ts`.
  - `/sketchfab_oauth2` is the OAuth redirect URI registered with Sketchfab, so the path must not change. It reads `access_token` and `state` (the model id) from the URL hash and then removes them.
- **3D preview**:
  - `viewers/GlbViewer.vue` uses `<model-viewer>`, loaded lazily and registered as a custom element in `vite.config.ts`. It shows load progress and asks before loading large files.
  - `viewers/StlViewer.vue` is a minimal three.js viewer, because `<model-viewer>` can't read STL. `three` must stay on the version `@google/model-viewer` expects as a peer dependency.
- **Theming**: color tokens are CSS variables in `src/style.css`, mapped to Tailwind colors (`bg-surface`, `text-ink-2`, `bg-accent`, …), with a dark palette applied through `prefers-color-scheme`. Use those tokens rather than raw colors. Buttons use `btn btn-primary` / `btn btn-secondary`.
- **Content**:
  - `src/content/faq.md` is compiled into a Vue component by `unplugin-vue-markdown`.
  - Every external social and sponsor link (GitHub, Discord, Bluesky, LinkedIn, Sketchfab, GitHub Sponsors, Patreon, PayPal) lives in `src/content/links.ts`. The header, footer, About and `SupportBlock` all read it.
  - Brand logos come from `BrandIcon.vue`, which uses `simple-icons` (CC0). LinkedIn is hand-drawn because simple-icons removed it. The site deliberately has no Twitter or Slack links.
- **Regional data** (`src/composables/region.ts`, `RegionHint.vue`):
  - A dataset's coverage comes from its `extentInfo`; an imagery provider's comes from names like "SwissImage (Switzerland only)".
  - The area's country is found by Photon reverse geocoding of the area's centre.
  - Inside CH/LI, the hint offers swissALTI3D 2m + SwissImage. When a regional option is used outside its country, it warns.
- **OBJ export**: `GET /api/model/export/obj?modelId=<requestId>` returns a ZIP (`.obj`, `.mtl`, texture) for glTF models only (`ModelResult.objUrl`).
- **GitHub Pages SPA routing**: the build copies `index.html` to `404.html` (a plugin in `vite.config.ts`), so deep links load the app.
