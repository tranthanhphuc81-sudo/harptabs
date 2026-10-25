import { describe, expect, it } from 'vitest';
import { buildKaraoke, countdownAt, holesFor, locate } from './karaoke';
import { flatten, parseTab } from './tabText';
import { viewSong } from './viewAs';
import { blankSong } from './db';

// dòng 1: dạo nhạc (không lời); dòng 2 có gạch nối, luyến (_) và dấu nghỉ; dòng 3 sau khoảng lặng 4 phách
const BODY = `4 5 6 r:2
4 4 -4 4 6:2 -6 r
Hap-py birth _ day
r:4
4 5 6
to you all`;

const flat = flatten(parseTab(BODY, 'C'));
const lines = buildKaraoke(flat);

describe('karaoke: gom dòng và âm tiết', () => {
  it('dòng dạo nhạc không lời, dòng có lời, bỏ dòng toàn dấu nghỉ', () => {
    expect(lines.map((l) => l.instrumental)).toEqual([true, false, false]);
    expect(lines[0].syls.map((s) => s.text)).toEqual(['', '', '']);
  });

  it('âm tiết có gạch nối; nốt luyến kéo dài chữ trước; dấu nghỉ ngắt chữ', () => {
    const l = lines[1];
    expect(l.syls.map((s) => `${s.text}${s.hyphen ? '-' : ''}`)).toEqual(['Hap-', 'py', 'birth', 'day']);
    // "birth" hát nốt -4 rồi luyến sang 4 → 2 nốt, dài 2 phách
    const birth = l.syls[2];
    expect(birth.fi).toHaveLength(2);
    expect(birth.end - birth.start).toBe(2);
    // "day" (6:2) rồi -6 không lời cũng là luyến; dấu nghỉ cuối không thuộc chữ nào
    expect(l.syls[3].fi).toHaveLength(2);
    expect(l.end).toBe(l.syls[3].end);
  });

  it('vị trí: trước bài, giữa âm tiết, hết dòng thì chuyển dòng kế', () => {
    expect(locate(lines, -2)).toEqual({ line: 0, syl: -1, p: 0 });
    const l1 = lines[1];
    const mid = locate(lines, l1.syls[2].start + 1);
    expect(mid).toMatchObject({ line: 1, syl: 2 });
    expect(mid.p).toBeCloseTo(0.5);
    // hát xong dòng 2 (đang nghỉ) → hiện dòng 3 để kịp đọc
    expect(locate(lines, l1.end + 0.5)).toEqual({ line: 2, syl: -1, p: 0 });
    // dòng cuối hát xong thì giữ nguyên, chữ cuối đầy
    expect(locate(lines, 1000)).toMatchObject({ line: 2, syl: 2, p: 1 });
  });

  it('đếm ngược chỉ khi trước câu có khoảng lặng từ 2 phách, tối đa 4', () => {
    const l2 = lines[2];
    expect(countdownAt(lines, l2.start - 3.5)).toBe(4);
    expect(countdownAt(lines, l2.start - 0.4)).toBe(1);
    expect(countdownAt(lines, l2.start - 6)).toBeNull(); // còn xa
    // dòng 2 bắt đầu ngay sau dạo nhạc 2 phách nghỉ → có đếm
    expect(countdownAt(lines, lines[1].start - 1)).toBe(1);
    // đang hát giữa dòng: không đếm
    expect(countdownAt(lines, lines[1].start + 1)).toBeNull();
  });

  it('số lỗ lấy theo cùng chỉ số nốt trên bản tab xếp lại cho kèn khác', () => {
    const song = blankSong({ id: 'k', title: 'k', body: BODY, harpKey: 'C' });
    const v = viewSong(song, { type: 'tremolo24', key: 'C', mode: 'octave' });
    const vflat = flatten(parseTab(v.song.body, 'C', 'tremolo24'));
    expect(vflat).toHaveLength(flat.length);
    const birth = lines[1].syls[2];
    expect(holesFor(birth, flat)).toEqual(['-4', '4']);
    expect(holesFor(birth, vflat).every((t) => t === null || /^-?\d+$/.test(t))).toBe(true);
  });
});
