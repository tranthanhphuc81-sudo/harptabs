/**
 * Số ngón tay phải cho giai điệu trên bàn phím (organ, piano, pianica): 1 = ngón cái … 5 = ngón út.
 * Chọn ngón cho cả bài cùng lúc (quy hoạch động) sao cho tay ít phải dời, ít căng ngón:
 * khoảng cách thoải mái giữa từng cặp ngón theo bảng của Parncutt và cộng sự (1997), luồn ngón cái khi đi lên,
 * vắt ngón qua ngón cái khi đi xuống, tránh đặt ngón cái lên phím đen. Ngón người dùng chọn tay được giữ cố định.
 */

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

/**
 * Khoảng cách (nửa cung) giữa hai ngón f < g của tay phải, từ ngón f sang ngón g:
 * [nhỏ nhất làm được, nhỏ nhất thoải mái, nhỏ nhất thả lỏng, lớn nhất thả lỏng, lớn nhất thoải mái, lớn nhất làm được].
 * Số âm với ngón cái: ngón cái luồn sang bên kia ngón đó.
 */
const SPAN: Record<string, [number, number, number, number, number, number]> = {
  '12': [-5, -3, 1, 5, 8, 10], '13': [-4, -2, 3, 7, 10, 12], '14': [-3, -1, 5, 9, 12, 14], '15': [-1, 1, 7, 10, 13, 15],
  '23': [1, 1, 1, 2, 3, 5], '24': [1, 1, 3, 4, 5, 7], '25': [2, 2, 5, 6, 8, 10],
  '34': [1, 1, 1, 2, 2, 4], '35': [1, 1, 3, 4, 5, 7], '45': [1, 1, 1, 2, 3, 5],
};

const IMPOSSIBLE = 50;

/** chi phí chuyển từ nốt a ngón f sang nốt b ngón g */
export function stepCost(a: number, f: number, b: number, g: number): number {
  if (f === g) return a === b ? 0 : IMPOSSIBLE * 0.4; // một ngón bấm hai nốt khác nhau liền nhau: phải nhấc cả tay
  const lo = Math.min(f, g), hi = Math.max(f, g);
  // khoảng cách tính từ ngón nhỏ sang ngón lớn
  const d = f < g ? b - a : a - b;
  const [minP, minC, minR, maxR, maxC, maxP] = SPAN[`${lo}${hi}`];
  if (d < minP || d > maxP) return IMPOSSIBLE;
  let c = 0;
  if (d < minC) c += 2 * (minC - d);
  if (d > maxC) c += 2 * (d - maxC);
  if (d < minR) c += minR - d;
  if (d > maxR) c += d - maxR;
  // luồn / vắt ngón (khoảng cách âm): làm được nhưng khó hơn chút, khó nữa nếu ngón cái phải xuống phím đen
  if (d < 0) c += 1 + (isBlack(f === 1 ? b : a) ? 1.5 : 0);
  // ngón 3 – 4 – 5 yếu, đi liền nhau dễ vấp
  if (lo >= 3) c += 0.5;
  return c;
}

/** chi phí riêng của một nốt: ngón cái / ngón út trên phím đen khó bấm */
function noteCost(m: number, f: number): number {
  if (!isBlack(m)) return 0;
  return f === 1 ? 2 : f === 5 ? 1 : 0;
}

export interface FingerNote {
  /** cao độ, null = nghỉ */
  midi: number | null;
  /** độ dài (phách): nghỉ dài thì tay có thời gian dời, chuyển ngón bớt khó */
  beats: number;
}

/**
 * Ngón cho từng nốt (null ở chỗ nghỉ). `fixed`: ngón chọn tay theo vị trí nốt, giữ nguyên và các nốt quanh nó tính theo.
 */
export function rightHandFingering(notes: FingerNote[], fixed: Map<number, number> = new Map()): (number | null)[] {
  const idx = notes.map((n, i) => (n.midi === null ? -1 : i)).filter((i) => i >= 0);
  const out: (number | null)[] = notes.map(() => null);
  if (!idx.length) return out;
  const F = [1, 2, 3, 4, 5];
  const allowed = (i: number) => (fixed.has(i) ? [fixed.get(i)!] : F);
  // cost[k][f]: chi phí nhỏ nhất tới nốt thứ k (trong idx) khi dùng ngón f; back để lần ngược
  let cost = new Map<number, number>();
  const back: Map<number, number>[] = [];
  for (const f of allowed(idx[0])) cost.set(f, noteCost(notes[idx[0]].midi!, f) + (f === 1 ? 0 : 0.2 * (f - 1) * 0.1));
  back.push(new Map());
  for (let k = 1; k < idx.length; k++) {
    const i = idx[k], p = idx[k - 1];
    const a = notes[p].midi!, b = notes[i].midi!;
    // có nghỉ ở giữa (hoặc nốt trước ngân dài): có thời gian nhấc tay nên chuyển ngón dễ hơn
    const rest = notes.slice(p + 1, i).reduce((s, n) => s + n.beats, 0);
    const ease = rest >= 1 ? 0.3 : notes[p].beats >= 2 ? 0.7 : 1;
    const next = new Map<number, number>();
    const bk = new Map<number, number>();
    for (const g of allowed(i)) {
      let best = Infinity, arg = 1;
      for (const [f, c0] of cost) {
        const c = c0 + ease * Math.min(stepCost(a, f, b, g), ease < 1 ? 6 : IMPOSSIBLE);
        if (c < best) { best = c; arg = f; }
      }
      next.set(g, best + noteCost(b, g));
      bk.set(g, arg);
    }
    cost = next;
    back.push(bk);
  }
  let f = [...cost.entries()].sort((x, y) => x[1] - y[1])[0][0];
  for (let k = idx.length - 1; k >= 0; k--) {
    out[idx[k]] = f;
    if (k > 0) f = back[k].get(f)!;
  }
  return out;
}
