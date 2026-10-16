/**
 * Đối chiếu bản quét với bản thu MỘT GIỌNG (tự thổi kèn / hát / ngân nga giai điệu):
 *  1. dò cao độ bản thu (YIN, hạ mẫu xuống ~11 kHz cho nhanh) → tách thành từng nốt
 *  2. gióng hàng chuỗi nốt bản quét với chuỗi nốt bản thu (quy hoạch động), chấp nhận hát khác
 *     giọng / khác quãng tám, nhanh chậm tuỳ ý
 *  3. chỗ hai bên khác nhau → gợi ý sửa: sai cao độ, sót nốt, có thể thừa nốt, sai trường độ
 * Chạy hoàn toàn trên máy, không phụ thuộc DOM (test được trong Node).
 */
import { yin } from '../audio/pitch';
import { hzToMidiFloat } from './harp';
import { trackMelodyInMix } from './melodyMix';

// ───────────────────────── dò cao độ ─────────────────────────

export interface PitchFrame { t: number; midi: number | null; rms: number }

const TARGET_SR = 11025;
export const HOP_SEC = 0.01;

/** Hạ tần số lấy mẫu (lọc trung bình khối) — giọng người / kèn đều dưới ~2 kHz */
function downsample(x: Float32Array, sr: number): { y: Float32Array; sr: number } {
  const f = Math.max(1, Math.round(sr / TARGET_SR));
  if (f === 1) return { y: x, sr };
  const y = new Float32Array(Math.floor(x.length / f));
  for (let i = 0; i < y.length; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += x[i * f + k];
    y[i] = s / f;
  }
  return { y, sr: sr / f };
}

/** Cao độ theo thời gian (mỗi 10 ms); khung lặng / tạp âm → midi null */
export function trackPitch(samples: Float32Array, sampleRate: number): PitchFrame[] {
  const { y, sr } = downsample(samples, sampleRate);
  const win = 512, hop = Math.max(1, Math.round(sr * HOP_SEC));
  const buf = new Float32Array(win);
  const raw: { t: number; hz: number | null; clarity: number; rms: number }[] = [];
  for (let p = 0; p + win <= y.length; p += hop) {
    let e = 0;
    for (let i = 0; i < win; i++) { buf[i] = y[p + i]; e += buf[i] * buf[i]; }
    const rms = Math.sqrt(e / win);
    const r = rms > 1e-4 ? yin(buf, sr, 70, 1200, 0.15) : null;
    raw.push({ t: (p + win / 2) / sr, hz: r?.hz ?? null, clarity: r?.clarity ?? 0, rms });
  }
  if (!raw.length) return [];
  // ngưỡng lặng theo chính bản thu: nền ồn (bách phân vị 20) và mức to nhất
  const sorted = raw.map((f) => f.rms).sort((a, b) => a - b);
  // (hát / thổi liền gần như không nghỉ thì "nền" rơi vào chính tiếng nốt → chỉ tin khi nhỏ hẳn so với đỉnh)
  const floor = sorted[Math.floor(sorted.length * 0.1)], peak = sorted[Math.floor(sorted.length * 0.98)];
  const gate = Math.max(floor < peak * 0.25 ? floor * 2.5 : 0, peak * 0.06, 1e-4);
  const frames: PitchFrame[] = raw.map((f) => ({ t: f.t, rms: f.rms, midi: f.hz && f.rms >= gate && f.clarity >= 0.6 ? hzToMidiFloat(f.hz) : null }));
  // sửa nhảy quãng tám lẻ tẻ (lỗi hay gặp của YIN): so với trung vị lân cận
  for (let i = 0; i < frames.length; i++) {
    const m = frames[i].midi;
    if (m === null) continue;
    const near = frames.slice(Math.max(0, i - 4), i + 5).map((f) => f.midi).filter((v): v is number => v !== null).sort((a, b) => a - b);
    const med = near[near.length >> 1];
    for (const d of [12, -12]) if (Math.abs(m + d - med) < 0.8 && Math.abs(m - med) > 10) frames[i].midi = m + d;
  }
  return frames;
}

// ───────────────────────── tách nốt ─────────────────────────

export interface AudioNote { start: number; end: number; midi: number }

const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/**
 * Tách nốt: đoạn có cao độ liền, ổn định. Nốt mới khi cao độ đổi ≥ 0.7 nửa cung (giữ ≥ 3 khung), khi lặng,
 * hoặc khi thổi / hát lại cùng một nốt (âm lượng tụt rồi lên lại).
 */
export function segmentNotes(frames: PitchFrame[]): AudioNote[] {
  const out: AudioNote[] = [];
  let cur: { i0: number; ms: number[]; peak: number; dip: number } | null = null;
  const close = (i1: number) => {
    if (cur && i1 - cur.i0 >= 7) out.push({ start: frames[cur.i0].t, end: frames[i1 - 1].t + HOP_SEC, midi: med(cur.ms) });
    cur = null;
  };
  let pending = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.midi === null) {
      // lặng ngắn (≤ 30 ms) trong lúc ngân vẫn tính cùng nốt
      if (cur && frames.slice(i, i + 4).every((g) => g.midi === null)) close(i);
      continue;
    }
    if (!cur) { cur = { i0: i, ms: [f.midi], peak: f.rms, dip: Infinity }; pending = 0; continue; }
    const m = med(cur.ms.slice(-15));
    if (Math.abs(f.midi - m) >= 0.7) {
      // đổi cao độ: chỉ tính khi giữ ổn định vài khung (không phải luyến láy / rung)
      pending++;
      if (pending >= 3) { const start = i - pending + 1; close(start); cur = { i0: start, ms: frames.slice(start, i + 1).map((g) => g.midi ?? f.midi!), peak: f.rms, dip: Infinity }; pending = 0; }
      continue;
    }
    pending = 0;
    // thổi / hát lại cùng nốt: âm lượng tụt dưới 45% đỉnh rồi bật lên lại ≥ 1.8 lần chỗ trũng
    cur.dip = Math.min(cur.dip, f.rms);
    if (cur.dip < cur.peak * 0.45 && f.rms > cur.dip * 1.8 && f.rms > cur.peak * 0.6 && i - cur.i0 >= 8) {
      close(i);
      cur = { i0: i, ms: [f.midi], peak: f.rms, dip: Infinity };
      continue;
    }
    if (f.rms > cur.peak) { cur.peak = f.rms; cur.dip = Infinity; }
    cur.ms.push(f.midi);
  }
  close(frames.length);
  return out;
}

// ───────────────────────── gióng hàng & gợi ý ─────────────────────────

/** Nốt bản quét theo thứ tự chơi; rest = dấu lặng (guess = máy tự chèn vào ô thiếu phách) */
export interface ScoreNote {
  id: string; midi: number | null; beats: number; guess?: boolean;
  /** ô nhịp chứa nốt (để biết ô nào thiếu / thừa phách) */
  bar?: string;
}

export type Suggestion =
  | { kind: 'pitch'; noteId: string; from: number; to: number; at: number }
  | { kind: 'fill'; noteId: string; to: number; beats: number; at: number }
  | { kind: 'missing'; afterId: string; to: number; beats: number; at: number }
  | { kind: 'extra'; noteId: string; from: number; at: number }
  | { kind: 'duration'; noteId: string; midi: number; from: number; to: number; at: number };

export interface Comparison {
  /** nửa cung lệch giữa bản thu và bản quét (hát thấp một quãng tám → -12) */
  offset: number;
  matched: number;
  scoreNotes: number;
  audioNotes: number;
  suggestions: Suggestion[];
}

const NICE = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2, 3, 4];
const nearestNice = (b: number) => NICE.reduce((best, v) => (Math.abs(Math.log(v / b)) < Math.abs(Math.log(best / b)) ? v : best), 1);

/** meter: số phách mỗi ô — để chỉ sửa trường độ / thêm nốt khi làm ô nhịp tròn phách */
export function compareWithAudio(score: ScoreNote[], audio: AudioNote[], meter?: number): Comparison {
  const barSum = new Map<string, number>();
  for (const s of score) if (s.bar !== undefined) barSum.set(s.bar, (barSum.get(s.bar) ?? 0) + s.beats);
  const deficit = (bar: string | undefined) => (bar === undefined || meter === undefined ? 0 : Math.round((meter - (barSum.get(bar) ?? meter)) * 1000) / 1000);
  // vị trí (phách) của từng nốt bản quét
  const onset: number[] = [];
  let t = 0;
  for (const n of score) { onset.push(t); t += n.beats; }
  const S = score.map((n, i) => ({ ...n, i, at: onset[i] })).filter((n) => n.midi !== null) as (ScoreNote & { i: number; at: number; midi: number })[];
  const A = audio;
  const n = S.length, m = A.length;
  const empty: Comparison = { offset: 0, matched: 0, scoreNotes: n, audioNotes: m, suggestions: [] };
  if (!n || !m) return empty;

  const dur = (a: AudioNote) => a.end - a.start;
  const matchCost = (s: number, a: number) => {
    const d = Math.abs(s - a);
    if (d < 0.5) return 0;
    if (Math.abs(d - 12) < 0.5) return 0.4; // máy dò nhầm quãng tám
    return d < 2.5 ? 0.7 : 1.2;
  };
  const SKIP_S = 0.9;
  const skipA = (a: AudioNote) => (dur(a) < 0.15 ? 0.25 : 0.9);
  const run = (k: number, keep: boolean) => {
    const D = new Float64Array((n + 1) * (m + 1));
    const B = keep ? new Uint8Array((n + 1) * (m + 1)) : null;
    const W = m + 1;
    for (let i = 1; i <= n; i++) { D[i * W] = D[(i - 1) * W] + SKIP_S; if (B) B[i * W] = 1; }
    // bản thu dư ở đầu / cuối (dạo đầu, hát thêm lần nữa, bài gốc có đoạn nhạc dạo) không tính phí
    for (let j = 1; j <= m; j++) { D[j] = 0; if (B) B[j] = 2; }
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
      const c0 = D[(i - 1) * W + j - 1] + matchCost(S[i - 1].midi + k, A[j - 1].midi);
      const c1 = D[(i - 1) * W + j] + SKIP_S;
      const c2 = D[i * W + j - 1] + skipA(A[j - 1]);
      let best = c0, b = 0;
      if (c1 < best) { best = c1; b = 1; }
      if (c2 < best) { best = c2; b = 2; }
      D[i * W + j] = best;
      if (B) B[i * W + j] = b;
    }
    let end = m;
    for (let j = 0; j <= m; j++) if (D[n * W + j] < D[n * W + end]) end = j;
    return { cost: D[n * W + end], B, end };
  };
  // lệch giọng: thử mọi độ lệch quanh độ lệch trung vị
  const guess = Math.round(med(A.map((a) => a.midi)) - med(S.map((s) => s.midi)));
  let bestK = guess, bestCost = Infinity;
  // (bài gốc có nhạc đệm: trung vị lẫn tiếng đàn → thử thêm quanh giọng gốc của bản nhạc)
  const ks = new Set<number>();
  for (let k = guess - 7; k <= guess + 7; k++) ks.add(k);
  for (let k = -12; k <= 12; k++) ks.add(k);
  for (const k of ks) { const c = run(k, false).cost; if (c < bestCost - 1e-9 || (Math.abs(c - bestCost) < 1e-9 && Math.abs(k) < Math.abs(bestK))) { bestCost = c; bestK = k; } }
  const { B, end } = run(bestK, true);
  const pairs: [number, number][] = [];
  const skippedS: number[] = [], skippedA: number[] = [];
  for (let i = n, j = end; i > 0;) {
    const b = B![i * (m + 1) + j];
    if (j > 0 && b === 0) { pairs.push([i - 1, j - 1]); i--; j--; }
    else if (j === 0 || b === 1) { skippedS.push(i - 1); i--; }
    else { skippedA.push(j - 1); j--; }
  }
  pairs.reverse();
  const k = bestK;

  // bản đồ thời gian phách → giây từ các cặp khớp chắc (cùng cao độ)
  const anchors = pairs.filter(([i, j]) => Math.abs(S[i].midi + k - A[j].midi) < 0.5).map(([i, j]) => ({ beat: S[i].at, sec: A[j].start }));
  const secToBeat = (sec: number) => {
    if (anchors.length < 2) return NaN;
    let a = 0;
    while (a + 2 < anchors.length && anchors[a + 1].sec <= sec) a++;
    const p = anchors[a], q = anchors[a + 1];
    return q.sec === p.sec ? p.beat : p.beat + ((sec - p.sec) * (q.beat - p.beat)) / (q.sec - p.sec);
  };
  /**
   * giây cho một phách quanh vị trí: trung vị tỉ số Δgiây/Δphách giữa các mốc liền nhau gần đó — bền với
   * chỗ bản quét sót cả ô nhịp (khoảng đó bản quét ngắn hơn thật, tỉ số vọt lên, trung vị bỏ qua)
   */
  const spbAt = (beat: number) => {
    const rs: { d: number; r: number }[] = [];
    for (let a = 0; a + 1 < anchors.length; a++) {
      const db = anchors[a + 1].beat - anchors[a].beat, ds = anchors[a + 1].sec - anchors[a].sec;
      if (db > 0.01 && ds > 0) rs.push({ d: Math.abs((anchors[a].beat + anchors[a + 1].beat) / 2 - beat), r: ds / db });
    }
    if (!rs.length) return NaN;
    return med(rs.sort((x, y) => x.d - y.d).slice(0, 12).map((x) => x.r));
  };
  const sugg: Suggestion[] = [];
  // sai cao độ: cặp khớp nhưng lệch ≥ nửa cung (không tính lệch đúng quãng tám), nốt thu đủ dài
  for (const [i, j] of pairs) {
    // so trong phạm vi một quãng tám (hát khác quãng tám không tính), giữ quãng tám của bản quét
    const diff = A[j].midi - k - S[i].midi;
    const r = diff - 12 * Math.round(diff / 12);
    if (Math.abs(r) >= 0.5 && dur(A[j]) >= 0.12) sugg.push({ kind: 'pitch', noteId: S[i].id, from: S[i].midi, to: S[i].midi + Math.round(r), at: S[i].at });
  }
  // sót nốt: nốt thu không khớp, đủ dài, nằm giữa hai mốc
  for (const j of skippedA) {
    const a = A[j];
    if (dur(a) < 0.15) continue;
    const beat = secToBeat(a.start), spb = spbAt(beat);
    if (!Number.isFinite(beat) || !Number.isFinite(spb) || spb <= 0) continue;
    const next = A[j + 1];
    let beats = nearestNice(((next ? Math.min(next.start, a.end + 0.25 * spb) : a.end) - a.start) / spb);
    const pitch = Math.round(a.midi - k);
    // ô có dấu lặng máy tự chèn trùng chỗ → biến dấu lặng thành nốt
    const gi = score.findIndex((s, idx) => s.midi === null && s.guess && onset[idx] - 0.25 <= beat && beat < onset[idx] + s.beats);
    if (gi >= 0) { sugg.push({ kind: 'fill', noteId: score[gi].id, to: pitch, beats: score[gi].beats, at: onset[gi] }); continue; }
    // nốt bản quét ngay trước chỗ đó
    let prev = -1;
    for (let idx = 0; idx < score.length; idx++) if (onset[idx] <= beat + 0.05) prev = idx;
    if (prev < 0) continue;
    // ô đang thiếu phách gần bằng độ dài nghe được → lấy đúng phần thiếu (ô tròn phách)
    const d = deficit(score[prev].bar);
    if (d > 0 && d / beats < 2 && beats / d < 2) beats = d;
    sugg.push({ kind: 'missing', afterId: score[prev].id, to: pitch, beats, at: beat });
  }
  // có thể thừa: nốt quét không khớp nốt thu nào, nằm giữa hai nốt khớp
  const matchedI = new Set(pairs.map(([i]) => i));
  for (const i of skippedS) {
    if (i === 0 || i === n - 1 || !matchedI.has(i - 1) || !matchedI.has(i + 1)) continue;
    sugg.push({ kind: 'extra', noteId: S[i].id, from: S[i].midi, at: S[i].at });
  }
  // sai trường độ: chỉ xét ô nhịp đang lệch phách; khoảng cách tới nốt khớp kế tiếp đổi ra phách
  for (let p = 0; p + 1 < pairs.length; p++) {
    const [i, j] = pairs[p], [i2, j2] = pairs[p + 1];
    if (i2 !== i + 1 || j2 !== j + 1) continue;
    const sn = S[i];
    // chỉ sửa khi ô đang lệch phách và sửa xong thì ô tròn phách (hát nhanh chậm tuỳ hứng không đủ tin)
    const d = deficit(sn.bar);
    if (Math.abs(d) < 0.01 || score[sn.i + 1]?.midi === null) continue; // dấu lặng xen giữa: bỏ qua
    const spb = spbAt(sn.at);
    if (!Number.isFinite(spb) || spb <= 0) continue;
    const got = (A[j2].start - A[j].start) / spb;
    const to = nearestNice(got);
    const ratio = got / sn.beats;
    if (to !== sn.beats && Math.abs(to - sn.beats - d) < 0.01 && (ratio > 1.25 || ratio < 0.8) && Math.abs(Math.log(got / to)) < 0.2) {
      sugg.push({ kind: 'duration', noteId: sn.id, midi: sn.midi, from: sn.beats, to, at: sn.at });
    }
  }
  sugg.sort((a, b) => a.at - b.at);
  return { offset: k, matched: anchors.length, scoreNotes: n, audioNotes: m, suggestions: sugg };
}

/**
 * Phân tích trọn gói: mẫu âm thanh (mono) → so với bản quét.
 * mode 'solo': bản thu một giọng (tự thổi / hát); 'mix': bài hát gốc có nhạc đệm — dò giai điệu chính
 * (melodyMix) và chỉ giữ gợi ý sửa cao độ: các loại khác bị nhạc đệm làm nhiễu (thử nghiệm: thêm / bỏ
 * nốt theo bài gốc làm bản quét sai hơn, sửa cao độ thì không).
 */
export function analyzeRecording(samples: Float32Array, sampleRate: number, score: ScoreNote[], meter?: number, mode: 'solo' | 'mix' = 'solo'): Comparison & { notes: AudioNote[] } {
  const notes = segmentNotes(mode === 'mix' ? trackMelodyInMix(samples, sampleRate) : trackPitch(samples, sampleRate));
  const r = compareWithAudio(score, notes, meter);
  if (mode === 'mix') r.suggestions = r.suggestions.filter((x) => x.kind === 'pitch');
  return { ...r, notes };
}
