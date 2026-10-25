/**
 * Bảng mã chữ Việt cũ trong file MIDI karaoke: Unicode (UTF-8), Windows-1258, VNI-Windows, TCVN3 (ABC).
 * Máy đoán theo cả file: thử từng bảng mã, bảng mã cho ra nhiều chữ Việt hợp lệ nhất (ít ký tự lạ nhất) thắng.
 */

export type VnEncoding = 'utf8' | 'cp1258' | 'vni' | 'tcvn3' | 'latin1';

export const VN_ENCODINGS: { value: VnEncoding; label: string }[] = [
  { value: 'utf8', label: 'Unicode (UTF-8)' },
  { value: 'cp1258', label: 'Windows-1258' },
  { value: 'vni', label: 'VNI (VNI-Times…)' },
  { value: 'tcvn3', label: 'TCVN3 / ABC (.VnTime…)' },
  { value: 'latin1', label: 'Không dấu / Latin' },
];

const latin1 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return s; };

// ───── TCVN3 (ABC): mỗi chữ có dấu là một byte; chữ hoa có dấu dùng font riêng nên trong file là chữ thường
const TCVN3: Record<number, string> = {
  0xa1: 'Ă', 0xa2: 'Â', 0xa3: 'Ê', 0xa4: 'Ô', 0xa5: 'Ơ', 0xa6: 'Ư', 0xa7: 'Đ',
  0xa8: 'ă', 0xa9: 'â', 0xaa: 'ê', 0xab: 'ô', 0xac: 'ơ', 0xad: 'ư', 0xae: 'đ',
  0xb5: 'à', 0xb6: 'ả', 0xb7: 'ã', 0xb8: 'á', 0xb9: 'ạ',
  0xbb: 'ằ', 0xbc: 'ẳ', 0xbd: 'ẵ', 0xbe: 'ắ', 0xc6: 'ặ',
  0xc7: 'ầ', 0xc8: 'ẩ', 0xc9: 'ẫ', 0xca: 'ấ', 0xcb: 'ậ',
  0xcc: 'è', 0xce: 'ẻ', 0xcf: 'ẽ', 0xd0: 'é', 0xd1: 'ẹ',
  0xd2: 'ề', 0xd3: 'ể', 0xd4: 'ễ', 0xd5: 'ế', 0xd6: 'ệ',
  0xd7: 'ì', 0xd8: 'ỉ', 0xdc: 'ĩ', 0xdd: 'í', 0xde: 'ị',
  0xdf: 'ò', 0xe1: 'ỏ', 0xe2: 'õ', 0xe3: 'ó', 0xe4: 'ọ',
  0xe5: 'ồ', 0xe6: 'ổ', 0xe7: 'ỗ', 0xe8: 'ố', 0xe9: 'ộ',
  0xea: 'ờ', 0xeb: 'ở', 0xec: 'ỡ', 0xed: 'ớ', 0xee: 'ợ',
  0xef: 'ù', 0xf1: 'ủ', 0xf2: 'ũ', 0xf3: 'ú', 0xf4: 'ụ',
  0xf5: 'ừ', 0xf6: 'ử', 0xf7: 'ữ', 0xf8: 'ứ', 0xf9: 'ự',
  0xfa: 'ỳ', 0xfb: 'ỷ', 0xfc: 'ỹ', 0xfd: 'ý', 0xfe: 'ỵ',
};
const tcvn3 = (b: Uint8Array) => { let s = ''; for (const x of b) s += TCVN3[x] ?? String.fromCharCode(x); return s; };

// ───── VNI-Windows: chữ cái + byte dấu đứng sau ("Vieät" = Việt, "Ngöôøi" = Người)
const GRAVE = '\u0300', ACUTE = '\u0301', TILDE = '\u0303', HOOK = '\u0309', DOT = '\u0323', CIRC = '\u0302', BREVE = '\u0306';
/** byte dấu (chữ thường / chữ hoa) → dấu kết hợp; `on` = chỉ gắn vào các nguyên âm này */
const VNI_MARKS: Record<string, { m: string; on?: string }> = {
  'ù': { m: ACUTE }, 'ø': { m: GRAVE }, 'û': { m: HOOK }, 'õ': { m: TILDE }, 'ï': { m: DOT },
  'â': { m: CIRC, on: 'aeo' }, 'á': { m: CIRC + ACUTE, on: 'aeo' }, 'à': { m: CIRC + GRAVE, on: 'aeo' },
  'å': { m: CIRC + HOOK, on: 'aeo' }, 'ã': { m: CIRC + TILDE, on: 'aeo' }, 'ä': { m: CIRC + DOT, on: 'aeo' },
  'ê': { m: BREVE, on: 'a' }, 'é': { m: BREVE + ACUTE, on: 'a' }, 'è': { m: BREVE + GRAVE, on: 'a' },
  'ú': { m: BREVE + HOOK, on: 'a' }, 'ü': { m: BREVE + TILDE, on: 'a' }, 'ë': { m: BREVE + DOT, on: 'a' },
};
for (const [k, v] of Object.entries({ ...VNI_MARKS })) VNI_MARKS[k.toUpperCase()] = v;
/** ký tự VNI đứng riêng */
const VNI_LETTERS: Record<string, string> = {
  'ô': 'ơ', 'ö': 'ư', 'ñ': 'đ', 'ó': 'í', 'ì': 'ì', 'æ': 'ỉ', 'ò': 'ị', 'î': 'ĩ',
  'Ô': 'Ơ', 'Ö': 'Ư', 'Ñ': 'Đ', 'Ó': 'Í', 'Ì': 'Ì', 'Æ': 'Ỉ', 'Ò': 'Ị', 'Î': 'Ĩ',
};
const VOWEL = /[aeiouyơưăâêô]/i;

/**
 * `st.base`: nguyên âm gốc của ký tự vừa ghi (để biết byte dấu sau có gắn được không) — giữ qua các đoạn
 * vì lời karaoke tách từng ký tự để dấu ở sự kiện sau chữ cái.
 */
function vni(b: Uint8Array, st = { base: '' }): string {
  let out = '';
  let base = st.base;
  for (const ch of latin1(b)) {
    const mark = VNI_MARKS[ch];
    if (mark && base && (!mark.on || mark.on.includes(base.toLowerCase()))) {
      out += mark.m;
      base = mark.m.includes(CIRC) || mark.m.includes(BREVE) ? 'â' : base; // đã có mũ / trăng: chỉ còn nhận dấu thanh
      continue;
    }
    const c = VNI_LETTERS[ch] ?? ch;
    out += c;
    base = VOWEL.test(c) ? c.normalize('NFD')[0] : '';
  }
  st.base = base;
  // dấu đứng đầu đoạn (chữ cái ở đoạn trước) để nguyên dạng kết hợp: ghép chữ xong mới chuẩn hoá
  return out.normalize('NFC');
}

let cp: TextDecoder | null | undefined;
function cp1258(b: Uint8Array): string {
  if (cp === undefined) { try { cp = new TextDecoder('windows-1258'); } catch { cp = null; } }
  return cp ? cp.decode(b).normalize('NFC') : latin1(b);
}
const utf8 = new TextDecoder('utf-8');

export function decodeVn(b: Uint8Array, enc: VnEncoding): string {
  switch (enc) {
    case 'utf8': return utf8.decode(b).normalize('NFC');
    case 'cp1258': return cp1258(b);
    case 'vni': return vni(b);
    case 'tcvn3': return tcvn3(b);
    default: return latin1(b);
  }
}

/** bộ giải mã cho một chuỗi đoạn liên tiếp (lời từng ký tự): VNI nhớ chữ cái cuối của đoạn trước */
export function vnDecoder(enc: VnEncoding): (b: Uint8Array) => string {
  if (enc !== 'vni') return (b) => decodeVn(b, enc);
  const st = { base: '' };
  return (b) => vni(b, st);
}

const VN_LETTERS = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const VN_SET = new Set([...VN_LETTERS, ...VN_LETTERS.toUpperCase()]);
const TONED = new Set([...'àáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ'].flatMap((c) => [c, c.toUpperCase()]));

/** âm tiết tiếng Việt (đã bỏ dấu thanh, chữ thường): phụ âm đầu + vần + phụ âm cuối */
const SYLLABLE = /^(ngh|ng|nh|ch|gh|gi|kh|ph|qu|th|tr|[bcdđghklmnpqrstvx])?[aăâeêioôơuưy]{1,3}(ch|ng|nh|[cmnpt])?$/;
const TONE_MARKS = /[\u0300\u0301\u0303\u0309\u0323]/g;
const isSyllable = (w: string) => SYLLABLE.test(w.toLowerCase().normalize('NFD').replace(TONE_MARKS, '').normalize('NFC'));

/** điểm "giống tiếng Việt": chữ hợp lệ có dấu được cộng, chữ có ký tự lạ / hai dấu thanh bị trừ nặng */
export function vnScore(text: string): number {
  let score = 0;
  for (const w of text.normalize('NFC').split(/[\s/\\,.!?;:"'()[\]{}-]+/)) {
    if (!w) continue;
    let bad = false, toned = 0, vn = 0;
    for (const c of w) {
      if (c < '\u0080') continue;
      if (c === '�' || !VN_SET.has(c)) { bad = true; break; }
      vn++;
      if (TONED.has(c)) toned++;
    }
    if (bad || toned > 1 || (vn && !isSyllable(w))) score -= 3;
    else if (vn) score += 1;
  }
  return score;
}

/** Đoán bảng mã cho cả file (mọi đoạn chữ: lời, tên track, tên bài) */
export function detectVn(parts: Uint8Array[]): VnEncoding {
  const nonAscii = parts.filter((p) => p.some((x) => x >= 0x80));
  if (!nonAscii.length) return 'utf8';
  // lời tách từng ký tự: nối liền để chữ cái và dấu đi cùng nhau; đoạn dài hơn thì cách nhau dấu cách
  const short = parts.filter((p) => p.length <= 2).length > parts.length / 2;
  const bytes = new Uint8Array(parts.flatMap((p) => (short ? [...p] : [...p, 0x20])));
  // UTF-8 hợp lệ thì gần như chắc chắn là UTF-8
  if (!utf8.decode(bytes).includes('�')) return 'utf8';
  let best: VnEncoding = 'latin1', bestScore = -Infinity;
  for (const enc of ['cp1258', 'vni', 'tcvn3', 'latin1'] as const) {
    const s = vnScore(decodeVn(bytes, enc));
    if (s > bestScore) { best = enc; bestScore = s; }
  }
  return best;
}

/**
 * Chữ đã lưu bị vỡ dấu (bài nhập trước khi app nhận được VNI / TCVN3: mỗi byte thành một ký tự Latin-1,
 * kiểu "Toâi ñi hoïc", "T«i ®i häc"): đọc lại các đoạn ký tự ≤ 0xFF theo bảng mã cũ.
 * Chỉ trả kết quả khi rõ ràng giống tiếng Việt hơn hẳn (chữ Việt đúng không bao giờ bị đổi nhầm).
 */
export function fixGarbled(...texts: string[]): { enc: VnEncoding; fix: (s: string) => string } | null {
  const joined = texts.join('\n');
  if (!/[\u0080-ÿ]/.test(joined)) return null;
  // chỉ đọc lại các đoạn ký tự một byte (≤ 0xFF) có chữ ngoài ASCII; chữ Unicode khác giữ nguyên
  const via = (enc: VnEncoding) => (s: string) => s.replace(/[\t\n\r -ÿ]+/g, (run) => (/[\u0080-ÿ]/.test(run) ? decodeVn(bytes(run), enc) : run));
  const before = vnScore(joined);
  let best: { enc: VnEncoding; score: number } | null = null;
  for (const enc of ['vni', 'tcvn3', 'cp1258'] as const) {
    const score = vnScore(via(enc)(joined));
    if (!best || score > best.score) best = { enc, score };
  }
  if (!best || best.score - before < 3) return null;
  return { enc: best.enc, fix: via(best.enc) };
}

const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
