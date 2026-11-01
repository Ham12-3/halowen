import { type CrashCause, formatDistance, formatScore, formatTime, type GameState } from '../game/GameState';
import { FINISH, STAGE_COUNT, STATIONS } from '../game/route';
import { LIVES } from '../game/config';
import {
  CRASH_ICON,
  GHOST_ICON,
  LANES_ICON,
  LANTERN_ICON,
  PUMPKIN_ICON,
  ROUNDEL_ICON,
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

const FIRST = STATIONS[0]?.name ?? '';
const LAST = STATIONS[STATIONS.length - 1]?.name ?? '';

/** Phones and tablets get swipe hints instead of keys. */
const TOUCH = window.matchMedia?.('(pointer: coarse)').matches ?? false;
const LANE_KEYS = TOUCH ? ['←', '→'] : ['A', 'D'];
const JUMP_KEYS = TOUCH ? ['↑', '↓'] : ['W', 'S'];
const START_HINT = TOUCH
  ? 'Swipe <kbd>←</kbd><kbd>→</kbd> to switch lanes, <kbd>↑</kbd> to jump, <kbd>↓</kbd> to slide'
  : 'or press <kbd>Space</kbd> &middot; <kbd>Esc</kbd> pause &middot; <kbd>M</kbd> sound';
const PAUSE_HINT = TOUCH ? '' : '<p class="hint"><kbd>Esc</kbd> resume &middot; <kbd>M</kbd> sound</p>';
const AGAIN_HINT = TOUCH ? '' : 'or press <kbd>Space</kbd> &middot; ';

const CRASHES: Record<CrashCause, [string, string]> = {
  fell: ['Off the rails!', 'You fell onto the tracks'],
  hurdle: ['Tripped on the pumpkins!', 'You went flying over a pile of jack-o’-lanterns'],
  bar: ['Hit the signal!', 'You ran head first into the ironwork'],
  ghost: ['The spirits claim you…', 'A ghost swept you off the line'],
};

/** The whole line as an Underground strip map: roundels joined by red line, each stage's length on it. */
function lineMap(): string {
  const stops = STATIONS.map((s, i) => {
    const next = STATIONS[i + 1];
    const leg = next ? `<span class="route-line"><span>${formatDistance(next.at - s.at)}</span></span>` : '';
    return `<span class="station"><span class="roundel"></span>${s.name}</span>${leg}`;
  });
  return `<div class="route-strip" aria-label="Route: ${STATIONS.map((s) => s.name).join(', ')}">${stops.join('')}</div>`;
}

function tip(icon: string, title: string, text: string, keys: string[]): string {
  const keycaps = keys.map((k) => `<kbd>${k}</kbd>`).join('');
  return `<li class="tip">${icon}<div><h3>${title}</h3><p>${text}</p></div><span class="keys">${keycaps}</span></li>`;
}

function startView(state: GameState): string {
  const best = state.best > 0 ? `<p class="badge">Best score &middot; ${formatScore(state.best)}</p>` : '';
  return `
    <div class="screen-card wide" role="dialog" aria-labelledby="screen-title">
      <p class="eyebrow">Halloween night &middot; London</p>
      <h1 class="logo" id="screen-title">Midnight Line</h1>
      <p class="tagline">Run the rooftops of the night trains across London, from ${FIRST} to ${LAST}. Gather souls, don't fall.</p>
      ${lineMap()}
      <ul class="how-to">
        ${tip(LANES_ICON, 'Switch lanes', 'Hop tracks before your train runs out.', LANE_KEYS)}
        ${tip(PUMPKIN_ICON, 'Jump & slide', 'Leap gaps and pumpkins; duck under signals and bridges.', JUMP_KEYS)}
        ${tip(GHOST_ICON, 'Dodge ghosts', `Red eyes mean it's swooping your way. ${LIVES.count} lives.`, [])}
        ${tip(LANTERN_ICON, 'Grab lanterns', 'The flare banishes ghosts and pulls souls to you.', [])}
      </ul>
      <button type="button" class="btn btn-primary" data-action="play">Start running</button>
      <p class="hint">${START_HINT}</p>
      ${best}
    </div>`;
}

function statTiles(tiles: Array<[string, string]>): string {
  const items = tiles.map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  return `<dl class="stat-grid">${items}</dl>`;
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
      <p class="eyebrow">Stage ${state.stage + 1} of ${STAGE_COUNT}</p>
      <h2 id="screen-title">Paused</h2>
      ${statTiles([
        ['Score', formatScore(state.score)],
        ['Souls', String(state.souls)],
        ['Lives', String(state.lives)],
        [`To ${state.nextStation.name}`, formatDistance(state.toNext)],
      ])}
      <div class="actions">
        <button type="button" class="btn btn-primary" data-action="play">Resume</button>
        <button type="button" class="btn btn-ghost" data-action="restart">Restart run</button>
      </div>
      ${soundButton(muted)}
      ${PAUSE_HINT}
    </div>`;
}

/** How far along the whole line the run got, with a tick at each station. */
function runProgress(state: GameState): string {
  const ticks = STATIONS.slice(1, -1).map((s) => `<i style="left:${(s.at / FINISH) * 100}%"></i>`).join('');
  return `
    <div class="run-progress" role="img" aria-label="${Math.round(state.progress * 100)}% of the way to ${LAST}">
      <span style="transform: scaleX(${state.progress.toFixed(3)})"></span>${ticks}
    </div>
    <div class="run-progress-labels"><span>${FIRST}</span><span>${LAST}</span></div>`;
}

function endView(state: GameState): string {
  const arrived = state.status === 'arrived';
  const [title, what] = arrived ? [`${LAST}!`, ''] : CRASHES[state.cause ?? 'fell'];
  const detail = arrived
    ? `You rode the whole Midnight Line and gathered ${state.souls} souls on the way.`
    : `${what}, ${formatDistance(state.toNext)} short of ${state.nextStation.name}.`;
  const record = state.isNewBest ? '<p class="badge new-best">New best score!</p>' : '';
  return `
    <div class="screen-card panel" role="dialog" aria-labelledby="screen-title">
      <div class="outcome-icon">${arrived ? ROUNDEL_ICON : CRASH_ICON}</div>
      <p class="eyebrow">${arrived ? 'End of the line' : `Stage ${state.stage + 1} of ${STAGE_COUNT}`}</p>
      <h2 id="screen-title">${title}</h2>
      <p class="screen-detail">${detail}</p>
      ${runProgress(state)}
      ${statTiles([
        ['Score', formatScore(state.score)],
        ['Souls', String(state.souls)],
        ['Distance', formatDistance(state.distance)],
        ['Best', formatScore(state.best)],
      ])}
      ${record}
      <button type="button" class="btn btn-primary" data-action="play">Run again</button>
      <p class="hint">${AGAIN_HINT}${formatTime(state.time)} on the line</p>
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
    // The key covers everything a screen shows that can differ between two runs' end screens.
    const key = view ? `${view}:${state.status}:${state.cause}:${state.score}:${muted}` : '';
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
