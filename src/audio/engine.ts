/** Bộ tổng hợp âm thanh dùng Web Audio — không cần file mẫu, chạy offline hoàn toàn. */
import { midiToHz } from '../lib/harp';

let ctx: AudioContext | null = null;
let master: GainNode;
export let melodyBus: GainNode;
export let drumBus: GainNode;
export let clickBus: GainNode;
let bassBus: GainNode;
let boBus: GainNode;
let bellBus: GainNode;
let compBus: GainNode;
let clapBus: GainNode;
/** kênh đệm hát (guitar / piano tự đệm) */
let singBus: GainNode;
/** kênh ra hiện tại của tiếng trống (bongo tạm chuyển sang kênh bo) */
let hitOut: AudioNode | null = null;
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
    // 'playback': bộ đệm âm thanh lớn hơn, điện thoại yếu bớt rè / đứt tiếng (lịch phát đã tính trước nên không lo trễ)
    ctx = new AC({ latencyHint: 'playback' });
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
    boBus = ctx.createGain();
    boBus.connect(drumBus);
    bellBus = ctx.createGain();
    bellBus.connect(drumBus);
    compBus = ctx.createGain();
    compBus.connect(drumBus);
    clapBus = ctx.createGain();
    clapBus.connect(drumBus);
    singBus = ctx.createGain();
    singBus.connect(master);
    melodyBus.connect(master);
    drumBus.connect(master);
    clickBus.connect(master);
    const verb = ctx.createConvolver();
    verb.buffer = roomImpulse(ctx);
    drumSend = ctx.createGain();
    melodySend = ctx.createGain();
    drumBus.connect(drumSend).connect(verb);
    melodyBus.connect(melodySend).connect(verb);
    singBus.connect(melodySend);
    verb.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyMix(mix);
    prepareMetal(ctx);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export type Instrument = 'harmonica' | 'tremolo' | 'piano' | 'guitar' | 'flute' | 'violin' | 'accordion' | 'organ' | 'sax' | 'whistle';

export const INSTRUMENT_OPTIONS: { value: Instrument; label: string }[] = [
  { value: 'harmonica', label: 'Kèn harmonica' },
  { value: 'tremolo', label: 'Kèn tremolo' },
  { value: 'piano', label: 'Piano' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'flute', label: 'Sáo trúc' },
  { value: 'violin', label: 'Violin' },
  { value: 'accordion', label: 'Accordion' },
  { value: 'organ', label: 'Organ' },
  { value: 'sax', label: 'Saxophone' },
  { value: 'whistle', label: 'Huýt sáo' },
];

let instrument: Instrument = 'harmonica';

/** Phát một nốt giai điệu bằng nhạc cụ đang chọn */
export function playTone(midi: number, when: number, dur: number, velocity = 1, out?: AudioNode): void {
  const c = audio();
  const t = Math.max(when, c.currentTime);
  const dest = out ?? melodyBus;
  switch (instrument) {
    case 'piano': return pianoTone(c, midi, t, dur, velocity, dest);
    case 'guitar': return guitarTone(c, midi, t, dur, velocity, dest);
    case 'flute': return fluteTone(c, midi, t, dur, velocity, dest);
    case 'violin': return bowedTone(c, midi, t, dur, velocity, dest);
    case 'accordion': return reedTone(c, midi, t, dur, velocity, dest);
    case 'organ': return organTone(c, midi, t, dur, velocity, dest);
    case 'sax': return saxTone(c, midi, t, dur, velocity, dest);
    case 'whistle': return whistleTone(c, midi, t, dur, velocity, dest);
    case 'tremolo': return harmonicaTone(c, midi, t, dur, velocity, dest, true);
    default: return harmonicaTone(c, midi, t, dur, velocity, dest);
  }
}

/** sóng sin cộng hưởng: mỗi hoạ âm [bội số, biên độ, thời gian tắt] */
function additive(c: AudioContext, f: number, t: number, partials: [number, number, number][], out: AudioNode, stopAt: number, stretch = 0) {
  for (const [n, amp, decay] of partials) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = f * n * Math.sqrt(1 + stretch * n * n);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(Math.min(stopAt, t + decay) + 0.02);
  }
}

function releaseEnv(c: AudioContext, t: number, end: number, peak: number, out: AudioNode, release = 0.12): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.setValueAtTime(peak, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  g.connect(out);
  return g;
}

function pianoTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = midiToHz(midi);
  const end = t + Math.max(0.15, dur);
  const life = Math.min(3.5, 2.2 * Math.pow(261 / f, 0.5));
  const env = releaseEnv(c, t, end, 0.38 * vel, out, 0.18);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(16000, f * (6 + 6 * vel)), t);
  lp.frequency.exponentialRampToValueAtTime(Math.min(8000, f * 3), t + life * 0.6);
  lp.connect(env);
  additive(c, f, t, [[1, 0.6, life], [2, 0.32, life * 0.7], [3, 0.16, life * 0.5], [4, 0.1, life * 0.35], [5, 0.06, life * 0.25], [6, 0.035, life * 0.2]], lp, end + 0.2, 0.0004);
  // tiếng búa gõ
  hammer(c, t, f, 0.05 * vel, out);
}

function hammer(c: AudioContext, t: number, f: number, gain: number, out: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.min(6000, f * 4);
  bp.Q.value = 1;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.05);
}

/** dây gảy Karplus–Strong, tạo sẵn rồi giữ lại theo từng cao độ */
const plucked = new Map<number, AudioBuffer>();
function pluckBuffer(c: AudioContext, midi: number): AudioBuffer {
  const hit = plucked.get(midi);
  if (hit) return hit;
  const sr = c.sampleRate;
  const len = Math.floor(sr * 2.2);
  const buf = c.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const period = sr / midiToHz(midi);
  const p = Math.max(2, Math.round(period));
  const ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = Math.random() * 2 - 1;
  // lọc nhẹ chuỗi khởi đầu cho tiếng ngón tay (bớt chói)
  for (let i = 1; i < p; i++) ring[i] = 0.6 * ring[i] + 0.4 * ring[i - 1];
  const damp = 0.996 - Math.min(0.01, midi / 12000);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const next = (idx + 1) % p;
    const v = ring[idx];
    ring[idx] = damp * 0.5 * (v + ring[next]);
    d[i] = v;
    idx = next;
  }
  plucked.set(midi, buf);
  return buf;
}

function guitarTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(c, midi);
  // bù sai số do làm tròn chu kỳ dây (nốt cao lệch tới vài chục cent)
  src.playbackRate.value = Math.max(2, Math.round(c.sampleRate / midiToHz(midi))) / (c.sampleRate / midiToHz(midi));
  const body = c.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = 220;
  body.gain.value = 5;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5000;
  const end = t + Math.max(0.2, dur) + 0.25;
  const env = releaseEnv(c, t, end - 0.1, 0.5 * vel, out, 0.1);
  src.connect(body).connect(lp).connect(env);
  src.start(t);
  src.stop(end + 0.05);
}

function vibrato(c: AudioContext, t: number, rate: number, depthHz: number, delay: number, targets: AudioParam[], stopAt: number) {
  const lfo = c.createOscillator();
  const g = c.createGain();
  lfo.frequency.value = rate;
  g.gain.setValueAtTime(0, t);
  g.gain.setValueAtTime(0, t + delay);
  g.gain.linearRampToValueAtTime(depthHz, t + delay + 0.3);
  lfo.connect(g);
  targets.forEach((p) => g.connect(p));
  lfo.start(t);
  lfo.stop(stopAt);
}

function breath(c: AudioContext, t: number, end: number, freq: number, q: number, attackGain: number, sustainGain: number, out: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(attackGain, t + 0.03);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, sustainGain), t + 0.15);
  g.gain.setValueAtTime(Math.max(0.0002, sustainGain), end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
  src.connect(bp).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(end + 0.1);
}

function fluteTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = midiToHz(midi);
  const end = t + Math.max(0.1, dur);
  const env = c.createGain();
  const peak = 0.36 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak * 1.15, t + 0.05);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.15);
  env.gain.setValueAtTime(peak, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.1);
  env.connect(out);
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o1.type = 'sine';
  o2.type = 'triangle';
  o1.frequency.value = f;
  o2.frequency.value = f * 2;
  g2.gain.value = 0.12;
  o1.connect(env);
  o2.connect(g2).connect(env);
  vibrato(c, t, 5.5, f * 0.006, 0.18, [o1.frequency, o2.frequency], end + 0.15);
  for (const o of [o1, o2]) { o.start(t); o.stop(end + 0.12); }
  // tiếng hơi qua lỗ sáo
  breath(c, t, end, f * 2, 2, 0.09 * vel, 0.025 * vel, out);
}

/** huýt sáo: sin gần như tinh khiết, vuốt cao độ lên lúc vào nốt, rung muộn, chút tiếng hơi qua môi */
function whistleTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = midiToHz(midi);
  const end = t + Math.max(0.1, dur);
  const env = c.createGain();
  const peak = 0.34 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.04);
  env.gain.setValueAtTime(peak, end - 0.02 > t + 0.04 ? end - 0.02 : t + 0.04);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.07);
  env.connect(out);
  const o1 = c.createOscillator();
  const o2 = c.createOscillator();
  const g2 = c.createGain();
  o1.type = 'sine';
  o2.type = 'sine';
  g2.gain.value = 0.04;
  for (const [o, n] of [[o1, 1], [o2, 2]] as [OscillatorNode, number][]) {
    // môi chỉnh dần tới đúng nốt: bắt đầu thấp ~40 cent
    o.frequency.setValueAtTime(f * n * 0.977, t);
    o.frequency.exponentialRampToValueAtTime(f * n, t + 0.06);
  }
  o1.connect(env);
  o2.connect(g2).connect(env);
  vibrato(c, t, 5.2, f * 0.008, 0.22, [o1.frequency, o2.frequency], end + 0.1);
  for (const o of [o1, o2]) { o.start(t); o.stop(end + 0.1); }
  breath(c, t, end, f, 6, 0.05 * vel, 0.012 * vel, out);
}

/** nguồn răng cưa/vuông qua lọc cộng hưởng (formant) — dùng cho violin, kèn sax */
function shaped(c: AudioContext, f: number, t: number, end: number, type: OscillatorType, formants: [number, number, number][], detune: number[]): { env: GainNode; oscs: OscillatorNode[] } {
  const mix = c.createGain();
  const env = c.createGain();
  for (const [freq, q, gain] of formants) {
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = c.createGain();
    g.gain.value = gain;
    mix.connect(bp).connect(g).connect(env);
  }
  const oscs = detune.map((dt) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = dt;
    o.connect(mix);
    o.start(t);
    o.stop(end + 0.2);
    return o;
  });
  return { env, oscs };
}

function bowedTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = midiToHz(midi);
  const end = t + Math.max(0.12, dur);
  const { env, oscs } = shaped(c, f, t, end, 'sawtooth', [[f * 1.5, 0.7, 0.9], [2800, 1.2, 0.5], [4500, 2, 0.25]], [-4, 5]);
  const peak = 0.3 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.09);
  env.gain.setValueAtTime(peak, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.15);
  env.connect(out);
  vibrato(c, t, 5.8, f * 0.007, 0.22, oscs.map((o) => o.frequency), end + 0.2);
  breath(c, t, end, 3500, 0.8, 0.03 * vel, 0.008 * vel, out);
}

function saxTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  const f = midiToHz(midi);
  const end = t + Math.max(0.1, dur);
  const { env, oscs } = shaped(c, f, t, end, 'square', [[f * 2, 0.9, 0.8], [1500, 1.5, 0.6], [2700, 2.5, 0.35]], [0, 7]);
  const peak = 0.3 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak * 1.2, t + 0.04);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.14);
  env.gain.setValueAtTime(peak, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.09);
  env.connect(out);
  // trượt nhẹ lên cao độ như người thổi
  oscs.forEach((o) => { o.frequency.setValueAtTime(f * 0.97, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); });
  vibrato(c, t, 5, f * 0.008, 0.3, oscs.map((o) => o.frequency), end + 0.2);
  breath(c, t, end, 2000, 1, 0.05 * vel, 0.015 * vel, out);
}

function reedTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  // accordion: hai lưỡi gà lệch tần (tiếng "musette") + lưỡi thấp một quãng tám
  const f = midiToHz(midi);
  const end = t + Math.max(0.1, dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(7000, f * 6);
  lp.Q.value = 0.8;
  const env = c.createGain();
  const peak = 0.2 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.04);
  env.gain.setValueAtTime(peak, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.08);
  lp.connect(env).connect(out);
  for (const [mult, dt, type, g] of [[1, -9, 'sawtooth', 0.5], [1, 9, 'sawtooth', 0.5], [0.5, 0, 'square', 0.35]] as [number, number, OscillatorType, number][]) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.type = type;
    o.frequency.value = f * mult;
    o.detune.value = dt;
    og.gain.value = g;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(end + 0.1);
  }
}

function organTone(c: AudioContext, midi: number, t: number, dur: number, vel: number, out: AudioNode) {
  // tay kéo kiểu organ điện: 16' 8' 4' 2 2/3' 2'
  const f = midiToHz(midi);
  const end = t + Math.max(0.1, dur);
  const env = c.createGain();
  const peak = 0.16 * vel;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  env.gain.setValueAtTime(peak, end);
  env.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
  env.connect(out);
  for (const [mult, g] of [[0.5, 0.5], [1, 0.8], [2, 0.5], [3, 0.3], [4, 0.25]]) {
    const o = c.createOscillator();
    const og = c.createGain();
    o.frequency.value = f * mult;
    og.gain.value = g;
    o.connect(og).connect(env);
    o.start(t);
    o.stop(end + 0.08);
  }
  // tiếng "click" phím organ
  hammer(c, t, 2000, 0.03 * vel, out);
}

/** Âm sắc gần giống harmonica: sóng răng cưa + vuông qua lọc thông thấp, có rung nhẹ */
/**
 * Tiếng kèn harmonica. `tremolo`: mỗi nốt có hai lưỡi gà, lưỡi thứ hai chỉnh cao hơn ~14 cent
 * → hai tiếng phách nhau thành tiếng rung "phập phồng" đặc trưng (không cần rung hơi giả bằng LFO).
 */
function harmonicaTone(c: AudioContext, midi: number, t: number, dur: number, velocity: number, out: AudioNode, tremolo = false): void {
  const f = midiToHz(midi);
  const end = t + Math.max(0.06, dur);
  const extra: OscillatorNode[] = [];

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
  lfoGain.gain.linearRampToValueAtTime(tremolo ? 0 : f * 0.004, t + 0.6);
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

  if (tremolo) {
    // cặp lưỡi gà thứ hai, lệch lên 14 cent (nốt thấp phách chậm, nốt cao phách nhanh — như kèn thật)
    const o3 = c.createOscillator();
    const o4 = c.createOscillator();
    o3.type = 'sawtooth';
    o4.type = 'square';
    o3.frequency.value = f;
    o4.frequency.value = f;
    o3.detune.value = 14;
    o4.detune.value = 20;
    const mix4 = c.createGain();
    mix4.gain.value = 0.35;
    o3.connect(filter);
    o4.connect(mix4).connect(filter);
    extra.push(o3, o4);
  }

  const env = c.createGain();
  // hai cặp lưỡi gà cộng lại to hơn: hạ bớt cho ngang tiếng kèn thường
  const peak = (tremolo ? 0.24 : 0.32) * velocity;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(peak, t + 0.025);
  env.gain.exponentialRampToValueAtTime(peak * 0.75, t + 0.12);
  env.gain.setValueAtTime(peak * 0.75, Math.max(t + 0.12, end - 0.06));
  env.gain.exponentialRampToValueAtTime(0.0001, end);

  o1.connect(filter);
  o2.connect(mix2).connect(filter);
  filter.connect(env).connect(out);

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
  br.connect(brF).connect(brG).connect(out);

  for (const o of [o1, o2, lfo, ...extra]) { o.start(t); o.stop(end + 0.02); }
  br.start(t, Math.random() * 0.5);
  br.stop(t + 0.1);
}

export type DrumKit = 'acoustic' | 'electronic' | 'soft';

let kit: DrumKit = 'acoustic';
let humanVel = 0;

export interface MixSettings { kit: DrumKit; instrument: Instrument; beatVol: number; melodyVol: number; bassVol: number; boVol: number; bellVol: number; compVol: number; clapVol: number; reverb: number; singVol?: number }
let mix: MixSettings = { kit: 'acoustic', instrument: 'harmonica', beatVol: 0.6, melodyVol: 0.55, bassVol: 0.7, boVol: 0.8, bellVol: 0.8, compVol: 0.7, clapVol: 0.8, reverb: 0.25, singVol: 0.8 };

/** Áp âm lượng / bộ trống / độ vang; chưa có AudioContext thì để dành áp lúc khởi tạo */
export function applyMix(m: MixSettings) {
  mix = { kit: m.kit, instrument: m.instrument, beatVol: m.beatVol, melodyVol: m.melodyVol, bassVol: m.bassVol, boVol: m.boVol ?? 0.8, bellVol: m.bellVol ?? 0.8, compVol: m.compVol ?? 0.7, clapVol: m.clapVol ?? 0.8, reverb: m.reverb, singVol: m.singVol ?? 0.8 };
  kit = m.kit;
  instrument = INSTRUMENT_OPTIONS.some((o) => o.value === m.instrument) ? m.instrument : 'harmonica';
  if (!ctx) return;
  const t = ctx.currentTime;
  drumBus.gain.setTargetAtTime(m.beatVol, t, 0.02);
  melodyBus.gain.setTargetAtTime(m.melodyVol, t, 0.02);
  bassBus.gain.setTargetAtTime(m.bassVol, t, 0.02);
  boBus.gain.setTargetAtTime(mix.boVol, t, 0.02);
  bellBus.gain.setTargetAtTime(mix.bellVol, t, 0.02);
  compBus.gain.setTargetAtTime(mix.compVol, t, 0.02);
  clapBus.gain.setTargetAtTime(mix.clapVol, t, 0.02);
  singBus.gain.setTargetAtTime(mix.singVol ?? 0.8, t, 0.02);
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
  o.connect(g).connect(hitOut ?? drumBus);
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
  src.connect(f).connect(g).connect(hitOut ?? drumBus);
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

/** 6 sóng vuông lệch tần qua lọc, tổng hợp sẵn một lần (hi-hat đánh rất dày: đỡ tạo 8 node mỗi tiếng) */
let metalBuf: AudioBuffer | null = null;
let metalPending = false;
function prepareMetal(c: AudioContext) {
  if (metalBuf || metalPending || typeof OfflineAudioContext === 'undefined') return;
  metalPending = true;
  try {
    const oc = new OfflineAudioContext(1, Math.round(c.sampleRate * 1.4), c.sampleRate);
    const bp = oc.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 10000;
    bp.Q.value = 0.8;
    const hp = oc.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    bp.connect(hp).connect(oc.destination);
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      const o = oc.createOscillator();
      o.type = 'square';
      o.frequency.value = 40 * r;
      o.connect(bp);
      o.start(0);
    }
    oc.startRendering().then((b) => { metalBuf = b; }, () => { metalPending = false; });
  } catch { metalPending = false; }
}

/** tiếng kim loại: chồng 6 sóng vuông lệch tần như máy trống kinh điển */
function metal(when: number, decay: number, gain: number) {
  const c = audio();
  if (metalBuf) {
    const src = c.createBufferSource();
    src.buffer = metalBuf;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, when + decay);
    src.connect(g).connect(drumBus);
    src.start(when, Math.random() * 0.3);
    src.stop(when + decay + 0.02);
    return;
  }
  prepareMetal(c);
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

/** mặt da trống tay: tần số chính + hoạ âm lệch (màng tròn), trượt cao độ nhẹ */
function handDrum(when: number, f: number, decay: number, gain: number, bright: number) {
  osc('sine', when, f * 1.12, f, 0.02, gain, decay);
  osc('sine', when, f * 1.59, f * 1.5, 0.02, gain * 0.35, decay * 0.6);
  noiseHit(when, 'bandpass', bright, 0.012, gain * 0.5, 1.5);
}

/**
 * bongo; kind: f = ngón nhẹ, t = gót tay, s = vỗ, h = mở cao, o = mở trầm,
 * v = vuốt bo (miết ngón trên mặt da: tiếng "u…" luyến lên), r = rung bo (vê dồn liên tục trong `dur` giây)
 */
export function bongo(when: number, kind: string, vel = 1, dur = 0.4) {
  hitOut = boBus;
  try {
    if (kind === 'v') bongoSlide(when, vel);
    else if (kind === 'r') bongoRoll(when, dur, vel);
    else bongoHit(when, kind, vel);
  } finally { hitOut = null; }
}

/** vuốt bo: ngón miết làm mặt da căng dần — cao độ trượt lên rồi chùng lại, kèm tiếng ma sát */
function bongoSlide(when: number, vel: number) {
  const c = audio();
  vel = vary(vel) * (kit === 'soft' ? 0.75 : 1);
  const o = c.createOscillator();
  const g = c.createGain();
  const f = 360;
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 0.95, when);
  o.frequency.exponentialRampToValueAtTime(f * 1.55, when + 0.2);
  o.frequency.exponentialRampToValueAtTime(f * 1.35, when + 0.34);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.2 * vel, when + 0.04);
  g.gain.setValueAtTime(0.2 * vel, when + 0.18);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.38);
  o.connect(g).connect(boBus);
  o.start(when);
  o.stop(when + 0.4);
  noiseHit(when, 'bandpass', 1600, 0.26, 0.05 * vel, 2, 0.06);
}

/** rung bo: hai tay vê xen kẽ mặt cao / trầm thật nhanh, to dần, chốt bằng tiếng mở */
function bongoRoll(when: number, dur: number, vel: number) {
  const gap = 0.045;
  const n = Math.max(4, Math.floor(dur / gap));
  for (let i = 0; i < n; i++) {
    const v = vel * (0.35 + 0.55 * (i / n));
    handDrum(when + i * gap, i % 2 ? 360 : 520, 0.05, 0.13 * vary(v), 3400);
  }
  handDrum(when + n * gap, 520, 0.16, 0.26 * vel, 3800);
}

function bongoHit(when: number, kind: string, vel: number) {
  vel = vary(vel) * (kit === 'soft' ? 0.75 : 1);
  const hi = 520, lo = 360;
  switch (kind) {
    case 'f': handDrum(when, hi, 0.07, 0.14 * vel, 3500); break;
    case 't': osc('sine', when, lo * 0.9, lo * 0.8, 0.02, 0.12 * vel, 0.05); break;
    case 's':
      // vỗ: tiếng da căng, chát, tắt rất nhanh
      noiseHit(when, 'bandpass', 2600, 0.05, 0.32 * vel, 1.4);
      osc('triangle', when, hi * 1.3, hi * 1.1, 0.02, 0.18 * vel, 0.06);
      break;
    case 'h': handDrum(when, hi, 0.16, 0.26 * vel, 3800); break;
    case 'o': handDrum(when, lo, 0.2, 0.3 * vel, 3000); break;
  }
}

/** conga (tumbadora); kind: o = mở, t = bàn tay úp (tắt), s = vỗ, l = tumba trầm */
export function conga(when: number, kind: string, vel = 1) {
  vel = vary(vel) * (kit === 'soft' ? 0.75 : 1);
  switch (kind) {
    case 'o': handDrum(when, 245, 0.28, 0.3 * vel, 2200); break;
    case 'l': handDrum(when, 185, 0.34, 0.32 * vel, 1800); break;
    case 't': osc('sine', when, 230, 200, 0.02, 0.12 * vel, 0.05); noiseHit(when, 'lowpass', 1200, 0.02, 0.08 * vel); break;
    case 's':
      noiseHit(when, 'bandpass', 2000, 0.06, 0.28 * vel, 1.2);
      osc('triangle', when, 340, 300, 0.02, 0.15 * vel, 0.07);
      break;
  }
}

/** güiro: tiếng cạo răng cưa — nhiễu được ngắt quãng nhanh */
export function guiro(when: number, long: boolean, vel = 1) {
  const c = audio();
  vel = vary(vel) * (kit === 'soft' ? 0.7 : 1);
  const dur = long ? 0.22 : 0.07;
  const src = c.createBufferSource();
  src.buffer = noise;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3600;
  bp.Q.value = 2.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  // mỗi răng ~22ms, tăng dần rồi nhả
  const ridge = 0.022;
  for (let x = 0; x < dur; x += ridge) {
    const amp = 0.16 * vel * (0.6 + 0.4 * (x / dur));
    g.gain.setValueAtTime(amp, when + x);
    g.gain.exponentialRampToValueAtTime(0.0005, when + x + ridge * 0.85);
  }
  src.connect(bp).connect(g).connect(drumBus);
  src.start(when, Math.random() * 0.5);
  src.stop(when + dur + 0.03);
}

/** Gõ hợp âm đệm ngắn ("pa" của valse): tiếng gảy mềm, kênh âm lượng riêng */
export function chordStab(midis: number[], when: number, dur: number, vel = 1) {
  const c = audio();
  vel = vary(vel);
  const end = when + Math.max(0.08, dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(kit === 'electronic' ? 3500 : 2600, when);
  lp.frequency.exponentialRampToValueAtTime(900, end);
  const env = c.createGain();
  const peak = (kit === 'soft' ? 0.1 : 0.13) * vel;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(peak, when + 0.008);
  env.gain.exponentialRampToValueAtTime(peak * 0.4, when + 0.12);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  lp.connect(env).connect(compBus);
  midis.forEach((m, i) => {
    const f = midiToHz(m);
    for (const [type, mult, g] of [['triangle', 1, 0.6], ['sawtooth', 1, 0.15], ['sine', 2, 0.15]] as [OscillatorType, number, number][]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.type = type;
      o.frequency.value = f * mult;
      og.gain.value = g;
      o.connect(og).connect(lp);
      // rải nhẹ như quạt dây
      o.start(when + i * 0.008);
      o.stop(end + 0.02);
    }
  });
}

/** chuông bò (cencerro): hai sóng vuông lệch tần qua lọc dải — tiếng "keng" kim loại */
export function cowbell(when: number, vel = 1) {
  const c = audio();
  vel = vary(vel) * (kit === 'soft' ? 0.6 : 1);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2400;
  bp.Q.value = 1.6;
  const g = c.createGain();
  const decay = kit === 'electronic' ? 0.25 : 0.14;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.22 * vel, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.06 * vel, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.001, when + decay);
  bp.connect(g).connect(bellBus);
  for (const f of [562, 845]) {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    o.connect(bp);
    o.start(when);
    o.stop(when + decay + 0.02);
  }
}

/** vỗ tay: ba tiếng nhiễu sát nhau (nhiều người vỗ) rồi một đuôi ngắn */
export function clap(when: number, vel = 1) {
  vel = vary(vel) * (kit === 'soft' ? 0.6 : 1);
  hitOut = clapBus;
  try {
    for (const [dt, g] of [[0, 0.3], [0.011, 0.26], [0.022, 0.22]]) noiseHit(when + dt, 'bandpass', 1200, 0.012, g * vel, 1.1);
    noiseHit(when + 0.03, 'bandpass', 1100, kit === 'electronic' ? 0.18 : 0.12, 0.25 * vel, 0.9);
  } finally { hitOut = null; }
}

/** chũm chọe ride: tiếng kim loại ngân dài + "ping" của mũ chũm */
export function ride(when: number, vel = 1) {
  vel = vary(vel) * (kit === 'soft' ? 0.6 : 1);
  metal(when, kit === 'electronic' ? 0.5 : 0.8, 0.11 * vel);
  osc('sine', when, 3150, 3150, 0, 0.04 * vel, 0.5);
  noiseHit(when, 'highpass', 8000, 0.25, 0.04 * vel, 0.5);
}

/** surdo: trống cái samba — thân rất trầm ngân dài + tiếng dùi bông */
export function surdo(when: number, vel = 1) {
  vel = vary(vel) * (kit === 'soft' ? 0.75 : 1);
  osc('sine', when, 95, 62, 0.12, 0.85 * vel, kit === 'electronic' ? 0.7 : 0.55);
  osc('sine', when, 150, 120, 0.05, 0.2 * vel, 0.15);
  noiseHit(when, 'lowpass', 900, 0.03, 0.18 * vel, 0.7);
}

/** clave: hai thanh gỗ cứng gõ vào nhau — tiếng "cách" cao, ngân ngắn */
export function clave(when: number, vel = 1) {
  vel = vary(vel) * (kit === 'soft' ? 0.7 : 1);
  osc('sine', when, 2500, 2450, 0.02, 0.28 * vel, 0.07);
  osc('sine', when, 5100, 5000, 0.01, 0.06 * vel, 0.03);
  noiseHit(when, 'bandpass', 3000, 0.008, 0.08 * vel, 3);
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

/** Nhạc cụ đệm hát: guitar gõ bo / quạt chả, piano tự đệm (không trống), hoặc cả ban nhạc theo beat */
export type Accomp = 'gobo' | 'strum' | 'piano' | 'band';

export const ACCOMP_OPTIONS: { value: Accomp; label: string }[] = [
  { value: 'gobo', label: 'Guitar gõ bo' },
  { value: 'strum', label: 'Guitar quạt chả' },
  { value: 'piano', label: 'Piano' },
  { value: 'band', label: 'Ban nhạc' },
];

/** Hợp âm cần cho một nhát đệm: bass gốc / quãng 5 (E2–D#3) và hợp âm ba thế đóng cho piano */
export interface AccompChord { bass: number; fifth: number; minor: boolean; triad: number[] }

/** Thế bấm guitar: gốc ở dây trầm, rồi quãng 5, 8, 3, 5, 8 lên tới dây cao */
function guitarShape(ch: AccompChord): number[] {
  const r = ch.bass;
  return [r, r + 7, r + 12, r + 12 + (ch.minor ? 3 : 4), r + 19, r + 24];
}

/** dây bị chặn ngay sau khi gảy: "tách" ngắn, không ngân */
function mutedPluck(c: AudioContext, midi: number, t: number, vel: number, out: AudioNode) {
  const src = c.createBufferSource();
  src.buffer = pluckBuffer(c, midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4 * vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.07);
}

/** quạt dây: xuống = dây trầm → cao (bỏ dây bass), lên = 4 dây cao, khẽ hơn */
function strumGuitar(c: AudioContext, ch: AccompChord, t: number, dur: number, vel: number, up: boolean) {
  const shape = guitarShape(ch).slice(1);
  const strings = up ? shape.slice(-4).reverse() : shape;
  const gap = up ? 0.009 : 0.013;
  strings.forEach((m, i) => guitarTone(c, m, t + i * gap, dur, vel * 0.32 * (up ? 0.8 : 1 - i * 0.04), singBus));
}

/** gõ bo: lòng bàn tay chặn dây đập xuống thùng đàn — tiếng "bộp" trầm + dây kêu tách */
function goboSlap(c: AudioContext, ch: AccompChord, t: number, vel: number) {
  hitOut = singBus;
  try {
    osc('sine', t, 170, 85, 0.05, 0.42 * vel, 0.1);
    noiseHit(t, 'lowpass', 700, 0.045, 0.32 * vel, 0.8);
    noiseHit(t, 'bandpass', 2200, 0.035, 0.2 * vel, 1);
  } finally { hitOut = null; }
  guitarShape(ch).slice(1).forEach((m, i) => mutedPluck(c, m, t + i * 0.003, 0.22 * vel, singBus));
}

/**
 * Một nhát đệm hát. kind theo điệu đệm (strumPattern / barTrack): B/F bass, D/d/U quạt, X gõ bo,
 * 3/4/5 rải một dây (dây số 3 = quãng 3, 4 = quãng 5, 5 = quãng 8 trên), Z = kết bài (bass + quạt chậm ngân dài),
 * V = vuốt dây (quạt thật chậm từ bass lên dây cao, để ngân), R = rung dây (quạt rung xuống–lên liên tục suốt `dur`, to dần),
 * L = lắc cổ tay (3 ngón búng dây liên tiếp "rrà" rồi chốt).
 * `dur` = thời gian tới nhát kế tiếp (giây), `bassDur` = tới nốt bass kế tiếp.
 */
export function accompHit(accomp: Accomp, kind: string, ch: AccompChord, when: number, dur: number, bassDur: number, vel = 1) {
  if (accomp === 'band') return;
  const c = audio();
  const t = Math.max(when, c.currentTime);
  vel = vary(vel);
  const arp = kind >= '3' && kind <= '5';
  if (kind === 'V') {
    const notes = accomp === 'piano' ? [ch.bass, ...ch.triad, ch.triad[0] + 12] : guitarShape(ch);
    const ring = Math.max(1.2, dur * 1.5);
    notes.forEach((m, i) => (accomp === 'piano' ? pianoTone : guitarTone)(c, m, t + i * 0.05, ring, (i === 0 ? 0.5 : 0.3 + 0.03 * i) * vel, singBus));
    return;
  }
  if (kind === 'R') {
    // quạt rung: nhát xuống/lên luân phiên ~14 nhát mỗi giây, to dần
    const gap = 0.07;
    const n = Math.max(3, Math.floor(dur / gap));
    for (let i = 0; i < n; i++) {
      const v = vel * (0.45 + 0.5 * (i / n));
      if (accomp === 'piano') ch.triad.forEach((m) => pianoTone(c, m + (i % 2 ? 12 : 0), t + i * gap, 0.14, 0.22 * v, singBus));
      else strumGuitar(c, ch, t + i * gap, 0.16, 0.8 * v, i % 2 === 1);
    }
    return;
  }
  if (kind === 'L') {
    if (accomp === 'piano') { ch.triad.forEach((m) => pianoTone(c, m, t, dur * 0.9, 0.45 * vel, singBus)); return; }
    // lắc cổ tay (rasgueado): ngón út, áp út, giữa búng xuống liên tiếp, ngón trỏ chốt
    for (let i = 0; i < 3; i++) strumGuitar(c, ch, t + i * 0.035, 0.12, 0.55 * vel * (0.8 + 0.1 * i), false);
    strumGuitar(c, ch, t + 0.11, Math.max(0.2, dur - 0.11), 1.05 * vel, false);
    return;
  }
  if (kind === 'Z') {
    // kết bài: bass rồi một tiếng quạt / hợp âm thật chậm, để ngân
    if (accomp === 'piano') {
      pianoTone(c, ch.bass, t, 2.6, 0.7 * vel, singBus);
      [...ch.triad, ch.triad[0] + 12].forEach((m, i) => pianoTone(c, m, t + i * 0.02, 2.6, 0.38 * vel, singBus));
    } else {
      guitarTone(c, ch.bass, t, 2.6, 0.55 * vel, singBus);
      guitarShape(ch).slice(1).forEach((m, i) => guitarTone(c, m, t + 0.02 + i * 0.035, 2.6, vel * 0.32, singBus));
    }
    return;
  }
  if (arp) {
    // rải: dây buông ngân tới nhát sau một chút cho liền tiếng
    const ring = Math.min(1.6, dur * 2.2);
    if (accomp === 'piano') {
      const m = kind === '3' ? ch.triad[1] : kind === '4' ? ch.triad[2] : ch.triad[0] + 12;
      pianoTone(c, m, t, ring, 0.34 * vel, singBus);
    } else guitarTone(c, guitarShape(ch)[Number(kind)], t, ring, 0.42 * vel, singBus);
    return;
  }
  if (accomp === 'piano') {
    if (kind === 'B' || kind === 'F') pianoTone(c, kind === 'F' ? ch.fifth : ch.bass, t, bassDur * 0.95, 0.6 * vel, singBus);
    else if (kind !== 'U') ch.triad.forEach((m) => pianoTone(c, m, t, dur * 0.9, (kind === 'd' ? 0.25 : kind === 'X' ? 0.42 : 0.36) * vel, singBus));
    return;
  }
  switch (kind) {
    case 'B': case 'F':
      guitarTone(c, kind === 'F' ? ch.fifth : ch.bass, t, bassDur * 0.95, 0.5 * vel, singBus);
      break;
    case 'D': strumGuitar(c, ch, t, dur, vel, false); break;
    case 'd': strumGuitar(c, ch, t, dur, 0.6 * vel, false); break;
    case 'U': strumGuitar(c, ch, t, dur, vel, true); break;
    case 'X':
      if (accomp === 'gobo') goboSlap(c, ch, t, vel);
      else strumGuitar(c, ch, t, dur, 1.1 * vel, false);
      break;
  }
}
