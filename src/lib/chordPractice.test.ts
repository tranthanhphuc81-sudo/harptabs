import { describe, expect, it } from 'vitest';
import { chordShape, shapeMidis } from '../data/chordShapes';
import { judgeChord, Spectrum, StrumDetector } from './chordPractice';
import { midiToHz } from './harp';

/** phổ giả: mỗi nốt có hoạ âm 1..6 giảm dần, thêm nền nhiễu nhỏ; giống micro 48 kHz, fftSize 16384 */
function spectrum(notes: number[], amp: Record<number, number> = {}): Spectrum {
  const binHz = 48000 / 16384;
  const mag = new Float32Array(8192).fill(1e-4);
  for (const m of notes) {
    const a = amp[m] ?? 1;
    for (let k = 1; k <= 6; k++) {
      const i = Math.round((k * midiToHz(m)) / binHz);
      mag[i] += a / k;
      mag[i - 1] += a / k / 3;
      mag[i + 1] += a / k / 3;
    }
  }
  return { mag, binHz };
}

/** phổ tính như micro thật: tín hiệu 16384 mẫu, cửa sổ Blackman, DFT tới 1200 Hz — có sườn phổ lấn sang ô bên cạnh */
function realSpectrum(notes: number[]): Spectrum {
  const N = 16384, sr = 48000, binHz = sr / N;
  const x = new Float32Array(N);
  for (const m of notes) {
    const f = midiToHz(m);
    for (let k = 1; k <= 5; k++) for (let i = 0; i < N; i++) x[i] += (0.2 / k) * Math.sin((2 * Math.PI * f * k * i) / sr + m);
  }
  for (let i = 0; i < N; i++) x[i] *= 0.42 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) + 0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
  const mag = new Float32Array(N / 2).fill(1e-6);
  for (let b = 1; b < 1200 / binHz; b++) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * b) / N;
    for (let i = 0; i < N; i++) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i); }
    mag[b] = Math.hypot(re, im) / N;
  }
  return { mag, binHz };
}

// C guitar x32010: Đô3 Mi3 Sol3 Đô4 Mi4
const C = [48, 52, 55, 60, 64];

describe('chấm hợp âm guitar từ phổ', () => {
  it('quạt đúng thế C → ok', () => {
    expect(judgeChord(spectrum(C), 'C', 'guitar')?.kind).toBe('ok');
  });

  it('dây 4 (Mi3) bị câm → báo dây 4', () => {
    const v = judgeChord(spectrum(C, { 52: 0.01 }), 'C', 'guitar')!;
    expect(v.kind).toBe('issues');
    expect(v.issues).toContainEqual({ kind: 'weak', string: 4, midi: 52 });
  });

  it('dây 3 bấm nhầm phím 1 (Sol#3 thay Sol3) → dây 3 câm + nốt lạ Sol#', () => {
    const v = judgeChord(spectrum([48, 52, 56, 60, 64]), 'C', 'guitar')!;
    expect(v.issues).toContainEqual({ kind: 'weak', string: 3, midi: 55 });
    expect(v.issues).toContainEqual({ kind: 'foreign', midi: 56 });
  });

  it('phổ thật (cửa sổ Blackman): C đúng → ok; dây 3 lệch một phím → dây 3 câm + một nốt lạ Sol#3 (không báo cả hoạ âm)', () => {
    expect(judgeChord(realSpectrum(C), 'C', 'guitar')?.kind).toBe('ok');
    const v = judgeChord(realSpectrum([48, 52, 56, 60, 64]), 'C', 'guitar')!;
    expect(v.issues).toEqual([{ kind: 'weak', string: 3, midi: 55 }, { kind: 'foreign', midi: 56 }]);
  });

  it('phổ thật: bấm đúng các hợp âm thường gặp (guitar + ukulele) không bị báo lỗi', () => {
    for (const inst of ['guitar', 'ukulele'] as const) {
      for (const c of ['G', 'Am', 'Em', 'D', 'F', 'E7', 'B7', 'Bm']) {
        const v = judgeChord(realSpectrum(shapeMidis(chordShape(c, inst)!, inst)), c, inst)!;
        expect({ c, inst, issues: v.issues }).toEqual({ c, inst, issues: [] });
      }
    }
  });

  it('quạt trúng dây 6 (×) → báo dây thừa, không báo nốt lạ', () => {
    const v = judgeChord(spectrum([40, ...C]), 'C', 'guitar')!;
    expect(v.issues).toEqual([{ kind: 'extra', string: 6, midi: 40 }]);
  });

  it('không có tiếng → quiet', () => {
    expect(judgeChord(spectrum([]), 'G', 'guitar')?.kind).toBe('quiet');
  });

  it('ukulele C (0003): Sol4 Đô4 Mi4 Đô5 đúng → ok', () => {
    expect(judgeChord(spectrum([67, 60, 64, 72]), 'C', 'ukulele')?.kind).toBe('ok');
  });

  it('hợp âm không có thế → null', () => {
    expect(judgeChord(spectrum(C), 'Xyz', 'guitar')).toBeNull();
  });
});

describe('tách lần quạt', () => {
  it('mỗi lần quạt trả một phổ, tiếng ngân không tính thêm', () => {
    const d = new StrumDetector();
    const s = spectrum(C);
    let n = 0;
    let t = 0;
    const run = (frames: number, rms: number) => { for (let i = 0; i < frames; i++) { if (d.feed(t, rms, s.mag, s.binHz)) n++; t += 1 / 60; } };
    run(10, 0.002);
    run(120, 0.1);   // quạt, ngân 2 giây
    run(20, 0.004);  // tắt
    run(60, 0.1);    // quạt lần hai
    expect(n).toBe(2);
  });
});
