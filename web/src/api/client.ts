import type {
  AssetInfo,
  BBox,
  Dataset,
  ElevationResponse,
  ImageryProvider,
  ModelOptions,
  ModelResult,
  OsmOptions,
  SizeEstimate,
  SketchfabExportRequest,
} from './types'

/** Production API by default; override with VITE_API_BASEURL (e.g. in .env.development.local) for a local backend. */
export const API_BASE = (import.meta.env.VITE_API_BASEURL || 'https://api.elevationapi.com').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** The API answers errors either as plain text or as JSON `{ statusCode, message }`. */
async function readError(res: Response): Promise<ApiError> {
  const text = await res.text()
  let message = text
  try {
    const body = JSON.parse(text)
    message = body.message ?? body.title ?? text
  } catch {
    /* plain-text error */
  }
  return new ApiError(res.status, message.trim() || `Request failed (${res.status})`)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, init)
  } catch {
    throw new ApiError(0, 'Cannot reach the Elevation API. Check your connection and try again.')
  }
  if (!res.ok) throw await readError(res)
  return res.json() as Promise<T>
}

function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) q.set(k, String(v))
  }
  return q.toString()
}

/** API path segment order is west,east,south,north. */
export function bboxToPath(b: BBox): string {
  const r = (n: number) => +n.toFixed(6)
  return [r(b.west), r(b.east), r(b.south), r(b.north)].join(',')
}

export function absoluteUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return /^https?:\/\//.test(path) ? path : API_BASE + path
}

/**
 * Returns the URL only if it is absolute http(s), for binding API-supplied links to `href`
 * (Vue does not block `javascript:` URLs). `undefined` makes Vue drop the attribute.
 */
export function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}

export function toModelResult(info: AssetInfo, format: ModelOptions['format']): ModelResult {
  return {
    id: info.requestId,
    format,
    modelUrl: absoluteUrl(info.modelFile)!,
    sizeMB: info.modelFileSizeMB,
    minElevation: info.minElevation,
    maxElevation: info.maxElevation,
    heightMapUrl: absoluteUrl(info.heightMap?.filePath),
    albedoUrl: absoluteUrl(info.albedoTexture?.filePath),
    normalMapUrl: absoluteUrl(info.normalMapTexture?.filePath),
    objUrl: format === 'glTF' ? `${API_BASE}/api/model/export/obj?${query({ modelId: info.requestId })}` : null,
    attributions: info.attributions ?? [],
  }
}

function modelQuery(o: ModelOptions, connectionId: string | null) {
  return {
    dataset: o.dataset,
    textured: o.format === 'glTF' && o.textured,
    imageryProvider: o.imageryProvider,
    textureQuality: o.textureQuality,
    format: o.format,
    zFactor: o.zFactor,
    meshReduceFactor: meshReduceFactor(o.meshDetail),
    adornments: o.format === 'glTF' && o.adornments,
    clientConnectionId: connectionId,
  }
}

export const MIN_MESH_DETAIL = 10

/** meshDetail (10–100 %) → API meshReduceFactor (0.1–1). */
export function meshReduceFactor(detail: number): number {
  return Math.min(100, Math.max(MIN_MESH_DETAIL, Math.round(detail))) / 100
}

export function osmQuery(osm: OsmOptions) {
  return {
    withBuildings: osm.osmBuildings,
    withBuildingsColors: osm.useOsmBuildingsColor,
    buildingsColor: osm.buildingsColor,
    withSkiPistes: osm.osmPistesSki,
    withTerrain: !osm.osmOnly,
    centerOnOrigin: osm.osmOnly,
  }
}

export function terrainModelPath(
  bbox: BBox,
  o: ModelOptions,
  osm: OsmOptions | null,
  connectionId: string | null,
  onlyEstimateSize = false,
): string {
  const base = osm ? '/api/model/3d/bbox/osm/' : '/api/model/3d/bbox/'
  const params = {
    ...modelQuery(o, connectionId),
    ...(osm ? osmQuery(osm) : {}),
    ...(onlyEstimateSize ? { onlyEstimateSize: true } : {}),
  }
  return `${base}${bboxToPath(bbox)}?${query(params)}`
}

interface EstimateResponse {
  success: boolean
  estimatedModelFileSizeMB: number
  estimatedModelFileSizeAfterReduceMB: number
  maximumAllowedFileSizeMB: number
}

export const api = {
  datasets: () => request<Dataset[]>('/api/dataset'),

  imagery: () => request<ImageryProvider[]>('/api/imagery'),

  pointElevation: (lat: number, lon: number, dataSet: string) =>
    request<ElevationResponse>(`/api/elevation?${query({ lat, lon, dataSet })}`),

  lineElevation: (line: GeoJSON.LineString, dataSetName: string, reduceResolution: number) =>
    request<ElevationResponse>('/api/elevation/line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line, dataSetName, reduceResolution }),
    }),

  async terrainModel(
    bbox: BBox,
    o: ModelOptions,
    osm: OsmOptions | null,
    connectionId: string | null,
    signal?: AbortSignal,
  ): Promise<ModelResult> {
    const res = await request<{ assetInfo: AssetInfo }>(terrainModelPath(bbox, o, osm, connectionId), {
      signal,
    })
    return toModelResult(res.assetInfo, o.format)
  },

  /** Size estimate only (fast, nothing is generated). Over-limit answers are HTTP 200 with success:false. */
  async estimateTerrainSize(
    bbox: BBox,
    o: ModelOptions,
    osm: OsmOptions | null,
    signal?: AbortSignal,
  ): Promise<SizeEstimate> {
    const r = await request<EstimateResponse>(terrainModelPath(bbox, o, osm, null, true), { signal })
    return {
      sizeMB: r.estimatedModelFileSizeAfterReduceMB,
      fullDetailMB: r.estimatedModelFileSizeMB,
      maxMB: r.maximumAllowedFileSizeMB,
      allowed: r.success && r.estimatedModelFileSizeAfterReduceMB <= r.maximumAllowedFileSizeMB,
    }
  },

  async gpxModel(
    file: File,
    o: ModelOptions,
    track3D: boolean,
    connectionId: string | null,
    signal?: AbortSignal,
  ): Promise<ModelResult> {
    const form = new FormData()
    form.append('file', file)
    const res = await request<{ assetInfo: AssetInfo }>(
      `/api/model/3d/gpx?${query({ ...modelQuery(o, connectionId), track3D })}`,
      { method: 'POST', body: form, signal },
    )
    return toModelResult(res.assetInfo, o.format)
  },

  sketchfabExport: (req: SketchfabExportRequest) =>
    request<{ viewModelUrl: string }>('/api/model/export/sketchfab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),
}

const SKETCHFAB_CLIENT_ID = 'SKa6zTHsHdgbs7RE7oug69QQq9TMDPv8gtqAZUuj'

/**
 * Implicit-grant login; Sketchfab redirects back to /sketchfab_oauth2#access_token=…&state=<state>.
 * Use beginSketchfabLogin() (sketchfabAuth.ts), which passes a CSRF nonce as `state`.
 */
export function sketchfabLoginUrl(state: string): string {
  return `https://sketchfab.com/oauth2/authorize/?${query({
    state,
    response_type: 'token',
    client_id: SKETCHFAB_CLIENT_ID,
    approval_prompt: 'auto',
  })}`
}
