import { BoxGeometry, type BufferGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { LANES, OBSTACLE, TRAIN } from '../../game/config';
import { mergeParts, paint } from './geometry';

/**
 * Obstacle models, built around their own origin on the roof of a carriage
 * (y = 0 is the roof). Each comes as a vertex-coloured frame plus a "glow"
 * part drawn unlit, so hazards stay readable in the dark.
 */
const ROOF = TRAIN.roofHeight;
/** Street level, below the viaduct. */
export const STREET_Y = -9;

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d).translate(x, y, z);
  g.deleteAttribute('uv');
  return paint(g, color);
}

const BAR_HEIGHT = OBSTACLE.barTop - OBSTACLE.barBottom;
const BAR_WIDTH = OBSTACLE.barHalfWidth * 2;
const BAR_DEPTH = OBSTACLE.barHalfDepth * 2;

/** A signal board hanging over one track from a beam above. */
export function createBarFrame(): BufferGeometry {
  const boardY = OBSTACLE.barBottom + BAR_HEIGHT / 2;
  return mergeParts([
    box(BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH, 0, boardY, 0, 0x26282f),
    box(0.08, 1.0, 0.08, -0.9, OBSTACLE.barTop + 0.5, 0, 0x1b1c20),
    box(0.08, 1.0, 0.08, 0.9, OBSTACLE.barTop + 0.5, 0, 0x1b1c20),
    box(BAR_WIDTH + 0.4, 0.18, 0.22, 0, OBSTACLE.barTop + 1.0, 0, 0x1b1c20),
  ]);
}

/** Hazard stripe along the board's lower edge plus a red signal lamp: "slide under". */
export function createBarGlow(): BufferGeometry {
  const lamp = new SphereGeometry(0.16, 10, 8).translate(0, OBSTACLE.barBottom + BAR_HEIGHT - 0.35, BAR_DEPTH / 2 + 0.05);
  lamp.deleteAttribute('uv');
  return mergeParts([
    box(BAR_WIDTH, 0.14, BAR_DEPTH + 0.04, 0, OBSTACLE.barBottom + 0.07, 0, 0xff8a1a),
    paint(lamp, 0xff2a1a),
  ]);
}

/** Road bridge across the whole viaduct, deck underside at barBottom, piers down to the street. */
export function createBridgeFrame(): BufferGeometry {
  const span = LANES.count * LANES.width + 4;
  const deckY = OBSTACLE.barBottom + BAR_HEIGHT / 2;
  const brick = 0x4e3328;
  const pier = (side: number): BufferGeometry => {
    const height = OBSTACLE.barTop - (STREET_Y - ROOF);
    return box(1.6, height, 4.4, side * (span / 2 + 0.8), OBSTACLE.barTop - height / 2, 0, brick);
  };
  return mergeParts([
    box(span, BAR_HEIGHT, 4, 0, deckY, 0, brick),
    box(span, 0.7, 0.3, 0, OBSTACLE.barTop + 0.35, -1.85, 0x3d2820),
    box(span, 0.7, 0.3, 0, OBSTACLE.barTop + 0.35, 1.85, 0x3d2820),
    pier(-1),
    pier(1),
  ]);
}

/** Warning stripe under both faces of the bridge, plus lamps on its parapet. */
export function createBridgeGlow(): BufferGeometry {
  const span = LANES.count * LANES.width + 4;
  const lamps = [-0.35, 0, 0.35].map((f) => {
    const lamp = new CylinderGeometry(0.12, 0.12, 0.3, 8).translate(f * span, OBSTACLE.barTop + 1.0, 1.85);
    lamp.deleteAttribute('uv');
    return paint(lamp, 0xffc46b);
  });
  return mergeParts([
    box(span, 0.14, 0.06, 0, OBSTACLE.barBottom + 0.07, 2.02, 0xff8a1a),
    box(span, 0.14, 0.06, 0, OBSTACLE.barBottom + 0.07, -2.02, 0xff8a1a),
    ...lamps,
  ]);
}
