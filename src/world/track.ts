import {
  BoxGeometry,
  type BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { LANES } from '../game/config';
import { RAIL_OFFSET } from './props/carriage';
import { box, mergeParts } from './props/geometry';
import { createRng } from './rng';

/** Every track on the viaduct: the three you run on, plus a siding either side. */
export const TRACK_XS = [-2, -1, 0, 1, 2].map((i) => i * LANES.width);
export const DECK_WIDTH = TRACK_XS.length * LANES.width + 2;
const SLEEPER_SPACING = 0.7;
/** Ballast texture tile, square: one track's width. */
const TILE = LANES.width;
/** The conductor rail runs this far outside the left running rail, on insulators every few metres. */
const THIRD_RAIL = RAIL_OFFSET + 0.46;
const INSULATOR_SPACING = 3.5;
/** Heights: wheels touch the rail tops at y = 0; sleepers and ballast sit below. */
const RAIL_HEIGHT = 0.16;
const SLEEPER_TOP = -RAIL_HEIGHT;
const SLEEPER_DEPTH = 0.14;
/** The ballast shoulders come just short of the sleeper tops. */
export const BED_Y = SLEEPER_TOP - 0.03;

/** Grey granite chippings, rust-stained between the rails where brake dust falls. */
function ballastTexture(): Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const rng = createRng(11);
  ctx.fillStyle = '#3c3a38';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5200; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const across = Math.abs(x / size - 0.5) * TILE; // metres from the track centre
    const rust = across < RAIL_OFFSET ? 0.6 : 0.15;
    const v = 55 + rng() * 70;
    const r = v + rust * 26;
    ctx.fillStyle = `rgb(${r | 0},${(v + rust * 8) | 0},${(v - rust * 14) | 0})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + rng() * 2.2, 1 + rng() * 1.8, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** A flat-bottom rail's cross-section (foot, web, head), 0.16 m tall, extruded along the line. */
function railGeometry(length: number): BufferGeometry {
  const s = new Shape();
  const pts: Array<[number, number]> = [
    [-0.075, 0], [0.075, 0], [0.075, 0.012], [0.012, 0.03], [0.009, 0.11], [0.034, 0.122], [0.036, 0.16],
    [-0.036, 0.16], [-0.034, 0.122], [-0.009, 0.11], [-0.012, 0.03], [-0.075, 0.012],
  ];
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  return new ExtrudeGeometry(s, { depth: length, bevelEnabled: false }).translate(0, 0, -length / 2);
}

/**
 * The permanent way: ballast, concrete sleepers, running rails with polished
 * heads, and the third rail on white ceramic insulators, for every track on
 * the viaduct, plus concrete cable troughs along both edges. Built `length`
 * metres long, centred on z = 0, to sit in the scrolling viaduct group.
 */
export function createTrack(length: number): Group {
  const group = new Group();
  group.name = 'track';

  const ballast = ballastTexture();
  ballast.repeat.set(DECK_WIDTH / TILE, length / TILE);
  ballast.offset.x = 0.5 - ((DECK_WIDTH / TILE / 2) % 1); // a tile's rust-stained centre under each track
  const bed = new Mesh(
    new PlaneGeometry(DECK_WIDTH, length).rotateX(-Math.PI / 2),
    new MeshStandardMaterial({ map: ballast, roughness: 0.95 }),
  );
  bed.position.y = BED_Y;
  group.add(bed);

  const dummy = new Object3D();
  const perTrack = Math.floor(length / SLEEPER_SPACING);
  const sleeper = new BoxGeometry(2.5, SLEEPER_DEPTH, 0.26).translate(0, SLEEPER_TOP - SLEEPER_DEPTH / 2, 0);
  const sleepers = new InstancedMesh(sleeper, new MeshStandardMaterial({ color: 0x8c8a84, roughness: 0.9 }), perTrack * TRACK_XS.length);
  const insulator = new CylinderGeometry(0.06, 0.08, 0.13, 8).translate(0, SLEEPER_TOP + 0.065, 0);
  const perTrackPots = Math.floor(length / INSULATOR_SPACING);
  const pots = new InstancedMesh(insulator, new MeshStandardMaterial({ color: 0xe6e1d6, roughness: 0.35 }), perTrackPots * TRACK_XS.length);
  let n = 0;
  let p = 0;
  for (const x of TRACK_XS) {
    for (let i = 0; i < perTrack; i++) {
      dummy.position.set(x, 0, -length / 2 + (i + 0.5) * SLEEPER_SPACING);
      dummy.updateMatrix();
      sleepers.setMatrixAt(n++, dummy.matrix);
    }
    for (let i = 0; i < perTrackPots; i++) {
      dummy.position.set(x - THIRD_RAIL, 0, -length / 2 + (i + 0.5) * INSULATOR_SPACING);
      dummy.updateMatrix();
      pots.setMatrixAt(p++, dummy.matrix);
    }
  }
  group.add(sleepers, pots);

  // Running rails: rust-brown sides, a mirror-bright strip worn into each head.
  const rail = railGeometry(length);
  const rails: BufferGeometry[] = [];
  const heads: BufferGeometry[] = [];
  for (const x of TRACK_XS) {
    for (const side of [-1, 1]) {
      rails.push(rail.clone().translate(x + side * RAIL_OFFSET, -RAIL_HEIGHT, 0));
      heads.push(new BoxGeometry(0.05, 0.004, length).translate(x + side * RAIL_OFFSET, 0.002, 0));
    }
    rails.push(new BoxGeometry(0.075, 0.07, length).translate(x - THIRD_RAIL, SLEEPER_TOP + 0.13 + 0.035, 0));
  }
  rail.dispose();
  const steel = new MeshStandardMaterial({ color: 0x5e4a3c, roughness: 0.7, metalness: 0.6 });
  const polished = new MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.15, metalness: 1 });
  group.add(new Mesh(mergeParts(rails), steel), new Mesh(mergeParts(heads), polished));

  // Cable troughs with concrete lids along both edges of the deck.
  const troughs = [-1, 1].map((side) => box(0.45, 0.22, length, side * (DECK_WIDTH / 2 - 0.35), BED_Y + 0.11, 0, 0x77746e));
  group.add(new Mesh(mergeParts(troughs), new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
  return group;
}
