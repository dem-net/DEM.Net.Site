import { describe, expect, it } from 'vitest'
import { TURNTABLE } from './turntable'
import { fitDistance, frameOrbit, sunDirection } from './lighting'

describe('turntable', () => {
  const start = { theta: 0.5, phi: 1.0, radius: 120 }

  it('turns only the heading, keeping the pitch and distance chosen by the user', () => {
    const o = frameOrbit(start, 10, 96)
    expect(o.phi).toBe(1)
    expect(o.radius).toBe(120)
  })

  it('makes one full turn that closes exactly on the start view', () => {
    const n = TURNTABLE.frames
    expect(frameOrbit(start, 0, n).theta).toBe(0.5)
    expect(frameOrbit(start, n / 4, n).theta).toBeCloseTo(0.5 + Math.PI / 2)
    // the frame after the last one would be the start again, so the loop doesn't repeat a frame
    expect(frameOrbit(start, n, n).theta - 2 * Math.PI).toBeCloseTo(0.5)
  })

  it('fits the API limits: 4 s clip, 4:3 like the viewer', () => {
    expect(TURNTABLE.frames / TURNTABLE.fps).toBeLessThanOrEqual(10)
    expect(TURNTABLE.width / TURNTABLE.height).toBeCloseTo(4 / 3)
  })
})

describe('lighting', () => {
  it('points the sun in glTF space: east +X, north −Z, up +Y', () => {
    const [ex, , ez] = sunDirection({ azimuth: 90, elevation: 0 })
    expect(ex).toBeCloseTo(1)
    expect(ez).toBeCloseTo(0)
    const [, , nz] = sunDirection({ azimuth: 0, elevation: 0 })
    expect(nz).toBeCloseTo(-1)
    const [nwx, nwy, nwz] = sunDirection({ azimuth: 315, elevation: 40 })
    expect(nwx).toBeLessThan(0) // west
    expect(nwz).toBeLessThan(0) // north
    expect(nwy).toBeCloseTo(Math.sin((40 * Math.PI) / 180))
    expect(Math.hypot(nwx, nwy, nwz)).toBeCloseTo(1)
  })

  it('fits the bounding sphere in the narrower field of view', () => {
    // 4:3 landscape: the vertical field of view is the limit
    expect(fitDistance(1, 30, 4 / 3)).toBeCloseTo(1 / Math.sin((15 * Math.PI) / 180))
    // portrait: the horizontal one is, so the camera goes further back
    expect(fitDistance(1, 30, 0.5)).toBeGreaterThan(fitDistance(1, 30, 4 / 3))
  })
})
