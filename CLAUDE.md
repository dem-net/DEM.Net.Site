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
  - **Textures** (`texturePath()`, `api.textures()`): `GET /api/texture/bbox/{w,e,s,n}?outputs=texture,normalmap,heightmap` generates only the requested images.
    - Every image comes with a world file (`.jgw`/`.pgw`) and a `.prj`, plus one ZIP with `metadata.json` (min/max elevation for decoding the 16-bit height map). `toTextureResult()` rejects an image without its georeferencing.
    - The texture is in EPSG:3857. The normal map and height map are in the dataset's SRID (one pixel per DEM sample).
    - `onlyEstimateSize=true` returns per-image estimates, gated by the same limit as models (`useTextureEstimate()`).
    - Model endpoints no longer return `heightMap`/`albedoTexture`/`normalMapTexture` (the texture is only embedded in the GLB).
    - Cross-origin `<a download>` is ignored, so the page saves sidecar files with `saveFile()` (`src/api/download.ts`).
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
  - `StatsPage` (`/stats`) maps every successful generation from `GET /api/stats/generations` (compact rows read by `toGenerationStats()`; the backend stores them in PostgreSQL/PostGIS, cached for a minute). Footprints are exact, not snapped: that was a deliberate choice.
    - Each dataset has its own sources and layers (footprint fill + outline, plus centre points that fade out by zoom 10), toggled from the panel. Aggregation, colors and GeoJSON are in `src/composables/generationStats.ts`.
    - Colors: the 7 most used datasets take the fixed categorical order (`SERIES_COLORS`, CVD-validated on adjacent pairs), the rest share `OTHER_COLOR`. Colors are assigned once per load, so hiding a dataset never repaints the others.
    - The page defaults to the Streets basemap. MapLibre popups live outside the component, so their theme styles are in an unscoped, `.stats-popup`-namespaced `<style>`.
    - What's published is disclosed on `/privacy#statistics`. Update it if the published fields change.
  - `TexturesPage` (`/textures`) has one Generate button per image plus "Generate all (.zip)". Only one job runs at a time (the server throttle). Results are dropped when the area or options change. The Map to 3D result links to it with the same `?bbox=`.
  - Shared pieces: `AreaStep.vue` (step 1 of the bbox tools), `ImageryFields.vue` (imagery + quality), `RegionHint.vue` (`v-model:dataset`, `v-model:imagery-provider`).
  - The "New" badge (`NewBadge.vue`) is driven by `isNew` on the tool entries in `App.vue` and `HomePage.vue`. Remove it there once the tool is no longer new.
  - The selected area is stored in `?bbox=`.
  - **Share links** (Map to 3D, `ShareButton.vue`) add the map view, basemap, 3D relief and the non-default model options to the URL (`src/composables/shareLink.ts`).
    - Values from a link are validated, and dataset and imagery names are checked against the catalog.
    - The share parameters are removed from the address bar once applied, so only `?bbox=` stays live.
    - New model options must be added to `optionsToQuery`/`optionsFromQuery`, or shared links will silently drop them.
  - Old URLs (`/playground_*`) redirect in `src/router.ts`.
  - `/sketchfab_oauth2` is the OAuth redirect URI registered with Sketchfab, so the path must not change. It reads `access_token` and `state` from the URL hash and then removes them. `state` is a CSRF nonce, not the model id: `beginSketchfabLogin()` (`src/api/sketchfabAuth.ts`) stores `{nonce, modelId}` in `sessionStorage`, and the callback refuses a token whose `state` doesn't match.
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
- **Security**:
  - The production build gets a Content-Security-Policy `<meta>` tag (`contentSecurityPolicy()` in `vite.config.ts`; build only, because dev HMR uses inline scripts). Add any new third-party host there, or the browser silently blocks it.
  - Bind API-supplied URLs to `href` through `safeUrl()` (`client.ts`), which allows only http(s): Vue doesn't block `javascript:` URLs.
  - The API's CORS allows any origin *without* credentials, so the SignalR connection uses `withCredentials: false`.
  - The backend (`/Users/xfischer/Repos/DEM.Net.WebAPI`) throttles generation and exports per client IP (1 per 5 s, 1 running at a time by default); a second request gets HTTP 429 with `Retry-After`. Size estimates aren't throttled.
- **Analytics**: the self-hosted cookieless tracker (`https://m.elevationapi.com/script.js`, from the `add-analytics` skill in `~/Repos/analytics`) is loaded in `index.html` with `data-spa`.
  - No `data-404`: `404.html` is a copy of `index.html` and serves every deep link, so every deep-link visit would be counted as "not found".
  - The CSP allows `m.elevationapi.com` in `script-src` and `connect-src`. `/privacy` (`PrivacyPage.vue`) holds the legal text and the `data-analytics-optout` button.
  - Its consent exemption forbids any other analytics, tracking script, cookie or identifier. Storage is limited to the existing functional entries (basemap and panel width in localStorage, OAuth nonce in sessionStorage), which are disclosed on `/privacy`; update that page if this changes.
- **GitHub Pages SPA routing**: the build copies `index.html` to `404.html` (a plugin in `vite.config.ts`), so deep links load the app.
