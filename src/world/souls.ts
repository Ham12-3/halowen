import { SOUL, TRAIN } from '../game/config';
import type { Obstacle } from './course';
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
