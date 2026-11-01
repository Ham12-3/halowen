import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
} from 'three';
import { FLARE, TRAIN } from '../game/config';
import type { Course } from './course';
import { laneX } from './lanes';
import { box, mergeParts, solid } from './props/geometry';
import { getGlowTexture } from './props/glowTexture';

const MAX_PICKUPS = 8;
const DRAW_AHEAD = 240;
const IRON = 0x2a2522;

/** A big iron lantern: base, four corner posts, a pointed cap and a ring to hang it by. */
function lanternFrame(): BufferGeometry {
  const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(0.05, 0.5, 0.05, sx * 0.16, 0, sz * 0.16, IRON)));
  return mergeParts([
    box(0.42, 0.07, 0.42, 0, -0.27, 0, IRON),
    ...posts,
    solid(new ConeGeometry(0.3, 0.22, 4).rotateY(Math.PI / 4).translate(0, 0.36, 0), IRON),
    solid(new CylinderGeometry(0.06, 0.06, 0.12, 6).translate(0, 0.52, 0), IRON),
  ]);
}

/**
 * Lantern pickups floating over the roofs: an iron cage around a blazing
 * core, slowly turning, with a warm halo you can spot from far off.
 */
export class PickupsView {
  readonly group = new Group();
  private readonly frames: InstancedMesh;
  private readonly cores: InstancedMesh;
  private readonly halos: Points;
  private readonly dummy = new Object3D();

  constructor() {
    this.frames = new InstancedMesh(lanternFrame(), new MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.45 }), MAX_PICKUPS);
    this.cores = new InstancedMesh(new CylinderGeometry(0.13, 0.13, 0.42, 10), new MeshBasicMaterial({ color: 0xffd27a }), MAX_PICKUPS);
    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(MAX_PICKUPS * 3), 3));
    this.halos = new Points(
      haloGeometry,
      new PointsMaterial({ size: 3.2, map: getGlowTexture(), color: 0xffa94a, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false }),
    );
    for (const obj of [this.frames, this.cores, this.halos]) obj.frustumCulled = false;
    this.frames.count = this.cores.count = 0;
    this.group.add(this.frames, this.cores, this.halos);
  }

  update(course: Course, distance: number, elapsed: number): void {
    const halo = this.halos.geometry.attributes.position;
    let n = 0;
    for (const block of course.visible) {
      for (const p of block.pickups) {
        if (p.taken || n >= MAX_PICKUPS || p.at < distance - 4 || p.at > distance + DRAW_AHEAD) continue;
        const x = laneX(p.lane);
        const y = TRAIN.roofHeight + FLARE.height + Math.sin(elapsed * 2.6 + p.at) * 0.12;
        this.dummy.position.set(x, y, -p.at);
        this.dummy.rotation.set(0, elapsed * 1.6, 0);
        this.dummy.scale.setScalar(1.5);
        this.dummy.updateMatrix();
        this.frames.setMatrixAt(n, this.dummy.matrix);
        this.cores.setMatrixAt(n, this.dummy.matrix);
        halo?.setXYZ(n, x, y, -p.at);
        n++;
      }
    }
    this.frames.count = this.cores.count = n;
    this.frames.instanceMatrix.needsUpdate = true;
    this.cores.instanceMatrix.needsUpdate = true;
    this.halos.geometry.setDrawRange(0, n);
    if (halo) halo.needsUpdate = true;
  }
}
