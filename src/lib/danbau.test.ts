import { describe, expect, it } from 'vitest';
import { harpName, isDanBau, isFingered, isFixedKey, midiToName, parseToken } from './harp';
import { bestTabs } from './converter';
import { parseTab } from './tabText';
import { tranhSamples } from '../data/tranhSamples';
import { TRANH_LESSONS } from '../data/tranhLessons';
import { SAMPLE_SONGS } from '../data/samples';

const name = (t: string, key: 'C' | 'D' = 'C') => midiToName(parseToken(t, key, 'danbau')!.midi);

describe('đàn bầu', () => {
  it('điểm bồi dây Đô: ½ Đô4, ⅓ Sol4, ¼ Đô5, ⅕ Mi5, ⅙ Sol5, ⅐ Sib5, ⅛ Đô6; dây buông Đô3', () => {
    expect(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'].map((t) => name(t))).toEqual(['C3', 'C4', 'G4', 'C5', 'E5', 'G5', 'Bb5', 'C6']);
    expect(isDanBau('danbau') && isFingered('danbau') && !isFixedKey('danbau')).toBe(true);
    expect(harpName('C', 'danbau')).toBe('Đàn bầu (dây Đô)');
  });

  it('nắn cần lên / xuống; dây Rê dời cả đàn; ký hiệu sai thì không nhận', () => {
    expect(name('b4+2')).toBe('D5');
    expect(name('b8-1')).toBe('B5');
    expect(name('b2', 'D')).toBe('D4');
    expect(parseToken('b4+4', 'C', 'danbau')).toBeNull();
    expect(parseToken('b4-3', 'C', 'danbau')).toBeNull();
    expect(parseToken('b9', 'C', 'danbau')).toBeNull();
  });

  it('bộ chọn ưu tiên điểm bồi không nắn: Đô Mi Sol Đô ra b4 b5 b6 b8', () => {
    expect(bestTabs([72, 76, 79, 84], 'C', 0, 'danbau').tokens).toEqual(['b4', 'b5', 'b6', 'b8']);
    // Rê5 phải nắn: từ Đô5 lên một cung
    expect(bestTabs([74], 'C', 0, 'danbau').tokens).toEqual(['b4+2']);
  });

  it('bài mẫu đàn bầu đủ nốt; tab bài học hợp lệ', () => {
    const base = SAMPLE_SONGS.filter((s) => (s.harpType ?? 'diatonic') === 'diatonic');
    const bau = tranhSamples(base).filter((s) => s.harpType === 'danbau');
    expect(bau.length).toBeGreaterThanOrEqual(6);
    for (const s of bau) expect(parseTab(s.body, s.harpKey, s.harpType).issues.filter((i) => i.level === 'error'), s.sampleId).toEqual([]);
    for (const l of TRANH_LESSONS.filter((x) => x.id.startsWith('danbau'))) for (const b of l.blocks) {
      if (b.t !== 'tab') continue;
      expect(parseTab(b.body, b.harpKey ?? 'C', b.harpType).issues, `${l.id}: ${b.caption}`).toEqual([]);
    }
  });
});
