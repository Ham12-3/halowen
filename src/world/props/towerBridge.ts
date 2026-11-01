import { type BufferGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { box, mergeParts, solid } from './geometry';
import { STREET_Y } from './obstacles';
import { SITES } from './sites';

const STONE = 0xcbb68c;
const STEEL = 0x5b8fd4; // Tower Bridge blue
const LIGHTS = 0xfff0c8;

/** Half the distance between the two main towers, and to the shore towers. */
const TOWER_Z = 42;
const SHORE_Z = 92;
const TOWER_TOP = 46;
const WALKWAY_Y = 40;
const DECK_Y = 9;

/** A straight steel member from a to b, as a thin box (for chains and hangers). */
function beam(a: Vector3, b: Vector3, thickness: number, color: number): BufferGeometry {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const length = a.distanceTo(b);
  const g = box(thickness, length, thickness, 0, 0, 0, color);
  const dir = b.clone().sub(a).normalize();
  // Tilt the box (built along Y) to point from a to b in the YZ plane.
  g.rotateX(Math.atan2(dir.z, dir.y));
  return g.translate(mid.x, mid.y, mid.z);
}

/** One main tower: stone body, four corner turrets and a pyramid roof. */
function tower(z: number): BufferGeometry[] {
  const parts = [box(15, TOWER_TOP, 19, 0, TOWER_TOP / 2, z, STONE)];
  for (const [x, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    parts.push(box(3.4, 8, 3.4, x * 6.3, TOWER_TOP + 4, z + dz * 8.3, STONE));
    parts.push(solid(new ConeGeometry(2.4, 6, 4).rotateY(Math.PI / 4).translate(x * 6.3, TOWER_TOP + 11, z + dz * 8.3), 0x6a6f78));
  }
  parts.push(solid(new ConeGeometry(9, 12, 4).rotateY(Math.PI / 4).translate(0, TOWER_TOP + 6, z), 0x6a6f78));
  return parts;
}

/**
 * Tower Bridge, spanning the river beside the line: twin Gothic towers, the
 * high walkways, the road deck, blue suspension chains to the shore towers,
 * and strings of lights along the walkways.
 */
export function createTowerBridge(): Group {
  const group = new Group();
  const stone: BufferGeometry[] = [...tower(-TOWER_Z), ...tower(TOWER_Z)];
  for (const z of [-SHORE_Z, SHORE_Z]) stone.push(box(9, 16, 11, 0, 8, z, STONE));
  group.add(new Mesh(mergeParts(stone), new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, emissive: 0x52442a })));

  const span = TOWER_Z * 2 - 19;
  const steel: BufferGeometry[] = [
    box(3, 3, span, -3.5, WALKWAY_Y, 0, STEEL),
    box(3, 3, span, 3.5, WALKWAY_Y, 0, STEEL),
    box(11, 1.6, SHORE_Z * 2, 0, DECK_Y, 0, 0x3d4a5c),
  ];
  // Chains sag from each tower down towards the deck, then climb to the shore tower.
  for (const side of [-1, 1]) {
    for (const x of [-5.5, 5.5]) {
      const top = new Vector3(x, TOWER_TOP - 10, side * (TOWER_Z + 9));
      const low = new Vector3(x, DECK_Y + 4, side * (TOWER_Z + 26));
      const shore = new Vector3(x, 15, side * (SHORE_Z - 5));
      steel.push(beam(top, low, 1.1, STEEL), beam(low, shore, 1.1, STEEL));
    }
  }
  group.add(new Mesh(mergeParts(steel), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4, emissive: 0x0c1830 })));

  const lights = [-3.5, 3.5].map((x) => box(0.4, 0.4, span, x, WALKWAY_Y + 1.8, 0, LIGHTS));
  lights.push(box(0.3, 0.3, SHORE_Z * 2, -5.6, DECK_Y + 1.2, 0, LIGHTS), box(0.3, 0.3, SHORE_Z * 2, 5.6, DECK_Y + 1.2, 0, LIGHTS));
  group.add(new Mesh(mergeParts(lights), new MeshBasicMaterial({ vertexColors: true })));

  group.position.set(SITES.towerBridge.x, STREET_Y, -SITES.towerBridge.at);
  return group;
}
