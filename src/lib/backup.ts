/** Nhắc sao lưu: mọi bài chỉ nằm trên máy, xoá dữ liệu trình duyệt là mất */
import { db, downloadJson, exportAll } from './db';
import type { Song } from './types';

const DAY = 24 * 60 * 60 * 1000;
/** số bài thay đổi chưa sao lưu thì nhắc ngay */
export const REMIND_AFTER_CHANGES = 10;
/** có thay đổi chưa sao lưu quá ngần này ngày thì nhắc */
export const REMIND_AFTER_DAYS = 30;
const SNOOZE_DAYS = 7;

/** Bài người dùng đã thêm / sửa (bài mẫu chưa động tới không tính) */
const touched = (s: Song) => s.source !== 'sample' || s.updatedAt > s.createdAt + 1000;

export interface BackupStatus {
  /** số bài thêm / sửa sau lần sao lưu gần nhất */
  changed: number;
  lastBackupAt: number | null;
  due: boolean;
}

export function backupStatus(songs: Song[], lastBackupAt: number | null, snoozeUntil: number | null, now = Date.now()): BackupStatus {
  const pending = songs.filter((s) => touched(s) && s.updatedAt > (lastBackupAt ?? 0));
  const oldest = pending.reduce((m, s) => Math.min(m, s.updatedAt), Infinity);
  const due = pending.length > 0
    && !(snoozeUntil && now < snoozeUntil)
    && (pending.length >= REMIND_AFTER_CHANGES || now - oldest > REMIND_AFTER_DAYS * DAY);
  return { changed: pending.length, lastBackupAt, due };
}

export async function loadBackupMeta(): Promise<{ lastBackupAt: number | null; snoozeUntil: number | null }> {
  const [a, b] = await Promise.all([db.kv.get('lastBackupAt'), db.kv.get('backupSnoozeUntil')]);
  return { lastBackupAt: (a?.value as number | undefined) ?? null, snoozeUntil: (b?.value as number | undefined) ?? null };
}

export async function markBackedUp(at = Date.now()): Promise<void> {
  await db.kv.bulkPut([{ key: 'lastBackupAt', value: at }, { key: 'backupSnoozeUntil', value: null }]);
}

export async function snoozeBackup(now = Date.now()): Promise<void> {
  await db.kv.put({ key: 'backupSnoozeUntil', value: now + SNOOZE_DAYS * DAY });
}

/** Tải file sao lưu toàn bộ bài về máy và ghi nhận thời điểm sao lưu. Trả về số bài. */
export async function downloadBackup(): Promise<number> {
  const data = await exportAll();
  downloadJson(data, `harptabs-sao-luu-${new Date().toISOString().slice(0, 10)}.json`);
  await markBackedUp();
  return data.songs.length;
}
