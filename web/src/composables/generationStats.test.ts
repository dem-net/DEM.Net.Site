import { describe, expect, it } from 'vitest'
import { toGenerationStats } from '@/api/client'
import type { Generation } from '@/api/types'
import {
  datasetColors,
  datasetFeatures,
  formatBytes,
  formatDate,
  OTHER_COLOR,
  SERIES_COLORS,
  totals,
  totalsByDataset,
} from './generationStats'

const columns = ['dataset', 'kind', 'format', 'sizeBytes', 'date', 'west', 'south', 'east', 'north']

describe('toGenerationStats', () => {
  it('reads rows by column name and drops malformed ones', () => {
    const r = toGenerationStats({
      updatedAt: '2026-11-14T17:00:00Z',
      columns,
      rows: [
        ['SRTM_GL3', 'terrain', 'glTF', 603656, '2026-11-14', 6.82, 45.8, 6.91, 45.86],
        ['SRTM_GL3', 'gpx', 'glTF', 480000, '2026-06-02', null, null, null, null],
        ['SRTM_GL3', 'textures', 'heightmap', null, '2026-07-01', 1, 2, 3, 4],
        ['SRTM_GL3', 'unknown-kind', 'glTF', 1, '2026-07-01', 1, 2, 3, 4],
        [42, 'terrain', 'glTF', 1, '2026-07-01', 1, 2, 3, 4],
      ],
    })
    expect(r.generations).toEqual([
      { dataset: 'SRTM_GL3', kind: 'terrain', format: 'glTF', sizeBytes: 603656, date: '2026-11-14', bbox: { west: 6.82, south: 45.8, east: 6.91, north: 45.86 } },
      { dataset: 'SRTM_GL3', kind: 'gpx', format: 'glTF', sizeBytes: 480000, date: '2026-06-02', bbox: null },
      { dataset: 'SRTM_GL3', kind: 'textures', format: 'heightmap', sizeBytes: null, date: '2026-07-01', bbox: { west: 1, south: 2, east: 3, north: 4 } },
    ])
  })

  it('follows the column order the API sends', () => {
    const r = toGenerationStats({
      updatedAt: '',
      columns: ['date', 'dataset', 'kind', 'format', 'sizeBytes', 'north', 'south', 'east', 'west'],
      rows: [['2026-06-02', 'AW3D30', 'osm', 'glTF', 10, 4, 2, 3, 1]],
    })
    expect(r.generations[0]).toMatchObject({ dataset: 'AW3D30', kind: 'osm', bbox: { west: 1, south: 2, east: 3, north: 4 } })
  })
})

const g = (dataset: string, kind: Generation['kind'], sizeBytes: number | null, date: string, mapped = true): Generation => ({
  dataset,
  kind,
  format: 'glTF',
  sizeBytes,
  date,
  bbox: mapped ? { west: 0, south: 0, east: 2, north: 1 } : null,
})

const sample = [
  g('A', 'terrain', 100, '2026-07-01'),
  g('B', 'textures', 50, '2026-06-02'),
  g('B', 'gpx', null, '2026-06-10', false),
  g('B', 'osm', 25, '2026-08-01'),
  g('C', 'terrain', 10, '2026-09-01'),
]

describe('totals', () => {
  it('counts models, textures, sizes and what is unknown', () => {
    expect(totals(sample)).toEqual({ count: 5, models: 4, textures: 1, sizeBytes: 185, unsized: 1, unmapped: 1, firstDate: '2026-06-02' })
  })

  it('ranks datasets by count, then name', () => {
    expect(totalsByDataset(sample).map((d) => [d.dataset, d.count, d.sizeBytes])).toEqual([
      ['B', 3, 75],
      ['A', 1, 100],
      ['C', 1, 10],
    ])
  })
})

describe('datasetColors', () => {
  it('assigns the fixed order, then the shared "other" color', () => {
    const names = Array.from({ length: 9 }, (_, i) => `D${i}`)
    const c = datasetColors(names)
    expect(c.get('D0')).toBe(SERIES_COLORS[0])
    expect(c.get('D6')).toBe(SERIES_COLORS[6])
    expect(c.get('D7')).toBe(OTHER_COLOR)
    expect(c.get('D8')).toBe(OTHER_COLOR)
  })
})

describe('datasetFeatures', () => {
  it('builds footprints and centres of one dataset, indexed into the full list', () => {
    const { footprints, centres } = datasetFeatures(sample, 'B')
    expect(footprints.features.map((f) => f.properties.i)).toEqual([1, 3]) // the GPX one has no area
    expect(footprints.features[0].geometry.coordinates[0]).toEqual([[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]])
    expect(centres.features[0].geometry.coordinates).toEqual([1, 0.5])
  })
})

describe('formatting', () => {
  it('formats sizes in decimal units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(999)).toBe('999 B')
    expect(formatBytes(603656)).toBe('604 kB')
    expect(formatBytes(12_345_678)).toBe('12.3 MB')
    expect(formatBytes(1_234_000_000)).toBe('1.23 GB')
  })

  it('formats dates in UTC', () => {
    expect(formatDate('2026-06-02')).toBe('Jun 2, 2026')
    expect(formatDate('garbage')).toBe('garbage')
  })
})
