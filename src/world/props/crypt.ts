import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
} from 'three';
import { box, type Collider } from '../collision';
import { CRYPT } from '../layout';
import { mergeParts } from './geometry';

/** The mausoleum at the north end of the main path. Its front faces +Z. */
export function createCrypt(): { group: Group; colliders: Collider[] } {
  const { width: w, depth: d, height: h } = CRYPT;
  const parts: BufferGeometry[] = [];

  const body = new BoxGeometry(w, h, d);
  body.translate(0, h / 2, 0);
  const plinth = new BoxGeometry(w + 0.8, 0.3, d + 0.8);
  plinth.translate(0, 0.15, 0);
  const step = new BoxGeometry(3.4, 0.16, 0.7);
  step.translate(0, 0.08, d / 2 + 0.75);
  const lintel = new BoxGeometry(w + 0.5, 0.45, d + 0.5);
  lintel.translate(0, h + 0.22, 0);
  parts.push(body, plinth, step, lintel);

  for (const x of [-2.7, -1.5, 1.5, 2.7]) {
    const column = new CylinderGeometry(0.2, 0.24, h - 0.3, 10);
    column.translate(x, 0.3 + (h - 0.3) / 2, d / 2 + 0.15);
    parts.push(column);
  }

  const gable = new Shape();
  gable.moveTo(-w / 2 - 0.45, 0);
  gable.lineTo(w / 2 + 0.45, 0);
  gable.lineTo(0, 1.6);
  gable.closePath();
  const roof = new ExtrudeGeometry(gable, { depth: d + 0.5, bevelEnabled: false });
  roof.translate(0, h + 0.44, -(d + 0.5) / 2);
  parts.push(roof);

  const crossPost = new BoxGeometry(0.16, 0.95, 0.16);
  crossPost.translate(0, h + 2.4, d / 2);
  const crossArm = new BoxGeometry(0.55, 0.16, 0.16);
  crossArm.translate(0, h + 2.55, d / 2);
  parts.push(crossPost, crossArm);

  const group = new Group();
  group.name = 'crypt';
  const stoneMaterial = new MeshStandardMaterial({ color: 0x5f6166, roughness: 0.95 });
  const stone = new Mesh(mergeParts(parts), stoneMaterial);
  stone.castShadow = true;
  stone.receiveShadow = true;
  group.add(stone);

  const door = new Mesh(new BoxGeometry(1.7, 2.5, 0.12), new MeshStandardMaterial({ color: 0x0c0b0e }));
  door.position.set(0, 1.55, d / 2 + 0.02);
  group.add(door);

  // A sliver of eerie green light leaking from the door.
  const gap = new Mesh(new PlaneGeometry(0.07, 2.35), new MeshBasicMaterial({ color: 0x8dffad }));
  gap.position.set(0, 1.55, d / 2 + 0.09);
  group.add(gap);

  group.position.set(CRYPT.x, 0, CRYPT.z);
  const colliders = [box(CRYPT.x, CRYPT.z, w / 2 + 0.4, d / 2 + 0.4)];
  return { group, colliders };
}
