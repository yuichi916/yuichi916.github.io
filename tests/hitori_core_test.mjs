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

check('openState: off は前方の広いルールも上書きする', () => {
  // 2026-08-04(火) / 2026-08-05(水) は共に 'Mo-Sa 11:00-18:30' の範囲内だが、
  // 'Tu off' は火曜日だけをその上書きで休みにする。水曜は影響を受けない。
  const tue12 = new Date(2026, 7, 4, 12, 0);
  const wed12 = new Date(2026, 7, 5, 12, 0);
  eq(core.openState('Mo-Sa 11:00-18:30; Tu off', tue12), 'closed', 'Tu off が前方ルールを上書きしていない');
  eq(core.openState('Mo-Sa 11:00-18:30; Tu off', wed12), 'open', '上書きが火曜以外にも及んでいる');
});

check('openState: 後続の営業時間ルールが前方ルールを上書きする', () => {
  // 水曜だけ短縮営業。'We 09:00-12:00' が 'Mo-Fr 09:00-18:00' の水曜分を置き換える。
  const wed10 = new Date(2026, 7, 5, 10, 0);
  const wed15 = new Date(2026, 7, 5, 15, 0);
  const thu15 = new Date(2026, 7, 6, 15, 0);
  eq(core.openState('Mo-Fr 09:00-18:00; We 09:00-12:00', wed10), 'open', '水曜10時は短縮営業の時間内');
  eq(core.openState('Mo-Fr 09:00-18:00; We 09:00-12:00', wed15), 'closed', '水曜15時は短縮営業で閉店のはず');
  eq(core.openState('Mo-Fr 09:00-18:00; We 09:00-12:00', thu15), 'open', '木曜は元のルールのまま営業中');
});

// 100x100 の正方形を2つ持つ疑似 geo。左=県1、右=県2。
const FAKE_GEO = {
  bounds: { minx: 0, miny: 0, scale: 1, lat0: 0 },
  paths: {
    1: 'M0 0L100 0L100 100L0 100Z',
    2: 'M200 0L300 0L300 100L200 100Z',
  },
};

check('projectToSvg は可逆な向き', () => {
  const b = { minx: 100, miny: -40, scale: 2, lat0: 36 };
  const [x1, y1] = core.projectToSvg(35, 139, b);
  const [x2, y2] = core.projectToSvg(36, 139, b);
  if (!(y2 < y1)) throw new Error('北にあるほど y が小さくない');
  const [x3] = core.projectToSvg(35, 140, b);
  if (!(x3 > x1)) throw new Error('東にあるほど x が大きくない');
});

check('parseSvgPath', () => {
  const rings = core.parseSvgPath('M0 0L10 0L10 10Z M20 20L30 20L30 30Z');
  eq(rings.length, 2);
  eq(rings[0].length, 3);
  eq(rings[1][0][0], 20);
});

check('pointInRing', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  eq(core.pointInRing(5, 5, sq), true);
  eq(core.pointInRing(15, 5, sq), false);
  eq(core.pointInRing(-1, 5, sq), false);
});

check('prefectureAt: 内包', () => {
  // bounds が恒等変換なので lat/lon はそのまま x,y になる（y は符号反転）
  eq(core.prefectureAt(-50, 50, FAKE_GEO), 1);
  eq(core.prefectureAt(-50, 250, FAKE_GEO), 2);
});

check('prefectureAt: どこにも入らなければ最寄り', () => {
  // x=160 は県1(0-100)より県2(200-300)に近い…わけではないので県1が返る
  eq(core.prefectureAt(-50, 140, FAKE_GEO), 1);
  eq(core.prefectureAt(-50, 260, FAKE_GEO), 2);
  // 遥か遠方でも必ず何かを返す（null を返さない）
  const far = core.prefectureAt(-9999, 9999, FAKE_GEO);
  if (far !== 1 && far !== 2) throw new Error('遠方で県が返らない: ' + far);
});

const DOC = {
  fields: ['id', 'name', 'lat', 'lon', 'cat', 'kind', 'solo', 'quiet', 'easy',
           'conf', 'chain', 'hidden', 'hidden_n', 'city', 'oh', 'tel', 'web', 'note'],
  items: [
    ['n1', '近いチェーン', 35.0010, 139.0, 'eat', 'gyudon', 5, 4, 4, 0, 1, 0.0, 8, '', '11:00-23:00', '', '', ''],
    ['n2', '遠い独立店', 35.0500, 139.0, 'eat', 'soba_udon', 4, 4, 3, 0, 0, 0.83, 12, '', '', '', '', ''],
    ['n3', '近い図書館', 35.0005, 139.0, 'stay', 'library', 4, 5, 5, 1, 0, 0.0, 2, '', '', '', '', ''],
    ['n4', '近い立ち飲み', 35.0008, 139.0, 'eat', 'standing', 5, 2, 2, 0, 0, 0.7, 6, '', '', '', '', ''],
  ],
};

check('rowsToObjects', () => {
  const o = core.rowsToObjects(DOC);
  eq(o.length, 4);
  eq(o[0].id, 'n1');
  eq(o[0].solo, 5);
  eq(o[1].hidden, 0.83);
});

check('withDistance', () => {
  const o = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  near(o[0].distM, 111, 30);
  if (!(o[1].distM > o[0].distM)) throw new Error('遠い店の距離が近い店以下');
});

check('sortByDistance', () => {
  const o = core.sortByDistance(core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0));
  eq(JSON.stringify(o.map(x => x.id)), JSON.stringify(['n3', 'n4', 'n1', 'n2']));
});

check('filterItems: カテゴリ', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  const r = core.filterItems(all, { cats: new Set(['stay']) });
  eq(r.length, 1);
  eq(r[0].id, 'n3');
});

check('filterItems: 距離', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { maxDistM: 400 }).length, 3, '400m以内は3件');
  eq(core.filterItems(all, { maxDistM: null }).length, 4, 'null は無制限');
});

check('filterItems: 3軸の下限', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { minSolo: 5 }).length, 2, 'solo>=5 は n1,n4');
  eq(core.filterItems(all, { minQuiet: 5 }).length, 1, 'quiet>=5 は図書館だけ');
  eq(core.filterItems(all, { minEasy: 4 }).length, 2, 'easy>=4 は n1,n3');
});

check('filterItems: チェーンと信頼度と営業時間', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, { nochain: true }).length, 3);
  eq(core.filterItems(all, { minConf: 1 }).length, 1);
  eq(core.filterItems(all, { requireHours: true }).length, 1, 'oh があるのは n1 だけ');
});

check('filterItems: 条件は積で効く', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  const r = core.filterItems(all, { cats: new Set(['eat']), nochain: true, minQuiet: 4 });
  eq(r.length, 1);
  eq(r[0].id, 'n2');
});

check('filterItems: 空の opts は素通し', () => {
  const all = core.withDistance(core.rowsToObjects(DOC), 35.0, 139.0);
  eq(core.filterItems(all, {}).length, 4);
});

const PLACES = [
  { name: '渋谷', lat: 35.658, lon: 139.701, type: 's', pref: 13 },
  { name: '渋谷駅', lat: 35.659, lon: 139.702, type: 's', pref: 13 },
  { name: '渋谷区', lat: 35.664, lon: 139.698, type: 'c', pref: 13 },
  { name: '府中駅', lat: 35.672, lon: 139.478, type: 's', pref: 13 },
  { name: '府中駅', lat: 34.567, lon: 133.235, type: 's', pref: 34 },
  { name: '新宿三丁目駅', lat: 35.690, lon: 139.705, type: 's', pref: 13 },
];

check('searchPlaces: 部分一致', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r.length, 3);
});

check('searchPlaces: 駅ありでも駅なしの名前に当たる', () => {
  // 入力「渋谷駅」で、OSM側の名前が「渋谷」の駅を取りこぼさない
  const names = core.searchPlaces(PLACES, '渋谷駅').map(p => p.name);
  if (!names.includes('渋谷')) throw new Error('駅を外した名前に当たらない: ' + names);
  if (!names.includes('渋谷駅')) throw new Error('そのままの名前に当たらない: ' + names);
});

check('searchPlaces: 駅が市区町村より上', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r[r.length - 1].type, 'c', '市区町村が最後でない');
  if (r.slice(0, -1).some(p => p.type === 'c')) throw new Error('駅より上に市区町村がある');
});

check('searchPlaces: 完全一致を優先', () => {
  const r = core.searchPlaces(PLACES, '渋谷');
  eq(r[0].name, '渋谷');
});

check('searchPlaces: 同名は県違いで両方残る', () => {
  const r = core.searchPlaces(PLACES, '府中');
  eq(r.length, 2);
  eq(new Set(r.map(p => p.pref)).size, 2);
});

check('searchPlaces: 空・空白は空配列', () => {
  eq(core.searchPlaces(PLACES, '').length, 0);
  eq(core.searchPlaces(PLACES, '   ').length, 0);
  eq(core.searchPlaces(PLACES, null).length, 0);
});

check('searchPlaces: 一致なし', () => {
  eq(core.searchPlaces(PLACES, 'ぜったいにない地名').length, 0);
});

check('searchPlaces: limit', () => {
  eq(core.searchPlaces(PLACES, '駅', 2).length, 2);
});

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('OK: core');
