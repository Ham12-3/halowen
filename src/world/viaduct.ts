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
import { TRAIN } from '../game/config';
import { STREET_Y } from './props/obstacles';
import { createRng } from './rng';
import { BED_Y, createTrack, DECK_WIDTH } from './track';

/** Metres of viaduct built; it slides forward in whole blocks to look endless. */
const LENGTH = 480;
const BEHIND = 60;
const L = TRAIN.blockLength;
/** Top of the brick structure, just under the ballast. */
const DECK_TOP = BED_Y - 0.02;
const PARAPET_HEIGHT = 1.1;

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
  const pxPerMetreY = h / (DECK_TOP - STREET_Y);
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

/** One tile of the streets below (two blocks square): wet asphalt, a road each way, pools of lamplight. */
function streetTextures(): { map: Texture; glow: Texture } {
  const size = 256;
  const m = size / (2 * L);
  const rng = createRng(19);
  const map = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#2a2a2e'; // pavements and yards
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#16161a'; // roads
    ctx.fillRect(9 * m, 0, 9 * m, size);
    ctx.fillRect(0, 2 * m, size, 9 * m);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rng() * 0.25})`;
      ctx.fillRect(rng() * size, rng() * size, 2, 2);
    }
  });
  const glow = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (const [x, y] of [[8, 1], [19, 1], [8, 12], [19, 12], [8, 26], [19, 20], [3, 12], [25, 1]] as const) {
      const pool = ctx.createRadialGradient(x * m, y * m, 0, x * m, y * m, 4.5 * m);
      pool.addColorStop(0, 'rgba(255,170,90,0.85)');
      pool.addColorStop(0.35, 'rgba(255,140,60,0.35)');
      pool.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(0, 0, size, size);
    }
  });
  return { map, glow };
}

function repeat(texture: Texture, x: number, y: number): Texture {
  texture.repeat.set(x, y);
  return texture;
}

/**
 * The railway viaduct: five tracks (see track.ts) on a brick deck with
 * parapets and coping, brick arches below and the street beneath. Built once,
 * then shifted two blocks at a time to follow the runner.
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

  const track = createTrack(LENGTH);
  track.position.z = centreZ;
  group.add(track);

  const parapet = new MeshStandardMaterial({ map: repeat(parapetTexture(), LENGTH / 4, 1), roughness: 0.95 });
  const wallHeight = PARAPET_HEIGHT - DECK_TOP;
  for (const side of [-1, 1]) add(new BoxGeometry(0.45, wallHeight, LENGTH), parapet, side * (DECK_WIDTH / 2 + 0.22), DECK_TOP + wallHeight / 2);
  const coping = new MeshStandardMaterial({ color: 0x8e8a82, roughness: 0.6 });
  for (const side of [-1, 1]) add(new BoxGeometry(0.6, 0.1, LENGTH), coping, side * (DECK_WIDTH / 2 + 0.22), PARAPET_HEIGHT + 0.05);

  const arches = new MeshStandardMaterial({ map: repeat(archTexture(), LENGTH / (2 * L), 1), roughness: 0.95 });
  add(new BoxGeometry(DECK_WIDTH + 0.9, DECK_TOP - STREET_Y, LENGTH), arches, 0, (STREET_Y + DECK_TOP) / 2);

  // The streets: a grid of roads, wet enough to catch the city's reflection, lamplight pooling on them.
  const streets = streetTextures();
  const tiles = [400 / (2 * L), LENGTH / (2 * L)] as const;
  const street = new PlaneGeometry(400, LENGTH).rotateX(-Math.PI / 2);
  add(
    street,
    new MeshStandardMaterial({
      map: repeat(streets.map, ...tiles),
      emissiveMap: repeat(streets.glow, ...tiles),
      emissive: 0xffffff,
      emissiveIntensity: 1.3,
      roughness: 0.45,
    }),
    0,
    STREET_Y,
  );

  return {
    group,
    update(distance: number): void {
      // Two blocks at a time: every texture here repeats in a whole fraction of that.
      group.position.z = -Math.floor(distance / (2 * L)) * 2 * L;
    },
  };
}
