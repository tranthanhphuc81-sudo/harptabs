/**
 * Bản đồ nhịp cho nhạc nền MP3: phách trong tab ↔ giây trong file nhạc.
 * Bài hát thật không giữ đúng một tốc độ (ca sĩ / ban nhạc nhanh chậm), nên dùng nhiều mốc nối thẳng với nhau.
 */

export interface TempoPoint { beat: number; sec: number }

export interface TempoMap {
  /** tăng dần cả phách lẫn giây */
  points: TempoPoint[];
  /** giây mỗi phách (trung vị) — dùng để ngoại suy trước mốc đầu / sau mốc cuối */
  spb: number;
}

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? a[a.length >> 1] : NaN;
};

/** dãy con tăng dài nhất theo giây (đã xếp theo phách) — bỏ các mốc khớp nhầm làm thời gian chạy lùi */
function longestIncreasing(ps: TempoPoint[]): TempoPoint[] {
  const tails: number[] = [], prev: number[] = new Array(ps.length).fill(-1);
  for (let i = 0; i < ps.length; i++) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (ps[tails[mid]].sec < ps[i].sec) lo = mid + 1; else hi = mid; }
    if (lo > 0) prev[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const out: TempoPoint[] = [];
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i]) out.push(ps[i]);
  return out.reverse();
}

function build(points: TempoPoint[]): TempoMap | null {
  if (points.length < 2) return null;
  const spbs: number[] = [];
  for (let i = 1; i < points.length; i++) spbs.push((points[i].sec - points[i - 1].sec) / (points[i].beat - points[i - 1].beat));
  const spb = median(spbs);
  return spb > 0 && Number.isFinite(spb) ? { points, spb } : null;
}

/**
 * Từ các cặp nốt khớp tự động (compareWithAudio.anchors): bỏ mốc chạy lùi, bỏ mốc làm tốc độ lệch bất thường
 * (ngoài 0,6–1,6 lần tốc độ chung), giữ tối đa một mốc mỗi phách.
 */
export function fromAnchors(anchors: TempoPoint[]): TempoMap | null {
  const sorted = [...anchors].filter((a) => Number.isFinite(a.beat) && Number.isFinite(a.sec)).sort((a, b) => a.beat - b.beat || a.sec - b.sec);
  // một mốc mỗi phách (mốc đầu tiên)
  const thin: TempoPoint[] = [];
  for (const a of sorted) if (!thin.length || a.beat - thin[thin.length - 1].beat >= 1 - 1e-9) thin.push(a);
  let pts = longestIncreasing(thin);
  if (pts.length < 2) return null;
  // bỏ mốc khiến tốc độ quanh nó lệch hẳn tốc độ chung
  for (let round = 0; round < 3; round++) {
    const m = build(pts);
    if (!m) return null;
    const ok = (a: TempoPoint, b: TempoPoint) => { const r = (b.sec - a.sec) / (b.beat - a.beat) / m.spb; return r >= 0.6 && r <= 1.6; };
    const keep = pts.filter((p, i) => {
      const left = i > 0 ? ok(pts[i - 1], p) : true, right = i + 1 < pts.length ? ok(p, pts[i + 1]) : true;
      return left || right;
    });
    if (keep.length === pts.length) break;
    pts = keep;
  }
  return build(pts);
}

/** từ các lần chạm "câu bắt đầu" (canh tay): chỉ bỏ lần chạm làm thời gian chạy lùi */
export function fromTaps(taps: TempoPoint[]): TempoMap | null {
  return build(longestIncreasing([...taps].sort((a, b) => a.beat - b.beat)));
}

/** nhạc đều nhịp: phách 0 ở giây `startSec`, tốc độ `bpm` */
export function fromBpm(startSec: number, bpm: number): TempoMap {
  const spb = 60 / Math.max(20, bpm);
  return { points: [{ beat: 0, sec: startSec }, { beat: 1, sec: startSec + spb }], spb };
}

/** giây trong file nhạc của phách `beat` */
export function secAt(m: TempoMap, beat: number): number {
  const p = m.points;
  if (beat <= p[0].beat) return p[0].sec - (p[0].beat - beat) * m.spb;
  const last = p[p.length - 1];
  if (beat >= last.beat) return last.sec + (beat - last.beat) * m.spb;
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].beat <= beat) lo = mid; else hi = mid; }
  return p[lo].sec + ((beat - p[lo].beat) * (p[hi].sec - p[lo].sec)) / (p[hi].beat - p[lo].beat);
}

/** phách trong tab ứng với giây `sec` trong file nhạc */
export function beatAt(m: TempoMap, sec: number): number {
  const p = m.points;
  if (sec <= p[0].sec) return p[0].beat - (p[0].sec - sec) / m.spb;
  const last = p[p.length - 1];
  if (sec >= last.sec) return last.beat + (sec - last.sec) / m.spb;
  let lo = 0, hi = p.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (p[mid].sec <= sec) lo = mid; else hi = mid; }
  return p[lo].beat + ((sec - p[lo].sec) * (p[hi].beat - p[lo].beat)) / (p[hi].sec - p[lo].sec);
}
