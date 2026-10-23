import { describe, expect, it } from 'vitest';
import { editNote, joinToken, splitToken } from './tabEdit';

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
