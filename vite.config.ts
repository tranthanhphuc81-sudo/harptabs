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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html'
      }
    })
  ],
  test: {
    environment: 'node'
  }
} as any);
