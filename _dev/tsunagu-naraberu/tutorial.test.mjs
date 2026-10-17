import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { TUTORIALS, tutorialCfg } from '../../assets/tsunagu-naraberu/tutorial.js';
import { createTsunagu } from '../../assets/tsunagu-naraberu/tsunagu.js';
import { createNaraberu } from '../../assets/tsunagu-naraberu/naraberu.js';
import { createPractice } from '../../assets/tsunagu-naraberu/practice.js';

const NONE = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
// 予告を持って始める課題（相殺）は、ゲームと同じく練習モードの中で動かす（盤だけでは相殺が起きない）
const make = (kind, step) => {
  const cfg = tutorialCfg(CFG, kind, step);
  if (step.pending) {
    const m = createPractice({ cfg, kind, seed: 1, setup: step.setup, pending: step.pending });
    const b = m.players[0].board;
    return { ...b, step: inp => m.step([inp]), board: b, isPractice: true };
  }
  const b = kind === 'tsunagu' ? createTsunagu({ cfg, seed: 1, takeGarbage: () => 0 }) : createNaraberu({ cfg, seed: 1, takeGarbage: () => [] });
  if (kind === 'tsunagu') b.step(NONE); // 最初の組を出す
  step.setup(b);
  return b;
};
// 手順: [入力, くり返し] の列。1刻みずつ進め、出来事をためる
function play(b, script, tail = 200) {
  const ev = [];
  for (const [o, n = 1] of script) for (let i = 0; i < n; i++) ev.push(...b.step({ ...NONE, ...o }));
  for (let i = 0; i < tail; i++) ev.push(...b.step(NONE));
  return ev;
}

// 各課題を解く手順（人が操作する想定の、最短の入力）
const SOLVE = {
  tsunagu: [
    [[{ left: true }], [{}], [{ left: true }], [{}], [{ up: true }]],   // 左はしに置く
    [[{ right: true }], [{}], [{ up: true }]],                        // 4つつなげる
    [[{ up: true }]],                                                 // 2連鎖（そのまま落とす）
    [[{ right: true }], [{}], [{ up: true }]],                        // おじゃまを巻き込む
    [[{ right: true }], [{}], [{ up: true }]],                        // 相殺: 4つつなげて消し、予告を打ち消す
  ],
  naraberu: [
    [[{ a: true }]],                                                  // 入れ替え
    [[{ a: true }]],                                                  // 3つ並べる（カーソルは用意済み）
    [[{ a: true }]],                                                  // 2連鎖
    [[{}, 90], [{ a: true }]],                                        // アクティブ連鎖: 消え終わって（81刻み）浮いている間（45刻み）に差し込む
    [[{ bHeld: true }, 40]],                                          // せり上げ
    [[{ a: true }]],                                                  // 相殺: 2連鎖で攻撃し、予告を打ち消す
  ],
};

for (const kind of ['tsunagu', 'naraberu']) {
  TUTORIALS[kind].forEach((step, k) => {
    test(`チュートリアル ${kind} ${k + 1}「${step.title}」: 始めは未達、手順で達成できる`, () => {
      const b0 = make(kind, step);
      const goalOf = (x, ev) => step.goal(x.board || x, ev);
      assert.equal(goalOf(b0, []), false, '始めた直後は未達');
      // 何もしなくても達成してしまわない（つなぐ派は自動落下するので短めに見る）
      const idle = play(make(kind, step), [[{}, kind === 'tsunagu' ? 20 : 40]], 0);
      assert.equal(goalOf(b0, idle), false, '何もしないで達成しない');
      const b = make(kind, step);
      const ev = play(b, SOLVE[kind][k]);
      assert.equal(goalOf(b, ev), true, '手順で達成できる');
      assert.ok(step.text && step.text.length > 5);
    });
  });
}

test('チュートリアルは つなぐ派5課題・ならべる派6課題（最後は相殺）', () => {
  assert.equal(TUTORIALS.tsunagu.length, 5);
  assert.equal(TUTORIALS.naraberu.length, 6);
  for (const kind of ['tsunagu', 'naraberu']) assert.ok(TUTORIALS[kind].at(-1).pending > 0, `${kind}: 最後は予告つきの相殺の課題`);
});
