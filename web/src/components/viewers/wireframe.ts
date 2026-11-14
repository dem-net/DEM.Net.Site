import { Mesh, MeshBasicMaterial, type Material, type Object3D } from 'three'

const OVERLAY = 'wireframe-overlay'

/** Shared by every overlay; never disposed (one tiny material for the whole session). */
const wireMaterial = new MeshBasicMaterial({
  color: 0x000000,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
})

/**
 * Draws (or removes) the triangle edges of every mesh under `root`, over its surface.
 * Each overlay is a child mesh sharing the original geometry, so no geometry is copied
 * (three.js builds and caches an edge index per geometry). The surfaces are pushed back
 * with polygon offset while the overlay is on, so the lines don't z-fight with them.
 */
export function setWireframe(root: Object3D, on: boolean) {
  const meshes: Mesh[] = []
  root.traverse((o) => {
    if (o instanceof Mesh && o.name !== OVERLAY) meshes.push(o)
  })
  for (const mesh of meshes) {
    const existing = mesh.children.find((c) => c.name === OVERLAY)
    if (on && !existing) {
      const wire = new Mesh(mesh.geometry, wireMaterial)
      wire.name = OVERLAY
      wire.raycast = () => {} // keep picking/hit tests on the real surface
      mesh.add(wire)
    } else if (!on && existing) {
      mesh.remove(existing)
    }
    const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      m.polygonOffset = on
      m.polygonOffsetFactor = on ? 1 : 0
      m.polygonOffsetUnits = on ? 1 : 0
    }
  }
}
