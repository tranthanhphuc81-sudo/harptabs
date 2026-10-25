import { describe, expect, it } from 'vitest';
import { encodeWav, mixRecording } from './wav';

describe('xuất bản thu karaoke', () => {
  it('đẩy giọng sớm lại đúng độ trễ rồi trộn với nhạc đệm', () => {
    const sr = 1000;
    const accomp = new Float32Array(1000);
    const voice = new Float32Array(1000);
    accomp[100] = 0.5;
    voice[150] = 0.5; // giọng trễ 50 ms
    const { samples, sampleRate } = mixRecording(accomp, voice, sr, { voiceLagMs: 50, voiceGain: 1, accompGain: 1, targetRate: 1000 });
    expect(sampleRate).toBe(1000);
    expect(samples[100]).toBeCloseTo(0.98, 2); // 0,5 + 0,5 = 1 → hạ xuống chống vỡ tiếng
    expect(samples[150]).toBe(0);
  });

  it('đổi tần số mẫu 48 kHz → 22,05 kHz giữ đúng độ dài', () => {
    const x = new Float32Array(48000).fill(0.2);
    const { samples, sampleRate } = mixRecording(x, new Float32Array(48000), 48000, { voiceLagMs: 0, voiceGain: 1, accompGain: 1 });
    expect(sampleRate).toBe(22050);
    expect(samples.length).toBe(22050);
    expect(samples[1000]).toBeCloseTo(0.2, 5);
  });

  it('file WAV: phần đầu đúng chuẩn, kích thước đúng, mẫu vượt ngưỡng bị chặn', async () => {
    const blob = encodeWav(Float32Array.from([0, 1, -1, 2]), 22050);
    const b = new Uint8Array(await blob.arrayBuffer());
    const txt = (o: number) => String.fromCharCode(...b.subarray(o, o + 4));
    expect([txt(0), txt(8), txt(12), txt(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(b.length).toBe(44 + 4 * 2);
    const v = new DataView(b.buffer);
    expect(v.getUint32(24, true)).toBe(22050);
    expect([v.getInt16(46, true), v.getInt16(48, true), v.getInt16(50, true)]).toEqual([32767, -32768, 32767]);
  });
});
