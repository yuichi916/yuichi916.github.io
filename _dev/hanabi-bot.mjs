// 一筆花火 2 のボット: 人の腕前を 3 段階でまねて周回し、段ごとの越え率と 1 周の長さを測る。
// node _dev/hanabi-bot.mjs [周回数] [腕前 casual|good|expert]
import * as G from '../hanabi/sim.js';
import * as Run from '../hanabi/run.js';
import { CHARM_BY_ID, CHARMS } from '../hanabi/charms.js';

const SKILL = {
  human: { speed: 640, jitter: 18, greed: 0.5, keepGap: 230, maxPicks: 9, react: 0.4, randomShop: true },
  bloomer: { speed: 560, jitter: 12, greed: 0.8, keepGap: 180, maxPicks: 40, react: 0.3, randomShop: true }, // 満開を狙い続ける人
  casual: { speed: 620, jitter: 16, greed: 0.55, keepGap: 240, maxPicks: 7, react: 0.35 },
  good: { speed: 520, jitter: 9, greed: 0.8, keepGap: 150, maxPicks: 12, react: 0.22 },
  expert: { speed: 430, jitter: 5, greed: 1, keepGap: 90, maxPicks: 18, react: 0.14 },
  tech: { speed: 430, jitter: 5, greed: 1, keepGap: 75, maxPicks: 18, react: 0.14, tsugi: true, dust: true }, // かすり・星屑・継ぎ火を使う人
};

// 玉が 1 つだけの夜は、まわりを回って熱をためてから飛びこむ
const ring = (s, f) => { const p = []; for (let i = 0; i <= 26; i++) { const a = (i / 13) * Math.PI * 2 + 3.14; p.push({ x: Math.max(f.x0, Math.min(f.x1, s.x + Math.cos(a) * 150)), y: Math.max(f.y0, Math.min(f.y1, s.y + Math.sin(a) * 120)) }); } p.push({ x: s.x, y: s.y }, { x: s.x + 90, y: s.y + 60 }, { x: s.x + 200, y: s.y + 40 }); return p; };
// 玉の値打ちを見て、群れをなぞる道を作る
function plan(st, sk, rnd) {
  const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0 && !(s.type === 'koori' && !st.m.iceLine));
  if (!idle.length) return [];
  if (idle.length === 1) return ring(idle[0], st.field);
  const val = (s) => ({ kin: 2.2, chouchin: 1.8, ootama: 1.8, shaku: 3, oni: 1.8 }[s.type] || 1);
  const density = (s) => idle.reduce((a, o) => a + (Math.hypot(o.x - s.x, o.y - s.y) < 150 ? 1 : 0), 0);
  let cur = idle.slice().sort((a, b) => density(b) * val(b) - density(a) * val(a))[Math.floor(rnd() * Math.min(3, idle.length) * (1.2 - sk.greed))] || idle[0];
  const path = [cur]; const rest = new Set(idle); rest.delete(cur);
  let used = 0;
  while (rest.size && path.length < sk.maxPicks) {
    let best = null, bv = -1;
    for (const s of rest) {
      const d = Math.hypot(s.x - cur.x, s.y - cur.y);
      const v = (val(s) * (0.6 + density(s) * 0.1)) / (40 + d);
      if (v > bv) { bv = v; best = s; }
    }
    const d = Math.hypot(best.x - cur.x, best.y - cur.y);
    if (used + d > st.ink * 0.92) break;
    used += d; path.push(best); rest.delete(best); cur = best;
  }
  return path.map((s) => ({ x: s.x, y: s.y }));
}

function playNight(st, sk, rnd) {
  let ticks = 0, drawn = 0;
  while (st.phase !== 'over' && ticks < 60 * 300) {
    ticks++;
    if (st.phase === 'aim' && st.shells.some((x) => x.rise > 0)) { /* 上がりきるのを見てから引く */ }
    else if (sk.tsugi && G.tsugiOpen(st) && st.t > st.tsugi.until - st.tsugi.win + 0.35) { // 継ぎ火: 輪の中から次を始める
      const at = { x: st.tsugi.x, y: st.tsugi.y };
      if (G.penDown(st, at.x, at.y)) { const path = plan(st, sk, rnd); if (!path.length) path.push({ x: at.x + 200, y: at.y }); st._path = path; st._pen = { ...at }; }
    } else if (st.phase === 'aim') {
      const path = plan(st, sk, rnd);
      const start = path.shift() || { x: st.field.x0 + rnd() * 400, y: st.field.y0 + rnd() * 200 };
      if (!path.length) path.push({ x: start.x + 200, y: start.y });
      G.penDown(st, start.x + (rnd() - 0.5) * sk.jitter, start.y + (rnd() - 0.5) * sk.jitter);
      st._path = path; st._pen = { ...start };
      ticks += 60 * (0.5 + rnd()); // 考える時間
    } else if (st.phase === 'stroke' && st.stroke && st.stroke.penDown) {
      const k = st.stroke;
      // 星屑: 筆先の近くに新しい星屑があれば、寄り道して拾う
      if (sk.dust && st.dust.length && !st._detour) { const p = st._pen; let best = null, bd = 150; for (const d of st.dust) { const dd = Math.hypot(d.x - p.x, d.y - p.y); if (dd < bd && d.t < 1.5) { bd = dd; best = d; } } if (best) { st._detour = 1; st._path.unshift({ x: best.x, y: best.y, detour: true }); } }
      if (st._path[0] && !st._path[0].detour) st._detour = 0;
      const tgt = st._path[0];
      if (!tgt) { G.penUp(st); }
      else {
        const gap = k.len - k.flameS;
        // 人は火の速さの変化に遅れて気づく
        st._seenV = (st._seenV ?? k.v) + (k.v - (st._seenV ?? k.v)) * Math.min(1, G.DT / sk.react);
        const seen = st._seenV;
        // 火を keepGap まで引きつけて、近づきすぎたら速める
        const speed = !k.flameOn ? sk.speed * 0.6 : gap < sk.keepGap * 0.6 ? sk.speed * 1.5 : gap < sk.keepGap ? Math.max(seen * 1.02, sk.speed * 0.7) : Math.max(seen * 0.8, sk.speed * 0.4);
        const dx = tgt.x - st._pen.x, dy = tgt.y - st._pen.y, d = Math.hypot(dx, dy);
        const stepLen = k.held ? 0 : speed * G.DT;
        if (d <= stepLen + 2) { st._pen = { ...tgt }; st._path.shift(); }
        else { st._pen.x += (dx / d) * stepLen; st._pen.y += (dy / d) * stepLen; }
        G.penMove(st, st._pen.x + (rnd() - 0.5) * sk.jitter * 0.2, st._pen.y + (rnd() - 0.5) * sk.jitter * 0.2);
      }
    }
    G.step(st, G.DT);
    st.events.length = 0;
  }
  return ticks / 60;
}

// 屋台: 買ったつもりで次の夜を試しに遊び、いちばん点が伸びるものを買う（人が「育てる」のに近い）
function trial(run, sk, seed) {
  const n = run.night < Run.NIGHTS_PER_WORLD ? [run.world, run.night + 1] : run.world < Run.WORLDS.length ? [run.world + 1, 1] : [run.world, run.night];
  const def = Run.nightDef(run, n[0], n[1]);
  const st = G.newNight({ ...def, target: 1e12 }, 1280, 720, Run.loadoutFor(run));
  playNight(st, sk, G.rng32(seed));
  return st.score;
}
function shop(run, rnd, sk) {
  if (sk.randomShop) { // 人はボットほど上手に買わない: 買えるものを適当に買う
    for (const it of Run.shopFor(run)) {
      if (it.cost > run.coins || (it.kind === 'charm' && run.charms.length >= run.slots) || rnd() < 0.35) continue;
      run.coins -= it.cost; Run.applyItem(run, it);
    }
    return;
  }
  for (let round = 0; round < 3; round++) {
    let items = Run.shopFor(run);
    for (let loop = 0; loop < 5; loop++) {
      const seeds = [11, 23];
      const base = seeds.reduce((a, x) => a + trial(run, sk, x), 0);
      let best = null, bv = 1.02 * base;
      for (const it of items) {
        if (it.bought || it.cost > run.coins || (it.kind === 'charm' && run.charms.length >= run.slots)) continue;
        const r2 = structuredClone(run); Run.applyItem(r2, it);
        const v = seeds.reduce((a, x) => a + trial(r2, sk, x), 0);
        if (v > bv) { bv = v; best = it; }
      }
      if (!best) break;
      run.coins -= best.cost; best.bought = true;
      Run.applyItem(run, best);
      if (best.kind === 'charm') { run.picked = run.picked || {}; run.picked[best.id] = bv / Math.max(1, base); }
    }
    const rc = Run.rerollCost(run);
    if (run.coins >= rc + 5 && run.charms.length < run.slots) { run.coins -= rc; run.rerolls++; run.shopRound++; } else break;
  }
}

function playRun(seed, sk, rank = 0, fuse = 'asa') {
  const rnd = G.rng32(seed * 77 + 5);
  const run = Run.newRun({ seed, rank, fuse });
  const log = []; let dscore = 0, seconds = 0, stars = 0, retries = 0, blooms = 0, score = 0, graze = 0, dust = 0, tsugi = 0;
  while (!run.done) {
    const def = Run.nightDef(run, run.world, run.night);
    if (process.env.MEASURE) { const m = G.newNight({ ...def, target: 1e15 }, 1280, 720, Run.loadoutFor(run)); playNight(m, sk, G.rng32(seed * 13 + run.night)); (globalThis.FULL ||= []).push({ i: (def.world - 1) * 8 + def.night, s: m.score, t: def.target }); }
    const st = G.newNight(def, 1280, 720, Run.loadoutFor(run));
    seconds += playNight(st, sk, rnd) + 3; // 集計
    (globalThis.NIGHTS ||= []).push({ i: (def.world - 1) * 8 + def.night, r: st.score / def.target, used: st.strokesUsed, first: st._first ?? 0 });
    score += st.score; dscore = (dscore || 0) + (st.dustScore || 0); graze += st.graze; dust += st.dustGot; tsugi += st.tsugiCount || 0;
    const res = Run.afterNight(run, st);
    if (res === 'retry') { retries++; continue; }
    if (res === 'over') { log.push({ w: run.world, n: run.night, score: st.score, target: st.target, rule: def.rule }); break; }
    const s = G.starsFor(st); stars += s;
    blooms += st.blooms;
    const rw = Run.rewardFor(st, s, def.boss);
    run.coins += rw.base + rw.left + rw.star + rw.earned + rw.twist + Run.interestFor(run.coins);
    run.nightsCleared++;
    seconds += 12; // 屋台
    shop(run, rnd, sk);
    const ch = Run.routeChoices(run); if (ch.length) Run.chooseRoute(run, ch[Math.floor(rnd() * ch.length)]);
    Run.advance(run);
  }
  return { pouch: run.pouch.length, coinsLeft: run.coins, score, dscore, graze, dust, tsugi, pv: run.pv, retries, blooms, cleared: run.nightsCleared, won: run.won, seconds, stars, end: log[0], charms: run.charms, coins: run.coins, picked: run.picked || {} };
}

const N = +(process.argv[2] || 60), skillName = process.argv[3] || 'all';
for (const name of (skillName === 'all' ? Object.keys(SKILL) : [skillName])) {
  const sk = SKILL[name];
  const res = []; for (let i = 0; i < N; i++) res.push(playRun(1000 + i * 37, sk, +(process.argv[4]||0), process.argv[5]||"asa"));
  const reach = Array.from({ length: 25 }, (_, n) => res.filter((r) => r.cleared >= n).length / N);
  const avg = (f) => res.reduce((a, r) => a + f(r), 0) / N;
  console.log(`== ${name}: 完走 ${(avg((r) => (r.won ? 1 : 0)) * 100).toFixed(0)}%  平均 ${avg((r) => r.cleared).toFixed(1)} 夜  1 周 ${(avg((r) => r.seconds) / 60).toFixed(1)} 分  星 ${avg((r) => r.stars).toFixed(1)}  やり直し ${avg((r) => r.retries).toFixed(1)}  満開 ${avg((r) => r.blooms).toFixed(1)}`);
  console.log(`  腕: 点の合計 ${Math.round(avg((r) => r.score)).toLocaleString()}（星屑 ${(100 * avg((r) => r.dscore) / avg((r) => r.score)).toFixed(0)}%）  かすり ${avg((r) => r.graze ?? 0).toFixed(0)}  星屑 ${avg((r) => r.dust ?? 0).toFixed(0)}  継ぎ火 ${avg((r) => r.tsugi ?? 0).toFixed(1)}  星の値 ${avg((r) => r.pv ?? 0).toFixed(1)}`);
  console.log(`  袋 ${avg((r) => r.pouch).toFixed(1)} 個  残り小判 ${avg((r) => r.coinsLeft).toFixed(0)}`);
  console.log('  到達率(夜0..24):', reach.filter((_, i) => i % 2 === 0).map((v) => (v * 100).toFixed(0)).join(' '));
  const ends = {}; for (const r of res) if (r.end) { const k = `${r.end.w}-${r.end.n}`; ends[k] = (ends[k] || 0) + 1; }
  { const br = {}; for (const r of res) if (r.end?.rule) br[r.end.rule] = (br[r.end.rule] || 0) + 1; console.log('  散った大一番:', JSON.stringify(br)); }
  console.log('  散った夜:', Object.entries(ends).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '));
  const cnt = {}; for (const r of res) for (const id of r.charms) cnt[id] = (cnt[id] || 0) + 1;
  console.log('  よく持つ:', Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' '));
  const ex = res.find((r) => r.end) || res[0];
  if (ex.end) console.log('  例:', ex.end, ex.charms.join(','));
}
if (process.env.NIGHTS) { const by = {}; for (const x of globalThis.NIGHTS) (by[x.i] ||= []).push(x); const med = (a) => { const b = a.slice().sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
  console.log('夜  点/目標の中央値  25%  75%  使った筆'); for (const [i, a] of Object.entries(by)) { const r = a.map((x) => x.r).sort((p, q) => p - q); console.log(i.padStart(2), med(r).toFixed(2).padStart(6), r[Math.floor(r.length * 0.25)].toFixed(2).padStart(6), r[Math.floor(r.length * 0.75)].toFixed(2).padStart(6), (a.reduce((p, x) => p + x.used, 0) / a.length).toFixed(1).padStart(6)); } }
if (process.env.MEASURE) { const by = {}; for (const x of globalThis.FULL) (by[x.i] ||= []).push(x); console.log('夜  3筆の中央値  目標  比'); for (const [i, a] of Object.entries(by)) { const v = a.map((x) => x.s).sort((p, q) => p - q), m = v[Math.floor(v.length / 2)]; console.log(i.padStart(2), String(Math.round(m)).padStart(9), String(a[0].t).padStart(8), (m / a[0].t).toFixed(2), 'n=' + a.length); } }
console.log('お守り', CHARMS.length, '種');
