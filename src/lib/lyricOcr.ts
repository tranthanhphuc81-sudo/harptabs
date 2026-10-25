/**
 * Lời bài hát in dưới khuông nhạc (bản quét): tìm dải chữ ngay dưới mỗi khuông, máy đọc chữ ra từng chữ kèm vị trí,
 * rồi gắn mỗi âm tiết (tiếng Việt: mỗi chữ cách nhau một dấu cách) vào nốt gần nhất theo chiều ngang.
 * Chỉ lấy dòng lời đầu tiên (lời 1); bài nhiều lời xếp chồng thì các dòng dưới bỏ qua.
 */
import type { OmrNote, OmrPage, TitleBox } from './omr';

/** một chữ máy đọc được, toạ độ ngang trên ảnh trang (đã chuẩn hoá) */
export interface OcrWord { text: string; x0: number; x1: number; confidence: number }

const isInk = (v: number) => v < 140;

/**
 * Các dải chữ ứng viên dưới khuông `si` (trên xuống dưới): bỏ phần đuôi nốt / vạch nối ngay dưới khuông,
 * dừng trước khuông kế tiếp (chừa chỗ tên hợp âm của khuông đó). Dải đầu thường là lời 1.
 */
export function lyricBands(page: Pick<OmrPage, 'image' | 'staves' | 'notes'>, si: number): TitleBox[] {
  const g = page.image, st = page.staves[si];
  if (!st) return [];
  const sp = st.space;
  // đuôi nốt quay xuống (nốt từ dòng giữa trở lên) dài ~3,5 khe; nốt dưới khuông thêm dòng kẻ phụ
  let low = st.bottom + 1.5 * sp;
  for (const n of page.notes) if (n.staff === si && !n.rest) low = Math.max(low, n.y + (n.step >= 4 ? 3.5 * sp : 0.8 * sp));
  const y0 = Math.round(low + 0.3 * sp);
  const next = page.staves[si + 1];
  const yMax = Math.min(g.height, Math.round(next ? next.top - 1.5 * sp : y0 + 9 * sp), Math.round(y0 + 9 * sp));
  const x0 = 0, x1 = Math.min(g.width, Math.round(st.xRight + 2 * sp));
  if (yMax - y0 < sp) return [];
  // mực từng hàng
  const rows: number[] = [];
  for (let y = y0; y < yMax; y++) {
    let c = 0;
    for (let x = x0; x < x1; x++) if (isInk(g.data[y * g.width + x])) c++;
    rows.push(c);
  }
  const on = (c: number) => c >= 3;
  const bands: TitleBox[] = [];
  const maxGap = Math.max(2, Math.round(0.35 * sp)); // dấu thanh tách khỏi chữ một khe nhỏ
  let start = -1, lastInk = -1;
  const close = () => {
    if (start < 0) return;
    const h = lastInk - start + 1;
    const ink = rows.slice(start, lastInk + 1).reduce((t, c) => t + c, 0);
    // đủ cao như một dòng chữ, đủ mực (bỏ chấm, nét luyến lẻ)
    if (h >= 0.6 * sp && h <= 4 * sp && ink >= 2 * sp * sp) {
      bands.push({ x0, x1, y0: Math.max(0, y0 + start - Math.round(0.3 * sp)), y1: Math.min(g.height, y0 + lastInk + 1 + Math.round(0.4 * sp)) });
    }
    start = -1;
  };
  rows.forEach((c, i) => {
    if (on(c)) { if (start < 0) start = i; lastInk = i; }
    else if (start >= 0 && i - lastInk > maxGap) close();
  });
  close();
  return bands.slice(0, 3);
}

/** Tách chữ máy đọc thành âm tiết: "Hà-Nội" → "Hà", "Nội" (chia vị trí theo số ký tự); bỏ số lời "1." và ký tự rác */
export function toSyllables(words: OcrWord[]): OcrWord[] {
  const out: OcrWord[] = [];
  for (const w of words) {
    const text = w.text.normalize('NFC').replace(/[|_~[\]{}<>«»"“”]/g, '').trim();
    if (!text) continue;
    const parts = text.split(/[-–]+/).filter(Boolean);
    const total = parts.reduce((t, p) => t + [...p].length, 0) || 1;
    let at = w.x0;
    for (const p of parts) {
      const w1 = ((w.x1 - w.x0) * [...p].length) / total;
      const s = { text: p, x0: at, x1: at + w1, confidence: w.confidence };
      at += w1;
      if (!/\p{L}/u.test(p)) continue; // số lời "1.", dấu câu đứng riêng
      if (/^(lời|loi)$/i.test(p) && out.length === 0) continue; // "Lời 1:"
      out.push(s);
    }
  }
  return out;
}

/** Dòng đọc được có giống lời bài hát không: vài chữ có chữ cái, máy đọc khá chắc */
export function looksLikeLyrics(syls: OcrWord[]): boolean {
  if (syls.length < 2) return false;
  const conf = syls.reduce((t, s) => t + s.confidence, 0) / syls.length;
  return conf >= 45;
}

/** nốt có thể mang lời của một khuông: bỏ dấu lặng và nốt nối (ngân tiếp nốt trước) — trái sang phải */
export function lyricSlots(notes: OmrNote[], staff: number): OmrNote[] {
  return notes.filter((n) => n.staff === staff && !n.rest && !n.tied).sort((a, b) => a.x - b.x);
}

/**
 * Gắn âm tiết vào nốt theo thứ tự trái sang phải: mỗi âm tiết vào nốt gần nhất phía sau nốt vừa gắn
 * (chữ hát luyến qua nhiều nốt thì các nốt giữa không có lời), luôn chừa đủ nốt cho các âm tiết còn lại.
 * Mốc của âm tiết lệch về đầu chữ: lời in căn giữa hay căn trái dưới nốt đều khớp.
 */
export function assignSyllables(slots: OmrNote[], syls: OcrWord[]): Map<string, string> {
  const out = new Map<string, string>();
  let from = 0;
  syls.forEach((s, k) => {
    const left = syls.length - k - 1;
    const anchor = s.x0 + (s.x1 - s.x0) / 4;
    let best = -1;
    for (let j = from; j < slots.length - left; j++) {
      if (best < 0 || Math.abs(slots[j].x - anchor) < Math.abs(slots[best].x - anchor)) best = j;
    }
    if (best < 0) return;
    out.set(slots[best].id, s.text);
    from = best + 1;
  });
  return out;
}

/**
 * Người dùng sửa lời một khuông (gõ lại cả dòng): các âm tiết lần lượt vào các nốt đang có lời,
 * thừa thì vào các nốt sau đó, thiếu thì các nốt cuối không còn lời.
 */
export function relyric(slots: OmrNote[], text: string): Map<string, string> {
  const syls = text.normalize('NFC').split(/\s+/).filter(Boolean);
  const had = slots.filter((n) => n.lyric);
  const lastHad = had.length ? slots.indexOf(had[had.length - 1]) : -1;
  const order = [...had, ...slots.slice(lastHad + 1)];
  const out = new Map<string, string>();
  for (const n of slots) out.set(n.id, '');
  syls.forEach((s, i) => { if (order[i]) out.set(order[i].id, s); });
  return out;
}

/** lời hiện có của một khuông, nối bằng dấu cách */
export const staffLyrics = (notes: OmrNote[], staff: number) =>
  lyricSlots(notes, staff).map((n) => n.lyric).filter(Boolean).join(' ');
