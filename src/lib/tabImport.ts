/**
 * Nhập tab harmonica dán từ trang web / tin nhắn: nhận nhiều kiểu ký hiệu phổ biến
 * và chuyển về định dạng tab của app. Tab trên mạng thường không ghi trường độ → mỗi nốt 1 phách.
 * Kèn chromatic: nút gạt ghi bằng < (4<, <4), * hoặc ' — app đổi hết về 4<.
 */
import { HarpKey, HarpType, isTremolo, normalizeKey, tremoloDir } from './harp';
import { looksLikeTabLine, splitLyrics } from './tabText';

export interface ImportResult {
  body: string;
  harpKey: HarpKey | null;
  /** loại kèn (người dùng chọn, hoặc đoán từ ký hiệu trong bài) */
  harpType: HarpType;
  title: string | null;
  tabLines: number;
  notes: number;
  /** ký hiệu không hiểu (để người dùng xem lại) */
  unknown: string[];
}

interface Conventions {
  /** ghi chữ B/D (Blow/Draw) trước hoặc sau số lỗ */
  letters: boolean;
  /** lỗ hút ghi trong ngoặc: (4) — chỉ khi cả bài không dùng dấu "-" */
  parens: boolean;
}

const DIA_HOLE = '(10|[1-9])';
const CHROM_HOLE = '(1[0-6]|[1-9])';
const TREM_HOLE = '(2[0-4]|1[0-9]|[1-9])';

/** Chuẩn hoá một ký hiệu; trả null nếu không phải nốt kèn */
export function normalizeToken(raw: string, conv: Conventions = { letters: false, parens: false }, type: HarpType = 'diatonic'): string | null {
  const chrom = type !== 'diatonic';
  const HOLE = isTremolo(type) ? TREM_HOLE : chrom ? CHROM_HOLE : DIA_HOLE;
  let t = raw.trim()
    .replace(/[’‘`´]/g, "'").replace(/[″”"]/g, "''").replace(/[−–—]/g, '-')
    .replace(/^[.,;]+|[.,;]+$/g, '');
  if (!t) return null;
  if (/^(r|rest|nghỉ|x|-)$/i.test(t)) return t === '-' ? null : 'r';

  // trường độ kiểu của app (4:2, -4:1/2) giữ nguyên
  let dur = '';
  const di = t.lastIndexOf(':');
  if (di > 0 && /^\d+(\.\d+)?(\/\d+(\.\d+)?)?$/.test(t.slice(di + 1))) { dur = t.slice(di); t = t.slice(0, di); }

  let draw = false;
  // mũi tên: ↑ thổi, ↓ hút
  if (/[↓⬇]/.test(t)) { draw = true; t = t.replace(/[↓⬇]/g, ''); }
  t = t.replace(/[↑⬆]/g, '');
  // ngoặc: (4) = hút (khi bài dùng quy ước này), ngoặc khác thì bỏ
  const paren = /^\((.*)\)$/.exec(t);
  if (paren) { t = paren[1]; if (conv.parens) draw = true; }
  // chữ B/D: B4, 4B, D4, 4D
  if (conv.letters) {
    const m = new RegExp(`^([BbDd])${HOLE}(.*)$`).exec(t) ?? (() => {
      const r = new RegExp(`^${HOLE}([BbDd])$`).exec(t);
      return r ? [r[0], r[2], r[1], ''] : null;
    })();
    if (m) { draw = /d/i.test(m[1]); t = m[2] + (m[3] ?? ''); }
  }
  let slide = false;
  if (chrom && t.startsWith('<')) { slide = true; t = t.slice(1); }
  if (t.startsWith('+')) t = t.slice(1);
  if (t.startsWith('-')) { draw = true; t = t.slice(1); }
  if (chrom && t.startsWith('<')) { slide = true; t = t.slice(1); }

  const m = new RegExp(`^${HOLE}(.*)$`).exec(t);
  if (!m) return null;
  const hole = m[1];
  let rest = m[2].toLowerCase();
  if (isTremolo(type)) {
    // tremolo: hướng do số lỗ quyết định (chẵn = hút), sách thường chỉ ghi số
    if (rest.replace(/~/g, '')) return null;
    if (draw && tremoloDir(Number(hole)) === 'blow') return null;
    return `${tremoloDir(Number(hole)) === 'draw' ? '-' : ''}${hole}${dur}`;
  }
  if (chrom) {
    rest = rest.replace(/~/g, '');
    if (!/^[<*'#]?$/.test(rest)) return null;
    return `${draw ? '-' : ''}${hole}${slide || rest ? '<' : ''}${dur}`;
  }
  // overblow / overdraw: o, ob, od, ^o
  if (/^(o|ob|od|ov)$/.test(rest)) return `${draw || rest === 'od' ? '-' : ''}${hole}o${dur}`;
  // bend: ', b, ^ (mỗi ký hiệu = nửa cung); "~" rung hơi thì bỏ
  rest = rest.replace(/~/g, '');
  if (!/^['b^]*$/.test(rest)) return null;
  const bends = rest.length;
  return `${draw ? '-' : ''}${hole}${"'".repeat(bends)}${dur}`;
}

const SECTION_RE = /^\s*[[(]?\s*(intro|verse|chorus|bridge|outro|refrain|pre-?chorus|solo|đoạn|điệp khúc|dạo|kết|phiên khúc|lời)\b[^\n]{0,25}$/i;
const KEY_RE = /(?:key|tông|tone|kèn|harp(?:monica)?|giọng)\s*(?:of|:|-)?\s*([A-G](?:#|b|♯|♭)?)(?![a-z])/i;

/** Tách dòng thành ký hiệu: hiểu cả kiểu viết dính 4-4-5, dấu phẩy, vạch | */
function rawTokens(line: string): string[] {
  return line
    .replace(/([0-9'’^bBoD)<*])(?=[-−–]\d)/g, '$1 ') // 4-4-5 → 4 -4 -5
    .replace(/[,;|/\\]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Dòng tab: phần lớn ký hiệu là nốt kèn */
function tabLine(line: string, conv: Conventions, type: HarpType): { tokens: string[]; unknown: string[] } | null {
  const toks = rawTokens(line);
  if (!toks.length) return null;
  const out: string[] = [], unknown: string[] = [];
  for (const t of toks) {
    const n = normalizeToken(t, conv, type);
    if (n) out.push(n); else unknown.push(t);
  }
  return out.length && out.length >= 0.7 * toks.length ? { tokens: out, unknown } : null;
}

/** Đoán loại kèn: có ký hiệu nút gạt, lỗ 11–16 hoặc chữ "chromatic" → chromatic */
export function guessHarpType(raw: string): HarpType {
  const toks = rawTokens(raw);
  const holes = toks.map((t) => /^[+-]?<?(\d+)/.exec(t.replace(/[−–]/g, '-'))?.[1]).filter(Boolean).map(Number);
  // tremolo châu Á đánh số tới 21 / 24 lỗ
  // (đoán 24 lỗ: phổ biến hơn, bài chơi được trên kèn 21 lỗ thì kèn 24 lỗ cũng chơi được)
  if (holes.some((h) => h > 16 && h <= 24)) return 'tremolo24';
  if (/tremolo/i.test(raw)) return 'tremolo24';
  if (holes.some((h) => h > 12 && h <= 16)) return 'chromatic16';
  if (/chromatic|chromonica|nút gạt/i.test(raw) || holes.some((h) => h > 10 && h <= 12)) return 'chromatic';
  if (toks.some((t) => /^[+-]?(<\d{1,2}|\d{1,2}[<*])$/.test(t))) return 'chromatic';
  return 'diatonic';
}

export function importTabText(raw: string, harpType?: HarpType): ImportResult {
  const text = raw.replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  const type = harpType ?? guessHarpType(text);
  const all = rawTokens(text);
  const conv: Conventions = {
    letters: all.some((t) => /^[Dd](10|[1-9])$|^(10|[1-9])[Dd]$/.test(t)) && all.some((t) => /^[Bb](10|[1-9])$|^(10|[1-9])B$/.test(t)),
    parens: all.some((t) => /^\((10|[1-9])['b^]*\)$/.test(t)) && !all.some((t) => /^[-−–](10|[1-9])/.test(t)),
  };

  let harpKey: HarpKey | null = null, title: string | null = null;
  const unknown = new Set<string>();
  type Row = { kind: 'tab'; tokens: string[] } | { kind: 'text'; text: string } | { kind: 'section'; text: string } | { kind: 'blank' };
  const rows: Row[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) { rows.push({ kind: 'blank' }); continue; }
    const tl = tabLine(trimmed, conv, type);
    if (tl) {
      rows.push({ kind: 'tab', tokens: tl.tokens });
      tl.unknown.forEach((u) => unknown.add(u));
      continue;
    }
    const km = KEY_RE.exec(trimmed);
    if (km && !harpKey) harpKey = normalizeKey(km[1]);
    if (SECTION_RE.test(trimmed)) { rows.push({ kind: 'section', text: trimmed.replace(/^[[(]\s*|\s*[\])]:?$|:$/g, '') }); continue; }
    rows.push({ kind: 'text', text: trimmed });
  }

  const firstTab = rows.findIndex((r) => r.kind === 'tab');
  const textOf = (i: number) => { const r = rows[i]; return r && r.kind === 'text' ? r.text : null; };
  const tabOf = (i: number) => { const r = rows[i]; return r && r.kind === 'tab' ? r.tokens : null; };
  /** dòng chữ i có thể là lời của dòng tab j: số âm tiết tương xứng với số nốt */
  const fits = (i: number, j: number) => {
    const t = textOf(i), tab = tabOf(j);
    if (!t || !tab || KEY_RE.test(t)) return false;
    const n = tab.filter((x) => x !== 'r').length, syl = splitLyrics(t).length;
    return syl >= 0.4 * n && syl <= 1.5 * n + 1; // lời thường mỗi âm tiết một nốt
  };
  // kiểu của cả bài: lời nằm TRÊN dòng tab nếu có lời ngay trước dòng tab đầu tiên và bài kết thúc bằng dòng tab
  const content = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === 'tab' || r.kind === 'text');
  const lyricsAbove = firstTab > 0 && fits(firstTab - 1, firstTab) && content[content.length - 1]?.r.kind === 'tab';

  // tiêu đề: dòng chữ ngắn đầu tiên trước dòng tab đầu tiên (không phải tông kèn, không phải lời)
  let titleIdx = -1;
  for (let i = 0; i < (firstTab < 0 ? rows.length : firstTab); i++) {
    const t = textOf(i);
    if (t && t.length <= 60 && !KEY_RE.test(t) && !(lyricsAbove && i === firstTab - 1)) { title = t.replace(/[-–|:]+\s*$/, '').trim(); titleIdx = i; break; }
  }
  const isLyric = (i: number, tab: number) => i !== titleIdx && fits(i, tab);

  // app cần lời nằm DƯỚI dòng tab
  const out: string[] = [];
  const used = new Set<number>();
  rows.forEach((r, i) => {
    if (used.has(i)) return;
    if (r.kind === 'tab') {
      out.push(r.tokens.join(' '));
      if (lyricsAbove && isLyric(i - 1, i) && !used.has(i - 1)) { out.push(textOf(i - 1)!); used.add(i - 1); }
      else if (!lyricsAbove && isLyric(i + 1, i)) { out.push(textOf(i + 1)!); used.add(i + 1); }
      return;
    }
    if (r.kind === 'text') {
      if (i === titleIdx || KEY_RE.test(r.text)) return;
      if (lyricsAbove && isLyric(i, i + 1)) return; // để dòng tab phía dưới lấy làm lời
      if (r.text.length <= 40) out.push('', `# ${r.text}`); // dòng chữ ngắn đứng riêng → tiêu đề đoạn
      return; // chữ dài (giới thiệu, quảng cáo…) bỏ
    }
    if (r.kind === 'section') { out.push('', `# ${r.text}`); return; }
    if (out.length && out[out.length - 1] !== '') out.push('');
  });

  const body = out.filter((l, i, a) => !(l === '' && (i === 0 || a[i - 1] === ''))).join('\n').trim();
  const tabLines = body.split('\n').filter((l) => looksLikeTabLine(l, type)).length;
  const notes = body.split('\n').filter((l) => looksLikeTabLine(l, type)).reduce((t, l) => t + l.split(/\s+/).filter((x) => x && x !== 'r').length, 0);
  return { body, harpKey, harpType: type, title, tabLines, notes, unknown: [...unknown].slice(0, 20) };
}
