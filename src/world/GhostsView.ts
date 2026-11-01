import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Object3D,
  Points,
  PointsMaterial,
} from 'three';
import { createGhostBodyGeometry, createGhostFaceGeometry, createGhostMaterials } from '../entities/ghostModel';
import { GHOST, TRAIN } from '../game/config';
import type { Course } from './course';
import { ghostX, isSwooping } from './hazards';
import { getGlowTexture } from './props/glowTexture';

const MAX_GHOSTS = 24;
const DRAW_AHEAD = 220;
/** Metres of the runner's travel over which a banished ghost rises and fades away. */
const FADE_DISTANCE = 7;
/** Drawn a little larger than the collision box so they read clearly at speed. */
const SCALE = 1.3;

const EYES_CALM = new Color(0x0b0b16);
const EYES_HUNTING = new Color(0xff3a22);
const EYES_GONE = new Color(0x9fdcff);

/**
 * The ghosts haunting the line: translucent bedsheets facing the runner,
 * bobbing in place. A swooper's eyes burn red as it leans into its glide; a
 * banished (or spent) ghost rises and fades. Rewritten every frame.
 */
export class GhostsView {
  readonly group = new Group();
  private readonly bodies: InstancedMesh;
  private readonly faces: InstancedMesh;
  /** A pale glow around each ghost, so they stand out against the dark from far away. */
  private readonly halos: Points;
  private readonly dummy = new Object3D();

  constructor() {
    const materials = createGhostMaterials();
    this.bodies = new InstancedMesh(createGhostBodyGeometry(), materials.body, MAX_GHOSTS);
    this.faces = new InstancedMesh(createGhostFaceGeometry(), materials.face, MAX_GHOSTS);
    // Create the per-instance eye colours up front so the shader is compiled with them.
    this.faces.setColorAt(0, EYES_CALM);
    const haloGeometry = new BufferGeometry();
    haloGeometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(MAX_GHOSTS * 3), 3));
    this.halos = new Points(
      haloGeometry,
      new PointsMaterial({ size: 3.4, map: getGlowTexture(), color: 0x9fb8ff, transparent: true, opacity: 0.55, depthWrite: false, blending: AdditiveBlending }),
    );
    for (const obj of [this.bodies, this.faces, this.halos]) {
      obj.frustumCulled = false;
      this.group.add(obj);
    }
    this.bodies.count = this.faces.count = 0;
  }

  update(course: Course, distance: number, elapsed: number): void {
    const halo = this.halos.geometry.attributes.position;
    let n = 0;
    for (const block of course.visible) {
      for (const g of block.ghosts) {
        if (n >= MAX_GHOSTS || g.at < distance - 6 || g.at > distance + DRAW_AHEAD) continue;
        const fade = g.goneAt === null ? 0 : (distance - g.goneAt) / FADE_DISTANCE;
        if (fade >= 1) continue;
        const swooping = isSwooping(g, distance);
        const bob = Math.sin(elapsed * 2.4 + g.at) * 0.12;
        this.dummy.position.set(ghostX(g, distance), TRAIN.roofHeight + GHOST.hover + bob + fade * 2.5, -g.at);
        // Facing the runner (+z); a swooper leans towards the lane it is heading for.
        const lean = g.lane === g.toLane ? 0 : Math.sign(g.toLane - g.lane) * (swooping ? 0.35 : 0.1);
        this.dummy.rotation.set(0, Math.PI, lean + Math.sin(elapsed * 1.7 + g.at) * 0.05);
        this.dummy.scale.setScalar(Math.max(0.001, 1 - fade) * SCALE);
        this.dummy.updateMatrix();
        this.bodies.setMatrixAt(n, this.dummy.matrix);
        this.faces.setMatrixAt(n, this.dummy.matrix);
        this.faces.setColorAt(n, g.goneAt !== null ? EYES_GONE : swooping ? EYES_HUNTING : EYES_CALM);
        const p = this.dummy.position;
        halo?.setXYZ(n, p.x, p.y + 1.0 * SCALE * (1 - fade), p.z);
        n++;
      }
    }
    this.bodies.count = this.faces.count = n;
    this.bodies.instanceMatrix.needsUpdate = true;
    this.faces.instanceMatrix.needsUpdate = true;
    if (this.faces.instanceColor) this.faces.instanceColor.needsUpdate = true;
    this.halos.geometry.setDrawRange(0, n);
    if (halo) halo.needsUpdate = true;
  }
}
