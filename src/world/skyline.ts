import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { landmarkClear } from './props/landmarks';
import { STREET_Y } from './props/obstacles';
import { createRng, range, type Rng } from './rng';

/** Window grid baked into the facade texture. */
const COLS = 8;
const FLOORS = 16;

interface Style {
  /** Typical footprint and height; each building varies around these. */
  width: number;
  height: number;
  depth: number;
  glass: boolean;
  tints: number[];
}

/** One row of buildings along each side of the viaduct: distance from the track and style. */
interface Row {
  offset: number;
  gap: [number, number];
  style: Style;
}

const TERRACE: Style = { width: 12, height: 14, depth: 10, glass: false, tints: [0x8a6a58, 0x7a5a4a, 0x9a8070, 0x6d5f58] };
const OFFICE: Style = { width: 18, height: 32, depth: 16, glass: true, tints: [0x6d7a8f, 0x5d6878, 0x7f8794] };
const TOWER: Style = { width: 22, height: 80, depth: 22, glass: true, tints: [0x52627a, 0x6a7b94, 0x45506a] };
const STYLES = [TERRACE, OFFICE, TOWER];

/** Brick terraces and warehouses hug the viaduct, offices behind, glass towers further out. */
const ROWS: Row[] = [
  { offset: 10, gap: [0, 2], style: TERRACE },
  { offset: 34, gap: [3, 9], style: OFFICE },
  { offset: 80, gap: [25, 60], style: TOWER },
];
const AHEAD = 520;
const BEHIND = 40;

/** Facade with a grid of windows; the emissive twin keeps only the lit ones so they glow. */
function facadeTextures(glass: boolean, seed: number): { map: Texture; glow: Texture } {
  const cell = 32;
  const make = (glowOnly: boolean): Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = COLS * cell;
    canvas.height = FLOORS * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    ctx.fillStyle = glowOnly ? '#000' : glass ? '#20283a' : '#5a4034';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const pattern = createRng(seed + 1);
    for (let y = 0; y < FLOORS; y++) {
      for (let x = 0; x < COLS; x++) {
        const lit = pattern() < 0.32;
        const warm = pattern() < 0.7 ? '#ffcf7a' : '#ff9a3c'; // Halloween: some windows burn orange
        if (glowOnly && !lit) continue;
        ctx.fillStyle = lit ? warm : glass ? '#141a28' : '#1c1612';
        const inset = glass ? 3 : 8;
        ctx.fillRect(x * cell + inset, y * cell + inset * 1.2, cell - inset * 2, cell - inset * 2.2);
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return texture;
  };
  // Both canvases replay the same seeded pattern, so lit windows line up in each.
  return { map: make(false), glow: make(true) };
}

/** Unit box standing on y = 0 with UVs sized so a typical building shows ~3 m windows. Roofs map to plain facade. */
function buildingGeometry(style: Style): BoxGeometry {
  const g = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const uv = g.attributes.uv;
  if (!uv) return g;
  const across = (Math.max(style.width, style.depth) / 3) / COLS;
  const up = style.height / 3.2 / FLOORS;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4); // px, nx, py, ny, pz, nz
    if (face === 2 || face === 3) uv.setXY(i, 0.001, 0.001);
    else uv.setXY(i, uv.getX(i) * across, uv.getY(i) * up);
  }
  return g;
}

interface Slot {
  row: Row;
  side: number;
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  tint: Color;
}

/**
 * Buildings lining both sides of the line, recycled ahead of the runner as
 * they fall behind. One instanced mesh per style; positions rebuilt only when
 * a building is recycled.
 */
export class Skyline {
  readonly group = new Group();
  private readonly meshes = new Map<Style, InstancedMesh>();
  private slots: Slot[] = [];
  /** Furthest z reached by each row on each side (rows grow towards -z). */
  private cursors = new Map<string, number>();
  private readonly dummy = new Object3D();
  private rng: Rng = createRng(2024);

  constructor() {
    STYLES.forEach((style, i) => {
      const { map, glow } = facadeTextures(style.glass, 100 + i * 10);
      const material = new MeshStandardMaterial({
        map,
        emissiveMap: glow,
        emissive: 0xffffff,
        emissiveIntensity: 1.1,
        roughness: style.glass ? 0.35 : 0.9,
        metalness: style.glass ? 0.4 : 0,
      });
      const mesh = new InstancedMesh(buildingGeometry(style), material, 160);
      mesh.frustumCulled = false;
      this.meshes.set(style, mesh);
      this.group.add(mesh);
    });
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
    for (const row of ROWS) {
      for (const side of [-1, 1]) {
        const key = `${row.offset}:${side}`;
        let cursor = this.cursors.get(key) ?? BEHIND;
        while (cursor > runnerZ - AHEAD) {
          cursor = this.addBuilding(row, side, cursor);
          changed = true;
        }
        this.cursors.set(key, cursor);
      }
    }
    if (changed) this.rebuild();
  }

  private addBuilding(row: Row, side: number, cursor: number): number {
    const s = row.style;
    const w = s.width * range(this.rng, 0.75, 1.3);
    const d = s.depth * range(this.rng, 0.8, 1.25);
    const h = s.height * range(this.rng, 0.7, 1.4);
    const z = cursor - w / 2;
    const x = side * (row.offset + d / 2 + range(this.rng, 0, row.gap[1] * 0.3));
    if (landmarkClear(x, z, Math.max(w, d) / 2)) {
      const tint = new Color(s.tints[Math.floor(this.rng() * s.tints.length)] ?? 0xffffff);
      this.slots.push({ row, side, x, z, w, h, d, tint });
    }
    return cursor - w - range(this.rng, row.gap[0], row.gap[1]);
  }

  private rebuild(): void {
    const counts = new Map<InstancedMesh, number>();
    for (const slot of this.slots) {
      const mesh = this.meshes.get(slot.row.style);
      if (!mesh) continue;
      const i = counts.get(mesh) ?? 0;
      if (i >= mesh.instanceMatrix.count) continue;
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
  }
}
