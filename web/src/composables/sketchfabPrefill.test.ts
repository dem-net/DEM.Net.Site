import { describe, expect, it } from 'vitest'
import { coordinatesLabel, DESCRIPTION_MAX, parsePublishContext, publishDescription } from './sketchfabPrefill'

const ctx = { lon: 7.3019, lat: 46.0446, link: 'https://elevationapi.com/terrain?bbox=7.26,7.34,46.03,46.06', linkLabel: 'Generate this model on Elevation API' }

describe('Sketchfab prefill', () => {
  it('links back to the model in markdown', () => {
    expect(publishDescription(ctx)).toBe('[Generate this model on Elevation API](https://elevationapi.com/terrain?bbox=7.26,7.34,46.03,46.06)')
  })

  it('leaves the description empty rather than cutting a link', () => {
    expect(publishDescription({ ...ctx, link: 'https://x.org/?' + 'a'.repeat(DESCRIPTION_MAX) })).toBe('')
  })

  it('names the place by its coordinates as a fallback', () => {
    expect(coordinatesLabel(7.30192, 46.04461)).toBe('46.0446° N, 7.3019° E')
    expect(coordinatesLabel(-70.5, -33.25)).toBe('33.2500° S, 70.5000° W')
  })

  it('accepts only a valid context read back from storage', () => {
    expect(parsePublishContext(ctx)).toEqual(ctx)
    expect(parsePublishContext(null)).toBeNull()
    expect(parsePublishContext({ ...ctx, link: 'javascript:alert(1)' })).toBeNull()
    expect(parsePublishContext({ ...ctx, lat: 120 })).toBeNull()
    expect(parsePublishContext({ ...ctx, lon: '7' })).toBeNull()
    expect(parsePublishContext({ ...ctx, linkLabel: '' })).toBeNull()
  })
})
