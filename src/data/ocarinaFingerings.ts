/**
 * Ocarina 12 lỗ alto Đô (kiểu châu Á), tầm La4 – Fa6.
 * Thế bấm 12 ký tự theo thứ tự: ngón cái trái, ngón cái phải (hai lỗ sau), trỏ / giữa / áp út / út tay trái,
 * trỏ / giữa / áp út / út tay phải, lỗ phụ trái, lỗ phụ phải. x = bịt, o = mở, h = bịt nửa.
 *
 * Nguồn: https://pureocarinas.com/ocarina-fingering-system — nốt tự nhiên đi lên bằng cách nhấc lần lượt
 * út, áp út, giữa, trỏ tay phải (Đô5 → Sol5), rồi áp út, giữa… tay trái; La4 / Si4 bịt thêm lỗ phụ (Si4: lỗ phụ phải).
 * Nốt thăng giáng là thế chéo theo cùng nguồn; Sib4, Đô#6, Rê#6 nguồn không ghi rõ nên không đưa vào
 * (bộ chọn nốt sẽ dời quãng tám / dịch giọng). Mỗi cây ocarina có thể khác chút: xem bảng thế bấm đi kèm đàn.
 */
export interface OcarinaFingering {
  midi: number;
  fingers: string;
  kind: 'normal' | 'sub' | 'cross' | 'half' | 'high';
  cost: number;
}

//            LtRt LiLmLrLp RiRmRrRp LsRs
const T = (s: string) => s.replace(/\s+/g, '');
export const OCARINA_FINGERINGS: OcarinaFingering[] = [
  { midi: 69, fingers: T('xx xxxx xxxx xx'), kind: 'sub', cost: 0.6 },    // La4: bịt hết, cả hai lỗ phụ
  { midi: 71, fingers: T('xx xxxx xxxx ox'), kind: 'sub', cost: 0.5 },    // Si4: thêm lỗ phụ phải
  { midi: 72, fingers: T('xx xxxx xxxx oo'), kind: 'normal', cost: 0 },   // Đô5
  { midi: 73, fingers: T('xx xxxx xxxh oo'), kind: 'half', cost: 1.5 },   // Đô#5
  { midi: 74, fingers: T('xx xxxx xxxo oo'), kind: 'normal', cost: 0 },   // Rê5
  { midi: 75, fingers: T('xx xxxx xxox oo'), kind: 'cross', cost: 1 },    // Rê#5
  { midi: 76, fingers: T('xx xxxx xxoo oo'), kind: 'normal', cost: 0 },   // Mi5
  { midi: 77, fingers: T('xx xxxx xooo oo'), kind: 'normal', cost: 0 },   // Fa5
  { midi: 78, fingers: T('xx xxxx oxox oo'), kind: 'cross', cost: 1 },    // Fa#5
  { midi: 79, fingers: T('xx xxxx oooo oo'), kind: 'normal', cost: 0 },   // Sol5
  { midi: 80, fingers: T('xx xxox ooxo oo'), kind: 'cross', cost: 1 },    // Sol#5
  { midi: 81, fingers: T('xx xxox oooo oo'), kind: 'normal', cost: 0 },   // La5
  { midi: 82, fingers: T('xx xoox ooxo oo'), kind: 'cross', cost: 1 },    // La#5
  { midi: 83, fingers: T('xx xoox oooo oo'), kind: 'normal', cost: 0 },   // Si5
  { midi: 84, fingers: T('xx ooox oooo oo'), kind: 'high', cost: 0.3 },   // Đô6
  { midi: 86, fingers: T('ox ooox oooo oo'), kind: 'high', cost: 0.4 },   // Rê6
  { midi: 88, fingers: T('oo ooox oooo oo'), kind: 'high', cost: 0.5 },   // Mi6
  { midi: 89, fingers: T('oo oooo oooo oo'), kind: 'high', cost: 0.6 },   // Fa6
];
