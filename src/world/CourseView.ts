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
import { createTrainParts, PIECE_LENGTH } from './props/train';

const L = TRAIN.blockLength;
const ROOF = TRAIN.roofHeight;
/** Instance budgets; anything beyond is skipped (the generator never gets close). */
const MAX_CARRIAGES = 140;
const MAX_PIECES = 60;
const MAX_HURDLES = 40;
const MAX_BARS = 50;
const MAX_BRIDGES = 10;
const MAX_TAIL_LAMPS = 60;
const MAX_GANGWAYS = 140;
const MAX_CABS = 110;
/** Three jack-o'-lanterns across the lane make one hurdle. */
const HURDLE_PUMPKINS = [-0.78, 0, 0.78];
const PUMPKIN_SCALE = 0.4;
/** Stabled trains on the sidings: the line is cut into runs of blocks, each holding one train or none. */
const SIDING_RUN = 9;

/** Whether the siding on `side` (-1 left, 1 right) has a carriage at block `index`. Fixed per block, so it never flickers. */
function sidingRoofed(index: number, side: number): boolean {
  if (index < 0) return false;
  const at = index + (side > 0 ? 4 : 0);
  const run = Math.floor(at / SIDING_RUN);
  const h = Math.abs(Math.sin(run * 91.7 + side * 13.1) * 43758.5453) % 1;
  const length = 3 + Math.floor(h * 5);
  const offset = at - run * SIDING_RUN;
  return h > 0.25 && offset >= 1 && offset <= length;
}

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
 * Draws the generated course: trains (carriages whole or split around a gap,
 * gangways between them, a cab at each end), stabled trains on the sidings,
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
  /** Red lamps where a train ends or a gap opens: the lane runs out here. */
  private readonly tailLamps: Pair;
  private readonly gangways: Pair;
  /** Driving cabs at both ends of every train. */
  private readonly cabs: Pair;
  private readonly dummy = new Object3D();
  private builtVersion = -1;

  constructor() {
    const train = createTrainParts();
    const frame = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const glow = new MeshBasicMaterial({ vertexColors: true });
    this.carriages = new Pair(train.carriage, MAX_CARRIAGES);
    this.pieces = new Pair(train.piece, MAX_PIECES);
    this.gangways = new Pair(train.gangway, MAX_GANGWAYS);
    this.cabs = new Pair(train.cab, MAX_CABS);
    this.hurdles = new Pair(
      [
        [createPumpkinBodyGeometry(), new MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })],
        [createPumpkinFaceGeometry(), new MeshBasicMaterial({ color: 0xffc04a })],
      ],
      MAX_HURDLES * HURDLE_PUMPKINS.length,
    );
    this.bars = new Pair([[createBarFrame(), frame], [createBarGlow(), glow]], MAX_BARS);
    this.bridges = new Pair([[createBridgeFrame(), frame], [createBridgeGlow(), glow]], MAX_BRIDGES);
    this.tailLamps = new Pair(train.tailLamps, MAX_TAIL_LAMPS);
    for (const pair of this.pairs()) this.group.add(...pair.meshes);
  }

  private pairs(): Pair[] {
    return [this.carriages, this.pieces, this.gangways, this.cabs, this.hurdles, this.bars, this.bridges, this.tailLamps];
  }

  /** Rebuilds the instances if the course has changed since the last call. */
  update(course: Course): void {
    if (course.version === this.builtVersion) return;
    this.builtVersion = course.version;

    course.visible.forEach((block, n) => {
      const mid = -(block.index * L + L / 2);
      const prev = course.visible[n - 1];
      const next = course.visible[n + 1];
      const near = -(block.index * L + TRAIN.coupling / 2);
      const far = -((block.index + 1) * L - TRAIN.coupling / 2);
      block.roof.forEach((roofed, lane) => {
        if (!roofed) return;
        const x = laneX(lane);
        // A train starts here if the lane was empty in the block before (or the line starts here): its cab faces the runner.
        if (prev ? !prev.roof[lane] : block.index === 0) this.place(this.cabs, x, 0, near);
        // The train ends at this block's far edge if the next block's lane is empty; otherwise a gangway couples on.
        if (next && !next.roof[lane]) {
          this.place(this.tailLamps, x, 0, far);
          this.place(this.cabs, x, 0, far, Math.PI);
        } else if (next) {
          this.place(this.gangways, x, 0, -((block.index + 1) * L));
        }
        const gap = block.obstacles.find((o) => o.lane === lane && o.kind === 'gap');
        if (!gap) {
          this.place(this.carriages, x, 0, mid);
          return;
        }
        const offset = (TRAIN.gapLength + PIECE_LENGTH) / 2;
        this.place(this.pieces, x, 0, mid + offset);
        this.place(this.pieces, x, 0, mid - offset);
        this.place(this.tailLamps, x, 0, -(gap.at - TRAIN.gapLength / 2));
      });
      for (const side of [-1, 1]) this.placeSiding(block.index, side, mid, near, far);
      if (block.bridge) this.place(this.bridges, laneX((LANES.count - 1) / 2), ROOF, mid);
      for (const o of block.obstacles) {
        if (o.kind === 'bar' && !block.bridge) this.place(this.bars, laneX(o.lane), ROOF, -o.at);
        if (o.kind !== 'hurdle') continue;
        // Faces turned back towards the oncoming runner, each pumpkin a little askew.
        HURDLE_PUMPKINS.forEach((dx, i) => {
          this.place(this.hurdles, laneX(o.lane) + dx, ROOF + PUMPKIN_SCALE * PUMPKIN_SQUASH, -o.at, Math.PI + (i - 1) * 0.35, PUMPKIN_SCALE);
        });
      }
    });
    for (const pair of this.pairs()) pair.commit();
  }

  /** A stabled train's carriage on a siding, with a cab where it starts or ends and gangways between. */
  private placeSiding(index: number, side: number, mid: number, near: number, far: number): void {
    if (!sidingRoofed(index, side)) return;
    const x = side * 2 * LANES.width;
    this.place(this.carriages, x, 0, mid);
    if (!sidingRoofed(index - 1, side)) this.place(this.cabs, x, 0, near);
    if (sidingRoofed(index + 1, side)) this.place(this.gangways, x, 0, -((index + 1) * L));
    else this.place(this.cabs, x, 0, far, Math.PI);
  }

  private place(pair: Pair, x: number, y: number, z: number, rotY = 0, scale = 1): void {
    this.dummy.position.set(x, y, z);
    this.dummy.rotation.set(0, rotY, 0);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    pair.add(this.dummy.matrix);
  }
}
