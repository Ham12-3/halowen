import { DirectionalLight, Group, HemisphereLight } from 'three';
import { ATMOSPHERE } from '../game/config';

/**
 * Cold moonlight plus a dim sky/ground fill: the city sky glows a little orange
 * from below. Most of the ambient light now comes from the night environment
 * map (environment.ts), so the fill stays low. No shadow maps: the world
 * scrolls past constantly, so moving things fake their shadows instead (see
 * the runner's blob shadow).
 */
export function createLighting(): Group {
  const group = new Group();
  group.name = 'lighting';
  group.add(new HemisphereLight(0x46527c, 0x4a2c18, 0.45));

  const { x, y, z } = ATMOSPHERE.moonLightDir;
  const moon = new DirectionalLight(0xa4b6ff, 1.0);
  moon.position.set(x, y, z).normalize().multiplyScalar(100);
  group.add(moon);
  return group;
}
