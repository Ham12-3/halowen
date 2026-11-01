import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { getGlowTexture } from './props/glowTexture';

const MAX_PARTICLES = 800;
/** Velocity kept per second (air drag), so bursts slow down and hang. */
const DRAG = 0.25;

export interface BurstOptions {
  x: number;
  y: number;
  z: number;
  count: number;
  color: number;
  /** Launch speed (m/s), randomised per particle. */
  speed: number;
  /** Extra upward speed; negative for downward. */
  lift?: number;
  /** Positive pulls down, negative makes sparks float up. */
  gravity?: number;
  /** Seconds each particle lives (randomised ±40%). */
  life: number;
  /** How far apart they start (metres). */
  spread?: number;
  /** Squash the burst flat along the ground (dust), 0..1 of the vertical speed kept. */
  flatten?: number;
}

/**
 * One shared spark system for every effect in the game: soul sparkles, dust,
 * hit sparks, ghost wisps, the flare's burst and embers. A single additive
 * Points cloud (one draw call); a dead particle is simply black, which adds
 * nothing. New bursts recycle the oldest particles.
 */
export class Particles {
  readonly points: Points;
  private readonly position: Float32BufferAttribute;
  private readonly color: Float32BufferAttribute;
  private readonly velocity = new Float32Array(MAX_PARTICLES * 3);
  private readonly base = new Float32Array(MAX_PARTICLES * 3);
  private readonly gravity = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly maxLife = new Float32Array(MAX_PARTICLES);
  private next = 0;
  private alive = 0;
  private readonly tint = new Color();

  constructor() {
    const geometry = new BufferGeometry();
    this.position = new Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    this.color = new Float32BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3);
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('color', this.color);
    this.points = new Points(
      geometry,
      new PointsMaterial({
        size: 0.32,
        map: getGlowTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
  }

  burst(o: BurstOptions): void {
    this.tint.set(o.color);
    const spread = o.spread ?? 0.2;
    for (let n = 0; n < o.count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX_PARTICLES;
      // A random direction on the sphere, scaled by a random fraction of the speed.
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = o.speed * (0.4 + Math.random() * 0.6);
      this.velocity.set([r * Math.cos(a) * s, u * s * (o.flatten ?? 1) + (o.lift ?? 0), r * Math.sin(a) * s], i * 3);
      this.position.setXYZ(i, o.x + (Math.random() - 0.5) * spread, o.y + (Math.random() - 0.5) * spread, o.z + (Math.random() - 0.5) * spread);
      this.base.set([this.tint.r, this.tint.g, this.tint.b], i * 3);
      this.gravity[i] = o.gravity ?? 0;
      this.life[i] = this.maxLife[i] = o.life * (0.6 + Math.random() * 0.8);
    }
    this.alive = Math.min(MAX_PARTICLES, this.alive + o.count);
  }

  update(dt: number): void {
    if (this.alive === 0) return;
    const drag = Math.pow(DRAG, dt);
    let alive = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const left = this.life[i] ?? 0;
      if (left <= 0) continue;
      const remaining = left - dt;
      this.life[i] = remaining;
      const k = i * 3;
      const v = this.velocity;
      v[k + 1] = (v[k + 1] ?? 0) - (this.gravity[i] ?? 0) * dt;
      for (let c = 0; c < 3; c++) v[k + c] = (v[k + c] ?? 0) * drag;
      this.position.setXYZ(i, this.position.getX(i) + (v[k] ?? 0) * dt, this.position.getY(i) + (v[k + 1] ?? 0) * dt, this.position.getZ(i) + (v[k + 2] ?? 0) * dt);
      // Fade out over the particle's life; dead ones go black (invisible when added).
      const fade = remaining > 0 ? (remaining / (this.maxLife[i] ?? 1)) ** 1.4 : 0;
      this.color.setXYZ(i, (this.base[k] ?? 0) * fade, (this.base[k + 1] ?? 0) * fade, (this.base[k + 2] ?? 0) * fade);
      if (remaining > 0) alive++;
    }
    this.alive = alive;
    this.position.needsUpdate = true;
    this.color.needsUpdate = true;
  }

  /** Clears every spark (on restart). */
  clear(): void {
    this.life.fill(0);
    this.color.array.fill(0);
    this.color.needsUpdate = true;
    this.alive = 0;
  }
}
