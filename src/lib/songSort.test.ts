import { describe, expect, it } from 'vitest';
import { compareTitle } from './songSort';

const s = (title: string, artist?: string) => ({ title, artist });
const names = (xs: { title: string }[]) => xs.map((x) => x.title);

describe('compareTitle', () => {
  const songs = [s('Đêm đông'), s(''), s('Bài 10'), s('Ánh trăng'), s('Dòng sông'), s('anh ơi'), s('Bài 2'), s('Ơi')];

  it('A→Z theo bảng chữ tiếng Việt, số theo giá trị, bài chưa đặt tên ở cuối', () => {
    expect(names([...songs].sort((a, b) => compareTitle(a, b)))).toEqual(
      ['anh ơi', 'Ánh trăng', 'Bài 2', 'Bài 10', 'Dòng sông', 'Đêm đông', 'Ơi', ''],
    );
  });

  it('Z→A đảo ngược nhưng bài chưa đặt tên vẫn ở cuối', () => {
    expect(names([...songs].sort((a, b) => compareTitle(a, b, -1)))).toEqual(
      ['Ơi', 'Đêm đông', 'Dòng sông', 'Bài 10', 'Bài 2', 'Ánh trăng', 'anh ơi', ''],
    );
  });

  it('trùng tên thì xét tác giả', () => {
    expect(compareTitle(s('Xuân', 'Văn Cao'), s('Xuân', 'Anh Tú'))).toBeGreaterThan(0);
  });
});
