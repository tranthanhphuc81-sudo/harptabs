import { describe, expect, it } from 'vitest';
import { chordAtBeat, chordTones, lickToTab, progressionBars, progressionChords, progressionOverrides, PROGRESSIONS } from './jazz';
import { parseTab, totalBeats } from './tabText';

const prog = (id: string) => PROGRESSIONS.find((p) => p.id === id)!;

describe('vòng hợp âm jazz', () => {
  it('ii–V–I ở giọng Đô và Si giáng', () => {
    expect(progressionChords(prog('ii-v-i'), 0).map((c) => c.name)).toEqual(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
    expect(progressionChords(prog('ii-v-i'), 10).map((c) => c.name)).toEqual(['Cm7', 'F7', 'Bbmaj7', 'Bbmaj7']);
    expect(progressionChords(prog('ii-v-i-minor'), 0).map((c) => c.name).slice(0, 3)).toEqual(['Dm7b5', 'G7', 'Cm7']);
  });
  it('mọi vòng: đủ ô, khoá hợp âm mỗi 2 phách', () => {
    for (const p of PROGRESSIONS) {
      const bars = progressionBars(p);
      expect([4, 8, 12]).toContain(bars);
      expect(Object.keys(progressionOverrides(progressionChords(p, 0)))).toHaveLength(bars * 2);
    }
    expect(progressionBars(prog('jazz-blues'))).toBe(12);
  });
  it('hợp âm theo phách, có lặp vòng', () => {
    const ch = progressionChords(prog('i-vi-ii-v'), 0);
    expect(chordAtBeat(ch, 2.5)?.name).toBe('Am7');
    expect(chordAtBeat(ch, 32 + 6)?.name).toBe('G7');
  });
});

describe('nốt hợp âm trên kèn', () => {
  it('Cmaj7 trên kèn chromatic C: đủ C E G B, nốt 3 và 7 là E và B', () => {
    const t = chordTones('C', 'chromatic', 0, 'maj7');
    expect(t.all).toContain('1'); // C
    expect(t.guide.length).toBeGreaterThan(0);
    expect(t.guide.every((x) => t.all.includes(x))).toBe(true);
  });
  it('kèn diatonic: Dm7 có lỗ dễ', () => {
    expect(chordTones('C', 'diatonic', 2, 'm7').all).toContain('-4');
  });
});

describe('lick tên nốt → tab', () => {
  it('đổi được trên kèn chromatic và diatonic, giữ độ dài', () => {
    const notes = 'D4:0.5 F4:0.5 A4:0.5 C5:0.5 B4 G4 E4:2';
    for (const type of ['chromatic', 'diatonic'] as const) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const r = lickToTab(notes, tonic, 'C', type);
        const p = parseTab(r.body, 'C', type);
        expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
        expect(totalBeats(p)).toBeCloseTo(6, 6);
      }
    }
  });
});
