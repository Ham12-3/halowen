import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  Path,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { GROUND_HALF } from './ground';
import { createRng } from './rng';

/** Metres covered by one repeat of the cobble texture. */
const TILE_METRES = 3;
const STREETS_HALF = GROUND_HALF + 80;

/** Running-bond cobblestones drawn onto a canvas. Lighter stones double as the bump map. */
function createCobbleTexture(size = 512): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  ctx.fillStyle = '#1a1816';
  ctx.fillRect(0, 0, size, size);
  const rng = createRng(5);
  const rows = 8;
  const cols = 8;
  const h = size / rows;
  const w = size / cols;
  for (let r = 0; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * w + (r % 2) * (w / 2) + (rng() - 0.5) * 4;
      const y = r * h + (rng() - 0.5) * 4;
      const tone = 70 + Math.floor(rng() * 45);
      ctx.fillStyle = `rgb(${tone + 8}, ${tone + 2}, ${tone - 6})`;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 10);
      ctx.fill();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / TILE_METRES, 1 / TILE_METRES);
  texture.anisotropy = 8;
  return texture;
}

/** A large cobbled square with a hole where the churchyard grass sits. */
export function createStreets(): Mesh {
  const outer = new Shape();
  outer.moveTo(-STREETS_HALF, -STREETS_HALF);
  outer.lineTo(STREETS_HALF, -STREETS_HALF);
  outer.lineTo(STREETS_HALF, STREETS_HALF);
  outer.lineTo(-STREETS_HALF, STREETS_HALF);
  outer.closePath();

  const hole = new Path();
  hole.moveTo(-GROUND_HALF, -GROUND_HALF);
  hole.lineTo(-GROUND_HALF, GROUND_HALF);
  hole.lineTo(GROUND_HALF, GROUND_HALF);
  hole.lineTo(GROUND_HALF, -GROUND_HALF);
  hole.closePath();
  outer.holes.push(hole);

  // ShapeGeometry UVs are the shape coordinates in metres, so the texture repeat sets the scale.
  const geometry = new ShapeGeometry(outer);
  geometry.rotateX(-Math.PI / 2);

  const cobbles = createCobbleTexture();
  const mesh = new Mesh(
    geometry,
    new MeshStandardMaterial({ map: cobbles, bumpMap: cobbles, bumpScale: 1.2, roughness: 0.85 }),
  );
  mesh.name = 'streets';
  mesh.receiveShadow = true;
  return mesh;
}
