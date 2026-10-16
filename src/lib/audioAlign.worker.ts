/** Phân tích bản thu trong luồng nền để giao diện không bị đứng (bài dài mất vài giây trên điện thoại) */
import { analyzeRecording, ScoreNote } from './audioAlign';

type Req = { samples: Float32Array; sampleRate: number; score: ScoreNote[]; meter?: number; mode?: 'solo' | 'mix' };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage: (m: unknown) => void };

ctx.onmessage = (e) => {
  try {
    const { samples, sampleRate, score, meter, mode } = e.data;
    ctx.postMessage({ ok: true, result: analyzeRecording(samples, sampleRate, score, meter, mode) });
  } catch (err) {
    ctx.postMessage({ ok: false, error: (err as Error).message || String(err) });
  }
};
