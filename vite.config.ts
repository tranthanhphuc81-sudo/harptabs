import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// cùng mã nguồn ra ba app: VITE_APP=recorder → Sổ Tab Sáo, VITE_APP=kalimba → Sổ Tab Kalimba (tên, biểu tượng, mô tả riêng)
const RECORDER = process.env.VITE_APP === 'recorder';
const KALIMBA = process.env.VITE_APP === 'kalimba';
const BRAND = KALIMBA
  ? { name: 'Sổ Tab Kalimba', short: 'Kalimba Tab', desc: 'Sổ bài kalimba 17 phím: tab số kèm vị trí phím, phát nhạc đệm, karaoke, dò nốt để chỉnh dây, học chơi. Chạy offline.', icons: 'kalimba/' }
  : RECORDER
  ? { name: 'Sổ Tab Sáo', short: 'Sáo Tab', desc: 'Sổ bài sáo dọc alto / soprano: tab tên nốt kèm thế bấm, phát nhạc đệm, dò nốt, học thổi. Chạy offline.', icons: 'recorder/' }
  : { name: 'Sổ Tab Harmonica', short: 'Harp Tab', desc: 'Sổ tab harmonica diatonic 10 lỗ: lưu bài, phát beat mẫu, dò nốt, học kỹ thuật. Chạy offline.', icons: '' };

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'brand-html',
      transformIndexHtml: (html: string) => html
        .replace(/<title>.*<\/title>/, `<title>${BRAND.name}</title>`)
        .replace(/(<meta name="description" content=")[^"]*"/, `$1${BRAND.desc}"`)
        .replace(/href="\.\/icon\.svg"/, `href="./${BRAND.icons}icon.svg"`)
        .replace(/href="\.\/icon-192\.png"/, `href="./${BRAND.icons}icon-192.png"`),
    },
    VitePWA({
      // không tự tải lại khi có bản mới: người dùng bấm "Cập nhật" khi xong việc
      registerType: 'prompt',
      includeAssets: [`${BRAND.icons}icon.svg`],
      manifest: {
        name: BRAND.name,
        short_name: BRAND.short,
        description: BRAND.desc,
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
          { src: `${BRAND.icons}icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BRAND.icons}icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${BRAND.icons}icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
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
