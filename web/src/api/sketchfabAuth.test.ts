import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  beginSketchfabLogin,
  completeSketchfabLogin,
  isPopupState,
  PopupBlockedError,
  popupSketchfabLogin,
  sendPopupResult,
} from './sketchfabAuth'

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

describe('Sketchfab popup login', () => {
  function stubWindow(popup: unknown) {
    const open = vi.fn((url: string) => (void url, popup))
    vi.stubGlobal('window', { open, screenX: 0, screenY: 0, outerWidth: 1200, outerHeight: 900 })
    return open
  }
  afterEach(() => vi.unstubAllGlobals())

  const stateOf = (open: ReturnType<typeof stubWindow>) =>
    new URL(open.mock.calls[0]![0]).searchParams.get('state')!

  it('resolves with the token sent back for its own state, ignoring others', async () => {
    const open = stubWindow({ close: vi.fn() })
    const p = popupSketchfabLogin()
    const state = stateOf(open)
    expect(isPopupState(state)).toBe(true)
    sendPopupResult({ state: 'popup.someone-else', token: 'evil' })
    sendPopupResult({ state, token: 'tok-1' })
    await expect(p).resolves.toBe('tok-1')
  })

  it('rejects when the sign-in was refused', async () => {
    const open = stubWindow({ close: vi.fn() })
    const p = popupSketchfabLogin()
    sendPopupResult({ state: stateOf(open), error: 'access_denied' })
    await expect(p).rejects.toThrow('access_denied')
  })

  it('rejects when the popup is blocked', async () => {
    stubWindow(null)
    await expect(popupSketchfabLogin()).rejects.toBeInstanceOf(PopupBlockedError)
  })

  it('stops waiting and closes the popup when aborted', async () => {
    const close = vi.fn()
    stubWindow({ close })
    const ac = new AbortController()
    const p = popupSketchfabLogin(ac.signal)
    ac.abort()
    await expect(p).rejects.toMatchObject({ name: 'AbortError' })
    expect(close).toHaveBeenCalled()
  })

  it('does not treat redirect-login states as popup states', () => {
    const state = new URL(beginSketchfabLogin('m', memoryStorage())).searchParams.get('state')
    expect(isPopupState(state)).toBe(false)
    expect(isPopupState(null)).toBe(false)
  })
})
