import { describe, expect, it } from 'vitest'
import type { Generation } from '@/api/types'
import { modelOptionsFromApi, regenerateLink } from './regenerate'
import { optionsFromQuery, osmFromQuery } from './shareLink'

const gen = (kind: Generation['kind'], format = 'glTF', dataset = 'SRTM_GL3'): Generation => ({
  id: 1,
  dataset,
  kind,
  format,
  sizeBytes: 1,
  date: '2026-07-01',
  bbox: { west: 6.82, south: 45.8, east: 6.91, north: 45.86 },
})

describe('regenerateLink', () => {
  it('uses the API defaults for options that were left out', () => {
    // No options sent: the API generated an untextured glTF at 50 % detail, z 1, with adornments
    expect(modelOptionsFromApi(gen('terrain'), {})).toMatchObject({
      textured: false,
      textureQuality: 1,
      zFactor: 1,
      meshDetail: 50,
      meshQuality: 2,
      adornments: true,
    })
    expect(regenerateLink(gen('terrain'), {})).toEqual({
      path: '/terrain',
      query: { bbox: '6.82,6.91,45.8,45.86', texture: '0', quality: '1' },
      areaOnly: false,
    })
  })

  it('carries the terrain options, which the Map to 3D page reads back', () => {
    const link = regenerateLink(gen('terrain', 'STL', 'AW3D30'), {
      textured: 'True',
      imageryProvider: 'Esri.WorldImagery',
      textureQuality: 'High',
      zFactor: '2.3',
      meshReduceFactor: '0.8',
      meshQuality: 'High',
      adornments: 'false',
    })!
    expect(optionsFromQuery(link.query)).toEqual({
      dataset: 'AW3D30',
      format: 'STL',
      imageryProvider: 'Esri.WorldImagery',
      textureQuality: 3,
      zFactor: 2.5,
      meshDetail: 80,
      meshQuality: 3,
      adornments: false,
    })
  })

  it('clamps out-of-range values the way the API did', () => {
    expect(modelOptionsFromApi(gen('terrain'), { zFactor: '50', meshReduceFactor: '0.01' })).toMatchObject({ zFactor: 10, meshDetail: 10 })
    expect(modelOptionsFromApi(gen('terrain'), { zFactor: 'abc', textureQuality: 'Ultra' })).toMatchObject({ zFactor: 1, textureQuality: 1 })
  })

  it('carries the OSM options', () => {
    const link = regenerateLink(gen('osm'), {
      withBuildings: 'false',
      withSkiPistes: 'true', // no longer offered: ignored
      withHighways: 'false',
      withTerrain: 'false',
      buildingsColor: '#E0E0E0',
      withBuildingsColors: 'true',
    })!
    expect(link.query.osm).toBe('1')
    expect(osmFromQuery(link.query)).toEqual({
      osmBuildings: false,
      useOsmBuildingsColor: true,
      buildingsColor: '#e0e0e0',
      osmHighways: false,
      osmOnly: true,
    })
  })

  it('opens the Textures page with its dataset, imagery and quality', () => {
    expect(regenerateLink(gen('textures', 'texture,heightmap', 'FABDEM'), { imageryProvider: 'Esri.WorldImagery', textureQuality: '3' })).toEqual({
      path: '/textures',
      query: { bbox: '6.82,6.91,45.8,45.86', dataset: 'FABDEM', imagery: 'Esri.WorldImagery', quality: '3' },
      areaOnly: false,
    })
    // The textures endpoint defaults to Medium
    expect(regenerateLink(gen('textures', 'heightmap'), {})!.query).toEqual({ bbox: '6.82,6.91,45.8,45.86' })
  })

  it('reuses only the area of GPX models, and needs an area', () => {
    expect(regenerateLink(gen('gpx'), {})).toMatchObject({ path: '/terrain', areaOnly: true })
    expect(regenerateLink({ ...gen('terrain'), bbox: null }, {})).toBeNull()
  })
})
