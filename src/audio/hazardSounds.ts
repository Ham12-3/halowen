import { noiseBurst, tone } from './synth';

/**
 * Recipes for the Halloween hazards' sounds: the ghosts' wail, losing a life,
 * the lantern flare and banishing a ghost. Each draws into `out`.
 */

/** A ghost's rising-and-falling moan, panned towards it (-1 left .. 1 right). */
export function wail(ctx: AudioContext, out: AudioNode, pan: number): void {
  const t = ctx.currentTime;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(out);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1600;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
  filter.connect(gain).connect(panner);

  const voice = ctx.createOscillator();
  voice.type = 'triangle';
  voice.frequency.setValueAtTime(330, t);
  voice.frequency.exponentialRampToValueAtTime(660, t + 0.5);
  voice.frequency.exponentialRampToValueAtTime(300, t + 1.5);
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5.5;
  const depth = ctx.createGain();
  depth.gain.value = 12;
  vibrato.connect(depth).connect(voice.frequency);
  voice.connect(filter);
  for (const osc of [voice, vibrato]) {
    osc.start(t);
    osc.stop(t + 1.6);
  }
  noiseBurst(ctx, panner, { freq: 1100, to: 700, q: 4, attack: 0.35, decay: 1, gain: 0.05 }); // breath
}

/** A life lost: a cold falling growl. */
export function hurt(ctx: AudioContext, out: AudioNode): void {
  tone(ctx, out, { type: 'sawtooth', freq: 190, to: 60, decay: 0.45, gain: 0.2 });
  tone(ctx, out, { type: 'square', freq: 200, to: 58, detune: 30, decay: 0.4, gain: 0.06 });
  noiseBurst(ctx, out, { filter: 'lowpass', freq: 1000, to: 200, decay: 0.3, gain: 0.35 });
}

/** The lantern blazing up: a whoosh, a warm swell and a sparkle on top. */
export function flare(ctx: AudioContext, out: AudioNode): void {
  noiseBurst(ctx, out, { freq: 300, to: 3200, q: 1, attack: 0.04, decay: 0.5, gain: 0.6 });
  tone(ctx, out, { freq: 140, to: 48, decay: 0.5, gain: 0.35 });
  for (const [freq, at] of [[659.25, 0.12], [987.77, 0.22], [1318.5, 0.32]] as const) {
    tone(ctx, out, { freq, at, decay: 0.6, gain: 0.1 });
  }
}

/** A ghost banished: a soft "poof" and a rising shimmer. */
export function banish(ctx: AudioContext, out: AudioNode): void {
  noiseBurst(ctx, out, { freq: 1800, to: 600, q: 1.2, attack: 0.01, decay: 0.3, gain: 0.35 });
  tone(ctx, out, { type: 'triangle', freq: 520, to: 1560, attack: 0.02, decay: 0.4, gain: 0.08 });
}
