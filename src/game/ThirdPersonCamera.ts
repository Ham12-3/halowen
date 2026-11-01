import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { type Collider, overlapsAny } from '../world/collision';
import { CAMERA } from './config';

const OBSTRUCTION_STEPS = 12;
const CAMERA_RADIUS = 0.3;
const MIN_DISTANCE = 1.2;

/**
 * Over-the-shoulder camera locked behind the player.
 * Yaw 0 looks down -Z; turning right decreases yaw.
 */
export class ThirdPersonCamera {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  pitch: number = CAMERA.defaultPitch;

  private readonly focus = new Vector3();
  private readonly lookTarget = new Vector3();
  private distance: number = CAMERA.distance;
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
  }

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * CAMERA.mouseSensitivity;
    this.pitch = MathUtils.clamp(
      this.pitch + dy * CAMERA.mouseSensitivity,
      CAMERA.minPitch,
      CAMERA.maxPitch,
    );
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Writes the horizontal forward direction for the current yaw into `out`. */
  forward(out: Vector3): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  /** `blockers` are tall obstacles the camera must not pass through (e.g. the crypt). */
  update(dt: number, playerPosition: Vector3, blockers: readonly Collider[] = []): void {
    if (!this.initialised) {
      this.focus.copy(playerPosition);
      this.initialised = true;
    } else {
      // Smooth only the follow point; yaw/pitch apply instantly so mouse look stays crisp.
      this.focus.lerp(playerPosition, 1 - Math.exp(-CAMERA.followSharpness * dt));
    }

    this.lookTarget.set(this.focus.x, this.focus.y + CAMERA.targetHeight, this.focus.z);
    const wanted = this.unobstructedDistance(blockers);
    // Snap in front of obstacles instantly, but ease back out to avoid popping.
    this.distance = wanted < this.distance ? wanted : MathUtils.lerp(this.distance, wanted, 1 - Math.exp(-6 * dt));

    const horizontal = Math.cos(this.pitch) * this.distance;
    const cam = this.camera.position;
    cam.set(
      this.lookTarget.x + Math.sin(this.yaw) * horizontal,
      this.lookTarget.y + Math.sin(this.pitch) * this.distance,
      this.lookTarget.z + Math.cos(this.yaw) * horizontal,
    );
    cam.y = Math.max(cam.y, CAMERA.minHeight);
    this.camera.lookAt(this.lookTarget);
  }

  /** Marches from the look target towards the camera and stops before the first blocker. */
  private unobstructedDistance(blockers: readonly Collider[]): number {
    if (blockers.length === 0) return CAMERA.distance;
    const dirX = Math.sin(this.yaw) * Math.cos(this.pitch);
    const dirZ = Math.cos(this.yaw) * Math.cos(this.pitch);
    const step = CAMERA.distance / OBSTRUCTION_STEPS;
    for (let i = 1; i <= OBSTRUCTION_STEPS; i++) {
      const d = i * step;
      if (overlapsAny(this.lookTarget.x + dirX * d, this.lookTarget.z + dirZ * d, CAMERA_RADIUS, blockers)) {
        return Math.max(MIN_DISTANCE, d - step);
      }
    }
    return CAMERA.distance;
  }
}
