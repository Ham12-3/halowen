import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MathUtils,
  Object3D,
  PointLight,
  Points,
  type Vector3,
} from 'three';
import { CANDLE, PLAYER, ROUND, WORLD } from '../game/config';
import { SPAWN } from '../world/layout';
import { range, type Rng } from '../world/rng';
import type { World } from '../world/World';
import { createCandleBodyGeometry, createCandleMaterials, createFlameGeometry, SOUL_COLOR, WAX_HEIGHT } from './candleModel';

/** Seconds the rise-and-vanish animation takes after pickup. */
const COLLECT_DURATION = 0.6;
const LIGHT_POOL = 2;

interface Candle {
  x: number;
  z: number;
  phase: number;
  collected: boolean;
  sinceCollected: number;
}

/**
 * The soul candles for one round. Bodies and flames are instanced, the halos
 * are one Points cloud, and a small fixed pool of point lights follows the
 * candles nearest the player (a fixed count avoids shader recompiles).
 */
export class Candles {
  readonly group = new Group();
  private candles: Candle[] = [];
  private readonly bodies: InstancedMesh;
  private readonly flames: InstancedMesh;
  private readonly halos: Points;
  private readonly lights: PointLight[] = [];
  private readonly dummy = new Object3D();
  private readonly soul = new Color(SOUL_COLOR);

  constructor(private readonly world: World) {
    const materials = createCandleMaterials();
    this.bodies = new InstancedMesh(createCandleBodyGeometry(), materials.body, ROUND.candles);
    this.flames = new InstancedMesh(createFlameGeometry(), materials.flame, ROUND.candles);

    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(ROUND.candles * 3), 3));
    haloGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(ROUND.candles * 3), 3));
    this.halos = new Points(haloGeometry, materials.halo);

    // Candles move every round, so skip bounds-based culling (10 tiny objects).
    for (const obj of [this.bodies, this.flames, this.halos]) obj.frustumCulled = false;
    for (let i = 0; i < LIGHT_POOL; i++) {
      const light = new PointLight(SOUL_COLOR, 0, CANDLE.lightRange, 2);
      this.lights.push(light);
      this.group.add(light);
    }
    this.group.add(this.bodies, this.flames, this.halos);
  }

  get remaining(): number {
    return this.candles.filter((c) => !c.collected).length;
  }

  /** Scatters a fresh set of candles over open ground, spread well apart. */
  spawn(rng: Rng): void {
    const half = WORLD.halfSize;
    let spacing: number = CANDLE.minSpacing;
    const spots: Candle[] = [];
    for (let attempt = 1; spots.length < ROUND.candles; attempt++) {
      if (attempt % 400 === 0) spacing *= 0.85; // relax if the map is too crowded
      const x = range(rng, -half, half);
      const z = range(rng, -half, half);
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < CANDLE.minSpawnDistance) continue;
      if (!this.world.isOpen(x, z, 0.9)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < spacing)) continue;
      spots.push({ x, z, phase: rng() * Math.PI * 2, collected: false, sinceCollected: 0 });
    }
    this.candles = spots;
  }

  /**
   * Animates the candles, points the light pool at those nearest the player and,
   * if `canCollect`, gathers any within reach. Returns how many were gathered.
   */
  update(dt: number, elapsed: number, player: Vector3, canCollect: boolean): number {
    const reach = PLAYER.radius + CANDLE.pickupRadius;
    const haloPos = this.halos.geometry.attributes.position;
    const haloCol = this.halos.geometry.attributes.color;
    if (!haloPos || !haloCol) return 0;
    let collected = 0;

    this.candles.forEach((c, i) => {
      if (canCollect && !c.collected && Math.hypot(player.x - c.x, player.z - c.z) < reach) {
        c.collected = true;
        collected++;
      }
      if (c.collected) c.sinceCollected += dt;

      const t = MathUtils.clamp(c.sinceCollected / COLLECT_DURATION, 0, 1);
      const ease = t * t;
      const y = CANDLE.hoverHeight + Math.sin(elapsed * 2 + c.phase) * 0.08 + ease * 1.4;
      const scale = c.collected ? 1 - ease : 1;
      const flicker = 1 + Math.sin(elapsed * 17 + c.phase) * 0.12 + Math.sin(elapsed * 31 + c.phase * 2) * 0.06;

      this.place(this.bodies, i, c.x, y, c.z, elapsed * 0.8 + c.phase, scale);
      this.place(this.flames, i, c.x, y + (WAX_HEIGHT + 0.05) * scale, c.z, 0, scale * flicker);
      haloPos.setXYZ(i, c.x, y + (WAX_HEIGHT + 0.1) * scale, c.z);
      const glow = (c.collected ? (1 - t) * 1.6 : 0.8 + Math.sin(elapsed * 3 + c.phase) * 0.2) * flicker;
      haloCol.setXYZ(i, this.soul.r * glow, this.soul.g * glow, this.soul.b * glow);
    });

    this.bodies.count = this.flames.count = this.candles.length;
    this.halos.geometry.setDrawRange(0, this.candles.length);
    this.bodies.instanceMatrix.needsUpdate = true;
    this.flames.instanceMatrix.needsUpdate = true;
    haloPos.needsUpdate = true;
    haloCol.needsUpdate = true;
    this.assignLights(player, elapsed);
    return collected;
  }

  private place(mesh: InstancedMesh, i: number, x: number, y: number, z: number, rotY: number, scale: number): void {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotY, 0);
    this.dummy.scale.setScalar(Math.max(scale, 1e-4));
    this.dummy.updateMatrix();
    mesh.setMatrixAt(i, this.dummy.matrix);
  }

  /** Lends the light pool to the uncollected candles nearest the player, fading with distance. */
  private assignLights(player: Vector3, elapsed: number): void {
    const nearest = this.candles
      .filter((c) => !c.collected)
      .map((c) => ({ c, d: Math.hypot(player.x - c.x, player.z - c.z) }))
      .sort((a, b) => a.d - b.d);
    this.lights.forEach((light, i) => {
      const entry = nearest[i];
      if (!entry) {
        light.intensity = 0;
        return;
      }
      const fade = 1 - MathUtils.smoothstep(entry.d, 10, 22);
      light.position.set(entry.c.x, CANDLE.hoverHeight + 0.6, entry.c.z);
      light.intensity = CANDLE.lightIntensity * fade * (1 + Math.sin(elapsed * 13 + entry.c.phase) * 0.1);
    });
  }
}
