import type { Map as MlMap } from 'maplibre-gl'
import { inject, provide, shallowRef, watch, type InjectionKey, type ShallowRef } from 'vue'
import type { BBox } from '@/api/types'

const MAP_KEY: InjectionKey<ShallowRef<MlMap | null>> = Symbol('map')

export function provideMap() {
  const map = shallowRef<MlMap | null>(null)
  provide(MAP_KEY, map)
  return map
}

/** Runs `fn` once the parent BaseMap's style has loaded. */
export function useMap(fn?: (map: MlMap) => void) {
  const map = inject(MAP_KEY)
  if (!map) throw new Error('useMap() must be used inside <BaseMap>')
  if (fn) {
    const stop = watch(
      map,
      (m) => {
        if (!m) return
        queueMicrotask(() => stop())
        fn(m)
      },
      { immediate: true },
    )
  }
  return map
}

export function fitBBox(map: MlMap, b: BBox, padding = 60) {
  map.fitBounds(
    [
      [b.west, b.south],
      [b.east, b.north],
    ],
    { padding, duration: 800, maxZoom: 15 },
  )
}

const EARTH_RADIUS_KM = 6371.0088

/** Grows a bbox by `km` on every side. */
export function padBBox(b: BBox, km: number): BBox {
  const dLat = (km / EARTH_RADIUS_KM) * (180 / Math.PI)
  const midLat = ((b.north + b.south) / 2) * (Math.PI / 180)
  const dLon = dLat / Math.max(Math.cos(midLat), 0.01)
  return {
    west: Math.max(-180, b.west - dLon),
    east: Math.min(180, b.east + dLon),
    south: Math.max(-90, b.south - dLat),
    north: Math.min(90, b.north + dLat),
  }
}

/** Width/height of a bbox in km, measured along its middle latitude/longitude. */
export function bboxSizeKm(b: BBox): { width: number; height: number } {
  const rad = Math.PI / 180
  const midLat = ((b.north + b.south) / 2) * rad
  return {
    width: Math.abs(b.east - b.west) * rad * EARTH_RADIUS_KM * Math.cos(midLat),
    height: Math.abs(b.north - b.south) * rad * EARTH_RADIUS_KM,
  }
}
