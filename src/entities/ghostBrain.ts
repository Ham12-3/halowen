import { GHOST, WORLD } from '../game/config';
import type { XZ } from '../world/collision';
import { range, type Rng } from '../world/rng';

/**
 * Ghost behaviour as a tiny state machine:
 *   wander  -> drift between random points in the churchyard
 *   chase   -> home in on the player once they come close
 *   retreat -> flee for a moment after touching the player
 * Ghosts float straight through graves and trees; only the fence holds them in.
 */
export type GhostMode = 'wander' | 'chase' | 'retreat';

export interface Ghost {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  mode: GhostMode;
  targetX: number;
  targetZ: number;
  /** Seconds left in the current retreat, or before picking a new wander target. */
  timer: number;
  /** Per-ghost offset so they don't bob in sync. */
  phase: number;
  /** 0..1 fade-in scale after spawning. */
  appear: number;
}

/** Ghosts stay this far inside the fence. */
export const GHOST_BOUNDS = WORLD.halfSize - 1.5;

export function createGhost(x: number, z: number, rng: Rng): Ghost {
  const g: Ghost = {
    x,
    z,
    vx: 0,
    vz: 0,
    yaw: rng() * Math.PI * 2,
    mode: 'wander',
    targetX: x,
    targetZ: z,
    timer: 0,
    phase: rng() * Math.PI * 2,
    appear: 0,
  };
  startWander(g, rng);
  return g;
}

function startWander(g: Ghost, rng: Rng): void {
  g.mode = 'wander';
  // Prefer nearby points so ghosts patrol a neighbourhood rather than crossing the map.
  const reach = 14;
  g.targetX = Math.max(-GHOST_BOUNDS, Math.min(GHOST_BOUNDS, g.x + range(rng, -reach, reach)));
  g.targetZ = Math.max(-GHOST_BOUNDS, Math.min(GHOST_BOUNDS, g.z + range(rng, -reach, reach)));
  g.timer = range(rng, 5, 10);
}

export function startRetreat(g: Ghost, seconds: number = GHOST.retreatTime): void {
  // A ghost already fleeing keeps whichever retreat lasts longer.
  g.timer = g.mode === 'retreat' ? Math.max(g.timer, seconds) : seconds;
  g.mode = 'retreat';
}

/**
 * Updates the ghost's mode and steers its velocity. `hunting` is false when the
 * round is over, which sends every ghost back to aimless wandering.
 */
export function think(g: Ghost, dt: number, player: XZ, hunting: boolean, rng: Rng): void {
  const dx = player.x - g.x;
  const dz = player.z - g.z;
  const dist = Math.hypot(dx, dz);

  if (g.mode === 'retreat') {
    g.timer -= dt;
    if (g.timer <= 0) startWander(g, rng);
  } else if (g.mode === 'chase') {
    if (!hunting || dist > GHOST.loseRadius) startWander(g, rng);
  } else if (hunting && dist < GHOST.detectRadius) {
    g.mode = 'chase';
  }

  let dirX = 0;
  let dirZ = 0;
  let speed = 0;
  if (g.mode === 'chase') {
    dirX = dx;
    dirZ = dz;
    speed = GHOST.chaseSpeed;
  } else if (g.mode === 'retreat') {
    dirX = -dx;
    dirZ = -dz;
    speed = GHOST.retreatSpeed;
  } else {
    g.timer -= dt;
    const tx = g.targetX - g.x;
    const tz = g.targetZ - g.z;
    if (g.timer <= 0 || Math.hypot(tx, tz) < 1.5) startWander(g, rng);
    dirX = g.targetX - g.x;
    dirZ = g.targetZ - g.z;
    speed = GHOST.wanderSpeed;
  }

  const len = Math.hypot(dirX, dirZ);
  const desiredX = len > 1e-4 ? (dirX / len) * speed : 0;
  const desiredZ = len > 1e-4 ? (dirZ / len) * speed : 0;
  const blend = 1 - Math.exp(-GHOST.agility * dt);
  g.vx += (desiredX - g.vx) * blend;
  g.vz += (desiredZ - g.vz) * blend;
}

/** Pushes ghosts that are too close apart so a chasing pack fans out. */
export function separate(ghosts: readonly Ghost[], dt: number): void {
  for (let i = 0; i < ghosts.length; i++) {
    for (let j = i + 1; j < ghosts.length; j++) {
      const a = ghosts[i];
      const b = ghosts[j];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d >= GHOST.separation || d < 1e-4) continue;
      const push = ((GHOST.separation - d) / d) * 2 * dt;
      a.x -= dx * push;
      a.z -= dz * push;
      b.x += dx * push;
      b.z += dz * push;
    }
  }
}
