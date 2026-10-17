import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const good = {
  candidates: [{ content: { parts: [{ text: JSON.stringify({
    title: 'X', tempo: 90, timeSignature: '4/4', confidence: 0.8, warnings: [],
    sections: [{ lines: [{ notes: [{ pitch: 'C5', beats: 1, lyric: '' }] }] }],
  }) }] } }],
  usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
};

function mem() {
  const m = new Map<string, string>();
  return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) };
}

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://w.example/v1/transcribe', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

afterEach(() => vi.unstubAllGlobals());

describe('worker', () => {
  it('chặn sai token, cho qua đúng token, đếm lượt', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(good), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const env = { GEMINI_API_KEY: 'k', APP_TOKEN: 't', DAILY_LIMIT: '1', RATE: mem() };
    const input = { input: { kind: 'name', title: 'Hello' } };
    expect((await worker.fetch(req(input), env)).status).toBe(401);
    const ok = await worker.fetch(req(input, { 'x-app-token': 't' }), env);
    expect(ok.status).toBe(200);
    const data: any = await ok.json();
    expect(data.result.title).toBe('X');
    expect(data.usage.model).toBe('gemini-3.5-flash-lite');
    expect((fetchMock.mock.calls[0] as any)[1].headers['x-goog-api-key']).toBe('k');
    expect((await worker.fetch(req(input, { 'x-app-token': 't' }), env)).status).toBe(429);
  });

  it('chặn trang web lạ, cho qua origin trong danh sách và gọi không có origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(good), { status: 200 })));
    const env = { GEMINI_API_KEY: 'k', ALLOWED_ORIGINS: 'https://harptabs.pages.dev' };
    const input = { input: { kind: 'name', title: 'Hello' } };
    expect((await worker.fetch(req(input, { origin: 'https://evil.example' }), env)).status).toBe(403);
    const ok = await worker.fetch(req(input, { origin: 'https://harptabs.pages.dev' }), env);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://harptabs.pages.dev');
    expect((await worker.fetch(req(input), env)).status).toBe(200);
  });

  it('giữ lượt trước khi gọi AI, trả lại lượt khi Gemini lỗi', async () => {
    const rate = mem();
    const env = { GEMINI_API_KEY: 'k', DAILY_LIMIT: '1', RATE: rate };
    const input = { input: { kind: 'name', title: 'Hello' } };
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })));
    expect((await worker.fetch(req(input), env)).status).toBe(502);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(good), { status: 200 })));
    expect((await worker.fetch(req(input), env)).status).toBe(200);
    expect((await worker.fetch(req(input), env)).status).toBe(429);
  });

  it('chặn gọi dồn dập bằng binding BURST', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(good), { status: 200 })));
    const env = { GEMINI_API_KEY: 'k', BURST: { limit: async () => ({ success: false }) } };
    expect((await worker.fetch(req({ input: { kind: 'name', title: 'Hello' } }), env)).status).toBe(429);
  });

  it('chặn body quá lớn kể cả khi không có content-length', async () => {
    const big = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < 15; i++) c.enqueue(new Uint8Array(1_000_000));
        c.close();
      },
    });
    const r = new Request('https://w.example/v1/transcribe', { method: 'POST', body: big, duplex: 'half' } as RequestInit);
    expect((await worker.fetch(r, { GEMINI_API_KEY: 'k' })).status).toBe(413);
  });

  it('từ chối đầu vào sai và trả CORS', async () => {
    const r = await worker.fetch(req({ input: { kind: 'name', title: '' } }), { GEMINI_API_KEY: 'k' });
    expect(r.status).toBe(400);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });
});
