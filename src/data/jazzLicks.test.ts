import { describe, expect, it } from 'vitest';
import { lickToTab } from '../lib/jazz';
import { parseTab, totalBeats } from '../lib/tabText';
import { JAZZ_LICKS, jazzLickPlace } from './jazzLicks';

describe('lick jazz', () => {
  it('id không trùng, có chỗ dùng', () => {
    expect(new Set(JAZZ_LICKS.map((l) => l.id)).size).toBe(JAZZ_LICKS.length);
    expect(JAZZ_LICKS.every((l) => jazzLickPlace(l))).toBe(true);
  });
  it.each(JAZZ_LICKS.map((l) => [l.id, l] as const))('%s: đổi sang tab ở 12 giọng, dài đúng chuỗi hợp âm', (_, l) => {
    const beats = l.chords.reduce((t, c) => t + c.beats, 0);
    for (const type of ['chromatic', 'diatonic'] as const) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const r = lickToTab(l.notes, tonic, 'C', type);
        const p = parseTab(r.body, 'C', type);
        expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
        expect(totalBeats(p)).toBeCloseTo(beats, 6);
        if (type === 'chromatic') expect(r.unplayable, `${l.id} giọng ${tonic}`).toBe(0);
      }
    }
  });
});
