import {
  type BufferGeometry,
  Group,
  InstancedMesh,
  type Material,
  type Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { LANES, TRAIN } from '../game/config';
import { type Course, laneX } from './course';
import { createBarFrame, createBarGlow, createBridgeFrame, createBridgeGlow } from './props/obstacles';
import { createPumpkinBodyGeometry, createPumpkinFaceGeometry, PUMPKIN_SQUASH } from './props/pumpkins';
import { CARRIAGE_LENGTH, createCarriageBody, createCarriageMaterials, createCarriageWindows, PIECE_LENGTH } from './props/train';

const L = TRAIN.blockLength;
const ROOF = TRAIN.roofHeight;
/** Instance budgets; anything beyond is skipped (the generator never gets close). */
const MAX_CARRIAGES = 90;
const MAX_PIECES = 60;
const MAX_HURDLES = 40;
const MAX_BARS = 50;
const MAX_BRIDGES = 10;
/** Three jack-o'-lanterns across the lane make one hurdle. */
const HURDLE_PUMPKINS = [-0.78, 0, 0.78];
const PUMPKIN_SCALE = 0.4;

/** One prop drawn as a pair of instanced meshes sharing transforms: a lit frame and an unlit glow. */
class Pair {
  readonly meshes: InstancedMesh[];
  count = 0;
  constructor(parts: Array<[BufferGeometry, Material]>, readonly capacity: number) {
    this.meshes = parts.map(([g, m]) => {
      const mesh = new InstancedMesh(g, m, capacity);
      mesh.frustumCulled = false; // spread along the whole visible line
      mesh.count = 0;
      return mesh;
    });
  }
  add(matrix: Matrix4): void {
    if (this.count >= this.capacity) return;
    for (const mesh of this.meshes) mesh.setMatrixAt(this.count, matrix);
    this.count++;
  }
  commit(): void {
    for (const mesh of this.meshes) {
      mesh.count = this.count;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.count = 0;
  }
}

/**
 * Draws the generated course: carriages (whole, or split around a gap),
 * jack-o'-lantern hurdles, signal boards and road bridges. Everything is
 * static in the world, so instances are only rebuilt when the course changes.
 */
export class CourseView {
  readonly group = new Group();
  private readonly carriages: Pair;
  private readonly pieces: Pair;
  private readonly hurdles: Pair;
  private readonly bars: Pair;
  private readonly bridges: Pair;
  private readonly dummy = new Object3D();
  private builtVersion = -1;

  constructor() {
    const train = createCarriageMaterials();
    const frame = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const glow = new MeshBasicMaterial({ vertexColors: true });
    this.carriages = new Pair(
      [[createCarriageBody(CARRIAGE_LENGTH), train.body], [createCarriageWindows(CARRIAGE_LENGTH), train.windows]],
      MAX_CARRIAGES,
    );
    this.pieces = new Pair(
      [[createCarriageBody(PIECE_LENGTH), train.body], [createCarriageWindows(PIECE_LENGTH), train.windows]],
      MAX_PIECES,
    );
    this.hurdles = new Pair(
      [
        [createPumpkinBodyGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })],
        [createPumpkinFaceGeometry(), new MeshBasicMaterial({ color: 0xffc04a })],
      ],
      MAX_HURDLES * HURDLE_PUMPKINS.length,
    );
    this.bars = new Pair([[createBarFrame(), frame], [createBarGlow(), glow]], MAX_BARS);
    this.bridges = new Pair([[createBridgeFrame(), frame], [createBridgeGlow(), glow]], MAX_BRIDGES);
    for (const pair of [this.carriages, this.pieces, this.hurdles, this.bars, this.bridges]) {
      this.group.add(...pair.meshes);
    }
  }

  /** Rebuilds the instances if the course has changed since the last call. */
  update(course: Course): void {
    if (course.version === this.builtVersion) return;
    this.builtVersion = course.version;

    for (const block of course.visible) {
      const mid = -(block.index * L + L / 2);
      block.roof.forEach((roofed, lane) => {
        if (!roofed) return;
        const x = laneX(lane);
        const gap = block.obstacles.find((o) => o.lane === lane && o.kind === 'gap');
        if (!gap) {
          this.place(this.carriages, x, 0, mid);
          return;
        }
        const offset = (TRAIN.gapLength + PIECE_LENGTH) / 2;
        this.place(this.pieces, x, 0, mid + offset);
        this.place(this.pieces, x, 0, mid - offset);
      });
      if (block.bridge) this.place(this.bridges, laneX((LANES.count - 1) / 2), ROOF, mid);
      for (const o of block.obstacles) {
        if (o.kind === 'bar' && !block.bridge) this.place(this.bars, laneX(o.lane), ROOF, -o.at);
        if (o.kind !== 'hurdle') continue;
        // Faces turned back towards the oncoming runner, each pumpkin a little askew.
        HURDLE_PUMPKINS.forEach((dx, i) => {
          this.place(this.hurdles, laneX(o.lane) + dx, ROOF + PUMPKIN_SCALE * PUMPKIN_SQUASH, -o.at, Math.PI + (i - 1) * 0.35, PUMPKIN_SCALE);
        });
      }
    }
    for (const pair of [this.carriages, this.pieces, this.hurdles, this.bars, this.bridges]) pair.commit();
  }

  private place(pair: Pair, x: number, y: number, z: number, rotY = 0, scale = 1): void {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotY, 0);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    pair.add(this.dummy.matrix);
  }
}
