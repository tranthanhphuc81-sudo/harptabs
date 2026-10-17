import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { blankSong } from './db';
import { harpTypeOf } from './harp';
import { flatten, parseTab } from './tabText';
import { chordForOriginal, isOriginal, viewSong } from './viewAs';

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
