import { DirectionalLight, Group, HemisphereLight, Vector3 } from 'three';
import { ATMOSPHERE, RENDER, WORLD } from '../game/config';

/** Cold moonlight with shadows plus a dim sky/ground fill so nothing is pitch black. */
export function createLighting(): Group {
  const group = new Group();
  group.name = 'lighting';

  const hemi = new HemisphereLight(0x5b6ca8, 0x1c150f, 1.7);
  group.add(hemi);

  const { x, y, z } = ATMOSPHERE.moonLightDir;
  const moon = new DirectionalLight(0xa8bcff, 1.4);
  moon.position.copy(new Vector3(x, y, z).normalize().multiplyScalar(90));
  moon.castShadow = true;

  // Wide enough to include the town houses and church so they shade the churchyard.
  const extent = WORLD.halfSize + 20;
  const cam = moon.shadow.camera;
  cam.left = -extent;
  cam.right = extent;
  cam.top = extent;
  cam.bottom = -extent;
  cam.near = 10;
  cam.far = 200;
  moon.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
  moon.shadow.bias = -0.0004;
  moon.shadow.normalBias = 0.04;
  group.add(moon);

  return group;
}
