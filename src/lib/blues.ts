/**
 * Tập ngẫu hứng blues: khung 12 ô nhịp ở vị trí 2 (cross harp), thang âm blues trên kèn diatonic,
 * và dựng chuỗi sự kiện cho bộ phát nhạc (nền nhạc chạy lặp, xen lick mẫu để hỏi–đáp).
 */
import { ChordOverrides, chordName, segKey } from '../audio/harmony';
import { HarpKey, harpLayout, HarpNote, keyOffset, techniqueCost } from './harp';
import { FlatEvent, flatten, parseTab } from './tabText';

export type BluesVariant = 'basic' | 'quick';
/** bậc hợp âm trong blues: I (chủ), IV, V */
export type Degree = 'I' | 'IV' | 'V';

export const BAR_BEATS = 4;
export const BARS = 12;
export const JAM_BEATS = BAR_BEATS * BARS;

const pc = (n: number) => ((n % 12) + 12) % 12;
const DEGREE_SHIFT: Record<Degree, number> = { I: 0, IV: 5, V: 7 };

/** Bậc hợp âm từng ô: basic = I I I I / IV IV I I / V IV I V; quick change đổi ô 2 sang IV */
export function bluesDegrees(variant: BluesVariant): Degree[] {
  const d: Degree[] = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];
  if (variant === 'quick') d[1] = 'IV';
  return d;
}

/** Nốt gốc (pitch class) khi chơi vị trí 2 trên kèn này: cao hơn tông kèn một quãng năm */
export function bluesTonic(harpKey: HarpKey): number {
  return pc(keyOffset(harpKey) + 7);
}

/** Tên tông dùng cho cả bài: các tông giáng (F, Bb, Eb…) ghi giáng */
const FLAT_TONICS = new Set([5, 10, 3, 8, 1]);
export function usesFlats(tonic: number): boolean {
  return FLAT_TONICS.has(pc(tonic));
}

/** Tên hợp âm từng ô: hợp âm 7 át (G7, C7, D7) — màu đặc trưng của blues */
export function bluesChords(tonic: number, variant: BluesVariant): string[] {
  const flats = usesFlats(tonic);
  return bluesDegrees(variant).map((d) => chordName(pc(tonic + DEGREE_SHIFT[d]), false, flats, true));
}

/** Ép bộ đệm đánh đúng khung blues: mỗi nửa ô (2 phách) một khoá */
export function bluesOverrides(chords: string[]): ChordOverrides {
  const out: ChordOverrides = {};
  chords.forEach((name, bar) => {
    for (let h = 0; h < BAR_BEATS; h += 2) out[segKey(bar * BAR_BEATS + h)] = name;
  });
  return out;
}

/** Lỗ dễ nhất cho mỗi cao độ thuộc các bậc `degrees` (tính từ `tonic`), bỏ overblow; xếp từ thấp lên cao */
function holesFor(harpKey: HarpKey, tonic: number, degrees: number[], maxCost: number): string[] {
  const best = new Map<number, HarpNote>();
  for (const n of harpLayout(harpKey, 'diatonic')) {
    if (n.over || techniqueCost(n) > maxCost || !degrees.includes(pc(n.midi - tonic))) continue;
    const cur = best.get(n.midi);
    if (!cur || techniqueCost(n) < techniqueCost(cur)) best.set(n.midi, n);
  }
  return [...best.values()].sort((a, b) => a.midi - b.midi).map((n) => n.token);
}

/** Thang âm blues (1 ♭3 4 ♭5 5 ♭7) ở vị trí 2: kèn C ra -2 -3' 4 -4' -4 -5 6 … */
export function bluesScaleTokens(harpKey: HarpKey): string[] {
  return holesFor(harpKey, bluesTonic(harpKey), [0, 3, 5, 6, 7, 10], 4);
}

/** Lỗ không cần bend ra nốt của hợp âm đang vang (nốt "an toàn" để dừng câu) */
export function chordToneTokens(harpKey: HarpKey, degree: Degree): string[] {
  const root = pc(bluesTonic(harpKey) + DEGREE_SHIFT[degree]);
  return holesFor(harpKey, root, [0, 4, 7, 10], 0);
}

/** Ô nhịp (0–11) và phách trong ô từ vị trí phát */
export function barAt(beat: number): number {
  const b = Math.floor(beat / BAR_BEATS);
  return ((b % BARS) + BARS) % BARS;
}

/** Ô máy "hỏi" khi bật hỏi–đáp: máy chơi 2 ô, người chơi đáp 2 ô */
export const CALL_BARS: { bar: number; degree: Degree }[] = [
  { bar: 0, degree: 'I' }, { bar: 4, degree: 'IV' }, { bar: 8, degree: 'V' },
];
export function isCallBar(bar: number): boolean {
  return CALL_BARS.some((c) => bar === c.bar || bar === c.bar + 1);
}

/** Nốt của một lick (tab theo lỗ — cùng tab chơi được mọi tông kèn diatonic) */
export function lickEvents(body: string, harpKey: HarpKey): FlatEvent[] {
  return flatten(parseTab(body, harpKey, 'diatonic'));
}

/**
 * Chuỗi sự kiện cho bộ phát: dài đúng `bars` ô. Chỗ trống là sự kiện câm (token null nhưng có cao độ):
 * không phát ra tiếng, nhưng giúp bộ đệm có hợp âm và biết bài dài bao nhiêu.
 * `calls`: các lick đặt vào ô nào (độ dài lick tính bằng phách, cắt nếu tràn).
 */
export function jamEvents(harpKey: HarpKey, bars: number, calls: { bar: number; body: string }[] = []): FlatEvent[] {
  const tonicMidi = 48 + bluesTonic(harpKey);
  const total = bars * BAR_BEATS;
  const placed = calls
    .flatMap((c) => lickEvents(c.body, harpKey).map((e) => ({ ...e, start: e.start + c.bar * BAR_BEATS })))
    .filter((e) => e.start < total - 1e-6)
    .sort((a, b) => a.start - b.start);
  const out: FlatEvent[] = [];
  const silent = (from: number, to: number) => {
    for (let t = from; t < to - 1e-6; t = Math.floor(t / 2 + 1e-6) * 2 + 2) {
      const end = Math.min(to, Math.floor(t / 2 + 1e-6) * 2 + 2);
      out.push({ token: null, midi: tonicMidi, beats: end - t, start: t, sectionIndex: 0, lineIndex: 0, eventIndex: out.length });
    }
  };
  let t = 0;
  for (const e of placed) {
    if (e.start < t - 1e-6) continue;
    silent(t, e.start);
    const beats = Math.min(e.beats, total - e.start);
    out.push({ ...e, beats, sectionIndex: 0, lineIndex: 0, eventIndex: out.length });
    t = e.start + beats;
  }
  silent(t, total);
  return out;
}
