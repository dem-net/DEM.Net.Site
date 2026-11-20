/**
 * Lighting settings of the 3D preview (TerrainViewer's Lighting panel). Saved with a gallery submission so the
 * gallery shows the model as its publisher lit it: the API stores them as a flat JSON object of numbers, booleans as
 * 0/1, and refuses unknown keys or values out of its ranges (DEM.Net.WebAPI `GalleryViewer`, ranges at least as wide
 * as the ones below).
 */
export interface ViewerSettings {
  /** Degrees clockwise from north. */
  sunAzimuth: number
  /** Degrees above the horizon. */
  sunElevation: number
  sunIntensity: number
  /** Environment (sky dome) light. */
  skyIntensity: number
  exposure: number
  shadows: boolean
  ao: boolean
  /** 0 (none) to 1 (full ambient occlusion). */
  aoIntensity: number
  /** AO sampling radius, as a fraction of the model's size (its bounding sphere radius). */
  aoRadius: number
}

/** Sun from the north-west, like a hillshade: the relief reads as raised, not sunken. */
export const DEFAULT_VIEWER: Readonly<ViewerSettings> = {
  sunAzimuth: 315,
  sunElevation: 40,
  sunIntensity: 2.6,
  skyIntensity: 0.75,
  exposure: 0.95,
  shadows: true,
  ao: true,
  aoIntensity: 0.9,
  aoRadius: 0.04,
}

type NumericKey = { [K in keyof ViewerSettings]: ViewerSettings[K] extends number ? K : never }[keyof ViewerSettings]

/** Slider ranges; values from the API are clamped to them. */
export const VIEWER_RANGES: Record<NumericKey, { min: number; max: number; step: number }> = {
  sunAzimuth: { min: 0, max: 359, step: 1 },
  sunElevation: { min: 5, max: 85, step: 1 },
  sunIntensity: { min: 0, max: 6, step: 0.1 },
  skyIntensity: { min: 0, max: 2, step: 0.05 },
  exposure: { min: 0.3, max: 2, step: 0.05 },
  aoIntensity: { min: 0, max: 1, step: 0.05 },
  aoRadius: { min: 0.005, max: 0.15, step: 0.005 },
}

const BOOLEAN_KEYS = ['shadows', 'ao'] as const

/** The submission's `viewer` field. */
export function viewerToApi(s: ViewerSettings): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of Object.keys(VIEWER_RANGES) as NumericKey[]) out[key] = Math.round(s[key] * 1e4) / 1e4
  for (const key of BOOLEAN_KEYS) out[key] = s[key] ? 1 : 0
  return out
}

/** Settings stored with a gallery item; missing or invalid values fall back to the defaults. Null when none were saved. */
export function viewerFromApi(raw: unknown): ViewerSettings | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (!Object.values(r).some(num)) return null
  const s: ViewerSettings = { ...DEFAULT_VIEWER }
  for (const [key, { min, max }] of Object.entries(VIEWER_RANGES) as [NumericKey, { min: number; max: number }][]) {
    const v = r[key]
    if (num(v)) s[key] = Math.min(max, Math.max(min, v))
  }
  for (const key of BOOLEAN_KEYS) {
    const v = r[key]
    if (num(v)) s[key] = v !== 0
  }
  return s
}
