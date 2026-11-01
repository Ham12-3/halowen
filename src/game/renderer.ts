import { ACESFilmicToneMapping, PCFShadowMap, WebGLRenderer } from 'three';
import { RENDER } from './config';

/** The WebGL renderer: filmic tone mapping, capped pixel ratio, moonlight shadows. */
export function createRenderer(container: HTMLElement): WebGLRenderer {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  // The moon is fixed and everything that casts its shadows is static (the player
  // has a blob shadow instead), so the shadow map is drawn once rather than every
  // frame, which saves ~8 ms of GPU time per frame on an integrated laptop GPU.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    renderer.shadowMap.needsUpdate = true;
  });
  container.appendChild(renderer.domElement);
  return renderer;
}
