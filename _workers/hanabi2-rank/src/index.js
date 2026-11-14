// 一筆花火2 の世界ランキング（Cloudflare Workers + D1）。
//
// 祭りが終わるたびに、ページが 1 周の結果と記録（筆の動きと屋台の操作を gzip して base64）を送る。
// 無料の枠（1 回 10ms ほど）では 1 周を流しなおせないので、ここではありえない値だけを弾いて受け、
// 上位の記録は手元の確かめ役（_dev/hanabi2-verify.mjs）が本物のルールで流しなおし、合わないものを隠す。
//
//   GET  /health                               … { ok, v }（ページは、これが返ったときだけランキングを見せる）
//   GET  /top?board=d:YYYYMMDD|a:段位:流派&player=…  … 上位 50 と、自分の順位
//   POST /submit { v, player, name, daily, day, rank, school, fuse, score, nights, won, log }
//   GET  /admin/pending?limit=…                … まだ確かめていない上位の記録（Authorization: Bearer <ADMIN_TOKEN>）
//   POST /admin/mark { board, player, verified: 1|-1, why? } … 確かめた結果（-1 は隠す）
//   POST /admin/hide { board, player, hidden } … 不適切な名前を隠す / もどす
import { LOG_VERSION, SCHOOLS, RANKS, FUSES } from '../../../hanabi/run.js';
import { cleanName } from '../../../assets/hitofude/names.js';

const TOP = 50, MAX_BODY = 450000, PER_IP = 60, KEEP_LOG = 200; // 記録を残すのは、その板の上位 200 まで
const PLAYER = /^[a-f0-9]{32}$/, DAY = /^\d{8}$/, BOARD = /^(d:\d{8}|a:[0-7]:[a-z]+)$/;
const SCHOOL_IDS = SCHOOLS.map((s) => s.id), FUSE_IDS = FUSES.map((f) => f.id);

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allow.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { 'Access-Control-Allow-Origin': ok ? origin : (allow[0] || '*'), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, env, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req, env) } });
const fail = (req, env, error, status = 400) => json(req, env, { ok: false, error }, status);
async function body(req) { const t = await req.text(); if (t.length > MAX_BODY) return null; try { return JSON.parse(t); } catch { return null; } }
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
function sameToken(a, b) { if (!a || !b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }
const admin = (req, env) => sameToken((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.ADMIN_TOKEN || '');

// 世界時の今日・昨日（今日の祭りは世界時の日付で盤が決まる。日付をまたいで遊び終えた祭りも受ける）
const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const okDay = (day) => DAY.test(day) && (day === ymd(new Date()) || day === ymd(new Date(Date.now() - 86400000)));

async function placeOf(db, board, row) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE board = ?1 AND hidden = 0 AND (score > ?2 OR (score = ?2 AND updated < ?3))').bind(board, row.score, row.updated).first();
  return (r ? r.n : 0) + 1;
}
async function countOf(db, board) { const r = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE board = ?1 AND hidden = 0').bind(board).first(); return r ? r.n : 0; }

// ---------------------------------------------------------------- 受ける
async function submit(req, env) {
  const p = await body(req);
  if (!p || typeof p !== 'object') return fail(req, env, 'payload');
  if (p.v !== LOG_VERSION) return fail(req, env, 'version', 409);
  if (!PLAYER.test(p.player || '')) return fail(req, env, 'player');
  const name = cleanName(p.name); if (!name) return fail(req, env, 'name');
  // ありえない値を弾く（本当の確かめは、上位の記録を手元で流しなおして行う）
  const score = p.score, nights = p.nights;
  if (!Number.isSafeInteger(score) || score < 0 || score > 5e12 || !Number.isInteger(nights) || nights < 0 || nights > 2000) return fail(req, env, 'range');
  if (p.won && nights < 24) return fail(req, env, 'range');
  if (!SCHOOL_IDS.includes(p.school) || !FUSE_IDS.includes(p.fuse) || !(Number.isInteger(p.rank) && p.rank >= 0 && p.rank < RANKS.length)) return fail(req, env, 'header');
  if (typeof p.log !== 'string' || p.log.length < 20 || !/^[A-Za-z0-9+/=]+$/.test(p.log)) return fail(req, env, 'log');
  let board;
  if (p.daily) { if (!okDay(String(p.day)) || p.school !== 'hon' || p.rank !== 0 || p.fuse !== 'asa') return fail(req, env, 'daily'); board = `d:${p.day}`; }
  else board = `a:${p.rank}:${p.school}`;
  const db = env.DB, now = Date.now();
  // 同じ所から 1 日 PER_IP 回まで（IP はそのまま残さず、日ごとの塩をかけた要約だけ）
  const ip = await sha(`${ymd(new Date())}:${req.headers.get('CF-Connecting-IP') || 'local'}`);
  const c = await db.prepare('INSERT INTO ipcount (day, ip, n) VALUES (?1, ?2, 1) ON CONFLICT(day, ip) DO UPDATE SET n = n + 1 RETURNING n').bind(ymd(new Date()), ip).first();
  if (c && c.n > PER_IP) return fail(req, env, 'busy', 429);
  const old = await db.prepare('SELECT score, updated, hidden FROM entries WHERE board = ?1 AND player = ?2').bind(board, p.player).first();
  // 前の記録のほうが上なら、名前だけ新しくして残す
  if (old && old.score >= score) {
    await db.prepare('UPDATE entries SET name = ?3 WHERE board = ?1 AND player = ?2').bind(board, p.player, name).run();
    return json(req, env, { ok: true, kept: true, place: old.hidden ? null : await placeOf(db, board, old), count: await countOf(db, board) });
  }
  const above = await db.prepare('SELECT COUNT(*) AS n FROM entries WHERE board = ?1 AND hidden = 0 AND score > ?2').bind(board, score).first();
  const log = (above ? above.n : 0) < KEEP_LOG ? p.log : null;
  await db.prepare(`INSERT INTO entries (board, player, name, score, nights, won, school, rank, fuse, log, verified, hidden, created, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, 0, ?11, ?11)
    ON CONFLICT(board, player) DO UPDATE SET name = ?3, score = ?4, nights = ?5, won = ?6, school = ?7, rank = ?8, fuse = ?9, log = ?10, verified = 0, hidden = 0, updated = ?11`)
    .bind(board, p.player, name, score, nights, p.won ? 1 : 0, p.school, p.rank, p.fuse, log, now).run();
  return json(req, env, { ok: true, board, place: await placeOf(db, board, { score, updated: now }), count: await countOf(db, board) });
}

async function top(req, env, url) {
  const board = url.searchParams.get('board') || '', player = url.searchParams.get('player') || '';
  if (!BOARD.test(board)) return fail(req, env, 'board');
  const db = env.DB;
  const rows = (await db.prepare('SELECT player, name, score, nights, won, verified FROM entries WHERE board = ?1 AND hidden = 0 ORDER BY score DESC, updated ASC LIMIT ?2').bind(board, TOP).all()).results || [];
  const list = rows.map((r) => ({ name: r.name, score: r.score, nights: r.nights, won: !!r.won, verified: r.verified === 1, ...(player && r.player === player ? { me: true } : {}) }));
  let me = null;
  if (PLAYER.test(player)) {
    const row = await db.prepare('SELECT name, score, nights, updated, hidden FROM entries WHERE board = ?1 AND player = ?2').bind(board, player).first();
    if (row && !row.hidden) me = { place: await placeOf(db, board, row), name: row.name, score: row.score, nights: row.nights };
  }
  return json(req, env, { ok: true, board, count: await countOf(db, board), top: list, me });
}

// ---------------------------------------------------------------- 管理
async function pending(req, env, url) {
  if (!admin(req, env)) return fail(req, env, 'auth', 401);
  const limit = Math.max(1, Math.min(50, +url.searchParams.get('limit') || 20));
  // 上位から順に。板ごとの上位 50 に入るものだけ（下のほうは確かめなくても目立たない）
  const rows = (await env.DB.prepare(`SELECT e.board, e.player, e.name, e.score, e.nights, e.won, e.school, e.rank, e.fuse, e.log FROM entries e
    WHERE e.verified = 0 AND e.hidden = 0 AND e.log IS NOT NULL
      AND (SELECT COUNT(*) FROM entries x WHERE x.board = e.board AND x.hidden = 0 AND x.score > e.score) < 50
    ORDER BY e.score DESC LIMIT ?1`).bind(limit).all()).results || [];
  return json(req, env, { ok: true, rows });
}
async function mark(req, env) {
  if (!admin(req, env)) return fail(req, env, 'auth', 401);
  const p = await body(req);
  if (!p || !BOARD.test(p.board || '') || !PLAYER.test(p.player || '') || ![1, -1].includes(p.verified)) return fail(req, env, 'payload');
  await env.DB.prepare('UPDATE entries SET verified = ?3, hidden = CASE WHEN ?3 = -1 THEN 1 ELSE hidden END, why = ?4 WHERE board = ?1 AND player = ?2').bind(p.board, p.player, p.verified, String(p.why || '').slice(0, 200)).run();
  return json(req, env, { ok: true });
}
async function hide(req, env) {
  if (!admin(req, env)) return fail(req, env, 'auth', 401);
  const p = await body(req);
  if (!p || !BOARD.test(p.board || '') || !PLAYER.test(p.player || '')) return fail(req, env, 'payload');
  await env.DB.prepare('UPDATE entries SET hidden = ?3 WHERE board = ?1 AND player = ?2').bind(p.board, p.player, p.hidden === 0 ? 0 : 1).run();
  return json(req, env, { ok: true });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    try {
      if (req.method === 'GET' && url.pathname === '/health') return json(req, env, { ok: true, v: LOG_VERSION });
      if (req.method === 'GET' && url.pathname === '/top') return top(req, env, url);
      if (req.method === 'POST' && url.pathname === '/submit') return submit(req, env);
      if (req.method === 'GET' && url.pathname === '/admin/pending') return pending(req, env, url);
      if (req.method === 'POST' && url.pathname === '/admin/mark') return mark(req, env);
      if (req.method === 'POST' && url.pathname === '/admin/hide') return hide(req, env);
      return fail(req, env, 'not found', 404);
    } catch (e) {
      return fail(req, env, 'server', 500);
    }
  },
};
