/**
 * Tập nghe – đáp: máy chơi vài nốt, người tập nghe rồi chơi lại trên nhạc cụ của mình; app nghe micro và chấm từng nốt.
 * Luyện tai và thuộc vị trí nốt trên đàn. Dùng cho mọi nhạc cụ (chấm theo cao độ, chấp nhận khác quãng tám).
 */
import { HarpNote } from './harp';

export interface EarLevel {
  id: string;
  label: string;
  /** bậc trong gam trưởng tính từ nốt chủ (nửa cung): 0 = Đô, 2 = Rê, 4 = Mi… */
  degrees: number[];
  /** số nốt mỗi câu */
  len: number;
}

export const EAR_LEVELS: EarLevel[] = [
  { id: 'l1', label: '1 nốt · Đô Rê Mi', degrees: [0, 2, 4], len: 1 },
  { id: 'l2', label: '1 nốt · Đô → Sol', degrees: [0, 2, 4, 5, 7], len: 1 },
  { id: 'l3', label: '1 nốt · cả gam', degrees: [0, 2, 4, 5, 7, 9, 11, 12], len: 1 },
  { id: 'l4', label: '2 nốt · Đô → Sol', degrees: [0, 2, 4, 5, 7], len: 2 },
  { id: 'l5', label: '3 nốt · Đô → Sol', degrees: [0, 2, 4, 5, 7], len: 3 },
  { id: 'l6', label: '3 nốt · cả gam', degrees: [0, 2, 4, 5, 7, 9, 11, 12], len: 3 },
  { id: 'l7', label: '4 nốt · cả gam', degrees: [0, 2, 4, 5, 7, 9, 11, 12], len: 4 },
];

/** kỹ thuật dễ (không tính bend, overblow, nhấn, nắn, bịt nửa lỗ…) để ra đề */
const EASY = new Set(['blow', 'draw', 'fingered', 'harmonic']);

/**
 * Nốt chủ để ra đề: nốt tông của nhạc cụ, chọn quãng tám có nhiều nốt gam chơi được bằng kỹ thuật dễ nhất,
 * ưu tiên quãng giữa tầm. Trả về nốt chủ và các nốt đề chơi được.
 */
export function earPool(layout: HarpNote[], keyOff: number, level: EarLevel): { tonic: number; pool: number[] } | null {
  const easy = new Set(layout.filter((n) => EASY.has(n.technique)).map((n) => n.midi));
  if (!easy.size) return null;
  const lo = Math.min(...easy), hi = Math.max(...easy), mid = (lo + hi) / 2;
  let best: { tonic: number; pool: number[]; score: number } | null = null;
  for (let t = 36 + (((keyOff % 12) + 12) % 12); t <= 96; t += 12) {
    const pool = level.degrees.map((d) => t + d).filter((m) => easy.has(m));
    if (!pool.includes(t) && !pool.includes(t + 12)) continue;
    // đủ nốt là chính; bằng nhau thì gần giữa tầm hơn
    const score = pool.length * 100 - Math.abs(t + 6 - mid);
    if (!best || score > best.score) best = { tonic: t, pool, score };
  }
  return best && best.pool.length >= Math.min(2, level.degrees.length) ? { tonic: best.tonic, pool: best.pool } : null;
}

/** ra một câu: len nốt từ pool; không lặp một nốt hai lần liền; câu nhiều nốt thì nốt đầu là nốt chủ cho dễ bắt */
export function makeQuestion(pool: number[], len: number, rnd: () => number = Math.random, tonic?: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    const choices = pool.filter((m) => m !== out[out.length - 1]);
    out.push(choices[Math.floor(rnd() * choices.length)] ?? pool[0]);
  }
  if (len >= 3 && tonic !== undefined && pool.includes(tonic)) {
    out[0] = tonic;
    if (out[1] === tonic) out[1] = pool.filter((m) => m !== tonic && m !== out[2])[0] ?? out[1];
  }
  return out;
}

/** nốt chơi được: cùng cao độ, hoặc cùng tên nốt khác quãng tám (đàn nhiều quãng, giọng người) */
export const sameNote = (heard: number, want: number, anyOctave: boolean) => heard === want || (anyOctave && (heard - want) % 12 === 0);

/* ---------- tách nốt từ micro ---------- */

/** cao độ phải đứng yên bao lâu thì tính là một nốt (giây) */
const STABLE = 0.12;
/** mất tiếng bao lâu thì nốt kế tiếp (dù cùng cao độ) tính là nốt mới */
const GAP = 0.09;

/**
 * Tách các nốt người chơi từ luồng cao độ: cao độ đứng yên quanh một nốt STABLE giây là một nốt;
 * nốt kế tiếp phải khác cao độ, hoặc cùng cao độ nhưng sau một quãng lặng / một cú gảy mới (âm lượng vọt lên).
 */
export class NoteSegmenter {
  private cand: number | null = null;
  private since = 0;
  private last: number | null = null;
  private silentSince: number | null = null;
  private level = 0;

  reset() { this.cand = null; this.last = null; this.silentSince = null; this.level = 0; }

  feed(time: number, midi: number | null, rms = 0): number | null {
    // cú gảy mới (âm lượng vọt lên gấp đôi): cho phép nhận lại cùng một nốt
    const attack = rms > 0.02 && rms > this.level * 2;
    this.level = Math.max(rms, this.level * 0.9);
    if (midi === null) {
      if (this.silentSince === null) this.silentSince = time;
      if (time - this.silentSince >= GAP) this.last = null;
      this.cand = null;
      return null;
    }
    this.silentSince = null;
    if (attack) this.last = null;
    const m = Math.round(midi);
    if (Math.abs(midi - m) > 0.4) { this.cand = null; return null; }
    if (m !== this.cand) { this.cand = m; this.since = time; return null; }
    if (time - this.since >= STABLE && m !== this.last) { this.last = m; return m; }
    return null;
  }
}

/** nốt dễ nhất trên nhạc cụ cho một cao độ (để chỉ chỗ bấm khi người tập trả lời sai) */
export function easiestNote(layout: HarpNote[], midi: number): HarpNote | undefined {
  return layout.filter((n) => n.midi === midi).sort((a, b) => (EASY.has(b.technique) ? 1 : 0) - (EASY.has(a.technique) ? 1 : 0) || (a.fingerCost ?? 0) - (b.fingerCost ?? 0))[0];
}
