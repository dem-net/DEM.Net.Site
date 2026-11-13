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

const cache = new Map<string, string | null>()

/** Country code at a point via Photon reverse geocoding; null at sea or on failure. Cached per ~1 km. */
export async function countryAt(lon: number, lat: number, signal?: AbortSignal): Promise<string | null> {
  const key = `${lon.toFixed(2)},${lat.toFixed(2)}`
  if (cache.has(key)) return cache.get(key)!
  const params = new URLSearchParams({ lon: lon.toFixed(5), lat: lat.toFixed(5), limit: '1' })
  const res = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal })
  if (!res.ok) return null
  const body = (await res.json()) as { features: { properties: { countrycode?: string } }[] }
  const code = body.features[0]?.properties.countrycode?.toUpperCase() ?? null
  cache.set(key, code)
  return code
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
