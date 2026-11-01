import { Color, Float32BufferAttribute, MathUtils, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { WORLD } from '../game/config';
import { pathDistance } from './layout';
import { fbm } from './rng';

/** Grass stops just past the fence, where the cobbled streets take over. */
export const GROUND_HALF = WORLD.halfSize + 0.5;
const SEGMENTS = 96;

const GRASS = new Color(0x1c2716);
const GRASS_ALT = new Color(0x27301a);
const DIRT = new Color(0x2c2219);
const PATH = new Color(0x3d3329);

/** Churchyard ground with vertex-colour variation: grass, dirt patches and worn paths. */
export function createGround(): Mesh {
  const geometry = new PlaneGeometry(GROUND_HALF * 2, GROUND_HALF * 2, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position;
  if (!pos) throw new Error('Ground geometry has no positions');
  const colors = new Float32Array(pos.count * 3);
  const c = new Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    c.lerpColors(GRASS, GRASS_ALT, fbm(x * 0.15, z * 0.15, 3));
    const dirt = MathUtils.smoothstep(fbm(x * 0.07, z * 0.07, 9), 0.55, 0.7);
    c.lerp(DIRT, dirt * 0.8);

    const path = 1 - MathUtils.smoothstep(pathDistance(x, z), -0.5, 0.6);
    c.lerp(PATH, path);

    c.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));

  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  mesh.name = 'ground';
  mesh.receiveShadow = true;
  return mesh;
}
