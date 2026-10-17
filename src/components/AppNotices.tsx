import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../lib/db';
import { backupStatus, downloadBackup, loadBackupMeta, snoozeBackup } from '../lib/backup';
import { applyUpdate, useUpdateReady } from '../lib/swUpdate';
import { useAppState } from '../state';

/** Có bản mới của app: người dùng tự bấm cập nhật khi đã lưu xong, không tự tải lại giữa chừng */
export function UpdateNotice() {
  const ready = useUpdateReady();
  const [later, setLater] = useState(false);
  if (!ready || later) return null;
  return (
    <div className="notice" role="status">
      <span>Có bản mới của app. Lưu bài đang sửa (nếu có) rồi bấm cập nhật.</span>
      <span className="row gap">
        <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>Cập nhật</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLater(true)}>Để sau</button>
      </span>
    </div>
  );
}

/** Nhắc xuất file sao lưu khi có nhiều bài mới / sửa, hoặc lâu rồi chưa sao lưu */
export function BackupNotice() {
  const { toast } = useAppState();
  const status = useLiveQuery(async () => {
    const [songs, meta] = await Promise.all([db.songs.toArray(), loadBackupMeta()]);
    return backupStatus(songs, meta.lastBackupAt, meta.snoozeUntil);
  }, []);
  if (!status?.due) return null;
  return (
    <div className="notice" role="status">
      <span>
        {status.changed} bài mới hoặc đã sửa {status.lastBackupAt ? `từ lần sao lưu ngày ${new Date(status.lastBackupAt).toLocaleDateString('vi-VN')}` : 'chưa từng được sao lưu'}.
        {' '}Bài chỉ nằm trên máy này, nên xuất file sao lưu để khỏi mất.
      </span>
      <span className="row gap">
        <button type="button" className="btn btn-primary btn-sm" onClick={async () => toast(`Đã xuất ${await downloadBackup()} bài`)}>Sao lưu ngay</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void snoozeBackup()}>Nhắc sau</button>
      </span>
    </div>
  );
}
