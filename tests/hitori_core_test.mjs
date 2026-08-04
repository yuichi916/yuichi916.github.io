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

check('parseOpeningHours: 基本形', () => {
  const r = core.parseOpeningHours('11:00-23:00');
  eq(r.length, 1);
  eq(r[0].days.length, 7, '曜日指定なしは毎日');
  eq(r[0].spans[0][0], 660);
  eq(r[0].spans[0][1], 1380);
});

check('parseOpeningHours: 曜日範囲と複数区間', () => {
  const r = core.parseOpeningHours('Mo-Fr 11:00-14:00,17:00-22:00');
  eq(r.length, 1);
  eq(JSON.stringify(r[0].days), JSON.stringify([1, 2, 3, 4, 5]));
  eq(r[0].spans.length, 2);
  eq(r[0].spans[1][0], 1020);
});

check('parseOpeningHours: 複数ルール', () => {
  const r = core.parseOpeningHours('Mo-Fr 09:00-18:00; Sa 09:00-12:00');
  eq(r.length, 2);
  eq(JSON.stringify(r[1].days), JSON.stringify([6]));
});

check('parseOpeningHours: 24/7', () => {
  const r = core.parseOpeningHours('24/7');
  eq(r[0].days.length, 7);
  eq(r[0].spans[0][1], 1440);
});

check('parseOpeningHours: 日をまたぐ', () => {
  const r = core.parseOpeningHours('18:00-02:00');
  eq(r[0].spans[0][0], 1080);
  eq(r[0].spans[0][1], 1560, '翌日02:00は1440+120');
});

check('parseOpeningHours: off は休みとして無視してよい', () => {
  // ルールが無い曜日は休みなので、off を落としても結果は同じ
  const r = core.parseOpeningHours('Mo-Fr 09:00-18:00; Sa,Su off');
  eq(r.length, 1);
  eq(JSON.stringify(r[0].days), JSON.stringify([1, 2, 3, 4, 5]));
});

check('parseOpeningHours: 解釈できないものは null', () => {
  for (const s of ['', null, undefined, 'sunrise-sunset', 'Mo-Fr 09:00-18:00; PH off',
                   'Jan-Mar 10:00-17:00', 'week 1-53 10:00-17:00', 'なんか変な文字列']) {
    eq(core.parseOpeningHours(s), null, `${JSON.stringify(s)} が null にならない`);
  }
});

check('openState', () => {
  // 2026-08-04 は火曜日
  const tue14 = new Date(2026, 7, 4, 14, 0);
  const tue23 = new Date(2026, 7, 4, 23, 0);
  const sat14 = new Date(2026, 7, 8, 14, 0);

  eq(core.openState('11:00-23:00', tue14), 'open');
  eq(core.openState('11:00-23:00', tue23), 'closed', '23:00ちょうどは閉店');
  eq(core.openState('Mo-Fr 09:00-18:00', sat14), 'closed');
  eq(core.openState('Mo-Fr 09:00-18:00', tue14), 'open');
  eq(core.openState('24/7', tue23), 'open');

  // 日をまたぐ営業。水曜01:00は火曜18:00-02:00の営業中。
  const wed01 = new Date(2026, 7, 5, 1, 0);
  eq(core.openState('Mo-Fr 18:00-02:00', wed01), 'open');

  // 不明は null。営業中と偽らない。
  eq(core.openState('', tue14), null);
  eq(core.openState('sunrise-sunset', tue14), null);
});

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('OK: core');
