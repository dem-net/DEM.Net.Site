import type { Generation, GenerationKind } from '@/api/types'

export const KIND_LABELS: Record<GenerationKind, string> = {
  terrain: 'Map to 3D',
  osm: 'Map to 3D + OSM',
  gpx: 'GPX to 3D',
  textures: 'Textures',
}

export const isModel = (g: Generation) => g.kind !== 'textures'

export interface Totals {
  count: number
  models: number
  textures: number
  sizeBytes: number
  /** Generations whose size is unknown (not in sizeBytes). */
  unsized: number
  /** Generations without an area (not on the map). */
  unmapped: number
  firstDate: string | null
}

export interface DatasetTotals extends Totals {
  dataset: string
}

function emptyTotals(): Totals {
  return { count: 0, models: 0, textures: 0, sizeBytes: 0, unsized: 0, unmapped: 0, firstDate: null }
}

function add(t: Totals, g: Generation) {
  t.count++
  if (isModel(g)) t.models++
  else t.textures++
  if (g.sizeBytes === null) t.unsized++
  else t.sizeBytes += g.sizeBytes
  if (!g.bbox) t.unmapped++
  if (t.firstDate === null || g.date < t.firstDate) t.firstDate = g.date
}

export function totals(gens: readonly Generation[]): Totals {
  const t = emptyTotals()
  for (const g of gens) add(t, g)
  return t
}

/** Per dataset, most generations first (then by name). */
export function totalsByDataset(gens: readonly Generation[]): DatasetTotals[] {
  const map = new Map<string, DatasetTotals>()
  for (const g of gens) {
    let t = map.get(g.dataset)
    if (!t) map.set(g.dataset, (t = { dataset: g.dataset, ...emptyTotals() }))
    add(t, g)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.dataset.localeCompare(b.dataset))
}

/**
 * Categorical colors for the map (light steps: the basemaps are light in both themes).
 * Fixed order, validated for color-vision deficiency on adjacent pairs; never cycled:
 * datasets past the 7th share the neutral "other" color.
 */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'] as const
export const OTHER_COLOR = '#7c7b76'

/**
 * Color per dataset, by rank in `ranked` (most used first). Computed once per load, so hiding
 * a dataset never repaints the others.
 */
export function datasetColors(ranked: readonly string[]): Map<string, string> {
  return new Map(ranked.map((d, i) => [d, SERIES_COLORS[i] ?? OTHER_COLOR]))
}

type Props = { i: number }

/**
 * Footprints (polygons) and their centres (points, readable at world zoom where most footprints are
 * smaller than a pixel) for one dataset. Feature property `i` is the index in `gens`.
 */
export function datasetFeatures(gens: readonly Generation[], dataset: string) {
  const footprints: GeoJSON.Feature<GeoJSON.Polygon, Props>[] = []
  const centres: GeoJSON.Feature<GeoJSON.Point, Props>[] = []
  gens.forEach((g, i) => {
    if (g.dataset !== dataset || !g.bbox) return
    const { west: w, south: s, east: e, north: n } = g.bbox
    const properties = { i }
    footprints.push({
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    })
    centres.push({ type: 'Feature', properties, geometry: { type: 'Point', coordinates: [(w + e) / 2, (s + n) / 2] } })
  })
  return {
    footprints: { type: 'FeatureCollection', features: footprints } as GeoJSON.FeatureCollection<GeoJSON.Polygon, Props>,
    centres: { type: 'FeatureCollection', features: centres } as GeoJSON.FeatureCollection<GeoJSON.Point, Props>,
  }
}

/** Decimal units, as the API counts sizes (1 MB = 10^6 bytes). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  let v = bytes
  let u = 0
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000
    u++
  }
  const digits = u === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2
  return `${v.toFixed(digits)} ${units[u]}`
}

const dateFormat = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "2026-06-02" → "Jun 2, 2026" */
export function formatDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? isoDate : dateFormat.format(d)
}
