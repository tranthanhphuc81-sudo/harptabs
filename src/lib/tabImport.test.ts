import { describe, expect, it } from 'vitest';
import { importTabText, normalizeToken } from './tabImport';
import { parseTab } from './tabText';

const tabLines = (body: string) => body.split('\n').filter((l) => /^-?\d/.test(l));

describe('nhập tab dán từ mạng', () => {
  it('chuẩn hoá các kiểu ký hiệu nốt', () => {
    expect(normalizeToken('4')).toBe('4');
    expect(normalizeToken('+4')).toBe('4');
    expect(normalizeToken('-4')).toBe('-4');
    expect(normalizeToken('−4')).toBe('-4');
    expect(normalizeToken('4↓')).toBe('-4');
    expect(normalizeToken('↑4')).toBe('4');
    expect(normalizeToken('-3b')).toBe("-3'");
    expect(normalizeToken('-3bb')).toBe("-3''");
    expect(normalizeToken("-3’")).toBe("-3'");
    expect(normalizeToken('-2"')).toBe("-2''");
    expect(normalizeToken('-3^')).toBe("-3'");
    expect(normalizeToken('10b')).toBe("10'");
    expect(normalizeToken('6o')).toBe('6o');
    expect(normalizeToken('6ob')).toBe('6o');
    expect(normalizeToken('7od')).toBe('-7o');
    expect(normalizeToken('-4:2')).toBe('-4:2');
    expect(normalizeToken('-4~')).toBe('-4');
    expect(normalizeToken('11')).toBeNull();
    expect(normalizeToken('love')).toBeNull();
    expect(normalizeToken('D4', { letters: true, parens: false })).toBe('-4');
    expect(normalizeToken('4B', { letters: true, parens: false })).toBe('4');
    expect(normalizeToken('(4)', { letters: false, parens: true })).toBe('-4');
  });

  it('kiểu phổ biến: dòng tab + lời bên dưới, tiêu đề, tông kèn, đoạn', () => {
    const r = importTabText(`Twinkle Twinkle Little Star
Harmonica key: C

[Verse]
4 4 6 6 -6 -6 6
Twin-kle twin-kle lit-tle star
-5 -5 5 5 -4 -4 4
How I won-der what you are
`);
    expect(r.title).toBe('Twinkle Twinkle Little Star');
    expect(r.harpKey).toBe('C');
    expect(r.tabLines).toBe(2);
    expect(r.notes).toBe(14);
    expect(r.body).toContain('# Verse');
    const p = parseTab(r.body, 'C');
    expect(p.issues.filter((i) => i.level === 'error')).toEqual([]);
    const ev = p.sections.flatMap((s) => s.lines).flatMap((l) => (l.kind === 'tab' ? l.events : []));
    expect(ev[0].lyric).toBe('Twin');
    expect(ev).toHaveLength(14);
  });

  it('lời nằm TRÊN dòng tab được đưa xuống dưới', () => {
    const r = importTabText(`Happy birth-day to you
6 6 -6 6 -7 7
Happy birth-day to you
6 6 -6 6 -8 -7`);
    const lines = r.body.split('\n');
    expect(lines[0]).toBe('6 6 -6 6 -7 7');
    expect(lines[1]).toBe('Happy birth-day to you');
    expect(r.title).toBeNull();
  });

  it('viết dính, dấu phẩy, vạch nhịp, mũi tên', () => {
    expect(tabLines(importTabText('4-4-5-5 6').body)).toEqual(['4 -4 -5 -5 6']);
    expect(tabLines(importTabText('4, -4, 5 | -5, 6').body)).toEqual(['4 -4 5 -5 6']);
    expect(tabLines(importTabText('4↑ 4↓ 5↑ 5↓').body)).toEqual(['4 -4 5 -5']);
  });

  it('quy ước chữ B/D và quy ước ngoặc = hút', () => {
    expect(tabLines(importTabText('B4 D4 B5 D5 B6').body)).toEqual(['4 -4 5 -5 6']);
    expect(tabLines(importTabText('4 (4) 5 (5) 6').body)).toEqual(['4 -4 5 -5 6']);
    // có dấu "-" thì ngoặc không mang nghĩa hút
    expect(tabLines(importTabText('4 -4 (5)').body)).toEqual(['4 -4 5']);
  });

  it('báo ký hiệu không hiểu, bỏ chữ dài không liên quan', () => {
    const r = importTabText(`Bài này hay lắm, mọi người nhớ like và share nhé các bạn ơi!!!
4 4 -4 4 6 -5 X?
`);
    expect(r.unknown).toContain('X?');
    expect(r.body).not.toContain('like');
    expect(tabLines(r.body)).toEqual(['4 4 -4 4 6 -5']);
  });
});
