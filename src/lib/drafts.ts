/**
 * Bản nháp tự lưu (bài đang sửa) trong IndexedDB — còn nguyên khi tắt app, tải lại trang hay cập nhật bản mới.
 * Ảnh quét dở lưu riêng ở bảng scans (xem scanStore.ts).
 */
import { db } from './db';
import type { Song } from './types';

export interface SongDraft {
  song: Song;
  tagText: string;
  savedAt: number;
  /** updatedAt của bài lúc bắt đầu sửa: bài đã được lưu ở chỗ khác sau đó thì nháp đã cũ */
  baseUpdatedAt?: number;
}

const keyOf = (songId?: string) => `draft:${songId ?? 'new'}`;

export async function loadDraft(songId?: string): Promise<SongDraft | null> {
  const row = await db.kv.get(keyOf(songId));
  return (row?.value as SongDraft | undefined) ?? null;
}

export async function saveDraft(songId: string | undefined, d: SongDraft): Promise<void> {
  await db.kv.put({ key: keyOf(songId), value: d });
}

export async function clearDraft(songId?: string): Promise<void> {
  await db.kv.delete(keyOf(songId));
}

/** Khoá bản quét dở trong bảng scans: quét mới, hoặc sửa lại ảnh quét của một bài */
export const scanDraftId = (songId?: string) => (songId ? `draft:scan:${songId}` : 'draft:scan');
