import { type BufferGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { TRAIN } from '../../game/config';
import { box, mergeParts } from './geometry';

/** A full carriage fills a block, less the coupling space. */
export const CARRIAGE_LENGTH = TRAIN.blockLength - TRAIN.coupling;
/** The two pieces either side of a gap in the middle of a carriage. */
export const PIECE_LENGTH = (CARRIAGE_LENGTH - TRAIN.gapLength) / 2;

const W = TRAIN.width;
const ROOF = TRAIN.roofHeight;
const COLORS = {
  under: 0x16161a,
  skirt: 0x1d3b8f, // Underground blue
  body: 0xd3d7dd,
  roof: 0x5a5e66,
  door: 0xc8102e, // Underground red
};

/** Both sides of the carriage get a part at ±x. */
function bothSides(make: (side: number) => BufferGeometry): BufferGeometry[] {
  return [make(-1), make(1)];
}

/** Carriage shell along Z, centred on the origin, wheels on the rails at y = 0, roof at ROOF. */
export function createCarriageBody(length: number): BufferGeometry {
  const parts = [
    box(W - 0.4, 0.55, length * 0.92, 0, 0.275, 0, COLORS.under),
    box(W + 0.02, 0.35, length, 0, 0.725, 0, COLORS.skirt),
    box(W, ROOF - 1.0, length, 0, 0.9 + (ROOF - 1.0) / 2 - 0.1, 0, COLORS.body),
    box(W - 0.12, 0.12, length - 0.1, 0, ROOF - 0.06, 0, COLORS.roof),
  ];
  // Red sliding doors: two on a full carriage, one on each piece beside a gap.
  const doors = length > PIECE_LENGTH + 1 ? [-0.25, 0.25] : [0];
  for (const at of doors) {
    parts.push(...bothSides((s) => box(0.05, 2.0, 1.3, s * (W / 2 + 0.01), 1.9, at * length, COLORS.door)));
  }
  return mergeParts(parts);
}

/** The lit windows, drawn unlit so they glow at night. Same frame as the body. */
export function createCarriageWindows(length: number): BufferGeometry {
  const full = length > PIECE_LENGTH + 1;
  // Windows sit between the doors: [centre along the carriage (fraction), width in metres].
  const panes: Array<[number, number]> = full ? [[-0.41, 1.6], [0, 3.4], [0.41, 1.6]] : [[-0.32, 0.9], [0.32, 0.9]];
  const parts: BufferGeometry[] = [];
  for (const [at, width] of panes) {
    parts.push(...bothSides((s) => box(0.04, 0.8, width, s * (W / 2 + 0.02), 2.3, at * length, 0xffffff)));
  }
  // The end windows, so a train coming into view reads as lit from the front too.
  parts.push(box(1.4, 0.7, 0.04, 0, 2.35, -length / 2 - 0.02, 0xffffff));
  return mergeParts(parts);
}

export function createCarriageMaterials(): { body: MeshStandardMaterial; windows: MeshBasicMaterial } {
  return {
    body: new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 }),
    windows: new MeshBasicMaterial({ color: 0xffd896 }),
  };
}
