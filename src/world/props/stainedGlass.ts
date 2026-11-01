import { CanvasTexture, SRGBColorSpace, type Texture } from 'three';

const GLASS = ['#9e1f2a', '#1f3f9e', '#c99a2e', '#2e7a4f', '#6a2b8c'];

/** Procedural rose-window texture: concentric rings of coloured petals with lead lines. */
export function createRoseWindowTexture(size = 256): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');

  const c = size / 2;
  ctx.fillStyle = '#120d0a';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#120d0a';
  ctx.lineWidth = size * 0.012;

  const ring = (count: number, radius: number, petal: number, offset: number): void => {
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * radius, c + Math.sin(a) * radius, petal, 0, Math.PI * 2);
      ctx.fillStyle = GLASS[(i + count) % GLASS.length] ?? '#c99a2e';
      ctx.fill();
      ctx.stroke();
    }
  };

  ring(16, size * 0.41, size * 0.075, 0);
  ring(12, size * 0.29, size * 0.08, Math.PI / 12);
  ring(8, size * 0.16, size * 0.07, 0);
  ctx.beginPath();
  ctx.arc(c, c, size * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = '#c99a2e';
  ctx.fill();
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
