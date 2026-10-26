import { describe, expect, it } from 'vitest';
import { barAt, bluesChords, bluesOverrides, bluesScaleTokens, bluesTonic, chordToneTokens, isCallBar, JAM_BEATS, jamEvents } from './blues';

describe('khung blues 12 ô', () => {
  it('kèn C chơi blues giọng Sol: I I I I / IV IV I I / V IV I V', () => {
    expect(bluesTonic('C')).toBe(7);
    expect(bluesChords(7, 'basic')).toEqual(['G', 'G', 'G', 'G', 'C', 'C', 'G', 'G', 'D', 'C', 'G', 'D']);
    expect(bluesChords(7, 'quick')[1]).toBe('C');
  });
  it('tông giáng ghi giáng: kèn Eb chơi giọng Bb', () => {
    expect(bluesChords(bluesTonic('Eb'), 'basic').slice(0, 5)).toEqual(['Bb', 'Bb', 'Bb', 'Bb', 'Eb']);
  });
  it('mỗi nửa ô một khoá hợp âm', () => {
    const o = bluesOverrides(bluesChords(7, 'basic'));
    expect(Object.keys(o)).toHaveLength(24);
    expect(o['16']).toBe('C');
    expect(o['46']).toBe('D');
  });
});

describe('thang âm blues trên kèn', () => {
  it('kèn C: -2 -3\' 4 -4\' -4 -5 6 ở quãng giữa', () => {
    const t = bluesScaleTokens('C');
    const i = t.indexOf('-2');
    expect(t.slice(i, i + 7)).toEqual(['-2', "-3'", '4', "-4'", '-4', '-5', '6']);
  });
  it('nốt hợp âm không cần bend', () => {
    expect(chordToneTokens('C', 'I')).toContain('-2');
    expect(chordToneTokens('C', 'I').every((t) => !t.includes("'"))).toBe(true);
  });
});

describe('chuỗi sự kiện jam', () => {
  it('dài đúng 48 phách, chỉ có sự kiện câm khi không có lick', () => {
    const ev = jamEvents('C', 12);
    const last = ev[ev.length - 1];
    expect(last.start + last.beats).toBe(JAM_BEATS);
    expect(ev.every((e) => e.token === null && e.midi !== null)).toBe(true);
  });
  it('lick đặt đúng ô, ô đáp để trống', () => {
    const ev = jamEvents('C', 12, [{ bar: 4, body: '4 5 6 5:5' }]);
    const notes = ev.filter((e) => e.token);
    expect(notes[0].start).toBe(16);
    expect(notes[notes.length - 1].start + notes[notes.length - 1].beats).toBe(24);
    expect(ev.filter((e) => e.start >= 24).every((e) => e.token === null)).toBe(true);
    const last = ev[ev.length - 1];
    expect(last.start + last.beats).toBe(JAM_BEATS);
  });
  it('ô hỏi / đáp và vị trí ô', () => {
    expect([0, 1, 2, 4, 5, 8, 9, 11].map(isCallBar)).toEqual([true, true, false, true, true, true, true, false]);
    expect(barAt(47.9)).toBe(11);
    expect(barAt(48.1)).toBe(0);
  });
});
