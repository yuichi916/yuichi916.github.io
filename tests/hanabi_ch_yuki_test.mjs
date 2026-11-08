// 第4章「雪の山里」のテスト: node tests/hanabi_ch_yuki_test.mjs
import assert from 'node:assert/strict';
import * as M from '../hanabi/ch/yuki.js';
import * as Z from '../hanabi/ch/yuki-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(M.LEVELS.length, 8, '8 面ちょうど');
assert.equal(M.CHAPTER.id, 'yuki');

function drive(lv, w, h, opt = {}) {
  const st = M.newStage(lv, w, h, opt), mem = {}, log = [];
  let down = false, last = null, maxStep = 0;
  for (let g = 0; g < 60 * 60 && !['done', 'fail'].includes(st.phase); g++) {
    const a = M.bot(st, mem);
    if (a) {
      if (a.down) { if (down) M.penUp(st); down = M.penDown(st, a.down[0], a.down[1]); last = { x: a.down[0], y: a.down[1] }; }
      if (a.move && down) { maxStep = Math.max(maxStep, Math.hypot(a.move[0] - last.x, a.move[1] - last.y)); last = { x: a.move[0], y: a.move[1] }; M.penMove(st, a.move[0], a.move[1]); }
      if (a.up && down) { down = false; M.penUp(st); }
    }
    M.step(st, Z.DT); log.push(...st.events); st.events.length = 0;
  }
  return { st, log, maxStep };
}
// 指で線を引く（1 コマ 9 まで）。引きながら時間も進める
function stroke(st, pts, v = 8) {
  assert.equal(M.penDown(st, pts[0].x, pts[0].y), true, '線を引きはじめられる');
  let p = { ...pts[0] };
  for (const q of pts.slice(1)) for (;;) { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy); if (l <= v) { p = { ...q }; M.penMove(st, p.x, p.y); M.step(st, Z.DT); break; } p = { x: p.x + (dx / l) * v, y: p.y + (dy / l) * v }; M.penMove(st, p.x, p.y); M.step(st, Z.DT); }
}
const run = (st, n = 900) => { const log = []; for (let i = 0; i < n && st.phase === 'play'; i++) { M.step(st, Z.DT); log.push(...st.events.splice(0)); } return log; };

// 置き場所: 画面に収まる・湯けむりや松に埋もれない
for (const lv of M.LEVELS) for (const [w, h] of SIZES) {
  const st = M.newStage(lv, w, h), land = w >= h, top = land ? 110 : 220, bottom = land ? h * 0.62 : h * 0.7;
  for (const p of [st.house, ...st.pines, ...st.usagi, ...st.ledge.pts]) assert.ok(p.x > 30 && p.x < w - 30 && p.y > top && p.y < bottom, `${lv.id} 画面の外 ${w}x${h} (${p.x | 0},${p.y | 0})`);
  const inSteam = (p) => st.steam.some((s) => p.x > s.x0 - 20 && p.x < s.x1 + 20 && p.y > s.y0 - 20 && p.y < s.y1 + 20);
  assert.ok(!inSteam(st.house) && !st.ledge.pts.some(inSteam), `${lv.id} 家や棚が湯けむりの中 ${w}x${h}`);
  for (const u of st.usagi) for (const p of st.pines) assert.ok(Math.hypot(u.x - p.x, u.y - p.y) > 60, `${lv.id} うさぎが松に近い`);
  assert.ok(st.house.y < st.field.fallY - 40, '家は谷より上');
  assert.equal(st.phase, 'aim');
}
console.log('ok   置き場所: 画面に収まる・湯けむりや松に埋もれない');

// 全面を、横長・縦長で越えられる。手本の線なら星 3 つ
for (const [w, h] of SIZES) for (const lv of M.LEVELS) {
  const { st, maxStep } = drive(lv, w, h);
  assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} ${st.reason}`);
  assert.equal(M.starsFor(st), 3, `${lv.id} ${w}x${h} 星 ${M.starsFor(st)} 秒 ${st.rideT.toFixed(2)}`);
  assert.ok(maxStep <= 9.001, `${lv.id} 指が速すぎる ${maxStep}`);
  for (const k of st.strokes) for (const p of k.pts) assert.ok(p.x >= 0 && p.x <= w && p.y >= 100 && p.y <= h * (w >= h ? 0.63 : 0.71), `${lv.id} 線が画面の外 ${w}x${h}`);
}
console.log('ok   全 8 面を横長・縦長で越える（星 3）');

// そりは筆を置くまで待つ
{
  const st = M.newStage(M.LEVELS[0], 1280, 720), x = st.sled.x;
  for (let i = 0; i < 600; i++) M.step(st, Z.DT);
  assert.equal(st.sled.x, x); assert.equal(st.phase, 'aim'); assert.equal(st.sled.mode, 'hold');
}

// 失敗の形
const L0 = M.LEVELS[0];
{
  // どこにも氷を引かないと、そりは谷へ落ちる
  const st = M.newStage(L0, 1280, 720);
  stroke(st, [{ x: 1000, y: 200 }, { x: 1040, y: 200 }]); M.penUp(st);
  run(st); assert.equal(st.reason, 'fell', '谷へ落ちる');
}
{
  // 筆を置いたまま止めると、火が筆先まで来る
  const st = M.newStage(L0, 1280, 720), s = st.sled;
  assert.equal(M.penDown(st, s.x + 60, s.y + 40), true); M.penMove(st, s.x + 64, s.y + 41);
  run(st); assert.equal(st.reason, 'caught', '追いつかれる');
}
{
  // 谷の形の氷: そりは底で揺れているうちに、火が来て氷が溶ける
  const st = M.newStage(L0, 1280, 720), s = st.sled;
  stroke(st, [{ x: s.x + 40, y: s.y + 30 }, { x: s.x + 200, y: s.y + 120 }, { x: s.x + 360, y: s.y + 30 }]); M.penUp(st);
  const log = run(st, 1800);
  assert.equal(st.reason, 'melt', '溶けて落ちる ' + st.reason); assert.ok(log.some((e) => e.type === 'air' && e.why === 'melt'));
}
{
  // 松に向けて引くと、線は手前で止まり、そりは松にぶつかる
  const lv = M.LEVELS.find((l) => l.id === 'matsu'), st = M.newStage(lv, 1280, 720), s = st.sled, p = st.pines[0];
  stroke(st, [{ x: s.x + 40, y: s.y + 30 }, { x: p.x, y: p.y - 6 }]); M.penUp(st);
  assert.ok(st.events.some((e) => e.type === 'block' && e.what === 'pine') || st.strokes[0].pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= p.r + 4 - 0.01), '松の中へは引けない');
  run(st); assert.equal(st.reason, 'pine', '松にぶつかる ' + st.reason);
}
{
  // 湯けむりの中では引けない（始められないし、中へのびない）
  const lv = M.LEVELS.find((l) => l.id === 'yukemuri'), st = M.newStage(lv, 1280, 720), g = st.steam[0];
  assert.equal(M.penDown(st, (g.x0 + g.x1) / 2, 300), false, '湯けむりの中では始められない');
  stroke(st, [{ x: g.x0 - 120, y: 300 }, { x: g.x1 + 120, y: 300 }]);
  const k = st.strokes[0]; assert.ok(k.pts.every((q) => q.x <= g.x0), '湯けむりの中へはのびない');
}
console.log('ok   落ちる・追いつかれる・溶ける・松・湯けむり');

// 物理: まっすぐな坂では離れずに速くなる・高い所から落ちても氷を突き抜けない・家まで引くと筆はそこで終わる
{
  const st = M.newStage(L0, 1280, 720), s = st.sled;
  stroke(st, [{ x: s.x + 30, y: s.y + 24 }, { x: s.x + 700, y: s.y + 230 }], 9); M.penUp(st);
  let prev = -1, airs = 0;
  for (let i = 0; i < 600 && st.phase === 'play'; i++) { M.step(st, Z.DT); airs += st.events.filter((e) => e.type === 'air' && e.why === 'jump').length; st.events.length = 0; if (st.sled.mode === 'ride' && st.sled.k === st.strokes[0] && st.sled.s < st.strokes[0].len - 5) { assert.ok(st.sled.vs >= prev - 0.5, 'まっすぐな坂では速くなる'); prev = st.sled.vs; } }
  assert.equal(airs, 0, 'まっすぐな坂では浮かない'); assert.ok(prev > 200);
}
{
  const st = M.newStage(L0, 720, 1280), s = st.sled, f = st.field;
  stroke(st, [{ x: s.x - 40, y: f.y1 - 20 }, { x: s.x + 300, y: f.y1 + 10 }], 9); M.penUp(st);
  const log = run(st, 240);
  const land = log.find((e) => e.type === 'land'); assert.ok(land && land.hard > 300, '速く落ちても、氷に乗る');
}
{
  const st = M.newStage(L0, 1280, 720), H = st.house;
  stroke(st, [{ x: H.x - 200, y: H.y - 40 }, { x: H.x, y: H.y }]);
  assert.equal(st.cur, null, '家まで引いたら筆はおしまい');
}
console.log('ok   物理: 坂・着地・家で筆が終わる');

// 星: 遅いと 2 つめがつかない
{
  const lv = M.LEVELS[0], st = M.newStage(lv, 1280, 720); st.phase = 'done'; st.rideT = 99; st.usagi.forEach((u) => { u.got = true; });
  assert.equal(M.starsFor(st), 2); st.rideT = 1; assert.equal(M.starsFor(st), 3); st.usagi[0].got = false; assert.equal(M.starsFor(st), 2);
}
// 決定的
{ const a = drive(M.LEVELS[7], 1280, 720).st, b = drive(M.LEVELS[7], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.sled.x, b.sled.x); assert.equal(a.rideT, b.rideT); }
{ const { st } = drive(M.LEVELS[4], 720, 1280); assert.ok(M.info(st).length > 0); assert.ok(Array.isArray(M.labels(st))); }
console.log('hanabi_ch_yuki_test: ALL PASS');
