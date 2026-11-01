import type { WebGLRenderer } from 'three';

const SAMPLE_WINDOW = 0.5;

/** Small dev overlay: frames per second plus draw calls. Toggle with the backquote key. */
export class FpsMeter {
  private readonly el: HTMLDivElement;
  private frames = 0;
  private time = 0;

  constructor(
    parent: HTMLElement,
    private readonly renderer: WebGLRenderer,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'fps-meter';
    parent.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.el.classList.toggle('hidden');
    });
  }

  tick(dt: number): void {
    this.frames++;
    this.time += dt;
    if (this.time < SAMPLE_WINDOW) return;
    const fps = Math.round(this.frames / this.time);
    const { calls, triangles } = this.renderer.info.render;
    this.el.textContent = `${fps} fps · ${calls} draws · ${(triangles / 1000).toFixed(0)}k tris`;
    this.frames = 0;
    this.time = 0;
  }
}
