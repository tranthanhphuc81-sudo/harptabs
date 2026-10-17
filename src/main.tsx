import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import './styles/app.css';
import App from './App';
import { setUpdateReady } from './lib/swUpdate';
import { installThemes } from './lib/themes';

installThemes();

const updateSW = registerSW({
  immediate: true,
  // có bản mới: chờ người dùng bấm "Cập nhật" (xem components/AppNotices.tsx)
  onNeedRefresh: () => setUpdateReady(() => {
    void updateSW(true);
    // trang chưa do service worker điều khiển (lần mở đầu) thì bản mới đã chạy sẵn, không có gì để kích hoạt: tự tải lại
    window.setTimeout(() => location.reload(), 3000);
  }),
  // app mở cả ngày (nhất là bản Android) thì mỗi giờ hỏi máy chủ một lần
  onRegisteredSW: (_url, reg) => {
    if (reg) setInterval(() => { if (navigator.onLine) reg.update().catch(() => {}); }, 60 * 60 * 1000);
  },
});

// Nội dung được chia sẻ vào app (?title=&text=&url=): cất tạm rồi mở thẳng "Dán tab"
const shared = new URLSearchParams(location.search);
const sharedLink = /#\/shared\?d=([\w-]+)/.exec(`${shared.get('url') ?? ''} ${shared.get('text') ?? ''}`);
if (sharedLink) {
  // chia sẻ link bài (của chính app) vào app → mở thẳng bài, không qua "Dán tab"
  history.replaceState(null, '', `${location.pathname}#/shared?d=${sharedLink[1]}`);
} else if (shared.has('text') || shared.has('url') || shared.has('title')) {
  const payload = { title: shared.get('title') ?? '', text: shared.get('text') ?? '', url: shared.get('url') ?? '' };
  try { sessionStorage.setItem('harptabs-shared', JSON.stringify(payload)); } catch { /* chế độ riêng tư */ }
  history.replaceState(null, '', `${location.pathname}#/ai?paste=1`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
