import { describe, expect, it } from 'vitest';
import { CHORD_TRUTH, scoreSong } from './harmonyBench';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { songTonality } from '../lib/harp';

/**
 * Đo độ chính xác của bộ đoán hợp âm trên 16 bài mẫu có hợp âm chuẩn (309 khúc đệm).
 * Đo ngày 2026-10-28: 283/309 = 91,6%. Sửa bộ đoán mà tụt dưới ngưỡng là test báo.
 */
describe('độ chính xác bộ đoán hợp âm', () => {
  const songs = Object.entries(CHORD_TRUTH).map(([id, truth]) => {
    const s = SAMPLE_SONGS.find((x) => x.sampleId === id)!;
    return { id, truth, song: { flat: flatten(parseTab(s.body, s.harpKey, s.harpType)), bpb: beatsPerBar(s.timeSig), pickup: s.pickupBeats, key: s.songKey || songTonality(s.harpKey, s.position, s.harpType) }, chords: s.chords };
  });

  it('tự đoán (không có hợp âm gắn sẵn) đúng ít nhất 91%', () => {
    let right = 0, total = 0;
    for (const { truth, song } of songs) {
      const r = scoreSong(song, truth);
      right += r.right; total += r.total;
    }
    expect(total).toBe(309);
    expect(right / total).toBeGreaterThanOrEqual(0.91);
  });

  it('bài mẫu đã gắn hợp âm chuẩn: đệm đúng 100%', () => {
    for (const { id, truth, song, chords } of songs) {
      expect(chords, id).toBeTruthy();
      const r = scoreSong({ ...song, overrides: chords }, truth);
      expect(r.misses, id).toEqual([]);
    }
  });
});
