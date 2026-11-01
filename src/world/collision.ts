/**
 * Static collision on the ground (XZ) plane. Everything in the graveyard is
 * treated as an infinitely tall circle or axis-aligned box, which is plenty
 * for a flat world where nothing jumps.
 */

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export interface BoxCollider {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Collider = CircleCollider | BoxCollider;

export interface XZ {
  x: number;
  z: number;
}

export function circle(x: number, z: number, r: number): CircleCollider {
  return { kind: 'circle', x, z, r };
}

export function box(x: number, z: number, halfX: number, halfZ: number): BoxCollider {
  return { kind: 'box', minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ };
}

/** Pushes a circle out of one collider. Returns true if they overlapped. */
function pushOut(pos: XZ, radius: number, c: Collider): boolean {
  if (c.kind === 'circle') {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const min = radius + c.r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= min * min) return false;
    const d = Math.sqrt(d2);
    if (d < 1e-6) {
      pos.x += min;
      return true;
    }
    const push = (min - d) / d;
    pos.x += dx * push;
    pos.z += dz * push;
    return true;
  }

  const cx = Math.min(Math.max(pos.x, c.minX), c.maxX);
  const cz = Math.min(Math.max(pos.z, c.minZ), c.maxZ);
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return false;

  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    const push = (radius - d) / d;
    pos.x += dx * push;
    pos.z += dz * push;
    return true;
  }

  // Centre is inside the box: leave through the nearest face.
  const exits = [
    { axis: 'x', dist: pos.x - c.minX, target: c.minX - radius },
    { axis: 'x', dist: c.maxX - pos.x, target: c.maxX + radius },
    { axis: 'z', dist: pos.z - c.minZ, target: c.minZ - radius },
    { axis: 'z', dist: c.maxZ - pos.z, target: c.maxZ + radius },
  ] as const;
  let best: (typeof exits)[number] = exits[0];
  for (const e of exits) if (e.dist < best.dist) best = e;
  if (best.axis === 'x') pos.x = best.target;
  else pos.z = best.target;
  return true;
}

/** Resolves a moving circle against every collider. Mutates `pos`. */
export function resolveCircle(pos: XZ, radius: number, colliders: readonly Collider[]): boolean {
  let hit = false;
  // Two passes settle most corner cases where one push shoves into a neighbour.
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) hit = pushOut(pos, radius, c) || hit;
  }
  return hit;
}

/** True if a circle at (x, z) overlaps any collider. Used for procedural placement. */
export function overlapsAny(x: number, z: number, r: number, colliders: readonly Collider[]): boolean {
  const probe = { x, z };
  for (const c of colliders) {
    if (pushOut(probe, r, c)) return true;
  }
  return false;
}
