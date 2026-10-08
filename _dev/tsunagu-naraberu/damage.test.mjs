import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../../assets/tsunagu-naraberu/config.js';
import { createRng } from '../../assets/tsunagu-naraberu/rng.js';
import {
  tsunaguDamage, naraberuDamage, sendAttack, addPending, landTsunagu, landNaraberu,
} from '../../assets/tsunagu-naraberu/damage.js';

const cfg = { ...CFG, atkMulT: 1, atkMulN: 1, convT: 1, convN: 1, chainStepN: 6, naraberuLandSec: 3 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('rng: 同じシードで同じ列', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) { const v = r.int(5); assert.ok(v >= 0 && v < 5); }
});

test('つなぐ派: 4個1連鎖1色 = 40/70', () => {
  near(tsunaguDamage({ n: 4, chain: 1, groupSizes: [4], colors: 1 }, cfg), 40 / 70);
});
test('つなぐ派: 4個2連鎖 = 320/70', () => {
  near(tsunaguDamage({ n: 4, chain: 2, groupSizes: [4], colors: 1 }, cfg), 320 / 70);
});
test('つなぐ派: 5個3連鎖2色 = 15', () => {
  // 5個は1群(GB=2)、2色(CB=3) は群が別色という想定で GB は群ごと: [5]→2 のみ
  near(tsunaguDamage({ n: 5, chain: 3, groupSizes: [5], colors: 2 }, cfg), 10 * 5 * (16 + 2 + 3) / 70);
  near(tsunaguDamage({ n: 5, chain: 3, groupSizes: [5], colors: 2 }, cfg), 15);
});
test('つなぐ派: atkMulT が掛かる', () => {
  near(tsunaguDamage({ n: 4, chain: 2, groupSizes: [4], colors: 1 }, { ...cfg, atkMulT: 2 }), 640 / 70);
});

test('ならべる派: 同時4個1連鎖=3、同時3個2連鎖=6、同時5個3連鎖=16', () => {
  near(naraberuDamage({ n: 4, chain: 1 }, cfg), 3);
  near(naraberuDamage({ n: 3, chain: 1 }, cfg), 0);
  near(naraberuDamage({ n: 3, chain: 2 }, cfg), 6);
  near(naraberuDamage({ n: 5, chain: 3 }, cfg), 16);
});

test('相殺: 自分の予告から先に引く', () => {
  const own = { D: 10, age: 0 }, opp = { D: 0, age: 0 };
  assert.equal(sendAttack(4, own, opp), 0);
  near(own.D, 6); near(opp.D, 0);
  const own2 = { D: 3, age: 0 }, opp2 = { D: 0, age: 0 };
  near(sendAttack(8, own2, opp2), 5);
  near(own2.D, 0); near(opp2.D, 5);
});

test('ならべる派の分割: 6,9,14,2', () => {
  const ready = D => ({ D, age: 999 });
  assert.deepEqual(landNaraberu(ready(6), cfg), [{ w: 6, h: 1 }]);
  assert.deepEqual(landNaraberu(ready(9), cfg), [{ w: 6, h: 1 }, { w: 3, h: 1 }]);
  const p14 = ready(14);
  assert.deepEqual(landNaraberu(p14, cfg), [{ w: 6, h: 2 }]);
  near(p14.D, 2);
  const p2 = ready(2);
  assert.deepEqual(landNaraberu(p2, cfg), []);
  near(p2.D, 2);
});

test('ならべる派: 猶予前は着弾しない', () => {
  const p = { D: 12, age: 3 * 60 - 1 };
  assert.deepEqual(landNaraberu(p, cfg), []);
  near(p.D, 12);
});

test('ならべる派: 高さは12まで', () => {
  const p = { D: 6 * 15, age: 999 };
  assert.deepEqual(landNaraberu(p, cfg), [{ w: 6, h: 12 }]);
  near(p.D, 18);
});

test('予告の age: 3マス未満の予告に足したら0に戻る、3以上なら保つ', () => {
  const p = { D: 2, age: 500 };
  addPending(p, 4, cfg);
  near(p.D, 6); assert.equal(p.age, 0);
  p.age = 100;
  addPending(p, 6, cfg);
  assert.equal(p.age, 100);
});

test('つなぐ派: 1回最大30個、残りは予告に残る', () => {
  const p = { D: 40.2, age: 0 };
  assert.equal(landTsunagu(p, cfg), 30);
  near(p.D, 10.2);
  const q = { D: 0.7, age: 0 };
  assert.equal(landTsunagu(q, cfg), 0);
  near(q.D, 0.7);
});
