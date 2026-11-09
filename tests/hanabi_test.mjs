// 一筆花火 2 のルールのテスト: node tests/hanabi_test.mjs
import assert from 'node:assert/strict';
import * as G from '../hanabi/sim.js';
import * as Run from '../hanabi/run.js';
import { CHARMS, CHARM_BY_ID } from '../hanabi/charms.js';

// 同じ手で動かす運転手。pen はプログラムで動かす（速さは一定、火を引きつけ気味）
function drive(st, { speed = 430, picks = 12, stopAt = Infinity, seed = 5 } = {}) {
  const rnd = G.rng32(seed);
  let guard = 0;
  while (st.phase !== 'over' && guard++ < 60 * 200) {
    if (st.phase === 'aim') {
      const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0);
      const start = idle.slice().sort((a, b) => a.x - b.x)[0] || { x: 300, y: 300 };
      const path = []; let cur = start; const rest = new Set(idle); rest.delete(start); let used = 0;
      while (rest.size && path.length < picks) {
        let b = null, bd = 1e9; for (const s of rest) { const d = Math.hypot(s.x - cur.x, s.y - cur.y); if (d < bd) { bd = d; b = s; } }
        if (used + bd > st.ink * 0.9) break;
        used += bd; path.push({ x: b.x, y: b.y }); rest.delete(b); cur = b;
      }
      if (!path.length) { const f = st.field; for (let i = 1; i <= 14; i++) { const a = (i / 7) * Math.PI * 2; path.push({ x: Math.max(f.x0, Math.min(f.x1, start.x + Math.cos(a) * 140)), y: Math.max(f.y0, Math.min(f.y1, start.y + Math.sin(a) * 110)) }); } }
      G.penDown(st, start.x, start.y); st._p = path; st._pen = { x: start.x, y: start.y };
    } else if (st.phase === 'stroke' && st.stroke?.penDown) {
      const t = st._p[0];
      if (!t) G.penUp(st);
      else {
        const dx = t.x - st._pen.x, dy = t.y - st._pen.y, d = Math.hypot(dx, dy), v = speed * G.DT;
        if (d <= v) { st._pen = { ...t }; st._p.shift(); } else { st._pen.x += (dx / d) * v; st._pen.y += (dy / d) * v; }
        G.penMove(st, st._pen.x, st._pen.y);
      }
    }
    G.step(st, G.DT);
    if (stopAt !== Infinity && st.strokesUsed >= stopAt) break;
    st._log = st._log || []; for (const e of st.events) st._log.push(e); st.events.length = 0;
  }
  return st;
}
const scene = (extra = {}) => ({ id: 5, world: 1, night: 5, seed: 321, count: 22, mix: { kin: 4, ootama: 3, senrin: 3, chouchin: 3, shime: 3, koori: 3, oni: 3, shaku: 1 }, strokes: 3, refill: 5, target: 1e12, ...extra });
const play = (charms, extra, o) => drive(G.newNight(scene(extra), 1280, 720, { charms: charms.map((id) => CHARM_BY_ID[id]), recipes: {}, coins: 20 }), o);

// ---- 同じ入力なら同じ結果
{ const a = play([]), b = play([]); assert.equal(a.score, b.score); assert.ok(a.score > 0, '基本の点'); console.log('ok   決定的（同じ手で同じ点）', a.score); }

// 特定の場面でしか働かないものは、下で場面を作って確かめる
const SITUATIONAL = new Set(['atsukan', 'renjishi', 'risoku', 'oiri', 'suminagashi', 'mankai', 'yaguruma', 'futofude', 'kogane', 'musubi', 'yukidoke', 'oniibi']);
// ---- 全お守りが、何かを変える（点・小判・筆・出来事のどれか）
{
  const base = play([]);
  const dead = [];
  for (const c of CHARMS) {
    const runs = [{}, { speed: 240 }, { picks: 4 }, { speed: 200, picks: 18 }];
    let changed = false;
    for (const o of runs) {
      const b = play([], undefined, o), s = play([c.id], undefined, o);
      const fired = (s._log || []).some((e) => e.type === 'charmFire');
      if (s.score !== b.score || s.coinsEarned !== b.coinsEarned || s.maxStrokes !== b.maxStrokes || s.shells.length !== b.shells.length || fired || s.ink !== b.ink) { changed = true; break; }
    }
    if (!changed && !c.discount && !c.freeReroll && !SITUATIONAL.has(c.id)) dead.push(c.id);
  }
  assert.deepEqual(dead, [], '効かないお守り: ' + dead.join(','));
  console.log(`ok   お守り ${CHARMS.length} 種すべて、効き目が出る`);
}

// ---- 場面を作って確かめるお守り
{
  const one = (id, extra = {}) => {
    const lvl = { count: 1, mix: {}, strokes: 2, refill: 0, ...extra };
    const a = G.newNight(scene(lvl), 1280, 720, { charms: id ? [CHARM_BY_ID[id]] : [] }), s = a.shells[0];
    G.penDown(a, s.x - 80, s.y); for (let i = 1; i <= 20; i++) G.penMove(a, s.x - 80 + i * 8, s.y); G.penUp(a);
    for (let i = 0; i < 500 && a.phase === 'stroke'; i++) G.step(a, G.DT);
    return a;
  };
  assert.equal(one(null).score, 20); assert.equal(one('mankai').score, 40, '満開の加護 ×4');
  assert.equal(one('oiri').coinsEarned, 10, '大入り +10');
  assert.equal(one('yaguruma').strokesLeft, 2, '矢車は筆がもどる');
  const r = { k: { pops: 20, mult: 2 } }; CHARM_BY_ID.renjishi.on.strokeEnd(r); assert.ok(Math.abs(r.k.mult - 3.2) < 1e-9, '連獅子');
  const r2 = { k: { pops: 19, mult: 2 } }; CHARM_BY_ID.renjishi.on.strokeEnd(r2); assert.equal(r2.k.mult, 2);
  const win = one('risoku', { target: 1, refill: 0 }); for (let i = 0; i < 300 && win.phase !== 'over'; i++) G.step(win, G.DT); assert.equal(win.coinsEarned, 3, '利息 +3');
  const ink = one('suminagashi'); assert.ok(ink.carriedInk > 500, '墨流しは余りを持ちこす');
  // 熱燗: 熱くなってから火を離しても冷めない
  const heat = (id) => { const a = G.newNight(scene({ count: 1, mix: {}, refill: 0 }), 1280, 720, { charms: id ? [CHARM_BY_ID[id]] : [] }); G.penDown(a, 80, 600); a.stroke.heat = 2; for (let i = 1; i <= 200; i++) { G.penMove(a, 80 + i * 14, 600); G.step(a, G.DT); } return a.stroke.heat; };
  assert.ok(heat('atsukan') >= 2, '熱燗は冷めない'); assert.ok(heat(null) < 2, 'ふつうは冷める');
  // 太い筆: 玉の少し外を通る線でも火が移る
  const off = (id) => { const a = G.newNight(scene({ count: 1, mix: {}, refill: 0 }), 1280, 720, { charms: id ? [CHARM_BY_ID[id]] : [] }), s = a.shells[0], y = s.y + s.r + 14; G.penDown(a, s.x - 90, y); for (let i = 1; i <= 22; i++) G.penMove(a, s.x - 90 + i * 8, y); G.penUp(a); for (let i = 0; i < 400 && a.phase === 'stroke'; i++) G.step(a, G.DT); return s.state; };
  assert.equal(off(null), 'idle'); assert.equal(off('futofude'), 'burst', '太い筆');
  // 黄金虫: 線でじかに火をつけた金の玉は点 ×5
  const gold = (id) => { const a = G.newNight(scene({ count: 1, mix: { kin: 1 }, refill: 0, strokes: 1 }), 1280, 720, { charms: id ? [CHARM_BY_ID[id]] : [] }), t = a.shells[0]; G.penDown(a, t.x - 80, t.y); for (let i = 1; i <= 20; i++) G.penMove(a, t.x - 80 + i * 8, t.y); G.penUp(a); for (let i = 0; i < 400 && a.phase === 'stroke'; i++) G.step(a, G.DT); return a.score; };
  assert.ok(gold('kogane') > gold(null), '黄金虫');
  // 結び: 線を交わらせると結び目ができ、火が来ると倍率が増える
  const knot = (id) => {
    const a = G.newNight(scene({ count: 1, mix: {}, refill: 0, strokes: 1 }), 1280, 720, { charms: id ? [CHARM_BY_ID[id]] : [] }), cx = 200, cy = 300;
    const pts = []; for (let i = 0; i <= 40; i++) pts.push([cx - 120 + i * 6, cy]); for (let i = 1; i <= 30; i++) pts.push([cx + 120, cy - i * 5]); for (let i = 1; i <= 24; i++) pts.push([cx + 120 - i * 5, cy - 150]); for (let i = 1; i <= 40; i++) pts.push([cx, cy - 150 + i * 5]);
    G.penDown(a, pts[0][0], pts[0][1]); let hit = 0, i = 1;
    for (let t = 0; t < 900 && a.phase === 'stroke'; t++) {
      if (a.stroke.penDown) { if (i < pts.length) { G.penMove(a, pts[i][0], pts[i][1]); if (!a.stroke.held) i += 1; } else G.penUp(a); }
      G.step(a, G.DT); if (a.events.some((e) => e.type === 'knotBurst')) hit++; a.events.length = 0;
    }
    return hit;
  };
  assert.ok(knot('musubi') >= 1, '結び目が爆ぜる'); assert.equal(knot(null), 0);
  // 鬼火: 最高の熱の倍率が上がる
  { const a = G.newNight(scene(), 1280, 720, { charms: [CHARM_BY_ID.oniibi] }), b = G.newNight(scene(), 1280, 720, {}); assert.equal(G.heatMult(3, a), 5); assert.equal(G.heatMult(3, b), 4); assert.equal(G.heatMult(2, a), 3); }
  console.log('ok   場面つきのお守り');
}

// ---- お守りの id が重複しない・文章がある
{
  assert.equal(new Set(CHARMS.map((c) => c.id)).size, CHARMS.length);
  for (const c of CHARMS) assert.ok(c.ja && c.en && c.dj && c.de && c.cost > 0, c.id);
  assert.ok(CHARMS.length >= 60);
  console.log('ok   お守りの表');
}

// ---- 追いつかれる: 動かない筆は短い線で終わる / 押し間違いは筆を減らさない
{
  const st = G.newNight(scene(), 1280, 720, {});
  G.penDown(st, 300, 300); G.penMove(st, 310, 300);
  for (let i = 0; i < 120; i++) G.step(st, G.DT);
  assert.equal(st.strokesLeft, 3, '短すぎる線は筆を減らさない');
  const s2 = G.newNight(scene(), 1280, 720, {});
  G.penDown(s2, 300, 300); for (let i = 1; i <= 30; i++) G.penMove(s2, 300 + i * 8, 300);
  let caught = false;
  for (let i = 0; i < 400 && s2.phase === 'stroke'; i++) { G.step(s2, G.DT); if (s2.events.some((e) => e.type === 'caught')) caught = true; }
  assert.ok(caught, '止まっていると追いつかれる');
  console.log('ok   追いつかれる・押し間違い');
}

// ---- 熱: 火の近くを走ると点が増える
{
  const far = play([], undefined, { speed: 1400, picks: 8 }), near = play([], undefined, { speed: 290, picks: 8 });
  const hotFar = (far._log || []).filter((e) => e.type === 'heat' && e.up).length, hotNear = (near._log || []).filter((e) => e.type === 'heat' && e.up).length;
  assert.ok(hotNear > hotFar, `火に近いほど熱が上がる ${hotNear} > ${hotFar}`);
  assert.ok(near.score > far.score, `引きつけた方が点が高い ${near.score} > ${far.score}`);
  console.log('ok   熱の得', far.score, '→', near.score);
}

// ---- 火の速さ: 一定ではない / 曲がり角で落ちる / 線は火から離れすぎない
{
  const run = (bends) => {
    const st = G.newNight(scene({ count: 1, mix: {}, refill: 0, strokes: 1 }), 1280, 720, {});
    G.penDown(st, 100, 500); let x = 100, y = 500; const vs = [];
    for (let i = 0; i < 200 && st.stroke?.penDown; i++) {
      const dirUp = bends && Math.floor(i / 20) % 2 === 1;
      if (dirUp) y -= 5; else x += 5;
      G.penMove(st, x, y); G.step(st, G.DT);
      if (st.stroke?.flameOn) vs.push(st.stroke.v);
      if (st.stroke && st.stroke.len - st.stroke.flameS > st.m.leash + 1) assert.fail('線が火から離れすぎ');
    }
    return vs;
  };
  const straight = run(false), bent = run(true);
  assert.ok(straight.at(-1) > straight[0] * 1.15, '直線では火が加速する');
  const av = (a) => a.reduce((p, c) => p + c, 0) / a.length;
  assert.ok(av(bent) < av(straight) * 0.95, `曲がると遅い ${av(bent).toFixed(0)} < ${av(straight).toFixed(0)}`);
  // 突風: 予告が先、そのあと速くなる
  const g = G.newNight(scene({ count: 1, mix: {}, refill: 0, strokes: 1, gusts: true }), 1280, 720, {});
  G.penDown(g, 60, 500); let seq = [];
  for (let i = 0; i < 300 && g.stroke?.penDown; i++) { G.penMove(g, 60 + i * 7, 500); G.step(g, G.DT); for (const e of g.events) if (e.type === 'gustWarn' || e.type === 'gust') seq.push(e.type); g.events.length = 0; }
  assert.equal(seq[0], 'gustWarn', '突風は予告が先'); assert.equal(seq[1], 'gust');
  // 玉がはじけると火が跳ねる
  const j = G.newNight(scene({ count: 1, mix: {}, refill: 0, strokes: 1 }), 1280, 720, {}), t = j.shells[0];
  G.penDown(j, t.x - 60, t.y); let k0 = 0;
  for (let i = 0; i < 120 && j.stroke?.penDown; i++) { G.penMove(j, t.x - 60 + i * 5, t.y); G.step(j, G.DT); k0 = Math.max(k0, j.stroke?.kick || 0); }
  assert.ok(k0 > 0.2, '玉がはじけると火が跳ねる');
  console.log('ok   火の速さ（加速・曲がり角・突風・跳ね・線の上限）');
}

// ---- 氷玉: 線では燃えない / 雪どけで燃える
{
  const lvl = { count: 1, mix: { koori: 1 }, strokes: 1, refill: 0 };
  const a = G.newNight(scene(lvl), 1280, 720, {}), s = a.shells[0];
  G.penDown(a, s.x - 100, s.y); for (let i = 1; i <= 25; i++) G.penMove(a, s.x - 100 + i * 8, s.y); G.penUp(a);
  for (let i = 0; i < 400 && a.phase === 'stroke'; i++) G.step(a, G.DT);
  assert.equal(s.state, 'idle', '氷玉は線で燃えない');
  const b = G.newNight(scene(lvl), 1280, 720, { charms: [CHARM_BY_ID.yukidoke] }), s2 = b.shells[0];
  G.penDown(b, s2.x - 100, s2.y); for (let i = 1; i <= 25; i++) G.penMove(b, s2.x - 100 + i * 8, s2.y); G.penUp(b);
  for (let i = 0; i < 400 && b.phase === 'stroke'; i++) G.step(b, G.DT);
  assert.equal(s2.state, 'burst', '雪どけなら燃える');
  console.log('ok   氷玉');
}

// ---- 満開: 全部ひらくと倍率が掛かる
{
  const lvl = { count: 1, mix: {}, strokes: 2, refill: 0 };
  const a = G.newNight(scene(lvl), 1280, 720, {}), s = a.shells[0];
  G.penDown(a, s.x - 80, s.y); for (let i = 1; i <= 20; i++) G.penMove(a, s.x - 80 + i * 8, s.y); G.penUp(a);
  for (let i = 0; i < 400 && a.phase === 'stroke'; i++) G.step(a, G.DT);
  assert.equal(a.blooms, 1); assert.equal(a.score, 20);
  console.log('ok   満開');
}

// ---- 大一番のルール: 例外が出ず、最後まで遊べる
for (const rule of Object.keys(Run.RULES)) {
  const st = play([], { rule, target: 100 });
  assert.equal(st.phase, 'over', rule);
  if (rule === 'ame') { const cuts = [321, 7, 99, 1234, 55].filter((seed) => (drive(G.newNight(scene({ rule, target: 1e12, seed }), 1280, 720, {}), { speed: 260 })._log || []).some((e) => e.type === 'cut')).length; assert.ok(cuts >= 1, '雪で線が切れる'); }
  console.log('ok   大一番', rule, st.score);
}

// ---- 周回: 24 夜を進める・屋台は持っていない物だけ・お金が足りなくても壊れない
{
  const run = Run.newRun({ seed: 77 });
  let n = 0; const seen = new Set();
  while (!run.done) {
    const def = Run.nightDef(run, run.world, run.night);
    assert.ok(def.target > 0 && def.count > 0);
    if (def.boss) { assert.ok(def.rule && Run.RULES[def.rule], '大一番にルール'); seen.add(def.rule); }
    const shop = Run.shopFor(run);
    for (const it of shop) if (it.kind === 'charm') assert.ok(!run.charms.includes(it.id));
    Run.advance(run); n++;
  }
  assert.equal(n, 24); assert.ok(run.won); assert.equal(seen.size, 6, '妖怪 6 人に会う: ' + [...seen]);
  const t = []; { const r = Run.newRun({ seed: 1 }); for (let w = 1; w <= 3; w++) for (let i = 1; i <= 8; i++) t.push(Run.nightDef(r, w, i).target); }
  for (let i = 1; i < t.length; i++) if (i % 8) assert.ok(t[i] > t[i - 1], '目標はワールド内で増える');
  console.log('ok   周回 24 夜・目標', t[0], '→', t[23]);
}

// ---- 開始の型・段位
{
  for (const f of Run.FUSES) { const r = Run.newRun({ seed: 3, fuse: f.id }); const st = G.newNight(Run.nightDef(r, 1, 1), 1280, 720, Run.loadoutFor(r)); assert.ok(st.ink > 0); for (const id of f.start) assert.ok(CHARM_BY_ID[id], id); }
  for (let rank = 0; rank < Run.RANKS.length; rank++) { const r = Run.newRun({ seed: 3, rank }); assert.ok(Run.nightDef(r, 1, 8).strokes >= 2); }
  const t0 = Run.nightDef(Run.newRun({ seed: 3, rank: 0 }), 2, 3).target, t7 = Run.nightDef(Run.newRun({ seed: 3, rank: 7 }), 2, 3).target;
  assert.ok(t7 > t0);
  console.log('ok   開始の型', Run.FUSES.length, '・段位', Run.RANKS.length);
}

// ---- 縦長の盤でも同じ数の玉が置ける
{
  const a = G.newNight(scene(), 1280, 720, {}), b = G.newNight(scene(), 720, 1280, {});
  assert.ok(Math.abs(a.shells.length - b.shells.length) <= 3, `${a.shells.length} / ${b.shells.length}`);
  for (const s of b.shells) assert.ok(s.x >= 0 && s.x <= 720 && s.y >= 0 && s.y <= 1280);
  console.log('ok   横と縦の盤', a.shells.length, b.shells.length);
}

// ---- 趣向: 全部、最後まで遊べて、それぞれの仕組みが働く
{
  const lvl = (twist, extra = {}) => scene({ twist, count: 20, mix: {}, target: 1e12, ...extra });
  const ev = (st, t) => (st._log || []).filter((e) => e.type === t);
  for (const id of Object.keys(Run.TWISTS)) {
    const st = drive(G.newNight(lvl(id), 1280, 720, {}));
    assert.equal(st.phase, 'over', id); assert.ok(st.strokesUsed >= 1, id);
    const v = drive(G.newNight(lvl(id), 720, 1280, {}));
    assert.equal(v.phase, 'over', id + ' 縦');
    for (const s of st.shells) assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y), id + ' 座標');
  }
  // ねずみ: 走って火を移す / ロケット: 一直線に飛ぶ
  const light = (st, s) => { G.penDown(st, s.x - 70, s.y); for (let i = 1; i <= 22; i++) G.penMove(st, s.x - 70 + i * 8, s.y); G.penUp(st); };
  const until = (st, f, n = 900) => { for (let i = 0; i < n && !f(); i++) { G.step(st, G.DT); st._log = st._log || []; st._log.push(...st.events); st.events.length = 0; } };
  {
    const st = G.newNight(lvl('nezumi'), 1280, 720, {}), s = st.shells.find((x) => x.type === 'nezumi');
    light(st, s); let seen = 0, x0 = null, moved = 0;
    until(st, () => { if (st.runners.length) { seen = 1; if (x0 === null) x0 = st.runners[0].x; moved = Math.max(moved, Math.abs(st.runners[0].x - x0)); } return st.phase !== 'stroke'; });
    assert.ok(seen && moved > 60, 'ねずみが走る');
    const ro = G.newNight(lvl('roket'), 1280, 720, {}), r = ro.shells.find((x) => x.type === 'roket');
    r.dir = 0; light(ro, r); let rr = null; until(ro, () => { if (!rr && ro.runners.length) rr = { ...ro.runners[0] }; return ro.phase !== "stroke"; });
    assert.ok(rr && Math.abs(rr.a) < 1e-9, 'ロケットは矢の向きへ');
  }
  // 親子玉: 玉が増える
  { const st = G.newNight(lvl('oyako', { count: 3 }), 1280, 720, {}), s = st.shells.find((x) => x.type === 'oyako'); const n0 = st.shells.length; light(st, s); until(st, () => st.shells.length > n0); assert.ok(st.shells.length >= n0 + 4, '親子玉は子玉を出す'); assert.ok(st.shells.some((x) => x.type === 'ko' && (x.vx || x.vy)), '子玉は飛び散る'); }
  // 夫婦玉: 片方で、遠くの相手もひらく
  { const st = G.newNight(lvl('meoto'), 1280, 720, {}), a = st.shells.find((x) => x.pair), b = st.shells.find((x) => x.id === a.pair); light(st, a); until(st, () => st.phase !== 'stroke'); assert.equal(b.state, 'burst', '夫婦玉の相手がひらく'); }
  // 数珠玉: 順番どおりだと倍率が上がり、ちがうと上がらない
  { const run = (order) => { const st = G.newNight(lvl('juzu', { count: 8 }), 1280, 720, {}); const js = st.shells.filter((x) => x.type === 'juzu').sort((a, b) => (order ? a.num - b.num : b.num - a.num)).slice(0, 3); js.forEach((j, i) => { j.x = 300 + i * 90; j.y = 300; }); G.penDown(st, js[0].x, js[0].y); const m0 = st.stroke.mult; for (const j of js.slice(1)) { G.penMove(st, j.x, j.y); for (let i = 0; i < 20; i++) G.step(st, G.DT); } return st.stroke.mult - m0; }; assert.equal(run(true), 5, '数珠玉 順番どおり (+2 +3)'); assert.equal(run(false), 0, '数珠玉 順番ちがい'); }
  // 地蔵玉: 火が止まる
  { const st = G.newNight(lvl('tome', { count: 1 }), 1280, 720, {}); const s = st.shells[0]; G.penDown(st, s.x - 60, s.y); let x = s.x - 60, stopped = 0; for (let i = 0; i < 240 && st.stroke?.penDown; i++) { x += 4; if (st.stroke.len - st.stroke.flameS < 300) G.penMove(st, x, s.y); G.step(st, G.DT); if (st.stroke?.stopT > 0) stopped++; } assert.ok(stopped > 30, '地蔵玉で火が止まる ' + stopped); }
  // 逃げ玉: 筆から逃げる / 金魚: 泳ぐ
  { const st = G.newNight(lvl('nige', { count: 2 }), 1280, 720, {}), s = st.shells.find((x) => x.type === 'nige'), far = st.shells.find((x) => x !== s); s.x = 640; s.y = 280; const px = s.x - 150, py = s.y, d0 = 150; G.penDown(st, px, py); for (let i = 0; i < 20; i++) G.step(st, G.DT); assert.ok(Math.hypot(s.x - px, s.y - py) > d0 + 20, '逃げ玉が逃げる'); assert.ok(far); }
  { const st = G.newNight(lvl('kingyo', { count: 8 }), 1280, 720, {}), s = st.shells.find((x) => x.type === 'kingyo'), x0 = s.x, y0 = s.y; for (let i = 0; i < 60; i++) G.step(st, G.DT); assert.ok(Math.hypot(s.x - x0, s.y - y0) > 30, '金魚が泳ぐ'); }
  // 烏: 線の通っていない玉をさらう。線を通した玉はさらわない。筆で追い払える
  { const st = G.newNight(lvl('karasu', { count: 6 }), 1280, 720, {}); const keep = st.shells[0]; G.penDown(st, keep.x, keep.y); let x = keep.x, stolen = 0; for (let i = 0; i < 420 && st.stroke?.penDown; i++) { x += i % 2 ? 2 : -2; G.penMove(st, x, keep.y); st.stroke.flameS = 0; st.stroke.age = Math.min(st.stroke.age, 0.1); G.step(st, G.DT); for (const e of st.events) if (e.type === 'crowTake') stolen++; st.events.length = 0; } assert.ok(stolen >= 1, '烏がさらう ' + stolen); assert.notEqual(keep.state, 'stolen', '線を通した玉は無事'); }
  { const st = G.newNight(lvl('karasu', { count: 6 }), 1280, 720, {}); const s = st.shells[0]; G.penDown(st, s.x, s.y); st.crows.push({ x: s.x + 8, y: s.y, target: null, carry: null, away: false }); st.stroke.age = 0; G.step(st, G.DT); assert.ok(st.events.some((e) => e.type === 'shoo'), '筆で追い払う'); }
  // 風車: 燃えていない線を切る
  { const st = G.newNight(lvl('kaza', { count: 1 }), 1280, 720, {}), b = st.blades[0]; G.penDown(st, b.x - 200, b.y); for (let i = 1; i <= 30; i++) G.penMove(st, b.x - 200 + i * 13, b.y); st.stroke.flameOn = true; st.stroke.age = 1; st.stroke.pts.forEach(() => {}); let cut = false; for (let i = 0; i < 260 && !cut; i++) { st.stroke.flameS = 0; G.step(st, G.DT); cut = st.stroke.cutS < Infinity; } assert.ok(cut, '風車が線を切る'); }
  // 油と水: 火の速さが変わる。油の上の玉は点 ×3
  { const speed = (kind) => { const st = G.newNight(scene({ count: 1, mix: {}, refill: 0 }), 1280, 720, {}); st.zones.push({ x: 300, y: 300, r: 150, kind }); G.penDown(st, 250, 300); for (let i = 1; i <= 8; i++) G.penMove(st, 250 + i * 10, 300); st.stroke.flameOn = true; st.stroke.age = 1; st.stroke.fx = 300; st.stroke.fy = 300; G.step(st, G.DT); return st.stroke.v; }; const n = (() => { const st = G.newNight(scene({ count: 1, mix: {}, refill: 0 }), 1280, 720, {}); G.penDown(st, 250, 300); for (let i = 1; i <= 8; i++) G.penMove(st, 250 + i * 10, 300); st.stroke.flameOn = true; st.stroke.age = 1; G.step(st, G.DT); return st.stroke.v; })(); assert.ok(speed('oil') > n * 1.6, '油で速い'); assert.ok(speed('water') < n * 0.6, '水で遅い'); }
  // 流れ玉: 引いている間だけ降る。落ちきると消える
  { const st = G.newNight(lvl('ryusei', { count: 2 }), 1280, 720, {}); G.penDown(st, 100, 300); let x = 100; for (let i = 0; i < 120; i++) { x += 3; G.penMove(st, x, 300); G.step(st, G.DT); } assert.ok(st.shells.some((s) => s.fall), '玉が降る'); assert.ok(st.ink > st.m.ink * 0.99); }
  // 尺玉一発: 熱 ×3 で突破。ぬるいと足りない
  { const go = (heat) => { const st = G.newNight(lvl('ippatsu'), 1280, 720, {}), s = st.shells[0]; assert.equal(st.shells.length, 1); G.penDown(st, s.x - 90, s.y); st.stroke.heat = heat; for (let i = 1; i <= 26; i++) G.penMove(st, s.x - 90 + i * 8, s.y); for (let i = 0; i < 300 && st.stroke && s.state === 'idle'; i++) { st.stroke.heat = heat; G.step(st, G.DT); } for (let i = 0; i < 90 && s.state !== 'burst'; i++) G.step(st, G.DT); return st.goalMet; }; assert.equal(go(2), true, '熱ければ突破'); assert.equal(go(0), false, 'ぬるいと突破しない'); }
  // 型物: 絵になっていて、満開で突破。つながらないのでなぞるしかない
  { const st = G.newNight(lvl('katamono'), 1280, 720, {}); assert.ok(st.shape && st.shells.length >= 18, '型物の玉'); assert.ok(st.m.blastR < 0.5); for (const s of st.shells) assert.ok(s.x > 0 && s.x < 1280 && s.y > 0 && s.y < 720); for (const [w, h] of [[1280, 720], [720, 1280], [1600, 720], [1136, 640]]) for (const n of Object.keys(G.SHAPES)) { const P = G.shapePoints(n, G.fieldFor(w, h)); assert.ok(P.length >= 12, `${n} ${P.length}`); for (let i = 0; i < P.length; i++) for (let j = 0; j < i; j++) assert.ok(Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y) >= 46, `${n} 玉が重なる ${w}x${h}`); } }
  // 型物は何筆かけてもよい（途中で玉が足されない）
  { const st = G.newNight(lvl('katamono'), 1280, 720, {}), n0 = st.shells.length, s = st.shells[0]; G.penDown(st, s.x, s.y); for (let i = 1; i <= 8; i++) G.penMove(st, s.x + i * 6, s.y); G.penUp(st); for (let i = 0; i < 400 && st.phase !== 'aim'; i++) G.step(st, G.DT); assert.equal(st.phase, 'aim'); assert.ok(st.shells.length < n0, '型物に玉は足されない'); }
  { const st = G.newNight(lvl('katamono'), 720, 1280, {}); for (const s of st.shells) assert.ok(s.x > 0 && s.x < 720 && s.y > 0 && s.y < 1280, '縦の型物'); }
  // 満開: 連続するほど倍率が増え、盤がまるごと入れかわる
  { const one = (streak) => { const a = G.newNight(scene({ count: 1, mix: {}, strokes: 2, refill: 0 }), 1280, 720, { streak }), s = a.shells[0]; light(a, s); for (let i = 0; i < 500 && a.phase === 'stroke'; i++) G.step(a, G.DT); return a; };
    assert.equal(one(0).score, 20, '満開 ×2'); assert.equal(one(1).score, 30, '連続 1 で ×3'); assert.equal(one(3).score, 50, '連続 3 で ×5'); assert.equal(one(99).score, 80, '上限 ×8'); assert.equal(one(2).streak, 3);
    const a = G.newNight(scene({ count: 1, mix: {}, strokes: 3, refill: 0 }), 1280, 720, {}), big = G.newNight(scene({ count: 18, mix: {}, strokes: 3, refill: 0 }), 1280, 720, {});
    big.shells.length = 1; const s = big.shells[0]; light(big, s); for (let i = 0; i < 900 && big.phase !== 'aim'; i++) G.step(big, G.DT);
    assert.equal(big.blooms, 1); assert.ok(big.shells.length >= 14, `満開のあとは盤がまるごと ${big.shells.length}`); assert.ok(a); }
  // 第二幕: 大一番を越えると、失敗のない一筆がもう一度
  { const st = G.newNight(scene({ count: 6, mix: {}, boss: true, rule: 'kaze', target: 1, refill: 3 }), 1280, 720, {}); const seen = []; for (let g = 0; g < 60 * 60 && st.phase !== 'over'; g++) { if (st.phase === 'aim') { const s = st.shells.find((x) => x.state === 'idle' && x.rise <= 0); if (s) light(st, s); } G.step(st, G.DT); for (const e of st.events) seen.push(e.type); st.events.length = 0; } assert.ok(seen.includes('act2'), '第二幕'); assert.equal(st.cleared, true); assert.ok(st.strokesUsed >= 2); }
  // 乱入: 夜の途中で起きる
  { const st = G.newNight(scene({ count: 6, mix: {}, intrude: 'fuku' }), 1280, 720, {}); const n0 = st.shells.length; G.penDown(st, 100, 500); let x = 100; for (let i = 0; i < 180; i++) { x += 4; G.penMove(st, x, 500); G.step(st, G.DT); } assert.ok(st.shells.length > n0 && st.shells.some((s) => s.type === 'kin'), '福の神'); assert.ok(st.intruded); }
  for (const kind of Object.keys(Run.INTRUDES)) { const st = drive(G.newNight(scene({ count: 8, mix: {}, intrude: kind }), 1280, 720, {})); assert.equal(st.phase, 'over', kind); assert.ok(st.intruded, kind); }
  // 周回: 道の分かれ・提灯
  { const run = Run.newRun({ seed: 9 }); assert.equal(run.lives, 3); const c = Run.routeChoices(run); assert.equal(c.length, 2); assert.notEqual(c[0].id, c[1].id); Run.chooseRoute(run, c[0]); Run.advance(run); const d = Run.nightDef(run, 1, 2); assert.equal(d.twist, c[0].id);
    const fake = { cleared: false, blooms: 1, streak: 4 }; assert.equal(Run.afterNight(run, fake), 'retry'); assert.equal(run.lives, 2); assert.equal(run.bloomStreak, 4); assert.notEqual(Run.nightDef(run, 1, 2).seed, d.seed, 'やり直しは盤が変わる'); assert.equal(Run.afterNight(run, { cleared: false, blooms: 0, streak: 0 }), 'retry'); assert.equal(run.bloomStreak, 0, '満開なしで連続が切れる'); assert.equal(Run.afterNight(run, fake), 'over');
    const r2 = Run.newRun({ seed: 5 }), seen = new Set(); while (!r2.done) { const ch = Run.routeChoices(r2); for (const x of ch) assert.ok(Run.TWISTS[x.id], x.id); if (ch.length) { Run.chooseRoute(r2, ch[1]); seen.add(ch[1].id); } Run.advance(r2); } assert.ok(seen.size >= 12, `1 周で趣向 ${seen.size} 種`);
    const old = Run.fixRun({ seed: 1, world: 1, night: 2, charms: [], recipes: {} }); assert.equal(old.lives, 3); assert.ok(Run.nightDef(old, 1, 2)); }
  console.log(`ok   趣向 ${Object.keys(Run.TWISTS).length} 種・満開の連続・第二幕・乱入・道の分かれ・提灯`);
}
console.log('hanabi_test: ALL PASS');
