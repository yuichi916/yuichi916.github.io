// まぜる日本: assets/mazeru-core.js の検査（node scripts/mazeru/test_core.mjs）
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../../assets/mazeru-core.js');
const meta = JSON.parse(readFileSync(new URL('../../data/mazeru/elements.json', import.meta.url), 'utf8'));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

ok(M.key(3, 10) === M.key(10, 3), 'key(a,b) === key(b,a)');
ok(M.shardOf(3, 10, 16) === M.shardOf(10, 3, 16), 'shardOf は順序によらない');
const table = new Map();
let n = 0;
for (let s = 0; s < meta.shards; s++) {
  const t = readFileSync(new URL(`../../data/mazeru/r/${String(s).padStart(2, '0')}.txt`, import.meta.url), 'utf8');
  n += t.trim().length / 9;
  M.decodeShard(t, table);
}
ok(table.size === meta.recipes && n === meta.recipes, `全分割を読むと ${meta.recipes} 組（${table.size}）`);
// ブラウザと同じ引き方で、全組を逆順でも引ける
let sym = 0;
table.forEach((r, k) => { const a = Math.floor(k / 8192), b = k % 8192; if (table.get(M.key(b, a)) !== r) sym++; });
ok(sym === 0, 'A+B と B+A が同じ答え（ブラウザの引き方）');
ok(M.stars(0.02) === 5 && M.stars(0.08) === 4 && M.stars(0.2) === 3 && M.stars(0.4) === 2 && M.stars(0.9) === 1, '星の境目');
const rank = M.rarityRanker(meta.e);
const shares = meta.e.map((_, i) => rank(i));
const deepest = meta.e.reduce((b, e, i) => (e[3] > meta.e[b][3] || (e[3] === meta.e[b][3] && e[4] < meta.e[b][4]) ? i : b), 0);
ok(rank(meta.bases[0]) === 1 && shares.every((x) => x > 0 && x <= 1), '珍しさの割合は (0,1]、基本要素は 100%');
ok(rank(deepest) <= 0.03, `いちばん深く作り方の少ない要素は ★5 の範囲（${rank(deepest)}）`);
let mono2 = true; meta.e.forEach((e, i) => meta.e.forEach((f, j) => { if (i < 400 && j < 400 && e[3] > f[3] && rank(i) > rank(j)) mono2 = false; }));
ok(mono2, '深い要素ほど割合が小さい（先頭400要素で総当たり）');
const st = [0, 0, 0, 0, 0, 0]; shares.forEach((x) => st[M.stars(x)]++);
console.log('info 星の分布', JSON.stringify(st.slice(1)));
const txt = M.shareText({ found: 12, total: 2000, deepest: { name: '河童', emoji: '🥒', depth: 3 }, rare: 1 });
ok(txt.includes('?ref=x') && txt.includes('#まぜる日本') && txt.includes('河童'), '共有文に ?ref=x・ハッシュタグ・発見名');
let bad = false; try { M.decodeShard('abc'); } catch (e) { bad = true; }
ok(bad, '壊れた分割ファイルは例外');
console.log(fails ? 'FAILED' : 'ALL OK');
process.exit(fails ? 1 : 0);
