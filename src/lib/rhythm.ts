/**
 * Tập nhịp: máy đếm nhịp chạy, người tập chơi theo mẫu nhịp (một nốt bất kỳ hoặc vỗ tay); app bắt từng tiếng gõ từ micro
 * và chấm mỗi tiếng sớm / muộn bao nhiêu mili giây, độ đều, có hay bị vội / kéo nhịp không.
 */

export interface RhythmPattern {
  id: string;
  label: string;
  /** cách đếm hiện dưới mẫu */
  count: string;
  beatsPerBar: number;
  /** vị trí các tiếng gõ trong một ô nhịp (tính bằng phách, từ 0) */
  hits: number[];
}

const S = 2 / 3; // móc đôi swing: nốt sau rơi vào 2/3 phách
export const RHYTHM_PATTERNS: RhythmPattern[] = [
  { id: 'den', label: 'Nốt đen · 4/4', count: '1 2 3 4', beatsPerBar: 4, hits: [0, 1, 2, 3] },
  { id: 'ba', label: 'Nhịp ba · 3/4', count: '1 2 3', beatsPerBar: 3, hits: [0, 1, 2] },
  { id: 'trang', label: 'Nốt trắng (phách 1, 3)', count: '1 – 3 –', beatsPerBar: 4, hits: [0, 2] },
  { id: 'moc', label: 'Móc đơn (hai tiếng mỗi phách)', count: '1 & 2 & 3 & 4 &', beatsPerBar: 4, hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  { id: 'cham', label: 'Đen chấm dôi – móc', count: '1 – & 3 – &', beatsPerBar: 4, hits: [0, 1.5, 2, 3.5] },
  { id: 'dao', label: 'Đảo phách (chỉ chơi "&")', count: '& & & &', beatsPerBar: 4, hits: [0.5, 1.5, 2.5, 3.5] },
  { id: 'swing', label: 'Swing (nhịp lệch)', count: '1 – a 2 – a …', beatsPerBar: 4, hits: [0, S, 1, 1 + S, 2, 2 + S, 3, 3 + S] },
];

/* ---------- bắt tiếng gõ ---------- */

/** một tiếng gõ: thời điểm (giây, theo đồng hồ âm thanh) và độ lớn đỉnh */
export interface Onset { t: number; peak: number }

/**
 * Bắt tiếng gõ từ năng lượng từng khối mẫu âm thanh: năng lượng vọt lên gấp nhiều lần mức vài khối trước và trên ngưỡng nền
 * là một tiếng gõ; sau đó nghỉ REFRACT giây (tiếng đàn ngân không tính thêm). Độ lớn đỉnh lấy trong 30 ms sau lúc gõ.
 */
export class OnsetDetector {
  private hist: number[] = [];
  private floor = 1e-5;
  private lastHit = -Infinity;
  private lastInit = 0;
  private pending: Onset | null = null;

  constructor(private refract = 0.07, private ratio = 4, private minEnergy = 2e-5) {}

  /** đưa vào năng lượng (trung bình bình phương) của một khối bắt đầu lúc t; trả về tiếng gõ đã chốt (trễ ~30 ms) */
  feed(t: number, energy: number): Onset | null {
    let out: Onset | null = null;
    if (this.pending) {
      if (t - this.pending.t <= 0.03) this.pending.peak = Math.max(this.pending.peak, energy);
      else { out = this.pending; this.pending = null; }
    }
    const before = this.hist.length ? this.hist.reduce((a, b) => a + b, 0) / this.hist.length : energy;
    const jump = energy > this.minEnergy && energy > this.floor * 3 && energy > before * this.ratio;
    // tiếng to hơn hẳn tới ngay sau một tiếng nhỏ (tiếng máy đếm nhịp lọt vào micro rồi tiếng người chơi): tính tiếng sau
    const louder = t - this.lastHit < this.refract && energy > this.lastInit * 4;
    if (jump && (t - this.lastHit >= this.refract || louder)) {
      if (louder) this.pending = null;
      this.lastHit = t;
      this.lastInit = energy;
      this.pending = { t, peak: energy };
    }
    this.hist.push(energy);
    if (this.hist.length > 4) this.hist.shift();
    // mức nền: bám xuống nhanh, lên rất chậm (vài giây) để tiếng gõ dồn dập không tự che nhau
    this.floor = energy < this.floor ? energy : this.floor * 0.999 + energy * 0.001;
    return out;
  }
}

/* ---------- chấm ---------- */

export interface HitResult {
  /** thời điểm cần gõ (giây) */
  want: number;
  /** lệch (ms): âm = sớm, dương = muộn; null = bỏ sót */
  ms: number | null;
}

/**
 * Ghép tiếng gõ với các vị trí cần gõ (đã trừ độ trễ máy): mỗi vị trí lấy tiếng gõ gần nhất chưa dùng, trong khoảng
 * nửa khoảng cách tới vị trí bên cạnh (tối đa 180 ms). Trả về kết quả từng vị trí và số tiếng gõ thừa.
 */
export function matchHits(wants: number[], onsets: number[]): { hits: HitResult[]; extra: number } {
  const used = new Set<number>();
  const hits = wants.map((w, i) => {
    const gapPrev = i > 0 ? w - wants[i - 1] : Infinity;
    const gapNext = i < wants.length - 1 ? wants[i + 1] - w : Infinity;
    const win = Math.min(0.18, gapPrev / 2, gapNext / 2);
    let best = -1;
    for (let j = 0; j < onsets.length; j++) {
      if (used.has(j) || Math.abs(onsets[j] - w) > win) continue;
      if (best < 0 || Math.abs(onsets[j] - w) < Math.abs(onsets[best] - w)) best = j;
    }
    if (best < 0) return { want: w, ms: null };
    used.add(best);
    return { want: w, ms: Math.round((onsets[best] - w) * 1000) };
  });
  const first = wants[0] - 0.2, last = wants[wants.length - 1] + 0.2;
  const extra = onsets.filter((t, j) => !used.has(j) && t >= first && t <= last).length;
  return { hits, extra };
}

export interface RhythmStats {
  /** số tiếng gõ trúng / tổng */
  caught: number;
  total: number;
  /** lệch trung bình (ms): âm = hay vội, dương = hay kéo */
  mean: number;
  /** độ đều: độ lệch chuẩn (ms) */
  spread: number;
  /** số tiếng gõ lệch không quá GOOD_MS */
  good: number;
  extra: number;
}

/** lệch tới mức này vẫn tính là đúng nhịp (ms) */
export const GOOD_MS = 50;

export function rhythmStats(r: { hits: HitResult[]; extra: number }): RhythmStats {
  const ms = r.hits.map((h) => h.ms).filter((x): x is number => x !== null);
  const mean = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
  const spread = ms.length ? Math.sqrt(ms.reduce((a, b) => a + (b - mean) ** 2, 0) / ms.length) : 0;
  return { caught: ms.length, total: r.hits.length, mean: Math.round(mean), spread: Math.round(spread), good: ms.filter((x) => Math.abs(x) <= GOOD_MS).length, extra: r.extra };
}

/** nhận xét một lượt tập */
export function rhythmAdvice(s: RhythmStats): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  const pct = s.total ? Math.round((100 * s.good) / s.total) : 0;
  lines.push(`Đúng nhịp ${s.good}/${s.total} tiếng (${pct}%), lệch ±${s.spread} ms.`);
  if (s.caught < s.total * 0.7) lines.push(`Sót ${s.total - s.caught} tiếng: chơi rõ, dứt khoát hơn (hoặc để điện thoại gần nhạc cụ hơn).`);
  if (s.mean <= -25) lines.push(`Hay vội: trung bình sớm ${-s.mean} ms. Thả lỏng, nghe hết tiếng gõ của máy rồi mới chơi.`);
  else if (s.mean >= 25) lines.push(`Hay kéo: trung bình muộn ${s.mean} ms. Đếm thầm trước phách, chuẩn bị sẵn tay / hơi.`);
  if (s.spread > 40) lines.push('Chưa đều: tiếng sớm tiếng muộn. Hạ tốc độ, đếm thành tiếng "1 & 2 &".');
  if (s.extra > 2) lines.push(`Có ${s.extra} tiếng thừa: chỉ chơi đúng các vị trí trong mẫu.`);
  const ok = pct >= 80 && s.spread <= 35;
  if (ok) lines.push('Rất tốt! Thử tăng tốc độ thêm 5 nhịp/phút.');
  return { ok, lines };
}

/**
 * Độ trễ vòng của máy (loa → tai / micro → app), đo từ tiếng gõ của máy đếm nhịp lọt vào micro trong ô nhịp đếm vào
 * (lúc người tập chưa chơi): trung vị độ lệch giữa tiếng thu được và lúc phát. Null nếu không nghe thấy (đeo tai nghe).
 */
export function loopbackLatency(clicks: number[], onsets: Onset[]): { latency: number; level: number } | null {
  const d: { lag: number; peak: number }[] = [];
  for (const c of clicks) {
    const o = onsets.find((x) => x.t - c >= 0 && x.t - c <= 0.4);
    if (o) d.push({ lag: o.t - c, peak: o.peak });
  }
  if (d.length < Math.max(2, Math.ceil(clicks.length / 2))) return null;
  const lags = d.map((x) => x.lag).sort((a, b) => a - b);
  const peaks = d.map((x) => x.peak).sort((a, b) => a - b);
  return { latency: lags[Math.floor(lags.length / 2)], level: peaks[Math.floor(peaks.length / 2)] };
}

/**
 * Bỏ các tiếng thu được chính là tiếng gõ của máy lọt vào micro: trùng lúc tiếng máy tới micro (±30 ms) và không to hơn
 * hẳn tiếng máy. Tiếng người chơi trùng phách thường to hơn nhiều nên vẫn giữ.
 */
export function dropClicks(onsets: Onset[], clicks: number[], loop: { latency: number; level: number }): Onset[] {
  return onsets.filter((o) => !clicks.some((c) => Math.abs(o.t - (c + loop.latency)) <= 0.03) || o.peak > loop.level * 3);
}

/**
 * Độ trễ tự dò khi không đo được (đeo tai nghe, kể cả tai nghe Bluetooth trễ tới 0,3 giây): thử dời toàn bộ tiếng gõ
 * từ `lo` tới `hi` giây, chọn độ dời khớp được nhiều vị trí cần gõ nhất (lệch ≤ 40 ms), bằng nhau thì tổng lệch nhỏ hơn.
 * Vì tự canh theo chính người chơi nên chỉ chấm được độ đều, không chấm được vội / kéo.
 */
export function bestShift(wants: number[], onsets: number[], lo = 0, hi = 0.45): number {
  let best = lo, bestN = -1, bestErr = Infinity;
  for (let s = lo; s <= hi + 1e-9; s += 0.005) {
    let n = 0, err = 0;
    for (const w of wants) {
      let d = Infinity;
      for (const o of onsets) d = Math.min(d, Math.abs(o - s - w));
      if (d <= 0.04) { n++; err += d; }
    }
    if (n > bestN || (n === bestN && err < bestErr)) { best = s; bestN = n; bestErr = err; }
  }
  return best;
}
