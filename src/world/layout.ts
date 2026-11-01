import { WORLD } from '../game/config';

/**
 * Hand-placed landmarks. North is -Z: the gate is on the south fence,
 * the crypt sits at the far north end of the main path.
 */

export const SPAWN = { x: 0, z: WORLD.halfSize - 7 };

export const CRYPT = { x: 0, z: -WORLD.halfSize + 11, width: 7, depth: 6, height: 4.2 };

export const GATE = { x: 0, z: WORLD.halfSize, halfWidth: 2.4 };

export interface ShrineSpot {
  x: number;
  z: number;
  /** Turns the jack-o'-lantern's face towards the nearest path. */
  rotY: number;
}

/** Pumpkin shrines that refill the lantern, one in each part of the churchyard. */
export const SHRINES: readonly ShrineSpot[] = [
  { x: -21, z: 1.3, rotY: Math.PI }, // west, facing the cross path
  { x: 24, z: 6.7, rotY: 0 }, // east, facing the cross path
  { x: -3.9, z: -13, rotY: -Math.PI / 2 }, // north, beside the main path
  { x: 3.9, z: 16, rotY: Math.PI / 2 }, // south, beside the main path
];

interface PathSegment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfWidth: number;
}

const PATHS: readonly PathSegment[] = [
  // Main path from the gate to the crypt steps.
  { ax: 0, az: GATE.z + 2, bx: 0, bz: CRYPT.z + CRYPT.depth / 2, halfWidth: 1.6 },
  // East-west cross path, lined up with the town streets beyond the fence.
  { ax: -WORLD.halfSize, az: 4, bx: WORLD.halfSize, bz: 4, halfWidth: 1.2 },
  // Winding side paths.
  { ax: -14, az: 4, bx: -21, bz: -18, halfWidth: 1 },
  { ax: 15, az: 4, bx: 22, bz: 24, halfWidth: 1 },
  { ax: 0, az: -10, bx: 19, bz: -15, halfWidth: 1 },
];

function distanceToSegment(x: number, z: number, s: PathSegment): number {
  const vx = s.bx - s.ax;
  const vz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * vx + (z - s.az) * vz) / (vx * vx + vz * vz)));
  const dx = x - (s.ax + vx * t);
  const dz = z - (s.az + vz * t);
  return Math.sqrt(dx * dx + dz * dz);
}

/** Distance from the nearest path edge: negative inside a path, positive outside. */
export function pathDistance(x: number, z: number): number {
  let best = Infinity;
  for (const s of PATHS) best = Math.min(best, distanceToSegment(x, z, s) - s.halfWidth);
  return best;
}

/** True if (x, z) is within `radius` of any shrine. */
export function nearShrine(x: number, z: number, radius: number): boolean {
  return SHRINES.some((s) => Math.hypot(x - s.x, z - s.z) < radius);
}

/** True if (x, z) is inside the crypt footprint expanded by `margin`. */
export function nearCrypt(x: number, z: number, margin: number): boolean {
  return (
    Math.abs(x - CRYPT.x) < CRYPT.width / 2 + margin &&
    Math.abs(z - CRYPT.z) < CRYPT.depth / 2 + margin
  );
}
