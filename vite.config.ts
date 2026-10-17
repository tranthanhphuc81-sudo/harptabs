import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Sổ Tab Harmonica',
        short_name: 'Harp Tab',
        description: 'Lưu và tập harptab diatonic 10 lỗ, chạy offline',
        lang: 'vi',
        theme_color: '#1f2a33',
        background_color: '#eef1f2',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        // nhận chia sẻ từ trình duyệt/app khác (bôi đen tab → Chia sẻ → Harp Tab)
        share_target: { action: './', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        // bộ đọc chữ tên bài (~5 MB): không tải sẵn khi cài; lần đầu dùng mới tải rồi giữ lại để chạy offline
        // bộ đọc PDF (~1,6 MB) cũng vậy: chỉ tải khi nhập bản nhạc PDF lần đầu
        globIgnores: ['ocr/**', 'assets/pdf-*', 'assets/pdf.worker*'],
        runtimeCaching: [
          { urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/ocr/'), handler: 'CacheFirst', options: { cacheName: 'ocr', expiration: { maxEntries: 10 } } },
          { urlPattern: ({ url }: { url: URL }) => /\/assets\/pdf(-|\.worker)/.test(url.pathname), handler: 'CacheFirst', options: { cacheName: 'pdf', expiration: { maxEntries: 6 } } }
        ],
        navigateFallback: 'index.html'
      }
    })
  ],
  test: {
    environment: 'node'
  }
} as any);
