/**
 * Định dạng văn bản tab (lưu trong song.body):
 *
 *   # Đoạn 1                      ← tiêu đề đoạn
 *   4 4 -4 4 5 -5:2               ← dòng tab; ":2" = 2 phách, ":0.5" hay ":1/2" = nửa phách
 *   Hap-py birth-day to you       ← dòng lời (tuỳ chọn) ngay dưới dòng tab
 *
 *   r = nghỉ, "|" = vạch nhịp (bỏ qua), "_" trong lời = nốt luyến (không có chữ)
 *   Dòng chữ không đứng sau dòng tab được hiển thị như ghi chú.
 */
import { HarpKey, cleanToken, parseToken, isTabToken } from './harp';

export interface TabEvent {
  /** token đã chuẩn hoá, null nếu là dấu nghỉ */
  token: string | null;
  midi: number | null;
  beats: number;
  lyric?: string;
  /** chữ này nối với chữ sau bằng gạch nối (cùng một từ) */
  hyphen?: boolean;
  /** vị trí tuyệt đối tính bằng phách (điền khi flatten) */
  start?: number;
}

export interface TabLine {
  kind: 'tab';
  events: TabEvent[];
  lineNo: number;
}

export interface NoteLine {
  kind: 'note';
  text: string;
  lineNo: number;
}

export interface TabSection {
  title?: string;
  lines: (TabLine | NoteLine)[];
}

export interface ParseIssue {
  lineNo: number;
  message: string;
  level: 'error' | 'warning';
}

export interface ParsedTab {
  sections: TabSection[];
  issues: ParseIssue[];
}

const DUR_RE = /^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/;

function splitTokenDuration(raw: string): { head: string; beats: number | null; bad: boolean } {
  const idx = raw.lastIndexOf(':');
  if (idx <= 0) return { head: raw, beats: 1, bad: false };
  const head = raw.slice(0, idx);
  const m = DUR_RE.exec(raw.slice(idx + 1));
  if (!m) return { head, beats: null, bad: true };
  const beats = m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]);
  if (!(beats > 0) || beats > 32) return { head, beats: null, bad: true };
  return { head, beats, bad: false };
}

function isRest(head: string): boolean {
  return head === 'r' || head === 'R' || head === '0';
}

function tokensOf(line: string): string[] {
  return line.split(/\s+/).filter((t) => t && t !== '|' && t !== '||');
}

/** Một dòng là dòng tab nếu mọi token đều là ký hiệu lỗ / nghỉ (có thể kèm :độ dài) */
export function looksLikeTabLine(line: string): boolean {
  const toks = tokensOf(line);
  if (!toks.length) return false;
  return toks.every((t) => {
    const { head } = splitTokenDuration(t);
    return isRest(head) || isTabToken(head);
  });
}

export function splitLyrics(line: string): { text: string; hyphen: boolean; melisma: boolean }[] {
  const out: { text: string; hyphen: boolean; melisma: boolean }[] = [];
  for (const word of line.trim().split(/\s+/).filter(Boolean)) {
    if (word === '_' || word === '~') {
      out.push({ text: '', hyphen: false, melisma: true });
      continue;
    }
    const parts = word.split('-');
    parts.forEach((p, i) => {
      if (!p) return;
      if (p === '_' || p === '~') { out.push({ text: '', hyphen: false, melisma: true }); return; }
      out.push({ text: p, hyphen: i < parts.length - 1 && parts.slice(i + 1).some(Boolean), melisma: false });
    });
  }
  return out;
}

export function parseTab(body: string, key: HarpKey): ParsedTab {
  const issues: ParseIssue[] = [];
  const sections: TabSection[] = [];
  let current: TabSection = { lines: [] };
  let lastTab: TabLine | null = null;
  let lastTabHasLyric = false;

  const rows = body.replace(/\r\n?/g, '\n').split('\n');
  rows.forEach((row, i) => {
    const lineNo = i + 1;
    const line = row.trim();
    if (!line) {
      lastTab = null;
      return;
    }
    if (line.startsWith('#')) {
      if (current.lines.length || current.title) sections.push(current);
      current = { title: line.replace(/^#+\s*/, '') || undefined, lines: [] };
      lastTab = null;
      return;
    }
    if (looksLikeTabLine(line)) {
      const events: TabEvent[] = [];
      for (const raw of tokensOf(line)) {
        const { head, beats, bad } = splitTokenDuration(raw);
        if (bad) issues.push({ lineNo, level: 'error', message: `Độ dài không hợp lệ ở "${raw}" — dùng dạng 4:2, 4:0.5 hoặc 4:1/2` });
        const b = beats ?? 1;
        if (isRest(head)) {
          events.push({ token: null, midi: null, beats: b });
          continue;
        }
        const note = parseToken(head, key);
        if (!note) {
          issues.push({ lineNo, level: 'error', message: `"${cleanToken(head)}" không chơi được trên kèn ${key}` });
          events.push({ token: cleanToken(head), midi: null, beats: b });
        } else {
          events.push({ token: note.token, midi: note.midi, beats: b });
        }
      }
      const tl: TabLine = { kind: 'tab', events, lineNo };
      current.lines.push(tl);
      lastTab = tl;
      lastTabHasLyric = false;
      return;
    }
    // dòng chữ
    if (lastTab && !lastTabHasLyric) {
      const syl = splitLyrics(line);
      const targets = lastTab.events.filter((e) => e.token !== null);
      if (syl.length > targets.length) {
        issues.push({ lineNo, level: 'warning', message: `Lời có ${syl.length} chữ nhưng dòng tab chỉ có ${targets.length} nốt` });
      }
      targets.forEach((ev, idx) => {
        const s = syl[idx];
        if (s && !s.melisma) {
          ev.lyric = s.text;
          if (s.hyphen) ev.hyphen = true;
        }
      });
      lastTabHasLyric = true;
      return;
    }
    current.lines.push({ kind: 'note', text: line, lineNo });
    lastTab = null;
  });
  if (current.lines.length || current.title) sections.push(current);
  return { sections, issues };
}

function fmtBeats(b: number): string {
  if (b === 1) return '';
  // liên ba: ghi dạng phân số (2/3) cho dễ đọc
  const t = Math.round(b * 3);
  if (Math.abs(b * 3 - t) < 1e-6 && t % 3 !== 0 && Math.abs(b * 4 - Math.round(b * 4)) > 1e-6) return `:${t}/3`;
  const r = Math.round(b * 1000) / 1000;
  return `:${r}`;
}

export function serializeTab(sections: TabSection[]): string {
  const out: string[] = [];
  sections.forEach((sec, si) => {
    if (si > 0) out.push('');
    if (sec.title) out.push(`# ${sec.title}`);
    sec.lines.forEach((line, li) => {
      if (line.kind === 'note') {
        out.push(line.text);
        return;
      }
      if (li > 0 && sec.lines[li - 1].kind === 'tab') out.push('');
      out.push(line.events.map((e) => (e.token ?? 'r') + fmtBeats(e.beats)).join(' '));
      const playable = line.events.filter((e) => e.token !== null);
      if (playable.some((e) => e.lyric)) {
        let s = '';
        playable.forEach((e, i) => {
          const txt = e.lyric ? e.lyric : '_';
          s += txt;
          if (i < playable.length - 1) s += e.lyric && e.hyphen && playable[i + 1].lyric ? '-' : ' ';
        });
        out.push(s);
      }
    });
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export interface FlatEvent extends TabEvent {
  start: number;
  sectionIndex: number;
  lineIndex: number;
  eventIndex: number;
}

/** Trải phẳng mọi nốt theo thời gian (đơn vị: phách) */
export function flatten(parsed: ParsedTab): FlatEvent[] {
  const out: FlatEvent[] = [];
  let t = 0;
  parsed.sections.forEach((sec, si) =>
    sec.lines.forEach((line, li) => {
      if (line.kind !== 'tab') return;
      line.events.forEach((ev, ei) => {
        out.push({ ...ev, start: t, sectionIndex: si, lineIndex: li, eventIndex: ei });
        t += ev.beats;
      });
    }),
  );
  return out;
}

export function totalBeats(parsed: ParsedTab): number {
  const f = flatten(parsed);
  const last = f[f.length - 1];
  return last ? last.start + last.beats : 0;
}

export function countTechniques(parsed: ParsedTab): { notes: number; bends: number; overblows: number } {
  let notes = 0, bends = 0, overblows = 0;
  for (const ev of flatten(parsed)) {
    if (!ev.token) continue;
    notes++;
    if (ev.token.includes("'")) bends++;
    if (ev.token.includes('o')) overblows++;
  }
  return { notes, bends, overblows };
}
