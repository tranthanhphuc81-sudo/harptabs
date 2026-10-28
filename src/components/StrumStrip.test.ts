import { describe, expect, it } from 'vitest';
import { strumCells } from './StrumStrip';

describe('dải điệu quạt', () => {
  it('ballad 4/4 gõ bo: B · ✕ ↑ B ↑ ✕ ↑, đếm 1 & 2 &…', () => {
    const { cells, subdiv } = strumCells('ballad', 4, 'gobo');
    expect(subdiv).toBe(2);
    expect(cells.map((c) => c.mark).join(' ')).toBe('B · ✕ ↑ B ↑ ✕ ↑');
    expect(cells.map((c) => c.count).join(' ')).toBe('1 & 2 & 3 & 4 &');
  });

  it('quạt chả thì chặn dây thành quạt xuống', () => {
    expect(strumCells('ballad', 4, 'strum').cells.map((c) => c.mark).join('')).toBe('B·↓↑B↑↓↑');
  });

  it('valse 3/4 chỉ hiện một ô nhịp', () => {
    const { cells } = strumCells('waltz', 3, 'gobo');
    expect(cells).toHaveLength(6);
    expect(cells[0].mark).toBe('B');
  });
});
