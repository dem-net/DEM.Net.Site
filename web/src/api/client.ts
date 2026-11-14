import { GENERATION_KINDS } from './types'
import type {
  AssetInfo,
  Attribution,
  BBox,
  Dataset,
  ElevationResponse,
  Generation,
  GenerationStats,
  ImageryProvider,
  ModelOptions,
  ModelResult,
  OsmOptions,
  SizeEstimate,
  SketchfabExportRequest,
  TextureEstimate,
  TextureFile,
  TextureKind,
  TextureOptions,
  TextureSetResult,
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

export function texturePath(
  bbox: BBox,
  o: TextureOptions,
  kinds: readonly TextureKind[],
  connectionId: string | null,
  onlyEstimateSize = false,
): string {
  const params = {
    outputs: kinds.join(','),
    dataSet: o.dataset,
    // The server requires (and checks) a provider only for the texture
    imageryProvider: kinds.includes('texture') ? o.imageryProvider : null,
    textureQuality: o.textureQuality,
    clientConnectionId: connectionId,
    ...(onlyEstimateSize ? { onlyEstimateSize: true } : {}),
  }
  return `/api/texture/bbox/${bboxToPath(bbox)}?${query(params)}`
}

interface TextureFileResponse {
  kind: TextureKind
  filePath: string
  worldFilePath: string
  prjFilePath: string
  srid: number
  width: number
  height: number
  sizeMB: number
}

export interface TextureSetResponse {
  requestId: string
  minElevation?: number | null
  maxElevation?: number | null
  files: TextureFileResponse[]
  zipFilePath: string
  attributions?: Attribution[]
}

/** Absolute URLs; an image without its georeferencing files is a server error, not a partial result. */
export function toTextureResult(r: TextureSetResponse): TextureSetResult {
  const files = r.files.map((f): TextureFile => {
    const imageUrl = absoluteUrl(f.filePath)
    const worldFileUrl = absoluteUrl(f.worldFilePath)
    const prjUrl = absoluteUrl(f.prjFilePath)
    if (!imageUrl || !worldFileUrl || !prjUrl) throw new ApiError(500, `The ${f.kind} was returned without its georeferencing files.`)
    return { kind: f.kind, imageUrl, worldFileUrl, prjUrl, srid: f.srid, width: f.width, height: f.height, sizeMB: f.sizeMB }
  })
  return {
    id: r.requestId,
    files,
    zipUrl: absoluteUrl(r.zipFilePath)!,
    minElevation: r.minElevation ?? null,
    maxElevation: r.maxElevation ?? null,
    attributions: r.attributions ?? [],
  }
}

interface TextureEstimateResponse {
  success: boolean
  estimates: { kind: TextureKind; width: number; height: number; estimatedSizeMB: number }[]
  maximumAllowedFileSizeMB: number
}

export function toTextureEstimates(r: TextureEstimateResponse): { estimates: TextureEstimate[]; maxMB: number } {
  return {
    maxMB: r.maximumAllowedFileSizeMB,
    estimates: r.estimates.map((e) => ({
      kind: e.kind,
      width: e.width,
      height: e.height,
      sizeMB: e.estimatedSizeMB,
      allowed: e.estimatedSizeMB <= r.maximumAllowedFileSizeMB,
    })),
  }
}

/** GET /api/stats/generations: rows of values in the order of `columns`. */
export interface GenerationStatsResponse {
  updatedAt: string
  columns: string[]
  rows: unknown[][]
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Reads the rows by column name; malformed rows are dropped. */
export function toGenerationStats(r: GenerationStatsResponse): GenerationStats {
  const col = (name: string) => r.columns.indexOf(name)
  const [ds, kind, format, size, date, w, s, e, n] = [
    'dataset', 'kind', 'format', 'sizeBytes', 'date', 'west', 'south', 'east', 'north',
  ].map(col)
  const generations: Generation[] = []
  for (const row of r.rows ?? []) {
    const k = row[kind] as Generation['kind']
    if (typeof row[ds] !== 'string' || !GENERATION_KINDS.includes(k) || typeof row[date] !== 'string') continue
    const box = [row[w], row[s], row[e], row[n]]
    generations.push({
      dataset: row[ds] as string,
      kind: k,
      format: typeof row[format] === 'string' ? (row[format] as string) : '',
      sizeBytes: isNum(row[size]) && row[size] >= 0 ? row[size] : null,
      date: row[date] as string,
      bbox: box.every(isNum) ? { west: box[0] as number, south: box[1] as number, east: box[2] as number, north: box[3] as number } : null,
    })
  }
  return { updatedAt: r.updatedAt, generations }
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

  /** Every successful model and texture generation (public statistics, refreshed every minute by the API). */
  generationStats: async () => toGenerationStats(await request<GenerationStatsResponse>('/api/stats/generations')),

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

  async textures(
    bbox: BBox,
    o: TextureOptions,
    kinds: readonly TextureKind[],
    connectionId: string | null,
    signal?: AbortSignal,
  ): Promise<TextureSetResult> {
    return toTextureResult(await request<TextureSetResponse>(texturePath(bbox, o, kinds, connectionId), { signal }))
  },

  /** Size of each image (fast, nothing is generated). */
  async estimateTextures(bbox: BBox, o: TextureOptions, kinds: readonly TextureKind[], signal?: AbortSignal) {
    return toTextureEstimates(await request<TextureEstimateResponse>(texturePath(bbox, o, kinds, null, true), { signal }))
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
