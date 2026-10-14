import { describe, expect, it } from 'vitest';
import { PATTERNS } from './patterns';

const ALLOWED: Record<string, RegExp> = {
  bongo: /^[.ftsho]+$/,
  conga: /^[.tsol]+$/,
};

describe('beat mẫu', () => {
  for (const [name, p] of Object.entries(PATTERNS)) {
    it(`${name}: mỗi track dài đúng bội số ô nhịp, ký hiệu hợp lệ`, () => {
      const bar = p.beats * p.subdiv;
      for (const key of ['kick', 'snare', 'hat', 'openHat', 'rim', 'shaker', 'bongo', 'conga', 'guiro'] as const) {
        const tr = p[key];
        if (!tr) continue;
        expect(tr.length % bar, `${name}.${key}`).toBe(0);
        expect(tr, `${name}.${key}`).toMatch(ALLOWED[key] ?? /^[.xX]+$/);
      }
    });
  }

  it('bolero: trống bass đánh phách 1, nửa sau phách 2 và phách 3', () => {
    const k = PATTERNS.bolero.kick!;
    expect([0, 6, 8].every((i) => k[i] !== '.')).toBe(true);
  });
});
