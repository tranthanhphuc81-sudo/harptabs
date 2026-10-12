import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { loadSettings, saveSettings } from './lib/db';
import { DEFAULT_SETTINGS, Settings } from './lib/types';

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
    loadSettings().then((s) => { setSettings(s); setReady(true); }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

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
