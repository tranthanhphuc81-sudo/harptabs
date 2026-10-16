/**
 * Nhập file nhạc dạng dữ liệu — MusicXML (.musicxml, .xml, .mxl) và MIDI (.mid, .midi, .kar) — thành
 * cấu trúc dùng chung với AI / máy quét (AiTranscription) → dùng lại bộ chuyển tab có sẵn.
 * File đã ghi sẵn từng nốt và trường độ nên không phải đoán như đọc ảnh.
 * Không phụ thuộc DOM (tự đọc XML, tự giải nén zip) → chạy được cả trong test Node.
 */
import type { AiNote, AiTranscription } from '../../shared/ai';

// ───────────────────────── XML tối giản ─────────────────────────

export interface XmlEl { name: string; attrs: Record<string, string>; children: XmlEl[]; text: string }

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);

/** Đọc XML (đủ cho MusicXML): phần tử, thuộc tính, chữ; bỏ chú thích, khai báo, DOCTYPE */
export function parseXml(src: string): XmlEl {
  const root: XmlEl = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { if (stack.length > 1) stack.pop(); }
    else if (m[3]) {
      const attrs: Record<string, string> = {};
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = decode(a[2] ?? a[3] ?? '');
      const el: XmlEl = { name: m[3], attrs, children: [], text: '' };
      top.children.push(el);
      if (!m[5]) stack.push(el);
    } else if (m[6]) top.text += decode(m[6]);
  }
  return root;
}

const kids = (e: XmlEl | undefined, name: string) => (e ? e.children.filter((c) => c.name === name) : []);
const kid = (e: XmlEl | undefined, name: string) => e?.children.find((c) => c.name === name);
const txt = (e: XmlEl | undefined) => (e ? e.text.trim() : '');
const path = (e: XmlEl | undefined, ...names: string[]) => names.reduce<XmlEl | undefined>((x, n) => kid(x, n), e);

// ───────────────────────── zip (.mxl) ─────────────────────────

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([data.slice()]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Giải nén zip (chỉ kiểu lưu thẳng / deflate — đủ cho .mxl) */
export async function unzip(buf: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('File nén hỏng hoặc không phải .mxl');
  const n = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  const dec = new TextDecoder();
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + size);
    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, await inflateRaw(raw));
    p += 46 + nameLen + extra + comment;
  }
  return files;
}

// ───────────────────────── dùng chung ─────────────────────────

const LETTERS = 'CDEFGAB';
const STEP_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_KEYS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const MINOR_KEYS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'];
const keyFromFifths = (fifths: number, minor: boolean) => {
  const k = (minor ? MINOR_KEYS : MAJOR_KEYS)[Math.max(-7, Math.min(7, fifths)) + 7];
  return k ? (minor ? `${k}m` : k) : undefined;
};

/** Tên nốt theo số MIDI, viết theo hoá biểu (giọng giáng thì dùng b) */
export function midiName(midi: number, preferFlats = false): string {
  const names = preferFlats ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Một nốt giai điệu đã xếp theo thời gian (phách đen tính từ đầu bài) */
interface MelNote { start: number; beats: number; midi: number | null; lyric?: string; tieNext?: boolean }

/** Bè / track để người dùng chọn khi file có nhiều bè */
export interface MusicPart { id: string; name: string; notes: number; low: number; high: number }

export interface MusicFile {
  kind: 'musicxml' | 'midi';
  title: string;
  artist?: string;
  parts: MusicPart[];
  /** bè đoán là giai điệu chính */
  melodyPart: string;
  /** cấu trúc chuyển tab của một bè */
  transcribe(partId: string): AiTranscription;
}

/** Gộp nốt luyến cùng cao độ, chèn dấu lặng vào chỗ trống, chia dòng theo ô nhịp */
function toTranscription(
  notes: MelNote[], o: { title: string; artist?: string; songKey?: string; flats?: boolean; tempo?: number; timeSig: string; barBeats: number; pickupBeats: number; lineBreaks?: number[]; warnings?: string[] },
): AiTranscription {
  const out: MelNote[] = [];
  let t = notes.length ? notes[0].start : 0;
  for (const n of notes) {
    const gap = Math.round((n.start - t) * 1000) / 1000;
    if (gap > 0.01) out.push({ start: t, beats: gap, midi: null });
    const prev = out[out.length - 1];
    if (prev && prev.tieNext && prev.midi === n.midi && n.midi !== null && Math.abs(prev.start + prev.beats - n.start) < 0.01) {
      prev.beats += n.beats;
      prev.tieNext = n.tieNext;
    } else out.push({ ...n });
    t = Math.max(t, n.start + n.beats);
  }
  // chia dòng: theo chỗ xuống dòng của bản gốc (nếu có), không thì 4 ô nhịp một dòng
  const t0 = out.length ? out[0].start : 0;
  const barOf = (start: number) => Math.floor((start - t0 + (o.barBeats - o.pickupBeats) % o.barBeats + 1e-6) / o.barBeats);
  const breaks = new Set(o.lineBreaks ?? []);
  const lines: { notes: AiNote[] }[] = [];
  let cur: AiNote[] = [], curBar = -1, barsInLine = 0;
  for (const n of out) {
    const bar = barOf(n.start);
    if (bar !== curBar) {
      if (curBar >= 0) barsInLine += bar - curBar;
      const brk = o.lineBreaks?.length ? breaks.has(bar) : barsInLine >= 4;
      if (cur.length && brk && n.midi !== null) { lines.push({ notes: cur }); cur = []; barsInLine = 0; }
      curBar = bar;
    }
    cur.push({ pitch: n.midi === null ? 'R' : midiName(n.midi, !!o.flats), beats: Math.round(n.beats * 10000) / 10000, lyric: n.lyric ?? '' });
  }
  if (cur.length) lines.push({ notes: cur });
  return {
    title: o.title || 'Bài nhập từ file',
    artist: o.artist,
    songKey: o.songKey,
    tempo: o.tempo ? Math.round(o.tempo) : undefined,
    timeSignature: o.timeSig,
    pickupBeats: o.pickupBeats,
    confidence: 1,
    warnings: o.warnings ?? [],
    sections: [{ name: 'Đoạn 1', lines }],
  };
}

// ───────────────────────── MusicXML ─────────────────────────

/** Thứ tự chơi các ô nhịp: mở dấu lặp (‖: :‖), khung "1." "2." */
function playOrder(measures: XmlEl[]): number[] {
  const order: number[] = [];
  let i = 0, startRep = 0, pass = 1, guard = 0;
  const repeatsDone = new Set<number>();
  while (i < measures.length && guard++ < 4000) {
    const m = measures[i];
    const bars = kids(m, 'barline');
    if (bars.some((b) => kid(b, 'repeat')?.attrs.direction === 'forward') && !repeatsDone.has(i) && pass === 1) startRep = i;
    // khung "1.", "2.": bỏ ô không thuộc lượt đang chơi
    const ending = bars.map((b) => kid(b, 'ending')).find((e) => e && e.attrs.type === 'start');
    const endingNums = ending ? (ending.attrs.number ?? '1').split(/[\s,]+/).map(Number) : null;
    if (endingNums && !endingNums.includes(pass)) {
      // nhảy qua cả khung
      let j = i;
      while (j < measures.length && !kids(measures[j], 'barline').some((b) => { const e = kid(b, 'ending'); return e && (e.attrs.type === 'stop' || e.attrs.type === 'discontinue'); })) j++;
      i = j + 1;
      continue;
    }
    order.push(i);
    const back = bars.find((b) => kid(b, 'repeat')?.attrs.direction === 'backward');
    if (back) {
      const times = Number(kid(back, 'repeat')?.attrs.times ?? 2);
      if (pass < times && !repeatsDone.has(i)) { pass++; i = startRep; continue; }
      repeatsDone.add(i);
      pass = 1;
      startRep = i + 1;
    }
    i++;
  }
  return order;
}

function parseMusicXmlDoc(doc: XmlEl, fileTitle: string): MusicFile {
  const score = doc.children.find((c) => c.name === 'score-partwise');
  if (!score) {
    if (doc.children.some((c) => c.name === 'score-timewise')) throw new Error('File MusicXML dạng "timewise" chưa hỗ trợ — xuất lại dạng thường (partwise) từ MuseScore.');
    throw new Error('Không phải file MusicXML');
  }
  const credits = kids(score, 'credit');
  const creditOf = (type: string) => txt(kid(credits.find((c) => kids(c, 'credit-type').some((t) => txt(t) === type)), 'credit-words'));
  const title = txt(path(score, 'work', 'work-title')) || txt(kid(score, 'movement-title')) || creditOf('title') || fileTitle;
  const creators = kids(kid(score, 'identification'), 'creator');
  const composer = txt(creators.find((c) => c.attrs.type === 'composer')) || creditOf('composer');
  const lyricist = txt(creators.find((c) => c.attrs.type === 'lyricist'));
  const artist = [composer, lyricist && lyricist !== composer ? lyricist : ''].filter(Boolean).join(' & ') || undefined;
  const names = new Map(kids(kid(score, 'part-list'), 'score-part').map((p) => [p.attrs.id, txt(kid(p, 'part-name')) || p.attrs.id]));

  type Raw = { start: number; beats: number; midi: number | null; lyric?: string; tieStart: boolean; tieStop: boolean; voice: string; staff: string; chord: boolean };
  const parsed = kids(score, 'part').map((part) => {
    const measures = kids(part, 'measure');
    let divisions = 1, fifths = 0, minor = false, beats = 4, beatType = 4, tempo: number | undefined;
    let t = 0, pickup = 0;
    const raws: Raw[] = [];
    const lineBreaks: number[] = [];
    let barIndex = 0;
    for (const mi of playOrder(measures)) {
      const m = measures[mi];
      let cursor = t, maxT = t, lastStart = t;
      if (barIndex > 0 && kids(m, 'print').some((p) => p.attrs['new-system'] === 'yes' || p.attrs['new-page'] === 'yes')) lineBreaks.push(barIndex);
      for (const el of m.children) {
        if (el.name === 'attributes') {
          divisions = Number(txt(kid(el, 'divisions'))) || divisions;
          const key = kid(el, 'key');
          if (key && kid(key, 'fifths')) { fifths = Number(txt(kid(key, 'fifths'))); minor = txt(kid(key, 'mode')) === 'minor'; }
          const time = kid(el, 'time');
          if (time && kid(time, 'beats')) { beats = Number(txt(kid(time, 'beats'))) || 4; beatType = Number(txt(kid(time, 'beat-type'))) || 4; }
        } else if (el.name === 'direction' || el.name === 'sound') {
          const snd = el.name === 'sound' ? el : kid(el, 'sound');
          const metro = path(el, 'direction-type', 'metronome', 'per-minute');
          const tp = Number(snd?.attrs.tempo) || Number(txt(metro));
          if (tp > 0 && tempo === undefined) tempo = tp;
        } else if (el.name === 'backup') cursor -= Number(txt(kid(el, 'duration'))) / divisions;
        else if (el.name === 'forward') cursor += Number(txt(kid(el, 'duration'))) / divisions;
        else if (el.name === 'note') {
          if (kid(el, 'grace') || kid(el, 'cue')) continue;
          const dur = Number(txt(kid(el, 'duration'))) / divisions || 0;
          const chord = !!kid(el, 'chord');
          const start = chord ? lastStart : cursor;
          const pitch = kid(el, 'pitch');
          let midi: number | null = null;
          if (pitch && !kid(el, 'rest')) {
            const step = LETTERS.indexOf(txt(kid(pitch, 'step')).toUpperCase());
            midi = (Number(txt(kid(pitch, 'octave'))) + 1) * 12 + STEP_PC[Math.max(0, step)] + Math.round(Number(txt(kid(pitch, 'alter')) || 0));
          }
          const ties = [...kids(el, 'tie'), ...kids(kid(el, 'notations'), 'tied')].map((x) => x.attrs.type);
          const lyr = kids(el, 'lyric').sort((a, b) => Number(a.attrs.number ?? 1) - Number(b.attrs.number ?? 1))[0];
          let lyric: string | undefined;
          if (lyr) {
            const text = kids(lyr, 'text').map(txt).join('');
            const syl = txt(kid(lyr, 'syllabic'));
            lyric = text ? text + (syl === 'begin' || syl === 'middle' ? '-' : '') : kid(lyr, 'extend') ? '_' : undefined;
          }
          raws.push({ start, beats: dur, midi, lyric, tieStart: ties.includes('start'), tieStop: ties.includes('stop'), voice: txt(kid(el, 'voice')) || '1', staff: txt(kid(el, 'staff')) || '1', chord });
          if (!chord) { lastStart = cursor; cursor += dur; }
        }
        maxT = Math.max(maxT, cursor);
      }
      const barLen = (beats * 4) / beatType;
      const len = maxT - t;
      if (barIndex === 0 && (m.attrs.implicit === 'yes' || len < barLen - 0.01) && len > 0) pickup = len;
      t += m.attrs.implicit === 'yes' || (barIndex === 0 && pickup) ? len : Math.max(len, barLen);
      barIndex++;
    }
    return { raws, fifths, minor, beats, beatType, tempo, pickup, lineBreaks, id: part.attrs.id };
  });

  // giai điệu của một bè: khuông 1, bè (voice) nhiều nốt nhất; hợp âm lấy nốt cao nhất
  const melodyOf = (p: (typeof parsed)[number]) => {
    const staff1 = p.raws.filter((r) => r.staff === '1');
    const count = new Map<string, number>();
    for (const r of staff1) if (r.midi !== null) count.set(r.voice, (count.get(r.voice) ?? 0) + 1);
    const voice = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '1';
    const sel = staff1.filter((r) => r.voice === voice);
    const notes: MelNote[] = [];
    for (const r of sel) {
      const prev = notes[notes.length - 1];
      if (r.chord && prev && Math.abs(prev.start - r.start) < 1e-6) {
        if (r.midi !== null && (prev.midi === null || r.midi > prev.midi)) { prev.midi = r.midi; prev.tieNext = r.tieStart; }
        if (!prev.lyric && r.lyric) prev.lyric = r.lyric;
        continue;
      }
      if (r.midi === null) continue; // dấu lặng: để toTranscription tự chèn theo khoảng trống
      notes.push({ start: r.start, beats: r.beats, midi: r.midi, lyric: r.lyric, tieNext: r.tieStart });
    }
    return notes;
  };

  const parts: MusicPart[] = parsed.map((p) => {
    const ns = melodyOf(p).map((n) => n.midi!).filter((v) => v !== null);
    return { id: p.id, name: names.get(p.id) ?? p.id, notes: ns.length, low: Math.min(...ns), high: Math.max(...ns) };
  }).filter((p) => p.notes > 0);
  if (!parts.length) throw new Error('File không có nốt nào');
  // bè giai điệu: tên gợi ý (giọng hát, melody…) hoặc bè đầu tiên có nốt
  const melodyPart = parts.find((p) => /voice|vocal|voc|sing|melod|lead|soprano|giọng|hát|giai điệu/i.test(p.name))?.id ?? parts[0].id;

  return {
    kind: 'musicxml', title, artist, parts, melodyPart,
    transcribe(partId) {
      const p = parsed.find((x) => x.id === partId) ?? parsed[0];
      const barBeats = (p.beats * 4) / p.beatType;
      return toTranscription(melodyOf(p), {
        title, artist, songKey: keyFromFifths(p.fifths, p.minor), flats: p.fifths < 0, tempo: p.tempo,
        timeSig: `${p.beats}/${p.beatType}`, barBeats, pickupBeats: p.pickup, lineBreaks: p.lineBreaks,
      });
    },
  };
}

export function parseMusicXml(text: string, fileTitle = ''): MusicFile {
  return parseMusicXmlDoc(parseXml(text), fileTitle);
}

// ───────────────────────── MIDI ─────────────────────────

interface MidiNote { start: number; end: number; midi: number; ch: number }
interface MidiTrack { name: string; notes: MidiNote[]; lyrics: { t: number; text: string }[] }

/** Đọc file MIDI chuẩn: các track (nốt, lời), nhịp độ, số chỉ nhịp, hoá biểu */
function readMidi(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const str = (p: number, n: number) => String.fromCharCode(...buf.subarray(p, p + n));
  if (str(0, 4) !== 'MThd') throw new Error('Không phải file MIDI');
  const ntrk = dv.getUint16(10), div = dv.getUint16(12);
  if (div & 0x8000) throw new Error('File MIDI dạng SMPTE chưa hỗ trợ');
  const tpq = div;
  let p = 8 + dv.getUint32(4);
  let tempo: number | undefined, timeSig: [number, number] | undefined, key: [number, boolean] | undefined, seqName = '';
  const tracks: MidiTrack[] = [];
  const dec = new TextDecoder('utf-8');
  const textOf = (bytes: Uint8Array) => {
    // lời karaoke cũ hay là Latin-1; UTF-8 sai thì đọc lại kiểu Latin-1
    const s = dec.decode(bytes);
    return s.includes('�') ? String.fromCharCode(...bytes) : s;
  };
  for (let ti = 0; ti < ntrk && p + 8 <= buf.length; ti++) {
    if (str(p, 4) !== 'MTrk') break;
    const end = p + 8 + dv.getUint32(p + 4);
    let q = p + 8, tick = 0, status = 0;
    const tr: MidiTrack = { name: '', notes: [], lyrics: [] };
    const on = new Map<number, number>(); // (kênh*128+nốt) → tick bắt đầu
    const vlq = () => { let v = 0, b: number; do { b = buf[q++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80 && q < end); return v; };
    while (q < end) {
      tick += vlq();
      let st = buf[q];
      if (st & 0x80) q++; else st = status; // running status
      if (st === 0xff) {
        const type = buf[q++], len = vlq(), data = buf.subarray(q, q + len);
        q += len;
        if (type === 0x51 && tempo === undefined) tempo = 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]);
        else if (type === 0x58 && !timeSig) timeSig = [data[0], 2 ** data[1]];
        else if (type === 0x59 && !key) key = [(data[0] << 24) >> 24, data[1] === 1];
        else if (type === 0x03) { tr.name = textOf(data).trim(); if (ti === 0 && !seqName) seqName = tr.name; }
        else if (type === 0x05 || (type === 0x01 && tick > 0)) tr.lyrics.push({ t: tick / tpq, text: textOf(data) });
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { q += vlq(); continue; }
      status = st;
      const kind = st & 0xf0, ch = st & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) { q += 1; continue; }
      const a = buf[q], b = buf[q + 1];
      q += 2;
      if (kind === 0x90 && b > 0) on.set(ch * 128 + a, tick);
      else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
        const s = on.get(ch * 128 + a);
        if (s !== undefined) { tr.notes.push({ start: s / tpq, end: tick / tpq, midi: a, ch }); on.delete(ch * 128 + a); }
      }
    }
    tracks.push(tr);
    p = end;
  }
  return { tracks, tempo, timeSig, key, seqName };
}

/** Lượng tử hoá vị trí theo lưới móc kép (1/4 phách) hoặc móc đơn liên ba (1/3 phách), chọn lưới gần hơn */
const quant = (t: number) => {
  const q4 = Math.round(t * 4) / 4, q3 = Math.round(t * 3) / 3;
  return Math.abs(q3 - t) + 0.02 < Math.abs(q4 - t) ? q3 : q4;
};

export function parseMidi(buf: Uint8Array, fileTitle = ''): MusicFile {
  const { tracks, tempo, timeSig, key, seqName } = readMidi(buf);
  // file định dạng 0 (một track nhiều kênh) → tách theo kênh; bỏ kênh trống (kênh 10)
  const groups: { id: string; name: string; notes: MidiNote[]; lyrics: MidiTrack['lyrics'] }[] = [];
  tracks.forEach((tr, i) => {
    const chs = [...new Set(tr.notes.map((n) => n.ch))].filter((c) => c !== 9);
    for (const c of chs) {
      groups.push({ id: `${i}:${c}`, name: tr.name || `Track ${i + 1}${chs.length > 1 ? ` kênh ${c + 1}` : ''}`, notes: tr.notes.filter((n) => n.ch === c), lyrics: tr.lyrics });
    }
  });
  const allLyrics = tracks.flatMap((t) => t.lyrics);
  if (!groups.length) throw new Error('File MIDI không có nốt nào');

  /** Giai điệu một bè: tại mỗi thời điểm lấy nốt cao nhất đang kêu (bè chính thường ở trên) */
  const melodyOf = (notes: MidiNote[]) => {
    const ns = [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi);
    const out: MidiNote[] = [];
    for (const n of ns) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(prev.start - n.start) < 0.05) continue; // cùng lúc: đã lấy nốt cao hơn
      if (prev && prev.end > n.start) {
        if (n.midi < prev.midi && n.end <= prev.end) continue; // nốt thấp nằm gọn trong nốt dài phía trên
        prev.end = n.start;
      }
      out.push({ ...n });
    }
    return out;
  };
  const parts: MusicPart[] = groups.map((g) => {
    const m = melodyOf(g.notes);
    return { id: g.id, name: g.name, notes: m.length, low: Math.min(...m.map((n) => n.midi)), high: Math.max(...m.map((n) => n.midi)) };
  });
  // bè giai điệu: tên gợi ý → bè có lời → bè nhiều nốt, ít hợp âm, tầm cao
  const scoreOf = (g: (typeof groups)[number]) => {
    const m = melodyOf(g.notes);
    if (m.length < 8) return -Infinity;
    const avg = m.reduce((t, n) => t + n.midi, 0) / m.length;
    const poly = 1 - m.length / g.notes.length;
    const named = /voice|vocal|voc|sing|melod|lead|giọng|hát|giai điệu|solo/i.test(g.name) ? 40 : 0;
    return named + (g.lyrics.length ? 25 : 0) + avg - 30 * poly + Math.min(20, m.length / 10);
  };
  const melodyPart = [...groups].sort((a, b) => scoreOf(b) - scoreOf(a))[0].id;

  const [num, den] = timeSig ?? [4, 4];
  const barBeats = (num * 4) / den;
  const title = (seqName && !/^(untitled|track\s*\d*|sequence|seq-?\d*)$/i.test(seqName) ? seqName : '') || fileTitle;
  const songKey = key ? keyFromFifths(key[0], key[1]) : undefined;
  return {
    kind: 'midi', title, parts, melodyPart,
    transcribe(partId) {
      const g = groups.find((x) => x.id === partId) ?? groups[0];
      const mel = melodyOf(g.notes).filter((n) => n.end - n.start > 0.05);
      // lượng tử hoá; nốt bị cắt còn quá ngắn thì bỏ
      const notes: MelNote[] = [];
      mel.forEach((n, i) => {
        const s = quant(n.start), next = mel[i + 1] ? quant(mel[i + 1].start) : Infinity;
        let e = Math.min(quant(n.end), next);
        if (e - s < 0.2 && next - s >= 0.25) e = Math.min(next, s + 0.25);
        if (e - s < 0.1) return;
        notes.push({ start: s, beats: e - s, midi: n.midi });
      });
      // lời: gắn vào nốt bắt đầu gần nhất
      const lyrics = g.lyrics.length ? g.lyrics : allLyrics;
      for (const l of lyrics) {
        const text = l.text.replace(/^[/\\@]+/, '').replace(/[\r\n]+/g, ' ').trim();
        if (!text || text.startsWith('@')) continue;
        const n = notes.reduce<MelNote | null>((best, x) => (Math.abs(x.start - l.t) < 0.3 && (!best || Math.abs(x.start - l.t) < Math.abs(best.start - l.t)) ? x : best), null);
        if (n && !n.lyric) n.lyric = text.endsWith('-') ? text : text.replace(/\s+$/, '');
      }
      // ô nhịp lấy đà: bỏ các ô trống đầu bài, phần dư là nhịp lấy đà
      const t0 = notes.length ? notes[0].start : 0;
      const off = Math.round((t0 % barBeats) * 1000) / 1000;
      const pickup = off > 0.01 ? Math.round((barBeats - off) * 1000) / 1000 : 0;
      return toTranscription(notes, { title, songKey, flats: !!key && key[0] < 0, tempo, timeSig: `${num}/${den}`, barBeats, pickupBeats: pickup });
    },
  };
}

// ───────────────────────── vào ─────────────────────────

/** Đọc file nhạc theo nội dung (không tin đuôi file) */
export async function readMusicFile(bytes: Uint8Array, fileName = ''): Promise<MusicFile> {
  const fileTitle = fileName.replace(/\.[a-z0-9]{2,8}$/i, '').replace(/[_]+/g, ' ').trim();
  const head = String.fromCharCode(...bytes.subarray(0, 4));
  if (head === 'MThd') return parseMidi(bytes, fileTitle);
  if (head === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'RMID') {
    const i = bytes.findIndex((_, k) => bytes[k] === 0x4d && bytes[k + 1] === 0x54 && bytes[k + 2] === 0x68 && bytes[k + 3] === 0x64);
    if (i > 0) return parseMidi(bytes.subarray(i), fileTitle);
  }
  if (head.startsWith('PK')) {
    const files = await unzip(bytes);
    const container = files.get('META-INF/container.xml');
    const dec = new TextDecoder();
    let rootPath = container ? parseXml(dec.decode(container)).children[0]?.children.find((c) => c.name === 'rootfiles')?.children[0]?.attrs['full-path'] : undefined;
    if (!rootPath || !files.has(rootPath)) rootPath = [...files.keys()].find((k) => !k.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(k));
    if (!rootPath) throw new Error('Trong file .mxl không có bản nhạc');
    return parseMusicXml(dec.decode(files.get(rootPath)!), fileTitle);
  }
  const text = new TextDecoder().decode(bytes);
  if (/<score-(partwise|timewise)/.test(text)) return parseMusicXml(text, fileTitle);
  throw new Error('Chưa đọc được loại file này. Hãy dùng MusicXML (.musicxml, .mxl) hoặc MIDI (.mid).');
}
