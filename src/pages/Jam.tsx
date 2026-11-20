import { useEffect, useMemo, useState } from 'react';
import { usePracticeTimer } from '../lib/practiceLog';
import { JazzJam } from './JazzJam';
import { BRAND, IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP, IS_PIANICA_APP, IS_ORGAN_APP } from '../appConfig';
import { lickForRecorder } from '../lib/jazz';
import { Link } from 'react-router-dom';
import { HarpKey, harpName, HarpType, isFixedKey, isKalimba, keyOffset, pitchClassName, recorderKey } from '../lib/harp';
import {
  BAR_BEATS, barAt, BARS, bluesChords, bluesDegrees, bluesOverrides, bluesScaleTokens, bluesTonic, BluesVariant,
  CALL_BARS, chordToneTokens, isCallBar, jamEvents, lickEvents, pentatonicTokens, usesFlats,
} from '../lib/blues';
import { Lick, LICK_PLACES, lickDegrees, LICKS as HARP_LICKS } from '../data/licks';
import { KALIMBA_LICKS } from '../data/kalimbaLicks';
import { chordName } from '../audio/harmony';
import { HarpDiagram } from '../components/HarpDiagram';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { PlayerBar } from '../components/PlayerBar';
import { TabView, TokenText } from '../components/TabView';
import { usePlayer } from '../components/usePlayer';
import { useWakeLock } from '../components/useWakeLock';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';
import { parseTab } from '../lib/tabText';
import { t as tx } from '../lib/i18n';
import { localizeLick, tl } from '../lib/i18nData';
import { LangToggle } from '../components/LangToggle';

/**
 * Tập ngẫu hứng blues: nền nhạc 12 ô nhịp chạy lặp (vị trí 2), hiện hợp âm đang vang và các lỗ thang âm blues để tự thổi;
 * bật "Máy hỏi, bạn đáp" thì app chơi lick mẫu 2 ô rồi chừa 2 ô cho người chơi đáp. Thư viện lick: nghe từng câu trên nền nhạc.
 */

const PIN_KEY = 'harptabs.jamPins';
const loadPins = (): string[] => { try { return JSON.parse(localStorage.getItem(PIN_KEY) ?? '[]'); } catch { return []; } };
const savePins = (ids: string[]) => { try { localStorage.setItem(PIN_KEY, JSON.stringify(ids)); } catch { /* không lưu được thì thôi */ } };

// kalimba: lick riêng ghi bằng tab số (thang ngũ cung), các app khác: lick kèn đổi theo nhạc cụ
const LICKS = (IS_KALIMBA_APP ? KALIMBA_LICKS : HARP_LICKS).map(localizeLick);
const placeName = (k: Lick['over']) => tl(LICK_PLACES[k]);

/** chọn lick cho các ô "hỏi": ưu tiên lick đã ghim, đổi vòng theo `seed` */
function pickCalls(seed: number, pins: string[]) {
  return CALL_BARS.map(({ bar, degree }, i) => {
    const all = LICKS.filter((l) => l.over === degree);
    const pinned = all.filter((l) => pins.includes(l.id));
    const pool = pinned.length ? pinned : all;
    return { bar, lick: pool[(seed + i * 7) % pool.length] };
  });
}

function BluesJam() {
  const { settings } = useAppState();
  const [tab, setTab] = useState<'jam' | 'licks'>('jam');
  const [harpKey0, setHarpKey] = useState<HarpKey>(settings.defaultHarpKey);
  // app sáo: chọn loại sáo và giọng blues; lick (viết theo lỗ kèn) đổi sang tên nốt
  const rec = IS_RECORDER_APP || IS_GUITAR_APP || IS_PIANICA_APP || IS_ORGAN_APP;
  // kalimba: blues giọng trưởng ở vị trí 1 (kalimba C chơi blues Đô), chỉ tô thang ngũ cung
  const kal = IS_KALIMBA_APP;
  const [harpType, setHarpType] = useState<HarpType>(kal ? (isKalimba(settings.defaultHarpType) ? settings.defaultHarpType : 'kalimba17') : isFixedKey(settings.defaultHarpType) ? settings.defaultHarpType : IS_GUITAR_APP ? 'guitar6' : IS_PIANICA_APP ? 'pianica32' : IS_ORGAN_APP ? 'organ61' : rec ? 'recorderAlto' : 'diatonic');
  const harpKey = rec ? recorderKey(harpType) : harpKey0;
  const [recTonic, setRecTonic] = useState(() => (((keyOffset(recorderKey(harpType)) % 12) + 12) % 12));
  const conv = (body: string) => (rec ? lickForRecorder(body, recTonic, harpType) : body);
  const [variant, setVariant] = useState<BluesVariant>('basic');
  const [callResponse, setCallResponse] = useState(false);
  const [seed, setSeed] = useState(0);
  const [pins, setPins] = useState<string[]>(loadPins);
  const [lickId, setLickId] = useState<string>(LICKS[0].id);
  const [level, setLevel] = useState<0 | 1 | 2 | 3>(0);
  const [place, setPlace] = useState<Lick['over'] | 'all'>('all');

  const tonic = rec ? recTonic : kal ? keyOffset(harpKey) % 12 : bluesTonic(harpKey);
  const songKey = pitchClassName(tonic);
  const flats = usesFlats(tonic);
  const chords = useMemo(() => bluesChords(tonic, variant), [tonic, variant]);
  const degrees = useMemo(() => bluesDegrees(variant), [variant]);
  const scale = useMemo(() => (kal ? pentatonicTokens(harpKey, harpType, tonic) : rec ? bluesScaleTokens(harpKey, harpType, tonic) : bluesScaleTokens(harpKey)), [kal, rec, harpKey, harpType, tonic]);
  const lick = LICKS.find((l) => l.id === lickId) ?? LICKS[0];
  const calls = useMemo(() => pickCalls(seed, pins), [seed, pins]);

  // hai chế độ dùng chung một bộ phát: nền 12 ô (có thể xen lick hỏi) hoặc một lick lặp trên nền hợp âm của nó
  const { flat, overrides, bars } = useMemo(() => {
    if (tab === 'licks') {
      const names = lickDegrees(lick).map((d) => chordName((tonic + { I: 0, IV: 5, V: 7 }[d]) % 12, false, flats, true));
      return { flat: jamEvents(harpKey, lick.bars, [{ bar: 0, body: conv(lick.body) }], { tonic, harpType }), overrides: bluesOverrides(names), bars: lick.bars };
    }
    return {
      flat: jamEvents(harpKey, BARS, callResponse ? calls.map((c) => ({ bar: c.bar, body: conv(c.lick.body) })) : [], { tonic, harpType }),
      overrides: bluesOverrides(chords),
      bars: BARS,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- conv chỉ đổi theo recTonic / harpType (đã có trong danh sách)
  }, [tab, lick, tonic, flats, harpKey, harpType, recTonic, callResponse, calls, chords]);

  const p = usePlayer(flat, {
    bpm: 84, tempoScale: 1, beatsPerBar: BAR_BEATS, pickupBeats: 0, style: 'shuffle', melody: true, beat: true, click: false, countIn: true,
    songKey, chordOverrides: overrides, loop: { start: 0, end: bars * BAR_BEATS },
  });
  const { setOpts, stop } = p;
  useEffect(() => { setOpts({ loop: { start: 0, end: bars * BAR_BEATS } }); }, [bars, setOpts]);
  // đổi chế độ / lick / tông kèn: dừng để không lẫn với vòng đang chạy
  useEffect(() => { stop(); }, [tab, lickId, harpKey, harpType, recTonic, stop]);
  // máy "hỏi" cần giai điệu: về Jam thì bật lại (thư viện lick có thể đã tắt để tự thổi)
  useEffect(() => { if (tab === 'jam') setOpts({ melody: true }); }, [tab, setOpts]);
  useWakeLock(p.playing);
  usePracticeTimer('ngau-hung', p.playing);

  const togglePin = (id: string) => {
    const next = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id];
    setPins(next);
    savePins(next);
  };

  const cur = p.active != null ? flat[p.active] : null;
  const bar = cur ? barAt(cur.start) : null;
  const deg = bar != null ? (tab === 'licks' ? lickDegrees(lick)[bar % lick.bars] : degrees[bar]) : null;
  const tones = useMemo(() => (deg ? chordToneTokens(harpKey, deg, harpType, tonic) : []), [harpKey, deg, harpType, tonic]);
  const callNow = tab === 'jam' && callResponse && bar != null ? calls.find((c) => bar === c.bar || bar === c.bar + 1) : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- conv chỉ đổi theo recTonic / harpType
  const lickBody = useMemo(() => conv(lick.body), [lick.body, recTonic, harpType]);
  const lickParsed = useMemo(() => parseTab(lickBody, harpKey, harpType), [lickBody, harpKey, harpType]);
  const lickFlat = useMemo(() => lickEvents(lickBody, harpKey, harpType), [lickBody, harpKey, harpType]);
  // nốt đang phát của lick: ánh xạ từ chuỗi sự kiện của bộ phát sang tab của lick (cùng thời điểm bắt đầu)
  const lickActive = tab === 'licks' && cur?.token ? lickFlat.findIndex((e) => Math.abs(e.start - cur.start) < 1e-6) : null;

  const shown = LICKS.filter((l) => (level === 0 || l.level === level) && (place === 'all' || l.over === place));

  return (
    <>
      {rec
        ? <p className="muted small">{tx('Blues giọng')} <strong>{songKey}</strong> {tx('trên')} {harpName(harpKey, harpType).toLowerCase()}. {IS_GUITAR_APP ? tx('Lick được xếp lên cần đàn (dây.phím) theo giọng bạn chọn.') : tx('Lick được đổi sang tên nốt và thế bấm theo giọng bạn chọn.')}</p>
        : kal ? <p className="muted small">{tx('Blues giọng')} <strong>{songKey}</strong> {tx('trên {0}. Kalimba không có nốt giáng nên tập bằng thang ngũ cung 1 2 3 5 6: gảy nốt nào trong đó cũng hợp nền nhạc.', harpName(harpKey, harpType))}</p>
        : <p className="muted small">{tx('Vị trí 2: {0} chơi blues giọng', harpName(harpKey))} <strong>{songKey}</strong>{tx('. Tab tính theo lỗ nên đổi kèn vẫn thổi y như vậy.')}</p>}
      {!rec && !kal && settings.defaultHarpType !== 'diatonic' && <p className="alert">{tx('Trang này dành cho kèn diatonic 10 lỗ (kiểu blues phổ biến nhất).')}</p>}

      <div className="row gap wrap end-align">
        {rec ? <>
          <HarpTypeSelect value={harpType} onChange={(t) => isFixedKey(t) && setHarpType(t)} />
          <label className="field">
            <span className="field-label">{tx('Giọng blues')}</span>
            <select value={recTonic} onChange={(e) => setRecTonic(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{chordName(i, false, usesFlats(i))}</option>)}
            </select>
          </label>
        </> : kal ? <>
          <HarpTypeSelect value={harpType} onChange={(t) => isKalimba(t) && setHarpType(t)} />
          <KeySelect value={harpKey} onChange={(k) => k !== 'auto' && setHarpKey(k)} label={tx('Tông kalimba')} harpType={harpType} />
        </> : <KeySelect value={harpKey} onChange={(k) => k !== 'auto' && setHarpKey(k)} label={tx('Kèn của bạn')} />}
        <div className="segmented" role="tablist" aria-label={tx('Chế độ')}>
          <button type="button" role="tab" aria-selected={tab === 'jam'} className={tab === 'jam' ? 'on' : ''} onClick={() => setTab('jam')}>{tx('Jam 12 ô')}</button>
          <button type="button" role="tab" aria-selected={tab === 'licks'} className={tab === 'licks' ? 'on' : ''} onClick={() => setTab('licks')}>{tx('Thư viện lick')}</button>
        </div>
      </div>

      {tab === 'jam' ? (
        <>
          <div className="row gap wrap center">
            <div className="segmented" role="group" aria-label={tx('Kiểu khung')}>
              <button type="button" className={variant === 'basic' ? 'on' : ''} aria-pressed={variant === 'basic'} onClick={() => setVariant('basic')}>{tx('Cơ bản')}</button>
              <button type="button" className={variant === 'quick' ? 'on' : ''} aria-pressed={variant === 'quick'} onClick={() => setVariant('quick')}>Quick change</button>
            </div>
            <button type="button" className={`chip${callResponse ? ' on' : ''}`} aria-pressed={callResponse} onClick={() => setCallResponse(!callResponse)}>{tx('Máy hỏi, bạn đáp')}</button>
            {callResponse && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSeed((s) => s + 1)}>{tx('Đổi câu hỏi')}</button>}
          </div>

          <div className="jam-now" aria-live="polite">
            <div>
              <span className="muted small">{bar != null ? tx('Ô {0}/12', bar + 1) : p.countIn != null ? tx('Đếm vào {0}', p.countIn) : tx('Bấm phát để bắt đầu')}</span>
              <strong className="jam-chord">{p.chord ?? chords[0]}</strong>
              {bar != null && <span className="muted small">{tx('tiếp: {0}', chords[(bar + 1) % BARS])}</span>}
            </div>
            {callResponse && bar != null && (
              <span className={`jam-turn${callNow ? '' : ' you'}`}>{callNow ? tx('Máy hỏi: {0}', callNow.lick.title) : tx('Lượt bạn đáp!')}</span>
            )}
          </div>

          {/* nút phát ngay dưới dòng "Bấm phát để bắt đầu", không che khung 12 ô; cuộn xuống thì dính mép trên */}
          <PlayerBar p={p} className="pin-top" />

          <ol className="jam-grid" aria-label={tx('Khung 12 ô nhịp')}>
            {chords.map((c, i) => (
              <li key={i} className={`${bar === i ? 'on' : ''}${callResponse && isCallBar(i) ? ' call' : ''}`}>
                <span className="jg-n">{i + 1}</span>
                <span className="jg-c">{c}</span>
                <span className="jg-d">{degrees[i]}</span>
              </li>
            ))}
          </ol>

          <section>
            <h2 className="h-small">{kal ? tx('Thang ngũ cung') : tx('Thang âm blues')} {tx('trên')} {BRAND.noun} {tx('của bạn')}</h2>
            <p className="small muted">{tx('Khi nền nhạc chạy, {0} nốt nào trong các ô sáng cũng hợp. Chạm vào ô để nghe.', BRAND.verb)}</p>
            <HarpDiagram harpKey={harpKey} harpType={harpType} highlight={scale} nameStyle={settings.noteNames} />
            <p className="small">
              {tx('Nốt hợp âm đang vang (dừng câu ở đây nghe "chắc"):')}{' '}
              {tones.length ? tones.map((t) => <span key={t} className="jam-tone"><TokenText token={t} nameStyle={settings.noteNames} /></span>) : <span className="muted">{tx('phát nhạc để xem')}</span>}
            </p>
            <p className="small muted">{tx('Mẹo: chơi 2 ô, nghỉ 2 ô; lặp lại câu của mình rồi đổi một chút (nhịp, độ dài{0}). Khoảng lặng cũng là nhạc.', rec || kal ? '' : ', bend')}</p>
          </section>
        </>
      ) : (
        <>
          <div className="row gap wrap center">
            <div className="segmented" role="group" aria-label={tx('Mức độ')}>
              {([tx('Tất cả'), tx('Dễ'), tx('Vừa'), tx('Khó')] as const).map((label, i) => (
                <button key={label} type="button" className={level === i ? 'on' : ''} aria-pressed={level === i} onClick={() => setLevel(i as 0 | 1 | 2 | 3)}>{label}</button>
              ))}
            </div>
            <select value={place} onChange={(e) => setPlace(e.target.value as Lick['over'] | 'all')} aria-label={tx('Chỗ dùng trong khung')}>
              <option value="all">{tx('Mọi chỗ trong khung')}</option>
              {(Object.keys(LICK_PLACES) as Lick['over'][]).map((k) => <option key={k} value={k}>{placeName(k)}</option>)}
            </select>
          </div>

          <ul className="lick-list">
            {shown.map((l) => (
              <li key={l.id}>
                <button type="button" className={`lick-row${l.id === lick.id ? ' on' : ''}`} onClick={() => setLickId(l.id)} aria-pressed={l.id === lick.id}>
                  <span className="lk-title">{l.title}</span>
                  <span className="lk-meta">{['', tx('Dễ'), tx('Vừa'), tx('Khó')][l.level]} · {placeName(l.over)}{pins.includes(l.id) ? tx(' · đã ghim') : ''}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="muted small">{tx('Không có lick nào hợp bộ lọc.')}</li>}
          </ul>

          <section className="lick-detail">
            <h2 className="h-small">{lick.title}</h2>
            <p className="small muted">{tx('{0} · nền: {1}', placeName(lick.over), lickDegrees(lick).map((d) => chordName((tonic + { I: 0, IV: 5, V: 7 }[d]) % 12, false, flats, true)).join(' → '))}</p>
            <TabView parsed={lickParsed} flat={lickFlat} active={lickActive != null && lickActive >= 0 ? lickActive : null} size="m" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={harpType} harpKey={harpKey} />
            {lick.tip && <p className="small">{lick.tip}</p>}
            <div className="row gap wrap">
              <button type="button" className={`chip${!p.opts.melody ? ' on' : ''}`} aria-pressed={!p.opts.melody} onClick={() => setOpts({ melody: !p.opts.melody })}>{tx('Tắt giai điệu, tôi tự {0}', BRAND.verb)}</button>
              <button type="button" className={`chip${pins.includes(lick.id) ? ' on' : ''}`} aria-pressed={pins.includes(lick.id)} onClick={() => togglePin(lick.id)}>{tx('Dùng trong hỏi–đáp')}</button>
            </div>
            <p className="small muted">{tx('Bấm phát: lick lặp liên tục trên nền nhạc. Nghe vài lượt, rồi tắt giai điệu và {0} theo.', BRAND.verb)}</p>
          </section>
        </>
      )}

      {tab !== 'jam' && <PlayerBar p={p} />}
    </>
  );
}

const GENRE_KEY = 'harptabs.jamGenre';

/** Tập ngẫu hứng: chọn blues (vị trí 2, 12 ô) hoặc jazz (vòng ii–V–I…); nhớ lựa chọn trên máy */
export default function Jam() {
  const [picked, setGenre] = useState<'blues' | 'jazz'>(() => { try { return localStorage.getItem(GENRE_KEY) === 'jazz' ? 'jazz' : 'blues'; } catch { return 'blues'; } });
  // kalimba chỉ có nốt của một giọng trưởng: hợp âm jazz (m7b5, dim7…) thiếu nốt nên chỉ có blues
  const genre = IS_KALIMBA_APP ? 'blues' : picked;
  const pick = (g: 'blues' | 'jazz') => { setGenre(g); try { localStorage.setItem(GENRE_KEY, g); } catch { /* không lưu được thì thôi */ } };
  return (
    <div className="page page-jam">
      <header className="page-head">
        <div className="row gap center">
          <Link to="/learn" className="icon-btn" aria-label={tx('Về trang Học')}><Icon name="back" /></Link>
          <h1>{tx('Tập ngẫu hứng')}</h1>
        </div>
        {!IS_KALIMBA_APP && (
          <div className="segmented" role="tablist" aria-label={tx('Thể loại')}>
            <button type="button" role="tab" aria-selected={genre === 'blues'} className={genre === 'blues' ? 'on' : ''} onClick={() => pick('blues')}>Blues</button>
            <button type="button" role="tab" aria-selected={genre === 'jazz'} className={genre === 'jazz' ? 'on' : ''} onClick={() => pick('jazz')}>Jazz</button>
          </div>
        )}
        <LangToggle />
      </header>
      {genre === 'blues' ? <BluesJam key="blues" /> : <JazzJam key="jazz" />}
    </div>
  );
}
