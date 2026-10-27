/**
 * Kalimba 17 phím chỉnh giọng trưởng (thông dụng nhất: tông C, từ Đô4 tới Mi6).
 * Phím dài nhất ở giữa là nốt thấp nhất; nốt lên cao xen kẽ sang trái, sang phải:
 *   D6 B5 G5 E5 C5 A4 F4 D4 [C4] E4 G4 B4 D5 F5 A5 C6 E6
 * Tab kalimba kiểu số: 1–7 = Đô–Si theo tông của kalimba, chấm trên (°) = lên một quãng tám.
 * App ghi chấm bằng "°" (gõ ' hoặc * cũng được): 1 = Đô4, 1° = Đô5, 1°° = Đô6.
 */

export const KALIMBA_KEYS = 17;
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export interface KalimbaTine {
  /** thứ tự theo cao độ (0 = nốt thấp nhất) */
  index: number;
  /** vị trí phím từ trái sang phải (0 … 16) */
  pos: number;
  /** số nửa cung so với nốt thấp nhất (Đô của tông) */
  semis: number;
  token: string;
}

/** vị trí phím từ trái sang phải: phím thấp nhất ở giữa, lên cao xen kẽ trái / phải */
export function tinePos(index: number, keys = KALIMBA_KEYS): number {
  const center = Math.floor(keys / 2);
  return index % 2 === 1 ? center - (index + 1) / 2 : center + index / 2;
}

export function kalimbaToken(index: number): string {
  return `${(index % 7) + 1}${'°'.repeat(Math.floor(index / 7))}`;
}

export const KALIMBA_TINES: KalimbaTine[] = Array.from({ length: KALIMBA_KEYS }, (_, i) => ({
  index: i,
  pos: tinePos(i),
  semis: MAJOR[i % 7] + 12 * Math.floor(i / 7),
  token: kalimbaToken(i),
}));

/** chuẩn hoá cách ghi chấm: ' * ˚ º · → ° */
export function cleanKalimbaToken(raw: string): string {
  return raw.trim().replace(/['*˚º·]/g, '°');
}
