import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import {
  createNaraberu, fillFromRows, matchesOf, snapshot, simulateSwap, TOP, BOTTOM,
} from '../../assets/tsunagu-naraberu/naraberu.js';

const cfg = { ...CFG, atkMulN: 1, naraberuRiseStartSec: 1000, naraberuRiseEndSec: 1000 };
const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
const inp = o => ({ ...NONE, ...o });
const R = 1, G = 2;
const at = (b, x, y) => b.C[y * 6 + x];

function board(rows, extra = {}, takeGarbage = () => []) {
  const b = createNaraberu({ cfg: { ...cfg, ...extra }, seed: 1, takeGarbage });
  fillFromRows(b, rows);
  return b;
}
function run(b, frames, input = {}) {
  const ev = [];
  for (let i = 0; i < frames; i++) ev.push(...b.step(inp(input)));
  return ev;
}

test('横3で消える', () => {
  const b = board(['RRR...']);
  const ev = run(b, 1);
  assert.equal(ev.find(e => e.type === 'pop').n, 3);
  assert.equal(ev.filter(e => e.type === 'attack').length, 0);
  run(b, 60);
  assert.equal(at(b, 0, BOTTOM), 0);
});

test('縦3で消える', () => {
  const b = board(['G.....', 'G.....', 'G.....']);
  assert.equal(run(b, 1).find(e => e.type === 'pop').n, 3);
});

test('L字5は同時5個で D=4', () => {
  const b = board(['R.....', 'R.....', 'RRR...']);
  const atk = run(b, 1).filter(e => e.type === 'attack');
  assert.equal(atk.length, 1);
  assert.equal(atk[0].D, 4);
});

test('落下で2連鎖、2段目は D=6', () => {
  const b = board(['..G...', 'GGRRR.']);
  const atk = run(b, 150).filter(e => e.type === 'attack');
  assert.equal(atk.length, 1);
  assert.equal(atk[0].chain, 2);
  assert.equal(atk[0].D, 6);
});

test('空きマスと入れ替えると落ちる', () => {
  const b = board(['R.....', 'GB....']);
  b.cursor = { x: 0, y: BOTTOM - 1 };
  run(b, 1, { a: true });
  run(b, 5);
  assert.equal(at(b, 1, BOTTOM - 1), R);
  assert.equal(at(b, 0, BOTTOM - 1), 0);
});

test('消去中のセルとおじゃまは入れ替えできない', () => {
  const b = board(['RRR...']);
  run(b, 1);
  b.cursor = { x: 2, y: BOTTOM };
  run(b, 1, { a: true });
  assert.equal(at(b, 2, BOTTOM), R);
  assert.equal(at(b, 3, BOTTOM), 0);

  const g = board(['......']);
  g.addBlock(0, BOTTOM, 6, 1);
  g.cursor = { x: 0, y: BOTTOM };
  run(g, 1, { a: true });
  assert.equal(at(g, 0, BOTTOM), 9);
});

test('せり上がりで1行上がり、カーソルも上がる', () => {
  const b = board(['GB....'], { naraberuRiseStartSec: 0.5, naraberuRiseEndSec: 0.5 });
  b.cursor = { x: 0, y: 20 };
  run(b, 31);
  assert.equal(b.riseCount, 1);
  assert.equal(at(b, 0, BOTTOM - 1), G);
  assert.equal(b.cursor.y, 19);
});

test('消去中はせり上がりが止まる', () => {
  const b = board(['RRR...', 'GBGBGB'], { naraberuRiseStartSec: 0.2, naraberuRiseEndSec: 0.2 });
  run(b, 40);
  assert.equal(b.riseCount, 0);
});

test('解凍: 6×2ブロックの隣で消すと下の行がパネルに戻り、1行残る', () => {
  const b = board(['......', '......', 'BRRRBY'.replace(/R/g, 'R')]);
  // 下段を Y B ... にして消える色を R のみにする
  fillFromRows(b, ['BRRRGY']);
  b.addBlock(0, BOTTOM - 2, 6, 2);
  run(b, 200);
  assert.equal(b.blocks.size, 1);
  const blk = [...b.blocks.values()][0];
  assert.equal(blk.h, 1);
  let garbageCells = 0;
  for (let i = 0; i < b.C.length; i++) if (b.C[i] === 9) garbageCells++;
  assert.equal(garbageCells, 6);
});

// 3つ並びのない満杯の盤
function fullRows() {
  const rows = [];
  for (let y = TOP; y <= BOTTOM; y++) {
    rows.push([0, 1, 2, 3, 4, 5].map(x => 'RGBYP'[(x + 2 * y) % 5]).join(''));
  }
  return rows;
}

test('最上段に届いたまま猶予が切れると負け', () => {
  const b = board(fullRows(), { naraberuRiseStartSec: 1, naraberuRiseEndSec: 1, topGraceSec: 1 });
  run(b, 59);
  assert.equal(b.isDead(), false);
  run(b, 3);
  assert.equal(b.isDead(), true);
});

test('最上段でカーソルが盤外に出ない', () => {
  const b = board(['GB....']);
  b.cursor = { x: 4, y: TOP };
  run(b, 1, { up: true });
  run(b, 1, { right: true });
  assert.deepEqual(b.cursor, { x: 4, y: TOP });
});

test('初期盤にそろいがない（100シード）', () => {
  for (let s = 1; s <= 100; s++) {
    const b = createNaraberu({ cfg, seed: s, takeGarbage: () => [] });
    assert.equal(matchesOf(b).size, 0, `seed ${s}`);
  }
});

test('takeGarbage のブロックが隠し行に置かれて落ちてくる', () => {
  let once = true;
  const b = board(['GBGBGB'], {}, () => (once ? ((once = false), [{ w: 6, h: 1 }]) : []));
  run(b, 40);
  let n = 0;
  for (let x = 0; x < 6; x++) if (at(b, x, BOTTOM - 1) === 9) n++;
  assert.equal(n, 6);
});

test('simulateSwap: 1手で3つそろう入れ替えを見つける', () => {
  const b = board(['RR.R..']);
  const snap = snapshot(b);
  const r = simulateSwap(snap, 2, BOTTOM, cfg);
  assert.equal(r.cleared, 3);
  const r2 = simulateSwap(snap, 0, BOTTOM, cfg);
  assert.equal(r2.cleared, 0);
});

test('初期盤は1手で2連鎖以上・2手で3連鎖以上にならない（30シード）', () => {
  for (let s = 1; s <= 30; s++) {
    const b = createNaraberu({ cfg, seed: s, takeGarbage: () => [] });
    const snap = snapshot(b);
    for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < 5; x++) {
      const r = simulateSwap(snap, x, y, cfg);
      if (!r) continue;
      assert.ok(r.chains <= 1, `seed ${s} 1手 (${x},${y}) ${r.chains}連鎖`);
      const g = r.grid.slice();
      for (let y2 = TOP; y2 <= BOTTOM; y2++) for (let x2 = 0; x2 < 5; x2++) {
        const r2 = simulateSwap(g, x2, y2, cfg);
        if (r2) assert.ok(r2.chains <= 2, `seed ${s} 2手 ${r2.chains}連鎖`);
      }
    }
  }
});

test('レビュー1: 前の連鎖の最後の消去中に始まった無関係な消去から続く連鎖は 2 と数える', () => {
  const b = board(['..G...', 'GGRRR.']);
  const ev = run(b, 100); // 左の2連鎖の2段目がまだ消去中
  assert.equal(ev.filter(e => e.type === 'attack').length, 1);
  const set = (x, y, c) => { const i = y * 6 + x; b.C[i] = c; b.S[i] = 0; b.F[i] = 0; b.T[i] = 0; };
  set(3, BOTTOM, 5); set(4, BOTTOM, 5);
  set(5, BOTTOM, 4); set(5, BOTTOM - 1, 4); set(5, BOTTOM - 2, 4); set(5, BOTTOM - 3, 5);
  const atk = run(b, 200).filter(e => e.type === 'attack');
  assert.equal(atk.length, 1);
  assert.equal(atk[0].chain, 2);
  assert.equal(atk[0].D, 6);
});

test('レビュー2: 最上段が埋まっている間はせり上がり量が増えない', () => {
  const b = board(fullRows(), { naraberuRiseStartSec: 1, naraberuRiseEndSec: 1, topGraceSec: 5 });
  b.rise = 0.5;
  run(b, 120);
  assert.equal(b.rise, 0.5);
});

test('レビュー4: 背の高いおじゃまの着弾と同じ刻みにせり上がっても、ブロックが欠けない', () => {
  let once = true;
  const b = board(['GBGBGB'], { naraberuRiseStartSec: 1000, naraberuRiseEndSec: 1000 }, () => (once ? ((once = false), [{ w: 6, h: 12 }]) : []));
  b.rise = 0.9999;
  run(b, 1, { bHeld: true });
  for (const blk of b.blocks.values()) assert.ok(blk.y >= 0, `block y=${blk.y}`);
  run(b, 60);
  let cells = 0;
  for (let i = 0; i < b.C.length; i++) if (b.C[i] === 9) cells++;
  const area = [...b.blocks.values()].reduce((s, k) => s + k.w * k.h, 0);
  assert.equal(cells, area);
});
