import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import { LANES } from '../../game/config';
import type { Station } from '../../game/route';
import { STREET_Y } from './obstacles';

/** The shed's mouth sits this far before the station's distance, so you arrive inside it. */
const MOUTH_BEFORE = 10;

const SHED_LENGTH = 120;
const SHED_RADIUS = LANES.count * LANES.width * 0.5 + 3.5;
const SPRING = 5;

/** An Underground-style roundel: red ring, blue bar, the station name in white. */
function roundelTexture(name: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.clearRect(0, 0, 1024, 512);
  ctx.strokeStyle = '#dc241f';
  ctx.lineWidth = 70;
  ctx.beginPath();
  ctx.arc(512, 256, 190, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#0019a8';
  ctx.fillRect(130, 196, 764, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name.toUpperCase(), 512, 260);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A station on the line: an arched train shed over all the tracks (open at both
 * ends, so you run straight through intermediate stops), a glowing glass screen
 * at its mouth, the roundel above, and brick walls down to the street.
 */
export function createStation(station: Station): Group {
  const name = station.name;
  const group = new Group();
  group.name = `station:${name}`;

  // Upper half of a cylinder lying along the track (see the rotateX note below).
  const shed = new CylinderGeometry(SHED_RADIUS, SHED_RADIUS, SHED_LENGTH, 32, 1, true, Math.PI / 2, Math.PI);
  shed.rotateX(Math.PI / 2); // axis along z; theta π/2..3π/2 is now the top half
  shed.translate(0, SPRING, -SHED_LENGTH / 2);
  group.add(new Mesh(shed, new MeshStandardMaterial({ color: 0x2c313b, metalness: 0.5, roughness: 0.5, side: DoubleSide })));

  // Lit glass screen filling the arch at the mouth, plus a soft lit band along the roof inside.
  const screen = new CircleGeometry(SHED_RADIUS, 32, 0, Math.PI).translate(0, SPRING, 0.05);
  group.add(new Mesh(screen, new MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.22, side: DoubleSide, depthWrite: false })));
  const band = new BoxGeometry(1.2, 0.2, SHED_LENGTH).translate(0, SPRING + SHED_RADIUS - 0.4, -SHED_LENGTH / 2);
  group.add(new Mesh(band, new MeshBasicMaterial({ color: 0xffe0b0 })));

  // Side walls carrying the arch, down to the street.
  const wallHeight = SPRING - STREET_Y;
  const brick = new MeshStandardMaterial({ color: 0x6a4a3a, roughness: 0.95 });
  for (const side of [-1, 1]) {
    const wall = new BoxGeometry(2, wallHeight, SHED_LENGTH).translate(side * (SHED_RADIUS + 1), SPRING - wallHeight / 2, -SHED_LENGTH / 2);
    group.add(new Mesh(wall, brick));
  }

  const sign = new Mesh(
    new PlaneGeometry(14, 7),
    new MeshBasicMaterial({ map: roundelTexture(name), transparent: true, side: DoubleSide }),
  );
  sign.position.set(0, SPRING + SHED_RADIUS + 3.2, 0.3);
  group.add(sign);

  group.position.z = -(station.at - MOUTH_BEFORE);
  return group;
}
