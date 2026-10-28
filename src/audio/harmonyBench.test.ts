import { describe, expect, it } from 'vitest';
import { CHORD_TRUTH, scoreSong } from './harmonyBench';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { songTonality } from '../lib/harp';
import { kalimbaSamples } from '../data/kalimbaSamples';
import { recorderSamples } from '../data/recorderSamples';
import { guitarSamples } from '../data/guitarSamples';
import { harmonizeSegments, parseTonality } from './harmony';

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

  it('bản kalimba, sáo, guitar của bài mẫu giữ hợp âm chuẩn (dịch theo giọng nếu bài bị dịch giọng)', () => {
    const base = SAMPLE_SONGS.filter((s) => (s.harpType ?? 'diatonic') === 'diatonic');
    for (const [app, list] of [['kalimba', kalimbaSamples(base)], ['sáo', recorderSamples(base)], ['guitar', guitarSamples(base)]] as const) {
      for (const id of Object.keys(CHORD_TRUTH)) {
        const s = list.find((x) => x.sampleId.startsWith(`${id}-`));
        if (!s) continue;
        const orig = base.find((x) => x.sampleId === id)!;
        expect(s.chords, `${app} ${s.sampleId}`).toBeTruthy();
        // hợp âm đệm khớp giai điệu đã dịch: cùng số khúc với bản gốc, khúc nào cũng là hợp âm ép
        const segs = harmonizeSegments(flatten(parseTab(s.body, s.harpKey, s.harpType)), beatsPerBar(s.timeSig), s.pickupBeats, parseTonality(s.songKey || songTonality(s.harpKey, s.position, s.harpType)), s.chords);
        expect(Object.keys(s.chords!).length, `${app} ${s.sampleId}`).toBe(Object.keys(orig.chords!).length);
        expect(segs.filter((g) => g.manual).length, `${app} ${s.sampleId}`).toBe(Object.keys(s.chords!).length);
      }
    }
  });
});
