// ひとり歓迎マップの純粋なロジック。DOM も fetch も持たない。
// hitori.html から ESモジュールとして読み込み、Node からテストする。

const R_EARTH = 6371000;
const WALK_M_PER_MIN = 80;
const DIRS8 = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];

export function haversineM(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(a));
}

export function bearing8(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return DIRS8[Math.round(deg / 45) % 8];
}

export function walkMinutes(meters) {
  return Math.max(1, Math.ceil(meters / WALK_M_PER_MIN));
}

// --- opening_hours ---
// OSM の書式に完全対応はしない。基本形だけを扱い、解釈できないものは null を返す。
// 誤って「営業中」と出すより、分からないと言うほうがましである。

const _DAY_IDX = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const _ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const _UNSUPPORTED = /(PH|SH|sunrise|sunset|dawn|dusk|easter|week\s|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\[|\||"|=|<|>)/i;
const _RULE_RE = /^([A-Za-z][A-Za-z,\- ]*?)?\s*((?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*)$/;

function _parseDays(part) {
  if (!part || !part.trim()) return _ALL_DAYS.slice();
  const days = new Set();
  for (const token of part.split(',')) {
    const t = token.trim();
    if (!t) continue;
    const range = t.match(/^([A-Za-z]{2})\s*-\s*([A-Za-z]{2})$/);
    if (range) {
      const a = _DAY_IDX[range[1].toLowerCase()], b = _DAY_IDX[range[2].toLowerCase()];
      if (a === undefined || b === undefined) return null;
      for (let i = 0; i < 7; i++) {
        const d = (a + i) % 7;
        days.add(d);
        if (d === b) break;
      }
      continue;
    }
    const one = _DAY_IDX[t.toLowerCase()];
    if (one === undefined) return null;
    days.add(one);
  }
  return days.size ? [...days].sort((x, y) => x - y) : null;
}

function _parseSpans(part) {
  const out = [];
  for (const chunk of part.split(',')) {
    const m = chunk.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const a = (+m[1]) * 60 + (+m[2]);
    let b = (+m[3]) * 60 + (+m[4]);
    if (b <= a) b += 1440;      // 日をまたぐ営業
    out.push([a, b]);
  }
  return out.length ? out : null;
}

const _OFF_RE = /^([A-Za-z][A-Za-z,\- ]*?)\s+off$/i;

// OSM の通常ルールは後方が前方を上書きする。指定曜日を、既に積んだ各ルールの
// days から取り除き、空になったルールは捨てる（off はここで曜日だけ消して終わり）。
function _applyOverride(rules, days) {
  const remove = new Set(days);
  for (let i = rules.length - 1; i >= 0; i--) {
    rules[i].days = rules[i].days.filter(d => !remove.has(d));
    if (rules[i].days.length === 0) rules.splice(i, 1);
  }
}

export function parseOpeningHours(str) {
  if (!str) return null;
  const src = String(str).trim();
  if (!src) return null;
  if (src === '24/7') return [{ days: _ALL_DAYS.slice(), spans: [[0, 1440]] }];
  if (_UNSUPPORTED.test(src)) return null;

  const rules = [];
  for (const chunk of src.split(';')) {
    const rule = chunk.trim();
    if (!rule) continue;

    const offM = rule.match(_OFF_RE);
    if (offM) {
      const days = _parseDays(offM[1]);
      if (!days) return null;
      _applyOverride(rules, days);  // 休みとして前方ルールを上書き。ルール自体は追加しない
      continue;
    }

    const m = rule.match(_RULE_RE);
    if (!m) return null;
    const days = _parseDays(m[1]);
    const spans = _parseSpans(m[2]);
    if (!days || !spans) return null;
    _applyOverride(rules, days);    // 同じ曜日を持つ前方ルールをこのルールで上書き
    rules.push({ days, spans });
  }
  return rules.length ? rules : null;
}

export function openState(str, date) {
  const rules = parseOpeningHours(str);
  if (!rules) return null;
  const day = date.getDay();
  const prev = (day + 6) % 7;
  const min = date.getHours() * 60 + date.getMinutes();

  for (const r of rules) {
    if (r.days.includes(day)) {
      for (const [a, b] of r.spans) if (min >= a && min < b) return 'open';
    }
    // 前日から日をまたいで継続している営業
    if (r.days.includes(prev)) {
      for (const [a, b] of r.spans) {
        if (b > 1440 && min + 1440 >= a && min + 1440 < b) return 'open';
      }
    }
  }
  return 'closed';
}

// --- 現在地 → 都道府県 ---
// 県境ポリゴンは簡略化されている（許容誤差0.012度≒1.3km）ため、県境付近では
// 1km程度ずれうる。隣接県も読むので実害はない。

export function projectToSvg(lat, lon, bounds) {
  return [
    (lon * Math.cos(bounds.lat0 * Math.PI / 180) - bounds.minx) * bounds.scale,
    (-lat - bounds.miny) * bounds.scale,
  ];
}

export function parseSvgPath(d) {
  const rings = [];
  for (const seg of String(d).split('M').slice(1)) {
    const nums = seg.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) continue;
    const pts = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([+nums[i], +nums[i + 1]]);
    if (pts.length >= 3) rings.push(pts);
  }
  return rings;
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let _ringCache = null;

function _ringsOf(geo) {
  if (_ringCache && _ringCache.geo === geo) return _ringCache.rings;
  const rings = {};
  for (const [code, d] of Object.entries(geo.paths)) rings[code] = parseSvgPath(d);
  _ringCache = { geo, rings };
  return rings;
}

export function prefectureAt(lat, lon, geo) {
  const [x, y] = projectToSvg(lat, lon, geo.bounds);
  const rings = _ringsOf(geo);

  for (const [code, subpaths] of Object.entries(rings)) {
    for (const ring of subpaths) if (pointInRing(x, y, ring)) return +code;
  }

  // 海上・国外。最寄りの県へ寄せる。null を返すと呼び出し側が詰む。
  let best = null, bestD = Infinity;
  for (const [code, subpaths] of Object.entries(rings)) {
    for (const ring of subpaths) {
      for (const [px, py] of ring) {
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) { bestD = d; best = +code; }
      }
    }
  }
  return best;
}

// --- 絞り込みと並べ替え ---

export function rowsToObjects(doc) {
  const f = doc.fields;
  return doc.items.map(row => {
    const o = {};
    for (let i = 0; i < f.length; i++) o[f[i]] = row[i];
    return o;
  });
}

export function withDistance(items, lat, lon) {
  return items.map(it => ({ ...it, distM: haversineM(lat, lon, it.lat, it.lon) }));
}

export function sortByDistance(items) {
  return items.slice().sort((a, b) => a.distM - b.distM);
}

export function filterItems(items, opts) {
  const o = opts || {};
  return items.filter(it => {
    if (o.cats && !o.cats.has(it.cat)) return false;
    if (o.maxDistM != null && it.distM > o.maxDistM) return false;
    if (o.minSolo && it.solo < o.minSolo) return false;
    if (o.minQuiet && it.quiet < o.minQuiet) return false;
    if (o.minEasy && it.easy < o.minEasy) return false;
    if (o.nochain && it.chain === 1) return false;
    if (o.minConf && it.conf < o.minConf) return false;
    if (o.requireHours && !it.oh) return false;
    return true;
  });
}

// --- 地名・駅名検索 ---
// 外部ジオコーディングに依存せず、同梱インデックスへの部分一致で引く。

export function searchPlaces(items, query, limit = 20) {
  const q = String(query == null ? '' : query).trim();
  if (!q) return [];
  // 入力の末尾の「駅」を外したものでも照合する。単純な部分一致だけだと、
  // 入力「渋谷駅」に対して OSM 側の名前が「渋谷」の駅を取りこぼす。
  const alt = q.endsWith('駅') && q.length > 1 ? q.slice(0, -1) : null;

  const hits = [];
  for (const p of items) {
    const nm = p.name;
    if (nm.includes(q) || (alt && nm.includes(alt))) hits.push(p);
  }

  hits.sort((a, b) => {
    // 完全一致を最優先。
    const ae = a.name === q ? 0 : 1, be = b.name === q ? 0 : 1;
    if (ae !== be) return ae - be;
    // 同名の地名は全国に複数ありうる（例: 「別府」＝大分の温泉地／兵庫の
    // 小さな駅）。駅を市区町村より先に出す既定ルールだけでは、無名の駅が
    // 有名な自治体より上に来てしまう。places.py が付与する n（自前データ
    // セット内、その地点から半径2000m以内の施設数）を知名度の代理指標として
    // 使い、型（駅/市区町村）より先に効かせる。
    const an = a.n || 0, bn = b.n || 0;
    if (an !== bn) return bn - an;
    // 駅を市区町村より先に出す。利用者が打つのは駅名のほうが多い。
    if (a.type !== b.type) return a.type === 's' ? -1 : 1;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return a.pref - b.pref;
  });
  return hits.slice(0, limit);
}

// --- 並べ替え ---

export const SORTS = ['dist', 'solo', 'find', 'quiet', 'open'];

// 発見スコア。カテゴリによって効く指標が違うため、穴場度と正規化した孤立度の
// 大きいほうを採る。飲食・娯楽では穴場度が、湯・滞在では孤立度が効く。
export function findScore(item, isoThreshold) {
  const t = isoThreshold && isoThreshold[item.cat];
  const isoPart = t > 0 ? Math.min(1, (item.iso || 0) / t) : 0;
  return Math.max(item.hidden || 0, isoPart);
}

// 0=営業中 / 1=不明 / 2=営業時間外。
// 不明を営業時間外より下に置いてはならない。不明な店は開いている可能性があり、
// 閉まっていると確定した店より見込みがある。
export function openRank(item, date) {
  const st = openState(item.oh, date);
  if (st === 'open') return 0;
  if (st === null) return 1;
  return 2;
}

export function sortItems(items, sort, ctx) {
  const c = ctx || {};
  const now = c.now || new Date();
  const th = c.isoThreshold;
  const out = items.slice();
  const byDist = (a, b) => a.distM - b.distM;

  switch (sort) {
    case 'solo':
      return out.sort((a, b) => (b.solo - a.solo) || byDist(a, b));
    case 'quiet':
      return out.sort((a, b) => (b.quiet - a.quiet) || byDist(a, b));
    case 'find':
      return out.sort((a, b) => (findScore(b, th) - findScore(a, th)) || byDist(a, b));
    case 'open':
      return out.sort((a, b) => (openRank(a, now) - openRank(b, now)) || byDist(a, b));
    default:
      return out.sort(byDist);
  }
}

// --- お気に入り ---
// サーバーもアカウントも持たない。保存先は localStorage のみ。

export const FAV_KEY = 'hitori.favs';
export const FAV_MAX = 200;

const FAV_FIELDS = ['id', 'name', 'lat', 'lon', 'cat', 'kind',
                    'solo', 'quiet', 'easy', 'chain', 'prefCode'];

// IDだけでなくスナップショットを保存する。IDだけだと表示のたびに県ファイル
// （東京都は466KB）の取得が要り、複数県のお気に入りを開くと数MBになる。
export function favSnapshot(item) {
  const out = {};
  for (const f of FAV_FIELDS) out[f] = item[f];
  return out;
}

export function loadFavs(storage) {
  let raw;
  try {
    raw = storage.getItem(FAV_KEY);
  } catch (e) {
    return null;   // プライベートブラウジング等。呼び出し側が機能を隠す。
  }
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];     // 壊れた値で機能ごと死なせない
  }
}

export function saveFavs(storage, favs) {
  try {
    storage.setItem(FAV_KEY, JSON.stringify(favs));
    return true;
  } catch (e) {
    return false;
  }
}

export function isFav(favs, id) {
  return (favs || []).some(f => f.id === id);
}

export function toggleFav(favs, item) {
  const cur = favs || [];
  if (isFav(cur, item.id)) return cur.filter(f => f.id !== item.id);
  const next = cur.concat([favSnapshot(item)]);
  return next.length > FAV_MAX ? next.slice(next.length - FAV_MAX) : next;
}
