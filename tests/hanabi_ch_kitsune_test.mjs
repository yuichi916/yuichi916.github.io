// 第五章「狐の嫁入り」のテスト: node tests/hanabi_ch_kitsune_test.mjs
import assert from 'node:assert/strict';
import * as C from '../hanabi/ch/kitsune.js';
import * as K from '../hanabi/ch/kitsune-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(C.LEVELS.length, 8, '8 面');
for (const k of ['escaped', 'out', 'rain', 'lift']) assert.ok(C.FAIL[k], '失敗の言葉 ' + k);

// 画面に収まる: 道・提灯・にせの線・社の絵が、文字の帯と町に重ならない
for (const lv of C.LEVELS) for (const [w, h] of SIZES) {
  const st = C.newStage(lv, w, h), yMax = w >= h ? h * 0.62 : h * 0.68, tag = `${lv.id} ${w}x${h}`;
  const inside = (p, what) => assert.ok(p.x > 40 && p.x < w - 40 && p.y > 105 && p.y < yMax, `${tag} ${what} が画面の外 (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  for (const p of st.pts) inside(p, '道');
  for (const l of st.lanterns) inside(l, '提灯');
  for (const d of st.decoys) for (const p of d.pts) inside(p, 'にせの線');
  const e = K.pointAt(st, st.L); inside({ x: e.x, y: e.y - 62 }, '社');
  // 提灯と分かれ道は、いちばん狭い横長（960）だけ 1 つ少なくてもよい
  assert.ok(st.lanterns.length === lv.lanterns || (w === 960 && st.lanterns.length >= lv.lanterns - 1), `${tag} 提灯の数 ${st.lanterns.length}`);
  assert.ok(st.decoys.length === lv.decoys.length || (w === 960 && st.decoys.length >= lv.decoys.length - 1), `${tag} 分かれ道の数 ${st.decoys.length}`);
  // 道の点の間かくがそろっている（pointAt が正しく引ける）
  for (let i = 1; i < st.pts.length; i++) assert.ok(Math.abs(st.pts[i].s - st.pts[i - 1].s - 5) < 0.6 || i === st.pts.length - 1, `${tag} 点の間かく`);
  // 提灯どうしは離れていて、両方を取れる
  for (let i = 1; i < st.lanterns.length; i++) assert.ok(st.lanterns[i].s - st.lanterns[i - 1].s >= 140, `${tag} 提灯が近すぎる`);
  // にせの線の先は、本当の道から十分はなれている（たどると本当に外れる）
  for (const d of st.decoys) { const q = d.pts[d.pts.length - 1]; const m = Math.min(...st.pts.filter((p) => Math.abs(p.s - d.s0) > 40).map((p) => Math.hypot(p.x - q.x, p.y - q.y))); assert.ok(m > lv.tol + 14, `${tag} にせの線が道に近い`); }
  // 最後の提灯は、鳥居の前（狐が待つ所）より手前
  assert.ok(st.lanterns[st.lanterns.length - 1].s < lv.fox.stops[lv.fox.stops.length - 1][0] * st.L, `${tag} 提灯が鳥居より先`);
}
console.log('ok   8 面の道が、5 つの画面の大きさで画面に収まる');

// 運転手で遊ぶ（指は 1 コマ 9 以下）
function run(lv, w, h, opt = {}, drive = C.bot) {
  const st = C.newStage(lv, w, h, opt), mem = {}, log = [];
  let last = null;
  for (let g = 0; g < 60 * 120 && !['done', 'fail'].includes(st.phase); g++) {
    const a = drive(st, mem);
    if (a && a.down) { C.penDown(st, ...a.down); last = { x: a.down[0], y: a.down[1] }; }
    if (a && a.move) { if (last) assert.ok(Math.hypot(a.move[0] - last.x, a.move[1] - last.y) <= 9.001, `${lv.id} 指が速すぎる`); last = { x: a.move[0], y: a.move[1] }; C.penMove(st, ...a.move); }
    if (a && a.up) C.penUp(st);
    C.step(st, K.DT); log.push(...st.events); st.events.length = 0;
  }
  for (let g = 0; g < 120 && st.phase === 'done'; g++) { C.step(st, K.DT); log.push(...st.events); st.events.length = 0; }
  return { st, log };
}
for (const [w, h] of [[1280, 720], [720, 1280]]) {
  const got = [];
  for (const lv of C.LEVELS) {
    const { st, log } = run(lv, w, h);
    assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} 越えられない: ${st.reason}`);
    assert.ok(log.some((e) => e.type === 'catch'), `${lv.id} 尾をつかまえる`);
    assert.ok(st.lanterns.every((l) => l.lit), `${lv.id} 越えたあと提灯は全部ともる`);
    const n = C.starsFor(st); assert.ok(n >= 1 && n <= 3); got.push(n);
    assert.ok(C.info(st).length > 0);
  }
  assert.ok(got.every((n) => n === 3), `運転手は全部 星 3 ${got}`);
  console.log(`ok   運転手が 8 面とも越える ${w}x${h} 星`, got.join(''));
}

// 人の手くらいの速さ（毎秒 300、道の上をまっすぐ）でも全部越えられる。毎秒 120 だと山場は越えられない
function chase(lv, w, h, V) {
  return run(lv, w, h, {}, (st, mem) => {
    if (st.phase === 'aim') { mem.s = 0; return { down: [st.pts[0].x, st.pts[0].y] }; }
    mem.s = Math.min(st.foxS, mem.s + V / 60); const q = K.pointAt(st, mem.s); return { move: [q.x, q.y] };
  }).st;
}
for (const lv of C.LEVELS) for (const [w, h] of [[1280, 720], [720, 1280]]) assert.equal(chase(lv, w, h, 300).phase, 'done', `${lv.id} ${w}x${h} 毎秒 300 で越える`);
assert.equal(chase(C.LEVELS[7], 1280, 720, 120).reason, 'escaped', '遅いと狐は社に入る');
assert.equal(chase(C.LEVELS[0], 1280, 720, 120).phase, 'done', '面 0 は遅くても越える');
console.log('ok   毎秒 300 で全面越える・遅いと山場で置いていかれる');

// 失敗の形
{
  const lv0 = C.LEVELS[0], W = 1280, H = 720;
  // はじまり以外では筆を置けない
  const s0 = C.newStage(lv0, W, H); assert.equal(C.penDown(s0, 5, 5), false); assert.equal(s0.phase, 'aim');
  // 止まっていると、狐は社に入ってしまう
  const s1 = C.newStage(lv0, W, H); C.penDown(s1, s1.pts[0].x, s1.pts[0].y); for (let i = 0; i < 60 * 60 && s1.phase === 'run'; i++) C.step(s1, K.DT);
  assert.equal(s1.reason, 'escaped', '止まると逃げられる');
  // 線から外れたままだと、火が消える
  const s2 = C.newStage(lv0, W, H); C.penDown(s2, s2.pts[0].x, s2.pts[0].y); C.penMove(s2, s2.pts[0].x, s2.pts[0].y + 150);
  for (let i = 0; i < 60 * 5 && s2.phase === 'run'; i++) C.step(s2, K.DT);
  assert.equal(s2.reason, 'out', '外れると消える');
  // 外れてもすぐ戻れば消えない（ゆらぐだけ）。そのかわり星 3 はもらえない
  const s2c = C.newStage(lv0, W, H); C.penDown(s2c, s2c.pts[0].x, s2c.pts[0].y); C.penMove(s2c, s2c.pts[0].x, s2c.pts[0].y + 150); for (let i = 0; i < 20; i++) C.step(s2c, K.DT); C.penMove(s2c, s2c.pts[0].x + 4, s2c.pts[0].y); for (let i = 0; i < 20; i++) C.step(s2c, K.DT);
  assert.equal(s2c.phase, 'run'); assert.ok(s2c.on && s2c.offT > 0.3, 'すぐ戻ればつづく');
  // 筆を離すと消える
  const s3 = C.newStage(lv0, W, H); C.penDown(s3, s3.pts[0].x, s3.pts[0].y); C.penUp(s3); assert.equal(s3.reason, 'lift');
  // 天気雨: 線の上でも、止まっていると雨で冷える（狐が逃げるより先に）
  const lv4 = C.LEVELS[4]; assert.ok(lv4.rain > 0);
  const s4 = C.newStage(lv4, W, H); C.penDown(s4, s4.pts[0].x, s4.pts[0].y); for (let i = 0; i < 60 * 30 && s4.phase === 'run'; i++) C.step(s4, K.DT);
  assert.equal(s4.reason, 'rain', '雨で冷える');
  // 晴れの面では、止まっていても冷えない
  assert.ok(s1.heat > 0.9);
  // 近道はできない: 輪の道で、輪をとばして先の線へ飛ぶと外れる
  const lv3 = C.LEVELS[3], s5 = C.newStage(lv3, W, H), lp = s5.pts.find((p) => p.k === 'loop');
  C.penDown(s5, s5.pts[0].x, s5.pts[0].y); s5.foxS = s5.L * 0.6; for (let s = 0; s < lp.s - 10; s += 8) { const q = K.pointAt(s5, s); C.penMove(s5, q.x, q.y); C.step(s5, K.DT); }
  const after = s5.pts.find((p) => p.s > lp.s + 60 && p.k === 'row'); C.penMove(s5, after.x, after.y); C.step(s5, K.DT);
  assert.ok(s5.sP < lp.s + 20, '輪をとばして進めない');
  // 狐火の分かれ道: にせの線をたどると、外れて火が消える
  const lv5 = C.LEVELS[5], dec = run(lv5, W, H, {}, (st, mem) => {
    const d = st.decoys[0];
    if (mem.fake || (st.phase === 'run' && st.sP >= d.s0 - 4)) {
      mem.fake = mem.fake || { i: 0 }; const p = d.pts[Math.min(d.pts.length - 1, mem.fake.i++)]; mem.p = { x: p.x, y: p.y }; return { move: [p.x, p.y] };
    }
    return C.bot(st, mem);
  });
  assert.equal(dec.st.reason, 'out', 'にせの線をたどると消える');
  assert.ok(dec.log.some((e) => e.type === 'off'));
  // 提灯を取りこぼすと星 2 はない（道のまん中だけをなぞる）
  const plain = run(C.LEVELS[2], W, H, {}, (st, mem) => { if (st.phase === 'aim') { mem.s = 0; return { down: [st.pts[0].x, st.pts[0].y] }; } mem.s = Math.min(st.foxS, mem.s + 8); const q = K.pointAt(st, mem.s); return { move: [q.x, q.y] }; });
  assert.equal(plain.st.phase, 'done'); assert.ok(plain.st.lanterns.some((l) => l.missed)); assert.equal(C.starsFor(plain.st) < 3, true);
  console.log('ok   逃げられる・外れる・離す・雨・近道できない・にせの線・取りこぼし');
}

// 決定的
{ const a = run(C.LEVELS[7], 1280, 720).st, b = run(C.LEVELS[7], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.sP, b.sP); assert.equal(C.starsFor(a), C.starsFor(b)); }
// ルールの中で Math.random を使わない
{ const src = (await import('node:fs')).readFileSync(new URL('../hanabi/ch/kitsune-rules.js', import.meta.url), 'utf8'); assert.ok(!/Math\.random|document|window/.test(src), 'ルールは決定的'); }
console.log('hanabi_ch_kitsune_test: ALL PASS');
