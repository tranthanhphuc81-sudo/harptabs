import { describe, expect, it } from 'vitest';
import { harpLayout, parseToken, isTabToken } from './harp';
import { parseTab } from './tabText';
import { bestTabs, rekeyBody } from './converter';
import { guessHarpType, importTabText, normalizeToken } from './tabImport';

describe('kèn chromatic', () => {
  it('12 lỗ: Đô4 đến Rê7, mỗi 4 lỗ một quãng tám', () => {
    expect(parseToken('1', 'C', 'chromatic')!.midi).toBe(60);
    expect(parseToken('-1', 'C', 'chromatic')!.midi).toBe(62);
    expect(parseToken('4', 'C', 'chromatic')!.midi).toBe(72);
    expect(parseToken('5', 'C', 'chromatic')!.midi).toBe(72);
    expect(parseToken('-4', 'C', 'chromatic')!.midi).toBe(71);
    expect(parseToken('-12', 'C', 'chromatic')!.midi).toBe(95);
    expect(parseToken('12', 'C', 'chromatic')!.midi).toBe(96);
    expect(parseToken('13', 'C', 'chromatic')).toBeNull();
    expect(harpLayout('C', 'chromatic').length).toBe(48);
  });

  it('nút gạt nâng nửa cung; nhận cả <4', () => {
    expect(parseToken('-5<', 'C', 'chromatic')!.midi).toBe(75);
    expect(parseToken('<-3', 'C', 'chromatic')!.token).toBe('-3<');
    expect(parseToken('<4', 'C', 'chromatic')!.token).toBe('4<');
    expect(parseToken("-3'", 'C', 'chromatic')).toBeNull();
    expect(isTabToken('4<', 'diatonic')).toBe(false);
  });

  it('16 lỗ thêm quãng tám trầm', () => {
    expect(parseToken('1', 'C', 'chromatic16')!.midi).toBe(48);
    expect(parseToken('5', 'C', 'chromatic16')!.midi).toBe(60);
    expect(parseToken('-16', 'C', 'chromatic16')!.midi).toBe(95);
  });

  it('chọn lỗ: chơi đủ 12 nốt, ưu tiên nốt không gạt', () => {
    const fit = bestTabs([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], 'C', 0, 'chromatic');
    expect(fit.tokens).toEqual(['1', '1<', '-1', '-1<', '2', '-2', '-2<', '3', '3<', '-3', '-3<', '-4', '4']);
    expect(fit.stats.unplayable).toBe(0);
    expect(fit.stats.slides).toBe(5);
  });

  it('đổi bài diatonic có bend sang chromatic, giữ giọng', () => {
    const { body, fit } = rekeyBody("-2 -3' 4 -4' -4", 'C', 'C', 'octave', 'diatonic', 'chromatic');
    expect(fit.stats.unplayable).toBe(0);
    expect(fit.shift % 12).toBe(0);
    const p = parseTab(body, 'C', 'chromatic');
    expect(p.issues).toEqual([]);
  });

  it('dán tab chromatic từ mạng', () => {
    expect(normalizeToken('<4', undefined, 'chromatic')).toBe('4<');
    expect(normalizeToken('-5*', undefined, 'chromatic')).toBe('-5<');
    expect(normalizeToken('+11', undefined, 'chromatic')).toBe('11');
    expect(guessHarpType('4 -4 5 -5 <6 -6')).toBe('chromatic');
    expect(guessHarpType('4 -4 5 -5 6 -6')).toBe('diatonic');
    expect(guessHarpType('9 -9 10 11 -12')).toBe('chromatic');
    const r = importTabText('Für Elise\n6 -5< 6 -5< 6 -4 -5 5 -3');
    expect(r.harpType).toBe('chromatic');
    expect(r.body).toBe('6 -5< 6 -5< 6 -4 -5 5 -3');
  });
});

describe('kèn Trochilus màu vàng (solo tuning, 10 lỗ, nút gạt)', () => {
  it('nốt như 10 lỗ đầu của chromatic 12 lỗ: Đô4 đến Fa6, nút gạt nâng nửa cung', () => {
    const blow = Array.from({ length: 10 }, (_, i) => parseToken(String(i + 1), 'C', 'trochilusSolo')!.midi);
    const draw = Array.from({ length: 10 }, (_, i) => parseToken(String(-(i + 1)), 'C', 'trochilusSolo')!.midi);
    // C4 E4 G4 C5 | C5 E5 G5 C6 | C6 E6
    expect(blow).toEqual([60, 64, 67, 72, 72, 76, 79, 84, 84, 88]);
    // D4 F4 A4 B4 | D5 F5 A5 B5 | D6 F6
    expect(draw).toEqual([62, 65, 69, 71, 74, 77, 81, 83, 86, 89]);
    expect(parseToken('1<', 'C', 'trochilusSolo')!.midi).toBe(61);
    expect(parseToken('-10<', 'C', 'trochilusSolo')!.midi).toBe(90);
    // riêng lỗ 10 thổi gạt: Sol6 (theo sơ đồ của hãng), các lỗ khác gạt nâng nửa cung
    expect(parseToken('10<', 'C', 'trochilusSolo')!.midi).toBe(91);
    expect(parseToken('9<', 'C', 'trochilusSolo')!.midi).toBe(85);
    expect(parseToken('10<', 'C', 'chromatic')!.midi).toBe(89);
    expect(parseToken('11', 'C', 'trochilusSolo')).toBeNull();
    expect(harpLayout('C', 'trochilusSolo')).toHaveLength(40);
    // kèn tông khác dịch theo như chromatic 12 lỗ cùng tông (kèn G: lỗ 1 = Sol3)
    for (const k of ['G', 'A', 'Bb', 'D'] as const) {
      expect(parseToken('1', k, 'trochilusSolo')!.midi).toBe(parseToken('1', k, 'chromatic')!.midi);
    }
    expect(parseToken('1', 'G', 'trochilusSolo')!.midi).toBe(55);
  });

  it('chuyển bài sang Trochilus: đủ 12 nốt nửa cung trong tầm, không cần bend', () => {
    const r = rekeyBody('4 -4 5 -5 6 -6 7 -7 8\nDo Re Mi Fa Sol La Si Do Re\n', 'C', 'C', 'octave', 'diatonic', 'trochilusSolo');
    expect(r.fit.stats.unplayable).toBe(0);
    expect(r.fit.stats.bends).toBe(0);
    const chrom = bestTabs([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72], 'C', 0, 'trochilusSolo');
    expect(chrom.stats.unplayable).toBe(0);
  });
});
