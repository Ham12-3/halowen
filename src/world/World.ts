import type { Camera, Group, Scene } from 'three';
import { STATIONS } from '../game/route';
import { createAtmosphere } from './atmosphere';
import type { Course } from './course';
import { CourseView } from './CourseView';
import { GhostsView } from './GhostsView';
import { createLighting } from './lighting';
import { PickupsView } from './PickupsView';
import { createLondonEye, createShard } from './props/landmarks';
import { createStation } from './props/station';
import { createStPauls } from './props/stPauls';
import { createTowerBridge } from './props/towerBridge';
import { createBigBen, createParliament } from './props/westminster';
import { createRivers } from './river';
import { Skyline } from './skyline';
import { SoulsView } from './SoulsView';
import { createViaduct } from './viaduct';

/** Speed the London Eye turns at (radians per second); the real one takes half an hour. */
const EYE_SPIN = 0.03;

/**
 * Everything around the runner: sky and lights, the viaduct, the trains,
 * obstacles and souls of the course, the London skyline, the Thames, the
 * landmarks, and a station at every stop after the first.
 */
export class World {
  readonly courseView = new CourseView();
  private readonly soulsView = new SoulsView();
  private readonly ghostsView = new GhostsView();
  private readonly pickupsView = new PickupsView();
  private readonly skyline = new Skyline();
  private readonly viaduct = createViaduct();
  private readonly sky: Group;
  private readonly eyeWheel: Group;

  constructor(scene: Scene) {
    this.sky = createAtmosphere(scene);
    const eye = createLondonEye();
    this.eyeWheel = eye.wheel;
    scene.add(
      createLighting(),
      this.viaduct.group,
      this.courseView.group,
      this.soulsView.group,
      this.ghostsView.group,
      this.pickupsView.group,
      this.skyline.group,
      createRivers(),
      createShard(),
      createStPauls(),
      eye.group,
      createBigBen(),
      createParliament(),
      createTowerBridge(),
      ...STATIONS.slice(1).map(createStation),
    );
  }

  /** Back to the start of the line: the skyline is rebuilt from its fixed seed. */
  reset(): void {
    this.skyline.reset();
  }

  update(dt: number, elapsed: number, camera: Camera, distance: number, course: Course): void {
    this.viaduct.update(distance);
    this.skyline.update(distance);
    this.courseView.update(course);
    this.soulsView.update(course, distance, elapsed);
    this.ghostsView.update(course, distance, elapsed);
    this.pickupsView.update(course, distance, elapsed);
    this.eyeWheel.rotation.z += EYE_SPIN * dt;
    // Keep the sky dome centred on the camera so it always reads as infinitely far.
    this.sky.position.copy(camera.position);
  }
}
