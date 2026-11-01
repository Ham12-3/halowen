import {
  BackSide,
  BufferGeometry,
  CircleGeometry,
  Color,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  type Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { ATMOSPHERE } from '../game/config';
import { createRng, range } from './rng';

const SKY_RADIUS = 450;

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 horizonColor;
  uniform vec3 zenithColor;
  uniform vec3 moonDir;
  uniform vec3 moonGlow;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(horizonColor, zenithColor, pow(h, 0.45));
    float glow = max(dot(dir, moonDir), 0.0);
    col += moonGlow * (pow(glow, 24.0) * 0.6 + pow(glow, 4.0) * 0.12);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function moonDiscDirection(): Vector3 {
  const { x, z } = ATMOSPHERE.moonLightDir;
  const horizontal = new Vector3(x, 0, z).normalize();
  const e = ATMOSPHERE.moonDiscElevation;
  return horizontal.multiplyScalar(Math.cos(e)).setY(Math.sin(e));
}

function createStars(): Points {
  const rng = createRng(77);
  const positions: number[] = [];
  for (let i = 0; i < 700; i++) {
    const theta = rng() * Math.PI * 2;
    const y = range(rng, 0.18, 1);
    const r = Math.sqrt(1 - y * y);
    const dist = SKY_RADIUS * 0.92;
    positions.push(Math.cos(theta) * r * dist, y * dist, Math.sin(theta) * r * dist);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color: 0xc8d4ff,
    size: 1.6,
    sizeAttenuation: false,
    fog: false,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  return new Points(geometry, material);
}

/**
 * Fog, gradient sky dome, moon and stars. The returned group must follow the
 * camera every frame so the sky always sits at "infinity".
 */
export function createAtmosphere(scene: Scene): Group {
  const fogColor = new Color(ATMOSPHERE.fogColor);
  scene.fog = new FogExp2(fogColor, ATMOSPHERE.fogDensity);
  scene.background = fogColor;

  const moonDir = moonDiscDirection();
  const sky = new Group();
  sky.name = 'sky';

  const dome = new Mesh(
    new SphereGeometry(SKY_RADIUS, 32, 16),
    new ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        horizonColor: { value: fogColor },
        zenithColor: { value: new Color(ATMOSPHERE.skyZenith) },
        moonDir: { value: moonDir },
        moonGlow: { value: new Color(0x6f86c9) },
      },
      side: BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  sky.add(dome);

  const moon = new Mesh(
    new CircleGeometry(16, 40),
    new MeshBasicMaterial({ color: 0xf4f1dc, fog: false, depthWrite: false }),
  );
  moon.position.copy(moonDir).multiplyScalar(SKY_RADIUS * 0.9);
  moon.lookAt(0, 0, 0);
  moon.renderOrder = -1;
  sky.add(moon);

  const stars = createStars();
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  sky.add(stars);

  scene.add(sky);
  return sky;
}
