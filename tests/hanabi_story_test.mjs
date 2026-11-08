// 物語「星の夜」のテスト: node tests/hanabi_story_test.mjs
import assert from 'node:assert/strict';
import * as Z from '../hanabi/stars.js';

const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)); return Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u); };

for (const lv of Z.LEVELS) {
  // 解けること。筆を離す回数は決めたとおり（鵲の面は 0 回では解けず、1 回なら解ける）
  const jumps = (lv.jumps || 0) + (lv.magpie ? 1 : 0);
  assert.ok(Z.solve(lv, jumps), lv.id + ' 解ける');
  if (jumps > 0) assert.equal(Z.solve(lv, jumps - 1), null, lv.id + ' 筆を離さないと解けない');
  for (const [w, h] of [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]]) {
    const st = Z.newPuzzle(lv, w, h);
    // 星どうしが近すぎない・線が別の星の上を通らない（なぞるつもりのない星に触れない）
    st.nodes.forEach((a, i) => st.nodes.forEach((b, j) => { if (j > i) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > st.r * 2.4, `${lv.id} 星が近い ${w}x${h}`); }));
    for (const e of st.edges) st.nodes.forEach((n, i) => { if (i !== e.a && i !== e.b) assert.ok(segDist(n, st.nodes[e.a], st.nodes[e.b]) > st.r * 1.15, `${lv.id} 線が星 ${i} の上を通る ${w}x${h}`); });
    for (const n of st.nodes) assert.ok(n.x > 40 && n.x < w - 40 && n.y > 100 && n.y < h * 0.75, `${lv.id} 画面の外 ${w}x${h}`);
  }
}
console.log('ok   星座', Z.LEVELS.length, '面: 解ける・重ならない・画面に収まる');

// 手本どおりに引けば、火に追いつかれずに描ける（指は 1 秒に 420 動かす）
function drive(lv, opt = {}, speed = 420) {
  const st = Z.newPuzzle(lv, 1280, 720, opt), sol = Z.solve(lv, st.jumpsLeft);
  let p = { ...st.nodes[sol[0].n] }; Z.penDown(st, p.x, p.y);
  let i = 1, log = [];
  for (let g = 0; g < 60 * 60 && !['done', 'fail'].includes(st.phase); g++) {
    if (i < sol.length && st.phase === 'draw') {
      const q = sol[i];
      if (q.jump) { Z.penUp(st); Z.penDown(st, st.nodes[q.n].x, st.nodes[q.n].y); p = { ...st.nodes[q.n] }; i++; }
      else { const t = st.nodes[q.n], d = Math.hypot(t.x - p.x, t.y - p.y), v = speed * Z.DT; if (d <= v) { p = { x: t.x, y: t.y }; i++; } else { p.x += ((t.x - p.x) / d) * v; p.y += ((t.y - p.y) / d) * v; } Z.penMove(st, p.x, p.y); }
    }
    Z.step(st); log.push(...st.events); st.events.length = 0;
  }
  return { st, log };
}
for (const lv of Z.LEVELS) {
  const { st } = drive(lv, { magpie: !!lv.magpie });
  assert.equal(st.phase, 'done', lv.id + ' ' + st.reason); assert.ok(Z.starsFor(st) >= 1);
}
console.log('ok   手本どおりなら全面描ける');

// 失敗の形: 止まると追いつかれる・同じ線は二度なぞれない・離すと終わり・行き止まり
{
  const lv = Z.LEVELS[0], st = Z.newPuzzle(lv, 1280, 720); const a = st.nodes[0];
  Z.penDown(st, a.x, a.y); Z.penMove(st, st.nodes[1].x, st.nodes[1].y);
  for (let i = 0; i < 600 && st.phase === 'draw'; i++) Z.step(st);
  assert.equal(st.reason, 'caught', '止まると追いつかれる');
  const s2 = Z.newPuzzle(lv, 1280, 720); Z.penDown(s2, s2.nodes[0].x, s2.nodes[0].y); Z.penMove(s2, s2.nodes[1].x, s2.nodes[1].y); Z.penMove(s2, s2.nodes[0].x, s2.nodes[0].y);
  assert.equal(s2.cur, 1, '同じ線は二度なぞれない'); assert.ok(s2.events.some((e) => e.type === 'used'));
  const s3 = Z.newPuzzle(lv, 1280, 720); Z.penDown(s3, s3.nodes[0].x, s3.nodes[0].y); Z.penMove(s3, s3.nodes[1].x, s3.nodes[1].y); Z.penUp(s3); assert.equal(s3.reason, 'lift', '離すと終わり');
  // 北斗七星を柄の付け根から逆に回ると、柄の先で行き止まり
  const s4 = Z.newPuzzle(lv, 1280, 720), N = s4.nodes; Z.penDown(s4, N[3].x, N[3].y); for (const k of [2, 1, 0]) Z.penMove(s4, N[k].x, N[k].y); assert.equal(s4.reason, 'stuck', '行き止まり');
  // 星以外の所では始められない
  const s5 = Z.newPuzzle(lv, 1280, 720); assert.equal(Z.penDown(s5, 5, 5), false); assert.equal(s5.phase, 'aim');
  // 鵲: 1 度だけ離せる。離している間も火は進む
  const t = Z.LEVELS.find((l) => l.magpie), s6 = Z.newPuzzle(t, 1280, 720, { magpie: true }); Z.penDown(s6, s6.nodes[0].x, s6.nodes[0].y); Z.penMove(s6, s6.nodes[1].x, s6.nodes[1].y); Z.penUp(s6);
  assert.equal(s6.phase, 'jump'); for (let i = 0; i < 90; i++) Z.step(s6); assert.ok(s6.fireS > 0, '離している間も火は進む');
  assert.equal(Z.penDown(s6, s6.nodes[5].x, s6.nodes[5].y), true); assert.equal(s6.jumpsLeft, 0); Z.penUp(s6); assert.equal(s6.reason, 'lift', '2 度目は離せない');
  console.log('ok   追いつかれる・二度なぞれない・離す・行き止まり・鵲');
}
// 決定的
{ const a = drive(Z.LEVELS[4]).st, b = drive(Z.LEVELS[4]).st; assert.equal(a.t, b.t); assert.equal(a.minGap, b.minGap); }
console.log('hanabi_story_test: ALL PASS');
