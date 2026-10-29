import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { IS_GUITAR_APP, IS_KALIMBA_APP, IS_TRANH_APP } from '../appConfig';
import { db } from '../lib/db';
import { isDanBau } from '../lib/harp';
import {
  Activity, ACTIVITY_LABEL, activityTotals, bestStreak, DEFAULT_GOAL_MIN, lastDays, loadLog, Metric, metricValue, METRICS, onLogChange, setGoal, streak,
} from '../lib/practiceLog';
import { useAppState } from '../state';

/**
 * Nhật ký luyện tập: hôm nay tập bao nhiêu phút so với mục tiêu, chuỗi ngày tập liền, biểu đồ 7 ngày,
 * thời gian từng hoạt động, kết quả các bài tập (tuần này so với tuần trước) và bài tập gợi ý cho hôm nay.
 */
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const fmtMin = (secs: number) => (secs < 60 ? `${Math.round(secs)} giây` : `${Math.round(secs / 60)} phút`);

interface PlanItem { to: string; label: string; act: Activity; min: number; why: string }

export default function PracticeLog() {
  const { settings } = useAppState();
  const [log, setLog] = useState(loadLog);
  useEffect(() => onLogChange(() => setLog(loadLog())), []);
  const recent = useLiveQuery(() => db.songs.orderBy('lastPracticedAt').reverse().first(), []);

  const today = new Date();
  const goal = log.goalMin ?? DEFAULT_GOAL_MIN;
  const days = lastDays(log, today, 7);
  const prev = lastDays(log, new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7), 7);
  const todayLog = log.days[days[6].key];
  const todaySecs = todayLog?.secs ?? 0;
  const st = streak(log, today);
  const best = bestStreak(log);
  const maxBar = Math.max(goal * 60, ...days.map((d) => d.secs));
  const week = activityTotals(log, days.map((d) => d.key));
  const weekSecs = days.reduce((a, d) => a + d.secs, 0);

  // bài tập gợi ý hôm nay: khởi động theo nhạc cụ, nghe – đáp, bài đang tập
  const plan: PlanItem[] = [];
  if (IS_GUITAR_APP) plan.push({ to: '/tap-hop-am', label: 'Khởi động: bấm hợp âm sạch', act: 'hop-am', min: 3, why: 'Quạt từng hợp âm của bài đang tập cho tới khi sạch.' });
  else if (IS_TRANH_APP) plan.push(isDanBau(settings.defaultHarpType)
    ? { to: '/tap-boi-am', label: 'Khởi động: bồi âm, nắn cần', act: 'boi-am', min: 3, why: 'Mỗi điểm bồi vài lần, rồi nắn cần vài nốt.' }
    : { to: '/tap-cao-do?mode=bend', label: 'Khởi động: tập nhấn', act: 'cao-do', min: 3, why: 'Nhấn Fa, Si cho tới khi vào vùng xanh.' });
  else if (!IS_KALIMBA_APP) plan.push({ to: '/tap-cao-do?mode=hold', label: 'Khởi động: giữ nốt dài', act: 'cao-do', min: 3, why: '5 nốt, mỗi nốt giữ 4 giây cho thật đều.' });
  plan.push({ to: '/nghe-dap', label: 'Nghe – đáp', act: 'nghe-dap', min: 3, why: 'Luyện tai và thuộc vị trí nốt.' });
  plan.push(recent?.lastPracticedAt
    ? { to: `/song/${recent.id}`, label: `Bài đang tập: ${recent.title}`, act: 'bai-hat', min: IS_KALIMBA_APP ? 7 : 5, why: 'Chơi theo, chậm lại ở đoạn khó.' }
    : { to: '/', label: 'Chọn một bài và chơi theo', act: 'bai-hat', min: IS_KALIMBA_APP ? 7 : 5, why: 'Bài ngắn, quen thuộc là dễ vào nhất.' });

  const metrics = (Object.keys(METRICS) as Metric[])
    .map((m) => ({ m, now: metricValue(log, m, days.map((d) => d.key)), before: metricValue(log, m, prev.map((d) => d.key)) }))
    .filter((x) => x.now !== null || x.before !== null);
  const fmtMetric = (m: Metric, v: number | null) => {
    if (v === null) return '–';
    const def = METRICS[m];
    return def.kind === 'rate' ? `${v}%` : `${v} ${'unit' in def ? def.unit : ''}`;
  };

  return (
    <div className="page practice-log">
      <header className="page-head">
        <div>
          <h1>Nhật ký luyện tập</h1>
          <p className="muted">App tự ghi thời gian khi bạn chơi theo bài, ngẫu hứng hoặc dùng các trang tập có micro, cùng kết quả từng bài tập. Nhật ký lưu trong máy này.</p>
        </div>
      </header>

      <section className="pl-today">
        <div className="pl-big">
          <strong>{fmtMin(todaySecs)}</strong>
          <span>hôm nay / mục tiêu {goal} phút</span>
          <div className="pp-bar"><span className={todaySecs >= goal * 60 ? 'full' : ''} style={{ width: `${Math.min(100, (100 * todaySecs) / (goal * 60))}%` }} /></div>
        </div>
        <div className="pl-big">
          <strong>{st} ngày</strong>
          <span>tập liền{best > st ? ` · dài nhất ${best} ngày` : ''}</span>
          {st > 0 && todaySecs < 60 && <span className="small muted">Tập hôm nay để giữ chuỗi!</span>}
        </div>
      </section>

      <section className="card">
        <h2>Bài tập hôm nay</h2>
        <ol className="pl-plan">
          {plan.map((x) => {
            const done = (todayLog?.by[x.act] ?? 0) >= x.min * 60;
            return (
              <li key={x.to + x.label} className={done ? 'done' : ''}>
                <Link to={x.to}><strong>{done ? '✓ ' : ''}{x.label}</strong></Link>
                <span className="small muted"> · {x.min} phút. {x.why}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card">
        <h2>7 ngày qua</h2>
        <div className="pl-chart" role="img" aria-label={`Số phút tập 7 ngày qua: ${days.map((d) => Math.round(d.secs / 60)).join(', ')}`}>
          {days.map((d, i) => (
            <div key={d.key} className={`pl-col${i === 6 ? ' today' : ''}`}>
              <small>{d.secs >= 60 ? Math.round(d.secs / 60) : ''}</small>
              <div className="pl-track">
                <i className="pl-goal" style={{ bottom: `${(100 * goal * 60) / maxBar}%` }} />
                <span className={`pl-bar${d.secs >= goal * 60 ? ' met' : ''}`} style={{ height: `${(100 * d.secs) / maxBar}%` }} />
              </div>
              <small>{WEEKDAY[d.date.getDay()]}</small>
            </div>
          ))}
        </div>
        <p className="small muted">Tổng tuần: <strong>{fmtMin(weekSecs)}</strong>. Vạch ngang là mục tiêu mỗi ngày; cột xanh là ngày đạt mục tiêu.</p>
        {Object.keys(week).length > 0 && (
          <ul className="pl-acts">
            {(Object.entries(week) as [Activity, number][]).sort((a, b) => b[1] - a[1]).map(([a, s]) => <li key={a}><span>{ACTIVITY_LABEL[a]}</span><strong>{fmtMin(s)}</strong></li>)}
          </ul>
        )}
      </section>

      {metrics.length > 0 && (
        <section className="card">
          <h2>Kết quả bài tập</h2>
          <table className="pl-metrics">
            <thead><tr><th /><th>7 ngày qua</th><th>7 ngày trước</th></tr></thead>
            <tbody>
              {metrics.map(({ m, now, before }) => {
                const up = now !== null && before !== null && now > before;
                const down = now !== null && before !== null && now < before;
                return (
                  <tr key={m}>
                    <td>{METRICS[m].label}</td>
                    <td><strong>{fmtMetric(m, now)}</strong>{up && <span className="pl-up"> ↑</span>}{down && <span className="pl-down"> ↓</span>}</td>
                    <td className="muted">{fmtMetric(m, before)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <div className="row gap wrap end-align">
        <label className="field" htmlFor="pl-goal">
          <span className="field-label">Mục tiêu mỗi ngày</span>
          <select id="pl-goal" value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
            {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} phút</option>)}
          </select>
        </label>
      </div>
      <p className="small muted">Mẹo: tập ngắn mà đều mỗi ngày hiệu quả hơn tập dồn một buổi dài. Chỉ tính giờ khi đang phát nhạc hoặc đang bật micro ở trang tập; tập dưới 1 phút trong ngày không tính vào chuỗi.</p>
    </div>
  );
}
