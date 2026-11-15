import { bboxToPath } from '@/api/client'
import type { Generation, ModelOptions, OsmOptions } from '@/api/types'
import { optionsToQuery, osmToQuery } from './shareLink'
import { DEFAULT_DATASET, DEFAULT_IMAGERY } from './useCatalog'
import { MODEL_DEFAULTS, OSM_DEFAULTS } from './useModelOptions'

/** Where to generate a statistics entry again: a site route with the same area and options. */
export interface RegenerateLink {
  path: '/terrain' | '/textures'
  query: Record<string, string>
  /** GPX tracks are not stored: only the area can be reused. */
  areaOnly: boolean
}

type ApiOptions = Readonly<Record<string, string | undefined>>

/** ASP.NET binds booleans from "true"/"false" (any case); a missing value is the API's default. */
function bool(v: string | undefined, apiDefault: boolean): boolean {
  if (v === undefined) return apiDefault
  const s = v.toLowerCase()
  return s === 'true' ? true : s === 'false' ? false : apiDefault
}

function num(v: string | undefined, apiDefault: number): number {
  const n = v === undefined ? NaN : Number(v)
  return Number.isFinite(n) ? n : apiDefault
}

/** TextureQuality is sent as 1–3 or by name (Low, Medium, High). */
function quality(v: string | undefined, apiDefault: 1 | 2 | 3): 1 | 2 | 3 {
  const names: Record<string, 1 | 2 | 3> = { '1': 1, '2': 2, '3': 3, low: 1, medium: 2, high: 3 }
  return (v && names[v.toLowerCase()]) || apiDefault
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Model options as the API applied them (its defaults where a parameter was left out), in the site's terms. */
export function modelOptionsFromApi(g: Generation, o: ApiOptions): ModelOptions {
  return {
    dataset: g.dataset,
    format: g.format === 'STL' ? 'STL' : 'glTF',
    textured: bool(o.textured, false),
    imageryProvider: o.imageryProvider ?? MODEL_DEFAULTS.imageryProvider,
    textureQuality: quality(o.textureQuality, 1),
    zFactor: clamp(Math.round(num(o.zFactor, 1) * 2) / 2, 1, 10),
    meshDetail: clamp(Math.round(num(o.meshReduceFactor, 0.5) * 100), 10, 100),
    adornments: bool(o.adornments, true),
  }
}

export function osmOptionsFromApi(o: ApiOptions): OsmOptions {
  return {
    osmBuildings: bool(o.withBuildings, true),
    useOsmBuildingsColor: bool(o.withBuildingsColors, false),
    buildingsColor: o.buildingsColor && HEX_COLOR.test(o.buildingsColor) ? o.buildingsColor : OSM_DEFAULTS.buildingsColor,
    osmHighways: bool(o.withHighways, true),
    osmOnly: !bool(o.withTerrain, true),
  }
}

/** Null when the generation has no area. Names (dataset, imagery) are checked against the catalog by the target page. */
export function regenerateLink(g: Generation, apiOptions: ApiOptions): RegenerateLink | null {
  if (!g.bbox) return null
  const bbox = bboxToPath(g.bbox)
  if (g.kind === 'textures') {
    const q: Record<string, string> = { bbox }
    if (g.dataset !== DEFAULT_DATASET) q.dataset = g.dataset
    if (apiOptions.imageryProvider && apiOptions.imageryProvider !== DEFAULT_IMAGERY) q.imagery = apiOptions.imageryProvider
    const textureQuality = quality(apiOptions.textureQuality, 2)
    if (textureQuality !== 2) q.quality = String(textureQuality)
    return { path: '/textures', query: q, areaOnly: false }
  }
  const query = { bbox, ...optionsToQuery(modelOptionsFromApi(g, apiOptions)) }
  if (g.kind === 'osm') Object.assign(query, { osm: '1' }, osmToQuery(osmOptionsFromApi(apiOptions)))
  return { path: '/terrain', query, areaOnly: g.kind === 'gpx' }
}
