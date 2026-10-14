/**
 * Tự đệm hợp âm từ giai điệu: đoán tông (nếu bài không ghi), chia bài thành
 * từng ô nhịp / nửa ô nhịp rồi chọn chuỗi hợp âm hợp nhất bằng quy hoạch động.
 */
import { nameToMidi, pitchClassName } from '../lib/harp';

const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface Chord {
  /** lớp cao độ của nốt gốc (0 = C) */
  root: number;
  minor: boolean;
  name: string;
}

export interface ChordSpan { start: number; end: number; chord: Chord }

export interface Tonality { tonic: number; minor: boolean }

interface NoteLike { start: number; beats: number; midi: number | null }

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** "G", "Dm", "F#m", "Bb thứ" → tông; null nếu không đọc được */
export function parseTonality(key: string | undefined | null): Tonality | null {
  if (!key) return null;
  const m = /^\s*([A-Ga-g])([#b]?)\s*(m(?!aj)|min|thứ)?/.exec(key);
  if (!m) return null;
  const midi = nameToMidi(m[1].toUpperCase() + m[2] + '4');
  if (midi === null) return null;
  return { tonic: mod12(midi), minor: !!m[3] };
}

// hồ sơ tông Krumhansl–Kessler
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/** Đoán tông từ giai điệu (nốt dài, nốt cuối được tính nặng hơn) */
export function estimateTonality(notes: NoteLike[]): Tonality {
  const hist = new Array(12).fill(0);
  const played = notes.filter((n) => n.midi !== null);
  played.forEach((n) => { hist[mod12(n.midi!)] += n.beats; });
  const last = played[played.length - 1];
  if (last) hist[mod12(last.midi!)] += 2;
  let best: Tonality = { tonic: 0, minor: false };
  let bestR = -Infinity;
  for (let t = 0; t < 12; t++) {
    for (const minor of [false, true]) {
      const prof = minor ? MINOR_PROFILE : MAJOR_PROFILE;
      const r = hist.reduce((s, h, pc) => s + h * prof[mod12(pc - t)], 0);
      if (r > bestR + 1e-9) { bestR = r; best = { tonic: t, minor }; }
    }
  }
  return best;
}

interface Candidate { deg: number; minor: boolean; prior: number }

const MAJOR_CANDS: Candidate[] = [
  { deg: 0, minor: false, prior: 1 },
  { deg: 5, minor: false, prior: 0.8 },
  { deg: 7, minor: false, prior: 0.9 },
  { deg: 9, minor: true, prior: 0.5 },
  { deg: 2, minor: true, prior: 0.4 },
  { deg: 4, minor: true, prior: 0.15 },
];
const MINOR_CANDS: Candidate[] = [
  { deg: 0, minor: true, prior: 1 },
  { deg: 5, minor: true, prior: 0.7 },
  { deg: 7, minor: false, prior: 0.7 },
  { deg: 7, minor: true, prior: 0.35 },
  { deg: 3, minor: false, prior: 0.55 },
  { deg: 8, minor: false, prior: 0.55 },
  { deg: 10, minor: false, prior: 0.6 },
  { deg: 5, minor: false, prior: 0.3 },
];

/** Tông dùng dấu giáng (F, Bb, Eb…, Dm, Gm…) thì gọi tên hợp âm bằng giáng */
function usesFlats(key: Tonality): boolean {
  const major = key.minor ? mod12(key.tonic + 3) : key.tonic;
  return [5, 10, 3, 8, 1].includes(major);
}

export function chordName(root: number, minor: boolean, flats = false): string {
  return (flats ? FLAT_NAMES[mod12(root)] : pitchClassName(root)) + (minor ? 'm' : '');
}

/** Độ dài mỗi khúc hợp âm (phách) */
function segmentBeats(beatsPerBar: number): number {
  if (beatsPerBar === 4) return 2;
  if (beatsPerBar >= 6 && beatsPerBar % 2 === 0) return beatsPerBar / 2;
  return beatsPerBar;
}

export function harmonize(notes: NoteLike[], beatsPerBar: number, pickupBeats: number, tonality?: Tonality | null): ChordSpan[] {
  const played = notes.filter((n) => n.midi !== null);
  if (!played.length) return [];
  const end = Math.max(...notes.map((n) => n.start + n.beats));
  const key = tonality ?? estimateTonality(notes);
  const cands = (key.minor ? MINOR_CANDS : MAJOR_CANDS).map((c) => {
    const root = mod12(key.tonic + c.deg);
    return { ...c, chord: { root, minor: c.minor, name: chordName(root, c.minor, usesFlats(key)) } };
  });

  const seg = segmentBeats(beatsPerBar);
  const bounds: number[] = [0];
  for (let b = pickupBeats > 1e-6 ? pickupBeats : seg; b < end - 1e-6; b += seg) bounds.push(b);
  bounds.push(end);
  const segs = bounds.slice(0, -1).map((s, i) => ({ start: s, end: bounds[i + 1] }));

  // điểm khớp của từng hợp âm với từng khúc
  const fit = segs.map(({ start, end: e }) => {
    const w = new Array(12).fill(0);
    let total = 0;
    for (const n of played) {
      const ov = Math.min(e, n.start + n.beats) - Math.max(start, n.start);
      if (ov <= 1e-6) continue;
      const strong = Math.abs(n.start - start) < 1e-6 || Math.abs(mod(n.start - pickupBeats, beatsPerBar)) < 1e-6;
      const wt = ov * (strong ? 1.3 : 1);
      w[mod12(n.midi!)] += wt;
      total += wt;
    }
    return cands.map((c) => {
      if (total === 0) return c.prior * 0.3;
      const r = c.chord.root;
      const third = mod12(r + (c.minor ? 3 : 4));
      const fifth = mod12(r + 7);
      let s = 0;
      for (let pc = 0; pc < 12; pc++) {
        if (!w[pc]) continue;
        s += w[pc] * (pc === r || pc === third || pc === fifth ? 1 : -0.7);
      }
      return s / total + c.prior * 0.5;
    });
  });

  // quy hoạch động: hạn chế đổi hợp âm vụn vặt, nhất là giữa ô nhịp
  const n = segs.length;
  const k = cands.length;
  const score: number[][] = [fit[0].slice()];
  const from: number[][] = [new Array(k).fill(-1)];
  for (let i = 1; i < n; i++) {
    const midBar = Math.abs(mod(segs[i].start - pickupBeats, beatsPerBar)) > 1e-6;
    const change = midBar ? 0.45 : 0.12;
    score.push([]);
    from.push([]);
    for (let j = 0; j < k; j++) {
      let best = -Infinity, arg = 0;
      for (let p = 0; p < k; p++) {
        let v = score[i - 1][p] - (p === j ? 0 : change);
        if (cands[p].deg === 7 && cands[j].deg === 0) v += 0.1; // V → I
        if (v > best) { best = v; arg = p; }
      }
      score[i].push(best + fit[i][j] + (i === n - 1 && cands[j].deg === 0 ? 0.6 : 0));
      from[i].push(arg);
    }
  }
  let j = score[n - 1].indexOf(Math.max(...score[n - 1]));
  const pick: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) { pick[i] = j; j = from[i][j]; }

  // gộp các khúc liền nhau cùng hợp âm
  const out: ChordSpan[] = [];
  segs.forEach((s, i) => {
    const chord = cands[pick[i]].chord;
    const prev = out[out.length - 1];
    if (prev && prev.chord.name === chord.name) prev.end = s.end;
    else out.push({ start: s.start, end: s.end, chord });
  });
  return out;
}

function mod(a: number, n: number) {
  return ((a % n) + n) % n;
}

export function chordAt(spans: ChordSpan[], beat: number): Chord | null {
  let lo = 0, hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beat < spans[mid].start - 1e-6) hi = mid - 1;
    else if (beat >= spans[mid].end - 1e-6) lo = mid + 1;
    else return spans[mid].chord;
  }
  return null;
}

/** Nốt bass (MIDI) cho gốc hoặc quãng 5, nằm trong khoảng E2–D#3 (loa điện thoại vẫn nghe rõ) */
export function bassMidi(chord: Chord, fifth = false): number {
  const pc = mod12(chord.root + (fifth ? 7 : 0));
  return 40 + mod12(pc - 4);
}
