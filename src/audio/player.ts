/**
 * Bộ phát bài: lập lịch giai điệu + beat theo lưới thời gian của AudioContext
 * (look-ahead scheduling), hỗ trợ đổi tempo trực tiếp, lặp đoạn, đếm vào.
 */
import { FlatEvent } from '../lib/tabText';
import { getEffectivePrefs, setActiveStyle } from './beatPrefs';
import { Accomp, accompHit, audio, bass, bongo, chordStab, clap, clave, click, cowbell, conga, crash, guiro, hat, kick, playTone, ride, rim, setHumanVelocity, shaker, snare, surdo, tom } from './engine';
import { bassMidi, Chord, chordAt, chordVoicing, ChordOverrides, ChordSpan, harmonize, parseTonality, transposeSpans, walkingNote } from './harmony';
import { BeatPattern, BeatStyle, boPattern, lacPattern, resolvePattern, strumPattern } from './patterns';
import { AccompPlan, barTrack, planAccomp } from './accompPlan';
import { heardTime } from './latency';

export interface PlayerOptions {
  bpm: number;
  tempoScale: number;
  beatsPerBar: number;
  pickupBeats: number;
  style: BeatStyle;
  melody: boolean;
  /** đệm hát: tắt giai điệu, chỉ phát phần đệm (nhạc cụ đệm chọn trong cài đặt beat) */
  sing?: boolean;
  /** tiêu đề từng đoạn (nhận ra điệp khúc để đệm đầy hơn) */
  sections?: (string | undefined)[];
  beat: boolean;
  click: boolean;
  countIn: boolean;
  /** tông bài ("G", "Dm") để đệm hợp âm; bỏ trống thì tự đoán từ giai điệu */
  songKey?: string;
  /** hợp âm chọn tay (ghi đè hợp âm tự đoán) */
  chordOverrides?: ChordOverrides;
  /** đổi tông khi phát (nửa cung, karaoke: hợp giọng người hát); tab không đổi */
  transpose?: number;
  loop: { start: number; end: number } | null;
}

interface Marker { time: number; beat: number; spb: number }

const EPS = 1e-6;
/** lên lịch trước bao lâu (giây): đủ dài để máy khựng một lúc vẫn không trễ nhịp */
const LOOKAHEAD = 0.25;

/**
 * Đồng hồ gọi lập lịch mỗi 25ms. Chạy trong Web Worker vì trình duyệt hãm bộ hẹn giờ của trang
 * (tới ~1 lần/giây) khi tắt màn hình / chuyển app, còn hẹn giờ trong worker thì không; thiếu Worker thì dùng setInterval.
 */
function startClock(fn: () => void): () => void {
  try {
    const url = URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 25);'], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    return () => w.terminate();
  } catch {
    const id = window.setInterval(fn, 25);
    return () => window.clearInterval(id);
  }
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

export class Player {
  private events: FlatEvent[] = [];
  private endBeat = 0;
  private opts: PlayerOptions;
  private stopClock: (() => void) | null = null;
  private endTimer: number | null = null;
  private cursorBeat = 0;
  private cursorTime = 0;
  private markers: Marker[] = [];
  private finished = false;
  private chords: ChordSpan[] = [];
  private chordKey = '';
  /** kế hoạch đệm hát theo đặc trưng bài + điệu từng ô đã dựng */
  private plan: AccompPlan | null = null;
  private barTracks = new Map<string, string>();
  /** nốt bass walking vừa đánh (để nốt sau đi liền mạch) */
  private walkPrev: number | null = null;
  playing = false;
  onEnd?: () => void;

  constructor(opts: PlayerOptions) {
    this.opts = { ...opts };
    setActiveStyle(opts.style);
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
    const k = `${o.beatsPerBar}|${o.pickupBeats}|${o.songKey ?? ''}|${JSON.stringify(o.chordOverrides ?? {})}|${o.bpm}|${(o.sections ?? []).join('')}|${o.transpose ?? 0}`;
    if (k === this.chordKey) return;
    this.chordKey = k;
    // hợp âm tính theo giai điệu gốc rồi dịch theo tông đang phát
    this.chords = transposeSpans(harmonize(this.events, o.beatsPerBar, o.pickupBeats, parseTonality(o.songKey), o.chordOverrides), o.transpose ?? 0);
    this.plan = planAccomp(this.events, this.chords, { bpm: o.bpm, beatsPerBar: o.beatsPerBar, pickupBeats: o.pickupBeats, sections: o.sections });
    this.barTracks.clear();
  }

  /** Mô tả cách đệm hát bài này (hiện cho người dùng) */
  accompSummary(): string | null {
    return this.plan?.summary ?? null;
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
    if (this.playing) setActiveStyle(this.opts.style);
  }

  private spb() {
    return 60 / Math.max(20, this.opts.bpm * this.opts.tempoScale);
  }

  /** đang đệm hát: nhạc cụ đệm (null = phát bình thường) */
  private accomp(): Accomp | null {
    return this.opts.sing ? getEffectivePrefs(this.opts.style).accomp : null;
  }

  /** kiểu nhịp thực phát; đệm hát mà bài để "Không beat" / đếm nhịp thì đệm ballad hoặc valse */
  private beatStyle(): BeatStyle {
    const s = this.opts.style;
    if (this.opts.sing && (s === 'none' || s === 'metronome')) return this.opts.beatsPerBar === 3 ? 'waltz' : 'ballad';
    return s;
  }

  private subdiv() {
    const acc = this.accomp();
    if (acc && acc !== 'band') return strumPattern(this.opts.style, this.opts.beatsPerBar).subdiv;
    return resolvePattern(this.beatStyle(), this.opts.beatsPerBar)?.subdiv ?? 2;
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
    // âm thanh vừa khởi động (lần phát đầu): đồng hồ chưa chạy đều, cho bắt đầu chậm hơn một chút
    let t = c.currentTime + (c.state === 'running' && c.currentTime > 0.5 ? 0.08 : 0.3);
    this.markers = [];
    if (this.opts.countIn) {
      const n = this.opts.beatsPerBar;
      for (let i = 0; i < n; i++) {
        click(t + i * spb, i === 0);
        this.markers.push({ time: t + i * spb, beat: from - n + i, spb });
      }
      t += n * spb;
    }
    this.walkPrev = null;
    setActiveStyle(this.opts.style);
    this.cursorBeat = from;
    this.cursorTime = t;
    this.finished = false;
    this.playing = true;
    this.tick();
    this.stopClock = startClock(() => this.tick());
  }

  stop() {
    this.stopClock?.();
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.stopClock = null;
    this.endTimer = null;
    this.playing = false;
    this.markers = [];
  }

  /** Vị trí (phách) của tiếng đang ra loa lúc này — đã trừ độ trễ âm thanh; null nếu đang dừng */
  currentBeat(): number | null {
    if (!this.playing) return null;
    const now = heardTime(audio());
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
    // kiểu nhịp có đường bass riêng (r = gốc, o = gốc quãng tám trên, f = quãng 5); còn lại đánh theo trống bass
    const line = pattern.bassLine;
    const track = line ?? pattern.kick ?? '';
    const barLen = pattern.beats * pattern.subdiv;
    const cyc = (track.length > barLen ? (Math.max(0, bar) % Math.round(track.length / barLen)) * barLen : 0) + stepIdx;
    const ch = track[cyc];
    if (!force && (line ? !ch || ch === '.' : ch !== 'x' && ch !== 'X')) return;
    const chord = this.chordAt(beat + 1e-3);
    if (!chord || chord.root < 0) return;
    const len = track.length;
    let gap = 1;
    while (gap < len && track[(cyc + gap) % len] === '.') gap++;
    const stepBeats = 1 / pattern.subdiv;
    const span = this.chords.find((c) => beat >= c.start - 1e-6 && beat < c.end - 1e-6);
    const untilChange = span ? span.end - beat : gap * stepBeats;
    // valse: "um" ngắn gọn để chừa chỗ cho "pa pa"
    const durBeats = Math.min(gap * stepBeats, untilChange, style === 'waltz' ? 0.9 : 2) * 0.88;
    const changed = !!span && Math.abs(span.start - beat) < 1e-6;
    const half = Math.floor(barLen / 2);
    // valse đổi gốc / quãng 5 xen kẽ từng ô nhịp; kiểu khác dùng quãng 5 ở nửa sau ô
    const altFifth = !changed && (style === 'waltz' ? bar % 2 === 1 : style !== 'rock' && style !== 'ballad' && stepIdx >= half);
    if (line && ch === 'w') {
      const midi = walkingNote(this.chords, beat + 1e-3, this.walkPrev);
      if (midi === null) return;
      this.walkPrev = midi;
      bass(midi, t, Math.min(gap * stepBeats, 1) * 0.9 * spb, stepIdx === 0 ? 1 : 0.85);
      return;
    }
    if (line) {
      const root = bassMidi(chord);
      let midi = root;
      if (ch === 'f') midi = bassMidi(chord, true);
      else if (ch === 'o') midi = root + 12;
      else if (ch === 't') midi = root + (chord.minor ? 3 : 4);
      else if (ch === 'n') {
        // tumbao đón nhịp: gốc của hợp âm ở đầu ô kế tiếp
        const next = this.chordAt(beat - stepIdx / pattern.subdiv + pattern.beats + 1e-3);
        midi = next && next.root >= 0 ? bassMidi(next) : root;
      }
      else if (ch === 'a') {
        // nốt dẫn nửa cung từ dưới lên gốc hợp âm của phách kế tiếp
        const next = this.chordAt(beat + gap * stepBeats + 1e-3);
        midi = (next && next.root >= 0 ? bassMidi(next) : root) - 1;
      }
      bass(midi, t, Math.min(gap * stepBeats, ch === 'a' ? 9 : untilChange) * 0.88 * spb, ch === 'o' || ch === 'a' ? 0.85 : 1);
      return;
    }
    bass(bassMidi(chord, altFifth), t, durBeats * spb, ch === 'X' || stepIdx === 0 ? 1 : 0.8);
  }

  /** Một ô của điệu đệm hát (guitar gõ bo / quạt chả / piano), theo kế hoạch đệm của bài */
  private strumHit(acc: Accomp, stepIdx: number, beat: number, t0: number, spb: number) {
    const o = this.opts;
    const base = strumPattern(o.style, o.beatsPerBar);
    const subdiv = base.subdiv;
    const bar = Math.floor((beat - o.pickupBeats) / o.beatsPerBar + EPS);
    const plan = bar >= 0 ? this.plan?.bars[bar] : undefined;
    const bp = getEffectivePrefs(o.style);
    const tech = acc === 'piano' ? {} : { rake: bp.gRake, trem: bp.gTrem, shake: bp.gShake };
    const tk = `${bar}|${o.style}|${o.beatsPerBar}|${+!!tech.rake}${+!!tech.trem}${+!!tech.shake}`;
    let track = this.barTracks.get(tk);
    if (!track) { track = barTrack(plan, bar, base, tech); this.barTracks.set(tk, track); }
    const len = track.length;
    const kind = track[stepIdx] ?? '.';
    const chord = this.chordAt(beat + 1e-3);
    if (!chord || chord.root < 0) return;
    const span = this.chords.find((c) => beat >= c.start - 1e-6 && beat < c.end - 1e-6);
    // đổi hợp âm giữa ô mà điệu không có bass ở đó: đánh bass gốc của hợp âm mới
    const changed = !!span && bar >= 0 && stepIdx > 0 && Math.abs(span.start - beat) < 1e-6;
    if (kind === '.' && !changed) return;
    const gapTo = (hit: (k: string) => boolean) => {
      let g = 1;
      while (stepIdx + g < len && !hit(track![stepIdx + g])) g++;
      return g;
    };
    const step = 1 / subdiv;
    const untilChange = span ? span.end - beat : Infinity;
    const dur = Math.min(gapTo((k) => k !== '.') * step, 2, untilChange);
    const bassDur = Math.min(gapTo((k) => 'BFPQZV'.includes(k)) * step, 2, untilChange);
    setHumanVelocity(bp.humanize ? 0.1 : 0);
    const swing = subdiv !== 3 && stepIdx % 2 === 1 ? bp.swing * step * spb : 0;
    const jitter = bp.humanize ? (Math.random() - 0.5) * 0.01 : 0;
    const vel = (stepIdx % subdiv === 0 ? 1 : 0.85) * (plan?.energy ?? 1);
    const ch = { bass: bassMidi(chord), fifth: bassMidi(chord, true), minor: chord.minor, triad: chordVoicing(chord) };
    const when = t0 + swing + jitter;
    if (kind === 'P' || kind === 'Q') {
      // bass dẫn: nửa cung / một cung dưới gốc hợp âm ô sau
      const next = this.chordAt(o.pickupBeats + (bar + 1) * o.beatsPerBar + 1e-3);
      const target = next && next.root >= 0 ? bassMidi(next) : ch.bass;
      accompHit(acc, 'B', { ...ch, bass: target - (kind === 'Q' ? 2 : 1) }, when, dur * spb, dur * spb, 0.85 * vel);
      return;
    }
    if (changed && !'BFZV'.includes(kind)) {
      accompHit(acc, 'B', ch, when, dur * spb, bassDur * spb, vel);
      if (kind === '.') return;
    }
    accompHit(acc, kind, ch, when, dur * spb, bassDur * spb, vel);
  }

  private tick() {
    if (this.finished) return;
    const c = audio();
    // máy bận quá lâu, lỡ mất vài ô: dời cả nhịp ra sau một chút thay vì dồn các tiếng trễ vào cùng một lúc
    if (this.cursorTime < c.currentTime + 0.01) this.cursorTime = c.currentTime + 0.04;
    const horizon = c.currentTime + LOOKAHEAD;
    const o = this.opts;
    const acc = this.accomp();
    const style = this.beatStyle();
    const strum = acc && acc !== 'band' ? strumPattern(o.style, o.beatsPerBar) : null;
    const pattern = strum ? null : resolvePattern(style, o.beatsPerBar);
    const subdiv = strum?.subdiv ?? pattern?.subdiv ?? 2;
    const step = 1 / subdiv;
    // đổi lưới giữa chừng (bật/tắt đệm hát, đổi nhạc cụ đệm): nhích con trỏ tới ô kế tiếp của lưới mới
    const off = (this.cursorBeat - o.pickupBeats) * subdiv;
    const frac = off - Math.floor(off + EPS);
    if (frac > 1e-3) {
      const add = (1 - frac) * step;
      this.cursorBeat += add;
      this.cursorTime += add * this.spb();
    }

    while (this.cursorTime < horizon) {
      const spb = this.spb();
      const b0 = this.cursorBeat;
      const b1 = b0 + step;
      const t0 = this.cursorTime;

      if (o.melody && !acc) {
        for (const ev of this.events) {
          if (ev.start >= b1 - EPS) break;
          if (ev.start >= b0 - EPS && ev.midi !== null && ev.token) {
            playTone(ev.midi + (o.transpose ?? 0), t0 + (ev.start - b0) * spb, ev.beats * spb * 0.9);
          }
        }
      }

      const posInBar = mod(b0 - o.pickupBeats, o.beatsPerBar);
      const stepIdx = Math.round(posInBar * subdiv);
      const onGrid = Math.abs(posInBar * subdiv - stepIdx) < 1e-3;
      if (onGrid && strum && acc) this.strumHit(acc, stepIdx, b0, t0, spb);
      if (onGrid && (acc === 'band' || (!acc && o.beat)) && pattern) {
        const bp = getEffectivePrefs(style);
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
            if (bp.bass) this.bassHit(pattern, stepIdx, bar, b0, t, spb, style, true);
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
            else if (ch === 'g') fn(t, 0.3);
          };
          hit(pattern.kick, kick);
          if (bp.bass) this.bassHit(pattern, stepIdx, bar, b0, t, spb, style);
          hit(pattern.snare, snare);
          hit(pattern.hat, (t, v) => hat(t, v * accent));
          hit(pattern.openHat, (t, v) => hat(t, v, true));
          hit(pattern.rim, rim);
          hit(pattern.shaker ?? (bp.lac ? lacPattern(pattern) : undefined), (t, v) => shaker(t, v * accent));
          const boTrack = bp.bo || bp.boSlide || bp.boRoll ? boPattern(pattern) : pattern.bongo;
          // chỗ hết câu: theo kế hoạch đệm của bài (không có thì cứ 4 ô một câu)
          const pl = bar >= 0 ? this.plan?.bars[bar] : undefined;
          const phraseEnd = pl ? pl.phraseEnd : (bar + 1) % 4 === 0;
          const k = stepIdx - (o.beatsPerBar - 1) * subdiv;
          if (boTrack && bp.boRoll && phraseEnd && k >= 0) {
            // rung bo suốt phách cuối câu
            if (k === 0) bongo(t, 'r', 0.9, spb * 0.92);
          } else {
            // vuốt bo thay tiếng mở trầm ở ô thứ hai của mỗi cặp ô
            perc(boTrack, (t, ch) => bongo(t, bp.boSlide && ch === 'o' && bar % 2 === 1 ? 'v' : ch));
          }
          perc(pattern.conga, (t, ch) => conga(t, ch));
          perc(pattern.guiro, (t, ch) => guiro(t, ch === 'X'));
          hit(pattern.clave, clave);
          hit(pattern.cowbell, cowbell);
          hit(pattern.clap, clap);
          hit(pattern.ride, ride);
          hit(pattern.surdo, surdo);
          if (bp.comp || acc === 'band') {
            hit(pattern.comp, (t, v) => {
              const ch = this.chordAt(b0 + 1e-3);
              if (ch && ch.root >= 0) chordStab(chordVoicing(ch), t, Math.min(0.9, step * 1.6) * spb, v);
            });
          }
        }
      }
      const onBeat = Math.abs(posInBar - Math.round(posInBar)) < 1e-3;
      if (onBeat && (o.click || (!acc && o.beat && o.style === 'metronome'))) {
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
          // chờ tới lúc tiếng cuối thật sự ra loa (cộng độ trễ âm thanh) mới tắt đèn nốt
          const wait = Math.max(0, (this.cursorTime - heardTime(c)) * 1000) + 120;
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
