/**
 * Chấm điểm hát karaoke: so cao độ giọng (từ micro) với nốt của từng âm tiết, theo thời gian thực.
 * - Không phân biệt quãng tám: hát thấp / cao hơn một quãng tám (giọng nam hát bài viết cho kèn) vẫn đúng.
 * - Tính độ trễ micro: cao độ đọc được là của tiếng hát trước đó một chút.
 * - Mỗi âm tiết có cửa sổ rộng hơn chút (vào sớm 80 ms, trễ 150 ms — người hát hay vào trễ hơn vào sớm).
 * Hàm thuần: nhận từng lần đọc (cao độ, phách) — test được không cần micro.
 */
import type { KLine, KSyl } from './karaoke';
import type { FlatEvent } from './tabText';

/** lệch trong ngần này (nửa cung) là đủ điểm */
export const FULL_WITHIN = 0.35;
/** lệch thêm ngần này nữa thì về 0 điểm */
export const ZERO_AFTER = 1.0;
const EARLY_SEC = 0.08;
const LATE_SEC = 0.15;

interface SylStat {
  li: number;
  si: number;
  syl: KSyl;
  /** điểm từng khung có tiếng hát */
  fs: number[];
  /** số khung (có / không tiếng) khi đang tới âm tiết này */
  core: number;
  voicedCore: number;
}

export interface KaraokeSylResult { li: number; si: number; text: string; score: number }

export interface KaraokeSummary {
  /** 0..100 */
  score: number;
  /** độ chuẩn cao độ trung bình của các khung có hát (0..1) */
  pitch: number;
  /** hát đủ dài / đúng lúc (0..1) */
  timing: number;
  /** số âm tiết đã tới / tổng âm tiết có lời */
  done: number;
  total: number;
  weak: KaraokeSylResult[];
  finished: boolean;
}

/** độ lệch (nửa cung) sau khi gập quãng tám */
export function foldedError(sung: number, target: number): number {
  const d = sung - target;
  return Math.abs(d - 12 * Math.round(d / 12));
}

export function frameScore(err: number): number {
  return Math.max(0, Math.min(1, 1 - (err - FULL_WITHIN) / ZERO_AFTER));
}

export class KaraokeScorer {
  private stats: SylStat[] = [];
  private recent: number[] = [];
  /** vệt cao độ gần đây để vẽ: phách hát, cao độ đã gập về quãng tám của nốt cần hát, đúng / sai */
  trail: { beat: number; midi: number; target: number; ok: boolean }[] = [];

  /**
   * @param flat nốt của bài (cao độ gốc — chưa đổi tông)
   * @param spb giây mỗi phách lúc phát
   * @param transpose nửa cung đang đổi tông
   */
  constructor(lines: KLine[], private flat: FlatEvent[], private spb: number, private transpose = 0) {
    lines.forEach((l, li) => {
      if (l.instrumental) return;
      l.syls.forEach((syl, si) => { if (syl.text) this.stats.push({ li, si, syl, fs: [], core: 0, voicedCore: 0 }); });
    });
  }

  /** cao độ cần hát (đã đổi tông) ở phách `beat` trong âm tiết */
  targetAt(syl: KSyl, beat: number): number | null {
    let midi: number | null = null;
    for (const i of syl.fi) {
      const f = this.flat[i];
      if (!f || f.midi === null) continue;
      if (midi === null || beat >= f.start - 1e-9) midi = f.midi;
    }
    return midi === null ? null : midi + this.transpose;
  }

  private find(beat: number): SylStat | null {
    const early = EARLY_SEC / this.spb, late = LATE_SEC / this.spb;
    let best: SylStat | null = null, bestDist = Infinity;
    for (const st of this.stats) {
      const { start, end } = st.syl;
      if (beat < start - early || beat > end + late) continue;
      // nằm trong âm tiết thì chọn ngay; nằm ở rìa thì chọn âm tiết gần nhất
      const dist = beat < start ? start - beat : beat >= end ? beat - end : 0;
      if (dist < bestDist) { best = st; bestDist = dist; if (dist === 0) break; }
    }
    return best;
  }

  /**
   * Một lần đọc micro.
   * @param sungMidi cao độ (số MIDI có lẻ) hoặc null khi im lặng
   * @param beat phách lúc tiếng đó được hát (đã trừ độ trễ micro)
   */
  feed(sungMidi: number | null, beat: number) {
    // lọc rung giọng / đọc nhầm lẻ tẻ: trung vị 3 lần đọc gần nhất
    if (sungMidi === null) this.recent = [];
    else { this.recent.push(sungMidi); if (this.recent.length > 3) this.recent.shift(); }
    const smooth = this.recent.length ? [...this.recent].sort((a, b) => a - b)[this.recent.length >> 1] : null;

    const st = this.find(beat);
    if (!st) return;
    const inCore = beat >= st.syl.start && beat < st.syl.end;
    if (inCore) st.core++;
    if (smooth === null) return;
    const target = this.targetAt(st.syl, beat);
    if (target === null) return;
    const err = foldedError(smooth, target);
    const fs = frameScore(err);
    st.fs.push(fs);
    if (inCore) st.voicedCore++;
    // vẽ: đưa cao độ hát về quãng tám của nốt cần hát
    const d = smooth - target;
    this.trail.push({ beat, midi: target + (d - 12 * Math.round(d / 12)), target, ok: fs >= 0.6 });
    if (this.trail.length > 600) this.trail.splice(0, 200);
  }

  private sylScore(st: SylStat): number {
    if (!st.fs.length) return 0;
    const pitch = st.fs.reduce((a, b) => a + b, 0) / st.fs.length;
    // hát được nửa độ dài nốt là đủ (lấy hơi, nhả chữ sớm không bị trừ)
    const cover = st.core ? Math.min(1, st.voicedCore / (0.5 * st.core)) : st.fs.length ? 1 : 0;
    return pitch * cover;
  }

  summary(finished = false): KaraokeSummary {
    const reached = this.stats.filter((s) => s.core > 0 || s.fs.length > 0);
    const scores = reached.map((s) => this.sylScore(s));
    const frames = reached.flatMap((s) => s.fs);
    const timing = reached.length
      ? reached.reduce((a, s) => a + (s.core ? Math.min(1, s.voicedCore / (0.5 * s.core)) : s.fs.length ? 1 : 0), 0) / reached.length
      : 0;
    const weak = reached
      .map((s, i) => ({ li: s.li, si: s.si, text: s.syl.text, score: Math.round(scores[i] * 100) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .filter((w) => w.score < 70);
    return {
      score: scores.length ? Math.round((100 * scores.reduce((a, b) => a + b, 0)) / scores.length) : 0,
      pitch: frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0,
      timing,
      done: reached.length,
      total: this.stats.length,
      weak,
      finished,
    };
  }
}
