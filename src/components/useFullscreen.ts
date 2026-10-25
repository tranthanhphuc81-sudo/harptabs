import { RefObject, useCallback, useEffect, useState } from 'react';

/**
 * Toàn màn hình cho một phần tử (Fullscreen API). iPhone không cho phần tử nào toàn màn hình:
 * khi đó `supported` = false, lớp phủ vẫn phủ kín màn hình bằng CSS (position: fixed).
 */
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const supported = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const [active, setActive] = useState(false);

  useEffect(() => {
    const on = () => setActive(!!document.fullscreenElement && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, [ref]);

  const enter = useCallback(async () => {
    const el = ref.current;
    if (!el || !supported || document.fullscreenElement) return;
    // trình duyệt chặn (không do người dùng bấm, hoặc app đã toàn màn hình kiểu PWA): bỏ qua, lớp phủ CSS vẫn kín màn hình
    try { await el.requestFullscreen({ navigationUI: 'hide' }); } catch { /* bỏ qua */ }
  }, [ref, supported]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch { /* bỏ qua */ } }
  }, []);

  return { supported, active, enter, exit };
}
