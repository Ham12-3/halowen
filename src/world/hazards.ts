import { FLARE, GHOST, OBSTACLE, RUN, TRAIN } from '../game/config';
import type { Block, Course } from './course';
import { laneX } from './lanes';
import type { Rng } from './rng';

export interface Ghost {
  lane: number;
  /** The lane it swoops into as the runner approaches (equal to `lane` for one that just hovers). */
  toLane: number;
  /** Distance along the route. */
  at: number;
  /** Distance at which it was banished or touched (it fades away), or null while it haunts. */
  goneAt: number | null;
}

/** A floating lantern that lights the flare when collected. */
export interface Pickup {
  lane: number;
  at: number;
  taken: boolean;
}

const L = TRAIN.blockLength;

/** Roofed lanes of a block with no obstacle in them. */
function clearLanes(block: Block): number[] {
  return block.roof.flatMap((roofed, lane) => (roofed && !block.obstacles.some((o) => o.lane === lane) ? [lane] : []));
}

/**
 * Maybe haunts `block` with a ghost, decided once the block after it (`next`)
 * exists. A ghost only goes where some other lane is roofed before, through and
 * after it, so there is always a lane you can hold all the way past it.
 */
export function placeGhosts(block: Block, before: Block | undefined, next: Block, chance: number, rng: Rng): Ghost[] {
  if (block.calm || block.index * L < GHOST.firstAt || rng() >= chance) return [];
  const clear = clearLanes(block);
  const lane = clear[Math.floor(rng() * clear.length)];
  if (lane === undefined) return [];
  const neighbours = clear.filter((l) => Math.abs(l - lane) === 1);
  const toLane = neighbours.length > 0 && rng() < GHOST.swoopShare ? (neighbours[Math.floor(rng() * neighbours.length)] ?? lane) : lane;
  const holdable = (l: number): boolean => l !== toLane && block.roof[l] === true && next.roof[l] === true && (before?.roof[l] ?? true);
  if (!block.roof.some((_, l) => holdable(l))) return [];
  return [{ lane, toLane, at: block.index * L + L / 2 + (rng() - 0.5) * 4, goneAt: null }];
}

/** Maybe floats a lantern pickup over a clear lane that carries on into the next block. */
export function placePickup(block: Block, next: Block, lastAt: number, rng: Rng): Pickup[] {
  const at = block.index * L + L / 2;
  if (block.calm || at - lastAt < FLARE.spacing * (0.8 + rng() * 0.4)) return [];
  const lanes = clearLanes(block).filter((l) => next.roof[l]);
  const lane = lanes[Math.floor(rng() * lanes.length)];
  return lane === undefined ? [] : [{ lane, at, taken: false }];
}

/** A ghost's sideways position, given how far along the runner is: swoopers glide across as you near. */
export function ghostX(g: Ghost, distance: number): number {
  if (g.lane === g.toLane) return laneX(g.lane);
  const t = Math.min(1, Math.max(0, (distance - (g.at - GHOST.swoopLead)) / GHOST.swoopLength));
  return laneX(g.lane) + (laneX(g.toLane) - laneX(g.lane)) * t * t * (3 - 2 * t);
}

/** True while a swooper is gliding across (its eyes burn red). */
export function isSwooping(g: Ghost, distance: number): boolean {
  const start = g.at - GHOST.swoopLead;
  return g.lane !== g.toLane && distance > start - 25 && distance < start + GHOST.swoopLength;
}

/** Swoopers whose glide begins between distances `from` and `to` (for their wail). */
export function swoopsStarting(course: Course, from: number, to: number): Ghost[] {
  const ahead = GHOST.swoopLead;
  return course
    .blocksNear(to + ahead, ahead)
    .flatMap((b) => b.ghosts)
    .filter((g) => g.goneAt === null && g.lane !== g.toLane && g.at - ahead > from && g.at - ahead <= to);
}

/** Banishes every haunting ghost up to `reach` ahead. Returns how many. */
export function banishGhosts(course: Course, distance: number, reach: number): number {
  let count = 0;
  for (const g of course.blocksNear(distance + reach / 2, reach / 2 + L).flatMap((b) => b.ghosts)) {
    if (g.goneAt !== null || g.at < distance - 1 || g.at > distance + reach) continue;
    g.goneAt = distance;
    count++;
  }
  return count;
}

/** The ghost the runner's body is touching, if any (feet and head are heights above the roof). */
export function touchingGhost(course: Course, x: number, feet: number, head: number, distance: number): Ghost | null {
  for (const g of course.blocksNear(distance, L).flatMap((b) => b.ghosts)) {
    if (g.goneAt !== null || Math.abs(distance - g.at) > GHOST.halfDepth + OBSTACLE.runnerHalfDepth) continue;
    if (Math.abs(x - ghostX(g, distance)) > GHOST.halfWidth + RUN.halfWidth) continue;
    if (head > GHOST.hover && feet < GHOST.hover + GHOST.height) return g;
  }
  return null;
}

/** Collects any lantern pickup the runner passes through. Returns how many. */
export function collectPickups(course: Course, x: number, distance: number): number {
  let count = 0;
  for (const p of course.blocksNear(distance, L).flatMap((b) => b.pickups)) {
    if (p.taken || Math.abs(distance - p.at) > 0.9 || Math.abs(x - laneX(p.lane)) > 1) continue;
    p.taken = true;
    count++;
  }
  return count;
}
