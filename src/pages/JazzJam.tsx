import { useEffect, useMemo, useState } from 'react';
import { HarpKey, HarpType, isTremolo, keyOffset, pitchClassName } from '../lib/harp';
import { BAR_BEATS, jamEvents, lickEvents } from '../lib/blues';
import { chordAtBeat, chordTones, lickToTab, PlacedChord, progressionBars, progressionChords, progressionOverrides, PROGRESSIONS } from '../lib/jazz';
import { JazzLick, jazzLickPlace, JAZZ_LICKS } from '../data/jazzLicks';
import { chordName } from '../audio/harmony';
import { HarpDiagram } from '../components/HarpDiagram';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { PlayerBar } from '../components/PlayerBar';
import { TabView, TokenText } from '../components/TabView';
import { usePlayer } from '../components/usePlayer';
import { useWakeLock } from '../components/useWakeLock';
import { useAppState } from '../state';
import { parseTab } from '../lib/tabText';

/**
 * Tập ngẫu hứng jazz: vòng hợp âm (ii–V–I, I–vi–ii–V, Autumn Leaves, jazz blues) chạy lặp với nhịp swing + bass walking,
 * hiện nốt của hợp âm đang vang trên kèn (nhấn nốt 3 và 7). "Máy hỏi, bạn đáp": cứ 4 ô máy chơi lick 2 ô ở chỗ có lick hợp.
 */

const PIN_KEY = 'harptabs.jazzPins';
const loadPins = (): string[] => { try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]'); } catch { return []; } };
const savePins = (ids: string[]) => { try { localStorage.setItem(PIN_KEY, JSON.stringify(ids)); } catch { /* không lưu được thì thôi */ } };

const pc = (n: number) => ((n % 12) + 12) % 12;
const KEYS = Array.from({ length: 12 }, (_, i) => i);
const keyLabel = (t: number) => chordName(t, false, [5, 10, 3, 8, 1].includes(t));

/** lick khớp với chuỗi hợp âm bắt đầu ở phách `start` của vòng (so theo quãng giữa các gốc và loại hợp âm) */
function lickFits(l: JazzLick, chords: PlacedChord[], start: number): number | null {
  let t = start;
  let root0: number | null = null;
  for (const c of l.chords) {
    const ch = chords.find((x) => Math.abs(x.start - t) < 1e-6);
    if (!ch || Math.abs(ch.beats - c.beats) > 1e-6 || ch.q !== c.q) return null;
    if (root0 === null) root0 = ch.root;
    if (pc(ch.root - root0) !== c.rel) return null;
    t += c.beats;
  }
  return root0;
}

export function JazzJam() {
  const { settings } = useAppState();
  const [tab, setTab] = useState<'jam' | 'licks'>('jam');
  const [harpKey, setHarpKey] = useState<HarpKey>(settings.defaultHarpKey);
  const [harpType, setHarpType] = useState<HarpType>(isTremolo(settings.defaultHarpType) ? 'diatonic' : settings.defaultHarpType);
  const [tonic, setTonic] = useState(() => pc(keyOffset(settings.defaultHarpKey)));
  const [progId, setProgId] = useState(PROGRESSIONS[0].id);
  const [callResponse, setCallResponse] = useState(false);
  const [seed, setSeed] = useState(0);
  const [pins, setPins] = useState<string[]>(loadPins);
  const [lickId, setLickId] = useState(JAZZ_LICKS[0].id);

  const prog = PROGRESSIONS.find((p) => p.id === progId) ?? PROGRESSIONS[0];
  const chords = useMemo(() => progressionChords(prog, tonic), [prog, tonic]);
  const bars = progressionBars(prog);
  const lick = JAZZ_LICKS.find((l) => l.id === lickId) ?? JAZZ_LICKS[0];

  // cứ 4 ô: máy chơi 2 ô đầu nếu có lick hợp chuỗi hợp âm ở đó (ưu tiên lick đã ghim), 2 ô sau là lượt bạn
  const calls = useMemo(() => {
    const out: { bar: number; lick: JazzLick; body: string }[] = [];
    for (let b = 0; b < bars; b += 4) {
      const fits = JAZZ_LICKS.map((l) => ({ l, root: lickFits(l, chords, b * BAR_BEATS) })).filter((x) => x.root !== null);
      const pinned = fits.filter((x) => pins.includes(x.l.id));
      const pool = pinned.length ? pinned : fits;
      if (!pool.length) continue;
      const pick = pool[(seed + b) % pool.length];
      out.push({ bar: b, lick: pick.l, body: lickToTab(pick.l.notes, pc(pick.root! - pick.l.deg), harpKey, harpType).body });
    }
    return out;
  }, [bars, chords, pins, seed, harpKey, harpType]);

  // thư viện: lick ở giọng đã chọn, nền là đúng chuỗi hợp âm của lick
  const lickTab = useMemo(() => lickToTab(lick.notes, tonic, harpKey, harpType), [lick, tonic, harpKey, harpType]);
  const lickChords = useMemo<PlacedChord[]>(() => {
    let t = 0;
    const flats = [5, 10, 3, 8, 1].includes(tonic);
    return lick.chords.map((c) => {
      const root = pc(tonic + lick.deg + c.rel);
      const name = c.q === '' || c.q === 'm' || c.q === '7' ? chordName(root, c.q === 'm', flats, c.q === '7') : chordName(root, true, flats, c.q);
      const out = { start: t, beats: c.beats, name, root, q: c.q };
      t += c.beats;
      return out;
    });
  }, [lick, tonic]);
  const lickBars = Math.round(lickChords.reduce((t, c) => t + c.beats, 0) / BAR_BEATS);

  const { flat, overrides, loopBars, shown } = useMemo(() => {
    if (tab === 'licks') {
      return { flat: jamEvents(harpKey, lickBars, [{ bar: 0, body: lickTab.body }], { tonic, harpType }), overrides: progressionOverrides(lickChords), loopBars: lickBars, shown: lickChords };
    }
    return {
      flat: jamEvents(harpKey, bars, callResponse ? calls.map((c) => ({ bar: c.bar, body: c.body })) : [], { tonic, harpType }),
      overrides: progressionOverrides(chords), loopBars: bars, shown: chords,
    };
  }, [tab, harpKey, lickBars, lickTab.body, tonic, harpType, lickChords, bars, callResponse, calls, chords]);

  const p = usePlayer(flat, {
    bpm: 120, tempoScale: 1, beatsPerBar: BAR_BEATS, pickupBeats: 0, style: 'jazz', melody: true, beat: true, click: false, countIn: true,
    songKey: pitchClassName(tonic) + (prog.minor ? 'm' : ''), chordOverrides: overrides, loop: { start: 0, end: loopBars * BAR_BEATS },
  });
  const { setOpts, stop } = p;
  useEffect(() => { setOpts({ loop: { start: 0, end: loopBars * BAR_BEATS } }); }, [loopBars, setOpts]);
  useEffect(() => { stop(); }, [tab, lickId, harpKey, harpType, tonic, progId, stop]);
  useEffect(() => { if (tab === 'jam') setOpts({ melody: true }); }, [tab, setOpts]);
  useWakeLock(p.playing);

  const cur = p.active != null ? flat[p.active] : null;
  const now = cur ? chordAtBeat(shown, cur.start) : null;
  const total = loopBars * BAR_BEATS;
  const next = cur && now ? chordAtBeat(shown, (now.start + now.beats) % total) : null;
  const bar = cur ? Math.floor((((cur.start % total) + total) % total) / BAR_BEATS) : null;
  const focus = now ?? shown[0];
  const tones = useMemo(() => chordTones(harpKey, harpType, focus.root, focus.q), [harpKey, harpType, focus.root, focus.q]);
  const callNow = tab === 'jam' && callResponse && bar != null ? calls.find((c) => bar === c.bar || bar === c.bar + 1) : undefined;

  const lickParsed = useMemo(() => parseTab(lickTab.body, harpKey, harpType), [lickTab.body, harpKey, harpType]);
  const lickFlat = useMemo(() => lickEvents(lickTab.body, harpKey, harpType), [lickTab.body, harpKey, harpType]);
  const lickActive = tab === 'licks' && cur?.token ? lickFlat.findIndex((e) => Math.abs(e.start - cur.start) < 1e-6) : -1;

  const togglePin = (id: string) => {
    const nx = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    setPins(nx);
    savePins(nx);
  };

  // các ô nhịp: mỗi ô 1–2 hợp âm
  const grid = Array.from({ length: bars }, (_, i) => chords.filter((c) => c.start >= i * BAR_BEATS - 1e-6 && c.start < (i + 1) * BAR_BEATS - 1e-6));

  return (
    <>
      <p className="muted small">
        Jazz đổi hợp âm liên tục và cần đủ 12 nốt: hợp nhất là <strong>kèn chromatic</strong>; kèn diatonic chơi được nhưng nhiều nốt phải bend / overblow.
      </p>
      <div className="row gap wrap end-align">
        <HarpTypeSelect value={harpType} onChange={(t) => setHarpType(isTremolo(t) ? 'diatonic' : t)} />
        <KeySelect value={harpKey} onChange={(k) => k !== 'auto' && setHarpKey(k)} label="Kèn của bạn" harpType={harpType} />
        <label className="field">
          <span className="field-label">Giọng</span>
          <select value={tonic} onChange={(e) => setTonic(Number(e.target.value))}>
            {KEYS.map((k) => <option key={k} value={k}>{keyLabel(k)}{prog.minor ? ' thứ' : ''}</option>)}
          </select>
        </label>
        <div className="segmented" role="tablist" aria-label="Chế độ">
          <button type="button" role="tab" aria-selected={tab === 'jam'} className={tab === 'jam' ? 'on' : ''} onClick={() => setTab('jam')}>Jam</button>
          <button type="button" role="tab" aria-selected={tab === 'licks'} className={tab === 'licks' ? 'on' : ''} onClick={() => setTab('licks')}>Thư viện lick</button>
        </div>
      </div>

      {tab === 'jam' ? (
        <>
          <div className="row gap wrap center">
            <label className="field grow">
              <span className="field-label">Vòng hợp âm</span>
              <select value={progId} onChange={(e) => setProgId(e.target.value)}>
                {PROGRESSIONS.map((pr) => <option key={pr.id} value={pr.id}>{pr.title} ({progressionBars(pr)} ô)</option>)}
              </select>
            </label>
            <button type="button" className={`chip${callResponse ? ' on' : ''}`} aria-pressed={callResponse} onClick={() => setCallResponse(!callResponse)}>Máy hỏi, bạn đáp</button>
            {callResponse && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSeed((s) => s + 1)}>Đổi câu hỏi</button>}
          </div>
          <p className="small muted">{prog.hint}</p>

          <div className="jam-now" aria-live="polite">
            <div>
              <span className="muted small">{bar != null ? `Ô ${bar + 1}/${bars}` : p.countIn != null ? `Đếm vào ${p.countIn}` : 'Bấm phát để bắt đầu'}</span>
              <strong className="jam-chord">{focus.name}</strong>
              {next && <span className="muted small">tiếp: {next.name}</span>}
            </div>
            {callResponse && bar != null && (
              <span className={`jam-turn${callNow ? '' : ' you'}`}>{callNow ? `Máy hỏi: ${callNow.lick.title}` : 'Lượt bạn đáp!'}</span>
            )}
          </div>

          <ol className="jam-grid" aria-label="Các ô nhịp">
            {grid.map((cs, i) => (
              <li key={i} className={`${bar === i ? 'on' : ''}${callResponse && calls.some((c) => i === c.bar || i === c.bar + 1) ? ' call' : ''}`}>
                <span className="jg-n">{i + 1}</span>
                <span className="jg-c jg-jazz">{cs.map((c) => c.name).join(' ')}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <ul className="lick-list">
            {JAZZ_LICKS.map((l) => (
              <li key={l.id}>
                <button type="button" className={`lick-row${l.id === lick.id ? ' on' : ''}`} onClick={() => setLickId(l.id)} aria-pressed={l.id === lick.id}>
                  <span className="lk-title">{l.title}</span>
                  <span className="lk-meta">{['', 'Dễ', 'Vừa', 'Khó'][l.level]} · {jazzLickPlace(l)}{pins.includes(l.id) ? ' · đã ghim' : ''}</span>
                </button>
              </li>
            ))}
          </ul>
          <section className="lick-detail">
            <h2 className="h-small">{lick.title}</h2>
            <p className="small muted">{jazzLickPlace(lick)} · nền: {lickChords.map((c) => c.name).join(' → ')}</p>
            {lickTab.unplayable > 0 && <p className="small">Có {lickTab.unplayable} nốt kèn này không thổi được (thành dấu nghỉ) — thử kèn chromatic hoặc đổi giọng.</p>}
            <TabView parsed={lickParsed} flat={lickFlat} active={lickActive >= 0 ? lickActive : null} size="m" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
            {lick.tip && <p className="small">{lick.tip}</p>}
            <div className="row gap wrap">
              <button type="button" className={`chip${!p.opts.melody ? ' on' : ''}`} aria-pressed={!p.opts.melody} onClick={() => setOpts({ melody: !p.opts.melody })}>Tắt giai điệu, tôi tự thổi</button>
              <button type="button" className={`chip${pins.includes(lick.id) ? ' on' : ''}`} aria-pressed={pins.includes(lick.id)} onClick={() => togglePin(lick.id)}>Dùng trong hỏi–đáp</button>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="h-small">Nốt của hợp âm {focus.name} trên kèn</h2>
        <p className="small muted">Ô sáng là nốt thuộc hợp âm đang vang (đổi theo từng hợp âm). Chạm vào ô để nghe.</p>
        <HarpDiagram harpKey={harpKey} harpType={harpType} highlight={tones.all} nameStyle={settings.noteNames} />
        <p className="small">
          Nốt 3 và 7 (nhắm vào đây khi đổi hợp âm):{' '}
          {tones.guide.map((t) => <span key={t} className="jam-tone"><TokenText token={t} /></span>)}
        </p>
        <p className="small muted">Mẹo: mỗi khi hợp âm đổi, cho câu của bạn rơi vào nốt 3 hoặc 7 của hợp âm mới; giữa đó đi liền bậc hoặc rải hợp âm.</p>
      </section>

      <PlayerBar p={p} />
    </>
  );
}
