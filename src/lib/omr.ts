/**
 * Đọc khuông nhạc in (OMR) bằng luật, chạy offline, không cần AI.
 * Giống cách người học tự đọc: tìm 5 dòng kẻ → xoá dòng kẻ → tìm đầu nốt → vị trí so với
 * dòng kẻ cho cao độ; thân nốt, móc, chấm dôi, đầu rỗng/đặc cho trường độ.
 * Giả định: khoá Sol, một bè giai điệu (không hợp âm), bản in rõ, chụp thẳng.
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
  /** bậc so với dòng dưới cùng khoá Sol (0 = E4), mỗi bậc = nửa khe */
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
}

export interface OmrStaff { page: number; top: number; bottom: number; space: number; bars: number[]; xRight: number }

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

/** Co/giãn bằng cửa sổ chữ nhật kh×kw có tâm ở giữa (mép ảnh coi như nền, như scipy) */
function morph(b: Bits, kh: number, kw: number, erode: boolean) {
  const { w, h, d } = b;
  const ay = Math.floor(kh / 2), ax = Math.floor(kw / 2);
  // ảnh tích phân
  const I = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += d[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
  }
  const sum = (x0: number, y0: number, x1: number, y1: number) =>
    I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
  const r = new Bits(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = x - ax, y0 = y - ay, x1 = x0 + kw, y1 = y0 + kh;
      if (erode) {
        if (x0 < 0 || y0 < 0 || x1 > w || y1 > h) continue;
        r.d[y * w + x] = sum(x0, y0, x1, y1) === kh * kw ? 1 : 0;
      } else {
        // giãn: điểm (x,y) có mực nếu cửa sổ phản chiếu chứa mực
        const X0 = Math.max(0, x - (kw - 1 - ax)), Y0 = Math.max(0, y - (kh - 1 - ay));
        const X1 = Math.min(w, x + ax + 1), Y1 = Math.min(h, y + ay + 1);
        r.d[y * w + x] = sum(X0, Y0, X1, Y1) > 0 ? 1 : 0;
      }
    }
  }
  return r;
}
const opening = (b: Bits, k: number) => morph(morph(b, k, k, true), k, k, false);
const closingV = (b: Bits, k: number) => morph(morph(b, k, 1, false), k, 1, true);
const closing = (b: Bits, k: number) => morph(morph(b, k, k, false), k, k, true);

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

function lineRows(lineInk: Bits): Line[] {
  const { w, h, d } = lineInk;
  const cand: number[] = [];
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) n += d[y * w + x];
    if (n > 0.45 * w) cand.push(y);
  }
  const lines: Line[] = [];
  let start = cand[0];
  for (let i = 1; i <= cand.length; i++) {
    if (i === cand.length || cand[i] !== cand[i - 1] + 1) { if (start !== undefined) lines.push([start, cand[i - 1]]); start = cand[i]; }
  }
  return lines;
}

function groupStaves(lines: Line[]): { centers: number[]; lines: Line[] }[] {
  const centers = lines.map(([a, b]) => (a + b) / 2);
  const out: { centers: number[]; lines: Line[] }[] = [];
  // độ đều của 5 dòng bắt đầu từ i (nhỏ = đều); Infinity nếu không phải khuông
  const unevenness = (i: number) => {
    if (i + 4 >= centers.length) return Infinity;
    const g = centers.slice(i, i + 5);
    const d = g.slice(1).map((v, k) => v - g[k]);
    const r = Math.max(...d) / Math.min(...d);
    return r < 1.4 ? r : Infinity;
  };
  let i = 0;
  while (i + 4 < centers.length) {
    const u = unevenness(i);
    // đường kẻ ngang lạ (ngoặc lặp "1." "2.", gạch chân) sát khuông: chọn bộ 5 dòng đều hơn
    if (u < Infinity && unevenness(i + 1) < u) { i++; continue; }
    if (u < Infinity) { out.push({ centers: centers.slice(i, i + 5), lines: lines.slice(i, i + 5) }); i += 5; }
    else i++;
  }
  return out;
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

const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const spaceOf = (c: number[]) => mean(c.slice(1).map((v, k) => v - c[k]));

/** Khoảng cách dòng kẻ của ảnh (px), hoặc null nếu không thấy khuông nhạc */
export function staffSpacing(g: Gray): number | null {
  const st = groupStaves(lineRows(threshold(g, 225)));
  return st.length ? median(st.map((s) => spaceOf(s.centers))) : null;
}

// ───────────────────────── các phép đo cục bộ ─────────────────────────

function keepHeadHoles(holes: Bits, s: number, minW: number) {
  const { lab, boxes } = label(holes);
  const keep = new Uint8Array(boxes.length + 1);
  boxes.forEach((o, i) => { if (bh(o) <= 0.9 * s && minW <= bw(o) && bw(o) <= 1.4 * s && bh(o) <= bw(o) + 1) keep[i + 1] = 1; });
  const r = new Bits(holes.w, holes.h);
  for (let i = 0; i < r.d.length; i++) r.d[i] = keep[lab[i]];
  return r;
}

function anyIn(b: Bits, o: Box) {
  for (let y = o.y0; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) if (b.d[y * b.w + x]) return true;
  return false;
}

/** Lòng nốt trắng phải có vành mực ngắn ở cả hai bên (không phải thân nốt / móc dài) */
function ringSides(img: Bits, o: Box, s: number) {
  const sides: number[] = [];
  const left: number[] = [], right: number[] = [];
  for (let x = o.x0 - 1; x > Math.max(o.x0 - 4, -1); x--) left.push(x);
  for (let x = o.x1; x < Math.min(o.x1 + 3, img.w); x++) right.push(x);
  for (const xs of [left, right]) {
    const runs: number[] = [];
    for (const x of xs) for (let y = o.y0; y < o.y1; y++) { const r = verticalRun(img, x, y); if (r) runs.push(r[1] - r[0] + 1); }
    if (!runs.length) return false;
    sides.push(Math.min(...runs));
  }
  return Math.max(...sides) <= 1.6 * s;
}

interface Stem { x: number; a: number; b: number; up: boolean }

/** Thân nốt: đoạn dọc ≥ 2.6 khe chạm đầu nốt, sát mép trái/phải */
function findStem(img: Bits, o: Box, s: number): Stem | null {
  let best: [number, number, number] | null = null;
  const xs: number[] = [];
  for (let x = Math.max(o.x0 - 2, 0); x < o.x0 + 3; x++) xs.push(x);
  for (let x = o.x1 - 3; x < Math.min(o.x1 + 2, img.w); x++) xs.push(x);
  for (const x of xs) {
    for (let y = o.y0; y < o.y1; y++) {
      const r = verticalRun(img, x, y);
      if (r && r[1] - r[0] + 1 >= 2.6 * s && (!best || r[1] - r[0] > best[2] - best[1])) best = [x, r[0], r[1]];
    }
  }
  if (!best) return null;
  const [x, a, b] = best;
  if (Math.max(o.y0 - a, b - o.y1) < 1.8 * s) return null;
  // thân nốt là nét thẳng, mảnh: đo bề ngang nét ở phần nhô ra khỏi đầu nốt (lặng đen zig-zag thì rộng)
  const [ya, yb] = o.y0 - a > b - o.y1 ? [a, o.y0 - 2] : [o.y1 + 2, b];
  const widths: number[] = [];
  for (let y = ya; y <= yb; y++) {
    if (!img.get(x, y)) continue;
    let l = x, r = x;
    while (img.get(l - 1, y)) l--;
    while (img.get(r + 1, y)) r++;
    widths.push(r - l + 1);
  }
  if (widths.length && median(widths) > 0.48 * s) return null;
  const c = cy(o);
  return { x, a, b, up: c - a > b - c };
}

/** Đếm móc / vạch nối ở đoạn 1.8 khe gần đầu thân (không chạm đầu nốt) */
function countFlags(img: Bits, st: Stem, s: number) {
  let best = 0;
  for (const side of [1, -1]) {
    const x = st.x + side * Math.round(0.7 * s);
    if (x < 0 || x >= img.w) continue;
    const [y0, y1] = st.up ? [st.a, Math.min(st.a + Math.trunc(1.8 * s), img.h)] : [Math.max(st.b - Math.trunc(1.8 * s), 0), st.b + 1];
    // chỉ tính nét dày ≥ 2 px, cách nhau ≥ 2 px (bỏ hạt nhiễu của ảnh chụp)
    let runs = 0, len = 0, gap = 2;
    for (let y = y0; y <= y1; y++) {
      if (y < y1 && img.get(x, y)) { len++; continue; }
      if (len >= 2) { if (gap >= 2) runs++; gap = 0; } else if (len === 0) gap++;
      len = 0;
    }
    best = Math.max(best, runs);
  }
  return Math.min(best, 3);
}

/** Chấm dôi: đốm nhỏ, tròn bên phải đầu nốt (ngang đầu nốt hoặc khe ngay trên) */
function hasDot(img: Bits, o: Box, s: number) {
  const c = cy(o);
  const x0 = o.x1 + Math.trunc(0.15 * s), x1 = o.x1 + Math.trunc(1.6 * s);
  const y0 = Math.max(Math.trunc(c - 0.9 * s), 0), y1 = Math.trunc(c + 0.5 * s);
  const win = img.crop(y0, y1, x0, x1);
  const { boxes } = label(win);
  for (const b of boxes) {
    const hh = bh(b), ww = bw(b);
    let area = 0;
    for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) area += win.d[y * win.w + x];
    if (0.3 * s <= hh && hh <= 0.75 * s && 0.3 * s <= ww && ww <= 0.75 * s && Math.abs(hh - ww) <= 0.3 * s && area >= 0.55 * hh * ww
      && b.x0 > 0 && b.x1 < win.w && b.y0 > 0 && b.y1 < win.h) return true;
  }
  return false;
}

/** Khoá nhạc: khối cao > 5 khe ở đầu khuông; trả mép phải */
function clefEnd(img: Bits, top: number, bottom: number, s: number, xLeft: number) {
  const band = img.crop(Math.trunc(top - 3 * s), Math.trunc(bottom + 3 * s), xLeft, xLeft + Math.trunc(6 * s));
  let best = 0;
  for (const o of label(band).boxes) if (bh(o) >= 5 * s) best = Math.max(best, o.x1);
  return xLeft + (best || Math.trunc(3.6 * s));
}

/** Hoá biểu: dấu thăng (2 nét dọc) / giáng (1 nét dọc + bụng) giữa khoá nhạc và nốt đầu */
/**
 * Khối các dấu hoá dính nhau (ảnh nhỏ, in sát): cắt tại các nét dọc rồi phân loại từng phần.
 * Mỗi dấu giáng có 1 nét dọc, mỗi dấu thăng 2 nét. Trả [số dấu (+thăng / −giáng), hoặc 0 nếu không chắc].
 */
function splitAccidentals(lab: Int32Array, w: number, o: Box, id: number, s: number): number {
  const cols: number[] = [];
  for (let x = o.x0; x < o.x1; x++) {
    let best = 0, run = 0;
    for (let y = o.y0; y < o.y1; y++) { if (lab[y * w + x] === id) { run++; best = Math.max(best, run); } else run = 0; }
    if (best >= 1.4 * s) cols.push(x);
  }
  const strokes = cols.filter((x, i) => i === 0 || x !== cols[i - 1] + 1);
  const part = (x0: number, x1: number): Box | null => {
    let y0 = Infinity, y1 = -1;
    for (let y = o.y0; y < o.y1; y++) for (let x = x0; x < x1; x++) if (lab[y * w + x] === id) { y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1); }
    return y1 > y0 ? { x0, x1, y0, y1 } : null;
  };
  for (const per of [1, 2]) {
    if (strokes.length < 2 || strokes.length % per) continue;
    const cuts = strokes.filter((_, i) => i % per === 0).concat(o.x1);
    const kinds = cuts.slice(0, -1).map((x, i) => {
      const b = part(i === 0 ? o.x0 : x, cuts[i + 1]);
      return b ? classifyAccidental(lab, w, b, id, s) : null;
    });
    if (per === 1 && kinds.every((k) => k === -1)) return -kinds.length;
    if (per === 2 && kinds.every((k) => k === 1)) return kinds.length;
  }
  return 0;
}

function keySignature(img: Bits, top: number, bottom: number, s: number, xFrom: number): [number, number] {
  const y0 = Math.trunc(top - 1.5 * s);
  const band = img.crop(y0, Math.trunc(bottom + s), xFrom, xFrom + Math.trunc(9 * s));
  const { lab, boxes } = label(band);
  let sharps = 0, flats = 0, end = 0;
  for (const { o, id } of boxes.map((o, i) => ({ o, id: i + 1 })).sort((a, b) => a.o.x0 - b.o.x0)) {
    if (bh(o) < 0.5 * s) continue; // hạt nhiễu
    if (o.x0 - end > (end ? 1.2 : 2.5) * s) break; // dấu hoá trong hoá biểu đứng sát nhau
    let n = 0;
    if (1.8 * s <= bh(o) && bh(o) <= 3.6 * s && 0.45 * s <= bw(o) && bw(o) <= 1.4 * s) {
      const kind = classifyAccidental(lab, band.w, o, id, s);
      n = kind === 1 ? 1 : kind === -1 ? -1 : 0;
    } else if (1.8 * s <= bh(o) && bh(o) <= 4.8 * s && 1.4 * s < bw(o) && bw(o) <= 6 * s) {
      n = splitAccidentals(lab, band.w, o, id, s); // nhiều dấu dính nhau
    }
    if (!n) break;
    if (n > 0) sharps += n; else flats -= n;
    end = o.x1;
  }
  if (sharps && !flats) return [Math.min(sharps, 7), xFrom + end];
  if (flats && !sharps) return [-Math.min(flats, 7), xFrom + end];
  return [0, xFrom];
}

/** Cụm chữ số chỉ nhịp ngay sau khoá/hoá biểu: trả [x đầu, x cuối] */
function timeSigSpan(img: Bits, top: number, bottom: number, s: number, xFrom: number): [number, number] | null {
  const y0 = Math.trunc(top - 0.5 * s);
  const band = img.crop(y0, Math.trunc(bottom + 0.5 * s) + 1, xFrom, xFrom + Math.trunc(8 * s));
  const { boxes } = label(band);
  const mid = (bottom - top) / 2 + 0.5 * s;
  // chữ "C" (nhịp 4/4): một khối ở giữa khuông, cao ~2 khe — có thể vỡ thành vài mảnh khi xoá dòng kẻ
  const near = boxes.filter((b) => bh(b) >= 0.5 * s && bh(b) <= 3 * s && b.x0 < 3 * s);
  if (near.length) {
    const u = { x0: Math.min(...near.map((b) => b.x0)), x1: Math.max(...near.map((b) => b.x1)), y0: Math.min(...near.map((b) => b.y0)), y1: Math.max(...near.map((b) => b.y1)) };
    if (Math.abs(cy(u) + y0 - (top + bottom) / 2) <= 0.6 * s && 1.5 * s <= bh(u) && bh(u) <= 2.6 * s && 1.1 * s <= bw(u) && bw(u) <= 2.4 * s) {
      return [xFrom + u.x0 - 1, xFrom + u.x1 + 1];
    }
  }
  for (const a of boxes) {
    // hai chữ số dính nhau: khối cao gần bằng khuông, rộng (nốt + thân thì hẹp và thò ra ngoài khuông)
    const inside = a.y0 > 0 && a.y1 < band.h;
    if (3.4 * s <= bh(a) && bh(a) <= 4.8 * s && 1.7 * s <= bw(a) && bw(a) <= 3 * s && inside) return [xFrom + a.x0 - 1, xFrom + a.x1 + 1];
  }
  for (const a of boxes) for (const b of boxes) {
    if (a === b || !(1.3 * s <= bh(a) && bh(a) <= 2.6 * s && 1.3 * s <= bh(b) && bh(b) <= 2.6 * s)) continue;
    if (a.y1 <= mid + 0.5 * s && b.y0 >= mid - 0.5 * s && Math.abs(a.x0 - b.x0) < 0.8 * s) {
      return [xFrom + Math.min(a.x0, b.x0) - 1, xFrom + Math.max(a.x1, b.x1) + 1];
    }
  }
  return null;
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

interface Accidental { box: Box; kind: -1 | 0 | 1 }

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
    const near = heads.some((h) => cx(h) > o.x1 && h.x0 - 1.8 * s <= o.x1 && o.x1 <= h.x0 + 0.4 * s && Math.abs(cy(h) - cy(o)) <= 1.3 * s);
    if (!near) return;
    const kind = classifyAccidental(lab, img.w, o, i + 1, s);
    if (kind === null) return;
    out.push({ box: o, kind });
  });
  return out;
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
    if (0.3 * s <= h && h <= 0.85 * s && 0.8 * s <= w && w <= 2.4 * s && dens >= 0.6) beats = c < top + 1.5 * s ? 4 : 2;
    else if (1.2 * s <= h && h <= 2.2 * s && 0.55 * s <= w && w <= 1.3 * s && c > top + 0.8 * s && c < bottom - 0.3 * s) beats = 0.5;
    else if (2.2 * s < h && h <= 3.4 * s && 0.55 * s <= w && w <= 1.4 * s && c > top + s && c < bottom - s) beats = 1;
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
    let xs = [g.x], a = g.a, b = g.b, last = g.x;
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

// ───────────────────────── đọc một trang ─────────────────────────

let noteSeq = 0;

/** Đọc một trang (ảnh xám gốc). Trả null nếu không thấy khuông nhạc. */
export function readPage(input: Gray, page = 0): OmrPage | null {
  const original = flattenBackground(input);
  const s0 = staffSpacing(original);
  if (!s0) return null;
  const f = TARGET_SPACE / s0;
  const gray = Math.abs(f - 1) < 0.02 ? original : resizeGray(original, Math.round(original.width * f), Math.round(original.height * f));
  const ink = threshold(gray, 200);
  const lineInk = threshold(gray, 225);
  const lines = lineRows(lineInk);
  const staves = groupStaves(lines);
  if (!staves.length) return null;
  const clean = removeLines(ink, lines, 0); // tìm đầu nốt
  const thin = removeLines(lineInk, lines, 1); // thân nốt, móc: xoá cả viền xám của dòng kẻ
  const k = Math.max(3, Math.round(0.55 * TARGET_SPACE)) | 1;

  let keySig = 0;
  const outStaves: OmrStaff[] = [];
  const notes: OmrNote[] = [];

  staves.forEach(({ centers }, si) => {
    const s = spaceOf(centers);
    const top = centers[0], bottom = centers[4];
    const y0 = Math.max(Math.trunc(top - 3.5 * s), 0), y1 = Math.trunc(bottom + 2.2 * s);
    let xLeft = Infinity, xRight = -1;
    for (let x = 0; x < ink.w; x++) {
      let n = 0;
      for (let y = Math.trunc(top); y <= Math.trunc(bottom); y++) n += ink.d[y * ink.w + x];
      if (n >= 4) { xLeft = Math.min(xLeft, x); xRight = x; }
    }
    if (xRight < 0) return;
    const ce = clefEnd(thin, top, bottom, s, xLeft);
    const roi = clean.rows(y0, y1); roi.clearLeft(ce);
    const thinRoi = thin.rows(y0, y1);
    const headLike = (o: Box) => 0.5 * s <= bh(o) && bh(o) <= 1.6 * s && 0.7 * s <= bw(o) && bw(o) <= 2 * s;

    // lượt 1: lấp lỗ nhỏ cỡ lòng đầu nốt, và khe 3 px (ảnh nhỏ: dòng kẻ xẻ nốt trắng thành nhiều mảnh mỏng)
    const bridged = roi.or(closingV(roi, 3));
    const small = keepHeadHoles(fillHoles(bridged).andNot(bridged), s, 0);
    const heads = opening(closing(roi.or(small), 3), k);
    // hàng thuộc dòng kẻ (toạ độ trong roi) — bỏ qua khi đo độ đặc của lõi đầu nốt
    const inkRoi = ink.rows(y0, y1); inkRoi.clearLeft(ce); // còn dòng kẻ
    const lineRow = new Uint8Array(roi.h);
    for (const [a, b] of lines) for (let y = a - 1; y <= b + 1; y++) if (y >= y0 && y - y0 < roi.h) lineRow[y - y0] = 1;
    /** nốt trắng nếu có lòng rỗng, hoặc lõi đầu nốt (nửa giữa của hộp) thưa mực so với chính nó */
    const isHollow = (o: Box) => {
      if (anyIn(small, o)) return true;
      if (enclosedWhite(inkRoi, o) >= Math.max(3, 0.02 * s * s)) return true;
      let n = 0, ink = 0;
      for (let y = o.y0 + Math.floor(bh(o) / 4); y < o.y1 - Math.floor(bh(o) / 4); y++) {
        if (lineRow[y]) continue;
        for (let x = o.x0 + Math.floor(bw(o) / 4); x < o.x1 - Math.floor(bw(o) / 4); x++) { n++; ink += roi.d[y * roi.w + x]; }
      }
      return n >= 4 && ink / n < 0.75;
    };
    const objs: { o: Box; hollow: boolean }[] = label(heads).boxes.filter(headLike).map((o) => ({ o, hollow: isHollow(o) }));

    // lượt 2: nốt trắng nằm ở khe — vòng nốt + hai dòng kẻ bao thành ô kín
    const wl = lineInk.rows(y0, y1); wl.clearLeft(ce);
    const small2 = keepHeadHoles(fillHoles(wl).andNot(wl), s, 0.6 * s);
    for (const o of label(small2).boxes) {
      if (objs.some((p) => Math.abs(cx(o) - cx(p.o)) < 1.2 * s && Math.abs(cy(o) - cy(p.o)) < 1.2 * s)) continue;
      if (ringSides(roi, o, s)) objs.push({ o: { y0: Math.max(o.y0 - 1, 0), y1: o.y1 + 1, x0: Math.max(o.x0 - 2, 0), x1: o.x1 + 2 }, hollow: true });
    }

    // dấu hoá giữa bài (♯ ♭ ♮) đứng ngay trước nốt: tách riêng để không nhầm thành đầu nốt
    const accs = findAccidentals(thinRoi, objs.map((p) => p.o), s, ce);
    const inAcc = (o: Box) => accs.some((a) => a.box.x0 - 1 <= cx(o) && cx(o) <= a.box.x1 + 1 && a.box.y0 - 1 <= cy(o) && cy(o) <= a.box.y1 + 1);
    const cand = objs.filter((p) => !inAcc(p.o));

    const [ks, ksEnd] = keySignature(thin, top, bottom, s, ce + 1);
    if (si === 0) keySig = ks;
    const ts = timeSigSpan(thin, top, bottom, s, Math.max(ce, ksEnd) + 1);
    const contentFrom = Math.max(ce, ksEnd, ts ? ts[1] : 0);

    // xác minh từng đốm là nốt thật (có thân, hoặc nốt tròn trong khuông) TRƯỚC khi xét hợp âm:
    // chữ hợp âm "Gm" phía trên khuông có vòng giống đầu nốt rỗng
    const valid: { o: Box; hollow: boolean; stem: Stem | null; beats: number }[] = [];
    for (const { o, hollow } of cand) {
      if (cx(o) <= contentFrom) continue;
      const stem = findStem(thinRoi, o, s);
      if (!stem) {
        // nốt tròn: rỗng, không thân, nằm trong khuông ± 0.7 khe (tránh ♭ của chữ hợp âm "B♭") (hộp tìm qua lòng rỗng hẹp hơn cả nốt → 0.8 khe)
        if (!hollow || bw(o) < 0.8 * s || cy(o) + y0 < top - 0.7 * s || cy(o) + y0 > bottom + 0.7 * s) continue;
        valid.push({ o, hollow, stem, beats: 4 });
      } else {
        if (hollow && stem.b - stem.a + 1 < 3 * s) continue; // dấu lặng γ có nét chéo ngắn
        valid.push({ o, hollow, stem, beats: hollow ? 2 : 1 / 2 ** countFlags(thinRoi, stem, s) });
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
    const occupied: Box[] = [...accs.map((a) => a.box), ...cand.map((p) => ({ x0: p.o.x0 - 1, x1: p.o.x1 + 1, y0: p.o.y0 - 1, y1: p.o.y1 + 1 }))];
    for (const [i, { o, hollow, stem, beats }] of valid.entries()) {
      if (drop.has(i)) continue;
      const x = cx(o);
      // thân nốt + vùng móc bên phải → không tính là dấu lặng / dấu nối
      if (stem) occupied.push({ x0: stem.x - 2, x1: stem.x + Math.ceil(1.4 * s), y0: stem.a - 1, y1: stem.b + 2 });
      occupied.push({ x0: o.x0 - 1, x1: o.x1 + 1, y0: o.y0 - 1, y1: o.y1 + 1 });
      const dot = hasDot(roi, o, s);
      const acc = accs.find((a) => o.x0 - 1.8 * s <= a.box.x1 && a.box.x1 <= o.x0 + 0.4 * s && Math.abs(cy(a.box) - cy(o)) <= 1.3 * s);
      const y = cy(o) + y0;
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x, y,
        step: Math.round((bottom - y) / (s / 2)), accidental: acc ? acc.kind : null,
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
      if (occupied.some((z) => overlaps(z, o))) continue;
      if (staffNotes.some((n) => Math.abs(n.x - cx(o)) < 0.8 * s && Math.abs(n.y - (cy(o) + y0)) < s)) continue;
      const stem: Stem = { ...st, up: head.up };
      const beats = head.hollow ? 2 : 1 / 2 ** countFlags(thinRoi, stem, s);
      const dot = hasDot(roi, o, s);
      usedStems.push(st.x);
      occupied.push({ x0: st.x - 2, x1: st.x + Math.ceil(1.4 * s), y0: st.a - 1, y1: st.b + 2 }, { x0: o.x0 - 1, x1: o.x1 + 1, y0: o.y0 - 1, y1: o.y1 + 1 });
      const acc = accs.find((a) => o.x0 - 1.8 * s <= a.box.x1 && a.box.x1 <= o.x0 + 0.4 * s && Math.abs(cy(a.box) - cy(o)) <= 1.3 * s);
      const y = cy(o) + y0;
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x: cx(o), y,
        step: Math.round((bottom - y) / (s / 2)), accidental: acc ? acc.kind : null,
        beats: beats * (dot ? 1.5 : 1), hollow: head.hollow, dot, rest: false,
      });
    }
    // dấu lặng vẽ trong khuông
    for (const r of findRests(thinRoi, roi, top - y0, bottom - y0, s, contentFrom + 1, xRight + 1, occupied)) {
      staffNotes.push({
        id: `n${++noteSeq}`, page, staff: outStaves.length, x: r.x, y: r.y + y0, step: 4, accidental: null,
        beats: r.beats, hollow: false, dot: false, rest: true,
      });
    }
    staffNotes.sort((a, b) => a.x - b.x);
    const first = staffNotes.length ? staffNotes[0].x : xRight;
    const bars = barlines(thin, top, bottom, s, Math.trunc(first + s), xRight + 1, staffNotes.map((n) => n.x));

    // dấu hoá giữ hiệu lực đến hết ô nhịp cho các nốt cùng vị trí
    let held = new Map<number, -1 | 0 | 1>();
    let bi = 0;
    for (const n of staffNotes) {
      while (bi < bars.length && bars[bi] < n.x) { bi++; held = new Map(); }
      if (n.rest) continue;
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
    outStaves.push({ page, top, bottom, space: s, bars, xRight });
    notes.push(...staffNotes);
  });

  return { image: gray, scale: f, keySig, staves: outStaves, notes };
}

// ───────────────────────── nhịp, dấu lặng ─────────────────────────

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

export function guessTimeSig(meter: number, notes: OmrNote[]) {
  const eighthish = notes.filter((n) => n.beats === 0.5 || n.beats === 1.5).length;
  if (Math.abs(meter - 3) < 0.01) return eighthish / Math.max(1, notes.length) > 0.4 ? '6/8' : '3/4';
  return ({ 4: '4/4', 2: '2/4', 1.5: '3/8', 6: '6/4' } as Record<number, string>)[meter] ?? '4/4';
}

/** Đọc nhiều trang theo thứ tự */
export function readSheet(pages: Gray[]): OmrResult {
  const read = pages.map((g, i) => readPage(g, i)).filter((p): p is OmrPage => !!p);
  const meter = fillRests(read);
  const all = read.flatMap((p) => p.notes);
  return { pages: read, keySig: read[0]?.keySig ?? 0, meter, timeSig: guessTimeSig(meter, all.filter((n) => !n.rest)) };
}

// ───────────────────────── cao độ & xuất ─────────────────────────

const LETTERS = 'CDEFGAB';
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

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

/** Đổi kết quả đọc sang cấu trúc dùng chung với AI → dùng lại bộ chuyển tab có sẵn. Mỗi khuông một dòng. */
export function toTranscription(
  pages: Pick<OmrPage, 'notes' | 'staves'>[],
  opts: { title: string; keySig: number; timeSig: string; tempo: number; pickupBeats?: number },
): AiTranscription {
  const lines: { notes: { pitch: string; beats: number; lyric: string }[] }[] = [];
  let last: { pitch: string; beats: number } | null = null;
  for (const p of pages) p.staves.forEach((_, si) => {
    const notes: { pitch: string; beats: number; lyric: string }[] = [];
    for (const n of p.notes.filter((m) => m.staff === si).sort((a, b) => a.x - b.x)) {
      const pitch = notePitch(n, opts.keySig);
      // nốt nối (kể cả nối sang khuông sau) cộng trường độ vào nốt trước
      if (n.tied && !n.rest && last && last.pitch === pitch) { last.beats += n.beats; continue; }
      const e = { pitch, beats: n.beats, lyric: '' };
      notes.push(e);
      last = n.rest ? null : e;
    }
    if (notes.length) lines.push({ notes });
  });
  return {
    title: opts.title || 'Bài quét',
    songKey: keyName(opts.keySig),
    tempo: opts.tempo,
    timeSignature: opts.timeSig,
    pickupBeats: opts.pickupBeats ?? 0,
    confidence: 1,
    warnings: [],
    sections: [{ name: 'Đoạn 1', lines }],
  };
}
