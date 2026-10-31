/**
 * Tự cuộn trang tab theo nhịp (khi tự chơi, không phát nhạc): vị trí đang chơi trôi theo phách, trang cuộn
 * để vị trí đó luôn nằm ở vạch đọc. Giữa hai nốt liền kề nội suy tuyến tính → sang dòng mới thì trượt mượt.
 */

/** một nốt trên trang: phách bắt đầu và toạ độ dọc (tâm nốt, toạ độ trang) */
export interface ScrollPoint { beat: number; y: number }

/** gộp các nốt cùng phách, xếp theo phách; bỏ điểm làm y đi lùi (nốt ẩn, dòng in lệch) */
export function scrollPoints(raw: ScrollPoint[]): ScrollPoint[] {
  const out: ScrollPoint[] = [];
  for (const p of [...raw].sort((a, b) => a.beat - b.beat)) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.beat - p.beat) < 1e-6) continue;
    if (last && p.y < last.y - 1) continue;
    out.push(p);
  }
  return out;
}

/** toạ độ dọc của vị trí đang chơi ở phách `beat` */
export function yAtBeat(pts: ScrollPoint[], beat: number): number {
  if (!pts.length) return 0;
  if (beat <= pts[0].beat) return pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (beat < b.beat) return a.y + ((b.y - a.y) * (beat - a.beat)) / (b.beat - a.beat);
  }
  return pts[pts.length - 1].y;
}

/** ngược lại: phách ứng với toạ độ dọc `y` (để chạy tiếp từ dòng đang ở vạch đọc sau khi người dùng tự kéo) */
export function beatAtY(pts: ScrollPoint[], y: number): number {
  if (!pts.length) return 0;
  // nốt đầu tiên ở / dưới vạch đọc; đúng dòng đó (trong 1 px) thì chạy từ nốt đầu dòng
  const j = pts.findIndex((p) => p.y >= y - 1);
  if (j < 0) return pts[pts.length - 1].beat;
  if (j === 0 || pts[j].y - y < 1) return pts[j].beat;
  // giữa hai dòng: nội suy từ nốt cuối dòng trên tới nốt đầu dòng dưới
  const a = pts[j - 1], b = pts[j];
  return a.beat + ((b.beat - a.beat) * (y - a.y)) / (b.y - a.y);
}

/** tốc độ tự cuộn: phần trăm so với tempo bài, 30–200%, mỗi bước 5% */
export const AUTO_SCROLL_MIN = 30;
export const AUTO_SCROLL_MAX = 200;
export function clampScrollPct(p: number): number {
  return Math.min(AUTO_SCROLL_MAX, Math.max(AUTO_SCROLL_MIN, Math.round(p / 5) * 5));
}
