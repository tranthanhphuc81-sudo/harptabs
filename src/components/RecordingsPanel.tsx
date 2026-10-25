import { useEffect, useRef, useState } from 'react';
import { audio } from '../audio/engine';
import { decodeChannels } from '../lib/decode';
import { deleteRecording, listRecordings, updateRecording } from '../lib/recordings';
import type { Recording } from '../lib/types';
import { encodeWav, mixRecording } from '../lib/wav';
import { slugify } from '../lib/db';
import { Icon } from './Icon';
import { useAppState } from '../state';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtSize = (b: number) => (b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`);

interface Loaded { id: number; accomp: Float32Array; voice: Float32Array | null; sampleRate: number }

/** Danh sách bản thu karaoke của bài: nghe lại (giọng khớp nhạc), chỉnh lệch, cân giọng / nhạc, xuất WAV, xoá */
export function RecordingsPanel({ songId, refreshKey, onClose }: { songId: string; refreshKey: number; onClose: () => void }) {
  const { toast } = useAppState();
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Recording[] | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [lag, setLag] = useState<Record<number, number>>({});
  const [voiceGain, setVoiceGain] = useState(1);
  const [accompGain, setAccompGain] = useState(0.8);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const loaded = useRef<Loaded | null>(null);
  const live = useRef<{ srcs: AudioBufferSourceNode[]; gv: GainNode; ga: GainNode } | null>(null);

  useEffect(() => { ref.current?.showModal?.(); }, []);
  useEffect(() => { void listRecordings(songId).then(setRows); }, [songId, refreshKey]);
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!live.current) return;
    live.current.gv.gain.value = voiceGain;
    live.current.ga.gain.value = accompGain;
  }, [voiceGain, accompGain]);

  const lagOf = (r: Recording) => lag[r.id!] ?? r.voiceLagMs;

  async function load(r: Recording): Promise<Loaded> {
    const cur = loaded.current;
    if (cur && cur.id === r.id) return cur;
    const { channels, sampleRate } = await decodeChannels(r.blob);
    const d = { id: r.id!, accomp: channels[0], voice: channels[1] ?? null, sampleRate };
    loaded.current = d;
    return d;
  }

  function stop() {
    live.current?.srcs.forEach((s) => { s.onended = null; try { s.stop(); } catch { /* đã dừng */ } });
    live.current = null;
    setPlaying(null);
  }

  async function play(r: Recording) {
    stop();
    setBusy(r.id!);
    try {
      const d = await load(r);
      const ctx = audio();
      void ctx.resume?.();
      const buf = (x: Float32Array) => { const b = ctx.createBuffer(1, x.length, d.sampleRate); b.copyToChannel(x as Float32Array<ArrayBuffer>, 0); return b; };
      const ga = ctx.createGain(), gv = ctx.createGain();
      ga.gain.value = accompGain; gv.gain.value = voiceGain;
      ga.connect(ctx.destination); gv.connect(ctx.destination);
      const t = ctx.currentTime + 0.1;
      const a = ctx.createBufferSource();
      a.buffer = buf(d.accomp);
      a.connect(ga);
      a.start(t);
      const srcs = [a];
      if (d.voice) {
        // giọng thu trễ hơn nhạc: phát giọng từ sớm hơn đúng khoảng đó
        const v = ctx.createBufferSource();
        v.buffer = buf(d.voice);
        v.connect(gv);
        const l = lagOf(r) / 1000;
        if (l >= 0) v.start(t, Math.min(l, d.voice.length / d.sampleRate)); else v.start(t - l);
        srcs.push(v);
      }
      a.onended = () => { if (live.current?.srcs[0] === a) stop(); };
      live.current = { srcs, gv, ga };
      setPlaying(r.id!);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportWav(r: Recording) {
    setBusy(r.id!);
    try {
      const d = await load(r);
      const { samples, sampleRate } = mixRecording(d.accomp, d.voice ?? new Float32Array(0), d.sampleRate, { voiceLagMs: lagOf(r), voiceGain, accompGain });
      const url = URL.createObjectURL(encodeWav(samples, sampleRate));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(r.title)}-${new Date(r.createdAt).toISOString().slice(0, 10)}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(r: Recording) {
    if (confirmDel !== r.id) { setConfirmDel(r.id!); setTimeout(() => setConfirmDel((c) => (c === r.id ? null : c)), 4000); return; }
    if (playing === r.id) stop();
    if (loaded.current?.id === r.id) loaded.current = null;
    await deleteRecording(r.id!);
    setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null);
    toast('Đã xoá bản thu');
  }

  const commitLag = (r: Recording) => { const v = lag[r.id!]; if (v !== undefined && v !== r.voiceLagMs) void updateRecording(r.id!, { voiceLagMs: v }); };

  return (
    <dialog ref={ref} className="sheet recordings" onClose={() => { stop(); onClose(); }} aria-labelledby="rec-title">
      <h2 id="rec-title">Bản thu</h2>
      {!rows ? <p className="muted">Đang tải…</p> : !rows.length ? (
        <p className="muted">Chưa có bản thu nào. Bấm <strong>⏺ Thu</strong> trong màn hình karaoke để vừa hát vừa thu.</p>
      ) : (
        <ul className="rec-list">
          {rows.map((r) => (
            <li key={r.id} className={playing === r.id ? 'on' : ''}>
              <div className="row between center wrap gap">
                <div>
                  <strong>{new Date(r.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</strong>
                  <span className="muted small"> · {fmtTime(r.durationSec)} · {fmtSize(r.size)}{r.transpose ? ` · tông ${r.transpose > 0 ? '+' : ''}${r.transpose}` : ''}{r.score != null ? ` · ${r.score} điểm` : ''}</span>
                </div>
                <div className="row gap">
                  <button type="button" className="btn btn-primary btn-sm" disabled={busy === r.id} onClick={() => (playing === r.id ? stop() : play(r))}>
                    <Icon name={playing === r.id ? 'stop' : 'play'} size={16} /> {playing === r.id ? 'Dừng' : busy === r.id ? 'Đang mở…' : 'Nghe'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => exportWav(r)} aria-label="Xuất file WAV"><Icon name="download" size={16} /> WAV</button>
                  <button type="button" className={`btn btn-sm ${confirmDel === r.id ? 'btn-danger' : 'btn-ghost'}`} onClick={() => remove(r)} aria-label={confirmDel === r.id ? 'Bấm lần nữa để xoá' : 'Xoá bản thu'}>
                    {confirmDel === r.id ? 'Xoá?' : <Icon name="trash" size={16} />}
                  </button>
                </div>
              </div>
              {playing === r.id && (
                <div className="rec-controls">
                  <label className="field">
                    <span className="field-label">Giọng sớm / trễ: {lagOf(r) - r.voiceLagMs > 0 ? '+' : ''}{lagOf(r) - r.voiceLagMs} ms</span>
                    <input type="range" min={r.voiceLagMs - 300} max={r.voiceLagMs + 300} step={10} value={lagOf(r)}
                      onChange={(e) => setLag((m) => ({ ...m, [r.id!]: Number(e.target.value) }))}
                      onPointerUp={() => { commitLag(r); void play(r); }} onKeyUp={() => { commitLag(r); void play(r); }} />
                  </label>
                  <label className="field"><span className="field-label">Giọng</span>
                    <input type="range" min={0} max={1.5} step={0.05} value={voiceGain} onChange={(e) => setVoiceGain(Number(e.target.value))} /></label>
                  <label className="field"><span className="field-label">Nhạc đệm</span>
                    <input type="range" min={0} max={1.5} step={0.05} value={accompGain} onChange={(e) => setAccompGain(Number(e.target.value))} /></label>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Bản thu chỉ lưu trên máy này, không có trong file sao lưu hay link chia sẻ. Xuất WAV để giữ lại hoặc gửi cho người khác.</p>
      <div className="row gap end">
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>Xong</button>
      </div>
    </dialog>
  );
}
