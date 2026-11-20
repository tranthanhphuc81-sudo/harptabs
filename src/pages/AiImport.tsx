import { BRAND, IS_GUITAR_APP } from '../appConfig';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AiInput, AiResponse, estimateCostUsd, MAX_IMAGES, VND_PER_USD } from '../../shared/ai';
import { aiToTab, prepareImage, transcribe } from '../lib/ai';
import { blankSong, db } from '../lib/db';
import { HarpKey } from '../lib/harp';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { KeySelect } from '../components/KeySelect';
import { difficultyOf } from '../lib/converter';
import { TabView } from '../components/TabView';
import { MiniPlay } from '../components/PlayerBar';
import { usePlayer } from '../components/usePlayer';
import { Icon } from '../components/Icon';
import { useAppState, useOnline } from '../state';
import PasteTab from './PasteTab';
import { AI_ENABLED } from '../lib/features';
import { useScrollHint } from '../components/useScrollHint';
import { LOCALE, t } from '../lib/i18n';
import { LangToggle } from '../components/LangToggle';

// quét nhạc và đọc file nặng (OMR, MIDI, PDF): chỉ tải khi chọn
const ScanImport = lazy(() => import('./ScanImport'));
const FileImport = lazy(() => import('./FileImport'));
const AudioImport = lazy(() => import('./AudioImport'));
const ChordPaste = lazy(() => import('./ChordPaste'));

type Mode = 'scan' | 'file' | 'paste' | 'chords' | 'audio' | 'image' | 'name';
interface Img { id: string; mimeType: string; data: string; preview: string }

function vnd(usd: number) {
  const v = usd * VND_PER_USD;
  return v < 10 ? t('< 10đ') : t('{0}đ', Math.round(v).toLocaleString(LOCALE));
}

export default function AiImport() {
  const { settings, toast } = useAppState();
  const online = useOnline();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editScan = params.get('scan') ?? undefined;
  // mặc định mở "File nhạc" (MIDI / MusicXML: chính xác tuyệt đối); link sửa bản quét / dán tab mở thẳng chế độ đó
  const [rawMode, setMode] = useState<Mode>(params.get('paste') ? 'paste' : editScan ? 'scan' : params.get('chords') || IS_GUITAR_APP ? 'chords' : 'file');
  // AI đang tạm khoá: không vào được chế độ Ảnh + AI / Tên bài
  const mode: Mode = !AI_ENABLED && (rawMode === 'image' || rawMode === 'name') ? 'file' : rawMode;
  // hàng tab dài hơn màn hình điện thoại: mép mờ báo còn tab, tab đang chọn luôn cuộn vào tầm nhìn
  const tabsRef = useScrollHint<HTMLDivElement>();
  useEffect(() => {
    const el = tabsRef.current, on = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !on) return;
    const a = el.getBoundingClientRect(), b = on.getBoundingClientRect();
    if (b.left < a.left + 8) el.scrollLeft += b.left - a.left - 28;
    else if (b.right > a.right - 8) el.scrollLeft += b.right - a.right + 28;
  }, [mode, tabsRef]);
  const [lastMode, setLastMode] = useState<Mode>('image'); // chế độ đã tạo ra kết quả đang hiện
  // ảnh khuông nhạc chọn ở ô "File nhạc" → mở "Quét nhạc" với sẵn các ảnh đó
  const [scanFiles, setScanFiles] = useState<{ n: number; files: File[] } | null>(null);
  // file mp3 chọn ở ô "File nhạc" → mở "Bản thu" và dò luôn
  const [audioFile, setAudioFile] = useState<File | null>(null);
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
    if (files.length > room) toast(t('Tối đa {0} ảnh mỗi lần', MAX_IMAGES));
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
      if ((e as Error).name !== 'AbortError') setError((e as Error).message || t('Có lỗi xảy ra'));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const save = async () => {
    if (!resp || !converted) return;
    const r = resp.result;
    const song = blankSong({
      title: r.title || title || t('Bài mới'),
      artist: r.artist || artist || undefined,
      harpKey: converted.harpKey,
      songKey: converted.fit.shift % 12 === 0 ? converted.songKey : undefined,
      bpm: converted.bpm,
      timeSig: converted.timeSig,
      pickupBeats: converted.pickupBeats,
      style: converted.style,
      body: converted.body,
      difficulty: difficultyOf(converted.fit.stats),
      source: lastMode === 'image' ? 'ai-image' : 'ai-name',
      tags: ['AI'],
      notes: lastMode === 'image'
        ? t('Quét từ ảnh — AI hay đọc sai cao độ. Nghe lại, so với bản nhạc và sửa những chỗ sai.')
        : r.confidence < 0.6 ? t('AI chưa chắc chắn về giai điệu — nghe lại và sửa những chỗ sai.') : undefined,
    });
    await db.songs.put(song);
    toast(t('Đã lưu vào thư viện — kiểm tra lại rồi bấm Lưu bài'));
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
          <h1>{editScan ? t('Sửa nốt trên ảnh') : t('Nhập bài')}</h1>
          {!editScan && <p className="muted">{t('File nhạc (chính xác nhất), ảnh bản nhạc, tab chép từ mạng')}{AI_ENABLED ? t(', bản thu hoặc nhờ AI') : t(' hoặc bản thu')} {t('— chọn cách bên dưới.')}</p>}
        </div>
        <LangToggle />
      </header>

      {(mode === 'image' || mode === 'name') && !configured && (
        <div className="alert">
          {t('Chưa kết nối AI. Vào')} <Link to="/settings">{t('Cài đặt')}</Link> {t('để nhập địa chỉ máy chủ AI, hoặc dán Gemini API key của bạn (chỉ nên dùng cho máy cá nhân).')}
        </div>
      )}
      {(mode === 'image' || mode === 'name') && !online && <div className="alert">{t('Bạn đang offline. Phần này cần mạng; các phần khác của app vẫn dùng bình thường.')}</div>}

      <div className="segmented scroll-row" ref={tabsRef} role="tablist" aria-label={t('Cách nhập')}>
        {IS_GUITAR_APP && (
          <button type="button" role="tab" aria-selected={mode === 'chords'} className={mode === 'chords' ? 'on' : ''} onClick={() => setMode('chords')}>
            <Icon name="edit" size={18} /> {t('Dán hợp âm')}
          </button>
        )}
        <button type="button" role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>
          <Icon name="music" size={18} /> {t('File nhạc')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'scan'} className={mode === 'scan' ? 'on' : ''} onClick={() => setMode('scan')}>
          <Icon name="scan" size={18} /> {t('Quét nhạc')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'paste'} className={mode === 'paste' ? 'on' : ''} onClick={() => setMode('paste')}>
          <Icon name="edit" size={18} /> {t('Dán tab')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'audio'} className={mode === 'audio' ? 'on' : ''} onClick={() => setMode('audio')}>
          <Icon name="mic" size={18} /> {t('Bản thu')}
        </button>
        {AI_ENABLED && (
          <>
            <button type="button" role="tab" aria-selected={mode === 'image'} className={mode === 'image' ? 'on' : ''} onClick={() => setMode('image')}>
              <Icon name="camera" size={18} /> {t('Ảnh + AI')}
            </button>
            <button type="button" role="tab" aria-selected={mode === 'name'} className={mode === 'name' ? 'on' : ''} onClick={() => setMode('name')}>
              <Icon name="search" size={18} /> {t('Tên bài')}
            </button>
          </>
        )}
      </div>

      {mode === 'scan' ? <Suspense fallback={null}><ScanImport key={editScan ?? `new-${scanFiles?.n ?? 0}`} editSongId={editScan} initialFiles={scanFiles?.files} /></Suspense>
        : mode === 'chords' ? <Suspense fallback={null}><ChordPaste /></Suspense>
        : mode === 'file' ? <Suspense fallback={null}><FileImport onImages={(files) => { setScanFiles((s) => ({ n: (s?.n ?? 0) + 1, files })); setMode('scan'); }} onAudio={(f) => { setAudioFile(f); setMode('audio'); }} /></Suspense> : mode === 'paste' ? <PasteTab /> : mode === 'audio' ? <Suspense fallback={null}><AudioImport initialFile={audioFile ?? undefined} /></Suspense> : <>
      <div className="ai-form">
        {mode === 'image' ? (
          <>
            <div className="shots">
              {images.map((im, i) => (
                <figure key={im.id} className="shot">
                  <img src={im.preview} alt={`Trang ${i + 1}`} />
                  <figcaption>Trang {i + 1}</figcaption>
                  <button type="button" className="icon-btn shot-x" onClick={() => setImages(images.filter((x) => x.id !== im.id))} aria-label={t('Bỏ trang {0}', i + 1)}>
                    <Icon name="close" size={16} />
                  </button>
                </figure>
              ))}
              {images.length < MAX_IMAGES && (
                <div className="shot-add">
                  <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()}><Icon name="camera" size={18} /> {t('Chụp ảnh')}</button>
                  <button type="button" className="btn btn-ghost" onClick={() => galRef.current?.click()}><Icon name="image" size={18} /> {t('Chọn ảnh có sẵn')}</button>
                  <p className="muted small">{t('Chụp thẳng, đủ sáng, thấy rõ khoá nhạc và dấu hoá. Tối đa {0} trang, theo thứ tự.', MAX_IMAGES)}</p>
                  <p className="muted small"><strong>{t('Đang thử nghiệm:')}</strong> {t('AI thường đọc sai cao độ. Bản nhạc in thì dùng')} <button type="button" className="link-btn" onClick={() => setMode('scan')}>{t('Quét nhạc')}</button> {t('chính xác hơn, không tốn tiền.')}</p>
                </div>
              )}
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
              <input ref={galRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
            </div>
            <label className="field">
              <span className="field-label">{t('Tên bài (tuỳ chọn)')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
          </>
        ) : (
          <div className="row gap wrap">
            <label className="field grow">
              <span className="field-label">{t('Tên bài hát')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ví dụ: Oh! Susanna')} />
            </label>
            <label className="field grow">
              <span className="field-label">{t('Tác giả / ca sĩ (giúp AI đoán đúng bài)')}</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} />
            </label>
          </div>
        )}

        <label className="field">
          <span className="field-label">{t('Lời bài hát (tuỳ chọn)')}</span>
          <textarea rows={4} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder={t('Dán lời vào đây để AI ghép từng chữ vào nốt.')} />
          <span className="help">
            {mode === 'name'
              ? t('AI không tự viết lời bài hát (vấn đề bản quyền). Muốn có lời, hãy dán lời bạn có vào đây.')
              : t('Để trống thì AI dùng lời in trên bản nhạc.')}
          </span>
        </label>
        <label className="field">
          <span className="field-label">{t('Ghi chú cho AI (tuỳ chọn)')}</span>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder={t('Ví dụ: chỉ lấy điệp khúc, bản nhạc giọng Rê')} />
        </label>

        <div className="row gap wrap end-align">
          <KeySelect value={target} onChange={setTarget} allowAuto label={t('Chơi trên {0}', BRAND.noun)} />
          {target !== 'auto' && (
            <label className="check">
              <input type="checkbox" checked={allowTranspose} onChange={(e) => setAllowTranspose(e.target.checked)} />
              {t('Cho phép dịch giọng để dễ thổi')}
            </label>
          )}
        </div>

        <div className="row gap center wrap">
          {busy ? (
            <button type="button" className="btn btn-ghost" onClick={() => abortRef.current?.abort()}>{t('Huỷ')}</button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled={!canRun} onClick={run}>{t('Chuyển thành tab')}</button>
          )}
          <span className="muted small">
            {busy ? t('AI đang đọc giai điệu, thường mất 10–40 giây…') : t('Ước tính khoảng {0} mỗi lần với {1}.', vnd(estimate), settings.model)}
            {monthCost && monthCost.n > 0 && t(' Tháng này: {0} lần, khoảng {1}.', monthCost.n, vnd(monthCost.usd))}
          </span>
        </div>
        {busy && <div className="progress" aria-hidden="true"><span /></div>}
        {error && <div className="alert error" role="alert">{error}</div>}
      </div>

      {resp && converted && parsed && (
        <section className="ai-result" aria-label={t('Kết quả')}>
          <div className="row between center wrap gap">
            <div>
              <h2>{resp.result.title}</h2>
              <p className="muted">
                {t('Kèn')} {converted.harpKey}
                {converted.fit.shift % 12 !== 0 && t(', đã dịch giọng {0}{1} nửa cung', converted.fit.shift > 0 ? '+' : '', converted.fit.shift)}
                {`, ${converted.timeSig}, ${converted.bpm} bpm`}
              </p>
            </div>
            {!fromImage && (
              <div className="confidence" title={t('Độ tin cậy AI tự đánh giá')}>
                <span>{t('Độ tin cậy')}</span>
                <meter min={0} max={1} low={0.4} high={0.75} optimum={1} value={resp.result.confidence} />
                <strong>{Math.round(resp.result.confidence * 100)}%</strong>
              </div>
            )}
          </div>
          <p className="small">
            {converted.fit.stats.natural} {t('nốt thường,')} {converted.fit.stats.bends} {t('nốt bend')}
            {converted.fit.stats.unplayable > 0 && t(', {0} nốt ngoài tầm {1} (đã thành dấu nghỉ)', converted.fit.stats.unplayable, BRAND.noun)}
            {t('. Lần này tốn khoảng {0}.', vnd(estimateCostUsd(resp.usage)))}
          </p>
          {fromImage && (
            <div className="alert" role="note">
              <strong>{t('Kiểm tra kỹ trước khi tập.')}</strong> {t('Đọc ảnh khuông nhạc đang thử nghiệm: AI thường đếm đủ số nốt nhưng đọc sai cao độ. Bấm Nghe thử và so với bản nhạc, sửa những chỗ sai trong trang Sửa bài.')}
              <div className="row gap wrap" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={tryByName}><Icon name="search" size={18} /> {t('Thử bằng tên bài')}</button>
              </div>
            </div>
          )}
          {(tooShort || resp.result.warnings.length > 0 || converted.invalidPitches > 0 || (!fromImage && resp.result.confidence < 0.4)) && (
            <ul className="warnings">
              {tooShort && <li>{t('AI chỉ trả về')} {noteCount} {t('nốt — có thể mới là một đoạn ngắn, thiếu phần lớn bài.')} {fromImage ? t('Thử lại, hoặc chụp từng phần của bản nhạc.') : t('Có thể AI không biết rõ bài này.')}</li>}
              {!fromImage && resp.result.confidence < 0.4 && <li>{t('AI không chắc về giai điệu bài này. Hãy nghe thử và sửa lại trước khi tập.')}</li>}
              {converted.invalidPitches > 0 && <li>{t('{0} nốt AI ghi sai định dạng đã được bỏ qua.', converted.invalidPitches)}</li>}
              {resp.result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <TabView parsed={parsed} flat={flat} active={player.active} size="s" showNames={settings.showNoteNames} nameStyle={settings.noteNames} harpType={converted.harpType} harpKey={converted.harpKey} />
          <div className="row gap preview-actions">
            <MiniPlay p={player} />
            <button type="button" className="btn btn-primary" onClick={save}>{t('Lưu vào thư viện')}</button>
          </div>
        </section>
      )}
      </>}
    </div>
  );
}
