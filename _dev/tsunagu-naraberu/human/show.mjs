// matrix の json を表にする: node show.mjs matrix_base.json [matrix_new.json]
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map(f => JSON.parse(readFileSync(f, 'utf8')).report);
const LV = ['かんたん', 'やさしい', 'ふつう', 'つよい', 'おに'], WHO = ['初心者', 'ふつうの人', '上手な人'];
for (const play of ['tsunagu', 'naraberu']) {
  console.log(`\n### 人=${play}  勝率[95%CI] 平均秒 (人の操作/分, 人の最大連鎖/CPUの最大連鎖)${b ? ' → 改案' : ''}`);
  console.log('| | ' + LV.join(' | ') + ' |');
  for (const w of WHO) {
    const cells = LV.map(L => {
      const r = a[`${play}/${w}/${L}`]; if (!r) return '-';
      let s = `${(r.rate * 100).toFixed(1)}% [${(r.ci[0] * 100).toFixed(0)}–${(r.ci[1] * 100).toFixed(0)}] ${r.avgSec.toFixed(0)}s`;
      if (!b) s += ` (${r.humanActsPerMin.toFixed(0)}/分, ${r.humanMaxChain.toFixed(1)}/${r.cpuMaxChain.toFixed(1)})`;
      const n = b && b[`${play}/${w}/${L}`];
      if (n) s += ` → ${(n.rate * 100).toFixed(1)}% [${(n.ci[0] * 100).toFixed(0)}–${(n.ci[1] * 100).toFixed(0)}] ${n.avgSec.toFixed(0)}s`;
      return s;
    });
    console.log(`| ${w} | ${cells.join(' | ')} |`);
  }
}
