import type { Body, Runner } from '../entities/Runner';
import type { Course } from '../world/course';
import { collectPickups, touchingGhost } from '../world/hazards';
import { laneX } from '../world/lanes';
import { gatherSouls } from '../world/souls';
import { FLARE, OBSTACLE, RUN } from './config';
import type { CrashCause } from './GameState';

/** Everything the runner touched in one step. */
export interface Contacts {
  /** An obstacle or ghost that costs a life, if any. */
  hit: CrashCause | null;
  souls: number;
  lanterns: number;
}

/** Hurdles must be jumped (feet above them); bars must be slid under (head below them). */
function obstacleHit(course: Course, body: Body, distance: number): 'hurdle' | 'bar' | null {
  for (const o of course.obstaclesNear(distance, 2)) {
    if (o.kind === 'gap') continue;
    const hurdle = o.kind === 'hurdle';
    const halfWidth = hurdle ? OBSTACLE.hurdleHalfWidth : OBSTACLE.barHalfWidth;
    const halfDepth = hurdle ? OBSTACLE.hurdleHalfDepth : OBSTACLE.barHalfDepth;
    if (Math.abs(body.x - laneX(o.lane)) > halfWidth + RUN.halfWidth) continue;
    if (Math.abs(distance - o.at) > halfDepth + OBSTACLE.runnerHalfDepth) continue;
    const hit = hurdle ? body.feet < OBSTACLE.hurdleHeight : body.head > OBSTACLE.barBottom && body.feet < OBSTACLE.barTop;
    if (hit) return o.kind === 'hurdle' ? 'hurdle' : 'bar';
  }
  return null;
}

/**
 * What the runner touched this step. Obstacles and ghosts are ignored while
 * they blink after losing a life; a ghost that touches you disperses. While the
 * lantern flare burns, souls in any lane nearby fly to you.
 */
export function checkContacts(runner: Runner, course: Course, distance: number, flaring: boolean): Contacts {
  const body = runner.body;
  let hit: CrashCause | null = null;
  if (runner.invulnerable <= 0) {
    hit = obstacleHit(course, body, distance);
    const ghost = hit ? null : touchingGhost(course, body.x, body.feet, body.head, distance);
    if (ghost) {
      ghost.goneAt = distance;
      hit = 'ghost';
    }
  }
  return {
    hit,
    souls: gatherSouls(course, body.x, body.feet, body.head, distance, flaring ? FLARE.magnet : 0),
    lanterns: collectPickups(course, body.x, distance),
  };
}
