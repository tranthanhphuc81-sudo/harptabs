import { describe, expect, it } from 'vitest';
import { beatAtY, clampScrollPct, scrollPoints, yAtBeat } from './autoScroll';

// hai dòng tab: dòng 1 (y = 100) nốt ở phách 0, 1, 2, 3; dòng 2 (y = 200) nốt ở phách 4, 5
const pts = scrollPoints([
  { beat: 0, y: 100 }, { beat: 1, y: 100 }, { beat: 2, y: 100 }, { beat: 3, y: 100 },
  { beat: 4, y: 200 }, { beat: 5, y: 200 },
]);

describe('tự cuộn theo nhịp', () => {
  it('trong một dòng đứng yên, sang dòng mới thì trượt dần trong nốt cuối dòng', () => {
    expect(yAtBeat(pts, 0)).toBe(100);
    expect(yAtBeat(pts, 2.5)).toBe(100);
    expect(yAtBeat(pts, 3.5)).toBe(150);
    expect(yAtBeat(pts, 4)).toBe(200);
    // trước nốt đầu / sau nốt cuối: giữ ở hai đầu
    expect(yAtBeat(pts, -1)).toBe(100);
    expect(yAtBeat(pts, 9)).toBe(200);
  });

  it('chạy tiếp từ dòng đang ở vạch đọc: lấy nốt đầu dòng', () => {
    expect(beatAtY(pts, 100)).toBe(0);
    expect(beatAtY(pts, 50)).toBe(0);
    expect(beatAtY(pts, 150)).toBe(3.5);
    expect(beatAtY(pts, 200)).toBe(4);
    expect(beatAtY(pts, 999)).toBe(5);
  });

  it('gộp nốt cùng phách, bỏ điểm làm vị trí đi lùi', () => {
    const p = scrollPoints([{ beat: 2, y: 300 }, { beat: 0, y: 100 }, { beat: 0, y: 105 }, { beat: 1, y: 50 }]);
    expect(p).toEqual([{ beat: 0, y: 100 }, { beat: 2, y: 300 }]);
    expect(yAtBeat([], 3)).toBe(0);
    expect(beatAtY([], 3)).toBe(0);
  });

  it('tốc độ 30–200%, làm tròn bước 5%', () => {
    expect(clampScrollPct(72)).toBe(70);
    expect(clampScrollPct(10)).toBe(30);
    expect(clampScrollPct(500)).toBe(200);
    expect(clampScrollPct(NaN || 100)).toBe(100);
  });
});
