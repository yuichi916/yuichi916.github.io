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

// ---- 第2部: キー割り当て・DAS/ARR・ゲームパッド ----
const { padButtons } = await import('../../assets/tsunagu-naraberu/input.js');
const { DEFAULTS } = await import('../../assets/tsunagu-naraberu/settings.js');

const pad = ({ buttons = [], axes = [0, 0], index = 0 } = {}) => ({
  index, connected: true, mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })),
});

test('padButtons: 十字キー・スティック・A/B/X/Start', () => {
  assert.deepEqual([...padButtons(pad({ buttons: [14, 0] }))].sort(), ['a', 'left']);
  assert.deepEqual([...padButtons(pad({ buttons: [1] }))], ['b']);
  assert.deepEqual([...padButtons(pad({ buttons: [2] }))], ['b']);
  assert.deepEqual([...padButtons(pad({ buttons: [9] }))], ['pause']);
  assert.deepEqual([...padButtons(pad({ axes: [0.8, -0.9] }))].sort(), ['right', 'up']);
  assert.equal(padButtons(pad({ axes: [0.3, 0.2] })).size, 0, 'しきい値未満のスティックは無視');
});

test('ゲームパッド: 押した瞬間だけ edge、押しっぱなしで連続移動', () => {
  const inp = createInput();
  inp.setKeys(DEFAULTS.keys); inp.setTiming(10, 2);
  let pads = [pad({ buttons: [15] })];
  inp.pollPads(() => pads);
  let o = inp.poll(0, ['left', 'right']); inp.endFrame();
  assert.equal(o.right, true);
  const fired = [];
  for (let f = 1; f <= 14; f++) { inp.pollPads(() => pads); fired.push(inp.poll(0, ['left', 'right']).right); inp.endFrame(); }
  // 押してから10刻み目に連続移動が始まり、2刻みおき
  assert.deepEqual(fired.map((v, i) => (v ? i + 1 : 0)).filter(Boolean), [10, 12, 14]);
});

test('DAS/ARR を変えると連続移動の間隔が変わる', () => {
  const inp = createInput();
  inp.setKeys(DEFAULTS.keys); inp.setTiming(4, 3);
  const pads = [pad({ buttons: [14] })];
  const fired = [];
  for (let f = 0; f <= 10; f++) { inp.pollPads(() => pads); if (inp.poll(0, ['left', 'right']).left) fired.push(f); inp.endFrame(); }
  assert.deepEqual(fired, [0, 4, 7, 10]);
});

test('ゲームパッドが抜けても例外を出さない。2人対戦は接続順に 1P・2P', () => {
  const inp = createInput();
  inp.setKeys(DEFAULTS.keys); inp.setMode(true);
  inp.pollPads(() => [pad({ buttons: [0], index: 0 }), pad({ buttons: [1], index: 1 })]);
  const a = inp.poll(0, []), b = inp.poll(1, []);
  inp.endFrame();
  assert.equal(a.a, true); assert.equal(b.b, true);
  assert.doesNotThrow(() => { inp.pollPads(() => [null, undefined]); inp.poll(0, []); inp.poll(1, []); inp.endFrame(); });
  assert.doesNotThrow(() => { inp.pollPads(() => { throw new Error('no gamepad api'); }); inp.endFrame(); });
});

test('Start ボタンで一時停止の合図を返す（押した瞬間だけ）', () => {
  const inp = createInput();
  inp.setKeys(DEFAULTS.keys);
  assert.equal(inp.pollPads(() => [pad({ buttons: [9] })]).pause, true);
  inp.endFrame();
  assert.equal(inp.pollPads(() => [pad({ buttons: [9] })]).pause, false);
});

test('キーの割り当てを変えると、新しいキーで動き古いキーでは動かない', () => {
  const inp = createInput();
  const keys = structuredClone(DEFAULTS.keys);
  keys.p1.left = ['KeyJ'];
  inp.setKeys(keys); inp.setMode(true);
  fire('keydown', 'KeyJ'); fire('keyup', 'KeyJ');
  assert.equal(inp.poll(0, []).left, true); inp.endFrame();
  fire('keydown', 'KeyA'); fire('keyup', 'KeyA');
  assert.equal(inp.poll(0, []).left, false); inp.endFrame();
});

// ---- つなぐ派のジェスチャー ----
const { createTsunaguGesture } = await import('../../assets/tsunagu-naraberu/input.js');
const frames = (g, n) => Array.from({ length: n }, () => g.next());

test('ジェスチャー: 横に2.4マスすべると、2刻みに分けて右へ2列', () => {
  const g = createTsunaguGesture({ cell: 40, width: 240 });
  g.down(100, 200, 0); g.move(150, 202, 0.1); g.move(196, 203, 0.2);
  const out = frames(g, 4);
  assert.deepEqual(out.map(o => o.right), [true, true, false, false]);
  g.up(196, 203, 0.25);
  assert.ok(frames(g, 3).every(o => !o.a && !o.b), 'すべったあとに離してもタップにしない');
});

test('ジェスチャー: 半マス未満の動きで離すとタップ。右半分は右回転、左半分は左回転', () => {
  const g = createTsunaguGesture({ cell: 40, width: 240 });
  g.down(200, 300, 0); g.move(210, 305, 0.05); g.up(210, 305, 0.1);
  assert.equal(g.next().b, true);
  g.down(30, 300, 1); g.up(32, 301, 1.1);
  assert.equal(g.next().a, true);
});

test('ジェスチャー: 下へすばやくはじくと、すぐ落とす', () => {
  const g = createTsunaguGesture({ cell: 40, width: 240 });
  g.down(120, 100, 0); g.move(121, 150, 0.04); g.up(122, 190, 0.08);
  const o = g.next();
  assert.equal(o.up, true);
  assert.equal(o.a || o.b, false);
});

test('ジェスチャー: ゆっくり下へ1マス以上なら、離すまで速く落とす', () => {
  const g = createTsunaguGesture({ cell: 40, width: 240 });
  g.down(120, 100, 0); g.move(120, 130, 0.3); g.move(121, 160, 0.6);
  assert.equal(g.next().downHeld, true);
  g.up(121, 160, 0.7);
  const o = g.next();
  assert.equal(o.downHeld, false);
  assert.equal(o.up, false, 'ゆっくりならすぐ落とさない');
});
