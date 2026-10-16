import { describe, expect, it } from 'vitest';
import { isPdf, PAGE_WIDTH, renderScale } from './pdf';

describe('đọc bản nhạc PDF', () => {
  it('nhận ra file PDF theo kiểu file hoặc đuôi tên', () => {
    expect(isPdf(new File([], 'giac-mo-trua.PDF'))).toBe(true);
    expect(isPdf(new File([], 'x', { type: 'application/pdf' }))).toBe(true);
    expect(isPdf(new File([], 'anh.png', { type: 'image/png' }))).toBe(false);
  });

  it('trang A4 (595 điểm) vẽ ra ảnh rộng ~1600px; trang nhỏ không phóng quá 4 lần', () => {
    expect(Math.round(595 * renderScale(595))).toBe(PAGE_WIDTH);
    expect(renderScale(100)).toBe(4);
    expect(renderScale(10000)).toBe(0.5);
  });
});
