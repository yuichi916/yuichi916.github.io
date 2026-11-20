// 順位の幅の候補ごとに、ヒントを開くたびに残る県の数（推測なし）を集計する
const path = require('path');
const Core = require('../../assets/kyou-no-ken-core.js');
const L = require('../../assets/kyou-shrink.js');
const data = require('../../data/kyou-no-ken/data.json');
const DAYS = 47 * 20;
const schedules = [[12,9,7,5,4],[13,10,8,6,5],[14,11,8,6,5],[15,12,9,7,5],[16,12,10,8,6]];
for (const s of schedules) {
  L.WIDTH.splice(0, L.WIDTH.length, ...s);
  const sums = Array(7).fill(0), ones = Array(7).fill(0); const hist = [];
  for (let d = 0; d < DAYS; d++) {
    const pz = Core.hintsForDay(d, data);
    for (let k = 0; k <= 6; k++) {
      const n = L.candidates(data, pz, k, []).length;
      sums[k] += n; if (n === 1) ones[k]++;
    }
  }
  console.log(JSON.stringify(s).padEnd(14), 'avg', sums.map(x => (x / DAYS).toFixed(1)).join(' / '), '| 1県だけ%', ones.map(x => Math.round(100 * x / DAYS)).join(' / '));
}
