/**
 * Bộ phát bài: lập lịch giai điệu + beat theo lưới thời gian của AudioContext
 * (look-ahead scheduling), hỗ trợ đổi tempo trực tiếp, lặp đoạn, đếm vào.
 */
import { FlatEvent } from '../lib/tabText';
import { getBeatPrefs } from './beatPrefs';
import { audio, bass, bongo, clave, click, cowbell, conga, crash, guiro, hat, kick, playTone, rim, setHumanVelocity, shaker, snare, tom } from './engine';
import { bassMidi, Chord, chordAt, ChordOverrides, ChordSpan, harmonize, parseTonality } from './harmony';
import { BeatPattern, BeatStyle, boPattern, resolvePattern } from './patterns';

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
  /** tông bài ("G", "Dm") để đệm hợp âm; bỏ trống thì tự đoán từ giai điệu */
  songKey?: string;
  /** hợp âm chọn tay (ghi đè hợp âm tự đoán) */
  chordOverrides?: ChordOverrides;
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
  private chords: ChordSpan[] = [];
  private chordKey = '';
  playing = false;
  onEnd?: () => void;

  constructor(opts: PlayerOptions) {
    this.opts = { ...opts };
  }

  load(events: FlatEvent[]) {
    this.events = events;
    const last = events[events.length - 1];
    this.endBeat = last ? last.start + last.beats : 0;
    this.chordKey = '';
    this.updateChords();
  }

  private updateChords() {
    const o = this.opts;
    const k = `${o.beatsPerBar}|${o.pickupBeats}|${o.songKey ?? ''}|${JSON.stringify(o.chordOverrides ?? {})}`;
    if (k === this.chordKey) return;
    this.chordKey = k;
    this.chords = harmonize(this.events, o.beatsPerBar, o.pickupBeats, parseTonality(o.songKey), o.chordOverrides);
  }

  /** Hợp âm đệm tại vị trí (phách) */
  chordAt(beat: number): Chord | null {
    return chordAt(this.chords, beat);
  }

  get options(): PlayerOptions {
    return this.opts;
  }

  setOptions(p: Partial<PlayerOptions>) {
    this.opts = { ...this.opts, ...p };
    this.updateChords();
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

  /** Bass đánh theo trống bass: gốc ở đầu ô nhịp / khi đổi hợp âm, quãng 5 ở nửa sau ô nhịp */
  private bassHit(pattern: BeatPattern, stepIdx: number, bar: number, beat: number, t: number, spb: number, style: BeatStyle, force = false) {
    const track = pattern.kick ?? '';
    const barLen = pattern.beats * pattern.subdiv;
    const cyc = (track.length > barLen ? (Math.max(0, bar) % Math.round(track.length / barLen)) * barLen : 0) + stepIdx;
    const ch = track[cyc];
    if (!force && ch !== 'x' && ch !== 'X') return;
    const chord = this.chordAt(beat + 1e-3);
    if (!chord || chord.root < 0) return;
    const len = track.length;
    let gap = 1;
    while (gap < len && track[(cyc + gap) % len] === '.') gap++;
    const stepBeats = 1 / pattern.subdiv;
    const span = this.chords.find((c) => beat >= c.start - 1e-6 && beat < c.end - 1e-6);
    const untilChange = span ? span.end - beat : gap * stepBeats;
    const durBeats = Math.min(gap * stepBeats, untilChange, 2) * 0.88;
    const changed = !!span && Math.abs(span.start - beat) < 1e-6;
    const half = Math.floor(barLen / 2);
    const altFifth = style !== 'rock' && style !== 'ballad' && stepIdx >= half && !changed;
    bass(bassMidi(chord, altFifth), t, durBeats * spb, ch === 'X' || stepIdx === 0 ? 1 : 0.8);
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
        const bp = getBeatPrefs();
        setHumanVelocity(bp.humanize ? 0.12 : 0);
        // lắc (swing): đẩy trễ các ô lẻ; nhịp chùm ba vốn đã lắc nên bỏ qua
        const swing = subdiv !== 3 && stepIdx % 2 === 1 ? bp.swing * step * spb : 0;
        const jitter = bp.humanize ? (Math.random() - 0.5) * 0.012 : 0;
        const t = Math.max(c.currentTime, t0 + swing + jitter);
        // phách chính đậm hơn phách phụ cho có nhún
        const accent = bp.humanize && stepIdx % subdiv !== 0 ? 0.78 : 1;

        const bar = Math.floor((b0 - o.pickupBeats) / o.beatsPerBar + EPS);
        const fillBeat = bp.fills && bar >= 0 && (bar + 1) % 4 === 0 && posInBar >= o.beatsPerBar - 1 - EPS;
        if (fillBeat) {
          // dồn trống ở phách cuối mỗi câu 4 ô nhịp: tom từ cao xuống trầm
          const k = stepIdx - (o.beatsPerBar - 1) * subdiv;
          if (k === 0) {
            kick(t, 0.9);
            if (bp.bass) this.bassHit(pattern, stepIdx, bar, b0, t, spb, o.style, true);
          }
          if (k % 2 === 0) snare(t, 0.55 + 0.1 * k);
          tom(t, 0.6 + 0.1 * k, subdiv > 1 ? k / (subdiv - 1) : 0);
        } else {
          if (bp.fills && bar > 0 && bar % 4 === 0 && stepIdx === 0) crash(t, 0.9);
          const barLen = o.beatsPerBar * subdiv;
          // track dài nhiều ô nhịp: lấy ô theo chu kỳ (ô lấy đà dùng ô đầu)
          const at = (track: string | undefined) => track?.[(track.length > barLen ? (Math.max(0, bar) % Math.round(track.length / barLen)) * barLen : 0) + stepIdx];
          const perc = (track: string | undefined, fn: (t: number, ch: string) => void) => {
            const ch = at(track);
            if (ch && ch !== '.') fn(t, ch);
          };
          const hit = (track: string | undefined, fn: (t: number, v: number) => void) => {
            const ch = at(track);
            if (ch === 'x') fn(t, 0.7);
            else if (ch === 'X') fn(t, 1);
          };
          hit(pattern.kick, kick);
          if (bp.bass) this.bassHit(pattern, stepIdx, bar, b0, t, spb, o.style);
          hit(pattern.snare, snare);
          hit(pattern.hat, (t, v) => hat(t, v * accent));
          hit(pattern.openHat, (t, v) => hat(t, v, true));
          hit(pattern.rim, rim);
          hit(pattern.shaker, (t, v) => shaker(t, v * accent));
          perc(bp.bo ? boPattern(pattern) : pattern.bongo, (t, ch) => bongo(t, ch));
          perc(pattern.conga, (t, ch) => conga(t, ch));
          perc(pattern.guiro, (t, ch) => guiro(t, ch === 'X'));
          hit(pattern.clave, clave);
          hit(pattern.cowbell, cowbell);
        }
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
