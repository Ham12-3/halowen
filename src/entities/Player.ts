import { Group, type Mesh, Vector3 } from 'three';
import { PLAYER } from '../game/config';
import type { World } from '../world/World';
import { Lantern } from './Lantern';
import { createPlayerModel } from './playerModel';

const WALK_CYCLE_SPEED = 9;
const BLINKS_PER_SECOND = 12;

/** The lantern bearer. Faces the camera yaw (A/D and the mouse turn it); W/S walk along it. */
export class Player {
  readonly root = new Group();
  readonly velocity = new Vector3();
  readonly radius = PLAYER.radius;
  readonly lantern = new Lantern();

  private readonly body: Group;
  private readonly meshes: Mesh[];
  private walkPhase = 0;
  private invulnerable = 0;
  private readonly wish = new Vector3();

  constructor() {
    const model = createPlayerModel();
    this.body = model.body;
    this.meshes = model.meshes;
    model.hand.add(this.lantern.group);
    this.root.add(this.body, model.shadow);
  }

  get position(): Vector3 {
    return this.root.position;
  }

  /** False during the grace period after being touched. */
  get canBeHurt(): boolean {
    return this.invulnerable <= 0;
  }

  respawn(x: number, z: number): void {
    this.position.set(x, 0, z);
    this.velocity.set(0, 0, 0);
    this.invulnerable = 0;
    this.setVisible(true);
  }

  /** Shoves the player away from (fromX, fromZ) and starts the invulnerability blink. */
  hurt(fromX: number, fromZ: number): void {
    const dx = this.position.x - fromX;
    const dz = this.position.z - fromZ;
    const len = Math.hypot(dx, dz) || 1;
    this.velocity.set((dx / len) * PLAYER.knockback, 0, (dz / len) * PLAYER.knockback);
    this.invulnerable = PLAYER.hitInvulnerability;
  }

  /** `forward` is 1 to walk ahead, -1 to step back, 0 to stand still. */
  update(dt: number, elapsed: number, forward: number, yaw: number, world: World): void {
    if (this.invulnerable > 0) {
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.setVisible(this.invulnerable === 0 || Math.floor(this.invulnerable * BLINKS_PER_SECOND) % 2 === 0);
    }
    this.root.rotation.y = yaw;

    // Forward is -Z rotated by yaw. There is no strafing: A/D turn instead.
    this.wish.set(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(forward * PLAYER.walkSpeed);

    const blend = 1 - Math.exp(-PLAYER.acceleration * dt);
    this.velocity.lerp(this.wish, blend);
    this.position.addScaledVector(this.velocity, dt);
    world.collide(this.position, this.radius);

    this.animate(dt, elapsed);
  }

  /** Hides only the figure; the lantern stays lit so the scene's light count never changes. */
  private setVisible(visible: boolean): void {
    for (const mesh of this.meshes) mesh.visible = visible;
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
