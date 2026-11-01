import { type BufferGeometry, type Color, InstancedMesh, type Material, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
