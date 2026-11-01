import { ROUND } from './config';

/** `ready` = title screen before the round starts; the last three end the round. */
export type RoundStatus = 'ready' | 'playing' | 'won' | 'timeUp' | 'dead';

/** Score, lives, countdown and outcome for one round. */
export class GameState {
  readonly target: number = ROUND.candles;
  readonly maxLives: number = ROUND.lives;
  score = 0;
  lives: number = ROUND.lives;
  timeLeft: number = ROUND.timeLimit;
  status: RoundStatus = 'ready';

  reset(): void {
    this.score = 0;
    this.lives = ROUND.lives;
    this.timeLeft = ROUND.timeLimit;
    this.status = 'ready';
  }

  begin(): void {
    if (this.status === 'ready') this.status = 'playing';
  }

  get isOver(): boolean {
    return this.status === 'won' || this.status === 'timeUp' || this.status === 'dead';
  }

  get isWarning(): boolean {
    return this.status === 'playing' && this.timeLeft <= ROUND.warningTime;
  }

  tick(dt: number): void {
    if (this.status !== 'playing') return;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.status = 'timeUp';
  }

  collect(): void {
    if (this.status !== 'playing') return;
    this.score = Math.min(this.score + 1, this.target);
    if (this.score === this.target) this.status = 'won';
  }

  loseLife(): void {
    if (this.status !== 'playing') return;
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) this.status = 'dead';
  }
}

/** Formats seconds as m:ss, rounding up so the clock never shows 0:00 early. */
export function formatTime(seconds: number): string {
  const whole = Math.ceil(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
