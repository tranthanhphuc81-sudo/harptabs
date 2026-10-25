/** Trộn bản thu karaoke và xuất file WAV (không cần thư viện nén) */

export interface MixOptions {
  /** giọng thu trễ hơn nhạc đệm bao nhiêu (ms) — đẩy giọng lên sớm lại cho khớp */
  voiceLagMs: number;
  /** âm lượng giọng / nhạc đệm (0..1.5) */
  voiceGain: number;
  accompGain: number;
  /** tần số mẫu file xuất — 22,05 kHz: đủ nghe, khoảng 2,6 MB mỗi phút */
  targetRate?: number;
}

/** trộn kênh nhạc đệm (L) và giọng (R) thành một kênh, đổi tần số mẫu, chống vỡ tiếng */
export function mixRecording(accomp: Float32Array, voice: Float32Array, sampleRate: number, o: MixOptions): { samples: Float32Array; sampleRate: number } {
  const rate = o.targetRate ?? 22050;
  const lag = Math.round((o.voiceLagMs / 1000) * sampleRate);
  const len = Math.max(accomp.length, voice.length - Math.max(0, lag));
  const mixed = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const v = voice[i + lag];
    mixed[i] = (accomp[i] ?? 0) * o.accompGain + (v ?? 0) * o.voiceGain;
  }
  // đổi tần số mẫu: trung bình các mẫu trong mỗi ô (lọc chống răng cưa đơn giản)
  const step = sampleRate / rate;
  const n = Math.floor((len * rate) / sampleRate + 1e-6);
  const out = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    let s = 0;
    for (let k = a; k < b && k < len; k++) s += mixed[k];
    out[i] = s / (b - a);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak > 0.98) for (let i = 0; i < n; i++) out[i] *= 0.98 / peak;
  return { samples: out, sampleRate: rate };
}

/** WAV PCM 16-bit một kênh */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}
