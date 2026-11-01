import type { Vector3 } from 'three';
import type { Sound } from '../audio/Sound';
import type { RunnerEvents } from '../entities/Runner';
import type { Hud } from '../ui/Hud';
import type { Course } from '../world/course';
import { type Ghost, ghostX, swoopsStarting } from '../world/hazards';
import { laneX } from '../world/lanes';
import type { Particles } from '../world/Particles';
import type { ChaseCamera } from './ChaseCamera';
import { GHOST, ROUTE, SOUL, TRAIN } from './config';
import * as fx from './effects';
import type { CrashCause, GameState } from './GameState';
import { FINISH, type Station } from './route';

const HURT_TOASTS: Record<CrashCause, string> = {
  fell: 'Off the train!',
  hurdle: 'Tripped!',
  bar: 'Ouch!',
  ghost: 'A ghost got you!',
};

/** A short buzz on phones that support it (touch screens only). */
const canBuzz = window.matchMedia?.('(pointer: coarse)').matches === true && 'vibrate' in navigator;
function buzz(pattern: number | number[]): void {
  if (canBuzz) navigator.vibrate(pattern);
}

/**
 * Turns what happened in a step of the run into sound, HUD, particles and
 * camera shake: the clickety-clack of the couplings, soul chimes and sparkles,
 * ghost wails, hits, the flare, station chimes, and "in sight" / "new best" toasts.
 */
export class RunFeedback {
  private lastJoint = 0;
  private lastDistance = 0;
  private lastSoulTime = -Infinity;
  private streak = 0;
  /** Milestones already announced this run. */
  private readonly announced = new Set<string>();

  constructor(
    private readonly sound: Sound,
    private readonly hud: Hud,
    private readonly particles: Particles,
    private readonly camera: ChaseCamera,
  ) {}

  reset(): void {
    this.lastJoint = 0;
    this.lastDistance = 0;
    this.lastSoulTime = -Infinity;
    this.streak = 0;
    this.announced.clear();
    this.hud.clearToast();
    this.particles.clear();
  }

  /** One step of a run still in progress; `at` is the runner's position. */
  step(events: RunnerEvents, souls: number, station: Station | null, state: GameState, course: Course, at: Vector3): void {
    for (const ghost of swoopsStarting(course, this.lastDistance, state.distance)) {
      this.sound.wail(Math.max(-1, Math.min(1, (laneX(ghost.toLane) - at.x) / 4)));
    }
    this.lastDistance = state.distance;

    if (events.jumped) this.sound.jump();
    if (events.landed) {
      this.sound.land();
      fx.landingDust(this.particles, at);
    }
    if (events.slid) this.sound.slide();
    if (events.switched) this.sound.lane();

    // A clack at every carriage coupling passed.
    const joint = Math.floor(state.distance / TRAIN.blockLength);
    if (joint !== this.lastJoint) {
      this.lastJoint = joint;
      this.sound.clack(state.pace);
    }

    for (let i = 0; i < souls; i++) {
      this.streak = state.time - this.lastSoulTime < SOUL.streakWindow ? this.streak + 1 : 0;
      this.lastSoulTime = state.time;
      this.sound.soul(this.streak);
    }
    if (souls > 0) {
      this.hud.pulseSouls();
      fx.soulSparkle(this.particles, at, souls);
    }
    if (state.flaring) fx.lanternEmbers(this.particles, at);

    if (station) {
      this.sound.station();
      this.hud.toast(`${station.name}! +${ROUTE.stationBonus}`);
      fx.stationShower(this.particles, at);
    }
    this.announce(state);
  }

  /** The last life is gone. */
  crashed(cause: CrashCause, at: Vector3): void {
    this.sound.crash(cause);
    this.hud.flashCrash();
    fx.hitSparks(this.particles, at, true);
    this.camera.shake(0.7);
    buzz([60, 40, 140]);
  }

  /** A life lost but the run goes on. */
  hurt(cause: CrashCause, livesLeft: number, at: Vector3): void {
    this.sound.hurt();
    this.hud.flashCrash();
    this.hud.toast(`${HURT_TOASTS[cause]} ${livesLeft === 1 ? 'Last life!' : `${livesLeft} lives left`}`);
    if (cause === 'ghost') fx.ghostWisps(this.particles, at.x, at.y + 1, at.z - 0.5);
    else fx.hitSparks(this.particles, at, false);
    this.camera.shake(0.45);
    buzz(90);
  }

  /** A lantern collected: the flare lights. */
  flare(at: Vector3): void {
    this.sound.flare();
    this.hud.toast('Lantern flare!');
    fx.flareBurst(this.particles, at);
    this.camera.shake(0.18);
    buzz(30);
  }

  /** The flare banished these ghosts, `distance` along the line. */
  banished(ghosts: readonly Ghost[], distance: number): void {
    if (ghosts.length > 0) this.sound.banish();
    for (const g of ghosts) fx.ghostWisps(this.particles, ghostX(g, distance), TRAIN.roofHeight + GHOST.hover + 1, -g.at);
  }

  arrived(at: Vector3): void {
    this.sound.arrive();
    fx.stationShower(this.particles, at);
  }

  private announce(state: GameState): void {
    const next = state.nextStation;
    const once = (id: string, reached: boolean, text: string): void => {
      if (!reached || this.announced.has(id)) return;
      this.announced.add(id);
      this.hud.toast(text);
    };
    const last = next.at >= FINISH;
    once(`sight:${next.name}`, state.toNext <= 250 && state.toNext > 30, `${next.name} ${last ? '— the end of the line!' : 'in sight!'}`);
    once('best', state.isNewBest, 'New best score!');
  }
}
