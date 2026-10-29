import { useEffect, useMemo, useRef, useState } from 'react';
import { logMetric, usePracticeTimer } from '../lib/practiceLog';
import { MicPitch } from '../audio/pitch';
import { audio, playTone } from '../audio/engine';
import { SHOWN_HARP_TYPES } from '../appConfig';
import { FingeringIcon } from '../components/Fingering';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { TokenText } from '../components/TabView';
import { useWakeLock } from '../components/useWakeLock';
import { EAR_LEVELS, earPool, easiestNote, makeQuestion, NoteSegmenter, sameNote } from '../lib/earPractice';
import { HarpKey, HarpType, harpLayout, holeCount, isFretted, keyOffset, midiToHz, midiToName } from '../lib/harp';
import { useAppState } from '../state';

/**
 * Tập nghe – đáp: máy chơi nốt chủ làm mốc rồi một câu ngắn; người tập chơi lại trên nhạc cụ, app nghe micro chấm từng nốt.
 * Sai thì chỉ ra nốt đúng và chỗ bấm; đúng 5 câu liền thì lên cấp.
 */
const STATS_KEY = 'harptabs.earPractice';
type Stats = Record<string, { tries: number; ok: number }>;
const loadStats = (): Stats => { try { return JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}'); } catch { return {}; } };
const saveStats = (s: Stats) => { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch { /* không lưu được thì thôi */ } };

type Phase = 'idle' | 'playing' | 'listen' | 'right' | 'wrong';
/** nhịp phát câu hỏi (giây) */
const STEP = 0.75;

export default function EarPractice() {
  const { settings } = useAppState();
  const [type, setType] = useState<HarpType>(() => (SHOWN_HARP_TYPES.includes(settings.defaultHarpType) ? settings.defaultHarpType : SHOWN_HARP_TYPES[0]));
  const [key, setKey] = useState<HarpKey>(settings.defaultHarpKey);
  const [levelIdx, setLevelIdx] = useState(0);
  const [anyOctave, setAnyOctave] = useState(true);
  const [withTonic, setWithTonic] = useState(true);
  const [autoUp, setAutoUp] = useState(true);
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<number[]>([]);
  const [heard, setHeard] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [stats, setStats] = useState<Stats>(loadStats);
  const mic = useRef<MicPitch | null>(null);
  const seg = useRef(new NoteSegmenter());
  const listenFrom = useRef(Infinity);
  const level = useRef(0);
  const timer = useRef<number>();
  useWakeLock(on);
  usePracticeTimer('nghe-dap', on);

  const layout = harpLayout(key, type);
  const lv = EAR_LEVELS[levelIdx];
  const pool = useMemo(() => earPool(layout, keyOffset(key), lv), [layout, key, lv]);

  const ask = (q: number[]) => {
    if (!pool) return;
    clearTimeout(timer.current);
    setQuestion(q);
    setHeard([]);
    setPhase('playing');
    seg.current.reset();
    const c = audio();
    let t = c.currentTime + 0.1;
    if (withTonic) { playTone(pool.tonic, t, 0.9, 0.8); t += 1.3; }
    q.forEach((m, i) => playTone(m, t + i * STEP, STEP * 0.9));
    const total = t - c.currentTime + q.length * STEP;
    // không nghe micro khi loa đang phát (tránh tự chấm tiếng của chính máy)
    listenFrom.current = performance.now() / 1000 + total + 0.3;
    timer.current = window.setTimeout(() => setPhase((p) => (p === 'playing' ? 'listen' : p)), (total + 0.3) * 1000);
  };
  const next = () => pool && ask(makeQuestion(pool.pool, lv.len, Math.random, pool.tonic));
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => () => { clearTimeout(timer.current); mic.current?.stop(); }, []);
  // đổi nhạc cụ / cấp: bỏ câu đang dở; đang tập thì ra câu mới theo cấp mới
  useEffect(() => {
    clearTimeout(timer.current);
    setPhase('idle'); setQuestion([]); setHeard([]);
    if (mic.current) timer.current = window.setTimeout(() => nextRef.current(), 700);
  }, [type, key, levelIdx]);

  const record = (ok: boolean) => {
    logMetric('nghe-dap', ok ? 1 : 0);
    setStats((prev) => {
      const cur = prev[lv.id] ?? { tries: 0, ok: 0 };
      const nx = { ...prev, [lv.id]: { tries: cur.tries + 1, ok: cur.ok + (ok ? 1 : 0) } };
      saveStats(nx);
      return nx;
    });
  };

  const onNote = (m: number) => {
    if (phase !== 'listen') return;
    const i = heard.length;
    const want = question[i];
    const got = [...heard, m];
    setHeard(got);
    if (!sameNote(m, want, anyOctave)) { setPhase('wrong'); setStreak(0); record(false); return; }
    if (got.length < question.length) return;
    setPhase('right');
    record(true);
    const s = streak + 1;
    setStreak(s);
    if (autoUp && s >= 5 && levelIdx < EAR_LEVELS.length - 1) {
      timer.current = window.setTimeout(() => { setStreak(0); setLevelIdx(levelIdx + 1); }, 1400);
    } else {
      timer.current = window.setTimeout(() => nextRef.current(), 1400);
    }
  };
  const noteRef = useRef(onNote);
  noteRef.current = onNote;

  const lowHz = Math.round(Math.min(150, midiToHz(Math.min(...layout.map((n) => n.midi))) * 0.85));
  const start = async () => {
    setErr(null);
    const m = new MicPitch({ minHz: lowHz });
    m.onLevel = (rms) => { level.current = rms; };
    m.onReading = (r) => {
      const t = performance.now() / 1000;
      if (t < listenFrom.current) return;
      const n = seg.current.feed(t, r ? r.midi : null, level.current);
      if (n !== null) noteRef.current(n);
    };
    try { await m.start(); mic.current = m; setOn(true); next(); } catch (e) { setErr(e instanceof Error ? e.message : 'Không mở được micro'); }
  };
  const stop = () => { clearTimeout(timer.current); mic.current?.stop(); mic.current = null; setOn(false); setPhase('idle'); };
  useEffect(() => { if (mic.current) { stop(); void start(); } }, [lowHz]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (m: number) => midiToName(m, settings.noteNames);
  const strings = isFretted(type) ? holeCount(type) : undefined;
  const where = (m: number) => {
    const n = easiestNote(layout, m);
    return n && (
      <span className="ep-where" key={m}>
        <strong>{name(m)}</strong>
        {n.token !== midiToName(n.midi) && <span className="ep-tok"><TokenText token={n.token} strings={strings} /></span>}
        {n.fingers && <FingeringIcon fingers={n.fingers} size="s" />}
      </span>
    );
  };
  const st = stats[lv.id];

  return (
    <div className="page ear-practice">
      <header className="page-head">
        <div>
          <h1>Tập nghe – đáp</h1>
          <p className="muted">Máy chơi nốt chủ làm mốc rồi một câu ngắn. Bạn nghe và chơi lại trên {type.startsWith('guitar') || type.startsWith('ukulele') || type.startsWith('kalimba') || type.startsWith('tranh') ? 'đàn' : 'kèn / sáo'} của mình — app nghe và chấm từng nốt. Luyện tai và thuộc vị trí nốt.</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <HarpTypeSelect value={type} onChange={setType} id="ep-type" />
        <KeySelect value={key} onChange={(k) => k !== 'auto' && setKey(k as HarpKey)} id="ep-key" harpType={type} />
        <label className="field" htmlFor="ep-level">
          <span className="field-label">Cấp độ</span>
          <select id="ep-level" value={levelIdx} onChange={(e) => { setLevelIdx(Number(e.target.value)); setStreak(0); }}>
            {EAR_LEVELS.map((l, i) => { const s = stats[l.id]; return <option key={l.id} value={i}>{i + 1}. {l.label}{s?.tries ? ` (${Math.round((100 * s.ok) / s.tries)}%)` : ''}</option>; })}
          </select>
        </label>
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start} disabled={!pool}>
          <Icon name="mic" size={20} /> {on ? 'Dừng' : 'Bắt đầu'}
        </button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}
      {!pool && <div className="alert">Nhạc cụ này không đủ nốt cho cấp độ đã chọn. Chọn cấp thấp hơn hoặc loại khác.</div>}

      {pool && <p className="small muted">Nốt chủ: <strong>{name(pool.tonic)}</strong> · nốt có trong đề: {pool.pool.map((m) => midiToName(m, settings.noteNames, false)).join(' ')}</p>}

      <section className={`bp-result ep-stage${phase === 'right' ? ' k-ok' : phase === 'wrong' ? ' k-muted' : ''}`} aria-live="polite">
        {phase === 'idle' && <p className="muted">{on ? 'Đang chuẩn bị…' : 'Bấm Bắt đầu (cần micro). Nên đeo tai nghe hoặc để loa nhỏ để micro không nghe lẫn tiếng máy.'}</p>}
        {phase === 'playing' && <strong className="bp-kind">Nghe…</strong>}
        {phase === 'listen' && <><strong className="bp-kind">Đến lượt bạn</strong><p>Chơi lại {question.length > 1 ? `${question.length} nốt` : 'nốt vừa nghe'}.</p></>}
        {phase === 'right' && <strong className="bp-kind">Đúng rồi!</strong>}
        {phase === 'wrong' && <>
          <strong className="bp-kind">Chưa đúng</strong>
          <p>Nốt thứ {heard.length}: bạn chơi <strong>{name(heard[heard.length - 1])}</strong>, đúng là:</p>
          <div className="ep-answer">{question.map(where)}</div>
        </>}
        {question.length > 0 && (
          <div className="ep-dots" aria-label="Tiến độ câu">
            {question.map((_, i) => <span key={i} className={`bp-dot${i < heard.length ? (sameNote(heard[i], question[i], anyOctave) ? ' k-ok' : ' k-muted') : ''}`} />)}
          </div>
        )}
      </section>

      {on && (
        <div className="row gap wrap">
          <button type="button" className="btn btn-ghost" onClick={() => ask(question)} disabled={!question.length || phase === 'playing'}>Nghe lại</button>
          <button type="button" className="btn btn-ghost" onClick={next} disabled={phase === 'playing'}>Câu mới</button>
          {phase === 'listen' && question.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => { setPhase('wrong'); setStreak(0); record(false); }}>Xem đáp án</button>}
        </div>
      )}

      <div className="row gap wrap center ep-score">
        <span>Đúng liền: <strong>{streak}</strong>{autoUp && levelIdx < EAR_LEVELS.length - 1 ? ' / 5 để lên cấp' : ''}</span>
        <span>Cấp này: <strong>{st?.ok ?? 0}/{st?.tries ?? 0}</strong></span>
      </div>
      <div className="row gap wrap">
        <label className="check"><input type="checkbox" checked={withTonic} onChange={(e) => setWithTonic(e.target.checked)} /> Phát nốt chủ làm mốc</label>
        <label className="check"><input type="checkbox" checked={anyOctave} onChange={(e) => setAnyOctave(e.target.checked)} /> Chấp nhận khác quãng tám</label>
        <label className="check"><input type="checkbox" checked={autoUp} onChange={(e) => setAutoUp(e.target.checked)} /> Đúng 5 câu liền thì lên cấp</label>
      </div>

      <details className="card bp-tips">
        <summary>Cách tập hiệu quả</summary>
        <ul>
          <li>Trước khi chơi, <strong>hát thầm</strong> lại câu vừa nghe — hát được thì chơi sẽ dễ.</li>
          <li>So với nốt chủ: nốt vừa nghe cao hơn hay thấp hơn, gần hay xa? Đoán rồi thử, sai thì nghe lại.</li>
          <li>Chơi từng nốt rõ ràng, ngắt nhẹ giữa các nốt (đánh lưỡi "tu" với kèn, sáo).</li>
          <li>Mỗi ngày 10 phút. Cấp nào đúng trên 80% thì lên cấp kế.</li>
        </ul>
      </details>
    </div>
  );
}
