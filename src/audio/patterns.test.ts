import { describe, expect, it } from 'vitest';
import { BO_PATTERN_LIST, boPattern, PATTERNS } from './patterns';

const ALLOWED: Record<string, RegExp> = {
  bongo: /^[.ftsho]+$/,
  conga: /^[.tsol]+$/,
};

describe('beat mẫu', () => {
  for (const [name, p] of Object.entries(PATTERNS)) {
    it(`${name}: mỗi track dài đúng bội số ô nhịp, ký hiệu hợp lệ`, () => {
      const bar = p.beats * p.subdiv;
      for (const key of ['kick', 'snare', 'hat', 'openHat', 'rim', 'shaker', 'bongo', 'conga', 'guiro', 'clave', 'cowbell'] as const) {
        const tr = p[key];
        if (!tr) continue;
        expect(tr.length % bar, `${name}.${key}`).toBe(0);
        expect(tr, `${name}.${key}`).toMatch(ALLOWED[key] ?? /^[.xX]+$/);
      }
    });
  }

  it('gõ bo: có lớp bongo hợp lệ cho mọi kiểu nhịp', () => {
    for (const [meter, tr] of Object.entries(BO_PATTERN_LIST)) {
      const [beats, subdiv] = meter.split('/').map(Number);
      expect(tr.length % (beats * subdiv), meter).toBe(0);
      expect(tr, meter).toMatch(/^[.ftsho]+$/);
    }
    for (const [name, p] of Object.entries(PATTERNS)) expect(boPattern(p), name).toBeTruthy();
  });

  it('cha cha: nhấn "cha-cha" ở phách 4 và 4&, chuông đều 4 phách', () => {
    const p = PATTERNS.chacha;
    expect(p.rim![12]).not.toBe('.');
    expect(p.rim![14]).not.toBe('.');
    expect(p.conga![12]).toBe('o');
    expect(p.conga![14]).toBe('o');
    expect([0, 4, 8, 12].every((i) => p.cowbell![i] !== '.')).toBe(true);
  });

  it('tango: bass habanera (1, 1a, 2, 2&) và snare dồn cuối ô', () => {
    const k = PATTERNS.tango.kick!.slice(0, 16);
    expect([...k].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0).slice(0, 4)).toEqual([0, 3, 4, 6]);
    expect(PATTERNS.tango.snare!.slice(28)).toBe('Xxxx');
  });

  it('rumba: clave rumba 3-2 (1, 1a, 2&… 3&, 4)', () => {
    const c = PATTERNS.rumba.clave!.slice(0, 16);
    expect([...c].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0)).toEqual([0, 3, 7, 10, 12]);
  });

  it('bolero: trống bass đánh phách 1, nửa sau phách 2 và phách 3', () => {
    const k = PATTERNS.bolero.kick!;
    expect([0, 6, 8].every((i) => k[i] !== '.')).toBe(true);
  });
});
