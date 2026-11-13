import type { Map as MlMap } from 'maplibre-gl'
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawRectangleMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
  type HexColor,
} from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { ref } from 'vue'
import type { BBox } from '@/api/types'

export type DrawKind = 'rectangle' | 'linestring'

function cssHex(name: string, fallback: HexColor): HexColor {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return (/^#[0-9a-f]{6}$/i.test(v) ? v : fallback) as HexColor
}

export function polygonToBBox(coords: number[][]): BBox {
  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])
  return { west: Math.min(...xs), east: Math.max(...xs), south: Math.min(...ys), north: Math.max(...ys) }
}

/** terra-draw rejects coordinates with more decimals than its precision; 6 decimals ≈ 10 cm. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6

export function bboxToFeature(raw: BBox): GeoJSONStoreFeatures {
  const b = { west: round6(raw.west), south: round6(raw.south), east: round6(raw.east), north: round6(raw.north) }
  return {
    type: 'Feature',
    properties: { mode: 'rectangle' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [b.west, b.south],
          [b.east, b.south],
          [b.east, b.north],
          [b.west, b.north],
          [b.west, b.south],
        ],
      ],
    },
  }
}

/**
 * Single-shape drawing on a MapLibre map: draw a rectangle or a line, then reshape it by dragging
 * its corners/vertices. `onShape` fires after every completed draw or edit.
 * Call `destroy()` before the map is removed (e.g. in the page's onBeforeUnmount).
 */
export function createDraw(
  map: MlMap,
  kind: DrawKind,
  onShape: (feature: GeoJSONStoreFeatures | null) => void,
) {
  const accent = cssHex('--c-accent', '#2f6f4f')
  const white = '#ffffff' as HexColor
  const drawing = ref(false)

  const draw = new TerraDraw({
    adapter: new TerraDrawMapLibreGLAdapter({ map }),
    modes: [
      new TerraDrawRectangleMode({
        drawInteraction: 'click-move-or-drag',
        styles: { fillColor: accent, fillOpacity: 0.15, outlineColor: accent, outlineWidth: 2 },
      }),
      new TerraDrawLineStringMode({
        styles: { lineStringColor: accent, lineStringWidth: 3, closingPointColor: accent, closingPointOutlineColor: white },
      }),
      new TerraDrawSelectMode({
        flags: {
          rectangle: {
            feature: {
              draggable: true,
              coordinates: { draggable: false, resizable: 'opposite' },
            },
          },
          linestring: {
            feature: {
              draggable: true,
              coordinates: { draggable: true, midpoints: true, deletable: true },
            },
          },
        },
        styles: {
          selectedPolygonColor: accent,
          selectedPolygonFillOpacity: 0.2,
          selectedPolygonOutlineColor: accent,
          selectedLineStringColor: accent,
          selectionPointColor: white,
          selectionPointOutlineColor: accent,
          selectionPointWidth: 6,
          midPointColor: accent,
          midPointOutlineColor: white,
        },
      }),
    ],
  })
  draw.start()

  function current(): GeoJSONStoreFeatures | null {
    return draw.getSnapshot().find((f) => f.properties.mode === kind) ?? null
  }

  function editShape(id: string | number) {
    draw.setMode('select')
    draw.selectFeature(id)
  }

  draw.on('finish', (id, ctx) => {
    if (ctx.mode === kind) {
      // keep only the newly drawn shape
      const stale = draw
        .getSnapshot()
        .map((f) => f.id!)
        .filter((fid) => fid !== id)
      if (stale.length) draw.removeFeatures(stale)
      drawing.value = false
      editShape(id)
    }
    onShape(current())
  })

  function startDrawing() {
    draw.clear()
    onShape(null)
    draw.setMode(kind)
    drawing.value = true
  }

  function setShape(feature: GeoJSONStoreFeatures) {
    draw.clear()
    const [res] = draw.addFeatures([{ ...feature, properties: { ...feature.properties, mode: kind } }])
    if (res?.valid && res.id !== undefined) editShape(res.id)
    onShape(current())
  }

  function clear() {
    draw.clear()
    draw.setMode('select')
    drawing.value = false
    onShape(null)
  }

  function destroy() {
    try {
      draw.stop()
    } catch {
      /* map already removed */
    }
  }

  return { drawing, startDrawing, setShape, clear, destroy }
}
