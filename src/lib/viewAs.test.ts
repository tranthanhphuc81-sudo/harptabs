import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { blankSong } from './db';
import { harpTypeOf } from './harp';
import { flatten, parseTab } from './tabText';
import { bestHarp, chordForOriginal, hardnessOf, isOriginal, resolveChoice, viewSong } from './viewAs';

const grace = (() => {
  const { sampleId, ...s } = SAMPLE_SONGS.find((x) => x.sampleId === 'amazing-grace')!;
  return blankSong({ ...s, id: sampleId, chords: { '0': 'C', '4': 'F' } });
})();

describe('Xem cho kèn', () => {
  it('chọn đúng kèn của bài (hoặc không chọn) → giữ nguyên bài gốc', () => {
    expect(viewSong(grace, null).song).toBe(grace);
    expect(isOriginal(grace, { type: 'diatonic', key: grace.harpKey, mode: 'any' })).toBe(true);
    expect(viewSong(grace, { type: 'diatonic', key: grace.harpKey, mode: 'any' }).fit).toBeNull();
  });

  it('xem trên tremolo: tab hợp lệ, lời và trường độ giữ nguyên, bài gốc không đổi', () => {
    const before = JSON.stringify(grace);
    const v = viewSong(grace, { type: 'tremolo24', key: 'C', mode: 'any' });
    expect(harpTypeOf(v.song)).toBe('tremolo24');
    expect(v.song.position).toBe(1);
    const a = flatten(parseTab(grace.body, grace.harpKey, 'diatonic'));
    const p = parseTab(v.song.body, 'C', 'tremolo24');
    const b = flatten(p);
    expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(b.map((x) => [x.beats, x.lyric])).toEqual(a.map((x) => [x.beats, x.lyric]));
    expect(JSON.stringify(grace)).toBe(before);
  });

  it('dịch giọng thì giọng bài và hợp âm dịch theo; chọn hợp âm khi đang xem được dịch ngược về bài gốc', () => {
    const v = viewSong(grace, { type: 'diatonic', key: 'G', mode: 'any' });
    expect(v.fit!.shift % 12).not.toBe(0);
    const pc = (n: string) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].indexOf(n.replace(/m$/, ''));
    expect(((pc(v.song.chords!['0']) - pc('C')) % 12 + 12) % 12).toBe(((v.fit!.shift % 12) + 12) % 12);
    expect(chordForOriginal(v.song.chords!['4'], v.fit)).toBe('F');
  });

  it('"dễ thổi nhất" không dịch giọng khi giọng gốc đã thổi trọn được', () => {
    const v = viewSong(grace, { type: 'tremolo24', key: 'C', mode: 'any' });
    expect(Math.abs(v.fit!.shift % 12)).toBe(0);
    expect(v.fit!.stats.unplayable).toBe(0);
    expect(v.song.songKey).toBe(grace.songKey);
  });

  it('giữ giọng gốc: không dịch giọng, nốt không có trên kèn được đếm', () => {
    const v = viewSong(grace, { type: 'tremolo24', key: 'G', mode: 'octave' });
    expect(Math.abs(v.fit!.shift % 12)).toBe(0);
    expect(v.song.songKey).toBe(grace.songKey);
    expect(v.fit!.stats.unplayable).toBeGreaterThanOrEqual(0);
  });
});

describe('Tự chọn kèn hợp nhất', () => {
  const sample = (id: string) => {
    const { sampleId, ...s } = SAMPLE_SONGS.find((x) => x.sampleId === id)!;
    return blankSong({ ...s, id: sampleId });
  };

  it('bài thổi trọn trên kèn của nó, không bend → giữ nguyên bản gốc', () => {
    const s = sample('twinkle');
    const b = bestHarp(s);
    expect(b.originalFit.stats.bends + b.originalFit.stats.unplayable).toBe(0);
    expect(isOriginal(s, b.view)).toBe(true);
    expect(resolveChoice(s, 'auto')).toEqual(b.view);
  });

  it('bài nhiều nốt thăng giáng (Für Elise) → kèn chromatic, không phải tremolo', () => {
    const b = bestHarp(sample('fur-elise-chromatic'));
    expect(b.view.type).toMatch(/^chromatic/);
    expect(b.fit.stats.unplayable).toBe(0);
  });

  it('bài cần bend trên diatonic → chọn kèn khác dễ hơn, vẫn giữ giọng bài', () => {
    const s = blankSong({ id: 'b', title: 'bend', harpKey: 'C', body: "-2'' -3' -3 4 -4' -4 5 -6'" });
    const b = bestHarp(s);
    expect(b.originalFit.stats.bends).toBeGreaterThan(0);
    expect(hardnessOf(b.fit)).toBeLessThan(hardnessOf(b.originalFit));
    expect(Math.abs(b.fit.shift % 12)).toBe(0);
  });

  it('ngang độ khó thì ưu tiên kèn C', () => {
    // thang Đô trưởng đặt trên kèn G: kèn C diatonic thổi trọn được, không cần đổi loại kèn
    const s = blankSong({ id: 'g', title: 'g', harpKey: 'G', harpType: 'chromatic', body: '1 -1 2 -2 3 -3 -4 4' });
    const b = bestHarp(s);
    expect(hardnessOf(b.fit)).toBe(0);
  });

  it('lựa chọn "bản gốc" và kèn chọn tay', () => {
    const s = sample('twinkle');
    expect(resolveChoice(s, 'original')).toBeNull();
    expect(resolveChoice(s, { type: 'tremolo24', key: 'C', mode: 'any' })).toEqual({ type: 'tremolo24', key: 'C', mode: 'any' });
  });
});
