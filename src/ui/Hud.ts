import { FLARE } from '../game/config';
import { formatTime, type GameState } from '../game/GameState';
import { CANDLE_ICON, LANTERN_ICON, PUMPKIN_ICON } from './icons';

/** Tick marks on the oil gauge, one per flare's worth of oil. */
function fuelNotches(): string {
  let marks = '';
  for (let f = FLARE.cost; f < FLARE.maxFuel; f += FLARE.cost) {
    marks += `<i style="left:${(f / FLARE.maxFuel) * 100}%"></i>`;
  }
  return marks;
}

/** Heads-up display: souls, lives, the midnight countdown, lantern oil and the hurt flash. */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly souls: HTMLSpanElement;
  private readonly soulsBox: HTMLDivElement;
  private readonly lives: HTMLDivElement[];
  private readonly timer: HTMLDivElement;
  private readonly fuelBox: HTMLDivElement;
  private readonly fuelFill: HTMLDivElement;
  private readonly hurtFlash: HTMLDivElement;
  private lastSouls = '';
  private lastTime = '';
  private lastLives = -1;
  private lastFuel = -1;

  constructor(parent: HTMLElement, maxLives: number) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-souls">${CANDLE_ICON}<span class="hud-souls-count"></span></div>
      <div class="hud-timer" title="Time until midnight"></div>
      <div class="hud-lives" title="Lives">${`<div class="hud-life">${PUMPKIN_ICON}</div>`.repeat(maxLives)}</div>
      <div class="hud-fuel" title="Lantern oil">
        ${LANTERN_ICON}
        <div class="hud-fuel-bar"><div class="hud-fuel-fill"></div>${fuelNotches()}</div>
        <kbd>Space</kbd>
      </div>
    `;
    this.hurtFlash = document.createElement('div');
    this.hurtFlash.className = 'hurt-flash';
    parent.append(this.hurtFlash, this.root);

    const find = <T extends HTMLElement>(selector: string): T => {
      const el = this.root.querySelector<T>(selector);
      if (!el) throw new Error(`HUD element ${selector} missing`);
      return el;
    };
    this.soulsBox = find('.hud-souls');
    this.souls = find('.hud-souls-count');
    this.timer = find('.hud-timer');
    this.fuelBox = find('.hud-fuel');
    this.fuelFill = find('.hud-fuel-fill');
    this.lives = Array.from(this.root.querySelectorAll<HTMLDivElement>('.hud-life'));
    for (const el of [this.soulsBox, this.hurtFlash, this.fuelBox]) {
      el.addEventListener('animationend', () => el.classList.remove('pulse', 'active', 'denied', 'refilled'));
    }
  }

  /** Cheap to call every frame: the DOM is only touched when something changes. */
  update(state: GameState, fuel: number): void {
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
    const percent = Math.round((fuel / FLARE.maxFuel) * 100);
    if (percent !== this.lastFuel) {
      this.fuelFill.style.width = `${percent}%`;
      this.fuelBox.classList.toggle('low', fuel < FLARE.cost);
      this.lastFuel = percent;
    }
  }

  /** Hidden on the title screen. */
  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** Brief flare on the counter when a candle is gathered. */
  pulseSouls(): void {
    this.restartAnimation(this.soulsBox, 'pulse');
  }

  /** Red vignette when a ghost touches the player. */
  flashHurt(): void {
    this.restartAnimation(this.hurtFlash, 'active');
  }

  /** Shakes the oil gauge when there isn't enough oil to flare. */
  denyFlare(): void {
    this.restartAnimation(this.fuelBox, 'denied');
  }

  /** Glows the oil gauge when a shrine refills it. */
  pulseFuel(): void {
    this.restartAnimation(this.fuelBox, 'refilled');
  }

  private restartAnimation(el: HTMLElement, className: string): void {
    el.classList.remove(className);
    void el.offsetWidth; // force a reflow so the CSS animation plays again
    el.classList.add(className);
  }
}
