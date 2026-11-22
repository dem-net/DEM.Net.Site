import type { Object3D } from 'three'

/** Node of the sea at 0 m that DEM.Net adds to glTF models (`SharpGltfService.WATER_NODE_NAME`). */
export const WATER_NODE = 'Water'

/** True for the water node and everything under it. */
export function isWater(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (p.name === WATER_NODE) return true
  return false
}
