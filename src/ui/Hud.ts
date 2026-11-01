import { FLARE, LIVES } from '../game/config';
import { formatDistance, formatScore, formatTime, type GameState } from '../game/GameState';
import { STAGE_COUNT, stageEnds } from '../game/route';
import { CLOCK_ICON, LANTERN_ICON, PAUSE_ICON, PUMPKIN_ICON, SOUL_ICON } from './icons';

const TOAST_MS = 2200;

type Field = 'score' | 'souls' | 'soulsBox' | 'time' | 'stage' | 'from' | 'to' | 'remaining' | 'speed';

/**
 * Heads-up display: score, souls and time on the left; the current stage drawn
 * as an Underground line with the runner's marker in the middle; speed with a
 * pace bar on the right; and short toasts for stations and milestones. Bars and
 * the marker move with transforms only, and the DOM is only touched on change.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly el: Record<Field, HTMLElement>;
  private readonly fill: HTMLElement;
  private readonly rail: HTMLElement;
  private readonly pace: HTMLElement;
  private readonly lives: HTMLElement[];
  private readonly flare: HTMLElement;
  private readonly flareFill: HTMLElement;
  private readonly toastEl: HTMLDivElement;
  private readonly crashFlash: HTMLDivElement;
  private readonly speedLines: HTMLDivElement;
  private readonly flareGlow: HTMLDivElement;
  private toastTimer = 0;
  private last: Record<string, string | number> = {};

  /** `onPause` runs when the on-screen pause button is pressed (for touch and mouse players). */
  constructor(parent: HTMLElement, onPause: () => void) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-left">
        <div class="hud-pill hud-score"><span class="hud-label">Score</span><span class="hud-score-value"></span></div>
        <div class="hud-row">
          <div class="hud-pill hud-souls" aria-label="Souls">${SOUL_ICON}<span></span></div>
          <div class="hud-pill hud-time" aria-label="Run time">${CLOCK_ICON}<span></span></div>
        </div>
      </div>
      <div class="hud-route">
        <div class="hud-label hud-stage"></div>
        <div class="hud-line">
          <span class="roundel"></span>
          <div class="hud-track">
            <div class="hud-track-fill"></div>
            <div class="hud-marker-rail"><div class="hud-marker"></div></div>
          </div>
          <span class="roundel"></span>
        </div>
        <div class="hud-route-labels"><span class="hud-from"></span><strong class="hud-remaining"></strong><span class="hud-to"></span></div>
      </div>
      <div class="hud-right">
        <button type="button" class="hud-pause" aria-label="Pause">${PAUSE_ICON}</button>
        <div class="hud-pill hud-speed">
          <div class="hud-speed-reading"><span class="hud-speed-value"></span><span class="hud-speed-unit">km/h</span></div>
          <div class="hud-pace"><div class="hud-pace-fill"></div></div>
        </div>
        <div class="hud-lives" aria-label="Lives">${`<span class="hud-life">${PUMPKIN_ICON}</span>`.repeat(LIVES.count)}</div>
        <div class="hud-pill hud-flare" aria-label="Lantern flare">
          ${LANTERN_ICON}<div class="hud-flare-bar"><div class="hud-flare-fill"></div></div>
        </div>
      </div>
    `;
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');
    this.crashFlash = document.createElement('div');
    this.crashFlash.className = 'crash-flash';
    // Faint speed streaks at the screen's edges, and a warm glow while the flare burns.
    this.speedLines = document.createElement('div');
    this.speedLines.className = 'speed-lines';
    this.flareGlow = document.createElement('div');
    this.flareGlow.className = 'flare-glow';
    parent.append(this.speedLines, this.flareGlow, this.crashFlash, this.root, this.toastEl);

    const find = (selector: string): HTMLElement => {
      const found = this.root.querySelector<HTMLElement>(selector);
      if (!found) throw new Error(`HUD element ${selector} missing`);
      return found;
    };
    this.el = {
      score: find('.hud-score-value'),
      souls: find('.hud-souls span'),
      soulsBox: find('.hud-souls'),
      time: find('.hud-time span'),
      stage: find('.hud-stage'),
      from: find('.hud-from'),
      to: find('.hud-to'),
      remaining: find('.hud-remaining'),
      speed: find('.hud-speed-value'),
    };
    this.fill = find('.hud-track-fill');
    this.rail = find('.hud-marker-rail');
    this.pace = find('.hud-pace-fill');
    this.lives = Array.from(this.root.querySelectorAll<HTMLElement>('.hud-life'));
    this.flare = find('.hud-flare');
    this.flareFill = find('.hud-flare-fill');
    find('.hud-pause').addEventListener('click', onPause);
    this.el.soulsBox.addEventListener('animationend', () => this.el.soulsBox.classList.remove('pulse'));
    this.crashFlash.addEventListener('animationend', () => this.crashFlash.classList.remove('active'));
  }

  /** Cheap to call every frame: each element is only written when its text changes. */
  update(state: GameState): void {
    const { from, to } = stageEnds(state.stage);
    this.text('score', formatScore(state.score));
    this.text('souls', String(state.souls));
    this.text('time', formatTime(state.time));
    this.text('stage', `Stage ${state.stage + 1} of ${STAGE_COUNT}`);
    this.text('from', from.name);
    this.text('to', to.name);
    this.text('remaining', state.status === 'arrived' ? 'Arrived!' : `${formatDistance(state.toNext)} to go`);
    this.text('speed', String(Math.round(state.speed * 3.6)));

    const progress = Math.round(Math.min(1, Math.max(0, (state.distance - from.at) / (to.at - from.at))) * 1000) / 1000;
    if (progress !== this.last.progress) {
      this.fill.style.transform = `scaleX(${progress})`;
      this.rail.style.transform = `translateX(${progress * 100}%)`;
      this.last.progress = progress;
    }
    const pace = Math.round(Math.max(0, state.pace) * 100) / 100;
    if (pace !== this.last.pace) {
      this.pace.style.transform = `scaleX(${pace})`;
      this.last.pace = pace;
    }
    if (state.lives !== this.last.lives) {
      this.lives.forEach((life, i) => life.classList.toggle('lost', i >= state.lives));
      this.last.lives = state.lives;
    }
    const flare = Math.round((state.flareLeft / FLARE.duration) * 100) / 100;
    if (flare !== this.last.flare) {
      this.flare.classList.toggle('active', flare > 0);
      this.flareFill.style.transform = `scaleX(${flare})`;
      this.flareGlow.classList.toggle('active', flare > 0);
      this.last.flare = flare;
    }
    // Streaks fade in as the pace picks up, only while actually running.
    const running = state.status === 'playing';
    const streaks = running ? Math.round(Math.max(0, state.pace - 0.15) * 20) / 20 : 0;
    if (streaks !== this.last.streaks) {
      this.speedLines.style.opacity = String(Math.min(0.75, streaks * 0.85));
      this.last.streaks = streaks;
    }
  }

  /** Hidden on the title screen. */
  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A quick flare on the soul counter when souls are gathered. */
  pulseSouls(): void {
    this.restartAnimation(this.el.soulsBox, 'pulse');
  }

  /** A short message under the route bar, e.g. "Waterloo! +500". */
  toast(text: string): void {
    this.toastEl.textContent = text;
    this.restartAnimation(this.toastEl, 'show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), TOAST_MS);
  }

  /** Clears any toast still showing (on restart). */
  clearToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toastEl.classList.remove('show');
  }

  /** Red flash at the edges when the run ends in a crash. */
  flashCrash(): void {
    this.restartAnimation(this.crashFlash, 'active');
  }

  private text(key: Field, value: string): void {
    if (this.last[key] === value) return;
    this.el[key].textContent = value;
    this.last[key] = value;
  }

  private restartAnimation(el: HTMLElement, className: string): void {
    el.classList.remove(className);
    void el.offsetWidth; // force a reflow so the CSS animation plays again
    el.classList.add(className);
  }
}
