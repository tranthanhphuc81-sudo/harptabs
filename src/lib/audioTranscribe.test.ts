import { describe, expect, it } from 'vitest';
import { audioToTranscription, detectNotes, DetectedNote, estimateTempo, guessKey, quantizeNotes } from './audioTranscribe';
import { aiToTab } from './ai';
import { parseTab } from './tabText';

const SR = 22050;

/** "Bản thu" giả lập như audioAlign.test: tiếng có hoạ âm, rung nhẹ, nhịp co giãn, ngắt hơi giữa các nốt */
function sing(notes: [number, number][], bpm: number, seed = 1, jitter = 0.06) {
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const spb = 60 / bpm;
  const total = notes.reduce((t, [, b]) => t + b * spb * 1.1, 0.5) + 1;
  const out = new Float32Array(Math.ceil(total * SR));
  let t = 0.4;
  for (const [midi, beats] of notes) {
    const len = beats * spb * (1 - jitter + 2 * jitter * rand());
    if (midi > 0) {
      const f0 = 440 * 2 ** ((midi - 69) / 12);
      const n0 = Math.floor(t * SR), n1 = Math.floor((t + len * 0.88) * SR);
      let ph = 0;
      for (let i = n0; i < n1 && i < out.length; i++) {
        const tt = (i - n0) / SR, rel = (n1 - i) / SR;
        const env = Math.min(1, tt / 0.03) * Math.min(1, rel / 0.05);
        ph += (2 * Math.PI * f0 * (1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * tt))) / SR;
        out[i] += 0.3 * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
      }
    }
    t += len;
  }
  for (let i = 0; i < out.length; i++) out[i] += (rand() - 0.5) * 0.004;
  return out;
}

// "Ode to Joy" có nốt đen chấm + móc đơn, giọng Đô trưởng, 4/4 không lấy đà
const ODE: [number, number][] = [
  [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
  [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2],
  [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1],
  [60, 1], [60, 1], [62, 1], [64, 1], [62, 1.5], [60, 0.5], [60, 2],
];

// "Happy Birthday" 3/4, lấy đà 1 phách (hai móc đơn), giọng Fa trưởng
const BIRTHDAY: [number, number][] = [
  [60, 0.5], [60, 0.5], [62, 1], [60, 1], [65, 1], [64, 2],
  [60, 0.5], [60, 0.5], [62, 1], [60, 1], [67, 1], [65, 2],
  [60, 0.5], [60, 0.5], [72, 1], [69, 1], [65, 1], [64, 1], [62, 1],
  [70, 0.5], [70, 0.5], [69, 1], [65, 1], [67, 1], [65, 2],
];

/** so chuỗi nốt dò được với giai điệu đúng (cùng độ dài thì so từng nốt) */
function score(got: { midi: number | null; beats: number }[], want: [number, number][]) {
  const notes = got.filter((n) => n.midi !== null) as { midi: number; beats: number }[];
  let pitch = 0, dur = 0;
  const m = Math.min(notes.length, want.length);
  for (let i = 0; i < m; i++) {
    if (notes[i].midi === want[i][0]) pitch++;
    if (Math.abs(notes[i].beats - want[i][1]) < 1e-6) dur++;
  }
  return { count: notes.length, pitch: pitch / want.length, dur: dur / want.length };
}

describe('bản thu → tab', () => {
  it('dò đủ nốt, đúng cao độ (Ode to Joy, 96 bpm)', () => {
    const notes = detectNotes(sing(ODE, 96), SR, 'solo');
    expect(notes.length).toBe(ODE.length);
    expect(notes.map((n) => n.midi)).toEqual(ODE.map(([m]) => m));
  });

  it('đoán tempo gần đúng và làm tròn trường độ', () => {
    for (const [mel, bpm, barBeats] of [[ODE, 96, 4], [ODE, 72, 4], [BIRTHDAY, 110, 3]] as const) {
      const notes = detectNotes(sing(mel as [number, number][], bpm, 3), SR, 'solo');
      const t = estimateTempo(notes);
      expect(Math.abs(t.bpm - bpm) / bpm, `tempo ${bpm} → ${t.bpm}`).toBeLessThan(0.06);
      const q = quantizeNotes(notes, { bpm: t.bpm, offset: t.offset, barBeats, grid: 0.5 });
      const s = score(q.notes, mel as [number, number][]);
      expect(s.pitch, `cao độ ${bpm}`).toBeGreaterThanOrEqual(0.95);
      expect(s.dur, `trường độ ${bpm}: ${q.notes.map((n) => n.beats).join(' ')}`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('nhận ra nhịp lấy đà (Happy Birthday 3/4)', () => {
    const notes = detectNotes(sing(BIRTHDAY, 100, 5, 0.03), SR, 'solo');
    const t = estimateTempo(notes);
    const q = quantizeNotes(notes, { bpm: t.bpm, offset: t.offset, barBeats: 3, grid: 0.5 });
    expect(q.pickupBeats).toBe(1);
  });

  it('đoán giọng', () => {
    const mel = (m: [number, number][]) => m.map(([midi, beats], i) => ({ start: i, beats, midi }));
    expect(guessKey(mel(ODE))).toBe('C');
    expect(guessKey(mel(BIRTHDAY))).toBe('F');
  });

  it('làm tròn: nối chỗ ngắt hơi ngắn, nốt sát nhau không chồng lên nhau', () => {
    const n = (start: number, end: number, midi: number): DetectedNote => ({ start, end, midi });
    // 60 bpm, phách = 1 giây
    const q = quantizeNotes([n(0, 0.8, 60), n(1.02, 1.4, 62), n(1.48, 2.9, 64), n(4.05, 5, 65)], { bpm: 60, offset: 0, barBeats: 4, grid: 0.5 });
    expect(q.notes.map((x) => [x.start, x.beats])).toEqual([[0, 1], [1, 0.5], [1.5, 1.5], [4, 1]]);
  });

  it('ra tab cho kèn chromatic và diatonic', () => {
    const notes = detectNotes(sing(ODE, 90, 7), SR, 'solo');
    const t = estimateTempo(notes);
    const tr = audioToTranscription(notes, { ...t, barBeats: 4, grid: 0.5, title: 'Thử', timeSig: '4/4' });
    expect(tr.songKey).toBe('C');
    for (const type of ['diatonic', 'chromatic'] as const) {
      const c = aiToTab(tr, 'auto', true, type);
      expect(parseTab(c.body, c.harpKey, c.harpType).issues.filter((i) => i.level === 'error')).toEqual([]);
      expect(c.fit.stats.unplayable).toBe(0);
    }
  });
});
