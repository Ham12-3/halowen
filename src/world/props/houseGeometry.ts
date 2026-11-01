import { BoxGeometry, type BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, PlaneGeometry, Shape } from 'three';
import type { Rng } from '../rng';

/**
 * Medieval half-timbered townhouse (think Rouen or Colmar), built from boxes.
 * Local space: origin at the footprint centre on the ground, street front faces +Z.
 */

export interface HouseSpec {
  width: number;
  /** Including the stone ground floor. */
  floors: number;
  /** 'gable' = triangular end faces the street; 'eave' = ridge runs along the street. */
  roof: 'gable' | 'eave';
  roofHeight: number;
  shutters: number;
}

export interface HouseGeometry {
  body: BufferGeometry[];
  litWindows: BufferGeometry[];
  darkWindows: BufferGeometry[];
}

export const HOUSE_DEPTH = 9;
const GROUND_H = 3;
const FLOOR_H = 2.7;
/** Each upper floor overhangs the one below (a "jetty"). */
const JETTY = 0.35;
const BAY = 1.6;

const STONE = 0x8a8378;
const PLASTER = 0xe6dac0;
const TIMBER = 0x3b2618;
const ROOF = 0x3b302d;
const BRICK = 0x6b3a2a;
const DOOR = 0x2a1a10;

function colored(geo: BufferGeometry, hex: number): BufferGeometry {
  const count = geo.attributes.position?.count ?? 0;
  const colors = new Float32Array(count * 3);
  const c = new Color(hex);
  for (let i = 0; i < count; i++) c.toArray(colors, i * 3);
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geo;
}

export function buildHouse(spec: HouseSpec, rng: Rng): HouseGeometry {
  const out: HouseGeometry = { body: [], litWindows: [], darkWindows: [] };
  const W = spec.width;
  const D = HOUSE_DEPTH;

  const block = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number, rotZ = 0, rotX = 0): void => {
    const geo = new BoxGeometry(w, h, d);
    if (rotX) geo.rotateX(rotX);
    if (rotZ) geo.rotateZ(rotZ);
    geo.translate(x, y, z);
    out.body.push(colored(geo, hex));
  };
  const window = (w: number, h: number, x: number, y: number, z: number): void => {
    const geo = new PlaneGeometry(w, h);
    geo.translate(x, y, z);
    (rng() < 0.38 ? out.litWindows : out.darkWindows).push(geo);
  };

  // Stone ground floor with a door and a shop window.
  block(W, GROUND_H, D, 0, GROUND_H / 2, 0, STONE);
  const doorX = -W / 2 + 1.1;
  block(1.1, 2.3, 0.12, doorX, 1.15, D / 2 + 0.03, DOOR);
  window(Math.min(1.8, W - 3), 1.3, doorX + 1.0 + Math.min(1.8, W - 3) / 2 + 0.4, 1.55, D / 2 + 0.02);
  block(W + 0.1, 0.25, 0.25, 0, GROUND_H, D / 2 + 0.1, TIMBER);

  // Jettied, timber-framed upper floors.
  const bays = Math.max(3, Math.round(W / BAY));
  const bayW = W / bays;
  for (let floor = 1; floor < spec.floors; floor++) {
    const y0 = GROUND_H + (floor - 1) * FLOOR_H;
    const front = D / 2 + JETTY * floor;
    const fz = front + 0.04;
    block(W, FLOOR_H, D + JETTY * floor, 0, y0 + FLOOR_H / 2, (JETTY * floor) / 2, PLASTER);
    block(W, 0.2, 0.12, 0, y0 + 0.1, fz, TIMBER);
    block(W, 0.2, 0.12, 0, y0 + FLOOR_H - 0.1, fz, TIMBER);

    let windows = 0;
    for (let b = 0; b <= bays; b++) block(0.16, FLOOR_H, 0.12, -W / 2 + 0.08 + b * ((W - 0.16) / bays), y0 + FLOOR_H / 2, fz, TIMBER);
    for (let b = 0; b < bays; b++) {
      const cx = -W / 2 + bayW * (b + 0.5);
      const isWindow = b % 2 === 1 || (b === bays - 1 && windows === 0) || rng() < 0.2;
      if (isWindow) {
        windows++;
        window(0.72, 1.15, cx, y0 + 1.4, front + 0.02);
        block(bayW - 0.1, 0.12, 0.12, cx, y0 + 0.72, fz, TIMBER);
        for (const side of [-1, 1]) block(0.3, 1.15, 0.05, cx + side * 0.52, y0 + 1.4, front + 0.05, spec.shutters);
      } else {
        const angle = Math.atan2(FLOOR_H - 0.3, bayW) * (b % 4 === 0 ? 1 : -1);
        const length = Math.hypot(bayW, FLOOR_H - 0.3);
        block(length, 0.14, 0.1, cx, y0 + FLOOR_H / 2, fz, TIMBER, angle);
      }
    }
  }

  // Attic and roof.
  const top = GROUND_H + (spec.floors - 1) * FLOOR_H;
  const topJetty = JETTY * (spec.floors - 1);
  const topFront = D / 2 + topJetty;
  const topDepth = D + topJetty;
  const R = spec.roofHeight;
  const overhang = 0.35;

  if (spec.roof === 'gable') {
    const gable = new Shape();
    gable.moveTo(-W / 2, 0);
    gable.lineTo(W / 2, 0);
    gable.lineTo(0, R);
    gable.closePath();
    const attic = new ExtrudeGeometry(gable, { depth: topDepth, bevelEnabled: false });
    attic.translate(0, top, -D / 2);
    out.body.push(colored(attic, PLASTER));
    block(0.16, R * 0.8, 0.12, 0, top + R * 0.4, topFront + 0.04, TIMBER);
    block(W * 0.5, 0.16, 0.12, 0, top + R * 0.5, topFront + 0.04, TIMBER);
    for (const side of [-1, 1]) window(0.5, 0.7, side * W * 0.17, top + 1.0, topFront + 0.02);

    const slope = Math.atan2(R, W / 2);
    const span = W / 2 + overhang;
    const length = span / Math.cos(slope);
    for (const side of [-1, 1]) {
      const cy = top + R - (span / 2) * Math.tan(slope) + 0.1;
      block(length, 0.16, topDepth + 0.6, (side * span) / 2, cy, topJetty / 2, ROOF, -side * slope);
    }
    block(0.6, 2.2, 0.6, W * 0.25, top + R / 2 + 0.6, -D * 0.2, BRICK);
  } else {
    const gable = new Shape();
    gable.moveTo(-topDepth / 2, 0);
    gable.lineTo(topDepth / 2, 0);
    gable.lineTo(0, R);
    gable.closePath();
    const attic = new ExtrudeGeometry(gable, { depth: W, bevelEnabled: false });
    attic.rotateY(Math.PI / 2);
    attic.translate(-W / 2, top, topJetty / 2);
    out.body.push(colored(attic, PLASTER));

    const slope = Math.atan2(R, topDepth / 2);
    const span = topDepth / 2 + overhang;
    const length = span / Math.cos(slope);
    for (const side of [-1, 1]) {
      const cy = top + R - (span / 2) * Math.tan(slope) + 0.1;
      block(W + 0.6, 0.16, length, 0, cy, topJetty / 2 + (side * span) / 2, ROOF, 0, side * slope);
    }
    // A small dormer window poking out of the front slope.
    const dz = topFront - topDepth * 0.22;
    block(1.2, 1.2, 1.0, 0, top + R * 0.42 + 0.3, dz, PLASTER);
    block(1.5, 0.12, 1.3, 0, top + R * 0.42 + 0.95, dz, ROOF);
    window(0.6, 0.7, 0, top + R * 0.42 + 0.3, dz + 0.52);
    block(0.6, 2.2, 0.6, -W * 0.3, top + R * 0.7 + 0.5, topJetty / 2 - topDepth * 0.15, BRICK);
  }

  return out;
}
