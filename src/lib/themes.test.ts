import { describe, expect, it } from 'vitest';
import { COLOR_TOKENS, contrast, PALETTES, themeCss } from './themes';

/** cặp [chữ, nền, tỉ lệ tối thiểu] — 4.5 = chuẩn WCAG AA cho chữ thường, 3 = cho viền / vòng focus */
const PAIRS: [string, string, number][] = [
  ['ink', 'bg', 7], ['ink', 'surface', 7], ['ink', 'surface-2', 4.5],
  ['ink-2', 'bg', 4.5], ['ink-2', 'surface', 4.5],
  ['blow', 'blow-fill', 4.5], ['draw', 'draw-fill', 4.5],
  ['blow', 'surface', 4.5], ['draw', 'surface', 4.5], ['draw', 'bg', 4.5],
  ['bend', 'surface', 4.5], ['ok', 'surface', 4.5],
  ['accent-ink', 'accent', 4.5], ['ink', 'accent-soft', 4.5],
  ['focus', 'bg', 3],
];

describe('bảng màu', () => {
  for (const p of PALETTES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${p.name} (${mode === 'light' ? 'sáng' : 'tối'}) đủ tương phản để đọc`, () => {
        const tk = p[mode] as Record<string, string>;
        const bad = PAIRS
          .map(([a, b, min]) => ({ pair: `${a}/${b}`, ratio: Math.round(contrast(tk[a], tk[b]) * 100) / 100, min }))
          .filter((x) => x.ratio < x.min);
        expect(bad).toEqual([]);
      });
    }
  }

  it('mọi bảng có đủ màu, id không trùng, CSS dựng đủ bản sáng và tối', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    for (const p of PALETTES) for (const k of COLOR_TOKENS) { expect(p.light[k]).toBeTruthy(); expect(p.dark[k]).toBeTruthy(); }
    const css = themeCss();
    for (const p of PALETTES) {
      expect(css).toContain(`[data-palette='${p.id}']{`);
      expect(css).toContain(`[data-palette='${p.id}'][data-mode='dark']{`);
    }
  });
});
