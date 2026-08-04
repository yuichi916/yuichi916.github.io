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
    const m = rule.match(_RULE_RE);
    if (!m) {
      // 「その曜日は休み」はルール不在と同義なので落としてよい
      if (/\boff\b/i.test(rule)) continue;
      return null;
    }
    const days = _parseDays(m[1]);
    const spans = _parseSpans(m[2]);
    if (!days || !spans) return null;
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
