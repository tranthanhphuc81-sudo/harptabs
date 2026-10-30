/**
 * Chạy thử cả app (một bản build VITE_APP) trên jsdom: mở lần lượt mọi trang — thư viện, vài bài, sửa bài,
 * nhập bài, mọi bài học, dò nốt, các trang tập, cài đặt — và kiểm những lỗi kiểu "dùng chung mã nguồn":
 *  - trang không vỡ (ErrorBoundary), có tiêu đề;
 *  - app khác harmonica không vẽ sơ đồ kèn (.harp-diagram);
 *  - chữ "kèn / thổi / lỗ" chỉ có ở app dùng tới (đàn tranh mà ghi "Thổi sáo" là lỗi).
 * Mỗi app một file test (mỗi file chạy trong môi trường riêng nên appConfig đọc đúng VITE_APP).
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';

export type SmokeApp = 'harmonica' | 'recorder' | 'kalimba' | 'guitar' | 'pianica' | 'tranh' | 'organ';

/** chữ chỉ dành cho nhạc cụ thổi / có lỗ — app nào được phép dùng */
const WORDS: Record<string, SmokeApp[]> = {
  kèn: ['harmonica', 'pianica'],
  thổi: ['harmonica', 'recorder', 'pianica'],
  lỗ: ['harmonica', 'recorder'],
};

/** jsdom thiếu vài API trình duyệt mà app gọi khi mở trang */
function stubBrowser() {
  window.matchMedia ??= ((q: string) => ({
    matches: false, media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView ??= function scrollIntoView() {};
  (globalThis as Record<string, unknown>).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  (globalThis as Record<string, unknown>).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  // không gọi API AI / tải file thật trong lúc chạy thử
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
}

const tick = (ms = 0) => act(() => new Promise<void>((r) => { setTimeout(r, ms); }));

/** chờ tới khi điều kiện đúng (trang lazy tải xong, bài mẫu đã nạp) */
async function until(cond: () => boolean, ms = 4000) {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) return false;
    await tick(20);
  }
  return true;
}

async function go(path: string) {
  const prev = document.querySelector('main h1');
  await act(async () => {
    window.location.hash = '#' + path;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  // mỗi đường dẫn dựng lại cả trang (ErrorBoundary theo pathname): chờ tiêu đề mới thay tiêu đề cũ, hết khung "đang tải"
  await until(() => { const h = document.querySelector('main h1'); return !!h && h !== prev && !document.querySelector('main [aria-busy="true"]'); });
  await tick(50);
}

/** chỗ dùng đúng nghĩa ở mọi app: lỗ thoát âm của kalimba hộp, danh sách các app cùng bộ (có "kèn pianica") */
const ALLOWED = [/lỗ (thoát âm|tròn)|(che – mở|che|mở|có) lỗ/giu, /Cùng bộ còn app cho[^:]*/gu];

function wordsIn(raw: string): string[] {
  const text = ALLOWED.reduce((t, re) => t.replace(re, ' '), raw);
  const found: string[] = [];
  for (const w of Object.keys(WORDS)) if (new RegExp(`(^|[^\\p{L}])${w}(?=[^\\p{L}]|$)`, 'iu').test(text)) found.push(w);
  return found;
}

export function smokeApp(app: SmokeApp) {
  describe(`chạy thử app ${app}`, () => {
    let App: ComponentType;
    beforeAll(async () => {
      stubBrowser();
      vi.stubEnv('VITE_APP', app === 'harmonica' ? '' : app);
      vi.resetModules();
      App = (await import('../App')).default;
    });
    afterAll(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

    it('mở mọi trang: không vỡ, đúng sơ đồ nhạc cụ, không lẫn chữ của nhạc cụ khác', async () => {
      window.location.hash = '#/';
      const err = console.error;
      const errors: string[] = [];
      console.error = (...a: unknown[]) => { errors.push(a.map(String).join(' ').slice(0, 200)); };
      try {
        render(<App />);
        // thư viện: bài mẫu được nạp
        expect(await until(() => document.querySelectorAll('a[href*="/song/"]').length > 0, 8000), 'thư viện có bài mẫu').toBe(true);
        const songs = [...new Set([...document.querySelectorAll('a[href*="/song/"]')].map((a) => a.getAttribute('href')!.replace(/^#/, '')))];
        await go('/learn');
        const lessons = [...new Set([...document.querySelectorAll('main a[href*="/learn/"]')].map((a) => a.getAttribute('href')!.replace(/^#/, '')))];
        const practice = [...new Set([...document.querySelectorAll('main a[href^="#/"]')].map((a) => a.getAttribute('href')!.replace(/^#/, '').split('?')[0]))]
          .filter((p) => !p.startsWith('/learn/') && p !== '/learn');
        const routes = ['/', ...songs.slice(0, 3), `${songs[0]}/edit`, '/new', '/ai', '/learn', ...lessons, ...practice, '/tuner', '/settings'];

        const problems: string[] = [];
        for (const r of [...new Set(routes)]) {
          await go(r);
          const main = document.querySelector('main');
          const where = `${r} → ${window.location.hash}`;
          if (!main) { problems.push(`${where}: không có <main>`); continue; }
          const boom = main.querySelector('[role="alert"]')?.textContent ?? '';
          if (/Trang này gặp lỗi/.test(boom)) problems.push(`${where}: trang lỗi — ${boom.slice(0, 120)}`);
          if (!main.querySelector('h1')) problems.push(`${where}: không có tiêu đề`);
          if (app !== 'harmonica' && main.querySelector('.harp-diagram')) problems.push(`${where}: vẽ sơ đồ kèn harmonica`);
          const bad = wordsIn(main.textContent ?? '').filter((w) => !WORDS[w].includes(app));
          if (bad.length) {
            const lines = (main.textContent ?? '').split(/(?<=[.!?:])\s+/).filter((l) => wordsIn(l).some((w) => bad.includes(w))).slice(0, 2);
            problems.push(`${where}: có chữ "${bad.join(', ')}" — ${lines.map((l) => l.slice(0, 100)).join(' / ')}`);
          }
        }
        expect(problems).toEqual([]);
        expect(lessons.length, 'trang Học có bài học').toBeGreaterThan(2);
        // React báo lỗi khi dựng trang (không tính cảnh báo act / jsdom thiếu API)
        expect(errors.filter((e) => /The above error occurred|Uncaught/.test(e))).toEqual([]);
      } finally {
        console.error = err;
      }
    }, 120_000);
  });
}
