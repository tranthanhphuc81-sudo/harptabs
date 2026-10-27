import { describe, expect, it } from 'vitest';
import { harpLayout, isFixedKey, isFingered, isTabToken, midiToName, parseToken } from './harp';
import { bestTabs, fitToHarp, rekeyBody } from './converter';
import { parseTab } from './tabText';
import { chordPcs, chordShape, ChordInstrument, shapeMidis } from '../data/chordShapes';
import { guitarSamples } from '../data/guitarSamples';
import { SAMPLE_SONGS } from '../data/samples';

const DIATONIC_SAMPLES = SAMPLE_SONGS.filter((s) => (s.harpType ?? 'diatonic') === 'diatonic');
import { GUITAR_LESSONS } from '../data/guitarLessons';

describe('guitar / ukulele: bảng nốt', () => {
  it('dây buông guitar E2 A2 D3 G3 B3 E4, ukulele G4 C4 E4 A4', () => {
    const open = (t: 'guitar6' | 'ukulele4', s: number) => midiToName(parseToken(`${s}.0`, 'C', t)!.midi);
    expect([6, 5, 4, 3, 2, 1].map((s) => open('guitar6', s))).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect([4, 3, 2, 1].map((s) => open('ukulele4', s))).toEqual(['G4', 'C4', 'E4', 'A4']);
  });

  it('ký hiệu dây.phím', () => {
    expect(isTabToken('2.3', 'guitar6')).toBe(true);
    expect(isTabToken('7.1', 'guitar6')).toBe(false);
    expect(parseToken('5.3', 'C', 'guitar6')!.midi).toBe(48); // Đô3
    expect(parseToken('5.0', 'C', 'ukulele4')).toBeNull(); // ukulele không có dây 5
    expect(parseToken('1.13', 'C', 'ukulele4')).toBeNull(); // quá 12 phím
    expect(isFingered('guitar6') && isFixedKey('ukulele4')).toBe(true);
  });

  it('tầm đàn: guitar E2–G5, ukulele C4–A5', () => {
    const range = (t: 'guitar6' | 'ukulele4') => { const m = harpLayout('C', t).map((n) => n.midi); return [Math.min(...m), Math.max(...m)]; };
    expect(range('guitar6')).toEqual([40, 79]);
    expect(range('ukulele4')).toEqual([60, 81]);
  });

  it('tông không đổi bảng nốt (đàn không có tông)', () => {
    expect(harpLayout('G', 'guitar6')).toEqual(harpLayout('C', 'guitar6'));
  });

  it('bộ chọn vị trí ưu tiên thế đầu cần: thang Đô trưởng Đô3–Đô4', () => {
    const fit = bestTabs([48, 50, 52, 53, 55, 57, 59, 60], 'C', 0, 'guitar6');
    expect(fit.tokens).toEqual(['5.3', '4.0', '4.2', '4.3', '3.0', '3.2', '2.0', '2.1']);
  });

  it('giai điệu Đô4–Đô5 chuyển sang guitar không thiếu nốt', () => {
    const fit = fitToHarp([60, 62, 64, 65, 67, 69, 71, 72], 'C', { transpose: 'octave', type: 'guitar6' });
    expect(fit.stats.unplayable).toBe(0);
    expect(fit.tokens.every((t) => Number(t!.split('.')[1]) <= 7)).toBe(true);
  });
});

describe('thế hợp âm', () => {
  const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'F#', 'C#', 'Ab'];
  const SUFFIXES = ['', 'm', '7', 'm7', 'maj7', 'm7b5', 'dim7'];
  for (const inst of ['guitar', 'ukulele'] as ChordInstrument[]) {
    it(`${inst}: mọi hợp âm có thế và chỉ gồm nốt của hợp âm`, () => {
      for (const r of NAMES) for (const s of SUFFIXES) {
        const name = r + s;
        const shape = chordShape(name, inst);
        expect(shape, name).not.toBeNull();
        expect(shape!.length).toBe(inst === 'guitar' ? 6 : 4);
        const pcs = chordPcs(name)!;
        const got = new Set(shapeMidis(shape!, inst).map((m) => m % 12));
        for (const p of got) expect(pcs, `${inst} ${name}: nốt lạ`).toContain(p);
        // đủ nốt gốc, nốt 3 (và nốt 7 nếu có)
        expect(got.has(pcs[0]), `${inst} ${name}: thiếu nốt gốc`).toBe(true);
        expect(got.has(pcs[1]), `${inst} ${name}: thiếu nốt 3`).toBe(true);
        if (pcs.length > 3) expect(got.has(pcs[3]), `${inst} ${name}: thiếu nốt 7`).toBe(true);
      }
    });
  }

  it('guitar: nốt trầm nhất là nốt gốc', () => {
    for (const name of ['C', 'G', 'Am', 'F', 'Dm', 'E7', 'Bm', 'F#m', 'Bbmaj7', 'C#m7']) {
      const m = shapeMidis(chordShape(name, 'guitar')!, 'guitar');
      expect(Math.min(...m) % 12, name).toBe(chordPcs(name)![0]);
    }
  });

  it('thế quen: C x32010, G 320003, Am x02210; ukulele C 0003, F 2010', () => {
    expect(chordShape('C', 'guitar')).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(chordShape('G', 'guitar')).toEqual([3, 2, 0, 0, 0, 3]);
    expect(chordShape('Am', 'guitar')).toEqual([-1, 0, 2, 2, 1, 0]);
    expect(chordShape('C', 'ukulele')).toEqual([0, 0, 0, 3]);
    expect(chordShape('F', 'ukulele')).toEqual([2, 0, 1, 0]);
  });

  it('hợp âm chặn: Bb, C#m, F#', () => {
    expect(chordShape('F#', 'guitar')).toEqual([2, 4, 4, 3, 2, 2]);
    expect(chordShape('C#m', 'guitar')).toEqual([-1, 4, 6, 6, 5, 4]);
  });
});

describe('bài mẫu và bài học guitar', () => {
  it('bài mẫu harmonica chuyển sang guitar đủ nốt, có cả bài ukulele', () => {
    const out = guitarSamples(DIATONIC_SAMPLES);
    expect(out.filter((s) => s.harpType === 'guitar6').length).toBeGreaterThan(20);
    expect(out.filter((s) => s.harpType === 'ukulele4').length).toBeGreaterThanOrEqual(5);
    for (const s of out) {
      const p = parseTab(s.body, s.harpKey, s.harpType);
      expect(p.issues.filter((i) => i.level === 'error'), s.sampleId).toEqual([]);
    }
  });

  it('chuyển lại bài guitar sang ukulele được', () => {
    const g = guitarSamples(DIATONIC_SAMPLES).find((s) => s.harpType === 'guitar6' && s.sampleId !== 'guitar-scale')!;
    const r = rekeyBody(g.body, 'C', 'C', 'octave', 'guitar6', 'ukulele4');
    expect(r.fit.stats.unplayable).toBeLessThanOrEqual(2);
  });

  it('tab trong bài học hợp lệ', () => {
    for (const l of GUITAR_LESSONS) for (const b of l.blocks) {
      if (b.t !== 'tab') continue;
      const p = parseTab(b.body, b.harpKey ?? 'C', b.harpType);
      expect(p.issues, `${l.id}: ${b.caption}`).toEqual([]);
    }
  });
});
