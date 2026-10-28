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
 *
 * Kèn tremolo kiểu châu Á (16 / 21 / 24 lỗ, cùng cách xếp nốt, kèn ít lỗ thì bớt ở dải cao): mỗi số lỗ chỉ có MỘT nốt — lỗ lẻ thổi, lỗ chẵn hút.
 * App ghi lỗ hút có dấu trừ cho dễ nhìn (-4), nhưng nhận cả cách ghi chỉ có số (4) như sách tremolo.
 * Kèn này không có nốt thăng giáng, không bend.
 * Tremolo giọng thứ (Am, Dm…, thứ tự nhiên): lỗ thổi là hợp âm thứ (La Đô Mi), lỗ hút là các nốt còn lại.
 *
 * Sáo dọc (recorder, bấm Baroque): tab ghi bằng TÊN NỐT có quãng tám (F4, Bb4, C#5); mỗi nốt một thế bấm
 * (src/data/recorderFingerings.ts). Alto tông F và tenor tông C ghi đúng cao độ; soprano tông C ghi thấp hơn tiếng thật một quãng tám.
 */
import { GERMAN_OVERRIDES, RECORDER_FINGERINGS } from '../data/recorderFingerings';
import { closedOffset, saoTrucTable } from '../data/saoTrucFingerings';
import { OCARINA_FINGERINGS } from '../data/ocarinaFingerings';
import { cleanKalimbaToken, kalimbaFingers, kalimbaTines } from '../data/kalimba';
import { FRET_TOKEN_RE, fretCost, fretFingers, fretToken, GUITAR_FRETS, GUITAR_TUNING, parseFretToken, UKULELE_FRETS, UKULELE_TUNING } from '../data/guitar';

/** sáo trúc: bịt hết lỗ ra bậc mấy của tông sáo (1 = Đô của sáo Đô … 7; mặc định 5 = Sol), theo Cài đặt */
let saoTrucClosed = 5;
export function setSaoTrucClosed(degree: number) {
  if (degree === saoTrucClosed || !(degree >= 1 && degree <= 7)) return;
  saoTrucClosed = degree;
  for (const k of [...layoutCache.keys()]) if (k.startsWith('saoTruc')) layoutCache.delete(k);
}
export function getSaoTrucClosed(): number {
  return saoTrucClosed;
}

/** kiểu bấm sáo dọc đang dùng (theo Cài đặt); đổi thì xoá bảng nốt sáo đã tính */
let recorderSystem: 'baroque' | 'german' = 'baroque';
export function setRecorderFingering(sys: 'baroque' | 'german') {
  if (sys === recorderSystem) return;
  recorderSystem = sys;
  for (const k of [...layoutCache.keys()]) if (k.startsWith('recorder')) layoutCache.delete(k);
}

export type Direction = 'blow' | 'draw';
export type Technique = 'blow' | 'draw' | 'drawBend' | 'blowBend' | 'overblow' | 'overdraw' | 'blowSlide' | 'drawSlide'
  // sáo dọc: thế thường, thế chéo, bịt nửa lỗ, quãng cao (ngón cái hé)
  | 'fingered' | 'crossFingered' | 'halfHole' | 'highRegister';

/** Loại kèn. Bài cũ không ghi loại là diatonic. */
export type HarpType = 'diatonic' | 'chromatic' | 'chromatic16' | 'tremolo24' | 'tremolo21' | 'tremolo16' | 'tremolo24m' | 'tremolo21m' | 'tremolo16m'
  | 'recorderAlto' | 'recorderSoprano' | 'recorderTenor' | 'recorderBass' | 'saoTruc6' | 'kalimba17' | 'kalimba10' | 'kalimba8' | 'guitar6' | 'ukulele4' | 'pianica32' | 'pianica37' | 'ocarina12';
/** mọi loại hợp lệ (để đọc bài đã lưu); ô chọn chỉ hiện SHOWN_HARP_TYPES của bản build (src/appConfig.ts) */
export const HARP_TYPES: readonly HarpType[] = ['diatonic', 'chromatic', 'chromatic16', 'tremolo24', 'tremolo21', 'tremolo16', 'tremolo24m', 'tremolo21m', 'tremolo16m', 'recorderAlto', 'recorderSoprano', 'recorderTenor', 'recorderBass', 'saoTruc6', 'kalimba17', 'kalimba10', 'kalimba8', 'guitar6', 'ukulele4', 'pianica32', 'pianica37', 'ocarina12'];

export const HARP_TYPE_LABEL: Record<HarpType, string> = {
  diatonic: 'Diatonic 10 lỗ',
  chromatic: 'Chromatic 12 lỗ',
  chromatic16: 'Chromatic 16 lỗ',
  tremolo24: 'Tremolo 24 lỗ',
  tremolo21: 'Tremolo 21 lỗ',
  tremolo16: 'Tremolo 16 lỗ',
  tremolo24m: 'Tremolo 24 lỗ giọng thứ (Am, Dm…)',
  tremolo21m: 'Tremolo 21 lỗ giọng thứ (Am, Dm…)',
  tremolo16m: 'Tremolo 16 lỗ giọng thứ (Am, Dm…)',
  recorderAlto: 'Sáo dọc alto (Fa)',
  recorderSoprano: 'Sáo dọc soprano (Đô)',
  recorderTenor: 'Sáo dọc tenor (Đô trầm)',
  recorderBass: 'Sáo dọc bass (Fa trầm)',
  saoTruc6: 'Sáo trúc 6 lỗ',
  kalimba17: 'Kalimba 17 phím',
  kalimba10: 'Kalimba 10 phím',
  kalimba8: 'Kalimba 8 phím',
  guitar6: 'Guitar 6 dây',
  ukulele4: 'Ukulele 4 dây',
  pianica32: 'Pianica 32 phím',
  pianica37: 'Pianica 37 phím',
  ocarina12: 'Ocarina 12 lỗ (alto Đô)',
};

/** ocarina 12 lỗ alto Đô: tab tên nốt như sáo dọc, dưới nốt có hình thế bấm (src/data/ocarinaFingerings.ts) */
export function isOcarina(t: HarpType | undefined): boolean {
  return t === 'ocarina12';
}

/**
 * kèn pianica (melodica): bàn phím như piano, thổi qua ống. Tab ghi tên nốt (C4, F#4) như sáo dọc;
 * 32 phím Fa3–Đô6 (loại học sinh hay dùng), 37 phím Fa3–Fa6.
 */
export function isPianica(t: HarpType | undefined): boolean {
  return t === 'pianica32' || t === 'pianica37';
}
export const PIANICA_RANGE: Record<'pianica32' | 'pianica37', [number, number]> = { pianica32: [53, 84], pianica37: [53, 89] };

/** guitar, ukulele: tab ghi "dây.phím" (3.2 = dây 3 phím 2), dây 1 là dây cao nhất */
export function isFretted(t: HarpType | undefined): boolean {
  return t === 'guitar6' || t === 'ukulele4';
}

/** nhạc cụ không có tông để chọn (sáo dọc, guitar, ukulele): bảng nốt cố định */
export function isFixedKey(t: HarpType | undefined): boolean {
  return isRecorder(t) || isFretted(t) || isPianica(t) || isOcarina(t);
}

export function isKalimba(t: HarpType | undefined): boolean {
  return t === 'kalimba17' || t === 'kalimba10' || t === 'kalimba8';
}

/** sáo trúc: tông sáo chọn được (sáo Đô, sáo Rê…), bịt hết lỗ ra nốt bậc 5 dưới tông */
export function isSaoTruc(t: HarpType | undefined): boolean {
  return t === 'saoTruc6';
}

/**
 * nhạc cụ "mỗi nốt một cách chơi" (sáo dọc, sáo trúc: thế bấm; kalimba: vị trí phím) — tab ghi nốt, dưới nốt có hình minh hoạ.
 * Sáo ghi tên nốt (F4, Bb4); kalimba ghi số 1–7 có chấm quãng tám.
 */
export function isFingered(t: HarpType | undefined): boolean {
  return isRecorder(t) || isSaoTruc(t) || isKalimba(t) || isFretted(t) || isPianica(t) || isOcarina(t);
}

/** tông dùng để tra bảng nốt: sáo dọc có tông cố định, sáo trúc theo tông đã chọn */
export function fingeringKey(t: HarpType, key: HarpKey): HarpKey {
  return isFixedKey(t) ? recorderKey(t) : key;
}

export function isRecorder(t: HarpType | undefined): boolean {
  return t === 'recorderAlto' || t === 'recorderSoprano' || t === 'recorderTenor' || t === 'recorderBass';
}

/** tông cố định của sáo dọc: alto và bass Fa, soprano và tenor Đô (guitar, ukulele: C — không có tông) */
export function recorderKey(t: HarpType): HarpKey {
  return t === 'recorderAlto' || t === 'recorderBass' ? 'F' : 'C';
}

export function isChromatic(t: HarpType | undefined): boolean {
  return t === 'chromatic' || t === 'chromatic16';
}

export function isTremolo(t: HarpType | undefined): boolean {
  return t === 'tremolo24' || t === 'tremolo21' || t === 'tremolo16' || t === 'tremolo24m' || t === 'tremolo21m' || t === 'tremolo16m';
}

/** kèn tremolo lên dây giọng thứ: tên kèn là giọng thứ (kèn "Am" = tông A, loại giọng thứ) */
export function isMinorHarp(t: HarpType | undefined): boolean {
  return t === 'tremolo24m' || t === 'tremolo21m' || t === 'tremolo16m';
}

/** tên tông kèn để hiện: "C", hoặc "Am" với kèn giọng thứ */
export function harpKeyLabel(key: string, t?: HarpType): string {
  return key + (isMinorHarp(t) ? 'm' : '');
}

export function holeCount(t: HarpType = 'diatonic'): number {
  switch (t) {
    case 'chromatic16': return 16;
    case 'chromatic': return 12;
    case 'tremolo24': case 'tremolo24m': return 24;
    case 'tremolo21': case 'tremolo21m': return 21;
    case 'tremolo16': case 'tremolo16m': return 16;
    case 'recorderAlto': case 'recorderSoprano': case 'recorderTenor': case 'recorderBass': return 8;
    case 'saoTruc6': return 6;
    case 'kalimba17': return 17;
    case 'kalimba10': return 10;
    case 'kalimba8': return 8;
    case 'guitar6': return 6;
    case 'ukulele4': return 4;
    case 'pianica32': return 32;
    case 'pianica37': return 37;
    case 'ocarina12': return 12;
    default: return 10;
  }
}

/** tremolo: lỗ chẵn là lỗ hút */
export const tremoloDir = (hole: number): Direction => (hole % 2 === 0 ? 'draw' : 'blow');

export function harpTypeOf(s: { harpType?: HarpType }): HarpType {
  return s.harpType && HARP_TYPES.includes(s.harpType) ? s.harpType : 'diatonic';
}

/** "Kèn C" hoặc "Kèn C chromatic" */
export function harpName(key: string, t: HarpType = 'diatonic'): string {
  if (isTremolo(t)) return `Kèn ${harpKeyLabel(key, t)} tremolo ${holeCount(t)} lỗ`;
  if (isKalimba(t)) return `${HARP_TYPE_LABEL[t]} (${key})`;
  if (t === 'guitar6') return 'Guitar';
  if (t === 'ukulele4') return 'Ukulele';
  if (isPianica(t)) return `Kèn pianica ${holeCount(t)} phím`;
  if (isOcarina(t)) return 'Ocarina 12 lỗ (Đô)';
  if (isSaoTruc(t)) return `Sáo trúc ${pitchClassName(KEY_OFFSET[normalizeKey(key) ?? 'C'], 'solfege')} (${key}, bịt hết ra ${pitchClassName(KEY_OFFSET[normalizeKey(key) ?? 'C'] + [0, 2, 4, 5, 7, 9, 11][saoTrucClosed - 1], 'solfege')})`;
  if (isRecorder(t)) return t === 'recorderAlto' ? 'Sáo alto (Fa)' : t === 'recorderTenor' ? 'Sáo tenor (Đô)' : t === 'recorderBass' ? 'Sáo bass (Fa)' : 'Sáo soprano (Đô)';
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
  /** sáo dọc: thế bấm 8 lỗ (x kín, o mở, h nửa) và độ khó riêng của thế bấm */
  fingers?: string;
  fingerCost?: number;
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

/** tông kèn cao hơn `semitones` nửa cung (cùng số lỗ trên kèn đó cho giai điệu đã dịch giọng) */
export function shiftKey(k: HarpKey, semitones: number): HarpKey {
  const i = HARP_KEYS.indexOf(k);
  return HARP_KEYS[(((i + semitones) % 12) + 12) % 12];
}

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

// Tremolo châu Á kèn C (Suzuki, Tombo, Easttop…): lỗ 1, 3, 5… thổi; lỗ 2, 4, 6… hút
// Nguồn: bảng "Common tuning in East Asia", https://en.wikipedia.org/wiki/Tremolo_harmonica
const TREM_BLOW = [55, 60, 64, 67, 72, 76, 79, 84, 88, 91, 96, 100]; // G3 C4 E4 G4 C5 E5 G5 C6 E6 G6 C7 E7
const TREM_DRAW = [62, 65, 69, 71, 74, 77, 81, 83, 86, 89, 93, 95]; // D4 F4 A4 B4 D5 F5 A5 B5 D6 F6 A6 B6
// Tremolo giọng thứ tự nhiên, tính cho tông Đô thứ (Cm) rồi dịch theo tông kèn như kèn trưởng: kèn Am = thổi Mi3 La3 Đô4 Mi4…, hút Si3 Rê4 Fa4 Sol4…
const TREM_MINOR_BLOW = [55, 60, 63, 67, 72, 75, 79, 84, 87, 91, 96, 99]; // G3 C4 Eb4 G4 C5 Eb5 …
const TREM_MINOR_DRAW = [62, 65, 68, 70, 74, 77, 80, 82, 86, 89, 92, 94]; // D4 F4 Ab4 Bb4 D5 F5 …

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

  if (isOcarina(type)) {
    const KIND: Record<string, Technique> = { normal: 'fingered', sub: 'fingered', cross: 'crossFingered', half: 'halfHole', high: 'highRegister' };
    OCARINA_FINGERINGS.forEach((f, i) => notes.push({
      hole: i + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: f.midi,
      technique: KIND[f.kind], token: midiToName(f.midi), fingers: f.fingers, fingerCost: f.cost,
    }));
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isPianica(type)) {
    // pianica: mỗi phím một nốt; thế tay giữa bàn phím (Đô4–Mi5) dễ nhất, phím đen khó hơn chút
    const [lo, hi] = PIANICA_RANGE[type as 'pianica32' | 'pianica37'];
    for (let m = lo; m <= hi; m++) {
      const black = [1, 3, 6, 8, 10].includes(m % 12);
      notes.push({
        hole: m - lo + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: m,
        technique: 'fingered', token: midiToName(m), fingers: `p${m}`, fingerCost: (black ? 0.1 : 0) + (m < 60 || m > 76 ? 0.3 : 0),
      });
    }
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isFretted(type)) {
    // guitar / ukulele: mọi vị trí dây × phím; hole = phím + 1 (bộ chọn tính khoảng di tay theo phím)
    const tuning = type === 'guitar6' ? GUITAR_TUNING : UKULELE_TUNING;
    const frets = type === 'guitar6' ? GUITAR_FRETS : UKULELE_FRETS;
    tuning.forEach((open, si) => {
      for (let f = 0; f <= frets; f++) notes.push({
        hole: f + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: open + f,
        technique: 'fingered', token: fretToken(si + 1, f), fingers: fretFingers(tuning.length, si + 1, f), fingerCost: fretCost(si + 1, f, tuning.length),
      });
    });
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isKalimba(type)) {
    // kalimba tông C: Đô4 … Mi6; tông khác dịch theo (B: Si3 …, D: Rê4 …)
    const base = 60 + off;
    const keys = holeCount(type);
    kalimbaTines(keys).forEach((t) => notes.push({
      hole: t.pos + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: base + t.semis,
      technique: 'fingered', token: t.token, fingers: kalimbaFingers(t.pos, keys), fingerCost: 0,
    }));
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isSaoTruc(type)) {
    // sáo trúc Đô bịt hết ra Sol4; tông khác dịch theo (sáo Sol bịt hết ra Rê4, sáo Fa ra Đô5)
    // nốt bịt hết: bậc `saoTrucClosed` của tông sáo, đặt quanh Đô5 của sáo Đô (sáo Đô bịt hết ra Sol → Sol4)
    const base = 72 + off + closedOffset(saoTrucClosed);
    const KIND: Record<string, Technique> = { normal: 'fingered', cross: 'crossFingered', half: 'halfHole', high: 'highRegister' };
    saoTrucTable(saoTrucClosed).forEach((f, i) => notes.push({
      hole: i + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: base + i,
      technique: KIND[f.kind], token: midiToName(base + i), fingers: f.fingers, fingerCost: f.cost,
    }));
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isRecorder(type)) {
    // sáo: không phụ thuộc tông kèn; hole = thứ tự nốt (để bộ chọn tính khoảng nhảy theo cao độ)
    // nốt thấp nhất: alto F4, tenor C4 (ghi đúng cao độ), soprano C5 (ghi C4, thấp hơn tiếng thật một quãng tám)
    // bass: F3, ghi đúng cao độ (app không dùng khoá Fa)
    const sounding = type === 'recorderAlto' ? 65 : type === 'recorderTenor' ? 60 : type === 'recorderBass' ? 53 : 72;
    const written = type === 'recorderAlto' ? 65 : type === 'recorderBass' ? 53 : 60;
    const KIND: Record<string, Technique> = { normal: 'fingered', cross: 'crossFingered', half: 'halfHole', high: 'highRegister' };
    RECORDER_FINGERINGS.map((f, i) => (recorderSystem === 'german' ? GERMAN_OVERRIDES[i] ?? f : f)).forEach((f, i) => notes.push({
      hole: i + 1, dir: 'blow', bend: 0, over: false, slide: false, midi: sounding + i,
      technique: KIND[f.kind], token: midiToName(written + i), fingers: f.fingers, fingerCost: f.cost,
    }));
    layoutCache.set(ck, notes);
    return notes;
  }

  if (isTremolo(type)) {
    const [blowRow, drawRow] = isMinorHarp(type) ? [TREM_MINOR_BLOW, TREM_MINOR_DRAW] : [TREM_BLOW, TREM_DRAW];
    for (let hole = 1; hole <= holeCount(type); hole++) {
      const i = Math.floor((hole - 1) / 2);
      if (tremoloDir(hole) === 'blow') push(hole, 'blow', 0, false, blowRow[i], 'blow');
      else push(hole, 'draw', 0, false, drawRow[i], 'draw');
    }
    layoutCache.set(ck, notes);
    return notes;
  }

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
export const TREM_TOKEN_RE = /^([+-])?(2[0-4]|1[0-9]|[1-9])()$/;
/** sáo dọc: tên nốt viết hoa có quãng tám (F4, Bb4, C#5) — không lẫn với chữ trong lời */
export const RECORDER_TOKEN_RE = /^([A-G])([#b]?)(\d)$/;
/** kalimba: số 1–7, chấm quãng tám ° (hoặc ' *) */
export const KALIMBA_TOKEN_RE = /^([1-7])([°'*˚º·]{0,2})$/;
export { FRET_TOKEN_RE };

function tokenRe(type: HarpType): RegExp {
  return isFretted(type) ? FRET_TOKEN_RE : isKalimba(type) ? KALIMBA_TOKEN_RE : isFingered(type) ? RECORDER_TOKEN_RE : isTremolo(type) ? TREM_TOKEN_RE : isChromatic(type) ? CHROM_TOKEN_RE : TOKEN_RE;
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
  if (isFretted(type)) {
    const p = parseFretToken(t);
    return p ? harpLayout(key, type).find((n) => n.token === fretToken(p.string, p.fret)) ?? null : null;
  }
  if (isKalimba(type)) {
    const k = cleanKalimbaToken(t);
    return harpLayout(key, type).find((n) => n.token === k) ?? null;
  }
  if (isFingered(type)) {
    // khớp theo cao độ viết (Bb4 và A#4 là một nốt)
    const w = nameToMidi(t);
    return harpLayout(key, type).find((n) => nameToMidi(n.token) === w) ?? null;
  }
  const hole = Number(m[2]);
  if (isTremolo(type)) {
    // hướng do số lỗ quyết định; ghi "-" ở lỗ thổi (lẻ) là sai
    if (m[1] === '-' && tremoloDir(hole) === 'blow') return null;
    return harpLayout(key, type).find((n) => n.hole === hole) ?? null;
  }
  const dir: Direction = m[1] === '-' ? 'draw' : 'blow';
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
  fingered: 'Thế thường',
  crossFingered: 'Thế chéo',
  halfHole: 'Bịt nửa lỗ',
  highRegister: 'Quãng cao',
};

/** Độ khó khi chơi một nốt — dùng cho bộ chọn lỗ tối ưu */
export function techniqueCost(n: HarpNote): number {
  if (n.fingerCost !== undefined) return n.fingerCost;
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
    case 'fingered':
      return 0;
    case 'crossFingered':
    case 'highRegister':
      return 1;
    case 'halfHole':
      return 1.5;
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
export function songTonality(harp: HarpKey, position: 1 | 2 | 3 = 1, type?: HarpType): string {
  if (isMinorHarp(type)) return pitchClassName(KEY_OFFSET[harp]) + 'm';
  return positionKey(harp, position) + (position === 3 ? 'm' : '');
}
