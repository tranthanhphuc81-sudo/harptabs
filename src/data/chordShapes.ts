/**
 * Thế hợp âm guitar và ukulele. Ghi như sách hợp âm: từ dây trầm sang dây cao
 * (guitar: dây 6 → dây 1, ukulele: G C E A), x = không đánh dây đó, số = phím (0 = buông).
 * Hợp âm thông dụng dùng thế mở / thế quen; hợp âm khác tìm thế chặn hoặc tự dò thế gần đầu cần đàn.
 */
import { chordIntervals, parseChord } from '../audio/harmony';
import { GUITAR_TUNING, UKULELE_TUNING } from './guitar';

export type ChordInstrument = 'guitar' | 'ukulele';

/** phím từng dây, từ dây trầm sang dây cao; -1 = không đánh */
export type ChordShape = number[];

const PC_NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

const GUITAR_OPEN: Record<string, string> = {
  C: 'x32010', C7: 'x32310', Cmaj7: 'x32000', Cm: 'x35543', Cm7: 'x35343',
  D: 'xx0232', D7: 'xx0212', Dm: 'xx0231', Dm7: 'xx0211', Dmaj7: 'xx0222',
  E: '022100', E7: '020100', Em: '022000', Em7: '022030', Emaj7: '021100',
  F: '133211', F7: '131211', Fm: '133111', Fmaj7: 'xx3210',
  G: '320003', G7: '320001', Gmaj7: '320002', Gm: '355333',
  A: 'x02220', A7: 'x02020', Am: 'x02210', Am7: 'x02010', Amaj7: 'x02120',
  B7: 'x21202', Bm: 'x24432',
};

const UKULELE_OPEN: Record<string, string> = {
  C: '0003', C7: '0001', Cmaj7: '0002', Cm: '0333', Cm7: '3333',
  D: '2220', D7: '2223', Dm: '2210', Dm7: '2213', Dmaj7: '2224',
  E: '4442', E7: '1202', Em: '0432', Em7: '0202', Emaj7: '1302',
  F: '2010', F7: '2313', Fm: '1013', Fmaj7: '2413',
  G: '0232', G7: '0212', Gm: '0231', Gm7: '0211', Gmaj7: '0222',
  A: '2100', A7: '0100', Am: '2000', Am7: '0000', Amaj7: '1100',
  Bb: '3211', Bb7: '1211', Bbm: '3111',
  B: '4322', B7: '2322', Bm: '4222', Bm7: '2222',
};

/** thế chặn guitar theo nốt gốc trên dây 6 (dạng Mi) và dây 5 (dạng La): độ lệch phím so với phím chặn */
const BARRE_E: Record<string, (number | null)[]> = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], 7: [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, null, 1, 1, 0, null],
  m7b5: [0, null, 0, 0, -1, null], dim7: [0, null, -1, 0, -1, null],
};
const BARRE_A: Record<string, (number | null)[]> = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], 7: [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0],
  m7b5: [null, 0, 1, 0, 1, null], dim7: [null, 0, 1, -1, 1, null],
};

function parseShape(s: string): ChordShape {
  return [...s].map((c) => (c === 'x' ? -1 : Number(c)));
}

function tuningOf(inst: ChordInstrument): number[] {
  // từ dây trầm sang dây cao (ngược thứ tự số dây)
  return [...(inst === 'guitar' ? GUITAR_TUNING : UKULELE_TUNING)].reverse();
}

/** các nốt (MIDI) một thế hợp âm phát ra, từ dây trầm sang dây cao */
export function shapeMidis(shape: ChordShape, inst: ChordInstrument): number[] {
  const tun = tuningOf(inst);
  return shape.flatMap((f, i) => (f < 0 ? [] : [tun[i] + f]));
}

function chordInfo(name: string): { root: number; suffix: string; pcs: number[] } | null {
  const c = parseChord(name);
  if (!c || c.root < 0) return null;
  const suffix = c.name.replace(/^[A-G][#b]?/, '');
  return { root: c.root, suffix, pcs: chordIntervals(c).map((i) => (c.root + i) % 12) };
}

/** tên hợp âm theo cách gọi trong bảng (Db → C#, A# → Bb…) để tra thế mở */
function lookupOpen(table: Record<string, string>, root: number, suffix: string): ChordShape | null {
  for (const [n, pc] of Object.entries(PC_NAMES)) {
    if (pc !== root) continue;
    const s = table[n + suffix];
    if (s) return parseShape(s);
  }
  return null;
}

function barre(root: number, suffix: string): ChordShape | null {
  const opts: ChordShape[] = [];
  for (const [rel, base] of [[BARRE_E, 4], [BARRE_A, 9]] as const) {
    const pat = rel[suffix];
    if (!pat) continue;
    let f = (((root - base) % 12) + 12) % 12;
    if (f === 0) f = 12;
    if (pat.some((d) => d !== null && f + d < 1)) f += 12;
    if (f > 12) continue;
    opts.push(pat.map((d) => (d === null ? -1 : f + d)));
  }
  opts.sort((a, b) => Math.max(...a) - Math.max(...b));
  return opts[0] ?? null;
}

/** tự dò một thế gần đầu cần đàn chứa đủ nốt của hợp âm (nốt trầm nhất là nốt gốc với guitar) */
export function searchShape(pcs: number[], root: number, inst: ChordInstrument): ChordShape | null {
  const tun = tuningOf(inst);
  const n = tun.length;
  let best: ChordShape | null = null, bestScore = Infinity;
  for (let lo = 0; lo <= 9; lo++) {
    const choices = (i: number): number[] => {
      const out = [0];
      for (let f = Math.max(1, lo); f <= lo + 3; f++) out.push(f);
      if (inst === 'guitar' && i < 2) out.push(-1);
      return out.filter((f) => f < 0 || pcs.includes((tun[i] + f) % 12));
    };
    const rec = (i: number, acc: number[]) => {
      if (i === n) {
        const played = acc.map((f, j) => (f < 0 ? null : tun[j] + f)).filter((m): m is number => m !== null);
        if (played.length < Math.min(n, 4) - (inst === 'guitar' ? 0 : 1)) return;
        const got = new Set(played.map((m) => m % 12));
        if (!pcs.every((p, k) => got.has(p) || (k === 2 && pcs.length > 3))) return;
        if (inst === 'guitar' && Math.min(...played) % 12 !== root) return;
        // dây không đánh chỉ được ở phía dây trầm
        const firstPlayed = acc.findIndex((f) => f >= 0);
        if (acc.slice(firstPlayed).some((f) => f < 0)) return;
        const fretted = acc.filter((f) => f > 0);
        const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
        const score = (fretted.length ? Math.max(...fretted) : 0) * 0.8 + fretted.length * 0.5 + span * 0.6 + firstPlayed * 0.4;
        if (score < bestScore) { bestScore = score; best = [...acc]; }
        return;
      }
      for (const f of choices(i)) { acc.push(f); rec(i + 1, acc); acc.pop(); }
    };
    rec(0, []);
  }
  return best;
}

const cache = new Map<string, ChordShape | null>();

/** thế hợp âm cho tên hợp âm ("Am", "F#m7", "Bbmaj7"); null nếu không đọc được / không có thế */
export function chordShape(name: string, inst: ChordInstrument): ChordShape | null {
  const ck = `${inst}:${name}`;
  if (cache.has(ck)) return cache.get(ck)!;
  const info = chordInfo(name);
  let shape: ChordShape | null = null;
  if (info) {
    shape = lookupOpen(inst === 'guitar' ? GUITAR_OPEN : UKULELE_OPEN, info.root, info.suffix)
      ?? (inst === 'guitar' ? barre(info.root, info.suffix) : null)
      ?? searchShape(info.pcs, info.root, inst);
  }
  cache.set(ck, shape);
  return shape;
}

/** các nốt (pitch class) của hợp âm, để kiểm tra thế */
export function chordPcs(name: string): number[] | null {
  return chordInfo(name)?.pcs ?? null;
}
