import { describe, expect, it } from 'vitest';
import { dropClicks, loopbackLatency, matchHits, OnsetDetector, rhythmAdvice, rhythmStats } from './rhythm';

/** năng lượng từng khối 128 mẫu (48 kHz): nền nhỏ, mỗi tiếng gõ vọt lên rồi tắt dần */
function energies(hits: { t: number; amp: number }[], dur: number) {
  const dt = 128 / 48000;
  const out: { t: number; e: number }[] = [];
  for (let t = 0; t < dur; t += dt) {
    let e = 1e-6;
    for (const h of hits) if (t >= h.t) e += h.amp * Math.exp(-(t - h.t) / 0.15);
    out.push({ t, e });
  }
  return out;
}

describe('bắt tiếng gõ', () => {
  it('mỗi tiếng gõ một lần, thời điểm lệch dưới 5 ms; tiếng ngân không tính thêm', () => {
    const hits = [0.5, 1.0, 1.5, 2.0].map((t) => ({ t, amp: 0.01 }));
    const d = new OnsetDetector();
    const got: number[] = [];
    for (const { t, e } of energies(hits, 2.6)) { const o = d.feed(t, e); if (o) got.push(o.t); }
    expect(got).toHaveLength(4);
    got.forEach((t, i) => expect(Math.abs(t - hits[i].t)).toBeLessThan(0.005));
  });

  it('tiếng gõ liền nhau (móc đôi ở 120 nhịp/phút, cách 0,25 giây) vẫn tách được', () => {
    const hits = [0.5, 0.75, 1.0, 1.25].map((t) => ({ t, amp: 0.01 }));
    const d = new OnsetDetector();
    let n = 0;
    for (const { t, e } of energies(hits, 1.8)) if (d.feed(t, e)) n++;
    expect(n).toBe(4);
  });
});

describe('tiếng máy lọt vào micro ngay trước tiếng người chơi', () => {
  it('người chơi muộn 15 ms sau tiếng máy (nhỏ): lấy thời điểm của người chơi; tiếng máy riêng lẻ vẫn bắt được', () => {
    const d = new OnsetDetector();
    const got: number[] = [];
    for (const { t, e } of energies([{ t: 0.5, amp: 0.0005 }, { t: 0.515, amp: 0.02 }, { t: 1.5, amp: 0.0005 }, { t: 1.55, amp: 0.02 }], 2.2)) { const o = d.feed(t, e); if (o) got.push(o.t); }
    expect(got.some((t) => Math.abs(t - 0.515) < 0.004)).toBe(true);
    expect(got.some((t) => Math.abs(t - 0.5) < 0.004)).toBe(false);
    expect(got.some((t) => Math.abs(t - 1.5) < 0.004)).toBe(true);
    expect(got.some((t) => Math.abs(t - 1.55) < 0.004)).toBe(true);
  });
});

describe('chấm nhịp', () => {
  it('ghép tiếng gõ với phách: sớm âm, muộn dương, bỏ sót null, đếm tiếng thừa', () => {
    const r = matchHits([1, 1.5, 2, 2.5], [0.98, 1.53, 1.75, 2.49]);
    expect(r.hits.map((h) => h.ms)).toEqual([-20, 30, null, -10]);
    expect(r.extra).toBe(1);
  });

  it('thống kê và nhận xét: hay vội', () => {
    const r = matchHits([1, 2, 3, 4, 5, 6, 7, 8], [0.96, 1.96, 2.97, 3.96, 4.96, 5.97, 6.96, 7.96]);
    const s = rhythmStats(r);
    expect(s).toMatchObject({ caught: 8, total: 8, good: 8, extra: 0 });
    expect(s.mean).toBeLessThanOrEqual(-35);
    const a = rhythmAdvice(s);
    expect(a.lines.join(' ')).toContain('Hay vội');
  });

  it('đều và đúng → đạt', () => {
    const s = rhythmStats(matchHits([1, 2, 3, 4], [1.01, 1.99, 3.005, 4.0]));
    expect(rhythmAdvice(s).ok).toBe(true);
  });
});

describe('độ trễ máy và tiếng máy lọt vào micro', () => {
  const clicks = [0, 0.5, 1, 1.5];
  it('đo độ trễ vòng từ tiếng máy trong ô đếm vào; đeo tai nghe (không nghe thấy) thì null', () => {
    const on = clicks.map((c) => ({ t: c + 0.12, peak: 0.001 }));
    expect(loopbackLatency(clicks, on)).toEqual({ latency: expect.closeTo(0.12, 5), level: 0.001 });
    expect(loopbackLatency(clicks, [])).toBeNull();
  });

  it('bỏ tiếng máy lọt vào; giữ tiếng người chơi to hơn hẳn dù trùng phách, và tiếng lệch phách', () => {
    const loop = { latency: 0.12, level: 0.001 };
    const kept = dropClicks([{ t: 0.121, peak: 0.0012 }, { t: 0.62, peak: 0.02 }, { t: 0.87, peak: 0.0009 }], clicks, loop);
    expect(kept.map((o) => o.t)).toEqual([0.62, 0.87]);
  });
});
