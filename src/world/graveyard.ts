import { WORLD } from '../game/config';
import { box, circle, type Collider, overlapsAny } from './collision';
import { GATE, nearCrypt, pathDistance, SPAWN } from './layout';
import { GATE_PILLAR_TOP } from './props/fence';
import type { Placement } from './props/geometry';
import {
  MOUND_OFFSET,
  TOMBSTONE_EXTENTS,
  type TombstonePlacement,
  type TombstoneVariant,
} from './props/tombstones';
import { TREE_TRUNK_RADIUS } from './props/trees';
import { createRng, fbm, range, type Rng } from './rng';

export interface GraveyardLayout {
  tombstones: TombstonePlacement[];
  mounds: Placement[];
  trees: Placement[];
  pumpkins: Placement[];
  carvedPumpkins: Placement[];
  /** Colliders for everything generated here (fence and crypt bring their own). */
  colliders: Collider[];
}

const ROW_SPACING = 3.8;
const COLUMN_SPACING = 2.8;
/** Walkable band kept clear just inside the fence. */
const INNER_MARGIN = 3.5;
const HALF = WORLD.halfSize;

function pickVariant(rng: Rng): TombstoneVariant {
  const r = rng();
  return r < 0.5 ? 'rounded' : r < 0.82 ? 'cross' : 'obelisk';
}

function nearSpawn(x: number, z: number, radius: number): boolean {
  return Math.hypot(x - SPAWN.x, z - SPAWN.z) < radius;
}

function placeTombstones(rng: Rng, out: GraveyardLayout, blockers: Collider[]): void {
  const limit = HALF - INNER_MARGIN;
  for (let z = -limit; z <= limit; z += ROW_SPACING) {
    for (let x = -limit; x <= limit; x += COLUMN_SPACING) {
      const px = x + range(rng, -0.35, 0.35);
      const pz = z + range(rng, -0.3, 0.3);
      if (rng() < 0.22) continue;
      if (pathDistance(px, pz) < 1 || pathDistance(px, pz + MOUND_OFFSET) < 0.6) continue;
      if (nearCrypt(px, pz, 3) || nearSpawn(px, pz, 7)) continue;
      if (fbm(px * 0.06, pz * 0.06, 21) > 0.62) continue; // open clearings

      const variant = pickVariant(rng);
      const scale = range(rng, 0.85, 1.2);
      const lean = rng() < 0.3 ? 0.18 : 0.04;
      const rotY = range(rng, -0.12, 0.12);
      out.tombstones.push({
        x: px,
        z: pz,
        rotY,
        scale,
        variant,
        tiltX: range(rng, -lean, lean),
        tiltZ: range(rng, -lean, lean),
      });

      const ext = TOMBSTONE_EXTENTS[variant];
      const collider = box(px, pz, ext.hx * scale, ext.hz * scale);
      out.colliders.push(collider);
      blockers.push(collider);

      if (rng() < 0.45) {
        const offset = MOUND_OFFSET * scale;
        out.mounds.push({ x: px + Math.sin(rotY) * offset, z: pz + Math.cos(rotY) * offset, rotY, scale });
      }
    }
  }
}

/** Tries random samples until `count` are accepted (or attempts run out). */
function scatter(
  count: number,
  sample: () => { x: number; z: number },
  accept: (x: number, z: number) => boolean,
): Array<{ x: number; z: number }> {
  const result: Array<{ x: number; z: number }> = [];
  for (let attempt = 0; attempt < count * 30 && result.length < count; attempt++) {
    const p = sample();
    if (accept(p.x, p.z)) result.push(p);
  }
  return result;
}

function placeTrees(rng: Rng, out: GraveyardLayout, blockers: Collider[]): void {
  const addTree = (x: number, z: number): void => {
    const scale = range(rng, 0.85, 1.4);
    out.trees.push({ x, z, rotY: rng() * Math.PI * 2, scale });
    const collider = circle(x, z, TREE_TRUNK_RADIUS * scale);
    out.colliders.push(collider);
    blockers.push(collider);
  };

  const inner = HALF - 4;
  const interior = scatter(
    18,
    () => ({ x: range(rng, -inner, inner), z: range(rng, -inner, inner) }),
    (x, z) =>
      pathDistance(x, z) > 1.2 && !nearCrypt(x, z, 3) && !nearSpawn(x, z, 5) && !overlapsAny(x, z, 1.2, blockers),
  );
  for (const p of interior) addTree(p.x, p.z);

  const perimeter = scatter(
    30,
    () => {
      const t = range(rng, -HALF + 1.5, HALF - 1.5);
      const d = HALF - range(rng, 1.4, 3);
      const side = Math.floor(rng() * 4);
      return [{ x: t, z: -d }, { x: t, z: d }, { x: -d, z: t }, { x: d, z: t }][side] ?? { x: t, z: d };
    },
    (x, z) =>
      !(z > HALF - 4 && Math.abs(x - GATE.x) < 5) && pathDistance(x, z) > 1 && !overlapsAny(x, z, 1, blockers),
  );
  for (const p of perimeter) addTree(p.x, p.z);
}

function placePumpkins(rng: Rng, out: GraveyardLayout, blockers: Collider[]): void {
  const addPumpkin = (x: number, z: number, rotY: number): void => {
    const scale = range(rng, 0.28, 0.42);
    if (overlapsAny(x, z, scale, blockers)) return;
    const p: Placement = { x, z, rotY, scale };
    out.pumpkins.push(p);
    if (rng() < 0.45) out.carvedPumpkins.push(p);
    const collider = circle(x, z, scale * 0.95);
    out.colliders.push(collider);
    blockers.push(collider);
  };

  // Beside graves, faces turned roughly towards the gate.
  for (let i = 0; i < 26 && out.tombstones.length > 0; i++) {
    const stone = out.tombstones[Math.floor(rng() * out.tombstones.length)];
    if (!stone) continue;
    const side = rng() < 0.5 ? -1 : 1;
    const lx = side * 0.75 * stone.scale;
    const lz = 0.45 * stone.scale;
    const cos = Math.cos(stone.rotY);
    const sin = Math.sin(stone.rotY);
    addPumpkin(stone.x + lx * cos + lz * sin, stone.z - lx * sin + lz * cos, Math.PI + range(rng, -0.6, 0.6));
  }

  // Along the path edges.
  const edges = scatter(
    12,
    () => ({ x: range(rng, -HALF + 4, HALF - 4), z: range(rng, -HALF + 4, HALF - 4) }),
    (x, z) => {
      const d = pathDistance(x, z);
      return d > 0.35 && d < 0.9 && !nearSpawn(x, z, 3);
    },
  );
  for (const p of edges) addPumpkin(p.x, p.z, rng() * Math.PI * 2);

  // Carved pumpkins on top of the gate pillars, looking into the graveyard.
  for (const sign of [-1, 1]) {
    const p: Placement = { x: GATE.x + sign * (GATE.halfWidth + 0.3), y: GATE_PILLAR_TOP, z: GATE.z, rotY: 0, scale: 0.36 };
    out.pumpkins.push(p);
    out.carvedPumpkins.push(p);
  }
}

/** Procedurally places graves, trees and pumpkins around the fixed landmarks. */
export function generateGraveyard(staticColliders: readonly Collider[]): GraveyardLayout {
  const rng = createRng(WORLD.seed);
  const layout: GraveyardLayout = {
    tombstones: [],
    mounds: [],
    trees: [],
    pumpkins: [],
    carvedPumpkins: [],
    colliders: [],
  };
  const blockers = [...staticColliders];
  placeTombstones(rng, layout, blockers);
  placeTrees(rng, layout, blockers);
  placePumpkins(rng, layout, blockers);
  return layout;
}
