import { describe, expect, it } from 'vitest'
import { DEFAULT_VIEWER, VIEWER_RANGES, viewerFromApi, viewerToApi } from './viewerSettings'

describe('viewer settings', () => {
  it('round-trips through the API form, booleans as 0/1', () => {
    const s = { ...DEFAULT_VIEWER, sunAzimuth: 120, ao: false, aoRadius: 0.06 }
    const api = viewerToApi(s)
    expect(api.ao).toBe(0)
    expect(api.shadows).toBe(1)
    expect(viewerFromApi(JSON.parse(JSON.stringify(api)))).toEqual(s)
  })

  it('sends only numbers, within the ranges the API accepts', () => {
    for (const v of Object.values(viewerToApi(DEFAULT_VIEWER))) expect(typeof v).toBe('number')
    for (const [key, { min, max }] of Object.entries(VIEWER_RANGES)) {
      const value = DEFAULT_VIEWER[key as keyof typeof VIEWER_RANGES]
      expect(value).toBeGreaterThanOrEqual(min)
      expect(value).toBeLessThanOrEqual(max)
    }
  })

  it('fills missing or invalid values with the defaults and clamps the rest', () => {
    const s = viewerFromApi({ sunAzimuth: 90, sunElevation: 400, exposure: 'bright', unknown: 1 })!
    expect(s.sunAzimuth).toBe(90)
    expect(s.sunElevation).toBe(VIEWER_RANGES.sunElevation.max)
    expect(s.exposure).toBe(DEFAULT_VIEWER.exposure)
    expect(s.ao).toBe(DEFAULT_VIEWER.ao)
  })

  it('is null when nothing was saved', () => {
    expect(viewerFromApi(null)).toBeNull()
    expect(viewerFromApi(undefined)).toBeNull()
    expect(viewerFromApi({})).toBeNull()
    expect(viewerFromApi([1, 2])).toBeNull()
  })
})
