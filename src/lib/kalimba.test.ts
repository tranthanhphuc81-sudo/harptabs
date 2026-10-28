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

describe('tập ngẫu hứng trên kalimba', () => {
  it('lick kalimba: tab số hợp lệ, đủ phách theo số ô', async () => {
    const { KALIMBA_LICKS } = await import('../data/kalimbaLicks');
    const { lickEvents } = await import('./blues');
    expect(new Set(KALIMBA_LICKS.map((l) => l.id)).size).toBe(KALIMBA_LICKS.length);
    for (const l of KALIMBA_LICKS) {
      const p = parseTab(l.body, 'C', 'kalimba17');
      expect(p.issues.filter((i) => i.level === 'error'), l.id).toEqual([]);
      const ev = lickEvents(l.body, 'C', 'kalimba17');
      const beats = ev.reduce((s, e) => s + e.beats, 0);
      expect(beats, l.id).toBeCloseTo(l.bars * 4, 6);
      expect(ev.every((e) => e.token === null || e.midi !== null), l.id).toBe(true);
    }
    for (const over of ['I', 'IV', 'V', 'turn'] as const) expect(KALIMBA_LICKS.some((l) => l.over === over)).toBe(true);
  });
  it('thang ngũ cung trên kalimba C: chỉ 1 2 3 5 6 ở mọi quãng tám', async () => {
    const { pentatonicTokens } = await import('./blues');
    const t = pentatonicTokens('C', 'kalimba17', 0);
    expect(t.slice(0, 6)).toEqual(['1', '2', '3', '5', '6', '1°']);
    expect(t).not.toContain('4');
    expect(t).not.toContain('7');
    expect(t).toHaveLength(13);
  });
});

describe('kalimba 8 / 10 phím', () => {
  it('8 phím: Đô4 … Đô5, 10 phím: Đô4 … Mi5, phím giữa thấp nhất', () => {
    const k8 = harpLayout('C', 'kalimba8');
    expect(k8.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect([...k8].sort((a, b) => a.hole - b.hole).map((n) => n.token)).toEqual(['1°', '6', '4', '2', '1', '3', '5', '7']);
    const k10 = harpLayout('C', 'kalimba10');
    expect(k10).toHaveLength(10);
    expect(k10.at(-1)?.token).toBe('3°');
    expect(new Set(k10.map((n) => n.hole)).size).toBe(10);
    expect(harpName('C', 'kalimba10')).toBe('Kalimba 10 phím (C)');
  });
  it('nốt ngoài tầm đàn nhỏ không đọc được, hình phím ghi đủ số phím', () => {
    expect(parseToken('4°', 'C', 'kalimba10')).toBeNull();
    expect(parseToken('3°', 'C', 'kalimba10')?.midi).toBe(76);
    expect(parseToken('2°', 'C', 'kalimba8')).toBeNull();
    expect(harpLayout('C', 'kalimba8').find((n) => n.token === '1')?.fingers).toBe('k4/8');
  });
  it('bài 17 phím đổi sang 10 phím (dịch quãng tám nếu cần)', () => {
    const r = rekeyBody('1 1 5 5 6 6 5:2\n4 4 3 3 2 2 1:2\n', 'C', 'C', 'octave', 'kalimba17', 'kalimba10');
    expect(r.fit.stats.unplayable).toBe(0);
  });
});
