/**
 * Chia sẻ bài bằng đường link: cả bài (tab, lời, nhịp, tempo, hợp âm) nén vào phần sau dấu # của link,
 * nên không đi qua máy chủ nào. Người nhận bấm link → app mở bài xem trước → "Thêm vào thư viện".
 */
import { BRAND } from '../appConfig';
import { sanitizeSong } from './db';
import type { Song } from './types';

export const APP_URL = BRAND.url;
/** link dài quá thì một số app nhắn tin cắt mất */
export const MAX_LINK = 16_000;

/** chỉ gửi phần nội dung bài; ghi chú tập, yêu thích, ngày tập là của riêng người gửi */
const SHARED_FIELDS = ['title', 'artist', 'harpKey', 'harpType', 'position', 'songKey', 'chords', 'bpm', 'timeSig', 'pickupBeats', 'style', 'difficulty', 'body', 'tags'] as const;
export type SharedSong = Pick<Song, (typeof SHARED_FIELDS)[number]>;

function pick(song: Song): SharedSong {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_FIELDS) if (song[k] !== undefined) out[k] = song[k];
  return out as SharedSong;
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** "z" + deflate nén (trình duyệt mới), hoặc "j" + JSON thô khi máy không có CompressionStream */
export async function encodeSong(song: Song): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, s: pick(song) }));
  if (typeof CompressionStream !== 'undefined') return `z${b64url(await pipe(raw, new CompressionStream('deflate-raw')))}`;
  return `j${b64url(raw)}`;
}

/** Giải mã link chia sẻ → bài đã kiểm tra từng trường (link có thể do ai cũng gửi được) */
export async function decodeSong(data: string): Promise<Song | null> {
  try {
    const bytes = fromB64url(data.slice(1));
    const raw = data[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : data[0] === 'j' ? bytes : null;
    if (!raw || raw.length > 400_000) return null;
    const obj = JSON.parse(new TextDecoder().decode(raw)) as { v?: number; s?: Record<string, unknown> };
    if (obj?.v !== 1 || !obj.s) return null;
    const s = sanitizeSong({ ...obj.s, id: undefined, source: 'import', favorite: false, notes: undefined, lastPracticedAt: undefined });
    return s;
  } catch {
    return null;
  }
}

export async function shareLink(song: Song): Promise<string> {
  return `${APP_URL}#/shared?d=${await encodeSong(song)}`;
}

/**
 * Mở menu chia sẻ của điện thoại (Zalo, Messenger, email…). Máy tính không có menu chia sẻ → chép link.
 * Trả về điều đã làm để báo cho người dùng.
 */
export async function shareSong(song: Song): Promise<{ status: 'shared' | 'copied' | 'cancelled' | 'too-long' | 'failed'; url: string; text: string }> {
  const url = await shareLink(song);
  const done = (status: 'shared' | 'copied' | 'cancelled' | 'too-long' | 'failed') => ({ status, url, text });
  const title = song.title || `Bài ${BRAND.instrument}`;
  const text = `🎵 ${title}${song.artist ? ` — ${song.artist}` : ''} · tab ${BRAND.instrument}. Bấm link để mở trong ${BRAND.name}:`;
  if (url.length > MAX_LINK) return done('too-long');
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return done('shared');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return done('cancelled');
      // một số trình duyệt có share nhưng từ chối (vd. không do người dùng bấm) → chép link
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return done('copied');
  } catch {
    return done('failed');
  }
}
