import { BRAND } from '../appConfig';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiToTab } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey, HarpType, harpName } from '../lib/harp';
import { audioToTranscription, DetectedNote, RecordingKind, TempoGuess } from '../lib/audioTranscribe';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { difficultyOf } from '../lib/converter';
import { decodeAudio } from '../components/RecordingCheck';
import { HarpTypeSelect, KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState } from '../state';

/**
 * Bản thu → tab: thu âm ngay trong app hoặc chọn file âm thanh, máy dò giai điệu (lib/audioTranscribe.ts),
 * đoán tempo, làm tròn theo phách rồi xếp tab cho loại kèn đã chọn. Người dùng chỉnh tempo / nhịp / độ mịn
 * và nghe thử trước khi lưu. Chạy hoàn toàn trên máy.
 */

type Status = 'idle' | 'recording' | 'decoding' | 'analyzing' | 'done' | 'error';

const TIME_SIGS: { value: string; barBeats: number }[] = [
  { value: '4/4', barBeats: 4 }, { value: '3/4', barBeats: 3 }, { value: '2/4', barBeats: 2 },
];

function detect(samples: Float32Array, sampleRate: number, kind: RecordingKind): Promise<{ notes: DetectedNote[]; tempo: TempoGuess }> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../lib/audioTranscribe.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; notes?: DetectedNote[]; tempo?: TempoGuess; error?: string }>) => {
      w.terminate();
      if (e.data.ok && e.data.notes && e.data.tempo) resolve({ notes: e.data.notes, tempo: e.data.tempo });
      else reject(new Error(e.data.error || 'Lỗi dò giai điệu'));
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Lỗi dò giai điệu')); };
    w.postMessage({ samples, sampleRate, kind }, [samples.buffer]);
  });
}

export default function AudioImport({ initialFile }: { initialFile?: File }) {
  const { settings, toast } = useAppState();
  const nav = useNavigate();
  // file đưa sang từ ô "File nhạc" thường là cả bài hát có nhạc đệm
  const [kind, setKind] = useState<RecordingKind>(initialFile ? 'mix' : 'solo');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [secs, setSecs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState<DetectedNote[] | null>(null);
  const [guess, setGuess] = useState<TempoGuess | null>(null);
  const [bpm, setBpm] = useState(90);
  const [timeSig, setTimeSig] = useState('4/4');
  const [grid, setGrid] = useState(0.5);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [harpType, setHarpType] = useState<HarpType>(settings.defaultHarpType);
  const [target, setTarget] = useState<HarpKey | 'auto'>('auto');
  const [allowTranspose, setAllowTranspose] = useState(true);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    rec.current?.stream.getTracks().forEach((t) => t.stop());
    if (rec.current) clearInterval(rec.current.timer);
  }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const run = async (blob: Blob, name: string) => {
    setError('');
    setNotes(null);
    setAudioUrl(URL.createObjectURL(blob));
    setFileName(name);
    if (!title && name) setTitle(name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim());
    try {
      setStatus('decoding');
      const { samples, sampleRate } = await decodeAudio(blob);
      if (samples.length < sampleRate * 3) throw new Error('Bản thu quá ngắn — thu ít nhất vài câu nhạc');
      if (samples.length > sampleRate * 60 * 8) throw new Error('Bản thu dài quá 8 phút — cắt bớt rồi thử lại');
      setStatus('analyzing');
      const r = await detect(samples, sampleRate, kind);
      if (r.notes.length < 4) throw new Error(kind === 'mix'
        ? 'Không tách được giọng hát — thử bài có giọng hát rõ, hoặc tự hát / ngân nga lại giai điệu rồi thu.'
        : 'Không nghe ra giai điệu — thu gần micro hơn, nơi yên tĩnh, hát / thổi từng nốt rõ ràng.');
      setNotes(r.notes);
      setGuess(r.tempo);
      setBpm(r.tempo.bpm);
      setStatus('done');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  // có sẵn file (chọn từ ô "File nhạc"): dò ngay khi mở
  const started = useRef(false);
  useEffect(() => {
    if (!initialFile || started.current) return;
    started.current = true;
    void run(initialFile, initialFile.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần cho file đưa sang
  }, []);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        run(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), '');
      };
      mr.start();
      setSecs(0);
      const timer = window.setInterval(() => setSecs((s) => s + 1), 1000);
      rec.current = { mr, stream, timer };
      setStatus('recording');
    } catch {
      setError('Không mở được micro — kiểm tra quyền micro của trình duyệt / app');
      setStatus('error');
    }
  };
  const stop = () => {
    if (!rec.current) return;
    clearInterval(rec.current.timer);
    rec.current.mr.stop();
    rec.current = null;
  };

  const barBeats = TIME_SIGS.find((t) => t.value === timeSig)?.barBeats ?? 4;
  // đổi tempo tay: giữ gốc lưới máy tìm (một điểm đúng phách), chỉ đổi độ dài phách
  const transcription = useMemo(() => (notes && guess
    ? audioToTranscription(notes, { bpm, offset: guess.offset, barBeats, grid, timeSig, title: title.trim(), artist: artist.trim() || undefined })
    : null), [notes, guess, bpm, barBeats, grid, timeSig, title, artist]);
  const converted = useMemo(() => (transcription ? aiToTab(transcription, target, allowTranspose, harpType) : null), [transcription, target, allowTranspose, harpType]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey, converted.harpType) : null), [converted]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: converted?.bpm ?? bpm, tempoScale: 1, beatsPerBar: beatsPerBar(timeSig),
    pickupBeats: converted?.pickupBeats ?? 0, style: converted?.style ?? 'ballad', melody: true, beat: true, click: false, countIn: false,
  });

  const save = async () => {
    if (!converted) return;
    const song = blankSong({
      title: title.trim() || 'Bài từ bản thu',
      artist: artist.trim() || undefined,
      harpKey: converted.harpKey,
      harpType: converted.harpType === 'diatonic' ? undefined : converted.harpType,
      songKey: converted.fit.shift % 12 === 0 ? converted.songKey : undefined,
      bpm: converted.bpm,
      timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: difficultyOf(converted.fit.stats),
      source: 'import',
      tags: ['Bản thu'],
      notes: 'Tab dò từ bản thu — trường độ đã làm tròn theo phách. Nghe lại và sửa chỗ chưa đúng trong Sửa bài; thêm lời nếu cần.',
    });
    await db.songs.put(song);
    toast('Đã lưu vào thư viện');
    nav(`/song/${song.id}`);
  };

  const busy = status === 'decoding' || status === 'analyzing';
  const setTempo = (v: number) => setBpm(Math.min(220, Math.max(30, Math.round(v))));
  const stats = converted?.fit.stats;

  return (
    <div className="ai-form">
      <div className="segmented" role="group" aria-label="Loại bản thu">
        <button type="button" className={kind === 'solo' ? 'on' : ''} aria-pressed={kind === 'solo'} disabled={busy || status === 'recording'} onClick={() => setKind('solo')}>Tôi tự hát / thổi</button>
        <button type="button" className={kind === 'mix' ? 'on' : ''} aria-pressed={kind === 'mix'} disabled={busy || status === 'recording'} onClick={() => setKind('mix')}>Bài hát gốc (MP3)</button>
      </div>
      {kind === 'solo' ? (
        <p className="muted small">
          Hát, ngân nga hoặc {BRAND.verb} {BRAND.noun} <strong>giai điệu</strong> (một giọng, không nhạc đệm) — thu ngay hoặc chọn file ghi âm có sẵn.
          Hát đều nhịp, mỗi nốt rõ ràng, nơi yên tĩnh thì tab đúng nhất.
        </p>
      ) : (
        <p className="muted small">
          Chọn file bài hát gốc (ca sĩ hát kèm nhạc đệm). Máy tự tách giọng hát chính — <strong>chỉ là bản nháp</strong>:
          bài giọng hát rõ, nhạc đệm nhẹ thì được phần lớn giai điệu; nhạc đệm dày thì phải sửa nhiều. Bản tự hát lại luôn chính xác hơn.
        </p>
      )}
      <div className="row gap wrap center">
        {status === 'recording' ? (
          <button type="button" className="btn btn-primary" onClick={stop}><Icon name="stop" size={18} /> Dừng ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')})</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={start}><Icon name="mic" size={18} /> Thu âm</button>
        )}
        <button type="button" className="btn btn-ghost" disabled={busy || status === 'recording'} onClick={() => fileRef.current?.click()}>
          <Icon name="music" size={18} /> {kind === 'mix' ? 'Chọn file bài hát' : 'Chọn file ghi âm'}
        </button>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm,.flac" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(f, f.name); }} />
        {busy && <span className="muted small">{status === 'decoding' ? 'Đang đọc file âm thanh…' : kind === 'mix' ? 'Đang tách giọng hát và dò nốt… (bài dài mất vài chục giây)' : 'Đang dò cao độ từng nốt…'}</span>}
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {audioUrl && <audio className="audio-src" controls src={audioUrl} aria-label={fileName ? `Bản thu ${fileName}` : 'Bản thu'} />}

      {converted && parsed && notes && (
        <>
          <div className="row gap wrap end-align">
            <label className="field grow">
              <span className="field-label">Tên bài</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên bài hát" />
            </label>
            <label className="field grow">
              <span className="field-label">Tác giả / ca sĩ</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
          <div className="row gap wrap end-align">
            <div className="field">
              <span className="field-label">Tempo (bpm){guess && bpm !== guess.bpm ? '' : ' — máy đoán'}</span>
              <span className="row gap center">
                <input type="number" inputMode="numeric" min={30} max={220} value={bpm} style={{ width: '5.5rem' }}
                  onChange={(e) => setTempo(Number(e.target.value) || bpm)} aria-label="Tempo" />
                <button type="button" className="btn btn-ghost btn-sm" title="Nốt đang dài gấp đôi: tempo gấp đôi" onClick={() => setTempo(bpm * 2)}>×2</button>
                <button type="button" className="btn btn-ghost btn-sm" title="Nốt đang ngắn một nửa: tempo một nửa" onClick={() => setTempo(bpm / 2)}>÷2</button>
              </span>
            </div>
            <label className="field">
              <span className="field-label">Nhịp</span>
              <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
                {TIME_SIGS.map((t) => <option key={t.value}>{t.value}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Làm tròn tới</span>
              <select value={grid} onChange={(e) => setGrid(Number(e.target.value))}>
                <option value={0.5}>Nửa phách (móc đơn)</option>
                <option value={0.25}>1/4 phách (móc kép)</option>
              </select>
            </label>
            <HarpTypeSelect value={harpType} onChange={setHarpType} />
            <KeySelect value={target} onChange={setTarget} allowAuto label={`Chơi trên ${BRAND.noun}`} harpType={harpType} />
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
              {`, ${timeSig}, ${converted.bpm} bpm`}
              {converted.songKey && `, giọng ${converted.songKey}`}
              {converted.pickupBeats > 0 && `, lấy đà ${converted.pickupBeats} phách`}
            </p>
            <p className="small">
              Dò được {notes.length} nốt. {stats && <>{stats.natural} nốt thường{stats.bends ? `, ${stats.bends} nốt bend` : ''}{stats.slides ? `, ${stats.slides} nốt gạt` : ''}</>}
              {stats && stats.unplayable > 0 && `, ${stats.unplayable} nốt ngoài tầm ${BRAND.noun} (đã thành dấu nghỉ)`}.
            </p>
            <ul className="warnings">
              <li>Bấm <strong>Nghe thử</strong> và so với bản thu. Nốt nghe dài / ngắn gấp đôi thì bấm ×2 hoặc ÷2 ở ô Tempo.</li>
              {transcription?.warnings.map((w) => <li key={w}>{w}</li>)}
              {stats && stats.unplayable > 0 && <li>{`Có nốt ngoài tầm ${BRAND.noun} — thử chọn ${BRAND.noun} khác hoặc cho phép dịch giọng.`}</li>}
              <li>Tab không có lời — thêm lời trong trang Sửa bài sau khi lưu.</li>
            </ul>
            <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={converted.harpType} harpKey={converted.harpKey} />
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
