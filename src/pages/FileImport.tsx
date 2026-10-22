import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey, HarpType, harpName, midiToName } from '../lib/harp';
import { MusicFile, readMusicFile } from '../lib/musicFile';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { difficultyOf } from '../lib/converter';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/**
 * Nhập file nhạc dạng dữ liệu (MusicXML / MIDI) → tab. File ghi sẵn từng nốt nên chính xác tuyệt đối,
 * không phải đoán như đọc ảnh; chỉ cần chọn đúng bè giai điệu nếu file có nhiều bè.
 */
/** ảnh khuông nhạc (jpg, png…) hoặc bản nhạc PDF: không phải file dữ liệu, chuyển sang quét */
const isImage = (f: File) => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(jpe?g|png|webp|pdf)$/i.test(f.name);

export default function FileImport({ onImages }: { onImages?: (files: File[]) => void }) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<MusicFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [partId, setPartId] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [target, setTarget] = useState<HarpKey | 'auto'>('auto');
  const [harpType, setHarpType] = useState<HarpType>(settings.defaultHarpType);
  const [allowTranspose, setAllowTranspose] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (inputRef.current) inputRef.current.value = '';
    const images = list.filter(isImage);
    if (images.length && onImages) { onImages(images); return; }
    const f = list.find((x) => !isImage(x));
    if (!f) {
      if (images.length) setError('Ảnh / PDF bản nhạc hãy mở ở mục "Quét nhạc".');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mf = await readMusicFile(new Uint8Array(await f.arrayBuffer()), f.name);
      setFile(mf);
      setFileName(f.name);
      setPartId(mf.melodyPart);
      setTitle(mf.title);
      setArtist(mf.artist ?? '');
    } catch (e) {
      setFile(null);
      setError((e as Error).message || 'Không đọc được file');
    } finally {
      setBusy(false);
    }
  };

  const transcription = useMemo(() => (file && partId ? file.transcribe(partId) : null), [file, partId]);
  const converted = useMemo(() => (transcription ? aiToTab(transcription, target, allowTranspose, harpType) : null), [transcription, target, allowTranspose, harpType]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey, converted.harpType) : null), [converted]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: converted?.bpm ?? 90, tempoScale: 1, beatsPerBar: beatsPerBar(converted?.timeSig ?? '4/4'),
    pickupBeats: converted?.pickupBeats ?? 0, style: converted?.style ?? 'ballad', melody: true, beat: true, click: false, countIn: false,
  });

  const save = async () => {
    if (!converted || !file) return;
    const song = blankSong({
      title: title.trim() || 'Bài nhập từ file',
      artist: artist.trim() || undefined,
      harpKey: converted.harpKey,
      harpType: converted.harpType === 'diatonic' ? undefined : converted.harpType,
      songKey: converted.fit.shift % 12 === 0 ? converted.songKey : undefined,
      bpm: converted.bpm,
      timeSig: converted.timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: difficultyOf(converted.fit.stats),
      source: 'import',
      tags: [file.kind === 'midi' ? 'MIDI' : 'MusicXML'],
      notes: file.kind === 'midi'
        ? 'Nhập từ file MIDI — trường độ đã làm tròn theo phách; nghe lại nếu bài có nhịp phức tạp.'
        : undefined,
    });
    await db.songs.put(song);
    toast('Đã lưu vào thư viện');
    nav(`/song/${song.id}`);
  };

  const part = file?.parts.find((p) => p.id === partId);
  const noLyrics = !!transcription && !transcription.sections.some((s) => s.lines.some((l) => l.notes.some((n) => n.lyric)));

  return (
    <div className="ai-form">
      <p className="muted small">
        Chọn file <strong>MusicXML</strong> (<code>.musicxml</code>, <code>.mxl</code>, <code>.xml</code>) hoặc <strong>MIDI</strong> (<code>.mid</code>).
        File ghi sẵn từng nốt nên tab <strong>đúng tuyệt đối</strong>, không phải đoán như đọc ảnh.
        Chọn <strong>ảnh khuông nhạc</strong> (<code>.jpg</code>, <code>.png</code>, chọn được nhiều trang) hoặc <strong>bản nhạc PDF</strong> (<code>.pdf</code>) thì app chuyển sang quét nốt ngay trên máy.
        Tìm file này trên MuseScore, các diễn đàn nhạc, hoặc xuất từ phần mềm soạn nhạc (MuseScore, Sibelius, Finale…).
      </p>
      <div className="row gap wrap center">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Icon name="music" size={18} /> {file ? 'Chọn file khác' : 'Chọn file nhạc / ảnh'}
        </button>
        {fileName && <span className="muted small">{fileName}</span>}
        <input ref={inputRef} type="file" hidden multiple={!!onImages} onChange={(e) => open(e.target.files)}
          accept={`.mid,.midi,.kar,.rmi,.musicxml,.mxl,.xml,audio/midi,audio/x-midi,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml${onImages ? ',.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf' : ''}`} />
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <FileSources />

      {file && converted && parsed && (
        <>
          <div className="row gap wrap end-align">
            <label className="field grow">
              <span className="field-label">Tên bài</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bài hát" />
            </label>
            <label className="field grow">
              <span className="field-label">Tác giả</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
          <div className="row gap wrap end-align">
            {file.parts.length > 1 && (
              <label className="field grow">
                <span className="field-label">Bè giai điệu</span>
                <select value={partId} onChange={(e) => setPartId(e.target.value)}>
                  {file.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.notes} nốt, {midiToName(p.low)}–{midiToName(p.high)}{p.id === file.melodyPart ? ' (máy đoán là giai điệu)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <HarpTypeSelect value={harpType} onChange={setHarpType} />
            <KeySelect value={target} onChange={setTarget} allowAuto label="Chơi trên kèn" />
            {target !== 'auto' && (
              <label className="check">
                <input type="checkbox" checked={allowTranspose} onChange={(e) => setAllowTranspose(e.target.checked)} />
                Cho phép dịch giọng để dễ thổi
              </label>
            )}
          </div>

          <section className="ai-result" aria-label="Kết quả">
            <p className="muted">
              {harpName(converted.harpKey, converted.harpType)}
              {converted.fit.shift % 12 !== 0 && `, đã dịch giọng ${converted.fit.shift > 0 ? '+' : ''}${converted.fit.shift} nửa cung`}
              {`, ${converted.timeSig}, ${converted.bpm} bpm`}
              {converted.songKey && `, giọng ${converted.songKey}`}
            </p>
            <p className="small">
              {converted.fit.stats.natural} nốt thường, {converted.fit.stats.bends} nốt bend
              {converted.fit.stats.unplayable > 0 && `, ${converted.fit.stats.unplayable} nốt ngoài tầm kèn (đã thành dấu nghỉ)`}.
            </p>
            {(converted.fit.stats.unplayable > 0 || noLyrics || (file.parts.length > 1 && part)) && (
              <ul className="warnings">
                {file.parts.length > 1 && <li>File có {file.parts.length} bè — nghe thử, nếu không phải giai điệu chính thì chọn bè khác ở trên.</li>}
                {converted.fit.stats.unplayable > 0 && <li>Có nốt ngoài tầm kèn — thử chọn kèn khác hoặc cho phép dịch giọng.</li>}
                {noLyrics && <li>File không có lời — thêm lời trong trang Sửa bài nếu cần.</li>}
              </ul>
            )}
            <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
            <div className="row gap preview-actions">
              <MiniPlay p={player} />
              <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Nơi tìm file nhạc dạng dữ liệu (MusicXML / MIDI) + mẹo chuyển PDF thành MusicXML */
const SOURCES: { name: string; url: string; what: string }[] = [
  { name: 'Cùng Tập Nhạc', url: 'https://cungtapnhac.com/nhac-midi', what: 'Kho nhạc MIDI và sheet nhạc Việt. Tìm tên bài → mở mục Nhạc MIDI → tải file .mid về máy.' },
  { name: 'MuseScore.com', url: 'https://musescore.com/sheetmusic', what: 'Kho lớn nhất, có nhiều bài Việt do người dùng soạn. Mở bài → Download → MusicXML hoặc MIDI (cần tài khoản miễn phí; một số bài chỉ dành cho gói Pro).' },
  { name: 'IMSLP', url: 'https://imslp.org', what: 'Thư viện nhạc cổ điển hết bản quyền. Phần lớn là PDF, một số bài có MusicXML / MIDI.' },
  { name: 'Mutopia Project', url: 'https://www.mutopiaproject.org', what: 'Nhạc cổ điển, dân ca hết bản quyền — có sẵn file MIDI.' },
];

function FileSources() {
  const [q, setQ] = useState('');
  const search = (kind: 'cungtapnhac' | 'any') => {
    const name = q.trim();
    if (!name) return;
    // URLSearchParams ghi dấu cách thành "+": trang tìm của Cùng Tập Nhạc hiểu kiểu này
    const url = kind === 'cungtapnhac'
      ? `https://cungtapnhac.com/search?${new URLSearchParams({ searchword: name })}`
      : `https://www.google.com/search?q=${encodeURIComponent(`${name} musicxml OR mxl OR midi`)}`;
    window.open(url, '_blank', 'noopener');
  };
  return (
    <details className="syntax-help file-sources">
      <summary>Lấy file MusicXML / MIDI ở đâu?</summary>
      <form className="row gap wrap end-align" onSubmit={(e) => { e.preventDefault(); search('cungtapnhac'); }}>
        <label className="field grow">
          <span className="field-label">Tìm theo tên bài</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ví dụ: Diễm xưa" enterKeyHint="search" />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={!q.trim()}><Icon name="search" size={18} /> Trên Cùng Tập Nhạc</button>
        <button type="button" className="btn btn-ghost" disabled={!q.trim()} onClick={() => search('any')}>Mọi trang</button>
      </form>
      <ul>
        {SOURCES.map((s) => (
          <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> — {s.what}</li>
        ))}
      </ul>
      <p className="small"><strong>Cách tải về điện thoại rồi mở trong app:</strong> tải file (.mxl, .musicxml hoặc .mid) về máy → quay lại đây bấm <strong>Chọn file nhạc</strong> → chọn file vừa tải trong mục Tải xuống.</p>
      <p className="small"><strong>Chỉ có bản PDF đẹp?</strong> Mở bằng <a href="https://musescore.org" target="_blank" rel="noreferrer">MuseScore</a> (miễn phí, trên máy tính: File → Import PDF) hoặc <a href="https://audiveris.github.io/audiveris/" target="_blank" rel="noreferrer">Audiveris</a>, sửa vài chỗ sai rồi File → Export → MusicXML. PDF in sắc nét đọc chính xác hơn nhiều so với ảnh chụp.</p>
      <p className="small muted">Bài còn bản quyền: chỉ dùng để tự tập, không chia sẻ lại file.</p>
    </details>
  );
}
