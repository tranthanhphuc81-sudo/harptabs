import { describe, expect, it } from 'vitest';
import { detectLang, t } from './i18n';
import { EN } from './i18n.en';

describe('i18n', () => {
  it('khi chạy test luôn là tiếng Việt, thay tham số theo vị trí', () => {
    expect(t('Đã lưu')).toBe('Đã lưu');
    expect(t('Đã xoá {0} bài', 3)).toBe('Đã xoá 3 bài');
    expect(t('{0}{1} ms', '+', 20)).toBe('+20 ms');
    // như JSX: null / undefined không hiện gì
    expect(t('Bài {0}', null)).toBe('Bài ');
  });

  it('đoán ngôn ngữ theo máy', () => {
    expect(detectLang(['vi-VN', 'en-US'], 'UTC')).toBe('vi');
    expect(detectLang(['en-US'], 'Asia/Ho_Chi_Minh')).toBe('vi');
    expect(detectLang(['en-US'], 'Asia/Saigon')).toBe('vi');
    expect(detectLang(['en-GB', 'fr'], 'Europe/London')).toBe('en');
    expect(detectLang([], undefined)).toBe('vi');
  });

  it('bản dịch giữ đủ tham số {n} của câu gốc', () => {
    // hai câu bỏ tham số có chủ ý (tiếng Anh không cần động từ "thổi / chơi")
    const allowDrop = new Set(['Học {0} {1}', 'Lớn (để xa khi {0})']);
    const ph = (s: string) => (s.match(/\{\d+/g) ?? []).sort().join(',');
    const bad = Object.entries(EN).filter(([vi, en]) => !allowDrop.has(vi) && ph(vi) !== ph(en));
    expect(bad).toEqual([]);
  });
});
