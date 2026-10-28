import { describe, expect, it } from 'vitest';
import { BendHold, bendStatus, classifyPluck, nodeMidi, PluckDetector } from './bauPractice';

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

describe('tập nắn cần', () => {
  it('đẩy cần lên: thấp = thiếu, cao = quá, ±25 cent = đúng', () => {
    expect(bendStatus(60, 62, 2).status).toBe('under');
    expect(bendStatus(62.2, 62, 2)).toEqual({ status: 'ok', cents: 20 });
    expect(bendStatus(62.6, 62, 2).status).toBe('over');
    expect(bendStatus(null, 62, 2).status).toBe('none');
  });

  it('kéo cần xuống: cao = thiếu, thấp = quá', () => {
    expect(bendStatus(72, 71, -1).status).toBe('under');
    expect(bendStatus(70.5, 71, -1).status).toBe('over');
  });

  it('giữ đúng nửa giây mới tính một lần; giữ tiếp không tính thêm; gảy lại mới tính lần sau', () => {
    const h = new BendHold();
    let n = 0;
    let t = 0;
    const run = (frames: number, s: 'ok' | 'under' | 'none') => { for (let i = 0; i < frames; i++) { if (h.feed(t, s)) n++; t += 1 / 60; } };
    run(20, 'ok');     // 0,33 giây: chưa đủ
    run(5, 'under');
    expect(n).toBe(0);
    run(120, 'ok');    // giữ 2 giây: tính đúng một lần
    expect(n).toBe(1);
    run(10, 'none');   // tắt tiếng, gảy lại
    run(40, 'ok');
    expect(n).toBe(2);
  });
});
