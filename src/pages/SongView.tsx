import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, downloadJson, exportOne, newId, slugify } from '../lib/db';
import { HARP_KEYS, HarpKey, midiToName } from '../lib/harp';
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
  const parsed = useMemo(() => parseTab(song.body, song.harpKey), [song.body, song.harpKey]);
  const flat = useMemo(() => flatten(parsed), [parsed]);
  const stats = useMemo(() => countTechniques(parsed), [parsed]);
  const bpb = beatsPerBar(song.timeSig);

  const p = usePlayer(flat, {
    bpm: song.bpm, tempoScale: 1, beatsPerBar: bpb, pickupBeats: song.pickupBeats,
    style: song.style, melody: true, beat: song.style !== 'none', click: false, countIn: true,
  });

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

  const issues = parsed.issues.filter((i) => i.level === 'error');

  return (
    <div className="page page-song">
      <header className="song-head">
        <Link to="/" className="icon-btn back" aria-label="Về thư viện"><Icon name="back" /></Link>
        <KeyPlate k={song.harpKey} size="l" />
        <div className="sh-text">
          <h1>{song.title || 'Chưa đặt tên'}</h1>
          {song.artist && <p className="muted">{song.artist}</p>}
          <p className="sh-meta">
            <span>Kèn {song.harpKey}</span>
            {song.position && <span>Vị trí {song.position}</span>}
            {song.songKey && <span>Giọng {song.songKey}</span>}
            <span>{song.timeSig}</span>
            <span>{stats.notes} nốt</span>
            {stats.bends > 0 && <span className="bend-count">{stats.bends} bend</span>}
          </p>
        </div>
        <div className="sh-actions">
          <button type="button" className={`icon-btn${song.favorite ? ' starred' : ''}`} onClick={toggleFav} aria-pressed={song.favorite} aria-label="Yêu thích">
            <Icon name="star" filled={song.favorite} />
          </button>
          <button type="button" className="icon-btn" onClick={() => setRekeyOpen(true)} aria-label="Chuyển sang kèn khác"><Icon name="swap" /></button>
          <button type="button" className="icon-btn" onClick={exportSong} aria-label="Xuất file bài"><Icon name="download" /></button>
          <Link to={`/song/${song.id}/edit`} className="icon-btn" aria-label="Sửa bài"><Icon name="edit" /></Link>
        </div>
      </header>

      {song.notes && <p className="song-notes">{song.notes}</p>}
      {issues.length > 0 && (
        <div className="alert error">Bài có {issues.length} lỗi ký hiệu. <Link to={`/song/${song.id}/edit`}>Mở trình sửa</Link> để xem chi tiết.</div>
      )}

      <p className="legend">
        <span className="lg blow">4</span> thổi
        <span className="lg draw">−4</span> hút
        <span className="lg bend">′</span> bend nửa cung
        <span className="muted">Chạm vào nốt để nghe, hoặc chọn chỗ bắt đầu phát.</span>
      </p>

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
      />

      <div className="below-tab">
        <button type="button" className="btn btn-ghost" onClick={() => setShowDiagram((v) => !v)} aria-expanded={showDiagram}>
          {showDiagram ? 'Ẩn sơ đồ kèn' : 'Hiện sơ đồ kèn'}
        </button>
      </div>
      {showDiagram && <HarpDiagram harpKey={song.harpKey} highlight={activeToken ? [activeToken] : []} nameStyle={settings.noteNames} />}

      <ScanSection songId={song.id} />

      <PlayerBar
        p={player}
        loopLabel={loopInfo?.label}
        onToggleLoop={toggleLoop}
        extra={
          <button type="button" className={`chip${waitMode ? ' on' : ''}`} aria-pressed={waitMode} onClick={() => (waitMode ? stopWait() : startWait())}>
            <Icon name="mic" size={15} /> Chờ nốt
          </button>
        }
      />

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
  const [target, setTarget] = useState<HarpKey>(song.harpKey === 'C' ? 'G' : 'C');
  const [mode, setMode] = useState<'octave' | 'any'>('any');
  const preview = useMemo(() => rekeyBody(song.body, song.harpKey, target, mode), [song, target, mode]);
  const s = preview.fit.stats;
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialogRef.current?.showModal?.(); }, []);

  const apply = async (asNew: boolean) => {
    const now = Date.now();
    const shiftNote = preview.fit.shift % 12 !== 0 ? ` Đã dịch giọng ${preview.fit.shift > 0 ? '+' : ''}${preview.fit.shift} nửa cung.` : '';
    if (asNew) {
      const id = newId();
      await db.songs.put({ ...song, id, title: `${song.title} (kèn ${target})`, harpKey: target, body: preview.body, songKey: undefined, source: 'user', createdAt: now, updatedAt: now, favorite: false });
      toast(`Đã tạo bản cho kèn ${target}.${shiftNote}`);
      onDone(id);
    } else {
      await db.songs.update(song.id, { harpKey: target, body: preview.body, songKey: mode === 'octave' ? song.songKey : undefined, updatedAt: now });
      toast(`Đã chuyển sang kèn ${target}.${shiftNote}`);
      onDone(song.id);
    }
  };

  return (
    <dialog ref={dialogRef} className="sheet" onClose={onClose} aria-labelledby="rekey-title">
      <h2 id="rekey-title">Chuyển sang kèn khác</h2>
      <label className="field">
        <span className="field-label">Kèn bạn có</span>
        <select value={target} onChange={(e) => setTarget(e.target.value as HarpKey)}>
          {HARP_KEYS.map((k) => <option key={k} value={k}>Kèn {k}</option>)}
        </select>
      </label>
      <fieldset className="radio-group">
        <legend className="field-label">Cách chuyển</legend>
        <label><input type="radio" checked={mode === 'any'} onChange={() => setMode('any')} /> Dịch giọng cho dễ thổi nhất <span className="muted">(giai điệu giữ nguyên, cao độ thay đổi)</span></label>
        <label><input type="radio" checked={mode === 'octave'} onChange={() => setMode('octave')} /> Giữ đúng giọng gốc <span className="muted">(để chơi cùng bản thu, có thể phải bend)</span></label>
      </fieldset>
      <p className="rekey-stats">
        <strong>{s.natural}</strong> nốt thường, <strong>{s.bends}</strong> nốt bend, <strong>{s.overblows}</strong> overblow
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
