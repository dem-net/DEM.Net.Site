import { sketchfabLoginUrl } from './client'

/**
 * CSRF protection for the Sketchfab implicit-grant login (full-page redirect fallback).
 * `state` is a random nonce, not the model id: the callback only accepts a token whose
 * `state` matches the nonce this tab stored when it started the login.
 */
const KEY = 'dem.sketchfabAuth'

interface Pending {
  nonce: string
  modelId: string
}

function store(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** Remembers the model to publish and returns the Sketchfab authorize URL to navigate to. */
export function beginSketchfabLogin(modelId: string, storage: Storage | null = store()): string {
  const nonce = crypto.randomUUID()
  try {
    storage?.setItem(KEY, JSON.stringify({ nonce, modelId } satisfies Pending))
  } catch {
    /* storage blocked: the callback will refuse the login */
  }
  return sketchfabLoginUrl(nonce)
}

/**
 * Popup login: the model view stays open. The nonce is kept in memory (no storage); the callback
 * page, opened in the popup, recognises the `popup.` prefix and hands the token back over a
 * same-origin BroadcastChannel (window.opener may be severed by the provider's COOP header).
 */
const POPUP_PREFIX = 'popup.'
const CHANNEL = 'dem.sketchfabAuth'

interface PopupMessage {
  state: string
  token?: string
  error?: string
}

export function isPopupState(state: string | null): state is string {
  return !!state && state.startsWith(POPUP_PREFIX)
}

/** Called by the callback page when it runs in a popup. */
export function sendPopupResult(msg: PopupMessage) {
  const ch = new BroadcastChannel(CHANNEL)
  ch.postMessage(msg)
  ch.close()
}

export class PopupBlockedError extends Error {
  constructor() {
    super('Your browser blocked the Sketchfab sign-in window.')
  }
}

/**
 * Opens the Sketchfab sign-in popup and resolves with the access token.
 * Must be called synchronously from a click/submit handler, or the popup is blocked.
 * `signal` aborts the wait (e.g. the user cancels).
 */
export function popupSketchfabLogin(signal?: AbortSignal): Promise<string> {
  const nonce = POPUP_PREFIX + crypto.randomUUID()
  const w = 520
  const h = 720
  const left = Math.max(0, window.screenX + (window.outerWidth - w) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - h) / 2)
  const popup = window.open(sketchfabLoginUrl(nonce), 'sketchfab-login', `popup,width=${w},height=${h},left=${left},top=${top}`)
  if (!popup) return Promise.reject(new PopupBlockedError())

  return new Promise((resolve, reject) => {
    const ch = new BroadcastChannel(CHANNEL)
    const done = () => {
      ch.close()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      done()
      try {
        popup.close()
      } catch {
        /* cross-origin or already closed */
      }
      reject(new DOMException('Sign-in cancelled', 'AbortError'))
    }
    ch.onmessage = (e: MessageEvent<PopupMessage>) => {
      if (e.data?.state !== nonce) return // not ours: ignore
      done()
      if (e.data.token) resolve(e.data.token)
      else reject(new Error(`Sketchfab sign-in did not complete (${e.data.error ?? 'no token'}).`))
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort)
  })
}

/** Returns the model id when `state` matches the pending login, else null. Always clears the pending login. */
export function completeSketchfabLogin(state: string | null, storage: Storage | null = store()): string | null {
  let pending: Pending | null = null
  try {
    const raw = storage?.getItem(KEY)
    storage?.removeItem(KEY)
    pending = raw ? (JSON.parse(raw) as Pending) : null
  } catch {
    return null
  }
  if (!state || !pending?.nonce || pending.nonce !== state || !pending.modelId) return null
  return pending.modelId
}
