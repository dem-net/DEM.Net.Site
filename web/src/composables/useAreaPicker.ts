import type { Map as MlMap } from 'maplibre-gl'
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { BBox } from '@/api/types'
import { bboxToPath } from '@/api/client'
import { bboxToFeature, createDraw, polygonToBBox } from '@/components/map/createDraw'
import { bboxSizeKm, fitBBox } from '@/components/map/mapContext'

export function parseBBoxParam(v: unknown): BBox | null {
  if (typeof v !== 'string') return null
  const n = v.split(',').map(Number)
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null
  const [west, east, south, north] = n
  if (west >= east || south >= north || Math.abs(south) > 90 || Math.abs(north) > 90) return null
  return { west, east, south, north }
}

/** Rectangle picking for the bbox tools; the area is mirrored in `?bbox=w,e,s,n` so links are shareable. */
export function useAreaPicker() {
  const route = useRoute()
  const router = useRouter()
  const bbox = ref<BBox | null>(parseBBoxParam(route.query.bbox))
  const map = shallowRef<MlMap | null>(null)
  let draw: ReturnType<typeof createDraw> | null = null
  const drawing = ref(false)

  function syncUrl(b: BBox | null) {
    const query = { ...route.query }
    if (b) query.bbox = bboxToPath(b)
    else delete query.bbox
    router.replace({ query })
  }

  function onReady(m: MlMap) {
    map.value = m
    draw = createDraw(m, 'rectangle', (f) => {
      const b = f && f.geometry.type === 'Polygon' ? polygonToBBox(f.geometry.coordinates[0]) : null
      bbox.value = b
      syncUrl(b)
    })
    drawing.value = false
    if (bbox.value) {
      draw.setShape(bboxToFeature(bbox.value))
      fitBBox(m, bbox.value)
    }
  }

  function startDrawing() {
    draw?.startDrawing()
    drawing.value = true
  }

  /** Uses the middle of the visible map (inset so the rectangle stays easy to grab). */
  function useView() {
    const m = map.value
    if (!m || !draw) return
    const c = m.getContainer()
    const inset = Math.min(c.clientWidth, c.clientHeight) * 0.15
    const sw = m.unproject([inset, c.clientHeight - inset])
    const ne = m.unproject([c.clientWidth - inset, inset])
    draw.setShape(bboxToFeature({ west: sw.lng, south: sw.lat, east: ne.lng, north: ne.lat }))
    drawing.value = false
  }

  function setArea(b: BBox) {
    draw?.setShape(bboxToFeature(b))
    if (map.value) fitBBox(map.value, b)
  }

  function clear() {
    draw?.clear()
    drawing.value = false
  }

  onBeforeUnmount(() => draw?.destroy())

  const size = computed(() => (bbox.value ? bboxSizeKm(bbox.value) : null))
  const sizeLabel = computed(() =>
    size.value ? `${size.value.width.toFixed(1)} × ${size.value.height.toFixed(1)} km` : null,
  )

  // drawing flag resets when the rectangle is completed
  const isDrawing = computed(() => drawing.value && !bbox.value)

  return { bbox, map, onReady, startDrawing, useView, setArea, clear, isDrawing, size, sizeLabel }
}
