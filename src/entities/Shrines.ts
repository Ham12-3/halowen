import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  type InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
} from 'three';
import { SHRINE } from '../game/config';
import type { XZ } from '../world/collision';
import { SHRINES } from '../world/layout';
import { instance } from '../world/props/geometry';
import { getGlowTexture } from '../world/props/glowTexture';
import { createPumpkinFaceGeometry } from '../world/props/pumpkins';
import { shrinePumpkin } from '../world/props/shrine';

const LIT = new Color(0xffb347);
const SPENT = new Color(0x1c0e06);
/** Width of the fake light pool painted on the ground around each shrine. */
const POOL_SIZE = 5;

/**
 * The live part of the pumpkin shrines: which are lit, their glowing faces,
 * halos and ground glow. No real lights; additive sprites fake the glow so the
 * scene's light count never changes. World draws the stone and pumpkin bodies.
 */
export class Shrines {
  readonly group = new Group();
  /** 0..1 per shrine; 1 = lit and ready to refill the lantern. */
  private readonly charge = SHRINES.map(() => 1);
  private readonly faces: InstancedMesh;
  private readonly pools: InstancedMesh;
  private readonly halos: Points;
  private readonly color = new Color();

  constructor() {
    const lit = SHRINES.map(() => LIT);
    const pumpkins = SHRINES.map(shrinePumpkin);
    this.faces = instance(createPumpkinFaceGeometry(), new MeshBasicMaterial(), pumpkins, lit);

    const glow = getGlowTexture();
    const poolMaterial = new MeshBasicMaterial({
      map: glow,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const pool = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pools = SHRINES.map((s) => ({ x: s.x, y: 0.04, z: s.z, rotY: 0, scale: POOL_SIZE }));
    this.pools = instance(pool, poolMaterial, pools, lit);
    for (const mesh of [this.faces, this.pools]) {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    }

    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute('position', new Float32BufferAttribute(pumpkins.flatMap((p) => [p.x, p.y ?? 0, p.z]), 3));
    haloGeometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(SHRINES.length * 3), 3));
    this.halos = new Points(
      haloGeometry,
      new PointsMaterial({
        size: 3,
        map: glow,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false, // a dim beacon through the mist, like the soul candles
      }),
    );
    this.group.add(this.faces, this.pools, this.halos);
  }

  reset(): void {
    this.charge.fill(1);
  }

  /**
   * Relights spent shrines over time. If `wantsOil` and the player stands at a
   * lit shrine, that shrine is spent and this returns true (refill the lantern).
   */
  update(dt: number, elapsed: number, player: XZ, wantsOil: boolean): boolean {
    const haloColors = this.halos.geometry.attributes.color;
    let used = false;

    SHRINES.forEach((s, i) => {
      let charge = this.charge[i] ?? 1;
      if (charge < 1) {
        charge = Math.min(1, charge + dt / SHRINE.rechargeTime);
      } else if (wantsOil && !used && Math.hypot(player.x - s.x, player.z - s.z) < SHRINE.useRadius) {
        charge = 0;
        used = true;
      }
      this.charge[i] = charge;

      // Lit shrines pulse gently; spent ones smoulder back up while recharging.
      const glow = charge >= 1 ? 0.85 + Math.sin(elapsed * 2.2 + i * 1.7) * 0.15 : charge * charge * 0.3;
      // Over-bright face colours (above 1) tone-map towards white-hot, outshining the decorative pumpkins.
      this.faces.setColorAt(i, this.color.copy(SPENT).lerp(LIT, glow).multiplyScalar(1 + glow));
      this.pools.setColorAt(i, this.color.copy(LIT).multiplyScalar(glow * 0.6));
      haloColors?.setXYZ(i, LIT.r * glow * 0.85, LIT.g * glow * 0.85, LIT.b * glow * 0.85);
    });

    for (const mesh of [this.faces, this.pools]) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    if (haloColors) haloColors.needsUpdate = true;
    return used;
  }
}
