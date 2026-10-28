import { describe, expect, it } from 'vitest';
import { classifyPluck, nodeMidi, PluckDetector } from './bauPractice';

describe('chấm lần gảy đàn bầu', () => {
  it('đúng tiếng bồi ½ (Đô4 trên dây Đô), kèm lệch cent', () => {
    expect(classifyPluck([60.1, 60.12, 60.08, 60.1], 2, 0)).toMatchObject({ kind: 'ok', cents: 10 });
  });

  it('ra dây buông, nhầm điểm, lệch cao độ, tắt tiếng', () => {
    expect(classifyPluck([48, 48.05, 47.98], 2, 0).kind).toBe('open');
    expect(classifyPluck([67, 67, 67.1], 2, 0)).toMatchObject({ kind: 'wrong', node: 3 });
    expect(classifyPluck([62.4, 62.5, 62.45], 2, 0).kind).toBe('off');
    expect(classifyPluck([60], 2, 0).kind).toBe('muted');
  });

  it('dây Rê: bồi ½ ra Rê4', () => {
    expect(nodeMidi(2, 2)).toBe(62);
    expect(classifyPluck([62, 62, 62], 2, 2).kind).toBe('ok');
  });

  it('tách lần gảy: âm lượng vọt lên → nghe 0,45 giây → chấm; chờ lặng rồi mới nhận lần sau', () => {
    const d = new PluckDetector(2, 0);
    const out: string[] = [];
    let t = 0;
    const run = (frames: number, rms: number, midi: number | null) => {
      for (let i = 0; i < frames; i++) { const r = d.feed(t, rms, midi); if (r) out.push(r.kind); t += 1 / 60; }
    };
    run(10, 0.002, null);       // im lặng
    run(40, 0.08, 60);          // gảy đúng ½
    run(10, 0.003, null);       // tắt dần
    run(40, 0.06, null);        // gảy nhưng tắt tiếng (không ra cao độ)
    run(10, 0.003, null);
    run(40, 0.07, 48);          // ra dây buông
    expect(out).toEqual(['ok', 'muted', 'open']);
  });

  it('tiếng ngân dài không bị tính thành nhiều lần gảy', () => {
    const d = new PluckDetector(2, 0);
    let n = 0;
    for (let i = 0; i < 300; i++) if (d.feed(i / 60, 0.05, 60)) n++;
    expect(n).toBe(1);
  });
});
