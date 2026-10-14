import { describe, expect, it } from 'vitest';
import { cleanArtist, cleanTitle, looksLikeTitle, titleFromFilename } from './titleOcr';

describe('tên bài từ ảnh', () => {
  it('dọn chữ máy đọc', () => {
    expect(cleanTitle('  Con đường xưa em đi. \n')).toBe('Con đường xưa em đi');
    expect(cleanTitle('ĐỜI GỌI EM BIẾT BAO LẦN')).toBe('Đời gọi em biết bao lần');
    expect(cleanTitle('"Nắng Thủy Tinh"')).toBe('Nắng Thủy Tinh');
  });

  it('tên tác giả: bỏ chữ dẫn', () => {
    expect(cleanArtist('Trịnh Công Sơn')).toBe('Trịnh Công Sơn');
    expect(cleanArtist('Nhạc và lời Giáng Son')).toBe('Giáng Son');
    expect(cleanArtist('Nhạc & lời: Phạm Duy')).toBe('Phạm Duy');
    expect(cleanArtist('Nhạc: Văn Cao')).toBe('Văn Cao');
    expect(cleanArtist('Sáng tác - Trần Tiến')).toBe('Trần Tiến');
    expect(cleanArtist('Châu Kỳ & Hồ Đình Phương')).toBe('Châu Kỳ & Hồ Đình Phương');
  });

  it('loại chữ rác khi đọc kiểu chữ viết tay', () => {
    expect(looksLikeTitle('Ru em từng ngón xuân nồng')).toBe(true);
    expect(looksLikeTitle('(1XẤc ø~ø #xz«')).toBe(false);
    expect(looksLikeTitle('(2 #2 %2 €##2 đé,')).toBe(false);
  });

  it('tên file có nghĩa thì dùng, tên máy tự đặt thì bỏ', () => {
    expect(titleFromFilename('nang-thuy-tinh.png')).toBe('Nang thuy tinh');
    expect(titleFromFilename('Ru em từng ngón xuân nồng (1).jpg')).toBe('Ru em từng ngón xuân nồng');
    expect(titleFromFilename('IMG_20261014_101530.jpg')).toBe('');
    expect(titleFromFilename('Screenshot_2026-10-14-10-15-30.png')).toBe('');
    expect(titleFromFilename('image.jpg')).toBe('');
    expect(titleFromFilename('1234567.png')).toBe('');
  });
});
