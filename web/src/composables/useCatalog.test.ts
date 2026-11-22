import { describe, expect, it } from 'vitest'
import type { ImageryProvider } from '@/api/types'
import { imageryLabels } from './useCatalog'

const p = (name: string, text?: string): ImageryProvider => ({
  name,
  attribution: text ? { subject: 'Imagery', text, url: '', acknowledgement: '' } : undefined,
  maxZoom: 18,
  privateUseOnly: false,
})

describe('imageryLabels', () => {
  it('uses the attribution text, or the name when the text is shared', () => {
    const labels = imageryLabels([
      p('MapBox-Satellite', 'MapBox Satellite'),
      p('ThunderForest-Outdoors', 'ThunderForest'),
      p('ThunderForest-Landscape', 'ThunderForest'),
      p('No-Attribution'),
    ])
    expect(labels.get('MapBox-Satellite')).toBe('MapBox Satellite')
    expect(labels.get('ThunderForest-Outdoors')).toBe('ThunderForest Outdoors')
    expect(labels.get('ThunderForest-Landscape')).toBe('ThunderForest Landscape')
    expect(labels.get('No-Attribution')).toBe('No Attribution')
  })
})
