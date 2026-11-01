import { noiseBuffer, tone } from './synth';

/**
 * The night's background bed, started once and left running: gusting wind
 * (looped noise through a wandering low-pass filter), a faint low drone and
 * an owl that hoots from a random side every so often.
 */
export function startAmbience(ctx: AudioContext, out: AudioNode): void {
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(ctx);
  wind.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 520;
  lowpass.Q.value = 3;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.05;
  wind.connect(lowpass).connect(windGain).connect(out);

  // Two slow LFOs: one sweeps the filter (the whistle of a gust), one swells the volume.
  modulate(ctx, lowpass.frequency, 0.07, 320);
  modulate(ctx, windGain.gain, 0.045, 0.03);
  wind.start();

  const drone = ctx.createGain();
  drone.gain.value = 0.012;
  drone.connect(out);
  for (const [freq, detune] of [[55, 0], [82.4, 6], [110, -4]] as const) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(drone);
    osc.start();
  }
  modulate(ctx, drone.gain, 0.03, 0.005);

  scheduleOwl(ctx, out);
}

function modulate(ctx: AudioContext, param: AudioParam, rate: number, depth: number): void {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const amount = ctx.createGain();
  amount.gain.value = depth;
  lfo.connect(amount).connect(param);
  lfo.start();
}

/** "Hoo, hoo-hoooo" from somewhere off to one side, every 15-35 seconds. */
function scheduleOwl(ctx: AudioContext, out: AudioNode): void {
  const delay = 15000 + Math.random() * 20000;
  window.setTimeout(() => {
    if (ctx.state === 'running') {
      const pan = ctx.createStereoPanner();
      pan.pan.value = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4);
      pan.connect(out);
      const hoot = (at: number, decay: number): void =>
        tone(ctx, pan, { freq: 410, to: 350, at, attack: 0.07, decay, gain: 0.045 });
      hoot(0, 0.3);
      hoot(0.62, 0.22);
      hoot(0.95, 0.55);
    }
    scheduleOwl(ctx, out);
  }, delay);
}
