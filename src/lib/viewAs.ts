/**
 * "Xem cho kèn": hiện một bài trên loại kèn / tông khác mà KHÔNG sửa bài gốc.
 * Bộ chọn lỗ tối ưu xếp lại tab; giọng bài và hợp âm dịch theo nếu phải đổi giọng.
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody, TabFit } from './converter';
import { HARP_KEYS, HARP_TYPES, HarpKey, HarpType, harpTypeOf, songTonality } from './harp';
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
  const tonality = song.songKey || songTonality(song.harpKey, song.position);
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

// ----- nhớ lựa chọn trên máy này (tiện lợi, không cần đồng bộ) -----

const KEY = 'harptabs.viewAs';

export function loadViewAs(): ViewAs | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as ViewAs | null;
    if (v && HARP_TYPES.includes(v.type) && (HARP_KEYS as readonly string[]).includes(v.key) && (v.mode === 'any' || v.mode === 'octave')) return v;
  } catch { /* chế độ riêng tư */ }
  return null;
}

export function saveViewAs(v: ViewAs | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch { /* chế độ riêng tư */ }
}
