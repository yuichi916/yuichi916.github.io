// まぜる漢字「役札」の中身のテストと、機械に遊ばせた難しさの測定。
// 使い方: node scripts/kanji/test_yaku.mjs [--sim N]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Y = require('../../assets/yaku-core.js');

const root = new URL('../../', import.meta.url);
const W = JSON.parse(readFileSync(new URL('data/kanji/words.json', root), 'utf8'));
const G = JSON.parse(readFileSync(new URL('data/kanji/kanji.json', root), 'utf8'));
const D = JSON.parse(readFileSync(new URL('data/kanji/yaku.json', root), 'utf8'));
const EXTRA = new Set(readFileSync(new URL('data/kanji/extra.txt', root), 'utf8').split(/\r?\n/));
const byWord = new Map(W.common.map((r) => [r[0], r]));
const has = (w) => (byWord.has(w) ? 'c' : EXTRA.has(w) ? 'r' : null);
const read = (w) => { const r = byWord.get(w); return r ? r[1] : ''; };
const ctx = Y.makeCtx({ has, read, grade: G, s: D.s, r: D.r, pool: D.pool, base: D.base });

let ok = 0, fail = 0;
function t(name, cond, info) { if (cond) ok++; else { fail++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } }

// 手札を好きな字にした局を作る
function runWith(hand, jokers = [], o = {}) {
  const run = Y.newRun(ctx, 'test', {});
  run.hand = hand.split('').map((ch, i) => ({ id: 1000 + i, ch, seal: (o.seal || '').includes(ch) }));
  run.jokers = jokers.map((id) => ({ id, n: 0 }));
  if (o.round) run.round = o.round;
  return run;
}

// --- 点の計算（手で計算した正解）
{
  const run = runWith('火山花木');
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('火山 は語', e.ok && e.w === '火山', e);
  t('火山 点=10+4+3', e.chips === 17, e.chips);
  t('火山 倍=2', e.mult === 2, e.mult);
  t('火山 合計=34', e.total === 34, e.total);
  const e2 = Y.evaluate(ctx, run, [1, 0]);
  t('山火を選んでも火山に並べ替える', e2.ok && e2.w === '火山', e2.w);
  t('花木 は語でない→不可 か 辞書の語', Y.evaluate(ctx, run, [2, 3]).ok === (has('花木') !== null || has('木花') !== null));
}
{
  const run = runWith('火山', ['len2']);
  t('二字の札 倍+4 → 17×6=102', Y.evaluate(ctx, run, [0, 1]).total === 102);
}
{
  const run = runWith('会社', ['flip']);
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('会社⇄社会 はひっくり返し', e.flip === true && e.mult === 6, e);
}
{
  const run = runWith('海水', ['r85']);
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('さんずい: 海・水 で 倍+6 → 倍8', e.mult === 8 && e.w === '海水', [e.w, e.mult]);
  t('海水の点 = 10+9+4', e.chips === 23, e.chips);
}
{
  const run = runWith('火山', [], { seal: '火' });
  t('朱印 倍+4 → 17×6', Y.evaluate(ctx, run, [0, 1]).total === 102);
  run.jokers = [{ id: 'seal', n: 0 }];
  t('朱肉 倍+10 → 17×12', Y.evaluate(ctx, run, [0, 1]).total === 204);
}
{
  const run = runWith('山道具', ['shiri']);
  run.prev = '火山';
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('しりとり 火山→山道 倍×2', e.w === '山道' && e.mult === 4, [e.w, e.mult]);
}
{
  const run = runWith('火山', ['len4', 'len3']);
  t('長さ違いの札は効かない', Y.evaluate(ctx, run, [0, 1]).mult === 2);
}
{
  const run = runWith('一石二鳥', ['len4']);
  const e = Y.evaluate(ctx, run, [0, 1, 2, 3]);
  t('一石二鳥 4字 倍8×3=24', e.ok && e.w === '一石二鳥' && e.mult === 24, [e.w, e.mult, e.kind]);
}
{
  // 育つ筆: 出すたび +4
  const run = runWith('火山海水日本', ['brush']);
  run.handsLeft = 4; run.phase = 'round';
  const r1 = Y.play(ctx, run, [0, 1]);
  t('育つ筆 1手目は+0', r1.chips === 17, r1.chips);
  t('育つ筆 1手目のあと n=4', run.jokers[0].n === 4);
}
{
  // ボス: 二字封じ・重い霧
  const run = runWith('火山海水');
  run.bosses = { 1: 'futaji' }; run.round = 1;
  t('二字封じ 倍1', Y.evaluate(ctx, run, [0, 1]).mult === 1);
  run.bosses = { 1: 'kiri' };
  run.hand = [{ id: 1, ch: '議', seal: false }, { id: 2, ch: '会', seal: false }];
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('重い霧 議(20画)は0点', e.ok && e.chips === 10 + 6, [e.w, e.chips]);
}
{
  const run = runWith('火山火山');
  run.words = [['火山', 34, 1]];
  const e = Y.evaluate(ctx, run, [0, 1]);
  t('2回目の熟語は倍が半分 17x1=17', e.repeat && e.mult === 1 && e.total === 17, [e.mult, e.total]);
}
// --- 同じ種は同じ山札・同じボス
{
  const a = Y.newRun(ctx, '2026-10-25', { daily: true }), b = Y.newRun(ctx, '2026-10-25', { daily: true });
  t('同じ種は同じ手札', a.hand.map((h) => h.ch).join('') === b.hand.map((h) => h.ch).join(''));
  t('同じ種は同じボス', JSON.stringify(a.bosses) === JSON.stringify(b.bosses));
  const c = Y.newRun(ctx, '2026-10-26', { daily: true });
  t('種が違えば手札も違う', a.hand.map((h) => h.ch).join('') !== c.hand.map((h) => h.ch).join(''));
  t('山札36枚', a.deck.length === 36 && a.hand.length === 8);
  t('JSONで往復できる', JSON.stringify(JSON.parse(JSON.stringify(a))) === JSON.stringify(a));
}
// --- 毎日の一局: 店で何をしても、次の局の山札の順と店の品ぞろえは同じ
{
  const a = Y.newRun(ctx, '2026-10-26', { daily: true }), b = Y.newRun(ctx, '2026-10-26', { daily: true });
  for (const run of [a, b]) { run.phase = 'shop'; run.money = 40; Y.makeShop(ctx, run); }
  t('同じ日の店は同じ', JSON.stringify(a.shop.jokers) === JSON.stringify(b.shop.jokers));
  Y.reroll(a); Y.reroll(a); const p = Y.openPack(ctx, a);
  Y.nextRound(ctx, a); Y.nextRound(ctx, b);
  t('引き直し・字札を使っても次の局の手札は同じ', a.hand.map((h) => h.ch).join('') === b.hand.map((h) => h.ch).join(''), [a.hand.map((h) => h.ch).join(''), b.hand.map((h) => h.ch).join('')]);
  t('字札の3字は日で決まる', p && p.length === 3);
}
// --- 店
{
  const run = Y.newRun(ctx, 'shop', {});
  run.phase = 'shop'; run.money = 30; Y.makeShop(ctx, run);
  const id = run.shop.jokers[0];
  t('役札を買える', Y.buyJoker(run, 0) && run.jokers[0].id === id && run.money === 30 - Y.JMAP[id].price);
  const before = run.money;
  t('売ると半額', Y.sellJoker(run, 0) && run.money === before + Math.max(1, Math.floor(Y.JMAP[id].price / 2)));
  const p = Y.openPack(ctx, run);
  t('字札は3字', p && p.length === 3);
  t('字札を取ると山札+1', Y.takeFromPack(run, 1) && run.deck.length === 37);
  t('削ると山札-1', Y.cutTile(run, run.deck[0].id) && run.deck.length === 36);
  t('削りは1つの店で1回', !Y.cutTile(run, run.deck[0].id));
  t('朱印', Y.sealTile(run, run.deck[0].id) && run.deck[0].seal === true);
  t('次の局', Y.nextRound(ctx, run) && run.round === 2 && run.phase === 'round' && run.hand.length === 8);
  t('朱印は手札にも出る', run.hand.some((h) => h.seal) || run.pile.length > 0);
}
// --- 全部の役札が評価で落ちない
{
  const run = runWith('一石二鳥春夏');
  run.jokers = Y.JOKERS.slice(0, 5).map((j) => ({ id: j.id, n: 2 }));
  for (let i = 0; i < Y.JOKERS.length; i += 5) {
    run.jokers = Y.JOKERS.slice(i, i + 5).map((j) => ({ id: j.id, n: 2 }));
    const e = Y.evaluate(ctx, run, [0, 1, 2, 3]);
    t('役札まとめ ' + i, e.ok && Number.isFinite(e.total) && e.total > 0, e.total);
  }
  t('役札の数', Y.JOKERS.length >= 30, Y.JOKERS.length);
}
// --- 作れる語
{
  const run = runWith('火山花木日本人');
  const f = Y.formable(ctx, run);
  t('作れる語に火山・日本・日本人', ['火山', '日本', '日本人'].every((w) => f.some((x) => x.w === w)), f.map((x) => x.w));
}

console.log(`${ok} ok / ${fail} fail`);

// ------------------------------------------------------------ 機械に遊ばせる
const simN = Number((process.argv.find((a) => a.startsWith('--sim=')) || '').slice(6)) || (process.argv.includes('--sim') ? 300 : 0);
if (simN) {
  for (const skill of ['strong', 'weak']) {
    const reached = [], wins = [], deathBy = {};
    let bestTotal = 0;
    for (let s = 0; s < simN; s++) {
      const run = Y.newRun(ctx, 'sim' + s, {});
      let guard = 0;
      while (!run.over && !run.won && guard++ < 400) {
        if (run.phase === 'round') {
          const f = Y.formable(ctx, run);
          const evs = f.map((x) => ({ x, e: Y.evaluate(ctx, run, x.sel) })).filter((o) => o.e.ok).sort((a, b) => b.e.total - a.e.total);
          const need = Y.target(run) - run.score;
          // 弱い人: 見つけられるのは作れる語の半分（でたらめに）
          const pool = skill === 'weak' ? evs.filter((_, i) => (i * 7 + run.played * 3 + s) % 2 === 0) : evs;
          const best = pool[0];
          const perHand = need / run.handsLeft;
          if (best && (best.e.total >= perHand * 0.9 || run.discLeft === 0 || best.e.total >= need)) {
            Y.play(ctx, run, best.x.sel);
          } else if (run.discLeft > 0) {
            const keep = new Set(); (best ? best.x.sel : []).forEach((k) => keep.add(k));
            const sel = run.hand.map((_, k) => k).filter((k) => !keep.has(k)).slice(0, 5);
            if (!Y.discard(ctx, run, sel.length ? sel : [0])) break;
          } else if (best) Y.play(ctx, run, best.x.sel);
          else { run.over = true; }
        } else if (run.phase === 'shop') {
          // 買い物: 倍の札を優先、余ったら字札
          for (let k = 0; k < 2; k++) {
            const id = run.shop.jokers[k]; if (!id) continue;
            if (run.jokers.length < 5 && run.money >= Y.JMAP[id].price) Y.buyJoker(run, k);
          }
          if (run.money >= 8) { const p = Y.openPack(ctx, run); if (p) Y.takeFromPack(run, 0); }
          Y.nextRound(ctx, run);
        }
      }
      reached.push(run.won ? 9 : run.round); if (!run.won) { const b = Y.bossOf(run); deathBy[b ? b.id : 'r' + run.round] = (deathBy[b ? b.id : 'r' + run.round] || 0) + 1; } wins.push(run.won ? 1 : 0);
      bestTotal = Math.max(bestTotal, run.best ? run.best[1] : 0);
    }
    const hist = {}; reached.forEach((r) => { hist[r] = (hist[r] || 0) + 1; });
    const median = reached.slice().sort((a, b) => a - b)[Math.floor(reached.length / 2)];
    console.log(`${skill}: 勝ち ${(100 * wins.reduce((a, b) => a + b, 0) / simN).toFixed(1)}%  中央値 局${median}  分布 ${JSON.stringify(hist)}  最高の一手 ${bestTotal}  負け ${JSON.stringify(deathBy)}`);
  }
}
if (fail) process.exit(1);
