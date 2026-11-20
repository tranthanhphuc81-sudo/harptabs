/**
 * Song ngữ Việt / Anh. Chữ gốc trong mã là tiếng Việt, cũng là khoá tra từ điển (i18n.en.ts):
 * t('Đã lưu {0} bài', n) → "Saved {0} songs". Thiếu bản dịch thì hiện nguyên tiếng Việt.
 * Ngôn ngữ chọn một lần lúc mở app; đổi ngôn ngữ thì tải lại trang (chữ ở cấp module cũng được dịch đúng).
 */
import { EN } from './i18n.en';

export type Lang = 'vi' | 'en';
const KEY = 'sotab-lang';

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'vi' || v === 'en' ? v : null;
  } catch { return null; }
}

/** máy có tiếng Việt trong danh sách ngôn ngữ, hoặc đặt múi giờ Việt Nam → tiếng Việt; còn lại tiếng Anh */
export function detectLang(languages: readonly string[], timeZone: string | undefined): Lang {
  if (languages.some((l) => /^vi\b/i.test(l))) return 'vi';
  if (timeZone === 'Asia/Ho_Chi_Minh' || timeZone === 'Asia/Saigon') return 'vi';
  return languages.length ? 'en' : 'vi';
}

function initial(): Lang {
  // vite.config.ts cũng nạp file này (qua themes.ts) — lúc đó không có import.meta.env
  const env = (import.meta as { env?: { MODE?: string } }).env;
  if (!env || env.MODE === 'test') return 'vi';
  // link từ trang giới thiệu: ?lang=en / ?lang=vi — nhớ lựa chọn rồi xoá khỏi địa chỉ,
  // không thì mỗi lần tải lại (kể cả lúc bấm đổi ngôn ngữ) lại bị ép về ngôn ngữ trong link
  try {
    const q = new URLSearchParams(location.search).get('lang');
    dropLangParam();
    if (q === 'vi' || q === 'en') {
      try { localStorage.setItem(KEY, q); } catch { /* chế độ riêng tư */ }
      return q;
    }
  } catch { /* không có location */ }
  const s = saved();
  if (s) return s;
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    const langs = nav?.languages?.length ? nav.languages : nav?.language ? [nav.language] : [];
    return detectLang(langs, Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch { return 'vi'; }
}

export const LANG: Lang = initial();
/** dùng cho toLocaleString / Intl */
export const LOCALE = LANG === 'en' ? 'en-US' : 'vi-VN';
/** người dùng đã tự chọn ngôn ngữ chưa (chưa thì đang theo máy) */
export const LANG_CHOSEN = saved() !== null;

try { if (typeof document !== 'undefined') document.documentElement.lang = LANG; } catch { /* bỏ qua */ }

/** đổi ngôn ngữ (null = theo máy) rồi tải lại trang */
export function setLang(lang: Lang | null) {
  try {
    if (lang) localStorage.setItem(KEY, lang);
    else localStorage.removeItem(KEY);
  } catch { /* chế độ riêng tư */ }
  dropLangParam();
  location.reload();
}

/** bỏ ?lang= khỏi địa chỉ đang mở (giữ nguyên các tham số khác và phần #/trang) */
function dropLangParam() {
  try {
    const u = new URL(location.href);
    if (!u.searchParams.has('lang')) return;
    u.searchParams.delete('lang');
    history.replaceState(history.state, '', u.pathname + u.search + u.hash);
  } catch { /* không có location / history */ }
}

/**
 * Dịch một câu. {0}, {1}… thay bằng tham số; trong bản dịch có thể viết {0|song|songs} để chọn số ít / số nhiều theo tham số đó.
 */
export function t(s: string, ...args: (string | number | boolean | null | undefined)[]): string {
  // 'Tông {0}||nhạc cụ': phần sau "||" chỉ để tách nghĩa khi dịch, tiếng Việt không hiện
  const cut = s.indexOf('||');
  let out = LANG === 'en' ? (EN[s] ?? (cut >= 0 ? s.slice(0, cut) : s)) : cut >= 0 ? s.slice(0, cut) : s;
  if (args.length) {
    // {0^}: viết hoa chữ đầu của tham số ("{0^} type" → "Harmonica type")
    out = out.replace(/\{(\d+)(\^)?(?:\|([^|}]*)\|([^}]*))?\}/g, (m: string, i: string, cap?: string, one?: string, many?: string) => {
      if (+i >= args.length) return m;
      const v = args[+i];
      if (one !== undefined) return Number(v) === 1 ? one : many!;
      // như JSX: null / undefined / false không hiện gì
      const str = v === null || v === undefined || v === false || v === true ? '' : String(v);
      return cap ? str.charAt(0).toUpperCase() + str.slice(1) : str;
    });
  }
  return out;
}
