/**
 * Tập cao độ bằng micro, dùng chung cho các nhạc cụ:
 *  - Bend / nhấn / nắn: từ nốt gốc kéo cao độ lên hoặc xuống tới nốt đích (bend kèn harmonica, nhấn dây đàn tranh, nắn cần đàn bầu)
 *  - Giữ nốt dài: thổi / kéo một nốt thật đều — đo giữ được bao lâu và cao độ chao bao nhiêu (sáo, kèn, pianica)
 */
import { HarpNote, HarpType, isDanBau, isFretted, isKalimba, isOrgan, isTranh } from './harp';

/** nhạc cụ có bài giữ nốt dài: nhạc cụ hơi (kèn, sáo, pianica) — đàn dây gảy và kalimba nốt tắt dần nên không tập kiểu này */
export const canHoldNote = (t: HarpType) => !isFretted(t) && !isKalimba(t) && !isTranh(t) && !isDanBau(t) && !isOrgan(t);

/* ---------- bend / nhấn ---------- */

export type BendStatus = 'none' | 'under' | 'ok' | 'over';

/** khoảng chấp nhận (nửa cung): ±25 cent */
const BEND_TOL = 0.25;

/** so cao độ đang nghe với nốt đích; under/over tính theo hướng kéo (lên: thấp = thiếu; xuống: cao = thiếu) */
export function bendStatus(midi: number | null, target: number, bend: number): { status: BendStatus; cents: number } {
  if (midi === null) return { status: 'none', cents: 0 };
  const d = midi - target;
  const cents = Math.round(d * 100);
  if (Math.abs(d) <= BEND_TOL) return { status: 'ok', cents };
  const short = bend >= 0 ? d < 0 : d > 0;
  return { status: short ? 'under' : 'over', cents };
}

/** giữ đúng cao độ bao lâu thì tính một lần đạt (giây) */
const HOLD = 0.5;

/**
 * Đếm lần đạt: cao độ phải ở trong khoảng đúng liên tục HOLD giây.
 * Sau một lần đạt, phải rời khỏi nốt đích (tắt tiếng, hoặc nhả về nốt gốc) mới tính lần sau.
 */
export class BendHold {
  private since: number | null = null;
  private done = false;
  private away = 0;

  feed(time: number, status: BendStatus): boolean {
    if (status !== 'ok') {
      this.since = null;
      // vài khung liền không ở nốt đích (tắt tiếng, gảy lại, nhả bend) thì sẵn sàng tính lần sau
      if (++this.away >= 6) this.done = false;
      return false;
    }
    this.away = 0;
    if (this.done) return false;
    if (this.since === null) this.since = time;
    if (time - this.since >= HOLD) { this.done = true; return true; }
    return false;
  }

  reset() { this.since = null; this.done = false; this.away = 0; }
}

export interface BendDrill {
  /** nốt đích (ký hiệu tab) */
  token: string;
  /** nốt gốc trước khi bend / nhấn */
  baseToken: string;
  base: number;
  target: number;
  /** số nửa cung kéo: dương = lên (nhấn), âm = xuống (bend) */
  bend: number;
}

const MAJOR = new Set([0, 2, 4, 5, 7, 9, 11]);
const BEND_TECH = new Set(['drawBend', 'blowBend', 'press']);

/**
 * Bài bend / nhấn lấy từ sơ đồ nhạc cụ: kèn harmonica — mọi nốt bend; đàn tranh — chỉ các nốt nhấn ra nốt trong gam
 * mà dây buông không có (Fa, Si với dây Bắc), ở khoảng dây giữa đàn. `keyOffset`: tông đàn (nửa cung so với Đô).
 */
export function bendDrills(layout: HarpNote[], type: HarpType, keyOffset = 0): BendDrill[] {
  const tranh = type.startsWith('tranh');
  const openPcs = new Set(layout.filter((n) => !BEND_TECH.has(n.technique)).map((n) => n.midi % 12));
  const out: BendDrill[] = [];
  for (const n of layout) {
    if (!BEND_TECH.has(n.technique)) continue;
    const base = layout.find((b) => b.hole === n.hole && b.dir === n.dir && !b.over && !b.slide && !BEND_TECH.has(b.technique));
    if (!base) continue;
    if (tranh && (openPcs.has(n.midi % 12) || !MAJOR.has((n.midi - keyOffset + 120) % 12) || n.hole < 3 || n.hole > 13)) continue;
    out.push({ token: n.token, baseToken: base.token, base: base.midi, target: n.midi, bend: n.midi - base.midi });
  }
  return out;
}

/* ---------- giữ nốt dài ---------- */

export interface HoldResult {
  /** giữ được bao lâu (giây) */
  secs: number;
  /** độ chao: độ lệch chuẩn cao độ (cent) */
  spread: number;
  /** lệch trung bình so với nốt chuẩn (cent): âm = non, dương = già */
  drift: number;
}

/** thời gian mất tiếng / lạc nốt cho phép giữa chừng (giây) */
const GAP = 0.25;
/** ngắn hơn thế thì không tính là một lần giữ nốt */
const MIN_SECS = 0.8;
/** mục tiêu mỗi lần giữ (giây) */
export const HOLD_GOAL = 4;

const stats = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  return { mean, sd };
};

/** theo dõi một lần giữ nốt: trả về tiến độ mỗi khung và kết quả khi nốt dừng */
export class NoteHold {
  private start: number | null = null;
  private lastOn = 0;
  private cents: number[] = [];

  constructor(private target: number) {}

  setTarget(target: number) { this.target = target; this.start = null; this.cents = []; }

  feed(time: number, midi: number | null): { live: { secs: number; cents: number; spread: number } | null; done: HoldResult | null } {
    const on = midi !== null && Math.abs(midi - this.target) <= 0.5;
    if (on) {
      if (this.start === null) { this.start = time; this.cents = []; }
      this.lastOn = time;
      this.cents.push((midi! - this.target) * 100);
      // vài khung đầu là lúc vào nốt (tiếng lưỡi, hơi chưa đều): không tính vào độ chao
      const steady = this.cents.length > 8 ? this.cents.slice(6) : this.cents;
      return { live: { secs: time - this.start, cents: Math.round(this.cents[this.cents.length - 1]), spread: Math.round(stats(steady).sd) }, done: null };
    }
    if (this.start !== null && time - this.lastOn > GAP) {
      const secs = this.lastOn - this.start;
      const steady = this.cents.length > 8 ? this.cents.slice(6) : this.cents;
      this.start = null;
      if (secs < MIN_SECS) return { live: null, done: null };
      const { mean, sd } = stats(steady);
      return { live: null, done: { secs: Math.round(secs * 10) / 10, spread: Math.round(sd), drift: Math.round(mean) } };
    }
    return { live: null, done: null };
  }
}

/** nhận xét một lần giữ nốt */
export function holdGrade(r: HoldResult): { ok: boolean; text: string } {
  const steady = r.spread <= 8 ? 'rất vững' : r.spread <= 15 ? 'vững' : 'còn chao';
  const tune = Math.abs(r.drift) <= 15 ? 'đúng cao độ' : r.drift < 0 ? `non ${-r.drift} cent (hơi yếu hoặc chưa bịt kín)` : `già ${r.drift} cent (hơi mạnh quá)`;
  const ok = r.secs >= HOLD_GOAL && r.spread <= 15 && Math.abs(r.drift) <= 25;
  return { ok, text: `Giữ ${r.secs} giây, ${steady} (chao ±${r.spread} cent), ${tune}.` };
}
