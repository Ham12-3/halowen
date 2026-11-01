import { ROUTE } from '../game/config';
import { type CrashCause, formatDistance, formatTime, type GameState } from '../game/GameState';
import {
  CRASH_ICON,
  LANES_ICON,
  PUMPKIN_ICON,
  ROUNDEL_ICON,
  SIGNAL_ICON,
  SOUND_OFF_ICON,
  SOUND_ON_ICON,
} from './icons';

export interface ScreenHandlers {
  /** The main button, or a click on the backdrop: start, resume, or run again. */
  onPlay: () => void;
  /** The pause screen's restart button. */
  onRestart: () => void;
  onToggleSound: () => void;
}

type ScreenView = 'start' | 'pause' | 'end';

const CRASHES: Record<CrashCause, [string, string]> = {
  fell: ['Off the rails!', 'You fell onto the tracks'],
  hurdle: ['Tripped on the pumpkins!', 'You went flying over a pile of jack-o’-lanterns'],
  bar: ['Hit the signal!', 'You ran head first into the ironwork'],
};

const station = (name: string): string => `<span class="station"><span class="roundel"></span>${name}</span>`;

function tip(icon: string, title: string, text: string, keys: string[]): string {
  return `
    <li class="tip">${icon}
      <div><h3>${title}</h3><p>${text}</p></div>
      <span class="keys">${keys.map((k) => `<kbd>${k}</kbd>`).join('')}</span>
    </li>`;
}

function startView(state: GameState): string {
  const best = state.best > 0 ? `<p class="badge">Best run &middot; ${formatDistance(state.best)}</p>` : '';
  return `
    <div class="screen-card wide" role="dialog" aria-labelledby="screen-title">
      <p class="eyebrow">Halloween night &middot; London</p>
      <h1 class="logo" id="screen-title">Midnight Line</h1>
      <p class="tagline">Run the rooftops of the night trains from ${ROUTE.from} to ${ROUTE.to}. Don't fall, don't stop.</p>
      <div class="route-strip" aria-label="Route: ${ROUTE.from} to ${ROUTE.to}, ${formatDistance(ROUTE.length)}">
        ${station(ROUTE.from)}<span class="route-line"><span>${formatDistance(ROUTE.length)}</span></span>${station(ROUTE.to)}
      </div>
      <ul class="how-to">
        ${tip(LANES_ICON, 'Switch lanes', 'Hop tracks before your train runs out.', ['A', 'D'])}
        ${tip(PUMPKIN_ICON, 'Jump', 'Leap the gaps and jack-o’-lantern piles.', ['W', 'Space'])}
        ${tip(SIGNAL_ICON, 'Slide', 'Duck under signals and bridges.', ['S'])}
      </ul>
      <button type="button" class="btn btn-primary" data-action="play">Start running</button>
      <p class="hint">or press <kbd>Space</kbd> &middot; <kbd>Esc</kbd> pause &middot; <kbd>M</kbd> sound</p>
      ${best}
    </div>`;
}

function statTiles(tiles: Array<[string, string]>): string {
  return `<dl class="stat-grid">${tiles.map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function soundButton(muted: boolean): string {
  return `
    <button type="button" class="btn btn-ghost btn-small" data-action="sound" aria-pressed="${!muted}">
      ${muted ? SOUND_OFF_ICON : SOUND_ON_ICON}Sound ${muted ? 'off' : 'on'}
    </button>`;
}

function pauseView(state: GameState, muted: boolean): string {
  return `
    <div class="screen-card panel" role="dialog" aria-labelledby="screen-title">
      <h2 id="screen-title">Paused</h2>
      ${statTiles([
        ['Run', formatDistance(state.distance)],
        [`To ${ROUTE.to}`, formatDistance(state.remaining)],
        ['Time', formatTime(state.time)],
      ])}
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="play">Resume</button>
        <button type="button" class="btn btn-ghost" data-action="restart">Restart run</button>
      </div>
      ${soundButton(muted)}
      <p class="hint"><kbd>Esc</kbd> resume &middot; <kbd>M</kbd> sound</p>
    </div>`;
}

function endView(state: GameState): string {
  const arrived = state.status === 'arrived';
  const [title, what] = arrived ? [`${ROUTE.to}!`, ''] : CRASHES[state.cause ?? 'fell'];
  const detail = arrived
    ? `You rode the Midnight Line all the way from ${ROUTE.from}.`
    : `${what}, ${formatDistance(state.remaining)} short of ${ROUTE.to}.`;
  const record = state.isNewBest ? '<p class="badge new-best">New best run!</p>' : '';
  return `
    <div class="screen-card panel" role="dialog" aria-labelledby="screen-title">
      <div class="outcome-icon">${arrived ? ROUNDEL_ICON : CRASH_ICON}</div>
      <h2 id="screen-title">${title}</h2>
      <p class="screen-detail">${detail}</p>
      <div class="run-progress" role="img" aria-label="${Math.round(state.progress * 100)}% of the way to ${ROUTE.to}">
        <span style="transform: scaleX(${state.progress.toFixed(3)})"></span>
      </div>
      <div class="run-progress-labels"><span>${ROUTE.from}</span><span>${ROUTE.to}</span></div>
      ${statTiles([
        ['Run', formatDistance(state.distance)],
        ['Time', formatTime(state.time)],
        ['Best', formatDistance(state.best)],
      ])}
      ${record}
      <button type="button" class="btn btn-primary" data-action="play">Run again</button>
      <p class="hint">or press <kbd>Space</kbd></p>
    </div>`;
}

/** Full-screen overlays: the title, the pause screen, and the end of a run. */
export class Screens {
  private readonly el: HTMLDivElement;
  private key = '';

  constructor(parent: HTMLElement, handlers: ScreenHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'screen hidden';
    this.el.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'restart') handlers.onRestart();
      else if (action === 'sound') handlers.onToggleSound();
      // The main button, or the backdrop around the card (clicks inside the card's text do nothing).
      else if (action === 'play' || !target?.closest('.screen-card')) handlers.onPlay();
    });
    parent.appendChild(this.el);
  }

  /** Shows the right screen for the moment (or none while running). */
  update(state: GameState, paused: boolean, muted: boolean): void {
    const view: ScreenView | null =
      state.status === 'ready' ? 'start' : state.isOver ? 'end' : paused ? 'pause' : null;
    const key = view ? `${view}:${state.status}:${muted}` : '';
    if (key === this.key) return;
    this.key = key;
    this.el.className = view ? `screen ${view} ${state.status}` : 'screen hidden';
    if (!view) return;

    // Keep keyboard focus on the same control across a re-render (e.g. toggling sound).
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.action : undefined;
    this.el.innerHTML = view === 'start' ? startView(state) : view === 'pause' ? pauseView(state, muted) : endView(state);
    const target = this.el.querySelector<HTMLElement>(`[data-action="${focused ?? 'play'}"]`) ??
      this.el.querySelector<HTMLElement>('[data-action="play"]');
    target?.focus({ preventScroll: true });
  }
}
