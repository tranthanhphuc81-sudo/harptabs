import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey, midiToName } from '../lib/harp';
import { MusicFile, readMusicFile } from '../lib/musicFile';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/**
 * Nhập file nhạc dạng dữ liệu (MusicXML / MIDI) → tab. File ghi sẵn từng nốt nên chính xác tuyệt đối,
 * không phải đoán như đọc ảnh; chỉ cần chọn đúng bè giai điệu nếu file có nhiều bè.
 */
export default function FileImport() {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<MusicFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [partId, setPartId] = useState('');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [target, setTarget] = useState<HarpKey | 'auto'>('auto');
  const [allowTranspose, setAllowTranspose] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const open = async (files: FileList | null) => {
    const f = files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!f) return;
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
  const converted = useMemo(() => (transcription ? aiToTab(transcription, target, allowTranspose) : null), [transcription, target, allowTranspose]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey) : null), [converted]);
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
      songKey: converted.fit.shift % 12 === 0 ? converted.songKey : undefined,
      bpm: converted.bpm,
      timeSig: converted.timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: converted.fit.stats.bends > 3 || converted.fit.stats.overblows ? 3 : converted.fit.stats.bends ? 2 : 1,
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
        Tìm file này trên MuseScore, các diễn đàn nhạc, hoặc xuất từ phần mềm soạn nhạc (MuseScore, Sibelius, Finale…).
      </p>
      <div className="row gap wrap center">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Icon name="music" size={18} /> {file ? 'Chọn file khác' : 'Chọn file nhạc'}
        </button>
        {fileName && <span className="muted small">{fileName}</span>}
        <input ref={inputRef} type="file" hidden onChange={(e) => open(e.target.files)}
          accept=".mid,.midi,.kar,.rmi,.musicxml,.mxl,.xml,audio/midi,audio/x-midi,application/vnd.recordare.musicxml,application/vnd.recordare.musicxml+xml" />
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}

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
              Kèn {converted.harpKey}
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
            <div className="row gap">
              <MiniPlay p={player} />
              <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
            </div>
            <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
          </section>
        </>
      )}
    </div>
  );
}
