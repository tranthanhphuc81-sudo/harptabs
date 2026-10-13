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

registerSW({ immediate: true });

// Nội dung được chia sẻ vào app (?title=&text=&url=): cất tạm rồi mở thẳng "Dán tab"
const shared = new URLSearchParams(location.search);
if (shared.has('text') || shared.has('url') || shared.has('title')) {
  const payload = { title: shared.get('title') ?? '', text: shared.get('text') ?? '', url: shared.get('url') ?? '' };
  try { sessionStorage.setItem('harptabs-shared', JSON.stringify(payload)); } catch { /* chế độ riêng tư */ }
  history.replaceState(null, '', `${location.pathname}#/ai?paste=1`);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
