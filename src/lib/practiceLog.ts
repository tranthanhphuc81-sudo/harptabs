/**
 * Nhật ký luyện tập: mỗi ngày tập bao nhiêu phút (theo từng hoạt động), kết quả các bài tập có micro, chuỗi ngày tập liền.
 * Lưu trong máy (localStorage) — mỗi điện thoại một nhật ký riêng.
 */
import { useEffect } from 'react';

export type Activity = 'bai-hat' | 'ngau-hung' | 'nghe-dap' | 'cao-do' | 'hop-am' | 'boi-am';

export const ACTIVITY_LABEL: Record<Activity, string> = {
  'bai-hat': 'Chơi theo bài',
  'ngau-hung': 'Ngẫu hứng',
  'nghe-dap': 'Nghe – đáp',
  'cao-do': 'Tập cao độ',
  'hop-am': 'Tập hợp âm',
  'boi-am': 'Bồi âm, nắn cần',
};

/** kết quả bài tập: rate = tỉ lệ đúng (ghi 1 / 0), avg = trung bình (giây…), count = đếm số lần đạt */
export const METRICS = {
  'nghe-dap': { label: 'Nghe – đáp đúng', kind: 'rate' },
  'hop-am': { label: 'Quạt hợp âm sạch', kind: 'rate' },
  'boi-am': { label: 'Bồi âm đúng', kind: 'rate' },
  'giu-not': { label: 'Giữ nốt dài', kind: 'avg', unit: 'giây' },
  'bend': { label: 'Bend / nhấn đạt', kind: 'count', unit: 'lần' },
  'nan-can': { label: 'Nắn cần đạt', kind: 'count', unit: 'lần' },
} as const;
export type Metric = keyof typeof METRICS;

export interface DayLog {
  /** tổng số giây tập (giờ tập trùng nhau giữa hai hoạt động chỉ tính một lần) */
  secs: number;
  by: Partial<Record<Activity, number>>;
  metrics: Partial<Record<Metric, { sum: number; n: number }>>;
}
export interface PracticeLog { days: Record<string, DayLog>; goalMin?: number }

const KEY = 'harptabs.practiceLog';
export const DEFAULT_GOAL_MIN = 10;
/** ít hơn thế không tính là một ngày có tập (giây) */
export const MIN_DAY_SECS = 60;

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function loadLog(): PracticeLog {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (v && typeof v === 'object' && v.days) return v; } catch { /* hỏng thì làm lại */ }
  return { days: {} };
}
function saveLog(l: PracticeLog) {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* không lưu được thì thôi */ }
  listeners.forEach((f) => f());
}
const listeners = new Set<() => void>();
export function onLogChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }

function day(l: PracticeLog, k: string): DayLog {
  return (l.days[k] ??= { secs: 0, by: {}, metrics: {} });
}

/** cộng thời gian tập vào ngày (dùng cho đồng hồ và cho test) */
export function addTime(l: PracticeLog, k: string, secs: number, acts: Activity[]): PracticeLog {
  if (!acts.length || secs <= 0) return l;
  const d = day(l, k);
  d.secs += secs;
  for (const a of acts) d.by[a] = (d.by[a] ?? 0) + secs;
  return l;
}

export function addMetric(l: PracticeLog, k: string, m: Metric, value: number): PracticeLog {
  const d = day(l, k);
  const cur = d.metrics[m] ?? { sum: 0, n: 0 };
  d.metrics[m] = { sum: cur.sum + value, n: cur.n + 1 };
  return l;
}

/** ghi một kết quả bài tập hôm nay */
export function logMetric(m: Metric, value: number) {
  saveLog(addMetric(loadLog(), dayKey(new Date()), m, value));
}

export function setGoal(min: number) {
  const l = loadLog();
  l.goalMin = min;
  saveLog(l);
}

/* ---------- đồng hồ tập ---------- */

const active = new Map<Activity, number>();
let timer: number | undefined;
let last = 0;
/** nghỉ giữa hai lần đếm lâu hơn thế (máy ngủ, chuyển app) thì không cộng */
const MAX_STEP = 10;

function tick() {
  const now = Date.now() / 1000;
  const dt = now - last;
  last = now;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (dt <= 0 || dt > MAX_STEP || !active.size) return;
  saveLog(addTime(loadLog(), dayKey(new Date()), dt, [...active.keys()]));
}

function setActive(a: Activity, on: boolean) {
  const n = (active.get(a) ?? 0) + (on ? 1 : -1);
  if (n > 0) active.set(a, n); else active.delete(a);
  if (active.size && timer === undefined) { last = Date.now() / 1000; timer = window.setInterval(tick, 5000); }
  if (!active.size && timer !== undefined) { tick(); clearInterval(timer); timer = undefined; }
}

/** tính giờ tập cho một hoạt động khi `on` (micro đang bật, bài đang phát…) */
export function usePracticeTimer(a: Activity, on: boolean) {
  useEffect(() => {
    if (!on) return;
    setActive(a, true);
    return () => setActive(a, false);
  }, [a, on]);
}

/* ---------- tổng hợp ---------- */

const practiced = (l: PracticeLog, k: string) => (l.days[k]?.secs ?? 0) >= MIN_DAY_SECS;

/** chuỗi ngày tập liền tới hôm nay (hôm nay chưa tập thì tính tới hôm qua, chuỗi chưa đứt) */
export function streak(l: PracticeLog, today: Date): number {
  let d = practiced(l, dayKey(today)) ? today : addDays(today, -1);
  let n = 0;
  while (practiced(l, dayKey(d))) { n++; d = addDays(d, -1); }
  return n;
}

/** chuỗi dài nhất từng có */
export function bestStreak(l: PracticeLog): number {
  const keys = Object.keys(l.days).filter((k) => practiced(l, k)).sort();
  let best = 0, run = 0, prev: Date | null = null;
  for (const k of keys) {
    const [y, m, dd] = k.split('-').map(Number);
    const d = new Date(y, m - 1, dd);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** n ngày gần nhất tới hôm nay: [{ key, date, secs }] cũ → mới */
export function lastDays(l: PracticeLog, today: Date, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1);
    const key = dayKey(date);
    return { key, date, secs: l.days[key]?.secs ?? 0 };
  });
}

/** giá trị một kết quả trong khoảng ngày: rate → %, avg → trung bình, count → tổng; null nếu chưa có */
export function metricValue(l: PracticeLog, m: Metric, keys: string[]): number | null {
  let sum = 0, n = 0;
  for (const k of keys) { const x = l.days[k]?.metrics[m]; if (x) { sum += x.sum; n += x.n; } }
  if (!n) return null;
  const kind = METRICS[m].kind;
  return kind === 'rate' ? Math.round((100 * sum) / n) : kind === 'avg' ? Math.round((10 * sum) / n) / 10 : sum;
}

/** thời gian từng hoạt động trong khoảng ngày (giây) */
export function activityTotals(l: PracticeLog, keys: string[]): Partial<Record<Activity, number>> {
  const out: Partial<Record<Activity, number>> = {};
  for (const k of keys) for (const [a, s] of Object.entries(l.days[k]?.by ?? {})) out[a as Activity] = (out[a as Activity] ?? 0) + (s ?? 0);
  return out;
}
