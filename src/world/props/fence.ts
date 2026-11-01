import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { box, type Collider } from '../collision';
import { GATE } from '../layout';
import { instance, mergeParts, type Placement } from './geometry';

const BAR_SPACING = 0.32;
const PILLAR_COUNT_PER_SIDE = 12;
const PILLAR_HEIGHT = 1.8;
const GATE_PILLAR_SCALE = 1.4;

/** Height of a gate pillar top, for placing pumpkins on it. */
export const GATE_PILLAR_TOP = (PILLAR_HEIGHT + 0.14) * GATE_PILLAR_SCALE;

/** Each side runs along `t` from -half..half; `toXZ` maps t to world coords. */
interface Side {
  toXZ: (t: number) => { x: number; z: number };
  rotY: number;
  isGate: boolean;
}

/** Wrought-iron fence with stone pillars around the whole graveyard. */
export function createFence(half: number): { group: Group; colliders: Collider[] } {
  const group = new Group();
  group.name = 'fence';

  const sides: Side[] = [
    { toXZ: (t) => ({ x: t, z: -half }), rotY: 0, isGate: false },
    { toXZ: (t) => ({ x: t, z: half }), rotY: 0, isGate: true },
    { toXZ: (t) => ({ x: -half, z: t }), rotY: Math.PI / 2, isGate: false },
    { toXZ: (t) => ({ x: half, z: t }), rotY: Math.PI / 2, isGate: false },
  ];
  const pillarStep = (half * 2) / PILLAR_COUNT_PER_SIDE;

  const bars: Placement[] = [];
  const pillars: Placement[] = [];
  for (const side of sides) {
    const hasPillar = (t: number): boolean =>
      !(side.isGate && Math.abs(t - GATE.x) < GATE.halfWidth + 1);
    for (let i = 0; i <= PILLAR_COUNT_PER_SIDE; i++) {
      const t = -half + i * pillarStep;
      const corner = i === 0 || i === PILLAR_COUNT_PER_SIDE;
      if (!hasPillar(t) || (corner && side.rotY !== 0)) continue; // N/S sides own the corners
      pillars.push({ ...side.toXZ(t), rotY: side.rotY, scale: 1 });
    }
    for (let t = -half; t <= half; t += BAR_SPACING) {
      const pillarT = -half + Math.round((t + half) / pillarStep) * pillarStep;
      if (Math.abs(t - pillarT) < 0.35 && hasPillar(pillarT)) continue;
      const inGate = side.isGate && Math.abs(t - GATE.x) < GATE.halfWidth;
      bars.push({ ...side.toXZ(t), rotY: side.rotY, scale: inGate ? 1.25 : 1 });
    }
  }
  for (const sign of [-1, 1]) {
    pillars.push({ x: GATE.x + sign * (GATE.halfWidth + 0.3), z: GATE.z, rotY: 0, scale: GATE_PILLAR_SCALE });
  }

  const iron = new MeshStandardMaterial({ color: 0x1c1c22, metalness: 0.7, roughness: 0.45 });
  const stone = new MeshStandardMaterial({ color: 0x56575c, roughness: 0.95 });

  const bar = new BoxGeometry(0.05, 1.5, 0.05);
  bar.translate(0, 0.75, 0);
  const spike = new ConeGeometry(0.05, 0.16, 4);
  spike.translate(0, 1.58, 0);
  group.add(instance(mergeParts([bar, spike]), iron, bars));

  const column = new BoxGeometry(0.42, PILLAR_HEIGHT, 0.42);
  column.translate(0, PILLAR_HEIGHT / 2, 0);
  const cap = new BoxGeometry(0.56, 0.14, 0.56);
  cap.translate(0, PILLAR_HEIGHT + 0.07, 0);
  group.add(instance(mergeParts([column, cap]), stone, pillars));

  const rails = [0.35, 1.3].flatMap((y) =>
    [-half, half].flatMap((edge) => {
      const ns = new BoxGeometry(half * 2, 0.05, 0.05);
      ns.translate(0, y, edge);
      const ew = new BoxGeometry(0.05, 0.05, half * 2);
      ew.translate(edge, y, 0);
      return [ns, ew];
    }),
  );
  const railMesh = new Mesh(mergeParts(rails), iron);
  railMesh.castShadow = true;
  group.add(railMesh);

  const thickness = 0.4;
  const colliders: Collider[] = [
    box(0, -half, half + 1, thickness),
    box(0, half, half + 1, thickness),
    box(-half, 0, thickness, half + 1),
    box(half, 0, thickness, half + 1),
  ];
  return { group, colliders };
}
