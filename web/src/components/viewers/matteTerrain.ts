import { $scene } from '@google/model-viewer/lib/model-viewer-base.js'
import { Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D } from 'three'

/**
 * Terrain material written by DEM.Net (`TerrainNode` + "Material"), or any textured material
 * (older models name it "Default"). GPX tracks and OSM layers are untextured and left alone.
 */
const isTerrain = (m: Material) => m.name.startsWith('TerrainNode') || !!(m as MeshStandardMaterial).map

/**
 * Makes the terrain matte: metallic 0 and Specular F0 0, so the imagery isn't washed out at grazing
 * angles. Newer GLBs already carry this (KHR_materials_specular → MeshPhysicalMaterial); older ones
 * load as MeshStandardMaterial, which has no specular control, so it is swapped for a physical copy.
 * model-viewer's public API can't do this (setSpecularFactor is a no-op on standard materials),
 * hence the internal scene.
 */
export function makeTerrainMatte(viewer: HTMLElement) {
  const scene = (viewer as unknown as Record<symbol, (Object3D & { queueRender(): void }) | undefined>)[$scene]
  if (!scene) return
  scene.traverse((o) => {
    if (!(o instanceof Mesh)) return
    const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material]
    const out = mats.map((m) => {
      if (!isTerrain(m)) return m
      if (m instanceof MeshPhysicalMaterial) {
        m.metalness = 0
        m.specularIntensity = 0
        return m
      }
      if (!(m instanceof MeshStandardMaterial)) return m
      const phys = new MeshPhysicalMaterial()
      MeshStandardMaterial.prototype.copy.call(phys, m) // standard props only; keeps shared textures
      phys.defines = { STANDARD: '', PHYSICAL: '' }
      phys.metalness = 0
      phys.specularIntensity = 0
      m.dispose()
      return phys
    })
    o.material = Array.isArray(o.material) ? out : out[0]!
  })
  scene.queueRender()
}
