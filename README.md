# DEM.Net.Site

Front end of [elevationapi.com](https://elevationapi.com): generate 3D terrain models (glTF / STL) from any area or GPX track, and query elevations, using the [DEM.Net](https://github.com/dem-net/DEM.Net) Elevation API.

The app lives in [`web/`](web/) (Vue 3, Vite, TypeScript, Tailwind CSS, MapLibre GL).

## Develop

Requires Node 22+.

```sh
cd web
npm install
npm run dev        # http://localhost:5173, talks to https://api.elevationapi.com
```

To use a local backend, create `web/.env.development.local` with `VITE_API_BASEURL=https://localhost:5001`.

```sh
npm test           # unit tests (Vitest)
npm run lint       # ESLint
npm run build      # type-check + production build to web/dist
```

## Deploy

Pushing to `master` (changes under `web/`) runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which tests, builds and publishes to GitHub Pages. The repository's Pages source must be set to **GitHub Actions**.
