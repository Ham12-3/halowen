import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { createRng, type Rng } from './rng';

/** A facade tile: `bays` x `floors` cells, each `bay` x `floor` metres, painted at `ppm` pixels per metre. */
export interface Grid {
  bays: number;
  floors: number;
  bay: number;
  floor: number;
  ppm: number;
}

/** Alpha that marks plain wall in the colour texture; glass is fully opaque (see facadeMaterial.ts). */
const WALL_ALPHA = 150;

function context(width: number, height: number, fill: string): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, width, height);
  return ctx;
}

function texture(canvas: HTMLCanvasElement): Texture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Paints one facade tile into three layers at once: colour, a glass mask (packed
 * into the colour texture's alpha, so glass can be glossy and reflective) and
 * a glow layer holding only the lit windows. Coordinates are metres inside a
 * cell: x across the bay, y up from the floor. Row 0 is the ground floor.
 */
export class FacadePainter {
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;
  private readonly color: CanvasRenderingContext2D;
  private readonly mask: CanvasRenderingContext2D;
  private readonly glowCtx: CanvasRenderingContext2D;

  constructor(readonly grid: Grid, seed: number) {
    this.width = Math.round(grid.bays * grid.bay * grid.ppm);
    this.height = Math.round(grid.floors * grid.floor * grid.ppm);
    this.rng = createRng(seed);
    this.color = context(this.width, this.height, '#000');
    this.mask = context(this.width, this.height, '#000');
    this.glowCtx = context(this.width, this.height, '#000');
  }

  /** Canvas pixels for a rectangle in cell (bay, row). */
  private px(bay: number, row: number, x: number, y: number, w: number, h: number): [number, number, number, number] {
    const { ppm, bay: bw, floor: fh } = this.grid;
    const left = Math.round((bay * bw + x) * ppm);
    const top = Math.round(this.height - (row * fh + y + h) * ppm);
    return [left, top, Math.max(1, Math.round(w * ppm)), Math.max(1, Math.round(h * ppm))];
  }

  /** Opaque wall paint (brick, stone, frames). */
  wall(bay: number, row: number, x: number, y: number, w: number, h: number, color: string): void {
    const r = this.px(bay, row, x, y, w, h);
    this.color.fillStyle = color;
    this.color.fillRect(...r);
    this.mask.fillStyle = '#000';
    this.mask.fillRect(...r);
    this.glowCtx.fillStyle = '#000';
    this.glowCtx.fillRect(...r);
  }

  /** Glass: glossy and reflective, dark unless something glows behind it. */
  glass(bay: number, row: number, x: number, y: number, w: number, h: number, color: string, glow = '#000'): void {
    const r = this.px(bay, row, x, y, w, h);
    this.color.fillStyle = color;
    this.color.fillRect(...r);
    this.mask.fillStyle = '#fff';
    this.mask.fillRect(...r);
    this.glowCtx.fillStyle = glow;
    this.glowCtx.fillRect(...r);
  }

  /** Only the glow layer: interior detail seen through glass already painted. */
  glow(bay: number, row: number, x: number, y: number, w: number, h: number, color: string): void {
    this.glowCtx.fillStyle = color;
    this.glowCtx.fillRect(...this.px(bay, row, x, y, w, h));
  }

  /** Raw access for whole-tile passes (brickwork, weathering) on the colour layer. */
  get paint(): CanvasRenderingContext2D {
    return this.color;
  }

  /** Brick courses over the whole colour layer: `tones` are random per brick, `mortar` shows between. */
  bricks(tones: string[], mortar: string, length = 0.25, course = 0.094): void {
    const ctx = this.color;
    const { ppm } = this.grid;
    const bw = Math.max(2, Math.round(length * ppm));
    const bh = Math.max(2, Math.round(course * ppm));
    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, this.width, this.height);
    for (let y = 0, n = 0; y < this.height; y += bh, n++) {
      for (let x = n % 2 ? -bw / 2 : 0; x < this.width; x += bw) {
        ctx.fillStyle = tones[Math.floor(this.rng() * tones.length)] ?? mortar;
        ctx.fillRect(Math.round(x), y, bw - 1, bh - 1);
      }
    }
  }

  /** Soot and rain streaks running down from the top of the tile and below sills. */
  weather(strength: number): void {
    const ctx = this.color;
    for (let i = 0; i < this.width / 6; i++) {
      const x = this.rng() * this.width;
      const w = 2 + this.rng() * 10;
      const len = this.height * (0.1 + this.rng() * 0.5);
      const top = this.rng() * this.height;
      const g = ctx.createLinearGradient(0, top, 0, top + len);
      g.addColorStop(0, `rgba(10,8,6,${strength * this.rng()})`);
      g.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, top, w, len);
    }
  }

  /** The finished textures: colour with the glass mask in alpha, and the glow layer. */
  textures(): { map: Texture; glow: Texture } {
    const { width, height } = this;
    const image = this.color.getImageData(0, 0, width, height);
    const mask = this.mask.getImageData(0, 0, width, height).data;
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = (mask[i - 1] ?? 0) > 127 ? 255 : WALL_ALPHA;
    this.color.putImageData(image, 0, 0);
    return { map: texture(this.color.canvas), glow: texture(this.glowCtx.canvas) };
  }
}

/** Picks one item of a list at random. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('pick: empty list');
  return item;
}
