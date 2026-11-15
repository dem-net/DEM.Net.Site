import { onBeforeUnmount, ref, watch } from 'vue'
import type { Dataset } from '@/api/types'

/** Countries (ISO 3166-1 alpha-2) covered by each regional dataset / imagery, keyed by the API's region name. */
const REGIONS: Record<string, string[]> = {
  Switzerland: ['CH', 'LI'], // swissALTI3D and SwissImage also cover Liechtenstein
  France: ['FR'],
  Italy: ['IT'],
  Spain: ['ES'],
}

export const SWISS_COUNTRIES = REGIONS.Switzerland

export interface Region {
  name: string
  countries: string[]
}

/** Region of a dataset, from its `extentInfo` ("Global", "Switzerland", …); null when global. */
export function datasetRegion(d: Pick<Dataset, 'extentInfo'> | undefined): Region | null {
  const name = d?.extentInfo
  return name && REGIONS[name] ? { name, countries: REGIONS[name] } : null
}

/** Region of an imagery provider, from names like "SwissImage (Switzerland only)"; null when global. */
export function imageryRegion(providerName: string): Region | null {
  const name = providerName.match(/\((\w+) only\)/)?.[1]
  return name && REGIONS[name] ? { name, countries: REGIONS[name] } : null
}

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

/** Country code at a point; null at sea or on failure. */
export async function countryAt(lon: number, lat: number, signal?: AbortSignal): Promise<string | null> {
  const place = await reverseAt(lon, lat, signal)
  return place?.countrycode?.toUpperCase() ?? null
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
      // Not ours: the shared lookup was cancelled by another caller (the country check). Ask again.
      if ((e as Error).name !== 'AbortError') return null
    }
  }
  return null
}

/** Country of the given point (e.g. the centre of the selected area), debounced. */
export function useCountry(point: () => { lon: number; lat: number } | null) {
  const country = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined

  watch(
    () => {
      const p = point()
      return p ? `${p.lon.toFixed(3)},${p.lat.toFixed(3)}` : null
    },
    (key) => {
      clearTimeout(timer)
      controller?.abort()
      if (!key) {
        country.value = null
        return
      }
      timer = setTimeout(async () => {
        const p = point()
        if (!p) return
        controller = new AbortController()
        try {
          country.value = await countryAt(p.lon, p.lat, controller.signal)
        } catch {
          /* keep the previous value on network errors / aborts */
        }
      }, 500)
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    clearTimeout(timer)
    controller?.abort()
  })

  return country
}
