import { Group, type Mesh, type Vector3 } from 'three';
import { LANES, LIVES, OBSTACLE, RUN, TRAIN } from '../game/config';
import type { RunInput } from '../game/Input';
import { type Course, laneX, nearestLane } from '../world/course';
import { Lantern } from './Lantern';
import { createPlayerModel } from './playerModel';
import { RunnerPose } from './runnerPose';

const ROOF = TRAIN.roofHeight;
const MIDDLE_LANE = Math.floor(LANES.count / 2);
const BLINKS_PER_SECOND = 10;

/** What happened during one step, for sound and HUD feedback. */
export interface RunnerEvents {
  jumped: boolean;
  landed: boolean;
  slid: boolean;
  switched: boolean;
  /** Dropped too far below the roofs: off the train and onto the tracks. */
  fell: boolean;
}

/** The runner's body for contact tests: world x, and feet/head heights above the roof. */
export interface Body {
  x: number;
  feet: number;
  head: number;
}

/**
 * The hooded lantern bearer running along the train roofs: lanes, jumping,
 * sliding, landing and falling, plus the blink after losing a life and the
 * fall when the run ends. Contacts with obstacles and ghosts live in game/contacts.
 */
export class Runner {
  readonly root = new Group();
  readonly lantern = new Lantern();
  lane = MIDDLE_LANE;
  /** Seconds of blinking safety left after losing a life. */
  invulnerable = 0;
  private vy = 0;
  private grounded = true;
  /** Airborne because of a jump (not just stepping across an empty lane). */
  private jumping = false;
  /** Whether there is a roof under the runner right now (for the blob shadow). */
  private overRoof = true;
  private slideLeft = 0;
  private slideQueued = false;
  /** The run is over: lie where you fell (or keep dropping onto the rails). */
  private knockedOut = false;
  private falling = false;
  private readonly pose: RunnerPose;
  private readonly meshes: Mesh[];

  constructor() {
    const model = createPlayerModel();
    this.pose = new RunnerPose(model.body, this.lantern, model.shadow);
    this.meshes = model.meshes;
    model.hand.add(this.lantern.group);
    this.root.add(model.body, model.shadow);
    this.reset();
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get sliding(): boolean {
    return this.slideLeft > 0;
  }

  /** Feet and head heights above the roof, for contacts. */
  get body(): Body {
    const feet = this.root.position.y - ROOF;
    return { x: this.root.position.x, feet, head: feet + (this.sliding ? RUN.slideHeight : RUN.height) };
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
    this.invulnerable = 0;
    this.knockedOut = false;
    this.falling = false;
    this.pose.reset();
    this.setVisible(true);
  }

  /** One step of running, `distance` metres along the route at `speed`. */
  run(dt: number, elapsed: number, input: RunInput, distance: number, speed: number, course: Course): RunnerEvents {
    const ev: RunnerEvents = { jumped: false, landed: false, slid: false, switched: false, fell: false };
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
    ev.fell = p.y < ROOF - RUN.fallLimit;

    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.setVisible(this.invulnerable === 0 || Math.floor(this.invulnerable * BLINKS_PER_SECOND) % 2 === 0);
    }
    this.animate(dt, elapsed, speed);
    return ev;
  }

  /** After losing a life: blink for a while, and if you fell, get lifted back onto the nearest roof. */
  recover(fell: boolean, course: Course, distance: number): void {
    this.invulnerable = LIVES.invulnerability;
    if (!fell) return;
    const candidates = [this.lane, this.lane - 1, this.lane + 1, this.lane - 2, this.lane + 2].filter((l) => l >= 0 && l < LANES.count);
    this.lane =
      candidates.find((l) => course.hasRoof(l, distance)) ?? candidates.find((l) => course.hasRoof(l, distance + 3)) ?? this.lane;
    this.root.position.set(laneX(this.lane), ROOF, -distance);
    this.vy = 0;
    this.grounded = true;
    this.jumping = false;
    this.slideLeft = 0;
  }

  /** The run is over: pitch forward, or keep dropping onto the rails if you fell. */
  knockOut(fell: boolean): void {
    this.knockedOut = true;
    this.falling = fell;
    this.invulnerable = 0;
    this.setVisible(true);
  }

  /** A step while not running (title screen, after the run ends): idle, or play out the fall. */
  idle(dt: number, elapsed: number): void {
    if (this.falling) {
      this.vy -= RUN.gravity * dt;
      this.root.position.y = Math.max(0.1, this.root.position.y + this.vy * dt);
    }
    this.animate(dt, elapsed, 0);
  }

  /** Hides only the figure (the lantern's light stays on, so the scene's light count never changes). */
  private setVisible(visible: boolean): void {
    for (const mesh of this.meshes) mesh.visible = visible;
  }

  private animate(dt: number, elapsed: number, speed: number): void {
    const p = this.root.position;
    this.pose.update(dt, elapsed, {
      speed,
      grounded: this.grounded,
      sliding: this.sliding,
      knockedOut: this.knockedOut,
      vy: this.vy,
      laneOffset: p.x - laneX(this.lane),
      y: p.y,
      overRoof: this.overRoof,
    });
  }
}
