import { WebGLRenderer } from 'three';
import { RENDER } from './config';

/**
 * The WebGL renderer with a capped pixel ratio. Antialiasing, tone mapping and
 * bloom happen in the render pipeline (postfx.ts), so the canvas itself needs
 * neither. No shadow maps: the world scrolls past every frame, so the runner
 * uses a blob shadow.
 */
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  return renderer;
}
