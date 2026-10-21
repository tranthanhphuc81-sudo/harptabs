/**
 * Thống kê ẩn danh lượt cài / lượt dùng (tắt được trong Cài đặt).
 * Máy tạo một mã ngẫu nhiên, mỗi ngày gửi máy chủ một lần: mã đó, nền tảng (web / app cài từ web / APK)
 * và số lần mở app kể từ lần gửi trước. Không gửi tên bài, nội dung hay thông tin cá nhân.
 * Máy chủ: worker/src/stats.ts.
 */
import { db, newId } from './db';
import { DEFAULT_SETTINGS } from './types';

export type Platform = 'web' | 'pwa' | 'apk';

const ENDPOINT = `${DEFAULT_SETTINGS.proxyUrl}/v1/ping`;
const TWA_REFERRER = 'android-app://dev.pages.harptabs.twa';

/** Ngày theo giờ Việt Nam, khớp cách máy chủ tính ngày */
export function vnDay(now = Date.now()): string {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}

/** APK chỉ lộ ra ở lần mở đầu (referrer), nên nhớ lại; app cài từ web chạy ở chế độ standalone */
export function detectPlatform(rememberedApk: boolean, referrer: string, standalone: boolean): Platform {
  if (rememberedApk || referrer.startsWith(TWA_REFERRER)) return 'apk';
  return standalone ? 'pwa' : 'web';
}

function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone;
  } catch { return false; }
}

interface StatsState { id: string; lastDay: string | null; opens: number; apk: boolean }

let running: Promise<void> | null = null;

/**
 * Gọi khi mở app (countOpen = true) và khi quay lại app (false, chỉ để gửi nếu đã sang ngày mới).
 * Chỉ chạy ở bản build thật, không chạy khi phát triển trên máy.
 */
export function reportUsage(countOpen: boolean, send: typeof fetch = fetch, now = Date.now()): Promise<void> {
  if (running) return running;
  running = doReport(countOpen, send, now).catch(() => {}).finally(() => { running = null; });
  return running;
}

async function doReport(countOpen: boolean, send: typeof fetch, now: number): Promise<void> {
  const row = await db.kv.get('usageStats');
  const prev = row?.value as StatsState | undefined;
  const platform = detectPlatform(!!prev?.apk, typeof document === 'undefined' ? '' : document.referrer, isStandalone());
  const st: StatsState = {
    id: prev?.id ?? newId(),
    lastDay: prev?.lastDay ?? null,
    opens: (prev?.opens ?? 0) + (countOpen ? 1 : 0),
    apk: platform === 'apk',
  };
  const today = vnDay(now);
  if (st.lastDay !== today && st.opens > 0 && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    const r = await send(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: st.id, platform, opens: st.opens }),
      keepalive: true,
    }).catch(() => null);
    if (r && (r.ok || r.status === 400)) { st.lastDay = today; st.opens = 0; } // 400: dữ liệu hỏng, gửi lại cũng vậy
  }
  await db.kv.put({ key: 'usageStats', value: st });
}

/** Bật thống kê cho cả phiên: gửi khi mở app và khi quay lại app sau khi sang ngày mới */
export function startUsageStats(isEnabled: () => boolean): void {
  if (!import.meta.env.PROD || !isEnabled()) return;
  void reportUsage(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isEnabled()) void reportUsage(false);
  });
}
