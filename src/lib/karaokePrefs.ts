/** Cài đặt karaoke riêng từng bài (tông cho người hát, cách hiện số lỗ) — kv `karaoke:<id>`, không đưa vào sao lưu */
import { db } from './db';

/**
 * Số lỗ kèn trên màn hình lời khi đã đổi tông:
 *  - 'same'   giữ nguyên số lỗ, thổi bằng kèn cao / thấp hơn tương ứng (cùng lỗ ra đúng giai điệu đã đổi tông)
 *  - 'myHarp' xếp lại số lỗ cho cây kèn đang xem
 *  - 'hide'   chỉ hiện lời
 */
export type KaraokeHoles = 'same' | 'myHarp' | 'hide';

export interface KaraokePrefs {
  /** nửa cung, -6..+6 */
  transpose: number;
  holes: KaraokeHoles;
  chords: boolean;
  /** đang đeo tai nghe: tắt khử tiếng vọng để micro thu giọng tốt hơn (không đeo thì micro nghe cả nhạc đệm từ loa) */
  headphones: boolean;
}

export const DEFAULT_KARAOKE: KaraokePrefs = { transpose: 0, holes: 'same', chords: true, headphones: false };
export const MAX_TRANSPOSE = 6;

const key = (songId: string) => `karaoke:${songId}`;

export async function loadKaraokePrefs(songId: string): Promise<KaraokePrefs> {
  const v = (await db.kv.get(key(songId)))?.value as Partial<KaraokePrefs> | undefined;
  const t = Number(v?.transpose);
  return {
    transpose: Number.isFinite(t) ? Math.max(-MAX_TRANSPOSE, Math.min(MAX_TRANSPOSE, Math.round(t))) : 0,
    holes: v?.holes === 'myHarp' || v?.holes === 'hide' ? v.holes : 'same',
    chords: v?.chords !== false,
    headphones: v?.headphones === true,
  };
}

export async function saveKaraokePrefs(songId: string, p: KaraokePrefs): Promise<void> {
  await db.kv.put({ key: key(songId), value: p });
}
