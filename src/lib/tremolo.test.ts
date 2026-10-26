import { describe, expect, it } from 'vitest';
import { harpLayout, midiToName, parseToken } from './harp';
import { bestTabs, fitToHarp, rekeyBody } from './converter';
import { flatten, parseTab } from './tabText';
import { guessHarpType, importTabText } from './tabImport';
import { SAMPLE_SONGS } from '../data/samples';

const names = (type: 'tremolo24' | 'tremolo21', dir: 'blow' | 'draw') =>
  harpLayout('C', type).filter((n) => n.dir === dir).map((n) => midiToName(n.midi));

describe('kèn tremolo châu Á', () => {
  it('24 lỗ kèn C: lỗ lẻ thổi G3…E7, lỗ chẵn hút D4…B6', () => {
    expect(names('tremolo24', 'blow')).toEqual(['G3', 'C4', 'E4', 'G4', 'C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7', 'E7']);
    expect(names('tremolo24', 'draw')).toEqual(['D4', 'F4', 'A4', 'B4', 'D5', 'F5', 'A5', 'B5', 'D6', 'F6', 'A6', 'B6']);
    const l = harpLayout('C', 'tremolo24');
    expect(l.every((n) => (n.hole % 2 === 1) === (n.dir === 'blow'))).toBe(true);
    expect(new Set(l.map((n) => n.midi)).size).toBe(24); // mỗi nốt chỉ có một chỗ
  });

  it('21 lỗ là 21 lỗ đầu của bản 24', () => {
    expect(harpLayout('C', 'tremolo21').map((n) => n.token)).toEqual(harpLayout('C', 'tremolo24').slice(0, 21).map((n) => n.token));
    expect(parseToken('22', 'C', 'tremolo21')).toBeNull();
  });

  it('nhận cả "4" và "-4" cho lỗ hút; "-3" (lỗ thổi) là sai; kèn G thấp hơn kèn C 5 nửa cung', () => {
    expect(parseToken('4', 'C', 'tremolo24')?.token).toBe('-4');
    expect(parseToken('-4', 'C', 'tremolo24')?.token).toBe('-4');
    expect(parseToken('-3', 'C', 'tremolo24')).toBeNull();
    expect(parseToken('3', 'G', 'tremolo24')!.midi).toBe(parseToken('3', 'C', 'tremolo24')!.midi - 5);
  });

  it('thang âm Đô trưởng: 3 -2 5 -4 7 -6 -8 9; tự chọn quãng tám chơi trọn được', () => {
    const scale = [60, 62, 64, 65, 67, 69, 71, 72];
    expect(bestTabs(scale, 'C', 0, 'tremolo24').tokens).toEqual(['3', '-2', '5', '-4', '7', '-6', '-8', '9']);
    expect(fitToHarp(scale, 'C', { transpose: 'octave', type: 'tremolo24' }).stats.unplayable).toBe(0);
  });

  it('đổi bài mẫu diatonic sang tremolo: tab đọc lại được, không lỗi ký hiệu', () => {
    const s = SAMPLE_SONGS.find((x) => x.sampleId === 'amazing-grace')!;
    const { body } = rekeyBody(s.body, s.harpKey, 'C', 'any', 'diatonic', 'tremolo24');
    const parsed = parseTab(body, 'C', 'tremolo24');
    expect(parsed.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(flatten(parsed).filter((f) => f.midi !== null).length).toBeGreaterThan(20);
  });

  it('dán tab có số lỗ trên 16 → đoán là tremolo 24 lỗ', () => {
    const raw = 'Ode to Joy\n5 5 -6 7 7 -6 5 -4 3 3 5 5\n13 -12 17 -18';
    expect(guessHarpType(raw)).toBe('tremolo24');
    const imp = importTabText(raw);
    expect(imp.harpType).toBe('tremolo24');
    expect(imp.body.split('\n')[0]).toBe('5 5 -6 7 7 -6 5 -4 3 3 5 5');
  });
});

describe('tiếng kèn tremolo', () => {
  it('bài cho kèn tremolo tự phát bằng giọng "Kèn tremolo"', async () => {
    const { suggestInstrument } = await import('../audio/suggest');
    const song = { title: 'Ode to Joy', timeSig: '4/4', bpm: 100, harpType: 'tremolo24' as const };
    expect(suggestInstrument(song, [], 'ballad').instrument).toBe('tremolo');
    expect(suggestInstrument({ ...song, harpType: undefined }, [], 'ballad').instrument).not.toBe('tremolo');
  });
});

describe('tremolo giọng thứ', () => {
  it('kèn Am: thổi La Đô Mi, hút Si Rê Fa Sol; tên "Kèn Am"', async () => {
    const { harpLayout, harpName, songTonality, midiToName } = await import('./harp');
    const lay = harpLayout('A', 'tremolo24m');
    expect(lay).toHaveLength(24);
    const name = (h: number) => midiToName(lay.find((n) => n.hole === h)!.midi, 'letter');
    expect([1, 3, 5, 7].map(name)).toEqual(['E3', 'A3', 'C4', 'E4']);
    expect([2, 4, 6, 8].map(name)).toEqual(['B3', 'D4', 'F4', 'G4']);
    expect(harpName('A', 'tremolo24m')).toBe('Kèn Am tremolo 24 lỗ');
    expect(songTonality('A', 1, 'tremolo24m')).toBe('Am');
  });
});
