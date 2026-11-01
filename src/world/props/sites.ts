import { overRiver, STATIONS } from '../../game/route';

/**
 * Where every landmark stands: `at` is distance along the line, `x` the side
 * offset (negative is left of the track). Positions are stylised, not a map:
 * the line runs straight while London's sights pass by on either side.
 */
export const SITES = {
  shard: { at: 280, x: -62 },
  // Landmarks sit within ~75 m of the line so they come into the camera's view ahead, not beside it.
  stPauls: { at: 1150, x: -74 },
  eye: { at: 1830, x: -125 },
  bigBen: { at: 3860, x: 40 },
  /** The Houses of Parliament run along the right of the line for `length` metres. */
  parliament: { at: 3880, x: 88, length: 260 },
  towerBridge: { at: 6360, x: 70 },
} as const;

/** Ground the skyline must leave free around each single landmark (radius in metres). */
const FOOTPRINTS = [
  { ...SITES.shard, r: 42 },
  { ...SITES.stPauls, r: 58 },
  { ...SITES.eye, r: 80 },
  { ...SITES.bigBen, r: 16 },
];

/** Station sheds and their forecourts span this far either side of the track. */
const STATION_HALF_WIDTH = 46;

/** True if a building of radius `r` centred at world (x, z) keeps clear of the landmarks, stations and river. */
export function landmarkClear(x: number, z: number, r: number): boolean {
  const at = -z;
  if (overRiver(at, r + 8)) return false;
  if (STATIONS.some((s) => s.at > 0 && at > s.at - 30 - r && at < s.at + 140 + r && Math.abs(x) < STATION_HALF_WIDTH + r)) {
    return false;
  }
  const p = SITES.parliament;
  if (x > 50 - r && at > p.at - 12 - r && at < p.at + p.length + 12 + r) return false;
  return FOOTPRINTS.every((f) => Math.hypot(x - f.x, at - f.at) > f.r + r);
}
