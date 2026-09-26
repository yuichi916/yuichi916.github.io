// 一筆花火のバランス測定。8 夜を通しで遊ぶ貪欲なボットで、何夜まで越えられるかの分布を出す。
// 使い方: node _dev/hitofude-balance.mjs <月の番号 0-7> <T: 1 夜あたりに試す線の数（多いほど上手な人）> [priority|random]
import * as K from '../assets/hitofude/core.js';
// 近い玉を順につなぐだけの線。提灯があれば提灯から引きはじめ、雲を横切る線は引かない
function greedyStroke(shells, ink, rng, clouds = []) {
  const alive = shells.filter((s) => !s.burst);
  if (!alive.length) return [];
  const lantern = alive.find((s) => s.type === 'chouchin');
  let cur = lantern || alive[Math.floor(rng() * alive.length)];
  const pts = [{ x: cur.x, y: cur.y }];
  let used = 0; const seen = new Set([cur.id]);
  while (true) {
    const cand = alive.filter((s) => !seen.has(s.id) && !K.crossesCloud(clouds, cur.x, cur.y, s.x, s.y))
      .map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d).slice(0, 3);
    if (!cand.length) break;
    const pick = cand[Math.floor(rng() * cand.length)];
    if (used + pick.d > ink) break;
    used += pick.d; seen.add(pick.s.id); cur = pick.s; pts.push({ x: cur.x, y: cur.y });
  }
  return pts;
}
// まっすぐの夜: 玉から玉へ向かう直線（lightStroke が墨の長さで切る）
function straightStroke(shells, ink, rng) {
  const alive = shells.filter((s) => !s.burst);
  if (alive.length < 2) return [];
  const a = alive[Math.floor(rng() * alive.length)];
  const far = alive.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) > 120);
  const b = (far.length ? far : alive)[Math.floor(rng() * (far.length ? far.length : alive.length))];
  return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
}
export const strokeFor = (st, rng) => (st.twist === 'massugu' ? straightStroke(st.shells, st.ink, rng) : greedyStroke(st.shells, st.ink, rng, st.clouds));
export const PRIORITY = ['kodou', 'mankai', 'chouchinshi', 'kinun', 'nagafude', 'tairin', 'futofude', 'mashidama', 'amayoke', 'kazekiri', 'owaridama', 'nokoribi', 'senrin', 'orebi', 'nihitsu'];
export function playRun(seed, moon, T, rng, pickPolicy = 'priority') {
  const charms = []; let total = 0; let cleared = 0; const scores = [], twists = [];
  for (let night = 0; night < K.NIGHTS; night++) {
    let best = null;
    for (let t = 0; t < T; t++) {
      const st = K.newRound({ seed, night, charms, moon });
      const s1 = strokeFor(st, rng);
      K.lightStroke(st, s1);
      for (let n = 0; n < 3600 && !st.done; n++) {
        if (st.phase === 'draw2') { const s2 = strokeFor(st, rng); if (s2.length >= 2 && K.lightStroke(st, s2)) { /* 二筆目 */ } else K.finish(st); }
        K.step(st); st.events.length = 0;
      }
      if (!best || st.result.score > best.score) best = st.result;
    }
    scores.push(best.score); twists.push(K.twistFor(seed, night) ? K.twistFor(seed, night).id : '');
    total += best.score;
    if (best.score < K.targetFor(seed, night, moon)) break;
    cleared++;
    // 大一番を越えたら、お守りを 2 つ
    for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) {
      const offer = K.offerCharms(seed, night, charms, round);
      if (!offer.length) break;
      const pick = pickPolicy === 'random' ? offer[Math.floor(rng() * offer.length)] : offer.slice().sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0];
      charms.push(pick);
    }
  }
  return { cleared, total, scores, charms, twists };
}
if (process.argv[1].endsWith('hitofude-balance.mjs')) {
  const moon = +(process.argv[2] || 4), T = +(process.argv[3] || 3), policy = process.argv[4] || 'priority';
  const rng = K.rng32(1234);
  const hist = Array(9).fill(0); const perNight = Array(8).fill(null).map(() => []); const byTwist = {};
  const N = +(process.env.N || 80);
  for (let i = 1; i <= N; i++) {
    const r = playRun(K.hashStr('seed' + i), moon, T, rng, policy);
    hist[r.cleared]++;
    r.scores.forEach((s, n) => { perNight[n].push(s); if (r.twists[n]) (byTwist[`${n + 1}:${r.twists[n]}`] ||= []).push(s); });
  }
  console.log(`moon ${K.MOONS[moon].ja} T=${T} ${policy}: nights cleared hist`, hist.map((c, i) => `${i}:${c}`).join(' '));
  const reach = hist.map((_, i) => hist.slice(i).reduce((a, b) => a + b, 0) / N);
  console.log('P(clear >= n):', reach.slice(1).map((p, i) => `${i + 1}:${(p * 100).toFixed(0)}%`).join(' '));
  // その夜までたどり着いた人のうち、その夜を越えた割合（夜ごとの難しさ）
  console.log('P(clear n | reached n):', reach.slice(1).map((p, i) => `${i + 1}:${reach[i] ? (p / reach[i] * 100).toFixed(0) : '-'}%`).join(' '));
  // QUANT=1: 目標点を決めるための分位（その夜にたどり着いた人の点 ÷ 今の基本の目標点）
  if (process.env.QUANT) {
    const qs = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9];
    const row = (a, base) => { const b = a.slice().sort((x, y) => x - y); return qs.map((q) => (b[Math.floor(q * (b.length - 1))] / base).toFixed(2)).join(' '); };
    console.log('quantiles of score/base target: p10 p25 p40 p50 p60 p75 p90');
    perNight.forEach((a, n) => { if (a.length) console.log(`  night ${n + 1} n=${a.length}: ${row(a, K.TARGETS[n])}`); });
    for (const [k, a] of Object.entries(byTwist).sort()) console.log(`  boss ${k} n=${a.length}: ${row(a, K.TARGETS[+k.split(':')[0] - 1])}`);
  }
  perNight.forEach((a, n) => { if (!a.length) return; a.sort((x, y) => x - y); console.log(`  night ${n + 1} (n=${a.length}) base target ${K.TARGETS[n]} p50 ${a[Math.floor(a.length / 2)]} p90 ${a[Math.floor(a.length * 0.9)]}`); });
}
