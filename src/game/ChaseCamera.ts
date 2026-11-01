import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA, TRAIN } from './config';

/**
 * Camera behind and above the runner, looking down the line. It eases after
 * lane changes and jumps but is locked to the runner along the track, so
 * speed never stretches the gap. The view widens as the pace picks up.
 */
export class ChaseCamera {
  readonly camera: PerspectiveCamera;
  private readonly focus = new Vector3();
  private readonly look = new Vector3();
  private initialised = false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
  }

  /** Jump straight to the runner on the next update (after a restart). */
  snap(): void {
    this.initialised = false;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** `pace` is 0 at the starting speed and 1 at top speed. */
  update(dt: number, runner: Vector3, pace: number): void {
    // Follow a jump only partly, so the horizon doesn't bounce with every hop.
    const wantY = TRAIN.roofHeight + (runner.y - TRAIN.roofHeight) * 0.45;
    const wantX = runner.x * 0.8;
    if (!this.initialised) {
      this.focus.set(wantX, wantY, runner.z);
      this.initialised = true;
    }
    const ease = 1 - Math.exp(-CAMERA.followSharpness * dt);
    this.focus.x += (wantX - this.focus.x) * ease;
    this.focus.y += (wantY - this.focus.y) * ease;
    this.focus.z = runner.z;

    this.camera.position.set(this.focus.x, this.focus.y + CAMERA.up, this.focus.z + CAMERA.back);
    this.look.set(this.focus.x * 0.9, this.focus.y + CAMERA.lookHeight, this.focus.z - CAMERA.lookAhead);
    this.camera.lookAt(this.look);

    const fov = MathUtils.lerp(CAMERA.fov, CAMERA.maxFov, MathUtils.clamp(pace, 0, 1));
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
