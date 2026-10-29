import { describe, expect, it } from 'vitest';
import { activityTotals, addMetric, addTime, bestStreak, dayKey, lastDays, metricValue, PracticeLog, streak } from './practiceLog';

const d = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
const withDays = (...keys: string[]): PracticeLog => {
  const l: PracticeLog = { days: {} };
  for (const k of keys) addTime(l, k, 300, ['bai-hat']);
  return l;
};

describe('nhật ký luyện tập', () => {
  it('khoá ngày theo giờ máy, có số 0 đầu', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('chuỗi ngày: tính tới hôm nay; hôm nay chưa tập thì chuỗi vẫn giữ tới hôm qua; đứt một ngày là hết', () => {
    const l = withDays('2026-10-26', '2026-10-27', '2026-10-28');
    expect(streak(l, d('2026-10-28'))).toBe(3);
    expect(streak(l, d('2026-10-29'))).toBe(3);
    expect(streak(l, d('2026-10-30'))).toBe(0);
  });

  it('tập dưới 1 phút không tính là ngày có tập; qua tháng vẫn liền mạch', () => {
    const l = withDays('2026-09-29', '2026-09-30', '2026-10-01');
    addTime(l, '2026-10-02', 30, ['nghe-dap']);
    expect(streak(l, d('2026-10-02'))).toBe(3);
    expect(bestStreak(withDays('2026-01-01', '2026-01-02', '2026-01-10', '2026-01-11', '2026-01-12', '2026-01-13'))).toBe(4);
  });

  it('cộng giờ: hai hoạt động cùng lúc chỉ tính một lần vào tổng ngày', () => {
    const l: PracticeLog = { days: {} };
    addTime(l, '2026-10-28', 10, ['bai-hat', 'nghe-dap']);
    addTime(l, '2026-10-28', 5, ['nghe-dap']);
    expect(l.days['2026-10-28']).toMatchObject({ secs: 15, by: { 'bai-hat': 10, 'nghe-dap': 15 } });
    expect(activityTotals(l, ['2026-10-28', '2026-10-27'])).toEqual({ 'bai-hat': 10, 'nghe-dap': 15 });
  });

  it('kết quả: tỉ lệ %, trung bình, đếm; chưa có thì null', () => {
    const l: PracticeLog = { days: {} };
    for (const v of [1, 1, 0, 1]) addMetric(l, '2026-10-27', 'nghe-dap', v);
    addMetric(l, '2026-10-28', 'nghe-dap', 0);
    addMetric(l, '2026-10-28', 'giu-not', 3);
    addMetric(l, '2026-10-28', 'giu-not', 4.5);
    addMetric(l, '2026-10-28', 'bend', 1);
    addMetric(l, '2026-10-28', 'bend', 1);
    const keys = ['2026-10-27', '2026-10-28'];
    expect(metricValue(l, 'nghe-dap', keys)).toBe(60);
    expect(metricValue(l, 'giu-not', keys)).toBe(3.8);
    expect(metricValue(l, 'bend', keys)).toBe(2);
    expect(metricValue(l, 'hop-am', keys)).toBeNull();
  });

  it('7 ngày gần nhất: cũ → mới, ngày chưa tập là 0', () => {
    const days = lastDays(withDays('2026-10-28'), d('2026-10-28'), 7);
    expect(days.map((x) => x.key)).toEqual(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
    expect(days.map((x) => x.secs)).toEqual([0, 0, 0, 0, 0, 0, 300]);
  });
});
