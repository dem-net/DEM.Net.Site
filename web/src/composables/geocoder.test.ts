import { describe, expect, it } from 'vitest'
import { parseLatLon, toPlace } from './geocoder'

describe('toPlace', () => {
  it('maps a Photon city with its extent to [w, s, e, n] bounds', () => {
    // Real response shape for "Chamonix"; Photon extent order is [minLon, maxLat, maxLon, minLat]
    const p = toPlace({
      geometry: { coordinates: [6.8700009, 45.9230969] },
      properties: {
        osm_type: 'R',
        osm_id: 1,
        name: 'Chamonix-Mont-Blanc',
        state: 'Auvergne-Rhône-Alpes',
        country: 'France',
        type: 'city',
        extent: [6.8137453, 46.0311495, 7.0444709, 45.8284379],
      },
    })
    expect(p.label).toBe('Chamonix-Mont-Blanc')
    expect(p.detail).toBe('Auvergne-Rhône-Alpes, France')
    expect(p.bounds).toEqual([6.8137453, 45.8284379, 7.0444709, 46.0311495])
    expect([p.lon, p.lat]).toEqual([6.8700009, 45.9230969])
  })

  it('labels a street address without a name', () => {
    const p = toPlace({
      geometry: { coordinates: [2.35, 48.85] },
      properties: { street: 'Rue de Rivoli', housenumber: '10', city: 'Paris', country: 'France' },
    })
    expect(p.label).toBe('10 Rue de Rivoli')
    expect(p.detail).toBe('Paris, France')
    expect(p.bounds).toBeNull()
  })
})

describe('parseLatLon', () => {
  it('accepts "lat, lon" input', () => {
    expect(parseLatLon('45.8326, 6.8652')).toMatchObject({ lat: 45.8326, lon: 6.8652 })
    expect(parseLatLon('-33.9 18.4')).toMatchObject({ lat: -33.9, lon: 18.4 })
  })

  it('rejects text and out-of-range values', () => {
    expect(parseLatLon('Chamonix')).toBeNull()
    expect(parseLatLon('95, 10')).toBeNull()
  })
})
