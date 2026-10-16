import { useEffect, useRef, useState } from 'react';
import type { Comparison, ScoreNote, Suggestion } from '../lib/audioAlign';
import { midiToName } from '../lib/harp';
import { Icon } from './Icon';

type Status = 'idle' | 'recording' | 'decoding' | 'analyzing' | 'done' | 'error';

const BEAT_NAMES: Record<string, string> = { '0.25': 'móc kép', '0.333': 'móc đơn liên ba', '0.5': 'móc đơn', '0.667': 'đen liên ba', '0.75': 'móc đơn chấm', '1': 'đen', '1.5': 'đen chấm', '2': 'trắng', '3': 'trắng chấm', '4': 'tròn' };
const beatName = (b: number) => BEAT_NAMES[String(+b.toFixed(3))] ?? `${+b.toFixed(2)} phách`;
const sugKey = (s: Suggestion) => `${s.kind}:${'noteId' in s ? s.noteId : s.afterId}:${s.at}`;

/** Đọc file ghi âm / bản thu thành mẫu âm thanh một kênh */
async function decode(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
    }
    return { samples: out, sampleRate: buf.sampleRate };
  } catch {
    throw new Error('Không đọc được file âm thanh này — thử file .mp3, .m4a hoặc .wav');
  } finally {
    ctx.close();
  }
}

function analyze(samples: Float32Array, sampleRate: number, score: ScoreNote[], meter: number): Promise<Comparison> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../lib/audioAlign.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ ok: boolean; result?: Comparison; error?: string }>) => {
      w.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result); else reject(new Error(e.data.error || 'Lỗi phân tích'));
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Lỗi phân tích')); };
    w.postMessage({ samples, sampleRate, score, meter }, [samples.buffer]);
  });
}

/**
 * Đối chiếu bản quét với bản thu một giọng (tự thổi kèn / hát / ngân nga): máy dò cao độ bản thu,
 * gióng từng nốt với bản quét rồi gợi ý chỗ sửa; người dùng chọn mục muốn áp dụng.
 */
export function RecordingCheck({ score, meter, label, onApply, onFocus }: {
  score: ScoreNote[];
  /** số phách mỗi ô nhịp */
  meter: number;
  /** vị trí nốt để hiện cho người dùng (vd "Khuông 2, nốt 5") */
  label: (noteId: string) => string;
  onApply: (s: Suggestion[]) => void;
  onFocus: (noteId: string) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Comparison | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [secs, setSecs] = useState(0);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { rec.current?.stream.getTracks().forEach((t) => t.stop()); if (rec.current) clearInterval(rec.current.timer); }, []);

  const run = async (blob: Blob) => {
    setError('');
    setResult(null);
    try {
      setStatus('decoding');
      const { samples, sampleRate } = await decode(blob);
      if (samples.length < sampleRate * 2) throw new Error('Bản thu quá ngắn — thu ít nhất vài câu nhạc');
      setStatus('analyzing');
      const r = await analyze(samples, sampleRate, score, meter);
      setResult(r);
      // mặc định chọn: sai cao độ, sót nốt, trường độ; nốt "có thể thừa" để người dùng tự quyết
      setChecked(new Set(r.suggestions.filter((s) => s.kind !== 'extra').map(sugKey)));
      setStatus('done');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        run(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }));
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

  const describe = (s: Suggestion) => {
    const n = (m: number) => midiToName(m);
    switch (s.kind) {
      case 'pitch': return <>{label(s.noteId)}: <strong>{n(s.from)} → {n(s.to)}</strong></>;
      case 'fill': return <>{label(s.noteId)}: dấu lặng máy chèn → <strong>nốt {n(s.to)}</strong></>;
      case 'missing': return <>Sau {label(s.afterId).toLowerCase()}: <strong>thêm nốt {n(s.to)}</strong> ({beatName(s.beats)})</>;
      case 'extra': return <>{label(s.noteId)} ({n(s.from)}): <strong>có thể thừa</strong> — bản thu không có</>;
      case 'duration': return <>{label(s.noteId)} ({n(s.midi)}): <strong>{beatName(s.from)} → {beatName(s.to)}</strong></>;
    }
  };
  const toggle = (k: string) => setChecked((c) => { const x = new Set(c); if (x.has(k)) x.delete(k); else x.add(k); return x; });
  const apply = () => {
    if (!result) return;
    const sel = result.suggestions.filter((s) => checked.has(sugKey(s)));
    onApply(sel);
    setResult({ ...result, suggestions: result.suggestions.filter((s) => !checked.has(sugKey(s))) });
    setChecked(new Set());
  };

  const busy = status === 'decoding' || status === 'analyzing';
  const lowMatch = result && result.matched < result.scoreNotes * 0.5;
  return (
    <details className="syntax-help rec-check">
      <summary>Đối chiếu với bản thu — tìm nốt quét sai</summary>
      <p className="small">
        Thổi kèn, hát hoặc ngân nga <strong>giai điệu</strong> bài này (một giọng, không có nhạc đệm) — thu ngay hoặc chọn file ghi âm có sẵn.
        Máy so từng nốt với bản quét rồi gợi ý chỗ sửa. Hát khác giọng, nhanh chậm tuỳ ý đều được.
      </p>
      <div className="row gap wrap center">
        {status === 'recording' ? (
          <button type="button" className="btn btn-primary" onClick={stop}><Icon name="stop" size={18} /> Dừng ({Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')})</button>
        ) : (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={start}><Icon name="mic" size={18} /> Thu âm</button>
        )}
        <button type="button" className="btn btn-ghost" disabled={busy || status === 'recording'} onClick={() => fileRef.current?.click()}><Icon name="music" size={18} /> Chọn file ghi âm</button>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.webm" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(f); }} />
        {busy && <span className="muted small">{status === 'decoding' ? 'Đang đọc bản thu…' : 'Đang dò cao độ và so từng nốt…'}</span>}
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      {result && (
        <div className="rec-result">
          <p className="small">
            Khớp <strong>{result.matched}/{result.scoreNotes}</strong> nốt
            {result.offset % 12 !== 0 && <> · bạn hát / thổi lệch {result.offset > 0 ? '+' : ''}{result.offset} nửa cung so với bản nhạc (không sao)</>}.
          </p>
          {lowMatch && <div className="alert" role="note">Bản thu khớp ít — có thể thu nhầm bài, có nhạc đệm / tiếng ồn, hoặc mới thu một đoạn ngắn. Gợi ý dưới đây kém tin cậy.</div>}
          {result.suggestions.length === 0 ? (
            <p className="small"><Icon name="check" size={16} /> Không thấy chỗ nào khác giữa bản quét và bản thu.</p>
          ) : (
            <>
              <ul className="rec-list">
                {result.suggestions.map((s) => {
                  const k = sugKey(s);
                  return (
                    <li key={k}>
                      <label className="check"><input type="checkbox" checked={checked.has(k)} onChange={() => toggle(k)} /> <span>{describe(s)}</span></label>
                      <button type="button" className="link-btn" onClick={() => onFocus('noteId' in s ? s.noteId : s.afterId)}>Xem</button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="btn btn-primary" disabled={!checked.size} onClick={apply}>Áp dụng {checked.size} mục đã chọn</button>
            </>
          )}
        </div>
      )}
    </details>
  );
}
