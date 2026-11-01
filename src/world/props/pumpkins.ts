import { type BufferGeometry, CylinderGeometry, Shape, ShapeGeometry, SphereGeometry } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { paint } from './geometry';

/** Unit pumpkin: radius 1 on X/Z, squashed to this height on Y, face pointing -Z. */
export const PUMPKIN_SQUASH = 0.72;
const SQUASH = PUMPKIN_SQUASH;

function ribFactor(theta: number): number {
  return 0.9 + 0.1 * Math.abs(Math.cos(theta * 4));
}

/** Ribbed pumpkin body plus stem, coloured via vertex colours. */
export function createPumpkinBodyGeometry(): BufferGeometry {
  const sphere = new SphereGeometry(1, 18, 12);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const body = mergeVertices(sphere); // weld the UV seam so normals are smooth
  const pos = body.attributes.position;
  if (!pos) throw new Error('Pumpkin geometry has no positions');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const rib = ribFactor(Math.atan2(z, x));
    const rXZ = Math.sqrt(x * x + z * z);
    pos.setXYZ(i, x * rib, y * SQUASH * (1 - 0.2 * (1 - rXZ) ** 2), z * rib);
  }
  body.computeVertexNormals();
  paint(body, 0xd8670f);

  const stem = new CylinderGeometry(0.07, 0.12, 0.34, 6);
  stem.deleteAttribute('uv');
  stem.rotateZ(0.25);
  stem.translate(0.03, 0.68, 0);
  paint(stem, 0x3e4a1a);

  const merged = mergeGeometries([body, stem], false);
  if (!merged) throw new Error('Could not merge pumpkin geometry');
  return merged;
}

/** Jack-o-lantern face (eyes, nose, grin) wrapped onto the front of the unit pumpkin. */
export function createPumpkinFaceGeometry(): BufferGeometry {
  const eye = (cx: number): Shape => {
    const s = new Shape();
    s.moveTo(cx - 0.16, 0.1);
    s.lineTo(cx + 0.16, 0.1);
    s.lineTo(cx, 0.34);
    s.closePath();
    return s;
  };
  const nose = new Shape();
  nose.moveTo(-0.06, -0.04);
  nose.lineTo(0.06, -0.04);
  nose.lineTo(0, 0.06);
  nose.closePath();

  const grin = new Shape();
  const outline: Array<[number, number]> = [
    [-0.46, -0.1], [-0.3, -0.18], [-0.2, -0.08], [-0.1, -0.2],
    [0.1, -0.2], [0.2, -0.08], [0.3, -0.18], [0.46, -0.1],
    [0.3, -0.36], [0, -0.44], [-0.3, -0.36],
  ];
  outline.forEach(([x, y], i) => (i === 0 ? grin.moveTo(x, y) : grin.lineTo(x, y)));
  grin.closePath();

  const face = new ShapeGeometry([eye(-0.2), eye(0.2), nose, grin], 4);
  face.rotateY(Math.PI); // now faces -Z, matching the pumpkin front
  const pos = face.attributes.position;
  if (!pos) throw new Error('Face geometry has no positions');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const ySphere = pos.getY(i) / SQUASH;
    const flatR = Math.sqrt(Math.max(0, 1 - ySphere * ySphere));
    const rough = -Math.sqrt(Math.max(0, flatR * flatR - x * x));
    const r = flatR * ribFactor(Math.atan2(rough, x));
    pos.setZ(i, -Math.sqrt(Math.max(0, r * r - x * x)) - 0.02);
  }
  return face;
}
