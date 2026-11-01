import { RUN, SOUL, TRAIN } from '../game/config';
import type { Course, Obstacle } from './course';
import { laneX } from './lanes';
import type { Rng } from './rng';

export interface Soul {
  lane: number;
  /** Distance along the route. */
  at: number;
  /** Height above the roof. */
  height: number;
  taken: boolean;
}

/** Height of a well-timed jump's arc, `offset` metres from where it peaks. */
function arcHeight(offset: number): number {
  return Math.max(0.5, 1.55 - 0.03 * offset * offset);
}

/**
 * Maybe lays a trail of souls along one roofed lane of a block. The trail's
 * shape rewards what that lane asks of you: a straight line at chest height in
 * a clear lane, low under a bar (slide through it), or an arc over a hurdle
 * or gap (jump through it).
 */
export function placeSouls(start: number, roof: readonly boolean[], obstacles: readonly Obstacle[], rng: Rng): Soul[] {
  if (rng() >= SOUL.trailChance) return [];
  const lanes = roof.flatMap((hasRoof, lane) => (hasRoof ? [lane] : []));
  const lane = lanes[Math.floor(rng() * lanes.length)];
  if (lane === undefined) return [];

  const obstacle = obstacles.find((o) => o.lane === lane);
  const centre = obstacle?.at ?? start + TRAIN.blockLength / 2;
  const half = (SOUL.perTrail - 1) / 2;
  return Array.from({ length: SOUL.perTrail }, (_, i) => {
    const offset = (i - half) * SOUL.spacing;
    const height = !obstacle ? SOUL.height : obstacle.kind === 'bar' ? SOUL.lowHeight : arcHeight(offset);
    return { lane, at: centre + offset, height, taken: false };
  });
}

/**
 * Gathers the souls the runner is passing through: same lane, within reach
 * along the track, and between their feet and head (heights above the roof).
 * With `magnet` (the lantern flare), souls in any lane within `magnet` metres fly in.
 */
export function gatherSouls(course: Course, x: number, feet: number, head: number, at: number, magnet = 0): number {
  let count = 0;
  for (const soul of course.blocksNear(at, TRAIN.blockLength).flatMap((b) => b.souls)) {
    if (soul.taken) continue;
    const pulled = magnet > 0 && Math.abs(soul.at - at) < magnet;
    if (!pulled) {
      if (Math.abs(soul.at - at) > 0.75) continue;
      if (Math.abs(x - laneX(soul.lane)) > RUN.halfWidth + SOUL.reach) continue;
      if (soul.height < feet - 0.3 || soul.height > head + 0.2) continue;
    }
    soul.taken = true;
    count++;
  }
  return count;
}
