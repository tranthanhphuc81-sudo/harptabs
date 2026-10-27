/**
 * Thế bấm sáo trúc 6 lỗ (cách gọi phổ biến ở Việt Nam): sáo tông Đô bịt hết 6 lỗ ra Sol,
 * mở dần từ lỗ dưới: La, Si, Đô, Rê, Mi, mở hết ra Fa. Quãng 2 bấm như quãng 1, thổi mạnh hơn (vượt hơi).
 * Nốt thăng / giáng: bịt nửa lỗ ngay dưới lỗ đang mở.
 *
 * Mỗi thế bấm 6 ký tự, lỗ 1 (gần miệng thổi) → lỗ 6: x kín, o mở, h nửa.
 * Chỉ số 0 = nốt bịt hết (Sol của sáo Đô), mỗi bước nửa cung, 24 nốt (2 quãng tám).
 * Các nơi dạy sáo ghi hơi khác nhau ở nốt Fa# và quãng cao — kiểm lại với cây sáo của bạn.
 */
import type { RecorderFingering } from './recorderFingerings';

const LOW: RecorderFingering[] = [
  { fingers: 'xxxxxx', cost: 0, kind: 'normal' }, // Sol
  { fingers: 'xxxxxh', cost: 1.5, kind: 'half' }, // Sol#
  { fingers: 'xxxxxo', cost: 0, kind: 'normal' }, // La
  { fingers: 'xxxxho', cost: 1.5, kind: 'half' }, // Sib
  { fingers: 'xxxxoo', cost: 0, kind: 'normal' }, // Si
  { fingers: 'xxxooo', cost: 0, kind: 'normal' }, // Đô
  { fingers: 'xxhooo', cost: 1.5, kind: 'half' }, // Đô#
  { fingers: 'xxoooo', cost: 0, kind: 'normal' }, // Rê
  { fingers: 'xhoooo', cost: 1.5, kind: 'half' }, // Rê#
  { fingers: 'xooooo', cost: 0, kind: 'normal' }, // Mi
  { fingers: 'oooooo', cost: 0, kind: 'normal' }, // Fa
  { fingers: 'oxxxxx', cost: 2.5, kind: 'cross' }, // Fa# (thế chéo, quãng 2)
];

export const SAO_TRUC6_FINGERINGS: RecorderFingering[] = [
  ...LOW,
  // quãng 2: cùng thế bấm, thổi mạnh và hẹp môi hơn
  ...LOW.map((f, i) => ({ ...f, cost: f.cost + (i < 11 ? 0.8 : 1), kind: f.kind === 'normal' ? 'high' as const : f.kind })),
];
