// 一筆花火のランキング: 夜ごとの確かめ（rankcheck.js）と名前（names.js）のテスト
// ボットが「今夜の一筆」をページと同じ手順で遊び（屋台・お守り・やりなおし）、夜ごとに送る中身を作って確かめる。
// 本物のルールで燃やしなおした点が、遊んだときの点と同じになること、ずるい送り方は受けないことを見る。
import * as K from '../assets/hitofude/core.js';
import { playRun } from './lib/hitofude_rankbot.mjs';
import { initState, applyNight, cleanStrokes } from '../assets/hitofude/rankcheck.js';
import { cleanName } from '../assets/hitofude/names.js';

let fails = 0;
const check = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { fails++; console.log('FAIL', name, '—', e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m || 'assert'); };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); };

const DAYS = ['2026-10-03', '2026-11-15'];

function verifyAll(ctx, payloads) {
  let s = initState(K), last = null;
  for (const p of payloads) { const r = applyNight(K, s, JSON.parse(JSON.stringify(p)), ctx); if (!r.ok) return r; s = r.state; last = r; }
  return { ok: true, state: s, last };
}

const runs = DAYS.map((d) => playRun(d));
check('燃やしなおした点が、遊んだときの点と同じ（2 日・屋台・入れかえ・墨・Lv 上げ・入れかえ）', () => {
  for (const r of runs) {
    const v = verifyAll(r.ctx, r.payloads);
    ok(v.ok, `rejected: ${v.error}`);
    eq(v.state.total, Math.round(r.total), 'total');
    ok(v.state.over, 'run over');
  }
});
check('散った夜を予備の提灯でやりなおしても、同じ点', () => {
  const r = playRun(DAYS[0], { weakNight: 1 });
  ok(r.payloads[1].retries === 1, 'retried night 1');
  const v = verifyAll(r.ctx, r.payloads); ok(v.ok, `rejected: ${v.error}`); eq(v.state.total, Math.round(r.total));
});
check('夜を飛ばす・同じ夜を二度送る・終わった祭りに送ると受けない', () => {
  const r = runs[0]; let s = initState(K);
  eq(applyNight(K, s, r.payloads[1], r.ctx).error, 'order');
  s = applyNight(K, s, r.payloads[0], r.ctx).state;
  eq(applyNight(K, s, r.payloads[0], r.ctx).error, 'order');
  const v = verifyAll(r.ctx, r.payloads);
  eq(applyNight(K, v.state, { ...r.payloads[0], n: v.state.n }, r.ctx).error, 'over');
});
check('候補に出ていないお守り・星の足りない入れかえ・予備の提灯の数を越えるやりなおし・2 回目の広告は受けない', () => {
  const r = runs[0], ctx = r.ctx;
  const s1 = applyNight(K, initState(K), r.payloads[0], ctx).state;
  const p1 = JSON.parse(JSON.stringify(r.payloads[1]));
  const pick = p1.events.find((e) => e.t === 'pick');
  const notOffered = K.CHARMS.map((c) => c.id).find((id) => !K.offerCharms(ctx.seed, 0, [], 2 + 2, { level: 0 }).includes(id) && !K.offerCharms(ctx.seed, 0, [], 0, { level: 0 }).includes(id));
  eq(applyNight(K, s1, { ...p1, events: [...p1.events.filter((e) => e.t !== 'pick'), { ...pick, id: notOffered }] }, ctx).error, 'offer');
  eq(applyNight(K, { ...s1, wallet: 0 }, { ...p1, events: [{ t: 'reroll' }, pick] }, ctx).error, 'wallet');
  eq(applyNight(K, { ...s1, wallet: 2 }, { ...p1, events: [{ t: 'life' }, pick] }, ctx).error, 'wallet');
  eq(applyNight(K, s1, { ...p1, retries: s1.lives + 1 }, ctx).error, 'retries');
  eq(applyNight(K, { ...s1, adUsed: true }, { ...p1, ad: true }, ctx).error, 'ad');
  eq(applyNight(K, initState(K), { ...r.payloads[0], events: [{ t: 'ink' }] }, ctx).error, 'events');
});
check('線をすり替えても、点はサーバーが燃やしなおした点（送った数字は使わない）', () => {
  const r = runs[0];
  const fake = { ...r.payloads[0], score: 1e9, strokes: [r.payloads[0].strokes[0].slice(0, 3)] };
  const v = applyNight(K, initState(K), fake, r.ctx);
  ok(v.ok, v.error); ok(v.night.score < 1e6, 'score is recomputed');
  eq(applyNight(K, initState(K), { ...r.payloads[0], strokes: [[{ x: NaN, y: 1 }, { x: 2, y: 3 }]] }, r.ctx).error, 'strokes');
  eq(applyNight(K, initState(K), { ...r.payloads[0], strokes: [] }, r.ctx).error, 'strokes');
  ok(cleanStrokes([[[1, 2], [3, 4]]]), '[x, y] form');
});
check('1 夜を確かめる重さ（無料の枠 10ms の目安。いちばん重い夜）', () => {
  let worst = 0;
  for (const r of runs) {
    let s = initState(K);
    for (const p of r.payloads) { const t0 = performance.now(); const v = applyNight(K, s, p, { ...r.ctx }); const dt = performance.now() - t0; s = v.state; if (p.n > 0) worst = Math.max(worst, dt); }
  }
  console.log(`      いちばん重い夜 ${worst.toFixed(1)}ms`);
  ok(worst < 60, `${worst}ms`);
});
check('名前: ふつうの名前は受け、禁止語・URL・長すぎる名前・見えない字は受けない', () => {
  for (const n of ['ヒノコ', 'hanabi_ace', '花火師たろう', 'Skill', 'わすれず', 'くずもち', 'Analyst', 'しねま好き', 'grape']) ok(cleanName(n) === n.normalize('NFKC').trim(), `should accept ${n}`);
  for (const n of ['しね', '死ねよ', 'ばか', 'f u c k', 'FuCk', 'sh1t', 'kill you', 'www.example.com', 'http://a', 'a@b', '１２３４５６７８９０１２３', '', '   ', 'a‮b', '<b>x</b>']) eq(cleanName(n), null, `should reject ${JSON.stringify(n)}`);
  eq(cleanName('  ひのこ  '), 'ひのこ');
});

console.log(fails ? `hitofude_rank_test: ${fails} FAILED` : 'hitofude_rank_test: ALL PASS');
if (fails) process.exit(1);
