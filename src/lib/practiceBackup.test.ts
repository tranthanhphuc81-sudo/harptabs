import { beforeEach, describe, expect, it } from 'vitest';
import { exportPractice, importPractice } from './practiceBackup';

// môi trường test chạy trên node: giả localStorage
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
const get = (k: string) => JSON.parse(store.get(k)!);

beforeEach(() => store.clear());

describe('sao lưu nhật ký luyện tập', () => {
  it('xuất các khoá luyện tập, không xuất độ trễ âm thanh của máy và cài đặt khác', () => {
    store.set('harptabs.practiceLog', JSON.stringify({ days: { '2026-10-28': { secs: 300, by: {}, metrics: {} } } }));
    store.set('harptabs.earPractice', JSON.stringify({ l1: { tries: 5, ok: 4 } }));
    store.set('harptabs.rhythmLatency', '0.12');
    store.set('harptabs.librarySort', '"title"');
    expect(Object.keys(exportPractice()!).sort()).toEqual(['harptabs.earPractice', 'harptabs.practiceLog']);
    store.clear();
    expect(exportPractice()).toBeUndefined();
  });

  it('khôi phục là trộn: ngày trùng lấy giờ lớn hơn, ngày mới thêm vào; nhập lại cùng file không cộng dồn', () => {
    store.set('harptabs.practiceLog', JSON.stringify({ goalMin: 15, days: {
      '2026-10-27': { secs: 600, by: { 'bai-hat': 600 }, metrics: { 'nghe-dap': { sum: 3, n: 4 } } },
    } }));
    const file = { 'harptabs.practiceLog': { goalMin: 5, days: {
      '2026-10-27': { secs: 400, by: { 'bai-hat': 200, 'nghe-dap': 200 }, metrics: { 'nghe-dap': { sum: 8, n: 10 } } },
      '2026-10-20': { secs: 900, by: { 'nhip': 900 }, metrics: {} },
    } } };
    expect(importPractice(file)).toBe(1);
    importPractice(file);
    const l = get('harptabs.practiceLog');
    expect(l.goalMin).toBe(15);
    expect(l.days['2026-10-27']).toEqual({ secs: 600, by: { 'bai-hat': 600, 'nghe-dap': 200 }, metrics: { 'nghe-dap': { sum: 8, n: 10 } } });
    expect(l.days['2026-10-20'].secs).toBe(900);
  });

  it('kết quả trang tập: lấy số lớn hơn (kỷ lục, số lần), bỏ dữ liệu lạ trong file', () => {
    store.set('harptabs.rhythmPractice', JSON.stringify({ den: 90 }));
    store.set('harptabs.chordPractice', JSON.stringify({ 'guitar:C': { tries: 10, ok: 6 } }));
    importPractice({
      'harptabs.rhythmPractice': { den: 80, moc: 70, '<script>': 1 },
      'harptabs.chordPractice': { 'guitar:C': { tries: 20, ok: 15 }, 'guitar:G': { tries: 'x', ok: -1 } },
      'harptabs.librarySort': 'evil',
    });
    expect(get('harptabs.rhythmPractice')).toEqual({ den: 90, moc: 70 });
    expect(get('harptabs.chordPractice')).toEqual({ 'guitar:C': { tries: 20, ok: 15 } });
    expect(store.has('harptabs.librarySort')).toBe(false);
  });
});
