import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
} from 'three';

const LIGHT_COLOR = 0xffa64d;
const BASE_INTENSITY = 22;
const LIGHT_RANGE = 16;

/**
 * A hand-held iron lantern with a flickering point light.
 * The group origin is the handle, so it can hang and swing from the hand.
 */
export class Lantern {
  readonly group = new Group();
  readonly light: PointLight;
  private readonly flame: Mesh;
  private readonly glassMaterial: MeshStandardMaterial;

  constructor() {
    const iron = new MeshStandardMaterial({ color: 0x24211f, metalness: 0.6, roughness: 0.5 });

    const handle = new Mesh(new TorusGeometry(0.06, 0.008, 6, 12, Math.PI), iron);
    handle.position.y = -0.02;
    const cap = new Mesh(new ConeGeometry(0.1, 0.08, 4), iron);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = -0.06;
    const base = new Mesh(new BoxGeometry(0.15, 0.03, 0.15), iron);
    base.position.y = -0.29;
    this.group.add(handle, cap, base);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const post = new Mesh(new BoxGeometry(0.014, 0.2, 0.014), iron);
      post.position.set(x * 0.062, -0.18, z * 0.062);
      this.group.add(post);
    }

    this.glassMaterial = new MeshStandardMaterial({
      color: 0x000000,
      emissive: LIGHT_COLOR,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const glass = new Mesh(new CylinderGeometry(0.055, 0.055, 0.19, 8), this.glassMaterial);
    glass.position.y = -0.18;

    this.flame = new Mesh(
      new SphereGeometry(0.03, 8, 6),
      new MeshStandardMaterial({ color: 0x000000, emissive: 0xffe2a8, emissiveIntensity: 3 }),
    );
    this.flame.position.y = -0.19;
    this.flame.scale.set(1, 1.6, 1);

    this.light = new PointLight(LIGHT_COLOR, BASE_INTENSITY, LIGHT_RANGE, 2);
    this.light.position.y = -0.18;
    this.group.add(glass, this.flame, this.light);
  }

  /** Layered sine waves give a cheap, organic candle flicker. */
  update(elapsed: number): void {
    const flicker =
      1 +
      Math.sin(elapsed * 11.3) * 0.05 +
      Math.sin(elapsed * 23.7 + 1.3) * 0.035 +
      Math.sin(elapsed * 4.1 + 0.7) * 0.04;
    this.light.intensity = BASE_INTENSITY * flicker;
    this.glassMaterial.emissiveIntensity = 1.6 * flicker;
    this.flame.scale.set(flicker, 1.6 * flicker, flicker);
  }
}
