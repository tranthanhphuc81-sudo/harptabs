/** Bộ tổng hợp âm thanh dùng Web Audio — không cần file mẫu, chạy offline hoàn toàn. */
import { midiToHz } from '../lib/harp';

let ctx: AudioContext | null = null;
let master: GainNode;
export let melodyBus: GainNode;
export let drumBus: GainNode;
export let clickBus: GainNode;
let bassBus: GainNode;
let drumSend: GainNode;
let melodySend: GainNode;
let noise: AudioBuffer;

/** Hồi âm phòng nhỏ tạo bằng nhiễu tắt dần (không cần file mẫu) */
function roomImpulse(c: AudioContext, seconds = 1.1): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return b;
}

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
    clickBus.gain.value = 0.5;
    bassBus = ctx.createGain();
    bassBus.connect(drumBus);
    melodyBus.connect(master);
    drumBus.connect(master);
    clickBus.connect(master);
    const verb = ctx.createConvolver();
    verb.buffer = roomImpulse(ctx);
    drumSend = ctx.createGain();
    melodySend = ctx.createGain();
    drumBus.connect(drumSend).connect(verb);
    melodyBus.connect(melodySend).connect(verb);
    verb.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyMix(mix);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
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

export type DrumKit = 'acoustic' | 'electronic' | 'soft';

let kit: DrumKit = 'acoustic';
let humanVel = 0;

export interface MixSettings { kit: DrumKit; beatVol: number; melodyVol: number; bassVol: number; reverb: number }
let mix: MixSettings = { kit: 'acoustic', beatVol: 0.6, melodyVol: 0.55, bassVol: 0.7, reverb: 0.25 };

/** Áp âm lượng / bộ trống / độ vang; chưa có AudioContext thì để dành áp lúc khởi tạo */
export function applyMix(m: MixSettings) {
  mix = { kit: m.kit, beatVol: m.beatVol, melodyVol: m.melodyVol, bassVol: m.bassVol, reverb: m.reverb };
  kit = m.kit;
  if (!ctx) return;
  const t = ctx.currentTime;
  drumBus.gain.setTargetAtTime(m.beatVol, t, 0.02);
  melodyBus.gain.setTargetAtTime(m.melodyVol, t, 0.02);
  bassBus.gain.setTargetAtTime(m.bassVol, t, 0.02);
  drumSend.gain.setTargetAtTime(m.reverb * 0.7, t, 0.02);
  melodySend.gain.setTargetAtTime(m.reverb * 0.45, t, 0.02);
}

/** Độ ngẫu nhiên lực đánh (0 = máy móc) */
export function setHumanVelocity(v: number) {
  humanVel = v;
}

const vary = (v: number) => (humanVel ? v * (1 - humanVel + Math.random() * humanVel * 2) : v);

function osc(type: OscillatorType, when: number, f0: number, f1: number, fall: number, gain: number, decay: number) {
  const c = audio();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, when + fall);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.001, when + decay);
  o.connect(g).connect(drumBus);
  o.start(when);
  o.stop(when + decay + 0.02);
}

function noiseHit(when: number, type: BiquadFilterType, freq: number, decay: number, gain: number, q = 0.8, attack = 0) {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  if (attack > 0) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
  } else g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.001, when + attack + decay);
  src.connect(f).connect(g).connect(drumBus);
  src.start(when, Math.random() * 0.8);
  src.stop(when + attack + decay + 0.02);
}

export function kick(when: number, vel = 1) {
  vel = vary(vel);
  if (kit === 'electronic') {
    osc('sine', when, 150, 42, 0.14, 1.0 * vel, 0.5);
    return;
  }
  if (kit === 'soft') {
    osc('sine', when, 95, 50, 0.1, 0.7 * vel, 0.25);
    return;
  }
  // trống thật: thân trầm + tiếng dùi chạm mặt da
  osc('sine', when, 120, 52, 0.07, 0.95 * vel, 0.32);
  osc('triangle', when, 260, 90, 0.03, 0.3 * vel, 0.05);
  noiseHit(when, 'lowpass', 3200, 0.015, 0.25 * vel, 0.7);
}

export function snare(when: number, vel = 1) {
  vel = vary(vel);
  if (kit === 'soft') {
    // chổi quét: tiếng xoẹt mềm, lực vào chậm
    noiseHit(when, 'bandpass', 3200, 0.2, 0.3 * vel, 0.6, 0.025);
    return;
  }
  if (kit === 'electronic') {
    noiseHit(when, 'bandpass', 1900, 0.16, 0.55 * vel, 0.7);
    osc('triangle', when, 220, 150, 0.08, 0.35 * vel, 0.1);
    return;
  }
  // trống thật: dây lò xo (nhiễu sáng, đuôi dài) + thân 190Hz
  noiseHit(when, 'highpass', 1800, 0.2, 0.45 * vel, 0.5);
  noiseHit(when, 'bandpass', 4500, 0.09, 0.25 * vel, 0.9);
  osc('triangle', when, 240, 185, 0.05, 0.4 * vel, 0.12);
}

/** tiếng kim loại: chồng 6 sóng vuông lệch tần như máy trống kinh điển */
function metal(when: number, decay: number, gain: number) {
  const c = audio();
  const g = c.createGain();
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  bp.Q.value = 0.8;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, when + decay);
  bp.connect(hp).connect(g).connect(drumBus);
  for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 40 * r;
    o.connect(bp);
    o.start(when);
    o.stop(when + decay + 0.02);
  }
}

export function hat(when: number, vel = 1, open = false) {
  vel = vary(vel);
  if (kit === 'electronic') {
    noiseHit(when, 'highpass', 7500, open ? 0.25 : 0.045, 0.22 * vel, 0.5);
  } else if (kit === 'soft') {
    noiseHit(when, 'highpass', 6000, open ? 0.3 : 0.05, 0.1 * vel, 0.5);
  } else {
    metal(when, open ? 0.35 : 0.055, 0.2 * vel);
    noiseHit(when, 'highpass', 9000, open ? 0.3 : 0.04, 0.08 * vel, 0.5);
  }
}

/** chũm chọe mở câu mới */
export function crash(when: number, vel = 1) {
  vel = vary(vel);
  noiseHit(when, 'highpass', 5000, 1.3, (kit === 'soft' ? 0.12 : 0.22) * vel, 0.4);
  if (kit === 'acoustic') metal(when, 0.9, 0.08 * vel);
}

/** trống tom cho đoạn dồn; pitch 0 = cao … 1 = trầm */
export function tom(when: number, vel = 1, pitch = 0) {
  vel = vary(vel);
  const f = 220 - pitch * 110;
  if (kit === 'soft') {
    osc('sine', when, f * 0.8, f * 0.6, 0.15, 0.4 * vel, 0.25);
    return;
  }
  osc('sine', when, f, f * 0.65, 0.18, 0.7 * vel, kit === 'electronic' ? 0.4 : 0.3);
  noiseHit(when, 'lowpass', 2500, 0.02, 0.15 * vel, 0.7);
}

export function rim(when: number, vel = 1) {
  vel = vary(vel);
  if (kit === 'electronic') {
    osc('square', when, 1750, 1750, 0, 0.18 * vel, 0.035);
    return;
  }
  // gõ vành / mõ gỗ
  osc('triangle', when, kit === 'soft' ? 900 : 1250, kit === 'soft' ? 850 : 1150, 0.02, 0.22 * vel, 0.05);
  noiseHit(when, 'bandpass', 2600, 0.012, 0.12 * vel, 2);
}

export function shaker(when: number, vel = 1) {
  vel = vary(vel);
  noiseHit(when, 'bandpass', kit === 'soft' ? 4200 : 5200, 0.06, 0.14 * vel, 1.2, kit === 'electronic' ? 0 : 0.012);
}

/**
 * Tiếng bass đệm theo bộ trống: trống thật → bass ngón, nhẹ → contrabass gảy,
 * điện tử → synth bass có lọc quét.
 */
export function bass(midi: number, when: number, dur: number, vel = 1) {
  const c = audio();
  vel = vary(vel);
  const f = midiToHz(midi);
  const end = when + Math.max(0.08, dur);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  const env = c.createGain();
  const peak = 0.5 * vel;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + (kit === 'soft' ? 0.012 : 0.006));

  const oscs: OscillatorNode[] = [];
  const add = (type: OscillatorType, mult: number, gain: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    g.gain.value = gain;
    o.connect(g).connect(filter);
    oscs.push(o);
  };

  if (kit === 'electronic') {
    add('sawtooth', 1, 0.6);
    add('square', 0.5, 0.35);
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(f * 12, when);
    filter.frequency.exponentialRampToValueAtTime(f * 2.5, when + 0.18);
    env.gain.exponentialRampToValueAtTime(peak * 0.7, when + 0.1);
    env.gain.setValueAtTime(peak * 0.7, Math.max(when + 0.1, end - 0.04));
  } else if (kit === 'soft') {
    // gảy dây: tắt dần tự nhiên, không ngân đều
    add('sine', 1, 0.9);
    add('triangle', 2, 0.25);
    filter.Q.value = 0.7;
    filter.frequency.value = f * 5;
    env.gain.exponentialRampToValueAtTime(peak * 0.35, when + Math.min(0.5, dur));
  } else {
    add('triangle', 1, 0.8);
    add('sawtooth', 1, 0.22);
    add('sine', 2, 0.15);
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(f * 7, when);
    filter.frequency.exponentialRampToValueAtTime(f * 3.5, when + 0.12);
    env.gain.exponentialRampToValueAtTime(peak * 0.6, when + 0.15);
    env.gain.setValueAtTime(peak * 0.6, Math.max(when + 0.15, end - 0.05));
  }
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  filter.connect(env).connect(bassBus);
  for (const o of oscs) { o.start(when); o.stop(end + 0.02); }
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
