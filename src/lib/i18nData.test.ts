import { describe, expect, it } from 'vitest';
import { textHash, tl } from './i18nData';
import { EN_DATA } from '../data/en/dataEn';
// @ts-expect-error — script .mjs không có khai báo kiểu
import { textHash as scriptHash } from '../../scripts/i18n-data.mjs';

describe('i18nData', () => {
  it('mã băm trong app giống hệt script sinh từ điển', () => {
    for (const s of ['Bắt đầu', 'Thang âm Đô trưởng — guitar', 'a', '']) expect(textHash(s)).toBe(scriptHash(s));
  });
  it('từ điển có bản dịch bài học; khi chạy test (tiếng Việt) thì giữ nguyên', () => {
    expect(EN_DATA[textHash('Chọn kèn và cầm kèn')]).toBe('Choosing and holding a harmonica');
    expect(tl('Chọn kèn và cầm kèn')).toBe('Chọn kèn và cầm kèn');
  });
});
