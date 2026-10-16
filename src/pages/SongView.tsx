import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteSongs, downloadJson, exportOne, newId, slugify } from '../lib/db';
import { HARP_KEYS, HARP_TYPES, HARP_TYPE_LABEL, HarpKey, HarpType, harpName, harpTypeOf, isChromatic, midiToName, songTonality } from '../lib/harp';
import { countTechniques, flatten, parseTab } from '../lib/tabText';
import { rekeyBody } from '../lib/converter';
import { beatsPerBar, Song } from '../lib/types';
import { TabView } from '../components/TabView';
import { HarpDiagram } from '../components/HarpDiagram';
import { PlayerBar } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
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
import { suggestInstrument, suggestStyle } from '../audio/suggest';

export default function SongView() {
  const { id } = useParams();
  const song = useLiveQuery(() => (id ? db.songs.get(id) : undefined), [id]);
  if (song === undefined) return <div className="page"><p className="muted">Đang tải…</p></div>;
  if (!song) return <div className="page"><p>Không tìm thấy bài này.</p><Link to="/" className="btn btn-ghost">Về thư viện</Link></div>;
  return <SongPlayerView key={song.id} song={song} />;
}

function SongPlayerView({ song }: { song: Song }) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const harpType = harpTypeOf(song);
  const chrom = isChromatic(harpType);
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
    songKey: song.songKey || songTonality(song.harpKey, song.position),
    chordOverrides: song.chords,
    sections,
  });
  // nhạc cụ giai điệu hợp với bài và kiểu nhịp đang phát (chỉ dùng khi tự động, chỉnh tay thì giữ)
  const autoInstrument = useMemo(() => suggestInstrument(song, flat, p.opts.style), [song, flat, p.opts.style]);
  useEffect(() => { setSongInstrument(autoInstrument.instrument); }, [autoInstrument]);
  useEffect(() => () => setSongInstrument(null), []);

  // ----- hợp âm đệm: hiện trên tab, chọn tay khi máy đoán sai -----
  const tonality = useMemo(() => parseTonality(song.songKey || songTonality(song.harpKey, song.position))!, [song.songKey, song.harpKey, song.position]);
  // đệm hát: luôn hiện hợp âm trên lời để hát theo
  const showChords = beatPrefs.showChords || !!p.opts.sing;
  const chordSegs = useMemo(
    () => (showChords ? harmonizeSegments(flat, bpb, song.pickupBeats, tonality, song.chords) : null),
    [showChords, flat, bpb, song.pickupBeats, tonality, song.chords],
  );
  const [chordEdit, setChordEdit] = useState<ChordSegment | null>(null);
  const pickChord = (seg: ChordSegment, name: string | null) => {
    const next = { ...(song.chords ?? {}) };
    if (name === null) delete next[segKey(seg.start)];
    else next[segKey(seg.start)] = name;
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

  const onNoteClick = (fi: number) => {
    setFocus(fi);
    if (waitMode) { const k = playable.indexOf(fi); if (k >= 0) setWaitIdx(k); return; }
    if (p.playing) p.play(fi);
    else if (flat[fi]?.midi != null) previewNote(flat[fi].midi!, 0.5);
    if (p.opts.loop) {
      const r = sectionRange(fi);
      if (r) p.setOpts({ loop: { start: r.start, end: r.end } });
    }
  };

  // ----- chế độ chờ nốt (micro) -----
  const stableFrames = useRef(0);
  const waitIdxRef = useRef(0);
  waitIdxRef.current = waitIdx;

  const stopWait = () => {
    micRef.current?.stop();
    micRef.current = null;
    setWaitMode(false);
    setHeard(null);
  };

  const startWait = async () => {
    p.stop();
    const mic = new MicPitch();
    mic.onReading = (r) => {
      setHeard(r);
      const target = flat[playable[waitIdxRef.current]];
      if (r && target && r.nearest === target.midi && Math.abs(r.cents) < 45) {
        stableFrames.current++;
        if (stableFrames.current >= 4) {
          stableFrames.current = 0;
          const next = waitIdxRef.current + 1;
          if (next >= playable.length) {
            toast('Hoàn thành cả bài!');
            setWaitIdx(0);
          } else setWaitIdx(next);
        }
      } else if (!r || (target && r.nearest !== target.midi)) {
        stableFrames.current = 0;
      }
    };
    try {
      await mic.start();
      micRef.current = mic;
      markPracticed();
      const startAt = focus != null ? Math.max(0, playable.indexOf(focus)) : 0;
      setWaitIdx(startAt);
      setWaitMode(true);
    } catch (e) {
      toast((e as Error).name === 'NotAllowedError' ? 'Cần cho phép dùng micro để luyện chế độ chờ nốt' : (e as Error).message);
    }
  };
  useEffect(() => () => micRef.current?.stop(), []);

  const activeIdx = waitMode ? playable[waitIdx] ?? null : p.active ?? focus;
  const activeToken = activeIdx != null ? flat[activeIdx]?.token : null;

  const toggleFav = () => db.songs.update(song.id, { favorite: !song.favorite });
  const exportSong = () => downloadJson(exportOne(song), `${slugify(song.title)}.harptab.json`);
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
            {!chrom && song.position && <span>Vị trí {song.position}</span>}
            {song.songKey && <span>Giọng {song.songKey}</span>}
            <span>{song.timeSig}</span>
            <span>{stats.notes} nốt</span>
            {stats.bends > 0 && <span className="bend-count">{stats.bends} bend</span>}
            {stats.slides > 0 && <span className="bend-count">{stats.slides} nốt gạt</span>}
          </p>
        </div>
        <div className="sh-actions">
          <button type="button" className={`icon-btn${song.favorite ? ' starred' : ''}`} onClick={toggleFav} aria-pressed={song.favorite} aria-label="Yêu thích">
            <Icon name="star" filled={song.favorite} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setRekeyOpen(true)} aria-label="Chuyển sang kèn khác"><Icon name="swap" /></button>
          <button type="button" className="icon-btn" onClick={exportSong} aria-label="Xuất file bài"><Icon name="download" /></button>
          <Link to={`/song/${song.id}/edit`} className="icon-btn" aria-label="Sửa bài"><Icon name="edit" /></Link>
          <button type="button" className={confirmDel ? 'btn btn-danger del-confirm' : 'icon-btn'} onClick={removeSong}
            aria-label={confirmDel ? 'Bấm lần nữa để xoá bài' : 'Xoá bài'}>
            {confirmDel ? 'Xoá?' : <Icon name="trash" />}
          </button>
        </div>
      </header>

      {song.notes && <p className="song-notes">{song.notes}</p>}
      {issues.length > 0 && (
        <div className="alert error">Bài có {issues.length} lỗi ký hiệu. <Link to={`/song/${song.id}/edit`}>Mở trình sửa</Link> để xem chi tiết.</div>
      )}

      <p className="legend">
        <span className="lg blow">4</span> thổi
        <span className="lg draw">−4</span> hút
        {chrom ? <><span className="lg bend">&lt;</span> bấm nút gạt</> : <><span className="lg bend">′</span> bend nửa cung</>}
        <span className="muted">Chạm vào nốt để nghe, hoặc chọn chỗ bắt đầu phát.</span>
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

      <TabView
        parsed={parsed}
        flat={flat}
        active={activeIdx}
        onNoteClick={onNoteClick}
        showNames={settings.showNoteNames}
        nameStyle={settings.noteNames}
        size={settings.tabSize}
        chords={chordSegs}
        onChordClick={setChordEdit}
      />

      <div className="below-tab">
        <button type="button" className="btn btn-ghost" onClick={() => setShowDiagram((v) => !v)} aria-expanded={showDiagram}>
          {showDiagram ? 'Ẩn sơ đồ kèn' : 'Hiện sơ đồ kèn'}
        </button>
      </div>
      {showDiagram && <HarpDiagram harpKey={song.harpKey} harpType={harpType} highlight={activeToken ? [activeToken] : []} nameStyle={settings.noteNames} />}

      <ScanSection songId={song.id} />

      <PlayerBar
        p={player}
        loopLabel={loopInfo?.label}
        onToggleLoop={toggleLoop}
        autoStyle={autoStyle}
        autoApplied={autoApplied}
        autoInstrument={autoInstrument}
        extra={
          <button type="button" className={`chip${waitMode ? ' on' : ''}`} aria-pressed={waitMode} onClick={() => (waitMode ? stopWait() : startWait())}>
            <Icon name="mic" size={15} /> Chờ nốt
          </button>
        }
      />

      {chordEdit && (
        <ChordPicker
          seg={chordEdit}
          tonality={tonality}
          where={chordWhere(chordEdit)}
          onPick={(name) => pickChord(chordEdit, name)}
          onClose={() => setChordEdit(null)}
        />
      )}

      {rekeyOpen && (
        <RekeyDialog
          song={song}
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
  const [target, setTarget] = useState<HarpKey>(song.harpKey === 'C' ? 'G' : 'C');
  const [mode, setMode] = useState<'octave' | 'any'>('any');
  const preview = useMemo(() => rekeyBody(song.body, song.harpKey, target, mode, fromType, toType), [song, target, mode, fromType, toType]);
  const toName = harpName(target, toType).replace(/^Kèn/, 'kèn');
  const typeFields = { harpType: toType === 'diatonic' ? undefined : toType, position: isChromatic(toType) ? 1 as const : song.position };
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
      <h2 id="rekey-title">Chuyển sang kèn khác</h2>
      <label className="field">
        <span className="field-label">Loại kèn</span>
        <select value={toType} onChange={(e) => setToType(e.target.value as HarpType)}>
          {HARP_TYPES.map((t) => <option key={t} value={t}>{HARP_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Kèn bạn có</span>
        <select value={target} onChange={(e) => setTarget(e.target.value as HarpKey)}>
          {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {k}</option>)}
        </select>
      </label>
      <fieldset className="radio-group">
        <legend className="field-label">Cách chuyển</legend>
        <label><input type="radio" checked={mode === 'any'} onChange={() => setMode('any')} /> Dịch giọng cho dễ thổi nhất <span className="muted">(giai điệu giữ nguyên, cao độ thay đổi)</span></label>
        <label><input type="radio" checked={mode === 'octave'} onChange={() => setMode('octave')} /> Giữ đúng giọng gốc <span className="muted">(để chơi cùng bản thu{isChromatic(toType) ? ', có thể phải bấm gạt nhiều hơn' : ', có thể phải bend'})</span></label>
      </fieldset>
      <p className="rekey-stats">
        {isChromatic(toType)
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
