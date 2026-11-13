import { describe, expect, it } from 'vitest'
import type { ModelOptions } from '@/api/types'
import { mapStateFromQuery, mapStateToQuery, optionsFromQuery, optionsToQuery, parseViewParam, viewToParam } from './shareLink'
import { MODEL_DEFAULTS } from './useModelOptions'

describe('map view param', () => {
  it('round-trips a tilted view and keeps flat views short', () => {
    const tilted = { center: [6.865432123, 45.832198765] as [number, number], zoom: 12.3456, bearing: -17.25, pitch: 60 }
    expect(viewToParam(tilted)).toBe('6.86543,45.8322,12.35,-17.3,60')
    expect(parseViewParam(viewToParam(tilted))).toEqual({ center: [6.86543, 45.8322], zoom: 12.35, bearing: -17.3, pitch: 60 })
    expect(viewToParam({ center: [6.87, 45.92], zoom: 9, bearing: 0, pitch: 0 })).toBe('6.87,45.92,9')
  })

  it('rejects malformed or out-of-range views', () => {
    for (const bad of ['', '1,2', '1,2,3,4', 'a,b,c', '181,0,5', '0,86,5', '0,0,23', '0,0,5,0,80', '0,0,5,400,0']) {
      expect(parseViewParam(bad)).toBeNull()
    }
  })
})

describe('map state query', () => {
  it('always includes the basemap and only adds relief when on', () => {
    const view = { center: [7, 46] as [number, number], zoom: 10, bearing: 0, pitch: 0 }
    expect(mapStateToQuery({ view, basemap: 'topo', relief: false })).toEqual({ map: '7,46,10', basemap: 'topo' })
    const q = mapStateToQuery({ view, basemap: 'streets', relief: true })
    expect(mapStateFromQuery(q)).toEqual({ view, basemap: 'streets', relief: true })
  })

  it('ignores unknown basemaps and relief values', () => {
    expect(mapStateFromQuery({ basemap: 'satellite', relief: 'yes' })).toEqual({})
  })
})

describe('model options query', () => {
  it('writes nothing for the defaults', () => {
    expect(optionsToQuery({ ...MODEL_DEFAULTS })).toEqual({})
  })

  it('round-trips every non-default option', () => {
    const o: ModelOptions = {
      dataset: 'swissALTI3D',
      format: 'STL',
      textured: false,
      imageryProvider: 'SwissImage',
      textureQuality: 3,
      zFactor: 2.5,
      meshDetail: 30,
      adornments: false,
    }
    const q = optionsToQuery(o)
    expect(q).toEqual({ dataset: 'swissALTI3D', format: 'stl', texture: '0', imagery: 'SwissImage', quality: '3', z: '2.5', detail: '30', adornments: '0' })
    expect(optionsFromQuery(q)).toEqual(o)
  })

  it('drops invalid values instead of passing them to the API', () => {
    expect(
      optionsFromQuery({
        dataset: '../../etc',
        format: 'obj',
        texture: 'maybe',
        imagery: '<script>',
        quality: '7',
        z: '50',
        detail: '5',
        adornments: 'no',
      }),
    ).toEqual({})
    expect(optionsFromQuery({ z: '2.3', detail: '45.5' })).toEqual({ zFactor: 2.5 })
  })
})
