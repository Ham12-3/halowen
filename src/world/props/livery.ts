import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';
import { createRng } from '../rng';
import { arcAtHeight, CARRIAGE_LENGTH, PROFILE_ARC, ROOF_START } from './carriage';

const W = 1024;
const H = 256;
const BODY = '#e8ebee';
const BAND = '#16181b';
const DOOR = '#f0be12';
const ROOF = '#9b9ea3';

/** Doors (centre along the carriage, metres from its -z end) and the windows between them. */
const DOORS = [CARRIAGE_LENGTH * 0.25, CARRIAGE_LENGTH * 0.75];
const DOOR_WIDTH = 1.45;
const WINDOWS: Array<[number, number]> = [
  [0.75, 2.05],
  [4.25, 6.45],
  [6.75, 8.95],
  [11.15, 12.45],
];

function canvas(fill: string): CanvasRenderingContext2D {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
  return ctx;
}

const px = (metres: number): number => (metres / CARRIAGE_LENGTH) * W;
/** Canvas y for a height on the carriage side (v = 0 at the bottom of the canvas). */
const py = (height: number): number => H - (arcAtHeight(height) / PROFILE_ARC) * H;

function rect(ctx: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(px(x0), py(y1), px(x1) - px(x0), py(y0) - py(y1));
}

/** Inside a lit carriage: bright LED ceiling, pale walls, rows of seat backs and the odd passenger. */
function interior(glow: CanvasRenderingContext2D, x0: number, x1: number, y0: number, y1: number, seed: number): void {
  const rng = createRng(seed);
  rect(glow, x0, x1, y0, y1, '#b9c4d2');
  rect(glow, x0, x1, y1 - (y1 - y0) * 0.3, y1, '#eef3fa');
  for (let x = x0 + 0.1; x < x1 - 0.3; x += 0.55) rect(glow, x, x + 0.42, y0, y0 + 0.22, '#3b4a6b');
  for (let x = x0 + 0.2; x < x1 - 0.4; x += 0.9) {
    if (rng() > 0.35) continue;
    const head = x + rng() * 0.3;
    rect(glow, head, head + 0.2, y0 + 0.2, y0 + 0.46, '#2a2724'); // a passenger's head and shoulders
    rect(glow, head - 0.08, head + 0.28, y0, y0 + 0.24, '#34302c');
  }
}

/**
 * The carriage livery, laid out as the body's unrolled cross-section: u along
 * the carriage, v from the bottom of the side up over the cantrail to the
 * roof's centre. White sides, a black band around the windows, yellow doors,
 * a grimy grey roof with seams and air-conditioning grilles. The glow twin
 * holds the lit interior seen through the windows.
 */
export function createLivery(): { map: Texture; glow: Texture } {
  const ctx = canvas(BODY);
  const glow = canvas('#000');
  const rng = createRng(7);

  rect(ctx, 0, CARRIAGE_LENGTH, 1.0, 1.18, '#3a3d42'); // solebar
  rect(ctx, 0, CARRIAGE_LENGTH, 1.78, 2.64, BAND);
  WINDOWS.forEach(([x0, x1], i) => {
    rect(ctx, x0, x1, 1.86, 2.56, '#0b0d10');
    interior(glow, x0 + 0.03, x1 - 0.03, 1.88, 2.54, 11 + i);
    for (let x = x0 + 1.1; x < x1 - 0.5; x += 1.1) rect(ctx, x, x + 0.05, 1.86, 2.56, BAND); // pillars
  });
  for (const centre of DOORS) {
    const x0 = centre - DOOR_WIDTH / 2;
    const x1 = centre + DOOR_WIDTH / 2;
    rect(ctx, x0, x1, 1.05, 2.86, DOOR);
    rect(ctx, centre - 0.01, centre + 0.01, 1.05, 2.86, '#8a6c08'); // the leaves' meeting edge
    for (const [a, b] of [[x0 + 0.14, centre - 0.12], [centre + 0.12, x1 - 0.14]] as const) {
      rect(ctx, a, b, 1.92, 2.6, '#0b0d10');
      interior(glow, a + 0.02, b - 0.02, 1.94, 2.58, Math.round(centre * 10));
    }
  }

  // The roof: light grey, darker where brake dust and diesel soot settle, panel seams, two grilles.
  const roofTop = 0;
  const roofBottom = H - ROOF_START * H;
  const grime = ctx.createLinearGradient(0, roofBottom, 0, roofTop);
  grime.addColorStop(0, '#b4b7bb');
  grime.addColorStop(0.35, ROOF);
  grime.addColorStop(1, '#85888d');
  ctx.fillStyle = grime;
  ctx.fillRect(0, roofTop, W, roofBottom - roofTop);
  for (let x = 0.6; x < CARRIAGE_LENGTH; x += 1.2) {
    ctx.fillStyle = 'rgba(40,42,46,0.45)';
    ctx.fillRect(px(x), roofTop, 2, roofBottom - roofTop);
  }
  for (const centre of [CARRIAGE_LENGTH * 0.18, CARRIAGE_LENGTH * 0.82]) {
    ctx.fillStyle = '#6a6e74';
    ctx.fillRect(px(centre - 0.9), roofTop, px(1.8), (roofBottom - roofTop) * 0.55);
    ctx.fillStyle = '#4c5056';
    for (let y = roofTop + 3; y < roofTop + (roofBottom - roofTop) * 0.5; y += 5) ctx.fillRect(px(centre - 0.8), y, px(1.6), 2);
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(30,28,26,${0.05 + rng() * 0.12})`;
    ctx.fillRect(rng() * W, roofTop + rng() * (roofBottom - roofTop), 3 + rng() * 14, 2 + rng() * 6);
  }
  // Rain-streaked grime running down from the cantrail.
  for (let i = 0; i < 140; i++) {
    const x = rng() * W;
    const g = ctx.createLinearGradient(0, roofBottom, 0, roofBottom + 40);
    g.addColorStop(0, 'rgba(50,48,46,0.25)');
    g.addColorStop(1, 'rgba(50,48,46,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, roofBottom, 2 + rng() * 4, 40);
  }

  const toTexture = (c: CanvasRenderingContext2D): Texture => {
    const t = new CanvasTexture(c.canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: toTexture(ctx), glow: toTexture(glow) };
}
