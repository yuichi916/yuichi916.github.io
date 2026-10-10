import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecords, saveRecords, recordResult, emptyRecords, KEY } from '../../assets/tsunagu-naraberu/records.js';

const store = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('何もなければ空の戦績', () => {
  const r = loadRecords(store());
  assert.deepEqual(r, emptyRecords());
  assert.equal(r.plays, 0);
});

test('CPU戦: 段別・キャラ別の勝敗、最大連鎖と最大攻撃', () => {
  const r = emptyRecords();
  let b = recordResult(r, { mode: 'cpu', level: 'ふつう', chars: ['hinata', 'rin'], result: 'win', maxChain: 3, attack: 120.4 });
  assert.deepEqual(b, { newBestChain: true, newBestAttack: true });
  b = recordResult(r, { mode: 'cpu', level: 'ふつう', chars: ['hinata', 'suzu'], result: 'lose', maxChain: 2, attack: 50 });
  assert.deepEqual(b, { newBestChain: false, newBestAttack: false });
  recordResult(r, { mode: 'cpu', level: 'つよい', chars: ['momo', 'rin'], result: 'draw', maxChain: 5, attack: 10 });
  assert.equal(r.plays, 3);
  assert.deepEqual(r.cpu['ふつう'], { win: 1, lose: 1, draw: 0 });
  assert.deepEqual(r.cpu['つよい'], { win: 0, lose: 0, draw: 1 });
  assert.deepEqual(r.chars.hinata, { win: 1, lose: 1, plays: 2 });
  assert.equal(r.bestChain, 5);
  assert.equal(r.bestAttack, 120);
});

test('2人対戦は回数と1Pキャラの plays だけ、練習とチュートリアルは数えない', () => {
  const r = emptyRecords();
  recordResult(r, { mode: '2p', chars: ['rin', 'momo'], result: 'win', maxChain: 9, attack: 999 });
  assert.equal(r.plays, 1);
  assert.equal(r.chars.rin.plays, 1);
  assert.equal(r.chars.rin.win, 0);
  assert.equal(r.bestChain, 0, '2人対戦の記録は自己ベストにしない（相手が人なので）');
  const b = recordResult(r, { mode: 'practice', chars: ['rin'], result: 'win', maxChain: 9, attack: 1 });
  assert.deepEqual(b, { newBestChain: false, newBestAttack: false });
  assert.equal(r.plays, 1);
});

test('保存して読み戻せる。壊れた保存は空から数え直す', () => {
  const st = store();
  const r = emptyRecords();
  recordResult(r, { mode: 'cpu', level: 'やさしい', chars: ['suzu', 'momo'], result: 'win', maxChain: 2, attack: 30 });
  saveRecords(st, r);
  assert.deepEqual(loadRecords(st), r);
  assert.deepEqual(loadRecords(store({ [KEY]: 'not json' })), emptyRecords());
  assert.deepEqual(loadRecords(store({ [KEY]: '{"plays":"x"}' })), emptyRecords());
});
