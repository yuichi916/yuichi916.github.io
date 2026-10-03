// 一筆花火「今夜の一筆」のランキング（Cloudflare Workers + D1）。
//
// 夜を越えるたびに、ページがその夜だけを送る（POST /night）。サーバーは 1 夜ずつ、本物のルールで線を燃やしなおして確かめ、
// 点と進み（越えた夜・お守り・星・墨・予備の提灯）を D1 に残す。点はサーバーが燃やしなおした点だけを使う。
// 無料の枠（1 回 10ms ほど）に収まるよう、重い願い札は日ごとに前もって作った表（src/wishes.js）を使う。
//
//   GET  /health                         … { ok, v }（ページは、これが返ってきたときだけランキングを見せる）
//   GET  /top?day=YYYY-MM-DD&player=…     … その日の上位 50 と、自分の順位
//   POST /night  { v, day, player, name, n, events, retries, ad, strokes, wishStars? }
//   POST /name   { day, player, name }    … その日の名前を変える
//   GET  /admin/list?day=…                … 名前の見張り（Authorization: Bearer <ADMIN_TOKEN>）
//   POST /admin/hide { day, player, hidden } … 不適切な名前・記録を隠す / もどす
//
// 合言葉（ADMIN_TOKEN）はコードに書かない。`npx wrangler secret put ADMIN_TOKEN` で入れる。
import * as K from '../../../assets/hitofude/core.js';
import { initState, applyNight } from '../../../assets/hitofude/rankcheck.js';
import { cleanName } from '../../../assets/hitofude/names.js';
import WISHES, { WISH_VERSION } from './wishes.js';

const TOP = 50, MAX_BODY = 200000, NEW_PER_IP = 30; // 同じ IP の人（学校・携帯の回線は多くの人で 1 つ）が並んでも困らない数
const PLAYER = /^[a-f0-9]{32}$/, DAYKEY = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- 返事
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allow.includes(origin) || /^https:\/\/([a-z0-9-]+\.)*crazygames\.[a-z.]+$/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { 'Access-Control-Allow-Origin': ok ? origin : (allow[0] || '*'), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, env, body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req, env), ...extra } });
const fail = (req, env, error, status = 400) => json(req, env, { ok: false, error }, status);

// 日本時間の今日と昨日（日付をまたいで遊び終えた祭りも受ける）
function jst(offsetDays = 0) { return K.jstDateKey(new Date(Date.now() + offsetDays * 86400000)); }
const okDay = (day) => DAYKEY.test(day) && (day === jst(0) || day === jst(-1));

// その日の盤（種と月）と願い札（前もって作った表。表に無い日は、ページが送った星の数を 2 までで受ける）
function dayCtx(day, wishStars) {
  const seed = K.hashStr('hitofude-daily:' + day), moon = K.moonIndex(K.moonPhase(day));
  const tab = WISH_VERSION === K.REPLAY_VERSION ? WISHES[day] : null;
  const wishOf = (n) => {
    if (tab) { const w = tab[n]; return w ? { id: w[0], ...(w[1] != null ? { n: w[1] } : {}), stars: w[2] } : null; }
    return null;
  };
  return { seed, moon, wishOf, hasTable: !!tab, wishStars: Number.isInteger(wishStars) ? Math.max(0, Math.min(2, wishStars)) : 0 };
}

async function body(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
function sameToken(a, b) { if (!a || !b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

// ---------------------------------------------------------------- 順位
async function rankOf(db, day, row) {
  if (!row || row.hidden) return null;
  const r = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE day = ?1 AND hidden = 0 AND (total > ?2 OR (total = ?2 AND updated < ?3))').bind(day, row.total, row.updated).first();
  return (r ? r.n : 0) + 1;
}
async function countOf(db, day) { const r = await db.prepare('SELECT COUNT(*) AS n FROM runs WHERE day = ?1 AND hidden = 0').bind(day).first(); return r ? r.n : 0; }

// ---------------------------------------------------------------- 夜を受ける
async function postNight(req, env) {
  const p = await body(req);
  if (!p || typeof p !== 'object') return fail(req, env, 'payload');
  if (p.v !== K.REPLAY_VERSION) return fail(req, env, 'version', 409); // ゲームとサーバーのルールの版が違う
  if (!okDay(p.day)) return fail(req, env, 'day');
  if (!PLAYER.test(p.player || '')) return fail(req, env, 'player');
  const name = cleanName(p.name);
  if (!name) return fail(req, env, 'name');
  const db = env.DB, now = Date.now();
  let row = await db.prepare('SELECT * FROM runs WHERE day = ?1 AND player = ?2').bind(p.day, p.player).first();
  let state;
  if (!row) {
    if (p.n !== 0) return fail(req, env, 'order', 409);
    // 同じ所からの新しい参加は、1 日 NEW_PER_IP 人まで（IP はそのまま残さず、日ごとの塩をかけた要約だけ）
    const ip = await sha(`${p.day}:${req.headers.get('CF-Connecting-IP') || 'local'}`);
    const c = await db.prepare('INSERT INTO ipcount (day, ip, n) VALUES (?1, ?2, 1) ON CONFLICT(day, ip) DO UPDATE SET n = n + 1 RETURNING n').bind(p.day, ip).first();
    if (c && c.n > NEW_PER_IP) return fail(req, env, 'busy', 429);
    state = initState(K);
  } else {
    try { state = JSON.parse(row.state); } catch (e) { return fail(req, env, 'state', 500); }
  }
  const ctx = dayCtx(p.day, p.wishStars);
  // 表に無い日: 願い札は、ページが送った星の数（0〜2）を、目標を越えた夜だけ足す
  if (!ctx.hasTable) ctx.wishOf = () => null;
  // 読みなおして同じ夜をもう一度送ってきた（もう確かめ終えた）: 次に送るべき夜を返す（ページは、そのまま続ける）
  if (Number.isInteger(p.n) && p.n < state.n) return json(req, env, { ok: false, error: 'order', next: state.n }, 409);
  const r = applyNight(K, state, p, ctx);
  if (!r.ok) return fail(req, env, r.error, 422);
  if (!ctx.hasTable && r.night.pass && ctx.wishStars) r.state.wallet += ctx.wishStars;
  const s = r.state;
  await db.prepare(`INSERT INTO runs (day, player, name, night, total, cleared, over, state, created, updated, hidden) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, 0)
    ON CONFLICT(day, player) DO UPDATE SET name = ?3, night = ?4, total = ?5, cleared = ?6, over = ?7, state = ?8, updated = ?9`)
    .bind(p.day, p.player, name, s.n, s.total, s.cleared, s.over ? 1 : 0, JSON.stringify(s), now).run();
  row = { total: s.total, updated: now, hidden: row ? row.hidden : 0 };
  return json(req, env, { ok: true, night: r.night, total: s.total, cleared: s.cleared, over: s.over, rank: await rankOf(db, p.day, row), count: await countOf(db, p.day) });
}

async function postName(req, env) {
  const p = await body(req);
  if (!p || !okDay(p.day) || !PLAYER.test(p.player || '')) return fail(req, env, 'payload');
  const name = cleanName(p.name);
  if (!name) return fail(req, env, 'name');
  await env.DB.prepare('UPDATE runs SET name = ?3 WHERE day = ?1 AND player = ?2').bind(p.day, p.player, name).run();
  return json(req, env, { ok: true, name });
}

async function getTop(req, env, url) {
  const day = url.searchParams.get('day') || jst(0), player = url.searchParams.get('player') || '';
  if (!DAYKEY.test(day)) return fail(req, env, 'day');
  const db = env.DB;
  const rows = (await db.prepare('SELECT player, name, total, cleared, night, over FROM runs WHERE day = ?1 AND hidden = 0 ORDER BY total DESC, updated ASC LIMIT ?2').bind(day, TOP).all()).results || [];
  const entries = rows.map((r, i) => ({ rank: i + 1, name: r.name, total: r.total, cleared: r.cleared, night: r.night, over: !!r.over, ...(player && r.player === player ? { me: true } : {}) }));
  let me = null;
  if (PLAYER.test(player)) {
    const row = await db.prepare('SELECT total, cleared, night, over, updated, hidden, name FROM runs WHERE day = ?1 AND player = ?2').bind(day, player).first();
    if (row) me = { rank: await rankOf(db, day, row), total: row.total, cleared: row.cleared, night: row.night, over: !!row.over, name: row.name, hidden: !!row.hidden };
  }
  return json(req, env, { ok: true, day, count: await countOf(db, day), entries, me }, 200);
}

// ---------------------------------------------------------------- 管理（合言葉が要る）
function admin(req, env) { const h = req.headers.get('Authorization') || ''; return sameToken(h.replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN || ''); }
async function adminList(req, env, url) {
  if (!admin(req, env)) return fail(req, env, 'auth', 401);
  const day = url.searchParams.get('day') || jst(0);
  const rows = (await env.DB.prepare('SELECT player, name, total, cleared, night, over, hidden, updated FROM runs WHERE day = ?1 ORDER BY total DESC LIMIT 500').bind(day).all()).results || [];
  return json(req, env, { ok: true, day, rows });
}
async function adminHide(req, env) {
  if (!admin(req, env)) return fail(req, env, 'auth', 401);
  const p = await body(req);
  if (!p || !DAYKEY.test(p.day || '') || !PLAYER.test(p.player || '')) return fail(req, env, 'payload');
  await env.DB.prepare('UPDATE runs SET hidden = ?3 WHERE day = ?1 AND player = ?2').bind(p.day, p.player, p.hidden === 0 ? 0 : 1).run();
  return json(req, env, { ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    try {
      if (req.method === 'GET' && url.pathname === '/health') return json(req, env, { ok: true, v: K.REPLAY_VERSION, wishes: WISH_VERSION === K.REPLAY_VERSION });
      if (req.method === 'GET' && url.pathname === '/top') return getTop(req, env, url);
      if (req.method === 'POST' && url.pathname === '/night') return postNight(req, env);
      if (req.method === 'POST' && url.pathname === '/name') return postName(req, env);
      if (req.method === 'GET' && url.pathname === '/admin/list') return adminList(req, env, url);
      if (req.method === 'POST' && url.pathname === '/admin/hide') return adminHide(req, env);
      return fail(req, env, 'not found', 404);
    } catch (e) {
      return fail(req, env, 'server', 500);
    }
  },
};
