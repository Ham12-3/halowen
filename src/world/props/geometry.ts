import { type BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, type Material, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Gives every vertex of `geo` the same vertex colour (for single-material merged props). */
export function paint<T extends BufferGeometry>(geo: T, color: number | Color): T {
  const c = color instanceof Color ? color : new Color(color);
  const count = geo.attributes.position?.count ?? 0;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/** Where and how to place one instance of a prop. */
export interface Placement {
  x: number;
  y?: number;
  z: number;
  rotY: number;
  scale: number;
  /** Small lean in radians, applied before the yaw (crooked tombstones). */
  tiltX?: number;
  tiltZ?: number;
}

/**
 * Merges primitive parts into one geometry so a multi-part prop can be drawn
 * as a single InstancedMesh. Parts are de-indexed so mixed primitives merge.
 */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const prepared = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(prepared, false);
  if (!merged) throw new Error('mergeParts: parts have mismatched attributes');
  for (const g of [...parts, ...prepared]) g.dispose();
  return merged;
}

const dummy = new Object3D();

/** Builds an InstancedMesh with one instance per placement. */
export function instance(
  geometry: BufferGeometry,
  material: Material,
  placements: readonly Placement[],
  colors?: readonly Color[],
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, Math.max(placements.length, 1));
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y ?? 0, p.z);
    dummy.rotation.set(p.tiltX ?? 0, p.rotY, p.tiltZ ?? 0, 'YXZ');
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const color = colors?.[i];
    if (color) mesh.setColorAt(i, color);
  });
  mesh.count = placements.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
