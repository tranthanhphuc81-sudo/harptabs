/**
 * Hợp âm chuẩn (cách đệm phổ biến) cho các bài mẫu: vừa gắn sẵn vào bài mẫu để đệm đúng,
 * vừa làm bộ đối chiếu đo độ chính xác của bộ đoán hợp âm (harmonyBench.test.ts).
 *
 * Mỗi ô nhịp một chuỗi: "C" = cả ô; "F C" = từng khúc đệm trong ô (4/4: hai nửa ô); "G/C" = chấp nhận cả hai cách đệm,
 * cách đầu là cách gắn vào bài. Hợp âm ngoài tông bộ đoán không có (D7 trong giọng C…) ghi kèm hợp âm thay thế ("D7/G").
 * Ô lấy đà không tính. Hợp âm ghi theo giọng của bài mẫu harmonica gốc.
 */
import { harmonizeSegments, parseTonality, segKey, type ChordOverrides } from './harmony';
import type { FlatEvent } from '../lib/tabText';

export const CHORD_TRUTH: Record<string, string[]> = {
  twinkle: ['C', 'F C', 'F C', 'G C', 'C F', 'C G', 'C F', 'C G', 'C', 'F C', 'F C', 'G C'],
  'frere-jacques': ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C'],
  'ode-to-joy': ['C', 'G', 'C', 'C/G G', 'C', 'G', 'C', 'G C', 'G C', 'G C', 'G', 'C/Am G', 'C', 'G', 'C', 'G C'],
  'jingle-bells': ['C', 'C', 'C', 'C', 'F', 'C', 'D7/G', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C'],
  'happy-birthday': ['C', 'G', 'G', 'C', 'C', 'F', 'C/G', 'C'],
  'amazing-grace': ['C', 'C', 'F', 'C', 'C', 'C/G', 'G', 'G/C', 'C', 'C', 'F', 'C', 'C/Am', 'G', 'C'],
  'oh-susanna': ['C', 'C G', 'C', 'G C', 'F', 'C G', 'C', 'G C'],
  'mary-lamb': ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C'],
  'london-bridge': ['C', 'C', 'G', 'C', 'C', 'C', 'G', 'C'],
  'row-your-boat': ['C', 'C', 'C', 'G C'],
  'old-macdonald': ['C', 'F C', 'C G', 'C', 'C', 'F C', 'C G', 'C', 'C', 'C', 'C', 'C', 'C', 'F C', 'C G', 'C'],
  'silent-night': ['C', 'C', 'C', 'C', 'G', 'G', 'C', 'C', 'F', 'F', 'C', 'C', 'F', 'F', 'C', 'C', 'G', 'G', 'C', 'C', 'C/G', 'G', 'C'],
  'my-bonnie': ['C', 'F', 'C', 'C', 'C', 'D7/G', 'G', 'G', 'C', 'F', 'C', 'C/Am', 'F/Dm', 'G', 'C'],
  'we-wish-you': ['C', 'F', 'D7/G/Dm', 'G', 'E7/C/Em', 'Am/F', 'F/G/Dm', 'C'],
  'this-old-man': ['C', 'C', 'F', 'G', 'C', 'C G', 'G', 'C'],
  'auld-lang-syne': ['G', 'D', 'G', 'C', 'G', 'D', 'Em/C/G C/D', 'G G/C', 'G', 'D', 'G', 'C', 'G', 'D', 'Em/C/G C/D', 'G'],
};

/** độ dài khúc đệm theo số phách mỗi ô (giống harmonizeSegments) */
function segLen(bpb: number): number {
  if (bpb === 4) return 2;
  if (bpb >= 6 && bpb % 2 === 0) return bpb / 2;
  return bpb;
}

/** các hợp âm chấp nhận được cho khúc bắt đầu ở phách `start` (null: ô lấy đà / ngoài bảng) */
function wanted(truth: string[], bpb: number, pickup: number, start: number): string[] | null {
  if (start < pickup - 1e-6) return null;
  const bar = Math.floor((start - pickup) / bpb + 1e-6);
  const spec = truth[bar];
  if (!spec) return null;
  const parts = spec.split(' ');
  const half = Math.floor((((start - pickup) % bpb) + 1e-6) / segLen(bpb));
  return (parts[Math.min(half, parts.length - 1)] ?? parts[0]).split('/');
}

/** hợp âm chuẩn → hợp âm ép cho từng khúc đệm (lấy cách đầu tiên của mỗi khúc) */
export function truthOverrides(truth: string[], bpb: number, pickup: number): ChordOverrides {
  const out: ChordOverrides = {};
  const L = segLen(bpb);
  for (let t = pickup; ; t += L) {
    const w = wanted(truth, bpb, pickup, t);
    if (!w) break;
    out[segKey(t)] = w[0];
  }
  return out;
}

export interface BenchSong { flat: FlatEvent[]; bpb: number; pickup: number; key: string; overrides?: ChordOverrides }

/** số khúc bộ đoán đúng / tổng số khúc có hợp âm chuẩn, kèm danh sách khúc sai để xem */
export function scoreSong(s: BenchSong, truth: string[]): { right: number; total: number; misses: string[] } {
  const segs = harmonizeSegments(s.flat, s.bpb, s.pickup, parseTonality(s.key), s.overrides);
  let right = 0, total = 0;
  const misses: string[] = [];
  for (const g of segs) {
    const want = wanted(truth, s.bpb, s.pickup, g.start);
    if (!want) continue;
    total++;
    // hợp âm 7 át (G7) cùng chức năng với G: tính là đúng
    const name = g.chord.name;
    if (want.includes(name) || want.includes(name.replace(/^([A-G][#b]?)7$/, '$1')) || want.includes(`${name}7`)) right++;
    else misses.push(`ô ${Math.floor((g.start - s.pickup) / s.bpb + 1e-6) + 1}: ${name} (chuẩn ${want.join('/')})`);
  }
  return { right, total, misses };
}
