/**
 * Tập hợp âm guitar / ukulele bằng micro: sau mỗi lần quạt, lấy phổ tần số trung bình của tiếng đàn rồi so với thế bấm:
 *   weak    — dây cần kêu nhưng gần như không nghe thấy: ngón tay chạm vào dây đó, bấm chưa đủ lực, hoặc gảy sót
 *   extra   — dây đánh dấu × (không đánh) vẫn kêu: quạt trúng dây thừa
 *   foreign — có nốt không thuộc thế bấm (và không phải hoạ âm của các nốt đúng): bấm lệch phím / nhầm dây
 * Cùng một cao độ cách quãng tám (ví dụ Đô3 và Đô4) thì hoạ âm của nốt trầm che nốt cao, nên dây cao đó không chấm được.
 */
import { ChordInstrument, chordShape } from '../data/chordShapes';
import { GUITAR_TUNING, UKULELE_TUNING } from '../data/guitar';
import { hzToMidiFloat, midiToHz } from './harp';

/** phổ biên độ (tuyến tính) và độ rộng mỗi ô tần số (Hz) */
export interface Spectrum { mag: Float32Array; binHz: number }

export type ChordIssue =
  | { kind: 'weak'; string: number; midi: number }
  | { kind: 'extra'; string: number; midi: number }
  | { kind: 'foreign'; midi: number };

export interface ChordVerdict {
  kind: 'ok' | 'issues' | 'quiet';
  issues: ChordIssue[];
  /** độ lớn từng dây so với dây lớn nhất (dB, ≤ 0), từ dây trầm sang dây cao; null = dây không đánh hoặc không chấm được */
  levels: (number | null)[];
}

const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-9));
/** khoảng cách hai tần số (cent) */
const centsBetween = (a: number, b: number) => 1200 * Math.log2(a / b);

/**
 * biên độ đỉnh phổ trong khoảng ±cents quanh một tần số. Chỉ tính đỉnh thật (lớn hơn các ô hai bên):
 * sườn của một nốt sát bên (bấm lệch một phím) lấn vào khoảng này không được tính là có nốt.
 */
export function bandPeak(s: Spectrum, hz: number, cents = 40): number {
  const lo = Math.max(2, Math.floor((hz * 2 ** (-cents / 1200)) / s.binHz));
  const hi = Math.min(s.mag.length - 3, Math.max(lo + 1, Math.ceil((hz * 2 ** (cents / 1200)) / s.binHz)));
  let m = 0;
  for (let i = lo; i <= hi; i++) {
    const v = s.mag[i];
    if (v > m && v >= s.mag[i - 1] && v >= s.mag[i + 1] && v >= s.mag[i - 2] && v >= s.mag[i + 2]) m = v;
  }
  return m;
}

/** mức nền: trung vị biên độ trong dải tần guitar */
function noiseFloor(s: Spectrum, loHz: number, hiHz: number): number {
  const a = Array.from(s.mag.subarray(Math.floor(loHz / s.binHz), Math.ceil(hiHz / s.binHz))).sort((x, y) => x - y);
  return db(a[Math.floor(a.length / 2)] ?? 0);
}

/** cao độ dây buông, từ dây trầm sang dây cao (cùng thứ tự với thế bấm) */
export const openStrings = (inst: ChordInstrument) => [...(inst === 'guitar' ? GUITAR_TUNING : UKULELE_TUNING)].reverse();

/** dây có bị nốt khác che không: trùng hoạ âm (×2..×8) của một nốt khác đang kêu */
function shadowed(midi: number, others: number[]): boolean {
  return others.some((o) => o < midi && [12, 19, 24, 28, 31, 34, 36].some((h) => Math.abs(midi - o - h) < 0.3));
}

/** dây yếu hơn dây lớn nhất bao nhiêu dB thì coi là câm */
const WEAK_DB = 24;
/** dây × kêu to tới mức này (so với dây lớn nhất) thì coi là quạt trúng */
const EXTRA_DB = 14;
/** nốt lạ phải to tới mức này mới tính */
const FOREIGN_DB = 14;
/** tiếng đàn phải nổi hơn nền bao nhiêu dB */
const SIGNAL_DB = 18;

export function judgeChord(s: Spectrum, name: string, inst: ChordInstrument): ChordVerdict | null {
  const shape = chordShape(name, inst);
  if (!shape) return null;
  const open = openStrings(inst);
  const n = shape.length;
  const expected = shape.map((f, i) => (f < 0 ? null : open[i] + f));
  const played = expected.filter((m): m is number => m !== null);
  const raw = expected.map((m) => (m === null ? null : db(bandPeak(s, midiToHz(m)))));
  const ref = Math.max(...raw.filter((x): x is number => x !== null));
  const floor = noiseFloor(s, 70, 1100);
  const levels = raw.map((x) => (x === null ? null : Math.round(x - ref)));
  if (ref - floor < SIGNAL_DB) return { kind: 'quiet', issues: [], levels };

  const issues: ChordIssue[] = [];
  expected.forEach((m, i) => {
    if (m === null || shadowed(m, played)) { if (m !== null) levels[i] = null; return; }
    if (raw[i]! < ref - WEAK_DB) issues.push({ kind: 'weak', string: n - i, midi: m });
  });
  // dây × vẫn kêu
  const extras: number[] = [];
  shape.forEach((f, i) => {
    if (f >= 0) return;
    const m = open[i];
    if (played.some((p) => Math.abs(p - m) < 0.3) || shadowed(m, played)) return;
    if (db(bandPeak(s, midiToHz(m))) > ref - EXTRA_DB) { issues.push({ kind: 'extra', string: n - i, midi: m }); extras.push(m); }
  });
  // nốt lạ: đỉnh phổ không phải nốt đúng hay hoạ âm của nốt đúng / dây thừa
  const sources = [...played, ...extras].map(midiToHz);
  const seen = new Set<number>();
  const lo = Math.ceil(75 / s.binHz), hi = Math.min(s.mag.length - 3, Math.floor(1100 / s.binHz));
  for (let i = lo; i <= hi; i++) {
    const v = s.mag[i];
    if (db(v) < ref - FOREIGN_DB) continue;
    if (v < s.mag[i - 1] || v < s.mag[i + 1] || v < s.mag[i - 2] || v < s.mag[i + 2]) continue;
    const hz = i * s.binHz;
    const explained = sources.some((f0) => {
      const k = Math.round(hz / f0);
      return k >= 1 && k <= 8 && Math.abs(centsBetween(hz, k * f0)) < 45;
    });
    if (explained) continue;
    const midi = Math.round(hzToMidiFloat(hz));
    // hoạ âm của nốt lạ đã báo (quét từ trầm lên nên gặp nốt gốc trước) cũng không báo lại
    sources.push(hz);
    if (seen.has(midi)) continue;
    seen.add(midi);
    issues.push({ kind: 'foreign', midi });
  }
  return { kind: issues.length ? 'issues' : 'ok', issues, levels };
}

/* ---------- tách lần quạt ---------- */

const ONSET = 0.03;
/** bỏ qua tiếng phím gảy đầu, lấy phổ trong khoảng này sau lúc quạt (giây) */
const FROM = 0.12;
const TO = 0.5;

/**
 * Tách lần quạt từ luồng micro: âm lượng vọt lên là một lần quạt; cộng phổ các khung từ FROM tới TO giây rồi trả phổ trung bình.
 * Sau đó chờ tiếng lặng hẳn hoặc một cú quạt mạnh mới (dây guitar ngân lâu nên không chờ tắt hẳn).
 */
export class StrumDetector {
  private state: 'idle' | 'listen' | 'wait' = 'idle';
  private start = 0;
  private sum: Float32Array | null = null;
  private frames = 0;
  private peak = 0;
  private binHz = 1;

  feed(time: number, rms: number, mag: Float32Array, binHz: number): Spectrum | null {
    const attack = this.state === 'wait' && time - this.start > TO + 0.1 && rms > Math.max(ONSET, this.peak * 1.6);
    if (this.state === 'idle' || attack) {
      if (rms < ONSET) return null;
      this.state = 'listen';
      this.start = time;
      this.sum = new Float32Array(mag.length);
      this.frames = 0;
      this.peak = rms;
      this.binHz = binHz;
      return null;
    }
    if (this.state === 'listen') {
      const t = time - this.start;
      if (t >= FROM) {
        for (let i = 0; i < mag.length; i++) this.sum![i] += mag[i];
        this.frames++;
      }
      if (t >= TO) {
        this.state = 'wait';
        this.peak = rms;
        const out = this.sum!;
        for (let i = 0; i < out.length; i++) out[i] /= Math.max(1, this.frames);
        return { mag: out, binHz: this.binHz };
      }
      return null;
    }
    this.peak = Math.max(rms, this.peak * 0.97);
    if (rms < ONSET * 0.4) this.state = 'idle';
    return null;
  }
}

/** lời khuyên cho từng lỗi; tên nốt theo cài đặt */
export function issueText(x: ChordIssue, name: (midi: number) => string): string {
  switch (x.kind) {
    case 'weak': return `Dây ${x.string} (${name(x.midi)}) gần như không kêu: ngón tay khác đang chạm vào dây này, bấm chưa đủ lực (bấm sát phím đàn), hoặc quạt sót.`;
    case 'extra': return `Dây ${x.string} (dấu ×) cũng kêu: bắt đầu quạt từ dây kế bên, hoặc chạm hờ một ngón tay vào dây này cho nó câm.`;
    case 'foreign': return `Có nốt ${name(x.midi)} không thuộc hợp âm: có ngón bấm lệch phím hoặc nhầm dây — so lại với sơ đồ.`;
  }
}
