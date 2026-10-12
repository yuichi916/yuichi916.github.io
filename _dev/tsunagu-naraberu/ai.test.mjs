import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG, LEVELS, AI_N, cpuAtkOf } from '../../assets/tsunagu-naraberu/config.js';
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

test('ならべる派AI: 盤が低ければ、少量の予告（降ってこない3マス未満）があってもせり上げる', () => {
  for (const lv of Object.keys(LEVELS)) {
    for (const D of [10, 30]) { // 1.5マス（いつまでも降らない）と 4.5マス
      const b = createNaraberu({ cfg: CFG, seed: 3, takeGarbage: () => [] });
      fillFromRows(b, ['R.G.B.', 'GBYPRG']);
      const ai = createNaraberuAI(lv, CFG, { seed: 1 });
      let held = 0;
      for (let f = 0; f < 600; f++) { const i = ai.next(b, D); if (i.bHeld) held++; b.step(i); }
      assert.ok(held > 0, `${lv} 予告${D}: せり上げを一度も押さない`);
    }
  }
});

test('ならべる派AI: 降ってこない少量の予告（3マス未満）は、せり上げを止める理由にしない', () => {
  for (const lv of Object.keys(LEVELS)) {
    const b = createNaraberu({ cfg: CFG, seed: 3, takeGarbage: () => [] });
    // 高さ = せり上げの上限 − 1、そろう所なし
    const rows = ['RGBYPR', 'YPRGBY', 'BYPRGB', 'PRGBYP', 'GBYPRG', 'RGBYPR', 'YPRGBY', 'BYPRGB', 'PRGBYP'];
    fillFromRows(b, rows.slice(0, AI_N.raiseBelow[lv] - 1));
    const ai = createNaraberuAI(lv, CFG, { seed: 1 });
    const D = 2 / CFG.convN; // 2マス
    let held = 0;
    for (let f = 0; f < 120; f++) { const i = ai.next(b, D); if (i.bHeld) held++; b.step(i); }
    assert.ok(held > 0, `${lv}: 2マスの予告でせり上げを止めた`);
  }
});

test('CPU対CPU: ならべる派CPUの棒立ち（盤が止まっているのに1秒以上なにもしない）は試合時間の5%未満', () => {
  for (const lv of Object.keys(LEVELS)) {
    let total = 0, idle = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const kinds = ['tsunagu', 'naraberu'];
      const m = createMatch({ cfg: CFG, kinds, seeds: [seed * 2 + 1, seed * 2 + 2], cpuAtk: kinds.map(k => cpuAtkOf(k, lv)) });
      const ais = [createTsunaguAI(lv, CFG, { seed }), createNaraberuAI(lv, CFG, { seed: seed + 9 })];
      let run = 0;
      while (!m.result) {
        const inp = ais.map((ai, p) => ai.next(m.players[p].board, m.players[p].pending.D));
        const b = m.players[1].board;
        const busy = b.S.some(v => v) || [...b.blocks.values()].some(k => k.thaw > 0);
        const r0 = b.rise + b.riseCount, cx = b.cursor.x, cy = b.cursor.y;
        m.step(inp);
        const acted = (b.rise + b.riseCount) - r0 > 0.05 || b.cursor.x !== cx || b.cursor.y !== cy || inp[1].a;
        total++;
        if (!acted && !busy) run++;
        else { if (run >= 60) idle += run; run = 0; }
      }
    }
    assert.ok(idle / total < 0.05, `${lv}: 棒立ち ${(100 * idle / total).toFixed(1)}%`);
  }
});

test('ならべる派AI: 予告が降ると上限を超える高さなら、せり上げない', () => {
  const b = createNaraberu({ cfg: CFG, seed: 3, takeGarbage: () => [] });
  fillFromRows(b, ['R.G.B.', 'GBYPRG', 'BYPRGB', 'YPRGBY', 'PRGBYP']); // 高さ5
  const ai = createNaraberuAI('ふつう', CFG, { seed: 1 }); // せり上げの上限 6段
  const D = 12 / CFG.convN; // 12マス＝2段ぶんの予告 → 5+2 で上限を超える
  let held = 0;
  for (let f = 0; f < 120; f++) { const i = ai.next(b, D); if (i.bHeld) held++; b.step(i); }
  assert.equal(held, 0);
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
