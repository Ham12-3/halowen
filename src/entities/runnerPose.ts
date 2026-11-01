import { type Group, MathUtils, type Mesh } from 'three';
import { OBSTACLE, TRAIN } from '../game/config';
import type { Lantern } from './Lantern';

const ROOF = TRAIN.roofHeight;

/** What the pose needs to know about the runner this step. */
export interface PoseState {
  speed: number;
  grounded: boolean;
  sliding: boolean;
  knockedOut: boolean;
  vy: number;
  /** World x minus the target lane's x (leans into lane changes). */
  laneOffset: number;
  y: number;
  overRoof: boolean;
}

/**
 * Animates the runner's figure: leaning forward to run, tipping back to slide,
 * pitching forward when the run ends, the stride bob, the lantern's swing, and
 * the blob shadow staying on whatever is underneath.
 */
export class RunnerPose {
  private runPhase = 0;

  constructor(
    private readonly figure: Group,
    private readonly lantern: Lantern,
    private readonly shadow: Mesh,
  ) {}

  reset(): void {
    this.figure.position.set(0, 0, 0);
    this.figure.rotation.set(0, 0, 0);
  }

  update(dt: number, elapsed: number, s: PoseState): void {
    const b = this.figure;
    const ease = 1 - Math.exp(-14 * dt);
    let lean = -0.22 * Math.min(1, s.speed / 10);
    if (s.knockedOut) lean = -1.4;
    else if (s.sliding) lean = 1.15;
    else if (!s.grounded) lean = -0.1 + MathUtils.clamp(s.vy * 0.02, -0.25, 0.25);
    b.rotation.x += (lean - b.rotation.x) * ease;
    b.rotation.z = MathUtils.clamp(s.laneOffset * 0.12, -0.3, 0.3);

    this.runPhase += dt * s.speed * 0.9;
    const striding = s.grounded && !s.sliding && !s.knockedOut && s.speed > 0;
    b.position.y = striding ? Math.abs(Math.sin(this.runPhase)) * 0.12 : 0;

    const idle = Math.sin(elapsed * 1.7) * 0.05;
    this.lantern.group.rotation.x = (striding ? Math.sin(this.runPhase * 2) * 0.3 : 0) + idle;
    this.lantern.group.rotation.z = (striding ? Math.sin(this.runPhase) * 0.15 : 0) + idle * 0.6;
    this.lantern.update(elapsed);

    // The blob shadow stays on whatever is underneath: a roof, or the rails of an empty lane.
    const ground = s.overRoof && s.y > ROOF - OBSTACLE.stepUp ? ROOF : 0;
    const height = Math.max(0, s.y - ground);
    this.shadow.position.y = ground - s.y + 0.02;
    this.shadow.scale.setScalar(MathUtils.clamp(1 - height * 0.25, 0.35, 1));
  }
}
