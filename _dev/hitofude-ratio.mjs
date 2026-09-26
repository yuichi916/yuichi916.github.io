// 目標点の倍率（TARGET_RATIO）を決める。ボットが越えた・散ったに関係なく 8 夜を遊び、夜ごとの「点 ÷ 基準点」の分布を出す。
// 使い方: node _dev/hitofude-ratio.mjs <T: 1 夜に試す線の数> [N=120]
import * as K from '../assets/hitofude/core.js';
import { strokeFor, PRIORITY } from './hitofude-balance.mjs';
const T = +(process.argv[2] || 2), N = +(process.argv[3] || 120);
const rng = K.rng32(4321);
const per = Array.from({ length: K.NIGHTS }, () => []);
for (let i = 1; i <= N; i++) {
  const seed = K.hashStr('ratio' + i), moon = i % 8, charms = [];
  for (let night = 0; night < K.NIGHTS; night++) {
    let best = 0;
    for (let t = 0; t < T; t++) {
      const st = K.newRound({ seed, night, charms, moon });
      K.lightStroke(st, strokeFor(st, rng));
      for (let n = 0; n < 3600 && !st.done; n++) { if (st.phase === 'draw2') { const s2 = strokeFor(st, rng); if (!(s2.length >= 2 && K.lightStroke(st, s2))) K.finish(st); } K.step(st); st.events.length = 0; }
      best = Math.max(best, st.result.score);
    }
    per[night].push(best / Math.max(1, K.parScore(seed, night, moon)));
    for (let round = 0; round < (K.isBoss(night) ? 2 : 1); round++) {
      const offer = K.offerCharms(seed, night, charms, round);
      if (offer.length) charms.push(offer.slice().sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b))[0]);
    }
  }
}
const qs = [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5];
console.log(`T=${T} N=${N}: 点 ÷ 基準点 の分位 ` + qs.map((q) => 'p' + q * 100).join(' '));
per.forEach((a, n) => { a.sort((x, y) => x - y); console.log(`  night ${n + 1}: ` + qs.map((q) => a[Math.floor(q * (a.length - 1))].toFixed(2)).join(' ')); });
