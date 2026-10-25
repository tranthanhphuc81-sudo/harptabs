import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppState } from '../state';
import { MicPitch, VOICE_MIC } from '../audio/pitch';
import { KaraokeScorer, KaraokeSummary } from '../lib/karaokeScore';
import { loadBest, PracticeRecord, recordBest } from '../lib/practiceScore';
import { PitchStrip } from './PitchStrip';
import { KaraokeRecorder, recorderSupported } from '../audio/karaokeRecorder';
import { addRecording, listRecordings } from '../lib/recordings';
import { RecordingsPanel } from './RecordingsPanel';
import { BackingSetup } from './BackingSetup';
import { useBackingPlayer } from './useBackingPlayer';
import { loadBacking, tabSig } from '../lib/backings';
import type { Backing, MidiSource } from '../lib/types';
import { loadMidiSource, midiBytes, saveMidiSource } from '../lib/midiSources';
import { Arrangement, buildArrangement, matchMidiToTab } from '../lib/midiArrange';
import { harpName, harpTypeOf, shiftKey } from '../lib/harp';
import { buildKaraoke, countdownAt, holesFor, KLine, locate } from '../lib/karaoke';
import { DEFAULT_KARAOKE, KaraokeHoles, KaraokePrefs, loadKaraokePrefs, MAX_TRANSPOSE, saveKaraokePrefs } from '../lib/karaokePrefs';
import { FlatEvent, flatten, parseTab } from '../lib/tabText';
import type { Song } from '../lib/types';
import { viewSong } from '../lib/viewAs';
import { ChordSegment, transposeSpans } from '../audio/harmony';
import { Icon } from './Icon';
import { TokenText } from './TabView';
import type { PlayerState } from './usePlayer';
import { useFullscreen } from './useFullscreen';
import { useWakeLock } from './useWakeLock';

const HOLES_LABEL: Record<KaraokeHoles, string> = { same: 'Giữ số lỗ', myHarp: 'Xếp lại cho kèn đang xem', hide: 'Ẩn số lỗ' };

/** tên hợp âm gắn vào âm tiết: khúc hợp âm bắt đầu trong âm tiết nào thì hiện trên âm tiết đó */
function chordsByLine(lines: KLine[], segs: ChordSegment[]): Map<string, string> {
  const out = new Map<string, string>();
  let prev = '';
  for (const seg of segs) {
    // khúc liền sau cùng hợp âm (nửa ô nhịp nối tiếp): không hiện lại
    if (seg.chord.name === prev) continue;
    prev = seg.chord.name;
    for (let li = 0; li < lines.length; li++) {
      const l = lines[li];
      if (seg.start < l.start - 1e-6 || seg.start >= l.end - 1e-6) continue;
      let si = l.syls.findIndex((s) => seg.start >= s.start - 1e-6 && seg.start < s.end - 1e-6);
      if (si < 0) si = l.syls.findIndex((s) => s.start >= seg.start);
      if (si >= 0 && !out.has(`${li}.${si}`)) out.set(`${li}.${si}`, seg.chord.name);
      break;
    }
  }
  return out;
}

/**
 * Màn hình karaoke: lời to toàn màn hình, chữ đổi màu chạy theo tiếng hát, đếm ngược vào câu,
 * đổi tông cho hợp giọng. Dùng chung bộ phát của trang bài (đang bật Đệm hát).
 */
export default function KaraokeView({ song, original, flat, p, chordSegs, onClose }: {
  /** bài đang xem (có thể đã xếp lại cho kèn khác) — cùng số nốt, cùng phách với bài gốc */
  song: Song;
  original: Song;
  flat: FlatEvent[];
  p: PlayerState;
  chordSegs: ChordSegment[] | null;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(rootRef);
  useWakeLock(true);

  const [prefs, setPrefs] = useState<KaraokePrefs>(DEFAULT_KARAOKE);
  // người dùng đã chỉnh trước khi đọc xong cài đặt cũ: giữ cái vừa chỉnh, không ghi đè
  const touched = useRef(false);
  useEffect(() => {
    void loadKaraokePrefs(original.id).then((saved) => setPrefs((cur) => (touched.current ? cur : saved))).catch(() => {});
  }, [original.id]);
  const update = (patch: Partial<KaraokePrefs>) => setPrefs((cur) => {
    touched.current = true;
    const next = { ...cur, ...patch };
    void saveKaraokePrefs(original.id, next).catch(() => {});
    return next;
  });
  const t = prefs.transpose;

  // mở karaoke: bật Đệm hát (tắt giai điệu kèn) và đổi tông; đóng thì trả lại như cũ
  const { setOpts } = p;
  // nguồn nhạc: đệm tự tạo, bản phối MIDI gốc (bài nhập từ MIDI), nhạc nền MP3 — mặc định cái "thật" nhất đang có
  const [backing, setBacking] = useState<Backing | null>(null);
  const [midiSrc, setMidiSrc] = useState<MidiSource | null>(null);
  const [arr, setArr] = useState<Arrangement | null>(null);
  const [src, setSrc] = useState<'synth' | 'midi' | 'mp3'>('synth');
  const [showBacking, setShowBacking] = useState(false);
  useEffect(() => {
    void Promise.all([loadBacking(original.id).catch(() => null), loadMidiSource(original.id).catch(() => null)]).then(([b, m]) => {
      setBacking(b);
      setMidiSrc(m);
      setSrc(b ? 'mp3' : m ? 'midi' : 'synth');
    });
  }, [original.id]);
  useEffect(() => {
    setArr(null);
    if (!midiSrc) return;
    try { setArr(buildArrangement(midiBytes(midiSrc), midiSrc)); } catch { /* file hỏng: dùng đệm tự tạo */ }
  }, [midiSrc]);
  const useMp3 = src === 'mp3';
  const bk = useBackingPlayer(backing, flat);
  const mp3 = useMp3 && !!backing && bk.status === 'ready';
  const midi = src === 'midi' && !!arr;
  /** bộ phát đang dùng: nhạc nền MP3 hoặc tiếng tổng hợp — chữ chạy, chấm điểm, thu âm đều theo nó */
  const tp = mp3 ? bk : p;
  // trang bài tạo lại đối tượng bộ phát mỗi lần vẽ: giữ bản mới nhất trong ref để vòng chữ chạy không khởi động lại
  const pRef = useRef(tp);
  pRef.current = tp;
  // đổi nguồn nhạc giữa chừng: dừng cả hai
  const synthStop = p.stop;
  useEffect(() => { synthStop(); bk.stop(); }, [mp3, midi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setOpts({ arrangement: midi ? arr : null }); }, [midi, arr, setOpts]);
  const wasSing = useRef(!!p.opts.sing);
  useEffect(() => {
    const prev = wasSing.current;
    setOpts({ sing: true });
    void fs.enter();
    return () => { pRef.current.stop(); setOpts({ sing: prev, transpose: 0, arrangement: null }); void fs.exit(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở / đóng
  }, []);
  useEffect(() => { setOpts({ transpose: t }); }, [t, setOpts]);

  // lời + thời điểm theo bài gốc (bản xếp lại cho kèn khác có thể mất lời ở nốt không thổi được)
  const lyricFlat = useMemo(() => {
    const f = flatten(parseTab(original.body, original.harpKey, harpTypeOf(original)));
    return f.length === flat.length ? f : flat;
  }, [original, flat]);
  const lines = useMemo(() => buildKaraoke(lyricFlat), [lyricFlat]);

  // ----- chấm điểm giọng hát qua micro -----
  const { settings } = useAppState();
  const [scoring, setScoring] = useState(false);
  const [micErr, setMicErr] = useState<string | null>(null);
  const [live, setLive] = useState<number | null>(null);
  const [result, setResult] = useState<{ s: KaraokeSummary; rec: PracticeRecord | null; newBest: boolean } | null>(null);
  const scorer = useRef<KaraokeScorer | null>(null);
  const spb = mp3 ? bk.spb : 60 / Math.max(20, p.opts.bpm * p.opts.tempoScale);
  /** tông đang hát: nhạc tổng hợp = tông chọn; nhạc nền MP3 = giọng của file so với tab */
  const et = mp3 ? backing!.keyOffset : t;
  const spbRef = useRef(spb);
  spbRef.current = spb;
  const lagRef = useRef(0.06);
  lagRef.current = (settings.micLatencyMs ?? 60) / 1000;
  const scoreKey = `karaokeScore:${original.id}`;
  const newScorer = () => { scorer.current = new KaraokeScorer(lines, lyricFlat, spbRef.current, et); setLive(null); };

  // bật / tắt micro theo nút Chấm điểm; đổi "đeo tai nghe" thì mở lại micro (bật / tắt khử tiếng vọng)
  useEffect(() => {
    if (!scoring) return;
    const mic = new MicPitch({ ...VOICE_MIC, echoCancellation: !prefs.headphones });
    mic.onReading = (r) => {
      const sc = scorer.current, b = pRef.current.beatAt();
      if (!sc || b === null) return;
      // tiếng hát tới bộ dò trễ một chút: độ trễ micro + nửa cửa sổ phân tích
      sc.feed(r ? r.midi : null, b - (lagRef.current + mic.windowDelay) / spbRef.current);
    };
    let alive = true;
    mic.start()
      .then(() => { if (!alive) mic.stop(); else setMicErr(null); })
      .catch((e: Error) => {
        if (!alive) return;
        setMicErr(e.name === 'NotAllowedError' ? 'Cần cho phép dùng micro để chấm điểm' : e.message || 'Không mở được micro');
        setScoring(false);
      });
    return () => { alive = false; mic.stop(); };
  }, [scoring, prefs.headphones]);

  // bắt đầu hát: bộ chấm mới; dừng: tổng kết (hát quá ít thì thôi)
  const wasPlaying = useRef(false);
  const finish = async () => {
    const sc = scorer.current;
    scorer.current = null;
    setLive(null);
    if (!sc) return;
    const s0 = sc.summary();
    if (s0.done < 3) return;
    const s = { ...s0, finished: s0.done >= s0.total };
    const saved = s.finished ? await recordBest(scoreKey, s.score).catch(() => null) : null;
    const rec = saved?.rec ?? await loadBest(scoreKey).catch(() => null);
    setResult({ s, rec, newBest: !!saved?.newBest });
  };
  // ----- thu âm lượt hát (nhạc đệm + giọng) -----
  const { toast } = useAppState();
  const recorder = useRef<KaraokeRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [recStart, setRecStart] = useState(0);
  const [recElapsed, setRecElapsed] = useState(0);
  const [showRecs, setShowRecs] = useState(false);
  const [recCount, setRecCount] = useState(0);
  const [recRefresh, setRecRefresh] = useState(0);
  useEffect(() => { void listRecordings(original.id).then((r) => setRecCount(r.length)).catch(() => {}); }, [original.id, recRefresh]);
  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setRecElapsed((performance.now() - recStart) / 1000), 500);
    return () => window.clearInterval(id);
  }, [recording, recStart]);

  const saveTake = async (score?: number) => {
    const rec = recorder.current;
    recorder.current = null;
    setRecording(false);
    if (!rec) return;
    const take = await rec.stop();
    if (!take || take.durationSec < 2) return;
    try {
      await addRecording({
        songId: original.id, title: original.title || 'Karaoke', createdAt: Date.now(), durationSec: take.durationSec,
        mime: take.mime, blob: take.blob, voiceLagMs: take.voiceLagMs, transpose: t, score,
      });
      setRecRefresh((n) => n + 1);
      toast('Đã lưu bản thu — bấm "Bản thu" để nghe lại');
    } catch (e) {
      toast((e as Error).message || 'Không lưu được bản thu');
    }
  };

  const startRecording = async () => {
    if (recorder.current) return;
    const rec = new KaraokeRecorder();
    try {
      await rec.start(!prefs.headphones, (settings.micLatencyMs ?? 60) + (settings.syncOffsetMs ?? 0));
    } catch (e) {
      const err = e as Error;
      setMicErr(err.name === 'NotAllowedError' ? 'Cần cho phép dùng micro để thu âm' : err.message || 'Không mở được micro');
      return;
    }
    rec.onLimit = () => pRef.current.stop();
    recorder.current = rec;
    setMicErr(null);
    setRecStart(performance.now());
    setRecElapsed(0);
    setRecording(true);
    startFrom(shown);
  };
  // thoát karaoke giữa chừng: vẫn giữ lượt đang thu
  useEffect(() => () => { if (recorder.current) void saveTake(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tp.playing && !wasPlaying.current && scoring) { setResult(null); newScorer(); }
    if (!tp.playing && wasPlaying.current && recorder.current) {
      // điểm của lượt này (nếu đang chấm) lưu kèm bản thu — đọc trước khi tổng kết xoá bộ chấm
      const sm = scoring ? scorer.current?.summary() : undefined;
      void saveTake(sm && sm.done >= 3 ? sm.score : undefined);
    }
    if (!tp.playing && wasPlaying.current) void finish();
    wasPlaying.current = tp.playing;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi bắt đầu / dừng phát
  }, [tp.playing]);
  // bật chấm điểm khi đang hát, hoặc đổi tông giữa chừng: chấm lại từ đây
  useEffect(() => {
    if (!scoring) { scorer.current = null; setLive(null); return; }
    if (pRef.current.playing) newScorer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi bật chấm điểm / đổi tông
  }, [scoring, et]);
  // điểm tạm thời trong lúc hát
  useEffect(() => {
    if (!scoring || !tp.playing) return;
    const id = window.setInterval(() => {
      const sm = scorer.current?.summary();
      setLive(sm && sm.done > 0 ? sm.score : null);
    }, 500);
    return () => window.clearInterval(id);
  }, [scoring, tp.playing]);

  // số lỗ: giữ nguyên (thổi bằng kèn lệch tông tương ứng), hoặc xếp lại cho kèn đang xem
  const type = harpTypeOf(song);
  const holeFlat = useMemo(() => {
    if (!t || prefs.holes !== 'myHarp') return flat;
    const v = viewSong({ ...song, harpKey: shiftKey(song.harpKey, t) }, { type, key: song.harpKey, mode: 'octave' });
    return flatten(parseTab(v.song.body, song.harpKey, type));
  }, [t, prefs.holes, flat, song, type]);
  const missing = useMemo(() => holeFlat.filter((f, i) => f.token === null && flat[i]?.token).length, [holeFlat, flat]);

  const chordMap = useMemo(
    () => (prefs.chords && chordSegs ? chordsByLine(lines, transposeSpans(chordSegs, et)) : new Map<string, string>()),
    [prefs.chords, chordSegs, lines, et],
  );

  // ----- chữ chạy: đọc phách mỗi khung hình, ghi thẳng --p vào âm tiết (không vẽ lại React) -----
  const [shown, setShown] = useState(0);
  const [count, setCount] = useState<number | null>(null);
  const shownRef = useRef(0);
  useEffect(() => {
    let raf = 0;
    let lastCount: number | null = null;
    const frame = () => {
      const beat = pRef.current.beatAt();
      if (beat !== null) {
        const pos = locate(lines, beat);
        if (pos.line >= 0 && pos.line !== shownRef.current) { shownRef.current = pos.line; setShown(pos.line); }
        const els = lineRef.current?.querySelectorAll<HTMLElement>('[data-s]');
        els?.forEach((el, i) => {
          const v = pos.line !== shownRef.current ? 0 : i < pos.syl ? 1 : i === pos.syl ? pos.p : 0;
          const s = v.toFixed(3);
          if (el.style.getPropertyValue('--p') !== s) el.style.setProperty('--p', s);
        });
        const c = countdownAt(lines, beat);
        if (c !== lastCount) { lastCount = c; setCount(c); }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lines]);
  // dừng phát: chữ về trạng thái chưa hát
  useEffect(() => {
    if (tp.playing) return;
    lineRef.current?.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => el.style.setProperty('--p', '0'));
    setCount(null);
  }, [tp.playing, shown]);

  // phím tắt: cách = phát / dừng, Esc = thoát
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement)) { e.preventDefault(); pRef.current.toggle(); }
      else if (e.key === 'Escape' && !document.fullscreenElement) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // bài nhập từ MIDI trước khi app giữ file gốc: chọn lại file đó, máy dò bè hát và chỗ khớp với tab
  const midiInput = useRef<HTMLInputElement>(null);
  const linkMidi = async (f: File | undefined) => {
    if (midiInput.current) midiInput.current.value = '';
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const link = matchMidiToTab(bytes, lyricFlat);
      if (!link) { toast('File MIDI này không khớp với tab của bài'); return; }
      await saveMidiSource(original.id, f.name, bytes, link, tabSig(lyricFlat));
      const m = await loadMidiSource(original.id);
      setMidiSrc(m);
      if (m) { setSrc('midi'); toast('Đã nối bản phối gốc'); }
    } catch (e) {
      toast((e as Error).message || 'Không đọc được file MIDI');
    }
  };

  const startFrom = (li: number) => {
    const first = lines[li]?.syls[0]?.fi[0];
    shownRef.current = li;
    setShown(li);
    tp.play(first);
  };

  const renderLine = (li: number, big: boolean) => {
    const l = lines[li];
    if (!l) return <div className="kara-line kara-empty" />;
    return (
      <div className={`kara-line${big ? ' current' : ' next'}${l.instrumental ? ' instrumental' : ''}`} ref={big ? lineRef : undefined}>
        {l.syls.map((s, si) => {
          const holes = prefs.holes === 'hide' ? [] : holesFor(s, holeFlat);
          const text = s.text || (l.instrumental ? '♪' : '·');
          const chord = chordMap.get(`${li}.${si}`);
          return (
            <span key={si} className="ks" data-s={big ? si : undefined}>
              {(chord || holes.length > 0) && (
                <span className="ks-top">
                  {chord && <span className="ks-chord">{chord}</span>}
                  {holes.length > 0 && (
                    <span className="ks-holes">
                      {holes.map((h, i) => <span key={i} className={h?.startsWith('-') ? 'draw' : 'blow'}>{h ? <TokenText token={h} /> : '–'}</span>)}
                    </span>
                  )}
                </span>
              )}
              <span className="ks-row">
                <span className="ks-word">
                  <span className="ks-base">{text}</span>
                  <span className="ks-fill" aria-hidden="true">{text}</span>
                </span>
                {s.hyphen && <span className="ks-hy">-</span>}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const noLyrics = lines.every((l) => l.instrumental);
  const playHarp = t ? harpName(shiftKey(song.harpKey, t), type) : null;

  return (
    <div ref={rootRef} className="karaoke" role="dialog" aria-modal="true" aria-label={`Karaoke: ${original.title}`}>
      <header className="kara-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Thoát karaoke"><Icon name="back" /></button>
        <div className="kara-title">
          <strong>{original.title || 'Karaoke'}</strong>
          {original.artist && <span className="muted"> · {original.artist}</span>}
        </div>
        <div className="kara-tools">
          <div className="kara-key" role="group" aria-label="Đổi tông cho hợp giọng">
            <button type="button" className="icon-btn" disabled={mp3 || t <= -MAX_TRANSPOSE} onClick={() => update({ transpose: t - 1 })} aria-label="Hạ tông"><Icon name="minus" size={18} /></button>
            <span className="kara-key-val" aria-live="polite">{mp3 ? 'Tông theo nhạc' : `Tông ${t > 0 ? `+${t}` : t}`}</span>
            <button type="button" className="icon-btn" disabled={mp3 || t >= MAX_TRANSPOSE} onClick={() => update({ transpose: t + 1 })} aria-label="Nâng tông"><Icon name="plus" size={18} /></button>
          </div>
          <select className="chip-select" value={prefs.holes} onChange={(e) => update({ holes: e.target.value as KaraokeHoles })} aria-label="Số lỗ kèn">
            {(Object.keys(HOLES_LABEL) as KaraokeHoles[]).map((k) => <option key={k} value={k}>{HOLES_LABEL[k]}</option>)}
          </select>
          <button type="button" className={`chip${prefs.chords ? ' on' : ''}`} aria-pressed={prefs.chords} onClick={() => update({ chords: !prefs.chords })}>Hợp âm</button>
          {(backing || midiSrc) && (
            <div className="segmented" role="radiogroup" aria-label="Nguồn nhạc">
              <button type="button" role="radio" aria-checked={src === 'synth'} className={src === 'synth' ? 'on' : ''} onClick={() => setSrc('synth')}>Tự đệm</button>
              {midiSrc && <button type="button" role="radio" aria-checked={src === 'midi'} className={src === 'midi' ? 'on' : ''} onClick={() => setSrc('midi')}>MIDI gốc</button>}
              {backing && <button type="button" role="radio" aria-checked={src === 'mp3'} className={src === 'mp3' ? 'on' : ''} onClick={() => setSrc('mp3')}>MP3</button>}
            </div>
          )}
          {!midiSrc && original.tags?.includes('MIDI') && (
            <button type="button" className="chip" onClick={() => { tp.stop(); midiInput.current?.click(); }}>🎹 Nối file MIDI gốc</button>
          )}
          <input ref={midiInput} type="file" hidden accept=".mid,.midi,.kar,.rmi,audio/midi,audio/x-midi" onChange={(e) => void linkMidi(e.target.files?.[0])} />
          <button type="button" className="chip" onClick={() => { tp.stop(); setShowBacking(true); }}>🎵 {backing ? 'Nhạc nền' : 'Thêm nhạc MP3'}</button>
          <button type="button" className={`chip${scoring ? ' on' : ''}`} aria-pressed={scoring} onClick={() => setScoring((v) => !v)}>
            <Icon name="mic" size={15} /> Chấm điểm{scoring && live !== null ? ` · ${live}` : ''}
          </button>
          {scoring && (
            <button type="button" className={`chip${prefs.headphones ? ' on' : ''}`} aria-pressed={prefs.headphones} onClick={() => update({ headphones: !prefs.headphones })}>
              🎧 Đeo tai nghe
            </button>
          )}
        </div>
      </header>
      {micErr && <p className="kara-note small danger" role="alert">{micErr}</p>}
      {midi && midiSrc!.tabSig !== tabSig(lyricFlat) && (
        <p className="kara-note small">Tab đã sửa sau khi nhập — bản phối gốc có thể lệch với lời.</p>
      )}
      {useMp3 && backing && bk.status === 'loading' && <p className="kara-note small">Đang mở nhạc nền…</p>}
      {useMp3 && backing && bk.status === 'error' && <p className="kara-note small danger" role="alert">{bk.error}</p>}
      {mp3 && backing!.tabSig !== tabSig(lyricFlat) && (
        <p className="kara-note small">Tab đã sửa sau khi đồng bộ nhạc nền — lời có thể lệch. <button type="button" className="link-btn" onClick={() => setShowBacking(true)}>Đồng bộ lại</button></p>
      )}
      {scoring && !prefs.headphones && (
        <p className="kara-note small">Không đeo tai nghe: micro nghe lẫn nhạc đệm từ loa, máy đã bật khử tiếng vọng. Đeo tai nghe để chấm chính xác hơn.</p>
      )}

      {t !== 0 && prefs.holes !== 'hide' && (
        <p className="kara-note small">
          {prefs.holes === 'same'
            ? <>Đã đổi tông {t > 0 ? `+${t}` : t}: thổi đúng số lỗ này bằng <strong>{playHarp}</strong>.</>
            : <>Số lỗ xếp lại cho {harpName(song.harpKey, type).replace(/^Kèn/, 'kèn')}{missing > 0 ? ` — ${missing} nốt không có trên kèn này (–)` : ''}.</>}
        </p>
      )}

      <main className="kara-stage" onClick={() => !tp.playing && startFrom(shown)}>
        {noLyrics && <p className="kara-hint">Bài chưa có lời — thêm lời dưới dòng tab trong Sửa bài để hát karaoke.</p>}
        {tp.countIn != null
          ? <div className="kara-count big" aria-live="assertive">{tp.countIn}</div>
          : count != null && <div className="kara-count" aria-hidden="true">{'●'.repeat(count)}</div>}
        {scoring && <PitchStrip lines={lines} scorer={scorer} getBeat={tp.beatAt} spb={spb} />}
        {renderLine(shown, true)}
        {renderLine(shown + 1, false)}
      </main>

      {result && (
        <KaraokeResult
          r={result}
          onRetry={() => { setResult(null); startFrom(0); }}
          onPick={(li) => { setResult(null); startFrom(li); }}
          onClose={() => setResult(null)}
        />
      )}

      <footer className="kara-foot">
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(Math.max(0, shown - 1))} disabled={shown === 0} aria-label="Câu trước">
          <Icon name="back" size={18} /> Câu trước
        </button>
        <button type="button" className="kara-play" onClick={() => (tp.playing ? tp.stop() : startFrom(shown))} aria-label={tp.playing ? 'Dừng' : 'Hát'} disabled={useMp3 && !!backing && bk.status === 'loading'}>
          <Icon name={tp.playing ? 'stop' : 'play'} size={30} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(0)} aria-label="Hát lại từ đầu">
          <Icon name="loop" size={18} /> Từ đầu
        </button>
        {recorderSupported() && (
          recording
            ? <span className="kara-rec on" role="status"><span className="kara-rec-dot" aria-hidden="true" /> Đang thu {Math.floor(recElapsed / 60)}:{String(Math.floor(recElapsed % 60)).padStart(2, '0')}</span>
            : <button type="button" className="btn btn-ghost kara-rec" onClick={() => void startRecording()} disabled={tp.playing} aria-label="Vừa hát vừa thu âm">
                <span className="kara-rec-dot" aria-hidden="true" /> Thu
              </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setShowRecs(true)}>
          Bản thu{recCount ? ` (${recCount})` : ''}
        </button>
      </footer>
      {showBacking && (
        <BackingSetup
          song={original}
          flat={lyricFlat}
          lines={lines}
          existing={backing}
          onSaved={(b) => { setBacking(b); setSrc(b ? 'mp3' : midiSrc ? 'midi' : 'synth'); }}
          onClose={() => setShowBacking(false)}
        />
      )}
      {showRecs && <RecordingsPanel songId={original.id} refreshKey={recRefresh} onClose={() => { setShowRecs(false); setRecRefresh((n) => n + 1); }} />}
    </div>
  );
}

const verdict = (n: number) => (n >= 90 ? 'Hát hay quá!' : n >= 75 ? 'Tốt lắm!' : n >= 50 ? 'Khá rồi, tập thêm chút nữa' : 'Cứ hát chậm từng câu nhé');

/** Kết quả một lượt hát karaoke có chấm điểm */
function KaraokeResult({ r, onRetry, onPick, onClose }: {
  r: { s: KaraokeSummary; rec: PracticeRecord | null; newBest: boolean };
  onRetry: () => void;
  onPick: (line: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal?.(); }, []);
  const { s, rec, newBest } = r;
  return (
    <dialog ref={ref} className="sheet practice-result" onClose={onClose} aria-labelledby="kr-title">
      <h2 id="kr-title">{s.finished ? 'Hát hết bài' : `Đã hát ${s.done}/${s.total} chữ`}</h2>
      <div className="pr-score" aria-label={`${s.score} điểm`}><strong>{s.score}</strong><span>điểm</span></div>
      <p className="pr-verdict">
        {verdict(s.score)}
        {s.finished && newBest && rec && rec.times > 1 && <span className="pr-best"> Điểm cao nhất mới!</span>}
      </p>
      <dl className="storage-info">
        <div><dt>Đúng cao độ</dt><dd>{Math.round(s.pitch * 100)}%</dd></div>
        <div><dt>Vào nhịp, đủ hơi</dt><dd>{Math.round(s.timing * 100)}%</dd></div>
        {rec && <div><dt>Bài này</dt><dd>cao nhất {rec.best} điểm · đã hát hết {rec.times} lần</dd></div>}
        {!s.finished && <div><dt>Lưu ý</dt><dd className="muted">Chỉ lượt hát hết bài mới được ghi điểm.</dd></div>}
      </dl>
      {s.weak.length > 0 && (
        <div>
          <p className="field-label">Chữ hát chưa chuẩn — chạm để hát lại từ câu đó</p>
          <div className="row gap wrap">
            {s.weak.map((w) => (
              <button key={`${w.li}.${w.si}`} type="button" className="chip" onClick={() => onPick(w.li)}>
                <strong>{w.text}</strong> <span className="muted">· {w.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Đóng</button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>Hát lại từ đầu</button>
      </div>
    </dialog>
  );
}

