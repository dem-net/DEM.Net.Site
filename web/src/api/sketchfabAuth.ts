import { sketchfabLoginUrl } from './client'

/**
 * CSRF protection for the Sketchfab implicit-grant login.
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
