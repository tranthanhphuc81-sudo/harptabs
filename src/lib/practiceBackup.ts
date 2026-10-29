/**
 * Đưa nhật ký luyện tập và kết quả các trang tập (đang lưu trong localStorage) vào file sao lưu.
 * Khôi phục là TRỘN với dữ liệu đang có trong máy (không ghi đè, không cộng dồn hai lần khi nhập lại cùng một file):
 * số liệu lấy giá trị lớn hơn, kết quả bài tập trong ngày lấy bản có nhiều lần ghi hơn.
 */

/** các khoá được sao lưu; độ trễ âm thanh (harptabs.rhythmLatency) là của riêng từng máy nên không đưa vào */
export const PRACTICE_KEYS = [
  'harptabs.practiceLog', 'harptabs.bauPractice', 'harptabs.bendPractice', 'harptabs.chordPractice',
  'harptabs.pitchPractice', 'harptabs.earPractice', 'harptabs.rhythmPractice',
] as const;

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : null);
/** khoá hợp lệ: ngắn, chỉ chữ số / chữ / vài dấu (file sao lưu có thể do người khác gửi) */
const okKey = (k: string) => k.length <= 60 && /^[\w:+\-.#']+$/.test(k);
const MAX_ENTRIES = 5000;

export function exportPractice(): Json | undefined {
  const out: Json = {};
  for (const k of PRACTICE_KEYS) {
    try { const v = localStorage.getItem(k); if (v) out[k] = JSON.parse(v); } catch { /* bỏ qua khoá hỏng */ }
  }
  return Object.keys(out).length ? out : undefined;
}

/** trộn hai bảng số liệu: số lấy lớn hơn, bảng con trộn đệ quy (sâu tối đa 3 tầng) */
function mergeMax(a: unknown, b: unknown, depth = 0): unknown {
  const nb = num(b);
  if (nb !== null) { const na = num(a); return na === null ? nb : Math.max(na, nb); }
  if (!isObj(b) || depth > 3) return a;
  const out: Json = isObj(a) ? { ...a } : {};
  for (const [k, v] of Object.entries(b).slice(0, MAX_ENTRIES)) {
    if (!okKey(k)) continue;
    const m = mergeMax(out[k], v, depth + 1);
    if (m !== undefined) out[k] = m;
  }
  // bảng con toàn dữ liệu lạ, máy cũng chưa có: bỏ hẳn (khỏi để lại mục rỗng làm trang tập hiện sai)
  return !isObj(a) && !Object.keys(out).length ? undefined : out;
}

/** trộn nhật ký: từng ngày lấy giờ tập lớn hơn; kết quả bài tập lấy bản có nhiều lần ghi hơn */
function mergeLog(a: unknown, b: unknown): Json {
  const out: Json = isObj(a) ? { ...a } : { days: {} };
  const days: Json = isObj(out.days) ? { ...out.days } : {};
  if (isObj(b) && isObj(b.days)) {
    for (const [k, d] of Object.entries(b.days).slice(0, MAX_ENTRIES)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !isObj(d)) continue;
      const cur = isObj(days[k]) ? (days[k] as Json) : { secs: 0, by: {}, metrics: {} };
      const metrics: Json = isObj(cur.metrics) ? { ...cur.metrics } : {};
      if (isObj(d.metrics)) {
        for (const [m, x] of Object.entries(d.metrics)) {
          if (!okKey(m) || !isObj(x) || num(x.sum) === null || num(x.n) === null) continue;
          const have = metrics[m] as Json | undefined;
          if (!have || (num(have.n) ?? 0) < (x.n as number)) metrics[m] = { sum: x.sum, n: x.n };
        }
      }
      days[k] = { secs: mergeMax(cur.secs, d.secs) ?? 0, by: mergeMax(cur.by, d.by), metrics };
    }
    if (out.goalMin === undefined && num(b.goalMin) !== null) out.goalMin = b.goalMin;
  }
  out.days = days;
  return out;
}

/** trộn phần luyện tập của file sao lưu vào máy; trả về số mục đã trộn */
export function importPractice(data: unknown): number {
  if (!isObj(data)) return 0;
  let n = 0;
  for (const k of PRACTICE_KEYS) {
    if (!(k in data)) continue;
    let cur: unknown;
    try { cur = JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { cur = null; }
    const merged = k === 'harptabs.practiceLog' ? mergeLog(cur, data[k]) : mergeMax(cur, data[k]);
    if (merged === undefined) continue;
    try { localStorage.setItem(k, JSON.stringify(merged)); n++; } catch { /* hết chỗ thì thôi */ }
  }
  return n;
}
