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

  it('từ chối đầu vào sai và trả CORS', async () => {
    const r = await worker.fetch(req({ input: { kind: 'name', title: '' } }), { GEMINI_API_KEY: 'k' });
    expect(r.status).toBe(400);
    expect(r.headers.get('access-control-allow-origin')).toBe('*');
  });
});
