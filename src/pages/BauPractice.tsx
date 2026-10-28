import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MicPitch } from '../audio/pitch';
import { previewNote } from '../audio/engine';
import { BauIcon, BAU_GLYPH } from '../components/DanBau';
import { KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { useWakeLock } from '../components/useWakeLock';
import { HarpKey, keyOffset, midiToName } from '../lib/harp';
import { nodeMidi, PluckDetector, PluckResult, pluckAdvice } from '../lib/bauPractice';
import { useAppState } from '../state';

/**
 * Tập bồi âm đàn bầu: chọn điểm bồi, bật micro, gảy — app chấm từng lần gảy (đúng / dây buông / nhầm điểm / tắt tiếng),
 * đếm tỉ lệ đúng, nhớ kết quả từng điểm qua các buổi tập.
 */
const NODES = [2, 3, 4, 5, 6, 7, 8];
const STATS_KEY = 'harptabs.bauPractice';
type Stats = Record<number, { tries: number; ok: number }>;

const loadStats = (): Stats => { try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}'); } catch { return {}; } };
const saveStats = (s: Stats) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* không lưu được thì thôi */ } };

const KIND_LABEL: Record<PluckResult['kind'], string> = { ok: 'Đúng', open: 'Dây buông', wrong: 'Nhầm điểm', muted: 'Tắt tiếng', off: 'Lệch cao độ' };

export default function BauPractice() {
  const { settings } = useAppState();
  const [key, setKey] = useState<HarpKey>('C');
  const [node, setNode] = useState(2);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<PluckResult[]>([]);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [autoNext, setAutoNext] = useState(true);
  const mic = useRef<MicPitch | null>(null);
  const det = useRef(new PluckDetector(node, keyOffset(key)));
  const level = useRef(0);
  useWakeLock(on);

  const offset = keyOffset(key);
  const target = nodeMidi(node, offset);
  useEffect(() => { det.current.setTarget(node, offset); }, [node, offset]);

  const record = (r: PluckResult) => {
    setResults((prev) => [r, ...prev].slice(0, 30));
    setStats((prev) => {
      const cur = prev[node] ?? { tries: 0, ok: 0 };
      const next = { ...prev, [node]: { tries: cur.tries + 1, ok: cur.ok + (r.kind === 'ok' ? 1 : 0) } };
      saveStats(next);
      return next;
    });
  };
  // đúng 5 lần liên tiếp thì chuyển sang điểm kế (nếu bật)
  const streak = results.findIndex((r) => r.kind !== 'ok');
  const okStreak = streak < 0 ? results.length : streak;
  useEffect(() => {
    if (!autoNext || okStreak < 5) return;
    const i = NODES.indexOf(node);
    if (i < NODES.length - 1) { setNode(NODES[i + 1]); setResults([]); }
  }, [okStreak, autoNext, node]);

  const recordRef = useRef(record);
  recordRef.current = record;

  const start = async () => {
    setErr(null);
    // đàn bầu: dây buông Đô3 (~130 Hz) tới bồi 1/8 Đô6 (~1050 Hz); tiếng bồi nhỏ → ngưỡng âm lượng thấp
    const m = new MicPitch({ minHz: 95, maxHz: 1400, minClarity: 0.75, minRms: 0.006 });
    m.onLevel = (rms) => { level.current = rms; };
    m.onReading = (r) => {
      const res = det.current.feed(performance.now() / 1000, level.current, r ? r.midi : null);
      if (res) recordRef.current(res);
    };
    try { await m.start(); mic.current = m; setOn(true); } catch (e) { setErr(e instanceof Error ? e.message : 'Không mở được micro'); }
  };
  const stop = () => { mic.current?.stop(); mic.current = null; setOn(false); };
  useEffect(() => () => mic.current?.stop(), []);

  const s = stats[node] ?? { tries: 0, ok: 0 };
  const last = results[0];
  const glyph = (n: number) => BAU_GLYPH[n];

  return (
    <div className="page bau-practice">
      <header className="page-head">
        <div>
          <h1>Tập bồi âm</h1>
          <p className="muted">Chọn điểm bồi, bật micro rồi gảy. App nghe từng lần gảy và cho biết đã ra đúng tiếng bồi chưa, sai thì sai ở đâu.</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <KeySelect value={key} onChange={(k) => k !== 'auto' && setKey(k)} label="Dây buông" harpType="danbau" />
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? 'Tắt micro' : 'Bật micro'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => previewNote(target, 1.2)}>Nghe mẫu</button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      <div className="segmented bp-nodes" role="tablist" aria-label="Điểm bồi đang tập">
        {NODES.map((n) => {
          const st = stats[n];
          return (
            <button key={n} type="button" role="tab" aria-selected={n === node} className={n === node ? 'on' : ''} onClick={() => { setNode(n); setResults([]); }}>
              <span className="bp-frac">{BAU_GLYPH[n]}</span>
              <small>{st?.tries ? `${Math.round((100 * st.ok) / st.tries)}%` : midiToName(nodeMidi(n, offset), settings.noteNames, false)}</small>
            </button>
          );
        })}
      </div>

      <section className="bp-target">
        <BauIcon n={node} bend={0} size="l" />
        <p>Chạm hờ cạnh bàn tay ở điểm <strong>{BAU_GLYPH[node]}</strong> dây (tính từ ngựa đàn), gảy, nhấc tay ngay. Đúng sẽ ra <strong>{midiToName(target, settings.noteNames)}</strong>.</p>
      </section>

      <section className={`bp-result${last ? ` k-${last.kind}` : ''}`} aria-live="polite">
        {!on && !last && <p className="muted">Bật micro để bắt đầu. Đặt điện thoại gần đàn, nơi yên tĩnh.</p>}
        {on && !last && <p className="muted">Đang nghe… gảy thử một lần.</p>}
        {last && <>
          <strong className="bp-kind">{KIND_LABEL[last.kind]}</strong>
          <p>{pluckAdvice(last, glyph)}</p>
          {last.midi !== null && last.kind !== 'ok' && <p className="small muted">Nghe được: {midiToName(Math.round(last.midi), settings.noteNames)}</p>}
        </>}
      </section>

      <div className="bp-history" aria-label="Các lần gảy gần đây">
        {results.slice(0, 20).map((r, i) => <span key={i} className={`bp-dot k-${r.kind}`} title={KIND_LABEL[r.kind]} />)}
      </div>

      <div className="row gap wrap center">
        <span>Điểm {BAU_GLYPH[node]}: <strong>{s.ok}/{s.tries}</strong> lần đúng{s.tries ? ` (${Math.round((100 * s.ok) / s.tries)}%)` : ''}</span>
        <label className="check"><input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Đúng 5 lần liền thì sang điểm kế</label>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResults([]); const next = { ...stats }; delete next[node]; setStats(next); saveStats(next); }}>Xoá thống kê điểm này</button>
      </div>

      <details className="card bp-tips">
        <summary>Mẹo ra tiếng bồi</summary>
        <ul>
          <li>Dán vạch nhỏ lên thân đàn ở các điểm ½ ⅓ ¼ để đặt tay đúng chỗ — lệch vài milimét là mất tiếng.</li>
          <li>Cạnh bàn tay (phía ngón út) chỉ <strong>đặt hờ</strong> lên dây; ấn xuống là tắt tiếng.</li>
          <li>Que gảy chừa đầu khoảng 1 cm, gảy sát chỗ tay chạm, hất ra dứt khoát — và <strong>nhấc tay ngay</strong>.</li>
          <li>Tập điểm ½ tới khi đúng đều rồi mới sang ⅓, ¼… Mỗi ngày 10 phút là đủ.</li>
        </ul>
        <p className="small">Kết quả "Lệch cao độ" nhiều lần: lên lại dây buông bằng <Link to="/tuner">Dò nốt</Link>.</p>
      </details>
    </div>
  );
}
