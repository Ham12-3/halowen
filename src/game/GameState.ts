import { FLARE, GHOST, LIVES, ROUTE, RUN, SOUL } from './config';
import { FINISH, type Station, STATIONS, speedCapAt, stageAt, TOP_SPEED } from './route';

/** `ready` = title screen; `crashed` and `arrived` (at the last station) end the run. */
export type RunStatus = 'ready' | 'playing' | 'crashed' | 'arrived';

/** What cost a life (and, for the last life, ended the run). */
export type CrashCause = 'fell' | 'hurdle' | 'bar' | 'ghost';

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
  lives: number = LIVES.count;
  /** Seconds left on the lantern flare (0 when it isn't burning). */
  flareLeft = 0;
  /** Ghosts banished by the flare. */
  banished = 0;
  /** What cost the last life (or ended the run). */
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
    this.lives = LIVES.count;
    this.flareLeft = 0;
    this.banished = 0;
    this.cause = null;
    this.previousBest = this.best;
  }

  get flaring(): boolean {
    return this.flareLeft > 0;
  }

  begin(): void {
    if (this.status === 'ready') this.status = 'playing';
  }

  get isOver(): boolean {
    return this.status === 'crashed' || this.status === 'arrived';
  }

  /** A metre run is a point, plus souls, station bonuses and ghosts banished. */
  get score(): number {
    return (
      Math.floor(this.distance) +
      this.souls * SOUL.value +
      this.stationsReached * ROUTE.stationBonus +
      this.banished * GHOST.banishValue
    );
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
    this.flareLeft = Math.max(0, this.flareLeft - dt);
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

  startFlare(): void {
    if (this.status === 'playing') this.flareLeft = FLARE.duration;
  }

  banish(ghosts: number): void {
    if (this.status === 'playing') this.banished += ghosts;
  }

  /** Costs a life and slows you down; the last life ends the run. Returns true if the run is over. */
  loseLife(cause: CrashCause): boolean {
    if (this.status !== 'playing') return false;
    this.cause = cause;
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives > 0) {
      this.speed = Math.max(RUN.startSpeed, this.speed * LIVES.stumbleSpeed);
      return false;
    }
    this.finish('crashed');
    return true;
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
