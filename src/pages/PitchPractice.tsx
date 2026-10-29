import { useEffect, useMemo, useRef, useState } from 'react';
import { logMetric, usePracticeTimer } from '../lib/practiceLog';
import { Link, useSearchParams } from 'react-router-dom';
import { MicPitch } from '../audio/pitch';
import { droneHz, startDrone } from '../audio/practiceBacking';
import { previewNote } from '../audio/engine';
import { SHOWN_HARP_TYPES } from '../appConfig';
import { BendMeter } from '../components/BendMeter';
import { FingeringIcon } from '../components/Fingering';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { TokenText } from '../components/TabView';
import { useWakeLock } from '../components/useWakeLock';
import { HarpKey, HarpType, harpLayout, isDanBau, keyOffset, isFretted, isTranh, midiToHz, midiToName } from '../lib/harp';
import { BendDrill, bendDrills, canHoldNote, BendHold, bendStatus, BendStatus, HOLD_GOAL, HoldResult, holdGrade, NoteHold } from '../lib/pitchPractice';
import { useAppState } from '../state';

/**
 * Tập cao độ với micro: bend kèn harmonica / nhấn dây đàn tranh (thước cao độ báo thiếu – đúng – quá),
 * và giữ nốt dài cho các nhạc cụ hơi (đo giữ được bao lâu, cao độ chao bao nhiêu).
 */
type Mode = 'bend' | 'hold';

const canBend = (t: HarpType, k: HarpKey) => bendDrills(harpLayout(k, t), t, keyOffset(k)).length > 0;

const BEST_KEY = 'harptabs.pitchPractice';
const loadBest = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}'); } catch { return {}; } };
const STATUS_LABEL: Record<BendStatus, string> = { none: 'Đang nghe…', under: 'Thiếu', ok: 'Đúng', over: 'Quá' };

function bendAdvice(status: BendStatus, d: BendDrill, type: HarpType): string {
  const tranh = isTranh(type);
  const draw = d.token.startsWith('-');
  switch (status) {
    case 'none': return tranh ? `Gảy dây ${d.baseToken} rồi tay trái nhấn dây (phía trái nhạn).` : `${draw ? 'Hút' : 'Thổi'} nốt ${d.baseToken} cho sạch rồi bend xuống.`;
    case 'ok': return 'Đúng rồi — giữ yên!';
    case 'under':
      if (tranh) return 'Thiếu: nhấn thêm một chút.';
      return draw ? 'Bend chưa đủ sâu: kéo lưỡi về sau thêm (nói "i" → "u"), hạ hàm, hơi tụt xuống họng. Đừng hút mạnh hơn.' : 'Bend chưa đủ: đẩy lưỡi lên gần răng cửa, nén hơi thêm. Đừng thổi mạnh hơn.';
    case 'over':
      if (tranh) return 'Quá tay: nhấn nhẹ lại.';
      return 'Bend quá sâu: nhả bớt, lưỡi nhích về lại một chút.';
  }
}

export default function PitchPractice() {
  const { settings } = useAppState();
  const [params] = useSearchParams();
  const want = params.get('mode') === 'hold' ? 'hold' : params.get('mode') === 'bend' ? 'bend' : null;
  const [type, setType] = useState<HarpType>(() => {
    // loại mặc định trong cài đặt không thuộc bản app này (dữ liệu cũ) thì lấy loại đầu tiên của app
    const t = SHOWN_HARP_TYPES.includes(settings.defaultHarpType) ? settings.defaultHarpType : SHOWN_HARP_TYPES[0];
    if (!want) return t;
    const ok = (x: HarpType) => (want === 'hold' ? canHoldNote(x) : canBend(x, settings.defaultHarpKey));
    return ok(t) ? t : SHOWN_HARP_TYPES.find(ok) ?? t;
  });
  const [key, setKey] = useState<HarpKey>(settings.defaultHarpKey);
  const layout = harpLayout(key, type);
  const drills = useMemo(() => bendDrills(layout, type, keyOffset(key)), [layout, type, key]);
  const hasBend = drills.length > 0;
  const hasHold = canHoldNote(type);
  const [mode, setMode] = useState<Mode>(want ?? (hasBend ? 'bend' : 'hold'));
  const curMode: Mode = mode === 'bend' && !hasBend ? 'hold' : mode === 'hold' && !hasHold ? 'bend' : mode;

  // nốt để giữ: mỗi cao độ một nốt, bỏ nốt bend / overblow; mặc định nốt giữa tầm
  const holdNotes = useMemo(() => {
    const seen = new Set<number>();
    return layout.filter((n) => !n.bend && !n.over && !['drawBend', 'blowBend', 'overblow', 'overdraw', 'press'].includes(n.technique))
      .sort((a, b) => a.midi - b.midi).filter((n) => (seen.has(n.midi) ? false : (seen.add(n.midi), true)));
  }, [layout]);
  const [drillIdx, setDrillIdx] = useState(0);
  const [holdIdx, setHoldIdx] = useState<number | null>(null);
  // mặc định: nốt thế bấm thường, trong gam, ở giữa tầm — dễ ra tiếng nhất cho người mới
  const defaultHold = useMemo(() => {
    const easy = holdNotes.map((n, i) => ({ n, i })).filter(({ n }) => ['fingered', 'blow', 'draw'].includes(n.technique) && ![1, 3, 6, 8, 10].includes((n.midi - keyOffset(key) + 120) % 12));
    return easy.length ? easy[Math.floor(easy.length / 2)].i : Math.floor(holdNotes.length / 2);
  }, [holdNotes, key]);
  const hi = Math.min(holdIdx ?? defaultHold, holdNotes.length - 1);
  const d = drills[Math.min(drillIdx, drills.length - 1)];
  const holdNote = holdNotes[hi];

  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [midi, setMidi] = useState<number | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState(false);
  const [live, setLive] = useState<{ secs: number; cents: number; spread: number } | null>(null);
  const [holds, setHolds] = useState<HoldResult[]>([]);
  const [best, setBest] = useState<Record<string, number>>(loadBest);
  const mic = useRef<MicPitch | null>(null);
  const bendHold = useRef(new BendHold());
  const noteHold = useRef(new NoteHold(0));
  useWakeLock(on);
  usePracticeTimer('cao-do', on);
  useEffect(() => () => mic.current?.stop(), []);

  const target = curMode === 'bend' ? d?.target : holdNote?.midi;
  useEffect(() => { bendHold.current.reset(); noteHold.current.setTarget(target ?? 0); setMidi(null); setLive(null); }, [target, curMode]);

  const bestKey = holdNote ? `${type}:${holdNote.midi}` : '';
  const onFrame = (time: number, m: number | null) => {
    setMidi(m);
    if (curMode === 'bend') {
      if (d && bendHold.current.feed(time, bendStatus(m, d.target, d.bend).status)) {
        setDone((p) => ({ ...p, [d.token]: (p[d.token] ?? 0) + 1 }));
        logMetric('bend', 1);
        setFlash(true);
        setTimeout(() => setFlash(false), 900);
      }
      return;
    }
    const r = noteHold.current.feed(time, m);
    setLive(r.live);
    if (r.done) {
      const res = r.done;
      logMetric('giu-not', res.secs);
      setHolds((p) => [res, ...p].slice(0, 8));
      setBest((p) => {
        if ((p[bestKey] ?? 0) >= res.secs || res.spread > 15) return p;
        const next = { ...p, [bestKey]: res.secs };
        try { localStorage.setItem(BEST_KEY, JSON.stringify(next)); } catch { /* không lưu được thì thôi */ }
        return next;
      });
    }
  };
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  // tầm dò theo nốt thấp nhất của nhạc cụ (bài tập không xuống thấp hơn nốt thấp nhất, nên không cần dò rộng như Dò nốt)
  const lowHz = Math.round(midiToHz(Math.min(...layout.map((n) => n.midi))) * 0.85);
  const tonic = 60 + keyOffset(key);
  // tiếng bass nền: chỉ bật khi nằm hẳn dưới tầm dò của micro
  const droneOk = droneHz(tonic) * 1.2 < lowHz;
  const [drone, setDrone] = useState(true);
  useEffect(() => (on && drone && droneOk ? startDrone(tonic) : undefined), [on, drone, droneOk, tonic]);
  const start = async () => {
    setErr(null);
    const m = new MicPitch({ minHz: lowHz });
    m.onReading = (r) => frameRef.current(performance.now() / 1000, r ? r.midi : null);
    try { await m.start(); mic.current = m; setOn(true); } catch (e) { setErr(e instanceof Error ? e.message : 'Không mở được micro'); }
  };
  const stop = () => { mic.current?.stop(); mic.current = null; setOn(false); setMidi(null); setLive(null); };
  useEffect(() => { if (mic.current) { stop(); void start(); } }, [lowHz]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = (m: number) => midiToName(m, settings.noteNames, false);
  const tranh = isTranh(type);
  const bendWord = tranh ? 'Nhấn' : 'Bend';
  const unsupported = !hasBend && !hasHold;

  return (
    <div className="page pitch-practice">
      <header className="page-head">
        <div>
          <h1>{curMode === 'bend' ? `Tập ${bendWord.toLowerCase()}` : 'Tập giữ nốt dài'}</h1>
          <p className="muted">{curMode === 'bend'
            ? `Thước cao độ cho thấy đang thiếu, đủ hay quá so với nốt cần ra. Giữ đúng nửa giây là một lần đạt.`
            : `Chọn một nốt, ${tranh ? 'gảy' : 'thổi'} thật đều và lâu nhất có thể. App đo giữ được bao lâu, cao độ có chao không. Mục tiêu: ${HOLD_GOAL} giây, chao dưới ±15 cent.`}</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <HarpTypeSelect value={type} onChange={(t) => { setType(t); setDrillIdx(0); setHoldIdx(null); }} id="pp-type" />
        <KeySelect value={key} onChange={(k) => k !== 'auto' && setKey(k as HarpKey)} id="pp-key" harpType={type} />
        {!unsupported && <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? 'Tắt micro' : 'Bật micro'}
        </button>}
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      {unsupported && <div className="card">
        {isDanBau(type) ? <p>Đàn bầu có trang tập riêng: <Link to="/tap-boi-am">Tập bồi âm, nắn cần</Link>.</p>
          : isFretted(type) ? <p>Guitar / ukulele: dùng <Link to="/tap-hop-am">Tập hợp âm</Link>.</p>
          : <p>Loại nhạc cụ này không có bài tập cao độ (nốt cố định). Chọn loại khác ở trên.</p>}
      </div>}

      {hasBend && hasHold && (
        <div className="segmented bp-mode" role="tablist" aria-label="Bài tập">
          <button type="button" role="tab" aria-selected={curMode === 'bend'} className={curMode === 'bend' ? 'on' : ''} onClick={() => setMode('bend')}>{bendWord}</button>
          <button type="button" role="tab" aria-selected={curMode === 'hold'} className={curMode === 'hold' ? 'on' : ''} onClick={() => setMode('hold')}>Giữ nốt dài</button>
        </div>
      )}

      {curMode === 'bend' && d && <>
        <div className="segmented bp-nodes pp-drills" role="tablist" aria-label="Nốt cần tập">
          {drills.map((x, i) => (
            <button key={x.token} type="button" role="tab" aria-selected={x === d} className={x === d ? 'on' : ''} onClick={() => setDrillIdx(i)}>
              <span className="bp-frac"><TokenText token={x.token} /></span>
              <small>{name(x.target)}{done[x.token] ? ` ✓${done[x.token]}` : ''}</small>
            </button>
          ))}
        </div>
        <section className="bp-target">
          <p>
            {tranh ? <>Gảy dây <strong>{d.baseToken}</strong> ({name(d.base)}), tay trái nhấn cho cao lên {d.bend === 1 ? 'nửa cung' : 'một cung'} tới <strong>{name(d.target)}</strong>.</>
              : <>{d.token.startsWith('-') ? 'Hút' : 'Thổi'} <strong>{d.baseToken}</strong> ({name(d.base)}), rồi bend xuống {-d.bend === 1 ? 'nửa cung' : -d.bend === 2 ? 'một cung' : 'một cung rưỡi'} tới <strong>{name(d.target)}</strong>.</>}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { previewNote(d.base, 0.7); setTimeout(() => previewNote(d.target, 1.2), 750); }}>Nghe mẫu</button>
        </section>
        <BendMeter base={d.base} target={d.target} midi={midi} name={name} />
        {(() => {
          const st = bendStatus(midi, d.target, d.bend);
          const cls = flash || st.status === 'ok' ? ' k-ok' : st.status === 'none' ? '' : ' k-open';
          return (
            <section className={`bp-result${on ? cls : ''}`} aria-live="polite">
              {!on ? <p className="muted">Bật micro để bắt đầu. Nơi yên tĩnh, điện thoại cách khoảng một gang tay.</p> : <>
                <strong className="bp-kind">{flash ? 'Đạt!' : STATUS_LABEL[st.status]}{!flash && st.status !== 'none' ? ` (${st.cents > 0 ? '+' : ''}${st.cents} cent)` : ''}</strong>
                <p>{flash ? (tranh ? 'Giữ đúng được nửa giây. Nhả tay, gảy lại để tập lần nữa.' : 'Giữ đúng được nửa giây. Nhả về nốt gốc rồi bend lại.') : bendAdvice(st.status, d, type)}</p>
              </>}
            </section>
          );
        })()}
        {droneOk && <label className="check"><input type="checkbox" checked={drone} onChange={(e) => setDrone(e.target.checked)} /> Tiếng bass nền (nốt chủ ngân trầm)</label>}
        <p className="small muted">{tranh
          ? 'Nhấn cách nhạn khoảng một gang tay, ngón trỏ + giữa ấn đều. Nhấn một cung cần lực mạnh hơn nhiều so với nửa cung.'
          : 'Bend bằng hình dạng khoang miệng, không phải bằng sức hút. Đau họng hay kèn kêu tịt là đang hút quá mạnh — nghỉ một chút.'}</p>
      </>}

      {curMode === 'hold' && holdNote && <>
        <label className="field" htmlFor="pp-note">
          <span className="field-label">Nốt</span>
          <select id="pp-note" value={hi} onChange={(e) => setHoldIdx(Number(e.target.value))}>
            {holdNotes.map((n, i) => <option key={n.token} value={i}>{n.token === midiToName(n.midi) ? midiToName(n.midi, settings.noteNames) : `${n.token} · ${midiToName(n.midi, settings.noteNames)}`}{best[`${type}:${n.midi}`] ? ` (kỷ lục ${best[`${type}:${n.midi}`]}s)` : ''}</option>)}
          </select>
        </label>
        <section className="bp-target">
          {holdNote.fingers && <FingeringIcon fingers={holdNote.fingers} size="l" />}
          <p>{holdNote.token !== midiToName(holdNote.midi) && <><strong><TokenText token={holdNote.token} /></strong> · </>}<strong>{midiToName(holdNote.midi, settings.noteNames)}</strong>. Hít sâu, {tranh ? 'gảy' : 'thổi'} nhẹ và đều, giữ tới khi hết hơi.</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => previewNote(holdNote.midi, 2)}>Nghe mẫu</button>
        </section>
        <div className="pp-hold" aria-live="off">
          <div className="pp-bar"><span style={{ width: `${Math.min(100, (100 * (live?.secs ?? 0)) / HOLD_GOAL)}%` }} className={live && live.secs >= HOLD_GOAL ? 'full' : ''} /></div>
          <div className="pp-nums">
            <strong>{(live?.secs ?? 0).toFixed(1)}s</strong>
            <span>{live ? `${live.cents > 0 ? '+' : ''}${live.cents} cent · chao ±${live.spread}` : on ? (midi !== null ? `Đang ra ${midiToName(Math.round(midi), settings.noteNames)} — chưa đúng nốt` : 'Đang nghe…') : 'Bật micro để bắt đầu'}</span>
          </div>
          <div className="cents-meter" aria-hidden="true">
            <div className="cm-track"><div className="cm-center" /><div className="cm-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, live?.cents ?? 0))}%`, opacity: live ? 1 : 0 }} /></div>
          </div>
        </div>
        {holds.length > 0 && (
          <ul className="pp-results">
            {holds.map((r, i) => { const g = holdGrade(r); return <li key={i} className={g.ok ? 'ok' : ''}>{g.ok ? '✓ ' : ''}{g.text}</li>; })}
          </ul>
        )}
        {droneOk && <label className="check"><input type="checkbox" checked={drone} onChange={(e) => setDrone(e.target.checked)} /> Tiếng bass nền (nốt chủ ngân trầm)</label>}
        <p className="small muted">Kỷ lục chỉ tính lần giữ vững (chao dưới ±15 cent). Giữ nốt dài đều là bài khởi động tốt nhất mỗi buổi tập: 5 nốt, mỗi nốt 3 lần.</p>
      </>}
    </div>
  );
}
