import { Color, Group, InstancedMesh, MathUtils, Object3D, type Vector3 } from 'three';
import { GHOST, PLAYER } from '../game/config';
import { SPAWN } from '../world/layout';
import { range, type Rng } from '../world/rng';
import { createGhost, type Ghost, GHOST_BOUNDS, separate, startRetreat, think } from './ghostBrain';
import { createGhostBodyGeometry, createGhostFaceGeometry, createGhostMaterials } from './ghostModel';

const APPEAR_SECONDS = 1.2;
const TURN_RATE = 6;

const FACE_CALM = new Color(0x0b0b16);
const FACE_HUNTING = new Color(0xff3a22);
const FACE_SCARED = new Color(0x26406e);

/**
 * All ghosts for the round, drawn as two InstancedMeshes (translucent sheets
 * and their faces). The faces glow red while a ghost is hunting the player.
 */
export class Ghosts {
  readonly group = new Group();
  /** Ghosts that started hunting the player during the last update. */
  readonly spotted: Ghost[] = [];
  private ghosts: Ghost[] = [];
  private readonly bodies: InstancedMesh;
  private readonly faces: InstancedMesh;
  private readonly dummy = new Object3D();

  constructor(private readonly rng: Rng = Math.random) {
    const materials = createGhostMaterials();
    this.bodies = new InstancedMesh(createGhostBodyGeometry(), materials.body, GHOST.count);
    this.faces = new InstancedMesh(createGhostFaceGeometry(), materials.face, GHOST.count);
    for (const mesh of [this.bodies, this.faces]) {
      mesh.frustumCulled = false; // they roam the whole map; 6 instances is cheap to always draw
      mesh.castShadow = false;
      this.group.add(mesh);
    }
  }

  get list(): readonly Ghost[] {
    return this.ghosts;
  }

  /** Places a fresh pack of ghosts away from the player spawn and from each other. */
  spawn(): void {
    const spots: Ghost[] = [];
    let spacing = 9;
    for (let attempt = 1; spots.length < GHOST.count; attempt++) {
      if (attempt % 300 === 0) spacing *= 0.85;
      const x = range(this.rng, -GHOST_BOUNDS, GHOST_BOUNDS);
      const z = range(this.rng, -GHOST_BOUNDS, GHOST_BOUNDS);
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < GHOST.minSpawnDistance) continue;
      if (spots.some((g) => Math.hypot(g.x - x, g.z - z) < spacing)) continue;
      spots.push(createGhost(x, z, this.rng));
    }
    this.ghosts = spots;
  }

  /** Sends a ghost fleeing (after it touches the player). */
  scare(ghost: Ghost): void {
    startRetreat(ghost);
  }

  /**
   * Shoves every ghost within `radius` of `from` outwards (`push` at the centre,
   * half that at the edge) and sends it fleeing for `seconds`. Returns the count.
   */
  repel(from: Vector3, radius: number, push: number, seconds: number): number {
    let hit = 0;
    for (const g of this.ghosts) {
      const dx = g.x - from.x;
      const dz = g.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const strength = push * (1 - (d / radius) * 0.5);
      g.vx = (dx / (d || 1)) * strength;
      g.vz = (dz / (d || 1)) * strength;
      startRetreat(g, seconds);
      hit++;
    }
    return hit;
  }

  /**
   * Runs AI and movement, then redraws. Returns the first ghost touching the
   * player this frame, or null. While `hunting` is false ghosts just wander.
   */
  update(dt: number, elapsed: number, player: Vector3, hunting: boolean): Ghost | null {
    const reach = PLAYER.radius + GHOST.radius;
    let toucher: Ghost | null = null;

    this.spotted.length = 0;
    for (const g of this.ghosts) {
      const before = g.mode;
      think(g, dt, player, hunting, this.rng);
      if (g.mode === 'chase' && before !== 'chase') this.spotted.push(g);
    }
    separate(this.ghosts, dt);

    this.ghosts.forEach((g, i) => {
      g.x = MathUtils.clamp(g.x + g.vx * dt, -GHOST_BOUNDS, GHOST_BOUNDS);
      g.z = MathUtils.clamp(g.z + g.vz * dt, -GHOST_BOUNDS, GHOST_BOUNDS);
      g.appear = Math.min(1, g.appear + dt / APPEAR_SECONDS);

      // Face the player while hunting, otherwise the direction of travel.
      const lookX = g.mode === 'chase' ? player.x - g.x : g.vx;
      const lookZ = g.mode === 'chase' ? player.z - g.z : g.vz;
      if (Math.hypot(lookX, lookZ) > 0.05) {
        const targetYaw = Math.atan2(-lookX, -lookZ);
        const delta = Math.atan2(Math.sin(targetYaw - g.yaw), Math.cos(targetYaw - g.yaw));
        g.yaw += delta * (1 - Math.exp(-TURN_RATE * dt));
      }

      const touching = Math.hypot(player.x - g.x, player.z - g.z) < reach;
      if (hunting && !toucher && touching && g.mode !== 'retreat' && g.appear >= 1) toucher = g;

      this.draw(i, g, elapsed);
    });

    this.bodies.count = this.faces.count = this.ghosts.length;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.faces.instanceMatrix.needsUpdate = true;
    if (this.faces.instanceColor) this.faces.instanceColor.needsUpdate = true;
    return toucher;
  }

  private draw(i: number, g: Ghost, elapsed: number): void {
    const speed = Math.hypot(g.vx, g.vz);
    const bob = Math.sin(elapsed * 2.2 + g.phase) * 0.18;
    const ease = 1 - (1 - g.appear) ** 3;
    this.dummy.position.set(g.x, GHOST.hoverHeight + bob + (1 - ease) * -0.8, g.z);
    // Lean into the direction of travel, with a gentle side-to-side sway.
    this.dummy.rotation.set(-speed * 0.07, g.yaw, Math.sin(elapsed * 1.6 + g.phase) * 0.06, 'YXZ');
    this.dummy.scale.setScalar(Math.max(ease, 1e-3));
    this.dummy.updateMatrix();
    this.bodies.setMatrixAt(i, this.dummy.matrix);
    this.faces.setMatrixAt(i, this.dummy.matrix);
    this.faces.setColorAt(i, g.mode === 'chase' ? FACE_HUNTING : g.mode === 'retreat' ? FACE_SCARED : FACE_CALM);
  }
}
