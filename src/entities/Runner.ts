import { Group, MathUtils, type Mesh, type Vector3 } from 'three';
import { LANES, OBSTACLE, RUN, TRAIN } from '../game/config';
import type { CrashCause } from '../game/GameState';
import type { RunInput } from '../game/Input';
import { type Course, laneX, nearestLane } from '../world/course';
import { Lantern } from './Lantern';
import { createPlayerModel } from './playerModel';

const ROOF = TRAIN.roofHeight;
const MIDDLE_LANE = Math.floor(LANES.count / 2);

/** What happened during one step, for sound and HUD feedback. */
export interface RunnerEvents {
  jumped: boolean;
  landed: boolean;
  slid: boolean;
  switched: boolean;
  crashed: CrashCause | null;
}

/**
 * The hooded lantern bearer running along the train roofs. Handles lanes,
 * jumping, sliding, landing and falling; the course says where the roofs and
 * obstacles are. Faces -Z, the way the line runs.
 */
export class Runner {
  readonly root = new Group();
  readonly lantern = new Lantern();
  lane = MIDDLE_LANE;
  private vy = 0;
  private grounded = true;
  /** Airborne because of a jump (not just stepping across an empty lane). */
  private jumping = false;
  /** Whether there is a roof under the runner right now (for the blob shadow). */
  private overRoof = true;
  private slideLeft = 0;
  private slideQueued = false;
  private crash: CrashCause | null = null;
  private runPhase = 0;
  private readonly body: Group;
  private readonly shadow: Mesh;

  constructor() {
    const model = createPlayerModel();
    this.body = model.body;
    this.shadow = model.shadow;
    model.hand.add(this.lantern.group);
    this.root.add(this.body, this.shadow);
    this.reset();
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get sliding(): boolean {
    return this.slideLeft > 0;
  }

  reset(): void {
    this.lane = MIDDLE_LANE;
    this.root.position.set(laneX(this.lane), ROOF, 0);
    this.vy = 0;
    this.grounded = true;
    this.jumping = false;
    this.overRoof = true;
    this.slideLeft = 0;
    this.slideQueued = false;
    this.crash = null;
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
  }

  /** One step of running, `distance` metres along the route at `speed`. */
  run(dt: number, elapsed: number, input: RunInput, distance: number, speed: number, course: Course): RunnerEvents {
    const ev: RunnerEvents = { jumped: false, landed: false, slid: false, switched: false, crashed: null };
    const p = this.root.position;
    p.z = -distance;

    const lane = this.lane;
    if (input.left && this.lane > 0) this.lane--;
    if (input.right && this.lane < LANES.count - 1) this.lane++;
    ev.switched = this.lane !== lane;
    if (input.jump && this.grounded) {
      this.vy = RUN.jumpVelocity;
      this.grounded = false;
      this.jumping = true;
      this.slideLeft = 0;
      ev.jumped = true;
    }
    if (input.slide) {
      if (this.grounded) {
        ev.slid = this.slideLeft <= 0;
        this.slideLeft = RUN.slideTime;
      } else {
        // Slam down out of a jump, then slide as soon as you land. Only after a real jump:
        // slamming while hopping across an empty lane would drop you onto the tracks.
        if (this.jumping) this.vy = Math.min(this.vy, -RUN.slamVelocity);
        this.slideQueued = true;
      }
    }
    p.x += (laneX(this.lane) - p.x) * (1 - Math.exp(-RUN.laneSharpness * dt));
    this.slideLeft = Math.max(0, this.slideLeft - dt);

    this.overRoof = course.hasRoof(nearestLane(p.x), distance);
    if (this.grounded && !this.overRoof) this.grounded = false;
    if (!this.grounded) {
      this.vy -= RUN.gravity * dt;
      p.y += this.vy * dt;
      // Land on a roof, forgiving a late jump by pulling you up a little.
      if (this.overRoof && this.vy <= 0 && p.y <= ROOF && p.y > ROOF - OBSTACLE.stepUp) {
        p.y = ROOF;
        this.vy = 0;
        this.grounded = true;
        ev.landed = this.jumping; // no thump for simply hopping across an empty lane
        this.jumping = false;
        if (this.slideQueued) {
          this.slideLeft = RUN.slideTime;
          ev.slid = true;
        }
        this.slideQueued = false;
      }
    }

    ev.crashed = p.y < ROOF - RUN.fallLimit ? 'fell' : this.hitObstacle(course, distance);
    this.crash = ev.crashed;
    this.animate(dt, elapsed, speed);
    return ev;
  }

  /** A step while not running (title screen, after a crash or arriving): idle, or play out the crash. */
  idle(dt: number, elapsed: number): void {
    if (this.crash === 'fell') {
      // Keep falling until you hit the rails.
      this.vy -= RUN.gravity * dt;
      this.root.position.y = Math.max(0.1, this.root.position.y + this.vy * dt);
    }
    this.animate(dt, elapsed, 0);
  }

  /** Hurdles must be jumped (feet above them); bars must be slid under (head below them). */
  private hitObstacle(course: Course, distance: number): CrashCause | null {
    const p = this.root.position;
    const feet = p.y - ROOF;
    const head = feet + (this.sliding ? RUN.slideHeight : RUN.height);
    for (const o of course.obstaclesNear(distance, 2)) {
      if (o.kind === 'gap') continue;
      const hurdle = o.kind === 'hurdle';
      const halfWidth = hurdle ? OBSTACLE.hurdleHalfWidth : OBSTACLE.barHalfWidth;
      const halfDepth = hurdle ? OBSTACLE.hurdleHalfDepth : OBSTACLE.barHalfDepth;
      if (Math.abs(p.x - laneX(o.lane)) > halfWidth + RUN.halfWidth) continue;
      if (Math.abs(distance - o.at) > halfDepth + OBSTACLE.runnerHalfDepth) continue;
      const hit = hurdle ? feet < OBSTACLE.hurdleHeight : head > OBSTACLE.barBottom && feet < OBSTACLE.barTop;
      if (hit) return o.kind === 'hurdle' ? 'hurdle' : 'bar';
    }
    return null;
  }

  private animate(dt: number, elapsed: number, speed: number): void {
    const b = this.body;
    const p = this.root.position;
    const ease = 1 - Math.exp(-14 * dt);
    // Lean forward to run, tip back to slide, pitch forward when thrown by a crash.
    let lean = -0.22 * Math.min(1, speed / 10);
    if (this.crash) lean = -1.4;
    else if (this.sliding) lean = 1.15;
    else if (!this.grounded) lean = -0.1 + MathUtils.clamp(this.vy * 0.02, -0.25, 0.25);
    b.rotation.x += (lean - b.rotation.x) * ease;
    b.rotation.z = MathUtils.clamp((p.x - laneX(this.lane)) * 0.12, -0.3, 0.3);

    this.runPhase += dt * speed * 0.9;
    const striding = this.grounded && !this.sliding && !this.crash && speed > 0;
    b.position.y = striding ? Math.abs(Math.sin(this.runPhase)) * 0.12 : 0;

    const idle = Math.sin(elapsed * 1.7) * 0.05;
    this.lantern.group.rotation.x = (striding ? Math.sin(this.runPhase * 2) * 0.3 : 0) + idle;
    this.lantern.group.rotation.z = (striding ? Math.sin(this.runPhase) * 0.15 : 0) + idle * 0.6;
    this.lantern.update(elapsed);

    // The blob shadow stays on whatever is underneath: a roof, or the rails of an empty lane.
    const ground = this.overRoof && p.y > ROOF - OBSTACLE.stepUp ? ROOF : 0;
    const height = Math.max(0, p.y - ground);
    this.shadow.position.y = ground - p.y + 0.02;
    this.shadow.scale.setScalar(MathUtils.clamp(1 - height * 0.25, 0.35, 1));
  }
}
