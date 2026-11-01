import { ROUTE, RUN } from './config';

/** `ready` = title screen; `crashed` and `arrived` end the run. */
export type RunStatus = 'ready' | 'playing' | 'crashed' | 'arrived';

/** What ended a run in a crash. */
export type CrashCause = 'fell' | 'hurdle' | 'bar';

const BEST_KEY = 'midnight-line-best';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Distance, speed, time and outcome for one run along the line. */
export class GameState {
  readonly target: number = ROUTE.length;
  status: RunStatus = 'ready';
  distance = 0;
  speed: number = RUN.startSpeed;
  time = 0;
  cause: CrashCause | null = null;
  /** Furthest distance ever reached (remembered between visits). */
  best = readBest();
  /** The best distance as it stood when this run began. */
  previousBest = this.best;

  reset(): void {
    this.status = 'ready';
    this.distance = 0;
    this.speed = RUN.startSpeed;
    this.time = 0;
    this.cause = null;
    this.previousBest = this.best;
  }

  /** This run went further than any before it (not counting the very first run). */
  get isNewBest(): boolean {
    return this.previousBest > 0 && this.distance > this.previousBest;
  }

  begin(): void {
    if (this.status === 'ready') this.status = 'playing';
  }

  get isOver(): boolean {
    return this.status === 'crashed' || this.status === 'arrived';
  }

  get remaining(): number {
    return Math.max(0, this.target - this.distance);
  }

  /** 0..1 along the route. */
  get progress(): number {
    return Math.min(1, this.distance / this.target);
  }

  /** 0 at the starting speed, 1 at top speed. */
  get pace(): number {
    return (this.speed - RUN.startSpeed) / (RUN.maxSpeed - RUN.startSpeed);
  }

  /** Runs the clock and moves the runner along; reaching the target ends the run. */
  advance(dt: number): void {
    if (this.status !== 'playing') return;
    this.speed = Math.min(RUN.maxSpeed, this.speed + RUN.acceleration * dt);
    this.distance = Math.min(this.target, this.distance + this.speed * dt);
    this.time += dt;
    if (this.distance >= this.target) this.finish('arrived');
  }

  crash(cause: CrashCause): void {
    if (this.status !== 'playing') return;
    this.cause = cause;
    this.finish('crashed');
  }

  private finish(status: RunStatus): void {
    this.status = status;
    if (this.distance <= this.best) return;
    this.best = this.distance;
    try {
      localStorage.setItem(BEST_KEY, String(Math.round(this.best)));
    } catch {
      // Storage can be blocked (private mode); the best distance just isn't kept.
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
