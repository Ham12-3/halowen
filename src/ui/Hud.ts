import { ROUTE } from '../game/config';
import { formatDistance, formatTime, type GameState } from '../game/GameState';
import { CLOCK_ICON } from './icons';

const TOAST_MS = 2200;

/**
 * Heads-up display: run time, the route drawn as an Underground line with the
 * runner's marker, distance to go, speed with a pace bar, and short toasts
 * for milestones. Bars and the marker move with transforms only.
 */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly time: HTMLSpanElement;
  private readonly fill: HTMLDivElement;
  private readonly rail: HTMLDivElement;
  private readonly remaining: HTMLElement;
  private readonly speed: HTMLSpanElement;
  private readonly pace: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly crashFlash: HTMLDivElement;
  private toastTimer = 0;
  private last = { time: '', progress: -1, remaining: '', speed: -1, pace: -1 };

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-pill hud-time" aria-label="Run time">${CLOCK_ICON}<span></span></div>
      <div class="hud-route">
        <div class="hud-line">
          <span class="roundel"></span>
          <div class="hud-track">
            <div class="hud-track-fill"></div>
            <div class="hud-marker-rail"><div class="hud-marker"></div></div>
          </div>
          <span class="roundel"></span>
        </div>
        <div class="hud-route-labels"><span>${ROUTE.from}</span><strong class="hud-remaining"></strong><span>${ROUTE.to}</span></div>
      </div>
      <div class="hud-pill hud-speed">
        <div class="hud-speed-reading"><span class="hud-speed-value"></span><span class="hud-speed-unit">km/h</span></div>
        <div class="hud-pace"><div class="hud-pace-fill"></div></div>
      </div>
    `;
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.toastEl.setAttribute('role', 'status');
    this.toastEl.setAttribute('aria-live', 'polite');
    this.crashFlash = document.createElement('div');
    this.crashFlash.className = 'crash-flash';
    parent.append(this.crashFlash, this.root, this.toastEl);

    const find = <T extends HTMLElement>(selector: string): T => {
      const el = this.root.querySelector<T>(selector);
      if (!el) throw new Error(`HUD element ${selector} missing`);
      return el;
    };
    this.time = find('.hud-time span');
    this.fill = find('.hud-track-fill');
    this.rail = find('.hud-marker-rail');
    this.remaining = find('.hud-remaining');
    this.speed = find('.hud-speed-value');
    this.pace = find('.hud-pace-fill');
    this.crashFlash.addEventListener('animationend', () => this.crashFlash.classList.remove('active'));
  }

  /** Cheap to call every frame: the DOM is only touched when something changes. */
  update(state: GameState): void {
    const time = formatTime(state.time);
    if (time !== this.last.time) this.time.textContent = this.last.time = time;

    const progress = Math.round(state.progress * 1000) / 1000;
    if (progress !== this.last.progress) {
      this.fill.style.transform = `scaleX(${progress})`;
      this.rail.style.transform = `translateX(${progress * 100}%)`;
      this.last.progress = progress;
    }
    const remaining = state.status === 'arrived' ? 'Arrived!' : `${formatDistance(state.remaining)} to go`;
    if (remaining !== this.last.remaining) this.remaining.textContent = this.last.remaining = remaining;

    const kmh = Math.round(state.speed * 3.6);
    if (kmh !== this.last.speed) {
      this.speed.textContent = String(kmh);
      this.last.speed = kmh;
    }
    const pace = Math.round(Math.max(0, state.pace) * 100) / 100;
    if (pace !== this.last.pace) {
      this.pace.style.transform = `scaleX(${pace})`;
      this.last.pace = pace;
    }
  }

  /** Hidden on the title screen. */
  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A short message under the route bar, e.g. "New best!". */
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

  private restartAnimation(el: HTMLElement, className: string): void {
    el.classList.remove(className);
    void el.offsetWidth; // force a reflow so the CSS animation plays again
    el.classList.add(className);
  }
}
