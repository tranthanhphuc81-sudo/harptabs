import { describe, expect, it } from 'vitest';
import { harpLayout, harpName, parseToken } from './harp';
import { parseTab } from './tabText';
import { rankHarpKeys, midisOf, rekeyBody } from './converter';
import { SAMPLE_SONGS } from '../data/samples';

describe('kalimba 17 phím', () => {
  it('tông C: Đô4 … Mi6, phím giữa thấp nhất, xen kẽ trái phải', () => {
    const l = harpLayout('C', 'kalimba17');
    expect(l).toHaveLength(17);
    expect(l[0]).toMatchObject({ token: '1', midi: 60, hole: 9 });
    expect(l.find((n) => n.token === '1°')?.midi).toBe(72);
    expect(l.find((n) => n.token === '3°°')?.midi).toBe(88);
    // thứ tự trên đàn từ trái sang phải
    const byPos = [...l].sort((a, b) => a.hole - b.hole).map((n) => n.token);
    expect(byPos).toEqual(['2°°', '7°', '5°', '3°', '1°', '6', '4', '2', '1', '3', '5', '7', '2°', '4°', '6°', '1°°', '3°°']);
    expect(harpName('C', 'kalimba17')).toBe('Kalimba 17 phím (C)');
  });
  it('đọc tab số, nhận cả cách ghi chấm bằng \' hoặc *', () => {
    expect(parseToken("1'", 'C', 'kalimba17')?.token).toBe('1°');
    expect(parseToken('5*', 'C', 'kalimba17')?.midi).toBe(79);
    expect(parseToken('4°°', 'C', 'kalimba17')).toBeNull(); // trên Mi6
    const p = parseTab('1 1 5 5 6 6 5:2\nTwin-kle twin-kle lit-tle star\n', 'C', 'kalimba17');
    expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(p.sections[0].lines[0]).toMatchObject({ kind: 'tab' });
  });
  it('bài mẫu chuyển được sang kalimba (dịch giọng nếu cần), không thiếu nốt', () => {
    let ok = 0;
    for (const s of SAMPLE_SONGS.filter((x) => !x.harpType).slice(0, 20)) {
      const r = rekeyBody(s.body, s.harpKey, 'C', 'any', 'diatonic', 'kalimba17');
      if (r.fit.stats.unplayable === 0) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(12);
    const best = rankHarpKeys(midisOf(parseTab('1 2 3', 'C', 'kalimba17')), 1, 'kalimba17')[0];
    expect(best.stats.unplayable).toBe(0);
  });
});
