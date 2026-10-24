// きょうの県: assets/kyou-no-ken-core.js の検査（画面と同じファイルをそのまま読む）
//   - 日付の境目が日本時間 0 時であること
//   - 365 日分の出題: 47 県の出現回数の偏り、同じ県が近い日に続かないこと
//   - ヒント: 毎日 6 つ、tier の順、重複なし
//   - 距離: JS の計算を国土地理院「都道府県庁間の距離」全 1,081 組と照合（selftest.py が書き出した表）
//   - 共有文の形
// 使い方:  node scripts/kyou_no_ken/test_core.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const K = require(path.join(ROOT, 'assets', 'kyou-no-ken-core.js'));
const data = JSON.parse(readFileSync(path.join(ROOT, 'data', 'kyou-no-ken', 'data.json'), 'utf8'));

let fails = 0;
function check(cond, msg) {
  console.log((cond ? '  ok   ' : '  FAIL ') + msg);
  if (!cond) fails++;
}

console.log('[1] 日付の境目（日本時間 0 時）');
const t0 = Date.UTC(2026, 9, 23, 15, 0, 0); // = 2026-10-24 00:00 JST
check(K.dayIndexAt(t0) === 0, '2026-10-24 00:00:00 JST が #1（通し番号 0）');
check(K.dayIndexAt(t0 - 1) === -1, '2026-10-23 23:59:59.999 JST は前の日');
check(K.dayIndexAt(t0 + K.DAY - 1) === 0, '2026-10-24 23:59:59.999 JST はまだ #1');
check(K.dayIndexAt(t0 + K.DAY) === 1, '2026-10-25 00:00:00 JST で #2');
check(K.dayIndexAt(Date.UTC(2026, 9, 24, 14, 59, 59)) === 0 && K.dayIndexAt(Date.UTC(2026, 9, 24, 15, 0, 0)) === 1,
  'UTC 14:59:59 → 15:00:00 で日が変わる（UTC 0 時ではない）');
check(K.dayIndexAt(Date.UTC(2026, 9, 24, 0, 0, 0)) === 0 && K.dayIndexAt(Date.UTC(2026, 9, 23, 23, 59, 59)) === 0,
  'UTC の 0 時をまたいでも日は変わらない');
check(K.dateOfIndex(0) === '2026-10-24' && K.dateOfIndex(8) === '2026-11-01' && K.dateOfIndex(68) === '2026-12-31'
  && K.dateOfIndex(69) === '2027-01-01', 'dateOfIndex: #1=10/24, #9=11/1, #70=2027/1/1');
check(K.msToNextJstMidnight(t0 + 1000) === K.DAY - 1000, '次の 0 時（日本時間）までの残り時間');
// どのタイムゾーンでも同じ答え: 端末の時計の UTC 値だけで決まる（Date の getHours 等を使っていない）
check(!/getHours|getDate\(|getMonth\(|getFullYear\(|toLocaleDateString/.test(readFileSync(path.join(ROOT, 'assets', 'kyou-no-ken-core.js'), 'utf8')),
  '端末のタイムゾーンに依存する Date のメソッドを使っていない');

console.log('[2] 365 日分の出題');
const N = 365;
const seq = Array.from({ length: N }, (_, i) => K.prefForDay(i));
const counts = Array(47).fill(0);
seq.forEach((p) => counts[p]++);
const minC = Math.min(...counts), maxC = Math.max(...counts);
check(counts.every((c) => c > 0), '365 日で 47 県すべてが出る');
check(maxC - minC <= 1, `出現回数の差は 1 以内（最少 ${minC} 回・最多 ${maxC} 回。365 = 47×7 + 36）`);
for (let c = 0; c * 47 < N; c++) {
  const block = seq.slice(c * 47, c * 47 + 47);
  if (block.length === 47) check(new Set(block).size === 47, `周期 ${c + 1}（#${c * 47 + 1}〜#${c * 47 + 47}）で 47 県が 1 回ずつ`);
}
let minGap = Infinity, gapAt = null;
const last = new Map();
seq.forEach((p, i) => {
  if (last.has(p) && i - last.get(p) < minGap) { minGap = i - last.get(p); gapAt = [data.prefs[p].name, last.get(p) + 1, i + 1]; }
  last.set(p, i);
});
check(minGap >= 17, `同じ県がもう一度出るまで最短 ${minGap} 日（17 日以上）${gapAt ? ' 例: ' + gapAt[0] + ' #' + gapAt[1] + '→#' + gapAt[2] : ''}`);
// 長い期間でも崩れない（10 年ぶん）
const long = Array.from({ length: 3650 }, (_, i) => K.prefForDay(i));
let lg = Infinity; const ll = new Map();
long.forEach((p, i) => { if (ll.has(p)) lg = Math.min(lg, i - ll.get(p)); ll.set(p, i); });
check(lg >= 17, `10 年（3,650 日）でも最短間隔 ${lg} 日`);
check(K.prefForDay(100) === K.prefForDay(100) && JSON.stringify(seq) === JSON.stringify(Array.from({ length: N }, (_, i) => K.prefForDay(i))),
  '何度計算しても同じ並び（決定的）');
check(K.prefForDay(-5) === K.prefForDay(0), '#1 より前の日は #1 に丸める');
console.log('  最初の 14 日: ' + seq.slice(0, 14).map((p, i) => '#' + (i + 1) + ' ' + data.prefs[p].short).join('、'));

console.log('[3] ヒント');
let hintOk = true, tierOk = true, regionLast = true;
const useCount = {};
for (let i = 0; i < N; i++) {
  const { pref, hints } = K.hintsForDay(i, data);
  if (pref !== seq[i]) hintOk = false;
  if (hints.length !== 6) hintOk = false;
  const stats = hints.filter((h) => h.type === 'stat');
  if (new Set(stats.map((h) => h.id)).size !== 5) hintOk = false;
  const tiers = stats.map((h) => data.indicators[h.index].tier);
  if (tiers.join() !== '1,1,2,2,3') tierOk = false;
  if (hints[5].type !== 'region') regionLast = false;
  stats.forEach((h) => { useCount[h.id] = (useCount[h.id] || 0) + 1; });
}
check(hintOk, '毎日 6 つ、統計 5 つは重複なし');
check(tierOk, '並びは tier 1,1,2,2,3（当てにくい→当てやすい）');
check(regionLast, '6 つ目は「地方」');
check(Object.keys(useCount).length === data.indicators.length, `365 日で全 ${data.indicators.length} 指標が使われる`);
console.log('  指標ごとの登場回数: ' + data.indicators.map((d) => d.label.slice(0, 8) + ' ' + (useCount[d.id] || 0)).join(' / '));
const combos = new Set(Array.from({ length: N }, (_, i) => K.hintsForDay(i, data).hints.map((h) => h.id || 'R').join()));
check(combos.size > 300, `ヒントの組み合わせが日によって変わる（365 日で ${combos.size} 通り）`);

console.log('[4] 距離（国土地理院の表と照合）');
const table = JSON.parse(readFileSync(path.join(ROOT, '_dev', 'kyou-no-ken', 'gsi_distances.json'), 'utf8'));
let worst = 0, wp = null;
for (const [a, b, km] of table) {
  const r = K.clue(data, a, b).km;
  const r2 = K.clue(data, b, a).km;
  const e = Math.max(Math.abs(r - km), Math.abs(r2 - km));
  if (e > worst) { worst = e; wp = [data.prefs[a].short, data.prefs[b].short, km, r.toFixed(2)]; }
}
check(table.length === 1081, '表は 1,081 組');
check(worst <= 0.2, `全 1,081 組で差 ≤ 0.2 km（最大 ${worst.toFixed(3)} km ${wp}）`);
const idx = (s) => data.prefs.findIndex((p) => p.short === s);
const tk = K.clue(data, idx('東京'), idx('大阪'));
check(Math.abs(tk.km - 395.9) < 0.1, `東京→大阪 ${tk.km.toFixed(1)} km（国土地理院 395.9 km）`);
check(K.dir8(tk.azimuth) === 6 || K.dir8(tk.azimuth) === 5, `東京から見た大阪は西〜南西（方位角 ${tk.azimuth.toFixed(1)}°）`);
check(K.dir8(K.clue(data, idx('東京'), idx('北海道')).azimuth) <= 1, '東京から見た北海道は北〜北東');
check(K.dir8(K.clue(data, idx('北海道'), idx('沖縄')).azimuth) === 5, '北海道から見た沖縄は南西');
check(K.dir8(K.clue(data, idx('鳥取'), idx('岡山')).azimuth) === 4, '鳥取から見た岡山は南');
check(K.clue(data, 5, 5).km === 0, '同じ県は 0 km');
check(K.square(0) === '🟩' && K.square(100) === '🟨' && K.square(300) === '🟧' && K.square(800) === '🟥', '距離の色分け');

console.log('[5] 共有文');
const ans = seq[0];
const wrong1 = (ans + 20) % 47, wrong2 = (ans + 1) % 47;
const txt = K.shareText({ data, day: 0, tries: [{ guess: wrong1 }, { guess: -1 }, { guess: ans }], answer: ans, won: true,
  url: 'https://yuichi916.github.io/kyou-no-ken.html?ref=x' });
console.log(txt.split('\n').map((l) => '    | ' + l).join('\n'));
const lines = txt.split('\n');
check(lines[0] === 'きょうの県 #1 3/6', '1 行目: 回と点');
check(/^[🟥🟧🟨]⬜🟩$/u.test(lines[1]), '2 行目: 外れ・パス・正解のマス');
check(lines.at(-1).endsWith('?ref=x'), 'URL に ?ref=x');
check(!txt.includes(data.prefs[ans].short), '共有文に答えの県名が出ない');
const lose = K.shareText({ data, day: 4, tries: Array(6).fill({ guess: wrong2 }), answer: ans, won: false, url: 'u' });
check(lose.startsWith('きょうの県 #5 X/6'), '外したときは X/6');

console.log();
if (fails) { console.log('FAILED ' + fails); process.exit(1); }
console.log('ALL PASS');
