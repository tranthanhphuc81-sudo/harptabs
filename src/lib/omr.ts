/**
 * Đọc khuông nhạc in (OMR) bằng luật, chạy offline, không cần AI.
 * Giống cách người học tự đọc, theo thứ tự:
 *  1. Khoảng cách dòng kẻ: độ dài "mực + trắng" lặp đều theo cột → phóng ảnh về TARGET_SPACE.
 *  2. Khuông nhạc: khớp mẫu 5 dòng cách đều trên từng dải dọc rồi nối lại → chịu được ảnh nghiêng,
 *     cong nhẹ; nắn thẳng từng khuông.
 *  3. Đầu nốt: khớp mẫu bầu dục (đặc / rỗng) ngay tại các bậc cao độ của khuông trên ảnh xám —
 *     vị trí dọc là cao độ luôn, không phụ thuộc bước xoá dòng kẻ (ảnh nhỏ, nét mờ vẫn đọc được).
 *  4. Hoá biểu: dấu thăng / giáng ở các bậc cố định theo thứ tự cố định; đối chiếu giữa các khuông.
 *  5. Trường độ: thân nốt, móc / vạch nối (đếm theo độ đậm), chấm dôi, dấu lặng; dấu hoá trước nốt.
 * Khoá Sol hoặc khoá Fa (nhận theo từng khuông), dấu nhắc lại ‖: :‖. Giả định: một bè giai điệu (nốt chồng thì giữ
 * nốt cao nhất), bản in. Tên hợp âm in trên khuông đọc riêng bằng máy đọc chữ (lib/chordOcr.ts).
 *
 * Mọi toạ độ là trên ảnh đã chuẩn hoá (khoảng cách dòng kẻ ≈ TARGET_SPACE px).
 */
import type { AiTranscription } from '../../shared/ai';

export const TARGET_SPACE = 13.5;

export interface Gray { width: number; height: number; data: Uint8Array }

export interface OmrNote {
  id: string;
  page: number;
  staff: number;
  x: number;
  y: number;
  /** bậc so với dòng dưới cùng khoá Sol (0 = E4), mỗi bậc = nửa khe — khuông khoá Fa đã quy đổi (dòng dưới = G2 = -12) */
  step: number;
  /** dấu hoá riêng của nốt: null = theo hoá biểu, 1 = thăng, -1 = giáng, 0 = bình */
  accidental: -1 | 0 | 1 | null;
  beats: number;
  hollow: boolean;
  dot: boolean;
  rest: boolean;
  /** nối (dấu nối ⌒) với nốt trước: khi chuyển tab, cộng trường độ vào nốt trước */
  tied?: boolean;
  /** dấu lặng máy tự chèn vào ô thiếu phách (không thấy trên ảnh) — có thể là nốt bị sót */
  guess?: boolean;
  /** âm tiết lời in dưới nốt (máy đọc chữ, người dùng sửa được) */
  lyric?: string;
  /** tên hợp âm in phía trên nốt (máy đọc chữ) — hợp âm đệm từ nốt này */
  chord?: string;
}

export interface OmrStaff {
  page: number; top: number; bottom: number; space: number; bars: number[]; xRight: number;
  /** khuông khoá Fa (không ghi = khoá Sol) */
  clef?: 'F';
  /** dấu nhắc lại (vạch nhịp kèm hai chấm): "start" = chấm bên phải ‖:, "end" = chấm bên trái :‖ */
  repeats?: { x: number; kind: 'start' | 'end' }[];
  /** ngoặc lần 1 (khoảng x, kết thúc ở dấu :‖): các nốt bên dưới chỉ chơi ở lượt đầu, lượt nhắc lại nhảy sang lần 2 */
  firstEndings?: [number, number][];
  /** ngoặc liên ba "⌐3¬" (khoảng x) — trường độ các nốt bên dưới được sửa ở fillRests */
  tuplets?: [number, number][];
}

export interface OmrPage {
  image: Gray;
  /** hệ số co giãn từ ảnh gốc sang ảnh chuẩn hoá */
  scale: number;
  keySig: number;
  staves: OmrStaff[];
  notes: OmrNote[];
}

export interface OmrResult {
  pages: OmrPage[];
  /** số dấu thăng (+) / giáng (−) ở hoá biểu */
  keySig: number;
  /** số phách đen mỗi ô nhịp, đoán từ các ô nhịp */
  meter: number;
  timeSig: string;
}

// ───────────────────────── ảnh nhị phân ─────────────────────────

class Bits {
  constructor(public w: number, public h: number, public d: Uint8Array = new Uint8Array(w * h)) {}
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.d[y * this.w + x] : 0; }
  clone() { return new Bits(this.w, this.h, this.d.slice()); }
  rows(y0: number, y1: number) {
    y0 = Math.max(0, y0); y1 = Math.min(this.h, y1);
    return new Bits(this.w, Math.max(0, y1 - y0), this.d.slice(y0 * this.w, y1 * this.w));
  }
  crop(y0: number, y1: number, x0: number, x1: number) {
    y0 = Math.max(0, y0); y1 = Math.min(this.h, y1); x0 = Math.max(0, x0); x1 = Math.min(this.w, x1);
    const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
    const out = new Bits(w, h);
    for (let y = 0; y < h; y++) out.d.set(this.d.subarray((y + y0) * this.w + x0, (y + y0) * this.w + x0 + w), y * w);
    return out;
  }
  clearLeft(x: number) { for (let y = 0; y < this.h; y++) this.d.fill(0, y * this.w, y * this.w + Math.min(this.w, Math.max(0, x))); }
  or(o: Bits) { const r = this.clone(); for (let i = 0; i < r.d.length; i++) r.d[i] |= o.d[i]; return r; }
  andNot(o: Bits) { const r = this.clone(); for (let i = 0; i < r.d.length; i++) r.d[i] = r.d[i] & (o.d[i] ^ 1); return r; }
}

/** Hộp bao: [y0, y1) × [x0, x1) — như slice của scipy.ndimage.find_objects */
interface Box { y0: number; y1: number; x0: number; x1: number }
const bh = (b: Box) => b.y1 - b.y0;
const bw = (b: Box) => b.x1 - b.x0;
const cx = (b: Box) => (b.x0 + b.x1 - 1) / 2;
const cy = (b: Box) => (b.y0 + b.y1 - 1) / 2;

function threshold(g: Gray, t: number) {
  const b = new Bits(g.width, g.height);
  for (let i = 0; i < b.d.length; i++) b.d[i] = g.data[i] < t ? 1 : 0;
  return b;
}

/** Gán nhãn thành phần liên thông 4 hướng; trả nhãn (1..n, theo thứ tự quét) và hộp bao */
function label(b: Bits): { lab: Int32Array; boxes: Box[] } {
  const { w, h, d } = b;
  const lab = new Int32Array(w * h);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (!d[i] || lab[i]) continue;
    const id = boxes.length + 1;
    const box = { y0: h, y1: 0, x0: w, x1: 0 };
    lab[i] = id; stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w, y = (p - x) / w;
      if (y < box.y0) box.y0 = y; if (y + 1 > box.y1) box.y1 = y + 1;
      if (x < box.x0) box.x0 = x; if (x + 1 > box.x1) box.x1 = x + 1;
      if (x > 0 && d[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && d[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && d[p - w] && !lab[p - w]) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && d[p + w] && !lab[p + w]) { lab[p + w] = id; stack.push(p + w); }
    }
    boxes.push(box);
  }
  return { lab, boxes };
}

/** Lấp lỗ: nền (4 hướng) không nối ra mép ảnh thì thành mực */
function fillHoles(b: Bits) {
  const { w, h, d } = b;
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (p: number) => { if (!d[p] && !outside[p]) { outside[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p - x) / w;
    if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w); if (y < h - 1) seed(p + w);
  }
  const r = new Bits(w, h);
  for (let i = 0; i < r.d.length; i++) r.d[i] = outside[i] ? 0 : 1;
  return r;
}

/** Đoạn mực dọc liền đi qua hàng y ở cột x (vá chỗ đứt 1 px). Trả [đầu, cuối] hoặc null */
function verticalRun(b: Bits, x: number, y: number): [number, number] | null {
  if (!b.get(x, y)) return null;
  let a = y, e = y;
  while (a - 1 >= 0 && (b.get(x, a - 1) || (a - 2 >= 0 && b.get(x, a - 2)))) a--;
  while (e + 1 < b.h && (b.get(x, e + 1) || (e + 2 < b.h && b.get(x, e + 2)))) e++;
  return [a, e];
}

// ───────────────────────── ảnh xám & co giãn ─────────────────────────

export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Gray {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    // giống PIL convert('L'), nền trong suốt coi như trắng
    const a = rgba[j + 3] / 255;
    const r = rgba[j] * a + 255 * (1 - a), g = rgba[j + 1] * a + 255 * (1 - a), b = rgba[j + 2] * a + 255 * (1 - a);
    data[i] = (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16;
  }
  return { width, height, data };
}

/**
 * Làm phẳng nền cho ảnh chụp bằng điện thoại: giấy xám, sáng không đều → nền trắng.
 * Độ sáng giấy ở mỗi vùng ≈ điểm sáng nhất trong ô lưới, nội suy song tuyến giữa các ô.
 */
export function flattenBackground(g: Gray): Gray {
  const { width: w, height: h } = g;
  const block = Math.max(8, Math.round(Math.min(w, h) / 40));
  const gw = Math.ceil(w / block), gh = Math.ceil(h / block);
  const grid = new Float32Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = Math.floor(y / block) * gw + Math.floor(x / block);
    if (g.data[y * w + x] > grid[i]) grid[i] = g.data[y * w + x];
  }
  // lấy max 3×3 ô để ô phủ kín mực (khoá nhạc, chữ đậm) vẫn có nền đúng
  const bg = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let m = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const jj = j + dj, ii = i + di;
      if (jj >= 0 && ii >= 0 && jj < gh && ii < gw) m = Math.max(m, grid[jj * gw + ii]);
    }
    bg[j * gw + i] = m;
  }
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(Math.max((y + 0.5) / block - 0.5, 0), gh - 1);
    const j0 = Math.floor(fy), j1 = Math.min(j0 + 1, gh - 1), ty = fy - j0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(Math.max((x + 0.5) / block - 0.5, 0), gw - 1);
      const i0 = Math.floor(fx), i1 = Math.min(i0 + 1, gw - 1), tx = fx - i0;
      const b = (bg[j0 * gw + i0] * (1 - tx) + bg[j0 * gw + i1] * tx) * (1 - ty) + (bg[j1 * gw + i0] * (1 - tx) + bg[j1 * gw + i1] * tx) * ty;
      const v = g.data[y * w + x];
      data[y * w + x] = b < 60 ? v : Math.min(255, Math.round((v * 255) / b));
    }
  }
  return { width: w, height: h, data };
}

function bicubic(x: number) {
  const a = -0.5;
  x = Math.abs(x);
  if (x < 1) return ((a + 2) * x - (a + 3)) * x * x + 1;
  if (x < 2) return (((x - 5) * x + 8) * x - 4) * a;
  return 0;
}

function coeffs(inSize: number, outSize: number) {
  const scale = inSize / outSize;
  const filterscale = Math.max(1, scale);
  const support = 2 * filterscale;
  const out: { start: number; w: Float64Array }[] = [];
  for (let xx = 0; xx < outSize; xx++) {
    const center = (xx + 0.5) * scale;
    const xmin = Math.max(Math.trunc(center - support + 0.5), 0);
    const xmax = Math.min(Math.trunc(center + support + 0.5), inSize) - xmin;
    const w = new Float64Array(xmax);
    let ww = 0;
    for (let x = 0; x < xmax; x++) { w[x] = bicubic((x + xmin - center + 0.5) / filterscale); ww += w[x]; }
    if (ww) for (let x = 0; x < xmax; x++) w[x] /= ww;
    out.push({ start: xmin, w });
  }
  return out;
}

const clip8 = (v: number) => (v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v));

/** Co giãn ảnh xám bằng bicubic giống PIL (ngang trước, dọc sau, làm tròn về 8 bit giữa hai lượt) */
export function resizeGray(g: Gray, width: number, height: number): Gray {
  const cx = coeffs(g.width, width);
  const tmp = new Uint8Array(width * g.height);
  for (let y = 0; y < g.height; y++) {
    const row = y * g.width;
    for (let x = 0; x < width; x++) {
      const { start, w } = cx[x];
      let v = 0;
      for (let k = 0; k < w.length; k++) v += g.data[row + start + k] * w[k];
      tmp[y * width + x] = clip8(v);
    }
  }
  const cyc = coeffs(g.height, height);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const { start, w } = cyc[y];
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (let k = 0; k < w.length; k++) v += tmp[(start + k) * width + x] * w[k];
      data[y * width + x] = clip8(v);
    }
  }
  return { width, height, data };
}

// ───────────────────────── khuông nhạc ─────────────────────────

type Line = [number, number];

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Khoảng cách dòng kẻ (tâm–tâm, px) đo theo cột: đoạn mực + đoạn trắng kế tiếp lặp lại đều nhau
 * (5 dòng kẻ) → độ dài phổ biến nhất. Không phụ thuộc ảnh có nghiêng hay dòng kẻ đứt quãng.
 */
function runSpacing(b: Bits): number | null {
  const { w, h, d } = b;
  const hist = new Float64Array(80);
  const pairs: number[] = [];
  for (let x = 0; x < w; x++) {
    pairs.length = 0;
    let y = 0;
    while (y < h && d[y * w + x]) y++; // bỏ đoạn mực chạm mép trên
    while (y < h) {
      while (y < h && !d[y * w + x]) y++;
      const a = y;
      while (y < h && d[y * w + x]) y++;
      const bl = y - a;
      const c = y;
      while (y < h && !d[y * w + x]) y++;
      if (y >= h || !bl) break;
      pairs.push(bl + y - c);
      y = c; // đoạn trắng này là khởi đầu cặp sau
    }
    // chỉ đếm cặp lặp lại (dòng kẻ kế bên cách đều) — chữ, nốt thì không
    for (let i = 0; i + 1 < pairs.length; i++) if (Math.abs(pairs[i] - pairs[i + 1]) <= 1 && pairs[i] < hist.length) hist[pairs[i]]++;
  }
  let m = 0;
  for (let i = 3; i < hist.length; i++) if (hist[i] > hist[m]) m = i;
  if (hist[m] < 20) return null;
  const lo = hist[m - 1] ?? 0, hi = hist[m + 1] ?? 0;
  return m + (hi - lo) / (hist[m] + lo + hi);
}

/** Một khuông nhạc tìm được: tâm khuông theo từng cột (cho phép ảnh nghiêng/cong nhẹ), khoảng cách dòng kẻ */
interface StaffGeo { yc: Float32Array; sp: number; center: number }

/**
 * Tìm khuông nhạc theo từng dải dọc: trong mỗi dải, khớp mẫu "5 dòng cách đều" lên biểu đồ mực của các
 * đoạn ngang dài (bỏ chữ, đầu nốt), rồi nối các dải cùng một khuông lại. Chịu được ảnh nghiêng, dòng kẻ
 * dày/mỏng không đều, khuông ngắn (khuông đầu thụt lề), đường kẻ lạ sát khuông (ngoặc lặp "1." "2.").
 */
function findStaves(ink: Bits, s: number): StaffGeo[] {
  const { w, h, d } = ink;
  // chỉ giữ mực thuộc đoạn ngang dài ≥ 2 khe
  const minRun = Math.round(2 * s);
  const hl = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!d[y * w + x]) { x++; continue; }
      const a = x;
      while (x < w && d[y * w + x]) x++;
      if (x - a >= minRun) hl.fill(1, y * w + a, y * w + x);
    }
  }
  const SW = Math.max(8, Math.round(4 * s));
  const nStrips = Math.max(1, Math.floor(w / SW));
  const sps: number[] = [];
  for (let sp = 0.85 * s; sp <= 1.15 * s; sp += 0.25) sps.push(sp);
  type Cand = { strip: number; xc: number; center: number; sp: number; score: number };
  const cands: Cand[] = [];
  const prof = new Float32Array(h), near = new Float32Array(h);
  for (let i = 0; i < nStrips; i++) {
    const x0 = Math.round((i * w) / nStrips), x1 = Math.round(((i + 1) * w) / nStrips);
    for (let y = 0; y < h; y++) {
      let n = 0;
      for (let x = x0; x < x1; x++) n += hl[y * w + x];
      prof[y] = n / (x1 - x0);
    }
    for (let y = 0; y < h; y++) near[y] = Math.max(prof[y], y > 0 ? prof[y - 1] : 0, y + 1 < h ? prof[y + 1] : 0);
    const score = new Float32Array(h), best = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      for (const sp of sps) {
        if (y + 4 * sp >= h - 1) break;
        let m = Infinity;
        for (let k = 0; k < 5 && m > score[y]; k++) m = Math.min(m, near[Math.round(y + k * sp)]);
        if (m > score[y]) { score[y] = m; best[y] = sp; }
      }
    }
    const r = Math.round(1.5 * s);
    for (let y = 0; y < h; y++) {
      if (score[y] < 0.35) continue;
      let isMax = true;
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r) && isMax; j++) if (score[j] > score[y] || (score[j] === score[y] && j < y)) isMax = false;
      if (!isMax) continue;
      // tinh chỉnh: trọng tâm mực của từng dòng kẻ (dòng dày nhiều hàng), rồi khớp tâm + khoảng cách
      const cs = [0, 1, 2, 3, 4].map((k) => {
        const c = y + k * best[y], rr = best[y] / 3;
        let sw = 0, sy = 0;
        for (let j = Math.max(0, Math.ceil(c - rr)); j <= Math.min(h - 1, Math.floor(c + rr + 1)); j++) { sw += prof[j]; sy += prof[j] * j; }
        return sw ? sy / sw : c;
      });
      const center = mean(cs), sp = (2 * (cs[4] - cs[0]) + (cs[3] - cs[1])) / 10;
      cands.push({ strip: i, xc: (x0 + x1) / 2, center, sp, score: score[y] });
    }
  }
  // nối các dải: cùng khuông thì tâm gần nhau
  type Chain = { items: Cand[]; last: Cand };
  const chains: Chain[] = [];
  for (let i = 0; i < nStrips; i++) {
    for (const c of cands.filter((c) => c.strip === i)) {
      let bestC: Chain | null = null;
      for (const ch of chains) {
        if (ch.last.strip >= i || i - ch.last.strip > 4) continue;
        const dy = Math.abs(ch.last.center - c.center);
        if (dy < 0.6 * s && (!bestC || dy < Math.abs(bestC.last.center - c.center))) bestC = ch;
      }
      if (bestC) { bestC.items.push(c); bestC.last = c; } else chains.push({ items: [c], last: c });
    }
  }
  const total = (ch: Chain) => ch.items.reduce((t, c) => t + c.score, 0);
  const kept: StaffGeo[] = [];
  for (const ch of chains.filter((ch) => ch.items.length >= Math.max(3, 0.25 * nStrips)).sort((a, b) => total(b) - total(a))) {
    const center = median(ch.items.map((c) => c.center));
    if (kept.some((k) => Math.abs(k.center - center) < 4 * s)) continue;
    // tâm theo cột: nội suy tuyến tính giữa các dải (đã lọc trung vị 3 dải), ngoài hai đầu giữ nguyên
    const pts = ch.items.map((c, j, a) => ({ x: c.xc, y: median(a.slice(Math.max(0, j - 1), j + 2).map((q) => q.center)) }));
    const yc = new Float32Array(w);
    let j = 0;
    for (let x = 0; x < w; x++) {
      while (j + 1 < pts.length && pts[j + 1].x <= x) j++;
      if (x <= pts[0].x) yc[x] = pts[0].y;
      else if (j + 1 >= pts.length) yc[x] = pts[pts.length - 1].y;
      else yc[x] = pts[j].y + ((pts[j + 1].y - pts[j].y) * (x - pts[j].x)) / (pts[j + 1].x - pts[j].x);
    }
    kept.push({ yc, sp: median(ch.items.map((c) => c.sp)), center });
  }
  return kept.sort((a, b) => a.center - b.center);
}

/**
 * Nắn thẳng từng khuông: dời mỗi cột lên/xuống để tâm khuông nằm ngang ở một hàng cố định.
 * Vùng của mỗi khuông kéo tới nửa đường sang khuông bên cạnh.
 */
function straighten(g: Gray, staves: StaffGeo[]): Gray {
  const { width: w, height: h } = g;
  const shifts = staves.map((st) => st.yc.map((v) => v - st.center));
  if (shifts.every((sh) => sh.every((v) => Math.abs(v) < 0.35))) return g;
  const data = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let j = 0;
    for (let y = 0; y < h; y++) {
      while (j + 1 < staves.length && y > (staves[j].center + staves[j + 1].center) / 2) j++;
      const sy = y + shifts[j][x];
      const y0 = Math.floor(sy), t = sy - y0;
      const a = y0 >= 0 && y0 < h ? g.data[y0 * w + x] : 255, b = y0 + 1 >= 0 && y0 + 1 < h ? g.data[(y0 + 1) * w + x] : 255;
      data[y * w + x] = Math.round(a * (1 - t) + b * t);
    }
  }
  return { width: w, height: h, data };
}

/** Hàng mực của từng dòng kẻ (sau khi nắn thẳng): các hàng quanh vị trí dòng có mực ngang ≥ nửa đỉnh */
function staffLines(lineInk: Bits, st: StaffGeo): Line[] {
  const { w, d } = lineInk;
  // bề ngang khuông: cột có mực ở tâm khuông
  const rowFrac = (y: number) => {
    if (y < 0 || y >= lineInk.h) return 0;
    let n = 0;
    for (let x = 0; x < w; x++) n += d[y * w + x];
    return n / w;
  };
  return [0, 1, 2, 3, 4].map((k) => {
    const c = st.center + (k - 2) * st.sp;
    const r = Math.max(1, Math.floor(st.sp / 3));
    const ys: number[] = [];
    for (let y = Math.round(c) - r; y <= Math.round(c) + r; y++) ys.push(y);
    const fr = ys.map(rowFrac);
    const peak = Math.max(...fr);
    const on = ys.filter((_, i) => fr[i] >= 0.5 * peak && peak > 0);
    return on.length ? [Math.min(...on), Math.max(...on)] as Line : [Math.round(c), Math.round(c)] as Line;
  });
}

/** Xoá dòng kẻ (nới pad px mỗi bên cho hết viền xám), giữ chỗ có nét đi xuyên qua */
function removeLines(ink: Bits, lines: Line[], pad: number) {
  const out = ink.clone();
  const { w, h } = ink;
  for (let [a, b] of lines) {
    a = Math.max(a - pad, 0); b = Math.min(b + pad, h - 1);
    const above = Math.max(a - 1, 0), below = Math.min(b + 1, h - 1);
    for (let x = 0; x < w; x++) {
      if (ink.d[above * w + x] && ink.d[below * w + x]) continue;
      for (let y = a; y <= b; y++) out.d[y * w + x] = 0;
    }
  }
  return out;
}

/** Khoảng cách dòng kẻ của ảnh (px), hoặc null nếu không thấy khuông nhạc */
export function staffSpacing(g: Gray): number | null {
  const s = runSpacing(threshold(g, 210));
  return s && s >= 3 && findStaves(threshold(g, 225), s).length ? s : null;
}

// ───────────────────────── các phép đo cục bộ ─────────────────────────

interface Stem { x: number; a: number; b: number; up: boolean }

/**
 * Thân nốt: đoạn dọc ≥ 2.6 khe chạm đầu nốt, sát mép trái/phải. Nốt đầu nhóm có vạch nối dốc thì thân ngắn
 * (≈ 2 khe): nhận khi đầu thân chạm vạch nối — nét ngang dày chạy sang bên.
 */
function findStem(img: Bits, o: Box, s: number, strict: Bits = img): Stem | null {
  let best: [number, number, number] | null = null;
  const xs: number[] = [];
  for (let x = Math.max(o.x0 - 2, 0); x < o.x0 + 3; x++) xs.push(x);
  for (let x = o.x1 - 3; x < Math.min(o.x1 + 2, img.w); x++) xs.push(x);
  /** ở đầu thân (xa đầu nốt) có vạch nối: hàng mực ngang dài ≥ 1.2 khe */
  const beamAt = (x: number, a: number, b: number) => {
    const end = o.y0 - a > b - o.y1 ? a : b;
    for (let dy = 0; dy <= 0.4 * s; dy++) {
      const y = end + (end === a ? dy : -dy);
      let l = x, r = x;
      if (!img.get(x, y)) continue;
      while (img.get(l - 1, y)) l--;
      while (img.get(r + 1, y)) r++;
      if (r - l + 1 >= 1.2 * s) return true;
    }
    return false;
  };
  for (const x of xs) {
    for (let y = o.y0; y < o.y1; y++) {
      const r = verticalRun(img, x, y);
      if (!r || (best && r[1] - r[0] <= best[2] - best[1])) continue;
      const len = r[1] - r[0] + 1;
      if (len >= 2.6 * s || (len >= 1.9 * s && beamAt(x, r[0], r[1]))) best = [x, r[0], r[1]];
    }
  }
  if (!best) return null;
  const [x, a, b] = best;
  if (Math.max(o.y0 - a, b - o.y1) < 1.8 * s) return null;
  // thân nốt bắt đầu từ đầu nốt; nét dọc nhô ra cả hai phía là vạch nhịp / nét khác đi xuyên qua
  if (Math.min(o.y0 - a, b - o.y1) > 0.8 * s) return null;
  // thân nốt là nét thẳng, mảnh: đo bề ngang nét ở phần nhô ra khỏi đầu nốt (lặng đen zig-zag thì rộng)
  // chỉ đo nửa gần đầu nốt: nửa xa là chỗ móc / vạch nối dính vào thân
  const up = o.y0 - a > b - o.y1;
  const [ya, yb] = up ? [Math.round((a + o.y0 - 2) / 2), o.y0 - 2] : [o.y1 + 2, Math.round((o.y1 + 2 + b) / 2)];
  const widths: number[] = [];
  // đo trên ảnh ngưỡng chặt hơn: nét mảnh in mờ, phóng to thì viền xám làm nét to ra
  for (let y = ya; y <= yb; y++) {
    if (!strict.get(x, y)) continue;
    let l = x, r = x;
    while (strict.get(l - 1, y)) l--;
    while (strict.get(r + 1, y)) r++;
    widths.push(r - l + 1);
  }
  if (widths.length && median(widths) > 0.48 * s) return null;
  const c = cy(o);
  return { x, a, b, up: c - a > b - c };
}

/** Đếm móc / vạch nối ở đoạn 1.8 khe gần đầu thân (không chạm đầu nốt) */
function countFlags(img: Bits, st: Stem, s: number, dk?: (x: number, y: number) => number): number {
  let best = 0;
  const [y0, y1] = st.up ? [st.a, Math.min(st.a + Math.trunc(1.8 * s), img.h)] : [Math.max(st.b - Math.trunc(1.8 * s), 0), st.b + 1];
  /** các đoạn mực dọc ở cột x trong vùng đầu thân: [đầu, cuối] */
  const runsAt = (x: number) => {
    const out: [number, number][] = [];
    let a = -1;
    for (let y = y0; y <= y1; y++) {
      const on = y < y1 && img.get(x, y);
      if (on && a < 0) a = y;
      if (!on && a >= 0) { out.push([a, y - 1]); a = -1; }
    }
    return out;
  };
  if (dk) {
    // theo độ đậm (ảnh xám): móc / vạch nối sát nhau chỉ cách bởi khe hơi sáng hơn, ngưỡng nhị phân
    // làm dính lại; đếm đỉnh đậm tách nhau bởi chỗ trũng rõ (bỏ dòng kẻ: chỉ lấy điểm còn mực sau khi xoá)
    for (const side of [1, -1]) {
      const counts: number[] = [];
      for (const f of [0.6, 0.75, 0.9]) {
      const x = st.x + side * Math.round(f * s);
      if (x < 0 || x >= img.w) continue;
      const prof: number[] = [];
      for (let y = y0; y < y1; y++) prof.push(img.get(x, y) ? dk(x, y) : 0);
      let n = 0, peak = 0, valley = 1, inPeak = false;
      for (const v of prof) {
        if (!inPeak) {
          if (v >= 0.45 && (n === 0 || v - valley >= 0.2)) { inPeak = true; peak = v; n++; }
          else valley = Math.min(valley, v);
        } else if (v > peak) peak = v;
        else if (peak - v >= 0.2) { inPeak = false; valley = v; }
      }
      counts.push(n);
      }
      // móc cong có thể cắt cột hai lần: lấy số đếm trung vị của các cột
      if (counts.length) best = Math.max(best, median(counts));
    }
    // móc mảnh in nhạt có thể không đủ đậm: lấy thêm cách đếm trên ảnh nhị phân
    return Math.min(Math.max(Math.round(best), countFlags(img, st, s)), 3);
  }
  for (const side of [1, -1]) {
    const x = st.x + side * Math.round(0.7 * s);
    if (x < 0 || x >= img.w) continue;
    // chỉ tính nét dày ≥ 2 px, cách nhau ≥ 2 px (bỏ hạt nhiễu của ảnh chụp)
    const rs = runsAt(x).filter(([a, b]) => b - a + 1 >= 2);
    const next = runsAt(x + side * 3);
    let runs = 0, lastEnd = -Infinity;
    for (const [a, b] of rs) {
      if (a - lastEnd - 1 < 2) { lastEnd = b; continue; }
      lastEnd = b;
      // ảnh nhỏ phóng to: hai vạch nối sát nhau nhoè thành một vạch dày → tính theo bề dày thật
      // (vuông góc với nét: móc cờ dốc thì đoạn cắt dọc dài hơn bề dày), mỗi vạch ~0.5 khe, hở ~0.25 khe
      const m = next.find(([c, d]) => c <= b + 1 && a <= d + 1);
      const slope = m ? ((m[0] + m[1]) / 2 - (a + b) / 2) / 3 : 0;
      const thick = (b - a + 1) / Math.sqrt(1 + slope * slope);
      runs += Math.max(1, Math.round((thick + 0.25 * s) / (0.8 * s)));
    }
    best = Math.max(best, runs);
  }
  return Math.min(best, 3);
}

/** Chấm dôi: đốm nhỏ, tròn bên phải đầu nốt (ngang đầu nốt hoặc khe ngay trên) */
function hasDot(img: Bits, o: Box, s: number) {
  const c = cy(o);
  const x0 = o.x1 + 1, x1 = o.x1 + Math.trunc(1.6 * s);
  const y0 = Math.max(Math.trunc(c - 0.9 * s), 0), y1 = Math.trunc(c + 0.5 * s);
  const win = img.crop(y0, y1, x0, x1);
  const { boxes } = label(win);
  for (const b of boxes) {
    const hh = bh(b), ww = bw(b);
    let area = 0;
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) area += win.d[y * win.w + x];
    // chấm nhỏ (ảnh độ phân giải thấp phóng to: chỉ còn ~0.25 khe), tròn, đặc, tách khỏi đầu nốt
    if (0.22 * s <= hh && hh <= 0.75 * s && 0.22 * s <= ww && ww <= 0.75 * s && Math.abs(hh - ww) <= 0.3 * s && area >= 0.5 * hh * ww
      && b.x0 > 0 && b.x1 < win.w && b.y0 > 0 && b.y1 < win.h) return true;
  }
  return false;
}

/**
 * Khoá nhạc ở đầu khuông; trả mép phải và loại khoá.
 * Khoá Sol: khối cao > 5 khe (nhô ra trên và dưới khuông).
 * Khoá Fa: thân cong cao ~3 khe từ dòng trên xuống, bên phải có hai chấm kẹp dòng Fa (dòng thứ hai từ trên).
 */
function clefInfo(img: Bits, top: number, bottom: number, s: number, xLeft: number): { end: number; clef: 'G' | 'F' } {
  const by0 = Math.trunc(top - 3 * s);
  const band = img.crop(by0, Math.trunc(bottom + 3 * s), xLeft, xLeft + Math.trunc(6 * s));
  const { boxes } = label(band);
  let best = 0;
  for (const o of boxes) if (bh(o) >= 5 * s) best = Math.max(best, o.x1);
  if (best) return { end: xLeft + best, clef: 'G' };
  // khoá Fa: các mảnh thân (dòng kẻ xoá xong có thể vỡ) nằm trong nửa trên khuông, sát mép trái
  const t = top - by0;
  const body = boxes.filter((o) => o.x0 < 2.5 * s && o.y0 >= t - 0.9 * s && o.y1 <= t + 4 * s && Math.max(bh(o), bw(o)) >= 0.6 * s);
  if (body.length) {
    const u = { x0: Math.min(...body.map((o) => o.x0)), x1: Math.max(...body.map((o) => o.x1)), y0: Math.min(...body.map((o) => o.y0)), y1: Math.max(...body.map((o) => o.y1)) };
    const dot = (yc: number) => boxes.find((o) => o.x0 >= u.x1 - 0.6 * s && o.x0 <= u.x1 + 1.5 * s
      && bh(o) >= 0.2 * s && bh(o) <= 0.8 * s && bw(o) >= 0.2 * s && bw(o) <= 0.8 * s && Math.abs(cy(o) - yc) <= 0.35 * s);
    const d1 = dot(t + 0.5 * s), d2 = dot(t + 1.5 * s);
    if (bh(u) >= 2.2 * s && bh(u) <= 4.3 * s && u.y0 <= t + 0.6 * s && d1 && d2 && Math.abs(cx(d1) - cx(d2)) <= 0.6 * s) {
      return { end: xLeft + Math.max(d1.x1, d2.x1) + 1, clef: 'F' };
    }
  }
  return { end: xLeft + Math.trunc(3.6 * s), clef: 'G' };
}

/** khoá Fa: dòng dưới cùng là G2, thấp hơn E4 (dòng dưới khoá Sol) 12 bậc */
const F_CLEF_SHIFT = -12;

const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4]; // F♯5 C♯5 G♯5 D♯5 A♯4 E♯5 B♯4
const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1]; // B♭4 E♭5 A♭4 D♭5 G♭4 C♭5 F♭4
// khoá Fa: cùng hình xếp, thấp hơn một quãng ba trên khuông (F♯3 ở dòng thứ hai từ trên, B♭2 ở dòng thứ hai từ dưới)
const SHARP_STEPS_F = SHARP_STEPS.map((x) => x - 2);
const FLAT_STEPS_F = FLAT_STEPS.map((x) => x - 2);

/**
 * Hoá biểu theo vị trí chuẩn: dấu thăng / giáng luôn nằm ở các bậc cố định theo thứ tự cố định
 * (thăng: Fa Đô Sol Rê La Mi Si, giáng: Si Mi La Rê Sol Đô Fa), cách đều nhau ngay sau khoá nhạc.
 * Thử mọi vị trí bắt đầu / khoảng cách, đếm số dấu liên tiếp có mực đúng chỗ — không cần tách từng
 * dấu (ảnh nhỏ: các dấu dính nhau, dòng kẻ xoá xong thì vỡ vụn).
 * Mỗi dấu: hộp quanh vị trí phải có mực, phần khuông còn lại cùng cột phải trống
 * (chữ số chỉ nhịp, thân nốt phủ cả chiều cao khuông thì không đạt).
 */
function keySignatureByPosition(img: Bits, top: number, bottom: number, s: number, xFrom: number, clef: 'G' | 'F' = 'G'): { key: number; ends: Map<number, number> } {
  const frac = (x0: number, x1: number, y0: number, y1: number) => {
    x0 = Math.max(0, Math.round(x0)); x1 = Math.min(img.w, Math.round(x1)); y0 = Math.max(0, Math.round(y0)); y1 = Math.min(img.h, Math.round(y1));
    if (x1 <= x0 || y1 <= y0) return 0;
    let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) n += img.d[y * img.w + x];
    return n / ((x1 - x0) * (y1 - y0));
  };
  /** số cột có mực trong hộp */
  const inkCols = (x0: number, x1: number, y0: number, y1: number) => {
    x0 = Math.max(0, Math.round(x0)); x1 = Math.min(img.w, Math.round(x1)); y0 = Math.max(0, Math.round(y0)); y1 = Math.min(img.h, Math.round(y1));
    let n = 0;
    for (let x = x0; x < x1; x++) for (let y = y0; y < y1; y++) if (img.d[y * img.w + x]) { n++; break; }
    return n;
  };
  const ct = top - 0.5 * s, cb = bottom + 0.5 * s;
  const glyph = (kind: number, x: number, step: number) => {
    const y = bottom - (step * s) / 2;
    // thăng: cao ~2.6 khe, tâm ở bậc; giáng: thân nhô lên ~2 khe, bụng ở bậc
    const [gy0, gy1] = kind > 0 ? [y - 1.25 * s, y + 1.25 * s] : [y - 1.9 * s, y + 0.6 * s];
    const gx0 = x - 0.4 * s, gx1 = x + 0.4 * s;
    const f = Math.min(frac(gx0, gx1, gy0, (gy0 + gy1) / 2), frac(gx0, gx1, (gy0 + gy1) / 2, gy1));
    // dấu thăng / bụng dấu giáng có bề ngang; thân nốt đứng gần đó chỉ là một nét dọc mảnh
    if (f && inkCols(gx0, gx1, (gy0 + gy1) / 2, gy1) < 0.3 * s) return 0;
    let fc = 0;
    if (gy0 - 0.3 * s > ct) fc = Math.max(fc, frac(gx0, gx1, ct, gy0 - 0.3 * s));
    if (gy1 + 0.3 * s < cb) fc = Math.max(fc, frac(gx0, gx1, gy1 + 0.3 * s, cb));
    return f >= 0.12 && fc <= 0.06 ? f : 0;
  };
  let best = { n: 0, kind: 0, score: 0 };
  // mép phải của hoá biểu cho từng số dấu (dùng khi số dấu được sửa theo các khuông khác)
  const ends = new Map<number, number>([[0, xFrom]]);
  const endScore = new Map<number, number>();
  for (const kind of [1, -1]) {
    const steps = clef === 'F' ? (kind > 0 ? SHARP_STEPS_F : FLAT_STEPS_F) : (kind > 0 ? SHARP_STEPS : FLAT_STEPS);
    for (let x1 = xFrom + 0.4 * s; x1 <= xFrom + 2.4 * s; x1++) {
      for (let dx = 0.65 * s; dx <= 1.45 * s; dx += 0.5) {
        let n = 0, sc = 0;
        for (let i = 0; i < 7; i++) {
          const g = glyph(kind, x1 + i * dx, steps[i]);
          if (!g) break;
          n++; sc += g;
          if (sc / n > (endScore.get(kind * n) ?? 0)) { endScore.set(kind * n, sc / n); ends.set(kind * n, Math.round(x1 + i * dx + 0.5 * s)); }
        }
        if (n > best.n || (n === best.n && n > 0 && sc > best.score)) best = { n, kind, score: sc };
      }
    }
  }
  return { key: best.kind * best.n, ends };
}

/** Cụm chữ số chỉ nhịp ngay sau khoá/hoá biểu: trả [x đầu, x cuối] */
function timeSigSpan(img: Bits, top: number, bottom: number, s: number, xFrom: number): [number, number] | null {
  const y0 = Math.trunc(top - 0.5 * s);
  const band = img.crop(y0, Math.trunc(bottom + 0.5 * s) + 1, xFrom, xFrom + Math.trunc(8 * s));
  const { boxes } = label(band);
  const mid = (bottom - top) / 2 + 0.5 * s;
  // chữ "C" (nhịp 4/4): một khối ở giữa khuông, cao ~2 khe — có thể vỡ thành vài mảnh khi xoá dòng kẻ
  // (chữ "¢" — nhịp 2/2 — có thêm nét dọc nhô ra trên dưới)
  const near = boxes.filter((b) => bh(b) >= 0.5 * s && bh(b) <= 4 * s && b.x0 < 3 * s);
  if (near.length) {
    const u = { x0: Math.min(...near.map((b) => b.x0)), x1: Math.max(...near.map((b) => b.x1)), y0: Math.min(...near.map((b) => b.y0)), y1: Math.max(...near.map((b) => b.y1)) };
    if (Math.abs(cy(u) + y0 - (top + bottom) / 2) <= 0.6 * s && 1.1 * s <= bh(u) && bh(u) <= 3.6 * s && 1.1 * s <= bw(u) && bw(u) <= 2.4 * s) {
      return [xFrom + u.x0 - 1, xFrom + u.x1 + 1];
    }
  }
  const { lab } = label(band);
  for (const [i, a] of boxes.entries()) {
    // hai chữ số dính nhau: khối cao gần bằng khuông, rộng (nốt + thân thì hẹp và thò ra ngoài khuông)
    const inside = a.y0 > 0 && a.y1 < band.h;
    if (!(3.0 * s <= bh(a) && bh(a) <= 4.8 * s && 1.2 * s <= bw(a) && bw(a) <= 3 * s && inside && a.x0 < 3 * s)) continue;
    // chữ số rộng đều từ trên xuống; nốt + thân thì phần lớn các hàng chỉ còn nét thân mảnh
    let wide = 0;
    for (let y = a.y0; y < a.y1; y++) {
      let l = Infinity, r = -1;
      for (let x = a.x0; x < a.x1; x++) if (lab[y * band.w + x] === i + 1) { l = Math.min(l, x); r = x; }
      if (r - l + 1 >= 0.45 * bw(a)) wide++;
    }
    if (wide >= 0.6 * bh(a)) return [xFrom + a.x0 - 1, xFrom + a.x1 + 1];
  }
  for (const a of boxes) for (const b of boxes) {
    if (a === b || !(1.3 * s <= bh(a) && bh(a) <= 2.6 * s && 1.3 * s <= bh(b) && bh(b) <= 2.6 * s)) continue;
    if (a.y1 <= mid + 0.5 * s && b.y0 >= mid - 0.5 * s && Math.abs(a.x0 - b.x0) < 0.8 * s) {
      return [xFrom + Math.min(a.x0, b.x0) - 1, xFrom + Math.max(a.x1, b.x1) + 1];
    }
  }
  return null;
}

/**
 * Ngoặc liên ba trên / dưới khuông: hai đoạn kẻ ngang mảnh cùng độ cao, giữa là con số nhỏ ("— 3 —",
 * "⌐ 3 ¬"). Không cần đọc ra chữ số: ngoặc lặp (volta) là một đường liền, dấu nối là đường cong.
 * Trả khoảng x của ngoặc.
 */
function findTuplets(img: Bits, top: number, bottom: number, s: number, xFrom: number, xTo: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [ra, rb] of [[top - 4 * s, top - 0.4 * s], [bottom + 0.4 * s, bottom + 3.5 * s]]) {
    const y0 = Math.max(0, Math.round(ra)), y1 = Math.min(img.h, Math.round(rb));
    if (y1 - y0 < 3) continue;
    const band = img.crop(y0, y1, Math.max(0, xFrom), Math.min(img.w, xTo));
    // chỉ giữ mực thuộc đoạn ngang dài ≥ 0.8 khe
    const hl = new Bits(band.w, band.h);
    for (let y = 0; y < band.h; y++) {
      let x = 0;
      while (x < band.w) {
        if (!band.d[y * band.w + x]) { x++; continue; }
        const a = x;
        while (x < band.w && band.d[y * band.w + x]) x++;
        if (x - a >= 0.8 * s) hl.d.fill(1, y * band.w + a, y * band.w + x);
      }
    }
    // đoạn kẻ: mảnh, dài, trên và dưới là nền trắng (nét chữ viết tay của lời bài hát thì dính chữ)
    const clearAround = (b: Box) => {
      let n = 0, t = 0;
      for (const y of [b.y0 - Math.round(0.35 * s), b.y1 - 1 + Math.round(0.35 * s)]) {
        if (y < 0 || y >= band.h) continue;
        // bỏ hai đầu: ngoặc "⌐ ¬" có móc cong xuống / lên ở đầu
        const m = Math.round(0.5 * s);
        for (let x = b.x0 + m; x < b.x1 - m; x++) { t++; n += band.d[y * band.w + x]; }
      }
      return t > 0 && n / t <= 0.15;
    };
    const { lab: bandLab, boxes: allBlobs } = label(band);
    /**
     * Đoạn kẻ đứng riêng: phần mực dính liền với nó (trong khoảng ngang của đoạn, bỏ hai đầu) chỉ là chính
     * đường kẻ — nét chữ viết tay của lời bài hát thì dính chữ cái cao thấp; đầu ngoặc chạm thân nốt thì không sao
     */
    const freeLine = (b: Box) => {
      const y = Math.round(cy(b)), x = Math.round(cx(b));
      let id = 0;
      for (let dy = -1; dy <= 1 && !id; dy++) id = bandLab[(y + dy) * band.w + x] || 0;
      if (!id) return false;
      const m = Math.round(0.5 * s), r = Math.round(1.0 * s);
      let on = 0, off = 0;
      for (let yy = Math.max(0, b.y0 - r); yy < Math.min(band.h, b.y1 + r); yy++) {
        for (let xx = b.x0 + m; xx < b.x1 - m; xx++) {
          if (bandLab[yy * band.w + xx] !== id) continue;
          if (yy >= b.y0 - 1 && yy <= b.y1) on++; else off++;
        }
      }
      return on > 0 && off <= 0.15 * on;
    };
    const segs = label(hl).boxes.filter((b) => bh(b) <= 0.75 * s && bw(b) >= 1.4 * s && bw(b) >= 3 * bh(b) && clearAround(b) && freeLine(b)).sort((a, b) => a.x0 - b.x0);
    const blobs = allBlobs.filter((b) => 0.45 * s <= bh(b) && bh(b) <= 2.0 * s && 0.25 * s <= bw(b) && bw(b) <= 1.6 * s);
    const used = new Set<Box>();
    for (const L of segs) for (const R of segs) {
      // ngoặc có thể nghiêng theo hướng giai điệu
      if (L === R || used.has(L) || used.has(R) || Math.abs(cy(L) - cy(R)) > 1.0 * s) continue;
      const gap = R.x0 - L.x1;
      if (gap < 0.3 * s || gap > 6 * s || R.x1 - L.x0 < 2.2 * s) continue;
      // con số đứng một mình trong khe (chữ lời bài hát thì nhiều chữ cái sát nhau)
      // (bỏ qua thân nốt thò xuống / lên và vạch nối của nhóm nốt ngay dưới ngoặc)
      const inGap = allBlobs.filter((b) => b.x1 > L.x1 + 1 && b.x0 < R.x0 - 1 && Math.abs(cy(b) - (cy(L) + cy(R)) / 2) <= 1.2 * s && Math.max(bh(b), bw(b)) >= 0.35 * s
        && !(bw(b) <= 0.35 * s && bh(b) >= 1.0 * s) && !(bw(b) >= 1.5 * s && bw(b) >= 2 * bh(b)));
      // con số nằm giữa khe
      const digit = inGap.length === 1 && blobs.includes(inGap[0]) && Math.abs(cx(inGap[0]) - (L.x1 + R.x0) / 2) <= 1.0 * s;
      if (!digit) continue;
      used.add(L); used.add(R);
      out.push([L.x0 + xFrom, R.x1 + xFrom]);
    }
  }
  return out;
}

/** Vạch nhịp: nét dọc phủ đúng từ dòng trên tới dòng dưới, không dính đầu nốt */
function barlines(img: Bits, top: number, bottom: number, s: number, xFrom: number, xTo: number, heads: number[]) {
  const xs: number[] = [];
  const midY = Math.trunc((top + bottom) / 2);
  for (let x = Math.max(0, xFrom); x < Math.min(xTo, img.w); x++) {
    const r = verticalRun(img, x, midY);
    if (r && Math.abs(r[0] - top) <= 0.5 * s && Math.abs(r[1] - bottom) <= 0.5 * s && heads.every((hx) => Math.abs(x - hx) > s)) xs.push(x);
  }
  const groups: number[][] = [];
  for (const x of xs) { const g = groups[groups.length - 1]; if (g && x - g[g.length - 1] <= 2) g.push(x); else groups.push([x]); }
  return groups.map(mean);
}

/**
 * Dấu nhắc lại: hai chấm ở hai khe giữa khuông (kẹp dòng giữa) đứng sát một vạch phủ cả khuông.
 * Vạch bên phải hai chấm → kết đoạn nhắc lại (:‖); vạch bên trái → mở đoạn (‖:).
 */
function findRepeats(img: Bits, top: number, bottom: number, s: number, xFrom: number, xTo: number): { x: number; kind: 'start' | 'end' }[] {
  const mid = (top + bottom) / 2;
  const y0 = Math.max(0, Math.round(mid - 1.4 * s));
  const band = img.crop(y0, Math.min(img.h, Math.round(mid + 1.4 * s)), Math.max(0, xFrom), Math.min(img.w, xTo));
  const dots = label(band).boxes.filter((o) => bh(o) >= 0.2 * s && bh(o) <= 0.8 * s && bw(o) >= 0.2 * s && bw(o) <= 0.8 * s);
  const fullBar = (x: number) => {
    const r = verticalRun(img, x, Math.round(mid));
    return !!r && Math.abs(r[0] - top) <= 0.6 * s && Math.abs(r[1] - bottom) <= 0.6 * s;
  };
  const out: { x: number; kind: 'start' | 'end' }[] = [];
  for (const a of dots) {
    if (Math.abs(cy(a) + y0 - (mid - 0.5 * s)) > 0.3 * s) continue;
    const b = dots.find((o) => Math.abs(cy(o) + y0 - (mid + 0.5 * s)) <= 0.3 * s && Math.abs(cx(o) - cx(a)) <= 0.5 * s);
    if (!b) continue;
    const dl = Math.max(0, xFrom) + Math.min(a.x0, b.x0), dr = Math.max(0, xFrom) + Math.max(a.x1, b.x1);
    // vạch gần nhất mỗi bên (trong 1.2 khe)
    let right = -1, left = -1;
    for (let x = dr; x <= dr + 1.2 * s && right < 0; x++) if (fullBar(x)) right = x;
    for (let x = dl - 1; x >= dl - 1.2 * s && left < 0; x--) if (fullBar(x)) left = x;
    if (right >= 0 && (left < 0 || right - dr <= dl - left)) out.push({ x: right, kind: 'end' });
    else if (left >= 0) out.push({ x: left, kind: 'start' });
  }
  return out.sort((p, q) => p.x - q.x);
}

/**
 * Ngoặc lần 1: đường kẻ ngang mảnh phía trên khuông, đầu trái có móc thả xuống, kết thúc ở dấu :‖ (thường có
 * móc phải ngay trên vạch). Không cần đọc số "1.": ngoặc kết thúc ở dấu :‖ là ngoặc lần 1; ngoặc lần 2 nằm sau
 * dấu :‖ nên lượt nhắc lại tự nối vào. Trả khoảng x [mép trái ngoặc, dấu :‖].
 */
function findFirstEndings(img: Bits, top: number, s: number, ends: number[], yMin: number): [number, number][] {
  const out: [number, number][] = [];
  for (const e of ends) {
    const probe = Math.round(e - 0.8 * s);
    let found: [number, number] | null = null;
    // ngoặc có thể nằm rất cao (trên nốt cao, ký hiệu kéo vĩ, tên hợp âm): dò tới sát khuông phía trên
    for (let y = Math.round(top - 0.6 * s); y >= Math.max(1, Math.round(yMin), Math.round(top - 12 * s)) && !found; y--) {
      if (!img.get(probe, y)) continue;
      // đường kẻ ngang chạy sang trái từ chỗ dò, mảnh (trên và dưới đường là nền trắng ở giữa đoạn)
      let l = probe;
      while (img.get(l - 1, y) || img.get(l - 1, y - 1) || img.get(l - 1, y + 1)) l--;
      if (probe - l < 2.5 * s) continue;
      const mid = Math.round((l + probe) / 2);
      if (img.get(mid, y - Math.round(0.35 * s)) || img.get(mid, y + Math.round(0.35 * s))) continue;
      // móc trái thả xuống
      let hook = 0;
      for (let x = l; x <= l + 2 && !hook; x++) {
        const r = verticalRun(img, x, y + 1);
        if (r && r[1] - y >= 0.7 * s) hook = r[1] - y;
      }
      if (hook) found = [l, e];
    }
    if (found) out.push(found);
  }
  return out;
}

/** kind 2: thăng hoặc bình (ảnh mờ không phân biệt được) — quyết theo ngữ cảnh: nốt đang bị hoá thì là bình */
interface Accidental { box: Box; kind: -1 | 0 | 1 | 2 }

/**
 * Phân loại ký hiệu dấu hoá theo hình dạng của chính nó (so các phần với nhau, đơn vị = khe):
 *  - thăng: phần trên có 2 nét dọc mảnh
 *  - giáng: phần trên là 1 nét mảnh, phần dưới phình "bụng" sang phải
 *  - bình: phần trên 1 nét, phần dưới 1 nét mảnh lệch sang phải
 * Nốt có thân thì khác: phần trên rộng (đầu nốt) hoặc đầu nốt nằm bên trái thân.
 */
function classifyAccidental(lab: Int32Array, w: number, o: Box, id: number, s: number): -1 | 0 | 1 | null {
  const runsAt = (y: number) => {
    const r: [number, number][] = [];
    for (let x = o.x0; x < o.x1; x++) {
      const on = lab[y * w + x] === id;
      if (on && (!r.length || r[r.length - 1][1] !== x - 1)) r.push([x, x]);
      else if (on) r[r.length - 1][1] = x;
    }
    return r;
  };
  const thin = (r: [number, number]) => r[1] - r[0] + 1 <= 0.6 * s; // đầu nốt luôn rộng > 1 khe
  const tops = [0.05, 0.1, 0.15, 0.2, 0.25].map((f) => runsAt(Math.trunc(o.y0 + f * bh(o))));
  if (tops.some((r) => r.length >= 2 && r.every(thin))) return 1;
  const top = tops[2];
  if (top.length !== 1 || !thin(top[0])) return null;
  const bot = runsAt(Math.trunc(o.y0 + 0.88 * bh(o)));
  if (bot.length === 1 && thin(bot[0]) && bot[0][0] > top[0][1] + 0.15 * s) return 0;
  // bụng của dấu giáng: ở nửa dưới, mực lan sang phải thân ≥ 0.3 khe, không lan sang trái
  let right = -Infinity, left = Infinity;
  for (const f of [0.5, 0.6, 0.7, 0.8, 0.9]) for (const r of runsAt(Math.trunc(o.y0 + f * bh(o)))) { right = Math.max(right, r[1]); left = Math.min(left, r[0]); }
  if (right >= top[0][1] + 0.3 * s && left >= top[0][0] - 0.15 * s) return -1;
  return null;
}

/** Dấu hoá giữa bài: ký hiệu cao 1.8–3.6 khe đứng ngay trước một đầu nốt */
function findAccidentals(img: Bits, heads: Box[], s: number, xFrom: number): Accidental[] {
  const out: Accidental[] = [];
  const { lab, boxes } = label(img);
  boxes.forEach((o, i) => {
    if (o.x0 < xFrom || !(1.8 * s <= bh(o) && bh(o) <= 3.6 * s && 0.45 * s <= bw(o) && bw(o) <= 1.4 * s)) return;
    // phải đứng ngay bên trái một đầu nốt (không phải chính nó), ngang tầm đầu nốt
    const head = heads.find((h) => cx(h) > o.x1 && h.x0 - 1.8 * s <= o.x1 && o.x1 <= h.x0 + 0.4 * s && Math.abs(cy(h) - cy(o)) <= 1.3 * s);
    if (!head || heads.some((h) => overlaps(h, o))) return;
    let kind: Accidental['kind'] | null = classifyAccidental(lab, img.w, o, i + 1, s);
    if (kind === null && bw(o) >= 0.6 * s) {
      // ảnh mờ: dựa vào dáng theo chiều dọc so với đầu nốt — giáng nhô hẳn lên trên (thân ~2 khe, bụng
      // ngang đầu nốt), thăng / bình cân hai phía
      const up = cy(head) - o.y0, down = o.y1 - cy(head);
      if (up > 1.6 * down && down <= 0.9 * s) kind = -1;
      else if (Math.abs(up - down) <= 0.6 * s) kind = 2;
    }
    if (kind === null) return;
    out.push({ box: o, kind });
  });
  return out;
}

/**
 * Dấu hoá dính vào đầu nốt (ảnh nhỏ: không tách được thành khối riêng): xét các cột ngay bên trái
 * đầu nốt, mỗi cột lấy đoạn mực dọc đi qua ngang tầm đầu nốt; dấu hoá là các nét dọc dài 1.8–3.4 khe
 * (vạch nhịp phủ cả khuông). Giáng nhô hẳn lên trên, thăng / bình cân hai phía.
 * `stems`: cột thân các nốt đã nhận — bỏ qua (thân ngắn của nốt có vạch nối đứng ngay trước nốt sau trông như ♭).
 */
function accidentalBefore(img: Bits, hx: number, hy: number, s: number, xFrom: number, stems: number[] = []): -1 | 2 | null {
  const right = Math.round(hx - 0.62 * s), left = Math.max(xFrom, Math.round(hx - 2.0 * s));
  const tops: number[] = [], bots: number[] = [];
  for (let x = left; x < right; x++) {
    if (stems.some((sx) => Math.abs(sx - x) <= 2)) continue;
    let best: [number, number] | null = null;
    for (let y = Math.round(hy - 0.5 * s); y <= Math.round(hy + 0.5 * s); y++) {
      const r = verticalRun(img, x, y);
      if (r && (!best || r[1] - r[0] > best[1] - best[0])) best = r;
    }
    if (!best) continue;
    const len = best[1] - best[0] + 1;
    if (len >= 1.8 * s && len <= 3.4 * s) { tops.push(hy - best[0]); bots.push(best[1] - hy); }
  }
  if (tops.length < 2) return null;
  const up = median(tops), down = median(bots);
  if (up > 1.6 * down && down <= 0.9 * s) return -1;
  if (Math.abs(up - down) <= 0.6 * s) return 2;
  return null;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Dấu lặng trong khuông: lặng tròn/trắng (khối dẹt), lặng móc đơn (hình 7), lặng đen (zig-zag) */
function findRests(img: Bits, dotImg: Bits, top: number, bottom: number, s: number, xFrom: number, xTo: number, occupied: Box[]) {
  const y0 = Math.max(0, Math.trunc(top - 0.6 * s)), y1 = Math.min(img.h, Math.trunc(bottom + 0.6 * s) + 1);
  const band = img.crop(y0, y1, xFrom, xTo);
  const { lab, boxes } = label(band);
  const out: { x: number; y: number; beats: number }[] = [];
  boxes.forEach((b, i) => {
    const box = { y0: b.y0 + y0, y1: b.y1 + y0, x0: b.x0 + xFrom, x1: b.x1 + xFrom };
    if (occupied.some((o) => overlaps(o, box))) return;
    let area = 0;
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) if (lab[y * band.w + x] === i + 1) area++;
    const h = bh(box), w = bw(box), c = cy(box), dens = area / (h * w);
    let beats = 0;
    // lặng tròn treo dưới dòng kẻ 4, lặng trắng đặt trên dòng kẻ 3
    if (0.2 * s <= h && h <= 0.85 * s && 0.8 * s <= w && w <= 2.4 * s && dens >= 0.6) {
      if (Math.abs(box.y0 - (top + s)) <= 0.35 * s) beats = 4;
      else if (Math.abs(box.y1 - (top + 2 * s)) <= 0.35 * s) beats = 2;
    }
    else if (1.2 * s <= h && h <= 2.2 * s && 0.55 * s <= w && w <= 1.3 * s && c > top + 0.8 * s && c < bottom - 0.3 * s) beats = 0.5;
    else if (2.2 * s < h && h <= 3.4 * s && 0.55 * s <= w && w <= 1.4 * s && c > top + s && c < bottom - s) {
      // lặng đen là nét gấp khúc: tâm mực từng hàng lệch qua lại; vạch nhịp kép mờ thì thẳng đứng
      const cs: number[] = [];
      for (let y = b.y0; y < b.y1; y++) {
        let n = 0, t = 0;
        for (let x = b.x0; x < b.x1; x++) if (lab[y * band.w + x] === i + 1) { n++; t += x; }
        if (n) cs.push(t / n);
      }
      const m = mean(cs), sd = Math.sqrt(mean(cs.map((v) => (v - m) ** 2)));
      if (sd >= 0.045 * s) beats = 1;
    }
    if (!beats) return;
    if (hasDot(dotImg, box, s)) beats *= 1.5;
    out.push({ x: cx(box), y: c, beats });
  });
  return out;
}

/** Dấu nối: đường cong mảnh, dẹt, không dính đầu nốt / thân nốt */
function findTies(img: Bits, s: number, xFrom: number, occupied: Box[]): Box[] {
  const { lab, boxes } = label(img);
  return boxes.filter((o, i) => {
    if (o.x0 < xFrom || occupied.some((p) => overlaps(p, o))) return false;
    const h = bh(o), w = bw(o);
    if (!(0.3 * s <= h && h <= 1.5 * s && 1.5 * s <= w && w <= 14 * s && w >= 2.5 * h)) return false;
    let area = 0;
    for (let y = o.y0; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) if (lab[y * img.w + x] === i + 1) area++;
    return area / (h * w) <= 0.45;
  });
}

/**
 * Lòng nốt trắng: số điểm trắng bị mực bao kín, nằm ở giữa đầu nốt (50% bề ngang, 70% chiều cao).
 * Đo trên ảnh CÒN dòng kẻ: dòng kẻ dày cùng vành nốt khép kín các khe trắng nhỏ.
 */
function enclosedWhite(img: Bits, o: Box): number {
  const patch = img.crop(o.y0 - 1, o.y1 + 1, o.x0 - 1, o.x1 + 1);
  const holes = fillHoles(patch).andNot(patch);
  // chỉ tính phần giữa: ô trắng kẹp giữa mép đầu nốt, thân nốt và dòng kẻ nằm sát cạnh, không phải lòng nốt
  const mx = Math.floor(bw(o) * 0.25), my = Math.floor(bh(o) * 0.15);
  let n = 0;
  for (let y = 1 + my; y < patch.h - 1 - my; y++) for (let x = 1 + mx; x < patch.w - 1 - mx; x++) n += holes.d[y * patch.w + x];
  return n;
}

/** Các thân nốt (nét dọc thẳng, mảnh, dài 2.8–6 khe) trong vùng khuông; bỏ vạch nhịp */
function stemSegments(img: Bits, s: number, xFrom: number, xTo: number): Stem[] {
  const segs: { x: number; a: number; b: number }[] = [];
  for (let x = Math.max(0, xFrom); x < Math.min(img.w, xTo); x++) {
    let y = 0;
    while (y < img.h) {
      if (!img.get(x, y)) { y++; continue; }
      const r = verticalRun(img, x, y)!;
      if (r[1] - r[0] + 1 >= 2.8 * s && r[1] - r[0] + 1 <= 6 * s) segs.push({ x, a: r[0], b: r[1] });
      y = r[1] + 1;
    }
  }
  // gộp các cột liền nhau của cùng một nét
  const out: Stem[] = [];
  const used = new Array(segs.length).fill(false);
  segs.forEach((g, i) => {
    if (used[i]) return;
    const xs = [g.x];
    let a = g.a, b = g.b, last = g.x;
    for (let j = i + 1; j < segs.length; j++) {
      const h = segs[j];
      if (h.x > last + 1) break;
      if (!used[j] && h.x === last + 1 && h.a < b && a < h.b) { used[j] = true; xs.push(h.x); a = Math.min(a, h.a); b = Math.max(b, h.b); last = h.x; }
    }
    if (xs.length > 0.48 * s) return; // không mảnh
    // nét phủ đúng cả khuông có thể là vạch nhịp HOẶC thân nốt nằm trên dòng dưới (E4, F4):
    // vẫn giữ lại, bên gọi chỉ nhận khi có đầu nốt ở đầu nét
    out.push({ x: Math.round(xs.reduce((t, v) => t + v, 0) / xs.length), a, b, up: true });
  });
  return out;
}

/**
 * Đầu nốt ở đầu một thân nốt: khối mực cỡ đầu nốt ngay bên trái đầu dưới (thân quay lên)
 * hoặc bên phải đầu trên (thân quay xuống). Lõi thưa mực so với vành → nốt trắng.
 */
function headAtStem(img: Bits, inkWithLines: Bits, st: Stem, s: number, lineRow: Uint8Array): { box: Box; hollow: boolean; up: boolean } | null {
  // thân nốt thường chạy xuyên qua mép đầu nốt → đầu nốt có thể nằm lùi vào trong thân tới 1.3 khe
  const tries: { box: Box; up: boolean }[] = [
    { box: { x0: Math.round(st.x - 1.6 * s), x1: st.x - 1, y0: Math.round(st.b - 1.3 * s), y1: Math.round(st.b + 0.5 * s) }, up: true },
    { box: { x0: st.x + 2, x1: Math.round(st.x + 1.6 * s), y0: Math.round(st.a - 0.5 * s), y1: Math.round(st.a + 1.3 * s) }, up: false },
  ];
  let best: { box: Box; hollow: boolean; up: boolean; score: number } | null = null;
  for (const { box, up } of tries) {
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0;
    for (let y = Math.max(0, box.y0); y < Math.min(img.h, box.y1); y++) {
      if (lineRow[y]) continue;
      for (let x = Math.max(0, box.x0); x < Math.min(img.w, box.x1); x++) {
        if (!img.get(x, y)) continue;
        n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
      }
    }
    if (!n) continue;
    const w = x1 - x0, h = y1 - y0;
    if (w < 0.8 * s || w > 1.7 * s || h < 0.5 * s || h > 1.4 * s) continue;
    // lõi: nửa giữa của khối, bỏ hàng dòng kẻ
    let cn = 0, ci = 0;
    for (let y = y0 + Math.floor(h / 4); y < y1 - Math.floor(h / 4); y++) {
      if (lineRow[y]) continue;
      for (let x = x0 + Math.floor(w / 4); x < x1 - Math.floor(w / 4); x++) { cn++; ci += img.get(x, y); }
    }
    const core = cn ? ci / cn : 1;
    let rows = 0;
    for (let y = y0; y < y1; y++) if (!lineRow[y]) rows++;
    const dens = n / Math.max(1, w * rows);
    if (dens < 0.2) continue;
    const hollow = core < 0.5 || enclosedWhite(inkWithLines, { x0, x1, y0, y1 }) >= Math.max(3, 0.02 * s * s);
    const score = hollow ? 2 : dens; // ưu tiên dạng vòng (nốt trắng) — đầu kia thường là vạch nối / móc
    if (!best || score > best.score) best = { box: { x0, x1, y0, y1 }, hollow, up, score };
  }
  return best && { box: best.box, hollow: best.hollow, up: best.up };
}

// ───────────────────────── đầu nốt theo mẫu ─────────────────────────

type Pt = [number, number];
/** Các điểm trong vành elip (bán trục a, b, nghiêng góc t) có bán kính chuẩn hoá trong [r0, r1] */
function ellipsePts(a: number, b: number, t: number, r0: number, r1: number): Pt[] {
  const out: Pt[] = [];
  const R = Math.ceil(Math.max(a, b) * r1) + 1;
  const c = Math.cos(t), sn = Math.sin(t);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const u = (dx * c + dy * sn) / a, v = (-dx * sn + dy * c) / b;
    const r = Math.sqrt(u * u + v * v);
    if (r >= r0 && r <= r1) out.push([dx, dy]);
  }
  return out;
}

interface HeadHit { x: number; y: number; step: number; hollow: boolean; wide: boolean; score: number }

/**
 * Tìm đầu nốt bằng khớp mẫu bầu dục, chỉ ở các bậc cao độ (dòng kẻ / khe, cả dòng kẻ phụ) của khuông:
 * vị trí dọc đã biết trước nên chỉ cần quét ngang. Đo trên độ đậm (ảnh xám còn dòng kẻ) nên không bị
 * bước xoá dòng kẻ làm vỡ vành nốt trắng nhỏ.
 *  - nốt đen: lòng elip đậm, vòng bên ngoài không đậm kín (không phải vạch nối đôi / khối mực)
 *  - nốt trắng / nốt tròn: vành đậm, lõi (bỏ các hàng dòng kẻ) sáng
 */
function templateHeads(dark: Float32Array, w: number, h: number, top: number, bottom: number, s: number, xFrom: number, xTo: number, lineHalf: number): HeadHit[] {
  const tilt = -0.35;
  const fill = ellipsePts(0.6 * s, 0.43 * s, tilt, 0, 1);
  const around = ellipsePts(0.6 * s, 0.43 * s, tilt, 1.45, 1.65);
  const ring = ellipsePts(0.62 * s, 0.45 * s, tilt, 0.72, 1.05);
  const inner = ellipsePts(0.62 * s, 0.45 * s, tilt, 0, 0.6);
  const wRing = ellipsePts(0.78 * s, 0.47 * s, 0, 0.72, 1.05);
  const wInner = ellipsePts(0.78 * s, 0.47 * s, 0, 0, 0.6);
  const seed = ellipsePts(0.62 * s, 0.45 * s, tilt, 0, 0.8), wSeed = ellipsePts(0.78 * s, 0.47 * s, 0, 0, 0.8);
  const rOut = ellipsePts(0.62 * s, 0.45 * s, tilt, 1.4, 1.65), wOut = ellipsePts(0.78 * s, 0.47 * s, 0, 1.35, 1.6);
  // hàng thuộc dòng kẻ (cả dòng kẻ phụ trên/dưới khuông)
  const onLine = (y: number) => { const f = (y - top) / s; return Math.abs(f - Math.round(f)) * s <= lineHalf; };
  const left = around.filter(([dx]) => dx < -0.45 * s), right = around.filter(([dx]) => dx > 0.45 * s);
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? dark[y * w + x] : 0);
  // độ lệch chỉ số (dy*w+dx) của từng mẫu, dùng khi cả mẫu nằm trong ảnh (nhanh, không kiểm tra biên)
  const R0 = Math.ceil(2 * s);
  const offs = new Map<Pt[], Int32Array>();
  const offOf = (pts: Pt[]) => { let o = offs.get(pts); if (!o) { o = Int32Array.from(pts, ([dx, dy]) => dy * w + dx); offs.set(pts, o); } return o; };
  const avg = (pts: Pt[], x: number, y: number, skipLines: boolean) => {
    if (!skipLines && x >= R0 && y >= R0 && x < w - R0 && y < h - R0) {
      const o = offOf(pts), c = y * w + x;
      let t = 0;
      for (let i = 0; i < o.length; i++) t += dark[c + o[i]];
      return o.length ? t / o.length : -1;
    }
    let t = 0, n = 0;
    for (const [dx, dy] of pts) { if (skipLines && onLine(y + dy)) continue; t += at(x + dx, y + dy); n++; }
    return n ? t / n : -1;
  };
  /** lòng nốt trắng: phần sáng nhất của lõi (lòng nốt trắng là khe nghiêng hẹp, không phủ hết lõi) */
  const light = (pts: Pt[], x: number, y: number) => {
    const v: number[] = [];
    // hàng dòng kẻ: trừ đi độ đậm của chính dòng kẻ (đo hai bên, lấy bên nhạt hơn để tránh nốt bên cạnh)
    // → lòng nốt trắng nằm trên dòng kẻ vẫn "sáng", nốt đen thì vẫn đậm
    const side = Math.round(1.6 * s);
    for (const [dx, dy] of pts) {
      const d = at(x + dx, y + dy);
      if (!onLine(y + dy)) { v.push(d); continue; }
      const L = Math.min(at(x - side, y + dy), at(x + side, y + dy), 0.9);
      v.push(Math.max(0, (d - L) / (1 - L)));
    }
    if (v.length < 3) return -1;
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.3)];
  };
  /**
   * Lòng nốt trắng là vùng sáng nhỏ bị mực bao kín: loang từ các điểm sáng trong lõi, không được chạm
   * mép cửa sổ và không cao quá ~0.65 khe (ô trống giữa hai dòng kẻ + thân + móc thì cao cả khe).
   */
  const enclosed = (x: number, y: number, inn: Pt[]) => {
    const rx = Math.round(1.0 * s), ry = Math.round(0.8 * s);
    const W = 2 * rx + 1, H = 2 * ry + 1;
    const seen = new Uint8Array(W * H);
    const wall = (qx: number, qy: number) => at(x - rx + qx, y - ry + qy) >= 0.25 || onLine(y - ry + qy);
    let parts = 0;
    for (const [dx, dy] of inn) {
      const i0 = (dy + ry) * W + dx + rx;
      if (seen[i0] || wall(dx + rx, dy + ry)) continue;
      // mỗi mảnh lòng (dòng kẻ chia lòng nốt làm hai) phải nhỏ và kín
      seen[i0] = 1;
      const stack = [i0];
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      while (stack.length) {
        const i = stack.pop()!;
        const px = i % W, py = (i - px) / W;
        if (px === 0 || py === 0 || px === W - 1 || py === H - 1) return false;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          const qx = j % W, qy = (j - qx) / W;
          if (seen[j] || wall(qx, qy)) continue;
          seen[j] = 1; stack.push(j);
        }
      }
      if (y1 - y0 + 1 > 0.6 * s || x1 - x0 + 1 > 1.15 * s) return false;
      parts++;
    }
    return parts > 0;
  };
  const barCols: number[] = [];
  for (let x = Math.max(0, Math.round(xFrom)); x < Math.min(w, xTo); x++) {
    let n = 0, m = 0;
    for (let y = Math.round(top); y <= Math.round(bottom); y++) { m++; if (at(x, y) >= 0.5) n++; }
    if (n >= 0.92 * m) barCols.push(x);
  }
  const hits: HeadHit[] = [];
  const quadsOf = (rg: Pt[]) => [rg.filter(([dx, dy]) => dx > Math.abs(dy)), rg.filter(([dx, dy]) => -dx > Math.abs(dy)), rg.filter(([dx, dy]) => dy > Math.abs(dx)), rg.filter(([dx, dy]) => -dy > Math.abs(dx))];
  const shapes = [
    { rg: ring, inn: inner, out: rOut, sd: seed, quads: quadsOf(ring), wide: false },
    { rg: wRing, inn: wInner, out: wOut, sd: wSeed, quads: quadsOf(wRing), wide: true },
  ];
  // vài điểm thưa để loại nhanh nền trắng trước khi đo kỹ
  const sparse = (pts: Pt[]) => pts.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 12)) === 0);
  const probeRing = sparse(ellipsePts(0.62 * s, 0.45 * s, tilt, 0.85, 0.95)), probeWide = sparse(ellipsePts(0.78 * s, 0.47 * s, 0, 0.85, 0.95));
  const probeCore = ellipsePts(0.62 * s, 0.45 * s, tilt, 0, 0.35);
  for (let step = -7; step <= 15; step++) {
    const y = Math.round(bottom - (step * s) / 2);
    if (y < 0 || y >= h) continue;
    const off = (pts: Pt[]) => pts.filter(([, dy]) => !onLine(y + dy));
    const per = shapes.map((sh) => ({ ...sh, outOff: off(sh.out), quadsOff: sh.quads.map(off) }));
    for (let x = Math.max(0, Math.round(xFrom)); x < Math.min(w, xTo); x++) {
      const pr = Math.max(avg(probeRing, x, y, false), avg(probeWide, x, y, false)), pc = avg(probeCore, x, y, false);
      if (pr < 0.3 && pc < 0.5) continue;
      let hollowHit = false;
      for (const sh of per) {
        const R = avg(sh.rg, x, y, false);
        if (R < 0.42) continue;
        const N = light(sh.inn, x, y);
        if (!(N >= 0 && N <= 0.3 && R - N >= 0.3)) continue;
        // vành phải khép kín: cả bốn phía đều có mực (dấu lặng đen zig-zag chỉ có giữa); bỏ hàng dòng kẻ
        // (dòng kẻ ngang trên/dưới tự tạo "vành"), phía nào toàn dòng kẻ thì bỏ qua
        if (sh.quadsOff.some((q) => q.length >= 3 && avg(q, x, y, false) < 0.3)) continue;
        // vạch nhịp (đơn/kép) đi xuyên vành: nét dọc phủ gần hết chiều cao khuông
        if (barCols.some((bx) => Math.abs(bx - x) <= 0.8 * s)) continue;
        // xung quanh vành phải trống (bỏ dòng kẻ): dấu nối / vạch nhịp kép + dòng kẻ tạo "vòng" giả
        if (sh.outOff.length && avg(sh.outOff, x, y, false) > 0.2) continue;
        if (!enclosed(x, y, sh.sd)) continue;
        hits.push({ x, y, step, hollow: true, wide: sh.wide, score: R - N * 0.5 });
        hollowHit = true;
        break;
      }
      if (hollowHit || pc < 0.5) continue;
      // vạch nối (beam) dày cũng đậm kín elip nhưng kéo dài sang hai bên
      const F = avg(fill, x, y, false);
      if (F >= 0.6 && avg(around, x, y, false) <= 0.5 && Math.min(avg(left, x, y, false), avg(right, x, y, false)) < 0.45) {
        hits.push({ x, y, step, hollow: false, wide: false, score: F });
      }
    }
  }
  // giữ cực đại: mỗi đầu nốt chỉ một vị trí (bỏ vị trí lệch ngang và lệch nửa khe)
  const nms = (list: HeadHit[]) => {
    const kept: HeadHit[] = [];
    for (const c of [...list].sort((a, b) => b.score - a.score)) if (!kept.some((k) => Math.abs(k.x - c.x) < 0.9 * s && Math.abs(k.step - c.step) <= 1)) kept.push(c);
    return kept;
  };
  // ngưỡng nốt đen theo chính bản in: đầu nốt thật đậm gần bằng nhau (~0.9), vạch nối / chữ / dấu lặng
  // khớp một phần thì thấp hẳn (≤ 0.75). Lọc trước khi giữ cực đại để vị trí nốt đen yếu không che nốt trắng
  const filled = nms(hits.filter((k) => !k.hollow)).map((k) => k.score).sort((a, b) => a - b);
  const q = filled.length >= 4 ? filled[Math.floor(filled.length * 0.75)] : 0.95;
  const thr = Math.min(0.8, Math.max(0.6, 0.83 * q));
  return nms(hits.filter((k) => k.hollow || k.score >= thr));
}

// ───────────────────────── đọc một trang ─────────────────────────

let noteSeq = 0;

/** Đọc một trang (ảnh xám gốc). Trả null nếu không thấy khuông nhạc. */
export function readPage(input: Gray, page = 0): OmrPage | null {
  const original = flattenBackground(input);
  const s0 = runSpacing(threshold(original, 210));
  if (!s0 || s0 < 3) return null;
  const f = TARGET_SPACE / s0;
  const scaled = Math.abs(f - 1) < 0.02 ? original : resizeGray(original, Math.round(original.width * f), Math.round(original.height * f));
  const geo = findStaves(threshold(scaled, 225), TARGET_SPACE);
  if (!geo.length) return null;
  const gray = straighten(scaled, geo);
  const ink = threshold(gray, 200);
  const lineInk = threshold(gray, 225);
  const staves = geo.map((st) => ({ st, lines: staffLines(lineInk, st) }));
  const lines = staves.flatMap((st) => st.lines);
  const clean = removeLines(ink, lines, 0); // tìm đầu nốt
  // chấm dôi sát thân nốt: viền xám nhoè dính chấm vào thân → xét thêm trên ngưỡng đậm hơn
  const darkInk = threshold(gray, 140);
  const dotInk = removeLines(darkInk, lines, 0);
  const thin = removeLines(lineInk, lines, 1); // thân nốt, móc: xoá cả viền xám của dòng kẻ
  const dark = new Float32Array(gray.data.length);
  for (let i = 0; i < dark.length; i++) dark[i] = (255 - gray.data[i]) / 255;

  let keySig = 0;
  const outStaves: OmrStaff[] = [];
  const notes: OmrNote[] = [];

  // khung từng khuông: bề ngang, khoá nhạc, hoá biểu
  const frames = staves.map(({ st }) => {
    const s = st.sp;
    const top = st.center - 2 * s, bottom = st.center + 2 * s;
    let xLeft = Infinity, xRight = -1;
    for (let x = 0; x < ink.w; x++) {
      let n = 0;
      for (let y = Math.trunc(top); y <= Math.trunc(bottom); y++) n += ink.d[y * ink.w + x];
      if (n >= 4) { xLeft = Math.min(xLeft, x); xRight = x; }
    }
    if (xRight < 0) return null;
    const { end: ce, clef } = clefInfo(thin, top, bottom, s, xLeft);
    return { s, top, bottom, xLeft, xRight, ce, clef, ks: keySignatureByPosition(thin, top, bottom, s, ce + 1, clef) };
  });
  // hệ nhiều khuông (piano, hợp xướng — các khuông nối nhau bằng nét dọc / ngoặc ở đầu hệ): chỉ đọc khuông
  // trên cùng (giai điệu), không ghép khuông bè trầm vào sau
  const lowerInSystem = frames.map((f, i) => {
    const p = frames[i - 1];
    if (!f || !p) return false;
    const y = Math.round((p.bottom + f.top) / 2), x0 = Math.min(p.xLeft, f.xLeft);
    for (let x = Math.max(0, Math.round(x0 - f.s)); x <= x0 + 1.5 * f.s; x++) {
      const r = verticalRun(ink, x, y);
      if (r && r[0] <= p.bottom + 0.5 * p.s && r[1] >= f.top - 0.5 * f.s) return true;
    }
    return false;
  });

  // hoá biểu in lại ở mọi khuông, chỉ đổi khi chuyển giọng (từ đó về sau): khuông lệch hẳn với hai khuông
  // kề bên (hoặc hai khuông kế tiếp ở đầu/cuối bài) là đọc nhầm — chỉ so giữa các khuông giai điệu
  const melodic = frames.map((_, i) => i).filter((i) => !lowerInSystem[i]);
  const keys = melodic.map((i) => frames[i]?.ks.key ?? 0);
  const fixedKeys: number[] = frames.map((f) => f?.ks.key ?? 0);
  keys.forEach((k, j) => {
    const p = keys[j - 1], n = keys[j + 1];
    if (p !== undefined && n !== undefined) { fixedKeys[melodic[j]] = p === n && p !== k ? p : k; return; }
    const [a, b] = p === undefined ? [keys[j + 1], keys[j + 2]] : [keys[j - 1], keys[j - 2]];
    fixedKeys[melodic[j]] = a !== undefined && a === b && a !== k ? a : k;
  });

  // dấu hoá ghi rõ gần nhất của từng chữ nốt (Đô…Si), qua các ô nhịp và khuông: phân biệt dấu thăng với dấu bình nhắc lại
  const lastAlter = new Map<number, -1 | 0 | 1>();
  staves.forEach((_, si) => {
    const fr = frames[si];
    if (!fr || lowerInSystem[si]) return;
    const { s, top, bottom, xRight, ce, clef } = fr;
    // bậc theo khoá Sol (0 = E4): khuông khoá Fa dời xuống
    const shift = clef === 'F' ? F_CLEF_SHIFT : 0;
    const y0 = Math.max(Math.trunc(top - 3.5 * s), 0), y1 = Math.trunc(bottom + 2.2 * s);
    const roi = clean.rows(y0, y1); roi.clearLeft(ce);
    const thinRoi = thin.rows(y0, y1);
    const strictRoi = clean.rows(y0, y1);
    const dotRoi = dotInk.rows(y0, y1);
    const dk = (x: number, y: number) => (x >= 0 && x < gray.width && y + y0 >= 0 && y + y0 < gray.height ? dark[(y + y0) * gray.width + x] : 0);

    const inkRoi = ink.rows(y0, y1); inkRoi.clearLeft(ce); // còn dòng kẻ
    // hàng thuộc dòng kẻ (toạ độ trong roi) — bỏ qua khi đo độ đặc của lõi đầu nốt
    const lineRow = new Uint8Array(roi.h);
    for (const [a, b] of lines) for (let y = a - 1; y <= b + 1; y++) if (y >= y0 && y - y0 < roi.h) lineRow[y - y0] = 1;
    // đầu nốt: khớp mẫu bầu dục ở từng bậc cao độ (xem templateHeads)
    const lineHalf = Math.max(1, mean(staves[si].lines.map(([a, b]) => (b - a + 1) / 2)));
    const objs: { o: Box; hollow: boolean }[] = templateHeads(dark, gray.width, gray.height, top, bottom, s, ce, xRight + 1, lineHalf).map((t) => {
      const ax = (t.wide ? 0.78 : 0.62) * s, ay = 0.45 * s;
      // hộp bao theo mực thật quanh mẫu (đầu nốt có thể to/nhỏ hơn mẫu), trên ảnh đã xoá dòng kẻ
      let bx0 = Infinity, bx1 = -1, by0 = Infinity, by1 = -1;
      for (const [dx, dy] of ellipsePts(ax * 1.2, ay * 1.25, -0.35, 0, 1)) {
        const x = t.x + dx, y = t.y - y0 + dy;
        if (!roi.get(x, y)) continue;
        bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x + 1); by0 = Math.min(by0, y); by1 = Math.max(by1, y + 1);
      }
      const tb = { x0: Math.round(t.x - ax), x1: Math.round(t.x + ax) + 1, y0: Math.round(t.y - y0 - ay), y1: Math.round(t.y - y0 + ay) + 1 };
      const o = bx1 - bx0 >= 0.6 * s && by1 - by0 >= 0.4 * s ? { x0: bx0, x1: bx1, y0: Math.min(by0, tb.y0), y1: Math.max(by1, tb.y1) } : tb;
      return { o, hollow: t.hollow };
    });

    // dấu hoá giữa bài (♯ ♭ ♮) đứng ngay trước nốt: tách riêng để không nhầm thành đầu nốt
    const accs = findAccidentals(thinRoi, objs.map((p) => p.o), s, ce);
    const inAcc = (o: Box) => accs.some((a) => a.box.x0 - 1 <= cx(o) && cx(o) <= a.box.x1 + 1 && a.box.y0 - 1 <= cy(o) && cy(o) <= a.box.y1 + 1);
    const cand = objs.filter((p) => !inAcc(p.o));

    const ks = fixedKeys[si], ksEnd = fr.ks.ends.get(ks) ?? ce + 1;
    if (si === 0) keySig = ks;
    const ts = timeSigSpan(thin, top, bottom, s, Math.max(ce, ksEnd) + 1);
    const contentFrom = Math.max(ce, ksEnd, ts ? ts[1] : 0);

    /** nốt ngoài khuông từ La5 / Đô4 trở ra phải có dòng kẻ phụ (chữ, logo in đè thì không) */
    const ledgerOk = (o: Box) => {
      const stepOf = Math.round((bottom - (cy(o) + y0)) / (s / 2));
      if (stepOf < 10 && stepOf > -2) return true;
      const ly = Math.round((stepOf >= 10 ? top - s : bottom + s) - y0);
      let best = 0;
      for (const yy of [ly - 1, ly, ly + 1]) {
        let l = Math.round(cx(o)), r = l;
        if (!inkRoi.get(l, yy)) continue;
        while (inkRoi.get(l - 1, yy)) l--;
        while (inkRoi.get(r + 1, yy)) r++;
        best = Math.max(best, r - l + 1);
      }
      return best >= 1.3 * s;
    };
    // xác minh từng đốm là nốt thật (có thân, hoặc nốt tròn trong khuông) TRƯỚC khi xét hợp âm:
    // chữ hợp âm "Gm" phía trên khuông có vòng giống đầu nốt rỗng
    const valid: { o: Box; hollow: boolean; stem: Stem | null; beats: number }[] = [];
    for (const { o, hollow } of cand) {
      if (cx(o) <= contentFrom) continue;
      // vạch nối dày (hai vạch nối 16 dính nhau) khớp mẫu nốt đen: nhưng kéo dài ngang qua nhiều hàng
      if (!hollow) {
        const run = (y: number) => {
          y = Math.round(y);
          let l = Math.round(cx(o)), r = l;
          if (!strictRoi.get(l, y)) return 0;
          while (strictRoi.get(l - 1, y)) l--;
          while (strictRoi.get(r + 1, y)) r++;
          return r - l + 1;
        };
        if (Math.min(run(cy(o) - 0.15 * s), run(cy(o)), run(cy(o) + 0.15 * s)) >= 2.0 * s) continue;
      }
      if (!ledgerOk(o)) continue;
      const stem = findStem(thinRoi, o, s, strictRoi);
      if (!stem) {
        // nốt tròn: rỗng, không thân, nằm trong khuông ± 0.7 khe (tránh ♭ của chữ hợp âm "B♭") (hộp tìm qua lòng rỗng hẹp hơn cả nốt → 0.8 khe)
        if (!hollow || bw(o) < 0.8 * s || cy(o) + y0 < top - 0.7 * s || cy(o) + y0 > bottom + 0.7 * s) continue;
        valid.push({ o, hollow, stem, beats: 4 });
      } else {
        if (hollow && stem.b - stem.a + 1 < 3 * s) continue; // dấu lặng γ có nét chéo ngắn
        valid.push({ o, hollow, stem, beats: hollow ? 2 : 1 / 2 ** countFlags(thinRoi, stem, s, dk) });
      }
    }
    // hai nốt cùng cột: giữ nốt đặc (bỏ vòng móc rỗng); cùng loại = hợp âm → giữ nốt cao nhất (giai điệu)
    const drop = new Set<number>();
    const flagZones = valid.filter((v) => v.stem).map((v) => ({ x0: v.stem!.x - 2, x1: v.stem!.x + Math.ceil(1.4 * s), y0: v.stem!.a - 1, y1: v.stem!.b + 2 }));
    valid.forEach((v, i) => { if (!v.stem && flagZones.some((z) => overlaps(z, v.o))) drop.add(i); });
    valid.forEach((a, i) => valid.forEach((b, j) => {
      if (i === j || Math.abs(cx(a.o) - cx(b.o)) >= 1.2 * s) return;
      if ((a.hollow && !b.hollow) || (a.hollow === b.hollow && cy(a.o) > cy(b.o) + 0.5 * s)) drop.add(i);
    }));

    const staffNotes: OmrNote[] = [];
    const stemXs = valid.filter((v, i) => !drop.has(i) && v.stem).map((v) => v.stem!.x);
    const occupied: Box[] = [...accs.map((a) => a.box), ...cand.map((p) => ({ x0: p.o.x0 - 1, x1: p.o.x1 + 1, y0: p.o.y0 - 1, y1: p.o.y1 + 1 }))];
    for (const [i, { o, hollow, stem, beats }] of valid.entries()) {
      if (drop.has(i)) continue;
      const x = cx(o);
      // thân nốt + vùng móc bên phải → không tính là dấu lặng / dấu nối
      if (stem) occupied.push({ x0: stem.x - 2, x1: stem.x + Math.ceil(1.4 * s), y0: stem.a - 1, y1: stem.b + 2 });
      occupied.push({ x0: o.x0 - 1, x1: o.x1 + 1, y0: o.y0 - 1, y1: o.y1 + 1 });
      const dot = hasDot(roi, o, s) || hasDot(dotRoi, o, s);
      const acc = accs.find((a) => o.x0 - 1.8 * s <= a.box.x1 && a.box.x1 <= o.x0 + 0.4 * s && Math.abs(cy(a.box) - cy(o)) <= 1.3 * s)
        ?? (() => { const k = accidentalBefore(thinRoi, cx(o), cy(o), s, contentFrom, stemXs); return k === null ? undefined : { box: o, kind: k }; })();
      const y = cy(o) + y0;
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x, y,
        step: Math.round((bottom - y) / (s / 2)) + shift, accidental: acc ? (acc.kind as OmrNote['accidental']) : null,
        beats: beats * (dot ? 1.5 : 1), hollow, dot, rest: false,
      });
    }
    // nốt bị sót (thường là nốt trắng vành mảnh bị bước tìm đầu nốt gặm mất): tìm thân nốt "mồ côi"
    // rồi xem ở đầu thân có đầu nốt không
    const usedStems = valid.filter((v, i) => !drop.has(i) && v.stem).map((v) => v.stem!.x);
    for (const st of stemSegments(thinRoi, s, contentFrom + 1, xRight + 1)) {
      if (usedStems.some((x) => Math.abs(x - st.x) <= 0.4 * s)) continue;
      // móc / thân của nốt đã nhận không phải thân mồ côi
      const stBox = { x0: st.x - 1, x1: st.x + 2, y0: st.a, y1: st.b + 1 };
      if (occupied.some((z) => overlaps(z, stBox))) continue;
      const head = headAtStem(roi, inkRoi, st, s, lineRow);
      if (!head) continue;
      // nét phủ đúng cả khuông: vạch nhịp, trừ khi ở đầu nét là nốt TRẮNG (nốt đen đã được tìm ở trên)
      const spansStaff = Math.abs(st.a - (top - y0)) <= 0.5 * s && Math.abs(st.b - (bottom - y0)) <= 0.5 * s;
      if (spansStaff && !head.hollow) continue;
      const o = head.box;
      if (occupied.some((z) => overlaps(z, o)) || !ledgerOk(o)) continue;
      if (staffNotes.some((n) => Math.abs(n.x - cx(o)) < 0.8 * s && Math.abs(n.y - (cy(o) + y0)) < s)) continue;
      const stem: Stem = { ...st, up: head.up };
      const beats = head.hollow ? 2 : 1 / 2 ** countFlags(thinRoi, stem, s, dk);
      const dot = hasDot(roi, o, s) || hasDot(dotRoi, o, s);
      usedStems.push(st.x);
      occupied.push({ x0: st.x - 2, x1: st.x + Math.ceil(1.4 * s), y0: st.a - 1, y1: st.b + 2 }, { x0: o.x0 - 1, x1: o.x1 + 1, y0: o.y0 - 1, y1: o.y1 + 1 });
      const acc = accs.find((a) => o.x0 - 1.8 * s <= a.box.x1 && a.box.x1 <= o.x0 + 0.4 * s && Math.abs(cy(a.box) - cy(o)) <= 1.3 * s)
        ?? (() => { const k = accidentalBefore(thinRoi, cx(o), cy(o), s, contentFrom, stemXs); return k === null ? undefined : { box: o, kind: k }; })();
      const y = cy(o) + y0;
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x: cx(o), y,
        step: Math.round((bottom - y) / (s / 2)) + shift, accidental: acc ? (acc.kind as OmrNote['accidental']) : null,
        beats: beats * (dot ? 1.5 : 1), hollow: head.hollow, dot, rest: false,
      });
    }
    // dấu lặng vẽ trong khuông
    for (const r of findRests(thinRoi, roi, top - y0, bottom - y0, s, contentFrom + 1, xRight + 1, occupied)) {
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x: r.x, y: r.y + y0, step: 4 + shift, accidental: null,
        beats: r.beats, hollow: false, dot: false, rest: true,
      });
    }
    staffNotes.sort((a, b) => a.x - b.x);
    const first = staffNotes.length ? staffNotes[0].x : xRight;
    const bars = barlines(thin, top, bottom, s, Math.trunc(first + s), xRight + 1, staffNotes.filter((n) => !n.rest).map((n) => n.x));

    // dấu hoá giữ hiệu lực đến hết ô nhịp cho các nốt cùng vị trí
    let held = new Map<number, -1 | 0 | 1>();
    let bi = 0;
    for (const n of staffNotes) {
      while (bi < bars.length && bars[bi] < n.x) { bi++; held = new Map(); }
      if (n.rest) continue;
      const letter = ((n.step % 7) + 7) % 7;
      if ((n.accidental as number) === 2) {
        const cur = held.has(n.step) ? held.get(n.step)! : alterOf(n.step, ks);
        // nốt đang tự nhiên: thăng, trừ khi chữ nốt này vừa bị giáng ở ô trước (dấu bình nhắc lại sau B♭…)
        n.accidental = cur !== 0 ? 0 : lastAlter.get(letter) === -1 ? 0 : 1;
      }
      // Mi♯ / Si♯, Fa♭ / Đô♭ gần như chỉ có ở giọng rất nhiều dấu: dấu đọc ra như vậy là dấu bình (bậc 0 = Mi)
      if (n.accidental === 1 && (letter === 0 || letter === 4) && ks < 6) n.accidental = 0;
      if (n.accidental === -1 && (letter === 1 || letter === 5) && ks > -6) n.accidental = 0;
      if (n.accidental !== null && !held.has(n.step)) lastAlter.set(letter, n.accidental);
      else if (n.accidental !== null && held.get(n.step) !== n.accidental) lastAlter.set(letter, n.accidental);
      if (n.accidental !== null) held.set(n.step, n.accidental);
      else if (held.has(n.step)) n.accidental = held.get(n.step)!;
    }
    // dấu nối giữa hai nốt liền nhau cùng cao độ
    const ties = findTies(roi, s, contentFrom, occupied);
    const pitched = staffNotes.filter((n) => !n.rest);
    for (let i = 1; i < pitched.length; i++) {
      const p = pitched[i - 1], q = pitched[i];
      if (p.step !== q.step) continue;
      if (ties.some((t) => p.x - 0.3 * s <= t.x0 && t.x0 <= p.x + 1.6 * s && q.x - 1.6 * s <= t.x1 && t.x1 <= q.x + 0.3 * s)) q.tied = true;
    }
    // chuyển giọng giữa bài (hoá biểu khác khuông đầu): ghi dấu hoá riêng cho nốt bị ảnh hưởng
    if (ks !== keySig) for (const n of staffNotes) {
      if (n.rest || n.accidental !== null) continue;
      const want = alterOf(n.step, ks);
      if (want !== alterOf(n.step, keySig)) n.accidental = want;
    }
    // ngưỡng đậm: ngoặc in đậm hay dính vào vạch nối / thân nốt qua viền xám
    // ngưỡng nhạt: ngoặc kẻ mảnh, in mờ
    const tuplets = findTuplets(darkInk, top, bottom, s, contentFrom, xRight + 1);
    for (const t of findTuplets(lineInk, top, bottom, s, contentFrom, xRight + 1)) {
      if (!tuplets.some(([a, b]) => a < t[1] && t[0] < b)) tuplets.push(t);
    }
    // dấu nhắc lại: tìm cả trước nốt đầu (‖: ngay sau khoá / hoá biểu)
    const repeats = findRepeats(thin, top, bottom, s, contentFrom - Math.round(2 * s), xRight + 2);
    const above = frames.slice(0, si).reverse().find((f) => f);
    const firstEndings = findFirstEndings(lineInk, top, s, repeats.filter((r) => r.kind === 'end').map((r) => r.x), above ? above.bottom + s : 0);
    outStaves.push({
      page, top, bottom, space: s, bars, xRight,
      ...(clef === 'F' ? { clef } : {}), ...(tuplets.length ? { tuplets } : {}), ...(repeats.length ? { repeats } : {}),
      ...(firstEndings.length ? { firstEndings } : {}),
    });
    notes.push(...staffNotes);
  });

  return { image: gray, scale: f, keySig, staves: outStaves, notes };
}

// ───────────────────────── nhịp, dấu lặng ─────────────────────────

/**
 * Liên ba: các nốt dưới ngoặc "3" chỉ còn 2/3 trường độ in. Bản in thường vẽ ngoặc lệch / ngắn hơn nhóm
 * nốt (thiếu nốt đầu), có khi đánh số "3" cho nhóm vốn đã đủ phách → chọn nhóm nốt liền nhau quanh ngoặc
 * (thêm / bớt một nốt mỗi bên) sao cho tổng phách ô nhịp khớp số phách mỗi ô; không khớp hơn thì giữ nguyên.
 */
function applyTuplets(measures: { st: OmrStaff; ms: OmrNote[] }[], meter: number, dry = false) {
  let fits = 0;
  for (const m of measures) {
    const s = m.st.space;
    let total = m.ms.reduce((t, n) => t + n.beats, 0);
    for (const [x0, x1] of m.st.tuplets ?? []) {
      const ms = m.ms;
      const inside = ms.map((n, i) => (n.x >= x0 - 0.4 * s && n.x <= x1 + 0.4 * s ? i : -1)).filter((i) => i >= 0);
      if (!inside.length) continue;
      const sum = total;
      let best: [number, number] | null = null, bestErr = Math.abs(sum - meter) - 0.01;
      for (const [da, db] of [[0, 0], [-1, 0], [0, 1], [1, 0], [0, -1], [-1, 1]]) {
        const a = inside[0] + da, b = inside[inside.length - 1] + db;
        if (a < 0 || b >= ms.length || b - a < 1 || b - a > 5) continue;
        const g = ms.slice(a, b + 1).reduce((t, n) => t + n.beats, 0);
        const err = Math.abs(sum - g / 3 - meter);
        if (err < bestErr) { bestErr = err; best = [a, b]; }
      }
      if (!best) continue;
      total -= ms.slice(best[0], best[1] + 1).reduce((t, n) => t + n.beats, 0) / 3;
      if (!dry) for (let i = best[0]; i <= best[1]; i++) ms[i].beats = (ms[i].beats * 2) / 3;
    }
    if (Math.abs(total - meter) < 0.01) fits++;
  }
  return fits;
}

/**
 * Chia ô nhịp theo vạch nhịp; ô thiếu phách (trừ ô đầu = nhịp lấy đà, ô cuối) được chèn dấu lặng
 * vào khoảng trống lớn nhất. Trả số phách mỗi ô (giá trị thường gặp nhất).
 */
export function fillRests(pages: OmrPage[]): number {
  type Measure = { st: OmrStaff; si: number; page: OmrPage; a: number; b: number; ms: OmrNote[] };
  const measures: Measure[] = [];
  for (const page of pages) {
    page.staves.forEach((st, si) => {
      const edges = [-Infinity, ...st.bars, Infinity];
      for (let i = 0; i < edges.length - 1; i++) {
        const ms = page.notes.filter((n) => n.staff === si && edges[i] < n.x && n.x < edges[i + 1]);
        if (ms.length) measures.push({ st, si, page, a: edges[i], b: edges[i + 1], ms });
      }
    });
  }
  const sums = measures.map((m) => Math.round(m.ms.reduce((t, n) => t + n.beats, 0) * 1000) / 1000);
  const counts = new Map<number, number>();
  let meter = 4, bestN = 0;
  for (const v of sums) { const n = (counts.get(v) ?? 0) + 1; counts.set(v, n); if (n > bestN) { bestN = n; meter = v; } }
  // bài nhiều liên ba: ô có liên ba (chưa sửa) dư phách nên có thể đông hơn → tính cả các ô khớp được
  // sau khi sửa liên ba, chỉ xét các số phách thường gặp
  if (measures.some((m) => m.st.tuplets?.length)) {
    let best = -1;
    const usual = [2, 3, 4, 6];
    for (const M of usual.includes(meter) ? [meter, ...usual] : usual) {
      const n = applyTuplets(measures, M, true);
      if (n > best) { best = n; meter = M; }
    }
  }
  applyTuplets(measures, meter);
  measures.forEach((m, idx) => {
    const missing = meter - m.ms.reduce((t, n) => t + n.beats, 0);
    if (missing <= 0.01 || idx === 0 || idx === measures.length - 1) return;
    const xs = [Math.max(m.a, m.ms[0].x - 3 * m.st.space), ...m.ms.map((n) => n.x), Math.min(m.b, m.st.xRight)];
    let gi = 0, gmax = -Infinity;
    for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] - xs[i] >= gmax) { gmax = xs[i + 1] - xs[i]; gi = i; }
    m.page.notes.push({
      id: `n${++noteSeq}`, page: m.ms[0].page, staff: m.si, x: (xs[gi] + xs[gi + 1]) / 2, y: (m.st.top + m.st.bottom) / 2,
      step: 4, accidental: null, beats: missing, hollow: false, dot: false, rest: true, guess: true,
    });
  });
  for (const p of pages) p.notes.sort((a, b) => a.staff - b.staff || a.x - b.x);
  return meter;
}

/**
 * 3 phách đen mỗi ô: 3/4 hay 6/8? 6/8 chia ô làm hai nửa 1.5 phách, nốt hầu như không vắt qua giữa ô;
 * 3/4 thì nốt đen / nốt trắng vắt qua giữa ô là thường. `measures`: các ô đủ phách (danh sách trường độ).
 */
export function guessTimeSig(meter: number, notes: OmrNote[], measures: number[][] = []) {
  const eighthish = notes.filter((n) => n.beats === 0.5 || n.beats === 1.5).length;
  if (Math.abs(meter - 3) < 0.01) {
    if (measures.length >= 2) {
      const crossing = measures.filter((m) => {
        let t = 0;
        return m.some((b) => { const hit = t < 1.5 - 0.01 && t + b > 1.5 + 0.01; t += b; return hit; });
      }).length;
      if (crossing / measures.length >= 0.2) return '3/4';
    }
    return eighthish / Math.max(1, notes.length) > 0.4 ? '6/8' : '3/4';
  }
  return ({ 4: '4/4', 2: '2/4', 1.5: '3/8', 6: '6/4' } as Record<number, string>)[meter] ?? '4/4';
}

export interface TitleBox { x0: number; y0: number; x1: number; y1: number }

/**
 * Vùng tên bài và tên tác giả trên trang (toạ độ trên page.image), phía trên khuông đầu tiên.
 *  - tên bài: dòng chữ to nhất (cụm chữ lớn nhất trong dòng)
 *  - tác giả: dòng chữ dưới tên bài, canh phải theo khuông ("Nhạc và lời …", "Trịnh Công Sơn")
 * Bỏ logo / khung (khối mực quá to, hoặc chứa hình bên trong), nốt nhạc và hợp âm sát khuông.
 */
export function findHeaderBoxes(page: Pick<OmrPage, 'image' | 'staves'>): { title: TitleBox | null; artist: TitleBox | null } {
  const none = { title: null, artist: null };
  const st = page.staves[0];
  if (!st) return none;
  const s = st.space;
  // tên bài: cao hơn khuông ≥ 3 khe (nốt cao, hợp âm, ngoặc liên ba nằm sát khuông); tác giả có khi sát hơn
  const yTitle = Math.round(st.top - 3 * s), yEnd = Math.round(st.top - 1.5 * s);
  if (yTitle < s) return none;
  const img = threshold(page.image, 160).rows(0, yEnd);
  const { lab, boxes } = label(img);
  // chữ: không quá to (logo, khung ảnh), không là hạt bụi
  const keep = new Uint8Array(boxes.length + 1);
  // (bỏ cả đường kẻ ngang mảnh: ngoặc liên ba, ngoặc lặp, gạch chân — không phải chữ)
  const cand = boxes.map((b) => bh(b) <= 8 * s && bw(b) <= 12 * s && Math.max(bh(b), bw(b)) >= 0.3 * s && !(bw(b) >= 3 * bh(b) && bh(b) <= 0.6 * s));
  // logo / hình vẽ: cao vượt hẳn cỡ chữ thường gặp trên trang
  const hs = boxes.filter((_, i) => cand[i] && bh(boxes[i]) >= 0.6 * s).map(bh);
  const typical = hs.length ? median(hs) : s;
  // logo vòng tròn có hình bên trong: khối to chứa trọn vài khối khác
  const inside = (o: Box, b: Box) => b !== o && b.x0 >= o.x0 && b.x1 <= o.x1 && b.y0 >= o.y0 && b.y1 <= o.y1;
  const drop = new Set<Box>();
  boxes.forEach((o, i) => {
    if (bh(o) <= 2.5 * typical) return;
    const inner = boxes.filter((b, j) => cand[j] && inside(o, b));
    // khối quá to (khung, vòng logo) thì mọi thứ bên trong cũng là hình, không phải chữ
    if (inner.length >= (cand[i] ? 2 : 1)) { drop.add(o); inner.forEach((b) => drop.add(b)); }
  });
  boxes.forEach((b, i) => { if (cand[i] && !drop.has(b) && bh(b) <= Math.max(6 * typical, 2 * s)) keep[i + 1] = 1; });
  const { w, h } = img;
  const rowN = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep[lab[y * w + x]]) rowN[y]++;
  // các dải dòng chữ (khe trống ≤ 0.25 khe vẫn tính cùng dòng: dấu tiếng Việt tách khỏi thân chữ)
  const bands: [number, number][] = [];
  let a = -1, lastInk = -1;
  for (let y = 0; y <= h; y++) {
    const ink = y < h && rowN[y] > 0;
    if (ink) { if (a < 0) a = y; lastInk = y; continue; }
    if (a >= 0 && (y === h || y - lastInk > 0.25 * s)) { bands.push([a, lastInk + 1]); a = -1; }
  }
  type Line = { y0: number; y1: number; size: number; groups: [number, number, number][] };
  const lines: Line[] = [];
  for (const [y0, y1] of bands) {
    // cỡ chữ: số hàng có mực đáng kể (≥ 30% đỉnh) — không tính phần dấu, chân chữ thưa
    let peak = 0;
    for (let y = y0; y < y1; y++) peak = Math.max(peak, rowN[y]);
    let size = 0;
    for (let y = y0; y < y1; y++) if (rowN[y] >= 0.3 * peak) size++;
    if (size < 0.4 * s) continue;
    // cột có mực trong dải → tách cụm theo khe ngang > 4 lần cỡ chữ (giữa các từ thì hẹp hơn)
    const colInk = new Uint8Array(w);
    for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) if (keep[lab[y * w + x]]) colInk[x] = 1;
    const groups: [number, number, number][] = [];
    let gx = -1, last = -1, mass = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && colInk[x]) { if (gx < 0) { gx = x; mass = 0; } last = x; mass++; continue; }
      if (gx >= 0 && (x === w || x - last > 4 * size)) { groups.push([gx, last + 1, mass]); gx = -1; }
    }
    lines.push({ y0, y1, size, groups });
  }
  const boxOf = (l: Line, x0: number, x1: number): TitleBox => {
    const pad = Math.round(0.4 * l.size);
    return { x0: Math.max(0, x0 - pad), y0: Math.max(0, l.y0 - pad), x1: Math.min(w, x1 + pad), y1: Math.min(h, l.y1 + pad) };
  };
  let title: { line: Line; box: TitleBox } | null = null;
  for (const l of lines) {
    if (l.y1 > yTitle || l.size < 0.6 * s) continue;
    const g = [...l.groups].sort((p, q) => q[2] - p[2])[0];
    if (!g || g[1] - g[0] < 2 * l.size) continue;
    if (!title || l.size > title.line.size * 1.1) title = { line: l, box: boxOf(l, g[0], g[1]) };
  }
  // tác giả: dòng đầu tiên dưới tên bài có cụm chữ canh phải theo khuông, chữ nhỏ hơn tên bài
  let artist: TitleBox | null = null;
  if (title) {
    for (const l of lines) {
      if (l.y0 < title.line.y1 || l.size > title.line.size) continue;
      const right = [...l.groups].sort((p, q) => q[1] - p[1]);
      if (!right.length || right[0][1] < st.xRight - 6 * s || right[0][0] < w / 3) continue;
      // gộp các cụm sát bên trái ("Nhạc và lời" + "Giáng Son")
      let x0 = right[0][0];
      for (const g of right.slice(1)) if (x0 - g[1] <= 6 * l.size) x0 = Math.min(x0, g[0]);
      if (right[0][1] - x0 < 3 * l.size) continue; // hợp âm / ký hiệu lẻ
      artist = boxOf(l, x0, right[0][1]);
      break;
    }
  }
  return { title: title?.box ?? null, artist };
}

export const findTitleBox = (page: Pick<OmrPage, 'image' | 'staves'>) => findHeaderBoxes(page).title;

/** Đọc nhiều trang theo thứ tự */
export function readSheet(pages: Gray[]): OmrResult {
  const read = pages.map((g, i) => readPage(g, i)).filter((p): p is OmrPage => !!p);
  const meter = fillRests(read);
  const all = read.flatMap((p) => p.notes);
  // các ô đủ phách (sau khi chèn dấu lặng) — để phân biệt 3/4 với 6/8
  const full: number[][] = [];
  for (const p of read) p.staves.forEach((st, si) => {
    const edges = [-Infinity, ...st.bars, Infinity];
    for (let i = 0; i + 1 < edges.length; i++) {
      const bs = p.notes.filter((n) => n.staff === si && edges[i] < n.x && n.x < edges[i + 1]).map((n) => n.beats);
      if (bs.length && Math.abs(bs.reduce((t, b) => t + b, 0) - meter) < 0.01) full.push(bs);
    }
  });
  return { pages: read, keySig: read[0]?.keySig ?? 0, meter, timeSig: guessTimeSig(meter, all.filter((n) => !n.rest), full) };
}

// ───────────────────────── cao độ & xuất ─────────────────────────

const LETTERS = 'CDEFGAB';
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

/** Dấu hoá hoá biểu áp cho bậc (0 = E4): 1 thăng, -1 giáng, 0 không */
function alterOf(step: number, keySig: number): -1 | 0 | 1 {
  const letter = LETTERS[(((2 + step) % 7) + 7) % 7];
  if (keySig > 0 && SHARP_ORDER.slice(0, keySig).includes(letter)) return 1;
  if (keySig < 0 && FLAT_ORDER.slice(0, -keySig).includes(letter)) return -1;
  return 0;
}

/**
 * Ngược với notePitch: số MIDI → bậc trên khuông + dấu hoá riêng (null nếu hoá biểu đã đúng).
 * Nốt đen trên phím đàn viết thăng hay giáng theo hoá biểu (giọng giáng → giáng).
 */
export function midiToStep(midi: number, keySig: number): { step: number; accidental: -1 | 0 | 1 | null } {
  const NAT = [0, 2, 4, 5, 7, 9, 11];
  const pc = ((midi % 12) + 12) % 12, oct = Math.floor(midi / 12) - 1;
  const stepOf = (li: number, o: number) => (o - 4) * 7 + li - 2;
  const opts: { step: number; alter: -1 | 0 | 1 }[] = [];
  const li = NAT.indexOf(pc);
  if (li >= 0) opts.push({ step: stepOf(li, oct), alter: 0 });
  // thăng: chữ ngay dưới; giáng: chữ ngay trên (kể cả E#, B#, Fb, Cb khi hoá biểu có)
  const below = NAT.indexOf((pc + 11) % 12), above = NAT.indexOf((pc + 1) % 12);
  if (below >= 0) opts.push({ step: stepOf(below, pc === 0 ? oct - 1 : oct), alter: 1 });
  if (above >= 0) opts.push({ step: stepOf(above, pc === 11 ? oct + 1 : oct), alter: -1 });
  // ưu tiên cách viết không cần dấu hoá riêng
  const fit = opts.find((o) => alterOf(o.step, keySig) === o.alter);
  if (fit) return { step: fit.step, accidental: null };
  const pref = opts.find((o) => o.alter === 0) ?? opts.find((o) => o.alter === (keySig < 0 ? -1 : 1)) ?? opts[0];
  return { step: pref.step, accidental: pref.alter };
}

/** Tên nốt (vd "F#4") theo bậc, hoá biểu và dấu hoá riêng; dấu lặng → "R" */
export function notePitch(n: Pick<OmrNote, 'step' | 'accidental' | 'rest'>, keySig: number): string {
  if (n.rest) return 'R';
  const idx = 2 + n.step;
  const letter = LETTERS[((idx % 7) + 7) % 7];
  const octave = 4 + Math.floor(idx / 7);
  let acc = 0;
  if (n.accidental !== null) acc = n.accidental;
  else if (keySig > 0 && SHARP_ORDER.slice(0, keySig).includes(letter)) acc = 1;
  else if (keySig < 0 && FLAT_ORDER.slice(0, -keySig).includes(letter)) acc = -1;
  return `${letter}${acc > 0 ? '#' : acc < 0 ? 'b' : ''}${octave}`;
}

/** Tên giọng trưởng theo hoá biểu, để ghi vào bài */
export function keyName(keySig: number) {
  return ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'][keySig + 7] ?? 'C';
}

/**
 * Thứ tự chơi: trang → khuông → trái sang phải, mở dấu nhắc lại (đoạn giữa ‖: và :‖ — hoặc từ đầu bài nếu
 * không có ‖: — chơi thêm một lần ngay sau :‖; nốt dưới ngoặc lần 1 bỏ ở lượt nhắc lại, lượt đó nối sang ngoặc
 * lần 2 nằm ngay sau :‖). `again` = nốt chơi lại; `line` = dòng tab của nốt.
 */
export function playOrder(pages: Pick<OmrPage, 'notes' | 'staves'>[]): { n: OmrNote; again: boolean; line: string }[] {
  const out: { n: OmrNote; again: boolean; line: string }[] = [];
  let from = 0, pass = 0;
  const firstEnding = new Set<OmrNote>();
  pages.forEach((p, pi) => p.staves.forEach((st, si) => {
    const marks = st.repeats ?? [];
    const notes = p.notes.filter((m) => m.staff === si).sort((a, b) => a.x - b.x);
    for (const n of notes) if ((st.firstEndings ?? []).some(([a, b]) => a - 0.5 * st.space <= n.x && n.x < b)) firstEnding.add(n);
    let mi = 0;
    const flush = (x: number) => {
      for (; mi < marks.length && marks[mi].x < x; mi++) {
        if (marks[mi].kind === 'start') { from = out.length; continue; }
        // chép lại các nốt gốc từ đầu đoạn tới đây, mỗi khuông vẫn là một dòng
        pass++;
        const seg = out.slice(from).filter((e) => !e.again && !firstEnding.has(e.n));
        for (const e of seg) out.push({ n: e.n, again: true, line: `${e.line}~${pass}` });
        from = out.length;
      }
    };
    for (const n of notes) { flush(n.x); out.push({ n, again: false, line: `${pi}:${si}` }); }
    flush(Infinity);
  }));
  return out;
}

/** Đổi kết quả đọc sang cấu trúc dùng chung với AI → dùng lại bộ chuyển tab có sẵn. Mỗi khuông một dòng. */
export function toTranscription(
  pages: Pick<OmrPage, 'notes' | 'staves'>[],
  opts: { title: string; keySig: number; timeSig: string; tempo: number; pickupBeats?: number },
): AiTranscription {
  const lines: { notes: { pitch: string; beats: number; lyric: string }[] }[] = [];
  let last: { pitch: string; beats: number } | null = null;
  let cur: { key: string; notes: { pitch: string; beats: number; lyric: string }[] } | null = null;
  let again = 0;
  for (const { n, again: rep, line } of playOrder(pages)) {
    if (rep) again++;
    if (!cur || cur.key !== line) { cur = { key: line, notes: [] }; lines.push(cur); }
    const pitch = notePitch(n, opts.keySig);
    // nốt nối (kể cả nối sang khuông sau) cộng trường độ vào nốt trước
    if (n.tied && !n.rest && last && last.pitch === pitch) { last.beats += n.beats; continue; }
    // lần chơi lại: lời in dưới nốt thường là lời 1 → để trống, người dùng tự thêm lời 2
    const e: { pitch: string; beats: number; lyric: string } = { pitch, beats: n.beats, lyric: n.rest || rep ? '' : n.lyric ?? '' };
    cur.notes.push(e);
    last = n.rest ? null : e;
  }
  return {
    title: opts.title || 'Bài quét',
    songKey: keyName(opts.keySig),
    tempo: opts.tempo,
    timeSignature: opts.timeSig,
    pickupBeats: opts.pickupBeats ?? 0,
    confidence: 1,
    warnings: again ? [`Đã mở dấu nhắc lại: ${again} nốt được chơi thêm lần hai (lời lần hai để trống).`] : [],
    sections: [{ name: 'Đoạn 1', lines: lines.filter((l) => l.notes.length).map((l) => ({ notes: l.notes })) }],
  };
}
