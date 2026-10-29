import { useEffect, useRef, useState } from 'react';
import { logMetric, usePracticeTimer } from '../lib/practiceLog';
import { Link, useSearchParams } from 'react-router-dom';
import { MicSpectrum } from '../audio/spectrum';
import { previewChord } from '../audio/engine';
import { ChordDiagram, FretboardChart, shapeTokens } from '../components/Fretboard';
import { Icon } from '../components/Icon';
import { useWakeLock } from '../components/useWakeLock';
import { ChordInstrument, chordShape, shapeMidis } from '../data/chordShapes';
import { ChordVerdict, issueText, judgeChord, openStrings, StrumDetector } from '../lib/chordPractice';
import { midiToName } from '../lib/harp';
import { useAppState } from '../state';

/**
 * Tập hợp âm guitar / ukulele: chọn hợp âm, bấm theo sơ đồ, quạt — app nghe phổ tiếng đàn và cho biết
 * dây nào câm, dây × nào bị quạt trúng, có nốt lạ (bấm lệch phím) không. Đếm tỉ lệ sạch từng hợp âm.
 */
const DEFAULT_CHORDS = ['C', 'G', 'Am', 'Em', 'D', 'Dm', 'E', 'A', 'F', 'G7', 'C7', 'D7', 'A7', 'E7', 'B7', 'Bm'];
const STATS_KEY = 'harptabs.chordPractice';
type Stats = Record<string, { tries: number; ok: number }>;
const loadStats = (): Stats => { try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}'); } catch { return {}; } };
const saveStats = (s: Stats) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* không lưu được thì thôi */ } };

const KIND_LABEL: Record<ChordVerdict['kind'], string> = { ok: 'Sạch — đủ tiếng các dây', issues: 'Chưa sạch', quiet: 'Nhỏ quá, chưa nghe rõ' };

export default function ChordPractice() {
  const { settings } = useAppState();
  const [params] = useSearchParams();
  const [inst, setInst] = useState<ChordInstrument>(() => (params.get('inst') === 'ukulele' || (!params.get('inst') && settings.defaultHarpType === 'ukulele4') ? 'ukulele' : 'guitar'));
  const fromSong = (params.get('c') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const chords = (fromSong.length ? fromSong : DEFAULT_CHORDS).filter((c) => chordShape(c, inst));
  const [chord, setChord] = useState(() => chords[0] ?? 'C');
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<ChordVerdict[]>([]);
  const [stats, setStats] = useState<Stats>(loadStats);
  const mic = useRef<MicSpectrum | null>(null);
  const det = useRef(new StrumDetector());
  useWakeLock(on);
  usePracticeTimer('hop-am', on);
  useEffect(() => () => mic.current?.stop(), []);
  useEffect(() => { if (!chordShape(chord, inst)) setChord(chords[0] ?? 'C'); setResults([]); }, [inst]); // eslint-disable-line react-hooks/exhaustive-deps

  const statKey = `${inst}:${chord}`;
  const onStrum = (v: ChordVerdict) => {
    setResults((prev) => [v, ...prev].slice(0, 30));
    if (v.kind === 'quiet') return;
    logMetric('hop-am', v.kind === 'ok' ? 1 : 0);
    setStats((prev) => {
      const cur = prev[statKey] ?? { tries: 0, ok: 0 };
      const next = { ...prev, [statKey]: { tries: cur.tries + 1, ok: cur.ok + (v.kind === 'ok' ? 1 : 0) } };
      saveStats(next);
      return next;
    });
  };
  const frame = useRef<(t: number, rms: number, mag: Float32Array, binHz: number) => void>(() => {});
  frame.current = (t, rms, mag, binHz) => {
    const s = det.current.feed(t, rms, mag, binHz);
    if (!s) return;
    const v = judgeChord(s, chord, inst);
    if (v) onStrum(v);
  };

  const start = async () => {
    setErr(null);
    const m = new MicSpectrum();
    m.onFrame = (t, rms, mag, binHz) => frame.current(t, rms, mag, binHz);
    try { await m.start(); mic.current = m; setOn(true); } catch (e) { setErr(e instanceof Error ? e.message : 'Không mở được micro'); }
  };
  const stop = () => { mic.current?.stop(); mic.current = null; setOn(false); };
  const pick = (c: string) => { setChord(c); setResults([]); det.current = new StrumDetector(); };

  const shape = chordShape(chord, inst);
  const name = (m: number) => midiToName(m, settings.noteNames);
  const last = results[0];
  const st = stats[statKey] ?? { tries: 0, ok: 0 };
  const open = openStrings(inst);
  const n = open.length;

  return (
    <div className="page chord-practice">
      <header className="page-head">
        <div>
          <h1>Tập hợp âm</h1>
          <p className="muted">Chọn hợp âm, bấm theo sơ đồ rồi quạt một lần, để đàn ngân. App nghe tiếng đàn và cho biết đã sạch chưa: dây nào câm, dây nào thừa, ngón nào bấm lệch.</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <div className="segmented" role="tablist" aria-label="Loại đàn">
          <button type="button" role="tab" aria-selected={inst === 'guitar'} className={inst === 'guitar' ? 'on' : ''} onClick={() => setInst('guitar')}>Guitar</button>
          <button type="button" role="tab" aria-selected={inst === 'ukulele'} className={inst === 'ukulele' ? 'on' : ''} onClick={() => setInst('ukulele')}>Ukulele</button>
        </div>
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? 'Tắt micro' : 'Bật micro'}
        </button>
        {shape && <button type="button" className="btn btn-ghost" onClick={() => previewChord(shapeMidis(shape, inst))}>Nghe mẫu</button>}
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      <div className="cp-chords" role="tablist" aria-label="Hợp âm đang tập">
        {chords.map((c) => {
          const s = stats[`${inst}:${c}`];
          return (
            <button key={c} type="button" role="tab" aria-selected={c === chord} className={`cp-chip${c === chord ? ' on' : ''}`} onClick={() => pick(c)}>
              {c}{s?.tries ? <small>{Math.round((100 * s.ok) / s.tries)}%</small> : null}
            </button>
          );
        })}
      </div>

      {shape && (
        <section className="cp-target">
          <ChordDiagram name={chord} inst={inst} />
          <div className="cp-neck">
            <FretboardChart harpType={inst === 'ukulele' ? 'ukulele4' : 'guitar6'} highlight={shapeTokens(shape)} nameStyle={settings.noteNames} maxFret={Math.max(5, ...shape) + 1} interactive={false} />
            <p className="small muted">× = không quạt dây đó, ○ = dây buông. Quạt từ dây trầm nhất có tiếng xuống dây 1.</p>
          </div>
        </section>
      )}

      <section className={`bp-result${last ? ` k-${last.kind === 'ok' ? 'ok' : last.kind === 'quiet' ? 'open' : 'muted'}` : ''}`} aria-live="polite">
        {!on && !last && <p className="muted">Bật micro để bắt đầu. Đặt điện thoại cách đàn khoảng nửa mét, nơi yên tĩnh.</p>}
        {on && !last && <p className="muted">Đang nghe… quạt hợp âm {chord} một lần.</p>}
        {last && <>
          <strong className="bp-kind">{KIND_LABEL[last.kind]}</strong>
          {last.kind === 'quiet' && <p>Quạt mạnh hơn, hoặc để điện thoại gần đàn hơn.</p>}
          {last.issues.length > 0 && <ul className="cp-issues">{last.issues.map((x, i) => <li key={i}>{issueText(x, name)}</li>)}</ul>}
          {last.kind !== 'quiet' && shape && (
            <div className="cp-levels" aria-label="Độ lớn từng dây">
              {shape.map((f, i) => {
                const lv = last.levels[i];
                const weak = last.issues.some((x) => x.kind === 'weak' && x.string === n - i);
                return (
                  <div key={i} className={`cp-lv${f < 0 ? ' off' : weak ? ' weak' : ''}`}>
                    <span className="cp-bar" style={{ height: f < 0 ? 0 : lv === null ? 25 : Math.max(3, 50 + lv * 1.6) }} />
                    <small>{n - i}</small>
                    <small className="muted">{f < 0 ? '×' : midiToName(open[i] + f, settings.noteNames, false)}</small>
                  </div>
                );
              })}
            </div>
          )}
        </>}
      </section>

      <div className="bp-history" aria-label="Các lần quạt gần đây">
        {results.slice(0, 20).map((r, i) => <span key={i} className={`bp-dot k-${r.kind === 'ok' ? 'ok' : r.kind === 'quiet' ? 'open' : 'muted'}`} title={KIND_LABEL[r.kind]} />)}
      </div>
      <div className="row gap wrap center">
        <span>{chord}: <strong>{st.ok}/{st.tries}</strong> lần sạch{st.tries ? ` (${Math.round((100 * st.ok) / st.tries)}%)` : ''}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setResults([]); const next = { ...stats }; delete next[statKey]; setStats(next); saveStats(next); }}>Xoá thống kê hợp âm này</button>
      </div>

      <details className="card bp-tips">
        <summary>Mẹo bấm hợp âm sạch</summary>
        <ul>
          <li>Bấm bằng <strong>đầu ngón tay</strong>, ngón dựng đứng như cái búa để không chạm dây bên cạnh.</li>
          <li>Bấm <strong>sát phím đàn</strong> (thanh kim loại) phía thân đàn: đỡ tốn lực, tiếng không rè.</li>
          <li>Quạt xong, gảy <strong>từng dây một</strong> từ dây trầm lên: dây nào câm hay rè là chỗ cần sửa ngón.</li>
          <li>Ngón cái tay trái đặt sau cần đàn, ngang ngón giữa; đừng bóp cả bàn tay quanh cần.</li>
          <li>Mỗi hợp âm: bấm, quạt, thả tay, bấm lại — lặp 10 lần. Sạch đều rồi mới sang hợp âm kế.</li>
        </ul>
        <p className="small">Dây lên chưa chuẩn thì app dễ chấm sai: lên dây trước bằng <Link to="/tuner">Dò nốt</Link>. Cùng một nốt cách quãng tám (ví dụ hai nốt Đô trong hợp âm C) thì dây cao hơn không chấm riêng được.</p>
      </details>
    </div>
  );
}
