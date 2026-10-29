import { describe, expect, it } from 'vitest';
import { leftHandChord } from './keyboardChord';

describe('hợp âm tay trái trên bàn phím', () => {
  it('ba hợp âm cơ bản quanh Đô3, đổi tay ít: C = Đô Mi Sol, F = Đô Fa La, G = Si Rê Sol', () => {
    expect(leftHandChord('C')).toEqual({ notes: [48, 52, 55], fingers: [5, 3, 1] });
    expect(leftHandChord('F')).toEqual({ notes: [48, 53, 57], fingers: [5, 2, 1] });
    expect(leftHandChord('G')).toEqual({ notes: [47, 50, 55], fingers: [5, 3, 1] });
  });

  it('hợp âm thứ, hợp âm 7, tên lạ', () => {
    expect(leftHandChord('Am')!.notes.map((m) => m % 12).sort((a, b) => a - b)).toEqual([0, 4, 9]);
    const g7 = leftHandChord('G7')!;
    expect(g7.notes).toHaveLength(4);
    expect(g7.fingers).toEqual([5, 3, 2, 1]);
    expect(leftHandChord('xyz')).toBeNull();
  });

  it('mọi thế bấm nằm trong vùng tay trái (Sol2 – Sol4) và gọn trong một quãng tám', () => {
    for (const n of ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'F#m', 'Dm', 'Em', 'Bm', 'C7', 'D7', 'Cmaj7', 'Ebm']) {
      const c = leftHandChord(n)!;
      expect(c.notes[0]).toBeGreaterThanOrEqual(43);
      expect(c.notes[c.notes.length - 1]).toBeLessThanOrEqual(67);
      expect(c.notes[c.notes.length - 1] - c.notes[0]).toBeLessThan(12);
    }
  });
});
