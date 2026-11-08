// 第3章「影絵の宿」のテスト: node tests/hanabi_ch_kage_test.mjs
import assert from 'node:assert/strict';
import * as C from '../hanabi/ch/kage.js';
import * as Z from '../hanabi/ch/kage-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(C.LEVELS.length, 8, '8 面ちょうど');

// 物の置き場所: 画面の中、上の文字の帯より下、横長は町より上。手元の枠は障子にかからない
for (const lv of C.LEVELS) for (const [w, h] of SIZES) {
  const st = C.newStage(lv, w, h, {}), land = w >= h, yMin = land ? 108 : 220, yMax = land ? h * 0.62 : h * 0.7;
  const inside = (x, y, what) => assert.ok(x >= 30 && x <= w - 30 && y >= yMin && y <= yMax, `${lv.id} ${what} が画面の外 ${w}x${h} (${x | 0}, ${y | 0})`);
  const p = st.paper; inside(p.x0, p.y0, '障子'); inside(p.x1, p.y1, '障子');
  inside(st.L.x, st.L.y - 34, '行灯'); inside(st.L.x, st.L.y + 30, '行灯');
  for (const c of st.cps) { inside(c.x, c.y, 'お題'); assert.ok(c.x > p.x0 && c.x < p.x1 && c.y > p.y0 && c.y < p.y1, `${lv.id} お題が障子の外 ${w}x${h}`); }
  for (let t = 0; t < 12; t += 0.25) {
    const b = Z.handBox(st, t); inside(b.x0, b.y0, '手元'); inside(b.x1, b.y1, '手元');
    const apart = land ? b.x1 < p.x0 : b.y0 > p.y1;
    assert.ok(apart, `${lv.id} 手元が障子にかかる ${w}x${h} t=${t}`);
  }
  assert.ok(st.cps.length >= 30, lv.id + ' 印が少ない');
}
console.log('ok   置き場所: 画面に収まる・手元と障子が重ならない');

// エンジン（story.js の autoTick）と同じ道で、運転手に遊ばせる
function drive(lv, w, h, opt = {}, botFn = C.bot, maxT = 60) {
  const st = C.newStage(lv, w, h, opt), mem = {}, log = [];
  let down = false;
  for (let g = 0; g < maxT * 60 && !['done', 'fail'].includes(st.phase); g++) {
    if (st.phase === 'aim') down = false;
    const a = botFn(st, mem);
    if (a && a.down) { if (down) C.penUp(st); down = !!C.penDown(st, a.down[0], a.down[1]); }
    if (a && a.move && down) {
      const last = st.pen || { x: a.move[0], y: a.move[1] };
      assert.ok(Math.hypot(a.move[0] - last.x, a.move[1] - last.y) <= 9.001, '指は 1 コマ 9 まで');
      C.penMove(st, a.move[0], a.move[1]);
    }
    if (a && a.up && down) { down = false; C.penUp(st); }
    C.step(st, 1 / 60); log.push(...st.events); st.events.length = 0;
  }
  return { st, log };
}

for (const [w, h] of [[1280, 720], [720, 1280]]) {
  const res = [];
  for (const lv of C.LEVELS) {
    const { st, log } = drive(lv, w, h);
    assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} 運転手が越えられない: ${st.reason} 重なり ${(st.cov * 100).toFixed(0)}% はみ出し ${(st.stray * 100).toFixed(0)}%`);
    assert.ok(C.starsFor(st) >= 1);
    assert.ok(log.some((e) => e.type === 'bloom'));
    if (lv.strokes > 1) assert.equal(st.strokes.length, 2, lv.id + ' 二筆めを使う');
    res.push(`${lv.id} ${(st.cov * 100).toFixed(0)}%/${(st.stray * 100).toFixed(0)}% ★${C.starsFor(st)} 余裕${st.minGap | 0}`);
  }
  console.log(`ok   運転手が全 8 面を越える ${w}x${h}:`, res.join(' ・ '));
}

// 失敗の形
{
  const lv = C.LEVELS[0];
  // 止まると追いつかれる
  const s1 = C.newStage(lv, 1280, 720), b = Z.handBox(s1), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  assert.equal(C.penDown(s1, cx, cy), true); C.penMove(s1, cx + 30, cy);
  for (let i = 0; i < 600 && s1.phase === 'draw'; i++) C.step(s1, 1 / 60);
  assert.equal(s1.reason, 'caught', '止まると追いつかれる');
  // 手元の外では始められない
  const s2 = C.newStage(lv, 1280, 720); assert.equal(C.penDown(s2, 5, 5), false); assert.equal(s2.phase, 'aim');
  assert.equal(C.penDown(s2, s2.T.x, s2.T.y), false, '障子の上では始められない');
  // 少しだけ描いて離すと、影が足りない
  const s3 = C.newStage(lv, 1280, 720), m3 = {};
  const short = (st, mem) => { const a = C.bot(st, mem); if (st.phase === 'draw' && st.cur.len > 120) return { up: true }; return a; };
  const r3 = drive(lv, 1280, 720, {}, short); assert.equal(r3.st.reason, 'short', '足りない'); void s3; void m3;
  // 押し間違い（すぐ離す）は数えない
  const s4 = C.newStage(lv, 1280, 720); C.penDown(s4, cx, cy); C.penMove(s4, cx + 4, cy); C.penUp(s4); assert.equal(s4.phase, 'aim'); assert.equal(s4.strokes.length, 0);
  // お題をなぞったあと、行灯のそばで線を往復させると、はみ出しすぎ
  const stray = (st, mem) => {
    if (mem.extra) {
      if (mem.extra > 900) return { up: true };
      const p = st.pen, tx = st.L.x + 30 + ((Math.floor(mem.extra / 40) % 2) ? 0 : 30), ty = st.L.y - 30;
      const d = Math.hypot(tx - p.x, ty - p.y), v = Math.min(8, d); mem.extra += v || 8;
      return { move: d ? [p.x + ((tx - p.x) / d) * v, p.y + ((ty - p.y) / d) * v] : [p.x + 1, p.y] };
    }
    const a = C.bot(st, mem); if (a && a.up && st.phase === 'draw') { mem.extra = 1; return { move: [st.pen.x, st.pen.y] }; } return a;
  };
  const r5 = drive(lv, 1280, 720, {}, stray); assert.equal(r5.st.reason, 'stray', 'はみ出し: ' + r5.st.reason + ' ' + r5.st.cov.toFixed(2) + ' ' + r5.st.stray.toFixed(2));
  // 燃えていない線は影にならない: 描いている途中、火より先の線は数えない
  const s6 = C.newStage(lv, 1280, 720), m6 = {};
  for (let i = 0; i < 40; i++) { const a = C.bot(s6, m6); if (a.down) C.penDown(s6, ...a.down); else if (a.move) C.penMove(s6, ...a.move); C.step(s6, 1 / 60); }
  assert.ok(s6.cur.len > 100 && s6.cov === 0 && s6.shadowLen === 0, '火が来るまで影はない');
  // 二筆の面: 一筆めのあと待つと、そのまま決まる
  const t = C.LEVELS.find((l) => l.id === 'torii');
  const once = (st, mem) => (st.phase === 'aim2' ? null : C.bot(st, mem));
  const r7 = drive(t, 1280, 720, {}, once); assert.equal(r7.st.reason, 'short', '鳥居は一筆では足りない'); assert.ok(r7.log.some((e) => e.type === 'more'));
  // 影が左右さかさまの面: 筆を右へ動かすと、影は左へ
  const n = C.LEVELS.find((l) => l.mirror), s8 = C.newStage(n, 1280, 720), a8 = Z.shadowOf(s8, s8.L.x + 100, s8.L.y), b8 = Z.shadowOf(s8, s8.L.x + 110, s8.L.y);
  assert.ok(b8.x < a8.x, 'さかさまの影');
  // 行灯がゆれる面: 同じ筆の所でも、影の大きさが変わる
  const f = C.LEVELS.find((l) => l.kAmp && !l.reveal), s9 = C.newStage(f, 1280, 720);
  assert.ok(Math.abs(Z.kAt(s9, 0) - Z.kAt(s9, f.kPer / 4)) > 0.2, 'ゆれる行灯');
  // またたく行灯
  const c = C.LEVELS.find((l) => l.flicker), s10 = C.newStage(c, 1280, 720); let off = 0; for (let i = 0; i < 120; i++) if (!Z.lampOn(s10, i / 60)) off++; assert.ok(off > 20 && off < 60, 'またたく');
  console.log('ok   追いつかれる・手元の外・足りない・押し間違い・はみ出し・燃えた所だけ影・二筆・さかさま・ゆれる・またたく');
}

// 星: 3 つ取れる面がある・はみ出しが多いと 3 つにならない
{
  let three = 0; for (const lv of C.LEVELS) if (C.starsFor(drive(lv, 1280, 720).st) === 3) three++;
  assert.ok(three >= 6, '運転手の星 3 つが少ない ' + three);
}
// 決定的
{ const a = drive(C.LEVELS[7], 1280, 720).st, b = drive(C.LEVELS[7], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.cov, b.cov); assert.equal(a.stray, b.stray); assert.equal(a.minGap, b.minGap); }
// 章の型
for (const k of ['CHAPTER', 'LEVELS', 'FAIL', 'newStage', 'penDown', 'penMove', 'penUp', 'step', 'starsFor', 'info', 'labels', 'draw', 'particles', 'onEvent', 'bot', 'retry']) assert.ok(C[k], k);
for (const r of ['caught', 'short', 'stray']) assert.ok(C.FAIL[r], 'FAIL.' + r);
{ const st = C.newStage(C.LEVELS[0], 1280, 720); assert.equal(typeof C.info(st), 'string'); assert.ok(C.labels(st).some((l) => l.cls === 'big' && l.text === '狐')); }
console.log('hanabi_ch_kage_test: ALL PASS');
