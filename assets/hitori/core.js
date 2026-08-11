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
    if (o.kind && it.kind !== o.kind) return false;
    if (o.maxDistM != null && it.distM > o.maxDistM) return false;
    if (o.minSolo && it.solo < o.minSolo) return false;
    if (o.minQuiet && it.quiet < o.minQuiet) return false;
    if (o.minEasy && it.easy < o.minEasy) return false;
    if (o.nochain && it.chain === 1) return false;
    if (o.minConf && it.conf < o.minConf) return false;
    if (o.requireHours && !it.oh) return false;
    // 集めた事実による絞り込み。調べていない施設は「該当しない」ではなく
    // 「分からない」なので、条件が指定されたら除く（居ないことにしない）。
    if (o.verifiedOnly && !it.checked) return false;
    if (o.preds && o.preds.length) {
      for (const fn of o.preds) if (!fn(it)) return false;
    }
    if (o.factFilters && o.factFilters.length) {
      const f = o.factsOf ? o.factsOf(it) : null;
      if (!f) return false;
      for (const need of o.factFilters) if (f[need.k] !== need.v) return false;
    }
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

// 行けない可能性がある施設を先頭に出さない。閉業や住民専用の情報が
// 1件だけあるものは、一覧から外す条件（2件以上）を満たさないので残るが、
// 徒歩1分だからといって最初に見せるのは不親切である。並びでは後ろへ回す。
// 消さずに後ろへ、という扱いにしているのは、1件の情報が誤りである
// 可能性も残すため。
export function sortItems(items, sort, ctx) {
  const c = ctx || {};
  const now = c.now || new Date();
  const th = c.isoThreshold;
  const out = items.slice();
  const byDist = (a, b) => a.distM - b.distM;
  const doubt = it => (c.doubtfulOf && c.doubtfulOf(it)) ? 1 : 0;
  // どの並び順でも、行けない疑いのあるものは最後に回す
  const withDoubt = cmp => (a, b) => (doubt(a) - doubt(b)) || cmp(a, b);

  switch (sort) {
    // 研究(§1)が言うのは、一人客が最初に知りたいのは味でも近さでもなく
    // 「いま行って浮かないか」の一点だということ。近い順だと、いま閉まって
    // いる店や一人だと居心地の悪い店が上に来る。開いていること・一人で
    // 浮かないこと・作法が要らないことをまとめて上に出す並びを用意する。
    // 距離は最後の同点処理に回す（近くても入れなければ意味がない）。
    case 'fit': {
      const fit = it => (it.solo * 2) + it.easy + it.quiet;
      return out.sort(withDoubt((a, b) =>
        (openRank(a, now) - openRank(b, now)) || (fit(b) - fit(a)) || byDist(a, b)));
    }
    case 'solo':
      return out.sort(withDoubt((a, b) => (b.solo - a.solo) || byDist(a, b)));
    case 'quiet':
      return out.sort(withDoubt((a, b) => (b.quiet - a.quiet) || byDist(a, b)));
    case 'find':
      return out.sort(withDoubt((a, b) => (findScore(b, th) - findScore(a, th)) || byDist(a, b)));
    case 'open':
      return out.sort(withDoubt((a, b) => (openRank(a, now) - openRank(b, now)) || byDist(a, b)));
    default:
      return out.sort(withDoubt(byDist));
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

// --- 紹介文の生成 ---
// 37,193件すべてに付けるため、手書きではなくデータから決定的に生成する。
// 3軸は業態からの推定なので「静かです」とは断定せず、「会話が発生しない」という
// 業態の性質として書く。既存の免責文と整合させるための制約。

const LEAD_MAX_CLAUSES = 2;

// I11: 「半径500mに同じ◯◯が◯軒」の半径は、この文言生成側と hitori.html の
// sameKindNearby() の実際の集計側の両方で使う。片方だけ数値リテラルを変えると
// 文言と実際の集計範囲がずれる（過去にしきい値の二重管理で事故を起こしている）。
export const SAME_KIND_RADIUS_M = 500;
// 「密集している」と言うのに必要な同業態の件数（自分を除く）
export const SAME_KIND_MIN = 3;

// iso は同じ「カテゴリ」（湯／飲食／娯楽／滞在）までの距離であり、同じ業態まで
// の距離ではない（scripts/hitori/iso.py の _nearest_same_cat）。したがって
// 孤立を語る節では業態名ではなくカテゴリ名を使う。業態名を使うと
// 「最寄りのネットカフェまで4.6km」のような事実でない文になる。
// 1文目は必ず数字を伴う具体的な事実にする。軸の節（会話が発生しない等）を
// 2つ並べると、静か5・入りやすさ5の業態（ネットカフェ・映画館・図書館）が
// 全部同じ文になり、実測で全体の17%が「会話が発生しない。作法は要らない。」
// に潰れた。施設ごとに異なる数字を必ず1つ入れることでそれを避ける。
export function leadFact(item, ctx) {
  const c = ctx || {};
  const kind = c.kindJa || item.kind;
  const cat = c.catJa || item.cat;
  if (c.isolated && c.isoText) return `最寄りの${cat}まで${c.isoText}。この一帯で唯一。`;
  if (c.gem) {
    // 「その中の一軒」と書くと、チェーン側の一軒に読める。実際は逆で、
    // その数に入っていないほうである。また chain=0 は「チェーンとして
    // 検出されなかった」であって独立店の証明ではないので、この店について
    // 断定せず、周辺の構成という事実だけを述べる。
    const chains = Math.round((item.hidden || 0) * (item.hidden_n || 0));
    return `周辺${item.hidden_n}軒のうち${chains}軒がチェーン。ここはその${chains}軒に入っていない。`;
  }
  if (c.sameKindNearby >= SAME_KIND_MIN) {
    // 密集は施設ではなく一帯についての事実なので、隣り合う店で同じ文になる。
    // 一覧では14軒すべてに「半径500mに同じラーメンが14軒。」と出ていた。
    // 一覧側は見出しで一度だけ言い、カードでは黙る。
    if (!c.suppressDensity) return `半径${SAME_KIND_RADIUS_M}mに同じ${kind}が${c.sameKindNearby}軒。`;
  }
  // ここから下は、この施設ではなく一帯についての事実か、業態名と軸の
  // 言い換えでしかない。1軒ずつ見るデッキでは文脈として役に立つが、
  // 並べて見る一覧では隣の店と同じ文が並ぶだけになる。
  //
  // 「最寄りのカウンター飲食まで19m。」が実際にそうだった。密集地では
  // どのカードもこれになり、しかも店の性質を何ひとつ伝えていない。
  // 離れているときは isolated 側の分岐が「この一帯で唯一」を出す。
  if (c.suppressDensity) return '';
  if (c.isoText) return `最寄りの${cat}まで${c.isoText}。`;
  return `${kind}。ひとり度${item.solo}。`;
}

// 一覧の先頭に一度だけ出す、この一帯についての事実。
// 該当が無ければ空文字。
export function densityNote(items, ctx) {
  const c = ctx || {};
  const counts = {};
  for (const it of items || []) {
    const n = c.sameKindNearby ? c.sameKindNearby(it) : 0;
    if (n >= SAME_KIND_MIN) counts[it.kind] = Math.max(counts[it.kind] || 0, n);
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top) return '';
  const label = (c.kindJa && c.kindJa(top[0])) || top[0];
  return `この一帯は${label}が多く、半径${SAME_KIND_RADIUS_M}mに${top[1]}軒あります。`;
}

// 軸の節はひとつだけ。当たらなければ空文字。
// 一覧のように3軸を言葉で別途出す画面では、これを足すと同じことを二度言う
// ことになるので leadFact() だけを使う。
export function leadAxis(item) {
  if (item.quiet >= 5) return '会話が発生しない。';
  if (item.quiet <= 2) return '声を出す場。';
  if (item.easy <= 2) return '常連の作法がある。';
  if (item.easy >= 5) return '作法は要らない。';
  if (item.solo === 5) return 'ひとりが標準。';
  return '';
}

export function leadSentence(item, ctx) {
  return leadFact(item, ctx) + leadAxis(item);
}

// --- 星座図 ---
// 写真が1枚も無いので、周辺施設の分布そのものを絵にする。
// 「密集」も「孤立」も同じ絵で語れ、他所から持ってこられない絵になる。

const CONST_RADIUS_M = 1500;
const CONST_R = 130;
const CONST_MAX_POINTS = 120;   // 都心では1.5km圏に数百件あり、全部打つと黒い塊になる

export function constellation(center, items, opts) {
  const o = opts || {};
  const radiusM = o.radiusM || CONST_RADIUS_M;
  const R = o.r || CONST_R;
  const maxPoints = o.maxPoints || CONST_MAX_POINTS;
  const cos = Math.cos(center.lat * Math.PI / 180);

  const pts = [];
  for (const it of items) {
    const dx = (it.lon - center.lon) * cos * 111320;
    const dy = -(it.lat - center.lat) * 111320;   // SVGは下が正なので反転
    const distM = Math.sqrt(dx * dx + dy * dy);
    if (distM > radiusM) continue;
    pts.push({
      x: (dx / radiusM) * R,
      y: (dy / radiusM) * R,
      cat: it.cat,
      distM,
      self: it.id === center.id,
    });
  }
  pts.sort((a, b) => a.distM - b.distM);
  return { points: pts.slice(0, maxPoints), r: R, rings: [R / 3, (R * 2) / 3, R] };
}

// --- 施設名の照合 ---
// 読み込み済みの県に対して使う。全国検索は別ファイルを取得したうえで
// 同じ関数を使う（items の中身が違うだけ）。

export function searchFacilities(items, query, limit = 20) {
  const q = String(query == null ? '' : query).trim();
  if (!q) return [];
  const hits = items.filter(it => it.name.includes(q));
  hits.sort((a, b) => {
    const ae = a.name === q ? 0 : 1, be = b.name === q ? 0 : 1;
    if (ae !== be) return ae - be;
    if (a.name.length !== b.name.length) return a.name.length - b.name.length;
    return (a.distM || 0) - (b.distM || 0);
  });
  return hits.slice(0, limit);
}

// --- 一人で入るときの動線 ---
// 一蘭が味集中カウンターで解決したのは「入店後に何が起きるか分からない」
// 不安である。物理的な設計は真似できないが、確認できた事実から入店から
// 着席までの流れを組み立てて先に見せることはできる。
// 推測はしない。確認できた事実だけを順に並べる。

export function entryFlow(facts) {
  if (!facts) return [];
  const f = [];
  if (facts.unstaffed === 'yes') f.push('入口に人はいない');
  if (facts.payment_method === 'ticket_machine') f.push('券売機で先に買う');
  else if (facts.payment_method === 'counter_person') f.push('番台で先に払う');
  // unstaffed だけでは支払い方法は分からない。料金箱とは限らない
  // （前払い不要・後払い・宿泊者のみ等もある）。推測しない。
  // 開いている日が決まっていない施設は、まず開いているかを確かめる所から。
  if (facts.open_period === 'irregular' || facts.open_period === 'seasonal'
      || facts.open_period === 'by_appointment') {
    f.unshift('開いている日をまず確かめる');
  }
  if (facts.reservation === 'required') f.unshift('事前の予約が要る');
  else if (facts.reservation === 'none') f.push('予約は要らない');
  else if (facts.reservation === 'possible') f.push('予約もできる');
  if (facts.payment_method === 'cash_only') f.push('現金だけ');
  else if (facts.payment_method === 'cashless_ok') f.push('現金以外も使える');
  if (facts.bring_towel === 'required') f.push('タオルは持参');
  else if (facts.bring_towel === 'rental') f.push('タオルは借りられる');
  else if (facts.bring_towel === 'included') f.push('タオルは料金に含まれる');
  if (facts.luggage === 'locker') f.push('ロッカーに荷物を置ける');
  else if (facts.luggage === 'shelf_only') f.push('荷物は棚に置く');
  else if (facts.luggage === 'none') f.push('荷物の置き場は無い');
  if (facts.wash_area === 'no') f.push('洗い場は無い');
  else if (facts.wash_area === 'yes') f.push('洗い場がある');
  if (facts.stay_limit) f.push(`${facts.stay_limit}分で上がる`);
  return f;
}

// 一人で行くなら、空いている時間に行けるかどうかが効く。Googleマップの
// 「混雑する時間帯」は位置情報のビッグデータが前提で、サーバの無いこの
// サイトでは同じことができない。代わりに業態から静的に推定する。
//
// これは実測ではなく推定である。ひとり度・静けさ・入りやすさと同じ扱いで、
// 画面でも必ず「業態からの推定」と書く。個々の施設について調べた busy_time
// があるときは、そちらが上に立つ（推定より確認できた事実が強い）。
//
// 値は 0=空いている 1=ふつう 2=混む。時刻は0..23の整数。
export const BUSY_LEVELS = ['空いている', 'ふつう', '混む'];

// 業態 → [[開始時, 終了時, 度合い], ...]。ここに無い時間帯は「ふつう」。
// 終了時は含まない（[12, 14, 2] は12:00〜13:59）。
export const BUSY_PROFILE = {
  // 飲食は昼の休憩と夕食に寄る。立ち食いは朝の通勤帯も混む。
  ramen:      [[11, 14, 2], [18, 20, 2], [14, 17, 0]],
  soba_udon:  [[11, 14, 2], [18, 20, 2], [14, 17, 0]],
  gyudon:     [[7, 9, 1], [11, 14, 2], [18, 20, 2], [14, 17, 0], [22, 24, 0]],
  curry:      [[11, 14, 2], [18, 20, 2], [14, 17, 0]],
  standing:   [[17, 21, 2], [11, 14, 1], [14, 17, 0]],
  yakiniku_solo: [[11, 14, 1], [18, 21, 2], [14, 17, 0]],
  // 湯は仕事帰りに寄る。開店直後がいちばん空く。
  sento:      [[15, 17, 0], [17, 21, 2], [21, 24, 1]],
  onsen:      [[10, 13, 0], [13, 16, 1], [16, 20, 2]],
  sauna:      [[10, 15, 0], [19, 23, 2]],
  footbath:   [[10, 16, 1], [16, 20, 0]],
  // 娯楽は夜と週末。ネットカフェは深夜が本番。
  netcafe:    [[9, 16, 0], [22, 24, 2], [0, 5, 2]],
  karaoke:    [[11, 16, 0], [19, 23, 2]],
  cinema:     [[10, 13, 0], [13, 17, 1], [17, 21, 2]],
  // 滞在は昼が静か。宿はチェックインの時間帯が混む。
  library:    [[9, 12, 0], [12, 17, 1], [17, 20, 0]],
  museum:     [[9, 11, 0], [11, 15, 1], [15, 17, 0]],
  hostel:     [[16, 20, 2], [20, 24, 1]],
  capsule:    [[16, 20, 2], [20, 24, 1]],
};

export function busyBands(kind) {
  const spec = BUSY_PROFILE[kind];
  if (!spec) return null;         // 表に無い業態は推定しない
  const hours = new Array(24).fill(1);
  for (const [from, to, level] of spec) {
    for (let h = from; h < to; h++) hours[h % 24] = level;
  }
  return hours;
}

// 「何時ごろが狙い目か」を一文にする。推定が無ければ空文字。
export function quietHint(kind) {
  const hours = busyBands(kind);
  if (!hours) return '';
  // 続いている「空いている」帯のうち、いちばん長いものを選ぶ。
  let best = null, run = null;
  for (let h = 0; h <= 24; h++) {
    if (h < 24 && hours[h] === 0) {
      run = run || { from: h, to: h };
      run.to = h + 1;
    } else if (run) {
      if (!best || run.to - run.from > best.to - best.from) best = run;
      run = null;
    }
  }
  if (!best) return '';
  return `${best.from}時ごろから${best.to}時ごろが空いている見込み`;
}

// 集めた事実 → 一覧に出す短い項目と警告。DOM も CURATED も知らない。
//
// hitori.html の中に置いていたが、語彙を足すたびにここの追従を忘れて
// 「集めたのに画面に出ない」を繰り返した（客層89件・混雑30件・作法16件が
// 死んでいた）。ブラウザを起動しないと確かめられないのが原因なので、
// Node から直接テストできる層へ移す。
//
// entry は curated.json の1施設分。max は出す項目数の上限。
export function facilityTips(entry, max) {
  const e = entry;
  if (!e || !e.facts) return { tips: [], warn: [] };
  const TIP_MAX = max || 7;

  // 矛盾している事実を落とすだけだと、料金が改定された施設で何も出なくなる
  // （実データで37施設が1.5倍以上ひらいていた）。値が割れているときは
  // 範囲で出し、割れていること自体を伝える。黙って消すより役に立つ。
  const v = {}, ranges = {};
  const byKey = {};
  for (const f of e.facts) (byKey[f.k] = byKey[f.k] || []).push(f);
  for (const [k, fs] of Object.entries(byKey)) {
    const vals = [...new Set(fs.map(f => f.v))];
    if (vals.length === 1) { v[k] = vals[0]; continue; }
    if (typeof vals[0] === 'number') {
      const ns = vals.filter(x => typeof x === 'number').sort((a, b) => a - b);
      if (ns.length >= 2) ranges[k] = [ns[0], ns[ns.length - 1]];
    }
  }

  const out = [];
  // 一人で行くときにいちばん効くのは「浮かないか」。料金や営業時間は
  // どこにでも書いてあるが、客層・作法・混み方は行った人の記録にしか
  // 出てこない。せっかく集めたのに、これまで一度も画面に出していなかった
  // （客層89件・混雑30件・作法16件・黙浴6件が死んでいた）。先に出す。
  if (v.clientele === 'solo_common') out.push('一人客が多い');
  else if (v.clientele === 'local') out.push('地元客が中心');
  else if (v.clientele === 'tourist') out.push('観光客が多い');
  if (v.first_timer === 'easy') out.push('初めてでも入りやすい');
  else if (v.first_timer === 'custom_exists') out.push('作法がある');
  if (v.silence === 'posted') out.push('黙浴の掲示あり');
  else if (v.silence === 'observed') out.push('会話は少なめ');
  if (v.busy_time === 'usually_quiet') out.push('いつも空いている');
  else if (v.busy_time === 'morning_quiet') out.push('朝は空いている');
  else if (v.busy_time === 'evening_busy') out.push('夕方は混む');
  else if (v.busy_time === 'weekend_busy') out.push('週末は混む');

  if (v.price != null) out.push(`${v.price}円`);
  else if (ranges.price) out.push(`${ranges.price[0]}〜${ranges.price[1]}円（情報が分かれています）`);
  if (v.unstaffed === 'yes') out.push('無人・料金箱');
  else if (v.payment_method === 'ticket_machine') out.push('券売機');
  else if (v.payment_method === 'counter_person') out.push('番台で支払い');
  if (v.payment_method === 'cash_only') out.push('現金のみ');
  if (v.bring_towel === 'required') out.push('タオル持参');
  else if (v.bring_towel === 'rental') out.push('タオル貸出あり');
  if (v.wash_area === 'no') out.push('洗い場なし');
  if (v.stay_limit) out.push(`滞在${v.stay_limit}分まで`);
  if (v.luggage === 'locker') out.push('ロッカーあり');
  else if (v.luggage === 'none') out.push('荷物置き場なし');
  if (v.hours) out.push(v.hours.length > 24 ? v.hours.slice(0, 23) + '…' : v.hours);
  else if (byKey.hours) out.push('営業時間は情報が分かれています');
  if (v.closed_days) out.push(`定休 ${v.closed_days}`);

  const warn = [];
  // 行ったのに閉まっていた、が一人旅では最も痛い。閉業でも休業でもないが
  // 「いつやっているか決まっていない」施設は実在する。
  if (v.open_period === 'irregular') warn.push('不定期営業（事前に確認を）');
  else if (v.open_period === 'seasonal') warn.push('季節営業（事前に確認を）');
  else if (v.open_period === 'by_appointment') warn.push('事前連絡が要る');
  // 一人で使えるかどうかは、このアプリで最も重要な警告。
  if (v.solo_ok === 'limited') warn.push('一人利用は期間限定');
  if (v.status === 'closed_temporarily') warn.push('休業中');
  if (v.renamed_to) warn.push(`現在は「${v.renamed_to}」`);
  // 閉業の予定が出ているが、その日はまだ来ていない施設。いま行けば入れる
  // ので一覧からは外さない。日付を出して、その先の予定を立てさせない。
  if (v.closes_on) warn.push(`${v.closes_on} に閉業予定`);

  // 裏付けが1件しかない閉業・入れない情報は、一覧から外す条件を満たさない。
  // それを何も出さずに済ませると、閉業した施設を平常どおり見せることになる
  // （実データで6施設。2022年閉店の店が普通に並んでいた）。
  // 外さない代わりに、確認を促す警告として必ず出す。
  for (const f of e.facts) {
    if (f.n >= 2) continue;
    if (f.k === 'status' && f.v === 'closed_permanently') warn.push('閉業の情報あり（要確認）');
    if (f.k === 'access' && f.v === 'residents_only') warn.push('地元住民専用の情報あり（要確認）');
    if (f.k === 'access' && f.v === 'members_only') warn.push('会員・関係者専用の情報あり（要確認）');
    if (f.k === 'solo_ok' && f.v === 'no') warn.push('一人不可の情報あり（要確認）');
  }

  const cd = String(v.closed_days || '');
  const seasonal = /冬[季期][^。]{0,6}休|季節営業|のみ営業|期間[^。]{0,4}休業|休館期間/.test(cd);
  if (seasonal && !/年中無休|通年/.test(cd)) warn.push('期間限定の営業');

  return { tips: out.slice(0, TIP_MAX), warn: [...new Set(warn)] };
}
