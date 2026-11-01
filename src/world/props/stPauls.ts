import { type BufferGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { glow } from './landmarks';
import { box, mergeParts, solid } from './geometry';
import { STREET_Y } from './obstacles';
import { SITES } from './sites';

const STONE = 0xd8d0bd;
const LEAD = 0x8d939c;
const GOLD = 0xe8c060;

/** Floodlit Portland stone: a faint warm self-glow keeps it bright against the night. */
function floodlit(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x4f493a });
}

/**
 * St Paul's Cathedral: the nave and west towers, a colonnaded drum, the great
 * lead dome, and the lantern with its gold cross. Its long axis runs along the line.
 */
export function createStPauls(): Group {
  const group = new Group();
  const base = 26;
  const parts: BufferGeometry[] = [
    box(36, base, 84, 0, base / 2, 0, STONE), // nave
    box(54, base - 4, 22, 0, (base - 4) / 2, -6, STONE), // transepts
    solid(new CylinderGeometry(15.5, 16.5, 14, 32).translate(0, base + 7, -6), STONE), // drum
  ];
  // The ring of columns around the drum.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    parts.push(solid(new CylinderGeometry(0.7, 0.7, 12, 6).translate(Math.cos(a) * 17.2, base + 6, -6 + Math.sin(a) * 17.2), STONE));
  }
  // Two west towers framing the front (towards +z, the way the runner comes from).
  for (const side of [-1, 1]) {
    parts.push(box(9, 22, 9, side * 12, base + 11, 38, STONE));
    parts.push(solid(new ConeGeometry(4.2, 9, 8).translate(side * 12, base + 26.5, 38), LEAD));
  }
  parts.push(box(24, 10, 4, 0, base + 5, 42, STONE)); // portico pediment
  group.add(new Mesh(mergeParts(parts), floodlit()));

  const dome: BufferGeometry[] = [
    solid(new SphereGeometry(15.5, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1).translate(0, base + 14, -6), LEAD),
    solid(new CylinderGeometry(2.6, 2.8, 8, 12).translate(0, base + 14 + 19.4 + 4, -6), STONE), // lantern
    solid(new SphereGeometry(2.7, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, base + 41.4, -6), LEAD),
    box(0.5, 4.2, 0.5, 0, base + 46.2, -6, GOLD), // the cross
    box(2.4, 0.5, 0.5, 0, base + 46.8, -6, GOLD),
  ];
  group.add(new Mesh(mergeParts(dome), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3, emissive: 0x1d2026 })));

  const cross = glow(0xffd98a, 9);
  cross.position.set(0, base + 46.5, -6);
  group.add(cross);
  group.position.set(SITES.stPauls.x, STREET_Y, -SITES.stPauls.at);
  return group;
}
