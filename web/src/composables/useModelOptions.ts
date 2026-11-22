import { reactive } from 'vue'
import type { ModelOptions, OsmOptions } from '@/api/types'
import { DEFAULT_DATASET, DEFAULT_IMAGERY } from './useCatalog'

export const MODEL_DEFAULTS: Readonly<ModelOptions> = Object.freeze({
  dataset: DEFAULT_DATASET,
  format: 'glTF',
  textured: true,
  imageryProvider: DEFAULT_IMAGERY,
  textureQuality: 2,
  zFactor: 1.5,
  meshDetail: 10,
  meshQuality: 2,
  adornments: true,
  boxed: false,
  boxMonuments: false,
  water: true,
  trueScale: true,
})

export function useModelOptions(overrides: Partial<ModelOptions> = {}) {
  return reactive<ModelOptions>({ ...MODEL_DEFAULTS, ...overrides })
}

export const OSM_DEFAULTS: Readonly<OsmOptions> = Object.freeze({
  osmBuildings: true,
  useOsmBuildingsColor: true,
  buildingsColor: '#ffffff',
  osmHighways: false,
  osmOnly: false,
})

export function useOsmOptions(overrides: Partial<OsmOptions> = {}) {
  return reactive<OsmOptions>({ ...OSM_DEFAULTS, ...overrides })
}
