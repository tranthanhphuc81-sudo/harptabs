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
export interface MelNote { start: number; beats: number; midi: number | null; lyric?: string; tieNext?: boolean; /** lời karaoke xuống dòng trước nốt này */ lineStart?: boolean }

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
  /** backing (chỉ MIDI): mức lọc giọng phụ 0 (tắt) … 3 (mạnh), mặc định 2 */
  transcribe(partId: string, opts?: { backing?: number }): AiTranscription;
}

/** Gộp nốt luyến cùng cao độ, chèn dấu lặng vào chỗ trống, chia dòng theo ô nhịp */
export function toTranscription(
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
  // chia dòng: theo chỗ xuống dòng của bản gốc (nếu có), theo câu lời karaoke ("/" "\"), không thì 4 ô nhịp một dòng
  const t0 = out.length ? out[0].start : 0;
  const barOf = (start: number) => Math.floor((start - t0 + (o.barBeats - o.pickupBeats) % o.barBeats + 1e-6) / o.barBeats);
  const breaks = new Set(o.lineBreaks ?? []);
  const lyricBreaks = !o.lineBreaks?.length && out.filter((n) => n.lineStart).length >= 2;
  // nốt nằm trong một câu lời: từ nốt mở câu tới chữ cuối trước câu sau — đoạn dạo / gian tấu ngoài câu vẫn chia 4 ô nhịp
  const inLine = new Array<boolean>(out.length).fill(false);
  if (lyricBreaks) {
    let open = out.findIndex((n) => n.lyric);
    const close = (end: number) => {
      if (open < 0) return;
      let last = -1;
      for (let i = open; i < end; i++) if (out[i].lyric) last = i;
      // chữ cuối ngân luyến qua vài nốt liền (chưa có dấu lặng) vẫn thuộc câu
      while (last >= 0 && last + 1 < end && out[last + 1].midi !== null) last++;
      for (let i = open; i <= last; i++) inLine[i] = true;
    };
    out.forEach((n, i) => { if (n.lineStart && i > open) { close(i); open = i; } });
    close(out.length);
  }
  const lines: { notes: AiNote[] }[] = [];
  let cur: AiNote[] = [], curBar = -1, barsInLine = 0, curLyric = false;
  out.forEach((n, i) => {
    const bar = barOf(n.start);
    // câu lời mới, kể cả câu đầu không đánh dấu ngay sau đoạn dạo
    let brk = lyricBreaks && (!!n.lineStart || (inLine[i] && !inLine[i - 1]));
    if (bar !== curBar) {
      if (curBar >= 0) barsInLine += bar - curBar;
      if (o.lineBreaks?.length) brk = breaks.has(bar);
      // câu lời quá dài (file chỉ đánh dấu đoạn): vẫn ngắt sau 8 ô nhịp
      else if (lyricBreaks) brk ||= (!inLine[i] && (curLyric || barsInLine >= 4)) || barsInLine >= 8;
      else brk = barsInLine >= 4;
      curBar = bar;
    }
    if (cur.length && brk && n.midi !== null) { lines.push({ notes: cur }); cur = []; barsInLine = 0; curLyric = false; }
    if (n.lyric) curLyric = true;
    cur.push({ pitch: n.midi === null ? 'R' : midiName(n.midi, !!o.flats), beats: Math.round(n.beats * 10000) / 10000, lyric: n.lyric ?? '' });
  });
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

interface MidiNote { start: number; end: number; midi: number; ch: number; vel: number }
interface MidiTrack { name: string; notes: MidiNote[]; lyrics: { t: number; text: string }[] }

const utf8 = new TextDecoder('utf-8');
let cp1258: TextDecoder | null | undefined;
/** byte dấu thanh rời của Windows-1258: huyền, sắc, hỏi, ngã, nặng */
const CP1258_TONES = new Set([0xcc, 0xec, 0xd2, 0xde, 0xf2]);

/** có dấu thanh rời kiểu Windows-1258 ngay sau một chữ cái → nhiều khả năng là bảng mã này */
export function looksCp1258(bytes: Uint8Array): boolean {
  return bytes.some((b, i) => i > 0 && CP1258_TONES.has(b) && (/[A-Za-z]/.test(String.fromCharCode(bytes[i - 1])) || bytes[i - 1] >= 0xc0));
}

/**
 * Chữ trong file MIDI cũ: UTF-8; không phải thì đọc theo bảng mã cũ.
 * Windows-1258 (file Việt hay gặp) ghi dấu thanh RỜI sau chữ cái: "Ờ" = Ơ (0xD5) + huyền (0xCC), "đ" = 0xF0.
 * `isCp1258`: cả file dùng Windows-1258 — lời karaoke mỗi sự kiện chỉ 1–2 byte nên phải đoán theo cả file.
 * Còn lại đọc kiểu Latin-1 như trước.
 */
export function legacyText(bytes: Uint8Array, isCp1258 = looksCp1258(bytes)): string {
  const s = utf8.decode(bytes);
  if (!s.includes('�')) return s;
  if (isCp1258) {
    if (cp1258 === undefined) { try { cp1258 = new TextDecoder('windows-1258'); } catch { cp1258 = null; } }
    if (cp1258) return cp1258.decode(bytes).normalize('NFC');
  }
  return String.fromCharCode(...bytes);
}

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
  // lời và tên: giải mã sau khi đọc hết file, để đoán bảng mã theo cả file
  const texts: { bytes: Uint8Array; set: (s: string) => void }[] = [];
  const later = (bytes: Uint8Array, set: (s: string) => void) => texts.push({ bytes, set });
  for (let ti = 0; ti < ntrk && p + 8 <= buf.length; ti++) {
    if (str(p, 4) !== 'MTrk') break;
    const end = p + 8 + dv.getUint32(p + 4);
    let q = p + 8, tick = 0, status = 0;
    const tr: MidiTrack = { name: '', notes: [], lyrics: [] };
    const on = new Map<number, [number, number]>(); // (kênh*128+nốt) → [tick bắt đầu, velocity]
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
        else if (type === 0x03) later(data, (s) => { tr.name = s.trim(); if (ti === 0 && !seqName) seqName = tr.name; });
        else if (type === 0x05 || (type === 0x01 && tick > 0)) { const l = { t: tick / tpq, text: '' }; tr.lyrics.push(l); later(data, (s) => { l.text = s; }); }
        continue;
      }
      if (st === 0xf0 || st === 0xf7) { q += vlq(); continue; }
      status = st;
      const kind = st & 0xf0, ch = st & 0x0f;
      if (kind === 0xc0 || kind === 0xd0) { q += 1; continue; }
      const a = buf[q], b = buf[q + 1];
      q += 2;
      if (kind === 0x90 && b > 0) {
        // đánh lại cùng phím khi nốt cũ chưa nhả (hay gặp ở file karaoke): nốt cũ dừng ở đây
        const prev = on.get(ch * 128 + a);
        if (prev !== undefined && tick > prev[0]) tr.notes.push({ start: prev[0] / tpq, end: tick / tpq, midi: a, ch, vel: prev[1] });
        on.set(ch * 128 + a, [tick, b]);
      }
      else if (kind === 0x80 || (kind === 0x90 && b === 0)) {
        const s = on.get(ch * 128 + a);
        if (s !== undefined) { tr.notes.push({ start: s[0] / tpq, end: tick / tpq, midi: a, ch, vel: s[1] }); on.delete(ch * 128 + a); }
      }
    }
    tracks.push(tr);
    p = end;
  }
  const fileCp1258 = texts.some((x) => looksCp1258(x.bytes));
  for (const x of texts) x.set(legacyText(x.bytes, fileCp1258));
  return { tracks, tempo, timeSig, key, seqName };
}

/**
 * Lời karaoke tách theo từng ký tự (Soft Karaoke kiểu Việt: "T" "u" "ổ" "i" " " "đ" "ờ" "i"…) → gom lại
 * thành từng chữ: chữ mới bắt đầu sau dấu cách hoặc "/" "\\" (xuống dòng). File tách theo âm tiết thì giữ nguyên chữ.
 * Chữ mở đầu dòng lời ("/" "\\" đứng trước, hoặc xuống dòng ở cuối chữ trước) được đánh dấu `brk`.
 */
function syllables(lyrics: { t: number; text: string }[]): { t: number; text: string; brk?: boolean }[] {
  const body = lyrics.filter((l) => !l.text.startsWith('@'));
  const core = (s: string) => s.replace(/^[/\\\s]+/, '').replace(/\s+$/, '');
  const lead = (s: string) => /^\s*[/\\\r\n]/.test(s), tail = (s: string) => /[\r\n]\s*$/.test(s);
  const chars = body.map((l) => core(l.text)).filter(Boolean);
  const short = chars.filter((c) => [...c].length <= 1).length;
  const out: { t: number; text: string; brk?: boolean }[] = [];
  let pending = false;
  if (chars.length < 8 || short / chars.length < 0.6) {
    for (const l of body) {
      if (lead(l.text)) pending = true;
      const c = core(l.text).replace(/[\r\n]+/g, ' ');
      if (c) { out.push({ t: l.t, text: c, brk: pending || undefined }); pending = false; }
      if (tail(l.text)) pending = true;
    }
    return out;
  }
  let cur: { t: number; text: string; brk?: boolean } | null = null;
  for (const l of body) {
    if (lead(l.text)) pending = true;
    // dấu cách / "/" / "\" đứng trước: chữ trước đã hết
    if (/^[/\\\s]/.test(l.text) && cur) { out.push(cur); cur = null; }
    const c = core(l.text);
    // chữ mới tính giờ từ ký tự đầu tiên của nó
    if (c) { if (cur) cur.text += c; else { cur = { t: l.t, text: c, brk: pending || undefined }; pending = false; } }
    if (tail(l.text)) pending = true;
    if (/\s$/.test(l.text) && cur) { out.push(cur); cur = null; }
  }
  if (cur) out.push(cur);
  // chữ cái và dấu thanh có thể nằm ở hai sự kiện: chuẩn hoá sau khi ghép
  return out.map((l) => ({ ...l, text: l.text.normalize('NFC') }));
}

/** Lượng tử hoá vị trí theo lưới móc kép (1/4 phách) hoặc móc đơn liên ba (1/3 phách), chọn lưới gần hơn */
const quant = (t: number) => {
  const q4 = Math.round(t * 4) / 4, q3 = Math.round(t * 3) / 3;
  return Math.abs(q3 - t) + 0.02 < Math.abs(q4 - t) ? q3 : q4;
};

/**
 * Nốt bị dò vỡ thành nhiều nốt ngắn lặp lại (nghe như nói lắp): nối các nốt cùng cao độ liền nhau lại,
 * và bỏ nốt chớp rất ngắn kẹp giữa hai nốt cùng cao độ. Nốt lặp thật (cả hai đủ dài) được giữ nguyên; nốt đánh lại ngắn (< nửa phách) ngay sau nốt cùng cao độ thì coi là tiếng ngân bị dò vỡ.
 */
function mergeRepeats(mel: MidiNote[]): MidiNote[] {
  const dur = (n: MidiNote) => n.end - n.start;
  const cleaned = mel.filter((n, i) => !(dur(n) < 0.15 && mel[i - 1] && mel[i + 1] && mel[i - 1].midi === mel[i + 1].midi && mel[i - 1].midi !== n.midi));
  const out: MidiNote[] = [];
  for (const n of cleaned) {
    const prev = out[out.length - 1];
    if (prev && prev.midi === n.midi && n.start - prev.end <= 0.35 && (dur(prev) < 0.35 || dur(n) < 0.55)) prev.end = Math.max(prev.end, n.end);
    else out.push({ ...n });
  }
  return out;
}

/** Mức lọc giọng phụ 1…3: [nốt yếu hơn mấy lần velocity giữa, cao hơn đường giọng chính mấy nửa cung] */
const BACKING_LEVELS: [number, number][] = [[0.7, 12], [0.85, 9], [1, 6]];

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

  /**
   * Bỏ giọng phụ / hoạ âm: file dò từ giọng hát (Basic Pitch…) hay thêm các nốt cao, yếu chồng lên giọng chính.
   * Giọng chính = các nốt mạnh; nốt yếu hơn hẳn mà lại cao hơn đường giọng chính quanh nó thì bỏ.
   * File nhiều bè có velocity ngang nhau thì không bị đụng tới.
   */
  const dropBacking = (notes: MidiNote[], level: number): MidiNote[] => {
    if (level <= 0 || notes.length < 8) return notes;
    const [quietBelow, farAbove] = BACKING_LEVELS[Math.min(3, Math.round(level)) - 1];
    const medOf = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
    const velMid = medOf(notes.map((n) => n.vel));
    const loud = notes.filter((n) => n.vel >= 0.75 * velMid); // notes đã xếp theo thời điểm bắt đầu nên loud cũng vậy
    if (loud.length < 8) return notes;
    const globalMid = medOf(loud.map((n) => n.midi));
    let lo = 0, hi = 0; // cửa sổ ±8 phách trượt trên loud
    return notes.filter((n) => {
      // nốt yếu ở xa sau nốt mạnh cuối cùng (đoạn kết, đệm cuối bài): cửa sổ chạy hết danh sách, không được vượt quá
      while (lo < loud.length && loud[lo].start < n.start - 8) lo++;
      while (hi < loud.length && loud[hi].start <= n.start + 8) hi++;
      const near = loud.slice(lo, hi).map((o) => o.midi);
      const contour = near.length >= 3 ? medOf(near) : globalMid;
      return !(n.vel < quietBelow * velMid && n.midi - contour > farAbove);
    });
  };

  /** Giai điệu một bè: tại mỗi thời điểm lấy nốt cao nhất đang kêu (bè chính thường ở trên), sau khi bỏ giọng phụ yếu */
  const melodyOf = (all: MidiNote[], level = 2) => {
    const ns = dropBacking([...all].sort((a, b) => a.start - b.start || b.midi - a.midi), level);
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
  /**
   * File karaoke: chữ lời gắn đúng lúc giọng hát vào nốt → bè giai điệu là bè có nhiều nốt bắt đầu trùng thời điểm các chữ.
   * (File một track nhiều kênh thì lời thuộc cả track, nên không dựa vào "track có lời" được.)
   */
  const lyricTimes = syllables(allLyrics).filter((l) => l.text.replace(/^[/\\@\s]+/, '').trim()).map((l) => l.t);
  const lyricMatch = (m: MidiNote[]) => {
    if (lyricTimes.length < 8) return 0;
    const starts = m.map((n) => n.start);
    let hit = 0, j = 0;
    for (const t of lyricTimes) {
      while (j < starts.length - 1 && starts[j + 1] <= t) j++;
      const near = Math.min(Math.abs(starts[j] - t), j + 1 < starts.length ? Math.abs(starts[j + 1] - t) : Infinity);
      if (near < 0.2) hit++;
    }
    return hit / lyricTimes.length;
  };
  // bè giai điệu: khớp lời karaoke → tên gợi ý → bè có lời → bè nhiều nốt, ít hợp âm, tầm cao
  const scoreOf = (g: (typeof groups)[number]) => {
    const m = melodyOf(g.notes);
    if (m.length < 8) return -Infinity;
    const avg = m.reduce((t, n) => t + n.midi, 0) / m.length;
    const poly = 1 - m.length / g.notes.length;
    const named = /voice|vocal|voc|sing|melod|lead|giọng|hát|giai điệu|solo/i.test(g.name) ? 40 : 0;
    return 100 * lyricMatch(m) + named + (g.lyrics.length ? 25 : 0) + avg - 30 * poly + Math.min(20, m.length / 10);
  };
  const melodyPart = [...groups].sort((a, b) => scoreOf(b) - scoreOf(a))[0].id;

  const [num, den] = timeSig ?? [4, 4];
  const barBeats = (num * 4) / den;
  const title = (seqName && !/^(untitled|track\s*\d*|sequence|seq-?\d*)$/i.test(seqName) ? seqName : '') || fileTitle;
  const songKey = key ? keyFromFifths(key[0], key[1]) : undefined;
  return {
    kind: 'midi', title, parts, melodyPart,
    transcribe(partId, opts) {
      const g = groups.find((x) => x.id === partId) ?? groups[0];
      const level = opts?.backing ?? 2;
      const raw = melodyOf(g.notes, level).filter((n) => n.end - n.start > 0.05);
      // chỉ ở mức mạnh: file karaoke có nhiều chữ liền nhau cùng cao độ, không được nối
      const mel = level >= 3 ? mergeRepeats(raw) : raw;
      // lượng tử hoá; nốt bị cắt còn quá ngắn thì bỏ
      const notes: MelNote[] = [];
      mel.forEach((n, i) => {
        const s = quant(n.start), next = mel[i + 1] ? quant(mel[i + 1].start) : Infinity;
        let e = Math.min(quant(n.end), next);
        if (e - s < 0.2 && next - s >= 0.25) e = Math.min(next, s + 0.25);
        if (e - s < 0.1) return;
        // nốt nhả sớm (file karaoke / người chơi ngắt tiếng): nối liền tới nốt sau thay vì chèn dấu lặng,
        // trừ chỗ nghỉ thật (nốt kêu gần đủ, hoặc lặng dài quá 1 phách)
        const gap = next - e;
        const ratio = (e - s) / (next - s);
        if (next !== Infinity && gap > 0 && (gap < 0.25 || (ratio < 0.6 && gap <= 1))) e = next;
        // chữ cuối câu bị nhả quá sớm: ngân tiếp, chừa nửa phách lấy hơi (tối đa 3 phách)
        else if (next !== Infinity && gap > 1 && ratio < 0.4) e = Math.max(e, Math.min(next - 0.5, s + 3));
        notes.push({ start: s, beats: e - s, midi: n.midi });
      });
      // lời: gắn vào nốt bắt đầu gần nhất
      const lyrics = syllables(g.lyrics.length ? g.lyrics : allLyrics);
      for (const l of lyrics) {
        const text = l.text.replace(/^[/\\@]+/, '').replace(/[\r\n]+/g, ' ').trim();
        if (!text || text.startsWith('@')) continue;
        const n = notes.reduce<MelNote | null>((best, x) => (Math.abs(x.start - l.t) < 0.3 && (!best || Math.abs(x.start - l.t) < Math.abs(best.start - l.t)) ? x : best), null);
        if (n && !n.lyric) n.lyric = text.endsWith('-') ? text : text.replace(/\s+$/, '');
        else if (l.brk) { const nx = notes.find((x) => x.start >= l.t - 0.3 && !x.lyric); if (nx) nx.lineStart = true; continue; }
        if (n && l.brk) n.lineStart = true;
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
