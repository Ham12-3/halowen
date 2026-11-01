import type { CrashCause } from '../game/GameState';
import { startAmbience } from './ambience';
import * as hazard from './hazardSounds';
import { bell, noiseBurst, tone } from './synth';

const VOLUME = 0.7;
const MUTE_KEY = 'midnight-line-muted';

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Pentatonic steps above A5, so a streak of souls climbs the scale. */
const SOUL_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/**
 * Every sound effect, synthesised with the Web Audio API (no audio files).
 * Nothing plays until `unlock()` runs inside a click or key press, because
 * browsers keep audio suspended until the page has had a user gesture.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = readMuted();

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

  /** Two-tone train whistle as the run starts. */
  whistle(): void {
    this.play((ctx, out) => {
      for (const [freq, at] of [[740, 0], [880, 0], [740, 0.45], [880, 0.45]] as const) {
        tone(ctx, out, { type: 'triangle', freq, at, attack: 0.04, decay: 0.38, gain: 0.07 });
      }
      noiseBurst(ctx, out, { freq: 2400, q: 2, attack: 0.04, decay: 0.8, gain: 0.05 }); // steam
    });
  }

  /** Clickety-clack over a rail joint; louder as the pace (0..1) rises. */
  clack(pace: number): void {
    this.play((ctx, out) => {
      const gain = 0.16 + pace * 0.12;
      for (const at of [0, 0.11]) {
        noiseBurst(ctx, out, { freq: 420, q: 3, at, attack: 0.002, decay: 0.06, gain });
        tone(ctx, out, { freq: 75, at, attack: 0.002, decay: 0.08, gain: gain * 0.5 });
      }
    });
  }

  jump(): void {
    this.play((ctx, out) => {
      noiseBurst(ctx, out, { freq: 500, to: 2200, q: 0.8, attack: 0.02, decay: 0.25, gain: 0.9 });
      tone(ctx, out, { type: 'triangle', freq: 300, to: 520, decay: 0.18, gain: 0.12 });
    });
  }

  /** Feet on a carriage roof: a hollow metal thump. */
  land(): void {
    this.play((ctx, out) => {
      tone(ctx, out, { freq: 120, to: 60, decay: 0.14, gain: 0.3 });
      noiseBurst(ctx, out, { filter: 'lowpass', freq: 700, decay: 0.1, gain: 0.25 });
    });
  }

  slide(): void {
    this.play((ctx, out) => {
      noiseBurst(ctx, out, { filter: 'lowpass', freq: 1800, to: 500, attack: 0.03, decay: 0.45, gain: 0.45 });
    });
  }

  /** A quick whoosh for a lane change. */
  lane(): void {
    this.play((ctx, out) => {
      noiseBurst(ctx, out, { freq: 900, to: 1600, q: 0.9, attack: 0.01, decay: 0.12, gain: 0.7 });
    });
  }

  crash(cause: CrashCause): void {
    this.play((ctx, out) => {
      tone(ctx, out, { type: 'sawtooth', freq: 160, to: 45, decay: 0.6, gain: 0.2 });
      noiseBurst(ctx, out, { filter: 'lowpass', freq: 1400, to: 150, decay: 0.5, gain: 0.45 });
      if (cause === 'bar') bell(ctx, out, 220, 0, 0.08); // ringing ironwork
      if (cause === 'fell') noiseBurst(ctx, out, { filter: 'lowpass', freq: 600, at: 0.35, decay: 0.3, gain: 0.4 });
      if (cause === 'ghost') hazard.wail(ctx, out, 0);
    });
  }

  /** A soul gathered: a sparkle that climbs higher with each one in a quick streak. */
  soul(streak: number): void {
    this.play((ctx, out) => {
      const step = SOUL_STEPS[Math.min(streak, SOUL_STEPS.length - 1)] ?? 0;
      const freq = 880 * 2 ** (step / 12);
      tone(ctx, out, { freq, decay: 0.28, gain: 0.22 });
      tone(ctx, out, { type: 'triangle', freq: freq * 2, detune: 6, decay: 0.18, gain: 0.07 });
    });
  }

  /** Passing through a station: the "ding-dong" of a platform announcement, and a bell. */
  station(): void {
    this.play((ctx, out) => {
      tone(ctx, out, { freq: 659.25, decay: 0.9, gain: 0.14 });
      tone(ctx, out, { freq: 523.25, at: 0.38, decay: 1.1, gain: 0.14 });
      bell(ctx, out, 392, 0.05, 0.06);
    });
  }

  /** A swooping ghost's wail, panned towards it (-1 left .. 1 right). */
  wail(pan: number): void {
    this.play((ctx, out) => hazard.wail(ctx, out, pan));
  }

  hurt(): void {
    this.play(hazard.hurt);
  }

  flare(): void {
    this.play(hazard.flare);
  }

  banish(): void {
    this.play(hazard.banish);
  }

  /** The end of the line: a rising fanfare and the station bell. */
  arrive(): void {
    this.play((ctx, out) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        tone(ctx, out, { freq, at: i * 0.14, decay: 1.2, gain: 0.16 });
        tone(ctx, out, { type: 'triangle', freq: freq * 2, at: i * 0.14, decay: 0.6, gain: 0.04 });
      });
      bell(ctx, out, 392, 0.6, 0.12);
    });
  }

  private play(make: (ctx: AudioContext, out: AudioNode) => void): void {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    make(this.ctx, this.master);
  }
}
