import { describe, expect, it } from 'vitest';
import { harpLayout, isFixedKey, isFingered, midiToName, parseToken } from './harp';
import { fitToHarp } from './converter';
import { OCARINA_FINGERINGS } from '../data/ocarinaFingerings';
import { RECORDER_LESSONS } from '../data/recorderLessons';
import { parseTab } from './tabText';

describe('ocarina 12 lỗ alto Đô', () => {
  it('tầm La4 – Fa6, mỗi thế bấm 12 lỗ, không trùng nhau', () => {
    const l = harpLayout('C', 'ocarina12');
    expect(midiToName(l[0].midi)).toBe('A4');
    expect(midiToName(l[l.length - 1].midi)).toBe('F6');
    expect(OCARINA_FINGERINGS.every((f) => /^[xoh]{12}$/.test(f.fingers))).toBe(true);
    expect(new Set(OCARINA_FINGERINGS.map((f) => f.fingers)).size).toBe(OCARINA_FINGERINGS.length);
    expect(isFingered('ocarina12') && isFixedKey('ocarina12')).toBe(true);
  });

  it('nốt tự nhiên: nhấc dần ngón tay phải rồi tay trái; La4 / Si4 dùng lỗ phụ', () => {
    const f = (name: string) => parseToken(name, 'C', 'ocarina12')!.fingers;
    expect(f('C5')).toBe('xxxxxxxxxxoo');
    expect(f('G5')).toBe('xxxxxxooooo' + 'o');
    expect(f('A4')).toBe('xxxxxxxxxxxx');
    expect(f('B4')).toBe('xxxxxxxxxxox');
    expect(f('F6')).toBe('oooooooooooo');
    // càng lên cao càng mở thêm lỗ (đếm số lỗ bịt giảm dần ở các nốt tự nhiên)
    const covered = (n: string) => [...f(n)!].filter((c) => c === 'x').length;
    const naturals = ['C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6'];
    naturals.slice(1).forEach((n, i) => expect(covered(n), n).toBeLessThan(covered(naturals[i])));
  });

  it('nốt không có thế bấm thì không chơi được; giai điệu Đô trưởng vừa tầm', () => {
    expect(parseToken('Bb4', 'C', 'ocarina12')).toBeNull();
    expect(parseToken('G4', 'C', 'ocarina12')).toBeNull();
    const fit = fitToHarp([60, 62, 64, 65, 67, 69, 71, 72], 'C', { transpose: 'octave', type: 'ocarina12' });
    expect(fit.stats.unplayable).toBe(0);
  });

  it('bài học ocarina: tab hợp lệ', () => {
    const l = RECORDER_LESSONS.find((x) => x.id === 'ocarina-lam-quen')!;
    for (const b of l.blocks) if (b.t === 'tab') expect(parseTab(b.body, b.harpKey ?? 'C', b.harpType).issues).toEqual([]);
  });
});
