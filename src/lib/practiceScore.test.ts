import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadPractice, recordPractice, STABLE_FRAMES, WaitScorer } from './practiceScore';

/** thổi `midi` lệch `cents` trong n khung, mỗi khung 50ms */
function blow(sc: WaitScorer, t: { now: number }, midi: number | null, target: number, index: number, n = STABLE_FRAMES, cents = 5) {
  let hit = false;
  for (let i = 0; i < n; i++) {
    t.now += 50;
    hit = sc.feed(midi === null ? null : { nearest: midi, cents }, target, index, t.now) || hit;
  }
  return hit;
}

describe('chấm điểm Chờ nốt', () => {
  it('thổi đúng hết, chuẩn cao độ → gần 100 điểm', () => {
    const sc = new WaitScorer(3);
    const t = { now: 0 };
    sc.begin(0);
    [60, 62, 64].forEach((m, i) => expect(blow(sc, t, m, m, i)).toBe(true));
    const s = sc.summary(true);
    expect(s).toMatchObject({ done: 3, total: 3, firstTry: 1, finished: true, weak: [] });
    expect(s.score).toBeGreaterThanOrEqual(95);
  });

  it('chưa đủ khung thì chưa chuyển nốt; hơi lướt qua nốt sai không tính là lạc', () => {
    const sc = new WaitScorer(1);
    const t = { now: 0 };
    sc.begin(0);
    expect(blow(sc, t, 60, 60, 0, STABLE_FRAMES - 1)).toBe(false);
    blow(sc, t, 61, 60, 0, STABLE_FRAMES - 1); // lướt qua
    expect(blow(sc, t, 60, 60, 0)).toBe(true);
    expect(sc.results[0].misses).toBe(0);
  });

  it('giữ nốt sai đủ lâu = một lần lạc; đổi sang nốt sai khác = thêm một lần; nốt hay lạc được liệt kê', () => {
    const sc = new WaitScorer(2);
    const t = { now: 0 };
    sc.begin(0);
    blow(sc, t, 62, 60, 7, STABLE_FRAMES * 3); // giữ lâu vẫn chỉ 1 lần
    blow(sc, t, 59, 60, 7);
    blow(sc, t, null, 60, 7);
    blow(sc, t, 60, 60, 7);
    blow(sc, t, 64, 64, 8);
    const s = sc.summary(true);
    expect(sc.results.map((r) => r.misses)).toEqual([2, 0]);
    expect(s.firstTry).toBe(0.5);
    expect(s.weak.map((w) => w.index)).toEqual([7]);
    expect(s.score).toBeLessThan(70);
  });

  it('thổi đúng nốt nhưng lệch nhiều cent bị trừ điểm cao độ', () => {
    const run = (cents: number) => {
      const sc = new WaitScorer(1);
      sc.begin(0);
      blow(sc, { now: 0 }, 60, 60, 0, STABLE_FRAMES, cents);
      return sc.summary(true);
    };
    expect(run(40).score).toBeLessThan(run(5).score);
    expect(Math.round(run(40).avgCents)).toBe(40);
  });

  it('ghi điểm cao nhất và số lần tập theo bài', async () => {
    expect(await loadPractice('p')).toBeNull();
    expect((await recordPractice('p', 70, 1)).newBest).toBe(true);
    expect((await recordPractice('p', 60, 2)).newBest).toBe(false);
    const r = await recordPractice('p', 90, 3);
    expect(r.newBest).toBe(true);
    expect(r.rec).toEqual({ best: 90, last: 90, at: 3, times: 3 });
  });
});
