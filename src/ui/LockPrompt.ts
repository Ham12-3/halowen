import type { Input } from '../game/Input';

/**
 * Overlay shown whenever the mouse is not captured. Clicking it requests
 * pointer lock. (Phase 4 replaces this with proper start/pause screens.)
 */
export class LockPrompt {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement, input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'lock-prompt';
    this.el.innerHTML = `
      <h1>Pumpkin Hollow</h1>
      <p>Click to explore the old churchyard</p>
      <p>WASD to move &middot; Mouse to look &middot; Esc to release the mouse</p>
    `;
    this.el.addEventListener('click', () => input.requestPointerLock());
    input.onLockChange((locked) => this.el.classList.toggle('hidden', locked));
    parent.appendChild(this.el);
  }
}
