/**
 * Capo cho guitar / ukulele: kẹp capo ở phím n thì mọi dây cao lên n nửa cung, người chơi bấm "thế" của hợp âm thấp hơn n nửa cung.
 * Ví dụ bài giọng D, capo 2: bấm thế C – G – Am – F mà nghe ra D – A – Bm – G.
 * Capo chỉ đổi thế hợp âm; tab giai điệu (dây.phím) vẫn tính từ đầu cần đàn.
 */
import { chordName, parseChord } from '../audio/harmony';
import { chordEase, ChordInstrument } from '../data/chordShapes';

export const MAX_CAPO = 7;

/** tên thế hợp âm cần bấm khi kẹp capo `capo` để nghe ra hợp âm `sounding` */
export function shapeName(sounding: string, capo: number): string {
  if (!capo) return sounding;
  const c = parseChord(sounding);
  if (!c || c.root < 0) return sounding;
  return chordName(c.root - capo, c.minor, false, c.quality ?? c.seventh);
}

/** ngược lại: thế bấm `shape` với capo `capo` nghe ra hợp âm gì */
export function soundingName(shape: string, capo: number): string {
  return capo ? shapeName(shape, -capo) : shape;
}

/** độ khó cả bài với capo `capo`: cộng độ khó từng thế (hợp âm lặp lại tính theo số lần xuất hiện, tối đa 2 lần) */
export function capoCost(chords: string[], capo: number, inst: ChordInstrument): number {
  const count = new Map<string, number>();
  for (const c of chords) count.set(c, (count.get(c) ?? 0) + 1);
  let cost = 0;
  for (const [name, n] of count) cost += chordEase(shapeName(name, capo), inst) * Math.min(n, 2);
  // capo cao tiếng đàn mỏng và phải dời capo: phạt nhẹ để khi ngang nhau chọn capo thấp
  return cost + capo * 0.5;
}

/** chỉ gợi ý capo khi dễ hơn rõ rệt (bớt được ít nhất một hợp âm chặn khó), không chỉ để né một hợp âm F */
const MIN_GAIN = 2.5;

/** capo giúp bấm dễ nhất (0 = không cần capo) */
export function bestCapo(chords: string[], inst: ChordInstrument): number {
  const named = chords.filter((c) => { const p = parseChord(c); return p && p.root >= 0; });
  if (!named.length) return 0;
  let best = 0, bestCost = Infinity;
  for (let k = 0; k <= MAX_CAPO; k++) {
    const v = capoCost(named, k, inst);
    if (v < bestCost - 1e-9) { best = k; bestCost = v; }
  }
  return best && capoCost(named, 0, inst) - bestCost >= MIN_GAIN ? best : 0;
}
