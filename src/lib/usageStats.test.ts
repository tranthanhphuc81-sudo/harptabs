import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { detectPlatform, reportUsage, vnDay } from './usageStats';

const DAY = 86400_000;
const T0 = Date.parse('2026-10-21T03:00:00Z');

beforeEach(async () => { await db.kv.delete('usageStats'); });

const okFetch = () => vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 204 }));
const sent = (f: ReturnType<typeof okFetch>, i = 0) => JSON.parse(String(f.mock.calls[i][1]!.body));

describe('thống kê ẩn danh trên app', () => {
  it('nhận ra nền tảng', () => {
    expect(detectPlatform(false, 'android-app://dev.pages.harptabs.twa/', true)).toBe('apk');
    expect(detectPlatform(true, '', true)).toBe('apk');
    expect(detectPlatform(false, '', true)).toBe('pwa');
    expect(detectPlatform(false, 'https://google.com/', false)).toBe('web');
  });

  it('mỗi ngày gửi một lần, cộng dồn số lần mở vào lần gửi sau, giữ nguyên mã máy', async () => {
    const f = okFetch();
    await reportUsage(true, f as typeof fetch, T0);
    await reportUsage(true, f as typeof fetch, T0 + 3600_000);
    await reportUsage(false, f as typeof fetch, T0 + 7200_000);
    expect(f).toHaveBeenCalledTimes(1);
    const first = sent(f);
    expect(first).toMatchObject({ platform: 'web', opens: 1 });
    expect(first.id).toMatch(/^[A-Za-z0-9-]{8,64}$/);

    await reportUsage(false, f as typeof fetch, T0 + DAY);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sent(f, 1)).toEqual({ id: first.id, platform: 'web', opens: 1 });
  });

  it('gửi lỗi thì giữ lại, hôm sau gửi bù', async () => {
    const bad = vi.fn(async () => { throw new Error('offline'); });
    await reportUsage(true, bad as unknown as typeof fetch, T0);
    const f = okFetch();
    await reportUsage(true, f as typeof fetch, T0 + 60_000);
    expect(sent(f)).toMatchObject({ opens: 2 });
  });

  it('ngày theo giờ Việt Nam', () => {
    expect(vnDay(Date.parse('2026-10-20T17:30:00Z'))).toBe('2026-10-21');
  });
});
