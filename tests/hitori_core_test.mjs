// ひとり歓迎マップの純関数テスト。DOM も fetch も使わない。
// 実行: node tests/hitori_core_test.mjs
import * as core from '../assets/hitori/core.js';

let failures = 0;
function check(name, fn) {
  try { fn(); } catch (e) { failures++; console.error(`FAIL ${name}: ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg || ''} expected ~${b}, got ${a}`);
}

check('haversineM', () => {
  // 東京駅と有楽町駅はおよそ800m
  near(core.haversineM(35.6812, 139.7671, 35.6749, 139.7630), 800, 250);
  near(core.haversineM(35.0, 139.0, 35.0, 139.0), 0, 0.001);
  // 緯度35度で経度0.00033度はおよそ30m
  near(core.haversineM(35.0, 139.0, 35.0, 139.00033), 30, 5);
});

check('bearing8', () => {
  eq(core.bearing8(35.0, 139.0, 36.0, 139.0), '北');
  eq(core.bearing8(35.0, 139.0, 34.0, 139.0), '南');
  eq(core.bearing8(35.0, 139.0, 35.0, 140.0), '東');
  eq(core.bearing8(35.0, 139.0, 35.0, 138.0), '西');
  eq(core.bearing8(35.0, 139.0, 35.5, 139.5), '北東');
  eq(core.bearing8(35.0, 139.0, 34.5, 138.5), '南西');
});

check('walkMinutes', () => {
  eq(core.walkMinutes(400), 5);
  eq(core.walkMinutes(800), 10);
  eq(core.walkMinutes(10), 1, '極近でも0分にしない');
  eq(core.walkMinutes(401), 6, '切り上げ');
});

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('OK: core');
