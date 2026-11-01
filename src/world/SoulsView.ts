import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  PointsMaterial,
} from 'three';
import { TRAIN } from '../game/config';
import { type Course, laneX } from './course';
import { getGlowTexture } from './props/glowTexture';

const MAX_SOULS = 240;
/** Souls further ahead than this aren't drawn (the fog has them anyway). */
const DRAW_AHEAD = 240;

/**
 * The soul wisps: a small glowing core each plus a soft halo, bobbing and
 * turning. Unlike the course's static props they animate, so they are
 * rewritten every frame; gathered souls simply stop being drawn.
 */
export class SoulsView {
  readonly group = new Group();
  private readonly cores: InstancedMesh;
  private readonly halos: Points;
  private readonly dummy = new Object3D();

  constructor() {
    this.cores = new InstancedMesh(new IcosahedronGeometry(0.2, 1), new MeshBasicMaterial({ color: 0xd2f8ff }), MAX_SOULS);
    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(MAX_SOULS * 3), 3));
    this.halos = new Points(
      haloGeometry,
      new PointsMaterial({
        size: 1.4,
        map: getGlowTexture(),
        color: 0x5fd8ff,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    for (const obj of [this.cores, this.halos]) obj.frustumCulled = false;
    this.cores.count = 0;
    this.group.add(this.cores, this.halos);
  }

  update(course: Course, distance: number, elapsed: number): void {
    const halo = this.halos.geometry.attributes.position;
    let n = 0;
    for (const block of course.visible) {
      for (const soul of block.souls) {
        if (soul.taken || n >= MAX_SOULS || soul.at < distance - 4 || soul.at > distance + DRAW_AHEAD) continue;
        const x = laneX(soul.lane);
        const y = TRAIN.roofHeight + soul.height + Math.sin(elapsed * 3 + soul.at) * 0.08;
        const z = -soul.at;
        this.dummy.position.set(x, y, z);
        this.dummy.rotation.set(elapsed * 1.3 + soul.at, elapsed * 2 + soul.at, 0);
        this.dummy.updateMatrix();
        this.cores.setMatrixAt(n, this.dummy.matrix);
        halo?.setXYZ(n, x, y, z);
        n++;
      }
    }
    this.cores.count = n;
    this.cores.instanceMatrix.needsUpdate = true;
    this.halos.geometry.setDrawRange(0, n);
    if (halo) halo.needsUpdate = true;
  }
}
