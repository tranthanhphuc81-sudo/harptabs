import { describe, expect, it } from 'vitest';
import { harpLayout, harpName, holeCount, isFixedKey, isFingered, isKeyboard, isOrgan, keyboardRange } from './harp';
import { organSamples } from '../data/organSamples';
import { parseTab } from './tabText';

describe('đàn organ / piano', () => {
  it('bảng phím: organ 61 phím Đô2–Đô7, piano 88 phím La0–Đô8; tên nốt làm tab; hình bàn phím rộng', () => {
    const o = harpLayout('C', 'organ61');
    expect(o).toHaveLength(61);
    expect([o[0].midi, o[60].midi]).toEqual([36, 96]);
    expect(o.find((n) => n.midi === 60)).toMatchObject({ token: 'C4', fingers: 'o60', fingerCost: 0 });
    expect(harpLayout('C', 'piano88')).toHaveLength(88);
    expect(keyboardRange('piano88')).toEqual([21, 108]);
    expect(holeCount('organ61')).toBe(61);
    expect(harpName('C', 'organ61')).toBe('Đàn organ 61 phím');
  });

  it('thuộc họ bàn phím: tông cố định, có hình dưới nốt; pianica cũng là bàn phím nhưng không phải organ', () => {
    expect([isOrgan('organ61'), isKeyboard('organ61'), isFixedKey('organ61'), isFingered('piano88')]).toEqual([true, true, true, true]);
    expect([isOrgan('pianica32'), isKeyboard('pianica32')]).toEqual([false, true]);
  });

  it('bài mẫu ghi lại cho organ: đủ bài, mọi nốt chơi được, nằm vùng tay phải', async () => {
    const { SAMPLE_SONGS } = await import('../data/samples');
    const out = organSamples(SAMPLE_SONGS.filter((s) => !s.harpType || s.harpType === 'diatonic'));
    expect(out.length).toBeGreaterThan(20);
    for (const s of out) {
      const p = parseTab(s.body, s.harpKey, 'organ61');
      expect({ title: s.title, issues: p.issues }).toEqual({ title: s.title, issues: [] });
      const notes = p.sections.flatMap((x) => x.lines.flatMap((l) => (l.kind === 'tab' ? l.events : []))).filter((e) => e.midi !== null);
      expect(notes.every((e) => e.midi! >= 36 && e.midi! <= 96)).toBe(true);
    }
  });
});
