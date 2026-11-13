import { reactive } from 'vue'
import type { ModelOptions, OsmOptions } from '@/api/types'
import { DEFAULT_DATASET, DEFAULT_IMAGERY } from './useCatalog'

export function useModelOptions(overrides: Partial<ModelOptions> = {}) {
  return reactive<ModelOptions>({
    dataset: DEFAULT_DATASET,
    format: 'glTF',
    textured: true,
    imageryProvider: DEFAULT_IMAGERY,
    textureQuality: 2,
    zFactor: 1,
    generateTIN: false,
    meshDetail: 50,
    ...overrides,
  })
}

export function useOsmOptions() {
  return reactive<OsmOptions>({
    osmBuildings: true,
    useOsmBuildingsColor: false,
    buildingsColor: '#945200',
    osmPistesSki: false,
    osmOnly: false,
  })
}
