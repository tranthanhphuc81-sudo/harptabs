/** Nhạc nền MP3 của bài (karaoke): lưu, đọc, xoá, giới hạn, kiểm tra tab đã sửa sau khi đồng bộ */
import { db } from './db';
import { hasRoom, StorageFullError } from './recordings';
import type { FlatEvent } from './tabText';
import type { TempoMap } from './tempoMap';
import type { Backing } from './types';

export const MAX_BACKING_MB = 20;
export const MAX_BACKING_MIN = 8;

/** dấu vân tay tab: số nốt, tổng phách, cao độ — đổi là bản đồ nhịp cũ không còn đúng */
export function tabSig(flat: FlatEvent[]): string {
  let h = 0;
  for (const f of flat) h = (Math.imul(h, 31) + (f.midi ?? -1) * 7 + Math.round(f.beats * 100)) | 0;
  const last = flat[flat.length - 1];
  return `${flat.length}:${last ? +(last.start + last.beats).toFixed(3) : 0}:${(h >>> 0).toString(36)}`;
}

export function checkBackingFile(file: { size: number; type: string; name: string }): string | null {
  if (file.size > MAX_BACKING_MB * 1e6) return `File quá lớn (tối đa ${MAX_BACKING_MB} MB)`;
  if (file.type && !file.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(file.name)) return 'Chỉ nhận file âm thanh (mp3, m4a, wav, ogg…)';
  return null;
}

export async function loadBacking(songId: string): Promise<Backing | null> {
  return (await db.backings.get(songId)) ?? null;
}

export async function saveBacking(b: Omit<Backing, 'size' | 'createdAt'> & { createdAt?: number }): Promise<void> {
  const old = await db.backings.get(b.songId);
  const extra = b.blob.size - (old && old.blob === b.blob ? b.blob.size : 0);
  if (extra > 0 && !(await hasRoom(extra))) throw new StorageFullError();
  try {
    await db.backings.put({ ...b, size: b.blob.size, createdAt: b.createdAt ?? Date.now() });
  } catch (e) {
    if ((e as Error).name === 'QuotaExceededError') throw new StorageFullError();
    throw e;
  }
}

/** cập nhật bản đồ nhịp / chỉnh lệch, giữ nguyên file */
export async function updateBackingSync(songId: string, patch: Partial<Pick<Backing, 'points' | 'spb' | 'offsetMs' | 'source' | 'confidence' | 'tabSig' | 'keyOffset'>>): Promise<void> {
  await db.backings.update(songId, patch);
}

export async function deleteBacking(songId: string): Promise<void> {
  await db.backings.delete(songId);
}

export const mapOf = (b: Pick<Backing, 'points' | 'spb'>): TempoMap => ({ points: b.points, spb: b.spb });
