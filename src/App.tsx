import { useAppState } from './state';
import { useWakeLock } from './components/useWakeLock';
import { BRAND } from './appConfig';
import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { AppStateProvider, useOnline } from './state';
import { ensureSeeded } from './lib/db';
import { Icon } from './components/Icon';
import { ThemeToggle } from './components/ThemeToggle';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateNotice } from './components/AppNotices';
import Library from './pages/Library';
import SongView from './pages/SongView';

// các trang ít mở hơn: tải khi cần để app mở nhanh (service worker vẫn lưu sẵn để chạy offline)
const SongEdit = lazy(() => import('./pages/SongEdit'));
const AiImport = lazy(() => import('./pages/AiImport'));
const Learn = lazy(() => import('./pages/Learn'));
const LessonPage = lazy(() => import('./pages/Learn').then((m) => ({ default: m.LessonPage })));
const Tuner = lazy(() => import('./pages/Tuner'));
const Jam = lazy(() => import('./pages/Jam'));
const BauPractice = lazy(() => import('./pages/BauPractice'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const SharedSong = lazy(() => import('./pages/SharedSong'));

const NAV = [
  { to: '/', icon: 'library', label: 'Bài hát', end: true },
  { to: '/ai', icon: 'scan', label: 'Nhập bài' },
  { to: '/learn', icon: 'learn', label: 'Học' },
  { to: '/tuner', icon: 'mic', label: 'Dò nốt' },
  { to: '/settings', icon: 'settings', label: 'Cài đặt' },
];

function Shell() {
  const online = useOnline();
  // giữ màn hình sáng suốt lúc app đang mở (Cài đặt → Luôn giữ sáng); tay bận cầm kèn / sáo
  const { settings } = useAppState();
  useWakeLock(settings.keepAwakeAlways ?? true);
  // cỡ hình dưới mỗi nốt (bàn phím pianica, thế bấm sáo, phím kalimba) dùng chung mọi trang có tab
  useEffect(() => { document.documentElement.style.setProperty('--finger-scale', String(settings.fingerScale ?? 1)); }, [settings.fingerScale]);
  const { pathname } = useLocation();
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => { setErr(String(e?.message ?? e)); setReady(true); });
    // mọi bài chỉ nằm trên máy: xin trình duyệt đừng tự xoá khi máy đầy bộ nhớ
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  return (
    <div className="app">
      <nav className="nav" aria-label="Điều hướng chính">
        <div className="nav-brand" aria-hidden="true">
          <span className="brand-mark">
            {Array.from({ length: 10 }, (_, i) => <i key={i} />)}
          </span>
          <span className="brand-name">{BRAND.line1}<br />{BRAND.line2}</span>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="nav-theme"><ThemeToggle /></div>
      </nav>
      <main className="main">
        <UpdateNotice />
        {!online && <div className="offline-pill" role="status">Đang offline — mọi thứ vẫn dùng được, trừ phần nhờ AI</div>}
        {err && <div className="alert error">Không mở được kho dữ liệu trên máy: {err}. Hãy tắt chế độ ẩn danh hoặc cho phép lưu trữ.</div>}
        {ready && (
          <ErrorBoundary key={pathname}>
          <Suspense fallback={<div className="page" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/new" element={<SongEdit />} />
            <Route path="/song/:id" element={<SongView />} />
            <Route path="/song/:id/edit" element={<SongEdit />} />
            <Route path="/ai" element={<AiImport />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:lessonId" element={<LessonPage />} />
            <Route path="/tuner" element={<Tuner />} />
            <Route path="/jam" element={<Jam />} />
            <Route path="/tap-boi-am" element={<BauPractice />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/shared" element={<SharedSong />} />
            <Route path="*" element={<Library />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </AppStateProvider>
  );
}
