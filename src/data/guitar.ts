/**
 * Guitar 6 dây (lên dây chuẩn E A D G B E) và ukulele 4 dây (G C E A, dây Sol cao — re-entrant).
 * Dây đánh số như tab guitar: dây 1 là dây mảnh nhất (cao nhất), guitar dây 6 là dây Mi trầm.
 * Tab ghi "dây.phím": 1.0 = dây 1 buông, 6.3 = dây 6 phím 3, 2.1 = dây 2 phím 1.
 * Guitar ghi theo cao độ thật (sách nhạc guitar ghi cao hơn một quãng tám; app phát đúng tiếng đàn).
 */

/** cao độ dây buông, từ dây 1 tới dây cuối */
export const GUITAR_TUNING = [64, 59, 55, 50, 45, 40]; // E4 B3 G3 D3 A2 E2
export const UKULELE_TUNING = [69, 64, 60, 67]; // A4 E4 C4 G4
export const GUITAR_FRETS = 15;
export const UKULELE_FRETS = 12;

/** tên dây buông (để hiện: e B G D A E / A E C G) */
export const GUITAR_STRING_NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
export const UKULELE_STRING_NAMES = ['A', 'E', 'C', 'G'];

export const FRET_TOKEN_RE = /^([1-6])\.(\d{1,2})$/;

export function fretToken(string: number, fret: number): string {
  return `${string}.${fret}`;
}

/** "3.2" → dây 3 phím 2 */
export function parseFretToken(t: string): { string: number; fret: number } | null {
  const m = FRET_TOKEN_RE.exec(t.trim());
  return m ? { string: Number(m[1]), fret: Number(m[2]) } : null;
}

/**
 * Độ khó một vị trí: dây buông và phím 1–4 (thế bấm đầu cần đàn) dễ nhất, càng lên cao càng khó với người mới.
 * Ưu tiên nhẹ các dây cao (dây 1–3 guitar hay đánh giai điệu).
 */
export function fretCost(string: number, fret: number, strings: number): number {
  const f = fret === 0 ? 0 : fret <= 4 ? 0.1 : fret <= 7 ? 0.6 : fret <= 12 ? 1.2 : 2;
  const s = strings === 6 ? Math.max(0, string - 3) * 0.15 : 0;
  return f + s;
}

/** chuỗi mô tả hình phím dưới nốt: g{số dây}:{dây}:{phím} */
export function fretFingers(strings: number, string: number, fret: number): string {
  return `g${strings}:${string}:${fret}`;
}

export function parseFretFingers(f: string): { strings: number; string: number; fret: number } | null {
  const m = /^g(\d):(\d):(\d+)$/.exec(f);
  return m ? { strings: Number(m[1]), string: Number(m[2]), fret: Number(m[3]) } : null;
}
