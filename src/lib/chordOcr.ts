/**
 * Tên hợp âm in phía trên khuông (C, Am, G7, F#m…): chọn dải chữ để máy đọc, nhận tên hợp âm, gắn vào nốt
 * đứng ngay dưới, rồi đổi thành hợp âm chọn tay của bài (mỗi khúc hợp âm từ chỗ ghi tới hợp âm kế tiếp).
 */
import type { OmrNote, OmrPage, TitleBox } from './omr';
import type { OcrWord } from './lyricOcr';
import { normalizeChord } from './chordSheet';
import { NO_CHORD, segKey, type ChordOverrides } from '../audio/harmony';

/**
 * Dải chữ ngay trên khuông: trên nốt cao nhất (đuôi nốt quay lên ~3,5 khe), dưới khuông phía trên
 * (chừa chỗ lời của khuông đó). Trả null nếu không đủ chỗ.
 */
export function chordBand(page: Pick<OmrPage, 'image' | 'staves' | 'notes'>, si: number): TitleBox | null {
  const g = page.image, st = page.staves[si];
  if (!st) return null;
  const sp = st.space, mid = (st.top + st.bottom) / 2;
  let high = st.top - 0.8 * sp;
  // nốt dưới dòng giữa: đuôi quay lên
  for (const n of page.notes) if (n.staff === si && !n.rest) high = Math.min(high, n.y - (n.y > mid ? 3.5 * sp : 0.8 * sp));
  const y1 = Math.round(high - 0.1 * sp);
  const prev = page.staves[si - 1];
  const y0 = Math.max(0, Math.round(y1 - 3 * sp), prev ? Math.round(prev.bottom + 1.0 * sp) : 0);
  if (y1 - y0 < 1.2 * sp) return null;
  return { x0: 0, x1: Math.min(g.width, Math.round(st.xRight + 2 * sp)), y0, y1 };
}

/**
 * Các chữ là tên hợp âm (đã chuẩn hoá về hợp âm app chơi được). Dải chữ phần lớn không phải hợp âm thì là lời
 * bài hát của khuông trên ("Em ơi Hà Nội phố" có chữ "Em") → bỏ cả dải.
 */
export function chordWords(words: OcrWord[]): { x0: number; x1: number; chord: string }[] {
  const toks = words.map((w) => ({ ...w, text: w.text.trim().replace(/[|()[\]]/g, '') })).filter((w) => w.text && !/^[-/.,:]+$/.test(w.text));
  const out = toks.flatMap((w) => {
    const c = normalizeChord(w.text);
    return c && c !== NO_CHORD ? [{ x0: w.x0, x1: w.x1, chord: c }] : [];
  });
  return out.length && out.length >= 0.6 * toks.length ? out : [];
}

/** Gắn mỗi tên hợp âm vào nốt (hoặc dấu lặng) đứng ngay dưới: tên hợp âm in thẳng hàng với đầu nốt */
export function assignChords(notes: OmrNote[], staff: number, chords: { x0: number; x1: number; chord: string }[], space: number): Map<string, string> {
  const pool = notes.filter((n) => n.staff === staff).sort((a, b) => a.x - b.x);
  const out = new Map<string, string>();
  for (const c of chords) {
    const at = c.x0 + 0.5 * space;
    let best: OmrNote | null = null;
    for (const n of pool) {
      if (n.x < c.x0 - 1.5 * space) continue;
      if (!best || Math.abs(n.x - at) < Math.abs(best.x - at)) best = n;
    }
    if (best && Math.abs(best.x - at) <= 4 * space) out.set(best.id, c.chord);
  }
  return out;
}

/** Độ dài mỗi khúc hợp âm — như audio/harmony (nửa ô nhịp 4/4, một ô với nhịp khác) */
function segLen(beatsPerBar: number): number {
  if (beatsPerBar === 4) return 2;
  if (beatsPerBar >= 6 && beatsPerBar % 2 === 0) return beatsPerBar / 2;
  return beatsPerBar;
}

/**
 * Hợp âm in trên khuông → hợp âm chọn tay của bài: mỗi hợp âm giữ từ khúc chứa nốt nó đứng tới trước hợp âm
 * kế tiếp. `order`: thứ tự chơi (playOrder, đã mở dấu nhắc lại).
 */
export function chordOverrides(order: { n: OmrNote }[], beatsPerBar: number, pickupBeats: number): ChordOverrides {
  const seg = segLen(beatsPerBar);
  let t = 0;
  const marks: { beat: number; chord: string }[] = [];
  for (const { n } of order) {
    if (n.chord) marks.push({ beat: t, chord: n.chord });
    t += n.beats;
  }
  const end = t;
  if (!marks.length || end <= 0) return {};
  const bounds = [0];
  for (let b = pickupBeats > 1e-6 ? pickupBeats : seg; b < end - 1e-6; b += seg) bounds.push(b);
  const segOf = (beat: number) => {
    let i = 0;
    while (i + 1 < bounds.length && bounds[i + 1] <= beat + 1e-6) i++;
    return i;
  };
  const out: ChordOverrides = {};
  marks.forEach((m, k) => {
    const from = segOf(m.beat), to = k + 1 < marks.length ? segOf(marks[k + 1].beat) : bounds.length;
    for (let i = from; i < Math.max(to, from + 1); i++) out[segKey(bounds[i])] = m.chord;
  });
  return out;
}
