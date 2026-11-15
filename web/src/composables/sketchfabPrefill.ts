import { safeUrl } from '@/api/client'
import type { PublishContext } from '@/api/types'

/** Sketchfab description limit in our form. */
export const DESCRIPTION_MAX = 720

/** Markdown link back to the model (Sketchfab renders markdown); the API appends the data credits. */
export function publishDescription(ctx: PublishContext): string {
  const text = `[${ctx.linkLabel}](${ctx.link})`
  return text.length <= DESCRIPTION_MAX ? text : ''
}

/** Fallback model name at sea or when the place lookup fails: "46.0446° N, 7.3019° E". */
export function coordinatesLabel(lon: number, lat: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lon).toFixed(4)}° ${ew}`
}

/** Validates a context read back from storage (redirect sign-in); null when unusable. */
export function parsePublishContext(v: unknown): PublishContext | null {
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  const lon = c.lon
  const lat = c.lat
  if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) return null
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null
  const link = typeof c.link === 'string' ? safeUrl(c.link) : undefined
  const linkLabel = typeof c.linkLabel === 'string' ? c.linkLabel.slice(0, 100) : ''
  if (!link || !linkLabel) return null
  return { lon, lat, link, linkLabel }
}
