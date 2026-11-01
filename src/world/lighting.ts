import { DirectionalLight, Group, HemisphereLight } from 'three';
import { ATMOSPHERE } from '../game/config';

/**
 * Cold moonlight plus a sky/ground fill: the city sky glows a little orange
 * from below. No shadow maps: the world scrolls past constantly, so moving
 * things fake their shadows instead (see the runner's blob shadow).
 */
export function createLighting(): Group {
  const group = new Group();
  group.name = 'lighting';
  group.add(new HemisphereLight(0x5b6ca8, 0x3a2418, 1.6));

  const { x, y, z } = ATMOSPHERE.moonLightDir;
  const moon = new DirectionalLight(0xa8bcff, 1.3);
  moon.position.set(x, y, z).normalize().multiplyScalar(100);
  group.add(moon);
  return group;
}
