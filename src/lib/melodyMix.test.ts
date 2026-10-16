import { describe, expect, it } from 'vitest';
import { analyzeRecording, segmentNotes, ScoreNote } from './audioAlign';
import { trackMelodyInMix } from './melodyMix';

const SR = 44100;

/** bài hát giả lập: giọng hát (rung, nhiều hoạ âm) + hợp âm tắt dần + bè trầm + tiếng trống, có nhạc dạo */
function song(mel: [number, number][], acc = 0.8, bpm = 92) {
  let rnd = 7;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const spb = 60 / bpm, intro = 4;
  const beats = mel.reduce((t, [, b]) => t + b, 0) + intro;
  const out = new Float32Array(Math.ceil((beats * spb + 2) * SR));
  const tone = (t0: number, len: number, midi: number, amp: number, harm: number[], vib: number, decay: number) => {
    const f0 = 440 * 2 ** ((midi - 69) / 12), n0 = Math.floor(t0 * SR), n1 = Math.min(out.length, Math.floor((t0 + len) * SR));
    let ph = 0;
    for (let i = n0; i < n1; i++) {
      const tt = (i - n0) / SR, rel = (n1 - i) / SR;
      const env = Math.min(1, tt / 0.02) * Math.min(1, rel / 0.04) * Math.exp(-tt * decay);
      ph += (2 * Math.PI * f0 * (1 + vib * Math.sin(2 * Math.PI * 5.5 * tt) * Math.min(1, tt / 0.3))) / SR;
      let v = 0;
      harm.forEach((h, k) => (v += h * Math.sin((k + 1) * ph)));
      out[i] += amp * env * v;
    }
  };
  // nhạc đệm suốt bài (cả đoạn dạo): hợp âm theo nốt giai điệu đang hát, bass, hi-hat
  const starts: number[] = [];
  let t = 0.3 + intro * spb;
  for (const [, b] of mel) { starts.push(t); t += b * spb; }
  const rootAt = (time: number) => { for (let i = mel.length - 1; i >= 0; i--) if (time >= starts[i] && mel[i][0] > 0) return mel[i][0] - 12; return 57; };
  for (let b = 0, bt = 0.3; b < beats; b++, bt += spb) {
    const root = rootAt(bt);
    if (b % 2 === 0) for (const iv of [0, 4, 7]) tone(bt, 2 * spb, root - 5 + iv, 0.1 * acc, [1, 0.4, 0.2], 0, 2.5);
    tone(bt, spb * 0.9, root - 17, 0.22 * acc, [1, 0.5, 0.2], 0, 1.5);
    for (let i = Math.floor((bt + spb / 2) * SR), e = i + 0.03 * SR; i < e; i++) out[i] += (rand() - 0.5) * 0.08 * acc;
  }
  mel.forEach(([m, b], i) => { if (m > 0) tone(starts[i], b * spb * 0.9, m, 0.22, [1, 0.7, 0.5, 0.35, 0.25, 0.15], 0.012, 0.3); });
  return out;
}

const MEL: [number, number][] = [
  [67, 1], [64, 0.5], [65, 0.5], [67, 1], [72, 1], [69, 2], [67, 1], [65, 1],
  [64, 1], [62, 1], [60, 2], [62, 1], [64, 1], [65, 1], [67, 1], [69, 1], [67, 1], [64, 2],
];

describe('dò giai điệu trong bài hát có nhạc đệm', () => {
  it('tách được phần lớn nốt giai điệu dù có hợp âm, bè trầm, trống và nhạc dạo', () => {
    const got = segmentNotes(trackMelodyInMix(song(MEL), SR)).map((n) => Math.round(n.midi));
    const want = MEL.map(([m]) => m);
    // so khớp theo thứ tự (bỏ qua nốt nhạc dạo / nốt thừa)
    let j = 0, hit = 0;
    for (const w of want) { const k = got.indexOf(w, j); if (k >= 0 && k - j <= 3) { hit++; j = k + 1; } }
    expect(hit / want.length).toBeGreaterThanOrEqual(0.8);
  });

  it('chế độ bài gốc chỉ gợi ý sửa cao độ, và tìm ra nốt quét sai', () => {
    const score: ScoreNote[] = MEL.map(([m, b], i) => ({ id: `n${i}`, midi: m, beats: b }));
    score[4] = { ...score[4], midi: 74 }; // C5 bị đọc thành D5
    score.splice(9, 1); // sót một nốt
    const r = analyzeRecording(song(MEL), SR, score, 4, 'mix');
    expect(r.suggestions.every((s) => s.kind === 'pitch')).toBe(true);
    expect(r.suggestions).toContainEqual(expect.objectContaining({ kind: 'pitch', noteId: 'n4', from: 74, to: 72 }));
  });
});
