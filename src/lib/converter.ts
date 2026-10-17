/**
 * Chuyển cao độ (MIDI) sang tab harp: chọn lỗ tối ưu bằng quy hoạch động
 * (ưu tiên nốt tự nhiên, hạn chế bend/overblow, hạn chế nhảy lỗ xa),
 * và tìm tông kèn / quãng dịch giọng phù hợp nhất. Dùng chung cho diatonic và chromatic.
 */
import { HARP_KEYS, HarpKey, HarpNote, HarpType, harpLayout, isTremolo, techniqueCost } from './harp';
import { ParsedTab, TabSection, parseTab, serializeTab } from './tabText';

const UNPLAYABLE_COST = 60;
const MOVE_COST = 0.35;

export interface TabFit {
  key: HarpKey;
  type: HarpType;
  /** số nửa cung đã dịch so với bản gốc */
  shift: number;
  tokens: (string | null)[];
  cost: number;
  stats: { notes: number; natural: number; bends: number; slides: number; overblows: number; unplayable: number };
}

function candidatesFor(midi: number, key: HarpKey, type: HarpType): HarpNote[] {
  return harpLayout(key, type).filter((n) => n.midi === midi);
}

/** Độ khó gợi ý của bài theo kỹ thuật cần dùng */
export function difficultyOf(stats: { notes: number; bends: number; overblows: number; slides?: number }): 1 | 2 | 3 {
  if (stats.bends > 3 || stats.overblows) return 3;
  if (stats.bends) return 2;
  const slides = stats.slides ?? 0;
  return slides > Math.max(4, stats.notes * 0.25) ? 2 : 1;
}

/** Chọn token cho từng nốt với tổng chi phí nhỏ nhất (Viterbi). null trong input = nghỉ */
export function bestTabs(midis: (number | null)[], key: HarpKey, shift = 0, type: HarpType = 'diatonic'): TabFit {
  type State = { note: HarpNote | null; cost: number; prev: number };
  const columns: State[][] = [];
  const idxMap: number[] = []; // vị trí trong midis của mỗi cột
  let unplayable = 0;

  // tremolo: lỗ thổi (lẻ) và lỗ hút (chẵn) của một cặp nằm cùng chỗ trên kèn → khoảng cách tính theo cặp
  const place = isTremolo(type) ? (h: number) => Math.ceil(h / 2) : (h: number) => h;
  midis.forEach((m, i) => {
    if (m === null) return;
    const target = m + shift;
    const cands = candidatesFor(target, key, type);
    const prevCol = columns[columns.length - 1];
    const col: State[] = [];
    const options: (HarpNote | null)[] = cands.length ? cands : [null];
    for (const c of options) {
      const base = c ? techniqueCost(c) : UNPLAYABLE_COST;
      if (!prevCol) {
        col.push({ note: c, cost: base, prev: -1 });
        continue;
      }
      let best = Infinity, bestIdx = 0;
      prevCol.forEach((p, pi) => {
        const move = p.note && c ? Math.abs(place(p.note.hole) - place(c.hole)) * MOVE_COST : 0;
        const v = p.cost + base + move;
        if (v < best) { best = v; bestIdx = pi; }
      });
      col.push({ note: c, cost: best, prev: bestIdx });
    }
    columns.push(col);
    idxMap.push(i);
  });

  const tokens: (string | null)[] = midis.map(() => null);
  const stats = { notes: 0, natural: 0, bends: 0, slides: 0, overblows: 0, unplayable: 0 };
  if (!columns.length) return { key, type, shift, tokens, cost: 0, stats };

  const last = columns[columns.length - 1];
  let bi = 0;
  last.forEach((s, i) => { if (s.cost < last[bi].cost) bi = i; });
  const total = last[bi].cost;
  for (let c = columns.length - 1; c >= 0; c--) {
    const st = columns[c][bi];
    const n = st.note;
    stats.notes++;
    if (!n) { unplayable++; tokens[idxMap[c]] = null; }
    else {
      tokens[idxMap[c]] = n.token;
      if (n.technique === 'blow' || n.technique === 'draw') stats.natural++;
      else if (n.technique === 'overblow' || n.technique === 'overdraw') stats.overblows++;
      else if (n.slide) stats.slides++;
      else stats.bends++;
    }
    bi = st.prev;
  }
  stats.unplayable = unplayable;
  return { key, type, shift, tokens, cost: total, stats };
}

export interface FitOptions {
  /** 'octave': chỉ dịch quãng tám (giữ nguyên giọng); 'any': cho phép dịch giọng bất kỳ */
  transpose: 'octave' | 'any';
  type?: HarpType;
}

/** Tìm quãng dịch tốt nhất để chơi bài trên một kèn cho trước */
export function fitToHarp(midis: (number | null)[], key: HarpKey, opts: FitOptions = { transpose: 'octave' }): TabFit {
  const shifts: number[] = [];
  const range = opts.transpose === 'any' ? 11 : 0;
  for (let semi = -range; semi <= range; semi++) for (const oct of [-36, -24, -12, 0, 12, 24, 36]) shifts.push(semi + oct);
  let best: TabFit | null = null;
  for (const s of shifts) {
    const fit = bestTabs(midis, key, s, opts.type ?? 'diatonic');
    // phạt nhẹ việc dịch giọng để ưu tiên giữ nguyên giọng gốc khi chi phí ngang nhau
    const penalty = Math.abs(((s % 12) + 12) % 12 > 6 ? 12 - (((s % 12) + 12) % 12) : ((s % 12) + 12) % 12) * 0.05 + Math.abs(s) * 0.001;
    if (!best || fit.cost + penalty < best.cost + 1e-9) best = { ...fit, cost: fit.cost + penalty };
  }
  return best!;
}

/** Xếp hạng các tông kèn phù hợp để chơi bài ở đúng giọng gốc (chỉ dịch quãng tám) */
export function rankHarpKeys(midis: (number | null)[], limit = 3, type: HarpType = 'diatonic'): TabFit[] {
  return HARP_KEYS.map((k) => fitToHarp(midis, k, { transpose: 'octave', type }))
    .sort((a, b) => a.cost - b.cost)
    .slice(0, limit);
}

/** Ghi kết quả fit trở lại cấu trúc tab (giữ nguyên lời, độ dài, đoạn) */
export function applyFit(parsed: ParsedTab, fit: TabFit): TabSection[] {
  let i = 0;
  return parsed.sections.map((sec) => ({
    ...sec,
    lines: sec.lines.map((line) => {
      if (line.kind !== 'tab') return line;
      return {
        ...line,
        events: line.events.map((ev) => {
          const tok = fit.tokens[i++];
          if (ev.token === null && ev.midi === null) return ev; // nghỉ
          return { ...ev, token: tok, midi: ev.midi === null ? null : ev.midi + fit.shift };
        }),
      };
    }),
  }));
}

export function midisOf(parsed: ParsedTab): (number | null)[] {
  const out: (number | null)[] = [];
  parsed.sections.forEach((s) => s.lines.forEach((l) => {
    if (l.kind === 'tab') l.events.forEach((e) => out.push(e.token === null ? null : e.midi));
  }));
  return out;
}

export interface RekeyResult {
  body: string;
  fit: TabFit;
}

/**
 * Chuyển bài sang kèn khác (đổi tông, hoặc đổi loại kèn diatonic ↔ chromatic).
 *  - mode 'octave': giữ nguyên giọng hát, chỉ đổi lỗ (có thể phát sinh bend)
 *  - mode 'any':    dịch giọng để chơi dễ nhất trên kèn mới
 */
export function rekeyBody(
  body: string, fromKey: HarpKey, toKey: HarpKey, mode: FitOptions['transpose'],
  fromType: HarpType = 'diatonic', toType: HarpType = fromType,
): RekeyResult {
  const parsed = parseTab(body, fromKey, fromType);
  const midis = midisOf(parsed);
  const fit = fitToHarp(midis, toKey, { transpose: mode, type: toType });
  const sections = applyFit(parsed, fit);
  // nốt không chơi được: đánh dấu nghỉ để body vẫn hợp lệ
  sections.forEach((s) => s.lines.forEach((l) => {
    if (l.kind === 'tab') l.events.forEach((e) => { if (e.token === null) e.midi = null; });
  }));
  return { body: serializeTab(sections), fit };
}
