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
 *   BURST            (binding Rate Limiting, tuỳ chọn) — chặn gọi dồn dập trong thời gian ngắn
 *
 * Lưu ý: app là PWA công khai nên APP_TOKEN và kiểm tra origin chỉ chặn được trang web khác
 * và người gọi tò mò; lớp bảo vệ chính là giới hạn lượt theo IP.
 */
import { AiInput, buildGeminiRequest, geminiUrl, parseGeminiResponse, validateInput } from '../../shared/ai';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}

/** Binding Rate Limiting của Cloudflare (`[[ratelimits]]` trong wrangler.toml) */
interface RateLimiter {
  limit(opts: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GEMINI_API_KEY: string;
  APP_TOKEN?: string;
  DEFAULT_MODEL?: string;
  ALLOWED_MODELS?: string;
  DAILY_LIMIT?: string;
  ALLOWED_ORIGINS?: string;
  RATE?: KV;
  BURST?: RateLimiter;
}

const MAX_BODY = 14_000_000;
const RATE_TTL = 60 * 60 * 26;

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Trình duyệt luôn gửi Origin khi gọi chéo; origin lạ = trang web khác đang mượn máy chủ */
function originAllowed(origin: string | null, env: Env): boolean {
  const allowed = allowedOrigins(env);
  return !origin || allowed.includes('*') || allowed.includes(origin);
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = allowedOrigins(env);
  const allow = allowed.includes('*') ? '*' : origin && allowed.includes(origin) ? origin : allowed[0] ?? '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-app-token',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

/** Đọc body có giới hạn — không tin header content-length (gửi kiểu chunked sẽ không có) */
async function readBody(req: Request, max: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { all.set(c, off); off += c.byteLength; }
  return new TextDecoder().decode(all);
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

    const origin = req.headers.get('origin');
    if (!originAllowed(origin, env)) return json({ error: 'Trang này không được dùng máy chủ AI' }, 403, h);
    if (!env.GEMINI_API_KEY) return json({ error: 'Máy chủ chưa cấu hình GEMINI_API_KEY' }, 500, h);
    if (env.APP_TOKEN && req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: 'Mã ứng dụng không đúng' }, 401, h);

    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return json({ error: 'Dữ liệu gửi lên quá lớn' }, 413, h);

    const ip = req.headers.get('cf-connecting-ip') ?? 'unknown';
    if (env.BURST && !(await env.BURST.limit({ key: ip })).success) {
      return json({ error: 'Gửi nhanh quá, đợi một phút rồi thử lại' }, 429, h);
    }

    const rawBody = await readBody(req, MAX_BODY);
    if (rawBody === null) return json({ error: 'Dữ liệu gửi lên quá lớn' }, 413, h);
    let body: { input?: AiInput; model?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ error: 'Dữ liệu không phải JSON hợp lệ' }, 400, h);
    }
    const input = body.input as AiInput;
    const invalid = validateInput(input);
    if (invalid) return json({ error: invalid }, 400, h);

    const def = env.DEFAULT_MODEL || 'gemini-3.5-flash-lite';
    const allowedModels = (env.ALLOWED_MODELS || def).split(',').map((s) => s.trim()).filter(Boolean);
    const model = body.model && allowedModels.includes(body.model) ? body.model : def;

    // giới hạn lượt theo IP mỗi ngày: giữ chỗ trước khi gọi AI để các yêu cầu gửi cùng lúc không lọt qua,
    // trả lại lượt nếu Gemini lỗi (lỗi đó không tính tiền)
    let rateKey = '';
    let used = 0;
    const limit = Number(env.DAILY_LIMIT || 30);
    if (env.RATE) {
      rateKey = `${ip}:${new Date().toISOString().slice(0, 10)}`;
      used = Number((await env.RATE.get(rateKey)) ?? 0);
      if (used >= limit) return json({ error: `Bạn đã dùng hết ${limit} lượt AI hôm nay, mai thử lại nhé` }, 429, h);
      await env.RATE.put(rateKey, String(used + 1), { expirationTtl: RATE_TTL });
    }
    const refund = async () => {
      if (env.RATE && rateKey) await env.RATE.put(rateKey, String(used), { expirationTtl: RATE_TTL });
    };

    // key dán qua terminal hay dính khoảng trắng / xuống dòng
    const apiKey = env.GEMINI_API_KEY.trim();
    let upstream: Response;
    try {
      upstream = await fetch(geminiUrl(model), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildGeminiRequest(input)),
      });
    } catch (e) {
      await refund();
      console.error('gemini fetch failed', (e as Error).message);
      return json({ error: 'Không gọi được AI, thử lại sau' }, 502, h);
    }
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
      await refund();
      return json({ error: msg }, status, h);
    }
    try {
      const out = parseGeminiResponse(raw, model);
      return json(out, 200, h);
    } catch (e) {
      return json({ error: (e as Error).message }, 422, h);
    }
  },
};
