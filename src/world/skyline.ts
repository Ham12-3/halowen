import { BoxGeometry, Color, Group, InstancedMesh, Object3D } from 'three';
import { createFacades, type FacadeName, type Kind, type Row, ROWS } from './buildingKinds';
import { createFacadeMaterial } from './facadeMaterial';
import { landmarkClear } from './props/sites';
import { STREET_Y } from './props/obstacles';
import { createRng, range, type Rng } from './rng';
import { Rooftops } from './rooftops';

const AHEAD = 520;
const BEHIND = 40;
const CAPACITY = 160;

/** One building: its kind, which side of the line, footprint centre, size and tint. */
export interface Slot {
  kind: Kind;
  side: number;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tint: Color;
}

function weighted(rng: Rng, kinds: Array<[Kind, number]>): Kind {
  const total = kinds.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [kind, w] of kinds) {
    r -= w;
    if (r <= 0) return kind;
  }
  const last = kinds[kinds.length - 1];
  if (!last) throw new Error('weighted: no kinds');
  return last[0];
}

/**
 * London lining both sides of the line, recycled ahead of the runner as it
 * falls behind: Victorian terraces and warehouses by the viaduct, stone and
 * glass offices and post-war estates behind, towers further out. One instanced
 * mesh per facade; positions rebuilt only when a building is recycled.
 */
export class Skyline {
  readonly group = new Group();
  private readonly meshes = new Map<FacadeName, InstancedMesh>();
  private readonly rooftops = new Rooftops();
  private slots: Slot[] = [];
  /** Furthest z reached by each row on each side (rows grow towards -z). */
  private cursors = new Map<string, number>();
  private readonly dummy = new Object3D();
  private rng: Rng = createRng(2024);

  constructor() {
    const unit = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    for (const [name, { facade, look }] of Object.entries(createFacades()) as Array<[FacadeName, ReturnType<typeof createFacades>[FacadeName]]>) {
      const mesh = new InstancedMesh(unit, createFacadeMaterial(facade, look), CAPACITY);
      mesh.frustumCulled = false;
      this.meshes.set(name, mesh);
      this.group.add(mesh);
    }
    this.group.add(this.rooftops.group);
  }

  reset(): void {
    this.rng = createRng(2024);
    this.slots = [];
    this.cursors.clear();
    this.update(0, true);
  }

  /** Recycles buildings that have fallen behind and fills in ahead. */
  update(distance: number, force = false): void {
    const runnerZ = -distance;
    const passed = (s: Slot): boolean => s.z - s.w / 2 > runnerZ + BEHIND;
    let changed = force;
    if (this.slots.some(passed)) {
      this.slots = this.slots.filter((s) => !passed(s));
      changed = true;
    }
    ROWS.forEach((row, r) => {
      for (const side of [-1, 1]) {
        const key = `${r}:${side}`;
        let cursor = this.cursors.get(key) ?? BEHIND;
        while (cursor > runnerZ - AHEAD) {
          cursor = this.addBuilding(row, side, cursor);
          changed = true;
        }
        this.cursors.set(key, cursor);
      }
    });
    if (changed) this.rebuild();
  }

  private addBuilding(row: Row, side: number, cursor: number): number {
    const kind = weighted(this.rng, row.kinds);
    const w = range(this.rng, ...kind.width);
    const d = range(this.rng, ...kind.depth);
    const h = range(this.rng, ...kind.height);
    const z = cursor - w / 2;
    const x = side * (row.offset + d / 2 + range(this.rng, 0, row.gap[1] * 0.3));
    if (landmarkClear(x, z, Math.max(w, d) / 2)) {
      const tint = new Color(kind.tints[Math.floor(this.rng() * kind.tints.length)] ?? 0xffffff);
      this.slots.push({ kind, side, x, z, w, h, d, tint });
    }
    return cursor - w - range(this.rng, row.gap[0], row.gap[1]);
  }

  private rebuild(): void {
    const counts = new Map<InstancedMesh, number>();
    for (const slot of this.slots) {
      const mesh = this.meshes.get(slot.kind.facade);
      if (!mesh) continue;
      const i = counts.get(mesh) ?? 0;
      if (i >= CAPACITY) continue;
      this.dummy.position.set(slot.x, STREET_Y, slot.z);
      this.dummy.scale.set(slot.d, slot.h, slot.w); // the box's X faces the track
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, slot.tint);
      counts.set(mesh, i + 1);
    }
    for (const mesh of this.meshes.values()) {
      mesh.count = counts.get(mesh) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.rooftops.rebuild(this.slots);
  }
}
