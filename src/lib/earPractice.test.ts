import { describe, expect, it } from 'vitest';
import { harpLayout, HarpType } from './harp';
import { EAR_LEVELS, earPool, easiestNote, makeQuestion, NoteSegmenter, sameNote } from './earPractice';

describe('ra đề nghe – đáp', () => {
  it('mọi nhạc cụ đều ra được đề ở mọi cấp (trừ đàn bầu chỉ có vài nốt bồi)', () => {
    const types: HarpType[] = ['diatonic', 'chromatic', 'tremolo24', 'recorderAlto', 'saoTruc6', 'ocarina12', 'kalimba17', 'kalimba8', 'guitar6', 'ukulele4', 'pianica32', 'tranh17'];
    for (const t of types) {
      for (const lv of EAR_LEVELS) {
        const p = earPool(harpLayout('C', t), 0, lv);
        expect({ t, lv: lv.id, ok: !!p && p.pool.length >= 2 }).toEqual({ t, lv: lv.id, ok: true });
        expect(p!.tonic % 12).toBe(0);
      }
    }
  });

  it('kèn diatonic C: Đô Rê Mi lấy ở quãng giữa kèn (lỗ 4–5: C5 D5 E5), không dùng nốt bend', () => {
    const p = earPool(harpLayout('C', 'diatonic'), 0, EAR_LEVELS[0])!;
    expect(p).toEqual({ tonic: 72, pool: [72, 74, 76] });
  });

  it('tông G: nốt chủ là Sol', () => {
    expect(earPool(harpLayout('G', 'diatonic'), 7, EAR_LEVELS[1])!.tonic % 12).toBe(7);
  });

  it('câu không lặp nốt liền nhau; câu 3 nốt mở đầu bằng nốt chủ', () => {
    let s = 1;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const q = makeQuestion([60, 62, 64, 65, 67], 3, rnd, 60);
      expect(q).toHaveLength(3);
      expect(q[0]).toBe(60);
      for (let j = 1; j < q.length; j++) expect(q[j]).not.toBe(q[j - 1]);
    }
  });

  it('chấm khác quãng tám khi cho phép', () => {
    expect(sameNote(72, 60, true)).toBe(true);
    expect(sameNote(72, 60, false)).toBe(false);
    expect(sameNote(61, 60, true)).toBe(false);
  });

  it('chỉ chỗ bấm: chọn thế dễ nhất (kèn diatonic: Rê5 là -4)', () => {
    expect(easiestNote(harpLayout('C', 'diatonic'), 74)?.token).toBe('-4');
  });
});

describe('tách nốt từ micro', () => {
  const run = (seg: NoteSegmenter, frames: [number, number | null, number?][]) => {
    const out: number[] = [];
    let t = 0;
    for (const [n, m, rms] of frames) for (let i = 0; i < n; i++) { const r = seg.feed(t, m, rms ?? 0.05); if (r !== null) out.push(r); t += 1 / 60; }
    return out;
  };

  it('thổi liền Đô – Rê – Mi (không ngắt hơi) ra 3 nốt; tiếng lướt qua ngắn không tính', () => {
    expect(run(new NoteSegmenter(), [[20, 60.05], [3, 61.2], [20, 62], [20, 63.9]])).toEqual([60, 62, 64]);
  });

  it('cùng một nốt hai lần: ngắt tiếng giữa chừng thì tính hai nốt; ngân dài chỉ một', () => {
    expect(run(new NoteSegmenter(), [[20, 60], [8, null], [20, 60]])).toEqual([60, 60]);
    expect(run(new NoteSegmenter(), [[120, 60]])).toEqual([60]);
  });

  it('đàn gảy: gảy lại cùng nốt khi dây còn ngân (âm lượng vọt lên) cũng tính nốt mới', () => {
    expect(run(new NoteSegmenter(), [[20, 60, 0.08], [20, 60, 0.03], [20, 60, 0.1]])).toEqual([60, 60]);
  });
});
