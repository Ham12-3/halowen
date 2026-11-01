import {
  type BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { mergeParts } from '../world/props/geometry';

/** Centre height and radius of the domed head; the face sits on its front (-Z). */
const HEAD_Y = 1.12;
const HEAD_R = 0.44;
const HEM_WAVES = 7;

/** Classic bedsheet ghost: domed head flaring to a wavy hem, with two stubby arms. */
export function createGhostBodyGeometry(): BufferGeometry {
  const profile = [new Vector2(0.6, 0), new Vector2(0.56, 0.18), new Vector2(0.5, 0.5), new Vector2(0.46, 0.85)];
  for (let deg = 0; deg <= 90; deg += 15) {
    const a = (deg * Math.PI) / 180;
    profile.push(new Vector2(Math.max(HEAD_R * Math.cos(a), 0), HEAD_Y + HEAD_R * Math.sin(a)));
  }
  const sheet = new LatheGeometry(profile, 22);

  // Ripple the bottom edge so the sheet looks like it is trailing in a breeze.
  const pos = sheet.attributes.position;
  if (pos) {
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.2) continue;
      const theta = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, y + Math.sin(theta * HEM_WAVES) * 0.09 * (1 - y / 0.2));
    }
    sheet.computeVertexNormals();
  }

  const arms = [1, -1].map((side) => {
    const arm = new ConeGeometry(0.11, 0.42, 8);
    arm.rotateZ(-side * (Math.PI / 2 + 0.4));
    arm.translate(side * 0.5, 0.8, 0);
    return arm;
  });
  return mergeParts([sheet, ...arms]);
}

/** A flat oval moulded onto the front of the head. */
function facePatch(x: number, y: number, sx: number, sy: number): BufferGeometry {
  const patch = new CircleGeometry(1, 16);
  patch.scale(sx, sy, 1);
  patch.rotateY(Math.PI); // face -Z, the ghost's front
  const dy = Math.max(0, y - HEAD_Y);
  const z = -Math.sqrt(Math.max(0.01, HEAD_R * HEAD_R - x * x - dy * dy));
  const normal = new Vector3(x, dy, z).normalize();
  patch.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 0, -1), normal));
  patch.translate(x + normal.x * 0.015, y + normal.y * 0.015, z + normal.z * 0.015);
  return patch;
}

/** Two hollow eyes and a wailing "O" mouth, tinted per instance (dark, or red when hunting). */
export function createGhostFaceGeometry(): BufferGeometry {
  return mergeParts([
    facePatch(-0.14, 1.2, 0.065, 0.1),
    facePatch(0.14, 1.2, 0.065, 0.1),
    facePatch(0, 1.0, 0.055, 0.08),
  ]);
}

export function createGhostMaterials(): { body: MeshStandardMaterial; face: MeshBasicMaterial } {
  return {
    body: new MeshStandardMaterial({
      color: 0xe8efff,
      emissive: 0x4a62a0,
      emissiveIntensity: 0.55,
      roughness: 0.5,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
    face: new MeshBasicMaterial({ color: 0xffffff }),
  };
}
