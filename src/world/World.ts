import type { Camera, Group, Scene } from 'three';
import { createAtmosphere } from './atmosphere';
import type { Course } from './course';
import { CourseView } from './CourseView';
import { createLighting } from './lighting';
import { createLondonEye, createShard } from './props/landmarks';
import { createStation } from './props/station';
import { Skyline } from './skyline';
import { createViaduct } from './viaduct';

/** Speed the London Eye turns at (radians per second); the real one takes half an hour. */
const EYE_SPIN = 0.03;

/**
 * Everything around the runner: sky and lights, the viaduct, the trains and
 * obstacles of the course, the London skyline, the landmarks and Waterloo.
 */
export class World {
  readonly courseView = new CourseView();
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
      this.skyline.group,
      createShard(),
      eye.group,
      createStation(),
    );
  }

  /** Back to the start of the line: the skyline is rebuilt from its fixed seed. */
  reset(): void {
    this.skyline.reset();
  }

  update(dt: number, camera: Camera, distance: number, course: Course): void {
    this.viaduct.update(distance);
    this.skyline.update(distance);
    this.courseView.update(course);
    this.eyeWheel.rotation.z += EYE_SPIN * dt;
    // Keep the sky dome centred on the camera so it always reads as infinitely far.
    this.sky.position.copy(camera.position);
  }
}
