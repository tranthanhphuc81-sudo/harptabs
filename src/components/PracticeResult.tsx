import { useEffect, useRef } from 'react';
import type { PracticeRecord, PracticeSummary } from '../lib/practiceScore';
import { t } from '../lib/i18n';

export interface WeakNote { index: number; token: string; lyric?: string; misses: number }

const verdict = (s: number) => (s >= 90 ? t('Xuất sắc!') : s >= 75 ? t('Tốt lắm!') : s >= 50 ? t('Khá rồi, tập thêm chút nữa') : t('Cứ tập chậm từng đoạn nhé'));

/** Kết quả một lượt tập "Chờ nốt" */
export function PracticeResult({ summary, record, newBest, weak, onRetry, onPick, onClose }: {
  summary: PracticeSummary;
  record: PracticeRecord | null;
  newBest: boolean;
  weak: WeakNote[];
  onRetry: () => void;
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal?.(); }, []);
  const { score, done, total, firstTry, avgCents, finished } = summary;
  return (
    <dialog ref={ref} className="sheet practice-result" onClose={onClose} aria-labelledby="pr-title">
      <h2 id="pr-title">{finished ? t('Hoàn thành cả bài') : t('Đã tập {0}/{1} nốt', done, total)}</h2>
      <div className="pr-score" aria-label={t('{0} điểm', score)}>
        <strong>{score}</strong><span>{t('điểm')}</span>
      </div>
      <p className="pr-verdict">
        {verdict(score)}
        {finished && newBest && record && record.times > 1 && <span className="pr-best"> {t('Điểm cao nhất mới!')}</span>}
      </p>
      <dl className="storage-info">
        <div><dt>{t('Thổi đúng ngay')}</dt><dd>{t('{0}% số nốt', Math.round(firstTry * 100))}</dd></div>
        <div><dt>{t('Cao độ')}</dt><dd>{t('lệch trung bình')} {Math.round(avgCents)} cent{avgCents < 12 ? t(' — rất chuẩn') : avgCents > 25 ? t(' — thử giữ hơi đều, miệng ổn định hơn') : ''}</dd></div>
        {record && <div><dt>{t('Bài này')}</dt><dd>{t('cao nhất {0} điểm · đã tập hết {1} lần', record.best, record.times)}</dd></div>}
        {!finished && <div><dt>{t('Lưu ý')}</dt><dd className="muted">{t('Chỉ lượt tập hết bài mới được ghi điểm.')}</dd></div>}
      </dl>
      {weak.length > 0 && (
        <div>
          <p className="field-label">{t('Nốt hay lạc — chạm để tập lại từ đó')}</p>
          <div className="row gap wrap">
            {weak.map((w) => (
              <button key={w.index} type="button" className="chip" onClick={() => onPick(w.index)}>
                <strong>{w.token}</strong>{w.lyric ? ` “${w.lyric}”` : ''} <span className="muted">{t('· lạc {0} lần', w.misses)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>{t('Đóng')}</button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>{t('Tập lại từ đầu')}</button>
      </div>
    </dialog>
  );
}
