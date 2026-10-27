/**
 * Bài hợp âm dán vào (kiểu sách / trang hợp âm): lời kèm hợp âm, không cần giai điệu.
 *
 * Nhận hai cách ghi hay gặp:
 *   [Am]Em ơi Hà [F]Nội phố        ← hợp âm trong ngoặc vuông chen trong lời
 *   Am          F                  ← dòng hợp âm nằm trên dòng lời (căn theo cột chữ)
 *   Em ơi Hà    Nội phố
 * Dòng "ĐK:", "[Điệp khúc]", "Verse 1:" … thành tên đoạn. Hợp âm lạ (sus4, add9, C/G…) đổi về hợp âm gần nhất app chơi được.
 *
 * Bài lưu trong song.sheet ở dạng chuẩn hoá (ngoặc vuông, "# Tên đoạn"); mỗi hợp âm giữ `beats` phách khi phát.
 */
import { NO_CHORD, parseChord, segKey, type ChordOverrides } from '../audio/harmony';
import type { FlatEvent } from './tabText';

export interface SheetPart {
  chord?: string;
  text: string;
}
export interface SheetLine {
  kind: 'line' | 'section';
  /** tên đoạn (kind = section) */
  title?: string;
  parts: SheetPart[];
}

const CHORD_RE = /^([A-G])([#b♯♭]?)((?:maj|min|m|M|dim|aug|sus|add|°|ø|\+|Δ|\d|b|#|-)*)(?:\/([A-G][#b♯♭]?))?$/;

/** tên hợp âm bất kỳ → tên app chơi được (C, Am, G7, Cmaj7, Dm7, Bm7b5, C#dim7), hoặc null nếu không phải hợp âm */
export function normalizeChord(raw: string): string | null {
  const t = raw.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (/^n\.?c\.?$/i.test(t)) return NO_CHORD;
  const m = CHORD_RE.exec(t);
  if (!m) return null;
  const root = m[1] + m[2];
  const q = m[3];
  let suffix = '';
  if (/^(maj7|M7|Δ7?|maj9|M9|maj)$/.test(q)) suffix = q === 'maj' ? '' : 'maj7';
  else if (/^(m7b5|m7-5|ø7?)$/.test(q)) suffix = 'm7b5';
  else if (/^(dim7?|°7?|o7)$/.test(q)) suffix = 'dim7';
  else if (/^(m|min|-)(7|9|11)$/.test(q)) suffix = 'm7';
  else if (/^(m|min|-)(6|add9|maj7)?$/.test(q)) suffix = 'm';
  else if (/^(7|9|11|13|7sus4|7sus|7b9|7#9)$/.test(q)) suffix = '7';
  else if (/^(sus[24]?|add\d+|6|69|6\/9|5|aug|\+|2|4)?$/.test(q)) suffix = '';
  else return null;
  const c = parseChord(root + suffix);
  return c ? c.name : null;
}

/** dòng toàn tên hợp âm (cho phép | / - x2 ngoặc) */
export function isChordLine(line: string): boolean {
  const toks = line.replace(/[|()]/g, ' ').split(/\s+/).filter((t) => t && !/^[-/.]+$/.test(t) && !/^x\d+$/i.test(t));
  return toks.length > 0 && toks.every((t) => normalizeChord(t) !== null);
}

const BRACKET_RE = /^\s*\[([^\]]{1,30})\]\s*:?\s*$/;
const KEYWORD_RE = /^(đk|đ\.k\.?|dk|điệp khúc|diep khuc|chorus|refrain|verse|phiên khúc|pk|intro|outro|dạo đầu|dạo nhạc|bridge|interlude|coda|solo|lời \d|đoạn \d)(\s*\d+)?\s*:?$/i;

function sectionTitle(line: string): string | null {
  const t = line.trim();
  if (t.startsWith('#')) return t.replace(/^#+\s*/, '') || null;
  const b = BRACKET_RE.exec(t);
  if (b) return normalizeChord(b[1]) ? null : b[1].trim(); // [Am] là hợp âm, [ĐK] là tên đoạn
  if (KEYWORD_RE.test(t)) return t.replace(/:$/, '').trim();
  // dòng ngắn kết thúc bằng dấu hai chấm: "Điệp khúc 2:", "Lần 2:"
  if (/^[^[\]]{1,25}:$/.test(t)) return t.slice(0, -1).trim();
  return null;
}

/** "[Am]Em ơi [F]Hà Nội" → phần lời gắn hợp âm; ngoặc không phải hợp âm giữ nguyên chữ */
function inlineParts(line: string): SheetPart[] {
  const parts: SheetPart[] = [];
  let cur: SheetPart = { text: '' };
  const re = /\[([^\]]*)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const name = normalizeChord(m[1]);
    cur.text += line.slice(last, m.index);
    if (name) {
      if (cur.text || cur.chord) parts.push(cur);
      cur = { chord: name, text: '' };
    } else {
      cur.text += m[0];
    }
    last = m.index + m[0].length;
  }
  cur.text += line.slice(last);
  if (cur.text || cur.chord) parts.push(cur);
  return parts;
}

/** dòng hợp âm trên + dòng lời dưới → chèn hợp âm vào đúng cột chữ */
function mergeChordLine(chordLine: string, lyric: string): string {
  const marks: { col: number; name: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine))) {
    const name = normalizeChord(m[0].replace(/[|()]/g, ''));
    if (name) marks.push({ col: m.index, name });
  }
  let out = lyric.padEnd(Math.max(lyric.length, ...marks.map((k) => k.col)), ' ');
  for (const k of [...marks].reverse()) {
    // đặt hợp âm ở đầu chữ gần nhất (không cắt đôi chữ)
    let c = Math.min(k.col, out.length);
    while (c > 0 && /\S/.test(out[c - 1]) && /\S/.test(out[c] ?? ' ')) c--;
    // rơi vào khoảng trắng ngay trước chữ: dời tới đầu chữ đó
    let d = c;
    while (d < out.length && d - c < 3 && out[d] === ' ') d++;
    if (d < out.length && d > c && /\S/.test(out[d])) c = d;
    out = `${out.slice(0, c)}[${k.name}]${out.slice(c)}`;
  }
  return out.replace(/\s+$/, '');
}

export interface ParsedSheet {
  title?: string;
  lines: SheetLine[];
  chordCount: number;
}

/** đọc bài hợp âm dán vào (hoặc song.sheet đã chuẩn hoá) */
export function parseSheet(text: string): ParsedSheet {
  const rows = text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const lines: SheetLine[] = [];
  let title: string | undefined;
  let chordCount = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].replace(/\s+$/, '');
    if (!row.trim()) { if (lines.length && lines[lines.length - 1].parts.length) lines.push({ kind: 'line', parts: [] }); continue; }
    const sec = sectionTitle(row);
    if (sec) { lines.push({ kind: 'section', title: sec, parts: [] }); continue; }
    let src = row;
    if (isChordLine(row)) {
      const next = rows[i + 1]?.replace(/\s+$/, '') ?? '';
      if (next.trim() && !isChordLine(next) && !sectionTitle(next) && !/\[[^\]]+\]/.test(next)) {
        src = mergeChordLine(row, next);
        i++;
      } else {
        src = row.replace(/[|()]/g, ' ').split(/\s+/).filter(Boolean).map((t) => normalizeChord(t)).filter(Boolean).map((n) => `[${n}]`).join(' ');
      }
    }
    const parts = inlineParts(src.trim());
    if (!lines.length && !title && !parts.some((p) => p.chord) && rows.slice(i + 1).some((r) => /\[[^\]]+\]/.test(r) || isChordLine(r))) {
      // dòng đầu không có hợp âm, sau đó mới tới bài: coi là tên bài
      title = src.trim();
      continue;
    }
    chordCount += parts.filter((p) => p.chord).length;
    lines.push({ kind: 'line', parts });
  }
  while (lines.length && !lines[lines.length - 1].parts.length && lines[lines.length - 1].kind === 'line') lines.pop();
  return { title, lines, chordCount };
}

/** dạng chuẩn để lưu: "# Đoạn", "[C]lời [G]lời" */
export function serializeSheet(lines: SheetLine[]): string {
  return lines.map((l) => (l.kind === 'section' ? `# ${l.title}` : l.parts.map((p) => (p.chord ? `[${p.chord}]` : '') + p.text).join(''))).join('\n').trim() + '\n';
}

export interface SheetSlot {
  line: number;
  part: number;
  chord: string;
  start: number;
  beats: number;
}

/** thời gian từng hợp âm: mỗi hợp âm giữ `beats` phách theo thứ tự trong bài */
export function sheetSlots(lines: SheetLine[], beats: number): SheetSlot[] {
  const out: SheetSlot[] = [];
  let t = 0;
  lines.forEach((l, li) => l.parts.forEach((p, pi) => {
    if (!p.chord) return;
    out.push({ line: li, part: pi, chord: p.chord, start: t, beats });
    t += beats;
  }));
  return out;
}

/** chuỗi sự kiện câm cho bộ phát (giữ nhịp, không ra tiếng giai điệu) và hợp âm ép cho từng khúc đệm */
export function sheetPlayback(slots: SheetSlot[], segLen: number): { flat: FlatEvent[]; overrides: ChordOverrides } {
  const flat: FlatEvent[] = slots.map((s, i) => {
    const c = parseChord(s.chord);
    return { token: null, midi: c && c.root >= 0 ? 48 + c.root : 48, beats: s.beats, start: s.start, sectionIndex: 0, lineIndex: s.line, eventIndex: i };
  });
  const overrides: ChordOverrides = {};
  for (const s of slots) for (let b = s.start; b < s.start + s.beats - 1e-6; b += segLen) overrides[segKey(b)] = s.chord;
  return { flat, overrides };
}

/** các hợp âm trong bài theo thứ tự (để vẽ sơ đồ, gợi ý capo) */
export function sheetChords(lines: SheetLine[]): string[] {
  return lines.flatMap((l) => l.parts.map((p) => p.chord).filter((c): c is string => !!c && c !== NO_CHORD));
}

// ---------- dán hợp âm vào bài đã có giai điệu: khớp theo lời ----------

const norm = (w: string) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');

interface TabWord { word: string; start: number }

/** chữ trong lời của tab (âm tiết nối gạch gộp lại thành một chữ), kèm phách bắt đầu */
function tabWords(flat: FlatEvent[]): TabWord[] {
  const out: TabWord[] = [];
  let cur: TabWord | null = null;
  for (const e of flat) {
    if (!e.lyric) continue;
    if (cur) cur.word += e.lyric;
    else cur = { word: e.lyric, start: e.start };
    if (!e.hyphen) { out.push({ ...cur, word: norm(cur.word) }); cur = null; }
  }
  if (cur) out.push({ ...cur, word: norm(cur.word) });
  return out.filter((w) => w.word);
}

/** chữ trong bài dán, chữ nào có hợp âm đứng trước */
function sheetWords(lines: SheetLine[]): { words: string[]; chords: { at: number; chord: string }[] } {
  const words: string[] = [];
  const chords: { at: number; chord: string }[] = [];
  for (const l of lines) for (const p of l.parts) {
    if (p.chord) chords.push({ at: words.length, chord: p.chord });
    for (const w of p.text.split(/\s+/)) { const n = norm(w); if (n) words.push(n); }
  }
  return { words, chords };
}

/** khớp hai dãy chữ (dãy con chung dài nhất): chỉ số chữ bài dán → chỉ số chữ trong tab */
function align(a: string[], b: string[]): (number | null)[] {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: (number | null)[] = new Array(n).fill(null);
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out[i] = j; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return out;
}

/**
 * Đặt hợp âm của bài dán lên bài có giai điệu: khớp lời, hợp âm rơi vào khúc đệm chứa chữ đó và giữ tới hợp âm kế tiếp.
 * `segStarts`: phách bắt đầu các khúc đệm (từ harmonizeSegments). Trả về hợp âm ép + số hợp âm khớp được.
 */
export function chordsFromSheet(lines: SheetLine[], flat: FlatEvent[], segStarts: number[]): { overrides: ChordOverrides; matched: number; total: number } {
  const tw = tabWords(flat);
  const { words, chords } = sheetWords(lines);
  const map = align(words, tw.map((w) => w.word));
  const segLen = segStarts.length > 2 ? segStarts[2] - segStarts[1] : 2;
  const placed: { seg: number; chord: string }[] = [];
  for (const c of chords) {
    // chữ ngay sau hợp âm; không khớp thì lấy chữ khớp gần nhất phía sau (trong 3 chữ)
    let k = c.at;
    while (k < words.length && k < c.at + 3 && map[k] === null) k++;
    const ti = k < words.length ? map[k] : null;
    if (ti === null || ti === undefined) continue;
    const beat = tw[ti].start;
    let s = segStarts.findIndex((st, i) => beat >= st - 1e-6 && (i === segStarts.length - 1 || beat < segStarts[i + 1] - 1e-6));
    if (s < 0) continue;
    // chữ rơi cuối khúc (nốt lấy đà của câu): hợp âm đổi ở khúc sau
    if (s < segStarts.length - 1 && beat - segStarts[s] > segLen * 0.6) s++;
    const prev = placed[placed.length - 1];
    if (prev && prev.seg >= s) { prev.chord = c.chord; continue; }
    placed.push({ seg: s, chord: c.chord });
  }
  const overrides: ChordOverrides = {};
  placed.forEach((p, i) => {
    const end = i + 1 < placed.length ? placed[i + 1].seg : segStarts.length;
    for (let s = p.seg; s < end; s++) overrides[segKey(segStarts[s])] = p.chord;
  });
  return { overrides, matched: placed.length, total: chords.length };
}
