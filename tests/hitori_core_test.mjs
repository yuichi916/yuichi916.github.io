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
  { name: '渋谷', lat: 35.658, lon: 139.701, type: 's', pref: 13, n: 0 },
  { name: '渋谷駅', lat: 35.659, lon: 139.702, type: 's', pref: 13, n: 0 },
  { name: '渋谷区', lat: 35.664, lon: 139.698, type: 'c', pref: 13, n: 0 },
  { name: '府中駅', lat: 35.672, lon: 139.478, type: 's', pref: 13, n: 0 },
  { name: '府中駅', lat: 34.567, lon: 133.235, type: 's', pref: 34, n: 0 },
  { name: '新宿三丁目駅', lat: 35.690, lon: 139.705, type: 's', pref: 13, n: 0 },
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

check('searchPlaces: 知名度（n）が「駅を先に」より優先する', () => {
  // 別府＝大分県の有名な温泉地（周辺施設が多い＝nが高い）と、
  // 兵庫県の目立たない駅（nが低い）。型だけで駅を先に出す既定ルールでは
  // 無名の駅が有名な自治体より上に来てしまうため、nがその逆転を正す。
  const beppu = [
    { name: '別府駅', lat: 34.72, lon: 135.17, type: 's', pref: 28, n: 3 },
    { name: '別府市', lat: 33.28, lon: 131.49, type: 'c', pref: 44, n: 250 },
  ];
  const r = core.searchPlaces(beppu, '別府');
  eq(r[0].name, '別府市', '知名度が高い自治体が駅より下に沈んでいる');
  eq(r[0].pref, 44, '大分県が兵庫県より先に来ていない');
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

const TH = { bath: 3000, eat: 900, play: 5000, stay: 2000 };
const SORTABLE = [
  { id: 'a', cat: 'eat', solo: 3, quiet: 5, hidden: 0.0, iso: 100,  distM: 100, oh: '' },
  { id: 'b', cat: 'eat', solo: 5, quiet: 2, hidden: 0.9, iso: 200,  distM: 300, oh: '00:00-24:00' },
  { id: 'c', cat: 'bath', solo: 4, quiet: 4, hidden: 0.0, iso: 6000, distM: 200, oh: 'Mo 01:00-02:00' },
];

check('findScore: 飲食は穴場度、湯は孤立度が効く', () => {
  near(core.findScore(SORTABLE[1], TH), 0.9, 0.001);
  // bath: iso 6000 / threshold 3000 → 1.0 に丸まる
  near(core.findScore(SORTABLE[2], TH), 1.0, 0.001);
  near(core.findScore(SORTABLE[0], TH), 100 / 900, 0.001);
});

check('findScore: しきい値が無いカテゴリでも落ちない', () => {
  near(core.findScore({ cat: 'unknown', hidden: 0.3, iso: 500 }, TH), 0.3, 0.001);
});

check('openRank: 営業中→不明→営業時間外', () => {
  // 2026-08-04 は火曜
  const tue = new Date(2026, 7, 4, 12, 0);
  eq(core.openRank({ oh: '00:00-24:00' }, tue), 0, '営業中');
  eq(core.openRank({ oh: '' }, tue), 1, '不明は営業時間外より上');
  eq(core.openRank({ oh: 'Mo 01:00-02:00' }, tue), 2, '営業時間外');
});

check('sortItems: 距離順が既定', () => {
  const r = core.sortItems(SORTABLE, 'dist', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'acb');
});

check('sortItems: ひとり度は降順、同点は距離', () => {
  const r = core.sortItems(SORTABLE, 'solo', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'b');
});

check('sortItems: 発見度', () => {
  const r = core.sortItems(SORTABLE, 'find', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'c', 'iso で 1.0 の bath が先頭');
});

check('sortItems: 静けさ', () => {
  const r = core.sortItems(SORTABLE, 'quiet', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r[0].id, 'a');
});

check('sortItems: 営業中優先は 営業中→不明→営業時間外', () => {
  const r = core.sortItems(SORTABLE, 'open', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'bac', '不明(a)が営業時間外(c)より上にない');
});

check('sortItems: 入力を破壊しない', () => {
  const before = SORTABLE.map(x => x.id).join('');
  core.sortItems(SORTABLE, 'solo', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(SORTABLE.map(x => x.id).join(''), before);
});

check('sortItems: 未知の並べ替えは距離順に落とす', () => {
  const r = core.sortItems(SORTABLE, 'なにか', { isoThreshold: TH, now: new Date(2026, 7, 4, 12, 0) });
  eq(r.map(x => x.id).join(''), 'acb');
});

function fakeStorage(broken) {
  const map = new Map();
  return {
    getItem: k => (broken ? (() => { throw new Error('denied'); })() : (map.has(k) ? map.get(k) : null)),
    setItem: (k, v) => { if (broken) throw new Error('denied'); map.set(k, v); },
  };
}

const FAV_ITEM = {
  id: 'n1', name: 'はやし湯', lat: 35.0, lon: 139.0, cat: 'bath', kind: 'sento',
  solo: 4, quiet: 4, easy: 3, chain: 0, prefCode: 13,
  distM: 500, oh: '', note: 'メモ', hidden: 0.1, iso: 800,
};

check('favSnapshot: 11項目だけ持つ', () => {
  const s = core.favSnapshot(FAV_ITEM);
  eq(JSON.stringify(Object.keys(s).sort()),
     JSON.stringify(['cat','chain','easy','id','kind','lat','lon','name','prefCode','quiet','solo']));
  eq(s.id, 'n1');
  eq(s.distM, undefined, '距離は起点依存なので保存しない');
});

check('loadFavs: 空なら空配列', () => {
  eq(JSON.stringify(core.loadFavs(fakeStorage(false))), '[]');
});

check('loadFavs: 使えない環境では null', () => {
  eq(core.loadFavs(fakeStorage(true)), null);
});

check('saveFavs: 成否を返す', () => {
  eq(core.saveFavs(fakeStorage(false), [core.favSnapshot(FAV_ITEM)]), true);
  eq(core.saveFavs(fakeStorage(true), []), false);
});

check('保存して読み戻せる', () => {
  const st = fakeStorage(false);
  core.saveFavs(st, [core.favSnapshot(FAV_ITEM)]);
  const back = core.loadFavs(st);
  eq(back.length, 1);
  eq(back[0].name, 'はやし湯');
});

check('toggleFav: 追加と削除', () => {
  let favs = [];
  favs = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 1);
  eq(core.isFav(favs, 'n1'), true);
  favs = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 0);
  eq(core.isFav(favs, 'n1'), false);
});

check('toggleFav: 新しい配列を返し元を壊さない', () => {
  const favs = [];
  const next = core.toggleFav(favs, FAV_ITEM);
  eq(favs.length, 0);
  eq(next.length, 1);
});

check('toggleFav: 上限を超えたら古いものを落とす', () => {
  let favs = [];
  for (let i = 0; i < core.FAV_MAX + 5; i++) {
    favs = core.toggleFav(favs, { ...FAV_ITEM, id: 'n' + i });
  }
  eq(favs.length, core.FAV_MAX);
  eq(core.isFav(favs, 'n0'), false, '最古が残っている');
  eq(core.isFav(favs, 'n' + (core.FAV_MAX + 4)), true, '最新が無い');
});

check('loadFavs: 壊れたJSONは空配列にフォールバック', () => {
  const st = fakeStorage(false);
  st.setItem(core.FAV_KEY, '{壊れている');
  eq(JSON.stringify(core.loadFavs(st)), '[]');
});

const LEAD_BASE = { cat: 'bath', kind: 'sento', solo: 4, quiet: 4, easy: 3, hidden: 0.0, hidden_n: 2, iso: 400 };

check('leadSentence: 孤立が最優先', () => {
  const s = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', catJa: '湯・サウナ', isolated: true, isoText: '4.2km' });
  // iso は同カテゴリまでの距離なので、業態名（銭湯）ではなくカテゴリ名を使う
  eq(s.startsWith('最寄りの湯・サウナまで4.2km。この一帯で唯一。'), true, s);
  eq(s.includes('最寄りの銭湯'), false, '業態名で孤立を語っている: ' + s);
});

check('leadSentence: 密集は孤立でないときだけ', () => {
  const s = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', isolated: false, sameKindNearby: 4 });
  eq(s.startsWith('半径500mに同じ銭湯が4軒。'), true, s);
  const t = core.leadSentence(LEAD_BASE, { kindJa: '銭湯', catJa: '湯・サウナ', isolated: true, isoText: '4.2km', sameKindNearby: 4 });
  eq(t.includes('半径500m'), false, '孤立と密集が同時に出ている: ' + t);
});

check('leadSentence: 穴場は件数を出す', () => {
  const it = { ...LEAD_BASE, hidden: 0.83, hidden_n: 12 };
  const s = core.leadSentence(it, { kindJa: '銭湯', gem: true });
  eq(s.includes('周辺12軒のうち10軒がチェーン。ここはその10軒に入っていない。'), true, s);
});

check('leadSentence: 静けさと入りやすさ', () => {
  eq(core.leadSentence({ ...LEAD_BASE, quiet: 5 }, { kindJa: '図書館' }).includes('会話が発生しない。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, quiet: 2 }, { kindJa: '立ち飲み' }).includes('声を出す場。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, easy: 2 }, { kindJa: '角打ち' }).includes('常連の作法がある。'), true);
  eq(core.leadSentence({ ...LEAD_BASE, easy: 5 }, { kindJa: '映画館' }).includes('作法は要らない。'), true);
});

check('leadSentence: 1文目は具体的な事実、2文目は軸の節ひとつだけ', () => {
  // 軸の節を2つ並べると、静か5・入りやすさ5の業態がすべて同じ文になる
  // （実測で全体の17%）。1文目に必ず数字を入れることでそれを避ける。
  const it = { ...LEAD_BASE, quiet: 5, easy: 5, solo: 5, hidden: 0.9, hidden_n: 10 };
  const s = core.leadSentence(it, { kindJa: '銭湯', catJa: '湯・サウナ', isolated: true, isoText: '4.2km', gem: true });
  eq(s, '最寄りの湯・サウナまで4.2km。この一帯で唯一。会話が発生しない。');
  eq(s.includes('作法は要らない。'), false, '軸の節が2つ採られている: ' + s);
  eq(s.includes('ひとりが標準。'), false, '軸の節が2つ採られている: ' + s);
});

check('leadSentence: 1文目の優先順位は 孤立 > 穴場 > 密集 > 最寄り距離', () => {
  const it = { ...LEAD_BASE, quiet: 3, easy: 3, solo: 3, hidden: 0.83, hidden_n: 12 };
  const base = { kindJa: '銭湯', catJa: '湯・サウナ', isoText: '340m' };
  eq(core.leadSentence(it, { ...base, isolated: true, isoText: '4.2km', gem: true, sameKindNearby: 5 }),
     '最寄りの湯・サウナまで4.2km。この一帯で唯一。');
  eq(core.leadSentence(it, { ...base, gem: true, sameKindNearby: 5 }),
     '周辺12軒のうち10軒がチェーン。ここはその10軒に入っていない。');
  eq(core.leadSentence(it, { ...base, sameKindNearby: 5 }),
     '半径500mに同じ銭湯が5軒。');
  eq(core.leadSentence(it, base), '最寄りの湯・サウナまで340m。');
});

check('leadSentence: どの文にも施設ごとに異なる数字か性質が入る', () => {
  // 汎用の文だけで終わる施設が出ないこと
  const s = core.leadSentence({ ...LEAD_BASE, quiet: 3, easy: 3, solo: 3 },
                              { kindJa: '銭湯', catJa: '湯・サウナ', isoText: '340m' });
  eq(/\d/.test(s), true, '数字が1つも入っていない: ' + s);
});

check('leadSentence: どれにも当たらなくても空にしない', () => {
  const it = { ...LEAD_BASE, solo: 3, quiet: 3, easy: 3, hidden: 0, hidden_n: 0 };
  // 孤立度が渡されていれば、それを事実として述べる（約4分の1の施設がここに来る）
  const s = core.leadSentence(it, { kindJa: 'ゲストハウス', catJa: 'ひとり滞在', isoText: '340m' });
  eq(s, '最寄りのひとり滞在まで340m。');
  // 孤立度すら無いときだけ業態とひとり度に落とす
  const t = core.leadSentence(it, { kindJa: 'ゲストハウス', catJa: 'ひとり滞在' });
  eq(t, 'ゲストハウス。ひとり度3。');
});

check('leadSentence: 断定しない語を使わない', () => {
  // 「静かです」「空いています」のような断定は3軸が推定である以上使えない
  const bad = ['静かです', '空いて', '必ず', 'おすすめです'];
  for (const q of [5, 4, 2]) for (const e of [5, 3, 2]) {
    const s = core.leadSentence({ ...LEAD_BASE, quiet: q, easy: e }, { kindJa: '銭湯' });
    for (const b of bad) eq(s.includes(b), false, `${b} が含まれる: ${s}`);
  }
});

const CEN = { id: 'n1', lat: 35.0, lon: 139.0, cat: 'bath' };

check('constellation: 中心は原点', () => {
  const c = core.constellation(CEN, [CEN], {});
  eq(c.points.length, 1);
  near(c.points[0].x, 0, 0.01);
  near(c.points[0].y, 0, 0.01);
  eq(c.points[0].self, true);
});

check('constellation: 北が上（yが負）', () => {
  const north = { id: 'n2', lat: 35.009, lon: 139.0, cat: 'eat' };   // 約1km北
  const c = core.constellation(CEN, [CEN, north], {});
  const p = c.points.find(x => !x.self);
  eq(p.y < 0, true, '北の点が下にある: ' + p.y);
  near(p.x, 0, 1);
});

check('constellation: 東が右（xが正）', () => {
  const east = { id: 'n3', lat: 35.0, lon: 139.011, cat: 'eat' };    // 約1km東
  const c = core.constellation(CEN, [CEN, east], {});
  const p = c.points.find(x => !x.self);
  eq(p.x > 0, true, '東の点が左にある: ' + p.x);
});

check('constellation: 半径外は落とす', () => {
  const far = { id: 'n4', lat: 35.03, lon: 139.0, cat: 'eat' };      // 約3.3km
  const c = core.constellation(CEN, [CEN, far], {});
  eq(c.points.length, 1);
});

check('constellation: 距離が線形に写像される', () => {
  const half = { id: 'n5', lat: 35.00674, lon: 139.0, cat: 'eat' };  // 約750m = 半径の半分
  const c = core.constellation(CEN, [CEN, half], { r: 130, radiusM: 1500 });
  const p = c.points.find(x => !x.self);
  near(Math.abs(p.y), 65, 6);
});

check('constellation: 中心に近い順に上限で切る', () => {
  const many = [CEN];
  for (let i = 0; i < 300; i++) {
    many.push({ id: 'x' + i, lat: 35.0 + 0.00004 * (i + 1), lon: 139.0, cat: 'eat' });
  }
  const c = core.constellation(CEN, many, { maxPoints: 120 });
  eq(c.points.length, 120);
  // 中心に近い順
  const ds = c.points.map(p => p.distM);
  eq(JSON.stringify(ds), JSON.stringify(ds.slice().sort((a, b) => a - b)));
  eq(c.points[0].self, true, '中心が落ちている');
});

check('constellation: 周辺0件でも落ちない', () => {
  const c = core.constellation(CEN, [], {});
  eq(c.points.length, 0);
  eq(c.rings.length, 3);
  eq(c.r > 0, true);
});

const FAC = [
  { id: 'a', name: '駅前高等温泉', cat: 'bath', kind: 'onsen', distM: 135 },
  { id: 'b', name: '高等温泉', cat: 'bath', kind: 'onsen', distM: 900 },
  { id: 'c', name: '別府ブルーバード劇場', cat: 'play', kind: 'cinema', distM: 207 },
  { id: 'd', name: '温泉たまご屋', cat: 'eat', kind: 'ramen', distM: 50 },
];

check('searchFacilities: 部分一致', () => {
  eq(core.searchFacilities(FAC, '温泉').length, 3);
});

check('searchFacilities: 完全一致を先頭に', () => {
  eq(core.searchFacilities(FAC, '高等温泉')[0].id, 'b');
});

check('searchFacilities: 同点なら短い名前が先', () => {
  const r = core.searchFacilities(FAC, '温泉');
  eq(r[0].name.length <= r[1].name.length, true, r.map(x => x.name).join(','));
});

check('searchFacilities: 空・空白・nullは空配列', () => {
  eq(core.searchFacilities(FAC, '').length, 0);
  eq(core.searchFacilities(FAC, '  ').length, 0);
  eq(core.searchFacilities(FAC, null).length, 0);
});

check('searchFacilities: 一致なし', () => {
  eq(core.searchFacilities(FAC, 'ぜったいにない').length, 0);
});

check('searchFacilities: limit', () => {
  eq(core.searchFacilities(FAC, '温泉', 2).length, 2);
});

check('searchFacilities: 入力を破壊しない', () => {
  const before = FAC.map(x => x.id).join('');
  core.searchFacilities(FAC, '温泉');
  eq(FAC.map(x => x.id).join(''), before);
});

check('leadFact / leadAxis: 合成すると leadSentence と一致する', () => {
  const it = { ...LEAD_BASE, quiet: 5, easy: 5, solo: 5 };
  const ctx = { kindJa: '銭湯', catJa: '湯・サウナ', isolated: true, isoText: '4.2km' };
  eq(core.leadFact(it, ctx) + core.leadAxis(it), core.leadSentence(it, ctx));
});

check('leadFact: 軸の言い回しを含まない', () => {
  // 一覧は3軸を言葉で別途出すので、事実だけを返せないと同じことを二度言う
  const axisWords = ['会話が発生しない', '声を出す場', '常連の作法がある', '作法は要らない', 'ひとりが標準'];
  for (const q of [5, 3, 2]) for (const e of [5, 3, 2]) for (const so of [5, 4, 3]) {
    const f = core.leadFact({ ...LEAD_BASE, quiet: q, easy: e, solo: so },
                            { kindJa: '銭湯', catJa: '湯・サウナ', isoText: '340m' });
    for (const w of axisWords) eq(f.includes(w), false, `${w} が事実の節に混ざっている: ${f}`);
  }
});

check('leadAxis: 該当しなければ空文字', () => {
  eq(core.leadAxis({ ...LEAD_BASE, quiet: 3, easy: 3, solo: 3 }), '');
});

check('半径のリテラルが二重に存在しない', () => {
  eq(core.SAME_KIND_RADIUS_M, 500);
  eq(core.SAME_KIND_MIN, 3);
  const f = core.leadFact(LEAD_BASE, { kindJa: '銭湯', catJa: '湯・サウナ', sameKindNearby: core.SAME_KIND_MIN });
  eq(f.includes(`半径${core.SAME_KIND_RADIUS_M}m`), true, f);
});


check('leadFact: 穴場の文がこの店をチェーン側と読ませない', () => {
  // 「その中の一軒」はチェーン側の一軒に読める。実際は逆である。
  const it = { ...LEAD_BASE, hidden: 0.83, hidden_n: 12 };
  const f = core.leadFact(it, { kindJa: '銭湯', catJa: '湯・サウナ', gem: true });
  eq(f.includes('その中の一軒'), false, '誤解を招く表現が残っている: ' + f);
  eq(f.includes('入っていない'), true, f);
  // chain=0 は「検出されなかった」であって独立店の証明ではないので断定しない
  for (const w of ['独立店', '個人店', '地元の名店']) {
    eq(f.includes(w), false, `${w} と断定している: ${f}`);
  }
});


check('filterItems: 確認済みだけに絞る', () => {
  const all = [{ id: 'a', cat: 'bath', distM: 10, checked: '2026-08-08' },
               { id: 'b', cat: 'bath', distM: 20, checked: '' }];
  eq(core.filterItems(all, { verifiedOnly: true }).length, 1);
  eq(core.filterItems(all, { verifiedOnly: true })[0].id, 'a');
  eq(core.filterItems(all, {}).length, 2, '指定が無ければ絞らない');
});

check('filterItems: 集めた事実で絞る', () => {
  const facts = { a: { payment_method: 'ticket_machine' }, b: { payment_method: 'counter_person' } };
  const all = [{ id: 'a', cat: 'bath', distM: 10 }, { id: 'b', cat: 'bath', distM: 20 },
               { id: 'c', cat: 'bath', distM: 30 }];
  const opts = { factsOf: it => facts[it.id], factFilters: [{ k: 'payment_method', v: 'ticket_machine' }] };
  const got = core.filterItems(all, opts);
  eq(got.length, 1);
  eq(got[0].id, 'a');
});

check('filterItems: 調べていない施設を「該当しない」扱いにしない', () => {
  // 事実で絞ったとき、未調査は結果から外れる。これは「条件に合わない」の
  // ではなく「分からない」なので、絞り込みを外せば戻ることが大事。
  const all = [{ id: 'c', cat: 'bath', distM: 30 }];
  eq(core.filterItems(all, { factsOf: () => null, factFilters: [{ k: 'x', v: 'y' }] }).length, 0);
  eq(core.filterItems(all, {}).length, 1, '絞り込みを外せば戻る');
});


check('filterItems: 述語での絞り込み（チェーンの有無）', () => {
  const all = [{ id: 'a', cat: 'eat', distM: 1, chain: 1 },
               { id: 'b', cat: 'eat', distM: 2, chain: 0 }];
  eq(core.filterItems(all, { preds: [it => it.chain !== 1] }).map(x => x.id).join(''), 'b');
  eq(core.filterItems(all, { preds: [it => it.chain === 1] }).map(x => x.id).join(''), 'a');
  eq(core.filterItems(all, {}).length, 2);
});


check('entryFlow: 確認できた事実だけを順に並べる', () => {
  const f = core.entryFlow({ payment_method: 'ticket_machine', bring_towel: 'required',
                             luggage: 'locker', stay_limit: 30 });
  eq(f[0], '券売機で先に買う', f.join('/'));
  eq(f.includes('タオルは持参'), true);
  eq(f.includes('30分で上がる'), true);
  // 分かっていないことは書かない
  eq(f.some(x => x.includes('洗い場')), false, f.join('/'));
});

check('entryFlow: 予約が要るときは先頭に来る', () => {
  const f = core.entryFlow({ reservation: 'required', payment_method: 'counter_person' });
  eq(f[0], '事前の予約が要る', f.join('/'));
});

check('entryFlow: 事実が無ければ空', () => {
  eq(core.entryFlow(null).length, 0);
  eq(core.entryFlow({}).length, 0);
});

check('filterItems: 業態で絞る', () => {
  const all = [{ id: 'a', cat: 'eat', kind: 'ramen', distM: 1 },
               { id: 'b', cat: 'eat', kind: 'soba_udon', distM: 2 }];
  eq(core.filterItems(all, { kind: 'ramen' }).map(x => x.id).join(''), 'a');
  eq(core.filterItems(all, { kind: null }).length, 2, '未指定なら絞らない');
  eq(core.filterItems(all, {}).length, 2);
});

check('sortItems: 行けない疑いのあるものは後ろへ回す', () => {
  const all = [{ id: 'near', distM: 10, solo: 5, quiet: 5, iso: 0, hidden: 0 },
               { id: 'far',  distM: 900, solo: 3, quiet: 3, iso: 0, hidden: 0 }];
  const ctx = { doubtfulOf: it => it.id === 'near' };
  // 近い順でも、疑いのあるものは後ろ
  eq(core.sortItems(all, 'dist', ctx).map(x => x.id).join(','), 'far,near');
  // ひとり度順でも同じ（疑いの判定がすべての並びに効く）
  eq(core.sortItems(all, 'solo', ctx).map(x => x.id).join(','), 'far,near');
  // 疑いが無ければ従来どおり
  eq(core.sortItems(all, 'dist', {}).map(x => x.id).join(','), 'near,far');
});

check('entryFlow: 分かっていないことを書かない', () => {
  // 無人だと分かっているだけでは支払い方法は決まらない。料金箱とは限らない。
  const f = core.entryFlow({ unstaffed: 'yes' });
  eq(f.includes('料金箱に入れる'), false, '推測している: ' + f.join('/'));
  eq(f.includes('入口に人はいない'), true, f.join('/'));
});

check('entryFlow: 語彙にある値をひとつ残らず扱う', () => {
  // 集めた事実が動線に出ないのは、収集した手間がそのまま無駄になる。
  // reservation=possible / payment_method=cashless_ok / bring_towel=included /
  // wash_area=yes は語彙にあるのに扱われていなかった。
  const cases = [
    [{ reservation: 'possible' }, '予約もできる'],
    [{ payment_method: 'cashless_ok' }, '現金以外も使える'],
    [{ bring_towel: 'included' }, 'タオルは料金に含まれる'],
    [{ wash_area: 'yes' }, '洗い場がある'],
  ];
  for (const [facts, want] of cases) {
    const f = core.entryFlow(facts);
    eq(f.includes(want), true, JSON.stringify(facts) + ' → ' + f.join('/'));
  }
});

check('entryFlow: 追加した値が既存の分岐を潰していない', () => {
  // else if で繋いだので、先に来る値が消えていないかを確かめる。
  eq(core.entryFlow({ reservation: 'required' }).includes('事前の予約が要る'), true);
  eq(core.entryFlow({ reservation: 'none' }).includes('予約は要らない'), true);
  eq(core.entryFlow({ payment_method: 'cash_only' }).includes('現金だけ'), true);
  eq(core.entryFlow({ bring_towel: 'required' }).includes('タオルは持参'), true);
  eq(core.entryFlow({ bring_towel: 'rental' }).includes('タオルは借りられる'), true);
  eq(core.entryFlow({ wash_area: 'no' }).includes('洗い場は無い'), true);
  eq(core.entryFlow({ wash_area: 'no' }).includes('洗い場がある'), false);
});

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('OK: core');

check('leadFact: 一覧では一帯の密集を繰り返さない', () => {
  // 東京駅の周辺では、隣り合うラーメン店14軒すべてに
  // 「半径500mに同じラーメンが14軒。」と同じ文が出ていた。
  // 施設ではなく一帯についての事実なので、カードごとに言う意味がない。
  const it = { kind: 'ramen', cat: 'eat', solo: 4, hidden: 0, hidden_n: 0 };
  const ctx = { kindJa: 'ラーメン', catJa: '飲食店', sameKindNearby: 14 };
  eq(core.leadFact(it, ctx), '半径500mに同じラーメンが14軒。', 'デッキでは今までどおり');
  eq(core.leadFact(it, { ...ctx, suppressDensity: true }), '', '一覧では黙る');
});

check('leadFact: 施設について言えることがあるなら抑制しない', () => {
  const it = { kind: 'sento', cat: 'bath', solo: 4, hidden: 0.8, hidden_n: 10 };
  const iso = { kindJa: '銭湯', catJa: '入浴施設', isolated: true, isoText: '4.6km',
                suppressDensity: true };
  eq(core.leadFact(it, iso), '最寄りの入浴施設まで4.6km。この一帯で唯一。');
  const gem = { kindJa: '銭湯', catJa: '入浴施設', gem: true, suppressDensity: true };
  eq(core.leadFact(it, gem).startsWith('周辺10軒のうち8軒がチェーン'), true, core.leadFact(it, gem));
});

check('leadFact: 一覧では一帯の話も埋め草も出さない', () => {
  // 「最寄りのカウンター飲食まで19m。」も「ラーメン。ひとり度4。」も、
  // 店の性質を何ひとつ伝えないまま隣の店と同じ文になる。
  const it = { kind: 'ramen', cat: 'eat', solo: 4, hidden: 0, hidden_n: 0 };
  const base = { kindJa: 'ラーメン', catJa: 'カウンター飲食', sameKindNearby: 1 };
  eq(core.leadFact(it, { ...base, isoText: '19m' }), '最寄りのカウンター飲食まで19m。');
  eq(core.leadFact(it, base), 'ラーメン。ひとり度4。');
  eq(core.leadFact(it, { ...base, isoText: '19m', suppressDensity: true }), '');
  eq(core.leadFact(it, { ...base, suppressDensity: true }), '');
});

check('leadFact: 一覧に残るのは、その施設について言えることだけ', () => {
  // 空文字を返す条件を広げすぎると、唯一・穴場まで消える。
  const it = { kind: 'sento', cat: 'bath', solo: 4, hidden: 0.8, hidden_n: 10 };
  const c = { kindJa: '銭湯', catJa: '入浴施設', suppressDensity: true,
              sameKindNearby: 9, isoText: '4.6km' };
  eq(core.leadFact(it, { ...c, isolated: true }),
     '最寄りの入浴施設まで4.6km。この一帯で唯一。');
  eq(core.leadFact(it, { ...c, gem: true }),
     '周辺10軒のうち8軒がチェーン。ここはその8軒に入っていない。');
});

check('densityNote: 一帯の密集を一度だけ言う', () => {
  const items = [{ id: 'a', kind: 'ramen' }, { id: 'b', kind: 'ramen' },
                 { id: 'c', kind: 'sento' }];
  const near = { a: 14, b: 14, c: 1 };
  const note = core.densityNote(items, {
    sameKindNearby: it => near[it.id],
    kindJa: k => ({ ramen: 'ラーメン', sento: '銭湯' })[k],
  });
  eq(note, 'この一帯はラーメンが多く、半径500mに14軒あります。');
});

check('densityNote: 密集していなければ何も言わない', () => {
  const items = [{ id: 'a', kind: 'ramen' }];
  eq(core.densityNote(items, { sameKindNearby: () => 2, kindJa: k => k }), '');
  eq(core.densityNote([], { sameKindNearby: () => 99, kindJa: k => k }), '');
  eq(core.densityNote(null, {}), '');
});

check('densityNote: いちばん多い業態を選ぶ', () => {
  const items = [{ id: 'a', kind: 'sento' }, { id: 'b', kind: 'ramen' }];
  const near = { a: 5, b: 20 };
  eq(core.densityNote(items, { sameKindNearby: it => near[it.id], kindJa: k => k }),
     'この一帯はramenが多く、半径500mに20軒あります。');
});

check('entryFlow: 開いている日が決まっていない施設は、それを最初に置く', () => {
  // 一人で遠出して閉まっていた、が最も痛い。券売機の話より先に来る。
  for (const v of ['irregular', 'seasonal', 'by_appointment']) {
    const f = core.entryFlow({ open_period: v, payment_method: 'ticket_machine' });
    eq(f[0], '開いている日をまず確かめる', v + ': ' + f.join('/'));
    eq(f.includes('券売機で先に買う'), true, v);
  }
});

check('entryFlow: 通年営業なら何も足さない', () => {
  const f = core.entryFlow({ open_period: 'year_round' });
  eq(f.length, 0, f.join('/'));
});

check('entryFlow: 予約必須のほうが先に来る', () => {
  // どちらも unshift するので、後から unshift した予約が先頭に立つ。
  const f = core.entryFlow({ open_period: 'seasonal', reservation: 'required' });
  eq(f[0], '事前の予約が要る', f.join('/'));
  eq(f[1], '開いている日をまず確かめる', f.join('/'));
});

check('busyBands: 業態ごとの狙い目を24時間で返す', () => {
  const sento = core.busyBands('sento');
  eq(sento.length, 24);
  eq(sento[16], 0, '銭湯の16時は空いている想定');
  eq(sento[18], 2, '銭湯の18時は混む想定');
  eq(core.busyBands('unknown_kind'), null, '表に無い業態は推定しない');
});

check('busyBands: 深夜をまたぐ業態も24時間に収まる', () => {
  const nc = core.busyBands('netcafe');
  eq(nc.length, 24);
  eq(nc[2], 2, 'ネットカフェの深夜2時は混む想定');
  eq(nc[10], 0);
  for (const v of nc) if (![0, 1, 2].includes(v)) throw new Error('範囲外の値: ' + v);
});

check('busyBands: すべての業態が0..2に収まる', () => {
  for (const k of Object.keys(core.BUSY_PROFILE)) {
    const b = core.busyBands(k);
    eq(b.length, 24, k);
    for (const v of b) if (![0, 1, 2].includes(v)) throw new Error(k + ' に範囲外の値');
  }
});

check('quietHint: いちばん長い空き帯を言う', () => {
  eq(core.quietHint('netcafe'), '9時ごろから16時ごろが空いている見込み');
  eq(core.quietHint('sento'), '15時ごろから17時ごろが空いている見込み');
  eq(core.quietHint('unknown_kind'), '', '推定できないなら黙る');
});

check('quietHint: 空き帯が無ければ黙る', () => {
  // 全部「混む」の業態を作っても、無い時間を捏造しない
  const saved = core.BUSY_PROFILE.__t;
  core.BUSY_PROFILE.__t = [[0, 24, 2]];
  eq(core.quietHint('__t'), '');
  if (saved === undefined) delete core.BUSY_PROFILE.__t; else core.BUSY_PROFILE.__t = saved;
});

check('sortItems fit: 開いていて浮かないものを先に出す', () => {
  const now = new Date(2026, 7, 11, 14, 0);   // 火曜14時
  const items = [
    { id: 'far_good',  distM: 900, solo: 5, quiet: 5, easy: 5, oh: '10:00-22:00', iso: 0, hidden: 0 },
    { id: 'near_shut', distM: 10,  solo: 5, quiet: 5, easy: 5, oh: '18:00-22:00', iso: 0, hidden: 0 },
    { id: 'near_meh',  distM: 20,  solo: 3, quiet: 3, easy: 3, oh: '10:00-22:00', iso: 0, hidden: 0 },
  ];
  eq(core.sortItems(items, 'fit', { now }).map(x => x.id).join(','),
     'far_good,near_meh,near_shut', '閉まっている店が上に来ている');
  // 近い順は今までどおり
  eq(core.sortItems(items, 'dist', { now }).map(x => x.id).join(','),
     'near_shut,near_meh,far_good');
});

check('sortItems fit: ひとり度を静けさより重く見る', () => {
  const now = new Date(2026, 7, 11, 14, 0);
  const items = [
    { id: 'solo5', distM: 100, solo: 5, quiet: 2, easy: 3, oh: '', iso: 0, hidden: 0 },
    { id: 'quiet5', distM: 100, solo: 3, quiet: 5, easy: 3, oh: '', iso: 0, hidden: 0 },
  ];
  // 研究(§1)が主指標に据えるのは「浮かないか」。静けさは従。
  eq(core.sortItems(items, 'fit', { now })[0].id, 'solo5');
});

check('sortItems fit: 行けない疑いのあるものは後ろのまま', () => {
  const now = new Date(2026, 7, 11, 14, 0);
  const items = [
    { id: 'doubt', distM: 10, solo: 5, quiet: 5, easy: 5, oh: '10:00-22:00', iso: 0, hidden: 0 },
    { id: 'ok',    distM: 900, solo: 3, quiet: 3, easy: 3, oh: '10:00-22:00', iso: 0, hidden: 0 },
  ];
  eq(core.sortItems(items, 'fit', { now, doubtfulOf: it => it.id === 'doubt' })
       .map(x => x.id).join(','), 'ok,doubt');
});
