/**
 * Dịch nội dung dài (bài học, lick, ghi chú bài mẫu). Từ điển khoá bằng mã băm của câu tiếng Việt (src/data/en/dataEn.ts,
 * sinh bằng scripts/i18n-data.mjs) cho gọn. Câu gốc bị sửa thì mã đổi → hiện nguyên tiếng Việt, không bao giờ hiện sai bài.
 */
import { LANG } from './i18n';
import { EN_DATA } from '../data/en/dataEn';

/** cyrb53 — giống hệt bản trong scripts/i18n-data.mjs */
export function textHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** dịch một đoạn nội dung; không có bản dịch thì trả nguyên */
export function tl(s: string): string;
export function tl(s: string | undefined): string | undefined;
export function tl(s: string | undefined): string | undefined {
  if (LANG !== 'en' || !s) return s;
  const hit = EN_DATA[textHash(s.trim())];
  if (hit !== undefined) return hit;
  // tên bài mẫu sinh tự động: "<tên> (đàn bầu)"
  const m = /^(.*) \(đàn bầu\)$/.exec(s);
  if (m) return `${tl(m[1])} (dan bau)`;
  return s;
}

/** bài mẫu đọc từ máy: dịch tên / tác giả / ghi chú nếu người dùng chưa sửa */
export function localizeSample<T extends { source?: string; title: string; artist?: string; notes?: string }>(song: T): T {
  if (LANG !== 'en' || song.source !== 'sample') return song;
  return { ...song, title: tl(song.title), artist: tl(song.artist), notes: tl(song.notes) };
}

/** lick: dịch tên và mẹo */
export function localizeLick<T extends { title: string; tip?: string }>(l: T): T {
  if (LANG !== 'en') return l;
  return { ...l, title: tl(l.title), tip: tl(l.tip) };
}
