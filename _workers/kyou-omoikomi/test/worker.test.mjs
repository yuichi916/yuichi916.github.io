// 手元の wrangler dev（--local）に対して、答えの受け取りと集計を確かめる。
//   npx wrangler d1 execute kyou-omoikomi --local --file=schema.sql
//   npx wrangler dev --local --port 8788
//   OMOI_URL=http://127.0.0.1:8788 node test/worker.test.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Core = require('../../../assets/kyou-no-ken-core.js');
const DATA = JSON.parse(readFileSync(new URL('../../../data/kyou-no-ken/data.json', import.meta.url), 'utf8'));
const BASE = process.env.OMOI_URL || 'http://127.0.0.1:8788';
const ORIGIN = 'http://127.0.0.1:8765';

let fails = 0, passes = 0;
function check(name, cond, extra) {
  if (cond) { passes++; } else { fails++; console.log('NG', name, extra !== undefined ? JSON.stringify(extra) : ''); }
}
const rnd = () => Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
const sidOf = () => rnd().slice(0, 16).padEnd(16, '0');
const bust = () => '_=' + rnd();
async function post(body) {
  const r = await fetch(BASE + '/a', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: ORIGIN }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json(), headers: r.headers };
}
async function get(path) {
  const r = await fetch(BASE + path + (path.includes('?') ? '&' : '?') + bust(), { headers: { Origin: ORIGIN } });
  return { status: r.status, body: await r.json(), headers: r.headers };
}

const IND = DATA.indicators[3]; // 空き家の割合
const P = 19; // 長野
const truth = IND.ranks[P];
const today = Core.dayIndexAt(Date.now());

// health と CORS
{
  const r = await get('/health');
  check('health', r.status === 200 && r.body.ok === true && r.body.v === 1, r.body);
  check('cors localhost', r.headers.get('access-control-allow-origin') === ORIGIN, r.headers.get('access-control-allow-origin'));
}

const before = (await get('/cell?p=' + P + '&i=' + IND.id)).body;
const statsBefore = (await get('/stats')).body;
const cellBefore = (statsBefore.cells.find((c) => c[0] === P && c[1] === IND.id) || [P, IND.id, 0, 0, 0]);
const homeBefore = (ins) => (statsBefore.home.find((h) => h[0] === P && h[1] === ins) || [P, ins, 0, 0, 0]);

// 2 人が同じ県×統計を予想する。1 人は長野に住む、1 人は住む県を答えない
const A = sidOf(), B = sidOf();
{
  const r1 = await post({ v: 1, sid: A, home: P, items: [{ k: 'r', p: P, i: IND.id, g: 5, src: 'check', truthClaim: 1 }] });
  check('post A', r1.status === 200 && r1.body.saved === 1, r1.body);
  const r2 = await post({ v: 1, sid: B, home: -1, items: [{ k: 'r', p: P, i: IND.id, g: 40, src: 'daily', d: today }] });
  check('post B', r2.status === 200 && r2.body.saved === 1, r2.body);
  const r3 = await post({ v: 1, sid: A, home: P, items: [{ k: 'r', p: P, i: IND.id, g: 30, src: 'check' }] });
  check('same person same question is saved once', r3.status === 200 && r3.body.saved === 0, r3.body);
}

{
  const c = (await get('/cell?p=' + P + '&i=' + IND.id)).body;
  check('cell n +2', c.n === before.n + 2, [before.n, c.n]);
  check('cell truth from server table', c.truth === truth, c.truth);
  check('cell hist 5', c.hist[4] === before.hist[4] + 1);
  check('cell hist 40', c.hist[39] === before.hist[39] + 1);
  check('cell hist 30 untouched', c.hist[29] === before.hist[29]);
}

{
  const s = (await get('/stats')).body;
  const cell = s.cells.find((c) => c[0] === P && c[1] === IND.id);
  check('stats cell n', cell && cell[2] === cellBefore[2] + 2, cell);
  check('stats cell signed error', cell && cell[3] === cellBefore[3] + (5 - truth) + (40 - truth), [cell, truth]);
  check('stats cell abs error', cell && cell[4] === cellBefore[4] + Math.abs(5 - truth) + Math.abs(40 - truth), [cell, truth]);
  const ins = s.home.find((h) => h[0] === P && h[1] === 1);
  check('insider counted', ins && ins[2] === homeBefore(1)[2] + 1, ins);
  const outs = s.home.find((h) => h[0] === P && h[1] === 0);
  check('no-home answer not in home table', (outs ? outs[2] : 0) === homeBefore(0)[2], outs);
  check('people grows', s.people >= statsBefore.people + 2, [statsBefore.people, s.people]);
  const jd = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const act = s.active.find((a) => a[0] === jd);
  const actBefore = statsBefore.active.find((a) => a[0] === jd);
  check('active today counts devices once', act && act[1] === (actBefore ? actBefore[1] : 0) + 2, [actBefore, act]);
}

// 毎日の問題で外した答え
{
  const ans = Core.prefForDay(today);
  const wrong = (ans + 1) % 47;
  const s0 = (await get('/stats')).body;
  const c0 = s0.conf.find((c) => c[0] === ans && c[1] === wrong);
  const r = await post({ v: 1, sid: A, home: P, items: [{ k: 'g', d: today, g: wrong, n: 2 }, { k: 'g', d: today, g: ans, n: 3 }] });
  check('guess saved (correct one skipped)', r.status === 200 && r.body.saved === 1, r.body);
  const s1 = (await get('/stats')).body;
  const c1 = s1.conf.find((c) => c[0] === ans && c[1] === wrong);
  check('conf +1', c1 && c1[2] === (c0 ? c0[2] : 0) + 1, [c0, c1]);
  const rf = await post({ v: 1, sid: A, items: [{ k: 'g', d: today + 2, g: wrong, n: 2 }] });
  check('future day rejected', rf.status === 400, rf.body);
}

// こわれた送り方は受けない
for (const [name, body] of [
  ['bad version', { v: 2, sid: A, items: [{ k: 'r', p: P, i: IND.id, g: 3 }] }],
  ['bad sid', { v: 1, sid: 'xyz', items: [{ k: 'r', p: P, i: IND.id, g: 3 }] }],
  ['bad rank', { v: 1, sid: A, items: [{ k: 'r', p: P, i: IND.id, g: 48 }] }],
  ['bad pref', { v: 1, sid: A, items: [{ k: 'r', p: 47, i: IND.id, g: 3 }] }],
  ['unknown indicator', { v: 1, sid: A, items: [{ k: 'r', p: P, i: 'ZZZ', g: 3 }] }],
  ['no items', { v: 1, sid: A, items: [] }],
  ['too many items', { v: 1, sid: A, items: new Array(31).fill({ k: 'r', p: P, i: IND.id, g: 3 }) }],
]) {
  const r = await post(body);
  check(name + ' → rejected', r.status >= 400 && r.body.ok === false, [r.status, r.body]);
}
{
  const r = await fetch(BASE + '/a', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{not json' });
  check('broken json → 400', r.status === 400);
}

// 公開用の行: IP の要約は出さない。端末の番号はそのまま出さない
{
  let after = 0, all = [];
  for (;;) {
    const r = (await get('/rows?kind=r&after=' + after)).body;
    all = all.concat(r.rows);
    if (r.next == null) break;
    after = r.next;
  }
  const mine = all.filter((x) => x[3] === P && x[4] === IND.id);
  check('rows contain our answers', mine.length >= 2, mine.length);
  check('rows do not contain raw sid', !JSON.stringify(all).includes(A) && !JSON.stringify(all).includes(B));
  check('rows have 10 columns', all.every((x) => x.length === 10), all[0]);
  check('rows truth matches table', mine.every((x) => x[6] === truth));
}

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
