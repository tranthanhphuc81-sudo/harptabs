/** Dò nốt từ bản thu trong luồng nền để giao diện không bị đứng (bài dài mất vài giây trên điện thoại) */
import { detectNotes, estimateTempo, RecordingKind } from './audioTranscribe';

type Req = { samples: Float32Array; sampleRate: number; kind: RecordingKind };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage: (m: unknown) => void };

ctx.onmessage = (e) => {
  try {
    const { samples, sampleRate, kind } = e.data;
    const notes = detectNotes(samples, sampleRate, kind);
    ctx.postMessage({ ok: true, notes, tempo: estimateTempo(notes) });
  } catch (err) {
    ctx.postMessage({ ok: false, error: (err as Error).message || String(err) });
  }
};
