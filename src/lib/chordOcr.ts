/**
 * Tên hợp âm in phía trên khuông (C, Am, G7, F#m…): chọn dải chữ để máy đọc, nhận tên hợp âm, gắn vào nốt
 * đứng ngay dưới, rồi đổi thành hợp âm chọn tay của bài (mỗi khúc hợp âm từ chỗ ghi tới hợp âm kế tiếp).
 */
import type { Gray, OmrNote, OmrPage, TitleBox } from './omr';
import type { OcrWord } from './lyricOcr';
import { normalizeChord } from './chordSheet';
import { NO_CHORD, segKey, type ChordOverrides } from '../audio/harmony';

/**
 * Dải chữ phía trên khuông: từ dưới khuông phía trên (cả phần lời của khuông đó) tới sát dòng kẻ trên cùng.
 * Tên hợp âm có thể nằm cao (trên ngoặc lần 1 / lần 2, trên nốt cao) nên lấy rộng, rồi tách theo dòng chữ
 * (`chordWords`): dòng nào phần lớn là tên hợp âm mới nhận. Trả null nếu không đủ chỗ.
 */
export function chordBand(page: Pick<OmrPage, 'image' | 'staves' | 'notes'>, si: number): TitleBox | null {
  const g = page.image, st = page.staves[si];
  if (!st) return null;
  const sp = st.space;
  const y1 = Math.round(st.top - 0.4 * sp);
  const prev = page.staves[si - 1];
  const y0 = Math.max(0, prev ? Math.round(prev.bottom + 1.0 * sp) : Math.round(st.top - 8 * sp));
  if (y1 - y0 < 1.2 * sp) return null;
  return { x0: 0, x1: Math.min(g.width, Math.round(st.xRight + 2 * sp)), y0, y1 };
}

/** một hàng chữ ứng viên phía trên khuông: ảnh sạch (chỉ còn các nét chữ, nền trắng) và vị trí trên trang */
export interface ChordRow { image: Gray; x0: number; y0: number }

/**
 * Hàng chữ ứng viên trong dải phía trên khuông. Đọc cả dải một lần thì máy đọc chữ gộp tên hợp âm với thân nốt,
 * vạch nối, đầu nốt của khuông kề bên. Nên tự tách trước: các nét giống chữ cái (cao 0,8–2,4 khe, không đặc như
 * đầu nốt, không mảnh dài như thân nốt), gom theo hàng; mỗi hàng chép sang ảnh trắng chỉ còn các nét đó.
 * Nhiều hàng (lời của khuông trên, số ngoặc lần 1 / 2, tên hợp âm): đọc từng hàng rồi chọn hàng có nhiều hợp âm nhất.
 */
export function chordRows(page: Pick<OmrPage, 'image' | 'staves' | 'notes'>, si: number): ChordRow[] {
  const band = chordBand(page, si);
  if (!band) return [];
  const g = page.image, sp = page.staves[si].space;
  const w = band.x1 - band.x0, h = band.y1 - band.y0;
  // mực, trừ các đường kẻ ngang dài (ngoặc lần 1 / lần 2, vạch nối): tên hợp âm hay chạm vào đường kẻ của ngoặc
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (g.data[(y + band.y0) * g.width + x + band.x0] >= 140) { x++; continue; }
      const a = x;
      while (x < w && g.data[(y + band.y0) * g.width + x + band.x0] < 140) x++;
      if (x - a < 2.5 * sp) mask.fill(1, y * w + a, y * w + x);
    }
  }
  const ink = (x: number, y: number) => mask[y * w + x] === 1;
  // các nét liền (8 hướng)
  const lab = new Int32Array(w * h);
  const comps: { x0: number; x1: number; y0: number; y1: number; px: number[] }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (lab[y * w + x] || !ink(x, y)) continue;
    const c = { x0: x, x1: x, y0: y, y1: y, px: [] as number[] };
    const stack = [y * w + x];
    lab[y * w + x] = comps.length + 1;
    while (stack.length) {
      const i = stack.pop()!, cx = i % w, cy = (i - cx) / w;
      c.px.push(i);
      c.x0 = Math.min(c.x0, cx); c.x1 = Math.max(c.x1, cx); c.y0 = Math.min(c.y0, cy); c.y1 = Math.max(c.y1, cy);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!lab[j] && ink(nx, ny)) { lab[j] = comps.length + 1; stack.push(j); }
      }
    }
    comps.push(c);
  }
  const glyphs = comps.filter((c) => {
    const cw = c.x1 - c.x0 + 1, ch = c.y1 - c.y0 + 1;
    const fill = c.px.length / (cw * ch);
    return ch >= 0.8 * sp && ch <= 2.4 * sp && cw >= 0.15 * sp && cw <= 2.6 * sp && fill <= 0.6 && !(ch > 4 * cw && ch > 1.6 * sp);
  });
  // gom theo hàng: tâm dọc gần nhau
  const rows: { mid: number; cs: typeof glyphs }[] = [];
  for (const c of [...glyphs].sort((a, b) => a.y0 + a.y1 - b.y0 - b.y1)) {
    const mid = (c.y0 + c.y1) / 2;
    const r = rows.find((q) => Math.abs(q.mid - mid) <= 0.6 * sp);
    if (r) r.cs.push(c); else rows.push({ mid, cs: [c] });
  }
  return rows.filter((r) => r.cs.length).map((r) => {
    const y0 = Math.max(0, Math.min(...r.cs.map((c) => c.y0)) - Math.round(0.4 * sp));
    const y1 = Math.min(h - 1, Math.max(...r.cs.map((c) => c.y1)) + Math.round(0.4 * sp));
    const rh = y1 - y0 + 1;
    const data = new Uint8Array(w * rh).fill(255);
    for (const c of r.cs) for (const i of c.px) {
      const x = i % w, y = (i - x) / w;
      data[(y - y0) * w + x] = g.data[(y + band.y0) * g.width + x + band.x0];
    }
    return { image: { width: w, height: rh, data }, x0: band.x0, y0: band.y0 + y0 };
  });
}

/** gom chữ thành từng dòng theo toạ độ dọc (chữ không có toạ độ dọc: coi là một dòng) */
export function textLines(words: OcrWord[]): OcrWord[][] {
  if (words.some((w) => w.y0 === undefined || w.y1 === undefined)) return words.length ? [words] : [];
  const lines: { mid: number; h: number; ws: OcrWord[] }[] = [];
  for (const w of [...words].sort((a, b) => (a.y0! + a.y1!) - (b.y0! + b.y1!))) {
    const mid = (w.y0! + w.y1!) / 2, h = Math.max(1, w.y1! - w.y0!);
    const line = lines.find((l) => Math.abs(l.mid - mid) <= 0.5 * Math.max(l.h, h));
    if (line) line.ws.push(w);
    else lines.push({ mid, h, ws: [w] });
  }
  return lines.map((l) => l.ws.sort((a, b) => a.x0 - b.x0));
}

/** chữ đáng tính khi xét một dòng: bỏ ký hiệu rời, số ngoặc lần 1 / lần 2 ("1.", "2."), chữ máy đọc không chắc (nốt, đuôi nốt) */
const meaningful = (w: OcrWord) => w.confidence >= 40 && /\p{L}/u.test(w.text) && !/^[IlL|]?\d+[.:]?$/.test(w.text.trim());

/** dòng chữ là dòng hợp âm: có tên hợp âm và tên hợp âm chiếm ≥ 60% số chữ đáng tính */
function chordLine(line: OcrWord[]): { x0: number; x1: number; chord: string }[] {
  // bộ đọc chữ tiếng Việt hay thêm dấu cho chữ cái đứng riêng ("Ạ", "Ð"): bỏ dấu trước khi so tên hợp âm
  const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').replace(/[ĐÐđ]/g, 'D');
  // chỉ giữ ký tự có thể có trong tên hợp âm (máy đọc hay dính thêm \ ' ` vào chữ cái)
  const toks = line.map((w) => ({ ...w, text: plain(w.text.trim()).replace(/[^A-Za-z0-9#♯♭/+°øΔ-]/g, '') })).filter((w) => w.text && !/^[-/.,:]+$/.test(w.text));
  const out = toks.flatMap((w) => {
    const c = normalizeChord(w.text);
    return c && c !== NO_CHORD ? [{ x0: w.x0, x1: w.x1, chord: c }] : [];
  });
  const n = toks.filter(meaningful).length;
  return out.length && out.length >= 0.6 * Math.max(n, out.length) ? out : [];
}

/**
 * Các chữ là tên hợp âm (đã chuẩn hoá về hợp âm app chơi được), xét từng dòng chữ: dòng phần lớn không phải
 * hợp âm là lời bài hát ("Em ơi Hà Nội phố" có chữ "Em") → bỏ cả dòng.
 */
export function chordWords(words: OcrWord[]): { x0: number; x1: number; chord: string }[] {
  return textLines(words).flatMap(chordLine).sort((a, b) => a.x0 - b.x0);
}

/** bỏ các dòng hợp âm khỏi chữ đọc được (dải lời dưới khuông có thể chạm tên hợp âm của khuông kế tiếp) */
export function withoutChordLines(words: OcrWord[]): OcrWord[] {
  return textLines(words).filter((l) => !chordLine(l).length).flat();
}

/** Gắn mỗi tên hợp âm vào nốt (hoặc dấu lặng) đứng ngay dưới: tên hợp âm in thẳng hàng với đầu nốt */
export function assignChords(notes: OmrNote[], staff: number, chords: { x0: number; x1: number; chord: string }[], space: number): Map<string, string> {
  const pool = notes.filter((n) => n.staff === staff).sort((a, b) => a.x - b.x);
  const out = new Map<string, string>();
  for (const c of chords) {
    const at = c.x0 + 0.5 * space;
    let best: OmrNote | null = null;
    for (const n of pool) {
      if (n.x < c.x0 - 1.5 * space) continue;
      if (!best || Math.abs(n.x - at) < Math.abs(best.x - at)) best = n;
    }
    if (best && Math.abs(best.x - at) <= 4 * space) out.set(best.id, c.chord);
  }
  return out;
}

/** Độ dài mỗi khúc hợp âm — như audio/harmony (nửa ô nhịp 4/4, một ô với nhịp khác) */
function segLen(beatsPerBar: number): number {
  if (beatsPerBar === 4) return 2;
  if (beatsPerBar >= 6 && beatsPerBar % 2 === 0) return beatsPerBar / 2;
  return beatsPerBar;
}

/**
 * Hợp âm in trên khuông → hợp âm chọn tay của bài: mỗi hợp âm giữ từ khúc chứa nốt nó đứng tới trước hợp âm
 * kế tiếp. `order`: thứ tự chơi (playOrder, đã mở dấu nhắc lại).
 */
export function chordOverrides(order: { n: OmrNote }[], beatsPerBar: number, pickupBeats: number): ChordOverrides {
  const seg = segLen(beatsPerBar);
  let t = 0;
  const marks: { beat: number; chord: string }[] = [];
  for (const { n } of order) {
    if (n.chord) marks.push({ beat: t, chord: n.chord });
    t += n.beats;
  }
  const end = t;
  if (!marks.length || end <= 0) return {};
  const bounds = [0];
  for (let b = pickupBeats > 1e-6 ? pickupBeats : seg; b < end - 1e-6; b += seg) bounds.push(b);
  const segOf = (beat: number) => {
    let i = 0;
    while (i + 1 < bounds.length && bounds[i + 1] <= beat + 1e-6) i++;
    return i;
  };
  const out: ChordOverrides = {};
  marks.forEach((m, k) => {
    const from = segOf(m.beat), to = k + 1 < marks.length ? segOf(marks[k + 1].beat) : bounds.length;
    for (let i = from; i < Math.max(to, from + 1); i++) out[segKey(bounds[i])] = m.chord;
  });
  return out;
}
