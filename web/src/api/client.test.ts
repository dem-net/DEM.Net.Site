import { describe, expect, it } from 'vitest'
import {
  absoluteUrl,
  API_BASE,
  bboxToPath,
  meshReduceFactor,
  safeUrl,
  sketchfabLoginUrl,
  terrainModelPath,
  texturePath,
  toModelResult,
  toTextureEstimates,
  toTextureResult,
} from './client'
import type { ModelOptions, TextureOptions } from './types'
import { parseBBoxParam } from '@/composables/useAreaPicker'

const opts: ModelOptions = {
  dataset: 'AW3D30',
  format: 'glTF',
  textured: true,
  imageryProvider: 'MapBox-SatelliteStreet',
  textureQuality: 3,
  zFactor: 1.5,
  meshDetail: 50,
  adornments: true,
}

describe('bbox', () => {
  it('serializes as west,east,south,north like the API expects', () => {
    expect(bboxToPath({ west: 6.75, east: 7.05, south: 45.75, north: 45.95 })).toBe('6.75,7.05,45.75,45.95')
  })

  it('rounds to 6 decimals', () => {
    expect(bboxToPath({ west: 6.123456789, east: 7, south: 45, north: 46 })).toBe('6.123457,7,45,46')
  })

  it('round-trips through the ?bbox= URL parameter', () => {
    const b = { west: 6.75, east: 7.05, south: 45.75, north: 45.95 }
    expect(parseBBoxParam(bboxToPath(b))).toEqual(b)
  })

  it('rejects malformed or inverted bbox parameters', () => {
    expect(parseBBoxParam('1,2,3')).toBeNull()
    expect(parseBBoxParam('7,6,45,46')).toBeNull()
    expect(parseBBoxParam('a,b,c,d')).toBeNull()
    expect(parseBBoxParam(undefined)).toBeNull()
  })
})

describe('terrainModelPath', () => {
  const bbox = { west: 6.75, east: 7.05, south: 45.75, north: 45.95 }

  it('builds the plain terrain endpoint with all model options', () => {
    const url = new URL(terrainModelPath(bbox, opts, null, 'abc'), 'https://x')
    expect(url.pathname).toBe('/api/model/3d/bbox/6.75,7.05,45.75,45.95')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      dataset: 'AW3D30',
      textured: 'true',
      imageryProvider: 'MapBox-SatelliteStreet',
      textureQuality: '3',
      format: 'glTF',
      zFactor: '1.5',
      meshReduceFactor: '0.5',
      adornments: 'true',
      clientConnectionId: 'abc',
    })
  })

  it('sends adornments=false when turned off, and never for STL', () => {
    const q = (o: ModelOptions) => new URL(terrainModelPath(bbox, o, null, null), 'https://x').searchParams.get('adornments')
    expect(q({ ...opts, adornments: false })).toBe('false')
    expect(q({ ...opts, format: 'STL' })).toBe('false')
  })

  it('switches to the OSM endpoint and maps OSM flags', () => {
    const url = new URL(
      terrainModelPath(
        bbox,
        opts,
        { osmBuildings: true, useOsmBuildingsColor: false, buildingsColor: '#945200', osmPistesSki: true, osmOnly: true },
        null,
      ),
      'https://x',
    )
    expect(url.pathname).toBe('/api/model/3d/bbox/osm/6.75,7.05,45.75,45.95')
    const q = Object.fromEntries(url.searchParams)
    expect(q).toMatchObject({
      withBuildings: 'true',
      withBuildingsColors: 'false',
      buildingsColor: '#945200',
      withSkiPistes: 'true',
      withTerrain: 'false',
      centerOnOrigin: 'true',
    })
    expect(q.clientConnectionId).toBeUndefined()
  })

  it('never asks for texture with STL, nor for a TIN', () => {
    const url = new URL(terrainModelPath(bbox, { ...opts, format: 'STL' }, null, null), 'https://x')
    expect(url.searchParams.get('textured')).toBe('false')
    expect(url.searchParams.has('generateTIN')).toBe(false)
  })
})

describe('model result', () => {
  it('makes the model path absolute and has no texture files (see the textures endpoint)', () => {
    const r = toModelResult(
      {
        requestId: 'id1',
        modelFile: '/gltf/x.glb',
        modelFileSizeMB: 31.7,
        minElevation: 790,
        maxElevation: 4804,
        attributions: [],
      },
      'glTF',
    )
    expect(r.modelUrl).toBe(`${API_BASE}/gltf/x.glb`)
    for (const k of ['albedoUrl', 'heightMapUrl', 'normalMapUrl']) expect(r).not.toHaveProperty(k)
    expect(r.objUrl).toBe(`${API_BASE}/api/model/export/obj?modelId=id1`)
  })

  it('offers OBJ export only for glTF models', () => {
    const info = { requestId: 'id2', modelFile: '/x.stl', modelFileSizeMB: 1, minElevation: 0, maxElevation: 1, attributions: [] }
    expect(toModelResult(info, 'STL').objUrl).toBeNull()
  })

  it('leaves absolute URLs untouched', () => {
    expect(absoluteUrl('https://cdn.example/x.glb')).toBe('https://cdn.example/x.glb')
  })
})

describe('textures', () => {
  const bbox = { west: 6.82, east: 6.91, south: 45.8, north: 45.86 }
  const topts: TextureOptions = { dataset: 'SRTM_GL3', imageryProvider: 'Esri.WorldImagery', textureQuality: 2 }

  it('builds the textures path with the requested outputs', () => {
    const url = new URL(API_BASE + texturePath(bbox, topts, ['texture', 'heightmap'], 'conn1'))
    expect(url.pathname).toBe('/api/texture/bbox/6.82,6.91,45.8,45.86')
    expect(url.searchParams.get('outputs')).toBe('texture,heightmap')
    expect(url.searchParams.get('dataSet')).toBe('SRTM_GL3')
    expect(url.searchParams.get('imageryProvider')).toBe('Esri.WorldImagery')
    expect(url.searchParams.get('textureQuality')).toBe('2')
    expect(url.searchParams.get('clientConnectionId')).toBe('conn1')
    expect(url.searchParams.has('onlyEstimateSize')).toBe(false)
  })

  it('sends the imagery provider only when the texture is requested', () => {
    const url = new URL(API_BASE + texturePath(bbox, topts, ['heightmap'], null, true))
    expect(url.searchParams.has('imageryProvider')).toBe(false)
    expect(url.searchParams.has('clientConnectionId')).toBe(false)
    expect(url.searchParams.get('onlyEstimateSize')).toBe('true')
  })

  const file = {
    kind: 'heightmap' as const,
    filePath: '/gltf/d/x_heightmap.png',
    worldFilePath: '/gltf/d/x_heightmap.pgw',
    prjFilePath: '/gltf/d/x_heightmap.prj',
    srid: 4326,
    width: 109,
    height: 73,
    sizeMB: 0.01,
  }

  it('makes image, world file, projection and zip URLs absolute', () => {
    const r = toTextureResult({ requestId: 'r1', files: [file], zipFilePath: '/gltf/d/x_textures.zip', minElevation: 1713, maxElevation: 4783 })
    expect(r.files[0]).toMatchObject({
      imageUrl: `${API_BASE}/gltf/d/x_heightmap.png`,
      worldFileUrl: `${API_BASE}/gltf/d/x_heightmap.pgw`,
      prjUrl: `${API_BASE}/gltf/d/x_heightmap.prj`,
      srid: 4326,
    })
    expect(r.zipUrl).toBe(`${API_BASE}/gltf/d/x_textures.zip`)
    expect(r.minElevation).toBe(1713)
    expect(r.attributions).toEqual([])
  })

  it('rejects an image without its georeferencing files', () => {
    expect(() => toTextureResult({ requestId: 'r1', files: [{ ...file, worldFilePath: '' }], zipFilePath: '/z.zip' })).toThrow(/georeferencing/)
  })

  it('flags each estimate against the limit', () => {
    const r = toTextureEstimates({
      success: false,
      maximumAllowedFileSizeMB: 100,
      estimates: [
        { kind: 'texture', width: 2000, height: 2000, estimatedSizeMB: 3 },
        { kind: 'heightmap', width: 9000, height: 9000, estimatedSizeMB: 140 },
      ],
    })
    expect(r.maxMB).toBe(100)
    expect(r.estimates.map((e) => [e.kind, e.allowed])).toEqual([
      ['texture', true],
      ['heightmap', false],
    ])
  })
})

it('builds the Sketchfab implicit-grant URL with the given state', () => {
  const url = new URL(sketchfabLoginUrl('nonce-42'))
  expect(url.origin + url.pathname).toBe('https://sketchfab.com/oauth2/authorize/')
  expect(url.searchParams.get('state')).toBe('nonce-42')
  expect(url.searchParams.get('response_type')).toBe('token')
})

describe('safeUrl', () => {
  it('keeps absolute http(s) URLs', () => {
    expect(safeUrl('https://example.org/a?b=1')).toBe('https://example.org/a?b=1')
    expect(safeUrl('http://giscience.uni-hd.de')).toBe('http://giscience.uni-hd.de')
  })
  it('drops script, data and relative URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeUrl(' JavaScript:alert(1)')).toBeUndefined()
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined()
    expect(safeUrl('/relative')).toBeUndefined()
    expect(safeUrl(null)).toBeUndefined()
    expect(safeUrl('')).toBeUndefined()
  })
})

describe('mesh detail and size estimate', () => {
  it('maps mesh detail % to meshReduceFactor and clamps to 10–100 %', () => {
    expect(meshReduceFactor(50)).toBe(0.5)
    expect(meshReduceFactor(100)).toBe(1)
    expect(meshReduceFactor(3)).toBe(0.1)
    expect(meshReduceFactor(140)).toBe(1)
  })

  it('adds onlyEstimateSize only for estimate requests', () => {
    const bbox = { west: 6.75, east: 7.05, south: 45.75, north: 45.95 }
    const est = new URL(terrainModelPath(bbox, opts, null, null, true), 'https://x')
    expect(est.searchParams.get('onlyEstimateSize')).toBe('true')
    const gen = new URL(terrainModelPath(bbox, opts, null, null), 'https://x')
    expect(gen.searchParams.has('onlyEstimateSize')).toBe(false)
  })
})
