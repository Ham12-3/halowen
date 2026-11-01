import type { Camera, Group, Scene } from 'three';
import { WORLD } from '../game/config';
import { createAtmosphere } from './atmosphere';
import { type Collider, resolveCircle, type XZ } from './collision';
import { generateGraveyard } from './graveyard';
import { createGround } from './ground';
import { createLighting } from './lighting';
import { createChurch } from './props/church';
import { createCrypt } from './props/crypt';
import { createFence } from './props/fence';
import { createHouses } from './props/houses';
import { createPumpkins } from './props/pumpkins';
import { createTombstones } from './props/tombstones';
import { createTrees } from './props/trees';
import { createStreets } from './streets';
import { CHURCH, generateTown } from './town';

/** Builds the churchyard, the old town around it, and owns the colliders. */
export class World {
  readonly colliders: Collider[] = [];
  /** Tall obstacles the camera should not pass through. */
  readonly cameraBlockers: Collider[] = [];
  private readonly sky: Group;

  constructor(scene: Scene) {
    this.sky = createAtmosphere(scene);
    scene.add(createLighting(), createGround(), createStreets());

    const fence = createFence(WORLD.halfSize);
    const crypt = createCrypt();
    const statics = [...fence.colliders, ...crypt.colliders];
    const layout = generateGraveyard(statics);

    scene.add(
      fence.group,
      crypt.group,
      createTombstones(layout.tombstones, layout.mounds),
      createTrees(layout.trees),
      createPumpkins(layout.pumpkins, layout.carvedPumpkins),
      createHouses(generateTown()),
    );

    const church = createChurch();
    church.position.set(CHURCH.x, 0, CHURCH.z);
    scene.add(church);
    this.colliders.push(...statics, ...layout.colliders);
    this.cameraBlockers.push(...crypt.colliders);
  }

  /** Pushes a circle out of all static geometry. Mutates `position`; returns true on contact. */
  collide(position: XZ, radius: number): boolean {
    return resolveCircle(position, radius, this.colliders);
  }

  /** Keeps the sky dome centred on the camera so it always reads as infinitely far. */
  update(camera: Camera): void {
    this.sky.position.copy(camera.position);
  }
}
