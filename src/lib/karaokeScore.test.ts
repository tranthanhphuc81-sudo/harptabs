import { describe, expect, it } from 'vitest';
import { buildKaraoke } from './karaoke';
import { foldedError, KaraokeScorer } from './karaokeScore';
import { flatten, parseTab } from './tabText';

// 120 bpm → 0,5 s mỗi phách; 4 âm tiết, "you" luyến 2 nốt (5 rồi -4)
const BODY = `4 -4 4:2 5 -4
Hap-py birth you _`;
const flat = flatten(parseTab(BODY, 'C'));
const lines = buildKaraoke(flat);
const SPB = 0.5;

/** hát cả bài: mỗi 1/20 phách một lần đọc; `sing(beat, target)` trả cao độ hát hoặc null */
function perform(sing: (beat: number, target: number) => number | null, transpose = 0, until = 6) {
  const sc = new KaraokeScorer(lines, flat, SPB, transpose);
  for (let b = -0.5; b < until; b += 0.05) {
    const syl = lines[0].syls.find((s) => b >= s.start && b < s.end);
    const target = syl ? sc.targetAt(syl, b) : null;
    sc.feed(target === null ? null : sing(b, target), b);
  }
  return sc;
}

describe('chấm điểm karaoke', () => {
  it('gập quãng tám: lệch đúng 12 nửa cung = 0', () => {
    expect(foldedError(48, 60)).toBe(0);
    expect(foldedError(73, 60)).toBe(1);
    expect(foldedError(60.3, 60)).toBeCloseTo(0.3);
  });

  it('hát đúng → gần 100; hát thấp hơn một quãng tám cũng đúng', () => {
    expect(perform((_, t) => t + 0.1).summary().score).toBeGreaterThanOrEqual(95);
    expect(perform((_, t) => t - 12).summary().score).toBeGreaterThanOrEqual(95);
  });

  it('lệch một cung → điểm thấp; im lặng → 0', () => {
    expect(perform((_, t) => t + 2).summary().score).toBeLessThan(15);
    expect(perform(() => null).summary().score).toBe(0);
  });

  it('vào trễ 120 ms vẫn được tính cho đúng âm tiết', () => {
    const lateBeats = 0.12 / SPB;
    const sc = perform((b) => {
      const s = lines[0].syls.find((x) => b - lateBeats >= x.start && b - lateBeats < x.end);
      return s ? new KaraokeScorer(lines, flat, SPB).targetAt(s, b - lateBeats) : null;
    });
    expect(sc.summary().score).toBeGreaterThanOrEqual(80);
  });

  it('nốt luyến: nửa sau âm tiết so với nốt thứ hai', () => {
    const you = lines[0].syls[3];
    const sc = new KaraokeScorer(lines, flat, SPB);
    expect(sc.targetAt(you, you.start + 0.2)).toBe(flat[you.fi[0]].midi);
    expect(sc.targetAt(you, you.end - 0.2)).toBe(flat[you.fi[1]].midi);
  });

  it('đổi tông: phải hát theo tông mới', () => {
    expect(perform((_, t) => t, 3).summary().score).toBeGreaterThanOrEqual(95);
    // hát theo tông gốc khi đã nâng 3 nửa cung → sai
    expect(perform((_, t) => t - 3, 3).summary().score).toBeLessThan(15);
  });

  it('hát được nửa bài: chỉ chấm phần đã tới, liệt kê âm tiết yếu', () => {
    const half = perform((b, t) => (b < 2 ? t : t + 2), 0, 3.5).summary();
    expect(half.done).toBeLessThan(half.total);
    expect(half.weak.map((w) => w.text)).toContain('birth');
    expect(half.weak.map((w) => w.text)).not.toContain('Hap');
  });
});
