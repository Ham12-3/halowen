import { formatTime, type GameState } from '../game/GameState';

const CANDLE_ICON = `
  <svg viewBox="0 0 24 32" width="22" height="30" aria-hidden="true">
    <path d="M12 2c3 4 4 6 4 8.5a4 4 0 0 1-8 0C8 8 9 6 12 2z" fill="#9ff0ff"/>
    <path d="M12 6c1.4 2 2 3.2 2 4.6a2 2 0 0 1-4 0c0-1.4.6-2.6 2-4.6z" fill="#ffffff"/>
    <rect x="9" y="15" width="6" height="13" rx="1" fill="#e2dccb"/>
    <rect x="6" y="28" width="12" height="2.5" rx="1" fill="#6b6460"/>
  </svg>`;

const PUMPKIN_ICON = `
  <svg viewBox="0 0 32 30" width="30" height="28" aria-hidden="true">
    <path d="M15 5c0-2 1-4 3-4" stroke="#4a5a20" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <ellipse cx="9.5" cy="17" rx="7.5" ry="10" fill="#e06a12"/>
    <ellipse cx="22.5" cy="17" rx="7.5" ry="10" fill="#e06a12"/>
    <ellipse cx="16" cy="17" rx="7" ry="11" fill="#f07c1c"/>
    <path d="M8 13l3.5-4 3.5 4zM17 13l3.5-4 3.5 4z" fill="#ffd36b"/>
    <path d="M7 19c3 5 15 5 18 0l-3 1.5-2-2-2 2-2-2-2 2-2-2-2 2z" fill="#ffd36b"/>
  </svg>`;

/** Heads-up display: souls, lives, the midnight countdown and an end-of-round banner. */
export class Hud {
  private readonly souls: HTMLSpanElement;
  private readonly soulsBox: HTMLDivElement;
  private readonly lives: HTMLDivElement[];
  private readonly timer: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly hurtFlash: HTMLDivElement;
  private lastSouls = '';
  private lastTime = '';
  private lastLives = -1;

  constructor(parent: HTMLElement, maxLives: number) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <div class="hud-souls">${CANDLE_ICON}<span class="hud-souls-count"></span></div>
      <div class="hud-timer" title="Time until midnight"></div>
      <div class="hud-lives" title="Lives">${`<div class="hud-life">${PUMPKIN_ICON}</div>`.repeat(maxLives)}</div>
    `;
    this.banner = document.createElement('div');
    this.banner.className = 'hud-banner hidden';
    this.hurtFlash = document.createElement('div');
    this.hurtFlash.className = 'hurt-flash';
    parent.append(this.hurtFlash, root, this.banner);

    this.soulsBox = root.querySelector<HTMLDivElement>('.hud-souls') ?? root;
    this.souls = root.querySelector<HTMLSpanElement>('.hud-souls-count') ?? document.createElement('span');
    this.timer = root.querySelector<HTMLDivElement>('.hud-timer') ?? root;
    this.lives = Array.from(root.querySelectorAll<HTMLDivElement>('.hud-life'));
    this.soulsBox.addEventListener('animationend', () => this.soulsBox.classList.remove('pulse'));
    this.hurtFlash.addEventListener('animationend', () => this.hurtFlash.classList.remove('active'));
  }

  /** Cheap to call every frame: the DOM is only touched when something changes. */
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
    if (state.lives !== this.lastLives) {
      this.lives.forEach((life, i) => life.classList.toggle('lost', i >= state.lives));
      this.lastLives = state.lives;
    }
  }

  /** Brief flare on the counter when a candle is gathered. */
  pulseSouls(): void {
    this.restartAnimation(this.soulsBox, 'pulse');
  }

  /** Red vignette when a ghost touches the player. */
  flashHurt(): void {
    this.restartAnimation(this.hurtFlash, 'active');
  }

  /** Temporary end-of-round message; Phase 4 replaces it with proper screens. */
  showRoundEnd(state: GameState): void {
    const won = state.status === 'won';
    const souls = `${state.score} of ${state.target} souls`;
    const [title, detail] = won
      ? ['Every soul is gathered!', `All ${state.target} candles found with ${formatTime(state.timeLeft)} to spare.`]
      : state.status === 'dead'
        ? ['The spirits claim you…', `Your last life slipped away with ${souls} gathered.`]
        : ['Midnight tolls…', `The bell rang with ${souls} gathered.`];
    this.banner.innerHTML = `<h2>${title}</h2><p>${detail}</p><p class="hint">Press R to play again</p>`;
    this.banner.classList.toggle('won', won);
    this.banner.classList.remove('hidden');
  }

  hideBanner(): void {
    this.banner.classList.add('hidden');
  }

  private restartAnimation(el: HTMLElement, className: string): void {
    el.classList.remove(className);
    void el.offsetWidth; // force a reflow so the CSS animation plays again
    el.classList.add(className);
  }
}
