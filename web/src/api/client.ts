import { GENERATION_KINDS } from './types'
import { viewerFromApi, viewerToApi } from './viewerSettings'
import type {
  AssetInfo,
  Attribution,
  BBox,
  Dataset,
  ElevationResponse,
  GalleryAdminSession,
  GalleryItem,
  GalleryKind,
  GalleryPage,
  GalleryReceipt,
  GallerySubmission,
  Generation,
  GenerationDetail,
  GenerationStats,
  ImageryProvider,
  MeshQuality,
  ModelOptions,
  ModelResult,
  OsmOptions,
  QualityEstimate,
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

/** The API answers errors as plain text, as JSON `{ statusCode, message }`, or as ProblemDetails `{ title, detail }`. */
async function readError(res: Response): Promise<ApiError> {
  const text = await res.text()
  let message = text
  try {
    const body = JSON.parse(text)
    message = body.message ?? body.detail ?? body.title ?? text
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

/** For calls whose answer has no body (202, 204). */
async function send(path: string, init?: RequestInit): Promise<void> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, init)
  } catch {
    throw new ApiError(0, 'Cannot reach the Elevation API. Check your connection and try again.')
  }
  if (!res.ok) throw await readError(res)
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
    meshQuality: o.meshQuality, // ignored by fixed resolution datasets
    adornments: o.format === 'glTF' && o.adornments,
    boxed: o.format === 'glTF' && o.boxed,
    boxStyle: o.format === 'glTF' && o.boxed && o.boxMonuments ? 'Monuments' : 'Solid',
    water: o.format === 'glTF' && o.water,
    trueScale: o.trueScale,
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
    withHighways: osm.osmHighways,
    withTerrain: !osm.osmOnly,
    // centerOnOrigin is left to the API default (true): false keeps Web Mercator coordinates, far off the viewer's frame
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

/**
 * Every generation in one request: the API pages this endpoint (30 rows by default),
 * so ask for its largest page (10000 rows).
 */
export const GENERATION_STATS_PATH = '/api/stats/generations?limit=10000'

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
  const [id, ds, kind, format, size, date, w, s, e, n, place] = [
    'id', 'dataset', 'kind', 'format', 'sizeBytes', 'date', 'west', 'south', 'east', 'north', 'place',
  ].map(col)
  const generations: Generation[] = []
  for (const row of r.rows ?? []) {
    const k = row[kind] as Generation['kind']
    if (typeof row[ds] !== 'string' || !GENERATION_KINDS.includes(k) || typeof row[date] !== 'string') continue
    const box = [row[w], row[s], row[e], row[n]]
    generations.push({
      id: id >= 0 && isNum(row[id]) ? row[id] : null,
      dataset: row[ds] as string,
      kind: k,
      format: typeof row[format] === 'string' ? (row[format] as string) : '',
      sizeBytes: isNum(row[size]) && row[size] >= 0 ? row[size] : null,
      date: row[date] as string,
      bbox: box.every(isNum) ? { west: box[0] as number, south: box[1] as number, east: box[2] as number, north: box[3] as number } : null,
      place: typeof row[place] === 'string' && (row[place] as string).trim() ? (row[place] as string).trim().slice(0, 100) : null,
    })
  }
  return { updatedAt: r.updatedAt, generations }
}

export interface EstimateResponse {
  success: boolean
  estimatedModelFileSizeMB: number
  estimatedModelFileSizeAfterReduceMB: number
  maximumAllowedFileSizeMB: number
  message?: string | null
  meshQualityEstimates?: {
    quality: number
    resolutionMeters: number
    estimatedModelFileSizeAfterReduceMB: number
    allowed: boolean
  }[] | null
}

export function toQualityEstimates(r: EstimateResponse): QualityEstimate[] | undefined {
  const list = (r.meshQualityEstimates ?? [])
    .filter((e) => [1, 2, 3, 4].includes(e.quality))
    .map((e) => ({
      quality: e.quality as MeshQuality,
      resolutionMeters: e.resolutionMeters,
      sizeMB: e.estimatedModelFileSizeAfterReduceMB,
      allowed: e.allowed,
    }))
  return list.length ? list : undefined
}

export const api = {
  datasets: () => request<Dataset[]>('/api/dataset'),

  imagery: () => request<ImageryProvider[]>('/api/imagery'),

  /** Every successful model and texture generation (public statistics, refreshed every minute by the API). */
  generationStats: async () => toGenerationStats(await request<GenerationStatsResponse>(GENERATION_STATS_PATH)),

  /** Options and model URL of up to 20 generations. */
  async generationDetails(ids: number[], signal?: AbortSignal): Promise<GenerationDetail[]> {
    const rows = await request<{ id: number; options?: Record<string, string> | null; modelUrl?: string | null }[]>(
      `/api/stats/generations/details?${query({ ids: ids.join(',') })}`,
      { signal },
    )
    return rows.map((r) => ({ id: r.id, options: r.options ?? {}, modelUrl: safeUrl(absoluteUrl(r.modelUrl)) ?? null }))
  },

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
    const qualities = toQualityEstimates(r)
    return {
      sizeMB: r.estimatedModelFileSizeAfterReduceMB,
      fullDetailMB: r.estimatedModelFileSizeMB,
      maxMB: r.maximumAllowedFileSizeMB,
      allowed: r.success && r.estimatedModelFileSizeAfterReduceMB <= r.maximumAllowedFileSizeMB,
      ...(r.message && { message: r.message }),
      ...(qualities && { qualities }),
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

  /**
   * Submits a generated glTF model to the gallery (multipart). The model stays on the server: only its id is sent,
   * with the texts, the poster and the optional turntable clip. The token in the receipt is shown only once.
   */
  galleryPublish(s: GallerySubmission, signal?: AbortSignal): Promise<GalleryReceipt> {
    return request<GalleryReceipt>('/api/gallery', { method: 'POST', body: galleryForm(s), signal })
  },

  /** Published models, newest first; pass the previous page's `next` as `cursor`. */
  async galleryList(cursor: string | null, limit: number, signal?: AbortSignal): Promise<GalleryPage> {
    const r = await request<GalleryPageResponse>(`/api/gallery?${query({ cursor, limit })}`, { signal })
    return { items: (r.items ?? []).map(toGalleryItem), next: r.next ?? null }
  },

  /** One published model; null when it isn't published (unknown, waiting for review, rejected or deleted). */
  async galleryItem(id: string, signal?: AbortSignal): Promise<GalleryItem | null> {
    try {
      return toGalleryItem(await request<GalleryItemResponse>(`/api/gallery/${encodeURIComponent(id)}`, { signal }))
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null
      throw e
    }
  },

  /** Deletes a model with the token of the publisher's private link. A wrong token answers 404, like an unknown id. */
  galleryDelete: (id: string, token: string) =>
    send(`/api/gallery/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'X-Gallery-Token': token } }),

  sketchfabExport: (req: SketchfabExportRequest) =>
    request<{ viewModelUrl: string }>('/api/model/export/sketchfab', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }),
}

/** Limits checked by the API (characters, after it trims and removes control characters). */
export const GALLERY_TITLE_MAX = 80
export const GALLERY_DESCRIPTION_MAX = 1000
export const GALLERY_PSEUDONYM_MAX = 40

export function galleryForm(s: GallerySubmission): FormData {
  const form = new FormData()
  form.append('modelId', s.modelId)
  form.append('title', s.title.trim())
  form.append('description', s.description.trim())
  form.append('pseudonym', s.pseudonym.trim())
  const ext = s.poster.type === 'image/webp' ? 'webp' : s.poster.type === 'image/png' ? 'png' : 'jpg'
  form.append('poster', s.poster, `poster.${ext}`)
  if (s.clip) form.append('clip', s.clip, 'turntable.mp4')
  if (s.viewer) form.append('viewer', JSON.stringify(viewerToApi(s.viewer)))
  return form
}

/**
 * The publisher's private link to their model. The token is in the fragment, which browsers never send to a server,
 * so it stays out of every log; the gallery page reads it to offer deletion.
 */
export function galleryOwnerLink(id: string, token: string, origin: string): string {
  return `${origin}/gallery/${encodeURIComponent(id)}#token=${encodeURIComponent(token)}`
}

/** Gallery id: 32 lowercase hex characters (checked before calling the API with a route parameter). */
export const GALLERY_ID = /^[0-9a-f]{32}$/

export interface GalleryItemResponse {
  id: string
  status: string
  title: string
  description?: string | null
  pseudonym?: string | null
  place?: string | null
  kind: string
  dataset: string
  imagery?: string | null
  options?: Record<string, string> | null
  /** [west, south, east, north] */
  bbox?: number[] | null
  attributions?: Attribution[] | null
  modelBytes: number
  createdAt: string
  publishedAt?: string | null
  posterUrl: string
  clipUrl?: string | null
  modelUrl: string
  /** Numbers, booleans as 0/1 (see viewerSettings.ts) */
  viewer?: Record<string, number> | null
}

export interface GalleryPageResponse {
  items?: GalleryItemResponse[] | null
  next?: string | null
}

const GALLERY_KINDS: readonly GalleryKind[] = ['terrain', 'osm', 'gpx']

export function toGalleryItem(r: GalleryItemResponse): GalleryItem {
  const b = r.bbox
  return {
    id: r.id,
    status: r.status,
    title: r.title,
    description: r.description || null,
    pseudonym: r.pseudonym || null,
    place: r.place || null,
    kind: GALLERY_KINDS.includes(r.kind as GalleryKind) ? (r.kind as GalleryKind) : 'terrain',
    dataset: r.dataset,
    imagery: r.imagery || null,
    options: r.options ?? {},
    bbox: b && b.length === 4 && b.every(Number.isFinite) ? { west: b[0], south: b[1], east: b[2], north: b[3] } : null,
    attributions: r.attributions ?? [],
    modelBytes: r.modelBytes,
    createdAt: r.createdAt,
    publishedAt: r.publishedAt ?? null,
    posterUrl: absoluteUrl(r.posterUrl)!,
    clipUrl: absoluteUrl(r.clipUrl),
    modelUrl: absoluteUrl(r.modelUrl)!,
    viewer: viewerFromApi(r.viewer),
  }
}

/** Reads `#token=…` (publisher's private link) or `#login=…` (admin sign-in link) from a location hash. */
export function hashParam(hash: string, name: 'token' | 'login'): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get(name) || null
}

export type GalleryFile = 'poster' | 'clip' | 'model'

/**
 * Moderation calls, signed in with a one-time link emailed to the admin address. The session stays in memory only
 * (never in browser storage): reloading the page signs out.
 */
export const galleryAdmin = {
  /** Answers the same whatever the address: only the configured admin address gets an email. */
  requestLink: (email: string) =>
    send('/api/gallery/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    }),

  /** Exchanges the token of a sign-in link (usable once) for a session. */
  signIn: (token: string) =>
    request<GalleryAdminSession>('/api/gallery/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }),

  signOut: (session: string) => send('/api/gallery/admin/session', { method: 'DELETE', headers: bearer(session) }),

  /** Waiting for review, oldest first. */
  async pending(session: string, signal?: AbortSignal): Promise<GalleryItem[]> {
    const rows = await request<GalleryItemResponse[]>('/api/gallery/admin/pending', { headers: bearer(session), signal })
    return rows.map(toGalleryItem)
  },

  /** A pending model's file: fetched with the session, so it can't be a plain <img src>. */
  async file(session: string, id: string, file: GalleryFile, signal?: AbortSignal): Promise<Blob> {
    let res: Response
    try {
      res = await fetch(`${API_BASE}/api/gallery/admin/${encodeURIComponent(id)}/${file}`, { headers: bearer(session), signal })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new ApiError(0, 'Cannot reach the Elevation API. Check your connection and try again.')
    }
    if (!res.ok) throw await readError(res)
    return res.blob()
  },

  approve: (session: string, id: string) =>
    send(`/api/gallery/admin/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: bearer(session) }),

  reject: (session: string, id: string) =>
    send(`/api/gallery/admin/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: bearer(session) }),

  /** Removes any model, published or not. */
  remove: (session: string, id: string) =>
    send(`/api/gallery/admin/${encodeURIComponent(id)}`, { method: 'DELETE', headers: bearer(session) }),
}

function bearer(session: string): HeadersInit {
  return { Authorization: `Bearer ${session}` }
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
