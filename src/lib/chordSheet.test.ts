import { describe, expect, it } from 'vitest';
import { chordsFromSheet, isChordLine, normalizeChord, parseSheet, serializeSheet, sheetChords, sheetPlayback, sheetSlots } from './chordSheet';
import { flatten, parseTab } from './tabText';
import { harmonizeSegments } from '../audio/harmony';

describe('tên hợp âm', () => {
  it('đổi hợp âm lạ về hợp âm chơi được', () => {
    expect(normalizeChord('Am')).toBe('Am');
    expect(normalizeChord('Gsus4')).toBe('G');
    expect(normalizeChord('C/G')).toBe('C');
    expect(normalizeChord('Cadd9')).toBe('C');
    expect(normalizeChord('Em7')).toBe('Em7');
    expect(normalizeChord('F#m')).toBe('F#m');
    expect(normalizeChord('Bbmaj7')).toBe('Bbmaj7');
    expect(normalizeChord('D9')).toBe('D7');
    expect(normalizeChord('Bdim')).toBe('Bdim7');
    expect(normalizeChord('Anh')).toBeNull();
    expect(normalizeChord('em')).toBeNull();
  });

  it('nhận dòng hợp âm', () => {
    expect(isChordLine('Am      F    C   G')).toBe(true);
    expect(isChordLine('| C | G | Am | F |')).toBe(true);
    expect(isChordLine('Em ơi Hà Nội phố')).toBe(false);
  });
});

describe('đọc bài hợp âm', () => {
  it('kiểu hợp âm trong ngoặc vuông', () => {
    const s = parseSheet('Tên bài\n[Am]Em ơi Hà [F]Nội phố\n\nĐK:\n[C]Ta còn em [G]mùi hoàng lan');
    expect(s.title).toBe('Tên bài');
    expect(s.chordCount).toBe(4);
    expect(s.lines[0].parts).toEqual([{ chord: 'Am', text: 'Em ơi Hà ' }, { chord: 'F', text: 'Nội phố' }]);
    expect(s.lines.find((l) => l.kind === 'section')?.title).toBe('ĐK');
    expect(sheetChords(s.lines)).toEqual(['Am', 'F', 'C', 'G']);
  });

  it('kiểu dòng hợp âm nằm trên dòng lời, căn theo cột', () => {
    const s = parseSheet('Am          F\nEm ơi Hà    Nội phố\nC        G\nTa còn em mùi hoàng lan');
    expect(s.lines[0].parts).toEqual([{ chord: 'Am', text: 'Em ơi Hà    ' }, { chord: 'F', text: 'Nội phố' }]);
    expect(s.lines[1].parts[1]).toEqual({ chord: 'G', text: 'mùi hoàng lan' });
  });

  it('hợp âm rơi giữa chữ thì lùi về đầu chữ', () => {
    const s = parseSheet('  G\nHello world');
    expect(s.lines[0].parts[0]).toEqual({ chord: 'G', text: 'Hello world' });
  });

  it('dòng chỉ có hợp âm (dạo đầu), [ĐK] là tên đoạn, dòng lời thường không thành tên đoạn', () => {
    const s = parseSheet('Intro:\nC  G  Am  F\n[ĐK]\n[C]Lời yêu thương\nKết thúc rồi em [G]ơi');
    expect(s.lines[0]).toMatchObject({ kind: 'section', title: 'Intro' });
    expect(s.lines[1].parts.map((p) => p.chord)).toEqual(['C', 'G', 'Am', 'F']);
    expect(s.lines[2]).toMatchObject({ kind: 'section', title: 'ĐK' });
    expect(s.lines[4].kind).toBe('line');
  });

  it('lưu rồi đọc lại giữ nguyên', () => {
    const s = parseSheet('Am          F\nEm ơi Hà    Nội phố\n\n# ĐK\n[C]Ta còn [G]em');
    const again = parseSheet(serializeSheet(s.lines));
    expect(again.lines).toEqual(s.lines);
  });

  it('dán hợp âm vào bài có giai điệu: khớp theo lời, giữ tới hợp âm sau', () => {
    const body = '2.1 2.1 3.0 3.0 3.2 3.2 3.0:2\nTwin-kle twin-kle lit-tle star\n\n4.3 4.3 4.2 4.2 4.0 4.0 5.3:2\nHow I won-der what you are\n';
    const flat = flatten(parseTab(body, 'C', 'guitar6'));
    const segs = harmonizeSegments(flat, 4, 0, { tonic: 0, minor: false });
    // lời dán viết khác chút (hoa thường, dấu câu) vẫn khớp
    const sheet = parseSheet('[C]Twinkle, twinkle [F]little [C]star\n[F]How I [C]wonder [G]what you [C]are');
    const r = chordsFromSheet(sheet.lines, flat, segs.map((s) => s.start));
    expect(r.total).toBe(7);
    expect(r.matched).toBe(7);
    expect(r.overrides).toEqual({ 0: 'C', 2: 'C', 4: 'F', 6: 'C', 8: 'F', 10: 'C', 12: 'G', 14: 'C' });
  });

  it('thời gian phát: mỗi hợp âm một ô, ép hợp âm từng nửa ô', () => {
    const s = parseSheet('[C]một [G]hai\n[Am]ba');
    const slots = sheetSlots(s.lines, 4);
    expect(slots.map((x) => [x.chord, x.start])).toEqual([['C', 0], ['G', 4], ['Am', 8]]);
    const { flat, overrides } = sheetPlayback(slots, 2);
    expect(flat.every((e) => e.token === null && e.midi !== null)).toBe(true);
    expect(overrides).toEqual({ 0: 'C', 2: 'C', 4: 'G', 6: 'G', 8: 'Am', 10: 'Am' });
  });
});
