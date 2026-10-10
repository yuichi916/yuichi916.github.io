import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import {
  createTsunagu, findGroups, resolveAll, applyGravity,
} from '../../assets/tsunagu-naraberu/tsunagu.js';

const cfg = { ...CFG, atkMulT: 1 };
const L = { '.': 0, R: 1, G: 2, B: 3, Y: 4, P: 5, O: 6 };
const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
const inp = o => ({ ...NONE, ...o });

// 下詰めで行を並べる（最後の文字列が y=12）
function gridOf(rows) {
  const g = Array.from({ length: 13 }, () => Array(6).fill(0));
  const off = 13 - rows.length;
  rows.forEach((r, i) => [...r].forEach((ch, x) => { g[off + i][x] = L[ch]; }));
  return g;
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('findGroups: 4連結は群、3連結は群でない', () => {
  assert.equal(findGroups(gridOf(['RRRR..'])).length, 1);
  assert.equal(findGroups(gridOf(['RRR...'])).length, 0);
  assert.equal(findGroups(gridOf(['R.....', 'R.....', 'RR....']))[0].cells.length, 4);
});

test('resolveAll: 手組み2連鎖', () => {
  const g = gridOf([
    'G.....',
    'RG....',
    'RG....',
    'RRG...',
  ]);
  const r = resolveAll(g, cfg);
  assert.equal(r.chains, 2);
  near(r.D, 40 / 70 + 320 / 70);
  assert.equal(r.cleared, 8);
});

test('resolveAll: 隣接するおじゃまも消える（消去数には入らない）', () => {
  const g = gridOf(['O.....', 'RRRRO.']);
  const r = resolveAll(g, cfg);
  assert.equal(r.chains, 1);
  assert.equal(r.cleared, 4);
  assert.ok(g.every(row => row.every(v => v === 0)));
});

test('applyGravity: 浮いたつぶが落ちる', () => {
  const g = gridOf(['R.....', '......', '......']);
  applyGravity(g);
  assert.equal(g[12][0], 1);
  assert.equal(g[10][0], 0);
});

function freshBoard(seed = 1, takeGarbage = () => 0) {
  const b = createTsunagu({ cfg, seed, takeGarbage });
  b.step(inp({})); // 最初の組を出す
  return b;
}

test('自動落下: 30刻みで1マス', () => {
  const b = freshBoard();
  const y0 = b.piece.y;
  for (let i = 0; i < 30; i++) b.step(inp({}));
  assert.equal(b.piece.y, y0 + 1);
});

test('壁際で右回転すると親が押し出される', () => {
  const b = freshBoard();
  b.piece.x = 5; b.piece.y = 5; b.piece.rot = 0;
  b.step(inp({ b: true }));
  assert.equal(b.piece.rot, 1);
  assert.equal(b.piece.x, 4);
});

test('幅1の井戸では上下反転', () => {
  const b = freshBoard();
  for (let y = 3; y <= 12; y++) { b.grid[y][1] = (y % 2) + 1; b.grid[y][3] = (y % 2) + 3; }
  b.piece.x = 2; b.piece.y = 5; b.piece.rot = 0;
  b.step(inp({ b: true }));
  assert.equal(b.piece.rot, 2);
  assert.equal(b.piece.x, 2);
});

test('隠し行で移動・回転しても例外が出ない', () => {
  const b = freshBoard();
  b.piece.x = 2; b.piece.y = 1; b.piece.rot = 0;
  for (const o of [{ left: true }, { a: true }, { a: true }, { right: true }, { b: true }, { b: true }, { a: true }]) {
    b.step(inp(o));
    assert.ok(b.piece.y >= 0);
  }
});

test('すぐ落とす→消える→攻撃イベント', () => {
  const b = freshBoard();
  b.grid = gridOf(['RRR...']);
  b.piece = { x: 3, y: 1, rot: 0, a: 1, b: 2 };
  const ev = [];
  for (let i = 0; i < 80; i++) ev.push(...b.step(inp({ up: i === 0 })));
  const atk = ev.filter(e => e.type === 'attack');
  assert.equal(atk.length, 1);
  near(atk[0].D, 40 / 70);
  assert.equal(atk[0].chain, 1);
});

test('連鎖のあと takeGarbage の個数が落ちる', () => {
  let asked = 0;
  const b = freshBoard(3, () => (asked++ === 0 ? 8 : 0));
  b.grid = gridOf([]);
  b.piece = { x: 0, y: 1, rot: 0, a: 1, b: 2 };
  b.step(inp({ up: true }));
  for (let i = 0; i < 5; i++) b.step(inp({}));
  const g = b.grid.flat().filter(v => v === 6).length;
  assert.equal(g, 8);
});

test('出現位置(2,1)がふさがると負け', () => {
  const b = createTsunagu({ cfg, seed: 1, takeGarbage: () => 0 });
  for (let y = 1; y <= 12; y++) b.grid[y][2] = (y % 2) + 1;
  b.step(inp({}));
  assert.equal(b.isDead(), true);
});

test('同じシードなら同じ組の列', () => {
  const seq = seed => {
    const b = createTsunagu({ cfg, seed, takeGarbage: () => 0 });
    const out = [];
    for (let i = 0; i < 400 && !b.isDead(); i++) {
      b.step(inp({ up: true }));
      if (b.piece) out.push(`${b.piece.a}${b.piece.b}`);
    }
    return out.join(',');
  };
  assert.equal(seq(7), seq(7));
  assert.notEqual(seq(7), seq(8));
});

test('先行入力（IRS）: 消去中に押した右回転は、次の組が出た瞬間にかかる', () => {
  const b = freshBoard();
  b.grid = gridOf(['RRR...']);
  b.piece = { x: 3, y: 1, rot: 0, a: 1, b: 2 };
  b.step(inp({ up: true }));       // 置く → R4つで消去が始まる
  assert.equal(b.phase, 'pop');
  b.step(inp({ b: true }));        // 消去中に右回転
  let spawned = false;
  for (let i = 0; i < 120 && !spawned; i++) { b.step(inp({})); spawned = b.phase === 'fall'; }
  assert.ok(spawned);
  assert.equal(b.piece.rot, 1);
});

test('先行入力（IRS）: 押さなければ回らない', () => {
  const b = freshBoard();
  b.grid = gridOf(['RRR...']);
  b.piece = { x: 3, y: 1, rot: 0, a: 1, b: 2 };
  b.step(inp({ up: true }));
  for (let i = 0; i < 120 && b.phase !== 'fall'; i++) b.step(inp({}));
  assert.equal(b.piece.rot, 0);
});
