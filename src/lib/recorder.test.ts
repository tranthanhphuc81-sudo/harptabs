import { describe, expect, it } from 'vitest';
import { harpLayout, harpName, isTabToken, parseToken } from './harp';
import { rekeyBody } from './converter';
import { parseTab } from './tabText';
import { SAMPLE_SONGS } from '../data/samples';

describe('sáo dọc alto (Fa) và soprano (Đô)', () => {
  it('alto: F4–G6 đủ 27 nốt, mỗi nốt có thế bấm 8 lỗ', () => {
    const l = harpLayout('F', 'recorderAlto');
    expect(l).toHaveLength(27);
    expect(l[0]).toMatchObject({ token: 'F4', midi: 65, fingers: 'xxxxxxxx' });
    expect(l[26].token).toBe('G6');
    expect(l.every((n) => /^[xoh]{8}$/.test(n.fingers!))).toBe(true);
    expect(harpName('F', 'recorderAlto')).toBe('Sáo alto (Fa)');
  });
  it('soprano ghi thấp hơn tiếng thật một quãng tám, cùng thế bấm với alto', () => {
    const s = harpLayout('C', 'recorderSoprano');
    expect(s[0]).toMatchObject({ token: 'C4', midi: 72 });
    expect(s.map((n) => n.fingers)).toEqual(harpLayout('F', 'recorderAlto').map((n) => n.fingers));
  });
  it('đọc tên nốt, cả cách viết thăng / giáng tương đương', () => {
    expect(parseToken('Bb4', 'F', 'recorderAlto')?.midi).toBe(70);
    expect(parseToken('A#4', 'F', 'recorderAlto')?.midi).toBe(70);
    expect(parseToken('E4', 'F', 'recorderAlto')).toBeNull(); // dưới tầm sáo alto
    expect(isTabToken('Hap-py', 'recorderAlto')).toBe(false);
    const p = parseTab('F4 G4:2 r A4\nMột hai ba\n', 'F', 'recorderAlto');
    expect(p.issues).toEqual([]);
    expect(p.sections[0].lines[0]).toMatchObject({ kind: 'tab' });
  });
  it('bài mẫu harmonica chuyển được sang sáo alto, không thiếu nốt', () => {
    for (const s of SAMPLE_SONGS.slice(0, 15)) {
      const r = rekeyBody(s.body, s.harpKey, 'F', 'any', s.harpType ?? 'diatonic', 'recorderAlto');
      expect(r.fit.stats.unplayable, s.title).toBe(0);
    }
  });
});
