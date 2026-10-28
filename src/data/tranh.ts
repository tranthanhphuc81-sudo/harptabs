/**
 * Đàn tranh 16 / 17 dây, lên dây ngũ cung. Dây 1 là dây trầm nhất (dây Hò), tông Đô: Sol3.
 *   Dây Bắc (thường dạy người mới): Sol La Đô Rê Mi lặp lại → G3 A3 C4 D4 E4 G4 …
 *   Dây Đảo: Sol La Đô Rê Fa lặp lại
 * Nguồn: hocdan.org/dan-tranh-17-day, dantranhpvv.wordpress.com (bài lên dây), senvietmusic.com (dây 1 = Sol3).
 * Tông khác: cả bộ nhạn dời đều (tông Rê: dây 1 = La3…).
 *
 * Tab ghi số dây; nốt không có trên dây thì NHẤN (tay trái nhấn dây phía trái nhạn cho cao lên):
 *   7   gảy dây 7;  7^  nhấn nửa cung;  7^^  nhấn một cung
 */
export type TranhTuning = 'bac' | 'dao';

/** khoảng cách (nửa cung) của 5 dây một vòng ngũ cung, tính từ Sol */
const PATTERN: Record<TranhTuning, number[]> = {
  bac: [0, 2, 5, 7, 9], // Sol La Đô Rê Mi
  dao: [0, 2, 5, 7, 10], // Sol La Đô Rê Fa
};

/** cao độ dây buông (dây 1 → dây cuối), tông Đô: dây 1 = Sol3 (55) */
export function tranhStrings(count: number, tuning: TranhTuning): number[] {
  const p = PATTERN[tuning];
  return Array.from({ length: count }, (_, i) => 55 + 12 * Math.floor(i / 5) + p[i % 5]);
}

export const TRANH_TOKEN_RE = /^(1[0-7]|[1-9])(\^{0,2})$/;

export function tranhToken(string: number, press: number): string {
  return `${string}${'^'.repeat(press)}`;
}

export function parseTranhToken(t: string): { string: number; press: number } | null {
  const m = TRANH_TOKEN_RE.exec(t.trim());
  return m ? { string: Number(m[1]), press: m[2].length } : null;
}

/** chuỗi mô tả hình dây dưới nốt: t{số dây}:{dây}:{nhấn} */
export function tranhFingers(count: number, string: number, press: number): string {
  return `t${count}:${string}:${press}`;
}

export function parseTranhFingers(f: string): { count: number; string: number; press: number } | null {
  const m = /^t(\d+):(\d+):(\d)$/.exec(f);
  return m ? { count: Number(m[1]), string: Number(m[2]), press: Number(m[3]) } : null;
}

/** độ khó: gảy dây buông dễ nhất; nhấn nửa cung, một cung khó dần (phải nhấn đúng độ cao) */
export function tranhCost(press: number): number {
  return press === 0 ? 0 : press === 1 ? 1.2 : 2;
}
