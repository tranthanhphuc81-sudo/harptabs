/**
 * Bản thu → tab: dò giai điệu trong file âm thanh / ghi âm, đoán tempo, làm tròn theo phách, đoán giọng,
 * rồi đưa về cùng dạng với kết quả đọc file MIDI để xếp tab (lib/ai.ts → aiToTab).
 *
 *  1. detectNotes (chạy trong worker): cao độ theo thời gian (YIN cho bản thu một giọng, melodyMix cho
 *     bài có nhạc đệm) → tách nốt (audioAlign.segmentNotes) → bỏ nốt quá ngắn / ngoài tầm.
 *  2. estimateTempo: thử từng tempo, chọn tempo mà điểm bắt đầu các nốt rơi khít lưới phách / nửa phách nhất
 *     (có ưu tiên nhẹ cho tempo phổ thông để khỏi chọn gấp đôi / một nửa).
 *  3. quantizeNotes: làm tròn đầu / cuối nốt theo lưới, nối liền chỗ ngắt hơi ngắn, chọn chỗ đặt vạch nhịp
 *     sao cho nốt dài / phách mạnh rơi đầu ô.
 * Không phụ thuộc DOM (test được trong Node).
 */
import type { AiTranscription } from '../../shared/ai';
import { AudioNote, segmentNotes, trackPitch } from './audioAlign';
import { trackMelodyInMix } from './melodyMix';
import { MelNote, toTranscription } from './musicFile';

/** solo: một giọng (tự hát, ngân nga, thổi kèn); mix: bài hát gốc có nhạc đệm */
export type RecordingKind = 'solo' | 'mix';

/** Nốt đã làm tròn cao độ (nửa cung) */
export interface DetectedNote { start: number; end: number; midi: number }

const MIN_NOTE_SEC = 0.07;

export function detectNotes(samples: Float32Array, sampleRate: number, kind: RecordingKind): DetectedNote[] {
  const frames = kind === 'mix' ? trackMelodyInMix(samples, sampleRate) : trackPitch(samples, sampleRate);
  return cleanNotes(segmentNotes(frames));
}

export function cleanNotes(notes: AudioNote[]): DetectedNote[] {
  return notes
    .map((n) => ({ start: n.start, end: n.end, midi: Math.round(n.midi) }))
    .filter((n) => n.end - n.start >= MIN_NOTE_SEC && n.midi >= 36 && n.midi <= 100);
}

// ───────────────────────── tempo ─────────────────────────

/** Độ khít của các điểm bắt đầu nốt với lưới chu kỳ `period` (0..1) và pha tốt nhất (giây) */
function gridFit(onsets: number[], weights: number[], period: number): { r: number; phase: number } {
  let re = 0, im = 0, sw = 0;
  onsets.forEach((t, i) => {
    const a = (2 * Math.PI * t) / period;
    re += weights[i] * Math.cos(a);
    im += weights[i] * Math.sin(a);
    sw += weights[i];
  });
  const ang = Math.atan2(im, re);
  return { r: sw ? Math.hypot(re, im) / sw : 0, phase: (((ang / (2 * Math.PI)) * period) % period + period) % period };
}

export interface TempoGuess { bpm: number; /** thời điểm (giây) của một phách bất kỳ — gốc của lưới */ offset: number; confidence: number }

export function estimateTempo(notes: DetectedNote[]): TempoGuess {
  if (notes.length < 4) return { bpm: 90, offset: notes[0]?.start ?? 0, confidence: 0 };
  const onsets = notes.map((n) => n.start);
  // nốt dài thường rơi đúng phách hơn nốt luyến láy ngắn
  const weights = notes.map((n) => Math.min(1, Math.max(0.2, n.end - n.start)));
  let best = { bpm: 90, offset: onsets[0], score: -Infinity, r: 0 };
  for (let bpm = 50; bpm <= 180; bpm += 0.5) {
    const beat = 60 / bpm;
    const b = gridFit(onsets, weights, beat), h = gridFit(onsets, weights, beat / 2);
    // ưu tiên nhẹ tempo 70–120 (bài hát phổ thông) để không nhảy sang gấp đôi / một nửa
    const prior = Math.exp(-((Math.log2(bpm / 92) / 0.55) ** 2) / 2);
    const score = (0.55 * b.r + 0.45 * h.r) * (0.75 + 0.25 * prior);
    if (score > best.score) best = { bpm, offset: b.phase, score, r: b.r };
  }
  // tinh chỉnh: gán mỗi nốt vào nửa phách gần nhất rồi kẻ đường thẳng khớp nhất (thời điểm = gốc + vị trí × độ dài phách)
  let beat = 60 / best.bpm, offset = best.offset;
  for (let it = 0; it < 2; it++) {
    const pos = onsets.map((t) => Math.round((t - offset) / beat * 2) / 2);
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pos.forEach((x, i) => { const w = weights[i], y = onsets[i]; sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y; });
    const den = sw * sxx - sx * sx;
    if (Math.abs(den) < 1e-9) break;
    const slope = (sw * sxy - sx * sy) / den;
    if (!(slope > 60 / 200 && slope < 60 / 40) || Math.abs(slope / beat - 1) > 0.08) break;
    beat = slope;
    offset = (sy - slope * sx) / sw;
  }
  return { bpm: Math.round(60 / beat), offset, confidence: best.r };
}

// ───────────────────────── làm tròn theo phách ─────────────────────────

export interface QuantizeOptions {
  bpm: number;
  /** giây — một điểm rơi đúng phách */
  offset: number;
  /** số phách đen mỗi ô (4/4 → 4, 3/4 → 3, 6/8 → 3) */
  barBeats: number;
  /** lưới làm tròn tính bằng phách: 0.5 (móc đơn) hoặc 0.25 (móc kép) */
  grid: number;
}

export interface Quantized { notes: MelNote[]; pickupBeats: number }

export function quantizeNotes(notes: DetectedNote[], o: QuantizeOptions): Quantized {
  const beat = 60 / o.bpm;
  const q = (sec: number) => Math.round((sec - o.offset) / beat / o.grid) * o.grid;
  const out: MelNote[] = [];
  for (const n of notes) {
    let s = q(n.start);
    const prev = out[out.length - 1];
    if (prev && s <= prev.start) {
      // hai nốt rơi cùng ô lưới: nốt sau dời sang ô kế, trừ khi nó quá ngắn
      if (n.end - n.start < beat * o.grid * 0.6) continue;
      s = prev.start + o.grid;
    }
    const e = Math.max(s + o.grid, q(n.end));
    out.push({ start: s, beats: e - s, midi: n.midi });
  }
  // nốt chạm nốt sau thì cắt; ngắt hơi ngắn (≤ 1 ô lưới, hoặc nốt kêu < 60% khoảng tới nốt sau và lặng ≤ 1 phách) thì nối liền
  for (let i = 0; i < out.length - 1; i++) {
    const n = out[i], next = out[i + 1].start;
    let e = Math.min(n.start + n.beats, next);
    const gap = next - e;
    if (gap > 0 && (gap <= o.grid + 1e-9 || ((e - n.start) / (next - n.start) < 0.6 && gap <= 1))) e = next;
    n.beats = e - n.start;
  }
  if (!out.length) return { notes: [], pickupBeats: 0 };

  // vạch nhịp: thử từng vị trí, chọn chỗ có nhiều nốt dài bắt đầu đúng đầu ô (phách giữa ô 4/4 tính một nửa)
  let bestPhase = 0, bestScore = -Infinity;
  for (let p = 0; p < o.barBeats - 1e-9; p += o.grid) {
    let score = 0;
    for (const n of out) {
      const pos = (((n.start - p) % o.barBeats) + o.barBeats) % o.barBeats;
      const w = Math.min(2, n.beats);
      if (pos < 1e-6) score += w;
      else if (o.barBeats === 4 && Math.abs(pos - 2) < 1e-6) score += 0.5 * w;
      else if (Math.abs(pos - Math.round(pos)) > 1e-6) score -= 0.15 * w; // nốt dài bắt đầu lệch phách: kém hợp lý
    }
    if (score > bestScore + 1e-9) { bestScore = score; bestPhase = p; }
  }
  const first = out[0].start;
  const pickupBeats = (((bestPhase - first) % o.barBeats) + o.barBeats) % o.barBeats;
  // dời cả bài về 0 (nốt đầu tiên bắt đầu ở phách 0)
  for (const n of out) n.start -= first;
  return { notes: out, pickupBeats: Math.round(pickupBeats * 1000) / 1000 };
}

// ───────────────────────── giọng ─────────────────────────

// bảng Krumhansl–Kessler: mức "hợp giọng" của 12 bậc trong giọng trưởng / thứ
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm']);

function corr(a: number[], b: number[]): number {
  const ma = a.reduce((s, x) => s + x, 0) / 12, mb = b.reduce((s, x) => s + x, 0) / 12;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Giọng bài đoán từ độ dài các bậc (vd "F", "Am"); nốt cuối bài được tính thêm vì bài hay kết ở chủ âm */
export function guessKey(notes: MelNote[]): string | undefined {
  const pcs = Array<number>(12).fill(0);
  for (const n of notes) if (n.midi !== null) pcs[n.midi % 12] += n.beats;
  const last = [...notes].reverse().find((n) => n.midi !== null);
  if (last?.midi != null) pcs[last.midi % 12] += 2;
  if (pcs.every((x) => x === 0)) return undefined;
  let best = { key: 'C', r: -Infinity };
  for (let k = 0; k < 12; k++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - k + 12) % 12]);
    const rMaj = corr(pcs, rot(MAJOR)), rMin = corr(pcs, rot(MINOR));
    if (rMaj > best.r) best = { key: KEY_NAMES[k], r: rMaj };
    if (rMin > best.r) best = { key: `${KEY_NAMES[k]}m`, r: rMin };
  }
  return best.key;
}

// ───────────────────────── gộp lại ─────────────────────────

export interface AudioTabOptions extends QuantizeOptions { title: string; artist?: string; timeSig: string }

export function audioToTranscription(notes: DetectedNote[], o: AudioTabOptions): AiTranscription & { songKey?: string } {
  const { notes: mel, pickupBeats } = quantizeNotes(notes, o);
  const songKey = guessKey(mel);
  const warnings: string[] = [];
  if (mel.length < 8) warnings.push('Dò được rất ít nốt — thử bản thu rõ hơn, ít tiếng ồn.');
  return {
    ...toTranscription(mel, {
      title: o.title || 'Bài từ bản thu', artist: o.artist, songKey, flats: !!songKey && FLAT_KEYS.has(songKey),
      tempo: o.bpm, timeSig: o.timeSig, barBeats: o.barBeats, pickupBeats, warnings,
    }),
    confidence: 0.5,
  };
}
