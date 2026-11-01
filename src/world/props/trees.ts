import {
  type BufferGeometry,
  CylinderGeometry,
  Group,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { createRng, range, type Rng } from '../rng';
import { instance, mergeParts, type Placement } from './geometry';

const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

/** Unscaled trunk radius used for collisions. */
export const TREE_TRUNK_RADIUS = 0.35;

/** Rotates `dir` away from itself by `angle` in a random direction. */
function deviate(dir: Vector3, angle: number, rng: Rng): Vector3 {
  const axis = new Vector3()
    .crossVectors(dir, Math.abs(dir.y) < 0.99 ? UP : SIDE)
    .normalize()
    .applyAxisAngle(dir, rng() * Math.PI * 2);
  return dir.clone().applyAxisAngle(axis, angle);
}

function addBranch(
  parts: BufferGeometry[],
  start: Vector3,
  dir: Vector3,
  length: number,
  radius: number,
  depth: number,
  rng: Rng,
): void {
  const geo = new CylinderGeometry(radius * 0.45, radius, length, 5, 1, true);
  geo.translate(0, length / 2, 0);
  geo.applyQuaternion(new Quaternion().setFromUnitVectors(UP, dir));
  geo.translate(start.x, start.y, start.z);
  parts.push(geo);
  if (depth <= 0) return;

  for (let i = 0; i < 2; i++) {
    const childStart = start.clone().addScaledVector(dir, length * range(rng, 0.55, 0.95));
    const childDir = deviate(dir, range(rng, 0.45, 0.9), rng);
    childDir.y += 0.15;
    childDir.normalize();
    addBranch(parts, childStart, childDir, length * range(rng, 0.5, 0.7), radius * 0.55, depth - 1, rng);
  }
}

/** A gnarled, leafless tree merged into one geometry. */
function deadTreeGeometry(seed: number): BufferGeometry {
  const rng = createRng(seed);
  const parts: BufferGeometry[] = [];
  const height = range(rng, 3.4, 4.2);
  const lean = range(rng, 0.15, 0.3);

  const trunk = new CylinderGeometry(0.12, 0.32, height, 7, 4);
  trunk.translate(0, height / 2, 0);
  const pos = trunk.attributes.position;
  if (pos) {
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / height;
      pos.setX(i, pos.getX(i) + Math.sin(t * Math.PI * 0.9) * lean);
    }
  }
  parts.push(trunk);

  const branchCount = 5;
  for (let i = 0; i < branchCount; i++) {
    const t = range(rng, 0.45, 0.95);
    const start = new Vector3(Math.sin(t * Math.PI * 0.9) * lean, height * t, 0);
    const azimuth = (i / branchCount) * Math.PI * 2 + range(rng, -0.4, 0.4);
    const elevation = range(rng, 0.35, 0.95);
    const dir = new Vector3(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    );
    addBranch(parts, start, dir, range(rng, 1.1, 1.7), 0.09 * (1.2 - t * 0.4), 2, rng);
  }

  const merged = mergeParts(parts);
  merged.computeVertexNormals();
  return merged;
}

/** Dead trees in two shape variants, split evenly across placements. */
export function createTrees(placements: readonly Placement[]): Group {
  const group = new Group();
  group.name = 'trees';
  const bark = new MeshStandardMaterial({ color: 0x2e251e, roughness: 1, flatShading: true });
  const seeds = [11, 29];
  seeds.forEach((seed, variant) => {
    const subset = placements.filter((_, i) => i % seeds.length === variant);
    if (subset.length > 0) group.add(instance(deadTreeGeometry(seed), bark, subset));
  });
  return group;
}
