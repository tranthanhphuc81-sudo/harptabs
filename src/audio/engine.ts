/** Bộ tổng hợp âm thanh dùng Web Audio — không cần file mẫu, chạy offline hoàn toàn. */
import { midiToHz } from '../lib/harp';

let ctx: AudioContext | null = null;
let master: GainNode;
export let melodyBus: GainNode;
export let drumBus: GainNode;
export let clickBus: GainNode;
let noise: AudioBuffer;

export function audio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    melodyBus = ctx.createGain();
    drumBus = ctx.createGain();
    clickBus = ctx.createGain();
    melodyBus.gain.value = 0.55;
    drumBus.gain.value = 0.6;
    clickBus.gain.value = 0.5;
    melodyBus.connect(master);
    drumBus.connect(master);
    clickBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setBusVolume(bus: 'melody' | 'drum' | 'click', v: number) {
  audio();
  const g = bus === 'melody' ? melodyBus : bus === 'drum' ? drumBus : clickBus;
  g.gain.setTargetAtTime(v, ctx!.currentTime, 0.02);
}

/** Âm sắc gần giống harmonica: sóng răng cưa + vuông qua lọc thông thấp, có rung nhẹ */
export function playTone(midi: number, when: number, dur: number, velocity = 1, out?: AudioNode): void {
  const c = audio();
  const f = midiToHz(midi);
  const t = Math.max(when, c.currentTime);
  const end = t + Math.max(0.06, dur);

  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'square';
  o1.frequency.value = f;
  o2.frequency.value = f;
  o2.detune.value = 6;

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 5.2;
  lfoGain.gain.setValueAtTime(0, t);
  lfoGain.gain.linearRampToValueAtTime(0, t + 0.25);
  lfoGain.gain.linearRampToValueAtTime(f * 0.004, t + 0.6);
  lfo.connect(lfoGain);
  lfoGain.connect(o1.frequency);
  lfoGain.connect(o2.frequency);

  const mix2 = c.createGain();
  mix2.gain.value = 0.35;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2.2;
  filter.frequency.setValueAtTime(Math.min(f * 2, 6000), t);
  filter.frequency.linearRampToValueAtTime(Math.min(f * 3.5, 9000), t + 0.05);
  filter.frequency.linearRampToValueAtTime(Math.min(f * 2.6, 7000), t + 0.2);

  const env = c.createGain();
  const peak = 0.32 * velocity;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.025);
  env.gain.exponentialRampToValueAtTime(peak * 0.75, t + 0.12);
  env.gain.setValueAtTime(peak * 0.75, Math.max(t + 0.12, end - 0.06));
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  o1.connect(filter);
  o2.connect(mix2).connect(filter);
  filter.connect(env).connect(out ?? melodyBus);

  // tiếng hơi thở nhẹ lúc bắt đầu
  const br = c.createBufferSource();
  br.buffer = noise;
  const brF = c.createBiquadFilter();
  brF.type = 'bandpass';
  brF.frequency.value = Math.min(f * 2, 5000);
  brF.Q.value = 1.5;
  const brG = c.createGain();
  brG.gain.setValueAtTime(0.05 * velocity, t);
  brG.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  br.connect(brF).connect(brG).connect(out ?? melodyBus);

  for (const o of [o1, o2, lfo]) { o.start(t); o.stop(end + 0.02); }
  br.start(t, Math.random() * 0.5);
  br.stop(t + 0.1);
}

export function kick(when: number, vel = 1) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.frequency.setValueAtTime(140, when);
  o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
  g.gain.setValueAtTime(0.9 * vel, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
  o.connect(g).connect(drumBus);
  o.start(when);
  o.stop(when + 0.3);
}

function noiseHit(when: number, type: BiquadFilterType, freq: number, decay: number, gain: number, q = 0.8) {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + decay);
  src.connect(f).connect(g).connect(drumBus);
  src.start(when, Math.random() * 0.8);
  src.stop(when + decay + 0.02);
}

export function snare(when: number, vel = 1) {
  noiseHit(when, 'bandpass', 1900, 0.16, 0.55 * vel, 0.7);
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, when);
  o.frequency.exponentialRampToValueAtTime(150, when + 0.08);
  g.gain.setValueAtTime(0.35 * vel, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
  o.connect(g).connect(drumBus);
  o.start(when);
  o.stop(when + 0.12);
}

export function hat(when: number, vel = 1, open = false) {
  noiseHit(when, 'highpass', 7500, open ? 0.25 : 0.045, 0.22 * vel, 0.5);
}

export function rim(when: number, vel = 1) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'square';
  o.frequency.value = 1750;
  g.gain.setValueAtTime(0.18 * vel, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.035);
  o.connect(g).connect(drumBus);
  o.start(when);
  o.stop(when + 0.05);
}

export function shaker(when: number, vel = 1) {
  noiseHit(when, 'bandpass', 5200, 0.06, 0.14 * vel, 1.2);
}

export function click(when: number, accent = false) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.value = accent ? 1600 : 1050;
  g.gain.setValueAtTime(accent ? 0.6 : 0.4, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  o.connect(g).connect(clickBus);
  o.start(when);
  o.stop(when + 0.06);
}

/** Phát thử một nốt ngay (sơ đồ kèn, nút nghe nốt) */
export function previewNote(midi: number, dur = 0.6) {
  const c = audio();
  playTone(midi, c.currentTime + 0.01, dur);
}
