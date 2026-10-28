import { afterEach, describe, expect, it } from 'vitest';
import { harpLayout, harpName, isFingered, isFixedKey, isTranh, midiToName, parseToken, setTranhTuning } from './harp';
import { bestTabs } from './converter';
import { parseTab } from './tabText';
import { tranhSamples } from '../data/tranhSamples';
import { TRANH_LESSONS } from '../data/tranhLessons';
import { SAMPLE_SONGS } from '../data/samples';

afterEach(() => setTranhTuning('bac'));

describe('đàn tranh', () => {
  it('dây Bắc tông Đô: dây 1 = Sol3, Sol La Đô Rê Mi lặp lại; 17 dây tới La6', () => {
    const open = (t: 'tranh16' | 'tranh17', s: number) => midiToName(parseToken(String(s), 'C', t)!.midi);
    expect([1, 2, 3, 4, 5, 6].map((s) => open('tranh17', s))).toEqual(['G3', 'A3', 'C4', 'D4', 'E4', 'G4']);
    expect(open('tranh16', 16)).toBe('G6');
    expect(open('tranh17', 17)).toBe('A6');
    expect(isTranh('tranh16') && isFingered('tranh17') && !isFixedKey('tranh17')).toBe(true);
    expect(harpName('C', 'tranh17')).toBe('Đàn tranh 17 dây (C, dây Bắc)');
  });

  it('đàn 19 / 21 / 22 dây thêm dây trầm, dây cao giữ như đàn 17 dây', () => {
    const lo = (t: 'tranh19' | 'tranh21' | 'tranh22') => midiToName(parseToken('1', 'C', t)!.midi);
    expect([lo('tranh19'), lo('tranh21'), lo('tranh22')]).toEqual(['D3', 'A2', 'G2']);
    expect(midiToName(parseToken('22', 'C', 'tranh22')!.midi)).toBe('A6');
    expect(midiToName(parseToken('19', 'C', 'tranh19')!.midi)).toBe('A6');
    expect(parseToken('20', 'C', 'tranh19')).toBeNull();
    expect(harpLayout('C', 'tranh21')).toHaveLength(21 * 3);
  });

  it('dây Đảo: Sol La Đô Rê Fa', () => {
    setTranhTuning('dao');
    expect(midiToName(parseToken('5', 'C', 'tranh17')!.midi)).toBe('F4');
  });

  it('nhấn: ^ nửa cung, ^^ một cung; tông Rê dời cả bộ dây', () => {
    expect(midiToName(parseToken('5^', 'C', 'tranh17')!.midi)).toBe('F4');
    expect(midiToName(parseToken('7^^', 'C', 'tranh17')!.midi)).toBe('B4');
    expect(midiToName(parseToken('1', 'D', 'tranh17')!.midi)).toBe('A3');
    expect(parseToken('18', 'C', 'tranh17')).toBeNull();
    expect(parseToken('5^^^', 'C', 'tranh17')).toBeNull();
  });

  it('bộ chọn ưu tiên dây buông: thang Đô trưởng chỉ nhấn ở Fa và Si', () => {
    const fit = bestTabs([60, 62, 64, 65, 67, 69, 71, 72], 'C', 0, 'tranh17');
    expect(fit.tokens).toEqual(['3', '4', '5', '5^', '6', '7', '7^^', '8']);
    expect(harpLayout('C', 'tranh16')).toHaveLength(16 * 3);
  });

  it('bài mẫu đủ nốt, giữ hợp âm; tab bài học hợp lệ', () => {
    const base = SAMPLE_SONGS.filter((s) => (s.harpType ?? 'diatonic') === 'diatonic');
    const out = tranhSamples(base);
    expect(out.length).toBeGreaterThan(30);
    for (const s of out) expect(parseTab(s.body, s.harpKey, s.harpType).issues.filter((i) => i.level === 'error'), s.sampleId).toEqual([]);
    expect(out.find((s) => s.sampleId === 'twinkle-tranh')!.chords).toBeTruthy();
    for (const l of TRANH_LESSONS) for (const b of l.blocks) {
      if (b.t !== 'tab') continue;
      expect(parseTab(b.body, b.harpKey ?? 'C', b.harpType).issues, `${l.id}: ${b.caption}`).toEqual([]);
    }
  });
});
