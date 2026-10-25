/**
 * Bản phối gốc trong file MIDI (karaoke): các bè đệm ngoài bè hát, xếp theo phách của tab
 * để bộ phát tổng hợp đánh lại bằng nhạc cụ gần nhất của app — trống kênh 10 đánh bằng bộ trống.
 */
import type { Instrument } from '../audio/engine';
import { nameToMidi } from './harp';
import { midiPayload, parseMidi, readMidi } from './musicFile';
import type { FlatEvent } from './tabText';

export type ArrVoice = Instrument | 'bass' | 'drum';

export interface ArrNote {
  /** phách trong tab (âm = đoạn dạo trước nốt hát đầu tiên) */
  beat: number;
  dur: number;
  /** cao độ đã dịch theo giọng tab (trống: số nốt GM) */
  midi: number;
  vel: number;
  voice: ArrVoice;
}

export interface ArrPart {
  id: string;
  name: string;
  /** nhạc cụ máy tự chọn theo file */
  voice: ArrVoice;
  /** nhạc cụ đang dùng (người dùng đổi), 'off' = tắt bè này */
  chosen: ArrVoice | 'off';
  notes: number;
}

/** người dùng đổi nhạc cụ / tắt từng bè (khoá = id bè) */
export type ArrVoices = Record<string, ArrVoice | 'off'>;

export interface Arrangement {
  notes: ArrNote[];
  /** phách đầu tiên có tiếng (âm nếu có dạo nhạc) / phách cuối cùng còn vang */
  start: number;
  end: number;
  parts: ArrPart[];
}

/** cách nối file MIDI với tab: bè hát, phách trong file của nốt đầu tab, tab lệch file bao nhiêu nửa cung */
export interface MidiLink { melodyPart: string; startBeat: number; shift: number }

/** dịch giọng gọn nhất cho phần đệm: tab dịch cả quãng tám thì đệm giữ nguyên, còn lại trong khoảng −6…+5 */
export const keyShift = (shift: number) => (((Math.round(shift) % 12) + 18) % 12) - 6;

/** nhạc cụ GM → nhạc cụ gần nhất của app (null = bỏ: hiệu ứng, bộ gõ không cao độ) */
export function gmVoice(prog: number): ArrVoice | null {
  const fam = prog >> 3;
  switch (fam) {
    case 0: return prog === 4 || prog === 5 ? 'epiano' : 'piano';
    case 1: return prog <= 10 ? 'musicbox' : prog === 11 ? 'vibraphone' : prog <= 13 ? 'marimba' : prog === 14 ? 'vibraphone' : 'dantranh';
    case 2: return prog === 21 || prog === 23 ? 'accordion' : prog === 22 ? 'harmonica' : 'organ';
    case 3: return 'guitar';
    case 4: return 'bass';
    case 5: return prog === 42 || prog === 43 ? 'cello' : prog === 45 || prog === 46 ? 'danhac' : prog === 47 ? null : 'violin';
    case 6: return prog >= 52 && prog <= 54 ? 'choir' : prog === 55 ? null : 'violin';
    case 7: return prog === 58 ? 'bass' : 'trumpet';
    case 8: return prog <= 67 ? 'sax' : 'clarinet';
    case 9: return prog === 76 ? 'ocarina' : prog === 78 ? 'whistle' : prog === 79 ? 'ocarina' : 'flute';
    case 10: case 11: case 12: return 'synth';
    case 13: return [
      'dannguyet', 'banjo', 'dannguyet', 'dantranh', 'kalimba', 'kenbau', 'violin', 'kenbau',
    ][prog - 104] as ArrVoice;
    case 14: return prog === 112 ? 'musicbox' : prog === 114 ? 'steeldrum' : null;
    default: return null;
  }
}

/** Các bè đệm của file (bỏ bè hát), xếp theo phách tab */
export function buildArrangement(bytes: Uint8Array, link: MidiLink, voices: ArrVoices = {}): Arrangement {
  const { tracks } = readMidi(midiPayload(bytes));
  const ks = keyShift(link.shift);
  const notes: ArrNote[] = [];
  const parts: ArrPart[] = [];
  tracks.forEach((tr, i) => {
    for (const ch of [...new Set(tr.notes.map((n) => n.ch))].sort((a, b) => a - b)) {
      const id = `${i}:${ch}`;
      if (id === link.melodyPart) continue;
      const own = tr.notes.filter((n) => n.ch === ch);
      let count = 0, first: ArrVoice | null = null;
      // trống chỉ bật / tắt được; bè khác đổi được sang nhạc cụ bất kỳ
      const pick = voices[id] === 'off' || (ch !== 9 && voices[id] && voices[id] !== 'drum') ? voices[id] : undefined;
      for (const n of own) {
        const auto = ch === 9 ? 'drum' : gmVoice(n.prog ?? 0);
        if (!auto) continue;
        first ??= auto;
        count++;
        if (pick === 'off') continue;
        const voice = pick ?? auto;
        notes.push({
          beat: n.start - link.startBeat,
          dur: Math.max(0.05, n.end - n.start),
          midi: voice === 'drum' ? n.midi : n.midi + ks,
          vel: Math.max(0.05, n.vel / 127),
          voice,
        });
      }
      if (count) parts.push({ id, name: tr.name || (ch === 9 ? 'Trống' : `Kênh ${ch + 1}`), voice: first!, chosen: pick ?? first!, notes: count });
    }
  });
  notes.sort((a, b) => a.beat - b.beat);
  let start = 0, end = 0;
  for (const n of notes) { start = Math.min(start, n.beat); end = Math.max(end, n.beat + n.dur); }
  return { notes, start: notes.length ? start : 0, end, parts };
}

/**
 * Tìm cách nối file MIDI với một tab đã có (bài nhập trước khi app biết giữ file gốc):
 * thử từng bè, từng mức lọc giọng phụ. Trước hết so khớp đúng vị trí từng nốt; bài nhập bằng bản app cũ
 * (cách làm tròn khác, vài nốt sửa tay, nốt ngoài tầm kèn thành dấu lặng) thì dò theo chuỗi cao độ.
 */
export function matchMidiToTab(bytes: Uint8Array, flat: FlatEvent[]): MidiLink | null {
  const file = parseMidi(midiPayload(bytes));
  const tabNotes = flat.filter((f) => f.midi !== null).map((f) => ({ t: f.start, m: f.midi! }));
  if (tabNotes.length < 4) return null;
  const tab = new Map(tabNotes.map((n) => [Math.round(n.t * 1000), n.m]));
  const parts = [...file.parts].sort((a, b) => +(b.id === file.melodyPart) - +(a.id === file.melodyPart));
  const tries: { part: string; backing: number }[] = [];
  for (const p of parts) for (const backing of p.id === file.melodyPart ? [2, 0, 1, 3] : [2, 0]) tries.push({ part: p.id, backing });
  const melodies = new Map<string, { t: number; m: number }[] & { startBeat?: number }>();
  const melodyOf = (k: { part: string; backing: number }) => {
    const key = `${k.part}|${k.backing}`;
    if (!melodies.has(key)) {
      let tr;
      try { tr = file.transcribe(k.part, { backing: k.backing }); } catch { tr = null; }
      const out: { t: number; m: number }[] & { startBeat?: number } = [];
      if (tr && tr.startBeat !== undefined) {
        out.startBeat = tr.startBeat;
        let at = 0;
        for (const sec of tr.sections) for (const l of sec.lines) for (const n of l.notes) {
          const m = n.pitch.toUpperCase() === 'R' ? null : nameToMidi(n.pitch);
          if (m !== null) out.push({ t: at, m });
          at += n.beats;
        }
      }
      melodies.set(key, out);
    }
    return melodies.get(key)!;
  };

  // 1) khớp đúng vị trí (bài nhập bằng bản app hiện tại)
  let best: (MidiLink & { score: number }) | null = null;
  for (const k of tries) {
    const mel = melodyOf(k);
    if (mel.startBeat === undefined) continue;
    const diffs = new Map<number, number>();
    for (const n of mel) {
      const t = tab.get(Math.round(n.t * 1000));
      if (t !== undefined) diffs.set(t - n.m, (diffs.get(t - n.m) ?? 0) + 1);
    }
    let shift = 0, hits = 0;
    for (const [d, c] of diffs) if (c > hits) { hits = c; shift = d; }
    const score = hits / Math.max(mel.length, tabNotes.length);
    if (!best || score > best.score) best = { melodyPart: k.part, startBeat: mel.startBeat, shift, score };
    if (score > 0.95) break;
  }
  if (best && best.score >= 0.7) return { melodyPart: best.melodyPart, startBeat: best.startBeat, shift: best.shift };

  // 2) dò theo chuỗi cao độ: so dãy nốt (bỏ qua quãng tám) bằng dãy con chung dài nhất,
  //    các cặp nốt khớp phải lệch thời điểm đều nhau → phách đầu tab nằm ở đâu trong file
  // (tab quá ngắn thì giai điệu bài khác cũng dễ trùng: không đoán)
  if (tabNotes.length < 16) return null;
  let alt: (MidiLink & { score: number }) | null = null;
  for (const k of tries) {
    const mel = melodyOf(k);
    if (mel.startBeat === undefined || mel.length < 4) continue;
    for (let s = 0; s < 12; s++) {
      const pairs = lcsPairs(tabNotes.map((n) => n.m % 12), mel.map((n) => (n.m + s) % 12));
      if (pairs.length < tabNotes.length * 0.7) continue;
      const d = pairs.map(([i, j]) => mel[j].t - tabNotes[i].t).sort((a, b) => a - b);
      const off = d[d.length >> 1];
      const steady = d.filter((x) => Math.abs(x - off) <= 0.26).length;
      const score = steady / tabNotes.length;
      if (!alt || score > alt.score) alt = { melodyPart: k.part, startBeat: mel.startBeat + off, shift: s, score };
    }
    if (alt && alt.score > 0.9) break;
  }
  return alt && alt.score >= 0.7 ? { melodyPart: alt.melodyPart, startBeat: alt.startBeat, shift: alt.shift } : null;
}

/** dãy con chung dài nhất của hai dãy số: các cặp chỉ số [i trong a, j trong b] khớp nhau */
function lcsPairs(a: number[], b: number[]): [number, number][] {
  const n = a.length, m = b.length, w = m + 1;
  const dp = new Uint16Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i * w + j] = a[i] === b[j] ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
  }
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { out.push([i, j]); i++; j++; }
    else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) i++;
    else j++;
  }
  return out;
}
