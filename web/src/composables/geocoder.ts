/** Photon (https://photon.komoot.io): free OSM geocoder that allows search-as-you-type, no API key. */
const PHOTON_URL = 'https://photon.komoot.io/api/'

export interface Place {
  id: string
  label: string
  detail: string
  lon: number
  lat: number
  /** [west, south, east, north] when the place has an extent (cities, regions, …). */
  bounds: [number, number, number, number] | null
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    name?: string
    street?: string
    housenumber?: string
    city?: string
    county?: string
    state?: string
    country?: string
    type?: string
    /** Photon order: [minLon, maxLat, maxLon, minLat] */
    extent?: [number, number, number, number]
  }
}

export function toPlace(f: PhotonFeature): Place {
  const p = f.properties
  const [lon, lat] = f.geometry.coordinates
  const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(' ') : undefined
  const label = p.name ?? street ?? p.city ?? p.country ?? 'Unnamed place'
  const detail = [p.name ? street : undefined, p.city !== label ? p.city : undefined, p.state, p.country]
    .filter((x) => x && x !== label)
    .join(', ')
  const e = p.extent
  return {
    id: `${p.osm_type ?? ''}${p.osm_id ?? `${lon},${lat}`}`,
    label,
    detail,
    lon,
    lat,
    bounds: e ? [e[0], e[3], e[2], e[1]] : null,
  }
}

export async function searchPlaces(
  q: string,
  near: { lon: number; lat: number } | null,
  signal?: AbortSignal,
): Promise<Place[]> {
  const params = new URLSearchParams({ q, limit: '6' })
  const lang = navigator.language?.slice(0, 2)
  if (lang && ['en', 'de', 'fr'].includes(lang)) params.set('lang', lang)
  if (near) {
    params.set('lon', near.lon.toFixed(3))
    params.set('lat', near.lat.toFixed(3))
  }
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const body = (await res.json()) as { features: PhotonFeature[] }
  return body.features.map(toPlace)
}

/** Parses "45.83, 6.86" style input so users can jump to raw coordinates too. */
export function parseLatLon(q: string): Place | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = +m[1]
  const lon = +m[2]
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { id: `coord:${lat},${lon}`, label: `${lat}, ${lon}`, detail: 'Coordinates', lat, lon, bounds: null }
}
