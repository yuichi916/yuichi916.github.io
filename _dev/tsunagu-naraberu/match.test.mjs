import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { createMatch } from '../../assets/tsunagu-naraberu/match.js';
import { createRng } from '../../assets/tsunagu-naraberu/rng.js';

const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
const keys = Object.keys(NONE);
const randInput = rng => {
  const o = { ...NONE };
  for (const k of keys) o[k] = rng.next() < 0.08;
  return o;
};

function playRandom(seed, kinds, frames) {
  const m = createMatch({ cfg: CFG, kinds, seeds: [seed, seed + 1], handicap: [0, 0] });
  const r = createRng(seed * 7);
  for (let f = 0; f < frames && !m.result; f++) m.step([randInput(r), randInput(r)]);
  return m;
}

test('同じシード＋同じ入力列なら同じ結果', () => {
  for (const kinds of [['tsunagu', 'naraberu'], ['naraberu', 'tsunagu'], ['tsunagu', 'tsunagu']]) {
    const a = playRandom(5, kinds, 6000), b = playRandom(5, kinds, 6000);
    assert.deepEqual(a.result, b.result);
    assert.equal(a.frame, b.frame);
    assert.equal(a.players[0].sent, b.players[0].sent);
  }
});

test('攻撃は相殺してから相手の予告に入る', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  m.players[0].pending.D = 2;
  m.applyAttack(0, 5);
  assert.equal(m.players[0].pending.D, 0);
  assert.equal(m.players[1].pending.D, 3);
});

test('ハンデ+1で攻撃1.2倍、-2で0.6倍', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [1, -2] });
  m.frame = 70 * 60; // ウォームアップと終盤加速の間
  assert.ok(Math.abs(m.attackMul(0) - 1.2) < 1e-9);
  assert.ok(Math.abs(m.attackMul(1) - 0.6) < 1e-9);
});

test('CPUの攻撃補正はハンデと掛け合わせる（省略時は1）', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [1, 0], cpuAtk: [1, 1.5] });
  m.frame = 120 * 60;
  assert.ok(Math.abs(m.attackMul(0) - m.feverMul() * 1.2) < 1e-9);
  assert.ok(Math.abs(m.attackMul(1) - m.feverMul() * 1.5) < 1e-9);
});

test('CPUの攻撃補正は開幕0から openingSec かけて満額に', () => {
  const cfg = { ...CFG, openingSec: 60, openingMul: 0.1 };
  const m = createMatch({ cfg, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0], cpuAtk: [1, 1.5] });
  m.frame = 0;
  assert.ok(Math.abs(m.attackMul(1) - m.feverMul()) < 1e-9);
  m.frame = 30 * 60;
  assert.ok(Math.abs(m.attackMul(1) - m.feverMul() * 1.25) < 1e-9);
  m.frame = 60 * 60;
  assert.ok(Math.abs(m.attackMul(1) - 1.5) < 1e-9);
});

test('feverMul: 開幕0秒0.4→15秒0.7→30秒1.0（ウォームアップ）', () => {
  const m = createMatch({ cfg: { ...CFG, openingSec: 30, openingMul: 0.4 }, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  const at = s => { m.frame = s * 60; return m.feverMul(); };
  assert.ok(Math.abs(at(0) - 0.4) < 1e-9);
  assert.ok(Math.abs(at(15) - 0.7) < 1e-9);
  assert.equal(at(30), 1);
  assert.equal(at(60), 1);
});

test('feverMul: 89秒1.0、90秒1.1、105秒1.2、上限2.0', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  const at = s => { m.frame = s * 60; return m.feverMul(); };
  assert.equal(at(89), 1);
  assert.ok(Math.abs(at(90) - 1.1) < 1e-9);
  assert.ok(Math.abs(at(105) - 1.2) < 1e-9);
  assert.equal(at(5000), 2);
});

test('両者同時に負けたら引き分け', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'tsunagu'], seeds: [1, 2], handicap: [0, 0] });
  for (const p of m.players) for (let y = 1; y <= 12; y++) p.board.grid[y][2] = (y % 2) + 1;
  m.step([NONE, NONE]);
  assert.deepEqual(m.result, { winner: -1, frames: 1 });
});

test('片方だけ負けたら相手の勝ち', () => {
  const m = createMatch({ cfg: CFG, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  for (let y = 1; y <= 12; y++) m.players[0].board.grid[y][2] = (y % 2) + 1;
  m.step([NONE, NONE]);
  assert.equal(m.result.winner, 1);
});

test('maxFrames で引き分け打ち切り', () => {
  const m = createMatch({ cfg: { ...CFG, maxFrames: 50 }, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  for (let i = 0; i < 60 && !m.result; i++) m.step([NONE, NONE]);
  assert.deepEqual(m.result, { winner: -1, frames: 50 });
});

test('着弾: つなぐ派へは個数、ならべる派へはブロックで落ちる', () => {
  const m = createMatch({ cfg: { ...CFG, convT: 1, convN: 1 }, kinds: ['tsunagu', 'naraberu'], seeds: [1, 2], handicap: [0, 0] });
  m.players[1].pending.D = 12; m.players[1].pending.age = 0;
  m.players[0].pending.D = 7;
  const ev = [];
  // つなぐ派は予告が出てから3秒（180刻み）は降らない: 20刻みに置いた組では降らず、200刻みに置いた組のあとで降る
  for (let i = 0; i < 260; i++) {
    const e = m.step([{ ...NONE, up: i === 20 || i === 200 }, NONE]);
    if (i < 180) assert.ok(!e.some(x => x.p === 0 && x.type === 'garbage'), `${i}刻みで降った`);
    ev.push(...e);
  }
  assert.ok(ev.some(e => e.p === 0 && e.type === 'garbage' && e.n === 7));
  assert.ok(ev.some(e => e.p === 1 && e.type === 'garbage' && e.w === 6 && e.h === 2));
});
