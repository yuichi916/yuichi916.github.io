// 新しい地図UIの純関数。DOM・fetch・Leaflet に触らない。
// 距離・営業時間・駅名検索・県判定は既存の core.js を使う（再実装しない）。
import { haversineM, openState, parseOpeningHours } from './core.js';

// --- 表示カテゴリ ---
// データ側の cat は stay に museum/library が混ざっている（「宿泊」に博物館が出ていた）。
// 表示は kind から決め直す。データは触らない。
export const DISPLAY_CATS = [
  { key: 'eat', label: '飲食' },
  { key: 'bath', label: '温浴' },
  { key: 'play', label: '体験' },
  { key: 'quiet', label: '静かに過ごす' },
  { key: 'stay', label: '宿' },
];

const KIND_CAT = {
  ramen: 'eat', soba_udon: 'eat', gyudon: 'eat', curry: 'eat', standing: 'eat',
  sento: 'bath', sauna: 'bath', onsen: 'bath', footbath: 'bath', private_sauna: 'bath',
  spa: 'bath', capsule_hotel_sauna: 'bath', private_sauna_hotel: 'bath',
  karaoke: 'play', netcafe: 'play', cinema: 'play',
  library: 'quiet', museum: 'quiet',
  hostel: 'stay',
};

const KIND_JA = {
  ramen: 'ラーメン', soba_udon: 'そば・うどん', gyudon: '牛丼・定食', curry: 'カレー', standing: '立ち食い',
  sento: '銭湯', sauna: 'サウナ', onsen: '温泉', footbath: '足湯', private_sauna: '個室サウナ',
  spa: 'スパ', capsule_hotel_sauna: 'カプセル&サウナ', private_sauna_hotel: '個室サウナ付き宿',
  karaoke: 'カラオケ', netcafe: 'ネットカフェ', cinema: '映画館',
  library: '図書館', museum: '博物館・美術館', hostel: 'ホステル',
};

// 未確認施設に見せる唯一の「見立て」。数字は出さない。業態の性質だけを言う。
const FIT_NOTE = {
  ramen: '一人客が普通の業態', gyudon: '一人客が普通の業態', curry: '一人客が普通の業態',
  standing: '一人客が普通の業態', sento: '一人客が普通の業態', netcafe: '一人客が普通の業態',
  library: '一人客が普通の業態', museum: '一人客が普通の業態', cinema: '一人客が普通の業態',
  soba_udon: '一人客が多い業態', karaoke: 'ヒトカラ対応は要確認',
  hostel: 'ドミトリー中心。個室は要確認', onsen: '一人利用は一般的', sauna: '一人利用は一般的',
  private_sauna: '個室型', private_sauna_hotel: '個室型', footbath: '一人客が普通の業態',
};

export function displayCat(kind, cat) { return KIND_CAT[kind] || cat; }
export function kindJa(kind) { return KIND_JA[kind] || kind; }
export function fitNote(kind) { return FIT_NOTE[kind] || ''; }

// --- 営業中ラベル ---
function _closingText(rules, now) {
  const day = now.getDay(), prev = (day + 6) % 7;
  const min = now.getHours() * 60 + now.getMinutes();
  let end = null;
  for (const r of rules) {
    if (r.days.includes(day)) for (const [a, b] of r.spans) if (min >= a && min < b) end = b;
    if (end === null && r.days.includes(prev)) {
      for (const [a, b] of r.spans) if (b > 1440 && min + 1440 >= a && min + 1440 < b) end = b - 1440;
    }
  }
  if (end === null) return '';
  const next = end > 1440;
  const m = next ? end - 1440 : end;
  const hh = Math.floor(m / 60), mm = m % 60;
  return `〜${next ? '翌' : ''}${hh}:${String(mm).padStart(2, '0')}`;
}

export function openLabel(item, hoursFact, now) {
  const candidates = [];
  if (hoursFact && typeof hoursFact.v === 'string') {
    candidates.push([hoursFact.v, hoursFact.official ? '公式サイト' : '確認済み情報']);
  }
  if (item && item.oh) candidates.push([item.oh, 'OpenStreetMap']);
  for (const [str, source] of candidates) {
    const rules = parseOpeningHours(str);
    if (!rules) continue;
    const st = openState(str, now);
    if (st === 'open') return { state: 'open', text: `営業中 ${_closingText(rules, now)}`.trim(), source };
    return { state: 'closed', text: '営業時間外', source };
  }
  return { state: 'unknown', text: '営業時間は要確認', source: '' };
}

// --- 確認済み事実の整形 ---
export const FACT_LABEL = {
  hours: '営業時間', opening_hours: '営業時間', closed_days: '定休日', price: '料金', payment_method: '支払い方法',
  counter_seats: 'カウンター席', counter_seating: 'カウンター席', seats_total: '座席数', seats: '席',
  bring_towel: 'タオル', towel: 'タオル', amenities: 'アメニティ', wash_area: '洗い場', facilities: '設備',
  unstaffed: '無人', access: '利用条件', conditions: '利用条件', solo_ok: '一人利用', silence: '静けさ',
  reservation: '予約', private_room: '個室・利用人数', first_timer: '初回利用', busy_time: '混雑の目安',
  parking: '駐車場', cuisine: '料理', luggage: '荷物', clientele: '客層', open_period: '営業期間',
  status: '営業状態', renamed_to: '改称', facility_identity: '施設名の確認', city: '所在地',
};
const VALUE_JA = {
  ticket_machine: '券売機あり', cash_only: '現金のみ', cashless_ok: 'キャッシュレス可', counter_person: 'レジで支払い',
  none: '予約不要', possible: '予約可', required: '要予約',
  public: '制限なし', residents_only: '住民限定', members_only: '会員制', male_only: '男性専用', female_only: '女性専用',
  open: '営業中', closed_temporarily: '休業中', closed_permanently: '閉業',
  posted: '静かにの案内あり', observed: '静かさに触れた記述', local: '地元客中心', tourist: '観光客中心', solo_common: '一人客が多い',
  easy: '初めてでも迷わない', custom_exists: '独自の作法あり', yes: 'あり', no: 'なし', rental: '貸出あり', included: '料金に含む',
  locker: 'ロッカーあり',
};
export const PERSONAL_DOMAINS = /zatsu-ke\.blog\.jp|sanukiudon-ranking\.com/;
const ROW_ORDER = ['hours', 'opening_hours', 'closed_days', 'price', 'payment_method', 'counter_seats', 'seats_total', 'seats',
  'reservation', 'access', 'parking', 'conditions', 'open_period'];
const HIDDEN_ROWS = new Set(['solo_insight', 'facility_identity', 'city']);
const BATH_ONLY = new Set(['bring_towel', 'towel', 'wash_area', 'amenities']);
const SOLO_KEYS = [['solo_ok', '一人利用'], ['counter_seats', '席'], ['seats_total', '席'], ['seats', '席'],
  ['payment_method', '支払い'], ['reservation', '予約'], ['silence', '静けさ'], ['first_timer', '初回'], ['clientele', '客層']];

export function formatFactValue(k, v) {
  if (k === 'price' && typeof v === 'number') return `${v.toLocaleString('ja-JP')}円`;
  if (typeof v === 'object' && v !== null) return JSON.stringify(v);
  return VALUE_JA[v] !== undefined ? VALUE_JA[v] : String(v);
}
function _domain(f) {
  const u = (f.urls && f.urls[0]) || '';
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return (f.src && f.src[0]) || ''; }
}
function _insightOf(f) {
  let v = f.v;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } }
  if (f.official && v && v.quality === 'grounded' && v.policyVersion === 'official-provenance-v2'
      && String(v.title || '').trim() && String(v.insight || '').trim()) return { title: v.title, insight: v.insight };
  return null;
}

export function summarizeCurated(entry) {
  const facts = (entry && entry.facts) || [];
  const domains = new Set();
  for (const f of facts) for (const d of (f.src || [])) domains.add(d);
  return { checked: (entry && entry.checked) || '', nFacts: facts.length,
    nOfficial: facts.filter(f => f.official).length, nDomains: domains.size,
    nConflict: facts.filter(f => f.conflict).length };
}

export function groupFacts(entry, displayCatKey) {
  const facts = (entry && entry.facts) || [];
  const byKey = new Map();
  let insight = null;
  const warnings = [], solo = [];
  for (const f of facts) {
    if (f.k === 'solo_insight') { insight = insight || _insightOf(f); continue; }
    if (HIDDEN_ROWS.has(f.k)) continue;
    if (displayCatKey !== 'bath' && BATH_ONLY.has(f.k)) continue;
    if (!byKey.has(f.k)) byKey.set(f.k, []);
    byKey.get(f.k).push(f);
  }
  const rows = [];
  const keys = [...byKey.keys()].sort((a, b) => {
    const ia = ROW_ORDER.indexOf(a), ib = ROW_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  for (const k of keys) {
    const list = byKey.get(k);
    rows.push({ k, label: FACT_LABEL[k] || k, conflict: list.some(f => f.conflict),
      values: list.map(f => { const domain = _domain(f); return {
        text: formatFactValue(k, f.v), domain, url: (f.urls && f.urls[0]) || '',
        official: !!f.official, personal: PERSONAL_DOMAINS.test(domain) }; }) });
  }
  // 営業状態と利用条件は、出典が食い違っていても必ず見せる（spec §6.3）。
  // 「閉業かもしれない」「男性専用かもしれない」は、行く前に知りたい種類の食い違いなので黙って消さない。
  for (const f of facts) {
    const conflicted = f.conflict ? '（出典で食い違い）' : '';
    if (f.k === 'status' && (f.v === 'closed_temporarily' || f.v === 'closed_permanently'))
      warnings.push({ level: 'danger', text: `${VALUE_JA[f.v]}の情報があります（${_domain(f)}）${conflicted}` });
    else if (f.k === 'access' && ['male_only', 'female_only', 'members_only', 'residents_only'].includes(f.v))
      warnings.push({ level: 'warn', text: `${VALUE_JA[f.v]} の情報があります（${_domain(f)}）${conflicted}` });
    else if (f.k === 'renamed_to' && !f.conflict) warnings.push({ level: 'warn', text: `改称: ${f.v}` });
  }
  const seenSolo = new Set();
  for (const [k, label] of SOLO_KEYS) {
    const f = facts.find(x => x.k === k && !x.conflict);
    if (!f || seenSolo.has(label)) continue;
    seenSolo.add(label);
    solo.push({ label, text: formatFactValue(k, f.v), official: !!f.official });
  }
  return { rows, solo, warnings, insight };
}

// --- 絞り込み・順位 ---
export const SCENES = [
  { key: 'bath_tonight', label: '今夜、ひとりで銭湯', cat: 'bath', kinds: null, openNow: true },
  { key: 'eat_quick', label: 'さっと一人飯', cat: 'eat', kinds: null, openNow: true },
  { key: 'rain', label: '雨の日に没頭', cat: null, kinds: ['library', 'museum', 'cinema', 'netcafe'], openNow: false },
  { key: 'stay_tonight', label: '今夜の宿', cat: 'stay', kinds: null, openNow: false },
];
export function isGem(it) { return !it.chain && Number(it.hidden) >= .75 && Number(it.hidden_n) >= 3; }

export function applyFilters(items, f, ctx) {
  const o = f || {}, c = ctx || {};
  const q = String(o.q || '').trim().toLowerCase();
  const kinds = o.kinds && o.kinds.length ? new Set(o.kinds) : null;
  return items.filter(it => {
    if (q && !`${it.name} ${it.city || ''} ${kindJa(it.kind)}`.toLowerCase().includes(q)) return false;
    if (o.cat && displayCat(it.kind, it.cat) !== o.cat) return false;
    if (kinds && !kinds.has(it.kind)) return false;
    if (o.verifiedOnly && !(c.checked && c.checked(it.id))) return false;
    if (o.hideChain && it.chain) return false;
    if (o.gemOnly && !isGem(it)) return false;
    // 確認済みの営業時間があれば、カードの表示と同じ判断材料で絞り込む（ctx.hoursOf は id→hours の事実）。
    if (o.openNow && openLabel(it, c.hoursOf ? c.hoursOf(it.id) : null, c.now || new Date()).state !== 'open') return false;
    if (o.radiusKm && c.origin && Number.isFinite(o.radiusKm) && it.distM > o.radiusKm * 1000) return false;
    return true;
  });
}

// localeCompare は呼ぶたびに照合器を作る。4万件の並べ替えでは1つを使い回す。
const JA = new Intl.Collator('ja');
export function rankItems(items, ctx) {
  const c = ctx || {};
  const ck = it => (c.checked && c.checked(it.id)) ? 0 : 1;
  const byArea = (a, b) => (Number(isGem(b)) - Number(isGem(a))) || (Number(b.solo) - Number(a.solo))
    || JA.compare(String(a.name), String(b.name));
  const byDist = (a, b) => (a.distM - b.distM) || byArea(a, b);
  return items.slice().sort((a, b) => (ck(a) - ck(b)) || (c.origin ? byDist(a, b) : byArea(a, b)));
}

export function expandRadius(items, radiusKm, steps = [1, 3, 10, Infinity]) {
  const idx = steps.indexOf(radiusKm);
  // radiusKm が steps に無い値なら、それ自体を先頭段として扱い、以降は
  // steps のうちそれより大きい段だけを続ける（steps.indexOf の -1 を
  // Math.max(0, -1) で握りつぶすと、無関係な先頭段からやり直してしまう）。
  const ladder = idx >= 0 ? steps.slice(idx) : [radiusKm, ...steps.filter(s => s > radiusKm)];
  for (let i = 0; i < ladder.length; i++) {
    const r = ladder[i];
    const hit = items.filter(it => !Number.isFinite(r) || it.distM <= r * 1000);
    if (hit.length || i === ladder.length - 1) return { items: hit, radiusKm: r, expanded: r !== radiusKm };
  }
  return { items: [], radiusKm: Infinity, expanded: true };
}

export function nearestChecked(items, lat, lon, checked) {
  let best = null;
  for (const it of items) {
    if (!checked(it.id)) continue;
    const d = haversineM(lat, lon, Number(it.lat), Number(it.lon));
    if (!best || d < best.distM) best = { item: it, distM: d };
  }
  return best;
}

// --- 保存（行きたい／行った）。サーバーもアカウントも持たない ---
export const SAVED_KEY = 'hitori.saved.v1';
const EMPTY = () => ({ want: {}, went: {} });

export function loadSaved(storage) {
  let raw;
  try { raw = storage.getItem(SAVED_KEY); } catch (e) { return null; }
  if (!raw) return EMPTY();
  try {
    const v = JSON.parse(raw);
    return { want: (v && v.want) || {}, went: (v && v.went) || {} };
  } catch (e) { return EMPTY(); }
}
export function saveSaved(storage, data) {
  try { storage.setItem(SAVED_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}
function _snap(item, pref) {
  return { t: Date.now(), pref: Number(pref), name: item.name, lat: Number(item.lat), lon: Number(item.lon), kind: item.kind };
}
export function toggleWant(data, item, pref) {
  const want = { ...data.want };
  if (want[item.id]) delete want[item.id]; else want[item.id] = _snap(item, pref);
  return { want, went: { ...data.went } };
}
export function setWent(data, item, pref, extra) {
  const went = { ...data.went, [item.id]: { ..._snap(item, pref), date: (extra && extra.date) || '', memo: (extra && extra.memo) || '' } };
  return { want: { ...data.want }, went };
}
export function removeWent(data, id) {
  const went = { ...data.went }; delete went[id];
  return { want: { ...data.want }, went };
}
export function savedCount(data) {
  return new Set([...Object.keys(data.want || {}), ...Object.keys(data.went || {})]).size;
}
export function encodeSavedParam(data) {
  const seen = new Set(), parts = [];
  for (const bucket of [data.want || {}, data.went || {}]) {
    for (const [id, v] of Object.entries(bucket)) {
      if (seen.has(id)) continue;
      seen.add(id); parts.push(`${v.pref}:${id}`);
    }
  }
  return parts.join(',');
}
export function parseSavedParam(str) {
  const out = [];
  for (const part of String(str || '').split(',')) {
    // id は OSM 由来の n123… と手動収録の manual-kanagawa-… の両方がある（実データ最長65字）。
    const m = part.match(/^(\d{1,2}):([A-Za-z][A-Za-z0-9_-]{0,79})$/);
    if (m) out.push({ pref: Number(m[1]), id: m[2] });
  }
  return out;
}
export function facilityShareUrl(base, pref, id) {
  return `${base}?pref=${encodeURIComponent(pref)}&facility=${encodeURIComponent(id)}`;
}

// --- ひとりチェック（詳細シートの信号機） ---
// このマップの独自の見方。「ひとりで行けるか」を6つの問いに割り、
// 公式に書いてあるものだけを ● にする。書いていないものは推定で埋めず △ のまま残す。
// 一人で行けない条件（男性専用・会員制・休業）が書いてあるときだけ ✕。
// 長い引用は quote に置き、一覧では short（12字前後）だけを見せる。
export const SOLO_CHECKS = [
  { key: 'solo', label: '一人利用', ask: 'ひとりで入れると書いてあるか' },
  { key: 'seat', label: '席', ask: 'カウンターなど一人の席があるか' },
  { key: 'pay', label: '支払い', ask: '注文と会計で人と話すか' },
  { key: 'book', label: '予約', ask: '予約が要るか' },
  { key: 'quiet', label: '静けさ', ask: '会話しないで居られるか' },
  { key: 'cond', label: '利用条件', ask: '誰でも入れるか' },
];
const PAY_SHORT = { ticket_machine: '券売機あり', cash_only: '現金のみ', cashless_ok: 'キャッシュレス可', counter_person: 'レジで支払い' };
const BOOK_SHORT = { none: '予約不要', possible: '予約できる', required: '要予約' };
const COND_SHORT = { public: '制限なし', residents_only: '住民限定', members_only: '会員制', male_only: '男性専用', female_only: '女性専用' };
const BLOCKING = new Set(['residents_only', 'members_only', 'male_only', 'female_only']);

function _short(text, max = 12) {
  const v = String(text ?? '').trim();
  const head = (v.split(/[、。・]/)[0] || v).trim() || v;
  return head.length > max ? `${head.slice(0, max)}…` : head;
}
// 事実から1項目ぶんの信号を組む。usable に無ければ △（未確認）。
function _cell(check, fact, short, state) {
  if (!fact) return { ...check, state: 'unknown', short: '記載なし', quote: '', official: false };
  return {
    ...check,
    state: state || (fact.official ? 'ok' : 'weak'),
    short: short || _short(fact.v),
    quote: typeof fact.v === 'object' ? JSON.stringify(fact.v) : String(fact.v),
    official: !!fact.official,
  };
}

export function soloCheck(entry, item) {
  const facts = ((entry && entry.facts) || []).filter(f => !f.conflict);
  const pick = (...keys) => facts.find(f => keys.includes(f.k)) || null;
  const kind = item && item.kind;

  const solo = pick('solo_ok');
  const seat = pick('counter_seats', 'seats', 'seats_total');
  const pay = pick('payment_method');
  const book = pick('reservation');
  const quiet = pick('silence');
  // access は語彙（public/male_only…）にも、アクセス説明の自由文にも使われている。
  // 「東京都台東区蔵前…」を利用条件の信号にすると読めないので、語彙の値だけを採る。
  const condFact = pick('access');
  const cond = condFact && COND_SHORT[condFact.v] ? condFact : null;
  const status = facts.find(f => f.k === 'status' && f.v !== 'open');

  const seatShort = seat
    ? (/^\d+$/.test(String(seat.v).trim()) ? `${seat.v}席`
      : /カウンター/.test(String(seat.v)) ? 'カウンター席あり' : _short(seat.v))
    : null;
  const condShort = cond ? (COND_SHORT[cond.v] || _short(cond.v)) : null;
  const condState = cond && BLOCKING.has(cond.v) ? 'blocked' : null;

  const cells = [
    _cell(SOLO_CHECKS[0], solo, solo ? '公式に一人利用あり' : null),
    _cell(SOLO_CHECKS[1], seat, seatShort),
    _cell(SOLO_CHECKS[2], pay, pay ? (PAY_SHORT[pay.v] || _short(pay.v)) : null),
    _cell(SOLO_CHECKS[3], book, book ? (BOOK_SHORT[book.v] || _short(book.v)) : null),
    _cell(SOLO_CHECKS[4], quiet, quiet ? _short(formatFactValue('silence', quiet.v)) : null),
    _cell(SOLO_CHECKS[5], cond, condShort, condState),
  ];
  // 個室型は業態そのものが答えなので、席の欄を推定ではなく分類として埋める。
  if (cells[1].state === 'unknown' && (kind === 'private_sauna' || kind === 'private_sauna_hotel')) {
    cells[1] = { ...cells[1], state: 'weak', short: '個室型', quote: '業態が個室サウナとして登録されています。', official: false };
  }
  if (status) {
    cells[5] = { ...cells[5], state: 'blocked', short: status.v === 'closed_permanently' ? '閉業の情報' : '休業の情報', quote: String(status.v), official: !!status.official };
  }
  const known = cells.filter(c => c.state === 'ok').length;
  return { cells, known, total: cells.length };
}
