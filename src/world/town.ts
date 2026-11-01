import { WORLD } from '../game/config';
import { CHURCH_HALF_WIDTH } from './props/church';
import { HOUSE_DEPTH, HOUSE_VARIANT_COUNT, type HousePlacement, houseWidth } from './props/houses';
import { createRng, type Rng } from './rng';

/**
 * The old town wrapped around the churchyard: a cobbled street runs just
 * outside the fence, lined by two rows of half-timbered houses. Gaps in the
 * rows become side streets that disappear into the fog.
 */

export const STREET_WIDTH = 7;
/** Line where the first row of house fronts stands. */
const FRONT = WORLD.halfSize + STREET_WIDTH;
const ROW_SPACING = HOUSE_DEPTH + 1;

/** The church faces the churchyard from beyond the north fence. */
export const CHURCH = { x: 0, z: -FRONT };

interface Gap {
  center: number;
  half: number;
}

type SideName = 'north' | 'south' | 'east' | 'west';

/** Gaps along each side, in that side's own coordinate (x for N/S, z for E/W). */
const GAPS: Record<SideName, Gap[]> = {
  north: [{ center: CHURCH.x, half: CHURCH_HALF_WIDTH }, { center: -26, half: 3 }],
  south: [{ center: 0, half: 4 }, { center: 24, half: 3 }],
  east: [{ center: 4, half: 3 }, { center: -20, half: 3 }],
  west: [{ center: 4, half: 3 }, { center: 18, half: 3 }],
};

const MIN_WIDTH = Math.min(...Array.from({ length: HOUSE_VARIANT_COUNT }, (_, v) => houseWidth(v)));

/** Packs houses along [from, to], skipping gaps. Calls `place` with each house centre. */
function fillRow(rng: Rng, from: number, to: number, gaps: Gap[], place: (t: number, variant: number) => void): void {
  let t = from;
  while (t < to - MIN_WIDTH / 2) {
    const next = gaps.filter((g) => g.center + g.half > t).sort((a, b) => a.center - b.center)[0];
    const room = next ? next.center - next.half - t : Infinity;
    if (room < MIN_WIDTH) {
      if (!next) break;
      t = next.center + next.half;
      continue;
    }
    // Pick a random variant that fits before the next gap.
    const fitting = Array.from({ length: HOUSE_VARIANT_COUNT }, (_, v) => v).filter((v) => houseWidth(v) <= room);
    const variant = fitting[Math.floor(rng() * fitting.length)] ?? 0;
    const w = houseWidth(variant);
    place(t + w / 2, variant);
    t += w;
  }
}

export function generateTown(): HousePlacement[] {
  const rng = createRng(WORLD.seed + 7);
  const houses: HousePlacement[] = [];

  for (let row = 0; row < 2; row++) {
    const front = FRONT + row * ROW_SPACING;
    const centre = front + HOUSE_DEPTH / 2;
    // North and south rows run past the corners so the blocks close up.
    const long = front + HOUSE_DEPTH;
    const sides: Array<{ name: SideName; span: number; at: (t: number) => { x: number; z: number }; rotY: number }> = [
      { name: 'north', span: long, at: (t) => ({ x: t, z: -centre }), rotY: 0 },
      { name: 'south', span: long, at: (t) => ({ x: t, z: centre }), rotY: Math.PI },
      { name: 'west', span: front, at: (t) => ({ x: -centre, z: t }), rotY: Math.PI / 2 },
      { name: 'east', span: front, at: (t) => ({ x: centre, z: t }), rotY: -Math.PI / 2 },
    ];
    for (const side of sides) {
      fillRow(rng, -side.span, side.span, GAPS[side.name], (t, variant) => {
        houses.push({ ...side.at(t), rotY: side.rotY, scale: 1, variant });
      });
    }
  }
  return houses;
}
