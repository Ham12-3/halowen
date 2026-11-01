import { ROUTE } from './config';

/** Helpers for the station-to-station route. Distances are metres along the line. */

export interface Station {
  name: string;
  /** Distance along the line. */
  at: number;
}

export const STATIONS: readonly Station[] = ROUTE.stations;
export const STAGE_COUNT = STATIONS.length - 1;
export const FINISH: number = STATIONS[STATIONS.length - 1]?.at ?? 0;

function station(index: number): Station {
  return STATIONS[Math.max(0, Math.min(STATIONS.length - 1, index))] ?? { name: '', at: 0 };
}

/** The stage being run at `distance`: 0 for the first stretch, up to STAGE_COUNT - 1. */
export function stageAt(distance: number): number {
  let stage = 0;
  for (let i = 1; i < STATIONS.length - 1; i++) if (distance >= station(i).at) stage = i;
  return stage;
}

/** The stations at either end of a stage. */
export function stageEnds(stage: number): { from: Station; to: Station } {
  return { from: station(stage), to: station(stage + 1) };
}

/** Top speed allowed on the stage being run at `distance`. */
export function speedCapAt(distance: number): number {
  return ROUTE.stageSpeeds[stageAt(distance)] ?? ROUTE.stageSpeeds[ROUTE.stageSpeeds.length - 1] ?? 20;
}

/** The fastest the line ever goes (end of the last stage). */
export const TOP_SPEED: number = Math.max(...ROUTE.stageSpeeds);

/** True within `before` metres before or `after` metres after any station (including the start). */
export function nearStation(distance: number, before: number, after: number): boolean {
  return STATIONS.some((s) => distance > s.at - before && distance < s.at + after);
}

/** True if `distance` is over the Thames (widened by `margin`). */
export function overRiver(distance: number, margin = 0): boolean {
  return ROUTE.rivers.some(([from, to]) => distance > from - margin && distance < to + margin);
}
