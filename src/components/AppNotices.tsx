import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '../lib/db';
import { backupStatus, downloadBackup, loadBackupMeta, snoozeBackup } from '../lib/backup';
import { applyUpdate, useUpdateReady } from '../lib/swUpdate';
import { useAppState } from '../state';
import { LOCALE, t } from '../lib/i18n';

/** Có bản mới của app: người dùng tự bấm cập nhật khi đã lưu xong, không tự tải lại giữa chừng */
export function UpdateNotice() {
  const ready = useUpdateReady();
  const [later, setLater] = useState(false);
  if (!ready || later) return null;
  return (
    <div className="notice update-notice" role="status">
      <span>{t('Có bản mới của app. Lưu bài đang sửa (nếu có) rồi bấm cập nhật.')}</span>
      <span className="row gap">
        <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>{t('Cập nhật')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLater(true)}>{t('Để sau')}</button>
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
        {status.changed} {t('bài mới hoặc đã sửa')} {status.lastBackupAt ? t('từ lần sao lưu ngày {0}', new Date(status.lastBackupAt).toLocaleDateString(LOCALE)) : t('chưa từng được sao lưu')}.
        {' '}{t('Bài chỉ nằm trên máy này, nên xuất file sao lưu để khỏi mất.')}
      </span>
      <span className="row gap">
        <button type="button" className="btn btn-primary btn-sm" onClick={async () => toast(t('Đã xuất {0} bài', await downloadBackup()))}>{t('Sao lưu ngay')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void snoozeBackup()}>{t('Nhắc sau')}</button>
      </span>
    </div>
  );
}
