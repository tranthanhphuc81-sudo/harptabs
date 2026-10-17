import { useEffect } from 'react';
import { useAppState } from '../state';

/**
 * Giữ màn hình sáng khi đang tập (tay bận cầm kèn, không chạm được màn hình).
 * Trình duyệt tự nhả khoá khi chuyển app / tắt màn hình → quay lại thì xin lại.
 */
export function useWakeLock(active: boolean) {
  const { settings } = useAppState();
  const on = active && settings.keepAwake;
  useEffect(() => {
    if (!on || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const l = await navigator.wakeLock.request('screen');
        if (alive) lock = l;
        else void l.release();
      } catch { /* pin yếu / trình duyệt từ chối: bỏ qua */ }
    };
    const onVisible = () => { void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}
