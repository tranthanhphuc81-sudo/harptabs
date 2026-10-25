/**
 * Thu một lượt hát karaoke thành MỘT file stereo: kênh trái = nhạc đệm (lấy ngay sau bộ nén, đúng cái đang phát),
 * kênh phải = giọng từ micro. Hai kênh nằm chung một file nên luôn khớp nhau từng mẫu;
 * giọng trễ hơn nhạc một khoảng (độ trễ loa + micro) — lưu lại để nghe / xuất thì đẩy giọng sớm lại.
 * Micro KHÔNG bao giờ được nối ra loa (tránh hú).
 */
import { audio, outputTap } from './engine';
import { outputDelay } from './latency';
import { MAX_RECORD_MIN } from '../lib/recordings';

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function recorderSupported(): boolean {
  return typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function pickMime(): string {
  for (const m of MIMES) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return '';
}

export interface Take { blob: Blob; mime: string; durationSec: number; voiceLagMs: number }

export class KaraokeRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private nodes: AudioNode[] = [];
  private chunks: Blob[] = [];
  private startedAt = 0;
  private limit = 0;
  private lagMs = 0;
  /** tự dừng vì quá dài */
  onLimit?: () => void;

  get recording() { return !!this.rec && this.rec.state === 'recording'; }

  /**
   * @param echoCancellation bật khi không đeo tai nghe
   * @param extraLagMs độ trễ micro + bù tay (ms) cộng thêm vào độ trễ loa máy báo
   */
  async start(echoCancellation: boolean, extraLagMs: number) {
    if (this.rec) return;
    if (!recorderSupported()) throw new Error('Trình duyệt này chưa thu âm được — thử Chrome / Safari bản mới');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation, noiseSuppression: false, autoGainControl: false } });
    const ctx = audio();
    void ctx.resume?.();
    const mic = ctx.createMediaStreamSource(this.stream);
    const merger = ctx.createChannelMerger(2);
    const dest = ctx.createMediaStreamDestination();
    outputTap().connect(merger, 0, 0);
    mic.connect(merger, 0, 1);
    merger.connect(dest);
    this.nodes = [mic, merger, dest];
    const mime = pickMime();
    this.rec = new MediaRecorder(dest.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000 });
    this.chunks = [];
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data); };
    this.rec.start(1000);
    this.startedAt = performance.now();
    this.lagMs = Math.round(outputDelay(ctx) * 1000 + extraLagMs);
    this.limit = window.setTimeout(() => this.onLimit?.(), MAX_RECORD_MIN * 60_000);
  }

  /** dừng và trả về bản thu (null nếu chưa thu gì) */
  stop(): Promise<Take | null> {
    const rec = this.rec;
    if (!rec) return Promise.resolve(null);
    window.clearTimeout(this.limit);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mime });
        const durationSec = (performance.now() - this.startedAt) / 1000;
        this.cleanup();
        resolve(blob.size ? { blob, mime, durationSec, voiceLagMs: this.lagMs } : null);
      };
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop?.(new Event('stop'));
    });
  }

  /** huỷ, không giữ bản thu */
  cancel() {
    window.clearTimeout(this.limit);
    if (this.rec && this.rec.state !== 'inactive') { this.rec.onstop = null; this.rec.stop(); }
    this.cleanup();
  }

  private cleanup() {
    try { outputTap().disconnect(this.nodes[1]); } catch { /* đã ngắt */ }
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* bỏ qua */ } }
    this.nodes = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.rec = null;
    this.chunks = [];
  }
}
