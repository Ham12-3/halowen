import { Color, Group, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { createRng } from '../rng';
import { instance, mergeParts, type Placement } from './geometry';
import { buildHouse, type HouseSpec } from './houseGeometry';

export { HOUSE_DEPTH } from './houseGeometry';

const SPECS: readonly HouseSpec[] = [
  { width: 5, floors: 4, roof: 'gable', roofHeight: 4.6, shutters: 0x2f4a3a },
  { width: 6.5, floors: 3, roof: 'gable', roofHeight: 4.8, shutters: 0x6b2a22 },
  { width: 7.5, floors: 3, roof: 'eave', roofHeight: 4, shutters: 0x2c3e5a },
];

/** Each spec is built twice with different window patterns for variety. */
const WINDOW_SEEDS = [101, 202];

export const HOUSE_VARIANT_COUNT = SPECS.length * WINDOW_SEEDS.length;

export function houseWidth(variant: number): number {
  return SPECS[variant % SPECS.length]?.width ?? 6;
}

export interface HousePlacement extends Placement {
  variant: number;
}

/** Limewash tints multiplied over the plaster so neighbours differ. */
const TINTS = [0xffffff, 0xf6e2b8, 0xf3d6c8, 0xdde3e8, 0xeee8cf, 0xf0d9a8].map((hex) => new Color(hex));

/** All town houses: one InstancedMesh per variant for walls, lit and dark windows. */
export function createHouses(placements: readonly HousePlacement[]): Group {
  const group = new Group();
  group.name = 'houses';

  const walls = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const lit = new MeshBasicMaterial({ color: 0xffb35c });
  const dark = new MeshStandardMaterial({ color: 0x0b1020, roughness: 0.25, metalness: 0.5 });
  const rng = createRng(909);

  for (let variant = 0; variant < HOUSE_VARIANT_COUNT; variant++) {
    const subset = placements.filter((p) => p.variant === variant);
    if (subset.length === 0) continue;
    const spec = SPECS[variant % SPECS.length];
    const seed = WINDOW_SEEDS[Math.floor(variant / SPECS.length)];
    if (!spec || seed === undefined) continue;

    const parts = buildHouse(spec, createRng(seed));
    const tints = subset.map(() => TINTS[Math.floor(rng() * TINTS.length)] ?? new Color(0xffffff));
    group.add(instance(mergeParts(parts.body), walls, subset, tints));

    if (parts.litWindows.length > 0) {
      // Some households are still awake; others have let their candles burn low.
      const glow = subset.map(() => new Color(1, 1, 1).multiplyScalar(rng() < 0.25 ? 0.15 : 0.6 + rng() * 0.4));
      const mesh = instance(mergeParts(parts.litWindows), lit, subset, glow);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      group.add(mesh);
    }
    if (parts.darkWindows.length > 0) {
      const mesh = instance(mergeParts(parts.darkWindows), dark, subset);
      mesh.castShadow = false;
      group.add(mesh);
    }
  }
  return group;
}
