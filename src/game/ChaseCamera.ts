import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { CAMERA, TRAIN } from './config';

/** Largest shake offset (metres) at full trauma. */
const MAX_SHAKE = 0.32;
/** Trauma lost per second. */
const SHAKE_RECOVERY = 1.8;

/**
 * Camera behind and above the runner, looking down the line. It eases after
 * lane changes and jumps but is locked to the runner along the track, so
 * speed never stretches the gap. The view widens as the pace picks up, and it
 * shakes on hits (unless the player asked the system for reduced motion).
 */
export class ChaseCamera {
  readonly camera: PerspectiveCamera;
  private readonly focus = new Vector3();
  private readonly look = new Vector3();
  private initialised = false;
  /** 0..1; shake strength grows with its square, so small bumps stay subtle. */
  private trauma = 0;
  private time = 0;
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(CAMERA.fov, aspect, CAMERA.near, CAMERA.far);
  }

  /** Jump straight to the runner on the next update (after a restart). */
  snap(): void {
    this.initialised = false;
    this.trauma = 0;
  }

  /** Adds screen shake (0..1); ignored when the system asks for reduced motion. */
  shake(amount: number): void {
    if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + amount);
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

    // Shake: layered sines make a cheap, smooth wobble; the camera and its target move together.
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - SHAKE_RECOVERY * dt);
    const s = this.trauma * this.trauma * MAX_SHAKE;
    const t = this.time;
    const sx = s * (Math.sin(t * 37) + Math.sin(t * 23.7) * 0.5);
    const sy = s * (Math.sin(t * 41.3) * 0.7 + Math.sin(t * 19.1) * 0.4);

    this.camera.position.set(this.focus.x + sx, this.focus.y + CAMERA.up + sy, this.focus.z + CAMERA.back);
    this.look.set(this.focus.x * 0.9 + sx * 0.5, this.focus.y + CAMERA.lookHeight + sy * 0.5, this.focus.z - CAMERA.lookAhead);
    this.camera.lookAt(this.look);

    const fov = MathUtils.lerp(CAMERA.fov, CAMERA.maxFov, MathUtils.clamp(pace, 0, 1));
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
