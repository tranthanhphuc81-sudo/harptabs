/**
 * "Xem cho kèn": hiện một bài trên loại kèn / tông khác mà KHÔNG sửa bài gốc.
 * Bộ chọn lỗ tối ưu xếp lại tab; giọng bài và hợp âm dịch theo nếu phải đổi giọng.
 */
import { transposeChords } from '../audio/harmony';
import { fitToHarp, midisOf, rekeyBody, TabFit } from './converter';
import { HARP_KEYS, HARP_TYPES, HarpKey, HarpType, harpTypeOf, isRecorder, recorderKey, songTonality } from './harp';
import { parseTab } from './tabText';
import type { Song } from './types';

export interface ViewAs {
  type: HarpType;
  key: HarpKey;
  /** 'any' = dịch giọng cho dễ thổi nhất; 'octave' = giữ đúng giọng gốc */
  mode: 'any' | 'octave';
}

export interface SongView {
  /** bài để hiển thị / phát (bài gốc, hoặc bản đã xếp lại cho kèn đang xem) */
  song: Song;
  /** null = đang xem bản gốc */
  fit: TabFit | null;
}

/** bài gốc đã viết cho đúng kèn này thì không cần xếp lại */
export function isOriginal(song: Song, v: ViewAs | null): boolean {
  return !v || (v.type === harpTypeOf(song) && v.key === song.harpKey);
}

export function viewSong(song: Song, v: ViewAs | null): SongView {
  if (!v || isOriginal(song, v)) return { song, fit: null };
  let { body, fit } = rekeyBody(song.body, song.harpKey, v.key, v.mode, harpTypeOf(song), v.type);
  if (v.mode === 'any') {
    // "dễ thổi nhất" chỉ dịch giọng khi thật sự đỡ khó (bớt nốt không có, bend, bấm gạt) — đỡ di chuyển tay chút ít thì giữ giọng gốc
    const keep = rekeyBody(song.body, song.harpKey, v.key, 'octave', harpTypeOf(song), v.type);
    const hard = (f: TabFit) => [f.stats.unplayable, f.stats.overblows, f.stats.bends, f.stats.slides];
    const [a, b] = [hard(keep.fit), hard(fit)];
    if (a.every((x, i) => x <= b[i])) ({ body, fit } = keep);
  }
  const shifted = fit.shift % 12 !== 0;
  // giọng bài: dịch theo số nửa cung đã đổi (để đệm hợp âm đúng giọng)
  const tonality = song.songKey || songTonality(song.harpKey, song.position, harpTypeOf(song));
  const songKey = shifted ? transposeChords({ 0: tonality }, fit.shift)?.['0'] ?? undefined : song.songKey;
  return {
    song: {
      ...song,
      body,
      harpKey: v.key,
      harpType: v.type === 'diatonic' ? undefined : v.type,
      // kèn khác diatonic chỉ chơi vị trí 1
      position: v.type === 'diatonic' && harpTypeOf(song) === 'diatonic' ? song.position : 1,
      songKey,
      chords: transposeChords(song.chords, fit.shift),
    },
    fit,
  };
}

/** hợp âm chọn tay khi đang xem bản đã dịch giọng: dịch ngược về giọng gốc trước khi lưu vào bài */
export function chordForOriginal(name: string, fit: TabFit | null): string {
  if (!fit || fit.shift % 12 === 0) return name;
  return transposeChords({ 0: name }, -fit.shift)?.['0'] ?? name;
}

// ----- tự chọn kèn hợp nhất cho từng bài -----

/** độ khó của một cách xếp tab: nốt không có > overblow > bend > bấm gạt */
const hardness = (f: TabFit) => f.stats.unplayable * 1000 + f.stats.overblows * 100 + f.stats.bends * 10 + f.stats.slides;

/** ngang độ khó thì ưu tiên kèn của bài, rồi kèn phổ biến hơn */
const TYPE_ORDER: HarpType[] = ['diatonic', 'chromatic', 'tremolo24', 'chromatic16', 'tremolo21'];

export interface BestHarp {
  view: ViewAs;
  /** độ khó (cùng thang với hardness) của bản gốc và của kèn được chọn */
  originalFit: TabFit;
  fit: TabFit;
}

const bestCache = new Map<string, BestHarp>();

/** so sánh từng phần tử từ trái sang: phần tử khác nhau đầu tiên quyết định */
function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/**
 * Kèn (loại + tông) chơi bài dễ nhất mà vẫn giữ đúng giọng bài.
 * Thứ tự ưu tiên: ít nốt không có / overblow / bend / bấm gạt → kèn của bài → kèn phổ biến → tông gốc, rồi kèn C → ít di chuyển.
 */
export function bestHarp(song: Song): BestHarp {
  const origType = harpTypeOf(song);
  const ck = `${origType}|${song.harpKey}|${song.body}`;
  const hit = bestCache.get(ck);
  if (hit) return hit;
  const midis = midisOf(parseTab(song.body, song.harpKey, origType));
  // bài sáo dọc: chỉ so sáo alto / soprano (mỗi loại một tông); bài kèn: các loại kèn
  const order: HarpType[] = isRecorder(origType) ? ['recorderAlto', 'recorderSoprano', 'recorderTenor', 'recorderBass'] : TYPE_ORDER;
  const types = [origType, ...order.filter((t) => t !== origType)];
  const originalFit = fitToHarp(midis, song.harpKey, { transpose: 'octave', type: origType });
  let best: { score: number[]; view: ViewAs; fit: TabFit } | null = null;
  types.forEach((type, ti) => {
    for (const key of isRecorder(type) ? [recorderKey(type)] : HARP_KEYS) {
      const fit = type === origType && key === song.harpKey ? originalFit : fitToHarp(midis, key, { transpose: 'octave', type });
      const keyRank = type === origType && key === song.harpKey ? 0 : key === 'C' ? 1 : 2;
      // kèn tông lạ (không phải tông của bài, không phải C) ít người có sẵn: chỉ chọn khi đỡ khó rõ rệt
      // (bớt được bend / nốt thiếu), không chỉ để bớt vài nốt bấm gạt
      const score = [hardness(fit) + (keyRank === 2 ? 5 : 0), ti, keyRank, fit.cost];
      if (!best || lexLess(score, best.score)) best = { score, view: { type, key, mode: 'octave' }, fit };
    }
  });
  const out = { view: best!.view, fit: best!.fit, originalFit };
  if (bestCache.size > 200) bestCache.clear();
  bestCache.set(ck, out);
  return out;
}

export const hardnessOf = hardness;

// ----- nhớ lựa chọn trên máy này (tiện lợi, không cần đồng bộ) -----

/** 'auto' = tự chọn kèn hợp nhất cho từng bài (mặc định); 'original' = bản gốc; còn lại = kèn chọn tay */
export type ViewChoice = 'auto' | 'original' | ViewAs;

// khoá mới: ai đã chọn kèn ở bản trước cũng bắt đầu lại từ "tự chọn"
const KEY = 'harptabs.viewChoice';

export function loadViewChoice(): ViewChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '"auto"') as ViewChoice;
    if (v === 'auto' || v === 'original') return v;
    if (v && HARP_TYPES.includes(v.type) && (HARP_KEYS as readonly string[]).includes(v.key) && (v.mode === 'any' || v.mode === 'octave')) return v;
  } catch { /* chế độ riêng tư */ }
  return 'auto';
}

export function saveViewChoice(v: ViewChoice) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* chế độ riêng tư */ }
}

/** lựa chọn → kèn cụ thể để xem bài này */
export function resolveChoice(song: Song, c: ViewChoice): ViewAs | null {
  if (c === 'original') return null;
  if (c === 'auto') return bestHarp(song).view;
  return c;
}
