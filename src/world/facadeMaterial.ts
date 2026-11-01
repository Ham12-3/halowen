import { Color, MeshStandardMaterial, Vector4 } from 'three';
import type { Facade } from './facades';

export interface FacadeLook {
  /** Band along the top of the walls (cornice, coping or plant screen): height in metres and colour. */
  cornice: number;
  corniceColor: number;
  roofColor: number;
  /** Strength of the lit windows. */
  glow: number;
  roughness: number;
}

const vertexHead = /* glsl */ `
  uniform vec4 facadeGrid;
  varying vec3 vFacade;
  varying float vRoof;
  varying float vSeed;
`;

/*
 * Windows at true size whatever the building's scale: the instance's own scale
 * turns the unit box's position into a count of bays across and floors up, each
 * rounded so whole windows fit. A hash of the building's position picks which
 * part of the tile it shows and how bright its windows burn.
 */
const vertexBody = /* glsl */ `
  vec3 bScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  bool alongZ = abs(normal.x) > 0.5;
  float across = alongZ ? bScale.z : bScale.x;
  float bays = max(1.0, floor(across / facadeGrid.x + 0.5));
  float floors = max(1.0, floor(bScale.y / facadeGrid.y));
  vFacade = vec3(((alongZ ? position.z : position.x) + 0.5) * bays, position.y * floors, (1.0 - position.y) * bScale.y);
  vRoof = step(0.5, normal.y);
  vSeed = fract(sin(dot(floor(instanceMatrix[3].xz), vec2(12.9898, 78.233))) * 43758.5453);
`;

const fragmentHead = /* glsl */ `
  uniform vec4 facadeGrid;
  uniform vec3 corniceColor;
  uniform float corniceHeight;
  uniform vec3 roofColor;
  varying vec3 vFacade;
  varying float vRoof;
  varying float vSeed;
`;

/** Samples the tile: the ground floor always uses row 0, upper floors cycle through the rest. */
const mapFragment = /* glsl */ `
  float facadeBay = mod(vFacade.x + floor(vSeed * 37.0), facadeGrid.z);
  float facadeRow = vFacade.y < 1.0 ? vFacade.y : 1.0 + mod(vFacade.y - 1.0 + floor(vSeed * 53.0), facadeGrid.w - 1.0);
  vec2 facadeUv = vec2(facadeBay / facadeGrid.z, facadeRow / facadeGrid.w);
  vec2 facadeDx = dFdx(vFacade.xy / facadeGrid.zw);
  vec2 facadeDy = dFdy(vFacade.xy / facadeGrid.zw);
  vec4 facadeTexel = textureGrad(map, facadeUv, facadeDx, facadeDy);
  float facadePlain = max(step(vFacade.z, corniceHeight), vRoof);
  float glassMask = smoothstep(0.75, 0.95, facadeTexel.a) * (1.0 - facadePlain);
  vec3 facadeColor = mix(facadeTexel.rgb, vRoof > 0.5 ? roofColor : corniceColor, facadePlain);
  diffuseColor.rgb *= facadeColor;
`;

const emissiveFragment = /* glsl */ `
  vec3 facadeGlow = textureGrad(emissiveMap, facadeUv, facadeDx, facadeDy).rgb;
  totalEmissiveRadiance *= facadeGlow * (1.0 - facadePlain) * (0.45 + vSeed * 0.8);
`;

/** A building material that reads the facade tile through the shader above. Use with a unit-box InstancedMesh. */
export function createFacadeMaterial(facade: Facade, look: FacadeLook): MeshStandardMaterial {
  const { grid } = facade;
  const material = new MeshStandardMaterial({
    map: facade.map,
    emissiveMap: facade.glow,
    emissive: 0xffffff,
    emissiveIntensity: look.glow,
    roughness: look.roughness,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms['facadeGrid'] = { value: new Vector4(grid.bay, grid.floor, grid.bays, grid.floors) };
    shader.uniforms['corniceColor'] = { value: new Color(look.corniceColor) };
    shader.uniforms['corniceHeight'] = { value: look.cornice };
    shader.uniforms['roofColor'] = { value: new Color(look.roofColor) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexHead}`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\n${vertexBody}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${fragmentHead}`)
      .replace('#include <map_fragment>', mapFragment)
      .replace('#include <emissivemap_fragment>', emissiveFragment)
      // Glass is glossy and catches the city's reflection; walls stay matte.
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.06, glassMask);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.6, glassMask);');
  };
  return material;
}
