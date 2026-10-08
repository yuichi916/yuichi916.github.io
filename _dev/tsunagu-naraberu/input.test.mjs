import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { createNaraberu, fillFromRows, BOTTOM } from '../../assets/tsunagu-naraberu/naraberu.js';

// DOM のない Node で input.js を動かすためのイベント差し替え
const listeners = {};
globalThis.addEventListener = (t, f) => { (listeners[t] ||= []).push(f); };
const fire = (t, code, repeat = false) => (listeners[t] || []).forEach(f => f({ code, repeat }));
const { createInput, touchDragStep } = await import('../../assets/tsunagu-naraberu/input.js');

test('レビュー7: reset() で、止まっている間に押したキーとタッチが捨てられる', () => {
  const inp = createInput();
  fire('keydown', 'KeyW');
  fire('keyup', 'KeyW');
  inp.press(0, 'b');
  inp.reset();
  const o = inp.poll(0, ['left', 'right']);
  assert.equal(o.up, false);
  assert.equal(o.bHeld, false);
});

const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
const slow = { ...CFG, naraberuRiseStartSec: 1000, naraberuRiseEndSec: 1000 };

function dragRun(b, drag, steps) {
  for (let k = 0; k < steps; k++) {
    const tap = touchDragStep(b, drag);
    b.step({ ...NONE, a: !!tap });
  }
}

test('レビュー3: 1刻みの間に2列なぞっても、つかんだパネルが2列動く', () => {
  const b = createNaraberu({ cfg: slow, seed: 1, takeGarbage: () => [] });
  fillFromRows(b, ['RGB...', 'GBYGBY']);
  const y = BOTTOM - 1;
  const drag = { col: 0, y, rc: b.riseCount, c: 1, target: 0, pending: null };
  drag.target = 2; // 一気に2列先へ
  dragRun(b, drag, 4);
  assert.equal(b.C[y * 6 + 2], 1);
  assert.equal(drag.col, 2);
});

test('レビュー3: 入れ替えが断られたら、そこで追いかけるのをやめる', () => {
  const b = createNaraberu({ cfg: slow, seed: 1, takeGarbage: () => [] });
  fillFromRows(b, ['RG....', 'GBYGBY']);
  const y = BOTTOM - 1;
  b.addBlock(2, y, 1, 1); // 2列目はおじゃま
  const drag = { col: 0, y, rc: b.riseCount, c: 1, target: 3, pending: null };
  dragRun(b, drag, 6);
  assert.equal(b.C[y * 6 + 1], 1); // 1列目までは動いた
  assert.equal(b.C[y * 6 + 3], 0); // 3列目には行っていない
  assert.equal(drag.target, drag.col);
});
