import { COURSE, LANES, ROUTE, TRAIN } from '../game/config';
import type { Rng } from './rng';

/**
 * The line ahead, generated a block at a time. Each block is a 14 m slice of
 * all three tracks: a lane either has a carriage in it (a roof to run on) or
 * is empty track you would fall onto. Roofed blocks may carry one obstacle.
 * Distances (`at`) are metres along the route; world z is `-at`.
 */
export type ObstacleKind = 'hurdle' | 'bar' | 'gap';

export interface Obstacle {
  lane: number;
  /** Distance along the route of the obstacle's centre. */
  at: number;
  kind: ObstacleKind;
}

export interface Block {
  index: number;
  /** Per lane: is there a carriage in this block? */
  roof: boolean[];
  obstacles: Obstacle[];
  /** A road bridge spans every lane here (each lane also gets a 'bar' obstacle). */
  bridge: boolean;
}

interface LaneState {
  roof: boolean;
  /** Blocks spent in the current state (train or empty stretch). */
  length: number;
  /** How long the current empty stretch lasts. */
  emptyFor: number;
}

const L = TRAIN.blockLength;
const MID_LANE = (LANES.count - 1) / 2;

export function laneX(lane: number): number {
  return (lane - MID_LANE) * LANES.width;
}

export function nearestLane(x: number): number {
  return Math.max(0, Math.min(LANES.count - 1, Math.round(x / LANES.width + MID_LANE)));
}

export class Course {
  /** Contiguous blocks, oldest first. */
  private blocks: Block[] = [];
  private lanes: LaneState[] = [];
  /** Block index of the last obstacle in each lane, to keep them spaced out. */
  private lastObstacle: number[] = [];
  private nextIndex = 0;
  private rng: Rng = Math.random;
  /** Bumped whenever blocks are added or dropped, so views know to rebuild. */
  version = 0;

  reset(rng: Rng): void {
    this.rng = rng;
    this.blocks = [];
    this.nextIndex = 0;
    this.lanes = Array.from({ length: LANES.count }, () => ({ roof: true, length: 0, emptyFor: 0 }));
    this.lastObstacle = this.lanes.map(() => -Infinity);
    this.version++;
  }

  get visible(): readonly Block[] {
    return this.blocks;
  }

  /** Keeps blocks generated from a little behind the runner to well ahead. */
  update(distance: number): void {
    const current = Math.floor(distance / L);
    while (this.nextIndex <= current + COURSE.ahead) {
      this.blocks.push(this.generate(this.nextIndex++));
      this.version++;
    }
    while ((this.blocks[0]?.index ?? Infinity) < current - COURSE.behind) {
      this.blocks.shift();
      this.version++;
    }
  }

  /** True if there is a roof to stand on in `lane` at distance `at`. */
  hasRoof(lane: number, at: number): boolean {
    if (at < 0) return true; // the platform end at the start of the line
    const block = this.block(Math.floor(at / L));
    if (!block?.roof[lane]) return false;
    return !block.obstacles.some((o) => o.kind === 'gap' && o.lane === lane && Math.abs(at - o.at) < TRAIN.gapLength / 2);
  }

  /** Obstacles whose centre is within `range` metres of distance `at`. */
  obstaclesNear(at: number, range: number): Obstacle[] {
    const out: Obstacle[] = [];
    for (let i = Math.floor((at - range) / L); i <= Math.floor((at + range) / L); i++) {
      for (const o of this.block(i)?.obstacles ?? []) if (Math.abs(o.at - at) <= range) out.push(o);
    }
    return out;
  }

  private block(index: number): Block | undefined {
    const first = this.blocks[0];
    return first ? this.blocks[index - first.index] : undefined;
  }

  private generate(index: number): Block {
    const start = index * L;
    const t = Math.min(1, start / COURSE.rampDistance);
    const ramp = ([easy, hard]: readonly number[]): number => (easy ?? 0) + ((hard ?? 0) - (easy ?? 0)) * t;
    // No hazards at the start of the line or on the run-in to the station.
    const calm = index < COURSE.safeBlocks || start > ROUTE.length - 90;
    const prev = this.blocks[this.blocks.length - 1];

    const roof = this.lanes.map((lane) => {
      if (lane.roof) {
        if (!calm && lane.length >= 3 && this.rng() < ramp(COURSE.endChance)) {
          Object.assign(lane, { roof: false, length: 0, emptyFor: this.rng() < 0.4 ? 2 : 1 });
        }
      } else if (calm || lane.length >= lane.emptyFor) {
        Object.assign(lane, { roof: true, length: 0 });
      }
      lane.length++;
      return lane.roof;
    });

    // Keep at least one lane roofed in both this block and the last, so there is always a way on.
    if (prev && !roof.some((r, l) => r && prev.roof[l])) {
      const options = prev.roof.flatMap((r, l) => (r ? [l] : []));
      const keep = options[Math.floor(this.rng() * options.length)] ?? 0;
      roof[keep] = true;
      Object.assign(this.lanes[keep] ?? {}, { roof: true, length: 3 });
    }

    const obstacles: Obstacle[] = [];
    let bridge = false;
    // A lane never gets obstacles in back-to-back blocks: at top speed one jump carries you
    // ~13 m, so anything closer could leave you landing on the next one with no time to react.
    const spaced = (lane: number): boolean => index - (this.lastObstacle[lane] ?? -Infinity) >= 2;
    if (!calm) {
      const mid = start + L / 2;
      if (this.rng() < ramp(COURSE.bridgeChance) && roof.every((_, lane) => spaced(lane))) {
        bridge = true;
        roof.forEach((_, lane) => obstacles.push({ lane, at: mid, kind: 'bar' }));
      } else {
        roof.forEach((hasRoof, lane) => {
          if (!hasRoof || !spaced(lane) || this.rng() >= ramp(COURSE.obstacleChance)) return;
          const r = this.rng();
          // A gap needs a carriage behind it to take off from.
          const kind: ObstacleKind = r < 0.45 ? 'hurdle' : r < 0.75 || !prev?.roof[lane] ? 'bar' : 'gap';
          obstacles.push({ lane, at: kind === 'gap' ? mid : mid + (this.rng() - 0.5) * 6, kind });
        });
        // Early on, leave one roofed lane completely clear.
        const roofed = roof.flatMap((r, l) => (r ? [l] : []));
        if (t < 0.5 && roofed.every((l) => obstacles.some((o) => o.lane === l))) {
          const spare = roofed[Math.floor(this.rng() * roofed.length)];
          obstacles.splice(0, obstacles.length, ...obstacles.filter((o) => o.lane !== spare));
        }
      }
    }
    for (const o of obstacles) this.lastObstacle[o.lane] = index;
    return { index, roof, obstacles, bridge };
  }
}
