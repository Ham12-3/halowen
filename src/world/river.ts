import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
} from 'three';
import { ROUTE } from '../game/config';
import { getGlowTexture } from './props/glowTexture';
import { STREET_Y } from './props/obstacles';

/** How far the water stretches either side of the line, and the gap between embankment lamps. */
const WIDTH = 1000;
const LAMP_SPACING = 12;

/**
 * The Thames at each crossing: dark water that catches the moonlight, with
 * strings of embankment lamps along both banks. The viaduct carries straight
 * on over it, so the crossing reads as a railway bridge.
 */
export function createRivers(): Group {
  const group = new Group();
  group.name = 'thames';
  const water = new MeshStandardMaterial({ color: 0x0b1828, roughness: 0.2, metalness: 0.7 });
  const lamps: number[] = [];

  for (const [from, to] of ROUTE.rivers) {
    const mesh = new Mesh(new PlaneGeometry(WIDTH, to - from).rotateX(-Math.PI / 2), water);
    mesh.position.set(0, STREET_Y + 0.3, -(from + to) / 2);
    group.add(mesh);
    for (const bank of [from, to]) {
      for (let x = -WIDTH / 2; x <= WIDTH / 2; x += LAMP_SPACING) {
        if (Math.abs(x) < 10) continue; // the viaduct itself
        lamps.push(x, STREET_Y + 4, -bank);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(lamps, 3));
  group.add(
    new Points(
      geometry,
      new PointsMaterial({ size: 3, map: getGlowTexture(), color: 0xffc97a, transparent: true, depthWrite: false }),
    ),
  );
  return group;
}
