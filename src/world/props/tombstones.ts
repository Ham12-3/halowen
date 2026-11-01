import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
} from 'three';
import { createRng } from '../rng';
import { instance, mergeParts, type Placement } from './geometry';

/** Tombstone fronts face +Z (towards the gate). */
export type TombstoneVariant = 'rounded' | 'cross' | 'obelisk';

export interface TombstonePlacement extends Placement {
  variant: TombstoneVariant;
}

/** Unscaled collision half-extents for each variant. */
export const TOMBSTONE_EXTENTS: Record<TombstoneVariant, { hx: number; hz: number }> = {
  rounded: { hx: 0.47, hz: 0.2 },
  cross: { hx: 0.33, hz: 0.2 },
  obelisk: { hx: 0.27, hz: 0.27 },
};

/** How far in front of the stone a grave mound sits (unscaled). */
export const MOUND_OFFSET = 1.05;

function roundedGeometry(): BufferGeometry {
  const w = 0.36;
  const shape = new Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, 0.7);
  shape.absarc(0, 0.7, w, 0, Math.PI, false);
  shape.lineTo(-w, 0);
  const slab = new ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 10,
  });
  slab.translate(0, 0.06, -0.07);
  const base = new BoxGeometry(0.9, 0.14, 0.34);
  base.translate(0, 0.03, 0);
  return mergeParts([slab, base]);
}

function crossGeometry(): BufferGeometry {
  const post = new BoxGeometry(0.16, 1.15, 0.14);
  post.translate(0, 0.72, 0);
  const arm = new BoxGeometry(0.62, 0.15, 0.14);
  arm.translate(0, 0.98, 0);
  const base = new BoxGeometry(0.48, 0.24, 0.36);
  base.translate(0, 0.08, 0);
  return mergeParts([post, arm, base]);
}

function obeliskGeometry(): BufferGeometry {
  const shaft = new CylinderGeometry(0.13, 0.2, 1.3, 4);
  shaft.rotateY(Math.PI / 4);
  shaft.translate(0, 0.9, 0);
  const tip = new ConeGeometry(0.13, 0.24, 4);
  tip.rotateY(Math.PI / 4);
  tip.translate(0, 1.67, 0);
  const plinth = new BoxGeometry(0.5, 0.26, 0.5);
  plinth.translate(0, 0.12, 0);
  const merged = mergeParts([shaft, tip, plinth]);
  merged.computeVertexNormals(); // non-indexed, so this yields crisp flat facets
  return merged;
}

function moundGeometry(): BufferGeometry {
  const mound = new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  mound.scale(0.42, 0.13, 0.8);
  return mound;
}

const STONE_GREY = new Color(0x77787c);
const STONE_LIGHT = new Color(0x95928a);
const STONE_MOSS = new Color(0x4f5b44);

/** All tombstones and grave mounds, one InstancedMesh per variant. */
export function createTombstones(
  stones: readonly TombstonePlacement[],
  mounds: readonly Placement[],
): Group {
  const group = new Group();
  group.name = 'tombstones';

  const stoneMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  const rng = createRng(4242);
  const builders: Record<TombstoneVariant, () => BufferGeometry> = {
    rounded: roundedGeometry,
    cross: crossGeometry,
    obelisk: obeliskGeometry,
  };

  for (const variant of Object.keys(builders) as TombstoneVariant[]) {
    const placements = stones.filter((s) => s.variant === variant);
    if (placements.length === 0) continue;
    const colors = placements.map(() => {
      const c = STONE_GREY.clone().lerp(STONE_LIGHT, rng() * 0.6);
      return rng() < 0.35 ? c.lerp(STONE_MOSS, 0.3 + rng() * 0.4) : c;
    });
    group.add(instance(builders[variant](), stoneMaterial, placements, colors));
  }

  if (mounds.length > 0) {
    const dirt = new MeshStandardMaterial({ color: 0x2a1f16, roughness: 1 });
    const mesh = instance(moundGeometry(), dirt, mounds);
    mesh.castShadow = false;
    group.add(mesh);
  }

  return group;
}
