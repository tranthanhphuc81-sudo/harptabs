/**
 * Bộ phát bài: lập lịch giai điệu + beat theo lưới thời gian của AudioContext
 * (look-ahead scheduling), hỗ trợ đổi tempo trực tiếp, lặp đoạn, đếm vào.
 */
import { FlatEvent } from '../lib/tabText';
import { audio, click, hat, kick, playTone, rim, shaker, snare } from './engine';
import { BeatStyle, resolvePattern } from './patterns';

export interface PlayerOptions {
  bpm: number;
  tempoScale: number;
  beatsPerBar: number;
  pickupBeats: number;
  style: BeatStyle;
  melody: boolean;
  beat: boolean;
  click: boolean;
  countIn: boolean;
  loop: { start: number; end: number } | null;
}

interface Marker { time: number; beat: number; spb: number }

const EPS = 1e-6;
const mod = (a: number, n: number) => ((a % n) + n) % n;

export class Player {
  private events: FlatEvent[] = [];
  private endBeat = 0;
  private opts: PlayerOptions;
  private timer: number | null = null;
  private endTimer: number | null = null;
  private cursorBeat = 0;
  private cursorTime = 0;
  private markers: Marker[] = [];
  private finished = false;
  playing = false;
  onEnd?: () => void;

  constructor(opts: PlayerOptions) {
    this.opts = { ...opts };
  }

  load(events: FlatEvent[]) {
    this.events = events;
    const last = events[events.length - 1];
    this.endBeat = last ? last.start + last.beats : 0;
  }

  get options(): PlayerOptions {
    return this.opts;
  }

  setOptions(p: Partial<PlayerOptions>) {
    this.opts = { ...this.opts, ...p };
  }

  private spb() {
    return 60 / Math.max(20, this.opts.bpm * this.opts.tempoScale);
  }

  private subdiv() {
    return resolvePattern(this.opts.style, this.opts.beatsPerBar)?.subdiv ?? 2;
  }

  private snap(beat: number) {
    const s = this.subdiv();
    const p = this.opts.pickupBeats;
    return p + Math.floor((beat - p) * s + EPS) / s;
  }

  start(fromBeat = 0) {
    this.stop();
    const c = audio();
    const spb = this.spb();
    const from = this.snap(Math.max(0, fromBeat));
    let t = c.currentTime + 0.08;
    this.markers = [];
    if (this.opts.countIn) {
      const n = this.opts.beatsPerBar;
      for (let i = 0; i < n; i++) {
        click(t + i * spb, i === 0);
        this.markers.push({ time: t + i * spb, beat: from - n + i, spb });
      }
      t += n * spb;
    }
    this.cursorBeat = from;
    this.cursorTime = t;
    this.finished = false;
    this.playing = true;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.timer = null;
    this.endTimer = null;
    this.playing = false;
    this.markers = [];
  }

  /** Vị trí hiện tại (phách) theo đồng hồ âm thanh; null nếu đang dừng */
  currentBeat(): number | null {
    if (!this.playing) return null;
    const now = audio().currentTime;
    let m: Marker | undefined;
    for (let i = this.markers.length - 1; i >= 0; i--) {
      if (this.markers[i].time <= now) { m = this.markers[i]; break; }
    }
    if (!m) return this.markers[0] ? this.markers[0].beat : null;
    if (this.markers.length > 400) this.markers.splice(0, this.markers.length - 200);
    return m.beat + (now - m.time) / m.spb;
  }

  private tick() {
    if (this.finished) return;
    const c = audio();
    const horizon = c.currentTime + 0.15;
    const o = this.opts;
    const pattern = resolvePattern(o.style, o.beatsPerBar);
    const subdiv = pattern?.subdiv ?? 2;
    const step = 1 / subdiv;

    while (this.cursorTime < horizon) {
      const spb = this.spb();
      const b0 = this.cursorBeat;
      const b1 = b0 + step;
      const t0 = this.cursorTime;

      if (o.melody) {
        for (const ev of this.events) {
          if (ev.start >= b1 - EPS) break;
          if (ev.start >= b0 - EPS && ev.midi !== null && ev.token) {
            playTone(ev.midi, t0 + (ev.start - b0) * spb, ev.beats * spb * 0.9);
          }
        }
      }

      const posInBar = mod(b0 - o.pickupBeats, o.beatsPerBar);
      const stepIdx = Math.round(posInBar * subdiv);
      const onGrid = Math.abs(posInBar * subdiv - stepIdx) < 1e-3;
      if (onGrid && o.beat && pattern) {
        const hit = (track: string | undefined, fn: (t: number, v: number) => void) => {
          const ch = track?.[stepIdx];
          if (ch === 'x') fn(t0, 0.7);
          else if (ch === 'X') fn(t0, 1);
        };
        hit(pattern.kick, kick);
        hit(pattern.snare, snare);
        hit(pattern.hat, (t, v) => hat(t, v));
        hit(pattern.openHat, (t, v) => hat(t, v, true));
        hit(pattern.rim, rim);
        hit(pattern.shaker, shaker);
      }
      const onBeat = Math.abs(posInBar - Math.round(posInBar)) < 1e-3;
      if (onBeat && (o.click || (o.beat && o.style === 'metronome'))) {
        click(t0, Math.round(posInBar) % o.beatsPerBar === 0);
      }

      this.markers.push({ time: t0, beat: b0, spb });
      this.cursorBeat = b1;
      this.cursorTime = t0 + step * spb;

      const end = o.loop ? o.loop.end : this.endBeat;
      if (this.cursorBeat >= end - EPS) {
        if (o.loop && o.loop.end > o.loop.start) {
          this.cursorBeat = this.snap(o.loop.start);
        } else {
          this.finished = true;
          const wait = Math.max(0, (this.cursorTime - c.currentTime) * 1000) + 120;
          this.endTimer = window.setTimeout(() => {
            this.stop();
            this.onEnd?.();
          }, wait);
          break;
        }
      }
    }
  }
}
