import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteSongs, downloadJson, exportOne, newId, slugify } from '../lib/db';
import { BRAND, SHOWN_HARP_TYPES } from '../appConfig';
import { HARP_KEYS, HARP_TYPE_LABEL, HarpKey, harpKeyLabel, HarpType, harpName, harpTypeOf, isChromatic, isFingered, isKalimba, isRecorder, isTremolo, midiToName, parseToken, recorderKey, songTonality } from '../lib/harp';
import { countTechniques, flatten, parseTab } from '../lib/tabText';
import { rekeyBody } from '../lib/converter';
import { beatsPerBar, Song } from '../lib/types';
import { TabView, visibleBand } from '../components/TabView';
import { HarpDiagram } from '../components/HarpDiagram';
import { PlayerBar } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { useWakeLock } from '../components/useWakeLock';
import { shareSong } from '../lib/share';
import { loadPractice, PracticeRecord, PracticeSummary, recordPractice, WaitScorer } from '../lib/practiceScore';
import { PracticeResult } from '../components/PracticeResult';
import { bestHarp, chordForOriginal, isOriginal, loadViewChoice, resolveChoice, saveViewChoice, ViewAs, ViewChoice, viewSong } from '../lib/viewAs';
import type { TabFit } from '../lib/converter';
import { Icon } from '../components/Icon';
import { KeyPlate } from '../components/KeySelect';
import { ScanPageView } from '../components/ScanPageView';
import type { SongScan } from '../lib/scanStore';
import { useAppState } from '../state';
import { MicPitch, PitchReading } from '../audio/pitch';
import { previewNote } from '../audio/engine';
import { ChordSegment, harmonizeSegments, parseTonality, segKey, transposeChords } from '../audio/harmony';
import { setBeatPrefs, setSongInstrument, useBeatPrefs } from '../audio/beatPrefs';
import { ChordPicker } from '../components/ChordPicker';
import { NoteEditor } from '../components/NoteEditor';
import { LyricEditor } from '../components/LyricEditor';
import { editNote, NoteEdit } from '../lib/tabEdit';
import { suggestInstrument, suggestStyle } from '../audio/suggest';

// màn hình karaoke: tải khi mở
const KaraokeView = lazy(() => import('../components/KaraokeView'));

const PAGE_TURN_KEY = 'harptabs.pageTurn';

export default function SongView() {
  const { id } = useParams();
  const song = useLiveQuery(() => (id ? db.songs.get(id) : undefined), [id]);
  if (song === undefined) return <div className="page"><p className="muted">Đang tải…</p></div>;
  if (!song) return <div className="page"><p>Không tìm thấy bài này.</p><Link to="/" className="btn btn-ghost">Về thư viện</Link></div>;
  return <SongWithView key={song.id} original={song} />;
}

/** "Xem cho kèn": mặc định tự chọn kèn hợp nhất cho từng bài; chọn tay thì nhớ trên máy này */
function SongWithView({ original }: { original: Song }) {
  const [choice, setChoice] = useState<ViewChoice>(loadViewChoice);
  const onChoice = (c: ViewChoice) => { setChoice(c); saveViewChoice(c); };
  const view = useMemo(() => resolveChoice(original, choice), [original, choice]);
  const { song, fit } = useMemo(() => viewSong(original, view), [original, view]);
  return <SongPlayerView song={song} original={original} fit={fit} view={view} choice={choice} onChoice={onChoice} />;
}

function SongPlayerView({ song, original, fit, view, choice, onChoice }: {
  /** bài đang hiển thị (bản gốc hoặc bản xếp lại cho kèn đang xem) */
  song: Song;
  /** bài gốc trong thư viện — mọi thao tác lưu đều làm trên bài này */
  original: Song;
  fit: TabFit | null;
  view: ViewAs | null;
  choice: ViewChoice;
  onChoice: (c: ViewChoice) => void;
}) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const harpType = harpTypeOf(song);
  const chrom = isChromatic(harpType);
  const trem = isTremolo(harpType);
  const rec = isFingered(harpType);
  const parsed = useMemo(() => parseTab(song.body, song.harpKey, harpType), [song.body, song.harpKey, harpType]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const stats = useMemo(() => countTechniques(parsed), [parsed]);
  const sections = useMemo(() => parsed.sections.map((s) => s.title), [parsed]);
  const bpb = beatsPerBar(song.timeSig);

  // tự động tối ưu: mở bài là áp kiểu nhịp hợp nhất (trừ bài để "Không beat" / "Máy đếm nhịp")
  const beatPrefs = useBeatPrefs();
  const autoStyle = useMemo(() => suggestStyle(song, flat), [song, flat]);
  const autoApplied = beatPrefs.auto && song.style !== 'none' && song.style !== 'metronome';
  const p = usePlayer(flat, {
    bpm: song.bpm, tempoScale: 1, beatsPerBar: bpb, pickupBeats: song.pickupBeats,
    style: autoApplied ? autoStyle.style : song.style, melody: true, beat: song.style !== 'none', click: false, countIn: true,
    songKey: song.songKey || songTonality(song.harpKey, song.position, harpType),
    chordOverrides: song.chords,
    sections,
  });
  // nhạc cụ giai điệu hợp với bài và kiểu nhịp đang phát (chỉ dùng khi tự động, chỉnh tay thì giữ)
  const autoInstrument = useMemo(() => suggestInstrument(song, flat, p.opts.style), [song, flat, p.opts.style]);
  useEffect(() => { setSongInstrument(autoInstrument.instrument); }, [autoInstrument]);
  useEffect(() => () => setSongInstrument(null), []);

  // ----- hợp âm đệm: hiện trên tab, chọn tay khi máy đoán sai -----
  const tonality = useMemo(() => parseTonality(song.songKey || songTonality(song.harpKey, song.position, harpType))!, [song.songKey, song.harpKey, song.position, harpType]);
  // đệm hát: luôn hiện hợp âm trên lời để hát theo
  const showChords = beatPrefs.showChords || !!p.opts.sing;
  const chordSegs = useMemo(
    () => (showChords ? harmonizeSegments(flat, bpb, song.pickupBeats, tonality, song.chords) : null),
    [showChords, flat, bpb, song.pickupBeats, tonality, song.chords],
  );
  const [chordEdit, setChordEdit] = useState<ChordSegment | null>(null);
  const pickChord = (seg: ChordSegment, name: string | null) => {
    // đang xem bản đã dịch giọng: lưu hợp âm theo giọng của bài gốc
    const next = { ...(original.chords ?? {}) };
    if (name === null) delete next[segKey(seg.start)];
    else next[segKey(seg.start)] = chordForOriginal(name, fit);
    void db.songs.update(song.id, { chords: Object.keys(next).length ? next : undefined, updatedAt: Date.now() });
  };
  const chordWhere = (seg: ChordSegment) => {
    if (seg.start < song.pickupBeats - 1e-6) return 'ở ô lấy đà';
    const bar = Math.floor((seg.start - song.pickupBeats) / bpb + 1e-6) + 1;
    const half = Math.abs(((seg.start - song.pickupBeats) % bpb)) > 1e-6;
    return `ô nhịp ${bar}${half ? ' (nửa sau)' : ''}`;
  };
  const manualCount = Object.keys(song.chords ?? {}).length;

  const [focus, setFocus] = useState<number | null>(null);
  const [showDiagram, setShowDiagram] = useState(false);
  const [rekeyOpen, setRekeyOpen] = useState(false);
  const [waitMode, setWaitMode] = useState(false);
  const [waitIdx, setWaitIdx] = useState(0);
  const [heard, setHeard] = useState<PitchReading | null>(null);
  const micRef = useRef<MicPitch | null>(null);
  const practicedMarked = useRef(false);

  const playable = useMemo(() => flat.map((f, i) => (f.midi !== null && f.token ? i : -1)).filter((i) => i >= 0), [flat]);

  // ----- lặp đoạn -----
  const sectionRange = (fi: number | null) => {
    const f = fi != null ? flat[fi] : flat[0];
    if (!f) return null;
    const inSec = flat.filter((x) => x.sectionIndex === f.sectionIndex);
    const sameLine = flat.filter((x) => x.sectionIndex === f.sectionIndex && x.lineIndex === f.lineIndex);
    const useLine = parsed.sections.length === 1 || inSec.length > 48;
    const group = useLine ? sameLine : inSec;
    const first = group[0], last = group[group.length - 1];
    const title = parsed.sections[f.sectionIndex]?.title;
    return { start: first.start, end: last.start + last.beats, label: useLine ? 'dòng này' : title || `đoạn ${f.sectionIndex + 1}` };
  };
  const loopInfo = p.opts.loop ? sectionRange(focus ?? p.active) : null;
  const toggleLoop = () => {
    if (p.opts.loop) p.setOpts({ loop: null });
    else {
      const r = sectionRange(focus ?? p.active);
      if (r) p.setOpts({ loop: { start: r.start, end: r.end } });
    }
  };

  const markPracticed = () => {
    if (practicedMarked.current) return;
    practicedMarked.current = true;
    void db.songs.update(song.id, { lastPracticedAt: Date.now() });
  };

  const player = {
    ...p,
    toggle: () => {
      if (p.playing) return p.stop();
      if (waitMode) stopWait();
      markPracticed();
      p.play(p.opts.loop ? undefined : focus ?? undefined);
    },
  };

  // ----- sửa nốt ngay khi nghe: chạm nốt sai trên tab rồi đổi tại chỗ, nhạc vẫn chạy -----
  const [editMode, setEditMode] = useState(false);
  const [karaoke, setKaraoke] = useState(false);
  const [lyricEdit, setLyricEdit] = useState(false);
  const keepPlaying = useRef(false);
  /** chỉ sửa được khi đang xem đúng bản gốc (bản đã dịch sang kèn khác không ứng với văn bản lưu) */
  const canEdit = fit === null && song === original;
  // lịch sử để hoàn tác: nội dung bài và nốt đang chọn trước mỗi lần sửa
  const [history, setHistory] = useState<{ body: string; focus: number | null }[]>([]);
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    keepPlaying.current = true;
    window.setTimeout(() => { keepPlaying.current = false; }, 1500);
    void db.songs.update(original.id, { body: last.body, updatedAt: Date.now() });
    setHistory((h) => h.slice(0, -1));
    setFocus(last.focus);
  };
  const applyEdit = (edit: NoteEdit, nextFocus?: number | null) => {
    const f = focus != null ? flat[focus] : null;
    if (!f) return;
    const body = editNote(original.body, original.harpKey, harpTypeOf(original), f, edit);
    if (body === null) { toast('Kèn này không có nốt đó'); return; }
    if (body === original.body) return;
    keepPlaying.current = true;
    window.setTimeout(() => { keepPlaying.current = false; }, 1500);
    setHistory((h) => [...h.slice(-49), { body: original.body, focus }]);
    void db.songs.update(original.id, { body, updatedAt: Date.now() });
    if (nextFocus !== undefined) setFocus(nextFocus);
  };
  const stepFocus = (dir: -1 | 1) => {
    if (focus == null) return;
    const k = Math.min(flat.length - 1, Math.max(0, focus + dir));
    setFocus(k);
    if (flat[k]?.midi != null) previewNote(flat[k].midi!, 0.4);
  };

  // ----- lật trang bằng một chạm (khi không phát): chạm nửa dưới sang trang, phần trên lùi trang -----
  const [pageTurn, setPageTurn] = useState(() => { try { return localStorage.getItem(PAGE_TURN_KEY) === '1'; } catch { return false; } });
  const togglePageTurn = () => {
    setPageTurn((v) => {
      try { localStorage.setItem(PAGE_TURN_KEY, v ? '0' : '1'); } catch { /* không lưu được thì thôi */ }
      return !v;
    });
  };
  const onPagerClick = (e: React.MouseEvent) => {
    if (!pageTurn || p.playing || waitMode || editMode) return;
    // chạm tên hợp âm vẫn mở bảng chọn hợp âm
    if ((e.target as HTMLElement).closest('.nt-chord')) return;
    e.stopPropagation();
    e.preventDefault();
    const [top, bottom] = visibleBand();
    const page = Math.max(120, (bottom - top) * 0.85);
    const back = e.clientY < top + (bottom - top) * 0.3;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: back ? -page : page, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onNoteClick = (fi: number) => {
    if (editMode && !waitMode) {
      setFocus(fi);
      if (flat[fi]?.midi != null) previewNote(flat[fi].midi!, 0.5); // chạm là nghe luôn, kể cả đang phát
      return;
    }
    setFocus(fi);
    if (waitMode) {
      const k = playable.indexOf(fi);
      // nhảy sang nốt khác: nốt đang chờ không tính điểm
      if (k >= 0) { waitIdxRef.current = k; setWaitIdx(k); scorer.current?.begin(performance.now()); }
      return;
    }
    if (p.playing) p.play(fi);
    else if (flat[fi]?.midi != null) previewNote(flat[fi].midi!, 0.5);
    if (p.opts.loop) {
      const r = sectionRange(fi);
      if (r) p.setOpts({ loop: { start: r.start, end: r.end } });
    }
  };

  // ----- chế độ chờ nốt (micro) + chấm điểm -----
  const waitIdxRef = useRef(0);
  waitIdxRef.current = waitIdx;
  const scorer = useRef<WaitScorer | null>(null);
  const [result, setResult] = useState<{ summary: PracticeSummary; record: PracticeRecord | null; newBest: boolean } | null>(null);

  const stopMic = () => {
    micRef.current?.stop();
    micRef.current = null;
    setWaitMode(false);
    setHeard(null);
  };

  /** kết thúc lượt tập: tập hết bài thì ghi điểm; dừng giữa chừng mà đã tập kha khá thì vẫn cho xem kết quả */
  const finishWait = async (finished: boolean) => {
    stopMic();
    const sc = scorer.current;
    scorer.current = null;
    if (!sc) return;
    const summary = sc.summary(finished);
    if (!finished && summary.done < 5) return;
    const saved = finished ? await recordPractice(song.id, summary.score).catch(() => null) : null;
    setResult({ summary, record: saved?.rec ?? (await loadPractice(song.id).catch(() => null)), newBest: !!saved?.newBest });
  };
  const stopWait = () => { void finishWait(false); };

  const startWait = async (from?: number) => {
    p.stop();
    setResult(null);
    const startAt = from ?? (focus != null ? Math.max(0, playable.indexOf(focus)) : 0);
    const sc = new WaitScorer(playable.length - startAt);
    const mic = new MicPitch();
    mic.onReading = (r) => {
      setHeard(r);
      const fi = playable[waitIdxRef.current];
      const target = flat[fi];
      if (!target || target.midi == null || scorer.current !== sc) return;
      if (!sc.feed(r, target.midi, fi, performance.now())) return;
      const next = waitIdxRef.current + 1;
      if (next >= playable.length) void finishWait(true);
      else { waitIdxRef.current = next; setWaitIdx(next); }
    };
    try {
      await mic.start();
      micRef.current = mic;
      markPracticed();
      scorer.current = sc;
      sc.begin(performance.now());
      waitIdxRef.current = startAt;
      setWaitIdx(startAt);
      setWaitMode(true);
    } catch (e) {
      toast((e as Error).name === 'NotAllowedError' ? 'Cần cho phép dùng micro để luyện chế độ chờ nốt' : (e as Error).message);
    }
  };
  useEffect(() => () => micRef.current?.stop(), []);

  useWakeLock(p.playing || waitMode);

  // đổi kèn đang xem: tab mới, vị trí nốt cũ không còn đúng → dừng phát / chờ nốt (không chấm điểm lượt dở)
  const viewKey = `${song.harpType ?? ''}|${song.harpKey}|${song.body.length}|${fit?.shift ?? ''}`;
  const lastViewKey = useRef(viewKey);
  useEffect(() => {
    if (lastViewKey.current === viewKey) return;
    lastViewKey.current = viewKey;
    // đang sửa nốt tại chỗ: giữ nhạc chạy và nốt đang chọn
    if (keepPlaying.current) { keepPlaying.current = false; return; }
    p.stop();
    scorer.current = null;
    stopMic();
    setFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi đổi kèn đang xem
  }, [viewKey]);

  const activeIdx = waitMode ? playable[waitIdx] ?? null : p.active ?? focus;
  const activeToken = activeIdx != null ? flat[activeIdx]?.token : null;

  const toggleFav = () => db.songs.update(song.id, { favorite: !song.favorite });
  const exportSong = () => downloadJson(exportOne(original), `${slugify(original.title)}.harptab.json`);
  // trình duyệt không cho chép tự động: hiện link để người dùng tự chép
  const [manualLink, setManualLink] = useState<string | null>(null);
  /** In / lưu PDF bằng hộp thoại in của máy; tên bài làm tên file PDF */
  const printSong = () => {
    const prev = document.title;
    const root = document.documentElement;
    const theme = root.getAttribute('data-theme');
    document.title = `${song.title || 'Bài hát'} – ${harpName(song.harpKey, harpType)}`;
    root.setAttribute('data-theme', 'light'); // in nền trắng kể cả khi đang dùng giao diện tối
    window.addEventListener('afterprint', () => {
      document.title = prev;
      if (theme === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    }, { once: true });
    window.print();
  };

  const share = async () => {
    const r = await shareSong(original);
    if (r.status === 'copied') toast('Đã chép link bài — dán vào tin nhắn để gửi');
    else if (r.status === 'too-long') toast('Bài dài quá để gửi bằng link — dùng nút Xuất file rồi gửi file');
    else if (r.status === 'failed') setManualLink(`${r.text} ${r.url}`);
  };
  // xoá: bấm lần đầu để hỏi lại, bấm lần nữa trong 4 giây mới xoá
  const [confirmDel, setConfirmDel] = useState(false);
  const removeSong = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    await deleteSongs([song.id]);
    toast(`Đã xoá "${song.title || 'bài'}"`);
    nav('/', { replace: true });
  };

  const issues = parsed.issues.filter((i) => i.level === 'error');

  return (
    <div className="page page-song">
      <header className="song-head">
        <Link to="/" className="icon-btn back" aria-label="Về thư viện"><Icon name="back" /></Link>
        <KeyPlate k={song.harpKey} type={harpType} size="l" />
        <div className="sh-text">
          <h1>{song.title || 'Chưa đặt tên'}</h1>
          {song.artist && <p className="muted">{song.artist}</p>}
          <p className="sh-meta">
            <span>{harpName(song.harpKey, harpType)}</span>
            {!chrom && !trem && !rec && song.position && <span>Vị trí {song.position}</span>}
            {song.songKey && <span>Giọng {song.songKey}</span>}
            <span>{song.timeSig}</span>
            <span>{stats.notes} nốt</span>
            {stats.bends > 0 && <span className="bend-count">{stats.bends} bend</span>}
            {stats.slides > 0 && <span className="bend-count">{stats.slides} nốt gạt</span>}
            <span className="print-only">{song.bpm} bpm</span>
          </p>
        </div>
        <div className="sh-actions">
          <button type="button" className={`icon-btn${song.favorite ? ' starred' : ''}`} onClick={toggleFav} aria-pressed={song.favorite} aria-label="Yêu thích">
            <Icon name="star" filled={song.favorite} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setRekeyOpen(true)} aria-label={`Chuyển sang ${BRAND.noun} khác`}><Icon name="swap" /></button>
          <button type="button" className="icon-btn" onClick={share} aria-label="Chia sẻ bài"><Icon name="share" /></button>
          <button type="button" className="icon-btn" onClick={printSong} aria-label="In / lưu PDF" title="In / lưu PDF"><Icon name="print" /></button>
          <button type="button" className="icon-btn" onClick={exportSong} aria-label="Xuất file bài"><Icon name="download" /></button>
          <Link to={`/song/${song.id}/edit`} className="icon-btn" aria-label="Sửa bài"><Icon name="edit" /></Link>
          <button type="button" className={confirmDel ? 'btn btn-danger del-confirm' : 'icon-btn'} onClick={removeSong}
            aria-label={confirmDel ? 'Bấm lần nữa để xoá bài' : 'Xoá bài'}>
            {confirmDel ? 'Xoá?' : <Icon name="trash" />}
          </button>
        </div>
      </header>

      <ViewAsBar original={original} view={view} fit={fit} choice={choice} onChoice={onChoice} viewed={song} onSaved={(id) => nav(`/song/${id}`)} />

      {song.notes && <p className="song-notes">{song.notes}</p>}
      {issues.length > 0 && (
        <div className="alert error">Bài có {issues.length} lỗi ký hiệu. <Link to={`/song/${song.id}/edit`}>Mở trình sửa</Link> để xem chi tiết.</div>
      )}

      <p className="legend">
        {isKalimba(harpType) ? <>Số 1–7 là Đô–Si theo tông kalimba, chấm trên = lên quãng tám. Hình nhỏ dưới số: phím cần gảy (phím giữa dài nhất là nốt thấp nhất).</> : rec ? <>Tên nốt kèm thế bấm: <strong>●</strong> bịt kín, <strong>○</strong> mở, <strong>◐</strong> bịt nửa {isRecorder(harpType) ? ' (lỗ trên cùng lệch trái là ngón cái)' : ' (lỗ 1 gần miệng thổi ở trên cùng)'}</> : <>
        <span className="lg blow">4</span> thổi
        <span className="lg draw">−4</span> hút
        {trem ? null : chrom ? <><span className="lg bend">&lt;</span> bấm nút gạt</> : <><span className="lg bend">′</span> bend nửa cung</>}
        </>}
        <span className="lg-dur print-only">Ô dài = giữ lâu hơn (ô thường 1 phách) · <strong>–</strong> nghỉ</span>
        <span className="muted no-print">Chạm vào nốt để nghe, hoặc chọn chỗ bắt đầu phát.</span>
        <button type="button" className={`chip no-print${pageTurn ? ' on' : ''}`} aria-pressed={pageTurn} onClick={togglePageTurn}>Chạm lật trang</button>
        <button type="button" className={`chip legend-chords${beatPrefs.showChords ? ' on' : ''}`} aria-pressed={beatPrefs.showChords}
          onClick={() => setBeatPrefs({ showChords: !beatPrefs.showChords })}>
          Hợp âm{manualCount > 0 ? ` (${manualCount} chọn tay)` : ''}
        </button>
      </p>
      {showChords && <p className="small muted">Chạm vào tên hợp âm trên nốt để đổi. Viền đậm là hợp âm bạn đã chọn tay.</p>}

      {waitMode && (
        <div className="wait-banner" role="status">
          <span>Chờ bạn thổi: <strong className="wb-target">{activeToken ?? '–'}</strong>
            {activeIdx != null && flat[activeIdx]?.midi != null && <span className="muted"> ({midiToName(flat[activeIdx].midi!, settings.noteNames)})</span>}
          </span>
          <span>Nghe được: <strong>{heard ? midiToName(heard.nearest, settings.noteNames) : '…'}</strong>
            {heard && <span className={`cents ${Math.abs(heard.cents) < 20 ? 'ok' : ''}`}>{heard.cents > 0 ? '+' : ''}{Math.round(heard.cents)}¢</span>}
          </span>
          <span className="muted">{waitIdx + 1}/{playable.length}</span>
        </div>
      )}

      {pageTurn && !p.playing && !waitMode && !editMode && <p className="small muted no-print page-turn-hint">Chạm phần dưới màn hình để sang trang, phần trên để lùi trang.</p>}
      <div className="tab-pager" onClickCapture={onPagerClick}>
      <TabView
        harpType={harpType}
        harpKey={song.harpKey}
        parsed={parsed}
        flat={flat}
        active={activeIdx}
        selected={editMode && canEdit ? focus : null}
        onNoteClick={onNoteClick}
        showNames={settings.showNoteNames}
        nameStyle={settings.noteNames}
        size={settings.tabSize}
        chords={chordSegs}
        onChordClick={setChordEdit}
      />
      </div>

      <div className="below-tab">
        <button type="button" className="btn btn-ghost" onClick={() => setShowDiagram((v) => !v)} aria-expanded={showDiagram}>
          {showDiagram ? 'Ẩn sơ đồ kèn' : 'Hiện sơ đồ kèn'}
        </button>
      </div>
      {showDiagram && <HarpDiagram harpKey={song.harpKey} harpType={harpType} highlight={activeToken ? [activeToken] : []} nameStyle={settings.noteNames} />}

      <ScanSection songId={song.id} />
      <p className="print-only print-foot">In từ {BRAND.name} · {BRAND.host} · © Trần Thanh Phúc · 0913.65.65.39</p>

      <PlayerBar
        p={player}
        loopLabel={loopInfo?.label}
        onToggleLoop={toggleLoop}
        autoStyle={autoStyle}
        autoApplied={autoApplied}
        autoInstrument={autoInstrument}
        above={editMode && (canEdit ? (
          <NoteEditor
            note={focus != null ? flat[focus] ?? null : null}
            harpType={harpType}
            harpKey={song.harpKey}
            nameStyle={settings.noteNames}
            playing={p.playing}
            onToken={(token) => { applyEdit({ kind: 'token', token }); if (token) { const n = parseToken(token, original.harpKey, harpTypeOf(original)); if (n) previewNote(n.midi, 0.5); } }}
            onBeats={(beats) => applyEdit({ kind: 'beats', beats })}
            onRemove={() => applyEdit({ kind: 'remove' }, focus != null ? Math.min(focus, flat.length - 2) : null)}
            onDuplicate={() => applyEdit({ kind: 'duplicate' }, focus != null ? focus + 1 : null)}
            onStep={stepFocus}
            canUndo={history.length > 0}
            onUndo={undo}
            onPickPlaying={() => { if (p.active != null) setFocus(p.active); }}
            onHearToken={(t) => { const n = parseToken(t, original.harpKey, harpTypeOf(original)); if (n) previewNote(n.midi, 0.6); }}
            onInsert={(token) => applyEdit({ kind: 'insert', token }, focus != null ? focus + 1 : null)}
            onClose={() => setEditMode(false)}
          />
        ) : (
          <p className="small muted">Đang xem bản đã đổi sang kèn khác — chọn “Kèn gốc” ở trên để sửa nốt. <button type="button" className="link-btn" onClick={() => setEditMode(false)}>Đóng</button></p>
        ))}
        extra={<>
          <button type="button" className={`chip${editMode ? ' on' : ''}`} aria-pressed={editMode} onClick={() => setEditMode((v) => !v)}>
            <Icon name="edit" size={15} /> Sửa nốt
          </button>
          <button type="button" className="chip" onClick={() => (canEdit ? setLyricEdit(true) : toast('Đang xem bản đã đổi sang kèn khác — chọn “Kèn gốc” ở trên để sửa lời'))}>
            📝 Sửa lời
          </button>
          <button type="button" className={`chip${waitMode ? ' on' : ''}`} aria-pressed={waitMode} onClick={() => (waitMode ? stopWait() : startWait())}>
            <Icon name="mic" size={15} /> Chờ nốt
          </button>
          <button type="button" className="chip" onClick={() => { if (waitMode) stopWait(); setEditMode(false); setKaraoke(true); }}>
            🎤 Karaoke
          </button>
        </>}
      />

      {lyricEdit && (
        <LyricEditor body={original.body} harpKey={original.harpKey} harpType={harpTypeOf(original)}
          onSave={(body) => {
            keepPlaying.current = true;
            window.setTimeout(() => { keepPlaying.current = false; }, 1500);
            setHistory((h) => [...h.slice(-49), { body: original.body, focus }]);
            void db.songs.update(original.id, { body, updatedAt: Date.now() });
            toast('Đã lưu lời');
          }}
          onClose={() => setLyricEdit(false)} />
      )}

      {karaoke && (
        <Suspense fallback={null}>
          <KaraokeView song={song} original={original} flat={flat} p={player} chordSegs={chordSegs} onClose={() => setKaraoke(false)} />
        </Suspense>
      )}

      {chordEdit && (
        <ChordPicker
          seg={chordEdit}
          tonality={tonality}
          where={chordWhere(chordEdit)}
          onPick={(name) => pickChord(chordEdit, name)}
          onClose={() => setChordEdit(null)}
        />
      )}

      {manualLink && <ShareLinkDialog text={manualLink} onClose={() => setManualLink(null)} />}

      {result && (
        <PracticeResult
          summary={result.summary}
          record={result.record}
          newBest={result.newBest}
          weak={result.summary.weak.map((w) => ({ index: w.index, token: flat[w.index]?.token ?? '?', lyric: flat[w.index]?.lyric, misses: w.misses }))}
          onRetry={() => { setResult(null); void startWait(0); }}
          onPick={(fi) => { setResult(null); setFocus(fi); void startWait(Math.max(0, playable.indexOf(fi))); }}
          onClose={() => setResult(null)}
        />
      )}

      {rekeyOpen && (
        <RekeyDialog
          song={original}
          onClose={() => setRekeyOpen(false)}
          onDone={(id) => { setRekeyOpen(false); if (id !== song.id) nav(`/song/${id}`); }}
        />
      )}
    </div>
  );
}

function RekeyDialog({ song, onClose, onDone }: { song: Song; onClose: () => void; onDone: (id: string) => void }) {
  const { toast } = useAppState();
  const fromType = harpTypeOf(song);
  const [toType, setToType] = useState<HarpType>(fromType);
  const [target0, setTarget] = useState<HarpKey>(song.harpKey === 'C' ? 'G' : 'C');
  // sáo dọc chỉ có một tông
  const target = isRecorder(toType) ? recorderKey(toType) : target0;
  const [mode, setMode] = useState<'octave' | 'any'>('any');
  const preview = useMemo(() => rekeyBody(song.body, song.harpKey, target, mode, fromType, toType), [song, target, mode, fromType, toType]);
  const toName = harpName(target, toType).replace(/^Kèn/, 'kèn');
  const typeFields = { harpType: toType === 'diatonic' ? undefined : toType, position: toType === 'diatonic' ? song.position : 1 as const };
  const s = preview.fit.stats;
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal?.(); }, []);

  const apply = async (asNew: boolean) => {
    const now = Date.now();
    const shiftNote = preview.fit.shift % 12 !== 0 ? ` Đã dịch giọng ${preview.fit.shift > 0 ? '+' : ''}${preview.fit.shift} nửa cung.` : '';
    if (asNew) {
      const id = newId();
      await db.songs.put({ ...song, ...typeFields, id, title: `${song.title} (${toName})`, harpKey: target, body: preview.body, songKey: undefined, chords: transposeChords(song.chords, preview.fit.shift), source: 'user', createdAt: now, updatedAt: now, favorite: false });
      toast(`Đã tạo bản cho ${toName}.${shiftNote}`);
      onDone(id);
    } else {
      await db.songs.update(song.id, { ...typeFields, harpKey: target, body: preview.body, songKey: mode === 'octave' ? song.songKey : undefined, chords: transposeChords(song.chords, preview.fit.shift), updatedAt: now });
      toast(`Đã chuyển sang ${toName}.${shiftNote}`);
      onDone(song.id);
    }
  };

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose} aria-labelledby="rekey-title">
      <h2 id="rekey-title">Chuyển sang {BRAND.noun} khác</h2>
      <label className="field">
        <span className="field-label">Loại {BRAND.noun}</span>
        <select value={toType} onChange={(e) => setToType(e.target.value as HarpType)}>
          {SHOWN_HARP_TYPES.map((t) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      {!isRecorder(toType) && <label className="field">
        <span className="field-label">Kèn bạn có</span>
        <select value={target} onChange={(e) => setTarget(e.target.value as HarpKey)}>
          {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {harpKeyLabel(k, toType)}</option>)}
        </select>
      </label>}
      <fieldset className="radio-group">
        <legend className="field-label">Cách chuyển</legend>
        <label><input type="radio" checked={mode === 'any'} onChange={() => setMode('any')} /> Dịch giọng cho dễ thổi nhất <span className="muted">(giai điệu giữ nguyên, cao độ thay đổi)</span></label>
        <label><input type="radio" checked={mode === 'octave'} onChange={() => setMode('octave')} /> Giữ đúng giọng gốc <span className="muted">(để chơi cùng bản thu{isRecorder(toType) ? ', nốt ngoài tầm sáo sẽ thiếu' : isTremolo(toType) ? ', nốt thăng giáng không có trên kèn tremolo' : isChromatic(toType) ? ', có thể phải bấm gạt nhiều hơn' : ', có thể phải bend'})</span></label>
      </fieldset>
      <p className="rekey-stats">
        {isTremolo(toType) || isFingered(toType)
          ? <><strong>{s.natural}</strong> nốt chơi được</>
          : isChromatic(toType)
          ? <><strong>{s.natural}</strong> nốt thường, <strong>{s.slides}</strong> nốt bấm gạt</>
          : <><strong>{s.natural}</strong> nốt thường, <strong>{s.bends}</strong> nốt bend, <strong>{s.overblows}</strong> overblow</>}
        {s.unplayable > 0 && <>, <strong className="danger">{s.unplayable}</strong> nốt không chơi được (sẽ thành dấu nghỉ)</>}
      </p>
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => dialogRef.current?.close()}>Huỷ</button>
        <button type="button" className="btn btn-ghost" onClick={() => apply(true)}>Lưu thành bài mới</button>
        <button type="button" className="btn btn-primary" onClick={() => apply(false)}>Chuyển bài này</button>
      </div>
    </dialog>
  );
}

/** Ảnh khuông nhạc đã quét của bài (nếu có): xem lại số lỗ trên từng nốt, mở lại để sửa */
function ScanSection({ songId }: { songId: string }) {
  const scan = useLiveQuery(() => db.scans.get(songId), [songId]);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  if (!scan) return null;
  return (
    <details className="scan-saved" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Bản nhạc gốc (ảnh đã quét{scan.pages.length > 1 ? `, ${scan.pages.length} trang` : ''})</summary>
      {open && <ScanPages scan={scan} zoom={zoom} setZoom={setZoom} songId={songId} />}
    </details>
  );
}

function ScanPages({ scan, zoom, setZoom, songId }: { scan: SongScan; zoom: number; setZoom: (z: number) => void; songId: string }) {
  const urls = useMemo(() => scan.pages.map((p) => URL.createObjectURL(p.image)), [scan]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return (
    <div className="scan-saved-body">
      <div className="row between center wrap gap">
        <p className="small muted">Số trên nốt là lỗ kèn lúc quét: <span className="tok-blow">cam = thổi</span>, <span className="tok-draw">xanh = hút</span>.</p>
        <div className="row gap wrap">
          <div className="segmented" role="group" aria-label="Phóng to ảnh">
            {[1, 2, 3].map((z) => <button key={z} type="button" className={zoom === z ? 'on' : ''} aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z}×</button>)}
          </div>
          <Link to={`/ai?scan=${songId}`} className="btn btn-ghost"><Icon name="edit" size={18} /> Sửa nốt trên ảnh</Link>
        </div>
      </div>
      {scan.pages.map((p, i) => (
        <ScanPageView key={i} image={{ url: urls[i], width: p.width, height: p.height }} staves={p.staves} notes={p.notes}
          tokenOf={(id) => scan.tokens[id]} zoom={zoom} label={`Trang ${i + 1}`} />
      ))}
    </div>
  );
}

function ShareLinkDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.showModal?.(); area.current?.select(); }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="share-title">
      <h2 id="share-title">Chép link bài</h2>
      <p className="muted small">Máy này không mở được menu chia sẻ. Chọn hết nội dung dưới đây, chép rồi dán vào tin nhắn. Người nhận bấm link là mở được bài.</p>
      <textarea ref={area} readOnly rows={4} value={text} onFocus={(e) => e.currentTarget.select()} aria-label="Link bài" />
      <div className="row gap end">
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>Xong</button>
      </div>
    </dialog>
  );
}

/** Chọn kèn để xem bài: tab được xếp lại ngay, bài gốc giữ nguyên */
function ViewAsBar({ original, viewed, view, fit, choice, onChoice, onSaved }: {
  original: Song;
  viewed: Song;
  view: ViewAs | null;
  fit: TabFit | null;
  choice: ViewChoice;
  onChoice: (c: ViewChoice) => void;
  onSaved: (id: string) => void;
}) {
  const { toast } = useAppState();
  const origType = harpTypeOf(original);
  const manual = typeof choice === 'object';
  const active = !!view && !isOriginal(original, view);
  const type = view?.type ?? origType;
  const key = view?.key ?? original.harpKey;
  const mode = manual ? choice.mode : 'any';
  const set = (p: Partial<ViewAs>) => onChoice({ type, key, mode, ...p });
  const shift = fit ? fit.shift % 12 : 0;
  const missing = fit?.stats.unplayable ?? 0;
  const nameOf = (s: Song) => harpName(s.harpKey, harpTypeOf(s)).replace(/^Kèn/, 'kèn');
  // kỹ thuật khó mà kèn đang xem đòi hỏi
  const techBits = (st: TabFit['stats']) => [
    st.overblows && `${st.overblows} nốt overblow`,
    st.bends && `${st.bends} nốt bend`,
    st.slides && `${st.slides} nốt bấm gạt`,
  ].filter(Boolean).join(', ');
  const hardBits = fit ? techBits(fit.stats) : '';
  const origBits = choice === 'auto' && active ? techBits(bestHarp(original).originalFit.stats) : '';

  const saveCopy = async () => {
    const now = Date.now();
    const id = newId();
    const name = nameOf(viewed);
    await db.songs.put({ ...viewed, id, title: `${original.title} (${name})`, source: 'user', favorite: false, createdAt: now, updatedAt: now, lastPracticedAt: undefined });
    toast(`Đã lưu bản cho ${name}`);
    onSaved(id);
  };

  return (
    <section className={`viewas${active ? ' on' : ''}`} aria-label="Xem bài cho kèn khác">
      <div className="row gap wrap center">
        <label className="field viewas-field">
          <span className="field-label">Xem cho {BRAND.noun}</span>
          <select value={manual ? choice.type : choice} onChange={(e) => {
            const v = e.target.value;
            if (v === 'auto' || v === 'original') onChoice(v);
            else onChoice({ type: v as HarpType, key: isRecorder(v as HarpType) ? recorderKey(v as HarpType) : key, mode: 'any' });
          }}>
            <option value="auto">✨ Tự chọn {BRAND.noun} hợp nhất</option>
            <option value="original">Bản gốc ({harpName(original.harpKey, origType).replace(/^Kèn /, '')})</option>
            {SHOWN_HARP_TYPES.map((t) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]}</option>)}
          </select>
        </label>
        {manual && !isRecorder(type) && (
          <label className="field viewas-field">
            <span className="field-label">Tông kèn</span>
            <select value={key} onChange={(e) => set({ key: e.target.value as HarpKey })}>
              {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {harpKeyLabel(k, type)}</option>)}
            </select>
          </label>
        )}
        {manual && active && (
          <div className="segmented" role="radiogroup" aria-label="Cách xếp tab">
            <button type="button" role="radio" aria-checked={mode === 'any'} className={mode === 'any' ? 'on' : ''} onClick={() => set({ mode: 'any' })}>Dễ thổi nhất</button>
            <button type="button" role="radio" aria-checked={mode === 'octave'} className={mode === 'octave' ? 'on' : ''} onClick={() => set({ mode: 'octave' })}>Giữ giọng gốc</button>
          </div>
        )}
      </div>
      {choice !== 'original' && (
        <p className="small muted viewas-status">
          {!active
            ? (choice === 'auto' ? `Bản gốc (${nameOf(original)}) đã là kèn dễ chơi nhất cho bài này.` : 'Đang xem bản gốc — bài viết sẵn cho kèn này.')
            : <>
              {choice === 'auto' ? <>Tự chọn <strong>{nameOf(viewed)}</strong>, giữ đúng giọng bài{origBits ? ` (bản gốc ${nameOf(original)} cần ${origBits})` : ''}</> : <>Tab xếp lại cho {nameOf(viewed)}</>}
              {', bài gốc không đổi'}
              {shift !== 0 && <> · đã dịch giọng {fit!.shift > 0 ? '+' : ''}{fit!.shift} nửa cung</>}
              {missing > 0 && <> · <strong className="danger">{missing} nốt</strong> không có trên kèn này (thành dấu nghỉ)</>}
              {hardBits && <> · cần {hardBits}</>}
              {manual && mode === 'octave' && (missing > 0 || (fit?.stats.overblows ?? 0) > 0 || (fit?.stats.bends ?? 0) > 0) && ' — thử "Dễ thổi nhất"'}
              {'. '}
              <button type="button" className="link-btn" onClick={saveCopy}>Lưu thành bài mới</button>
            </>}
        </p>
      )}
    </section>
  );
}
