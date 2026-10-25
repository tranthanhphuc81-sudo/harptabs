import { describe, expect, it } from 'vitest';
import { analyzeRecording, ScoreNote } from './audioAlign';
import { fromAnchors, secAt } from './tempoMap';

const SR = 22050;
// "Twinkle": (midi, phách); có nốt lặp lại và nốt dài
const MEL: [number, number][] = [
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
];

/** "bài gốc": dạo nhạc 3 giây im, tốc độ nhanh dần 0,62 → 0,50 s/phách; trả về âm thanh và giây thật của từng phách */
function render() {
  const total = MEL.reduce((t, [, b]) => t + b, 0);
  const spbAt = (beat: number) => 0.62 - (0.12 * beat) / total;
  const secOf: number[] = [3];
  for (let b = 0; b < total + 1; b++) secOf.push(secOf[b] + spbAt(b));
  const out = new Float32Array(Math.ceil((secOf[total] + 1) * SR));
  let beat = 0;
  for (const [midi, beats] of MEL) {
    const f = 440 * 2 ** ((midi - 69) / 12);
    const n0 = Math.floor(secOf[beat] * SR), n1 = Math.floor((secOf[beat + beats] - 0.06) * SR);
    for (let i = n0; i < n1; i++) {
      const tt = (i - n0) / SR, env = Math.min(1, tt / 0.02) * Math.min(1, (n1 - i) / SR / 0.04);
      out[i] += 0.3 * env * (Math.sin(2 * Math.PI * f * tt) + 0.4 * Math.sin(4 * Math.PI * f * tt));
    }
    beat += beats;
  }
  return { samples: out, secOf };
}

describe('tự đồng bộ nhạc nền theo tab', () => {
  it('dựng bản đồ nhịp từ bài có dạo nhạc và nhịp nhanh dần, sai số dưới 50 ms', () => {
    const { samples, secOf } = render();
    const score: ScoreNote[] = MEL.map(([midi, beats], i) => ({ id: String(i), midi, beats }));
    const r = analyzeRecording(samples, SR, score, 4, 'solo');
    expect(r.anchors.length).toBeGreaterThan(MEL.length * 0.6);
    const map = fromAnchors(r.anchors)!;
    let beat = 0, worst = 0;
    for (const [, beats] of MEL) { worst = Math.max(worst, Math.abs(secAt(map, beat) - secOf[beat])); beat += beats; }
    expect(worst).toBeLessThan(0.05);
  });

  it('bài có nhạc đệm (hợp âm trầm kéo dài): vẫn đồng bộ được, sai số dưới 80 ms', () => {
    const { samples, secOf } = render();
    // đệm: hợp âm C / F / G thấp hai quãng tám, mỗi ô 4 phách, nhỏ hơn giai điệu
    const chords = [[48, 52, 55], [48, 52, 55], [53, 57, 60], [48, 52, 55], [55, 59, 62], [48, 52, 55], [55, 59, 62], [55, 59, 62]];
    chords.forEach((ch, bar) => {
      const n0 = Math.floor(secOf[bar * 4] * SR), n1 = Math.floor(secOf[Math.min(bar * 4 + 4, secOf.length - 1)] * SR);
      for (const m of ch) {
        const f = 440 * 2 ** ((m - 24 - 69) / 12) * 4;
        for (let i = n0; i < n1 && i < samples.length; i++) samples[i] += 0.07 * Math.sin((2 * Math.PI * f * (i - n0)) / SR);
      }
    });
    const score: ScoreNote[] = MEL.map(([midi, beats], i) => ({ id: String(i), midi, beats }));
    const r = analyzeRecording(samples, SR, score, 4, 'mix');
    const map = fromAnchors(r.anchors)!;
    expect(map).not.toBeNull();
    let beat = 0, worst = 0;
    for (const [, beats] of MEL) { worst = Math.max(worst, Math.abs(secAt(map, beat) - secOf[beat])); beat += beats; }
    expect(worst).toBeLessThan(0.08);
  });
});

