import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { songTonality } from '../lib/harp';
import { bassMidi, chordAt, estimateTonality, harmonize, parseTonality } from './harmony';

const song = (id: string) => {
  const s = SAMPLE_SONGS.find((x) => x.sampleId === id)!;
  const flat = flatten(parseTab(s.body, s.harpKey));
  return { s, flat, spans: harmonize(flat, beatsPerBar(s.timeSig), s.pickupBeats, parseTonality(s.songKey || songTonality(s.harpKey, s.position))) };
};

describe('đệm hợp âm', () => {
  it('đọc tên tông', () => {
    expect(parseTonality('G')).toEqual({ tonic: 7, minor: false });
    expect(parseTonality('Dm')).toEqual({ tonic: 2, minor: true });
    expect(parseTonality('Bb thứ')).toEqual({ tonic: 10, minor: true });
    expect(parseTonality('F#')).toEqual({ tonic: 6, minor: false });
    expect(parseTonality('')).toBeNull();
  });

  it('Twinkle: C F C F C G C', () => {
    const { spans } = song('twinkle');
    expect(spans.slice(0, 7).map((c) => c.chord.name)).toEqual(['C', 'F', 'C', 'F', 'C', 'G', 'C']);
  });

  it('kết bài về hợp âm chủ', () => {
    for (const id of ['twinkle', 'happy-birthday', 'oh-susanna', 'clementine', 'jingle-bells']) {
      const { spans } = song(id);
      expect(spans[spans.length - 1].chord.name).toBe('C');
    }
  });

  it('đoán được tông khi bài không ghi', () => {
    expect(estimateTonality(song('twinkle').flat)).toEqual({ tonic: 0, minor: false });
  });

  it('tra hợp âm theo phách và nốt bass nằm trong tầm', () => {
    const { spans } = song('twinkle');
    expect(chordAt(spans, 4.5)?.name).toBe('F');
    expect(chordAt(spans, 999)).toBeNull();
    for (const sp of spans) {
      for (const fifth of [false, true]) {
        const m = bassMidi(sp.chord, fifth);
        expect(m).toBeGreaterThanOrEqual(40);
        expect(m).toBeLessThan(52);
      }
    }
  });

  it('bài trống không có hợp âm', () => {
    expect(harmonize([], 4, 0)).toEqual([]);
  });
});
