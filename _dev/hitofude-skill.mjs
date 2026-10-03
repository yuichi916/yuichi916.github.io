// 一筆花火の腕前ごとの通過率と、お守りの値打ちを測る（目標点の倍率 TARGET_RATIO と、お守りの数字はこれで決めた）。
// 使い方:
//   node _dev/hitofude-skill.mjs tiers [N=24] [評価回数=150] [段位=0] [starter|all]  … 夜ごとの通過率（落書き / 近い順 / lg3 / 山登り）・山登り ÷ 素朴な線・
//                                                                                   Spearman(ひらいた数, 点)・lg3 が 82% 越える倍率（TARGET_RATIO の目安）
//   node _dev/hitofude-skill.mjs charms [N=24] [評価回数=100] [starter|all|legend]   … お守りを 1 つ（か Lv を 1 つ）足したときの点の伸び・
//                                                                                   「持ち物によらず選ぶもの」が候補に入る割合
//   node _dev/hitofude-skill.mjs casual [N=400] [k=1]                            … 気軽な人（夜ごとに近い順の線を 1 本だけ。k=1 はいちばん近い玉、k=3 は近い 3 つのどれか）の
//                                                                                   一夜目〜三夜目の通過率（予備の提灯で 1 度ひき直したときも）。一夜目は 8 割 5 分以上にする
//   tiers は OFF=盤面の番号のずらし（いくつかに分けて同時に回す）、ONLY=8（その夜だけ測る）、DUMP=ファイル（夜ごとの点 ÷ 基準を書き出す。倍率を変えたときの通過率を回し直さずに出せる）
// 腕前（ボット）:
//   scrib  落書き。玉を見ずに、ゆるく曲がる線を墨が切れるまで（二筆目も落書き）
//   greedy ばらばらの玉から、近い 3 つのどれかへ順につなぐ（墨が切れるまで）
//   lg3    画面の言葉に従う人。提灯から近い順につなぐ線を 3 本ためして、いちばん良いもの。
//          まっすぐの夜は玉の並ぶ向きをねらい、尺玉の夜は尺玉へ行ける墨を残して尺玉で終える
//   opt    山登り（近い順の線を種に、点の入れかえ・反転・切りつめなどで評価回数ぶん探す）
//   naive  提灯から・ばらばらの所からを交互に 12 本ためした、いちばん良いもの（山登りと比べる相手）
// お守りは、値打ちの大きい順（_dev/hitofude-balance.mjs の choosePick）で、5 つの枠（段位 8 は 4）に集める。同じものは Lv 上げ。
// 散っても先の夜へ進む（夜ごとの通過率を見るため）
import { writeFileSync } from 'node:fs';
import * as K from '../assets/hitofude/core.js';
import { POOLS, choosePick, applyPick } from './hitofude-balance.mjs';

export function greedyFrom(st, start, rng, k = 3, ink = st.ink, shells = st.shells) {
  let cur = start; const pts = [{ x: cur.x, y: cur.y }]; const seen = new Set([cur.id]); let used = 0;
  for (;;) {
    const cand = shells.filter((s) => !seen.has(s.id) && !K.crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, k);
    if (!cand.length) break;
    const pick = cand[Math.floor(rng() * cand.length)];
    if (used + pick.d > ink) {
      // 人は墨が切れるまで引く: 残りの墨だけ、その玉の方へ伸ばす
      const f = (ink - used) / pick.d;
      if (f > 0.2) pts.push({ x: cur.x + (pick.s.x - cur.x) * f, y: cur.y + (pick.s.y - cur.y) * f });
      break;
    }
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}
export function scribble(rng, ink) {
  const F = K.FIELD;
  let x = F.x0 + rng() * (F.x1 - F.x0), y = F.y0 + rng() * (F.y1 - F.y0), a = rng() * Math.PI * 2;
  const pts = [{ x, y }]; let used = 0;
  while (used < ink) {
    a += (rng() - 0.5) * 1.2;
    let nx = x + Math.cos(a) * 8, ny = y + Math.sin(a) * 8;
    if (nx < F.x0 || nx > F.x1) { a = Math.PI - a; nx = x + Math.cos(a) * 8; }
    if (ny < F.y0 || ny > F.y1) { a = -a; ny = y + Math.sin(a) * 8; }
    x = nx; y = ny; pts.push({ x, y }); used += 8;
  }
  return pts;
}
function aimStraight(st, a) {
  let best = null;
  for (const b of st.shells) {
    if (b === a) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y), f = Math.min(1, st.ink / d), dx = (b.x - a.x) * f, dy = (b.y - a.y) * f, l2 = dx * dx + dy * dy;
    let n = 0;
    for (const s of st.shells) {
      const u = l2 ? Math.max(0, Math.min(1, ((s.x - a.x) * dx + (s.y - a.y) * dy) / l2)) : 0;
      if (Math.hypot(a.x + dx * u - s.x, a.y + dy * u - s.y) <= K.SHELLS[s.type].r + st.rules.reach) n++;
    }
    if (!best || n > best.n) best = { n, pts: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] };
  }
  return best.pts;
}
function toriLine(st, rng, start) {
  const sh = st.shells.find((s) => s.type === 'shaku');
  let cur = start; const pts = [{ x: cur.x, y: cur.y }], seen = new Set([cur.id, sh.id]); let used = 0;
  for (;;) {
    const cand = st.shells.filter((s) => !seen.has(s.id) && !K.crossesCloud(st.clouds, cur.x, cur.y, s.x, s.y)).map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(rng() * cand.length)];
    if (used + pick.d + Math.hypot(pick.s.x - sh.x, pick.s.y - sh.y) > st.ink) break;
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  pts.push({ x: sh.x, y: sh.y });
  return pts;
}
function tierLine(tier, st, rng) {
  if (tier === 'scrib') return st.twist === 'massugu' ? [{ x: 40 + rng() * 280, y: 110 + rng() * 380 }, { x: 40 + rng() * 280, y: 110 + rng() * 380 }] : scribble(rng, st.ink);
  const rnd = () => st.shells[Math.floor(rng() * st.shells.length)];
  if (st.twist === 'massugu') { if (tier === 'greedy') { const a = rnd(), b = rnd(); return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]; } return aimStraight(st, rnd()); }
  if (tier === 'greedy') return greedyFrom(st, rnd(), rng, 3, st.ink);
  const lan = st.shells.find((s) => s.type === 'chouchin');
  if (st.shells.some((s) => s.type === 'shaku')) return toriLine(st, rng, lan || rnd());
  return greedyFrom(st, lan || rnd(), rng, 3, st.ink);
}
const mkRound = (ctx) => K.newRound({ seed: ctx.seed, night: ctx.night, charms: ctx.charms, moon: ctx.moon, par: true, bank: ctx.bank || 0, level: ctx.level || 0 });
// 1 本の線を最後まで回す（二筆目は、残った玉の近い順の線。落書きの人は二筆目も落書き）
function evalLine(ctx, pts, tier = '') {
  const st = mkRound(ctx);
  if (!K.lightStroke(st, pts)) return { score: 0, pops: 0, pts };
  for (let n = 0; n < 3600 && !st.done; n++) {
    if (st.phase === 'draw2') {
      const left = st.shells.filter((s) => !s.burst);
      const s2 = tier === 'scrib' ? scribble(K.rng32(7 + n), st.ink) : left.length ? greedyFrom(st, left[0], K.rng32(7), 1, st.ink, left) : [];
      if (!(s2.length >= 2 && K.lightStroke(st, s2))) K.finish(st);
    }
    K.step(st); st.events.length = 0;
  }
  if (!st.done) K.finish(st);
  return { score: st.result.score, pops: st.result.pops, allClear: st.result.allClear, tori: st.result.tori, pts };
}
function optimize(ctx, rng, budget) {
  const st = mkRound(ctx), pool = [];
  let best = null;
  const consider = (pts) => { if (!pts || pts.length < 2) return null; const r = evalLine(ctx, pts); pool.push(r); if (!best || r.score > best.score) best = r; return r; };
  if (st.twist === 'massugu') {
    const sh = st.shells;
    for (let i = 0; i < Math.floor(budget * 0.6); i++) { const a = sh[Math.floor(rng() * sh.length)], b = sh[Math.floor(rng() * sh.length)]; if (a !== b) consider([{ x: a.x, y: a.y }, { x: b.x, y: b.y }]); }
    while (pool.length < budget) {
      const np = best.pts.map((p) => ({ ...p })), j = Math.floor(rng() * 2);
      np[j] = { x: Math.max(0, Math.min(359, Math.round(np[j].x + (rng() - 0.5) * 60))), y: Math.max(0, Math.min(639, Math.round(np[j].y + (rng() - 0.5) * 60))) };
      consider(np);
    }
    return { best, pool };
  }
  const starts = st.shells.slice();
  for (let i = starts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [starts[i], starts[j]] = [starts[j], starts[i]]; }
  const special = st.shells.filter((s) => s.type === 'chouchin' || s.type === 'shaku');
  const ordered = [...special, ...starts.filter((s) => !special.includes(s))];
  for (const s of ordered.slice(0, Math.min(30, Math.floor(budget * 0.3)))) consider(greedyFrom(st, s, rng, 1, st.ink));
  for (let i = 0; i < Math.floor(budget * 0.15); i++) consider(greedyFrom(st, ordered[Math.floor(rng() * Math.min(ordered.length, 8))], rng, 3, st.ink));
  let cur = pool.slice().sort((a, b) => b.score - a.score).slice(0, 3);
  while (pool.length < budget) {
    const p = cur[Math.floor(rng() * cur.length)].pts.map((q) => ({ x: q.x, y: q.y }));
    const m = Math.floor(rng() * 7), sh = st.shells[Math.floor(rng() * st.shells.length)], i = Math.floor(rng() * p.length);
    if (m === 6) { if (p.length > 4) p.length = Math.max(3, Math.floor(p.length * (0.4 + 0.5 * rng()))); } // 切りつめ（残り墨・鼓動のため）
    else if (m === 0) p[i] = { x: sh.x, y: sh.y };
    else if (m === 1) p.splice(i, 0, { x: sh.x, y: sh.y });
    else if (m === 2 && p.length > 3) p.splice(i, 1);
    else if (m === 3) p.reverse();
    else if (m === 4) p[i] = { x: Math.max(0, Math.min(359, Math.round(p[i].x + (rng() - 0.5) * 50))), y: Math.max(0, Math.min(639, Math.round(p[i].y + (rng() - 0.5) * 50))) };
    else { const j = Math.floor(rng() * p.length), a = Math.min(i, j), b = Math.max(i, j), seg = p.slice(a, b + 1).reverse(); p.splice(a, seg.length, ...seg); }
    const r = consider(p);
    if (r && r.score > Math.min(...cur.map((c) => c.score))) { cur.push(r); cur.sort((a, b) => b.score - a.score); cur = cur.slice(0, 3); }
  }
  return { best, pool };
}
const q = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
const pct = (x) => `${Math.round(x * 100)}%`;
function spearman(a, b) {
  const rank = (arr) => { const idx = arr.map((v, j) => [v + 1e-9 * j, j]).sort((x, y) => x[0] - y[0]); const r = []; idx.forEach(([, j], k) => (r[j] = k)); return r; };
  const ra = rank(a), rb = rank(b), m = (a.length - 1) / 2; let num = 0, da = 0, db = 0;
  for (let j = 0; j < a.length; j++) { num += (ra[j] - m) * (rb[j] - m); da += (ra[j] - m) ** 2; db += (rb[j] - m) ** 2; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// 目標点をのぞいた「その夜の基準」: 基準点 × 大一番の割り引き × 段位の倍率（TARGET_RATIO をかけると目標点）
const unit = (seed, night, moon, level) => { const tw = K.twistFor(seed, night); return K.parScore(seed, night, moon, level) * (tw ? tw.target : 1) * K.levelFx(level).target; };
function tiers(N, budget, level, poolName) {
  const rows = [], pool = POOLS[poolName], fx = K.levelFx(level);
  const off = +(process.env.OFF || 0); // 盤面の番号のずらし（いくつかに分けて同時に回すとき）
  const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null; // ONLY=8 なら八夜目だけ測る（お守りは同じように集める）
  for (let i = off; i < off + N; i++) {
    const seed = K.hashStr('rev' + i), moon = i % 8, rng = K.rng32(1000 + i);
    let charms = [];
    for (let night = 0; night < K.NIGHTS; night++) {
      if (only && !only.includes(night + 1)) { for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) charms = applyPick(charms, choosePick('priority', K.offerCharms(seed, night, charms, round, { pool, level }), charms, { slots: fx.slots, rng, night })); continue; }
      const ctx = { seed, night, charms: charms.slice(), moon, level }, st = mkRound(ctx), target = K.targetFor(seed, night, moon, level);
      const many = (tier, k) => Array.from({ length: k }, () => evalLine(ctx, tierLine(tier, st, rng), tier).score);
      const row = { night, twist: st.twist, target, u: unit(seed, night, moon, level), scrib: many('scrib', 5), greedy: many('greedy', 5), lg3: [0, 1, 2].map(() => Math.max(...many('lg', 3))) };
      const lan = st.shells.find((s) => s.type === 'chouchin');
      row.naive = Math.max(...Array.from({ length: 12 }, (_, k) => evalLine(ctx, st.twist === 'massugu' ? tierLine('lg', st, rng) : greedyFrom(st, k % 2 === 0 && lan ? lan : st.shells[Math.floor(rng() * st.shells.length)], rng, 3, st.ink)).score));
      const o = optimize(ctx, rng, budget);
      row.opt = o.best.score; row.sp = spearman(o.pool.map((p) => p.score), o.pool.map((p) => p.pops));
      rows.push(row);
      for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) {
        const offer = K.offerCharms(seed, night, charms, round, { pool, level });
        charms = applyPick(charms, choosePick('priority', offer, charms, { slots: fx.slots, rng, night }));
      }
    }
  }
  // DUMP=ファイル名: 夜ごとの点 ÷ 基準（倍率を変えたときの通過率を、回し直さずに出すため）
  if (process.env.DUMP) writeFileSync(process.env.DUMP, JSON.stringify(rows.map((x) => ({ night: x.night, u: x.u, scrib: x.scrib, greedy: x.greedy, lg3: x.lg3, opt: x.opt, naive: x.naive, sp: x.sp }))));
  const pass = (r, k) => { let a = 0, t = 0; for (const x of r) for (const s of [].concat(x[k])) { t++; if (s >= x.target) a++; } return a / t; };
  console.log(`N=${N} 評価=${budget} 段位${level} pool=${poolName}\n夜 | 落書き | 近い順 | lg3 | 山登り | 山登り ÷ 素朴な線（中央値） | Spearman(ひらいた数, 点) | 倍率の目安: lg3 が 82% / 落書き 20% / 山登り 98% 越える倍率（今 ${K.TARGET_RATIO.join(', ')}）`);
  for (let n = 0; n < K.NIGHTS; n++) {
    const r = rows.filter((x) => x.night === n);
    if (!r.length) continue;
    const rat = (k) => r.flatMap((x) => [].concat(x[k]).map((s) => s / x.u));
    console.log(`${n + 1} | ${pct(pass(r, 'scrib'))} | ${pct(pass(r, 'greedy'))} | ${pct(pass(r, 'lg3'))} | ${pct(pass(r, 'opt'))} | ${q(r.map((x) => x.opt / Math.max(1, x.naive)), 0.5).toFixed(2)} | ${q(r.map((x) => x.sp), 0.5).toFixed(2)} | ${q(rat('lg3'), 0.18).toFixed(2)} / ${q(rat('scrib'), 0.8).toFixed(2)} / ${q(rat('opt'), 0.02).toFixed(2)}`);
  }
}

// お守りを 1 つ（持っていれば Lv を 1 つ）足したときの点の伸び。持ち物は、その夜に出ているお守りから 2〜5 個（Lv はでたらめ）
function charms(N, budget, poolName) {
  const pool = POOLS[poolName], by = {}, byUp = {}, rows = [];
  for (let i = 0; i < N; i++) {
    const seed = K.hashStr('cv' + i), night = 3 + (i % 5), moon = i % 8, r0 = K.rng32(i * 7 + 1);
    const legal = pool.filter((c) => K.charmNeed(c) <= night); // その夜に仕掛けが出ているお守りだけ
    const sh = legal.slice();
    for (let j = sh.length - 1; j > 0; j--) { const k = Math.floor(r0() * (j + 1)); [sh[j], sh[k]] = [sh[k], sh[j]]; }
    const base = [];
    for (const id of sh.slice(0, 2 + Math.floor(r0() * 4))) { const l = r0() < 0.6 ? 1 : r0() < 0.7 ? 2 : 3; for (let k = 0; k < l; k++) base.push(id); }
    const ev = (ch) => optimize({ seed, night, charms: ch, moon }, K.rng32(555 + i), budget).best.score;
    const b = Math.max(1, ev(base)), gains = {}, lv = K.charmLevels(base);
    for (const c of legal) {
      if ((lv[c] || 0) >= K.MAX_LV) continue;
      gains[c] = ev([...base, c]) / b;
      ((lv[c] ? byUp : by)[c] ||= []).push(gains[c]);
    }
    rows.push(gains);
  }
  console.log(`N=${N} 評価=${budget} pool=${poolName}\nお守り | 新しく取る: 中央値 p25 p75 p90（n） | Lv を上げる: 中央値 p25 p75（n）`);
  const fmtq = (a, ps) => (a && a.length ? ps.map((p) => q(a, p).toFixed(2)).join(' ') + ` (${a.length})` : '-');
  for (const c of pool.slice().sort((x, y) => (by[y] ? q(by[y], 0.5) : 0) - (by[x] ? q(by[x], 0.5) : 0))) console.log(`${c.padEnd(13)} ${fmtq(by[c], [0.5, 0.25, 0.75, 0.9])} | ${fmtq(byUp[c], [0.5, 0.25, 0.75])}`);
  // 持ち物によらず選ぶもの: 候補のうち 1 つが、ほかのどれにも、持ち物の 75% 以上で勝つ
  const win = {};
  for (const g of rows) for (const a in g) for (const c in g) if (a !== c) { const w = ((win[a] ||= {})[c] ||= [0, 0]); w[1]++; if (g[a] > g[c] * 1.02) w[0]++; }
  const beats = (a, c) => win[a] && win[a][c] && win[a][c][1] >= 4 && win[a][c][0] / win[a][c][1] >= 0.75;
  let n = 0, auto = 0; const autoBy = {};
  for (let i = 0; i < 2000; i++) {
    const seed = K.hashStr('of' + i), rng = K.rng32(i + 9);
    let held = [];
    for (let night = 0; night < K.NIGHTS - 1; night++) for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) {
      const o = K.offerCharms(seed, night, held, round, { pool }); if (!o.length) continue;
      n++;
      const a = o.find((x) => o.every((y) => y === x || beats(x, y)));
      if (a) { auto++; autoBy[a] = (autoBy[a] || 0) + 1; }
      held = applyPick(held, choosePick('priority', o, held, { rng, night }));
    }
  }
  console.log(`持ち物によらず選ぶものが入っている候補: ${pct(auto / n)}（${Object.entries(autoBy).sort((a, b) => b[1] - a[1]).map(([id, c]) => `${id} ${pct(c / n)}`).join(', ')}）`);
}

// 気軽な人: 夜ごとに 1 本（ばらばらの玉から近い順。まっすぐの夜は玉から玉へ）。お守りははじめの 9 つからでたらめに、段位 0、予備の提灯で 1 度ひき直す
function casual(N, k) {
  const reach = [0, 0, 0], first = [0, 0, 0], pass = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const seed = K.hashStr('casual' + i), moon = i % 8, rng = K.rng32(i * 31 + 7);
    let charms = [], spare = K.levelFx(0).spare;
    for (let night = 0; night < 3; night++) {
      const ctx = { seed, night, charms: charms.slice(), moon, level: 0 }, target = K.targetFor(seed, night, moon, 0);
      const one = () => {
        const st = mkRound(ctx), a = st.shells[Math.floor(rng() * st.shells.length)], b = st.shells[Math.floor(rng() * st.shells.length)];
        return evalLine(ctx, st.twist === 'massugu' ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : greedyFrom(st, a, rng, k, st.ink)).score;
      };
      reach[night]++;
      let sc = one();
      if (sc >= target) first[night]++;
      if (sc < target && spare > 0) { spare--; sc = Math.max(sc, one()); }
      if (sc < target) break;
      pass[night]++;
      for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) charms = applyPick(charms, choosePick('random', K.offerCharms(seed, night, charms, round, { pool: POOLS.starter }), charms, { rng, night }));
    }
  }
  console.log(`N=${N} k=${k}: 1 本目で越える 一夜目 ${pct(first[0] / reach[0])} 二夜目 ${pct(first[1] / reach[1])} 三夜目 ${pct(first[2] / reach[2])} | ひき直しも入れて ${pct(pass[0] / reach[0])} ${pct(pass[1] / reach[1])} ${pct(pass[2] / reach[2])}`);
}

if (process.argv[1].endsWith('hitofude-skill.mjs')) {
  const [mode = 'tiers', nArg, bArg, a3, a4] = process.argv.slice(2);
  if (mode === 'charms') charms(+(nArg || 24), +(bArg || 100), a3 || 'all');
  else if (mode === 'casual') casual(+(nArg || 400), +(bArg || 1));
  else tiers(+(nArg || 24), +(bArg || 150), +(a3 || 0), a4 || 'starter');
}
