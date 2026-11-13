import { describe, expect, it } from 'vitest'
import { detailToFit } from './useSizeEstimate'
import { padBBox, bboxSizeKm } from '@/components/map/mapContext'

describe('detailToFit', () => {
  it('finds the highest detail under the limit (real API figures: 26.6 MB at 10 %, 71.4 MB at 100 %)', () => {
    // limit 50 MB → target 47.5 MB → 10 + 90 × (47.5 − 26.6) / (71.4 − 26.6) ≈ 51.9 → 51 %
    expect(detailToFit(26.6, 71.4, 50)).toBe(51)
  })

  it('returns 100 when full detail already fits', () => {
    expect(detailToFit(5, 40, 100)).toBe(100)
  })

  it('returns null when even minimum detail is too large', () => {
    expect(detailToFit(4608, 9216, 100)).toBeNull()
  })
})

describe('padBBox', () => {
  it('grows a bbox by about 1 km on each side', () => {
    const b = { west: 6.86, east: 6.9, south: 44.36, north: 44.43 }
    const before = bboxSizeKm(b)
    const after = bboxSizeKm(padBBox(b, 1))
    expect(after.width - before.width).toBeCloseTo(2, 1)
    expect(after.height - before.height).toBeCloseTo(2, 1)
  })
})
