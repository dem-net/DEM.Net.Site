import type { LocationQuery } from 'vue-router'
import type { ModelOptions } from '@/api/types'
import type { Basemap, MapState, MapView } from '@/components/map/mapContext'
import { MODEL_DEFAULTS } from './useModelOptions'

/**
 * Share links for Map to 3D. Next to the existing `bbox` (and `osm`), a link carries:
 *   map=lon,lat,zoom[,bearing,pitch]   camera
 *   basemap=topo|streets               basemap
 *   relief=1                           3D relief on
 *   dataset, format=stl, texture=0, imagery, quality=1..3, z, detail   model options that differ from the defaults
 * Every value read from a link is validated; unknown or out-of-range values are ignored.
 */

/** Query keys owned by share links (removed from the address bar once applied). */
export const SHARE_KEYS = ['map', 'basemap', 'relief', 'dataset', 'format', 'texture', 'imagery', 'quality', 'z', 'detail'] as const

type Query = Record<string, string>

function first(q: LocationQuery, key: string): string | null {
  const v = q[key]
  const s = Array.isArray(v) ? v[0] : v
  return typeof s === 'string' && s.length > 0 && s.length <= 200 ? s : null
}

const round = (n: number, digits: number) => +n.toFixed(digits)

export function viewToParam(v: MapView): string {
  const parts = [round(v.center[0], 5), round(v.center[1], 5), round(v.zoom, 2)]
  const bearing = round(v.bearing, 1)
  const pitch = round(v.pitch, 1)
  if (bearing || pitch) parts.push(bearing, pitch)
  return parts.join(',')
}

export function parseViewParam(s: string | null): MapView | null {
  if (!s) return null
  const n = s.split(',').map(Number)
  if ((n.length !== 3 && n.length !== 5) || n.some((x) => !Number.isFinite(x))) return null
  const [lon, lat, zoom, bearing = 0, pitch = 0] = n
  if (Math.abs(lon) > 180 || Math.abs(lat) > 85.06 || zoom < 0 || zoom > 22) return null
  if (Math.abs(bearing) > 360 || pitch < 0 || pitch > 75) return null
  return { center: [lon, lat], zoom, bearing, pitch }
}

export function mapStateToQuery(s: MapState): Query {
  // The basemap is always included: the recipient's default comes from their own saved preference.
  return { map: viewToParam(s.view), basemap: s.basemap, ...(s.relief && { relief: '1' }) }
}

export function mapStateFromQuery(q: LocationQuery): Partial<MapState> {
  const view = parseViewParam(first(q, 'map'))
  const basemap = first(q, 'basemap')
  return {
    ...(view && { view }),
    ...((basemap === 'topo' || basemap === 'streets') && { basemap: basemap as Basemap }),
    ...(first(q, 'relief') === '1' && { relief: true }),
  }
}

export function optionsToQuery(o: ModelOptions): Query {
  const d = MODEL_DEFAULTS
  const q: Query = {}
  if (o.dataset !== d.dataset) q.dataset = o.dataset
  if (o.format !== d.format) q.format = o.format.toLowerCase()
  if (o.textured !== d.textured) q.texture = o.textured ? '1' : '0'
  if (o.imageryProvider !== d.imageryProvider) q.imagery = o.imageryProvider
  if (o.textureQuality !== d.textureQuality) q.quality = String(o.textureQuality)
  if (o.zFactor !== d.zFactor) q.z = String(o.zFactor)
  if (o.meshDetail !== d.meshDetail) q.detail = String(o.meshDetail)
  return q
}

/** Names are checked against the catalog later (useCatalogGuard); here only their shape is. */
const NAME = /^[\w .()-]{1,100}$/

export function optionsFromQuery(q: LocationQuery): Partial<ModelOptions> {
  const o: Partial<ModelOptions> = {}
  const dataset = first(q, 'dataset')
  if (dataset && NAME.test(dataset)) o.dataset = dataset
  const format = first(q, 'format')?.toLowerCase()
  if (format === 'stl') o.format = 'STL'
  else if (format === 'gltf') o.format = 'glTF'
  const texture = first(q, 'texture')
  if (texture === '0' || texture === '1') o.textured = texture === '1'
  const imagery = first(q, 'imagery')
  if (imagery && NAME.test(imagery)) o.imageryProvider = imagery
  const quality = Number(first(q, 'quality'))
  if (quality === 1 || quality === 2 || quality === 3) o.textureQuality = quality
  const z = Number(first(q, 'z'))
  if (first(q, 'z') && Number.isFinite(z) && z >= 1 && z <= 10) o.zFactor = Math.round(z * 2) / 2 // the slider's 0.5 steps
  const detail = Number(first(q, 'detail'))
  if (first(q, 'detail') && Number.isInteger(detail) && detail >= 10 && detail <= 100) o.meshDetail = detail
  return o
}
