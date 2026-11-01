import { ROUND } from '../game/config';
import type { Input } from '../game/Input';

/**
 * Overlay shown whenever the mouse is not captured; the game is paused while
 * it is up. Clicking it requests pointer lock. (Phase 4 replaces this with
 * proper start/pause screens.)
 */
export class LockPrompt {
  private readonly el: HTMLDivElement;

  constructor(parent: HTMLElement, input: Input) {
    this.el = document.createElement('div');
    this.el.className = 'lock-prompt';
    this.el.innerHTML = `
      <h1>Pumpkin Hollow</h1>
      <p class="goal">Gather the ${ROUND.candles} soul candles before the church bell tolls midnight</p>
      <p>Ghosts roam the graves &mdash; their eyes burn red when they hunt you. ${ROUND.lives} lives.</p>
      <p>Click to play</p>
      <p>WASD to move &middot; Mouse to look &middot; Esc to pause</p>
    `;
    this.el.addEventListener('click', () => input.requestPointerLock());
    input.onLockChange((locked) => this.el.classList.toggle('hidden', locked));
    parent.appendChild(this.el);
  }
}
