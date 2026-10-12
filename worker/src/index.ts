/**
 * Proxy AI cho Sổ Tab Harmonica — chạy trên Cloudflare Workers.
 * Giữ GEMINI_API_KEY ở phía máy chủ, giới hạn số lượt mỗi ngày theo IP,
 * tuỳ chọn yêu cầu APP_TOKEN.
 *
 * Biến môi trường:
 *   GEMINI_API_KEY   (secret, bắt buộc)
 *   APP_TOKEN        (secret, tuỳ chọn) — app phải gửi header x-app-token trùng
 *   DEFAULT_MODEL    (mặc định gemini-3.5-flash-lite)
 *   ALLOWED_MODELS   danh sách model cho phép, cách nhau bởi dấu phẩy
 *   DAILY_LIMIT      số lượt / IP / ngày (mặc định 30) — cần KV binding RATE
 *   ALLOWED_ORIGINS  danh sách origin được gọi, "*" = tất cả
 */
import { AiInput, buildGeminiRequest, geminiUrl, parseGeminiResponse, validateInput } from '../../shared/ai';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  GEMINI_API_KEY: string;
  APP_TOKEN?: string;
  DEFAULT_MODEL?: string;
  ALLOWED_MODELS?: string;
  DAILY_LIMIT?: string;
  ALLOWED_ORIGINS?: string;
  RATE?: KV;
}

const MAX_BODY = 14_000_000;

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const allow = allowed.includes('*') ? '*' : origin && allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-app-token',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req.headers.get('origin'), env);
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, service: 'harptabs-ai' }, 200, h);
    if (url.pathname !== '/v1/transcribe' || req.method !== 'POST') return json({ error: 'Không tìm thấy' }, 404, h);

    if (!env.GEMINI_API_KEY) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY' }, 500, h);
    if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: 'Mã ứng dụng không đúng' }, 401, h);

    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return json({ error: 'Dữ liệu gửi lên quá lớn' }, 413, h);

    let body: { input?: AiInput; model?: string };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Dữ liệu không phải JSON hợp lệ' }, 400, h);
    }
    const input = body.input as AiInput;
    const invalid = validateInput(input);
    if (invalid) return json({ error: invalid }, 400, h);

    const def = env.DEFAULT_MODEL || 'gemini-3.5-flash-lite';
    const allowedModels = (env.ALLOWED_MODELS || def).split(',').map((s) => s.trim()).filter(Boolean);
    const model = body.model && allowedModels.includes(body.model) ? body.model : def;

    // giới hạn lượt theo IP mỗi ngày
    let rateKey = '';
    let used = 0;
    const limit = Number(env.DAILY_LIMIT || 30);
    if (env.RATE) {
      const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
      rateKey = `${ip}:${new Date().toISOString().slice(0, 10)}`;
      used = Number((await env.RATE.get(rateKey)) ?? 0);
      if (used >= limit) return json({ error: `Bạn đã dùng hết ${limit} lượt AI hôm nay, mai thử lại nhé` }, 429, h);
    }

    // key dán qua terminal hay dính khoảng trắng / xuống dòng
    const apiKey = env.GEMINI_API_KEY.trim();
    const upstream = await fetch(geminiUrl(model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(buildGeminiRequest(input)),
    });
    const text = await upstream.text();
    let raw: Parameters<typeof parseGeminiResponse>[0] = {};
    try {
      raw = JSON.parse(text);
    } catch {
      /* phản hồi không phải JSON */
    }
    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      const msg = upstream.status === 429 ? 'AI đang quá tải, thử lại sau ít phút' : 'Không gọi được AI, thử lại sau';
      console.error('gemini error', upstream.status, text.slice(0, 500), `key len=${apiKey.length} ascii=${/^[\x21-\x7e]+$/.test(apiKey)}`);
      return json({ error: msg }, status, h);
    }
    try {
      const out = parseGeminiResponse(raw, model);
      if (env.RATE && rateKey) await env.RATE.put(rateKey, String(used + 1), { expirationTtl: 60 * 60 * 26 });
      return json(out, 200, h);
    } catch (e) {
      return json({ error: (e as Error).message }, 422, h);
    }
  },
};
