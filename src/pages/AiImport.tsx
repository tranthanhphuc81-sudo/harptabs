import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AiInput, AiResponse, estimateCostUsd, MAX_IMAGES, VND_PER_USD } from '../../shared/ai';
import { aiToTab, prepareImage, transcribe } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey } from '../lib/harp';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { KeySelect } from '../components/KeySelect';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState, useOnline } from '../state';
import ScanImport from './ScanImport';
import PasteTab from './PasteTab';
import FileImport from './FileImport';

type Mode = 'scan' | 'file' | 'paste' | 'image' | 'name';
interface Img { id: string; mimeType: string; data: string; preview: string }

function vnd(usd: number) {
  const v = usd * VND_PER_USD;
  return v < 10 ? '< 10đ' : `${Math.round(v).toLocaleString('vi-VN')}đ`;
}

export default function AiImport() {
  const { settings, toast } = useAppState();
  const online = useOnline();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editScan = params.get('scan') ?? undefined;
  // mặc định mở "File nhạc" (MIDI / MusicXML: chính xác tuyệt đối); link sửa bản quét / dán tab mở thẳng chế độ đó
  const [mode, setMode] = useState<Mode>(params.get('paste') ? 'paste' : editScan ? 'scan' : 'file');
  const [lastMode, setLastMode] = useState<Mode>('image'); // chế độ đã tạo ra kết quả đang hiện
  // ảnh khuông nhạc chọn ở ô "File nhạc" → mở "Quét nhạc" với sẵn các ảnh đó
  const [scanFiles, setScanFiles] = useState<{ n: number; files: File[] } | null>(null);
  const [images, setImages] = useState<Img[]>([]);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [hint, setHint] = useState('');
  const [target, setTarget] = useState<HarpKey | 'auto'>('auto');
  const [allowTranspose, setAllowTranspose] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<AiResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  const configured = settings.aiMode === 'direct' ? !!settings.geminiKey : !!settings.proxyUrl;
  const monthCost = useLiveQuery(async () => {
    const from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
    const rows = await db.aiLog.where('at').aboveOrEqual(from.getTime()).toArray();
    return { n: rows.length, usd: rows.reduce((a, r) => a + r.costUsd, 0) };
  }, []);

  const converted = useMemo(() => (resp ? aiToTab(resp.result, target, allowTranspose) : null), [resp, target, allowTranspose]);
  const parsed = useMemo(() => (converted ? parseTab(converted.body, converted.harpKey) : null), [converted]);
  const flat = useMemo(() => (parsed ? flatten(parsed) : []), [parsed]);
  const player = usePlayer(flat, {
    bpm: converted?.bpm ?? 90, tempoScale: 1, beatsPerBar: beatsPerBar(converted?.timeSig ?? '4/4'),
    pickupBeats: converted?.pickupBeats ?? 0, style: converted?.style ?? 'ballad', melody: true, beat: true, click: false, countIn: false,
  });

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_IMAGES - images.length;
    if (files.length > room) toast(`Tối đa ${MAX_IMAGES} ảnh mỗi lần`);
    const picked = Array.from(files).slice(0, room);
    try {
      const prepared = await Promise.all(picked.map(prepareImage));
      setImages((prev) => [...prev, ...prepared.map((p, i) => ({ ...p, id: `${Date.now()}-${i}` }))]);
    } catch (e) {
      toast((e as Error).message);
    }
    if (camRef.current) camRef.current.value = '';
    if (galRef.current) galRef.current.value = '';
  };

  const run = async () => {
    setError(null);
    setResp(null);
    const input: AiInput = mode === 'image'
      ? { kind: 'image', images: images.map(({ mimeType, data }) => ({ mimeType, data })), title: title || undefined, lyrics: lyrics || undefined, hint: hint || undefined }
      : { kind: 'name', title, artist: artist || undefined, lyrics: lyrics || undefined, hint: hint || undefined };
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    try {
      const r = await transcribe(input, settings, ac.signal);
      setResp(r);
      setLastMode(mode);
      await db.aiLog.add({ at: Date.now(), kind: mode === 'name' ? 'name' : 'image', model: r.usage.model, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens, costUsd: estimateCostUsd(r.usage) });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || 'Có lỗi xảy ra');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const save = async () => {
    if (!resp || !converted) return;
    const r = resp.result;
    const song = blankSong({
      title: r.title || title || 'Bài mới',
      artist: r.artist || artist || undefined,
      harpKey: converted.harpKey,
      songKey: converted.fit.shift % 12 === 0 ? converted.songKey : undefined,
      bpm: converted.bpm,
      timeSig: converted.timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: converted.fit.stats.bends > 3 || converted.fit.stats.overblows ? 3 : converted.fit.stats.bends ? 2 : 1,
      source: lastMode === 'image' ? 'ai-image' : 'ai-name',
      tags: ['AI'],
      notes: lastMode === 'image'
        ? 'Quét từ ảnh — AI hay đọc sai cao độ. Nghe lại, so với bản nhạc và sửa những chỗ sai.'
        : r.confidence < 0.6 ? 'AI chưa chắc chắn về giai điệu — nghe lại và sửa những chỗ sai.' : undefined,
    });
    await db.songs.put(song);
    toast('Đã lưu vào thư viện — kiểm tra lại rồi bấm Lưu bài');
    nav(`/song/${song.id}/edit`);
  };

  // AI quét ảnh hay bịa cao độ mà vẫn tự chấm 90–100% → không hiện con số đó cho chế độ ảnh
  const fromImage = lastMode === 'image';
  // AI hay chỉ trả về một đoạn ngắn đầu bài → báo cho người dùng biết
  const SHORT_RESULT = 24;
  const noteCount = converted?.fit.stats.notes ?? 0;
  const tooShort = !!converted && noteCount < SHORT_RESULT;

  const tryByName = () => {
    if (resp?.result.title && !title) setTitle(resp.result.title);
    if (resp?.result.artist && !artist) setArtist(resp.result.artist);
    setResp(null);
    setMode('name');
  };

  const canRun = online && configured && !busy && (mode === 'image' ? images.length > 0 : title.trim().length >= 2);
  const estimate = mode === 'image' ? 0.0004 + images.length * 0.0006 + 0.005 : 0.006;

  return (
    <div className="page page-ai">
      <header className="page-head">
        <div>
          <h1>{editScan ? 'Sửa nốt trên ảnh' : 'Nhập bài'}</h1>
          <p className="muted">Mở file nhạc MIDI / MusicXML (chính xác nhất), chụp khuông nhạc để máy tự đọc nốt, dán tab copy từ mạng, hoặc nhờ AI đọc ảnh / nhớ bài theo tên.</p>
        </div>
      </header>

      {(mode === 'image' || mode === 'name') && !configured && (
        <div className="alert">
          Chưa kết nối AI. Vào <Link to="/settings">Cài đặt</Link> để nhập địa chỉ máy chủ AI, hoặc dán Gemini API key của bạn (chỉ nên dùng cho máy cá nhân).
        </div>
      )}
      {(mode === 'image' || mode === 'name') && !online && <div className="alert">Bạn đang offline. Phần này cần mạng; các phần khác của app vẫn dùng bình thường.</div>}

      <div className="segmented" role="tablist" aria-label="Cách nhập">
        <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
          <Icon name="music" size={18} /> File nhạc
        </button>
        <button type="button" role="tab" aria-selected={mode === 'scan'} className={mode === 'scan' ? 'on' : ''} onClick={() => setMode('scan')}>
          <Icon name="scan" size={18} /> Quét nhạc
        </button>
        <button type="button" role="tab" aria-selected={mode === 'paste'} className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>
          <Icon name="edit" size={18} /> Dán tab
        </button>
        <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'on' : ''} onClick={() => setMode('image')}>
          <Icon name="camera" size={18} /> Ảnh + AI
        </button>
        <button type="button" role="tab" aria-selected={mode === 'name'} className={mode === 'name' ? 'on' : ''} onClick={() => setMode('name')}>
          <Icon name="search" size={18} /> Tên bài
        </button>
      </div>

      {mode === 'scan' ? <ScanImport key={editScan ?? `new-${scanFiles?.n ?? 0}`} editSongId={editScan} initialFiles={scanFiles?.files} />
        : mode === 'file' ? <FileImport onImages={(files) => { setScanFiles((s) => ({ n: (s?.n ?? 0) + 1, files })); setMode('scan'); }} /> : mode === 'paste' ? <PasteTab /> : <>
      <div className="ai-form">
        {mode === 'image' ? (
          <>
            <div className="shots">
              {images.map((im, i) => (
                <figure key={im.id} className="shot">
                  <img src={im.preview} alt={`Trang ${i + 1}`} />
                  <figcaption>Trang {i + 1}</figcaption>
                  <button type="button" className="icon-btn shot-x" onClick={() => setImages(images.filter((x) => x.id !== im.id))} aria-label={`Bỏ trang ${i + 1}`}>
                    <Icon name="close" size={16} />
                  </button>
                </figure>
              ))}
              {images.length < MAX_IMAGES && (
                <div className="shot-add">
                  <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()}><Icon name="camera" size={18} /> Chụp ảnh</button>
                  <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()}><Icon name="image" size={18} /> Chọn ảnh có sẵn</button>
                  <p className="muted small">Chụp thẳng, đủ sáng, thấy rõ khoá nhạc và dấu hoá. Tối đa {MAX_IMAGES} trang, theo thứ tự.</p>
                  <p className="muted small"><strong>Đang thử nghiệm:</strong> AI thường đọc sai cao độ. Bản nhạc in thì dùng <button type="button" className="link-btn" onClick={() => setMode('scan')}>Quét nhạc</button> chính xác hơn, không tốn tiền.</p>
                </div>
              )}
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
              <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
            <label className="field">
              <span className="field-label">Tên bài (tuỳ chọn)</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </>
        ) : (
          <div className="row gap wrap">
            <label className="field grow">
              <span className="field-label">Tên bài hát</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Oh! Susanna" />
            </label>
            <label className="field grow">
              <span className="field-label">Tác giả / ca sĩ (giúp AI đoán đúng bài)</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
        )}

        <label className="field">
          <span className="field-label">Lời bài hát (tuỳ chọn)</span>
          <textarea rows={4} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder="Dán lời vào đây để AI ghép từng chữ vào nốt." />
          <span className="help">
            {mode === 'name'
              ? 'AI không tự viết lời bài hát (vấn đề bản quyền). Muốn có lời, hãy dán lời bạn có vào đây.'
              : 'Để trống thì AI dùng lời in trên bản nhạc.'}
          </span>
        </label>
        <label className="field">
          <span className="field-label">Ghi chú cho AI (tuỳ chọn)</span>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Ví dụ: chỉ lấy điệp khúc, bản nhạc giọng Rê" />
        </label>

        <div className="row gap wrap end-align">
          <KeySelect value={target} onChange={setTarget} allowAuto label="Chơi trên kèn" />
          {target !== 'auto' && (
            <label className="check">
              <input type="checkbox" checked={allowTranspose} onChange={(e) => setAllowTranspose(e.target.checked)} />
              Cho phép dịch giọng để dễ thổi
            </label>
          )}
        </div>

        <div className="row gap center wrap">
          {busy ? (
            <button type="button" className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>Huỷ</button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled={!canRun} onClick={run}>Chuyển thành tab</button>
          )}
          <span className="muted small">
            {busy ? 'AI đang đọc giai điệu, thường mất 10–40 giây…' : `Ước tính khoảng ${vnd(estimate)} mỗi lần với ${settings.model}.`}
            {monthCost && monthCost.n > 0 && ` Tháng này: ${monthCost.n} lần, khoảng ${vnd(monthCost.usd)}.`}
          </span>
        </div>
        {busy && <div className="progress" aria-hidden="true"><span /></div>}
        {error && <div className="alert error" role="alert">{error}</div>}
      </div>

      {resp && converted && parsed && (
        <section className="ai-result" aria-label="Kết quả">
          <div className="row between center wrap gap">
            <div>
              <h2>{resp.result.title}</h2>
              <p className="muted">
                Kèn {converted.harpKey}
                {converted.fit.shift % 12 !== 0 && `, đã dịch giọng ${converted.fit.shift > 0 ? '+' : ''}${converted.fit.shift} nửa cung`}
                {`, ${converted.timeSig}, ${converted.bpm} bpm`}
              </p>
            </div>
            {!fromImage && (
              <div className="confidence" title="Độ tin cậy AI tự đánh giá">
                <span>Độ tin cậy</span>
                <meter min={0} max={1} low={0.4} high={0.75} optimum={1} value={resp.result.confidence} />
                <strong>{Math.round(resp.result.confidence * 100)}%</strong>
              </div>
            )}
          </div>
          <p className="small">
            {converted.fit.stats.natural} nốt thường, {converted.fit.stats.bends} nốt bend
            {converted.fit.stats.unplayable > 0 && `, ${converted.fit.stats.unplayable} nốt ngoài tầm kèn (đã thành dấu nghỉ)`}
            {`. Lần này tốn khoảng ${vnd(estimateCostUsd(resp.usage))}.`}
          </p>
          {fromImage && (
            <div className="alert" role="note">
              <strong>Kiểm tra kỹ trước khi tập.</strong> Đọc ảnh khuông nhạc đang thử nghiệm: AI thường đếm đủ số nốt nhưng đọc sai cao độ.
              Bấm Nghe thử và so với bản nhạc, sửa những chỗ sai trong trang Sửa bài.
              <div className="row gap wrap" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={tryByName}><Icon name="search" size={18} /> Thử bằng tên bài</button>
              </div>
            </div>
          )}
          {(tooShort || resp.result.warnings.length > 0 || converted.invalidPitches > 0 || (!fromImage && resp.result.confidence < 0.4)) && (
            <ul className="warnings">
              {tooShort && <li>AI chỉ trả về {noteCount} nốt — có thể mới là một đoạn ngắn, thiếu phần lớn bài. {fromImage ? 'Thử lại, hoặc chụp từng phần của bản nhạc.' : 'Có thể AI không biết rõ bài này.'}</li>}
              {!fromImage && resp.result.confidence < 0.4 && <li>AI không chắc về giai điệu bài này. Hãy nghe thử và sửa lại trước khi tập.</li>}
              {converted.invalidPitches > 0 && <li>{converted.invalidPitches} nốt AI ghi sai định dạng đã được bỏ qua.</li>}
              {resp.result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="row gap">
            <MiniPlay p={player} />
            <button type="button" className="btn btn-primary" onClick={save}>Lưu vào thư viện</button>
          </div>
          <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} />
        </section>
      )}
      </>}
    </div>
  );
}
