/**
 * Phát nhạc nền MP3 cho karaoke theo bản đồ nhịp: cùng cách điều khiển như bộ phát tổng hợp
 * (phát từ một phách, dừng, phách đang vang ra loa) để màn hình lời / chấm điểm / thu âm dùng chung.
 */
import { audio, backingBus } from './engine';
import { heardTime } from './latency';
import { beatAt, secAt, TempoMap } from '../lib/tempoMap';

/** phát sớm hơn câu được chọn chừng này (giây) cho kịp vào */
const LEAD_IN = 1.5;

export class BackingPlayer {
  private src: AudioBufferSourceNode | null = null;
  private t0 = 0;
  private s0 = 0;
  playing = false;
  onEnd?: () => void;

  constructor(private buffer: AudioBuffer, private map: TempoMap, private offsetMs = 0) {}

  setSync(map: TempoMap, offsetMs: number) { this.map = map; this.offsetMs = offsetMs; }

  get duration() { return this.buffer.duration; }

  /** phát từ phách `fromBeat` (lùi lại chút để kịp vào câu); `fromSec` để phát từ một giây bất kỳ (canh tay) */
  start(fromBeat = 0, fromSec?: number) {
    this.stop();
    const ctx = audio();
    void ctx.resume?.();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(backingBus());
    const target = fromSec ?? secAt(this.map, fromBeat) + this.offsetMs / 1000 - LEAD_IN;
    this.s0 = Math.max(0, Math.min(this.buffer.duration - 0.05, target));
    this.t0 = ctx.currentTime + 0.08;
    src.onended = () => { if (this.src === src) { this.src = null; this.playing = false; this.onEnd?.(); } };
    src.start(this.t0, this.s0);
    this.src = src;
    this.playing = true;
  }

  stop() {
    const s = this.src;
    this.src = null;
    this.playing = false;
    if (s) { s.onended = null; try { s.stop(); } catch { /* đã dừng */ } }
  }

  /** giây trong file nhạc đang vang ra loa (đã trừ độ trễ âm thanh); null khi dừng */
  currentSec(): number | null {
    if (!this.playing) return null;
    return heardTime(audio()) - this.t0 + this.s0;
  }

  /** phách trong tab đang vang ra loa (dương offset = lời chạy muộn hơn nhạc) */
  currentBeat(): number | null {
    const sec = this.currentSec();
    return sec === null ? null : beatAt(this.map, sec - this.offsetMs / 1000);
  }
}

/** Đọc file nhạc thành AudioBuffer (trong AudioContext của bộ phát) */
export async function decodeBacking(blob: Blob): Promise<AudioBuffer> {
  try {
    return await audio().decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error('Không đọc được file nhạc này — thử file .mp3, .m4a hoặc .wav');
  }
}
