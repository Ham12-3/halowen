import { formatTime, type GameState } from '../game/GameState';

const CANDLE_ICON = `
  <svg viewBox="0 0 24 32" width="22" height="30" aria-hidden="true">
    <path d="M12 2c3 4 4 6 4 8.5a4 4 0 0 1-8 0C8 8 9 6 12 2z" fill="#9ff0ff"/>
    <path d="M12 6c1.4 2 2 3.2 2 4.6a2 2 0 0 1-4 0c0-1.4.6-2.6 2-4.6z" fill="#ffffff"/>
    <rect x="9" y="15" width="6" height="13" rx="1" fill="#e2dccb"/>
    <rect x="6" y="28" width="12" height="2.5" rx="1" fill="#6b6460"/>
  </svg>`;

/** Heads-up display: souls gathered, the midnight countdown and an end-of-round banner. */
export class Hud {
  private readonly souls: HTMLSpanElement;
  private readonly soulsBox: HTMLDivElement;
  private readonly timer: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private lastSouls = '';
  private lastTime = '';

  constructor(parent: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud-souls">${CANDLE_ICON}<span class="hud-souls-count"></span></div>
      <div class="hud-timer" title="Time until midnight"></div>
    `;
    this.banner = document.createElement('div');
    this.banner.className = 'hud-banner hidden';
    parent.append(root, this.banner);

    this.soulsBox = root.querySelector<HTMLDivElement>('.hud-souls') ?? root;
    this.souls = root.querySelector<HTMLSpanElement>('.hud-souls-count') ?? document.createElement('span');
    this.timer = root.querySelector<HTMLDivElement>('.hud-timer') ?? root;
    this.soulsBox.addEventListener('animationend', () => this.soulsBox.classList.remove('pulse'));
  }

  /** Cheap to call every frame: the DOM is only touched when the text changes. */
  update(state: GameState): void {
    const souls = `${state.score} / ${state.target}`;
    if (souls !== this.lastSouls) {
      this.souls.textContent = souls;
      this.lastSouls = souls;
    }
    const time = formatTime(state.timeLeft);
    if (time !== this.lastTime) {
      this.timer.textContent = time;
      this.lastTime = time;
    }
    this.timer.classList.toggle('warning', state.isWarning);
  }

  /** Brief flare on the counter when a candle is gathered. */
  pulseSouls(): void {
    this.soulsBox.classList.remove('pulse');
    void this.soulsBox.offsetWidth; // restart the CSS animation
    this.soulsBox.classList.add('pulse');
  }

  /** Temporary end-of-round message; Phase 4 replaces it with proper screens. */
  showRoundEnd(state: GameState): void {
    const won = state.status === 'won';
    const title = won ? 'Every soul is gathered!' : 'Midnight tolls…';
    const detail = won
      ? `All ${state.target} candles found with ${formatTime(state.timeLeft)} to spare.`
      : `The bell rang with ${state.score} of ${state.target} souls gathered.`;
    this.banner.innerHTML = `<h2>${title}</h2><p>${detail}</p><p class="hint">Press R to play again</p>`;
    this.banner.classList.toggle('won', won);
    this.banner.classList.remove('hidden');
  }

  hideBanner(): void {
    this.banner.classList.add('hidden');
  }
}
