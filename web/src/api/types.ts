export interface Attribution {
  subject: string
  text: string
  url: string
  acknowledgement?: string
}

export interface Dataset {
  name: string
  description: string
  publicUrl: string
  resolutionMeters: number
  attribution: Attribution
  isListed: boolean
  extentInfo?: string
}

export interface ImageryProvider {
  name: string
  /** Missing when a provider is configured without one. */
  attribution?: Attribution
  maxZoom: number
  privateUseOnly: boolean
}

export interface GeoPoint {
  latitude: number
  longitude: number
  elevation: number
  distanceFromOriginMeters?: number
}

export interface LineMetrics {
  minElevation: number
  maxElevation: number
  distance: number
  numPoints: number
  climb: number
  descent: number
  hasVoids: boolean
}

export interface ElevationResponse {
  message: string
  geoPoints: GeoPoint[]
  dataSet: Dataset
  metrics?: LineMetrics
}

interface FileRef {
  filePath: string
}

export interface AssetInfo {
  requestId: string
  modelFile: string
  modelFileSizeMB: number
  minElevation: number
  maxElevation: number
  heightMap?: FileRef | null
  albedoTexture?: FileRef | null
  normalMapTexture?: FileRef | null
  attributions: Attribution[]
}

/** BBox in lon/lat degrees. */
export interface BBox {
  west: number
  south: number
  east: number
  north: number
}

export type ModelFormat = 'glTF' | 'STL'

export interface ModelOptions {
  dataset: string
  format: ModelFormat
  textured: boolean
  imageryProvider: string
  textureQuality: 1 | 2 | 3
  zFactor: number
  generateTIN: boolean
  /** Percentage of mesh triangles to keep, 10–100 (sent as meshReduceFactor = meshDetail / 100). */
  meshDetail: number
}

/** Server-side size estimate (`onlyEstimateSize=true`). Approximate: actual files can differ by 2–3×. */
export interface SizeEstimate {
  /** Estimate for the requested mesh detail. */
  sizeMB: number
  /** Estimate at full detail (meshDetail 100%). */
  fullDetailMB: number
  maxMB: number
  /** False when the server would refuse to generate this model. */
  allowed: boolean
}

export interface OsmOptions {
  osmBuildings: boolean
  useOsmBuildingsColor: boolean
  buildingsColor: string
  osmPistesSki: boolean
  osmOnly: boolean
}

/** Model result with every file URL made absolute. */
export interface ModelResult {
  id: string
  format: ModelFormat
  modelUrl: string
  sizeMB: number
  minElevation: number
  maxElevation: number
  heightMapUrl: string | null
  albedoUrl: string | null
  normalMapUrl: string | null
  /** OBJ export (ZIP: .obj + .mtl + texture), converted server-side from the generated glTF. */
  objUrl: string | null
  attributions: Attribution[]
}

export interface SketchfabExportRequest {
  userToken: string
  modelId: string
  modelName: string
  description: string
  tags: string[]
  isInspectable: boolean
  isPublished: boolean
  isPrivate: boolean
  password: string
  clientConnectionId?: string | null
}
