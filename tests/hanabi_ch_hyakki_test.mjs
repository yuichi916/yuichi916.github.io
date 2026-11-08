// 第六章「百鬼夜行」のテスト: node tests/hanabi_ch_hyakki_test.mjs
import assert from 'node:assert/strict';
import * as C from '../hanabi/ch/hyakki.js';
import * as Y from '../hanabi/ch/hyakki-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(C.LEVELS.length, 8, '8 面');
for (const k of ['caught', 'miss', 'lift']) assert.ok(C.FAIL[k], '失敗の言葉 ' + k);

// 譜面: 画面に収まる・見えている間の面どうしが重ならない・太鼓とはなれている・拍の順
for (const lv of C.LEVELS) for (const [w, h] of SIZES) {
  const st = C.newStage(lv, w, h), yMax = w >= h ? h * 0.62 : h * 0.68, tag = `${lv.id} ${w}x${h}`, T = st.targets;
  assert.equal(T.length, lv.n, tag + ' 面の数');
  const inside = (p, m, what) => assert.ok(p.x - m > 40 && p.x + m < w - 40 && p.y - m > 105 && p.y + m < yMax, `${tag} ${what} が画面の外 (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`);
  for (const o of T) inside(o, st.r, '面');
  inside(st.taiko, 34, '太鼓'); inside(st.start, 30, 'はじまり');
  for (let i = 0; i < T.length; i++) {
    if (i) assert.ok(T[i].beat > T[i - 1].beat, tag + ' 拍の順');
    assert.ok(Math.hypot(T[i].x - st.taiko.x, T[i].y - st.taiko.y) > 110, tag + ' 太鼓と重なる');
    for (let j = i + 1; j < T.length; j++) if (Math.abs(T[j].beat - T[i].beat) <= 3.2) assert.ok(Math.hypot(T[i].x - T[j].x, T[i].y - T[j].y) > st.r * 1.6, `${tag} 面 ${i} と ${j} が重なる`);
  }
  // 面から面へ、人の指で間に合う速さ（毎秒 450 まで）
  for (let i = 1; i < T.length; i++) assert.ok(Math.hypot(T[i].x - T[i - 1].x, T[i].y - T[i - 1].y) / ((T[i].beat - T[i - 1].beat) * st.spb) < 450, `${tag} 面 ${i} が遠すぎる`);
}
console.log('ok   8 面の譜面が、5 つの画面の大きさで収まり、重ならない');

function run(lv, w, h, opt = {}, drive = C.bot, t0 = 0) {
  const st = C.newStage(lv, w, h, opt), mem = {}, log = [];
  for (let i = 0; i < t0; i++) { C.step(st, Y.DT); st.events.length = 0; }
  let last = null;
  for (let g = 0; g < 60 * 120 && !['done', 'fail'].includes(st.phase); g++) {
    const a = drive(st, mem);
    if (a && a.down) { C.penDown(st, ...a.down); last = { x: a.down[0], y: a.down[1] }; }
    if (a && a.move) { if (last) assert.ok(Math.hypot(a.move[0] - last.x, a.move[1] - last.y) <= 9.001, `${lv.id} 指が速すぎる`); last = { x: a.move[0], y: a.move[1] }; C.penMove(st, ...a.move); }
    if (a && a.up) C.penUp(st);
    C.step(st, Y.DT); log.push(...st.events); st.events.length = 0;
  }
  return { st, log };
}
for (const [w, h] of [[1280, 720], [720, 1280]]) {
  const got = [];
  for (const lv of C.LEVELS) {
    const { st, log } = run(lv, w, h);
    assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} 越えられない: ${st.reason}`);
    assert.equal(st.hit, lv.n, `${lv.id} 全部の面に当たる`);
    // 拍の音: 四つ数える拍があり、最後の面まで拍が鳴りつづける
    const beats = log.filter((e) => e.type === 'beat' && !e.pre);
    assert.deepEqual(beats.filter((e) => e.count).map((e) => e.count), [4, 3, 2, 1], lv.id + ' 四つ数える');
    assert.ok(beats.length >= Y.COUNT_IN + st.targets[st.targets.length - 1].beat, lv.id + ' 拍が鳴る');
    const n = C.starsFor(st); got.push(n); assert.ok(C.info(st).length > 0);
  }
  assert.ok(got.every((n) => n === 3), `運転手は全部 星 3 ${got}`);
  console.log(`ok   運転手が 8 面とも越える ${w}x${h} 星`, got.join(''));
}
// 筆を置く時が拍の途中でも、数えはじめは拍にそろう
{
  for (const t0 of [0, 7, 23, 41]) { const { st } = run(C.LEVELS[1], 1280, 720, {}, C.bot, t0); assert.equal(st.phase, 'done'); const k = st.songStart / st.spb; assert.ok(Math.abs(k - Math.round(k)) < 1e-9, '拍にそろう'); }
  console.log('ok   いつ筆を置いても、拍にそろって越えられる');
}

// 判定: 拍ちょうどなら「ぴったり」、0.1 秒ずれると「当たり」だけ、0.2 秒ずれると外れ
function passAt(off) {
  const lv = C.LEVELS[0], st = C.newStage(lv, 1280, 720); C.penDown(st, st.start.x, st.start.y);
  const o = st.targets[0];
  // 拍 + off の時に面の中心を通るよう、横にまっすぐ動かす（毎秒 300）
  const v = 300, x0 = o.x - v * (o.tb + off);
  let res = null;
  for (let g = 0; g < 60 * 8 && st.phase === 'play' && o.state === 'wait'; g++) {
    const c = Y.songT(st) + Y.DT; C.penMove(st, Math.max(x0, Math.min(o.x + 400, x0 + v * c)), o.y); C.step(st, Y.DT);
    for (const e of st.events) if (e.type === 'hit' || e.type === 'targetMiss') res = e; st.events.length = 0;
  }
  return res;
}
{
  const a = passAt(0); assert.equal(a.type, 'hit'); assert.equal(a.perfect, true, 'ぴったり');
  const b = passAt(0.1); assert.equal(b.type, 'hit'); assert.equal(b.perfect, false, '少し遅い'); assert.ok(b.off > 0.05);
  const b2 = passAt(-0.1); assert.equal(b2.type, 'hit'); assert.ok(b2.off < -0.05, '少し早い');
  const c = passAt(0.4); assert.equal(c.type, 'targetMiss', '遅すぎると外れ');
  const d = passAt(-0.4); assert.equal(d.type, 'targetMiss', '早すぎても外れ');
  console.log('ok   ぴったり・早い/遅い・外れ');
}

// 失敗の形
{
  const lv = C.LEVELS[0], W = 1280, H = 720;
  const s0 = C.newStage(lv, W, H); assert.equal(C.penDown(s0, 5, 5), false); assert.equal(s0.phase, 'aim');
  // 止まると火に追いつかれる
  const s1 = C.newStage(lv, W, H); C.penDown(s1, s1.start.x, s1.start.y); C.penMove(s1, s1.start.x + 60, s1.start.y); for (let i = 0; i < 60 * 30 && s1.phase === 'play'; i++) C.step(s1, Y.DT);
  assert.equal(s1.reason, 'caught', '止まると追いつかれる');
  // 離すと終わり
  const s2 = C.newStage(lv, W, H); C.penDown(s2, s2.start.x, s2.start.y); C.penUp(s2); assert.equal(s2.reason, 'lift');
  // 面を通らずに、ぐるぐる回っているだけだと、外しすぎで終わる（火には追いつかれない速さで）
  for (const L of [C.LEVELS[0], C.LEVELS[7]]) {
    const r = run(L, W, H, {}, (st, mem) => {
      // はじまりの印を通る、横 120・縦 80 の楕円を回る（毎秒 300 くらい）
      if (st.phase === 'aim') { mem.a = Math.PI; return { down: [st.start.x, st.start.y] }; }
      mem.a += 0.05; return { move: [st.start.x + 120 + Math.cos(mem.a) * 120, st.start.y + Math.sin(mem.a) * 80] };
    });
    assert.equal(r.st.reason, 'miss', L.id + ' 外しすぎで終わる');
  }
  // 外れが maxMiss までなら越えられる（星 2 はつかない）
  const L4 = C.LEVELS[4], skip = new Set([3, 9, 15]);
  const r4 = run(L4, W, H, {}, (st, mem) => {
    // 決めた面の拍のまわりだけ、手本の線から横へそれる（筆先は 1 コマ 9 以下で追う）
    const a = C.bot(st, mem); if (!a || !a.move) { if (a && a.down) mem.q = { x: a.down[0], y: a.down[1] }; return a; }
    const c = Y.songT(st); let dy = 0;
    for (const i of skip) { const o = st.targets[i]; if (Math.abs(c - o.tb) < 0.32) dy = (o.y < (st.f.y0 + st.f.y1) / 2 ? 1 : -1) * st.r * 2.4; }
    const gx = a.move[0], gy = a.move[1] + dy, d = Math.hypot(gx - mem.q.x, gy - mem.q.y);
    if (d > 9) { mem.q.x += ((gx - mem.q.x) / d) * 9; mem.q.y += ((gy - mem.q.y) / d) * 9; } else mem.q = { x: gx, y: gy };
    return { move: [mem.q.x, mem.q.y] };
  });
  assert.equal(r4.st.phase, 'done', '3 つ外しても越える ' + r4.st.reason); assert.ok(r4.st.miss >= 1 && r4.st.miss <= L4.maxMiss);
  console.log('ok   追いつかれる・離す・外しすぎ・少しの外れは許す');
}

// 決定的
{ const a = run(C.LEVELS[7], 1280, 720).st, b = run(C.LEVELS[7], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.perfect, b.perfect); assert.equal(a.len, b.len); }
{ const a = C.newStage(C.LEVELS[5], 720, 1280).targets, b = C.newStage(C.LEVELS[5], 720, 1280).targets; assert.deepEqual(a, b); }
{ const src = (await import('node:fs')).readFileSync(new URL('../hanabi/ch/hyakki-rules.js', import.meta.url), 'utf8'); assert.ok(!/Math\.random|document|window/.test(src), 'ルールは決定的'); }
console.log('hanabi_ch_hyakki_test: ALL PASS');
