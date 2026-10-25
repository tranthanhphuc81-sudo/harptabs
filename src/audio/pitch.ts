/** Dò cao độ từ micro bằng thuật toán YIN — chạy hoàn toàn trên máy. */
import { hzToMidiFloat } from '../lib/harp';

export interface PitchReading {
  hz: number;
  midi: number;
  /** lệch so với nốt gần nhất, đơn vị cent (-50..50) */
  cents: number;
  nearest: number;
  rms: number;
  clarity: number;
}

export function yin(buf: Float32Array, sampleRate: number, minHz = 150, maxHz = 3400, threshold = 0.12): { hz: number; clarity: number } | null {
  const half = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(half - 1, Math.ceil(sampleRate / minHz));
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const diff = buf[i] - buf[i + tau];
      s += diff * diff;
    }
    d[tau] = s;
  }
  // cumulative mean normalized difference
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;
  // nội suy parabol để tăng độ chính xác
  const x0 = tau > 1 ? cmnd[tau - 1] : cmnd[tau];
  const x2 = tau + 1 <= tauMax ? cmnd[tau + 1] : cmnd[tau];
  const denom = 2 * (2 * cmnd[tau] - x2 - x0);
  const better = denom !== 0 ? tau + (x2 - x0) / denom : tau;
  return { hz: sampleRate / better, clarity: 1 - cmnd[tau] };
}

export interface MicOptions {
  /** tầm cao độ dò (Hz) — mặc định cho kèn; giọng hát: 75–1100 */
  minHz?: number;
  maxHz?: number;
  /** độ rõ tối thiểu (0..1) để nhận một lần đọc */
  minClarity?: number;
  /** âm lượng tối thiểu (RMS) — nhỏ hơn coi là im lặng */
  minRms?: number;
  /** khử tiếng vọng: bật khi không đeo tai nghe để micro bớt nghe nhạc đệm từ loa */
  echoCancellation?: boolean;
}

/** mặc định giữ đúng như trước (dò nốt kèn, chờ nốt) */
const KEN: Required<MicOptions> = { minHz: 150, maxHz: 3400, minClarity: 0.8, minRms: 0.012, echoCancellation: false };
/** giọng hát: xuống tới giọng nam trầm (~75 Hz), chấp nhận tiếng hơi rè / có rung */
export const VOICE_MIC: MicOptions = { minHz: 75, maxHz: 1100, minClarity: 0.7, minRms: 0.01 };

export class MicPitch {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  private buf = new Float32Array(2048);
  private o: Required<MicOptions>;
  onReading?: (r: PitchReading | null) => void;

  constructor(opts: MicOptions = {}) {
    this.o = { ...KEN, ...opts };
  }

  /** nửa cửa sổ phân tích (giây): cao độ đọc được là của khoảng giữa cửa sổ, tức trễ hơn chút so với lúc đọc */
  get windowDelay(): number {
    return this.ctx ? this.buf.length / 2 / this.ctx.sampleRate : 0.021;
  }

  get active() {
    return !!this.stream;
  }

  async start() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Thiết bị không hỗ trợ micro trong trình duyệt này');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: this.o.echoCancellation, noiseSuppression: false, autoGainControl: false },
    });
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    src.connect(this.analyser);
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.analyser!.getFloatTimeDomainData(this.buf);
      let rms = 0;
      for (let i = 0; i < this.buf.length; i++) rms += this.buf[i] * this.buf[i];
      rms = Math.sqrt(rms / this.buf.length);
      if (rms < this.o.minRms) { this.onReading?.(null); return; }
      const r = yin(this.buf, this.ctx!.sampleRate, this.o.minHz, this.o.maxHz);
      if (!r || r.clarity < this.o.minClarity) { this.onReading?.(null); return; }
      const midi = hzToMidiFloat(r.hz);
      const nearest = Math.round(midi);
      this.onReading?.({ hz: r.hz, midi, nearest, cents: (midi - nearest) * 100, rms, clarity: r.clarity });
    };
    loop();
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
  }
}
