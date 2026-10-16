/**
 * Lý thuyết harmonica: diatonic 10 lỗ (lên dây Richter) và chromatic 12 / 16 lỗ (lên dây solo).
 *
 * Ký hiệu tab diatonic:
 *   4     thổi lỗ 4 (cũng chấp nhận "+4")
 *   -4    hút lỗ 4
 *   -3'   hút lỗ 3 bend nửa cung;  -3'' bend 1 cung;  -3''' bend 1,5 cung
 *   8'    thổi lỗ 8 bend nửa cung (blow bend, lỗ 7–10)
 *   6o    overblow lỗ 6;  -7o  overdraw lỗ 7
 *
 * Ký hiệu tab chromatic:
 *   4     thổi lỗ 4;  -4  hút lỗ 4
 *   4<    thổi lỗ 4, bấm nút gạt (cao lên nửa cung);  -4<  hút có bấm nút gạt
 */

export type Direction = 'blow' | 'draw';
export type Technique = 'blow' | 'draw' | 'drawBend' | 'blowBend' | 'overblow' | 'overdraw' | 'blowSlide' | 'drawSlide';

/** Loại kèn. Bài cũ không ghi loại là diatonic. */
export type HarpType = 'diatonic' | 'chromatic' | 'chromatic16';
export const HARP_TYPES: readonly HarpType[] = ['diatonic', 'chromatic', 'chromatic16'];

export const HARP_TYPE_LABEL: Record<HarpType, string> = {
  diatonic: 'Diatonic 10 lỗ',
  chromatic: 'Chromatic 12 lỗ',
  chromatic16: 'Chromatic 16 lỗ',
};

export function isChromatic(t: HarpType | undefined): boolean {
  return t === 'chromatic' || t === 'chromatic16';
}

export function holeCount(t: HarpType = 'diatonic'): number {
  return t === 'chromatic16' ? 16 : t === 'chromatic' ? 12 : 10;
}

export function harpTypeOf(s: { harpType?: HarpType }): HarpType {
  return s.harpType && HARP_TYPES.includes(s.harpType) ? s.harpType : 'diatonic';
}

/** "Kèn C" hoặc "Kèn C chromatic" */
export function harpName(key: string, t: HarpType = 'diatonic'): string {
  return t === 'diatonic' ? `Kèn ${key}` : t === 'chromatic16' ? `Kèn ${key} chromatic 16 lỗ` : `Kèn ${key} chromatic`;
}

export interface HarpNote {
  hole: number;
  dir: Direction;
  /** số nửa cung bend xuống (0 nếu không bend) */
  bend: number;
  /** overblow / overdraw */
  over: boolean;
  /** chromatic: bấm nút gạt */
  slide: boolean;
  midi: number;
  technique: Technique;
  token: string;
}

/** Tông kèn và độ lệch (nửa cung) so với kèn C. Các tông thấp nằm dưới C. */
export const HARP_KEYS = ['G', 'Ab', 'A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'F#'] as const;
export type HarpKey = (typeof HARP_KEYS)[number];

const KEY_OFFSET: Record<HarpKey, number> = {
  G: -5, Ab: -4, A: -3, Bb: -2, B: -1, C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6,
};

const KEY_ALIASES: Record<string, HarpKey> = {
  'G#': 'Ab', 'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', Gb: 'F#', Cb: 'B', 'E#': 'F', Fb: 'E', 'B#': 'C',
};

export function normalizeKey(k: string | undefined | null): HarpKey | null {
  if (!k) return null;
  const s = k.trim().replace('♯', '#').replace('♭', 'b');
  const cap = s.charAt(0).toUpperCase() + s.slice(1);
  if ((HARP_KEYS as readonly string[]).includes(cap)) return cap as HarpKey;
  return KEY_ALIASES[cap] ?? null;
}

export function keyOffset(key: HarpKey): number {
  return KEY_OFFSET[key];
}

// Kèn C: lỗ 1..10
const C_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96];
const C_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93];
const OVERBLOW_HOLES = [1, 4, 5, 6];
const OVERDRAW_HOLES = [7, 9, 10];

// Chromatic kèn C, mỗi 4 lỗ là một quãng tám: thổi Đô Mi Sol Đô, hút Rê Fa La Si
const CHROM_BLOW = [0, 4, 7, 12];
const CHROM_DRAW = [2, 5, 9, 11];

export function makeToken(hole: number, dir: Direction, bend: number, over: boolean, slide = false): string {
  return `${dir === 'draw' ? '-' : ''}${hole}${over ? 'o' : "'".repeat(bend)}${slide ? '<' : ''}`;
}

const layoutCache = new Map<string, HarpNote[]>();

/** Toàn bộ nốt chơi được trên kèn (diatonic: kể cả bend, overblow; chromatic: kể cả nút gạt) */
export function harpLayout(key: HarpKey, type: HarpType = 'diatonic'): HarpNote[] {
  const ck = `${type}:${key}`;
  const cached = layoutCache.get(ck);
  if (cached) return cached;
  const off = KEY_OFFSET[key];
  const notes: HarpNote[] = [];
  const push = (hole: number, dir: Direction, bend: number, over: boolean, midi: number, technique: Technique, slide = false) =>
    notes.push({ hole, dir, bend, over, slide, midi: midi + off, technique, token: makeToken(hole, dir, bend, over, slide) });

  if (isChromatic(type)) {
    // 12 lỗ: lỗ 1 = Đô4; 16 lỗ thêm một quãng tám trầm, lỗ 1 = Đô3
    const base = type === 'chromatic16' ? 48 : 60;
    for (let i = 0; i < holeCount(type); i++) {
      const hole = i + 1;
      const oct = base + 12 * Math.floor(i / 4);
      const blow = oct + CHROM_BLOW[i % 4];
      const draw = oct + CHROM_DRAW[i % 4];
      push(hole, 'blow', 0, false, blow, 'blow');
      push(hole, 'draw', 0, false, draw, 'draw');
      push(hole, 'blow', 0, false, blow + 1, 'blowSlide', true);
      push(hole, 'draw', 0, false, draw + 1, 'drawSlide', true);
    }
    layoutCache.set(ck, notes);
    return notes;
  }

  for (let i = 0; i < 10; i++) {
    const hole = i + 1;
    const blow = C_BLOW[i];
    const draw = C_DRAW[i];
    push(hole, 'blow', 0, false, blow, 'blow');
    push(hole, 'draw', 0, false, draw, 'draw');
    if (draw > blow) {
      for (let b = 1; b < draw - blow; b++) push(hole, 'draw', b, false, draw - b, 'drawBend');
      if (OVERBLOW_HOLES.includes(hole)) push(hole, 'blow', 0, true, draw + 1, 'overblow');
    } else if (blow > draw) {
      for (let b = 1; b < blow - draw; b++) push(hole, 'blow', b, false, blow - b, 'blowBend');
      if (OVERDRAW_HOLES.includes(hole)) push(hole, 'draw', 0, true, blow + 1, 'overdraw');
    }
  }
  layoutCache.set(ck, notes);
  return notes;
}

export const TOKEN_RE = /^([+-])?(10|[1-9])('{1,3}|o)?$/;
export const CHROM_TOKEN_RE = /^([+-])?(1[0-6]|[1-9])(<)?$/;

function tokenRe(type: HarpType): RegExp {
  return isChromatic(type) ? CHROM_TOKEN_RE : TOKEN_RE;
}

/** Chuẩn hoá các dấu nháy hay gặp khi copy từ web: ’ ′ ` ″ */
export function cleanToken(raw: string): string {
  return raw
    .trim()
    .replace(/[’′`´‘]/g, "'")
    .replace(/[″”"]/g, "''")
    .replace(/^[–—−]/, '-')
    .replace(/^([+-]?)<([+-]?)(\d+)$/, '$1$2$3<') // <4 → 4<
    .replace(/^\+/, '')
    .replace(/O$/, 'o');
}

export function parseToken(raw: string, key: HarpKey, type: HarpType = 'diatonic'): HarpNote | null {
  const t = cleanToken(raw);
  const m = tokenRe(type).exec(t);
  if (!m) return null;
  const dir: Direction = m[1] === '-' ? 'draw' : 'blow';
  const hole = Number(m[2]);
  const mod = m[3] ?? '';
  const slide = mod === '<';
  const over = mod === 'o';
  const bend = over || slide ? 0 : mod.length;
  const token = makeToken(hole, dir, bend, over, slide);
  return harpLayout(key, type).find((n) => n.token === token) ?? null;
}

export function isTabToken(raw: string, type: HarpType = 'diatonic'): boolean {
  return tokenRe(type).test(cleanToken(raw));
}

// ---------- Tên nốt ----------

const SHARP_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SOLFEGE = ['Đô', 'Đô#', 'Rê', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

export type NoteNameStyle = 'letter' | 'solfege';

export function pitchClassName(pc: number, style: NoteNameStyle = 'letter'): string {
  const i = ((pc % 12) + 12) % 12;
  return style === 'solfege' ? SOLFEGE[i] : SHARP_NAMES[i];
}

export function midiToName(midi: number, style: NoteNameStyle = 'letter', withOctave = true): string {
  const name = pitchClassName(midi, style);
  return withOctave ? `${name}${Math.floor(midi / 12) - 1}` : name;
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C4", "F#5", "Bb3", "Db4" → MIDI. Trả về null nếu không hợp lệ. */
export function nameToMidi(name: string): number | null {
  const m = /^\s*([A-Ga-g])\s*([#♯b♭]{0,2})\s*(-?\d)\s*$/.exec(name);
  if (!m) return null;
  let pc = PC[m[1].toUpperCase()];
  for (const ch of m[2]) pc += ch === '#' || ch === '♯' ? 1 : -1;
  return (Number(m[3]) + 1) * 12 + pc;
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hzToMidiFloat(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export const TECHNIQUE_LABEL: Record<Technique, string> = {
  blow: 'Thổi',
  draw: 'Hút',
  drawBend: 'Hút bend',
  blowBend: 'Thổi bend',
  overblow: 'Overblow',
  overdraw: 'Overdraw',
  blowSlide: 'Thổi + gạt',
  drawSlide: 'Hút + gạt',
};

/** Độ khó khi chơi một nốt — dùng cho bộ chọn lỗ tối ưu */
export function techniqueCost(n: HarpNote): number {
  switch (n.technique) {
    case 'blow':
    case 'draw':
      return 0;
    case 'drawBend':
      return 1.5 + n.bend; // nửa cung 2.5, 1 cung 3.5, 1.5 cung 4.5
    case 'blowBend':
      return 3 + n.bend;
    case 'overblow':
    case 'overdraw':
      return 8;
    case 'blowSlide':
    case 'drawSlide':
      return 0.4; // bấm gạt dễ, nhưng có nốt tự nhiên cùng cao độ thì ưu tiên nốt tự nhiên
  }
}

/** Tông bài hát tương ứng với mỗi vị trí trên một kèn */
export function positionKey(harp: HarpKey, position: 1 | 2 | 3): string {
  const shift = position === 1 ? 0 : position === 2 ? 7 : 2;
  return pitchClassName(KEY_OFFSET[harp] + shift);
}

/** Bài ở tông `songKey` muốn chơi vị trí `position` thì cần kèn tông nào */
export function harpForSongKey(songKey: string, position: 1 | 2 | 3): HarpKey | null {
  const k = normalizeKey(songKey.replace(/m$|min.*$|thứ$/i, ''));
  if (!k) return null;
  const shift = position === 1 ? 0 : position === 2 ? 7 : 2;
  const pc = (((KEY_OFFSET[k] - shift) % 12) + 12) % 12;
  return HARP_KEYS.find((h) => ((KEY_OFFSET[h] % 12) + 12) % 12 === pc) ?? null;
}

/** Tông để đệm hợp âm khi bài không ghi tông: vị trí 3 (Dorian) nghe như giọng thứ */
export function songTonality(harp: HarpKey, position: 1 | 2 | 3 = 1): string {
  return positionKey(harp, position) + (position === 3 ? 'm' : '');
}
