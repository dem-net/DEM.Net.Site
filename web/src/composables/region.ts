/** Properties of Photon's reverse geocoding result we use. */
export interface ReversePlace {
  name?: string
  city?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
  /** OSM tag of the feature: `natural` (peak, glacier…), `place` (village, town…), `highway`… */
  osm_key?: string
}

/** Features named after themselves: a peak or a village names the area better than its commune. */
const SELF_NAMED = new Set(['natural', 'place'])

const cache = new Map<string, Promise<ReversePlace | null>>()

/** Nearest OSM feature at a point via Photon reverse geocoding; null at sea or on failure. Cached per ~1 km. */
function reverseAt(lon: number, lat: number, signal?: AbortSignal): Promise<ReversePlace | null> {
  const key = `${lon.toFixed(2)},${lat.toFixed(2)}`
  const hit = cache.get(key)
  if (hit) return hit
  // Photon's default radius finds nothing in remote mountains: search up to 10 km for the nearest feature
  const params = new URLSearchParams({ lon: lon.toFixed(5), lat: lat.toFixed(5), limit: '1', radius: '10' })
  const lang = navigator.language?.slice(0, 2)
  if (lang && ['en', 'de', 'fr'].includes(lang)) params.set('lang', lang)
  const request = fetch(`https://photon.komoot.io/reverse?${params}`, { signal })
    .then(async (res) => {
      if (!res.ok) return null
      const body = (await res.json()) as { features: { properties: ReversePlace }[] }
      return body.features[0]?.properties ?? null
    })
    .catch((e: Error) => {
      cache.delete(key) // a cancelled or failed lookup is tried again next time
      throw e
    })
  cache.set(key, request)
  return request
}

/** Longest model name Sketchfab accepts in our form. */
export const PLACE_NAME_MAX = 48

/**
 * "Place, Country" from a reverse geocoding result: a peak or a village by its own name, anything else
 * (house, street, dam…) by the village it belongs to (`city`), then the county or state. Null when there is
 * nothing to name.
 */
export function placeLabel(p: ReversePlace | null): string | null {
  if (!p) return null
  const ownName = p.osm_key && SELF_NAMED.has(p.osm_key) ? p.name : undefined
  const place = ownName ?? p.city ?? p.name ?? p.county ?? p.state
  const parts = [place, p.country !== place ? p.country : undefined].filter((x): x is string => !!x?.trim())
  if (!parts.length) return null
  const label = parts.join(', ')
  return label.length <= PLACE_NAME_MAX ? label : label.slice(0, PLACE_NAME_MAX - 1).trimEnd() + '…'
}

/** Place name at a point ("Verbier, Switzerland"); null at sea or on failure. */
export async function placeNameAt(lon: number, lat: number, signal?: AbortSignal): Promise<string | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return placeLabel(await reverseAt(lon, lat, signal))
    } catch (e) {
      if (signal?.aborted) throw e
      // Not ours: the shared, cached lookup was cancelled by another caller. Ask again.
      if ((e as Error).name !== 'AbortError') return null
    }
  }
  return null
}
