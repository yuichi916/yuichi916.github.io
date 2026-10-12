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

test('型は合っていても範囲外・知らない値は既定値に直す（段・遊び方・ハンデ・音量・キー）', () => {
  const st = store({ [KEY_V2]: JSON.stringify({
    level: 'むずかしい', mode: 'online', handicap: [9, 'x', 1], volume: { bgm: 500, se: -3, voice: 'a' },
    keys: { p1: { left: [3, 'KeyQ'], right: 'KeyE' } }, das: 999, arr: 0,
  }) });
  const s = loadSettings(st);
  assert.equal(s.level, DEFAULTS.level);
  assert.equal(s.mode, DEFAULTS.mode);
  assert.deepEqual(s.handicap, [2, 0]);
  assert.deepEqual(s.volume, { bgm: 100, se: 0, voice: DEFAULTS.volume.voice });
  assert.deepEqual(s.keys.p1.left, ['KeyQ']);
  assert.deepEqual(s.keys.p1.right, DEFAULTS.keys.p1.right);
  assert.equal(s.das, 20); assert.equal(s.arr, 1);
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
