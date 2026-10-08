// 見た目の物理（fx.js）の検査: 中身を変えないこと、値が壊れないこと、落ちる・つぶれる・飛び散るが実際に起きること。
// node _dev/tsunagu-naraberu/fx.test.mjs
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { createMatch } from '../../assets/tsunagu-naraberu/match.js';
import { createTsunaguAI } from '../../assets/tsunagu-naraberu/ai-tsunagu.js';
import { createNaraberuAI } from '../../assets/tsunagu-naraberu/ai-naraberu.js';
import { createFx } from '../../assets/tsunagu-naraberu/fx.js';

function run(seed, withFx, kinds = ['tsunagu', 'naraberu'], maxFrames = 60 * 150) {
  const match = createMatch({ cfg: CFG, kinds, seeds: [seed, seed + 7919], handicap: [0, 0] });
  const ais = kinds.map((k, i) => k === 'tsunagu' ? createTsunaguAI('つよい', CFG, { seed: seed + i }) : createNaraberuAI('つよい', CFG, { seed: seed + i }));
  const fx = withFx ? createFx() : null;
  const seen = { fall: 0, squash: 0, parts: 0, swap: 0, pieceMoves: 0 };
  while (!match.result && match.frame < maxFrames) {
    const inputs = [0, 1].map(p => ais[p].next(match.players[p].board, match.players[p].pending.D));
    const pre = fx && fx.snapshot(match);
    const ev = match.step(inputs);
    if (fx) {
      fx.afterStep(match, ev, pre); fx.tick();
      seen.parts = Math.max(seen.parts, fx.parts.length);
      match.players.forEach((pl, p) => {
        if (pl.kind === 'tsunagu') {
          for (let y = 0; y < 13; y++) for (let x = 0; x < 6; x++) {
            const v = fx.tsunaguCell(p, x, y);
            if (!v) continue;
            assert.ok(pl.board.grid[y][x], `つぶの無いマスに動きが残っている p${p} ${x},${y}`);
            for (const k of ['off', 'v', 'sq', 'sqv']) assert.ok(v[k] === undefined || Number.isFinite(v[k]), `${k} が数でない`);
            assert.ok((v.off || 0) <= 0 && v.off > -16, `off が範囲外 ${v.off}`);
            assert.ok(Math.abs(v.sq || 0) < 0.6, `sq が大きすぎる ${v.sq}`);
            if (v.off < -0.05) seen.fall++;
            if (Math.abs(v.sq || 0) > 0.05) seen.squash++;
          }
          const q = fx.piece(p);
          if (q) { assert.ok([q.x, q.y, q.ang].every(Number.isFinite)); if (Math.abs(q.x - pl.board.piece.x) > 0.05) seen.pieceMoves++; }
        } else {
          for (let i = 0; i < pl.board.C.length; i++) {
            const v = fx.naraberuCell(p, i);
            if (!v) continue;
            for (const k of ['ox', 'oy', 'sq', 'sqv']) assert.ok(v[k] === undefined || Number.isFinite(v[k]));
            assert.ok(Math.abs(v.ox || 0) <= 1 && Math.abs(v.oy || 0) <= 1);
            if (v.ox) seen.swap++;
            if (Math.abs(v.sq || 0) > 0.05) seen.squash++;
          }
        }
      });
      for (const q of fx.parts) assert.ok([q.x, q.y, q.vx, q.vy].every(Number.isFinite));
      assert.ok(fx.parts.length < 2000, 'しずくが増え続けている');
    }
  }
  return { result: match.result, frame: match.frame, sent: match.players.map(p => p.sent), seen };
}

for (const seed of [11, 202, 3003]) {
  const a = run(seed, false), b = run(seed, true);
  // 中身を一切変えないこと: fx の有無で試合の結果・長さ・攻撃量が完全に同じ
  assert.deepEqual([a.result?.winner, a.frame, a.sent], [b.result?.winner, b.frame, b.sent], `seed ${seed}: fx で試合が変わった`);
  assert.ok(b.seen.fall > 0, '落ちる動きが一度も起きていない');
  assert.ok(b.seen.squash > 0, 'つぶれる動きが一度も起きていない');
  assert.ok(b.seen.parts > 0, 'しずく・破片が出ていない');
  assert.ok(b.seen.swap > 0, '入れ替えのすべりが出ていない');
  assert.ok(b.seen.pieceMoves > 0, '操作中の組が追いかけていない');
  console.log(`seed ${seed}: OK  frames ${b.frame}  winner ${b.result?.winner}`, b.seen);
}
// 同じ派どうしでも壊れないこと
for (const kinds of [['tsunagu', 'tsunagu'], ['naraberu', 'naraberu']]) {
  const a = run(77, false, kinds), b = run(77, true, kinds);
  assert.deepEqual([a.result?.winner, a.frame], [b.result?.winner, b.frame]);
  console.log(kinds.join('×'), 'OK', b.frame);
}
console.log('fx.test: all OK');
