import type { Vector3 } from 'three';
import type { Particles } from '../world/Particles';

/**
 * Particle recipes for the run's moments. `at` is the runner's feet (world
 * space); the world doesn't move, so bursts stay where they happened and the
 * runner carries on through them.
 */

/** Cyan sparkles drifting up from the runner's chest as souls are gathered. */
export function soulSparkle(p: Particles, at: Vector3, souls: number): void {
  p.burst({ x: at.x, y: at.y + 1.1, z: at.z - 0.6, count: Math.min(14, souls * 6), color: 0x7fe8ff, speed: 2.2, lift: 1.4, gravity: -1.5, life: 0.55 });
}

/** A low puff of grit when landing from a jump. */
export function landingDust(p: Particles, at: Vector3): void {
  p.burst({ x: at.x, y: at.y + 0.08, z: at.z, count: 10, color: 0x6a6258, speed: 2.4, flatten: 0.15, gravity: 2, life: 0.45, spread: 0.5 });
}

/** Orange sparks and grit when you hit something (bigger when the run ends). */
export function hitSparks(p: Particles, at: Vector3, big: boolean): void {
  p.burst({ x: at.x, y: at.y + 0.9, z: at.z - 0.4, count: big ? 46 : 26, color: 0xff7a2a, speed: big ? 7 : 5, lift: 1.5, gravity: 9, life: 0.7 });
  p.burst({ x: at.x, y: at.y + 0.4, z: at.z - 0.4, count: big ? 18 : 10, color: 0xffd08a, speed: 3, gravity: 6, life: 0.5 });
}

/** Pale wisps rising where a ghost was banished or dispersed. */
export function ghostWisps(p: Particles, x: number, y: number, z: number): void {
  p.burst({ x, y, z, count: 20, color: 0xbcd4ff, speed: 1.6, lift: 1.8, gravity: -1.2, life: 0.9, spread: 0.8 });
}

/** A golden ring of light when the lantern flare lights. */
export function flareBurst(p: Particles, at: Vector3): void {
  p.burst({ x: at.x, y: at.y + 1.0, z: at.z, count: 50, color: 0xffb347, speed: 8, flatten: 0.35, life: 0.65, spread: 0.3 });
  p.burst({ x: at.x, y: at.y + 1.0, z: at.z, count: 20, color: 0xfff0c8, speed: 3, lift: 2, gravity: -1, life: 0.8 });
}

/** A couple of embers trailing off the blazing lantern each step of the flare. */
export function lanternEmbers(p: Particles, at: Vector3): void {
  p.burst({ x: at.x + 0.36, y: at.y + 0.7, z: at.z + 0.2, count: 2, color: 0xff9a3c, speed: 0.8, lift: 1.2, gravity: -0.6, life: 0.5, spread: 0.15 });
}

/** A shower of gold as you pass through a station. */
export function stationShower(p: Particles, at: Vector3): void {
  p.burst({ x: at.x, y: at.y + 3, z: at.z - 3, count: 60, color: 0xffd36b, speed: 4, gravity: 3, life: 1.1, spread: 3 });
}
