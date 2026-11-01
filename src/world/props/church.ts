import {
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  TorusGeometry,
} from 'three';
import { mergeParts } from './geometry';
import { createRoseWindowTexture } from './stainedGlass';

const NAVE_W = 12;
const NAVE_H = 16;
const NAVE_L = 32;
const AISLE_W = 4.5;
const AISLE_H = 9;
const TOWER_W = 7.5;
const TOWER_H = 30;
const SPIRE_H = 20;
/** Half the full width including buttresses; the town leaves this much room. */
export const CHURCH_HALF_WIDTH = NAVE_W / 2 + AISLE_W + 1.2;

/** Gothic lancet: straight sides, then two arcs meeting in a point (equilateral arch). */
function pointedArch(w: number, h: number): Shape {
  const spring = h - w * 0.866;
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w / 2, spring);
  s.absarc(w / 2, spring, w, Math.PI, (2 * Math.PI) / 3, true);
  s.absarc(-w / 2, spring, w, Math.PI / 3, 0, true);
  s.lineTo(w / 2, 0);
  return s;
}

function arch(w: number, h: number, depth: number): ExtrudeGeometry {
  return new ExtrudeGeometry(pointedArch(w, h), { depth, bevelEnabled: false, curveSegments: 6 });
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, rotZ = 0): BoxGeometry {
  const geo = new BoxGeometry(w, h, d);
  if (rotZ) geo.rotateZ(rotZ);
  geo.translate(x, y, z);
  return geo;
}

function gableRoof(width: number, height: number, length: number, y: number): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(-width / 2, 0);
  s.lineTo(width / 2, 0);
  s.lineTo(0, height);
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: length, bevelEnabled: false });
  geo.translate(0, y, -length);
  return geo;
}

/**
 * A French Gothic church: tall nave, side aisles with flying buttresses,
 * a west tower with a spire, a pointed portal and a stained-glass rose window.
 * Origin at the centre of the facade on the ground; the facade faces +Z.
 */
export function createChurch(): Group {
  const stone: BufferGeometry[] = [];
  const slate: BufferGeometry[] = [];
  const dark: BufferGeometry[] = [];
  const glow: BufferGeometry[] = [];

  // Nave, aisles and roofs.
  stone.push(box(NAVE_W, NAVE_H, NAVE_L, 0, NAVE_H / 2, -NAVE_L / 2));
  slate.push(gableRoof(NAVE_W + 0.8, 8, NAVE_L, NAVE_H));
  const aisleSlope = Math.atan2(2.5, AISLE_W);
  for (const side of [-1, 1]) {
    stone.push(box(AISLE_W, AISLE_H, NAVE_L, side * (NAVE_W / 2 + AISLE_W / 2), AISLE_H / 2, -NAVE_L / 2));
    slate.push(box(Math.hypot(AISLE_W + 0.4, 2.5), 0.25, NAVE_L + 0.4, side * (NAVE_W / 2 + AISLE_W / 2 + 0.2), AISLE_H + 1.35, -NAVE_L / 2, -side * aisleSlope));

    // Flying buttresses: a pier with a pinnacle and an arm braced against the nave wall.
    const pierX = side * (NAVE_W / 2 + AISLE_W + 0.55);
    const armRun = AISLE_W + 0.55;
    const armRise = NAVE_H - AISLE_H - 5;
    for (let z = -4; z > -NAVE_L; z -= 6) {
      stone.push(box(1.1, AISLE_H + 3, 1.4, pierX, (AISLE_H + 3) / 2, z));
      const pinnacle = new ConeGeometry(0.6, 2.4, 4);
      pinnacle.translate(pierX, AISLE_H + 4.2, z);
      stone.push(pinnacle);
      const arm = box(Math.hypot(armRun, armRise), 0.55, 0.7, side * (NAVE_W / 2 + armRun / 2), AISLE_H + 2.5 + armRise / 2, z, side * Math.atan2(armRise, armRun) * -1);
      stone.push(arm);
      // Tall lancet windows glowing with candlelight from inside.
      const lancet = arch(1.3, 4.2, 0.1);
      lancet.rotateY(side * Math.PI / 2);
      lancet.translate(side * (NAVE_W / 2 + 0.05), AISLE_H + 2.8, z - 3);
      glow.push(lancet);
    }

    // Side portals on the aisle fronts.
    const sideDoor = arch(1.9, 3.8, 0.2);
    sideDoor.translate(side * (NAVE_W / 2 + AISLE_W / 2), 0, -0.1);
    dark.push(sideDoor);
  }

  // West tower with corner pinnacles, parapet and spire.
  const towerZ = 1 - TOWER_W / 2;
  stone.push(box(TOWER_W, TOWER_H, TOWER_W, 0, TOWER_H / 2, towerZ));
  stone.push(box(TOWER_W + 0.5, 0.7, TOWER_W + 0.5, 0, TOWER_H + 0.35, towerZ));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = (sx * TOWER_W) / 2;
      const z = towerZ + (sz * TOWER_W) / 2;
      stone.push(box(1.2, TOWER_H + 0.8, 1.2, x, (TOWER_H + 0.8) / 2, z));
      const pinnacle = new ConeGeometry(0.65, 3.6, 4);
      pinnacle.translate(x, TOWER_H + 2.6, z);
      stone.push(pinnacle);
    }
  }
  const spire = new ConeGeometry(TOWER_W * 0.42, SPIRE_H, 8);
  spire.rotateY(Math.PI / 8);
  spire.translate(0, TOWER_H + SPIRE_H / 2 + 0.7, towerZ);
  slate.push(spire);
  const tip = TOWER_H + SPIRE_H + 0.7;
  stone.push(box(0.25, 2, 0.25, 0, tip + 0.8, towerZ), box(0.9, 0.22, 0.25, 0, tip + 1.2, towerZ));

  // Belfry openings on the three visible tower faces.
  for (const x of [-1.4, 1.4]) {
    const louvre = arch(1.1, 4.2, 0.2);
    louvre.translate(x, 21, 0.95);
    dark.push(louvre);
  }

  // Main portal with a stepped archivolt, and the entrance steps.
  const archivolt = arch(4.8, 7.8, 0.25);
  archivolt.translate(0, 0, 0.85);
  stone.push(archivolt);
  const portal = arch(3.4, 6.6, 0.3);
  portal.translate(0, 0, 0.88);
  dark.push(portal);
  stone.push(box(7, 0.25, 1.4, 0, 0.125, 1.9), box(5.5, 0.25, 0.9, 0, 0.375, 1.6));

  const ring = new TorusGeometry(2.55, 0.22, 6, 32);
  ring.translate(0, 13, 1.05);
  stone.push(ring);

  const group = new Group();
  group.name = 'church';
  const add = (parts: BufferGeometry[], material: MeshStandardMaterial | MeshBasicMaterial, shadows: boolean): void => {
    const mesh = new Mesh(mergeParts(parts), material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    group.add(mesh);
  };
  add(stone, new MeshStandardMaterial({ color: 0x8d8778, roughness: 0.95 }), true);
  add(slate, new MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.7, metalness: 0.2 }), true);
  add(dark, new MeshStandardMaterial({ color: 0x0d0c0f, roughness: 1 }), false);
  add(glow, new MeshBasicMaterial({ color: 0xa8692c }), false);

  const rose = new Mesh(new CircleGeometry(2.45, 32), new MeshBasicMaterial({ map: createRoseWindowTexture() }));
  rose.position.set(0, 13, 1.04);
  group.add(rose);

  return group;
}
