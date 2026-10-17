import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { createPractice } from '../../assets/tsunagu-naraberu/practice.js';

const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };

test('練習: 予告を持って始められ、消して攻撃すると自分の予告を打ち消す（相殺）', () => {
  const cfg = { ...CFG, tsunaguLandSec: 999 };
  const m = createPractice({ cfg, kind: 'tsunagu', seed: 1, pending: 6, setup(b) {
    b.grid = Array.from({ length: 13 }, () => Array(6).fill(0));
    for (let x = 0; x < 3; x++) b.grid[12][x] = 1;
    b.piece = { x: 3, y: 1, rot: 0, a: 1, b: 2 };
  } });
  const before = m.players[0].pending.D;
  assert.ok(Math.abs(before * cfg.convT - 6) < 1e-9, '予告6個で始まる');
  const ev = [];
  for (let i = 0; i < 3; i++) ev.push(...m.step([{ ...NONE, up: i === 0 }]));
  const atk = ev.find(e => e.type === 'attack');
  assert.ok(atk && atk.offset > 0, '相殺の合図');
  assert.ok(m.players[0].pending.D < before, '予告が減る');
});

test('練習: 予告を持って始めた練習は、盤を作り直しても最初の予告に戻る（相殺の課題が解けなくならない）', () => {
  const cfg = { ...CFG, tsunaguLandSec: 999 };
  const m = createPractice({ cfg, kind: 'tsunagu', seed: 1, pending: 6 });
  m.players[0].pending.D = 0;
  m.resetBoard();
  assert.ok(Math.abs(m.players[0].pending.D * cfg.convT - 6) < 1e-9);
});

test('練習: 自分の盤だけが進み、結果は出ない', () => {
  for (const kind of ['tsunagu', 'naraberu']) {
    const m = createPractice({ cfg: CFG, kind, seed: 3 });
    assert.equal(m.players.length, 1);
    for (let i = 0; i < 300; i++) m.step([NONE]);
    assert.equal(m.frame, 300);
    assert.equal(m.result, null);
    assert.equal(m.feverMul(), 1);
  }
});

test('練習: おじゃまを落とすと、つなぐ派は次に置いたときに盤に入る', () => {
  const m = createPractice({ cfg: CFG, kind: 'tsunagu', seed: 1 });
  m.step([NONE]);
  m.dropGarbage(6);
  const ev = [];
  for (let i = 0; i < 200; i++) ev.push(...m.step([NONE])); // 予告の3秒を待つ
  for (let i = 0; i < 5; i++) ev.push(...m.step([{ ...NONE, up: i === 0 }]));
  assert.ok(ev.some(e => e.type === 'garbage' && e.n === 6));
});

test('練習: おじゃまを落とすと、ならべる派は試合と同じく予告の3秒のあとで盤の上に出る', () => {
  const m = createPractice({ cfg: CFG, kind: 'naraberu', seed: 1 });
  m.dropGarbage(12);
  const early = [], ev = [];
  for (let i = 0; i < 170; i++) early.push(...m.step([NONE]));
  assert.ok(!early.some(e => e.type === 'garbage'), '3秒たつ前は降らない（その間に打ち消せる）');
  for (let i = 0; i < 30; i++) ev.push(...m.step([NONE]));
  assert.ok(ev.some(e => e.type === 'garbage' && e.w * e.h === 12));
});

test('練習: 盤が詰まったら、その場で新しい盤になる（結果画面にしない）', () => {
  const m = createPractice({ cfg: CFG, kind: 'tsunagu', seed: 2 });
  const b0 = m.players[0].board;
  for (let y = 1; y <= 12; y++) b0.grid[y][2] = (y % 2) + 1;
  const ev = [];
  for (let i = 0; i < 3; i++) ev.push(...m.step([NONE]));
  assert.ok(ev.some(e => e.type === 'reset'));
  assert.notEqual(m.players[0].board, b0);
  assert.equal(m.result, null);
});

test('練習: やり直すと盤が新しくなり、予告も空になる', () => {
  const m = createPractice({ cfg: CFG, kind: 'naraberu', seed: 2 });
  m.dropGarbage(30);
  const b0 = m.players[0].board;
  m.resetBoard();
  assert.notEqual(m.players[0].board, b0);
  assert.equal(m.players[0].pending.D, 0);
});
