import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointsMaterial,
  SphereGeometry,
} from 'three';
import { mergeParts } from '../world/props/geometry';
import { getGlowTexture } from '../world/props/glowTexture';

/** Height of the wax column; the flame sits on top of it. */
export const WAX_HEIGHT = 0.3;
export const SOUL_COLOR = 0x5fd8ff;

function paint(geo: BufferGeometry, hex: number): BufferGeometry {
  const count = geo.attributes.position?.count ?? 0;
  const colors = new Float32Array(count * 3);
  const c = new Color(hex);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

/** Pale wax candle standing in a little iron dish. Origin at the dish base. */
export function createCandleBodyGeometry(): BufferGeometry {
  const wax = new CylinderGeometry(0.07, 0.08, WAX_HEIGHT, 10);
  wax.translate(0, WAX_HEIGHT / 2 + 0.03, 0);
  const drip = new CylinderGeometry(0.02, 0.025, 0.12, 5);
  drip.translate(0.07, WAX_HEIGHT - 0.03, 0.02);
  const dish = new CylinderGeometry(0.15, 0.11, 0.04, 12);
  dish.translate(0, 0.02, 0);
  const wick = new CylinderGeometry(0.006, 0.006, 0.04, 4);
  wick.translate(0, WAX_HEIGHT + 0.05, 0);
  return mergeParts([paint(wax, 0xe2dccb), paint(drip, 0xe2dccb), paint(dish, 0x2a2626), paint(wick, 0x111111)]);
}

/** Teardrop flame with its base at the origin. */
export function createFlameGeometry(): BufferGeometry {
  const flame = new SphereGeometry(0.05, 10, 8);
  flame.scale(1, 1.9, 1);
  flame.translate(0, 0.08, 0);
  return flame;
}

export function createCandleMaterials(): {
  body: MeshStandardMaterial;
  flame: MeshBasicMaterial;
  halo: PointsMaterial;
} {
  return {
    // A faint teal self-glow keeps the wax readable in the dark.
    body: new MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x0f2a2e }),
    flame: new MeshBasicMaterial({ color: 0xd8fbff }),
    halo: new PointsMaterial({
      size: 1.5,
      map: getGlowTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      // Unfogged so the souls shimmer through the mist and guide the player.
      fog: false,
    }),
  };
}
