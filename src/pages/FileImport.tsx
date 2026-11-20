import { BRAND } from '../appConfig';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey, HarpType, harpName, midiToName } from '../lib/harp';
import { MusicFile, readMusicFile } from '../lib/musicFile';
import { VN_ENCODINGS, VnEncoding } from '../lib/vnEncoding';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { difficultyOf } from '../lib/converter';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';
import { saveMidiSource } from '../lib/midiSources';
import { tabSig } from '../lib/backings';
import { t } from '../lib/i18n';

/**
 * Nhập file nhạc dạng dữ liệu (MusicXML / MIDI) → tab. File ghi sẵn từng nốt nên chính xác tuyệt đối,
 * không phải đoán như đọc ảnh; chỉ cần chọn đúng bè giai điệu nếu file có nhiều bè.
 */
/** ảnh khuông nhạc (jpg, png…) hoặc bản nhạc PDF: không phải file dữ liệu, chuyển sang quét */
const isAudio = (f: File) => !/midi|\.(mid|midi|kar|rmi)$/i.test(f.type + f.name) && (f.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac|webm)$/i.test(f.name));
const isImage = (f: File) => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(jpe?g|png|webp|pdf)$/i.test(f.name);

export default function FileImport({ onImages, onAudio }: { onImages?: (files: File[]) => void; onAudio?: (file: File) => void }) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<MusicFile | null>(null);
  const [fileName, setFileName] = useState('');
  // file MIDI gốc: giữ lại khi lưu bài để karaoke phát bản phối gốc
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
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
    const audio = list.find(isAudio);
    if (audio && onAudio) { onAudio(audio); return; }
    const f = list.find((x) => !isImage(x));
    if (!f) {
      if (images.length) setError(t('Ảnh / PDF bản nhạc hãy mở ở mục "Quét nhạc".'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = new Uint8Array(await f.arrayBuffer());
      const mf = await readMusicFile(data, f.name);
      setFile(mf);
      setBytes(mf.kind === 'midi' ? data : null);
      setFileName(f.name);
      setPartId(mf.melodyPart);
      setTitle(mf.title);
      setArtist(mf.artist ?? '');
    } catch (e) {
      setFile(null);
      setError((e as Error).message || t('Không đọc được file'));
    } finally {
      setBusy(false);
    }
  };

  // lời / tên bị vỡ dấu: đọc lại file theo bảng mã người dùng chọn (giữ bè, mức lọc đang chọn)
  const reencode = async (encoding: VnEncoding) => {
    if (!bytes) return;
    try {
      const mf = await readMusicFile(bytes, fileName, { encoding });
      setFile(mf);
      if (!title.trim() || title === file?.title) setTitle(mf.title);
    } catch (e) {
      setError((e as Error).message || t('Không đọc được file'));
    }
  };

  const [backing, setBacking] = useState(2);
  const transcription = useMemo(() => (file && partId ? file.transcribe(partId, { backing }) : null), [file, partId, backing]);
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
      title: title.trim() || t('Bài nhập từ file'),
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
        ? t('Nhập từ file MIDI — trường độ đã làm tròn theo phách; nghe lại nếu bài có nhịp phức tạp.')
        : undefined,
    });
    await db.songs.put(song);
    if (file.kind === 'midi' && bytes && transcription?.startBeat !== undefined) {
      // không giữ được file gốc thì bài vẫn lưu bình thường (karaoke dùng đệm tự tạo)
      await saveMidiSource(song.id, fileName, bytes, { melodyPart: partId, startBeat: transcription.startBeat, shift: converted.fit.shift }, tabSig(flat)).catch(() => {});
    }
    toast(t('Đã lưu vào thư viện'));
    nav(`/song/${song.id}`);
  };

  const part = file?.parts.find((p) => p.id === partId);
  const noLyrics = !!transcription && !transcription.sections.some((s) => s.lines.some((l) => l.notes.some((n) => n.lyric)));

  return (
    <div className="ai-form">
      <div className="row gap wrap center">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Icon name="music" size={18} /> {file ? t('Chọn file khác') : t('Chọn file nhạc / ảnh')}
        </button>
        {fileName && <span className="muted small">{fileName}</span>}
        <input ref={inputRef} type="file" hidden multiple={!!onImages} onChange={(e) => open(e.target.files)}
          accept={`.mid,.midi,.kar,.rmi,.musicxml,.mxl,.xml,audio/midi,audio/x-midi,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml${onImages ? ',.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf' : ''}${onAudio ? ',.mp3,.m4a,.wav,.ogg,.aac,.flac' : ''}`} />
      </div>
      {/* nhận những loại file nào: gọn từng dòng thay cho đoạn giải thích dài (nút chọn file nằm trên cùng) */}
      {!file && (
        <ul className="file-kinds small">
          <li><strong>MusicXML, MIDI</strong> <span className="muted">{t('(.musicxml .mxl .mid) — tab đúng tuyệt đối, không phải đoán')}</span></li>
          {onImages && <li><strong>{t('Ảnh, PDF bản nhạc')}</strong> <span className="muted">{t('(.jpg .png .pdf, nhiều trang) — quét nốt ngay trên máy')}</span></li>}
          {onAudio && <li><strong>{t('Âm thanh')}</strong> <span className="muted">{t('(.mp3 .m4a .wav) — dò giai điệu, ra bản nháp')}</span></li>}
        </ul>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}
      <FileSources />

      {file && converted && parsed && (
        <>
          <div className="row gap wrap end-align">
            <label className="field grow">
              <span className="field-label">{t('Tên bài')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Tên bài hát')} />
            </label>
            <label className="field grow">
              <span className="field-label">{t('Tác giả')}</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
          <div className="row gap wrap end-align">
            {file.parts.length > 1 && (
              <label className="field grow">
                <span className="field-label">{t('Bè giai điệu')}</span>
                <select value={partId} onChange={(e) => setPartId(e.target.value)}>
                  {file.parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.notes} {t('nốt,')} {midiToName(p.low)}–{midiToName(p.high)}{p.id === file.melodyPart ? t(' (máy đoán là giai điệu)') : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {file.kind === 'midi' && (
              <label className="field grow">
                <span className="field-label">{t('Lọc giọng phụ cao:')} {[t('tắt'), t('nhẹ'), t('vừa'), t('mạnh')][backing]}</span>
                <input type="range" min={0} max={3} step={1} value={backing} onChange={(e) => setBacking(Number(e.target.value))} aria-label={t('Mức lọc giọng phụ')} />
                <span className="small muted">{t('Kéo lên nếu nghe có nốt cao vút lên đột ngột (giọng đệm / hoạ âm lẫn trong file). Mức mạnh còn nối các nốt ngắn lặp lại (nghe như nói lắp) thành một nốt.')}</span>
              </label>
            )}
            {file.encoding && (
              <label className="field">
                <span className="field-label">{t('Bảng mã lời')}</span>
                <select value={file.encoding} onChange={(e) => void reencode(e.target.value as VnEncoding)}>
                  {VN_ENCODINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="small muted">{t('Lời bị vỡ dấu (kiểu “Toâi”, “T«i”) thì chọn bảng mã khác.')}</span>
              </label>
            )}
            <HarpTypeSelect value={harpType} onChange={setHarpType} />
            <KeySelect value={target} onChange={setTarget} allowAuto label={t('Chơi trên {0}', BRAND.noun)} harpType={harpType} />
            {target !== 'auto' && (
              <label className="check">
                <input type="checkbox" checked={allowTranspose} onChange={(e) => setAllowTranspose(e.target.checked)} />
                {t('Cho phép dịch giọng để dễ thổi')}
              </label>
            )}
          </div>

          <section className="ai-result" aria-label={t('Kết quả')}>
            <p className="muted">
              {harpName(converted.harpKey, converted.harpType)}
              {converted.fit.shift % 12 !== 0 && t(', đã dịch giọng {0}{1} nửa cung', converted.fit.shift > 0 ? '+' : '', converted.fit.shift)}
              {`, ${converted.timeSig}, ${converted.bpm} bpm`}
              {converted.songKey && t(', giọng {0}', converted.songKey)}
            </p>
            <p className="small">
              {converted.fit.stats.natural} {t('nốt thường,')} {converted.fit.stats.bends} {t('nốt bend')}
              {converted.fit.stats.unplayable > 0 && t(', {0} nốt ngoài tầm {1} (đã thành dấu nghỉ)', converted.fit.stats.unplayable, BRAND.noun)}.
            </p>
            {(converted.fit.stats.unplayable > 0 || noLyrics || (file.parts.length > 1 && part)) && (
              <ul className="warnings">
                {file.parts.length > 1 && <li>{t('File có {0} bè — nghe thử, nếu không phải giai điệu chính thì chọn bè khác ở trên.', file.parts.length)}</li>}
                {converted.fit.stats.unplayable > 0 && <li>{t('Có nốt ngoài tầm {0} — thử chọn {1} khác hoặc cho phép dịch giọng.', BRAND.noun, BRAND.noun)}</li>}
                {noLyrics && <li>{t('File không có lời — thêm lời trong trang Sửa bài nếu cần.')}</li>}
              </ul>
            )}
            <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={converted.harpType} harpKey={converted.harpKey} />
            <div className="row gap preview-actions">
              <MiniPlay p={player} />
              <button type="button" className="btn btn-primary" onClick={save}>{t('Lưu vào thư viện')}</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** Nơi tìm file nhạc dạng dữ liệu (MusicXML / MIDI) + mẹo chuyển PDF thành MusicXML */
const SOURCES: { name: string; url: string; what: string }[] = [
  { name: t('Cùng Tập Nhạc'), url: 'https://cungtapnhac.com/nhac-midi', what: t('Kho nhạc MIDI và sheet nhạc Việt. Tìm tên bài → mở mục Nhạc MIDI → tải file .mid về máy.') },
  { name: 'MuseScore.com', url: 'https://musescore.com/sheetmusic', what: t('Kho lớn nhất, có nhiều bài Việt do người dùng soạn. Mở bài → Download → MusicXML hoặc MIDI (cần tài khoản miễn phí; một số bài chỉ dành cho gói Pro).') },
  { name: 'IMSLP', url: 'https://imslp.org', what: t('Thư viện nhạc cổ điển hết bản quyền. Phần lớn là PDF, một số bài có MusicXML / MIDI.') },
  { name: 'Mutopia Project', url: 'https://www.mutopiaproject.org', what: t('Nhạc cổ điển, dân ca hết bản quyền — có sẵn file MIDI.') },
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
      <summary>{t('Lấy file MusicXML / MIDI ở đâu?')}</summary>
      <form className="row gap wrap end-align" onSubmit={(e) => { e.preventDefault(); search('cungtapnhac'); }}>
        <label className="field grow">
          <span className="field-label">{t('Tìm theo tên bài')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Ví dụ: Diễm xưa')} enterKeyHint="search" />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={!q.trim()}><Icon name="search" size={18} /> {t('Trên Cùng Tập Nhạc')}</button>
        <button type="button" className="btn btn-ghost" disabled={!q.trim()} onClick={() => search('any')}>{t('Mọi trang')}</button>
      </form>
      <ul>
        {SOURCES.map((s) => (
          <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> — {s.what}</li>
        ))}
      </ul>
      <p className="small"><strong>{t('Tự soạn bài?')}</strong> {t('Phần mềm soạn nhạc (MuseScore, Sibelius, Finale…) đều xuất được: File → Export → MusicXML hoặc MIDI.')}</p>
      <p className="small"><strong>{t('Cách tải về điện thoại rồi mở trong app:')}</strong> {t('tải file (.mxl, .musicxml hoặc .mid) về máy → quay lại đây bấm')} <strong>{t('Chọn file nhạc')}</strong> {t('→ chọn file vừa tải trong mục Tải xuống.')}</p>
      <p className="small"><strong>{t('Chỉ có bản PDF đẹp?')}</strong> {t('Mở bằng')} <a href="https://musescore.org" target="_blank" rel="noreferrer">MuseScore</a> {t('(miễn phí, trên máy tính: File → Import PDF) hoặc')} <a href="https://audiveris.github.io/audiveris/" target="_blank" rel="noreferrer">Audiveris</a>{t(', sửa vài chỗ sai rồi File → Export → MusicXML. PDF in sắc nét đọc chính xác hơn nhiều so với ảnh chụp.')}</p>
      <p className="small muted">{t('Bài còn bản quyền: chỉ dùng để tự tập, không chia sẻ lại file.')}</p>
    </details>
  );
}
