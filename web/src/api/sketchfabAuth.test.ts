import { describe, expect, it } from 'vitest'
import { beginSketchfabLogin, completeSketchfabLogin } from './sketchfabAuth'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

describe('Sketchfab login state', () => {
  it('sends a random nonce, not the model id, as state', () => {
    const s = memoryStorage()
    const state = new URL(beginSketchfabLogin('model-42', s)).searchParams.get('state')
    expect(state).toBeTruthy()
    expect(state).not.toContain('model-42')
  })

  it('returns the model id once for the matching state', () => {
    const s = memoryStorage()
    const state = new URL(beginSketchfabLogin('model-42', s)).searchParams.get('state')
    expect(completeSketchfabLogin(state, s)).toBe('model-42')
    expect(completeSketchfabLogin(state, s)).toBeNull() // single use
  })

  it('refuses a state this tab did not issue', () => {
    const s = memoryStorage()
    beginSketchfabLogin('model-42', s)
    expect(completeSketchfabLogin('attacker-state', s)).toBeNull()
    expect(completeSketchfabLogin(null, memoryStorage())).toBeNull()
    expect(completeSketchfabLogin('x', null)).toBeNull()
  })
})
