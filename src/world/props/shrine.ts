import { BoxGeometry, type BufferGeometry, ConeGeometry, Group, MeshStandardMaterial } from 'three';
import type { ShrineSpot } from '../layout';
import { instance, mergeParts, type Placement } from './geometry';
import { createPumpkinBodyGeometry } from './pumpkins';

/** Half the width of the square stone base; shrines collide as axis-aligned boxes. */
export const SHRINE_HALF_SIZE = 0.7;
/** Height of the capstone the big pumpkin rests on. */
const ALTAR_TOP = 0.95;
const PUMPKIN_SCALE = 0.5;
/** The unit pumpkin is squashed to this height on Y (see pumpkins.ts). */
const PUMPKIN_SQUASH = 0.72;

/** The big jack-o'-lantern on top. Shared with the Shrines entity, which draws its glowing face. */
export function shrinePumpkin(s: ShrineSpot): Placement {
  return { x: s.x, y: ALTAR_TOP + PUMPKIN_SCALE * PUMPKIN_SQUASH - 0.03, z: s.z, rotY: s.rotY, scale: PUMPKIN_SCALE };
}

/** Two small offering pumpkins on the front step, either side of the plinth. */
function offerings(s: ShrineSpot): Placement[] {
  const scale = 0.16;
  const cos = Math.cos(s.rotY);
  const sin = Math.sin(s.rotY);
  const lz = -0.6; // the shrine's front is local -Z, the way the pumpkin faces
  return [-0.42, 0.42].map((lx) => ({
    x: s.x + lx * cos + lz * sin,
    y: 0.22 + scale * PUMPKIN_SQUASH,
    z: s.z - lx * sin + lz * cos,
    rotY: s.rotY + lx,
    scale,
  }));
}

/** Stepped stone altar: base step, plinth, capstone and four corner finials. */
function createAltarGeometry(): BufferGeometry {
  const step = new BoxGeometry(SHRINE_HALF_SIZE * 2, 0.22, SHRINE_HALF_SIZE * 2).translate(0, 0.11, 0);
  const plinth = new BoxGeometry(0.95, 0.6, 0.95).translate(0, 0.52, 0);
  const cap = new BoxGeometry(1.15, 0.13, 1.15).translate(0, ALTAR_TOP - 0.065, 0);
  const finials = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz) => new ConeGeometry(0.07, 0.24, 4).translate(sx * 0.49, ALTAR_TOP + 0.12, sz * 0.49)),
  );
  return mergeParts([step, plinth, cap, ...finials]);
}

/** The static part of every shrine (stone and pumpkin bodies); the glow lives in entities/Shrines. */
export function createShrines(spots: readonly ShrineSpot[]): Group {
  const group = new Group();
  group.name = 'shrines';
  const stone = new MeshStandardMaterial({ color: 0x8a8590, roughness: 0.95 });
  group.add(instance(createAltarGeometry(), stone, spots.map((s) => ({ x: s.x, z: s.z, rotY: s.rotY, scale: 1 }))));

  const skin = new MeshStandardMaterial({ vertexColors: true, roughness: 0.65 });
  const pumpkins = spots.flatMap((s) => [shrinePumpkin(s), ...offerings(s)]);
  group.add(instance(createPumpkinBodyGeometry(), skin, pumpkins));
  return group;
}
