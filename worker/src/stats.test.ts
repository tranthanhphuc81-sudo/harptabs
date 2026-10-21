import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import worker from './index';
import { D1, D1Stmt, parsePing, readStats, recordPing, vnDay } from './stats';

/** D1 giả chạy trên SQLite của Node, đủ cho các câu lệnh trong stats.ts */
function fakeD1(): D1 {
  // nạp lúc chạy: Vite không nhận ra node:sqlite là module có sẵn của Node
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const stmt = (sql: string, args: unknown[] = []): D1Stmt & { exec(): { results: unknown[] } } => ({
    bind: (...v: unknown[]) => stmt(sql, v),
    exec: () => {
      const p = db.prepare(sql.replace(/\?(\d+)/g, '?'));
      const order = [...sql.matchAll(/\?(\d+)/g)].map((m) => args[Number(m[1]) - 1]);
      return /^\s*SELECT/i.test(sql) ? { results: p.all(...(order as never[])) } : (p.run(...(order as never[])), { results: [] });
    },
    all: async <T,>() => stmt(sql, args).exec() as { results: T[] },
    run: async () => stmt(sql, args).exec(),
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => list.map((s) => (s as ReturnType<typeof stmt>).exec()),
  };
}

const DAY = 86400_000;
const T0 = Date.parse('2026-10-21T03:00:00Z'); // 10 giờ sáng giờ VN

describe('thống kê ẩn danh', () => {
  it('ngày theo giờ Việt Nam', () => {
    expect(vnDay(Date.parse('2026-10-20T18:00:00Z'))).toBe('2026-10-21');
    expect(vnDay(Date.parse('2026-10-20T16:59:00Z'))).toBe('2026-10-20');
  });

  it('kiểm tra dữ liệu ping', () => {
    expect(parsePing({ id: 'abc', platform: 'web' })).toBeNull();
    expect(parsePing({ id: 'a1b2c3d4-e5f6', platform: 'ios' })).toBeNull();
    expect(parsePing({ id: 'a1b2c3d4-e5f6', platform: 'apk', opens: 9999 })!.opens).toBe(500);
    expect(parsePing({ id: 'a1b2c3d4-e5f6', platform: 'pwa' })!.opens).toBe(1);
  });

  it('đếm lượt cài, người dùng theo ngày, nâng nền tảng khi cài app', async () => {
    const db = fakeD1();
    await recordPing(db, { id: 'aaaaaaaa-1', platform: 'web', opens: 1 }, T0 - 2 * DAY);
    await recordPing(db, { id: 'aaaaaaaa-1', platform: 'pwa', opens: 3 }, T0);
    await recordPing(db, { id: 'bbbbbbbb-2', platform: 'apk', opens: 1 }, T0);
    await recordPing(db, { id: 'bbbbbbbb-2', platform: 'apk', opens: 2 }, T0); // cùng ngày: cộng lần mở
    await recordPing(db, { id: 'cccccccc-3', platform: 'web', opens: 1 }, T0 - 40 * DAY);
    const s = await readStats(db, T0);
    expect(s.installs.total).toBe(3);
    expect(s.installs.byPlatform).toEqual({ web: 1, pwa: 1, apk: 1 });
    expect(s.dau).toBe(2);
    expect(s.wau).toBe(2);
    expect(s.mau).toBe(2);
    expect(s.days).toHaveLength(30);
    const today = s.days[29];
    expect(today).toEqual({ day: '2026-10-21', installs: 1, active: 2, opens: 6 });
    expect(s.days[27]).toEqual({ day: '2026-10-19', installs: 1, active: 1, opens: 1 });
  });

  it('worker: nhận ping, khoá trang số liệu bằng mật khẩu', async () => {
    const env = { GEMINI_API_KEY: 'k', STATS: fakeD1(), STATS_PASSWORD: 'bí mật' };
    const ping = (body: unknown) => worker.fetch(new Request('https://w.example/v1/ping', { method: 'POST', body: JSON.stringify(body) }), env);
    expect((await ping({ id: 'dddddddd-4', platform: 'web' })).status).toBe(204);
    expect((await ping({ id: 'x', platform: 'web' })).status).toBe(400);
    const get = (pw?: string) => worker.fetch(new Request('https://w.example/v1/stats', { headers: pw ? { authorization: `Bearer ${encodeURIComponent(pw)}` } : {} }), env);
    expect((await get()).status).toBe(401);
    expect((await get('sai')).status).toBe(401);
    const ok = await get('bí mật');
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { installs: { total: number } }).installs.total).toBe(1);
    const page = await worker.fetch(new Request('https://w.example/stats'), env);
    expect(page.headers.get('content-type')).toContain('text/html');
  });
});
