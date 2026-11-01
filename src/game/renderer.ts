import { ACESFilmicToneMapping, WebGLRenderer } from 'three';
import { RENDER } from './config';

/**
 * The WebGL renderer: filmic tone mapping and a capped pixel ratio. No shadow
 * maps: the world scrolls past every frame, so the runner uses a blob shadow.
 */
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);
  return renderer;
}
