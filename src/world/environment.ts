import {
  BackSide,
  BoxGeometry,
  Color,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { ATMOSPHERE } from '../game/config';
import { createRng, range } from './rng';

const RADIUS = 100;

const domeVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Deep blue overhead, the orange glow of the streets low down, dark wet ground below. */
const domeFragment = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 glow;
  varying vec3 vDir;
  void main() {
    float h = vDir.y;
    vec3 sky = mix(horizon + glow * 0.8, zenith, smoothstep(0.0, 0.6, h));
    vec3 ground = horizon * 0.35 + glow * 0.25 * exp(h * 6.0);
    gl_FragColor = vec4(h > 0.0 ? sky : ground, 1.0);
  }
`;

/**
 * A tiny stand-in for the city at night (sky, a ring of lit windows and street
 * lamps, the moon) baked once into a prefiltered environment map. It gives
 * glass, train paint and rails something believable to reflect, and a little
 * coloured ambient light, without any runtime cost beyond the lookup.
 */
export function createNightEnvironment(renderer: WebGLRenderer): Texture {
  const scene = new Scene();
  scene.add(
    new Mesh(
      new SphereGeometry(RADIUS, 32, 16),
      new ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        uniforms: {
          zenith: { value: new Color(ATMOSPHERE.skyZenith) },
          horizon: { value: new Color(ATMOSPHERE.fogColor) },
          glow: { value: new Color(ATMOSPHERE.cityGlow) },
        },
        side: BackSide,
        depthWrite: false,
      }),
    ),
  );

  // Windows and lamps all round the horizon, mostly warm, some office-white.
  const rng = createRng(31);
  const COUNT = 420;
  const lights = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial(), COUNT);
  const dummy = new Object3D();
  const color = new Color();
  for (let i = 0; i < COUNT; i++) {
    const angle = rng() * Math.PI * 2;
    const elevation = Math.pow(rng(), 2.2) * 0.45 - 0.04;
    const dist = range(rng, 55, 90);
    dummy.position.set(Math.cos(angle) * dist, Math.sin(elevation) * dist, Math.sin(angle) * dist);
    dummy.lookAt(0, dummy.position.y, 0);
    dummy.scale.set(range(rng, 0.6, 2.4), range(rng, 0.5, 1.6), 0.2);
    dummy.updateMatrix();
    lights.setMatrixAt(i, dummy.matrix);
    color.set(rng() < 0.65 ? 0xffb35c : 0xdfe8ff).multiplyScalar(range(rng, 1.5, 5));
    lights.setColorAt(i, color);
  }
  scene.add(lights);

  const moon = new Mesh(new SphereGeometry(3, 16, 8), new MeshBasicMaterial({ color: new Color(0xdfe6ff).multiplyScalar(6) }));
  const { x, y, z } = ATMOSPHERE.moonLightDir;
  moon.position.set(x, y, z).normalize().multiplyScalar(RADIUS * 0.8);
  scene.add(moon);

  const pmrem = new PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0.02, 0.1, RADIUS * 2).texture;
  pmrem.dispose();
  return texture;
}
