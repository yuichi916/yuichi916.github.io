import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, loadSettings, saveSettings, rebind, KEY_V2, KEY_V1 } from '../../assets/tsunagu-naraberu/settings.js';

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test('何も保存がなければ既定値', () => {
  const s = loadSettings(store());
  assert.deepEqual(s, DEFAULTS);
  assert.notEqual(s, DEFAULTS, '既定値そのものを返さない（書き換えで既定値が壊れない）');
  assert.deepEqual(s.chars, ['hinata', 'rin']);
  assert.equal(s.das, 10); assert.equal(s.arr, 2);
});

test('旧形式（tn-settings の kinds）を読み替える', () => {
  const s = loadSettings(store({ [KEY_V1]: JSON.stringify({ mode: '2p', kinds: ['naraberu', 'naraberu'], level: 'つよい', handicap: [1, 0] }) }));
  assert.equal(s.mode, '2p');
  assert.deepEqual(s.chars, ['rin', 'suzu'], '同じ派どうしなら2人目は別キャラ');
  assert.equal(s.level, 'つよい');
  assert.deepEqual(s.handicap, [1, 0]);
});

test('旧形式に chars があればそれを使う', () => {
  const s = loadSettings(store({ [KEY_V1]: JSON.stringify({ chars: ['momo', 'suzu'] }) }));
  assert.deepEqual(s.chars, ['momo', 'suzu']);
});

test('保存して読み戻せる（足りない項目は既定値で埋まる）', () => {
  const st = store();
  const s = loadSettings(st);
  s.das = 7; s.keys.p1.a = ['KeyJ'];
  saveSettings(st, s);
  const t = loadSettings(st);
  assert.equal(t.das, 7);
  assert.deepEqual(t.keys.p1.a, ['KeyJ']);
  st.setItem(KEY_V2, JSON.stringify({ das: 5 }));
  const u = loadSettings(st);
  assert.equal(u.das, 5);
  assert.deepEqual(u.keys, DEFAULTS.keys);
});

test('壊れた JSON でも既定値で起動する', () => {
  assert.deepEqual(loadSettings(store({ [KEY_V2]: '{oops' })), DEFAULTS);
});

test('知らないキャラは既定のキャラに置き換える', () => {
  const s = loadSettings(store({ [KEY_V2]: JSON.stringify({ chars: ['nobody', 'rin'] }) }));
  assert.deepEqual(s.chars, ['hinata', 'rin']);
});

test('rebind: 同じキーの古い割り当てを、ほかの操作・プレイヤーから外す', () => {
  const keys = structuredClone(DEFAULTS.keys);
  rebind(keys, 'p1', 'a', 'ArrowUp'); // ArrowUp は p2.up に使われている
  assert.deepEqual(keys.p1.a, ['ArrowUp']);
  assert.ok(!keys.p2.up.includes('ArrowUp'));
  assert.ok(!keys.p1.up.includes('ArrowUp'));
  rebind(keys, 'p2', 'left', 'KeyF');
  assert.ok(!keys.p1.a.includes('KeyF'));
});
