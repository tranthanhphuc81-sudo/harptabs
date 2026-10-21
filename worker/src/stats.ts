/**
 * Thống kê ẩn danh: lượt cài và lượt dùng app.
 *
 *   POST /v1/ping   app gửi mỗi ngày một lần: { id, platform, version?, opens? }
 *   GET  /v1/stats  số liệu (header authorization: Bearer <encodeURIComponent(STATS_PASSWORD)>)
 *   GET  /stats     trang xem số liệu, hỏi mật khẩu
 *
 * Cần binding D1 STATS (xem schema.sql) và secret STATS_PASSWORD. Không lưu IP hay thông tin cá nhân.
 */

export interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1 {
  prepare(query: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<{ results: unknown[] }[]>;
}

export const PLATFORMS = ['web', 'pwa', 'apk'] as const;
export type Platform = (typeof PLATFORMS)[number];

const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const DAYS = 30;

/** Ngày theo giờ Việt Nam (UTC+7), dạng 2026-10-21 */
export function vnDay(now = Date.now(), offsetDays = 0): string {
  return new Date(now + 7 * 3600_000 + offsetDays * 86400_000).toISOString().slice(0, 10);
}

export interface Ping { id: string; platform: Platform; version?: string; opens: number }

export function parsePing(raw: unknown): Ping | null {
  const b = raw as Partial<Record<keyof Ping, unknown>> | null;
  if (!b || typeof b.id !== 'string' || !ID_RE.test(b.id)) return null;
  if (!PLATFORMS.includes(b.platform as Platform)) return null;
  const version = typeof b.version === 'string' ? b.version.slice(0, 32) : undefined;
  const opens = Math.min(500, Math.max(1, Math.floor(Number(b.opens) || 1)));
  return { id: b.id, platform: b.platform as Platform, version, opens };
}

export async function recordPing(db: D1, p: Ping, now = Date.now()): Promise<void> {
  const day = vnDay(now);
  await db.batch([
    // máy mới: thêm; máy cũ vừa cài app (web → pwa / apk): cập nhật nền tảng
    db.prepare(
      `INSERT INTO installs (id, first_day, platform, version) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (id) DO UPDATE SET version = excluded.version,
         platform = CASE WHEN excluded.platform = 'web' THEN installs.platform ELSE excluded.platform END`,
    ).bind(p.id, day, p.platform, p.version ?? null),
    db.prepare(
      `INSERT INTO active (day, id, platform, opens) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (day, id) DO UPDATE SET opens = active.opens + excluded.opens, platform = excluded.platform`,
    ).bind(day, p.id, p.platform, p.opens),
  ]);
}

export interface DayRow { day: string; installs: number; active: number; opens: number }
export interface Stats {
  today: string;
  installs: { total: number; byPlatform: Record<Platform, number> };
  dau: number;
  wau: number;
  mau: number;
  mauByPlatform: Record<Platform, number>;
  days: DayRow[];
}

const zero = (): Record<Platform, number> => ({ web: 0, pwa: 0, apk: 0 });

export async function readStats(db: D1, now = Date.now()): Promise<Stats> {
  const today = vnDay(now);
  const from = vnDay(now, -(DAYS - 1));
  const week = vnDay(now, -6);
  const [byPlat, newPerDay, actPerDay, wau, mau, mauPlat] = await db.batch([
    db.prepare('SELECT platform, COUNT(*) AS n FROM installs GROUP BY platform'),
    db.prepare('SELECT first_day AS day, COUNT(*) AS n FROM installs WHERE first_day >= ?1 GROUP BY first_day').bind(from),
    db.prepare('SELECT day, COUNT(*) AS n, SUM(opens) AS o FROM active WHERE day >= ?1 GROUP BY day').bind(from),
    db.prepare('SELECT COUNT(DISTINCT id) AS n FROM active WHERE day >= ?1').bind(week),
    db.prepare('SELECT COUNT(DISTINCT id) AS n FROM active WHERE day >= ?1').bind(from),
    db.prepare('SELECT platform, COUNT(DISTINCT id) AS n FROM active WHERE day >= ?1 GROUP BY platform').bind(from),
  ]);
  type R = { platform?: string; day?: string; n: number; o?: number };
  const rows = (x: { results: unknown[] }) => x.results as R[];

  const byPlatform = zero();
  for (const r of rows(byPlat)) if (PLATFORMS.includes(r.platform as Platform)) byPlatform[r.platform as Platform] = Number(r.n);
  const mauByPlatform = zero();
  for (const r of rows(mauPlat)) if (PLATFORMS.includes(r.platform as Platform)) mauByPlatform[r.platform as Platform] = Number(r.n);

  const ins = new Map(rows(newPerDay).map((r) => [r.day!, Number(r.n)]));
  const act = new Map(rows(actPerDay).map((r) => [r.day!, r]));
  const days: DayRow[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const day = vnDay(now, -i);
    const a = act.get(day);
    days.push({ day, installs: ins.get(day) ?? 0, active: a ? Number(a.n) : 0, opens: a ? Number(a.o ?? 0) : 0 });
  }
  return {
    today,
    installs: { total: Object.values(byPlatform).reduce((s, n) => s + n, 0), byPlatform },
    dau: days[days.length - 1].active,
    wau: Number(rows(wau)[0]?.n ?? 0),
    mau: Number(rows(mau)[0]?.n ?? 0),
    mauByPlatform,
    days,
  };
}

/** So mật khẩu không lộ thời gian so (băm rồi so từng byte) */
export async function passwordOk(given: string | null, expected: string | undefined): Promise<boolean> {
  if (!given || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected.trim())),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Trang xem số liệu: hỏi mật khẩu, gọi /v1/stats, vẽ bảng + biểu đồ cột */
export const STATS_PAGE = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Thống kê Sổ Tab Harmonica</title>
<style>
:root{--bg:#eef1f2;--ink:#1f2a33;--muted:#5b6b77;--card:#fff;--a:#c47a1c;--b:#2c6aa8;--line:#d7dde1}
@media (prefers-color-scheme:dark){:root{--bg:#141a1f;--ink:#e6ecef;--muted:#9aa8b2;--card:#1d252c;--line:#2d3841}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif}
main{max-width:860px;margin:0 auto;padding:20px 16px 40px}h1{font-size:1.4rem;margin:0 0 4px}.muted{color:var(--muted)}
form{display:flex;gap:8px;margin:24px 0}input{flex:1;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:inherit;background:var(--card);color:var(--ink)}
button{padding:10px 16px;border:0;border-radius:8px;background:var(--ink);color:var(--bg);font:inherit;font-weight:600;cursor:pointer}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}
.tile{background:var(--card);border-radius:12px;padding:12px 14px}.tile b{display:block;font-size:1.7rem;font-variant-numeric:tabular-nums}
.tile span{font-size:.85rem;color:var(--muted)}.card{background:var(--card);border-radius:12px;padding:14px;margin:12px 0;overflow-x:auto}
h2{font-size:1rem;margin:0 0 10px}.chart{display:flex;align-items:flex-end;gap:3px;height:150px}.col{flex:1;min-width:8px;display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.bar{background:var(--b);border-radius:3px 3px 0 0;min-height:1px}.bar.i{background:var(--a)}.ax{display:flex;justify-content:space-between;font-size:.75rem;color:var(--muted);margin-top:4px}
.legend{font-size:.85rem;color:var(--muted);display:flex;gap:14px;margin-bottom:8px}.legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}
table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}
.err{color:#c0392b}
</style></head><body><main>
<h1>Thống kê Sổ Tab Harmonica</h1><p class="muted">Đếm ẩn danh: mỗi máy một mã ngẫu nhiên, không lưu IP hay thông tin cá nhân. Ngày theo giờ Việt Nam.</p>
<form id="f"><input id="pw" type="password" placeholder="Mật khẩu" autocomplete="current-password" required><button>Xem</button></form>
<p id="msg" class="muted"></p><div id="out"></div>
</main><script>
const $=(s)=>document.querySelector(s);const PL={web:'Trình duyệt',pwa:'App cài từ web',apk:'App Android (APK)'};
const fmt=(n)=>Number(n).toLocaleString('vi-VN');
async function load(pw){$('#msg').textContent='Đang tải…';
 const r=await fetch('/v1/stats',{headers:{authorization:'Bearer '+encodeURIComponent(pw)}});
 if(r.status===401){$('#msg').innerHTML='<span class="err">Sai mật khẩu.</span>';sessionStorage.removeItem('pw');return}
 if(!r.ok){$('#msg').innerHTML='<span class="err">'+((await r.json().catch(()=>({}))).error||'Lỗi '+r.status)+'</span>';return}
 sessionStorage.setItem('pw',pw);$('#f').style.display='none';const s=await r.json();$('#msg').textContent='Cập nhật lúc '+new Date().toLocaleTimeString('vi-VN');render(s)}
function render(s){const max=Math.max(1,...s.days.map(d=>Math.max(d.active,d.installs)));
 const cols=s.days.map(d=>'<div class="col" title="'+d.day+': '+d.active+' người dùng, '+d.installs+' lượt cài mới, '+d.opens+' lần mở"><div class="bar i" style="height:'+(d.installs/max*100)+'%"></div><div class="bar" style="height:'+(Math.max(0,d.active-d.installs)/max*100)+'%"></div></div>').join('');
 const tile=(n,l)=>'<div class="tile"><b>'+fmt(n)+'</b><span>'+l+'</span></div>';
 $('#out').innerHTML='<div class="tiles">'+tile(s.installs.total,'Tổng lượt cài')+tile(s.dau,'Người dùng hôm nay')+tile(s.wau,'Người dùng 7 ngày')+tile(s.mau,'Người dùng 30 ngày')+'</div>'
 +'<div class="card"><h2>30 ngày gần đây</h2><div class="legend"><span><i style="background:var(--b)"></i>Người dùng trong ngày</span><span><i style="background:var(--a)"></i>Trong đó cài mới</span></div><div class="chart">'+cols+'</div><div class="ax"><span>'+s.days[0].day+'</span><span>'+s.today+'</span></div></div>'
 +'<div class="card"><h2>Theo nền tảng</h2><table><tr><th>Nền tảng</th><th>Lượt cài</th><th>Dùng trong 30 ngày</th></tr>'
 +Object.keys(PL).map(k=>'<tr><td>'+PL[k]+'</td><td>'+fmt(s.installs.byPlatform[k])+'</td><td>'+fmt(s.mauByPlatform[k])+'</td></tr>').join('')+'</table></div>'
 +'<div class="card"><h2>Từng ngày</h2><table><tr><th>Ngày</th><th>Cài mới</th><th>Người dùng</th><th>Lần mở app</th></tr>'
 +s.days.slice().reverse().map(d=>'<tr><td>'+d.day+'</td><td>'+fmt(d.installs)+'</td><td>'+fmt(d.active)+'</td><td>'+fmt(d.opens)+'</td></tr>').join('')+'</table></div>'}
$('#f').addEventListener('submit',(e)=>{e.preventDefault();load($('#pw').value)});
const saved=sessionStorage.getItem('pw');if(saved)load(saved);
</script></body></html>`;
