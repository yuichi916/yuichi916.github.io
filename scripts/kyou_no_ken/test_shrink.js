// 正解が候補から消えないことを機械的に確かめる。node scripts/kyou_no_ken/test_shrink.js
const assert = require('assert');
const Core = require('../../assets/kyou-no-ken-core.js');
const L = require('../../assets/kyou-shrink.js');
const data = require('../../data/kyou-no-ken/data.json');
const N = data.prefs.length, NI = data.indicators.length;
let checks = 0;

// 自己検査: 既知の正解で決まりそのものを確かめる
assert.strictEqual(L.band(0), 0); assert.strictEqual(L.band(150), 0); assert.strictEqual(L.band(150.01), 1);
assert.strictEqual(L.band(400), 1); assert.strictEqual(L.band(400.01), 2);
{ // 東京(12)の総人口は1位。幅14なら15位までが残り、16位以下は消える
  const ind = data.indicators.findIndex((x) => x.id === 'A011000');
  const pz = { pref: 12, hints: [{ type: 'stat', index: ind }] };
  const keep = L.keepByHint(data, pz, 0);
  data.prefs.forEach((_, i) => assert.strictEqual(keep.has(i), data.indicators[ind].ranks[i] <= 1 + L.WIDTH[0]));
  // 東京→大阪は約400km(=403km)なので「それより遠い」。東京から見て400km超の県だけが残る
  const g = L.keepByGuess(data, { pref: 26, hints: [] }, 12);
  assert.ok(g.has(26) && !g.has(12) && !g.has(13) && !g.has(10));
  checks += 3;
}

// 1. 全47県 × 全20統計 × ヒントの位置1〜5: 正解が残る
for (let a = 0; a < N; a++) for (let ind = 0; ind < NI; ind++) for (let k = 0; k < 5; k++) {
  const hints = Array.from({ length: 5 }, () => ({ type: 'stat', index: ind }));
  assert.ok(L.keepByHint(data, { pref: a, hints }, k).has(a), `stat a=${a} ind=${ind} k=${k}`); checks++;
}
// 2. 地方のヒント
for (let a = 0; a < N; a++) {
  const hints = [0, 1, 2, 3, 4].map((i) => ({ type: 'stat', index: i })).concat([{ type: 'region' }]);
  assert.ok(L.keepByHint(data, { pref: a, hints }, 5).has(a)); checks++;
}
// 3. 全47県 × 外した答え46県: 正解が残り、答えた県は消える
for (let a = 0; a < N; a++) for (let g = 0; g < N; g++) {
  const k = L.keepByGuess(data, { pref: a, hints: [] }, g);
  assert.ok(k.has(a), `guess a=${a} g=${g}`);
  if (g !== a) assert.ok(!k.has(g));
  checks++;
}
// 4. 実際の出題（20周期 = 940日）× 開いたヒント0〜6 × 外し方（候補からの順番どおり・逆順・乱数）
const rng = Core.mulberry32(12345);
let games = 0;
for (let d = 0; d < N * 20; d++) {
  const pz = Core.hintsForDay(d, data);
  let prev = N + 1;
  for (let k = 0; k <= 6; k++) {
    const c = L.candidates(data, pz, k, []);
    assert.ok(c.includes(pz.pref), `day ${d} opened ${k}`);
    assert.ok(c.length <= prev); prev = c.length; checks++;
  }
  for (const strat of ['first', 'last', 'rand', 'rand', 'rand']) {
    const guesses = [];
    for (let k = 1; k <= 6; k++) {
      const c = L.candidates(data, pz, k, guesses);
      assert.ok(c.includes(pz.pref), `day ${d} k ${k} guesses ${guesses}`); checks++;
      const wrong = c.filter((i) => i !== pz.pref);
      if (!wrong.length) break;
      const g = strat === 'first' ? wrong[0] : strat === 'last' ? wrong[wrong.length - 1] : wrong[Math.floor(rng() * wrong.length)];
      guesses.push(g);
      const after = L.candidates(data, pz, k, guesses);
      assert.ok(after.includes(pz.pref) && !after.includes(g)); checks++;
    }
    games++;
  }
}
// 5. どの県を最初に外しても（47県 × 940日 × ヒント1時点）正解が残る
for (let d = 0; d < N * 20; d++) {
  const pz = Core.hintsForDay(d, data);
  for (let g = 0; g < N; g++) { assert.ok(L.candidates(data, pz, 1, [g]).includes(pz.pref)); checks++; }
}
console.log('OK', checks, 'checks,', games, 'simulated games, width', JSON.stringify(L.WIDTH));
