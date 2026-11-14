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

export interface AssetInfo {
  requestId: string
  modelFile: string
  modelFileSizeMB: number
  minElevation: number
  maxElevation: number
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
  /** Percentage of mesh triangles to keep, 10–100 (sent as meshReduceFactor = meshDetail / 100). */
  meshDetail: number
  /** 3D scale bar and north arrow next to the terrain (glTF only; the API's default is true). */
  adornments: boolean
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
  /** OBJ export (ZIP: .obj + .mtl + texture), converted server-side from the generated glTF. */
  objUrl: string | null
  attributions: Attribution[]
}

/** Images of the textures endpoint (`/api/texture/bbox/…`). */
export type TextureKind = 'texture' | 'normalmap' | 'heightmap'

export const TEXTURE_KINDS: readonly TextureKind[] = ['texture', 'normalmap', 'heightmap']

export interface TextureOptions {
  /** Elevation dataset, for the normal map and height map. */
  dataset: string
  /** Imagery, for the texture. */
  imageryProvider: string
  textureQuality: 1 | 2 | 3
}

/** A generated image with its georeferencing files (always present). */
export interface TextureFile {
  kind: TextureKind
  imageUrl: string
  worldFileUrl: string
  prjUrl: string
  /** EPSG code of the world file. */
  srid: number
  width: number
  height: number
  sizeMB: number
}

export interface TextureSetResult {
  id: string
  files: TextureFile[]
  /** Every image, its georeferencing files and metadata.json. */
  zipUrl: string
  minElevation: number | null
  maxElevation: number | null
  attributions: Attribution[]
}

export interface TextureEstimate {
  kind: TextureKind
  width: number
  height: number
  sizeMB: number
  allowed: boolean
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

/** What a generation produced: terrain (Map to 3D), osm (Map to 3D with OpenStreetMap), gpx, textures. */
export type GenerationKind = 'terrain' | 'osm' | 'gpx' | 'textures'
export const GENERATION_KINDS: readonly GenerationKind[] = ['terrain', 'osm', 'gpx', 'textures']

/** One successful model or texture generation, from the public statistics. */
export interface Generation {
  dataset: string
  kind: GenerationKind
  /** glTF or STL for models; the generated images (e.g. "texture,heightmap") for textures. */
  format: string
  /** Null when unknown. */
  sizeBytes: number | null
  /** yyyy-mm-dd (UTC) */
  date: string
  /** Null when unknown (GPX models recorded before the statistics database). */
  bbox: BBox | null
}

export interface GenerationStats {
  updatedAt: string
  generations: Generation[]
}
