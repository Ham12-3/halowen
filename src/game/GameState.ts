import { ROUTE, RUN, SOUL } from './config';
import { FINISH, type Station, STATIONS, speedCapAt, stageAt, TOP_SPEED } from './route';

/** `ready` = title screen; `crashed` and `arrived` (at the last station) end the run. */
export type RunStatus = 'ready' | 'playing' | 'crashed' | 'arrived';

/** What ended a run in a crash. */
export type CrashCause = 'fell' | 'hurdle' | 'bar';

const BEST_KEY = 'midnight-line-best-score';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Distance, speed, souls, score and outcome for one run along the line. */
export class GameState {
  status: RunStatus = 'ready';
  distance = 0;
  speed: number = RUN.startSpeed;
  time = 0;
  souls = 0;
  /** Stations reached after the first, each worth a bonus. */
  stationsReached = 0;
  cause: CrashCause | null = null;
  /** Best score ever (remembered between visits). */
  best = readBest();
  /** The best score as it stood when this run began. */
  previousBest = this.best;

  reset(): void {
    this.status = 'ready';
    this.distance = 0;
    this.speed = RUN.startSpeed;
    this.time = 0;
    this.souls = 0;
    this.stationsReached = 0;
    this.cause = null;
    this.previousBest = this.best;
  }

  begin(): void {
    if (this.status === 'ready') this.status = 'playing';
  }

  get isOver(): boolean {
    return this.status === 'crashed' || this.status === 'arrived';
  }

  /** A metre run is a point, each soul SOUL.value, each station reached a bonus. */
  get score(): number {
    return Math.floor(this.distance) + this.souls * SOUL.value + this.stationsReached * ROUTE.stationBonus;
  }

  /** This run beat the best score from before it (not counting the very first run). */
  get isNewBest(): boolean {
    return this.previousBest > 0 && this.score > this.previousBest;
  }

  get stage(): number {
    return stageAt(this.distance);
  }

  /** 0..1 along the whole line. */
  get progress(): number {
    return Math.min(1, this.distance / FINISH);
  }

  /** 0 at the starting speed, 1 at the line's top speed. */
  get pace(): number {
    return (this.speed - RUN.startSpeed) / (TOP_SPEED - RUN.startSpeed);
  }

  /** The next station ahead (the last one once there). */
  get nextStation(): Station {
    return STATIONS.find((s) => s.at > this.distance) ?? (STATIONS[STATIONS.length - 1] as Station);
  }

  /** Metres to the next station. */
  get toNext(): number {
    return Math.max(0, this.nextStation.at - this.distance);
  }

  /** Runs the clock and moves the runner along. Returns the station reached this step, if any. */
  advance(dt: number): Station | null {
    if (this.status !== 'playing') return null;
    const before = this.distance;
    this.speed = Math.min(speedCapAt(this.distance), this.speed + RUN.acceleration * dt);
    this.distance = Math.min(FINISH, this.distance + this.speed * dt);
    this.time += dt;
    const reached = STATIONS.find((s) => s.at > before && s.at <= this.distance) ?? null;
    if (reached) {
      this.stationsReached++;
      if (this.distance >= FINISH) this.finish('arrived');
    }
    return reached;
  }

  collect(souls: number): void {
    if (this.status === 'playing') this.souls += souls;
  }

  crash(cause: CrashCause): void {
    if (this.status !== 'playing') return;
    this.cause = cause;
    this.finish('crashed');
  }

  private finish(status: RunStatus): void {
    this.status = status;
    if (this.score <= this.best) return;
    this.best = this.score;
    try {
      localStorage.setItem(BEST_KEY, String(this.best));
    } catch {
      // Storage can be blocked (private mode); the best score just isn't kept.
    }
  }
}

/** Formats metres as "850 m" or "1.84 km". */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`;
}

/** Formats seconds as m:ss. */
export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${(whole % 60).toString().padStart(2, '0')}`;
}

/** Formats a score with thousands separators: 12,480. */
export function formatScore(score: number): string {
  return Math.round(score).toLocaleString('en-GB');
}
