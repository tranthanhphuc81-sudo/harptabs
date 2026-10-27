/**
 * Tập ngẫu hứng jazz: các vòng hợp âm kinh điển (ii–V–I, I–vi–ii–V, jazz blues…), nốt của hợp âm đang vang
 * trên kèn (nốt 3 và 7 là "guide tones" nên nhắm vào), và lick viết bằng tên nốt đổi sang tab cho từng loại kèn.
 */
import { chordIntervals, ChordOverrides, chordName, ChordQuality, segKey } from '../audio/harmony';
import { HarpKey, harpLayout, HarpNote, HarpType, midiToName, nameToMidi, recorderKey, techniqueCost } from './harp';
import { bestTabs } from './converter';
import { BAR_BEATS, lickEvents, usesFlats } from './blues';

/** '' trưởng, 'm' thứ, '7' át, và các loại jazz */
export type JazzQuality = '' | 'm' | '7' | ChordQuality;

/** một hợp âm trong vòng: bậc (nửa cung từ chủ âm), loại, số phách */
export interface ProgChord { deg: number; q: JazzQuality; beats: number }

export interface Progression {
  id: string;
  title: string;
  hint: string;
  /** giọng thứ: chủ âm là nốt gốc của hợp âm i */
  minor?: boolean;
  chords: ProgChord[];
}

const bar = (deg: number, q: JazzQuality): ProgChord => ({ deg, q, beats: BAR_BEATS });
const half = (deg: number, q: JazzQuality): ProgChord => ({ deg, q, beats: BAR_BEATS / 2 });

export const PROGRESSIONS: Progression[] = [
  { id: 'ii-v-i', title: 'ii – V – I trưởng', hint: 'Vòng quan trọng nhất của jazz: Dm7 → G7 → Cmaj7.',
    chords: [bar(2, 'm7'), bar(7, '7'), bar(0, 'maj7'), bar(0, 'maj7')] },
  { id: 'ii-v-i-minor', title: 'ii – V – i thứ', hint: 'Bản thứ, nghe buồn và "đêm": Dm7♭5 → G7 → Cm7.', minor: true,
    chords: [bar(2, 'm7b5'), bar(7, '7'), bar(0, 'm7'), bar(0, 'm7')] },
  { id: 'i-vi-ii-v', title: 'I – vi – ii – V', hint: 'Vòng xoay 2 ô, nền của rất nhiều bài (rhythm changes, nhạc vàng cũng hay dùng).',
    chords: [0, 1, 2, 3].flatMap(() => [half(0, 'maj7'), half(9, 'm7'), half(2, 'm7'), half(7, '7')]) },
  { id: 'autumn', title: 'Kiểu Autumn Leaves', hint: 'Đi vòng quãng 4: ii–V–I trưởng rồi ii–V–i của giọng thứ tương ứng.',
    chords: [bar(2, 'm7'), bar(7, '7'), bar(0, 'maj7'), bar(5, 'maj7'), bar(11, 'm7b5'), bar(4, '7'), bar(9, 'm7'), bar(9, 'm7')] },
  { id: 'jazz-blues', title: 'Jazz blues 12 ô', hint: 'Blues 12 ô thêm hợp âm nối kiểu jazz (bebop blues).',
    chords: [bar(0, '7'), bar(5, '7'), bar(0, '7'), half(7, 'm7'), half(0, '7'), bar(5, '7'), bar(6, 'dim7'), bar(0, '7'), bar(9, '7'),
      bar(2, 'm7'), bar(7, '7'), half(0, '7'), half(9, '7'), half(2, 'm7'), half(7, '7')] },
];

const pc = (n: number) => ((n % 12) + 12) % 12;

export function progressionBars(p: Progression): number {
  return Math.round(p.chords.reduce((t, c) => t + c.beats, 0) / BAR_BEATS);
}

export interface PlacedChord { start: number; beats: number; name: string; root: number; q: JazzQuality }

/** Hợp âm của vòng ở giọng `tonic` kèm vị trí (phách) */
export function progressionChords(p: Progression, tonic: number): PlacedChord[] {
  const flats = usesFlats(p.minor ? pc(tonic + 3) : tonic);
  let t = 0;
  return p.chords.map((c) => {
    const root = pc(tonic + c.deg);
    const q = c.q;
    const name = q === '' || q === 'm' || q === '7' ? chordName(root, q === 'm', flats, q === '7') : chordName(root, true, flats, q);
    const out = { start: t, beats: c.beats, name, root, q };
    t += c.beats;
    return out;
  });
}

/** Ép bộ đệm đánh đúng vòng: mỗi khúc 2 phách một khoá */
export function progressionOverrides(chords: PlacedChord[]): ChordOverrides {
  const out: ChordOverrides = {};
  for (const c of chords) for (let b = c.start; b < c.start + c.beats - 1e-6; b += 2) out[segKey(b)] = c.name;
  return out;
}

/** Hợp âm ở phách `beat` (vòng lặp) */
export function chordAtBeat(chords: PlacedChord[], beat: number): PlacedChord | null {
  const total = chords.reduce((t, c) => t + c.beats, 0);
  if (!total) return null;
  const b = ((beat % total) + total) % total;
  return chords.find((c) => b >= c.start - 1e-6 && b < c.start + c.beats - 1e-6) ?? null;
}

const intervalsOf = (q: JazzQuality) => chordIntervals({ minor: q === 'm' || q === 'm7' || q === 'm7b5' || q === 'dim7', seventh: q === '7', quality: q === '' || q === 'm' || q === '7' ? undefined : q });

/**
 * Lỗ dễ nhất cho từng nốt của hợp âm trên kèn (cho phép overblow trên diatonic, nút gạt trên chromatic),
 * xếp từ thấp lên. `guide`: riêng nốt 3 và nốt 7 — hai nốt quyết định màu hợp âm, nên nhắm vào khi ngẫu hứng.
 */
export function chordTones(harpKey: HarpKey, harpType: HarpType, root: number, q: JazzQuality): { all: string[]; guide: string[] } {
  const iv = intervalsOf(q);
  const guideIv = [iv[1], iv[3]].filter((x) => x !== undefined);
  const best = new Map<number, HarpNote>();
  for (const n of harpLayout(harpKey, harpType)) {
    if (!iv.includes(pc(n.midi - root))) continue;
    const cur = best.get(n.midi);
    if (!cur || techniqueCost(n) < techniqueCost(cur)) best.set(n.midi, n);
  }
  const notes = [...best.values()].sort((a, b) => a.midi - b.midi);
  return { all: notes.map((n) => n.token), guide: notes.filter((n) => guideIv.includes(pc(n.midi - root))).map((n) => n.token) };
}

/**
 * Lick viết bằng tên nốt ở giọng Đô ("D4:0.5 F4 r:2") → tab cho kèn đã chọn ở giọng `tonic`.
 * Thử dịch thêm ±1 quãng tám để vừa tầm kèn, chọn cách ít nốt không chơi được / ít kỹ thuật khó nhất.
 */
export function lickToTab(notes: string, tonic: number, harpKey: HarpKey, harpType: HarpType): { body: string; unplayable: number } {
  const items = notes.trim().split(/\s+/).map((t) => {
    const [head, dur] = t.split(':');
    return { midi: head === 'r' ? null : nameToMidi(head), dur: dur ? `:${dur}` : '' };
  });
  const shift = tonic > 6 ? tonic - 12 : tonic; // dịch gần nhất (lên hoặc xuống)
  let best: ReturnType<typeof bestTabs> | null = null;
  for (const oct of [0, 12, -12, 24]) {
    const fit = bestTabs(items.map((i) => (i.midi === null ? null : i.midi + shift + oct)), harpKey, 0, harpType);
    if (!best || fit.cost < best.cost) best = fit;
  }
  // tokens của bestTabs khớp từng vị trí đầu vào (nghỉ = null)
  const body = items.map((i, k) => `${(i.midi !== null && best!.tokens[k]) || 'r'}${i.dur}`).join(' ');
  return { body, unplayable: best!.stats.unplayable };
}

/** lick blues viết cho kèn C diatonic (giọng Sol) → tên nốt ở giọng `tonic`, rồi xếp thế bấm cho sáo */
export function lickForRecorder(body: string, tonic: number, type: HarpType): string {
  const notes = lickEvents(body, 'C').map((e) => `${e.midi === null || !e.token ? 'r' : midiToName(e.midi)}:${e.beats}`).join(' ');
  return lickToTab(notes, (((tonic - 7) % 12) + 12) % 12, recorderKey(type), type).body;
}
