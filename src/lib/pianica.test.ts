import { describe, expect, it } from 'vitest';
import { harpLayout, harpName, isFingered, isFixedKey, isPianica, parseToken } from './harp';
import { fitToHarp } from './converter';
import { parseTab } from './tabText';
import { pianicaSamples } from '../data/pianicaSamples';
import { PIANICA_LESSONS } from '../data/pianicaLessons';
import { SAMPLE_SONGS } from '../data/samples';

describe('kèn pianica', () => {
  it('32 phím Fa3–Đô6, 37 phím Fa3–Fa6, mỗi phím một nốt', () => {
    const p32 = harpLayout('C', 'pianica32');
    expect(p32).toHaveLength(32);
    expect([p32[0].token, p32[31].token]).toEqual(['F3', 'C6']);
    const p37 = harpLayout('C', 'pianica37');
    expect([p37[0].token, p37[36].token]).toEqual(['F3', 'F6']);
    expect(new Set(p32.map((n) => n.midi)).size).toBe(32);
    expect(harpName('C', 'pianica32')).toBe('Kèn pianica 32 phím');
    expect(isPianica('pianica37') && isFingered('pianica32') && isFixedKey('pianica32')).toBe(true);
  });

  it('đọc tên nốt, Bb4 và A#4 là một phím, ngoài tầm thì không có', () => {
    expect(parseToken('C4', 'C', 'pianica32')!.midi).toBe(60);
    expect(parseToken('A#4', 'C', 'pianica32')!.token).toBe('Bb4');
    expect(parseToken('E3', 'C', 'pianica32')).toBeNull();
    expect(parseToken('E6', 'C', 'pianica37')!.midi).toBe(88);
  });

  it('giai điệu đặt quanh Đô giữa, giữ đúng giọng', () => {
    const fit = fitToHarp([72, 74, 76, 77, 79], 'C', { transpose: 'octave', type: 'pianica32' });
    expect(fit.stats.unplayable).toBe(0);
    // Đô5… dời xuống một quãng tám về quanh Đô giữa (thế tay dễ nhất), vẫn đúng giọng
    expect(fit.shift).toBe(-12);
  });

  it('bài mẫu chuyển đủ nốt, giữ hợp âm; tab bài học hợp lệ', () => {
    const base = SAMPLE_SONGS.filter((s) => (s.harpType ?? 'diatonic') === 'diatonic');
    const out = pianicaSamples(base);
    expect(out.length).toBeGreaterThan(30);
    for (const s of out) expect(parseTab(s.body, s.harpKey, s.harpType).issues.filter((i) => i.level === 'error'), s.sampleId).toEqual([]);
    expect(out.find((s) => s.sampleId === 'twinkle-pianica')!.chords).toBeTruthy();
    for (const l of PIANICA_LESSONS) for (const b of l.blocks) {
      if (b.t !== 'tab') continue;
      expect(parseTab(b.body, b.harpKey ?? 'C', b.harpType).issues, `${l.id}: ${b.caption}`).toEqual([]);
    }
  });
});
