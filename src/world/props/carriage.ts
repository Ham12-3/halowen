import { BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry } from 'three';
import { TRAIN } from '../../game/config';
import { box, mergeParts, paint, solid } from './geometry';

/** A full carriage fills a block, less the coupling space. */
export const CARRIAGE_LENGTH = TRAIN.blockLength - TRAIN.coupling;
/** The two pieces either side of a gap in the middle of a carriage. */
export const PIECE_LENGTH = (CARRIAGE_LENGTH - TRAIN.gapLength) / 2;

const HALF = TRAIN.width / 2;
const ROOF = TRAIN.roofHeight;
/** Running rails sit this far either side of the track centre (standard gauge). */
export const RAIL_OFFSET = 0.72;

/**
 * Half the body's cross-section, bottom of the right side up to the roof's
 * centreline: a slight tumblehome, straight sides, a rounded cantrail and a
 * gently cambered roof whose crown is the running surface at ROOF.
 */
export const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [HALF - 0.08, 1.0],
  [HALF - 0.01, 1.35],
  [HALF, 1.6],
  [HALF, 2.6],
  [HALF - 0.03, 2.78],
  [HALF - 0.1, 2.94],
  [HALF - 0.22, 3.06],
  [HALF - 0.4, 3.14],
  [HALF - 0.7, 3.185],
  [0, ROOF],
];

/** Distance along the profile from the bottom of the side to each point. */
const ARC = PROFILE.reduce<number[]>((acc, p, i) => {
  const prev = PROFILE[i - 1];
  acc.push(prev ? (acc[i - 1] ?? 0) + Math.hypot(p[0] - prev[0], p[1] - prev[1]) : 0);
  return acc;
}, []);
export const PROFILE_ARC = ARC[ARC.length - 1] ?? 1;
/** Where the roof begins, as a share of the profile arc (texture v): the cantrail's upper edge. */
export const ROOF_START = (ARC[5] ?? 0) / PROFILE_ARC;

/** Arc length up the side to height y (the side is the profile's lower, near-vertical part). */
export function arcAtHeight(y: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const a = PROFILE[i - 1];
    const b = PROFILE[i];
    if (!a || !b || y > b[1]) continue;
    const t = (y - a[1]) / (b[1] - a[1]);
    return (ARC[i - 1] ?? 0) + t * ((ARC[i] ?? 0) - (ARC[i - 1] ?? 0));
  }
  return PROFILE_ARC;
}

/**
 * The carriage body swept along Z, centred on the origin. Texture u runs along
 * the carriage (a full carriage spans u 0..1; pieces use their share of it),
 * v climbs each side from the bottom (0) over the cantrail to the roof's centre (1).
 */
export function createShell(length: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const u1 = length / CARRIAGE_LENGTH;
  const normalAt = (k: number): [number, number] => {
    const a = PROFILE[Math.max(0, k - 1)] ?? [0, 0];
    const b = PROFILE[Math.min(PROFILE.length - 1, k + 1)] ?? [0, 0];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
  };
  for (const side of [1, -1]) {
    for (let k = 0; k < PROFILE.length - 1; k++) {
      const quad = [k, k + 1].map((i) => {
        const [x, y] = PROFILE[i] ?? [0, 0];
        const [nx, ny] = normalAt(i);
        return { x: x * side, y, nx: nx * side, ny, v: (ARC[i] ?? 0) / PROFILE_ARC };
      });
      const [lo, hi] = quad as [(typeof quad)[0], (typeof quad)[0]];
      const corners = [
        [lo, -length / 2, 0],
        [lo, length / 2, u1],
        [hi, length / 2, u1],
        [hi, -length / 2, 0],
      ] as const;
      // Two triangles, wound to face outwards on either side.
      const order = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const i of order) {
        const [p, z, u] = corners[i] ?? corners[0];
        positions.push(p.x, p.y, z);
        normals.push(p.nx, p.ny, 0);
        uvs.push(u, p.v);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return g;
}

/** The full cross-section as a flat shape, for end walls and the cab. */
function sectionShape(): Shape {
  const shape = new Shape();
  const right = PROFILE.map(([x, y]) => [x, y] as const);
  const left = [...PROFILE].reverse().map(([x, y]) => [-x, y] as const);
  const outline = [...right, ...left.slice(1)];
  outline.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  return shape;
}

/** A wheelset pair and frame: one bogie centred at z. */
function bogie(z: number): BufferGeometry[] {
  const parts = [box(1.9, 0.32, 2.5, 0, 0.62, z, 0x1b1c1f), box(2.1, 0.14, 0.5, 0, 0.82, z, 0x26272a)];
  for (const dz of [-0.85, 0.85]) {
    for (const x of [-RAIL_OFFSET, RAIL_OFFSET]) {
      parts.push(solid(new CylinderGeometry(0.42, 0.42, 0.12, 10).rotateZ(Math.PI / 2).translate(x, 0.42, z + dz), 0x38393c));
    }
  }
  return parts;
}

/** Everything under and at the ends of the body: equipment cases, bogies and end walls. */
export function createUnderframe(length: number): BufferGeometry {
  const full = length > PIECE_LENGTH + 1;
  const parts = [box(TRAIN.width - 0.5, 0.42, length * (full ? 0.55 : 0.6), 0, 0.78, 0, 0x2a2b2e)];
  if (full) parts.push(...bogie(-length / 2 + 2.1), ...bogie(length / 2 - 2.1));
  for (const end of [-1, 1]) {
    const wall = new ShapeGeometry(sectionShape());
    if (end > 0) wall.translate(0, 0, length / 2);
    else wall.rotateY(Math.PI).translate(0, 0, -length / 2);
    parts.push(solid(wall, 0xc9ccd0));
  }
  return mergeParts(parts);
}

/** The rubber gangway and coupler bridging two carriages, centred on the coupling. */
export function createGangway(): BufferGeometry {
  const span = TRAIN.coupling + 0.1;
  const parts = [box(TRAIN.width - 0.55, 2.05, span, 0, 2.02, 0, 0x121214), box(0.32, 0.26, span, 0, 0.95, 0, 0x2b2b2d)];
  for (const dz of [-0.24, 0, 0.24]) parts.push(box(TRAIN.width - 0.45, 2.15, 0.06, 0, 2.02, dz, 0x1d1d20));
  return mergeParts(parts);
}

/**
 * A driving cab's front, origin at the body's end and protruding towards +z:
 * yellow warning panel, black windscreens either side of a gangway door.
 */
export function createCab(): BufferGeometry {
  const nose = new ExtrudeGeometry(sectionShape(), { depth: 0.32, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.08, bevelSegments: 2 });
  nose.deleteAttribute('uv');
  const pos = nose.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < (pos?.count ?? 0); i++) {
    const y = pos?.getY(i) ?? 0;
    const c = y < 1.95 ? [0.86, 0.62, 0.02] : y < 2.9 ? [0.012, 0.012, 0.014] : [0.62, 0.63, 0.65];
    colors.push(...c);
  }
  nose.setAttribute('color', new Float32BufferAttribute(colors, 3));
  const face = 0.42;
  return mergeParts([
    nose,
    box(0.78, 1.95, 0.04, 0, 1.95, face, 0x2a2b2e), // gangway door
    box(0.4, 0.6, 0.03, 0, 2.45, face + 0.02, 0x07080a), // its window
    box(1.6, 0.12, 0.3, 0, 0.95, 0.2, 0x1a1a1c), // buffer beam
  ]);
}

/** Head, tail and marker lamps on the cab front: white light (and red tails) to glow through the bloom. */
export function createCabLamps(): BufferGeometry {
  const face = 0.43;
  const parts: BufferGeometry[] = [];
  for (const x of [-0.78, 0.78]) {
    parts.push(paint(box(0.3, 0.13, 0.04, x, 1.42, face, 0xffffff), 0xffffff));
    parts.push(box(0.14, 0.1, 0.04, x * 1.12, 1.24, face, 0x500402)); // dimmer: very bright red washes out to pink on film
  }
  parts.push(box(0.16, 0.1, 0.04, 0, 3.0, face - 0.05, 0xffffff));
  return mergeParts(parts);
}
