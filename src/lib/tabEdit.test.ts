import { describe, expect, it } from 'vitest';
import { editNote, joinToken, lyricLines, setLyrics, splitToken } from './tabEdit';

const body = '# Đoạn 1\n4 4 -4:2 5\nHap-py birth day\n';
const pos = (ei: number) => ({ sectionIndex: 0, lineIndex: 0, eventIndex: ei });

describe('editNote', () => {
  it('đổi lỗ của đúng nốt, giữ nguyên lời và độ dài', () => {
    const out = editNote(body, 'C', 'diatonic', pos(2), { kind: 'token', token: '-5' })!;
    expect(out).toContain('4 4 -5:2 5');
    expect(out).toContain('Hap-py birth day');
  });
  it('từ chối nốt không có trên kèn', () => {
    expect(editNote(body, 'C', 'diatonic', pos(0), { kind: 'token', token: '99' })).toBeNull();
  });
  it('đổi độ dài, thêm và xoá nốt', () => {
    expect(editNote(body, 'C', 'diatonic', pos(0), { kind: 'beats', beats: 0.5 })).toContain('4:0.5 4 -4:2 5');
    expect(editNote(body, 'C', 'diatonic', pos(3), { kind: 'duplicate' })).toContain('5 5');
    expect(editNote(body, 'C', 'diatonic', pos(1), { kind: 'remove' })).toContain('4 -4:2 5');
  });
  it('chèn nốt mới sau nốt đang chọn, không đè nốt cũ', () => {
    const out = editNote(body, 'C', 'diatonic', pos(1), { kind: 'insert', token: '-6' })!;
    expect(out).toContain('4 4 -6 -4:2 5');
    expect(editNote(body, 'C', 'diatonic', pos(1), { kind: 'insert', token: '99' })).toBeNull();
  });
  it('nốt thành dấu nghỉ', () => {
    expect(editNote(body, 'C', 'diatonic', pos(1), { kind: 'token', token: null })).toContain('4 r -4:2 5');
  });
});

describe('splitToken/joinToken', () => {
  it('khứ hồi', () => {
    for (const t of ["-3''", '6o', '-4<', '4']) {
      const s = splitToken(t);
      expect(joinToken({ ...s, hole: s.hole! })).toBe(t);
    }
  });
});

describe('sửa lời theo dòng', () => {
  const BODY = '# Điệp khúc\n4 4 -4 4 5\nHap-py birth day to\n\n6 -6 7\nyou dear';
  it('đọc lời từng dòng như trong văn bản bài', () => {
    const ls = lyricLines(BODY, 'C', 'diatonic');
    expect(ls.map((l) => [l.sectionTitle, l.tokens.length, l.text])).toEqual([['Điệp khúc', 5, 'Hap-py birth day to'], ['Điệp khúc', 3, 'you dear']]);
  });
  it('thay lời một dòng: chữ theo thứ tự nốt, "_" là nốt luyến, dòng khác giữ nguyên', () => {
    const body = setLyrics(BODY, 'C', 'diatonic', new Map([['0.0', 'Chúc mừng _ sinh-nhật']]));
    const ls = lyricLines(body, 'C', 'diatonic');
    expect(ls[0].text).toBe('Chúc mừng _ sinh-nhật');
    expect(ls[1].text).toBe('you dear');
    // thừa chữ thì bỏ; xoá hết lời một dòng
    expect(lyricLines(setLyrics(body, 'C', 'diatonic', new Map([['0.1', 'một hai ba bốn']])), 'C', 'diatonic')[1].text).toBe('một hai ba');
    expect(lyricLines(setLyrics(body, 'C', 'diatonic', new Map([['0.1', '']])), 'C', 'diatonic')[1].text).toBe('');
  });
});
