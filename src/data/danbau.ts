/**
 * Đàn bầu (độc huyền cầm): một dây, chơi bằng âm bồi — cạnh bàn tay phải chạm nhẹ vào điểm nút 1/n của dây rồi gảy.
 * Dây Đô (tông C): dây buông Đô3; bồi 1/2 = Đô4, 1/3 = Sol4, 1/4 = Đô5, 1/5 = Mi5, 1/6 = Sol5, 1/7 = Sib5 (ít dùng), 1/8 = Đô6.
 * Nốt không có ở điểm bồi: tay trái NẮN CẦN — đẩy cần cho dây căng (nốt cao lên) hoặc kéo cho dây chùng (thấp xuống).
 * Nguồn: nhaccutienmanh.vn/cac-not-tren-can-dan-bau-day-do, xuongdancuong.com (kỹ thuật đàn bầu cho người mới).
 *
 * Tab: b4 = bồi ở điểm 1/4 dây;  b4+2 = bồi 1/4 rồi nắn cần lên 2 nửa cung;  b5-1 = nắn xuống nửa cung;
 *      b1 = gảy dây buông (âm thực, gảy gần ngựa đàn).
 */

/** nửa cung so với dây buông của từng điểm bồi (1 = dây buông) */
export const BAU_NODES: { n: number; semis: number }[] = [
  { n: 1, semis: 0 },
  { n: 2, semis: 12 },
  { n: 3, semis: 19 },
  { n: 4, semis: 24 },
  { n: 5, semis: 28 },
  { n: 6, semis: 31 },
  { n: 7, semis: 34 },
  { n: 8, semis: 36 },
];

/** dây buông tông Đô: Đô3 */
export const BAU_OPEN = 48;
/** nắn cần: lên tới 3 nửa cung, xuống tới 2 nửa cung */
export const BAU_BENDS = [0, 1, 2, 3, -1, -2];

export const BAU_TOKEN_RE = /^b([1-8])(?:([+-])([1-3]))?$/;

export function bauToken(n: number, bend: number): string {
  return `b${n}${bend > 0 ? `+${bend}` : bend < 0 ? `-${-bend}` : ''}`;
}

export function parseBauToken(t: string): { n: number; bend: number } | null {
  const m = BAU_TOKEN_RE.exec(t.trim());
  if (!m) return null;
  const bend = m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0;
  return BAU_BENDS.includes(bend) ? { n: Number(m[1]), bend } : null;
}

/** chuỗi mô tả hình dây dưới nốt: d{điểm bồi}:{nắn} */
export function bauFingers(n: number, bend: number): string {
  return `d${n}:${bend}`;
}

export function parseBauFingers(f: string): { n: number; bend: number } | null {
  const m = /^d(\d):(-?\d)$/.exec(f);
  return m ? { n: Number(m[1]), bend: Number(m[2]) } : null;
}

/**
 * độ khó: bồi 1/2 – 1/6 dễ nhất; 1/7, 1/8 nút sát ngựa khó tìm; dây buông là âm thực (ít dùng trong giai điệu);
 * nắn cần càng xa càng khó giữ đúng cao độ, nắn xuống khó hơn nắn lên.
 */
export function bauCost(n: number, bend: number): number {
  const node = n === 1 ? 0.8 : n >= 7 ? 0.7 : 0;
  const b = bend === 0 ? 0 : bend > 0 ? 0.6 + 0.5 * bend : 0.9 + 0.6 * -bend;
  return node + b;
}
