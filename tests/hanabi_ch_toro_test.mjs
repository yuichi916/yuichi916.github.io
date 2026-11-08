// 第2章「灯籠流し」のテスト: node tests/hanabi_ch_toro_test.mjs
import assert from 'node:assert/strict';
import * as M from '../hanabi/ch/toro.js';
import * as Z from '../hanabi/ch/toro-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(M.LEVELS.length, 8, '8 面ちょうど');
assert.equal(M.CHAPTER.id, 'toro');

// 運転手に遊ばせる（指は 1 コマ 9 以下しか動かさない）
function drive(lv, w, h, opt = {}) {
  const st = M.newStage(lv, w, h, opt), mem = {}, log = [];
  let down = false, last = null, maxStep = 0;
  for (let g = 0; g < 60 * 90 && !['done', 'fail'].includes(st.phase); g++) {
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

// 置き場所: 画面に収まる・岸や社や蓮が岩に埋もれない
for (const lv of M.LEVELS) for (const [w, h] of SIZES) {
  const st = M.newStage(lv, w, h), land = w >= h, top = land ? 110 : 220, bottom = land ? h * 0.62 : h * 0.7;
  const things = [...st.docks, ...st.shrines, ...st.lotus, ...st.rocks];
  for (const p of things) assert.ok(p.x > 30 && p.x < w - 30 && p.y > top && p.y < bottom, `${lv.id} 画面の外 ${w}x${h} (${p.x | 0},${p.y | 0})`);
  for (const d of st.docks) for (let i = 0; i < d.lanterns.length + 2; i++) { const p = M.dockSlot(st, d, i); assert.ok(p.x > 20 && p.x < w - 20 && p.y > top - 10, `${lv.id} 岸の灯籠が画面の外 ${w}x${h}`); }
  for (const p of [...st.docks, ...st.shrines, ...st.lotus]) for (const r of st.rocks) assert.ok(Math.hypot(p.x - r.x, p.y - r.y) > r.r + 22, `${lv.id} 岩に埋もれる ${w}x${h}`);
  assert.equal(st.phase, 'aim');
}
console.log('ok   置き場所: 画面に収まる・岩に埋もれない');

// 全面を、横長・縦長で越えられる。手本の道なら星 3 つ
for (const [w, h] of SIZES) for (const lv of M.LEVELS) {
  const { st, maxStep } = drive(lv, w, h);
  assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} ${st.reason}`);
  assert.equal(M.starsFor(st), 3, `${lv.id} ${w}x${h} 星 ${M.starsFor(st)}`);
  assert.ok(maxStep <= 9.001, `${lv.id} 指が速すぎる ${maxStep}`);
  const land = w >= h;
  for (const k of st.strokes) for (const p of k.pts) {
    assert.ok(p.x >= 0 && p.x <= w && p.y >= 100 && p.y <= h * (land ? 0.63 : 0.71), `${lv.id} 線が画面の外 ${w}x${h}`);
    for (const r of st.rocks) assert.ok(Math.hypot(p.x - r.x, p.y - r.y) >= r.r - 0.01, `${lv.id} 線が岩の中 ${w}x${h}`);
  }
}
console.log('ok   全 8 面を横長・縦長で越える（星 3）');

// 星の段: 手が遅いと星が減る・とても遅いと失敗
{
  const lv = M.LEVELS[5], st = M.newStage(lv, 1280, 720), mem = {}; let down = false;
  for (let g = 0; g < 60 * 60 && !['done', 'fail'].includes(st.phase); g++) { const a = Z.bot(st, mem, 4); if (a && a.down) down = M.penDown(st, ...a.down); else if (a && a.move && down) M.penMove(st, ...a.move); M.step(st, Z.DT); st.events.length = 0; }
  assert.ok(st.phase === 'done' && M.starsFor(st) < 3, '早瀬はゆっくりだと星が減る ' + st.phase + M.starsFor(st));
}

// 失敗の形
const L0 = M.LEVELS[0], L1 = M.LEVELS[1];
{
  // 止まると火に追いつかれる
  const st = M.newStage(L1, 1280, 720), d = st.docks[0];
  assert.equal(M.penDown(st, d.x, d.y), true);
  M.penMove(st, d.x + 120, d.y - 40);
  const log = [];
  for (let i = 0; i < 900 && st.phase === 'play'; i++) { M.step(st, Z.DT); log.push(...st.events.splice(0)); }
  assert.equal(st.reason, 'caught', '止まると追いつかれる');
  assert.ok(log.some((e) => e.type === 'burn'), '灯籠が燃える');
  assert.ok(M.FAIL[st.reason]);
}
{
  // 筆を離すと、灯籠は線の先で止まり、火に燃やされる
  const st = M.newStage(L0, 1280, 720), d = st.docks[0];
  M.penDown(st, d.x, d.y); for (let i = 1; i <= 40; i++) { M.penMove(st, d.x + i * 8, d.y); M.step(st, Z.DT); }
  M.penUp(st);
  for (let i = 0; i < 900 && st.phase === 'play'; i++) M.step(st, Z.DT);
  assert.equal(st.reason, 'lift', '離すと失敗');
}
{
  // 遠回りしすぎると、社についたあとで後ろの灯籠が燃える
  const st = M.newStage(L1, 1280, 720), d = st.docks[0], f = st.field;
  M.penDown(st, d.x, d.y);
  let p = { x: d.x, y: d.y };
  const way = [];
  for (let i = 0; i < 6; i++) way.push({ x: f.x0 + 150 + i * 30, y: i % 2 ? f.y0 + 10 : f.y1 - 10 });
  for (let i = 0; i < 6; i++) way.push({ x: f.x0 + 300 + i * 30, y: i % 2 ? f.y1 - 10 : f.y0 + 10 });
  way.push(st.shrines[0]);
  for (const q of way) { for (;;) { const dx = q.x - p.x, dy = q.y - p.y, l = Math.hypot(dx, dy); if (l < 9) { p = { x: q.x, y: q.y }; break; } p = { x: p.x + (dx / l) * 9, y: p.y + (dy / l) * 9 }; M.penMove(st, p.x, p.y); M.step(st, Z.DT); } M.penMove(st, p.x, p.y); }
  assert.ok(st.strokes[0].connected, '社までつながった');
  for (let i = 0; i < 1200 && st.phase === 'play'; i++) M.step(st, Z.DT);
  assert.equal(st.reason, 'burned', '遠回りすると燃える: ' + st.reason + ' ' + st.saved);
}
{
  // 岸から遠い所では始められない。岩の中へは線がのびない
  const st = M.newStage(M.LEVELS[1], 1280, 720);
  assert.equal(M.penDown(st, st.shrines[0].x, st.shrines[0].y), false); assert.equal(st.phase, 'aim');
  const d = st.docks[0], r = st.rocks[0]; M.penDown(st, d.x, d.y);
  for (let x = d.x; x < st.shrines[0].x; x += 8) M.penMove(st, x, r.y);
  const k = st.strokes[0], tip = k.pts[k.pts.length - 1];
  assert.ok(tip.x < r.x - r.r + 7 && !k.connected, '岩の手前で止まる');
  assert.ok(st.events.some((e) => e.type === 'block' && e.what === 'rock'));
}
{
  // 色の違う社にはつながらない
  const st = M.newStage(M.LEVELS[4], 1280, 720), d = st.docks[0], wrong = st.shrines.find((s) => s.col !== d.col);
  M.penDown(st, d.x, d.y);
  let p = { x: d.x, y: d.y };
  for (let i = 0; i < 400; i++) { const dx = wrong.x - p.x, dy = wrong.y - p.y, l = Math.hypot(dx, dy); if (l < 2) break; p = { x: p.x + (dx / l) * Math.min(8, l), y: p.y + (dy / l) * Math.min(8, l) }; M.penMove(st, p.x, p.y); }
  assert.equal(st.strokes[0].connected, false, '色の違う社');
  assert.ok(st.events.some((e) => e.type === 'block' && e.what === 'color'));
}
console.log('ok   止まる→追いつかれる・離す・遠回り→燃える・岩・色の違う社');

// 山場: 名前のない灯籠は、どうしても岸を離れない（数にも入らない）
{
  const lv = M.LEVELS[7]; assert.ok(lv.docks.some((d) => d.nameless));
  const { st, log } = drive(lv, 1280, 720);
  assert.equal(st.phase, 'done');
  assert.equal(st.total, lv.docks.reduce((a, d) => a + d.n, 0), '名前のない灯籠は数に入らない');
  assert.ok(!log.some((e) => e.type === 'save' && !e.name), '名前のない灯籠は送られない');
  assert.ok(M.LEVELS.slice(0, 7).every((l) => !l.docks.some((d) => d.nameless)), '名前のない灯籠は山場だけ');
}
console.log('ok   名前のない灯籠は岸に残る');

// 決定的
{ const a = drive(M.LEVELS[6], 1280, 720).st, b = drive(M.LEVELS[6], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.saved, b.saved); assert.deepEqual(a.strokes.map((k) => k.fireS), b.strokes.map((k) => k.fireS)); }
// info と labels は文字を返す
{ const { st } = drive(M.LEVELS[4], 720, 1280); assert.ok(M.info(st).length > 0); assert.ok(Array.isArray(M.labels(st))); assert.ok(M.info(M.newStage(M.LEVELS[0], 1280, 720)).includes('社')); }
console.log('hanabi_ch_toro_test: ALL PASS');
