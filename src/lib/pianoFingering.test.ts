import { describe, expect, it } from 'vitest';
import { rightHandFingering, stepCost } from './pianoFingering';

const seq = (ms: (number | null)[], beats = 1) => ms.map((midi) => ({ midi, beats }));

describe('số ngón tay phải', () => {
  it('năm nốt Đô – Sol: thế năm ngón 1 2 3 4 5', () => {
    expect(rightHandFingering(seq([60, 62, 64, 65, 67]))).toEqual([1, 2, 3, 4, 5]);
  });

  it('thang âm Đô đi lên: luồn ngón cái ở Fa (1 2 3 1 2 3 4 5)', () => {
    expect(rightHandFingering(seq([60, 62, 64, 65, 67, 69, 71, 72]))).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
  });

  it('thang âm Đô đi xuống: vắt ngón 3 qua ở Mi (5 4 3 2 1 3 2 1)', () => {
    expect(rightHandFingering(seq([72, 71, 69, 67, 65, 64, 62, 60]))).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('nốt lặp giữ nguyên ngón; chỗ nghỉ để trống', () => {
    const f = rightHandFingering(seq([64, 64, null, 65, 67]));
    expect(f[0]).toBe(f[1]);
    expect(f[2]).toBeNull();
  });

  it('không đặt ngón cái lên phím đen khi có cách khác', () => {
    const f = rightHandFingering(seq([62, 66, 67, 69, 71])); // Rê Fa# Sol La Si
    expect(f[1]).not.toBe(1);
  });

  it('ngón chọn tay được giữ, các nốt quanh tính theo', () => {
    const f = rightHandFingering(seq([60, 62, 64, 65, 67]), new Map([[0, 2]]));
    expect(f[0]).toBe(2);
    expect(f[1]).not.toBe(2);
    expect(f.every((x) => x !== null)).toBe(true);
  });

  it('không bao giờ dùng một ngón cho hai nốt khác nhau liền nhau (Ode to Joy)', () => {
    const ode = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62];
    const f = rightHandFingering(seq(ode));
    for (let i = 1; i < ode.length; i++) if (ode[i] !== ode[i - 1]) expect(f[i]).not.toBe(f[i - 1]);
    expect(f.every((x) => x !== null && x >= 1 && x <= 5)).toBe(true);
  });

  it('khoảng cách quá rộng giữa hai ngón kế nhau thì rất đắt', () => {
    expect(stepCost(60, 2, 72, 3)).toBeGreaterThanOrEqual(50);
    expect(stepCost(60, 1, 62, 2)).toBe(0);
  });
});
