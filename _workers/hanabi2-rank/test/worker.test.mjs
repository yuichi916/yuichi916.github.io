// hanabi2-rank の試験: 手元の Worker（wrangler dev --local）に、本物の記録と書きかえた記録を送り、
// 確かめ役を流して、本物は ✓・書きかえは隠れることを見る。
//   RANK_URL=http://127.0.0.1:8788 ADMIN_TOKEN=<手元用> node test/worker.test.mjs
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { makeRunLog } from '../../../_dev/hanabi2-logbot.mjs';
const U = process.env.RANK_URL || 'http://127.0.0.1:8788', T = process.env.ADMIN_TOKEN;
const post = (p, b) => fetch(U + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:8811' }, body: JSON.stringify(b) }).then((r) => r.json());
const get = (p) => fetch(U + p).then((r) => r.json());
const hex = (n) => n.toString(16).padStart(32, '0');
const pack = (log) => gzipSync(JSON.stringify(log)).toString('base64');
assert.equal((await get('/health')).ok, true);
const { run, log } = makeRunLog(4242, { nightsMax: 4 });
const base = { v: log.v, daily: false, rank: 0, school: 'hon', fuse: 'asa', won: false };
// 1) 本物
let r = await post('/submit', { ...base, player: hex(1), name: 'ほんもの', score: run.totalScore, nights: run.nightsCleared, log: pack(log) });
assert.ok(r.ok && r.place >= 1, JSON.stringify(r));
// 2) 点を盛った（記録はそのまま）
r = await post('/submit', { ...base, player: hex(2), name: 'もった', score: run.totalScore * 50, nights: run.nightsCleared, log: pack(log) });
assert.ok(r.ok && r.place === 1, '確かめる前は載ってしまう');
// 3) ありえない値・使えない名前は受けない
assert.equal((await post('/submit', { ...base, player: hex(3), name: 'x', score: -1, nights: 1, log: pack(log) })).ok, false);
assert.equal((await post('/submit', { ...base, player: hex(3), name: 'http://a.com', score: 10, nights: 1, log: pack(log) })).ok, false);
assert.equal((await post('/submit', { ...base, player: hex(3), name: 'a', score: 10, nights: 3, won: true, log: pack(log) })).ok, false, '24 夜前の大団円');
// 4) 確かめ役を流す
const out = execFileSync('node', ['../../_dev/hanabi2-verify.mjs'], { env: { ...process.env, RANK_URL: U, ADMIN_TOKEN: T, VERIFY_LOG: 'NUL' } }).toString();
console.log(out.trim());
const top = await get(`/top?board=a:0:hon&player=${hex(1)}`);
assert.equal(top.top.length, 1, '盛った記録は隠れた');
assert.equal(top.top[0].name, 'ほんもの'); assert.equal(top.top[0].verified, true);
assert.equal(top.me.place, 1);
// 5) 低い点を送っても、前の良い記録が残る
r = await post('/submit', { ...base, player: hex(1), name: 'ほんもの2', score: 1, nights: 1, log: pack(log) });
assert.ok(r.ok && r.kept);
console.log('hanabi2-rank worker test: ALL PASS');
