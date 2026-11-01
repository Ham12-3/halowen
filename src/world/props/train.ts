import { type BufferGeometry, Color, type Material, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { TRAIN } from '../../game/config';
import {
  CARRIAGE_LENGTH,
  createCab,
  createCabLamps,
  createGangway,
  createShell,
  createUnderframe,
  PIECE_LENGTH,
  ROOF_START,
} from './carriage';
import { box, mergeParts } from './geometry';
import { createLivery } from './livery';

export { CARRIAGE_LENGTH, PIECE_LENGTH };

const W = TRAIN.width;
const ROOF = TRAIN.roofHeight;

/** A prop made of parts that share one transform: [geometry, material] each. */
export type Parts = Array<[BufferGeometry, Material]>;

/**
 * Red marker lamps on the roof at the very end of a train (or before a gap),
 * so a lane that's about to run out reads from far away. The origin is the
 * roof's end edge; the lamps sit just behind it, on top where the runner sees them.
 */
export function createTailLamps(): BufferGeometry {
  const lamp = (x: number): BufferGeometry => box(0.3, 0.18, 0.3, x, ROOF + 0.09, 0.25, 0xffffff);
  return mergeParts([lamp(-0.9), lamp(0.9), box(W - 0.3, 0.04, 0.14, 0, ROOF + 0.02, 0.1, 0xffffff)]);
}

/**
 * A Southeastern-style electric multiple unit, as seen at London Bridge:
 * painted body shell, underframe and bogies, gangways between carriages, and
 * driving cabs (yellow fronts, headlights) at each end of a train.
 */
export function createTrainParts(): {
  carriage: Parts;
  piece: Parts;
  gangway: Parts;
  cab: Parts;
  tailLamps: Parts;
} {
  const livery = createLivery();
  const body = new MeshStandardMaterial({
    map: livery.map,
    emissiveMap: livery.glow,
    emissive: 0xffffff,
    emissiveIntensity: 1.5,
    roughness: 0.3,
    metalness: 0.1,
  });
  // Glossy paint on the sides, a matte weathered roof.
  body.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.75, step(${ROOF_START.toFixed(4)}, vMapUv.y));`,
    );
  };
  const frame = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.2 });
  const paint = new MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.1 });
  const lamps = new MeshBasicMaterial({ vertexColors: true, color: new Color(5, 5, 5) });
  return {
    carriage: [[createShell(CARRIAGE_LENGTH), body], [createUnderframe(CARRIAGE_LENGTH), frame]],
    piece: [[createShell(PIECE_LENGTH), body], [createUnderframe(PIECE_LENGTH), frame]],
    gangway: [[createGangway(), frame]],
    cab: [[createCab(), paint], [createCabLamps(), lamps]],
    tailLamps: [[createTailLamps(), new MeshBasicMaterial({ color: new Color(1, 0.03, 0.01).multiplyScalar(1.1) })]],
  };
}
