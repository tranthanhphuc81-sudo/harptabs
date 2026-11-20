import { BRAND, IS_HARMONICA_APP } from '../appConfig';
import { usePracticeTimer } from '../lib/practiceLog';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { db } from '../lib/db';
import { fixGarbled } from '../lib/vnEncoding';
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
import { loadMidiSource, midiBytes, saveMidiSource, updateMidiSound } from '../lib/midiSources';
import { INSTRUMENT_GROUPS, INSTRUMENT_OPTIONS, setArrangeSoft } from '../audio/engine';
import { Arrangement, ArrVoice, ArrVoices, buildArrangement, matchMidiToTab } from '../lib/midiArrange';
import { harpName, harpTypeOf, holeCount, isFingered, isFretted, midiToName, shiftKey } from '../lib/harp';
import { FingeringIcon, fingeringOf } from './Fingering';
import { buildKaraoke, countdownAt, holesFor, KLine, locate } from '../lib/karaoke';
import { DEFAULT_KARAOKE, DEFAULT_KARAOKE_VIEW, HOLE_SIZES, KaraokeHoles, KaraokePrefs, KaraokeView as ViewSizes, loadKaraokePrefs, loadKaraokeView, LYRIC_SIZES, MAX_TRANSPOSE, saveKaraokePrefs, saveKaraokeView } from '../lib/karaokePrefs';
import { FlatEvent, flatten, parseTab } from '../lib/tabText';
import type { Song } from '../lib/types';
import { viewSong } from '../lib/viewAs';
import { chordAt, ChordSegment, transposeSpans } from '../audio/harmony';
import { ChordDiagram } from './Fretboard';
import { Icon } from './Icon';
import { TokenText } from './TabView';
import type { PlayerState } from './usePlayer';
import { useFullscreen } from './useFullscreen';
import { useWakeLock } from './useWakeLock';
import { t as tx } from '../lib/i18n';

const HOLES_LABEL: Record<KaraokeHoles, string> = IS_HARMONICA_APP
  ? { same: tx('Giữ số lỗ'), myHarp: tx('Xếp lại cho kèn đang xem'), hide: tx('Ẩn số lỗ') }
  : { same: tx('Giữ nốt như bài'), myHarp: tx('Xếp lại cho {0} đang xem', BRAND.noun), hide: tx('Ẩn nốt') };

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

  // cỡ lời / cỡ số lỗ: chung cho mọi bài
  const [sizes, setSizes] = useState<ViewSizes>(DEFAULT_KARAOKE_VIEW);
  const [showSizes, setShowSizes] = useState(false);
  const sizesTouched = useRef(false);
  useEffect(() => { void loadKaraokeView().then((v) => { if (!sizesTouched.current) setSizes(v); }).catch(() => {}); }, []);
  const updateSizes = (patch: Partial<ViewSizes>) => setSizes((cur) => {
    sizesTouched.current = true;
    const next = { ...cur, ...patch };
    void saveKaraokeView(next).catch(() => {});
    return next;
  });

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
    try { setArr(buildArrangement(midiBytes(midiSrc), midiSrc, (midiSrc.voices ?? {}) as ArrVoices)); } catch { /* file hỏng: dùng đệm tự tạo */ }
    setArrangeSoft(midiSrc.soft !== false);
  }, [midiSrc]);
  // đổi nhạc cụ / tắt từng bè, dịu tiếng: áp ngay (cả khi đang phát), nhớ theo bài
  const [showVoices, setShowVoices] = useState(false);
  const setSound = (patch: { voices?: Record<string, string>; soft?: boolean }) => {
    if (!midiSrc) return;
    const next = { ...midiSrc, ...patch };
    setMidiSrc(next);
    void updateMidiSound(original.id, { voices: next.voices, soft: next.soft }).catch(() => {});
  };
  const useMp3 = src === 'mp3';
  const bk = useBackingPlayer(backing, flat);
  const mp3 = useMp3 && !!backing && bk.status === 'ready';
  const midi = src === 'midi' && !!arr;
  /** bộ phát đang dùng: nhạc nền MP3 hoặc tiếng tổng hợp — chữ chạy, chấm điểm, thu âm đều theo nó */
  const tp = mp3 ? bk : p;
  usePracticeTimer('bai-hat', tp.playing);
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
        setMicErr(e.name === 'NotAllowedError' ? tx('Cần cho phép dùng micro để chấm điểm') : e.message || tx('Không mở được micro'));
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
  // thông báo riêng của màn karaoke: thông báo chung của app nằm dưới lớp karaoke (và ngoài khung toàn màn hình) nên không thấy
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef(0);
  const toast = (msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 3500);
  };
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
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
      toast(tx('Đã lưu bản thu — bấm "Bản thu" để nghe lại'));
    } catch (e) {
      toast((e as Error).message || tx('Không lưu được bản thu'));
    }
  };

  const startRecording = async () => {
    if (recorder.current) return;
    const rec = new KaraokeRecorder();
    try {
      await rec.start(!prefs.headphones, (settings.micLatencyMs ?? 60) + (settings.syncOffsetMs ?? 0));
    } catch (e) {
      const err = e as Error;
      setMicErr(err.name === 'NotAllowedError' ? tx('Cần cho phép dùng micro để thu âm') : err.message || tx('Không mở được micro'));
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

  // sáo: hiện thế tay của nốt đang vang (cập nhật khi đổi nốt)
  const fingered = isFingered(type);
  const [curNote, setCurNote] = useState<number | null>(null);
  const curRef = useRef<number | null>(null);
  const holeFlatRef = useRef(holeFlat);
  holeFlatRef.current = holeFlat;

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
        if (fingered) {
          const hf = holeFlatRef.current;
          const i = hf.findIndex((f) => f.token && beat >= f.start - 1e-6 && beat < f.start + f.beats - 1e-6);
          const ni = i >= 0 ? i : null;
          if (ni !== curRef.current) { curRef.current = ni; setCurNote(ni); }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lines, fingered]);
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
      if (!link) { toast(tx('File MIDI này không khớp với tab của bài — chọn đúng file đã dùng để nhập bài này')); return; }
      await saveMidiSource(original.id, f.name, bytes, link, tabSig(lyricFlat));
      const m = await loadMidiSource(original.id);
      setMidiSrc(m);
      if (m) { setSrc('midi'); toast(tx('Đã nối bản phối gốc')); }
    } catch (e) {
      toast((e as Error).message || tx('Không đọc được file MIDI'));
    }
  };

  // lời lưu từ trước bị vỡ dấu (file MIDI bảng mã cũ): sửa ngay tại đây, không phải vào Sửa bài
  const garbled = useMemo(() => fixGarbled(original.body, original.title, original.artist ?? ''), [original.body, original.title, original.artist]);
  const fixFont = async () => {
    if (!garbled) return;
    tp.stop();
    const fixed = { ...original, body: garbled.fix(original.body), title: garbled.fix(original.title), artist: original.artist && garbled.fix(original.artist), updatedAt: Date.now() };
    try { await db.songs.put(fixed); toast(tx('Đã sửa lỗi font chữ')); } catch { toast(tx('Không lưu được')); }
  };

  // câu quá dài / chữ chỉnh to: tự thu nhỏ cho vừa khung (không tràn đè lên các nút)
  const stageRef = useRef<HTMLElement>(null);
  const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      el.style.setProperty('--kara-fit', '1');
      let f = 1;
      for (let i = 0; i < 4 && el.scrollHeight > el.clientHeight + 1 && f > 0.4; i++) {
        f = Math.max(0.4, f * Math.min(0.95, (el.clientHeight / el.scrollHeight) ** 0.6));
        el.style.setProperty('--kara-fit', String(f));
      }
      setFit(f);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [shown, lines, sizes, prefs.holes, prefs.chords, scoring, holeFlat, chordMap]);

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
                      {holes.map((h, i) => {
                        const f = fingered && !isFretted(type) ? fingeringOf(h, type, song.harpKey) : null;
                        return (
                          <span key={i} className={`${h?.startsWith('-') ? 'draw' : 'blow'}${f ? ' ks-fing' : ''}`}>
                            {h ? <TokenText token={h} strings={isFretted(type) ? holeCount(type) : undefined} /> : '–'}
                            {f && <FingeringIcon fingers={f} size="s" />}
                          </span>
                        );
                      })}
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
    <div ref={rootRef} className="karaoke" role="dialog" aria-modal="true" aria-label={`Karaoke: ${original.title}`}
      style={{ '--kara-lyric': sizes.lyric, '--kara-holes': sizes.holes } as CSSProperties}>
      <header className="kara-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label={tx('Thoát karaoke')}><Icon name="back" /></button>
        <div className="kara-title">
          <strong>{original.title || 'Karaoke'}</strong>
          {original.artist && <span className="muted"> · {original.artist}</span>}
        </div>
        <div className="kara-tools">
          <div className="kara-key" role="group" aria-label={tx('Đổi tông cho hợp giọng')}>
            <button type="button" className="icon-btn" disabled={mp3 || t <= -MAX_TRANSPOSE} onClick={() => update({ transpose: t - 1 })} aria-label={tx('Hạ tông')}><Icon name="minus" size={18} /></button>
            <span className="kara-key-val" aria-live="polite">{mp3 ? tx('Tông theo nhạc') : tx('Tông {0}', t > 0 ? `+${t}` : t)}</span>
            <button type="button" className="icon-btn" disabled={mp3 || t >= MAX_TRANSPOSE} onClick={() => update({ transpose: t + 1 })} aria-label={tx('Nâng tông')}><Icon name="plus" size={18} /></button>
          </div>
          <select className="chip-select" value={prefs.holes} onChange={(e) => update({ holes: e.target.value as KaraokeHoles })} aria-label={tx('Cách hiện nốt')}>
            {(Object.keys(HOLES_LABEL) as KaraokeHoles[]).map((k) => <option key={k} value={k}>{HOLES_LABEL[k]}</option>)}
          </select>
          <button type="button" className={`chip${prefs.chords ? ' on' : ''}`} aria-pressed={prefs.chords} onClick={() => update({ chords: !prefs.chords })}>{tx('Hợp âm')}</button>
          <button type="button" className={`chip${showSizes ? ' on' : ''}`} aria-expanded={showSizes} aria-controls="kara-sizes" onClick={() => setShowSizes((v) => !v)} title={tx('Cỡ chữ')}>Aa</button>
          {(backing || midiSrc) && (
            <div className="segmented" role="radiogroup" aria-label={tx('Nguồn nhạc')}>
              <button type="button" role="radio" aria-checked={src === 'synth'} className={src === 'synth' ? 'on' : ''} onClick={() => setSrc('synth')}>{tx('Tự đệm')}</button>
              {midiSrc && <button type="button" role="radio" aria-checked={src === 'midi'} className={src === 'midi' ? 'on' : ''} onClick={() => setSrc('midi')}>{tx('MIDI gốc')}</button>}
              {backing && <button type="button" role="radio" aria-checked={src === 'mp3'} className={src === 'mp3' ? 'on' : ''} onClick={() => setSrc('mp3')}>MP3</button>}
            </div>
          )}
          {midi && (
            <button type="button" className={`chip${showVoices ? ' on' : ''}`} aria-expanded={showVoices} aria-controls="kara-voices" onClick={() => setShowVoices((v) => !v)}>{tx('🎹 Nhạc cụ')}</button>
          )}
          {!midiSrc && original.tags?.includes('MIDI') && (
            <button type="button" className="chip" onClick={() => { tp.stop(); midiInput.current?.click(); }}>{tx('🎹 Nối file MIDI gốc')}</button>
          )}
          {/* không giới hạn loại file: nhiều máy Android không nhận ra .mid / .kar và làm mờ không cho chọn */}
          <input ref={midiInput} type="file" hidden onChange={(e) => void linkMidi(e.target.files?.[0])} />
          <button type="button" className="chip" onClick={() => { tp.stop(); setShowBacking(true); }}>🎵 {backing ? tx('Nhạc nền') : tx('Thêm nhạc MP3')}</button>
          <button type="button" className={`chip${scoring ? ' on' : ''}`} aria-pressed={scoring} onClick={() => setScoring((v) => !v)}>
            <Icon name="mic" size={15} /> {tx('Chấm điểm{0}', scoring && live !== null ? ` · ${live}` : '')}
          </button>
          {scoring && (
            <button type="button" className={`chip${prefs.headphones ? ' on' : ''}`} aria-pressed={prefs.headphones} onClick={() => update({ headphones: !prefs.headphones })}>
              {tx('🎧 Đeo tai nghe')}
            </button>
          )}
        </div>
      </header>
      {showVoices && midi && arr && midiSrc && (
        <div id="kara-voices" className="kara-sizes kara-voices" role="group" aria-label={tx('Nhạc cụ từng bè')}>
          {arr.parts.map((part) => (
            <label key={part.id} className="kara-size">
              <span className="kv-name" title={part.name}>{part.name}</span>
              <select className="chip-select" value={midiSrc.voices?.[part.id] ?? ''}
                onChange={(e) => {
                  const v = { ...(midiSrc.voices ?? {}) };
                  if (e.target.value) v[part.id] = e.target.value; else delete v[part.id];
                  setSound({ voices: v });
                }}>
                <option value="">{tx('Tự chọn ({0})', voiceLabel(part.voice))}</option>
                <option value="off">{tx('Tắt bè này')}</option>
                {part.voice !== 'drum' && <>
                  <option value="bass">Bass</option>
                  {INSTRUMENT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.items.map((it) => <option key={it} value={it}>{voiceLabel(it)}</option>)}
                    </optgroup>
                  ))}
                </>}
              </select>
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={midiSrc.soft !== false} onChange={(e) => setSound({ soft: e.target.checked })} />
            {tx('Dịu tiếng (bớt chói)')}
          </label>
          {midiSrc.voices && Object.keys(midiSrc.voices).length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSound({ voices: {} })}>{tx('Trả về tự chọn')}</button>
          )}
        </div>
      )}
      {showSizes && (
        <div id="kara-sizes" className="kara-sizes" role="group" aria-label={tx('Cỡ chữ')}>
          <label className="kara-size">
            <span>{tx('Cỡ lời')}</span>
            <input type="range" min={LYRIC_SIZES.min} max={LYRIC_SIZES.max} step={0.1} value={sizes.lyric}
              onChange={(e) => updateSizes({ lyric: Number(e.target.value) })} aria-valuetext={`${Math.round(sizes.lyric * 100)}%`} />
            <output>{Math.round(sizes.lyric * 100)}%</output>
          </label>
          <label className="kara-size">
            <span>{tx('Cỡ số lỗ')}</span>
            <input type="range" min={HOLE_SIZES.min} max={HOLE_SIZES.max} step={0.1} value={sizes.holes}
              onChange={(e) => updateSizes({ holes: Number(e.target.value) })} aria-valuetext={`${Math.round(sizes.holes * 100)}%`} />
            <output>{Math.round(sizes.holes * 100)}%</output>
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateSizes(DEFAULT_KARAOKE_VIEW)}
            disabled={sizes.lyric === 1 && sizes.holes === 1}>{tx('Mặc định')}</button>
        </div>
      )}
      {micErr && <p className="kara-note small danger" role="alert">{micErr}</p>}
      {garbled && (
        <p className="kara-note small" role="status">
          {tx('Lời bị lỗi font chữ Việt.')} <button type="button" className="link-btn" onClick={() => void fixFont()}>{tx('Sửa lỗi font')}</button>
        </p>
      )}
      {midi && midiSrc!.tabSig !== tabSig(lyricFlat) && (
        <p className="kara-note small">{tx('Tab đã sửa sau khi nhập — bản phối gốc có thể lệch với lời.')}</p>
      )}
      {useMp3 && backing && bk.status === 'loading' && <p className="kara-note small">{tx('Đang mở nhạc nền…')}</p>}
      {useMp3 && backing && bk.status === 'error' && <p className="kara-note small danger" role="alert">{bk.error}</p>}
      {mp3 && backing!.tabSig !== tabSig(lyricFlat) && (
        <p className="kara-note small">{tx('Tab đã sửa sau khi đồng bộ nhạc nền — lời có thể lệch.')} <button type="button" className="link-btn" onClick={() => setShowBacking(true)}>{tx('Đồng bộ lại')}</button></p>
      )}
      {scoring && !prefs.headphones && (
        <p className="kara-note small">{tx('Không đeo tai nghe: micro nghe lẫn nhạc đệm từ loa, máy đã bật khử tiếng vọng. Đeo tai nghe để chấm chính xác hơn.')}</p>
      )}

      {t !== 0 && prefs.holes !== 'hide' && (
        <p className="kara-note small">
          {prefs.holes === 'same'
            ? <>{tx('Đã đổi tông {0}: thổi đúng số lỗ này bằng', t > 0 ? `+${t}` : t)} <strong>{playHarp}</strong>.</>
            : <>{IS_HARMONICA_APP ? tx('Số lỗ') : tx('Nốt')} {tx('xếp lại cho')} {harpName(song.harpKey, type).replace(/^Kèn/, 'kèn')}{missing > 0 ? tx(' — {0} nốt không có trên {1} này (–)', missing, BRAND.noun) : ''}.</>}
        </p>
      )}

      <main ref={stageRef} className="kara-stage" style={{ '--kara-fit': fit } as CSSProperties} onClick={() => !tp.playing && startFrom(shown)}>
        {noLyrics && <p className="kara-hint">{tx('Bài chưa có lời — thêm lời dưới dòng tab trong Sửa bài để hát karaoke.')}</p>}
        {tp.countIn != null
          ? <div className="kara-count big" aria-live="assertive">{tp.countIn}</div>
          : count != null && <div className="kara-count" aria-hidden="true">{'●'.repeat(count)}</div>}
        {scoring && <PitchStrip lines={lines} scorer={scorer} getBeat={tp.beatAt} spb={spb} />}
        {fingered && (() => {
          // thế tay lớn của nốt đang vang (chưa phát thì nốt đầu câu đang hiện)
          const n = curNote != null ? holeFlat[curNote] : holeFlat[lines[shown]?.syls[0]?.fi[0] ?? -1];
          const f = n?.token ? fingeringOf(n.token, type, song.harpKey) : null;
          // guitar / ukulele: kèm sơ đồ hợp âm đang vang (theo capo của bài)
          const seg = isFretted(type) && chordSegs && n ? chordAt(transposeSpans(chordSegs, et - (song.capo ?? 0)), n.start) : null;
          return f && n?.midi != null ? (
            <div className="kara-finger" aria-label={tx('Thế tay nốt {0}', n.token)}>
              {seg && seg.root >= 0 && <ChordDiagram name={seg.name} inst={type === 'ukulele4' ? 'ukulele' : 'guitar'} />}
              <FingeringIcon fingers={f} size="l" />
              <span>{midiToName(n.midi)}</span>
            </div>
          ) : null;
        })()}
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
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(Math.max(0, shown - 1))} disabled={shown === 0} aria-label={tx('Câu trước')}>
          <Icon name="back" size={18} /> {tx('Câu trước')}
        </button>
        <button type="button" className="kara-play" onClick={() => (tp.playing ? tp.stop() : startFrom(shown))} aria-label={tp.playing ? tx('Dừng') : tx('Hát')} disabled={useMp3 && !!backing && bk.status === 'loading'}>
          <Icon name={tp.playing ? 'stop' : 'play'} size={30} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => startFrom(0)} aria-label={tx('Hát lại từ đầu')}>
          <Icon name="loop" size={18} /> {tx('Từ đầu')}
        </button>
        {recorderSupported() && (
          recording
            ? <span className="kara-rec on" role="status"><span className="kara-rec-dot" aria-hidden="true" /> {tx('Đang thu {0}:{1}', Math.floor(recElapsed / 60), String(Math.floor(recElapsed % 60)).padStart(2, '0'))}</span>
            : <button type="button" className="btn btn-ghost kara-rec" onClick={() => void startRecording()} disabled={tp.playing} aria-label={tx('Vừa hát vừa thu âm')}>
                <span className="kara-rec-dot" aria-hidden="true" /> Thu
              </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => setShowRecs(true)}>
          {tx('Bản thu{0}', recCount ? ` (${recCount})` : '')}
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
      <div className="toast kara-toast" role="status" aria-live="polite" data-show={toastMsg ? '' : undefined}>{toastMsg}</div>
      {showRecs && <RecordingsPanel songId={original.id} refreshKey={recRefresh} onClose={() => { setShowRecs(false); setRecRefresh((n) => n + 1); }} />}
    </div>
  );
}

/** tên nhạc cụ hiện cho người dùng */
function voiceLabel(v: ArrVoice): string {
  if (v === 'bass') return 'Bass';
  if (v === 'drum') return tx('Trống');
  return INSTRUMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

const verdict = (n: number) => (n >= 90 ? tx('Hát hay quá!') : n >= 75 ? tx('Tốt lắm!') : n >= 50 ? tx('Khá rồi, tập thêm chút nữa') : tx('Cứ hát chậm từng câu nhé'));

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
      <h2 id="kr-title">{s.finished ? tx('Hát hết bài') : tx('Đã hát {0}/{1} chữ', s.done, s.total)}</h2>
      <div className="pr-score" aria-label={tx('{0} điểm', s.score)}><strong>{s.score}</strong><span>{tx('điểm')}</span></div>
      <p className="pr-verdict">
        {verdict(s.score)}
        {s.finished && newBest && rec && rec.times > 1 && <span className="pr-best"> {tx('Điểm cao nhất mới!')}</span>}
      </p>
      <dl className="storage-info">
        <div><dt>{tx('Đúng cao độ')}</dt><dd>{Math.round(s.pitch * 100)}%</dd></div>
        <div><dt>{tx('Vào nhịp, đủ hơi')}</dt><dd>{Math.round(s.timing * 100)}%</dd></div>
        {rec && <div><dt>{tx('Bài này')}</dt><dd>{tx('cao nhất {0} điểm · đã hát hết {1} lần', rec.best, rec.times)}</dd></div>}
        {!s.finished && <div><dt>{tx('Lưu ý')}</dt><dd className="muted">{tx('Chỉ lượt hát hết bài mới được ghi điểm.')}</dd></div>}
      </dl>
      {s.weak.length > 0 && (
        <div>
          <p className="field-label">{tx('Chữ hát chưa chuẩn — chạm để hát lại từ câu đó')}</p>
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
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>{tx('Đóng')}</button>
        <button type="button" className="btn btn-primary" onClick={onRetry}>{tx('Hát lại từ đầu')}</button>
      </div>
    </dialog>
  );
}

