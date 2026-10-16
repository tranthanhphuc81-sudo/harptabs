/**
 * Dò giai điệu chính trong bài hát có nhạc đệm (MP3 bài gốc) — cách "nhẹ", không cần mô hình AI:
 *  1. phổ ngắn hạn (FFT) ở ~11 kHz, lấy các đỉnh phổ
 *  2. "độ nổi" của từng cao độ = tổng năng lượng ở các hoạ âm của nó (giọng hát nhiều hoạ âm đều nhau);
 *     dải giọng hát được ưu tiên, bè trầm / tiếng trống bị hạ
 *  3. bám theo đường nổi nhất qua thời gian (Viterbi), phạt nhảy xa; đoạn không có giai điệu rõ → lặng
 * Kết quả cùng dạng với trackPitch (bản thu một giọng) để dùng lại bước tách nốt và đối chiếu.
 * Chỉ để GỢI Ý: bài có giọng hát nổi rõ trên nhạc đệm thì khá đúng, hoà âm dày / nhiều nhạc cụ thì kém.
 */
import type { PitchFrame } from './audioAlign';

const SR = 11025;
const N = 1024; // ~93 ms mỗi khung
const HOP = 110; // ~10 ms
const BIN_CENTS = 10;
const F_MIN = 82; // E2
const NB = Math.round((1200 * Math.log2(1100 / F_MIN)) / BIN_CENTS); // tới ~C#6

function downsample(x: Float32Array, sr: number): Float32Array {
  const f = sr / SR;
  if (f <= 1.01) return x;
  // lọc thông thấp đơn giản (trung bình trượt) rồi lấy mẫu theo tỉ lệ thực
  const k = Math.max(1, Math.round(f));
  const out = new Float32Array(Math.floor(x.length / f));
  for (let i = 0; i < out.length; i++) {
    const c = Math.floor(i * f);
    let s = 0;
    for (let j = 0; j < k; j++) s += x[Math.min(x.length - 1, c + j)];
    out[i] = s / k;
  }
  return out;
}

/** FFT phức tại chỗ (radix-2) */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

const binOfHz = (hz: number) => (1200 * Math.log2(hz / F_MIN)) / BIN_CENTS;
const midiOfBin = (b: number) => 12 * Math.log2(F_MIN / 440) + 69 + (b * BIN_CENTS) / 100;

/** Trọng số theo dải: giọng hát / kèn (~150–900 Hz) được ưu tiên, bè trầm bị hạ */
const rangeWeight = (b: number) => {
  const hz = F_MIN * 2 ** ((b * BIN_CENTS) / 1200);
  if (hz < 110) return 0.35;
  if (hz < 150) return 0.6 + 0.4 * ((hz - 110) / 40);
  if (hz > 900) return Math.max(0.5, 1 - (hz - 900) / 800);
  return 1;
};

const HARM_W = Array.from({ length: 8 }, (_, h) => 0.8 ** h);
/** trọng số cos² theo khoảng cách tới cao độ gốc (lệch 0.1 bin), tính sẵn */
const SPREAD = Array.from({ length: 11 }, (_, f) => Float64Array.from({ length: 21 }, (_, i) => {
  const dist = Math.abs(i - 10 + (f - 5) / 10) / 10;
  return dist < 1 ? Math.cos((dist * Math.PI) / 2) ** 2 : 0;
}));
const KMAX = Math.round((4500 * N) / SR);

export function trackMelodyInMix(samples: Float32Array, sampleRate: number): PitchFrame[] {
  const peaks: number[] = [];
  const x = downsample(samples, sampleRate);
  const win = new Float64Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  const re = new Float64Array(N), im = new Float64Array(N), mag = new Float64Array(N / 2);
  const K = 6; // số ứng viên cao độ mỗi khung
  const cands: { b: number; s: number }[][] = [];
  const energy: number[] = [];
  const sal = new Float64Array(NB);
  for (let p = 0; p + N <= x.length; p += HOP) {
    let e = 0;
    for (let i = 0; i < N; i++) { re[i] = x[p + i] * win[i]; im[i] = 0; e += x[p + i] * x[p + i]; }
    energy.push(Math.sqrt(e / N));
    fft(re, im);
    let maxMag = 0;
    for (let k = 0; k < N / 2; k++) { mag[k] = Math.hypot(re[k], im[k]); if (mag[k] > maxMag) maxMag = mag[k]; }
    sal.fill(0);
    // đỉnh phổ (nội suy parabol) trong 70 Hz – 4.5 kHz, bỏ đỉnh nhỏ hơn 1/100 đỉnh lớn nhất (−40 dB);
    // giữ tối đa 30 đỉnh lớn nhất cho nhanh
    peaks.length = 0;
    for (let k = 2; k < Math.min(N / 2 - 1, KMAX); k++) {
      const m = mag[k];
      if (m < maxMag * 0.01 || m < mag[k - 1] || m < mag[k + 1]) continue;
      peaks.push(k);
    }
    if (peaks.length > 30) peaks.sort((a, b) => mag[b] - mag[a]).length = 30;
    for (const k of peaks) {
      const m = mag[k];
      const a = Math.log(mag[k - 1] + 1e-12), b = Math.log(m + 1e-12), c = Math.log(mag[k + 1] + 1e-12);
      const d = (a - c) / (2 * (a - 2 * b + c) || 1);
      const hz = ((k + d) * SR) / N;
      const amp = Math.sqrt(m / maxMag); // nén biên độ: hoạ âm yếu vẫn góp phần
      // góp vào các cao độ mà đỉnh này là hoạ âm thứ h của nó (± 1 nửa cung, trọng số cos² tính sẵn)
      for (let h = 1; h <= 8; h++) {
        const f0 = hz / h;
        if (f0 < F_MIN) break;
        const c0 = binOfHz(f0), base = Math.round(c0), frac = Math.round((base - c0) * 10) + 5; // 0..10
        const w = amp * HARM_W[h - 1];
        const row = SPREAD[frac];
        for (let db = -10; db <= 10; db++) {
          const bb = base + db;
          if (bb >= 0 && bb < NB) sal[bb] += w * row[db + 10];
        }
      }
    }
    // ứng viên: các cực đại độ nổi lớn nhất (đã nhân trọng số dải)
    const top: { b: number; s: number }[] = [];
    for (let b = 1; b < NB - 1; b++) {
      const v = sal[b] * rangeWeight(b);
      if (v <= 0 || sal[b] < sal[b - 1] || sal[b] < sal[b + 1]) continue;
      top.push({ b, s: v });
    }
    top.sort((p1, p2) => p2.s - p1.s);
    cands.push(top.slice(0, K));
  }
  const T = cands.length;
  if (!T) return [];
  // Viterbi qua các ứng viên: điểm = độ nổi (log) − phạt theo khoảng nhảy
  const score: Float64Array[] = [], back: Int16Array[] = [];
  for (let t = 0; t < T; t++) {
    const cs = cands[t];
    const sc = new Float64Array(cs.length), bk = new Int16Array(cs.length).fill(-1);
    for (let i = 0; i < cs.length; i++) {
      const own = Math.log(cs[i].s + 1e-9);
      if (t === 0 || !cands[t - 1].length) { sc[i] = own; continue; }
      let best = -Infinity, arg = -1;
      const prev = cands[t - 1];
      for (let j = 0; j < prev.length; j++) {
        const jump = Math.abs(prev[j].b - cs[i].b) / 10; // nửa cung
        const pen = jump < 0.5 ? 0 : jump < 2.5 ? 0.6 + 0.15 * jump : 1.2 + 0.25 * jump;
        const v = score[t - 1][j] - pen;
        if (v > best) { best = v; arg = j; }
      }
      sc[i] = best + own;
      bk[i] = arg;
    }
    score.push(sc); back.push(bk);
  }
  // lần ngược; khung không có ứng viên làm đứt đường → đoạn sau bắt đầu lại từ ứng viên tốt nhất
  const path = new Int16Array(T).fill(-1);
  const argmax = (t: number) => { let bi = -1; for (let i = 0; i < score[t].length; i++) if (bi < 0 || score[t][i] > score[t][bi]) bi = i; return bi; };
  let cur = argmax(T - 1);
  for (let t = T - 1; t >= 0; t--) {
    if (cur < 0) cur = argmax(t);
    path[t] = cur;
    cur = cur >= 0 ? back[t][cur] : -1;
  }
  // có giai điệu hay không: độ nổi của đường đã chọn so với mức thường gặp, và có tiếng
  const chosen = Array.from(path, (i, t) => (i >= 0 ? cands[t][i].s : 0));
  const sorted = chosen.filter((v) => v > 0).sort((a, b) => a - b);
  const typical = sorted.length ? sorted[Math.floor(sorted.length * 0.6)] : 0;
  const eSorted = [...energy].sort((a, b) => a - b);
  const quiet = eSorted[Math.floor(eSorted.length * 0.1)] * 2 + eSorted[Math.floor(eSorted.length * 0.95)] * 0.03;
  return Array.from(path, (i, t) => {
    const voiced = i >= 0 && chosen[t] >= typical * 0.35 && energy[t] > quiet;
    return { t: (t * HOP + N / 2) / SR, midi: voiced ? midiOfBin(cands[t][i].b) : null, rms: energy[t] };
  });
}
