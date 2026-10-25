/** Đọc file âm thanh (bản thu, MP3…) thành mẫu âm thanh */

function context(): AudioContext {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  return new AC();
}

/** từng kênh riêng (bản thu karaoke: trái = nhạc đệm, phải = giọng) */
export async function decodeChannels(blob: Blob): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const ctx = context();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice());
    return { channels, sampleRate: buf.sampleRate };
  } catch {
    throw new Error('Không đọc được file âm thanh này — thử file .mp3, .m4a hoặc .wav');
  } finally {
    void ctx.close();
  }
}

/** gộp về một kênh (dò cao độ, đối chiếu bản quét) */
export async function decodeAudio(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const { channels, sampleRate } = await decodeChannels(blob);
  const out = new Float32Array(channels[0]?.length ?? 0);
  for (const d of channels) for (let i = 0; i < d.length; i++) out[i] += d[i] / channels.length;
  return { samples: out, sampleRate };
}
