/** Sắp xếp bài hát theo tên, đúng thứ tự chữ tiếng Việt (a < á < ă …, d < đ, "Bài 2" < "Bài 10"). */
import type { Song } from './types';

const collator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });

/** So tên A→Z (dir = -1 cho Z→A); bài chưa đặt tên luôn nằm cuối, trùng tên thì xét tác giả. */
export function compareTitle(a: Pick<Song, 'title' | 'artist'>, b: Pick<Song, 'title' | 'artist'>, dir: 1 | -1 = 1): number {
  const ta = a.title.trim(), tb = b.title.trim();
  if (!ta || !tb) return ta ? -1 : tb ? 1 : 0;
  return dir * (collator.compare(ta, tb) || collator.compare(a.artist ?? '', b.artist ?? ''));
}
