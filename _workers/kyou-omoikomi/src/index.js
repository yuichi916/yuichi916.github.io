// きょうの県「思い込みチェック」の答えを集める（Cloudflare Workers + D1）。
//
// ページは答えを 1 つずつ送る（POST /a）。サーバーは本当の順位を自分の表（data.json）から入れる。
// ページが送った「本当の順位」は使わない。集計は D1 の引き金で足しこまれた表を読むだけ（schema.sql）。
//
//   GET  /health            … { ok, v }（ページは、これが返ってきたときだけ「みんなの予想」を見せる）
//   POST /a  { v, sid, home, items: [...] }
//        items の 1 つ: { k:'r', p, i, g, src, d? }  … 県 p の統計 i を g 位と予想した
//                       { k:'g', d, g, n }          … 問題 d で、県 g と答えて外した（ヒント n 個のとき）
//   GET  /cell?p=&i=        … その県×統計の「みんなの予想」（順位ごとの数）と本当の順位
//   GET  /stats             … みんなの思い込み地図の集計（県×統計・県民と県外・まちがえた県・日ごとの数）
//   GET  /rows?kind=r&after=ID … 公開用の答えの行（5,000 行ずつ）。ページが CSV にまとめる
//
// 送られた内容は、名前・場所・端末の情報を含まない。IP はそのまま残さず、日ごとの塩をかけた要約だけ
// （大量に送られたときに見分けるため。公開しない）。塩 SALT は `npx wrangler secret put SALT` で入れる。
import Core from '../../../assets/kyou-no-ken-core.js';
import DATA from '../../../data/kyou-no-ken/data.json';

const V = 1;
const MAX_BODY = 20000, MAX_ITEMS = 30, PAGE = 5000;
const PER_IP_HOUR = 3000; // 学校の 1 クラス（同じ回線）が一斉に答えても困らない数
const SID = /^[a-f0-9]{16,32}$/;
const IND = new Map(DATA.indicators.map((d) => [d.id, d]));

// ---------------------------------------------------------------- 返事
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allow = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = allow.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return { 'Access-Control-Allow-Origin': ok ? origin : (allow[0] || '*'), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (req, env, body, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, ...cors(req, env) } });
const fail = (req, env, error, status = 400) => json(req, env, { ok: false, error }, status);

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
function jstDay(ms) { return new Date(ms + 9 * 3600000).toISOString().slice(0, 10); }
async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24); }

// ---------------------------------------------------------------- 答えを受ける
async function postAnswers(req, env) {
  const text = await req.text();
  if (text.length > MAX_BODY) return fail(req, env, 'size', 413);
  let p; try { p = JSON.parse(text); } catch (e) { return fail(req, env, 'json'); }
  if (!p || typeof p !== 'object' || p.v !== V) return fail(req, env, 'version', 409);
  if (!SID.test(p.sid || '')) return fail(req, env, 'sid');
  const home = isInt(p.home, -1, 46) ? p.home : -1;
  if (!Array.isArray(p.items) || !p.items.length || p.items.length > MAX_ITEMS) return fail(req, env, 'items');

  const now = Date.now(), ts = Math.floor(now / 1000), jday = jstDay(now);
  const today = Core.dayIndexAt(now);
  const ip = req.headers.get('CF-Connecting-IP') || '';
  const iph = await sha((env.SALT || 'kyou-omoikomi') + '|' + jday + '|' + ip);

  const rows = [];
  for (const it of p.items) {
    if (!it || typeof it !== 'object') return fail(req, env, 'item');
    if (it.k === 'r') {
      const ind = IND.get(it.i);
      if (!ind || !isInt(it.p, 0, 46) || !isInt(it.g, 1, 47)) return fail(req, env, 'item-r');
      const src = it.src === 'daily' ? 'daily' : 'check';
      const day = isInt(it.d, 0, today) ? it.d : -1;
      rows.push(['r', it.p, it.i, it.g, ind.ranks[it.p], day, 0, src]);
    } else if (it.k === 'g') {
      if (!isInt(it.d, 0, today) || !isInt(it.g, 0, 46) || !isInt(it.n, 1, 6)) return fail(req, env, 'item-g');
      const answer = Core.prefForDay(it.d);
      if (it.g === answer) continue; // 正解は「まちがえた県」ではない
      rows.push(['g', answer, '', it.g, 0, it.d, it.n, '']);
    } else return fail(req, env, 'kind');
  }
  if (!rows.length) return json(req, env, { ok: true, saved: 0 });

  const db = env.DB;
  const recent = await db.prepare('SELECT COUNT(*) AS n FROM answers WHERE iph = ?1 AND ts > ?2').bind(iph, ts - 3600).first();
  if (recent && recent.n + rows.length > PER_IP_HOUR) return fail(req, env, 'busy', 429);

  const stmt = db.prepare('INSERT OR IGNORE INTO answers (ts, jday, sid, kind, pref, ind, guess, truth, home, day, hints, src, iph) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)');
  const res = await db.batch(rows.map((r) => stmt.bind(ts, jday, p.sid, r[0], r[1], r[2], r[3], r[4], home, r[5], r[6], r[7], iph)));
  const saved = res.reduce((s, x) => s + ((x.meta && x.meta.changes) ? 1 : 0), 0);
  return json(req, env, { ok: true, saved });
}

// ---------------------------------------------------------------- 読む（短い間、Cloudflare の手前に置いておく）
// 鍵は必要な項目だけで作る（?_=… などを足してキャッシュを素通りされ、D1 の読み出しが増えるのを防ぐ）
async function cached(req, env, ctx, seconds, keyPath, make) {
  if (String(env.NO_CACHE) === '1') { // 手元の検査用（wrangler dev --var NO_CACHE:1）
    return new Response(JSON.stringify(await make()), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  const cache = caches.default;
  const key = new Request(new URL(keyPath, req.url).toString(), { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) return hit;
  const body = await make();
  const res = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=' + seconds } });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
function withCors(res, req, env) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors(req, env))) r.headers.set(k, v);
  return r;
}

async function getCell(req, env, ctx) {
  const u = new URL(req.url);
  const p = parseInt(u.searchParams.get('p'), 10), i = u.searchParams.get('i') || '';
  const ind = IND.get(i);
  if (!ind || !isInt(p, 0, 46)) return fail(req, env, 'cell');
  const res = await cached(req, env, ctx, 30, '/cell?p=' + p + '&i=' + i, async () => {
    const r = await env.DB.prepare('SELECT guess, n FROM hist WHERE pref = ?1 AND ind = ?2').bind(p, i).all();
    const hist = new Array(47).fill(0);
    let n = 0;
    for (const row of r.results || []) { if (row.guess >= 1 && row.guess <= 47) { hist[row.guess - 1] = row.n; n += row.n; } }
    return { ok: true, p, i, truth: ind.ranks[p], n, hist };
  });
  return withCors(res, req, env);
}

async function getStats(req, env, ctx) {
  const res = await cached(req, env, ctx, 120, '/stats', async () => {
    const db = env.DB;
    const [cells, home, conf, days, act, ppl] = await db.batch([
      db.prepare('SELECT pref, ind, n, se, ae FROM cells'),
      db.prepare('SELECT pref, ins, n, se, ae FROM home'),
      db.prepare('SELECT pref, guess, n FROM conf'),
      db.prepare('SELECT jday, kind, n FROM days ORDER BY jday'),
      db.prepare('SELECT jday, n FROM dayact ORDER BY jday'),
      db.prepare('SELECT COUNT(*) AS n, MIN(first) AS since FROM people'),
    ]);
    const pick = (r, cols) => (r.results || []).map((x) => cols.map((c) => x[c]));
    const p0 = (ppl.results && ppl.results[0]) || { n: 0, since: null };
    return {
      ok: true, v: V, updated: new Date().toISOString(),
      people: p0.n, since: p0.since,
      cells: pick(cells, ['pref', 'ind', 'n', 'se', 'ae']),
      home: pick(home, ['pref', 'ins', 'n', 'se', 'ae']),
      conf: pick(conf, ['pref', 'guess', 'n']),
      days: pick(days, ['jday', 'kind', 'n']),
      active: pick(act, ['jday', 'n']),
    };
  });
  return withCors(res, req, env);
}

// 公開用の行。sid は端末に残っている番号と結びつかないよう、もう一度要約してから出す。iph は出さない
async function getRows(req, env, ctx) {
  const u = new URL(req.url);
  const kind = u.searchParams.get('kind') === 'g' ? 'g' : 'r';
  const after = Math.max(0, parseInt(u.searchParams.get('after') || '0', 10) || 0);
  const res = await cached(req, env, ctx, 600, '/rows?kind=' + kind + '&after=' + after, async () => {
    const r = await env.DB.prepare('SELECT id, jday, sid, pref, ind, guess, truth, home, day, hints, src FROM answers WHERE kind = ?1 AND id > ?2 ORDER BY id LIMIT ?3').bind(kind, after, PAGE).all();
    const list = r.results || [];
    const short = new Map();
    const rows = [];
    for (const x of list) {
      if (!short.has(x.sid)) short.set(x.sid, await sha('person|' + x.sid));
      rows.push(kind === 'r'
        ? [x.id, x.jday, short.get(x.sid).slice(0, 12), x.pref, x.ind, x.guess, x.truth, x.home, x.src, x.day]
        : [x.id, x.jday, short.get(x.sid).slice(0, 12), x.day, x.pref, x.guess, x.hints]);
    }
    return { ok: true, kind, rows, next: list.length === PAGE ? list[list.length - 1].id : null };
  });
  return withCors(res, req, env);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    try {
      if (url.pathname === '/health') return json(req, env, { ok: true, v: V });
      if (url.pathname === '/a' && req.method === 'POST') return await postAnswers(req, env);
      if (url.pathname === '/cell' && req.method === 'GET') return await getCell(req, env, ctx);
      if (url.pathname === '/stats' && req.method === 'GET') return await getStats(req, env, ctx);
      if (url.pathname === '/rows' && req.method === 'GET') return await getRows(req, env, ctx);
      return fail(req, env, 'not-found', 404);
    } catch (e) {
      return fail(req, env, 'server', 500);
    }
  },
};
