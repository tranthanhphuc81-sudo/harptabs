import { describe, expect, it } from 'vitest';
import { beatAt, fromAnchors, fromBpm, fromTaps, secAt } from './tempoMap';

// bài thật: dạo nhạc 4,2 giây, tốc độ tăng dần từ 0,6 s/phách xuống 0,5 s/phách trong 32 phách
const truth = (beat: number) => 4.2 + 0.6 * beat - (0.1 / 64) * beat * beat;
const anchors = Array.from({ length: 32 }, (_, b) => ({ beat: b, sec: truth(b) }));

describe('bản đồ nhịp nhạc nền', () => {
  it('đi lại hai chiều khớp; nhanh dần vẫn đúng trong 20 ms', () => {
    const m = fromAnchors(anchors)!;
    for (const b of [0, 3.5, 10.25, 30]) {
      expect(Math.abs(secAt(m, b) - truth(b))).toBeLessThan(0.02);
      expect(beatAt(m, secAt(m, b))).toBeCloseTo(b, 6);
    }
  });

  it('bỏ mốc khớp nhầm (chạy lùi, tốc độ vô lý)', () => {
    const noisy = [...anchors, { beat: 12.4, sec: 2 }, { beat: 20.2, sec: truth(20.2) + 3 }];
    const m = fromAnchors(noisy)!;
    expect(Math.abs(secAt(m, 12) - truth(12))).toBeLessThan(0.02);
    expect(Math.abs(secAt(m, 21) - truth(21))).toBeLessThan(0.05);
    // tăng dần cả hai chiều
    m.points.forEach((p, i) => { if (i) { expect(p.beat).toBeGreaterThan(m.points[i - 1].beat); expect(p.sec).toBeGreaterThan(m.points[i - 1].sec); } });
  });

  it('ngoại suy trước mốc đầu (dạo nhạc) và sau mốc cuối theo tốc độ chung', () => {
    const m = fromAnchors(anchors.slice(4, 20))!;
    expect(secAt(m, 0)).toBeCloseTo(m.points[0].sec - m.points[0].beat * m.spb, 6);
    expect(secAt(m, 40)).toBeGreaterThan(secAt(m, 30));
    expect(beatAt(m, 0)).toBeLessThan(0); // trước khi tab bắt đầu
  });

  it('quá ít mốc → null; chạm tay vài câu cũng dựng được; nhịp đều', () => {
    expect(fromAnchors([{ beat: 0, sec: 1 }])).toBeNull();
    const t = fromTaps([{ beat: 0, sec: 4 }, { beat: 16, sec: 13.5 }, { beat: 8, sec: 8.9 }, { beat: 24, sec: 5 }])!;
    expect(t.points.map((p) => p.beat)).toEqual([0, 8, 16]);
    const b = fromBpm(2, 120);
    expect(secAt(b, 4)).toBeCloseTo(4);
    expect(beatAt(b, 2)).toBeCloseTo(0);
  });
});
