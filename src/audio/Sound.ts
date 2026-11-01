import type { RoundStatus } from '../game/GameState';
import type { XZ } from '../world/collision';
import { startAmbience } from './ambience';
import { bell, noiseBurst, tone } from './synth';

const VOLUME = 0.7;
const MUTE_KEY = 'pumpkin-hollow-muted';
/** Minimum seconds between ghost wails, so a whole pack spotting you isn't a choir. */
const WAIL_GAP = 2;
/** Pentatonic steps above C5, so each soul gathered chimes a little higher. */
const SOUL_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Every sound effect, synthesised with the Web Audio API (no audio files).
 * Nothing plays until `unlock()` runs inside a click or key press, because
 * browsers keep audio suspended until the page has had a user gesture.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = readMuted();
  private lastWail = -Infinity;
  private lastSecond = Infinity;

  get isMuted(): boolean {
    return this.muted;
  }

  unlock(): void {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      const limiter = this.ctx.createDynamicsCompressor();
      this.master.connect(limiter).connect(this.ctx.destination);
      startAmbience(this.ctx, this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): void {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage can be blocked (private mode); muting still works for this visit.
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : VOLUME, this.ctx.currentTime, 0.05);
    }
  }

  /** A bright chime; `soul` (1-based) picks the note. */
  candle(soul: number): void {
    this.play((ctx, out) => {
      const freq = 523.25 * 2 ** ((SOUL_STEPS[soul - 1] ?? 0) / 12);
      tone(ctx, out, { freq, decay: 0.9, gain: 0.22 });
      tone(ctx, out, { freq: freq * 2, detune: 7, decay: 0.6, gain: 0.08 });
      tone(ctx, out, { type: 'triangle', freq: freq * 1.5, at: 0.07, decay: 0.7, gain: 0.08 });
    });
  }

  /** Whoosh, thump and sparkle. */
  flare(): void {
    this.play((ctx, out) => {
      noiseBurst(ctx, out, { freq: 300, to: 3000, q: 1.2, attack: 0.03, decay: 0.45, gain: 0.5 });
      tone(ctx, out, { freq: 140, to: 45, decay: 0.45, gain: 0.45 });
      tone(ctx, out, { type: 'triangle', freq: 880, to: 1760, at: 0.02, decay: 0.35, gain: 0.06 });
    });
  }

  /** Not enough oil: a dry sputter. */
  fizzle(): void {
    this.play((ctx, out) => {
      for (let i = 0; i < 3; i++) {
        noiseBurst(ctx, out, { filter: 'highpass', freq: 2500, at: i * 0.06, attack: 0.002, decay: 0.04, gain: 0.18 });
      }
      tone(ctx, out, { type: 'square', freq: 90, to: 60, decay: 0.15, gain: 0.04 });
    });
  }

  /** A shrine's warmth pouring into the lantern. */
  refill(): void {
    this.play((ctx, out) => {
      tone(ctx, out, { type: 'triangle', freq: 220, to: 440, attack: 0.25, decay: 0.45, gain: 0.12 });
      tone(ctx, out, { type: 'triangle', freq: 222, to: 445, attack: 0.25, decay: 0.45, gain: 0.08 });
      noiseBurst(ctx, out, { filter: 'lowpass', freq: 400, to: 2400, attack: 0.25, decay: 0.4, gain: 0.12 });
      tone(ctx, out, { freq: 659.25, at: 0.35, decay: 0.8, gain: 0.12 });
      tone(ctx, out, { freq: 987.77, at: 0.45, decay: 0.8, gain: 0.1 });
    });
  }

  /** A ghost's cold touch: a falling growl. */
  hurt(): void {
    this.play((ctx, out) => {
      tone(ctx, out, { type: 'sawtooth', freq: 180, to: 55, decay: 0.5, gain: 0.22 });
      tone(ctx, out, { type: 'square', freq: 190, to: 52, detune: 30, decay: 0.45, gain: 0.06 });
      noiseBurst(ctx, out, { filter: 'lowpass', freq: 900, to: 200, decay: 0.35, gain: 0.35 });
    });
  }

  /** A ghost's rising-and-falling moan, panned towards it (-1 left .. 1 right). */
  wail(pan: number): void {
    this.play((ctx, out) => {
      const t = ctx.currentTime;
      if (t - this.lastWail < WAIL_GAP) return;
      this.lastWail = t;
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      panner.connect(out);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      filter.connect(gain).connect(panner);

      const voice = ctx.createOscillator();
      voice.type = 'triangle';
      voice.frequency.setValueAtTime(320, t);
      voice.frequency.exponentialRampToValueAtTime(640, t + 0.55);
      voice.frequency.exponentialRampToValueAtTime(290, t + 1.8);
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.value = 12;
      vibrato.connect(depth).connect(voice.frequency);
      voice.connect(filter);
      for (const osc of [voice, vibrato]) {
        osc.start(t);
        osc.stop(t + 1.9);
      }
      noiseBurst(ctx, panner, { freq: 1100, to: 700, q: 4, attack: 0.4, decay: 1.2, gain: 0.04 }); // breath
    });
  }

  /** Call every step of a round: the clock ticks aloud once a second while `warning`. */
  clock(timeLeft: number, warning: boolean): void {
    const second = Math.ceil(timeLeft);
    if (second === this.lastSecond) return;
    this.lastSecond = second;
    if (warning && second > 0) this.tick(second <= 10);
  }

  /** One clock tick; sharper in the final ten seconds. */
  private tick(urgent: boolean): void {
    this.play((ctx, out) => {
      noiseBurst(ctx, out, { freq: urgent ? 3200 : 2200, q: 3, attack: 0.001, decay: 0.05, gain: urgent ? 1.4 : 0.9 });
      tone(ctx, out, { type: 'triangle', freq: urgent ? 1400 : 1000, attack: 0.001, decay: 0.07, gain: urgent ? 0.14 : 0.1 });
    });
  }

  /** Fanfare for a win, the midnight bell for time up, a falling lament for death. */
  roundEnd(status: RoundStatus): void {
    this.play((ctx, out) => {
      if (status === 'won') {
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          tone(ctx, out, { freq, at: i * 0.14, decay: 1.2, gain: 0.16 });
          tone(ctx, out, { type: 'triangle', freq: freq * 2, at: i * 0.14, decay: 0.6, gain: 0.04 });
        });
        bell(ctx, out, 523.25, 0.6, 0.1);
      } else if (status === 'timeUp') {
        for (let i = 0; i < 3; i++) bell(ctx, out, 196, i * 1.8, 0.17);
      } else if (status === 'dead') {
        [392, 311.13, 261.63, 196].forEach((freq, i) => {
          tone(ctx, out, { type: 'triangle', freq, at: i * 0.28, decay: 0.9, gain: 0.14 });
        });
        noiseBurst(ctx, out, { filter: 'lowpass', freq: 1200, to: 120, attack: 0.2, decay: 1.6, gain: 0.25 });
      }
    });
  }

  private play(make: (ctx: AudioContext, out: AudioNode) => void): void {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    make(this.ctx, this.master);
  }
}

/** Stereo pan (-1 left .. 1 right) of `source` for a listener at `listener` looking along camera `yaw`. */
export function stereoPan(listener: XZ, yaw: number, source: XZ): number {
  const dx = source.x - listener.x;
  const dz = source.z - listener.z;
  // The camera's right vector on the ground is (cos yaw, -sin yaw).
  return (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / (Math.hypot(dx, dz) || 1);
}
