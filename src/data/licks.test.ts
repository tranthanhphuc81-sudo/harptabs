import { describe, expect, it } from 'vitest';
import { HARP_KEYS } from '../lib/harp';
import { parseTab, totalBeats } from '../lib/tabText';
import { LICKS, lickDegrees } from './licks';

describe('thư viện lick', () => {
  it('id không trùng', () => {
    expect(new Set(LICKS.map((l) => l.id)).size).toBe(LICKS.length);
  });
  it.each(LICKS.map((l) => [l.id, l] as const))('%s: chơi được trên mọi tông kèn, dài đúng số ô', (_, l) => {
    for (const k of HARP_KEYS) {
      const p = parseTab(l.body, k, 'diatonic');
      expect(p.issues.filter((i) => i.level === 'error'), `${l.id} trên kèn ${k}`).toEqual([]);
    }
    expect(totalBeats(parseTab(l.body, 'C', 'diatonic'))).toBeCloseTo(l.bars * 4, 6);
    expect(lickDegrees(l)).toHaveLength(l.bars);
  });
});
