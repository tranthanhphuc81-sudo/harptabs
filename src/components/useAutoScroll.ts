import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatEvent } from '../lib/tabText';
import { beatAtY, scrollPoints, yAtBeat, type ScrollPoint } from '../lib/autoScroll';
import { visibleBand } from './TabView';

/** vạch đọc: dòng đang chơi giữ ở khoảng 1/3 phía trên vùng nhìn thấy */
const READ_LINE = 0.35;

/** toạ độ trang của các nốt đang hiện trong `root` (nốt có data-i = vị trí trong `flat`) */
function measure(root: Element | null, flat: FlatEvent[]): ScrollPoint[] {
  if (!root) return [];
  const raw: ScrollPoint[] = [];
  root.querySelectorAll<HTMLElement>('[data-i]').forEach((el) => {
    const f = flat[Number(el.dataset.i)];
    const r = el.getBoundingClientRect();
    if (f && r.height > 0) raw.push({ beat: f.start, y: r.top + r.height / 2 + window.scrollY });
  });
  return scrollPoints(raw);
}

/**
 * Tự cuộn trang tab theo nhịp `bpm` (không phát âm thanh). Chạm / kéo / lăn chuột tự dừng (trừ trong vùng
 * `controlsSelector`); chạy lại thì bắt đầu từ dòng đang ở vạch đọc.
 */
export function useAutoScroll(rootSelector: string, flat: FlatEvent[], bpm: number, controlsSelector: string) {
  const [running, setRunning] = useState(false);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const stop = useCallback(() => setRunning(false), []);
  const start = useCallback(() => setRunning(true), []);

  useEffect(() => {
    if (!running) return;
    const root = document.querySelector(rootSelector);
    let pts = measure(root, flat);
    if (pts.length < 2) { setRunning(false); return; }
    const line = () => { const [top, bottom] = visibleBand(); return top + (bottom - top) * READ_LINE; };
    let beat = beatAtY(pts, window.scrollY + line());
    const endBeat = pts[pts.length - 1].beat + 1;
    let last = performance.now();
    let remeasured = last;
    let raf = 0;
    const frame = (now: number) => {
      // chuyển tab / tắt màn hình: không cộng dồn khoảng thời gian bị ngắt
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      beat += (dt * bpmRef.current) / 60;
      // bố cục có thể đổi (xoay máy, đổi cỡ chữ): đo lại mỗi giây
      if (now - remeasured > 1000) { pts = measure(root, flat); remeasured = now; }
      if (beat > endBeat || pts.length < 2) { setRunning(false); return; }
      window.scrollTo(0, Math.max(0, yAtBeat(pts, beat) - line()));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // người dùng tự cuộn / chạm: dừng để đọc lại, chạy tiếp từ chỗ đang xem
    const onUser = (e: Event) => {
      if (e.target instanceof Element && e.target.closest(controlsSelector)) return;
      setRunning(false);
    };
    const onKey = (e: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) setRunning(false); };
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchstart', onUser, { passive: true });
    window.addEventListener('mousedown', onUser);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchstart', onUser);
      window.removeEventListener('mousedown', onUser);
      window.removeEventListener('keydown', onKey);
    };
  }, [running, rootSelector, flat, controlsSelector]);

  return { running, start, stop };
}
