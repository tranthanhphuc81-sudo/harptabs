import { setRecorderFingering, setSaoTrucClosed } from './lib/harp';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings } from './lib/db';
import { DEFAULT_SETTINGS, Settings } from './lib/types';
import { startUsageStats } from './lib/usageStats';
import { applyTheme } from './lib/themes';
import { setSyncOffsetMs } from './audio/latency';

interface Ctx {
  settings: Settings;
  ready: boolean;
  update: (p: Partial<Settings>) => void;
  toast: (msg: string) => void;
}

const SettingsCtx = createContext<Ctx>({ settings: DEFAULT_SETTINGS, ready: false, update: () => {}, toast: () => {} });

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setReady(true);
      statsOn.current = s.shareStats;
      startUsageStats(() => statsOn.current);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => { setSyncOffsetMs(settings.syncOffsetMs); }, [settings.syncOffsetMs]);
  useEffect(() => { setRecorderFingering(settings.recorderFingering ?? 'baroque'); }, [settings.recorderFingering]);
  useEffect(() => { setSaoTrucClosed(settings.saoTrucClosed ?? 5); }, [settings.saoTrucClosed]);

  // bảng màu + sáng/tối; "theo máy" thì đổi theo khi máy chuyển chế độ
  useEffect(() => {
    if (!ready) return;
    applyTheme(settings.palette, settings.theme);
    if (settings.theme !== 'system' || typeof matchMedia !== 'function') return;
    const q = matchMedia('(prefers-color-scheme: dark)');
    const on = () => applyTheme(settings.palette, 'system');
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, [ready, settings.palette, settings.theme]);

  // đọc giá trị mới nhất khi gửi thống kê (người dùng có thể tắt giữa chừng)
  const statsOn = useRef(true);
  statsOn.current = settings.shareStats;

  const update = useCallback((p: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...p };
      void saveSettings(next);
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600);
  }, []);

  return (
    <SettingsCtx.Provider value={{ settings, ready, update, toast }}>
      {children}
      <div className="toast" role="status" aria-live="polite" data-show={toastMsg ? '' : undefined}>{toastMsg}</div>
    </SettingsCtx.Provider>
  );
}

export const useAppState = () => useContext(SettingsCtx);

export function useOnline(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}
