import { describe, expect, it } from 'vitest'
import { PLACE_NAME_MAX, placeLabel } from './region'

describe('place label', () => {
  it('names the village and the country, even from a house, street or dam result', () => {
    expect(placeLabel({ name: 'Route de Verbier', city: 'Verbier', state: 'Valais', country: 'Switzerland', osm_key: 'highway' })).toBe('Verbier, Switzerland')
    expect(placeLabel({ name: "Prise d'eau de Louvie", city: 'Fionnay', country: 'Switzerland', osm_key: 'waterway' })).toBe('Fionnay, Switzerland')
  })

  it('names peaks and villages by their own name', () => {
    expect(placeLabel({ name: 'Matterhorn', city: 'Valtournenche', country: 'Italy', osm_key: 'natural' })).toBe('Matterhorn, Italy')
    expect(placeLabel({ name: 'Verbier', country: 'Switzerland', osm_key: 'place' })).toBe('Verbier, Switzerland')
  })

  it('uses the feature name far from villages, then the county or state', () => {
    expect(placeLabel({ name: 'Mont Fort', country: 'Switzerland' })).toBe('Mont Fort, Switzerland')
    expect(placeLabel({ county: 'Haute-Savoie', state: 'Auvergne-Rhône-Alpes', country: 'France' })).toBe('Haute-Savoie, France')
    expect(placeLabel({ country: 'Iceland' })).toBe('Iceland')
  })

  it('fits the Sketchfab name limit, and has nothing at sea', () => {
    const long = placeLabel({ city: 'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch', country: 'United Kingdom' })!
    expect(long.length).toBe(PLACE_NAME_MAX)
    expect(long.endsWith('…')).toBe(true)
    expect(placeLabel(null)).toBeNull()
    expect(placeLabel({})).toBeNull()
  })
})
