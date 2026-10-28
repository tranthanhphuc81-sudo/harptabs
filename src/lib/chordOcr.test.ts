import { describe, expect, it } from 'vitest';
import { assignChords, chordOverrides, chordWords } from './chordOcr';
import type { OmrNote } from './omr';

const note = (id: string, x: number, beats = 1, chord?: string): OmrNote =>
  ({ id, page: 0, staff: 0, x, y: 50, step: 2, accidental: null, beats, hollow: false, dot: false, rest: false, ...(chord ? { chord } : {}) });
const w = (text: string, x0: number) => ({ text, x0, x1: x0 + 20, confidence: 90 });

describe('tên hợp âm in trên khuông', () => {
  it('nhận tên hợp âm, chuẩn hoá về hợp âm chơi được', () => {
    expect(chordWords([w('C', 10), w('Am', 80), w('G7', 150), w('F#m', 220), w('Dsus4', 300)]).map((c) => c.chord))
      .toEqual(['C', 'Am', 'G7', 'F#m', 'D']);
  });
  it('dải chữ phần lớn là lời bài hát thì bỏ (dù có chữ "Em")', () => {
    expect(chordWords([w('Em', 10), w('ơi', 40), w('Hà', 70), w('Nội', 100), w('phố', 130)])).toEqual([]);
  });
  it('gắn hợp âm vào nốt ngay dưới', () => {
    const notes = [note('a', 20), note('b', 60), note('c', 100), note('d', 140)];
    const m = assignChords(notes, 0, [{ x0: 12, x1: 30, chord: 'C' }, { x0: 92, x1: 110, chord: 'G' }], 13.5);
    expect([...m.entries()]).toEqual([['a', 'C'], ['c', 'G']]);
  });
  it('mỗi hợp âm giữ tới hợp âm kế tiếp (khúc nửa ô nhịp 4/4)', () => {
    // 3 ô nhịp 4/4 nốt đen; C ở phách 0, G ở phách 6 (giữa ô 2), F ở phách 8
    const order = Array.from({ length: 12 }, (_, i) => ({ n: note(`n${i}`, i * 10, 1, ({ 0: 'C', 6: 'G', 8: 'F' } as Record<number, string>)[i]) }));
    expect(chordOverrides(order, 4, 0)).toEqual({ 0: 'C', 2: 'C', 4: 'C', 6: 'G', 8: 'F', 10: 'F' });
    // nhịp lấy đà 1 phách: khúc bắt đầu ở 0, 1, 3, 5…
    expect(chordOverrides(order, 4, 1)).toMatchObject({ 0: 'C', 1: 'C', 5: 'G' });
    expect(chordOverrides([{ n: note('x', 0) }], 4, 0)).toEqual({});
  });
});
