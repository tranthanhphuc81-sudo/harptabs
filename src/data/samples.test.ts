import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from './samples';
import { looksLikeTabLine, parseTab, splitLyrics } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';

/** Số phách đen mỗi ô nhịp (6/8 → 3) */
const barQuarters = (ts: string) => { const [n, d] = ts.split('/').map(Number); return (n * 4) / d; };
const beatsOf = (tok: string) => {
  const i = tok.lastIndexOf(':');
  if (i <= 0) return 1;
  const [a, b] = tok.slice(i + 1).split('/').map(Number);
  return b ? a / b : a;
};

describe('bài mẫu', () => {
  it('id không trùng', () => {
    const ids = SAMPLE_SONGS.map((s) => s.sampleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const s of SAMPLE_SONGS) {
    describe(s.title, () => {
      it('đọc tab không lỗi, mọi nốt thổi được', () => {
        const p = parseTab(s.body, s.harpKey, s.harpType);
        expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
        const events = p.sections.flatMap((x) => x.lines).flatMap((l) => (l.kind === 'tab' ? l.events : []));
        expect(events.length).toBeGreaterThan(0);
        expect(events.every((e) => e.token === null || e.midi !== null)).toBe(true);
        expect(beatsPerBar(s.timeSig)).toBeGreaterThan(0);
      });

      it('số âm tiết lời khớp số nốt từng dòng', () => {
        const lines = s.body.split('\n');
        lines.forEach((line, i) => {
          const next = lines[i + 1];
          if (!looksLikeTabLine(line, s.harpType) || !next || !next.trim() || next.startsWith('#') || looksLikeTabLine(next, s.harpType)) return;
          const notes = line.trim().split(/\s+/).filter((t) => !/^r(:|$)/i.test(t)).length;
          expect(splitLyrics(next).length, `${s.title}: "${next}"`).toBe(notes);
        });
      });

      it('tổng số phách khớp nhịp (trừ nhịp lấy đà)', () => {
        if (s.style === 'metronome' || s.tags.includes('luyện tập')) return; // bài luyện không theo ô nhịp
        const total = s.body.split('\n').filter((l) => looksLikeTabLine(l, s.harpType))
          .flatMap((l) => l.trim().split(/\s+/)).reduce((t, tok) => t + beatsOf(tok), 0);
        // hai cách ghi đều đúng: ô cuối đủ phách, hoặc ô cuối rút ngắn bù cho nhịp lấy đà
        const bar = barQuarters(s.timeSig);
        const off = (x: number) => { const r = ((x % bar) + bar) % bar; return Math.min(r, bar - r); };
        expect(Math.min(off(total - s.pickupBeats), off(total)), `${s.title}: tổng ${total} phách`).toBeLessThan(0.01);
      });
    });
  }
});
