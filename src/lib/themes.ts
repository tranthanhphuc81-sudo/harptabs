/**
 * Bảng màu giao diện. Mỗi bảng có bản sáng và bản tối; chế độ sáng / tối / theo máy chọn riêng.
 * Quy ước giữ nguyên ở mọi bảng: thổi = tông ấm, hút = tông lạnh, bend = đỏ hồng.
 * CSS của các bảng được dựng từ đây (themeCss) — sửa màu chỉ cần sửa file này.
 */

export type PaletteId = 'steel' | 'walnut' | 'blues' | 'forest' | 'rose' | 'contrast';
export type Mode = 'light' | 'dark';

export const COLOR_TOKENS = [
  'bg', 'surface', 'surface-2', 'line', 'line-strong', 'ink', 'ink-2',
  'steel-1', 'steel-2', 'steel-3',
  'blow', 'blow-fill', 'blow-edge', 'draw', 'draw-fill', 'draw-edge', 'bend', 'ok', 'focus',
  'accent', 'accent-ink', 'accent-soft', 'glass',
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type Tokens = Record<ColorToken, string>;

export interface Palette {
  id: PaletteId;
  name: string;
  hint: string;
  light: Tokens;
  dark: Tokens;
  /** màu thanh trạng thái điện thoại (meta theme-color) */
  bar: Record<Mode, string>;
}

const t = (s: string): Tokens => {
  const v = s.trim().split(/\s+/);
  if (v.length !== COLOR_TOKENS.length) throw new Error(`Bảng màu thiếu / thừa: ${v.length}`);
  return Object.fromEntries(COLOR_TOKENS.map((k, i) => [k, v[i]])) as Tokens;
};

// thứ tự giá trị đúng như COLOR_TOKENS
export const PALETTES: Palette[] = [
  {
    id: 'steel',
    name: 'Thép',
    hint: 'Xám thép, nút đồng thau',
    light: t(`#f3f5f7 #ffffff #edf0f3 #e1e6ea #cbd3da #17212a #5a6773 #dfe4e8 #aeb8c0 #7d8892
      #95600c #f9ebcd #e3bd72 #22589b #dfe9f7 #94b5df #b3264a #2e7d4f #2f6db5 #d08a1e #1d1406 #fbefd8 rgba(255,255,255,0.82)`),
    dark: t(`#0e1317 #161d23 #1f272e #29333b #3a4650 #e6ebef #97a5b0 #3a4650 #56636e #8a97a1
      #eab456 #33270f #6e5422 #7eb0ee #14263b #2f5482 #f07592 #63c48b #7eb0ee #f0b24a #1d1406 #2e2410 rgba(22,29,35,0.8)`),
    bar: { light: '#1f2a33', dark: '#0e1317' },
  },
  {
    id: 'walnut',
    name: 'Gỗ ấm',
    hint: 'Giấy kem, gỗ óc chó — ấm mắt khi tập lâu',
    light: t(`#f5efe6 #fffaf3 #efe5d6 #e4d6c2 #cfbb9f #2b1f14 #6f5c49 #e6dccd #b9a78f #8c7a64
      #8f4a0e #f7e3c9 #dfae73 #2c5868 #dcebee #8fb9c4 #a82d3c #3a7336 #8a4b14 #a35a1f #fffaf3 #f6e2cc rgba(255,250,243,0.85)`),
    dark: t(`#17110c #211912 #2b2118 #3a2d22 #4d3d2f #f1e6d8 #b9a58e #4d3d2f #6b5845 #a08c75
      #f0a85a #3a2614 #7a5129 #86c2d3 #13272d #2f5a66 #f07a86 #8fc985 #f0a85a #e0934b #1f1209 #33220f rgba(33,25,18,0.82)`),
    bar: { light: '#3a2a1c', dark: '#17110c' },
  },
  {
    id: 'blues',
    name: 'Blues đêm',
    hint: 'Xanh chàm và vàng sax — chất quán bar',
    light: t(`#eef0fb #ffffff #e6e9f8 #d9ddf2 #bcc3e6 #1a1f3d #565d85 #dde1f3 #a9b0d6 #7a82ad
      #9a520a #fbe9d2 #ebb36e #333eae #e1e4fb #9aa2ec #b8235f #2a7656 #4b55d6 #4b55d6 #ffffff #e3e5fb rgba(255,255,255,0.84)`),
    dark: t(`#0b0e24 #13173a #1b2049 #262c5a #353d73 #e7e9ff #9ea4d6 #353d73 #4f5895 #8890c6
      #ffb35c #35240f #7a5323 #9aa5ff #161c4d #3a4594 #ff6fa8 #5fd3a0 #9aa5ff #f5b942 #1a1204 #2a2410 rgba(19,23,58,0.82)`),
    bar: { light: '#1e2350', dark: '#0b0e24' },
  },
  {
    id: 'forest',
    name: 'Rừng thông',
    hint: 'Xanh rêu, đất nung — dịu và tự nhiên',
    light: t(`#eef3ee #fbfdfb #e4ece5 #d6e1d8 #b7c8ba #17261c #516b5b #dbe5dd #a6b9aa #77907d
      #944619 #f6e2d4 #dca37f #1d6656 #d7ece6 #86c0b2 #a92b48 #2c7438 #2c7a63 #2f7d55 #ffffff #dcefe2 rgba(251,253,251,0.85)`),
    dark: t(`#0c140f #131e17 #1a271f #24352a #33483a #e3eee6 #98b0a0 #33483a #4d6655 #86a08e
      #f0a070 #35200f #7a4a2a #6fd0b8 #102a24 #2c6457 #f27a93 #7fd68f #6fd0b8 #5cc48c #08140d #15301f rgba(19,30,23,0.82)`),
    bar: { light: '#1f3a2a', dark: '#0c140f' },
  },
  {
    id: 'rose',
    name: 'Hoa đào',
    hint: 'Hồng phấn, tím mận — nhẹ nhàng, tươi',
    light: t(`#fbf1f3 #ffffff #f6e6ea #efd9df #ddb9c3 #2e1a22 #74545f #f0dfe4 #c9a6b1 #9a7884
      #974511 #fbe4d3 #e8a978 #643a92 #ece2f7 #b79ddc #b8224b #2d7651 #b43c6c #c2477a #ffffff #f9dfe8 rgba(255,255,255,0.84)`),
    dark: t(`#170d12 #22141b #2c1a23 #3b2530 #4f3340 #f6e8ee #c2a2b0 #4f3340 #6e4d5c #a8879a
      #f4a26a #38200f #7d4a28 #c3a0f0 #241838 #5a4285 #ff7a9f #79d1a1 #f08fb3 #f08fb3 #2a0d18 #3a1a28 rgba(34,20,27,0.82)`),
    bar: { light: '#4a2433', dark: '#170d12' },
  },
  {
    id: 'contrast',
    name: 'Tương phản cao',
    hint: 'Đen trắng rõ nét — dễ đọc khi để xa, nắng gắt',
    light: t(`#ffffff #ffffff #f0f0f0 #8a8a8a #000000 #000000 #333333 #e0e0e0 #8a8a8a #444444
      #6b3300 #ffe2b8 #6b3300 #002f8f #d6e4ff #002f8f #a3001b #006b2e #0040c0 #ffcc00 #000000 #fff3b0 rgba(255,255,255,0.96)`),
    dark: t(`#000000 #0a0a0a #1a1a1a #8a8a8a #ffffff #ffffff #d6d6d6 #333333 #8a8a8a #cfcfcf
      #ffb84d #2e1a00 #ffb84d #8fc1ff #001a40 #8fc1ff #ff6b81 #5cff9d #ffff00 #ffd400 #000000 #2a2400 rgba(10,10,10,0.95)`),
    bar: { light: '#000000', dark: '#000000' },
  },
];

export const DEFAULT_PALETTE: PaletteId = 'steel';
export const paletteOf = (id: string | undefined): Palette => PALETTES.find((p) => p.id === id) ?? PALETTES[0];

const SHADOWS: Record<Mode, string> = {
  light: '--shadow-sm: 0 1px 2px rgba(23,33,42,0.05), 0 1px 1px rgba(23,33,42,0.03); --shadow: 0 1px 2px rgba(23,33,42,0.05), 0 10px 28px -12px rgba(23,33,42,0.22);',
  dark: '--shadow-sm: 0 1px 2px rgba(0,0,0,0.35); --shadow: 0 1px 2px rgba(0,0,0,0.35), 0 12px 30px -12px rgba(0,0,0,0.75);',
};

const block = (sel: string, tk: Tokens, mode: Mode) =>
  `${sel}{${COLOR_TOKENS.map((k) => `--${k}:${tk[k]};`).join('')}${SHADOWS[mode]}color-scheme:${mode};}`;

/**
 * CSS của mọi bảng màu. Áp được cho bất kỳ phần tử nào có data-palette (cả gốc trang lẫn
 * thẻ xem trước trong Cài đặt); data-mode="dark" chọn bản tối.
 */
export function themeCss(): string {
  return PALETTES.map((p) =>
    block(`[data-palette='${p.id}']`, p.light, 'light') + block(`[data-palette='${p.id}'][data-mode='dark']`, p.dark, 'dark'),
  ).join('\n');
}

export type ThemeMode = 'system' | Mode;

export const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
export const effectiveMode = (m: ThemeMode): Mode => (m === 'system' ? (systemDark() ? 'dark' : 'light') : m);

/** cất bản sao nhỏ để index.html áp theme ngay khi mở app, trước khi đọc xong IndexedDB */
export const THEME_CACHE_KEY = 'harptabs-theme';

export function applyTheme(palette: string | undefined, mode: ThemeMode) {
  const p = paletteOf(palette);
  const m = effectiveMode(mode);
  const root = document.documentElement;
  root.dataset.palette = p.id;
  root.dataset.mode = m;
  root.style.background = p[m].bg;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bar[m]);
  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ palette: p.id, mode, bg: { light: p.light.bg, dark: p.dark.bg }, bar: p.bar }));
  } catch { /* chế độ riêng tư */ }
}

/** gắn CSS các bảng màu vào trang (một lần, trước khi vẽ giao diện) */
export function installThemes() {
  if (document.getElementById('harptabs-themes')) return;
  const el = document.createElement('style');
  el.id = 'harptabs-themes';
  el.textContent = themeCss();
  document.head.appendChild(el);
}

// ----- độ tương phản (WCAG 2) — dùng trong test để mọi bảng màu đọc rõ -----

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
