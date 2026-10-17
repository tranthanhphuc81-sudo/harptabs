/**
 * Đồng bộ đèn nốt với tiếng: âm thanh được lên lịch trước rồi mới ra loa sau một khoảng trễ
 * (bộ đệm âm thanh của máy + loa / tai nghe Bluetooth). Đèn nốt phải theo lúc TIẾNG RA LOA,
 * không phải lúc lên lịch — nếu không đèn sẽ sáng trước tiếng.
 */

/** chỉnh tay (giây): dương = đèn trễ thêm, âm = đèn sớm hơn — cho loa / tai nghe báo sai độ trễ */
let manualOffset = 0;

export function setSyncOffsetMs(ms: number) {
  manualOffset = Number.isFinite(ms) ? ms / 1000 : 0;
}

type Ctx = Pick<AudioContext, 'currentTime'> & Partial<Pick<AudioContext, 'outputLatency' | 'baseLatency'>>;

/** độ trễ máy báo (giây): xử lý trong trình duyệt + đường ra loa */
export function outputDelay(c: Ctx): number {
  const base = Number.isFinite(c.baseLatency) ? c.baseLatency! : 0;
  const out = Number.isFinite(c.outputLatency) ? c.outputLatency! : 0;
  // số vô lý (vài trình duyệt báo 0 hoặc rất lớn lúc mới mở) thì bỏ qua
  const d = base + out;
  return d > 0 && d < 1.5 ? d : 0;
}

/** thời điểm (theo đồng hồ âm thanh) của tiếng đang phát ra loa ngay lúc này */
export function heardTime(c: Ctx): number {
  return c.currentTime - outputDelay(c) - manualOffset;
}
