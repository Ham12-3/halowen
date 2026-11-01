import { LANES } from '../game/config';

const MID_LANE = (LANES.count - 1) / 2;

/** World x of a lane's centre: lane 0 is left, the middle lane is x = 0. */
export function laneX(lane: number): number {
  return (lane - MID_LANE) * LANES.width;
}

/** The lane whose centre is closest to world x. */
export function nearestLane(x: number): number {
  return Math.max(0, Math.min(LANES.count - 1, Math.round(x / LANES.width + MID_LANE)));
}
