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
 * thử từng bè, từng mức lọc giọng phụ; tab khớp khi phần lớn nốt cùng vị trí và lệch cùng một số nửa cung.
 */
export function matchMidiToTab(bytes: Uint8Array, flat: FlatEvent[]): MidiLink | null {
  const file = parseMidi(midiPayload(bytes));
  const tab = new Map<number, number>();
  for (const f of flat) if (f.midi !== null) tab.set(Math.round(f.start * 1000), f.midi);
  if (tab.size < 4) return null;
  let best: (MidiLink & { score: number }) | null = null;
  for (const part of [...file.parts].sort((a, b) => +(b.id === file.melodyPart) - +(a.id === file.melodyPart))) {
    for (const backing of [2, 0, 1, 3]) {
      let tr;
      try { tr = file.transcribe(part.id, { backing }); } catch { continue; }
      if (tr.startBeat === undefined) continue;
      const diffs = new Map<number, number>();
      let at = 0, pitched = 0;
      for (const s of tr.sections) for (const l of s.lines) for (const n of l.notes) {
        const m = n.pitch.toUpperCase() === 'R' ? null : nameToMidi(n.pitch);
        if (m !== null) {
          pitched++;
          const t = tab.get(Math.round(at * 1000));
          if (t !== undefined) diffs.set(t - m, (diffs.get(t - m) ?? 0) + 1);
        }
        at += n.beats;
      }
      let shift = 0, hits = 0;
      for (const [d, c] of diffs) if (c > hits) { hits = c; shift = d; }
      const score = hits / Math.max(pitched, tab.size);
      if (!best || score > best.score) best = { melodyPart: part.id, startBeat: tr.startBeat, shift, score };
      if (score > 0.95) break;
    }
    if (best && best.score > 0.95) break;
  }
  return best && best.score >= 0.7 ? { melodyPart: best.melodyPart, startBeat: best.startBeat, shift: best.shift } : null;
}
