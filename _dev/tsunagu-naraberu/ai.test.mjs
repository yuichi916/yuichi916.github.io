import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, LEVELS } from '../../assets/tsunagu-naraberu/config.js';
import { createTsunagu, emptyGrid } from '../../assets/tsunagu-naraberu/tsunagu.js';
import { createNaraberu, fillFromRows, BOTTOM } from '../../assets/tsunagu-naraberu/naraberu.js';
import { createTsunaguAI } from '../../assets/tsunagu-naraberu/ai-tsunagu.js';
import { createNaraberuAI } from '../../assets/tsunagu-naraberu/ai-naraberu.js';
import { createMatch } from '../../assets/tsunagu-naraberu/match.js';

const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };

test('つなぐ派AI: すぐ消せる盤面で消す配置を選ぶ', () => {
  for (const lv of Object.keys(LEVELS)) {
    const b = createTsunagu({ cfg: CFG, seed: 1, takeGarbage: () => 0 });
    b.step(NONE);
    b.grid = emptyGrid();
    b.grid[12][0] = 1; b.grid[12][1] = 1; b.grid[12][2] = 1;
    b.piece = { x: 2, y: 1, rot: 0, a: 1, b: 2 };
    b.pieceId++;
    const ai = createTsunaguAI(lv, CFG, { danger: true });
    let popped = false;
    for (let i = 0; i < 400 && !popped; i++) popped = b.step(ai.next(b, 0)).some(e => e.type === 'pop');
    assert.ok(popped, lv);
  }
});

test('ならべる派AI: 1手でそろう盤面で300刻み以内にそろえる', () => {
  for (const lv of Object.keys(LEVELS)) {
    const b = createNaraberu({ cfg: { ...CFG, naraberuRiseStartSec: 1000, naraberuRiseEndSec: 1000 }, seed: 1, takeGarbage: () => [] });
    fillFromRows(b, ['RR.R..', 'GBYGBY']);
    b.cursor = { x: 0, y: 16 };
    const ai = createNaraberuAI(lv, CFG);
    let popped = false;
    for (let i = 0; i < 300 && !popped; i++) popped = b.step(ai.next(b, 0)).some(e => e.type === 'pop');
    assert.ok(popped, lv);
  }
});

test('ならべる派AI: せり上がり中でも正しい位置を入れ替える', () => {
  const b = createNaraberu({ cfg: { ...CFG, naraberuRiseStartSec: 0.25, naraberuRiseEndSec: 0.25 }, seed: 3, takeGarbage: () => [] });
  fillFromRows(b, ['RR.R..', 'GBYGBY']);
  b.cursor = { x: 0, y: 12 };
  const ai = createNaraberuAI('やさしい', CFG);
  let popped = null;
  for (let i = 0; i < 300 && !popped; i++) popped = b.step(ai.next(b, 0)).find(e => e.type === 'pop');
  assert.ok(popped);
  assert.ok(b.riseCount >= 1);
});

test('CPU対CPU: 全段・全組み合わせで完走する', () => {
  const kindsList = [['tsunagu', 'naraberu'], ['naraberu', 'tsunagu'], ['tsunagu', 'tsunagu'], ['naraberu', 'naraberu']];
  for (const lv of Object.keys(LEVELS)) {
    for (const kinds of kindsList) {
      const m = createMatch({ cfg: CFG, kinds, seeds: [11, 12], handicap: [0, 0] });
      const ais = kinds.map(k => (k === 'tsunagu' ? createTsunaguAI(lv, CFG) : createNaraberuAI(lv, CFG)));
      while (!m.result) m.step(ais.map((ai, p) => ai.next(m.players[p].board, m.players[p].pending.D)));
      assert.ok(m.result.frames > 0, `${lv} ${kinds}`);
    }
  }
});

test('つなぐ派AI: 計画が一度失敗しても、次の刻みで計画し直して null を読まない', () => {
  const b = createTsunagu({ cfg: CFG, seed: 1, takeGarbage: () => 0 });
  b.step(NONE);
  const ai = createTsunaguAI('ふつう', CFG);
  const saved = b.next;
  b.next = null; // 計画中に例外を起こさせる
  assert.throws(() => ai.next(b, 0));
  b.next = saved;
  assert.doesNotThrow(() => { for (let i = 0; i < 60; i++) ai.next(b, 0); });
});
