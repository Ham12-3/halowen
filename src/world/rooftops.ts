import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
} from 'three';
import { box, mergeParts, solid } from './props/geometry';
import { STREET_Y } from './props/obstacles';
import type { Slot } from './skyline';

/** Slate pitch of a terrace roof: rise per metre of depth. */
const PITCH = 0.36;
const CHIMNEY_SPACING = 4.8;

/** A unit gable roof: ridge along Z, eaves at y = 0, ridge at y = 1. Slate slopes, brick gable ends. */
function gableRoof(): BufferGeometry {
  const shape = new Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0.5, 0);
  shape.lineTo(0, 1);
  shape.closePath();
  const g = new ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const normals = g.attributes.normal;
  const colors: number[] = [];
  const slate = new Color(0x3b4048);
  const brick = new Color(0x6e5c48);
  for (let i = 0; i < (normals?.count ?? 0); i++) {
    const c = Math.abs(normals?.getZ(i) ?? 0) > 0.5 ? brick : slate;
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

/** A party-wall chimney stack with a row of clay pots, standing on y = 0. */
function chimney(): BufferGeometry {
  const parts = [box(1.5, 1.5, 0.6, 0, 0.75, 0, 0x6a5a48), box(1.6, 0.12, 0.7, 0, 1.5, 0, 0x8a7d68)];
  for (const x of [-0.5, -0.17, 0.17, 0.5]) {
    parts.push(solid(new CylinderGeometry(0.1, 0.13, 0.5, 6).translate(x, 1.8, 0), 0x9a5236));
  }
  return mergeParts(parts);
}

function mesh(geometry: BufferGeometry, material: Material, capacity: number): InstancedMesh {
  const m = new InstancedMesh(geometry, material, capacity);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

/** Cheap repeatable "random" from a building's position, so its roof never changes between rebuilds. */
function hash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * What sits on top of the skyline: slate gable roofs and chimney stacks on the
 * terraces, plant rooms and lift overruns on offices and estates, and red
 * aircraft warning lights crowning the towers.
 */
export class Rooftops {
  readonly group = new Group();
  private readonly gables: InstancedMesh;
  private readonly chimneys: InstancedMesh;
  private readonly plant: InstancedMesh;
  private readonly warnings: InstancedMesh;
  private readonly dummy = new Object3D();
  private readonly tint = new Color();

  constructor() {
    const painted = new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 });
    this.gables = mesh(gableRoof(), painted, 200);
    this.chimneys = mesh(chimney(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 400);
    const unit = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.plant = mesh(unit, new MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.3 }), 300);
    this.warnings = mesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshBasicMaterial({ color: new Color(1, 0.03, 0.01).multiplyScalar(2.2) }), 120);
    this.group.add(this.gables, this.chimneys, this.plant, this.warnings);
  }

  rebuild(slots: readonly Slot[]): void {
    for (const m of [this.gables, this.chimneys, this.plant, this.warnings]) m.count = 0;
    for (const s of slots) {
      const top = STREET_Y + s.h;
      const r = hash(s.x, s.z);
      const lean = Math.sign(s.x) * -1; // set back towards the track side
      switch (s.kind.roof) {
        case 'pitched': {
          const rise = s.d * PITCH;
          this.place(this.gables, s.x, top, s.z, s.d + 0.4, rise, s.w);
          const n = Math.max(1, Math.round(s.w / CHIMNEY_SPACING));
          for (let i = 0; i <= n; i++) this.place(this.chimneys, s.x, top + rise * 0.72, s.z - s.w / 2 + (i * s.w) / n, 1, 1, 1);
          break;
        }
        case 'flat':
          if (r < 0.6) this.place(this.plant, s.x + lean * s.d * 0.15, top, s.z + (r - 0.3) * s.w, 3, 2.4, 4, 0x6f6a62);
          break;
        case 'plant':
          this.place(this.plant, s.x - lean * s.d * 0.1, top, s.z + (r - 0.5) * s.w * 0.3, s.d * 0.45, 3.4, s.w * 0.35);
          if (r > 0.4) this.place(this.plant, s.x + lean * s.d * 0.25, top, s.z - s.w * 0.25, 2.5, 4.5, 3, 0x6c7178);
          break;
        case 'tower': {
          const crown = 4 + r * 4;
          this.place(this.plant, s.x, top, s.z, s.d * 0.75, crown, s.w * 0.75, 0x3a4048);
          for (const dz of [-1, 1]) this.place(this.warnings, s.x, top + crown + 0.4, s.z + dz * s.w * 0.3, 1, 1, 1);
          break;
        }
      }
    }
    for (const m of [this.gables, this.chimneys, this.plant, this.warnings]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  private place(m: InstancedMesh, x: number, y: number, z: number, sx: number, sy: number, sz: number, color = 0xffffff): void {
    if (m.count >= m.instanceMatrix.count) return;
    this.dummy.position.set(x, y, z);
    this.dummy.scale.set(sx, sy, sz);
    this.dummy.updateMatrix();
    m.setMatrixAt(m.count, this.dummy.matrix);
    if (m === this.plant) m.setColorAt(m.count, this.tint.set(color));
    m.count++;
  }
}
