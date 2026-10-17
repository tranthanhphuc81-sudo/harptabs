import { useEffect, useRef } from 'react';
import type { PracticeRecord, PracticeSummary } from '../lib/practiceScore';

export interface WeakNote { index: number; token: string; lyric?: string; misses: number }

const verdict = (s: number) => (s >= 90 ? 'Xuất sắc!' : s >= 75 ? 'Tốt lắm!' : s >= 50 ? 'Khá rồi, tập thêm chút nữa' : 'Cứ tập chậm từng đoạn nhé');

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
      <h2 id="pr-title">{finished ? 'Hoàn thành cả bài' : `Đã tập ${done}/${total} nốt`}</h2>
      <div className="pr-score" aria-label={`${score} điểm`}>
        <strong>{score}</strong><span>điểm</span>
      </div>
      <p className="pr-verdict">
        {verdict(score)}
        {finished && newBest && record && record.times > 1 && <span className="pr-best"> Điểm cao nhất mới!</span>}
      </p>
      <dl className="storage-info">
        <div><dt>Thổi đúng ngay</dt><dd>{Math.round(firstTry * 100)}% số nốt</dd></div>
        <div><dt>Cao độ</dt><dd>lệch trung bình {Math.round(avgCents)} cent{avgCents < 12 ? ' — rất chuẩn' : avgCents > 25 ? ' — thử giữ hơi đều, miệng ổn định hơn' : ''}</dd></div>
        {record && <div><dt>Bài này</dt><dd>cao nhất {record.best} điểm · đã tập hết {record.times} lần</dd></div>}
        {!finished && <div><dt>Lưu ý</dt><dd className="muted">Chỉ lượt tập hết bài mới được ghi điểm.</dd></div>}
      </dl>
      {weak.length > 0 && (
        <div>
          <p className="field-label">Nốt hay lạc — chạm để tập lại từ đó</p>
          <div className="row gap wrap">
            {weak.map((w) => (
              <button key={w.index} type="button" className="chip" onClick={() => onPick(w.index)}>
                <strong>{w.token}</strong>{w.lyric ? ` “${w.lyric}”` : ''} <span className="muted">· lạc {w.misses} lần</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Đóng</button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>Tập lại từ đầu</button>
      </div>
    </dialog>
  );
}
