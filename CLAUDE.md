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
npm run build        # vue-tsc -b && vite build → web/dist (also writes one .html per page, 404.html, sitemap.xml)
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
    - The GPX endpoint also accepts `onlyEstimateSize=true` (since DEM.Net.WebAPI#27): same response as the bbox endpoint (`meshQualityEstimates` included), computed over the server's own margin around the track, but each call uploads the file again.
    - The GPX page still estimates with the bbox endpoint over the track bounds plus 1 km, so option changes don't re-upload the track. It only warns.
    - `useSizeEstimate()` handles the debouncing and the "Reduce to fit" detail level (`detailToFit`, linear in `meshReduceFactor`).
  - `meshReduceFactor` (0.1–1) is the UI's "Mesh detail" (10–100 %, default 50 %).
  - `meshQuality` (1–4) is the Mapterhorn "Resolution" (Low, Medium, High, Best; default Medium), shown when the dataset has `isMapterhorn`. Always sent, other datasets ignore it. The estimate's `meshQualityEstimates` give each option's spacing and size. Share-link key `resolution=low|high|best` (`quality` is the texture quality).
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
  - `BaseMap.vue` creates the MapLibre map: OpenFreeMap vector style, plus an OpenTopoMap raster layer and AWS Terrarium hillshade/3D terrain, both added once and switched by toggling visibility. In Topo, every layer of the vector style is hidden too, so its tiles aren't fetched under the raster.
    - Never call `setStyle()`: it would wipe the drawing layers.
  - `BaseMap.vue` emits `ready(map)` for pages and also provides the map to slot children through `useMap()`.
  - `setWorkerUrl()` with a `?url` import of `maplibre-gl-worker.mjs` is required. Without it, MapLibre 6's worker fails to load under Vite.
  - The map container must be sized with `h-full`, not `absolute inset-0`, because MapLibre's CSS forces `position: relative` on it.
  - `createDraw.ts` wraps terra-draw for drawing one shape at a time (rectangle or line). Coordinates must be rounded (see `round6`), or terra-draw silently rejects the feature.
  - `AddressSearch.vue` uses Photon (`src/composables/geocoder.ts`). Nominatim's usage policy forbids autocomplete.
- **Pages** (`src/pages/`):
  - Tool pages use `ToolLayout` (a side panel with a sticky footer for the primary action, and the map).
  - `TerrainPage` covers both plain terrain and OSM models: the OSM switch selects `/api/model/3d/bbox/osm/…`.
    - OSM layers offered: buildings and roads (`withHighways`). Ski pistes are hidden: the API reads OSM from a Protomaps PMTiles archive, which has no pistes, and refuses `withSkiPistes=true` (HTTP 400).
    - Buildings come from a second archive when the server has it: Overture Maps buildings (`OsmElevationOptions.BuildingsPMTilesFilePath`), which keeps heights, floors, roof shapes and facade/roof colours. The model credits then include Overture.
    - The OSM estimate can come back `success:false` with a `message` (extent needs too many PMTiles tiles); `SizeGauge` shows that message.
  - `StatsPage` (`/stats`) maps every successful generation from `GET /api/stats/generations` (compact rows read by `toGenerationStats()`; the backend stores them in PostgreSQL/PostGIS, cached for a minute). Footprints are exact, not snapped: that was a deliberate choice.
    - Each dataset has its own sources and layers (footprint fill + outline, plus centre points that fade out by zoom 10), toggled from the panel. Aggregation, colors and GeoJSON are in `src/composables/generationStats.ts`.
    - Footprints are outlines only at rest. Fills add up where hundreds of areas overlap: even 2.5 % turns opaque over France. Only the hovered area (the smallest under the pointer, via feature-state; feature ids are generation indexes) and the areas appearing during a replay are filled.
    - Replay: the bar on the map plays the history day by day in 20 s (feature property `d` = day number, a layer `filter`, and paint expressions for the "recent" emphasis, updated only when the day changes). The panel numbers follow the replay day, while dataset order and colors stay fixed to the all-time ranking.
    - Never pass `filter: undefined` to `addLayer`: MapLibre's validation rejects the layer. Omit the key instead.
    - Each generation is titled with its place (`place` column, "Verbier, Switzerland"), named by the API a few seconds after it is recorded; generations from before place names show "Unknown location".
    - Clicking an area opens a popup listing the clicked area first (the highlighted one, computed again on click for touch screens), then a separator and the other generations at that place, newest first. The popup content is a Vue-rendered element (hidden in the template), handed to MapLibre with `setDOMContent`, so it updates when the details arrive. `GET /api/stats/generations/details?ids=` (at most 20) returns each generation's request options and, while the file is kept, its model URL. The API never links GPX models: they show the user's track.
    - "Generate again" (`src/composables/regenerate.ts`) turns the API options into a site link. A parameter left out of the request means the API's default (e.g. `textured=false`, quality Low), not the site's. Map to 3D reads the options from share-link keys (OSM options included: `buildings`, `buildingcolors`, `buildingcolor`, `roads`, `osmonly`; the retired `pistes` key is cleaned from old links but ignored). Textures reads `dataset`, `imagery` and `quality`. GPX only gets "Same area in Map to 3D", because the track isn't stored.
    - "View 3D" opens `GlbViewer`/`StlViewer` over the map on the same page.
    - The panel has two tabs: Overview (totals, datasets) and Latest (the 100 latest generations, newest first, grouped by day, following the replay day). The API lists generations oldest first by creation time and only sends the day, so the list order is the time order. Clicking a row zooms to its area and opens its popup.
    - Colors: the 7 most used datasets take the fixed categorical order (`SERIES_COLORS`, CVD-validated on adjacent pairs), the rest share `OTHER_COLOR`. Colors are assigned once per load, so hiding a dataset never repaints the others.
    - The page uses the same basemap default as the others (Topo, or the saved choice). MapLibre popups live outside the component, so their theme styles are in an unscoped, `.stats-popup`-namespaced `<style>`.
    - What's published is disclosed on `/privacy#statistics`. Update it if the published fields change.
  - `TexturesPage` (`/textures`) has one Generate button per image plus "Generate all (.zip)". Only one job runs at a time (the server throttle). Results are dropped when the area or options change. The Map to 3D result links to it with the same `?bbox=`.
  - Shared pieces: `AreaStep.vue` (step 1 of the bbox tools), `ImageryFields.vue` (imagery + quality).
  - Defaults (`MODEL_DEFAULTS`, `DEFAULT_DATASET`): Mapterhorn dataset, vertical exaggeration 1.5.
  - The "New" badge (`NewBadge.vue`) is driven by `isNew` on the tool entries in `App.vue` and `HomePage.vue`. Remove it there once the tool is no longer new.
  - The selected area is stored in `?bbox=`.
  - **Share links** (Map to 3D, `ShareButton.vue`) add the map view, basemap, 3D relief and the non-default model options to the URL (`src/composables/shareLink.ts`).
    - Values from a link are validated, and dataset and imagery names are checked against the catalog.
    - The share parameters are removed from the address bar once applied, so only `?bbox=` stays live.
    - New model options must be added to `optionsToQuery`/`optionsFromQuery`, or shared links will silently drop them.
  - Old URLs (`/playground_*`) redirect in `src/router.ts`.
  - `/sketchfab_oauth2` is the OAuth redirect URI registered with Sketchfab, so the path must not change. It reads `access_token` and `state` from the URL hash and then removes them. `state` is a CSRF nonce, not the model id: `beginSketchfabLogin()` (`src/api/sketchfabAuth.ts`) stores `{nonce, modelId, publish}` in `sessionStorage`, and the callback refuses a token whose `state` doesn't match.
  - The publish form is prefilled from a `PublishContext` captured when the model is generated (the options may change afterwards): Map to 3D links to its share URL, GPX to 3D to the GPX page (tracks aren't stored). The name is "Place, Country" from Photon reverse geocoding at the area's centre (`placeNameAt`, `src/composables/region.ts`), coordinates as a fallback, and never overwrites a name the user typed.
- **Gallery publishing** (`GalleryPublishPanel.vue`, under the model view, glTF results only; API: DEM.Net.WebAPI `api/gallery`):
  - The user turns the model in `TerrainViewer`, then "Capture this view" calls `TerrainViewer.capture()` → `captureTurntable()` (`viewers/turntable.ts`): a poster (WebP, JPEG where the browser has no WebP encoder, i.e. Safari) and a 4 s turntable MP4 (96 frames, 640×480, H.264 through WebCodecs, muxed by `mediabunny`, loaded lazily). The scene renders each frame at 640×480 (`beginCapture`/`renderFrame`/`endCapture`, sun and AO included), and it is copied to a 2D canvas in the same task: the WebGL buffer isn't preserved. Without an H.264 encoder only the poster is sent. `mediabunny` is pinned to the version the capture was tested with.
  - `api.galleryPublish()` posts multipart `modelId`, title (≤ 80), description (≤ 1000), pseudonym (≤ 40), poster, optional clip, and `viewer`: the lighting the capture was made with (`ViewCapture.viewer`), a JSON object of numbers, booleans as 0/1 (`src/api/viewerSettings.ts`). The API (`GalleryViewer`) refuses unknown keys and values out of range, stores the object and returns it as the item's `viewer`; the item and review pages pass it to `TerrainViewer`'s `settings`. A new lighting setting must be added to both, or submissions using it are refused. Everything else (area, dataset, options, credits) comes from the generation record, on the server. Errors are ProblemDetails: `readError()` reads `detail`.
  - The answer's token is shown once, in the private link `/gallery/<id>#token=…` (`galleryOwnerLink`): the fragment never reaches a server. Nothing about it is stored in the browser.
- **Gallery browsing** (`/gallery`, `/gallery/:id`, `/gallery/admin`; helpers in `composables/gallery.ts`):
  - `GalleryPage` pages through `GET api/gallery` with the `next` cursor (IntersectionObserver + "Show more"). `GalleryCard` creates the turntable `<video>` only while hovered or focused (mouse only, not with reduced motion), so a page of cards doesn't download every clip.
  - `GalleryItemPage` shows only published models (the API answers 404 otherwise). It reads `#token=` from the private link, keeps it in memory and removes it from the address bar at once, so a copied address can't delete the model; the delete section is also shown when the model isn't published (yet). "Generate again" reuses `regenerateLink()` (GPX: the area only).
  - `GalleryAdminPage`: the API emails a one-time link `/gallery/admin#login=…`; it is exchanged for a session (`POST api/gallery/admin/session`) kept in module memory only (`useGalleryAdmin`), never in browser storage, so a reload signs out and /privacy has nothing to disclose. Pending files need the `Authorization` header: `GalleryReviewItem` fetches them as blobs (poster at once, clip and model on demand). A 401 signs out. When signed in, the item page also offers deletion.
  - Item and admin pages aren't in `INDEXED_PAGES` (dynamic, noindex). Texts from visitors are always rendered as text (`vue/no-v-html` is an error).
  - The owner approves every submission before it's public. GPX models get a warning that the track becomes public (`gpx` prop on `ModelResultOverlay`). Disclosed on `/privacy#gallery`.
  - User-typed gallery text is shown only through text bindings: ESLint `vue/no-v-html` is an error.
  - CSP `media-src` allows `blob:` (capture preview) and the API origin (published clips).
- **3D preview**:
  - `viewers/TerrainViewer.vue` previews GLB and STL (`format` prop) with our own three.js scene, `viewers/terrainScene.ts`, loaded lazily (three.js is in that chunk only). It shows load progress, asks before loading large files, and has keyboard orbit (arrows, + / −).
  - Lighting: a gradient sky dome pre-filtered as the environment (no HDR file), a sun (`DirectionalLight` with a shadow map; default north-west, 40° high, like a hillshade), a ground plane that only shows the shadow, Neutral tone mapping. The Lighting panel sets every value in `ViewerSettings` (sun direction, height and strength, sky light, exposure, shadows, AO on/off, strength and radius); defaults and slider ranges are `DEFAULT_VIEWER` / `VIEWER_RANGES`. Nothing is kept in browser storage. Sun/orbit math is in `viewers/lighting.ts` (glTF space: Y up, east +X, south +Z).
  - Ambient occlusion: three's `GTAOPass` at half resolution, off by default on touch devices. SSAO was dropped from model-viewer once for crashing tabs, so the scene renders only when something changes, reports a lost WebGL context (the viewer offers to reload) and frees the context in `dispose()`.
  - Every size in the scene (clipping planes, shadow bias, AO radius) is relative to the model's bounding sphere: models range from a city block to a mountain range.
  - DEM.Net glTF models use no Draco or Meshopt compression, so no decoder (and no `wasm-unsafe-eval` in the CSP) is needed.
- **Theming**: color tokens are CSS variables in `src/style.css`, mapped to Tailwind colors (`bg-surface`, `text-ink-2`, `bg-accent`, …), with a dark palette applied through `prefers-color-scheme`. Use those tokens rather than raw colors. Buttons use `btn btn-primary` / `btn btn-secondary`.
- **Content**:
  - `src/content/faq.md` is compiled into a Vue component by `unplugin-vue-markdown`.
  - Release notes for the About page (`#release-notes`) live in `src/content/releaseNotes.ts`, newest first: one entry per period, short user-facing bullets per layer (Website, Elevation API, DEM.Net library, Audience measurement).
  - Every external social and sponsor link (GitHub, Discord, Bluesky, LinkedIn, Sketchfab, GitHub Sponsors, Patreon, PayPal) lives in `src/content/links.ts`. The header, footer, About and `SupportBlock` all read it.
  - Brand logos come from `BrandIcon.vue`, which uses `simple-icons` (CC0). LinkedIn is hand-drawn because simple-icons removed it. The site deliberately has no Twitter or Slack links.
- **OBJ export**: `GET /api/model/export/obj?modelId=<requestId>` returns a ZIP (`.obj`, `.mtl`, texture) for glTF models only (`ModelResult.objUrl`).
- **Security**:
  - The production build gets a Content-Security-Policy `<meta>` tag (`contentSecurityPolicy()` in `vite.config.ts`; build only, because dev HMR uses inline scripts). Add any new third-party host there, or the browser silently blocks it.
  - Bind API-supplied URLs to `href` through `safeUrl()` (`client.ts`), which allows only http(s): Vue doesn't block `javascript:` URLs.
  - The API's CORS allows any origin *without* credentials, so the SignalR connection uses `withCredentials: false`.
  - The backend (`/Users/xfischer/Repos/DEM.Net.WebAPI`) throttles generation and exports per client IP (1 per 5 s, 1 running at a time by default); a second request gets HTTP 429 with `Retry-After`. Size estimates aren't throttled.
- **Analytics**: the self-hosted cookieless tracker (`https://m.elevationapi.com/script.js`, from the `add-analytics` skill in `~/Repos/analytics`) is loaded in `index.html` with `data-spa`.
  - No `data-404`: `404.html` is a copy of `index.html` that also serves `/sketchfab_oauth2` and the old `/playground_*` URLs, which would be counted as "not found".
  - The CSP allows `m.elevationapi.com` in `script-src` and `connect-src`. `/privacy` (`PrivacyPage.vue`) holds the legal text and the `data-analytics-optout` button.
  - Its consent exemption forbids any other analytics, tracking script, cookie or identifier. Storage is limited to the existing functional entries (basemap and panel width in localStorage, OAuth nonce in sessionStorage), which are disclosed on `/privacy`; update that page if this changes.
- **GitHub Pages SPA routing and indexing** (`pageHtml()` in `vite.config.ts`, metadata in `src/seo.ts`):
  - Each page in `INDEXED_PAGES` gets its own copy of `index.html` (`/terrain` → `terrain.html`) with its title, description, canonical and Open Graph tags, so GitHub Pages answers HTTP 200. Google drops pages served with a 404 status, whatever they render.
  - Every other path boots the app through `404.html` (marked `noindex`). The build also writes `sitemap.xml`; `public/robots.txt` points to it.
  - The router sets the same head tags on client-side navigation. Add new public pages to `INDEXED_PAGES` (a test checks each entry is a real route; the route table is in `src/routes.ts`).
  - A page merged into another goes in `MOVED_PAGES` (`/faq` → `/about#faq`, `/expo` → `/about#expo`): the router redirects it, and the build still writes its HTML file with the target's tags, so old links get a 200 and a canonical to the target.
