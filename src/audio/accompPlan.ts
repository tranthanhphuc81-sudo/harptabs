/**
 * Đệm hát linh hoạt theo từng bài: đọc giai điệu (tốc độ, độ dày nốt, nốt ngân, chỗ cao trào,
 * điệp khúc, chỗ hết câu, chỗ đổi hợp âm) rồi lập kế hoạch đệm cho từng ô nhịp.
 *
 * Kế hoạch chỉ chọn "kết cấu" của ô (rải dây, quạt, quạt thưa / dày, kết bài) và câu dồn cuối câu;
 * điệu gốc của ô vẫn lấy từ kiểu nhịp (strumPattern).
 */
import type { ChordSpan } from './harmony';
import type { StrumPattern } from './patterns';

/**
 * rest = không đệm (ô lấy đà), arp = rải dây / móc, strum = quạt theo điệu, sparse = quạt thưa
 * (giai điệu đang dày), busy = quạt dày (lấp chỗ giai điệu ngân), final = kết bằng tiếng quạt ngân
 */
export type Texture = 'rest' | 'arp' | 'strum' | 'sparse' | 'busy' | 'final';
/** câu dồn ở phách cuối ô: walk = bass dẫn vào gốc hợp âm ô sau, push = dồn quạt / gõ bo */
export type Fill = 'none' | 'walk' | 'push';

export interface BarPlan {
  texture: Texture;
  /** hệ số lực đánh 0.6…1.15 (theo độ cao giai điệu, cao trào, điệp khúc, càng về sau càng đầy) */
  energy: number;
  fill: Fill;
  /** ô này kết thúc một câu / mở một câu mới / kết bằng nốt ngân */
  phraseEnd: boolean;
  phraseStart: boolean;
  held: boolean;
  /** ô kết: ô (tính trong ô nhịp) đánh tiếng quạt ngân cuối bài */
  finalStep?: number;
}

export interface SongFeel {
  /** số nốt mỗi phách */
  density: number;
  /** tỉ lệ thời gian giai điệu nằm ở nốt ngân dài (≥ 1,5 phách) */
  sustain: number;
  /** bài chậm, nhiều nốt ngân: rải dây là chính */
  lyrical: boolean;
  /** bài nhanh, rộn ràng */
  lively: boolean;
}

export interface AccompPlan {
  /** bars[i] = ô nhịp i (ô 0 là ô đầy đủ đầu tiên sau ô lấy đà) */
  bars: BarPlan[];
  feel: SongFeel;
  /** mô tả ngắn cách đệm để hiện cho người dùng */
  summary: string;
}

export interface PlanNote { start: number; beats: number; midi: number | null; sectionIndex?: number }

export interface PlanOptions {
  bpm: number;
  beatsPerBar: number;
  pickupBeats: number;
  /** tiêu đề từng đoạn của bài (để nhận ra điệp khúc) */
  sections?: (string | undefined)[];
}

const CHORUS = /điệp khúc|diep khuc|\bđk\b|\bdk\b|chorus|refrain|\bhook\b/i;
const EPS = 1e-6;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function chordRootAt(chords: ChordSpan[], beat: number): number | null {
  const s = chords.find((c) => beat >= c.start - EPS && beat < c.end - EPS);
  return s && s.chord.root >= 0 ? s.chord.root : null;
}

export function analyzeFeel(notes: PlanNote[], bpm: number): SongFeel {
  const played = notes.filter((n) => n.midi !== null);
  const first = notes[0]?.start ?? 0;
  const last = notes[notes.length - 1];
  const span = last ? Math.max(1, last.start + last.beats - first) : 1;
  const density = played.length / span;
  const total = played.reduce((a, n) => a + n.beats, 0) || 1;
  const sustain = played.filter((n) => n.beats >= 1.5).reduce((a, n) => a + n.beats, 0) / total;
  const lyrical = bpm < 70 || (bpm < 92 && (sustain >= 0.3 || density <= 1.05));
  const lively = !lyrical && (bpm >= 115 || density >= 2.2);
  return { density, sustain, lyrical, lively };
}

export function planAccomp(notes: PlanNote[], chords: ChordSpan[], o: PlanOptions): AccompPlan {
  const bpb = Math.max(1, o.beatsPerBar);
  const feel = analyzeFeel(notes, o.bpm);
  const last = notes[notes.length - 1];
  const endBeat = last ? last.start + last.beats : 0;
  const nBars = Math.max(0, Math.ceil((endBeat - o.pickupBeats) / bpb - EPS));
  const barOf = (beat: number) => Math.floor((beat - o.pickupBeats) / bpb + EPS);
  const played = notes.filter((n) => n.midi !== null);
  const lastOnset = played[played.length - 1];

  // thống kê giai điệu từng ô
  const stats = Array.from({ length: nBars }, () => ({ onsets: 0, pitchSum: 0, maxPitch: -1, section: -1, endsHeld: false, endsRest: true }));
  for (const n of notes) {
    const b = barOf(n.start);
    if (b < 0 || b >= nBars) continue;
    const s = stats[b];
    if (s.section < 0 && n.sectionIndex !== undefined) s.section = n.sectionIndex;
    if (n.midi === null) continue;
    s.onsets++;
    s.pitchSum += n.midi;
    s.maxPitch = Math.max(s.maxPitch, n.midi);
  }
  // nốt "ngân" là nốt dài hẳn so với nốt thường gặp của bài (bài toàn nốt trắng thì phải dài hơn nữa)
  const lens = played.map((n) => n.beats).sort((a, b) => a - b);
  const typical = lens.length ? lens[Math.floor(lens.length / 2)] : 1;
  const held = Math.max(1.5, typical * 1.9);
  for (let b = 0; b < nBars; b++) {
    const barEnd = o.pickupBeats + (b + 1) * bpb;
    // nốt đang vang ở phách cuối ô
    const atEnd = notes.find((n) => n.start < barEnd - 1 + EPS && n.start + n.beats > barEnd - 1 + EPS);
    stats[b].endsRest = !atEnd || atEnd.midi === null;
    stats[b].endsHeld = !!atEnd && atEnd.midi !== null && atEnd.beats >= held - EPS;
    if (stats[b].section < 0) stats[b].section = b > 0 ? stats[b - 1].section : 0;
  }

  const pitches = played.map((n) => n.midi!);
  const lo = pitches.length ? Math.min(...pitches) : 60;
  const hi = pitches.length ? Math.max(...pitches) : 72;
  const range = Math.max(1, hi - lo);
  // cao trào: ô chứa nốt cao nhất bài (chỉ tính khi bài đủ dài và giai điệu đủ rộng)
  const climax = stats.map((s) => nBars >= 6 && range >= 7 && s.maxPitch >= hi);
  const chorus = stats.map((s) => !!o.sections?.[s.section] && CHORUS.test(o.sections[s.section]!));

  // chỗ hết câu: ô kết bằng nốt ngân / dấu nghỉ, hoặc ô cuối của một đoạn
  const phraseEnd = stats.map((s, b) => {
    if (b >= nBars - 1) return false;
    if (stats[b + 1].section !== s.section) return true;
    return s.endsHeld || (s.endsRest && s.onsets > 0);
  });
  for (let b = 1; b < nBars; b++) if (phraseEnd[b] && phraseEnd[b - 1] && stats[b + 1]?.section === stats[b].section) phraseEnd[b] = false;
  // giai điệu chạy liền không nghỉ: ngắt câu theo khung 4 ô quen thuộc
  let since = 0;
  for (let b = 0; b < nBars - 1; b++) {
    since = phraseEnd[b] ? 0 : since + 1;
    if (since >= 4 && (b + 1) % 4 === 0) { phraseEnd[b] = true; since = 0; }
  }

  // câu chứa cao trào (từ sau chỗ hết câu trước tới chỗ hết câu của nó) được quạt mạnh
  const climaxPhrase = new Array<boolean>(nBars).fill(false);
  let phraseStart = 0;
  for (let b = 0; b < nBars; b++) {
    if (phraseEnd[b] || b === nBars - 1) {
      // câu cao trào tính tối đa 4 ô quanh nốt cao nhất
      if (climax.slice(phraseStart, b + 1).some(Boolean)) for (let k = Math.max(phraseStart, b - 3); k <= b; k++) climaxPhrase[k] = true;
      phraseStart = b + 1;
    }
  }
  // mở bài nhẹ: câu đầu không tính là cao trào
  const firstEnd = phraseEnd.indexOf(true);
  if (firstEnd >= 0 && firstEnd < nBars - 1) for (let k = 0; k <= firstEnd; k++) climaxPhrase[k] = false;

  const finalBar = lastOnset ? barOf(lastOnset.start) : nBars - 1;
  const bars: BarPlan[] = stats.map((s, b) => {
    const avg = s.onsets ? s.pitchSum / s.onsets : lo;
    const progress = nBars > 1 ? b / (nBars - 1) : 0;
    let energy = 0.82 + 0.16 * ((avg - lo) / range) + 0.06 * progress;
    if (climaxPhrase[b]) energy += 0.08;
    if (chorus[b]) energy += 0.08;

    let texture: Texture;
    if (feel.lyrical) texture = chorus[b] || climaxPhrase[b] ? 'strum' : 'arp';
    else texture = 'strum';
    if (texture === 'strum') {
      const ratio = s.onsets / bpb / Math.max(0.25, feel.density);
      if (s.onsets / bpb >= 2 && ratio >= 1.5) texture = 'sparse';
      else if (s.onsets <= 1 && !s.endsRest) texture = 'busy';
    }
    if (texture === 'arp') energy *= 0.92;

    let fill: Fill = 'none';
    if (phraseEnd[b]) {
      const barEnd = o.pickupBeats + (b + 1) * bpb;
      const here = chordRootAt(chords, barEnd - 0.5);
      const next = chordRootAt(chords, barEnd + EPS);
      if (next !== null && here !== null && next !== here) fill = 'walk';
      else if (texture !== 'arp') fill = 'push';
    }

    const plan: BarPlan = {
      texture, energy: clamp(energy, 0.6, 1.15), fill,
      phraseEnd: phraseEnd[b], phraseStart: b > 0 && phraseEnd[b - 1], held: s.endsHeld,
    };
    if (b === finalBar && lastOnset) {
      plan.texture = 'final';
      plan.fill = 'none';
      plan.finalStep = Math.max(0, lastOnset.start - (o.pickupBeats + b * bpb));
    }
    return plan;
  });

  return { bars, feel, summary: describe(bars, feel) };
}

function describe(bars: BarPlan[], feel: SongFeel): string {
  const n = (t: Texture) => bars.filter((b) => b.texture === t).length;
  const fills = bars.filter((b) => b.fill !== 'none').length;
  const parts: string[] = [];
  if (feel.lyrical) {
    parts.push('Bài chậm, nhiều nốt ngân: rải dây là chính');
    const s = n('strum') + n('sparse') + n('busy');
    if (s) parts.push(`quạt mạnh ở ${s} ô cao trào / điệp khúc`);
  } else {
    parts.push(feel.lively ? 'Bài nhanh, rộn ràng: quạt theo điệu' : 'Quạt theo điệu');
    if (n('sparse')) parts.push(`thưa lại ở ${n('sparse')} ô giai điệu dày`);
    if (n('busy')) parts.push(`quạt dày lấp ${n('busy')} chỗ ngân`);
  }
  if (fills) parts.push(`dồn / bass dẫn ở ${fills} chỗ hết câu`);
  if (bars.some((b) => b.texture === 'final')) parts.push('kết bằng tiếng quạt ngân');
  return parts.join(', ') + '.';
}

/** Rải dây theo số phách × độ chia: bass đầu ô (quãng 5 ở nửa sau ô 4 phách), các dây cao đi lên rồi xuống */
export function arpTrack(beats: number, subdiv: number): string {
  const len = beats * subdiv;
  const step = subdiv === 4 ? 2 : 1; // nhịp chia 16: rải theo móc đơn
  const cycle = ['3', '4', '5', '4'];
  const out: string[] = new Array(len).fill('.');
  let k = 0;
  for (let i = step; i < len; i += step) out[i] = cycle[k++ % cycle.length];
  out[0] = 'B';
  if (beats === 4) out[2 * subdiv] = 'F';
  return out.join('');
}

/** Kỹ thuật tay guitar bật thêm khi đệm hát */
export interface GuitarTech {
  /** vuốt dây: quạt thật chậm ở đầu câu mới */
  rake?: boolean;
  /** rung dây: quạt rung ở phách cuối ô có nốt ngân */
  trem?: boolean;
  /** lắc cổ tay: "rrà" thay câu dồn ở chỗ hết câu */
  shake?: boolean;
}

/** Điệu của một ô theo kế hoạch: kết cấu + câu dồn ở phách cuối + kỹ thuật tay (nếu bật) */
export function barTrack(plan: BarPlan | undefined, bar: number, base: StrumPattern, tech: GuitarTech = {}): string {
  const len = base.beats * base.subdiv;
  const sub = base.subdiv;
  const slice = (() => {
    const s = base.strum;
    const off = s.length > len ? (Math.max(0, bar) % Math.round(s.length / len)) * len : 0;
    return s.slice(off, off + len);
  })();
  if (bar < 0 || plan?.texture === 'rest') return '.'.repeat(len);
  if (!plan) return slice;
  let t: string[];
  switch (plan.texture) {
    case 'arp': t = arpTrack(base.beats, sub).split(''); break;
    case 'sparse': t = slice.replace(/[Ud]/g, '.').split(''); break;
    case 'busy': {
      // lấp các nửa phách trống bằng quạt lên
      const half = Math.max(1, sub / 2);
      t = slice.split('').map((c, i) => (c === '.' && i % half === 0 && i % sub !== 0 ? 'U' : c));
      break;
    }
    case 'final': {
      t = slice.split('');
      const at = Math.min(len - 1, Math.round((plan.finalStep ?? 0) * sub));
      for (let i = at; i < len; i++) t[i] = '.';
      t[at] = 'Z';
      return t.join('');
    }
    default: t = slice.split('');
  }
  const from = len - sub;
  const lastBeat = (first: string) => { t[from] = first; for (let i = 1; i < sub; i++) t[from + i] = '.'; };
  if (tech.rake && plan.phraseStart) t[0] = 'V';
  if (plan.fill === 'push' && tech.shake && base.beats >= 2) { lastBeat('L'); return t.join(''); }
  if (plan.fill !== 'walk' && tech.trem && plan.held && base.beats >= 2) { lastBeat('R'); return t.join(''); }
  // phách cuối dành cho bass dẫn: rung (nốt ngân) hoặc lắc đánh ở phách ngay trước
  if (plan.fill === 'walk' && base.beats >= 3 && ((tech.trem && plan.held) || tech.shake)) {
    const pre = from - sub;
    t[pre] = tech.trem && plan.held ? 'R' : 'L';
    for (let i = 1; i < sub; i++) t[pre + i] = '.';
  }
  if (plan.fill !== 'none' && base.beats >= 2) {
    const fill = plan.fill === 'walk'
      ? (sub === 1 ? ['P'] : sub === 2 ? ['Q', 'P'] : sub === 3 ? ['Q', '.', 'P'] : ['Q', '.', 'P', '.'])
      : (sub === 1 ? ['X'] : sub === 2 ? ['X', 'X'] : sub === 3 ? ['X', 'U', 'X'] : ['X', 'U', 'X', 'U']);
    for (let i = 0; i < sub; i++) t[from + i] = fill[i];
  }
  return t.join('');
}
