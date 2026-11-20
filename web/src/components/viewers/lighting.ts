/**
 * Pure helpers for the terrain viewer's camera and sun, in glTF space as DEM.Net writes it:
 * Y up, east = +X, south = +Z (so north = −Z).
 */

/** Camera position around the target, in three.js `Spherical` terms (theta from +Z toward +X, phi from +Y). */
export interface Orbit {
  /** Heading, radians. 0 looks from the south. */
  theta: number
  /** Angle from straight above, radians. */
  phi: number
  /** Distance to the target, scene units. */
  radius: number
}

/** The sun, as a map reader gives it. */
export interface Sun {
  /** Degrees clockwise from north. */
  azimuth: number
  /** Degrees above the horizon. */
  elevation: number
}

/** Start view: a little west of south, looking down at about 30° (model-viewer's old "-25deg 58deg"). */
export const START_THETA = (-25 * Math.PI) / 180
export const START_PHI = (58 * Math.PI) / 180

/** The camera stops just above the horizon. */
export const MAX_PHI = (88 * Math.PI) / 180

/** Unit vector from the scene toward the sun. */
export function sunDirection({ azimuth, elevation }: Sun): [number, number, number] {
  const az = (azimuth * Math.PI) / 180
  const el = (elevation * Math.PI) / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
}

/** Distance at which a sphere of `radius` fits in a camera of vertical field of view `fovDeg` and `aspect`. */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  const vHalf = (fovDeg * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * aspect)
  return radius / Math.sin(Math.min(vHalf, hHalf))
}

/** Orbit of frame `i` of `frames`: one full turn from the start heading, pitch and distance unchanged. */
export function frameOrbit(start: Orbit, i: number, frames: number): Orbit {
  return { ...start, theta: start.theta + (i * 2 * Math.PI) / frames }
}
