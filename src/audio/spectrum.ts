/** Phổ tần số từ micro (chạy hoàn toàn trên máy) — để nghe cả hợp âm nhiều nốt cùng lúc, việc mà dò cao độ một nốt (YIN) không làm được. */

export class MicSpectrum {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf = 0;
  /** mỗi khung hình: thời điểm (giây), âm lượng (RMS của 2048 mẫu mới nhất), phổ biên độ tuyến tính, độ rộng mỗi ô tần số (Hz) */
  onFrame?: (time: number, rms: number, mag: Float32Array, binHz: number) => void;

  async start() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Thiết bị không hỗ trợ micro trong trình duyệt này');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.analyser = this.ctx.createAnalyser();
    // 16384 mẫu: mỗi ô ~3 Hz, đủ tách Mi2 (82 Hz) với Fa2 (87 Hz)
    this.analyser.fftSize = 16384;
    this.analyser.smoothingTimeConstant = 0;
    this.ctx.createMediaStreamSource(this.stream).connect(this.analyser);
    const dbs = new Float32Array(this.analyser.frequencyBinCount);
    const mag = new Float32Array(this.analyser.frequencyBinCount);
    const wave = new Float32Array(this.analyser.fftSize);
    const binHz = this.ctx.sampleRate / this.analyser.fftSize;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      this.analyser!.getFloatTimeDomainData(wave);
      let rms = 0;
      for (let i = wave.length - 2048; i < wave.length; i++) rms += wave[i] * wave[i];
      rms = Math.sqrt(rms / 2048);
      this.analyser!.getFloatFrequencyData(dbs);
      for (let i = 0; i < dbs.length; i++) mag[i] = Number.isFinite(dbs[i]) ? 10 ** (dbs[i] / 20) : 0;
      this.onFrame?.(this.ctx!.currentTime, rms, mag, binHz);
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
