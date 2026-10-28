/**
 * Tập bồi âm đàn bầu: tách từng lần gảy từ luồng micro (âm lượng + cao độ mỗi khung hình) rồi chấm:
 *   ok     — ra đúng tiếng bồi ở điểm đang tập
 *   open   — ra cao độ dây buông: tay chưa chạm dây, hoặc chạm lệch xa điểm bồi
 *   wrong  — ra tiếng bồi của điểm khác: chạm nhầm điểm
 *   muted  — có tiếng gảy nhưng không ra cao độ rõ: ấn tay quá mạnh / nhấc tay chậm
 *   off    — ra cao độ rõ nhưng không khớp điểm nào: dây lên chưa đúng tông hoặc đang nắn cần
 */
import { BAU_NODES, BAU_OPEN } from '../data/danbau';

export type PluckKind = 'ok' | 'open' | 'wrong' | 'muted' | 'off';

export interface PluckResult {
  kind: PluckKind;
  /** cao độ đo được (MIDI, số thực), null khi tắt tiếng */
  midi: number | null;
  /** lệch so với nốt mục tiêu (cent), khi ok */
  cents?: number;
  /** điểm bồi chạm nhầm, khi wrong */
  node?: number;
}

/** cao độ (MIDI) của điểm bồi n với dây buông lệch `offset` nửa cung so với dây Đô */
export const nodeMidi = (n: number, offset: number) => BAU_OPEN + offset + (BAU_NODES.find((x) => x.n === n)?.semis ?? 0);

/** chấm một lần gảy từ các cao độ đo được trong lần gảy đó */
export function classifyPluck(pitches: number[], target: number, offset: number): PluckResult {
  if (pitches.length < 3) return { kind: 'muted', midi: null };
  const sorted = [...pitches].sort((a, b) => a - b);
  const m = sorted[Math.floor(sorted.length / 2)];
  const near = (x: number, tol = 0.5) => Math.abs(m - x) <= tol;
  const t = nodeMidi(target, offset);
  if (near(t)) return { kind: 'ok', midi: m, cents: Math.round((m - t) * 100) };
  if (near(BAU_OPEN + offset)) return { kind: 'open', midi: m };
  // bồi 1/7 lệch tự nhiên ~ −31 cent so với Sib: nới khoảng nhận
  const other = BAU_NODES.find(({ n }) => n > 1 && n !== target && near(nodeMidi(n, offset), n === 7 ? 0.7 : 0.5));
  if (other) return { kind: 'wrong', midi: m, node: other.n };
  return { kind: 'off', midi: m };
}

/** ngưỡng âm lượng (RMS) */
const ONSET = 0.025;
const RELEASE = 0.012;
/** thời gian nghe mỗi lần gảy trước khi chấm (giây) */
const LISTEN = 0.45;

/**
 * Tách lần gảy: âm lượng vọt lên trên ngưỡng là bắt đầu một lần gảy; nghe LISTEN giây (bỏ 60 ms đầu — tiếng que gảy),
 * gom cao độ rồi chấm; sau đó chờ tiếng lặng xuống (hoặc một cú gảy mạnh mới) mới nhận lần tiếp theo.
 */
export class PluckDetector {
  private state: 'idle' | 'listen' | 'wait' = 'idle';
  private start = 0;
  private pitches: number[] = [];
  private peak = 0;
  private quiet = 0;

  constructor(private target: number, private offset: number) {}

  setTarget(target: number, offset: number) {
    this.target = target;
    this.offset = offset;
    this.state = 'idle';
  }

  /** đưa vào một khung hình: thời điểm (giây), âm lượng, cao độ (null nếu không rõ). Trả về kết quả khi chấm xong một lần gảy */
  feed(time: number, rms: number, midi: number | null): PluckResult | null {
    if (this.state === 'idle' || (this.state === 'wait' && rms > Math.max(ONSET, this.peak * 1.8))) {
      if (rms < ONSET) return null;
      this.state = 'listen';
      this.start = time;
      this.pitches = [];
      this.peak = rms;
      this.quiet = 0;
      return null;
    }
    if (this.state === 'listen') {
      this.peak = Math.max(this.peak, rms);
      if (midi !== null && time - this.start > 0.06) this.pitches.push(midi);
      if (time - this.start >= LISTEN) {
        this.state = 'wait';
        this.peak = rms;
        return classifyPluck(this.pitches, this.target, this.offset);
      }
      return null;
    }
    // chờ lặng: tiếng tắt dần dưới ngưỡng vài khung là sẵn sàng cho lần gảy mới
    this.peak = Math.max(rms, this.peak * 0.97);
    this.quiet = rms < RELEASE ? this.quiet + 1 : 0;
    if (this.quiet >= 4) this.state = 'idle';
    return null;
  }
}

/** lời khuyên ngắn cho từng kết quả */
export function pluckAdvice(r: PluckResult, glyph: (n: number) => string): string {
  switch (r.kind) {
    case 'ok': return Math.abs(r.cents ?? 0) > 25 ? `Đúng tiếng bồi (lệch ${r.cents! > 0 ? '+' : ''}${r.cents} cent — kiểm tra lại dây buông).` : 'Đúng tiếng bồi!';
    case 'open': return 'Ra tiếng dây buông: cạnh bàn tay chưa chạm dây, hoặc chạm lệch xa điểm bồi.';
    case 'wrong': return `Ra tiếng bồi điểm ${glyph(r.node!)}: tay đặt nhầm điểm — dời tay cho đúng vạch.`;
    case 'muted': return 'Tiếng bị tắt: tay ấn quá mạnh hoặc nhấc tay chậm. Chỉ đặt hờ, gảy xong nhấc tay ngay.';
    case 'off': return 'Ra cao độ lạ: dây buông chưa đúng tông, hoặc cần đàn đang bị nắn. Lên lại dây bằng Dò nốt.';
  }
}

/* ---------- Tập nắn cần ---------- */

/** các bài nắn cần thường gặp: điểm bồi + số nửa cung nắn (dương = đẩy cần lên, âm = kéo cần xuống) */
export const BEND_DRILLS: { n: number; bend: number }[] = [
  { n: 4, bend: 2 }, { n: 5, bend: 1 }, { n: 6, bend: 2 }, { n: 8, bend: -1 },
  { n: 3, bend: 2 }, { n: 2, bend: 2 }, { n: 4, bend: -1 }, { n: 6, bend: 3 },
];

export type BendStatus = 'none' | 'under' | 'ok' | 'over';

/** khoảng chấp nhận (nửa cung): ±25 cent */
const BEND_TOL = 0.25;

/** so cao độ đang nghe với nốt cần nắn tới; under/over tính theo hướng nắn (đẩy lên: thấp = thiếu; kéo xuống: cao = thiếu) */
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
 * Đếm lần nắn đạt: cao độ phải ở trong khoảng đúng liên tục HOLD giây.
 * Sau một lần đạt, phải mất tiếng (gảy lại) mới tính lần sau — giữ nguyên không được tính nhiều lần.
 */
export class BendHold {
  private since: number | null = null;
  private done = false;
  private silent = 0;

  feed(time: number, status: BendStatus): boolean {
    if (status === 'none') {
      // vài khung không có cao độ liền nhau = dây tắt / gảy lại
      if (++this.silent >= 6) { this.done = false; this.since = null; }
      return false;
    }
    this.silent = 0;
    if (status !== 'ok') { this.since = null; return false; }
    if (this.done) return false;
    if (this.since === null) this.since = time;
    if (time - this.since >= HOLD) { this.done = true; return true; }
    return false;
  }

  reset() { this.since = null; this.done = false; this.silent = 0; }
}

export function bendAdvice(status: BendStatus, bend: number): string {
  const push = bend >= 0;
  switch (status) {
    case 'none': return 'Gảy bồi rồi nắn cần — app hiện cao độ ngay khi nghe thấy.';
    case 'under': return push ? 'Thiếu: đẩy cần thêm chút nữa.' : 'Thiếu: kéo cần ra thêm chút nữa.';
    case 'over': return push ? 'Quá tay: nới cần ra một chút.' : 'Quá tay: đẩy cần về một chút.';
    case 'ok': return 'Đúng rồi — giữ yên tay!';
  }
}
