import { describe, expect, it } from 'vitest';
import { yin } from './pitch';

function tone(hz: number, sr = 48000, n = 2048, harmonics = 6) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) for (let h = 1; h <= harmonics; h++) b[i] += Math.sin((2 * Math.PI * hz * h * i) / sr) / h;
  return b;
}

describe('YIN', () => {
  for (const hz of [196, 261.63, 523.25, 1046.5, 2093]) {
    it(`nhận đúng ${hz} Hz`, () => {
      const r = yin(tone(hz), 48000)!;
      expect(r).not.toBeNull();
      const cents = 1200 * Math.log2(r.hz / hz);
      expect(Math.abs(cents)).toBeLessThan(8);
    });
  }
  it('im lặng thì không trả kết quả', () => {
    const z = new Float32Array(2048);
    for (let i = 0; i < z.length; i++) z[i] = (Math.random() - 0.5) * 0.001;
    const r = yin(z, 48000);
    expect(r === null || r.clarity < 0.8).toBe(true);
  });
});

describe('yin cho giọng hát (75–1100 Hz)', () => {
  const sine = (hz: number, sr = 48000, n = 2048) => Float32Array.from({ length: n }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / sr) + 0.15 * Math.sin((4 * Math.PI * hz * i) / sr));
  it('bắt được giọng nam trầm 98 Hz (tầm mặc định của kèn thì không) và nốt La 440 Hz', () => {
    expect(yin(sine(98), 48000)).toBeNull();
    expect(yin(sine(98), 48000, 75, 1100)!.hz).toBeCloseTo(98, 0);
    expect(yin(sine(440), 48000, 75, 1100)!.hz).toBeCloseTo(440, 0);
  });
});
