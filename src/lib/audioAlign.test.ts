import { describe, expect, it } from 'vitest';
import { analyzeRecording, compareWithAudio, ScoreNote, segmentNotes, trackPitch } from './audioAlign';

const SR = 44100;

/**
 * "Bản thu" giả lập: tiếng có hoạ âm, rung nhẹ, mỗi nốt có tiếng bật / tắt dần, nghỉ hơi ngắn giữa các nốt,
 * nhịp hơi co giãn (như người thật), thêm chút tiếng ồn.
 */
function sing(notes: [number, number][], bpm = 90, transpose = 0, seed = 1, legato = false) {
  let rnd = seed;
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const spb = 60 / bpm;
  const total = notes.reduce((t, [, b]) => t + b * spb * 1.1, 0.5) + 1;
  const out = new Float32Array(Math.ceil(total * SR));
  let t = 0.3;
  for (const [midi, beats] of notes) {
    const len = beats * spb * (0.92 + 0.16 * rand()); // co giãn ±8%
    if (midi > 0) {
      const f0 = 440 * 2 ** ((midi + transpose - 69) / 12);
      const n0 = Math.floor(t * SR), n1 = Math.floor((t + len * (legato ? 1 : 0.88)) * SR);
      let ph = 0;
      for (let i = n0; i < n1 && i < out.length; i++) {
        const tt = (i - n0) / SR, rel = (n1 - i) / SR;
        const env = legato ? 1 : Math.min(1, tt / 0.03) * Math.min(1, rel / 0.05);
        ph += (2 * Math.PI * f0 * (1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * tt))) / SR;
        out[i] += 0.3 * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph));
      }
    }
    t += len;
  }
  for (let i = 0; i < out.length; i++) out[i] += (rand() - 0.5) * 0.004;
  return out;
}

// giai điệu đúng (midi, phách): "Twinkle twinkle" có nốt lặp lại
const TRUE: [number, number][] = [
  [60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2],
  [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2],
  [67, 1], [67, 1], [65, 1], [65, 1], [64, 1], [64, 1], [62, 2],
];

describe('dò cao độ bản thu', () => {
  it('thổi / hát liền không nghỉ hơi giữa các nốt vẫn tách được', () => {
    const mel: [number, number][] = [[60, 1], [62, 1], [64, 1], [65, 1], [67, 2], [65, 1], [64, 1], [62, 1], [60, 2]];
    const notes = segmentNotes(trackPitch(sing(mel, 100, 0, 3, true), SR));
    expect(notes.map((n) => Math.round(n.midi))).toEqual(mel.map(([m]) => m));
  });

  it('tách đúng từng nốt, kể cả nốt lặp lại cùng cao độ', () => {
    const notes = segmentNotes(trackPitch(sing(TRUE), SR));
    expect(notes.map((n) => Math.round(n.midi))).toEqual(TRUE.map(([m]) => m));
  });
});

describe('đối chiếu bản quét với bản thu', () => {
  const ids = (s: ScoreNote[]) => s;
  const scoreFrom = (mel: [number, number][]) => ids(mel.map(([m, b], i) => ({ id: `n${i}`, midi: m, beats: b })));

  it('bản quét đúng → không có gợi ý, dù hát thấp hơn một quãng tám và khác giọng', () => {
    const r = analyzeRecording(sing(TRUE, 80, -10), SR, scoreFrom(TRUE));
    expect(r.offset).toBe(-10);
    expect(r.suggestions).toEqual([]);
    expect(r.matched).toBeGreaterThan(18);
  });

  it('tìm ra nốt sai cao độ, nốt sót (cả chỗ máy đã chèn dấu lặng), nốt thừa', () => {
    const score = scoreFrom(TRUE);
    score[4] = { ...score[4], midi: 71 }; // A4 bị đọc thành B4
    score[9] = { id: 'g9', midi: null, beats: 1, guess: true }; // máy sót E4, đã chèn dấu lặng
    score.splice(16, 1); // sót hẳn F4 (phách 16)
    score.splice(12, 0, { id: 'x', midi: 72, beats: 0.5 }); // nốt thừa do đọc nhầm (vd chữ / dấu)
    const r = analyzeRecording(sing(TRUE), SR, score);
    const s = r.suggestions;
    expect(s).toContainEqual(expect.objectContaining({ kind: 'pitch', noteId: 'n4', from: 71, to: 69 }));
    expect(s).toContainEqual(expect.objectContaining({ kind: 'fill', noteId: 'g9', to: 64 }));
    expect(s).toContainEqual(expect.objectContaining({ kind: 'missing', afterId: 'n15', to: 65, beats: 1 }));
    expect(s).toContainEqual(expect.objectContaining({ kind: 'extra', noteId: 'x' }));
    expect(s).toHaveLength(4);
  });

  it('trường độ sai trong ô lệch phách (thiếu chấm dôi)', () => {
    const mel: [number, number][] = [[60, 1], [62, 1], [64, 1.5], [65, 0.5], [67, 2], [65, 1], [64, 1], [62, 1], [60, 1], [62, 1], [64, 1], [65, 2]];
    // ô nhịp 4/4 theo trường độ đúng
    let acc = 0;
    const score = scoreFrom(mel).map((n) => { const bar = `b${Math.floor(acc / 4 + 1e-6)}`; acc += n.beats; return { ...n, bar }; });
    score[2] = { ...score[2], beats: 1 }; // chấm dôi bị sót → ô đầu thiếu nửa phách
    const r = analyzeRecording(sing(mel, 100), SR, score, 4);
    expect(r.suggestions).toEqual([expect.objectContaining({ kind: 'duration', noteId: 'n2', from: 1, to: 1.5 })]);
  });

  it('không có nốt nào thì không gợi ý', () => {
    expect(compareWithAudio([], []).suggestions).toEqual([]);
  });
});
