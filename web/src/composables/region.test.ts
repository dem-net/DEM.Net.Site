import { describe, expect, it } from 'vitest'
import { datasetRegion, imageryRegion } from './region'

describe('regions', () => {
  it('reads dataset coverage from extentInfo (Switzerland includes Liechtenstein)', () => {
    expect(datasetRegion({ extentInfo: 'Switzerland' })).toEqual({ name: 'Switzerland', countries: ['CH', 'LI'] })
    expect(datasetRegion({ extentInfo: 'France' })?.countries).toEqual(['FR'])
    expect(datasetRegion({ extentInfo: 'Global' })).toBeNull()
    expect(datasetRegion({ extentInfo: 'Global + oceans' })).toBeNull()
  })

  it('reads imagery coverage from "(X only)" provider names', () => {
    expect(imageryRegion('SwissImage (Switzerland only)')?.countries).toEqual(['CH', 'LI'])
    expect(imageryRegion('OrtoIGNes (Spain only)')?.countries).toEqual(['ES'])
    expect(imageryRegion('MapBox-SatelliteStreet')).toBeNull()
  })
})
