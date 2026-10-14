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
      for (const key of ['kick', 'snare', 'hat', 'openHat', 'rim', 'shaker', 'bongo', 'conga', 'guiro', 'clave', 'cowbell', 'comp', 'clap', 'ride'] as const) {
        const tr = p[key];
        if (!tr) continue;
        expect(tr.length % bar, `${name}.${key}`).toBe(0);
        expect(tr, `${name}.${key}`).toMatch(ALLOWED[key] ?? /^[.xXg]+$/);
      }
      if (p.bassLine) {
        expect(p.bassLine.length % bar, `${name}.bassLine`).toBe(0);
        expect(p.bassLine, `${name}.bassLine`).toMatch(/^[.roftaw]+$/);
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

  it('valse: um ở phách 1, pa pa (hợp âm đệm) ở phách 2, 3', () => {
    const p = PATTERNS.waltz;
    expect(p.kick![0]).toBe('X');
    expect([2, 4].every((i) => p.comp![i] !== '.')).toBe(true);
  });

  it('bolero, rumba, cha cha có tiếng đệm hợp âm, không đè lên phách 1', () => {
    for (const name of ['bolero', 'rumba', 'chacha'] as const) {
      const c = PATTERNS[name].comp!;
      expect(c, name).toMatch(/x/);
      expect(c[0], name).toBe('.');
    }
  });

  it('slow rock: đệm hợp âm đủ 12 chùm ba, nhấn đầu phách', () => {
    const c = PATTERNS.slowrock.comp!;
    expect(c).toHaveLength(12);
    expect([0, 3, 6, 9].every((i) => c[i] === 'X')).toBe(true);
  });

  it('ballad và tango có tiếng đệm hợp âm ở mỗi phách', () => {
    for (const name of ['ballad', 'tango'] as const) {
      const p = PATTERNS[name];
      const per = p.subdiv;
      for (let b = 0; b < p.beats; b++) expect(p.comp![b * per], `${name} phách ${b + 1}`).not.toBe('.');
    }
  });

  it('rock, shuffle, train: nhấn hợp âm ở phách 2 và 4', () => {
    for (const name of ['rock', 'shuffle', 'train'] as const) {
      const p = PATTERNS[name];
      for (const beat of [1, 3]) expect(p.comp![beat * p.subdiv], `${name} phách ${beat + 1}`).toBe('X');
    }
  });

  it('mọi kiểu nhịp đều có tiếng đệm hợp âm', () => {
    for (const [name, p] of Object.entries(PATTERNS)) expect(p.comp, name).toBeTruthy();
  });

  it('bossa nova: bass 1, 2&, 3, 4& và clave bossa', () => {
    const on = (s: string) => [...s.slice(0, 16)].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0);
    expect(on(PATTERNS.bossa.kick!)).toEqual([0, 6, 8, 14]);
    expect(on(PATTERNS.bossa.rim!)).toEqual([0, 3, 6, 10, 13]);
  });

  it('disco: trống bass dậm đều 4 phách, hi-hat mở nửa sau phách, bass nhảy quãng tám', () => {
    const p = PATTERNS.disco;
    expect([0, 4, 8, 12].every((i) => p.kick![i] === 'X')).toBe(true);
    expect([2, 6, 10, 14].every((i) => p.openHat![i] === 'X')).toBe(true);
    expect(p.bassLine!.slice(0, 4)).toBe('r.o.');
  });

  it('jazz swing: ride "ding – ding-a", hi-hat chân 2 & 4, bass walking mỗi phách', () => {
    const p = PATTERNS.jazz;
    const on = (s: string) => [...s.slice(0, 12)].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0);
    expect(on(p.ride!)).toEqual([0, 3, 5, 6, 9, 11]);
    expect(on(p.hat!)).toEqual([3, 9]);
    expect(on(p.bassLine!)).toEqual([0, 3, 6, 9]);
  });

  it('reggae one drop: kick + gõ vành chỉ ở phách 3, skank ở 2 & 4', () => {
    const p = PATTERNS.reggae;
    const on = (s: string) => [...s.slice(0, 16)].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0);
    expect(on(p.kick!)).toEqual([8]);
    expect(on(p.rim!)).toEqual([8]);
    expect(on(p.comp!)).toEqual([4, 12]);
  });

  it('ska: guitar chặt ở mọi nửa sau phách, bass walking mỗi phách', () => {
    const p = PATTERNS.ska;
    const on = (s: string) => [...s].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0);
    expect(on(p.comp!)).toEqual([1, 3, 5, 7]);
    expect(p.bassLine).toBe('w.w.w.w.');
  });

  it('country: bass gốc ở phách 1, quãng 5 ở phách 3, hợp âm ở 2 & 4', () => {
    const p = PATTERNS.country;
    expect(p.bassLine![0]).toBe('r');
    expect(p.bassLine![8]).toBe('f');
    const on = (s: string) => [...s.slice(0, 16)].map((ch, i) => (ch !== '.' ? i : -1)).filter((i) => i >= 0);
    expect(on(p.comp!)).toEqual([4, 12]);
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
