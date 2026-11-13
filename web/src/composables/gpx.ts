import type { BBox } from '@/api/types'

export interface GpxSummary {
  name: string | null
  /** One coordinate list per track segment / route, as [lon, lat]. */
  lines: [number, number][][]
  bbox: BBox
  points: number
}

/** Client-side parse, only for previewing the track on the map; the API does the real work. */
export function parseGpx(xml: string): GpxSummary {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('This file is not valid GPX.')

  const groups = [...doc.querySelectorAll('trkseg'), ...doc.querySelectorAll('rte')]
  const lines = groups
    .map((g) =>
      [...g.querySelectorAll('trkpt, rtept')].map(
        (p) => [Number(p.getAttribute('lon')), Number(p.getAttribute('lat'))] as [number, number],
      ),
    )
    .map((l) => l.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .filter((l) => l.length > 1)

  const all = lines.flat()
  if (!all.length) throw new Error('No track or route found in this GPX file.')

  let west = Infinity
  let east = -Infinity
  let south = Infinity
  let north = -Infinity
  for (const [x, y] of all) {
    if (x < west) west = x
    if (x > east) east = x
    if (y < south) south = y
    if (y > north) north = y
  }

  const name = doc.querySelector('trk > name, rte > name, metadata > name')?.textContent?.trim() || null
  return { name, lines, bbox: { west, east, south, north }, points: all.length }
}
