import { Group, Vector3 } from 'three';
import { PLAYER } from '../game/config';
import type { MoveAxis } from '../game/Input';
import type { World } from '../world/World';
import { Lantern } from './Lantern';
import { createPlayerModel } from './playerModel';

const WALK_CYCLE_SPEED = 9;

/** The lantern bearer. Faces the camera yaw; WASD moves relative to it. */
export class Player {
  readonly root = new Group();
  readonly velocity = new Vector3();
  readonly radius = PLAYER.radius;
  readonly lantern = new Lantern();

  private readonly body: Group;
  private walkPhase = 0;
  private readonly wish = new Vector3();

  constructor() {
    const model = createPlayerModel();
    this.body = model.body;
    model.hand.add(this.lantern.group);
    this.root.add(this.body);
  }

  get position(): Vector3 {
    return this.root.position;
  }

  update(dt: number, elapsed: number, move: MoveAxis, yaw: number, world: World): void {
    this.root.rotation.y = yaw;

    // Forward is -Z rotated by yaw; right is +X rotated by yaw.
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    this.wish.set(-sin * move.y + cos * move.x, 0, -cos * move.y - sin * move.x);
    if (this.wish.lengthSq() > 1) this.wish.normalize();
    this.wish.multiplyScalar(PLAYER.walkSpeed);

    const blend = 1 - Math.exp(-PLAYER.acceleration * dt);
    this.velocity.lerp(this.wish, blend);
    this.position.addScaledVector(this.velocity, dt);
    world.collide(this.position, this.radius);

    this.animate(dt, elapsed);
  }

  private animate(dt: number, elapsed: number): void {
    const speed01 = Math.min(this.velocity.length() / PLAYER.walkSpeed, 1);
    this.walkPhase += dt * WALK_CYCLE_SPEED * speed01;
    const step = Math.sin(this.walkPhase);

    this.body.position.y = Math.abs(step) * 0.06 * speed01;
    this.body.rotation.z = step * 0.035 * speed01;

    // The lantern swings with each step and idles with a gentle sway.
    const idle = Math.sin(elapsed * 1.7) * 0.05;
    this.lantern.group.rotation.x = Math.sin(this.walkPhase * 2) * 0.18 * speed01 + idle;
    this.lantern.group.rotation.z = step * 0.12 * speed01 + idle * 0.6;
    this.lantern.update(elapsed);
  }
}
