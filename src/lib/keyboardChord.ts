/**
 * Hợp âm tay trái trên bàn phím (organ, piano): chọn thế bấm gần Đô3 nhất để đổi hợp âm ít phải dời tay
 * (C = Đô Mi Sol, F = Đô Fa La, G = Si Rê Sol…), kèm số ngón tay trái (5 = ngón út ở nốt thấp nhất, 1 = ngón cái ở nốt cao nhất).
 */
import { chordIntervals, parseChord } from '../audio/harmony';

/** tâm vùng tay trái: quanh Mi3 (giữa Đô3 và Sol3) */
const CENTER = 52;

export interface KeyboardChord { notes: number[]; fingers: number[] }

/** thế bấm tay trái cho một hợp âm (null nếu không đọc được tên); hợp âm nhiều hơn 4 nốt bỏ bớt nốt quãng 5 */
export function leftHandChord(name: string): KeyboardChord | null {
  const c = parseChord(name);
  if (!c || c.root < 0) return null;
  let pcs = chordIntervals(c).map((i) => (c.root + i) % 12);
  if (pcs.length > 4) pcs = pcs.filter((_, i) => i !== 2).slice(0, 4);
  let best: number[] | null = null;
  let bestScore = Infinity;
  // thử mỗi nốt làm nốt thấp nhất (các thế đảo), các nốt còn lại xếp lên trong một quãng tám
  for (let k = 0; k < pcs.length; k++) {
    const order = [...pcs.slice(k), ...pcs.slice(0, k)];
    for (let base = 43; base <= 57; base++) {
      if (base % 12 !== order[0]) continue;
      const notes = [base];
      for (const pc of order.slice(1)) {
        let m = notes[notes.length - 1] + 1;
        while (m % 12 !== pc) m++;
        notes.push(m);
      }
      const mean = notes.reduce((a, b) => a + b, 0) / notes.length;
      // gần tâm tay trái; thế gọn (khoảng cách hẹp) dễ bấm hơn
      const score = Math.abs(mean - CENTER) + 0.3 * (notes[notes.length - 1] - notes[0]);
      if (score < bestScore) { bestScore = score; best = notes; }
    }
  }
  if (!best) return null;
  return { notes: best, fingers: leftFingers(best) };
}

/** số ngón tay trái từ nốt thấp lên: 3 nốt 5-3-1 (nốt giữa cách nốt thấp ≥ 5 nửa cung thì 5-2-1); 4 nốt 5-3-2-1 */
export function leftFingers(notes: number[]): number[] {
  if (notes.length === 4) return [5, 3, 2, 1];
  if (notes.length === 3) return [5, notes[1] - notes[0] >= 5 ? 2 : 3, 1];
  return notes.map((_, i) => 5 - i);
}
