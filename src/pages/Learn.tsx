import { BRAND, IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP, IS_PIANICA_APP, IS_TRANH_APP } from '../appConfig';
import { useEffect, useState } from 'react';
import { dayKey, DEFAULT_GOAL_MIN, loadLog, onLogChange, streak } from '../lib/practiceLog';
import { Fragment, ReactNode, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Block, LESSON_GROUPS, LESSONS } from '../data/lessons';
import { HARP_KEYS, harpName, positionKey } from '../lib/harp';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { HarpDiagram } from '../components/HarpDiagram';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/** **đậm** và `mã` trong nội dung bài học */
function rich(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** thẻ nhật ký: hôm nay tập bao nhiêu, chuỗi ngày tập liền */
function LogCard() {
  const [log, setLog] = useState(loadLog);
  useEffect(() => onLogChange(() => setLog(loadLog())), []);
  const today = new Date();
  const mins = Math.round((log.days[dayKey(today)]?.secs ?? 0) / 60);
  const st = streak(log, today);
  return (
    <Link to="/nhat-ky" className="jam-card log-card">
      <strong>Nhật ký luyện tập</strong>
      <span>Hôm nay {mins} / {log.goalMin ?? DEFAULT_GOAL_MIN} phút{st ? ` · ${st} ngày tập liền` : ''}. Xem bài tập gợi ý cho hôm nay và tiến bộ từng tuần.</span>
    </Link>
  );
}

export default function Learn() {
  return (
    <div className="page page-learn">
      <header className="page-head">
        <div>
          <h1>Học {BRAND.verb} {BRAND.instrument}</h1>
          <p className="muted">Kỹ thuật, thủ thuật và mẹo, kèm bài tập nghe được. Tất cả dùng offline.{IS_RECORDER_APP || IS_KALIMBA_APP || IS_GUITAR_APP || IS_PIANICA_APP || IS_TRANH_APP ? '' : ' Chơi kèn chromatic: xem nhóm bài cuối.'}</p>
        </div>
      </header>
      <LogCard />
      <Link to="/nghe-dap" className="jam-card">
        <strong>Tập nghe – đáp</strong>
        <span>Máy chơi một câu ngắn, bạn nghe rồi chơi lại; app nghe micro chấm từng nốt, sai thì chỉ chỗ bấm. Luyện tai và thuộc vị trí nốt, 7 cấp từ 1 nốt tới câu 4 nốt.</span>
      </Link>
      <Link to="/tap-nhip" className="jam-card">
        <strong>Tập nhịp</strong>
        <span>Máy đếm nhịp chạy, bạn chơi theo mẫu (nốt đen, móc đơn, đảo phách, swing…); app nghe và báo mỗi tiếng sớm / muộn bao nhiêu mili giây, có hay vội hay kéo không.</span>
      </Link>
      {!IS_KALIMBA_APP && !IS_TRANH_APP && <Link to="/jam" className="jam-card">
        <strong>{IS_RECORDER_APP ? 'Tập ngẫu hứng jazz' : 'Tập ngẫu hứng blues & jazz'}</strong>
        <span>{IS_GUITAR_APP ? 'Nền nhạc 12 ô nhịp và các vòng jazz, thang âm blues trên cần đàn, máy hỏi – bạn đáp và lick mẫu xếp theo dây.phím.' : IS_RECORDER_APP ? 'Nền nhạc swing các vòng ii–V–I, thế bấm các nốt của hợp âm đang vang, máy hỏi – bạn đáp và lick mẫu.' : 'Nền nhạc 12 ô nhịp, thang âm blues trên kèn của bạn, máy hỏi – bạn đáp và lick mẫu; có cả chế độ jazz.'}</span>
      </Link>}
      {IS_TRANH_APP && <Link to="/tap-boi-am" className="jam-card">
        <strong>Tập bồi âm, nắn cần đàn bầu</strong>
        <span>Bật micro, gảy từng điểm bồi: app nghe và cho biết ra đúng tiếng bồi chưa, sai do chạm lệch, ấn mạnh hay nhầm điểm. Chế độ nắn cần: thước cao độ báo đang thiếu, đủ hay quá.</span>
      </Link>}
      {IS_TRANH_APP && <Link to="/tap-cao-do?mode=bend" className="jam-card">
        <strong>Tập nhấn đàn tranh</strong>
        <span>Gảy dây rồi nhấn: thước cao độ báo nhấn thiếu, đủ hay quá cho các nốt Fa, Si… (nửa cung, một cung).</span>
      </Link>}
      {!IS_TRANH_APP && !IS_GUITAR_APP && !IS_KALIMBA_APP && <Link to="/tap-cao-do" className="jam-card">
        <strong>{IS_RECORDER_APP || IS_PIANICA_APP ? 'Tập giữ hơi nốt dài' : 'Tập bend và giữ hơi'}</strong>
        <span>{IS_RECORDER_APP || IS_PIANICA_APP
          ? 'Thổi một nốt thật đều và lâu: app đo giữ được bao lâu, cao độ có chao, có non / già không. Bài khởi động tốt nhất mỗi buổi tập.'
          : 'Bend từng lỗ với thước cao độ báo thiếu – đúng – quá; và giữ nốt dài: app đo giữ được bao lâu, cao độ có chao không.'}</span>
      </Link>}
      {IS_GUITAR_APP && <Link to="/tap-hop-am" className="jam-card">
        <strong>Tập hợp âm với micro</strong>
        <span>Bấm theo sơ đồ, quạt một lần: app nghe và chỉ ra dây nào câm, dây × nào bị quạt trúng, ngón nào bấm lệch phím; đếm tỉ lệ sạch từng hợp âm.</span>
      </Link>}
      {LESSON_GROUPS.map((g) => (
        <section key={g} className="lesson-group">
          <h2>{g}</h2>
          <ol className="lesson-list">
            {LESSONS.filter((l) => l.group === g).map((l) => (
              <li key={l.id}>
                <Link to={`/learn/${l.id}`} className="lesson-row">
                  <span className="lr-title">{l.title}</span>
                  <span className="lr-sum">{l.summary}</span>
                  <span className="lr-min">{l.minutes} phút</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LessonTab({ b }: { b: Extract<Block, { t: 'tab' }> }) {
  const { settings } = useAppState();
  const key = b.harpKey ?? 'C';
  const type = b.harpType ?? 'diatonic';
  const parsed = useMemo(() => parseTab(b.body, key, type), [b.body, key, type]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const p = usePlayer(flat, {
    bpm: b.bpm ?? 80, tempoScale: 1, beatsPerBar: beatsPerBar(b.timeSig ?? '4/4'), pickupBeats: 0,
    style: b.style ?? 'metronome', melody: true, beat: true, click: false, countIn: true,
  });
  return (
    <figure className="lesson-tab">
      <figcaption className="row between center gap">
        <span>{b.caption ?? 'Bài tập'} <span className="muted">({harpName(key, type).replace(/^Kèn/, 'kèn')}, {b.bpm ?? 80} bpm)</span></span>
        <MiniPlay p={p} />
      </figcaption>
      <TabView parsed={parsed} flat={flat} active={p.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={type} harpKey={key} />
    </figure>
  );
}

function PositionsTable() {
  return (
    <div className="table-wrap">
      <table className="positions">
        <thead>
          <tr><th scope="col">Kèn</th><th scope="col">Vị trí 1</th><th scope="col">Vị trí 2</th><th scope="col">Vị trí 3</th></tr>
        </thead>
        <tbody>
          {HARP_KEYS.map((k) => (
            <tr key={k} className={k === 'C' ? 'hl' : ''}>
              <th scope="row">{k}</th>
              <td>{positionKey(k, 1)}</td>
              <td>{positionKey(k, 2)}</td>
              <td>{positionKey(k, 3)}m</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LessonPage() {
  const { lessonId } = useParams();
  const { settings } = useAppState();
  const idx = LESSONS.findIndex((l) => l.id === lessonId);
  const lesson = LESSONS[idx];
  if (!lesson) return <div className="page"><p>Không tìm thấy bài học.</p><Link to="/learn" className="btn btn-ghost">Về danh sách</Link></div>;
  const next = LESSONS[idx + 1];
  const prev = LESSONS[idx - 1];

  return (
    <article className="page page-lesson">
      <header className="page-head">
        <div className="row gap center">
          <Link to="/learn" className="icon-btn" aria-label="Về danh sách bài học"><Icon name="back" /></Link>
          <div>
            <p className="muted small">{lesson.group}</p>
            <h1>{lesson.title}</h1>
          </div>
        </div>
      </header>
      <p className="lead">{lesson.summary}</p>
      <div className="prose">
        {lesson.blocks.map((b, i) => {
          switch (b.t) {
            case 'p': return <p key={i}>{rich(b.text)}</p>;
            case 'h': return <h2 key={i}>{b.text}</h2>;
            case 'list': {
              const L = b.ordered ? 'ol' : 'ul';
              return <L key={i}>{b.items.map((it, j) => <li key={j}>{rich(it)}</li>)}</L>;
            }
            case 'tip': return <aside key={i} className="callout tip"><strong>Mẹo</strong>{rich(b.text)}</aside>;
            case 'warn': return <aside key={i} className="callout warn"><strong>Lưu ý</strong>{rich(b.text)}</aside>;
            case 'tab': return <LessonTab key={i} b={b} />;
            case 'diagram': return <HarpDiagram key={i} harpKey={b.harpKey ?? 'C'} harpType={b.harpType} showAdvanced={b.advanced ?? true} nameStyle={settings.noteNames} />;
            case 'positions': return <PositionsTable key={i} />;
            case 'link': return <aside key={i} className="callout tip">{b.text && <p>{rich(b.text)}</p>}<Link to={b.to} className="btn btn-primary">{b.label}</Link></aside>;
          }
        })}
      </div>
      <nav className="lesson-nav" aria-label="Chuyển bài học">
        {prev ? <Link to={`/learn/${prev.id}`} className="btn btn-ghost"><Icon name="back" size={16} /> {prev.title}</Link> : <span />}
        {next && <Link to={`/learn/${next.id}`} className="btn btn-primary">Bài tiếp: {next.title}</Link>}
      </nav>
    </article>
  );
}
