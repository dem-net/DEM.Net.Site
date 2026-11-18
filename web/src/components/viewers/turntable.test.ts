import { describe, expect, it } from 'vitest'
import { frameOrbit, TURNTABLE } from './turntable'

describe('turntable', () => {
  const start = { theta: 0.5, phi: 1.0, radius: 120 }
  const theta = (orbit: string) => parseFloat(orbit)

  it('turns only the heading, keeping the pitch and distance chosen by the user', () => {
    expect(frameOrbit(start, 10, 96)).toMatch(/rad 1rad 120m$/)
  })

  it('makes one full turn that closes exactly on the start view', () => {
    const n = TURNTABLE.frames
    expect(theta(frameOrbit(start, 0, n))).toBe(0.5)
    expect(theta(frameOrbit(start, n / 4, n))).toBeCloseTo(0.5 + Math.PI / 2)
    // the frame after the last one would be the start again, so the loop doesn't repeat a frame
    expect(theta(frameOrbit(start, n, n)) - 2 * Math.PI).toBeCloseTo(0.5)
  })

  it('fits the API limits: 4 s clip, 4:3 like the viewer', () => {
    expect(TURNTABLE.frames / TURNTABLE.fps).toBeLessThanOrEqual(10)
    expect(TURNTABLE.width / TURNTABLE.height).toBeCloseTo(4 / 3)
  })
})
