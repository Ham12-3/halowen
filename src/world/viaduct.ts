import {
  BoxGeometry,
  CanvasTexture,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';
import { LANES, TRAIN } from '../game/config';
import { laneX } from './course';
import { STREET_Y } from './props/obstacles';
import { createRng } from './rng';

/** Metres of viaduct built; it slides forward in whole blocks to look endless. */
const LENGTH = 480;
const BEHIND = 60;
const DECK_WIDTH = LANES.count * LANES.width + 2;
const L = TRAIN.blockLength;

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  draw(ctx);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Dark ballast with one timber sleeper per tile (0.7 m), across the whole deck. */
function ballastTexture(): Texture {
  const rng = createRng(11);
  return canvasTexture(128, 32, (ctx) => {
    ctx.fillStyle = '#2b2a2c';
    ctx.fillRect(0, 0, 128, 32);
    for (let i = 0; i < 500; i++) {
      const v = 30 + Math.floor(rng() * 40);
      ctx.fillStyle = `rgb(${v},${v - 2},${v - 4})`;
      ctx.fillRect(rng() * 128, rng() * 32, 2, 2);
    }
    ctx.fillStyle = '#3b2c22';
    ctx.fillRect(0, 10, 128, 12);
  });
}

/** London stock brick, 16x8 px per brick. */
function drawBricks(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number): void {
  const rng = createRng(seed);
  ctx.fillStyle = '#4a3a30';
  ctx.fillRect(0, 0, width, height);
  for (let y = 0; y < height; y += 8) {
    for (let x = (y / 8) % 2 ? -8 : 0; x < width; x += 16) {
      const v = rng() * 18;
      ctx.fillStyle = `rgb(${92 + v},${70 + v * 0.7},${52 + v * 0.5})`;
      ctx.fillRect(x + 1, y + 1, 14, 6);
    }
  }
}

/** Parapet brickwork: one tile is 4 m long by the 1.1 m wall height. */
function parapetTexture(): Texture {
  return canvasTexture(256, 64, (ctx) => drawBricks(ctx, 256, 64, 6));
}

/**
 * The viaduct's side wall: two railway arches per tile (2 blocks long, street to
 * deck), one with a lit shop or pub tucked inside, one dark.
 */
function archTexture(): Texture {
  const w = 2048;
  const h = 512;
  const pxPerMetreX = w / (2 * L);
  const pxPerMetreY = h / -STREET_Y;
  return canvasTexture(w, h, (ctx) => {
    drawBricks(ctx, w, h, 5);
    for (const [i, lit] of [[0, true], [1, false]] as const) {
      const cx = (i + 0.5) * L * pxPerMetreX;
      const spring = h - 4 * pxPerMetreY;
      ctx.fillStyle = '#0c0a0d';
      ctx.beginPath();
      ctx.ellipse(cx, spring, 4.7 * pxPerMetreX, 4.4 * pxPerMetreY, 0, Math.PI, 0);
      ctx.lineTo(cx + 4.7 * pxPerMetreX, h);
      ctx.lineTo(cx - 4.7 * pxPerMetreX, h);
      ctx.fill();
      if (!lit) continue;
      ctx.fillStyle = '#ffae55';
      ctx.fillRect(cx - 3.4 * pxPerMetreX, h - 3.2 * pxPerMetreY, 6.8 * pxPerMetreX, 2.6 * pxPerMetreY);
      ctx.fillStyle = '#3a2412'; // window bars
      for (let k = -2; k <= 2; k++) ctx.fillRect(cx + k * 1.4 * pxPerMetreX - 3, h - 3.2 * pxPerMetreY, 6, 2.6 * pxPerMetreY);
    }
  });
}

function repeat(texture: Texture, x: number, y: number): Texture {
  texture.repeat.set(x, y);
  return texture;
}

/**
 * The railway viaduct: ballast, sleepers and three pairs of rails on a brick
 * deck with parapets, brick arches below and the street beneath. Built once,
 * then shifted a block at a time to follow the runner.
 */
export function createViaduct(): { group: Group; update(distance: number): void } {
  const group = new Group();
  group.name = 'viaduct';
  const centreZ = BEHIND - LENGTH / 2;
  const add = (geometry: BoxGeometry | PlaneGeometry, material: Material, x: number, y: number): void => {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, centreZ);
    group.add(mesh);
  };

  const deck = new PlaneGeometry(DECK_WIDTH, LENGTH).rotateX(-Math.PI / 2);
  add(deck, new MeshStandardMaterial({ map: repeat(ballastTexture(), 1, LENGTH / 0.7), roughness: 1 }), 0, 0);

  const rail = new MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.8, roughness: 0.35 });
  for (let lane = 0; lane < LANES.count; lane++) {
    for (const side of [-1, 1]) add(new BoxGeometry(0.08, 0.16, LENGTH), rail, laneX(lane) + side * 0.72, 0.08);
  }

  const parapet = new MeshStandardMaterial({ map: repeat(parapetTexture(), LENGTH / 4, 1), roughness: 0.95 });
  for (const side of [-1, 1]) add(new BoxGeometry(0.45, 1.1, LENGTH), parapet, side * (DECK_WIDTH / 2 + 0.22), 0.55);

  const arches = new MeshStandardMaterial({ map: repeat(archTexture(), LENGTH / (2 * L), 1), roughness: 0.95 });
  add(new BoxGeometry(DECK_WIDTH + 0.9, -STREET_Y, LENGTH), arches, 0, STREET_Y / 2 - 0.01);

  const street = new PlaneGeometry(400, LENGTH).rotateX(-Math.PI / 2);
  add(street, new MeshStandardMaterial({ color: 0x141418, roughness: 1 }), 0, STREET_Y);

  return {
    group,
    update(distance: number): void {
      // Two blocks at a time: every texture here repeats in a whole fraction of that.
      group.position.z = -Math.floor(distance / (2 * L)) * 2 * L;
    },
  };
}
