import { useEffect, useRef, useState } from 'react';
import { logMetric, usePracticeTimer } from '../lib/practiceLog';
import { Link, useSearchParams } from 'react-router-dom';
import { MicPitch } from '../audio/pitch';
import { previewNote } from '../audio/engine';
import { BauIcon, BAU_GLYPH } from '../components/DanBau';
import { BendMeter } from '../components/BendMeter';
import { KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { useWakeLock } from '../components/useWakeLock';
import { HarpKey, keyOffset, midiToName } from '../lib/harp';
import { BEND_DRILLS, bendAdvice, BendHold, bendStatus, nodeMidi, PluckDetector, PluckResult, pluckAdvice } from '../lib/bauPractice';
import { useAppState } from '../state';

/**
 * Tập bồi âm đàn bầu: chọn điểm bồi, bật micro, gảy — app chấm từng lần gảy (đúng / dây buông / nhầm điểm / tắt tiếng),
 * đếm tỉ lệ đúng, nhớ kết quả từng điểm qua các buổi tập.
 * Chế độ nắn cần: gảy bồi rồi nắn — thước cao độ cho thấy đang thiếu / đủ / quá, giữ đúng nửa giây là tính một lần đạt.
 */
const NODES = [2, 3, 4, 5, 6, 7, 8];
const STATS_KEY = 'harptabs.bauPractice';
type Stats = Record<number, { tries: number; ok: number }>;

const loadStats = (): Stats => { try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}'); } catch { return {}; } };
const saveStats = (s: Stats) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* không lưu được thì thôi */ } };

const BEND_KEY = 'harptabs.bendPractice';
const loadBend = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(BEND_KEY) ?? '{}'); } catch { return {}; } };
const bendId = (d: { n: number; bend: number }) => `${d.n}${d.bend > 0 ? '+' : ''}${d.bend}`;
const STATUS_LABEL = { none: 'Đang nghe…', under: 'Thiếu', ok: 'Đúng', over: 'Quá' } as const;

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
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'boi' | 'nan'>(() => (params.get('mode') === 'nan' ? 'nan' : 'boi'));
  const [drill, setDrill] = useState(0);
  const [bendMidi, setBendMidi] = useState<number | null>(null);
  const [bendDone, setBendDone] = useState<Record<string, number>>(loadBend);
  const [flash, setFlash] = useState(false);
  const hold = useRef(new BendHold());
  const mic = useRef<MicPitch | null>(null);
  const det = useRef(new PluckDetector(node, keyOffset(key)));
  const level = useRef(0);
  useWakeLock(on);
  usePracticeTimer('boi-am', on);

  const offset = keyOffset(key);
  const target = nodeMidi(node, offset);
  useEffect(() => { det.current.setTarget(node, offset); }, [node, offset]);

  const record = (r: PluckResult) => {
    logMetric('boi-am', r.kind === 'ok' ? 1 : 0);
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

  const d = BEND_DRILLS[drill];
  const bendBase = nodeMidi(d.n, offset);
  const bendTarget = bendBase + d.bend;
  useEffect(() => { hold.current.reset(); setBendMidi(null); }, [drill, offset, mode]);
  // một khung hình micro: chế độ bồi âm → tách lần gảy; chế độ nắn cần → so cao độ với nốt đích
  const onFrame = (time: number, rms: number, midi: number | null) => {
    if (mode === 'boi') {
      const res = det.current.feed(time, rms, midi);
      if (res) record(res);
      return;
    }
    setBendMidi(midi);
    if (hold.current.feed(time, bendStatus(midi, bendTarget, d.bend).status)) {
      const id = bendId(d);
      logMetric('nan-can', 1);
      setBendDone((prev) => {
        const next = { ...prev, [id]: (prev[id] ?? 0) + 1 };
        try { localStorage.setItem(BEND_KEY, JSON.stringify(next)); } catch { /* không lưu được thì thôi */ }
        return next;
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
    }
  };
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  const start = async () => {
    setErr(null);
    // đàn bầu: dây buông Đô3 (~130 Hz) tới bồi 1/8 Đô6 (~1050 Hz); tiếng bồi nhỏ → ngưỡng âm lượng thấp
    const m = new MicPitch({ minHz: 95, maxHz: 1400, minClarity: 0.75, minRms: 0.006 });
    m.onLevel = (rms) => { level.current = rms; };
    m.onReading = (r) => frameRef.current(performance.now() / 1000, level.current, r ? r.midi : null);
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
          <h1>{mode === 'boi' ? 'Tập bồi âm' : 'Tập nắn cần'}</h1>
          <p className="muted">{mode === 'boi'
            ? 'Chọn điểm bồi, bật micro rồi gảy. App nghe từng lần gảy và cho biết đã ra đúng tiếng bồi chưa, sai thì sai ở đâu.'
            : 'Gảy bồi rồi nắn cần: thước bên dưới cho thấy cao độ đang thiếu, đủ hay quá so với nốt cần ra. Giữ đúng nửa giây là đạt.'}</p>
        </div>
      </header>

      <div className="segmented bp-mode" role="tablist" aria-label="Bài tập">
        <button type="button" role="tab" aria-selected={mode === 'boi'} className={mode === 'boi' ? 'on' : ''} onClick={() => setMode('boi')}>Bồi âm</button>
        <button type="button" role="tab" aria-selected={mode === 'nan'} className={mode === 'nan' ? 'on' : ''} onClick={() => setMode('nan')}>Nắn cần</button>
      </div>

      <div className="row gap wrap end-align">
        <KeySelect value={key} onChange={(k) => k !== 'auto' && setKey(k)} label="Dây buông" harpType="danbau" />
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? 'Tắt micro' : 'Bật micro'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => {
          if (mode === 'boi') { previewNote(target, 1.2); return; }
          previewNote(bendBase, 0.7);
          setTimeout(() => previewNote(bendTarget, 1.2), 750);
        }}>Nghe mẫu</button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      {mode === 'boi' && <>
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
      </>}

      {mode === 'nan' && <>
        <div className="segmented bp-nodes" role="tablist" aria-label="Nốt cần nắn">
          {BEND_DRILLS.map((x, i) => (
            <button key={bendId(x)} type="button" role="tab" aria-selected={i === drill} className={i === drill ? 'on' : ''} onClick={() => setDrill(i)}>
              <span className="bp-frac">{BAU_GLYPH[x.n]}{x.bend > 0 ? '↑' : '↓'}{Math.abs(x.bend)}</span>
              <small>{midiToName(nodeMidi(x.n, offset) + x.bend, settings.noteNames, false)}{bendDone[bendId(x)] ? ` ✓${bendDone[bendId(x)]}` : ''}</small>
            </button>
          ))}
        </div>

        <section className="bp-target">
          <BauIcon n={d.n} bend={d.bend} size="l" />
          <p>Gảy bồi <strong>{BAU_GLYPH[d.n]}</strong> (ra {midiToName(bendBase, settings.noteNames)}), rồi <strong>{d.bend > 0 ? 'đẩy cần' : 'kéo cần'}</strong> {Math.abs(d.bend) === 1 ? 'nửa cung' : Math.abs(d.bend) === 2 ? 'một cung' : `${Math.abs(d.bend)} nửa cung`} cho tới <strong>{midiToName(bendTarget, settings.noteNames)}</strong>.</p>
        </section>

        <BendMeter base={bendBase} target={bendTarget} midi={bendMidi} name={(m) => midiToName(m, settings.noteNames, false)} />
        {(() => {
          const st = bendStatus(bendMidi, bendTarget, d.bend);
          const cls = flash || st.status === 'ok' ? ' k-ok' : st.status === 'none' ? '' : ' k-open';
          return (
            <section className={`bp-result${on ? cls : ''}`} aria-live="polite">
              {!on ? <p className="muted">Bật micro để bắt đầu. Đặt điện thoại gần đàn, nơi yên tĩnh.</p> : <>
                <strong className="bp-kind">{flash ? 'Đạt!' : STATUS_LABEL[st.status]}{!flash && st.status !== 'none' ? ` (${st.cents > 0 ? '+' : ''}${st.cents} cent)` : ''}</strong>
                <p>{flash ? 'Giữ đúng được nửa giây. Thả cần, gảy lại để tập lần nữa.' : bendAdvice(st.status, d.bend)}</p>
              </>}
            </section>
          );
        })()}
        <div className="row gap wrap center">
          <span>Nắn {BAU_GLYPH[d.n]}{d.bend > 0 ? '↑' : '↓'}{Math.abs(d.bend)}: đạt <strong>{bendDone[bendId(d)] ?? 0}</strong> lần</span>
        </div>
      </>}

      <details className="card bp-tips">
        <summary>{mode === 'boi' ? 'Mẹo ra tiếng bồi' : 'Mẹo nắn cần'}</summary>
        {mode === 'nan' ? <ul>
          <li>Gảy bồi trước, <strong>nghe nốt ngân rồi mới nắn</strong>: nốt trượt lên / xuống tới đúng cao độ là tiếng đàn bầu đặc trưng.</li>
          <li>Nắn từ từ, nhìn chấm trên thước: chấm vào vùng xanh là dừng tay, giữ yên.</li>
          <li>Đẩy cần (về phía dây) cho nốt cao lên, kéo cần ra cho nốt thấp xuống. Nắn nửa cung cần rất ít lực — dễ quá tay.</li>
          <li>Đã quen thì tập nắn theo tai trước, rồi mới nhìn thước để kiểm tra.</li>
        </ul> : <ul>
          <li>Dán vạch nhỏ lên thân đàn ở các điểm ½ ⅓ ¼ để đặt tay đúng chỗ — lệch vài milimét là mất tiếng.</li>
          <li>Cạnh bàn tay (phía ngón út) chỉ <strong>đặt hờ</strong> lên dây; ấn xuống là tắt tiếng.</li>
          <li>Que gảy chừa đầu khoảng 1 cm, gảy sát chỗ tay chạm, hất ra dứt khoát — và <strong>nhấc tay ngay</strong>.</li>
          <li>Tập điểm ½ tới khi đúng đều rồi mới sang ⅓, ¼… Mỗi ngày 10 phút là đủ.</li>
        </ul>}
        <p className="small">Kết quả "Lệch cao độ" nhiều lần: lên lại dây buông bằng <Link to="/tuner">Dò nốt</Link>.</p>
      </details>
    </div>
  );
}

