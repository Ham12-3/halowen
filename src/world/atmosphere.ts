import { BackSide, Color, FogExp2, Group, Mesh, type Scene, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { ATMOSPHERE } from '../game/config';
import './heightFog';

const SKY_RADIUS = 450;
/** Angular radius of the moon's disc (radians); larger than life so it reads on screen. */
const MOON_RADIUS = 0.035;

// Pinned to the far plane and drawn after everything opaque, so only the sky you can see runs the cloud shader.
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
  }
`;

/**
 * A London night sky: never black, it glows brown-orange near the horizon from
 * the streets, fading to deep blue overhead. A broken cloud layer drifts across,
 * lit from below by the city and silvered near the moon. Moon and stars live in
 * the shader so the clouds can cover them.
 */
const skyFragment = /* glsl */ `
  uniform vec3 horizonColor;
  uniform vec3 zenithColor;
  uniform vec3 cityGlow;
  uniform vec3 moonDir;
  uniform float time;
  varying vec3 vDir;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
  }
  float fbm(vec2 p, int octaves) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      if (i >= octaves) break;
      sum += noise(p) * amp;
      p = p * 2.03 + vec2(17.1, 9.2);
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = max(dir.y, 0.0);
    vec3 col = mix(horizonColor, zenithColor, smoothstep(0.0, 0.55, pow(h, 0.7)));
    // The streets' glow hangs just above the horizon; right at it the sky is the haze, so distant city fades into it.
    col += cityGlow * smoothstep(0.0, 0.08, h) * exp(-h * 6.0) * 0.5;

    // A scattering of faint stars (London's light pollution hides most of them).
    vec2 starGrid = vec2(atan(dir.z, dir.x) * 120.0, dir.y * 110.0);
    vec2 starCell = floor(starGrid);
    vec2 starAt = vec2(hash(starCell + 7.7), hash(starCell + 1.3)) * 0.6 + 0.2;
    float star = step(0.993, hash(starCell)) * smoothstep(0.12, 0.0, length(fract(starGrid) - starAt));
    col += vec3(0.75, 0.8, 1.0) * star * smoothstep(0.15, 0.5, h) * (0.4 + hash(starCell + 3.1));

    // The moon: a pale disc with darker seas, its light scattering into a halo.
    float toMoon = dot(dir, moonDir);
    float angle = acos(clamp(toMoon, -1.0, 1.0));
    float disc = 1.0 - smoothstep(${MOON_RADIUS * 0.94}, ${MOON_RADIUS}, angle);
    vec3 side = normalize(cross(moonDir, vec3(0.0, 1.0, 0.0)));
    vec2 onDisc = vec2(dot(dir - moonDir, side), dot(dir - moonDir, cross(side, moonDir))) / ${MOON_RADIUS};
    float seas = disc > 0.0 ? fbm(onDisc * 2.2 + 4.0, 3) : 0.0;
    float limb = sqrt(max(1.0 - dot(onDisc, onDisc), 0.0));
    col = mix(col, vec3(3.2, 3.1, 2.8) * mix(0.65, 1.0, smoothstep(0.55, 0.4, seas)) * (0.6 + 0.4 * limb), disc);

    // Clouds on a flat layer overhead, drifting slowly, thinning into haze at the horizon.
    vec2 layer = dir.xz / max(dir.y, 0.04) * 0.55 + vec2(time * 0.006, time * 0.0025);
    float shape = fbm(layer * 1.4, 4) * 0.75 + fbm(layer * 5.0, 2) * 0.25;
    float cover = smoothstep(0.42, 0.72, shape) * smoothstep(0.02, 0.2, dir.y);
    float moonLit = pow(max(toMoon, 0.0), 10.0);
    vec3 cloud = mix(cityGlow * 0.7 + horizonColor * 0.8, zenithColor * 1.6 + cityGlow * 0.12, smoothstep(0.0, 0.6, h));
    cloud += vec3(0.42, 0.46, 0.55) * moonLit * (1.2 - smoothstep(0.55, 0.9, shape));
    col = mix(col, cloud, cover * 0.92);

    // Moonlight scattered in the damp air, over the clouds too.
    col += vec3(0.32, 0.36, 0.45) * (pow(max(toMoon, 0.0), 60.0) * 0.5 + pow(max(toMoon, 0.0), 8.0) * 0.08);

    gl_FragColor = vec4(mix(horizonColor, col, smoothstep(-0.03, 0.02, dir.y)), 1.0);
  }
`;

function moonDiscDirection(): Vector3 {
  const { x, z } = ATMOSPHERE.moonLightDir;
  const horizontal = new Vector3(x, 0, z).normalize();
  const e = ATMOSPHERE.moonDiscElevation;
  return horizontal.multiplyScalar(Math.cos(e)).setY(Math.sin(e));
}

/**
 * Haze and the sky dome. The returned group must follow the camera every
 * frame so the sky always sits at "infinity"; `update` drifts the clouds.
 */
export function createAtmosphere(scene: Scene): { sky: Group; update(elapsed: number): void } {
  const fogColor = new Color(ATMOSPHERE.fogColor);
  scene.fog = new FogExp2(fogColor, ATMOSPHERE.fogDensity);
  scene.background = fogColor;

  const material = new ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    uniforms: {
      horizonColor: { value: fogColor },
      zenithColor: { value: new Color(ATMOSPHERE.skyZenith) },
      cityGlow: { value: new Color(ATMOSPHERE.cityGlow) },
      moonDir: { value: moonDiscDirection() },
      time: { value: 0 },
    },
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), material);
  dome.renderOrder = 1000;
  dome.frustumCulled = false;

  const sky = new Group();
  sky.name = 'sky';
  sky.add(dome);
  scene.add(sky);
  return {
    sky,
    update(elapsed: number): void {
      material.uniforms['time']!.value = elapsed;
    },
  };
}
