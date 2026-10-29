import { describe, expect, it } from 'vitest';
import { harpLayout } from './harp';
import { BendHold, bendDrills, canHoldNote, holdGrade, NoteHold } from './pitchPractice';

describe('bài bend / nhấn lấy từ sơ đồ', () => {
  it('kèn diatonic C: đủ 12 nốt bend, bend xuống từ nốt gốc cùng lỗ', () => {
    const d = bendDrills(harpLayout('C', 'diatonic'), 'diatonic');
    expect(d.map((x) => x.token)).toEqual(expect.arrayContaining(["-1'", "-2'", "-2''", "-3'", "-3''", "-3'''", "-4'", "-6'", "8'", "9'", "10'", "10''"]));
    expect(d).toHaveLength(12);
    const b = d.find((x) => x.token === "-3''")!;
    expect(b).toMatchObject({ baseToken: '-3', bend: -2, base: 71, target: 69 });
  });

  it('đàn tranh 17 dây Bắc: chỉ nốt nhấn ra Fa, Si (không có trên dây buông), nhấn lên', () => {
    const d = bendDrills(harpLayout('C', 'tranh17'), 'tranh17');
    expect(d.length).toBeGreaterThan(0);
    for (const x of d) {
      expect([5, 11]).toContain(x.target % 12);
      expect(x.bend).toBeGreaterThan(0);
    }
  });

  it('kèn chromatic, sáo, pianica không có bài bend; giữ nốt dài chỉ cho nhạc cụ hơi', () => {
    for (const t of ['chromatic', 'recorderAlto', 'pianica32'] as const) expect(bendDrills(harpLayout('C', t), t)).toHaveLength(0);
    expect(['diatonic', 'recorderAlto', 'ocarina12', 'pianica32', 'tremolo24'].every((t) => canHoldNote(t as never))).toBe(true);
    expect(['guitar6', 'kalimba17', 'tranh17', 'danbau'].some((t) => canHoldNote(t as never))).toBe(false);
  });

  it('bend kèn: nhả về nốt gốc rồi bend lại thì tính lần sau', () => {
    const h = new BendHold();
    let n = 0, t = 0;
    const run = (frames: number, s: 'ok' | 'under') => { for (let i = 0; i < frames; i++) { if (h.feed(t, s)) n++; t += 1 / 60; } };
    run(60, 'ok');
    run(20, 'under'); // nhả về nốt gốc (vẫn có tiếng)
    run(60, 'ok');
    expect(n).toBe(2);
  });
});

describe('giữ nốt dài', () => {
  const play = (h: NoteHold, secs: number, cents: (i: number) => number | null, t0 = 0) => {
    const out: ReturnType<NoteHold['feed']>[] = [];
    for (let i = 0; i < secs * 60; i++) { const c = cents(i); out.push(h.feed(t0 + i / 60, c === null ? null : 72 + c / 100)); }
    return out;
  };

  it('giữ 5 giây đều, lệch nhỏ → kết quả khi dừng, đạt mục tiêu', () => {
    const h = new NoteHold(72);
    play(h, 5, (i) => 3 * Math.sin(i / 7));
    const end = play(h, 0.5, () => null, 5).find((x) => x.done)!.done!;
    expect(end.secs).toBeGreaterThanOrEqual(4.9);
    expect(end.spread).toBeLessThanOrEqual(3);
    expect(holdGrade(end).ok).toBe(true);
  });

  it('cao độ chao ±30 cent → còn chao, chưa đạt; non 30 cent → báo non', () => {
    const h = new NoteHold(72);
    play(h, 5, (i) => -30 + 30 * Math.sin(i / 5));
    const r = play(h, 0.5, () => null, 5).find((x) => x.done)!.done!;
    expect(r.spread).toBeGreaterThan(15);
    const g = holdGrade(r);
    expect(g.ok).toBe(false);
    expect(g.text).toContain('còn chao');
    expect(g.text).toContain('non');
  });

  it('ngắt hơi rất ngắn (0,1 giây) không cắt lần giữ; nốt quá ngắn không tính', () => {
    const h = new NoteHold(72);
    const a = play(h, 2, (i) => (i > 50 && i < 57 ? null : 0));
    expect(a.some((x) => x.done)).toBe(false);
    const short = new NoteHold(72);
    play(short, 0.5, () => 0);
    expect(play(short, 0.5, () => null, 0.5).some((x) => x.done)).toBe(false);
  });
});
