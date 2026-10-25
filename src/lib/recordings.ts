/** Bản thu karaoke trên máy: thêm, liệt kê, xoá, dung lượng */
import { db } from './db';
import type { Recording } from './types';

/** tối đa mỗi bản thu (phút) — 64 kbps ≈ 0,5 MB / phút */
export const MAX_RECORD_MIN = 10;

export class StorageFullError extends Error {
  constructor() { super('Máy hết chỗ lưu bản thu — xoá bớt bản thu cũ trong Cài đặt → Dữ liệu'); }
}

/** còn đủ chỗ lưu `bytes` không (chừa gấp đôi cho an toàn); trình duyệt không cho biết thì coi là đủ */
export async function hasRoom(bytes: number): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota || est.usage === undefined) return true;
    return est.quota - est.usage > bytes * 2;
  } catch { return true; }
}

export async function addRecording(r: Omit<Recording, 'id' | 'size'>): Promise<number> {
  const size = r.blob.size;
  if (!(await hasRoom(size))) throw new StorageFullError();
  try {
    return await db.recordings.add({ ...r, size });
  } catch (e) {
    if ((e as Error).name === 'QuotaExceededError') throw new StorageFullError();
    throw e;
  }
}

/** bản thu của một bài, mới nhất trước */
export async function listRecordings(songId: string): Promise<Recording[]> {
  const rows = await db.recordings.where('songId').equals(songId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRecording(id: number): Promise<void> {
  await db.recordings.delete(id);
}

export async function updateRecording(id: number, patch: Partial<Pick<Recording, 'voiceLagMs' | 'title'>>): Promise<void> {
  await db.recordings.update(id, patch);
}

/** tổng số bản thu và dung lượng (byte) */
export async function recordingsTotal(): Promise<{ count: number; bytes: number }> {
  let count = 0, bytes = 0;
  await db.recordings.each((r) => { count++; bytes += r.size || 0; });
  return { count, bytes };
}

export async function deleteAllRecordings(): Promise<void> {
  await db.recordings.clear();
}
