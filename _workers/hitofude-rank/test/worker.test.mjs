// ランキングの Worker を、手元で動かして（npx wrangler dev --local）HTTP で確かめる。
// 使い方: 別の窓で `npx wrangler d1 execute hitofude-rank --local --file=schema.sql` と `npx wrangler dev --local --port 8787`、
// それから `RANK_URL=http://127.0.0.1:8787 ADMIN_TOKEN=<.dev.vars と同じ合言葉> node test/worker.test.mjs`
import * as K from '../../../assets/hitofude/core.js';
import { playRun } from '../../../tests/lib/hitofude_rankbot.mjs';

const BASE = process.env.RANK_URL || 'http://127.0.0.1:8787', TOKEN = process.env.ADMIN_TOKEN || '';
const ORIGIN = 'https://yuichi916.github.io';
let fails = 0;
const ok = (c, m) => { if (!c) throw new Error(m || 'assert'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };
async function check(name, fn) { try { await fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '—', e.message); } }
const get = async (path, headers = {}) => { const r = await fetch(BASE + path, { headers: { Origin: ORIGIN, ...headers } }); return { status: r.status, h: r.headers, j: await r.json() }; };
const post = async (path, body, headers = {}) => { const r = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers }, body: JSON.stringify(body) }); return { status: r.status, h: r.headers, j: await r.json() }; };
const hex = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

const day = K.jstDateKey(new Date());
const A = { player: hex(), name: 'ヒノコ' }, B = { player: hex(), name: 'tama' };
const runA = playRun(day), runB = playRun(day, { reroll: false, buyInk: false, weakNight: 0 });
const send = (who, p, extra = {}) => post('/night', { v: K.REPLAY_VERSION, day, player: who.player, name: who.name, ...p, ...extra });
const count0 = (await get(`/top?day=${day}`)).j.count || 0; // 手元の DB に、ほかの試しの記録が残っていてもよい

await check('/health は版と願い札の表を返す', async () => {
  const r = await get('/health'); eq(r.status, 200); eq(r.j.v, K.REPLAY_VERSION); ok(r.j.wishes, 'wishes table for this version');
  eq(r.h.get('access-control-allow-origin'), ORIGIN, 'CORS');
});
await check('夜ごとに送ると、サーバーが燃やしなおした点が、遊んだ点と同じ', async () => {
  let last;
  for (const p of runA.payloads) { last = await send(A, p); eq(last.status, 200, `night ${p.n} ${JSON.stringify(last.j)}`); }
  eq(last.j.total, Math.round(runA.total), 'total'); ok(last.j.rank >= 1 && last.j.rank <= count0 + 1, `rank ${last.j.rank}`); ok(last.j.over, 'over');
  const again = await send(A, runA.payloads[0]); eq(again.status, 409); eq(again.j.next, runA.payloads.length, 'resent night tells the next night');
});
await check('二人目（やりなおしあり）も受け、順位は点の高い順', async () => {
  let last; for (const p of runB.payloads) { last = await send(B, p); eq(last.status, 200, `night ${p.n} ${JSON.stringify(last.j)}`); }
  eq(last.j.total, Math.round(runB.total));
  const top = await get(`/top?day=${day}&player=${B.player}`);
  eq(top.status, 200); eq(top.j.count, count0 + 2);
  ok(top.j.entries[0].total >= top.j.entries[1].total, 'sorted');
  ok(top.j.entries.every((e) => !('player' in e)), 'no player ids in public list');
  eq(top.j.me.total, Math.round(runB.total)); ok(top.j.entries.some((e) => e.me), 'me flagged');
});
await check('ずるい送り方は受けない（順番・版・名前・候補に無いお守り）', async () => {
  const C = { player: hex(), name: 'zzz' };
  eq((await send(C, runA.payloads[1])).status, 409, 'order: first night must be 0');
  eq((await send(C, runA.payloads[0], { v: K.REPLAY_VERSION + 1 })).j.error, 'version');
  eq((await send({ ...C, name: 'しね' }, runA.payloads[0])).j.error, 'name');
  eq((await send(C, runA.payloads[0], { day: '2020-01-01' })).j.error, 'day');
  eq((await send(C, runA.payloads[0])).status, 200);
  const p1 = JSON.parse(JSON.stringify(runA.payloads[1])); const pk = p1.events.find((e) => e.t === 'pick');
  const seed = K.hashStr('hitofude-daily:' + day), offered = [0, 4].flatMap((a) => K.offerCharms(seed, 0, [], a, { level: 0 }));
  pk.id = K.CHARMS.map((c) => c.id).find((id) => !offered.includes(id));
  const r = await send(C, p1); ok(r.status === 422, `status ${r.status} ${JSON.stringify(r.j)}`);
});
await check('名前を変えられる。管理の合言葉が無いと見られない。隠すとランキングから消える', async () => {
  eq((await post('/name', { day, player: A.player, name: 'ヒノコ改' })).j.name, 'ヒノコ改');
  eq((await get(`/admin/list?day=${day}`)).status, 401);
  eq((await get(`/admin/list?day=${day}`, { Authorization: 'Bearer wrong' })).status, 401);
  if (!TOKEN) { console.log('      (ADMIN_TOKEN が無いので、隠すのは試さない)'); return; }
  const list = await get(`/admin/list?day=${day}`, { Authorization: `Bearer ${TOKEN}` });
  eq(list.status, 200); ok(list.j.rows.some((r) => r.name === 'ヒノコ改'), 'renamed');
  eq((await post('/admin/hide', { day, player: A.player, hidden: 1 }, { Authorization: `Bearer ${TOKEN}` })).status, 200);
  const top = await get(`/top?day=${day}`); ok(!top.j.entries.some((e) => e.name === 'ヒノコ改'), 'hidden');
  await post('/admin/hide', { day, player: A.player, hidden: 0 }, { Authorization: `Bearer ${TOKEN}` });
});

console.log(fails ? `worker.test: ${fails} FAILED` : 'worker.test: ALL PASS');
if (fails) process.exit(1);
