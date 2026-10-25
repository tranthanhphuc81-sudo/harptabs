import { useEffect, useMemo, useRef, useState } from 'react';
import { BackingPlayer, decodeBacking } from '../audio/backingPlayer';
import type { Comparison, ScoreNote } from '../lib/audioAlign';
import { checkBackingFile, deleteBacking, MAX_BACKING_MIN, saveBacking, tabSig } from '../lib/backings';
import { KLine, locate } from '../lib/karaoke';
import type { FlatEvent } from '../lib/tabText';
import { fromAnchors, fromBpm, fromTaps, TempoMap, TempoPoint } from '../lib/tempoMap';
import type { Backing, Song } from '../lib/types';
import { Icon } from './Icon';

/** người chạm thường trễ hơn lúc nghe chừng này (giây) */
const TAP_REACTION = 0.12;
/** tự đồng bộ khớp ít hơn tỉ lệ nốt này thì báo "chưa chắc" và gợi ý canh tay */
const LOW_CONFIDENCE = 0.35;

type Step = 'pick' | 'analyzing' | 'review' | 'tap' | 'bpm';

/** dò giai điệu trong file nhạc và gióng với tab — chạy trong luồng nền */
function analyze(samples: Float32Array, sampleRate: number, score: ScoreNote[]): Promise<Comparison> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../lib/audioAlign.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; result?: Comparison; error?: string }>) => {
      w.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result); else reject(new Error(e.data.error || 'Lỗi phân tích'));
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Lỗi phân tích')); };
    w.postMessage({ samples, sampleRate, score, mode: 'mix' }, [samples.buffer]);
  });
}

/** giọng bài gốc lệch so với tab (nửa cung), bỏ quãng tám: -5..+6 */
const keyShift = (offset: number) => { const k = ((Math.round(offset) % 12) + 12) % 12; return k > 6 ? k - 12 : k; };

/**
 * Cài nhạc nền MP3 cho karaoke: chọn file người dùng có sẵn → máy tự gióng với tab (bản đồ nhịp) →
 * nghe thử, chỉnh lệch; tự gióng chưa chắc thì canh tay ("chạm khi câu bắt đầu") hoặc nhập nhịp đều.
 */
export function BackingSetup({ song, flat, lines, existing, onSaved, onClose }: {
  song: Song;
  /** nốt của bài gốc (cao độ, phách) — để gióng và lấy dấu vân tay tab */
  flat: FlatEvent[];
  lines: KLine[];
  existing: Backing | null;
  onSaved: (b: Backing | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>(existing ? 'review' : 'pick');
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<{ blob: Blob; name: string; mime: string } | null>(existing ? { blob: existing.blob, name: existing.name, mime: existing.mime } : null);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [map, setMap] = useState<TempoMap | null>(existing ? { points: existing.points, spb: existing.spb } : null);
  const [offsetMs, setOffsetMs] = useState(existing?.offsetMs ?? 0);
  const [keyOffset, setKeyOffset] = useState(existing?.keyOffset ?? 0);
  const [source, setSource] = useState<Backing['source']>(existing?.source ?? 'auto');
  const [confidence, setConfidence] = useState(existing?.confidence ?? 0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const player = useRef<BackingPlayer | null>(null);
  const stale = !!existing && existing.tabSig !== tabSig(flat);

  useEffect(() => { ref.current?.showModal?.(); }, []);
  useEffect(() => () => player.current?.stop(), []);

  // nhạc nền đã lưu: đọc file để nghe thử (file mới chọn thì đã đọc lúc chọn)
  useEffect(() => {
    if (!file || buffer) return;
    let alive = true;
    decodeBacking(file.blob).then((b) => { if (alive) setBuffer(b); }).catch((e: Error) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [file, buffer]);
  // bộ phát nghe thử theo bản đồ nhịp hiện tại
  useEffect(() => {
    player.current?.stop();
    setPlaying(false);
    if (!buffer || !map) { player.current = buffer ? new BackingPlayer(buffer, fromBpm(0, 60), 0) : null; return; }
    const bp = new BackingPlayer(buffer, map, offsetMs);
    bp.onEnd = () => setPlaying(false);
    player.current = bp;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉnh lệch cập nhật riêng, không dựng lại
  }, [buffer, map]);
  useEffect(() => { if (map) player.current?.setSync(map, offsetMs); }, [map, offsetMs]);

  const score: ScoreNote[] = useMemo(() => flat.map((f, i) => ({ id: String(i), midi: f.midi, beats: f.beats })), [flat]);
  const notes = useMemo(() => flat.filter((f) => f.midi !== null).length, [flat]);

  async function autoSync(b: AudioBuffer) {
    setStep('analyzing');
    setErr(null);
    try {
      // gộp kênh về một kênh để dò giai điệu
      const mono = new Float32Array(b.length);
      for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / b.numberOfChannels; }
      const r = await analyze(mono, b.sampleRate, score);
      const m = fromAnchors(r.anchors);
      const conf = notes ? r.anchors.length / notes : 0;
      setConfidence(conf);
      setKeyOffset(keyShift(r.offset));
      setSource('auto');
      if (!m) { setMap(null); setErr('Máy chưa gióng được nhạc với tab — canh bằng tay bên dưới.'); setStep('review'); return; }
      setMap(m);
      setOffsetMs(0);
      setStep('review');
    } catch (e) {
      setErr((e as Error).message);
      setStep('review');
    }
  }

  async function pick(f?: File) {
    if (!f) return;
    const bad = checkBackingFile(f);
    if (bad) { setErr(bad); return; }
    setErr(null);
    try {
      const b = await decodeBacking(f);
      if (b.duration > MAX_BACKING_MIN * 60) { setErr(`Bài dài quá (tối đa ${MAX_BACKING_MIN} phút)`); return; }
      setFile({ blob: f, name: f.name, mime: f.type || 'audio/mpeg' });
      setBuffer(b);
      await autoSync(b);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ----- nghe thử: dòng lời đang tới, chữ đang hát -----
  const [preview, setPreview] = useState<{ line: number; syl: number }>({ line: 0, syl: -1 });
  useEffect(() => {
    if (!playing || step !== 'review') return;
    let raf = 0;
    const frame = () => {
      const b = player.current?.currentBeat();
      if (b != null) { const pos = locate(lines, b); setPreview((cur) => (cur.line === pos.line && cur.syl === pos.syl ? cur : { line: pos.line, syl: pos.syl })); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, step, lines]);
  const [fromLine, setFromLine] = useState(0);
  const playPreview = () => {
    const bp = player.current;
    if (!bp || !map) return;
    if (playing) { bp.stop(); setPlaying(false); return; }
    bp.start(lines[fromLine]?.start ?? 0);
    setPlaying(true);
  };

  // ----- canh tay: chạm khi mỗi câu bắt đầu -----
  const [taps, setTaps] = useState<TempoPoint[]>([]);
  const [tapLine, setTapLine] = useState(0);
  const lyricLines = useMemo(() => lines.map((l, i) => ({ l, i })).filter(({ l }) => !l.instrumental), [lines]);
  const startTap = () => {
    if (!buffer) return;
    player.current?.stop();
    const bp = new BackingPlayer(buffer, fromBpm(0, 60), 0);
    bp.onEnd = () => setPlaying(false);
    player.current = bp;
    bp.start(0, 0);
    setPlaying(true);
    setTaps([]);
    setTapLine(0);
    setStep('tap');
  };
  const tap = () => {
    const sec = player.current?.currentSec();
    const target = lyricLines[tapLine];
    if (sec == null || !target) return;
    setTaps((t) => [...t, { beat: target.l.start, sec: Math.max(0, sec - TAP_REACTION) }]);
    setTapLine((n) => n + 1);
  };
  const finishTap = () => {
    player.current?.stop();
    setPlaying(false);
    const m = fromTaps(taps);
    if (!m) { setErr('Cần chạm ít nhất 2 câu'); return; }
    setMap(m); setSource('tap'); setConfidence(taps.length / Math.max(1, lyricLines.length)); setOffsetMs(0); setErr(null);
    setStep('review');
  };

  // ----- nhịp đều -----
  const [bpm, setBpm] = useState(song.bpm);
  const [firstSec, setFirstSec] = useState(0);
  const applyBpm = () => {
    const first = lyricLines[0]?.l.start ?? 0;
    const m = fromBpm(firstSec - (first * 60) / Math.max(20, bpm), bpm);
    setMap(m); setSource('bpm'); setConfidence(1); setOffsetMs(0); setErr(null);
    setStep('review');
  };

  async function save() {
    if (!file || !map || !buffer) return;
    setSaving(true);
    try {
      const b = {
        songId: song.id, name: file.name, mime: file.mime, blob: file.blob, durationSec: buffer.duration,
        points: map.points, spb: map.spb, offsetMs, keyOffset, source, confidence, tabSig: tabSig(flat),
      };
      await saveBacking(b);
      onSaved({ ...b, size: file.blob.size, createdAt: Date.now() });
      ref.current?.close();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await deleteBacking(song.id);
    onSaved(null);
    ref.current?.close();
  }

  const line = lines[preview.line];
  return (
    <dialog ref={ref} className="sheet backing-setup" onClose={() => { player.current?.stop(); onClose(); }} aria-labelledby="bk-title">
      <h2 id="bk-title">Nhạc nền MP3</h2>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {err && <p className="alert error small" role="alert">{err}</p>}

      {step === 'pick' && (
        <>
          <p className="muted">Chọn file nhạc của bài này mà bạn có sẵn trên máy (beat karaoke hoặc bản gốc). Máy sẽ tự gióng lời theo nhạc.</p>
          <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18} /> Chọn file nhạc</button>
        </>
      )}

      {step === 'analyzing' && (
        <>
          <p className="muted small">Đang dò giai điệu trong file và gióng với tab… (bài dài có thể mất chục giây)</p>
          <div className="progress" aria-hidden="true"><span /></div>
        </>
      )}

      {step === 'review' && (
        <>
          <p className="small">
            <strong>{file?.name}</strong>{buffer && <span className="muted"> · {Math.floor(buffer.duration / 60)}:{String(Math.round(buffer.duration % 60)).padStart(2, '0')}</span>}
          </p>
          {stale && <p className="alert small">Tab đã sửa sau lần đồng bộ trước — nên đồng bộ lại.</p>}
          {map ? (
            <p className="small">
              {source === 'auto' ? <>Máy tự gióng: khớp <strong>{Math.round(confidence * 100)}%</strong> nốt</> : source === 'tap' ? <>Canh tay: {Math.round(confidence * 100)}% số câu</> : <>Nhịp đều</>}
              {keyOffset !== 0 && <> · nhạc {keyOffset > 0 ? 'cao' : 'thấp'} hơn tab {Math.abs(keyOffset)} nửa cung (lời và chấm điểm theo nhạc)</>}
              {source === 'auto' && confidence < LOW_CONFIDENCE && <><br /><span className="danger">Gióng chưa chắc — nghe thử, nếu lệch thì canh tay.</span></>}
            </p>
          ) : <p className="muted small">Chưa có bản đồ nhịp.</p>}

          {map && (
            <div className="bk-preview">
              <div className="row gap center wrap">
                <select className="chip-select" value={fromLine} onChange={(e) => setFromLine(Number(e.target.value))} aria-label="Nghe thử từ câu">
                  {lyricLines.map(({ l, i }, k) => <option key={i} value={i}>Câu {k + 1}: {l.syls.map((s) => s.text).join(' ').slice(0, 28)}</option>)}
                </select>
                <button type="button" className="btn btn-primary btn-sm" onClick={playPreview} disabled={!buffer}>
                  <Icon name={playing ? 'stop' : 'play'} size={16} /> {playing ? 'Dừng' : 'Nghe thử'}
                </button>
              </div>
              {playing && line && (
                <p className="bk-line" aria-live="polite">
                  {line.syls.map((s, i) => <span key={i} className={i === preview.syl ? 'on' : i < preview.syl ? 'done' : ''}>{s.text || '♪'}{s.hyphen ? '-' : ' '}</span>)}
                </p>
              )}
              <label className="field">
                <span className="field-label">Lời sớm / muộn so với nhạc: {offsetMs > 0 ? '+' : ''}{offsetMs} ms</span>
                <input type="range" min={-1000} max={1000} step={20} value={offsetMs} onChange={(e) => setOffsetMs(Number(e.target.value))} />
              </label>
            </div>
          )}

          <div className="row gap wrap">
            <button type="button" className="btn btn-ghost btn-sm" onClick={startTap} disabled={!buffer || !lyricLines.length}>Canh tay: chạm theo câu</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('bpm')} disabled={!buffer}>Nhịp đều</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => buffer && void autoSync(buffer)} disabled={!buffer}>Tự đồng bộ lại</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Đổi file</button>
            {existing && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void remove()}><Icon name="trash" size={16} /> Bỏ nhạc nền</button>}
          </div>
        </>
      )}

      {step === 'tap' && (
        <>
          <p className="muted small">Nhạc đang phát từ đầu. Chạm nút lớn đúng lúc mỗi câu dưới đây bắt đầu hát. Chạm được vài câu là đủ.</p>
          <p className="bk-tap-line">{lyricLines[tapLine] ? lyricLines[tapLine].l.syls.map((s) => s.text).join(' ') : 'Hết câu'}</p>
          <div className="row gap center wrap">
            <button type="button" className="kara-play" onClick={tap} disabled={!lyricLines[tapLine] || !playing} aria-label="Câu này bắt đầu">
              <Icon name="check" size={28} />
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTapLine((n) => n + 1)} disabled={!lyricLines[tapLine]}>Bỏ qua câu</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={finishTap} disabled={taps.length < 2}>Xong ({taps.length} câu)</button>
          </div>
        </>
      )}

      {step === 'bpm' && (
        <>
          <p className="muted small">Nhạc giữ đều một tốc độ (beat karaoke thường như vậy): nhập giây câu đầu tiên bắt đầu hát và tốc độ.</p>
          <div className="row gap wrap end-align">
            <label className="field"><span className="field-label">Câu đầu bắt đầu ở giây</span>
              <input type="number" min={0} step={0.1} value={firstSec} onChange={(e) => setFirstSec(Math.max(0, Number(e.target.value) || 0))} /></label>
            <label className="field"><span className="field-label">Tốc độ (bpm)</span>
              <input type="number" min={30} max={260} value={bpm} onChange={(e) => setBpm(Math.min(260, Math.max(30, Number(e.target.value) || song.bpm)))} /></label>
            <button type="button" className="btn btn-primary btn-sm" onClick={applyBpm}>Dùng</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('review')}>Huỷ</button>
          </div>
        </>
      )}

      <p className="muted small">File chỉ lưu trên máy này để hát cho riêng bạn — không có trong file sao lưu, link chia sẻ hay gửi đi đâu. Chỉ dùng file bạn có quyền dùng.</p>
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Đóng</button>
        {step === 'review' && <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!map || !file || !buffer || saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>}
      </div>
    </dialog>
  );
}
