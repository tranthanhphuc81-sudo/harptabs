import { useEffect, useState } from 'react';
import { useAppState } from '../state';
import { Icon } from './Icon';

const darkQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/** Nút đổi giao diện sáng ↔ tối (chế độ "Theo máy" chọn trong Cài đặt) */
export function ThemeToggle({ className = 'icon-btn' }: { className?: string }) {
  const { settings, update } = useAppState();
  const [systemDark, setSystemDark] = useState(() => !!darkQuery()?.matches);
  useEffect(() => {
    const q = darkQuery();
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark);
  const label = dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  return (
    <button type="button" className={className} onClick={() => update({ theme: dark ? 'light' : 'dark' })} aria-label={label} title={label}>
      <Icon name={dark ? 'sun' : 'moon'} />
    </button>
  );
}
