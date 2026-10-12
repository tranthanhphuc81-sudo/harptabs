import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { AppStateProvider, useOnline } from './state';
import { ensureSeeded } from './lib/db';
import { Icon } from './components/Icon';
import Library from './pages/Library';
import SongView from './pages/SongView';
import SongEdit from './pages/SongEdit';
import AiImport from './pages/AiImport';
import Learn, { LessonPage } from './pages/Learn';
import Tuner from './pages/Tuner';
import SettingsPage from './pages/Settings';

const NAV = [
  { to: '/', icon: 'library', label: 'Bài hát', end: true },
  { to: '/ai', icon: 'camera', label: 'Nhập AI' },
  { to: '/learn', icon: 'learn', label: 'Học' },
  { to: '/tuner', icon: 'mic', label: 'Dò nốt' },
  { to: '/settings', icon: 'settings', label: 'Cài đặt' },
];

function Shell() {
  const online = useOnline();
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => { setErr(String(e?.message ?? e)); setReady(true); });
  }, []);

  return (
    <div className="app">
      <nav className="nav" aria-label="Điều hướng chính">
        <div className="nav-brand" aria-hidden="true">
          <span className="brand-mark">
            {Array.from({ length: 10 }, (_, i) => <i key={i} />)}
          </span>
          <span className="brand-name">Sổ Tab<br />Harmonica</span>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-item">
            <Icon name={n.icon} size={22} />
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">
        {!online && <div className="offline-pill" role="status">Đang offline — mọi thứ vẫn dùng được, trừ nhập bằng AI</div>}
        {err && <div className="alert error">Không mở được kho dữ liệu trên máy: {err}. Hãy tắt chế độ ẩn danh hoặc cho phép lưu trữ.</div>}
        {ready && (
          <Routes>
            <Route path="/" element={<Library />} />
            <Route path="/new" element={<SongEdit />} />
            <Route path="/song/:id" element={<SongView />} />
            <Route path="/song/:id/edit" element={<SongEdit />} />
            <Route path="/ai" element={<AiImport />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/learn/:lessonId" element={<LessonPage />} />
            <Route path="/tuner" element={<Tuner />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Library />} />
          </Routes>
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
