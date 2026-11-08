// 第7章「灯の家」のテスト: node tests/hanabi_ch_ie_test.mjs
import assert from 'node:assert/strict';
import * as C from '../hanabi/ch/ie.js';
import * as Z from '../hanabi/ch/ie-rules.js';

const SIZES = [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]];
assert.equal(C.LEVELS.length, 8, '8 面ちょうど');

// 札: 画面の中・帯の下・町より上。漂っても札どうしが重ならない。年は 1 つずつ・古い順に並ぶ
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L)); return Math.hypot(p.x - a.x - dx * u, p.y - a.y - dy * u); };
for (const lv of C.LEVELS) {
  const ages = lv.cards.map((c) => c[2]).filter(Boolean);
  assert.equal(new Set(ages).size, ages.length, lv.id + ' 年が重なる');
  for (const a of ages) assert.ok(Z.MEM[a], lv.id + ' 思い出がない ' + a);
  for (const [w, h] of SIZES) {
    const st = C.newStage(lv, w, h, {}), land = w >= h, yMin = land ? 150 : 230, yMax = land ? h * 0.6 : h * 0.68;
    for (let g = 0; g < 60 * 20; g++) {
      Z.step(st, 1 / 60);
      for (const c of st.cards) {
        assert.ok(c.x > 60 && c.x < w - 60 && c.y > yMin && c.y < yMax, `${lv.id} 札が画面の外 ${w}x${h} (${c.x | 0}, ${c.y | 0})`);
        for (const d of st.cards) if (d.i > c.i) assert.ok(Math.hypot(c.x - d.x, c.y - d.y) > st.r * 2.5, `${lv.id} 札が近い ${w}x${h}`);
      }
    }
    // 漂わない面では、つなぐ順の線がほかの札の上を通らない（通るなら、よけて描く面にする）
    if (!lv.drift && !lv.cards.some((c) => c[3])) {
      const s0 = C.newStage(lv, w, h, {});
      for (let j = 1; j < s0.order.length; j++) {
        const a = s0.cards[s0.order[j - 1]], b = s0.cards[s0.order[j]];
        for (const c of s0.cards) if (!s0.order.slice(0, j + 1).includes(c.i)) assert.ok(segDist(c, a, b) > s0.r * 1.2, `${lv.id} ${a.age}→${b.age} の線が札の上を通る ${w}x${h}`);
      }
    }
  }
}
assert.equal(C.LEVELS[7].cards.find((c) => c[2] === 15) !== undefined, true, '最後の面は十五の夏で終わる');
assert.equal(Math.max(...C.LEVELS[7].cards.map((c) => c[2])), 15);
console.log('ok   札: 画面に収まる・重ならない・年が古い順につながる');

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

for (const [w, h] of [[1280, 720], [720, 1280], [960, 720], [1600, 720], [720, 1560]]) {
  const res = [];
  for (const lv of C.LEVELS) {
    const { st, log } = drive(lv, w, h);
    assert.equal(st.phase, 'done', `${lv.id} ${w}x${h} 運転手が越えられない: ${st.reason} ひび ${st.miss} つないだ ${st.next}`);
    assert.equal(st.miss, 0, `${lv.id} ${w}x${h} 運転手がひびを入れた`);
    assert.ok(log.some((e) => e.type === 'bloom'));
    assert.equal(log.filter((e) => e.type === 'lit').length, st.order.length);
    res.push(`${lv.id} ★${C.starsFor(st)} ${st.age.toFixed(1)}s 余裕${Math.round(st.minGap)}`);
  }
  console.log(`ok   運転手が全 8 面を越える ${w}x${h}:`, res.join(' ・ '));
}

// 失敗の形
{
  // 止まると追いつかれる
  const lv = C.LEVELS[0], s1 = C.newStage(lv, 1280, 720), a = s1.cards[s1.order[0]];
  C.penDown(s1, a.x, a.y); C.penMove(s1, a.x + 40, a.y);
  for (let i = 0; i < 900 && s1.phase === 'draw'; i++) C.step(s1, 1 / 60);
  assert.equal(s1.reason, 'caught', '止まると追いつかれる');
  // 途中で離すと終わり
  const s2 = C.newStage(lv, 1280, 720); C.penDown(s2, a.x, a.y); C.penMove(s2, a.x + 40, a.y); C.penUp(s2); assert.equal(s2.reason, 'lift', '離すと終わり');
  // 押し間違い（何もつながずにすぐ離す）は数えない
  const s3 = C.newStage(lv, 1280, 720); C.penDown(s3, 640, 500); C.penUp(s3); assert.equal(s3.phase, 'aim');
  // 順番を違えると、ひび。許された数を越えると割れる
  const t = C.LEVELS.find((l) => l.id === 'juni'), s4 = C.newStage(t, 1280, 720), O = s4.order;
  const go = (st, c) => C.penMove(st, st.cards[c].x, st.cards[c].y);
  C.penDown(s4, s4.cards[O[0]].x, s4.cards[O[0]].y); assert.equal(s4.cards[O[0]].lit, true, '最初の札に灯');
  go(s4, O[2]); assert.equal(s4.cards[O[2]].cracked, true, '飛ばすとひび'); assert.equal(s4.miss, 1); assert.equal(s4.phase, 'draw');
  go(s4, O[1]); assert.equal(s4.cards[O[1]].lit, true, '正しい札に灯');
  go(s4, O[2]); assert.equal(s4.cards[O[2]].lit, true, 'ひびの入った札にも、順が来れば灯がともる'); assert.equal(s4.miss, 1, '同じ札で二度は数えない');
  go(s4, O[4]); assert.equal(s4.reason, 'crack', 'ひびが多すぎると割れる');
  // 年のない札もひび
  const d = C.LEVELS.find((l) => l.id === 'juichi'), s5 = C.newStage(d, 1280, 720), blank = s5.cards.find((c) => !c.age);
  C.penDown(s5, s5.cards[s5.order[0]].x, s5.cards[s5.order[0]].y); C.penMove(s5, blank.x, blank.y); assert.equal(s5.miss, 1, '年のない札');
  // 年が隠れる面: 近づくまで見えない
  const hd = C.LEVELS.find((l) => l.hidden), s6 = C.newStage(hd, 1280, 720); assert.ok(s6.cards.every((c) => !c.seen));
  const far = s6.cards[s6.order[0]]; C.penDown(s6, far.x, far.y); assert.ok(far.seen && s6.cards.some((c) => !c.seen), '近くの札だけ見える');
  // 漂う札
  const dr = C.LEVELS.find((l) => l.drift), s7 = C.newStage(dr, 1280, 720), x0 = s7.cards[0].x; for (let i = 0; i < 120; i++) C.step(s7, 1 / 60); assert.ok(Math.abs(s7.cards[0].x - x0) > 3, '札が漂う');
  console.log('ok   追いつかれる・離す・押し間違い・ひび・割れる・年のない札・隠れた年・漂う札');
}
// 最後の面: 十五の夏で終わり、火は速い
{
  const lv = C.LEVELS[7], { st, log } = drive(lv, 1280, 720);
  const last = log.filter((e) => e.type === 'lit').pop(); assert.equal(st.cards[last.i].age, 15); assert.ok(last.last);
  assert.ok(lv.v0 > C.LEVELS[6].v0 * 1.3 && lv.ramp > C.LEVELS[6].ramp * 3, '火が速い');
  // ゆっくり引くと追いつかれる（人の 1 秒 240）
  const slow = (s, m) => { const a = C.bot(s, m); if (a && a.move) { const p = s.pen, dx = a.move[0] - p.x, dy = a.move[1] - p.y, dd = Math.hypot(dx, dy); if (dd > 4) { m.p.x = p.x + (dx / dd) * 4; m.p.y = p.y + (dy / dd) * 4; return { move: [m.p.x, m.p.y] }; } } return a; };
  assert.equal(drive(lv, 1280, 720, {}, slow).st.reason, 'caught', '最後の面はゆっくりでは間に合わない');
}
// 星
{
  let three = 0; for (const lv of C.LEVELS) if (C.starsFor(drive(lv, 1280, 720).st) === 3) three++;
  assert.ok(three >= 6, '運転手の星 3 つが少ない ' + three);
}
// 決定的
{ const a = drive(C.LEVELS[6], 1280, 720).st, b = drive(C.LEVELS[6], 1280, 720).st; assert.equal(a.t, b.t); assert.equal(a.minGap, b.minGap); assert.equal(a.len, b.len); }
// 章の型
for (const k of ['CHAPTER', 'LEVELS', 'FAIL', 'newStage', 'penDown', 'penMove', 'penUp', 'step', 'starsFor', 'info', 'labels', 'draw', 'particles', 'onEvent', 'bot', 'retry']) assert.ok(C[k], k);
for (const r of ['caught', 'lift', 'crack']) assert.ok(C.FAIL[r], 'FAIL.' + r);
{ const st = C.newStage(C.LEVELS[0], 1280, 720); assert.equal(typeof C.info(st), 'string'); assert.ok(C.labels(st).some((l) => l.text === '七つの夏')); }
console.log('hanabi_ch_ie_test: ALL PASS');
