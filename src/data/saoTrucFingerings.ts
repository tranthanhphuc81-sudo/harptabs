/**
 * Thế bấm sáo trúc 6 lỗ, sinh theo cách gọi sáo của người chơi: sáo tông X, "bịt hết lỗ ra nốt" bậc mấy của X.
 * Phổ biến ở Việt Nam: sáo Đô bịt hết ra Sol (bậc 5). Có nơi gọi sáo theo nốt bịt hết (bịt hết ra Đô = bậc 1), v.v.
 *
 * Lỗ khoét theo thang âm trưởng của tông sáo: mở dần từ lỗ dưới lên, mỗi lỗ lên một bậc của thang (bắt đầu từ nốt bịt hết).
 * Chỗ cách nhau một cung thì nốt nửa cung ở giữa bấm bằng bịt nửa lỗ dưới cùng đang bịt; nốt cao hơn mở hết lỗ dùng thế chéo.
 * Quãng 2 bấm như quãng 1, thổi vượt hơi.
 *
 * Mỗi thế bấm 6 ký tự, lỗ 1 (gần miệng thổi) → lỗ 6: x kín, o mở, h nửa.
 * Các nơi dạy sáo ghi hơi khác nhau ở nốt thế chéo và quãng cao — kiểm lại với cây sáo của bạn.
 */
import type { RecorderFingering } from './recorderFingerings';

/** bậc (1 = tông của sáo … 7) → số nửa cung trong thang trưởng */
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const DEGREE_NAMES = ['Đô', 'Rê', 'Mi', 'Fa', 'Sol', 'La', 'Si'];

/** 24 nốt (2 quãng tám) tính từ nốt bịt hết; `closedDegree` 1–7 */
export function saoTrucTable(closedDegree: number): RecorderFingering[] {
  const d0 = Math.min(7, Math.max(1, Math.round(closedDegree))) - 1;
  // các nốt khi mở dần 0…6 lỗ: 7 bậc liên tiếp của thang trưởng, tính từ nốt bịt hết (nửa cung so với nốt bịt hết)
  const steps = Array.from({ length: 7 }, (_, k) => {
    const deg = d0 + k;
    return MAJOR_STEPS[deg % 7] + 12 * Math.floor(deg / 7) - MAJOR_STEPS[d0];
  });
  const low: RecorderFingering[] = [];
  const open = (k: number) => 'x'.repeat(6 - k) + 'o'.repeat(k);
  for (let k = 0; k < 7; k++) {
    low[steps[k]] = { fingers: open(k), cost: 0, kind: 'normal' };
    // cách một cung tới nốt sau: nốt giữa = bịt nửa lỗ dưới cùng đang bịt
    const next = k < 6 ? steps[k + 1] : 12;
    if (next - steps[k] === 2) {
      low[steps[k] + 1] = k < 6
        ? { fingers: 'x'.repeat(5 - k) + 'h' + 'o'.repeat(k), cost: 1.5, kind: 'half' }
        // trên nốt mở hết lỗ: thế chéo (mở lỗ 1, bịt các lỗ dưới)
        : { fingers: 'oxxxxx', cost: 2.5, kind: 'cross' };
    }
  }
  return [
    ...low,
    ...low.map((f) => ({ ...f, cost: f.cost + (f.kind === 'cross' ? 1 : 0.8), kind: f.kind === 'normal' ? 'high' as const : f.kind })),
  ];
}

/** nốt bịt hết lỗ cao hơn tông sáo (đặt ở Đô5 với sáo Đô) bao nhiêu nửa cung: bậc 4–7 nằm dưới tông, bậc 1–3 nằm trên */
export function closedOffset(closedDegree: number): number {
  const s = MAJOR_STEPS[Math.min(7, Math.max(1, Math.round(closedDegree))) - 1];
  return s > 4 ? s - 12 : s;
}
