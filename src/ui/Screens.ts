import { ROUND } from '../game/config';
import { formatTime, type GameState } from '../game/GameState';
import { CANDLE_ICON, GHOST_ICON, LANTERN_ICON } from './icons';

export interface ScreenHandlers {
  /** Any click on a screen: start, resume, or play again. */
  onPlay: () => void;
  /** The pause screen's restart button. */
  onRestart: () => void;
}

type ScreenView = 'start' | 'pause' | 'end';

const KEYS = `
  <div class="screen-keys">
    <span><kbd>W</kbd><kbd>S</kbd> walk</span>
    <span><kbd>A</kbd><kbd>D</kbd> turn</span>
    <span><kbd>Mouse</kbd> look</span>
    <span><kbd>Space</kbd> flare</span>
    <span><kbd>Esc</kbd> pause</span>
    <span><kbd>M</kbd> sound</span>
  </div>`;

function startView(): string {
  return `
    <h1>Pumpkin Hollow</h1>
    <p class="screen-tagline">Halloween night in the old town churchyard</p>
    <ul class="screen-rules">
      <li>${CANDLE_ICON}<span>Gather the <b>${ROUND.candles} soul candles</b> before the church bell tolls midnight.</span></li>
      <li>${GHOST_ICON}<span>Ghosts hunt you when their eyes <b class="red">burn red</b>.
        ${ROUND.lives} touches and you're theirs.</span></li>
      <li>${LANTERN_ICON}<span><b>Flare</b> your lantern to blast ghosts back. It burns oil, so refill
        at the glowing <b>pumpkin shrines</b>.</span></li>
    </ul>
    ${KEYS}
    <p class="screen-cta">Click to begin</p>`;
}

function stats(state: GameState): string {
  const lives = `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left`;
  return `
    <p class="screen-stats">
      <span>${state.score} / ${state.target} souls</span>
      <span>${formatTime(state.timeLeft)} to midnight</span>
      <span>${lives}</span>
    </p>`;
}

function pauseView(state: GameState, muted: boolean): string {
  return `
    <h2>Paused</h2>
    ${stats(state)}
    ${KEYS}
    <p class="screen-cta">Click to resume</p>
    <button type="button" class="screen-button" data-action="restart">Restart round</button>
    <p class="screen-note">Sound is ${muted ? 'off' : 'on'} &middot; press M to toggle</p>`;
}

function endView(state: GameState): string {
  const souls = `${state.score} of ${state.target} souls`;
  const [title, detail] =
    state.status === 'won'
      ? ['Every soul is gathered!', `You lit all ${state.target} souls home with ${formatTime(state.timeLeft)} to spare.`]
      : state.status === 'dead'
        ? ['The spirits claim you…', `Your lantern fell dark with ${souls} gathered.`]
        : ['Midnight tolls…', `The bell struck twelve with ${souls} gathered.`];
  return `
    <h2>${title}</h2>
    <p class="screen-detail">${detail}</p>
    ${stats(state)}
    <p class="screen-cta">Press R or click to play again</p>`;
}

/**
 * Full-screen overlays: the title before a round, the pause screen when the
 * mouse is released mid-round, and the results once a round ends.
 */
export class Screens {
  private readonly el: HTMLDivElement;
  private key = '';

  constructor(parent: HTMLElement, handlers: ScreenHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'screen hidden';
    this.el.addEventListener('click', (e) => {
      const onRestart = e.target instanceof Element && e.target.closest('[data-action="restart"]');
      if (onRestart) handlers.onRestart();
      else handlers.onPlay();
    });
    parent.appendChild(this.el);
  }

  /**
   * Shows the right screen for the moment. `captured` means the mouse is
   * locked (or about to be), which hides the title and pause screens.
   */
  update(state: GameState, captured: boolean, muted: boolean): void {
    const view: ScreenView | null = state.isOver ? 'end' : captured ? null : state.status === 'ready' ? 'start' : 'pause';
    const key = view ? `${view}:${state.status}:${muted}` : '';
    if (key === this.key) return;
    this.key = key;
    this.el.className = view ? `screen ${view} ${state.status}` : 'screen hidden';
    if (!view) return;
    const html = view === 'start' ? startView() : view === 'pause' ? pauseView(state, muted) : endView(state);
    this.el.innerHTML = `<div class="screen-card">${html}</div>`;
  }
}
