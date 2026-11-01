/**
 * Tiny Web Audio building blocks. Every sound in the game is assembled from
 * these: enveloped oscillators, filtered noise bursts and an inharmonic bell.
 * Times are seconds from now (`at`), so phrases can be scheduled in one go.
 */

const SILENT = 0.0001;

/** Exponential attack/decay envelope on a gain parameter (exponential ramps can't touch 0). */
export function envelope(param: AudioParam, t: number, attack: number, peak: number, decay: number): void {
  param.setValueAtTime(SILENT, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(SILENT, t + attack + decay);
}

export interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  /** Glide to this frequency over the note. */
  to?: number;
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  detune?: number;
}

export function tone(ctx: AudioContext, out: AudioNode, o: ToneOptions): void {
  const t = ctx.currentTime + (o.at ?? 0);
  const attack = o.attack ?? 0.01;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay);
  osc.detune.value = o.detune ?? 0;
  const gain = ctx.createGain();
  envelope(gain.gain, t, attack, o.gain, o.decay);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + attack + o.decay + 0.05);
}

let noise: AudioBuffer | undefined;

/** Two seconds of white noise, generated once and shared by every noise source. */
export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise) return noise;
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

export interface NoiseOptions {
  filter?: BiquadFilterType;
  freq: number;
  /** Sweep the filter to this frequency over the burst. */
  to?: number;
  q?: number;
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
}

export function noiseBurst(ctx: AudioContext, out: AudioNode, o: NoiseOptions): void {
  const t = ctx.currentTime + (o.at ?? 0);
  const attack = o.attack ?? 0.01;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter ?? 'bandpass';
  filter.Q.value = o.q ?? 1;
  filter.frequency.setValueAtTime(o.freq, t);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t + attack + o.decay);
  const gain = ctx.createGain();
  envelope(gain.gain, t, attack, o.gain, o.decay);
  src.connect(filter).connect(gain).connect(out);
  src.start(t, Math.random()); // random offset so repeated bursts don't sound identical
  src.stop(t + attack + o.decay + 0.05);
}

/** Church-bell partials as [frequency ratio, relative gain, decay seconds]. */
const BELL_PARTIALS: ReadonlyArray<readonly [number, number, number]> = [
  [0.5, 0.9, 5],
  [1, 0.7, 3.5],
  [1.19, 0.45, 2.6],
  [1.5, 0.3, 2],
  [2, 0.4, 1.6],
  [2.52, 0.18, 1.1],
  [3.01, 0.12, 0.8],
  [4.17, 0.08, 0.5],
];

export function bell(ctx: AudioContext, out: AudioNode, freq: number, at: number, gain: number): void {
  for (const [ratio, level, decay] of BELL_PARTIALS) {
    tone(ctx, out, { freq: freq * ratio, at, attack: 0.004, decay, gain: gain * level });
  }
}
