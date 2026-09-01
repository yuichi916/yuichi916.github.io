// assets/hitori/app.js
// 画面の状態と DOM・Leaflet・fetch。判断（順位・営業中・事実の整形）は map-core.js に置き、ここでは呼ぶだけ。
import * as core from './core.js';
import * as mc from './map-core.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GSI_TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a> | 施設: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>';
const PAGE = 100;

export const state = {
  index: null, rows: [], prefLoaded: new Set(), curatedByPref: new Map(), byId: new Map(),
  origin: null, filters: { q: '', cat: '', kinds: null, verifiedOnly: false, openNow: false, hideChain: false, gemOnly: false, radiusKm: 3 },
  current: null, saved: null, sheet: 'home', snap: 'half', shown: PAGE, pref: 14, notice: '', noticeLevel: '', loading: false,
  // 絞り込みの中身は狭い画面では畳んでおく（開いたままだと 390px でカードが1枚しか見えない）
  filtersOpen: typeof window !== 'undefined' && window.innerWidth >= 900,
};
// お知らせは2種類ある。失敗（err = 赤）と、途中経過（既定の枠だけ）。
// 「現在地を取得しています…」を赤で出すと、待たせている間ずっと失敗しているように読める。
export function setNotice(msg, level) { state.notice = msg; state.noticeLevel = msg ? (level || 'err') : ''; }
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
state.saved = storage ? mc.loadSaved(storage) : null;

export function track(name) {
  try { window.goatcounter && window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) {}
}

// --- 地図 ---
let map = null, canvas = null, layerCand = null, layerPin = null, originMarker = null, moved = false, selfMove = false;
// 自分で呼んだ setView/fitBounds でも movestart は飛ぶ。利用者が動かしたときだけ「この範囲で再検索」を出したいので囲う。
function selfView(fn) { selfMove = true; try { fn(); } finally { setTimeout(() => { selfMove = false; }, 0); } }
function initMap() {
  if (!window.L) { $('map').innerHTML = '<p style="padding:20px;color:#756b64">地図を読み込めませんでした。一覧からお探しください。</p>'; return; }
  map = L.map('map', { zoomControl: false, attributionControl: true }).setView([35.45, 139.63], 11);
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer(GSI_TILE, { maxZoom: 18, attribution: ATTR }).addTo(map);
  canvas = L.canvas({ padding: .5 });
  layerCand = L.layerGroup().addTo(map);
  layerPin = L.layerGroup().addTo(map);
  map.on('movestart', () => { if (!selfMove && state.sheet === 'list') { moved = true; $('btn-research').classList.add('show'); } });
  // 点の大きさは縮尺で変える。描いたあとに寄せ（fitBounds）で縮尺が動くので、帯をまたいだ時だけ描き直す。
  map.on('zoomend', () => { if (lastMarkers && dotBand() !== lastMarkers.band) renderMarkers(lastMarkers.view, lastMarkers.all); });
}
// 番号つきのピンは「いま一覧に出ている頁」だけ（番号が一覧と一致しないと読めない）。
// 候補の点は絞り込み後の全件を描く。100件で切ると、地図には県の一部しか無いように見えてしまう。
const MAX_DOTS = 3000;
// 点の見え方は縮尺で決まる。引いた縮尺で白フチの大きな丸を数千個描くと面になり、
// 主役の確認済みピンが埋もれる。帯（band）が変わった時だけ描き直す。
let lastMarkers = null;
function dotBand() { const z = map ? map.getZoom() : 12; return z >= 14 ? 2 : z >= 12 ? 1 : 0; }
const DOT_R = [2.6, 3.4, 4.5], DOT_O = [.45, .58, .7];
// 一覧の頁に離島などが混ざると fitBounds が日本全体まで引いてしまい、
// 主要な地点が点にしか見えなくなる（東京都の八丈島がこれだった）。
// 中央値から遠い外れ値を寄せの対象から外す。点とピンは消さない。
function trimOutliers(pts) {
  if (pts.length < 5) return pts;
  const mid = a => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const cLat = mid(pts.map(p => p[0])), cLon = mid(pts.map(p => p[1]));
  const k = Math.cos(cLat * Math.PI / 180);
  const d2 = p => (p[0] - cLat) ** 2 + ((p[1] - cLon) * k) ** 2;
  const sorted = pts.slice().sort((a, b) => d2(a) - d2(b));
  const inner = d2(sorted[Math.max(2, Math.ceil(pts.length * .9) - 1)]);
  const limit = Math.max(inner * 4, 0.0004);   // 9割が入る円の2倍。近接ばかりのときは潰さない
  const kept = pts.filter(p => d2(p) <= limit);
  return kept.length >= 2 ? kept : pts;
}
// view: いま一覧に出ている頁（ピンと地図の寄せに使う）。all: 絞り込み後の全件（点に使う）。
export function renderMarkers(view, all) {
  if (!map) return;
  layerCand.clearLayers(); layerPin.clearLayers();
  const bounds = [];
  const pinned = new Set();
  view.forEach((r, i) => {
    const ll = [Number(r.lat), Number(r.lon)];
    if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return;
    bounds.push(ll);
    const checked = isChecked(r.id), selected = state.current && state.current.id === r.id;
    const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
    if (!checked && !selected && !saved) return;   // 頁の中の候補は下の点として描く
    pinned.add(r.id);
    const icon = L.divIcon({ className: '', html: `<div class="pin ${selected ? 'selected' : ''} ${saved && !selected ? 'saved' : ''}">${i + 1}</div>`,
      iconSize: selected ? [38, 38] : [26, 26], iconAnchor: selected ? [19, 19] : [13, 13] });
    L.marker(ll, { icon, zIndexOffset: selected ? 1000 : checked ? 500 : 0 }).bindTooltip(esc(r.name), { direction: 'top', offset: [0, -14] })
      .on('click', () => select(r)).addTo(layerPin);
  });
  // 点が多すぎると描画が詰まるので上限を置く。現在地があれば近い順、無ければ順位のまま先頭から。
  let cand = (all && all.length ? all : view);
  if (cand.length > MAX_DOTS && state.origin) cand = cand.slice().sort((a, b) => (Number.isFinite(a.distM) ? a.distM : Infinity) - (Number.isFinite(b.distM) ? b.distM : Infinity));
  const band = dotBand();
  const dotR = DOT_R[band], dotO = DOT_O[band];
  lastMarkers = { view, all, band };
  let n = 0;
  for (const r of cand) {
    if (n >= MAX_DOTS) break;
    if (pinned.has(r.id)) continue;
    const lat = Number(r.lat), lon = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    n++;
    // 頁の外の点も押せば詳細が開く（一覧に出ていないから触れない、では地図の意味が無い）。
    // 白フチの大きな丸を数千個描くと面になり、主役の確認済みピンが埋もれる。
    // 引いた縮尺ほど小さく薄く、寄るほど掴みやすくする。
    L.circleMarker([lat, lon], { renderer: canvas, radius: dotR, weight: 0, fillColor: '#a2958b', fillOpacity: dotO })
      .on('click', () => select(r)).addTo(layerCand);
  }
  if (originMarker) originMarker.remove();
  if (state.origin) originMarker = L.marker([state.origin.lat, state.origin.lon], { icon: L.divIcon({ className: '', html: '<div class="origin-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
  // setView は選択地点を画面中央に置くが、モバイルではそこがシートの裏。見えている帯の中まで持ち上げる。
  if (state.current) selfView(() => {
    // 走っているアニメを先に止める。Leaflet はズームアニメ中の setView を黙って捨てる
    // （_tryAnimatedZoom が _animatingZoom 中は true を返す）ので、一覧の fitBounds 直後に
    // カードを押すと中心が動かないことがある。
    map.stop();
    map.setView([Number(state.current.lat), Number(state.current.lon)], Math.max(map.getZoom(), 15), { animate: true });
    const cover = sheetCover();
    if (cover) map.panBy([0, Math.round(cover / 2)], { animate: false });
  });
  else if (!moved && bounds.length > 1) selfView(() => map.fitBounds(trimOutliers(bounds), fitOpts()));
  else if (!moved && bounds.length === 1) selfView(() => map.fitBounds([bounds[0], bounds[0]], fitOpts()));
}
// モバイルはボトムシートが地図の下半分に重なる。その分だけ下に余白を取り、ピンがシートの裏に回らないようにする。
// 隠れる高さ(px)。デスクトップ（横並び）とシートが無い間は 0。
function sheetCover() {
  const sheet = $('sheet');
  if (window.innerWidth >= 900 || !sheet || !map) return 0;
  return Math.max(0, Math.min(window.innerHeight - sheet.getBoundingClientRect().top, map.getSize().y * .55));
}
function fitOpts() {
  const cover = sheetCover();
  if (!cover) return { padding: [30, 30], maxZoom: 14 };
  return { paddingTopLeft: [30, 30], paddingBottomRight: [30, Math.round(cover) + 10], maxZoom: 14 };
}

// --- データ ---
// index.json は素で引く（?v=Date.now() を付けると ETag が毎回無効になり、再訪のたびに全量を落とす）。
// 以降のデータは index.json の updated を版として付ける。データが更新された時だけ URL が変わる。
const loadJson = path => {
  const v = state.index && state.index.updated;
  return fetch(v ? `${path}?v=${encodeURIComponent(v)}` : path)
    .then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
};
export function isChecked(id) { return !!(state.index && state.index.checked[id]); }
// 読み込み中に別の検索が始まったら、後から届いた結果は捨てる（rows と描画の取り違えを防ぐ）。
let loadGen = 0;
export function beginLoad() { return ++loadGen; }
export function isStale(gen) { return gen !== loadGen; }
// 確認済みの根拠。カード・詳細・営業中フィルタで同じものを引く。
export function curatedOf(id) {
  const meta = state.index && state.index.checked[id];
  return meta ? (state.curatedByPref.get(meta[0]) || {})[id] || null : null;
}
export function hoursFactOf(id) {
  const cur = curatedOf(id);
  return cur ? (cur.facts || []).find(f => (f.k === 'hours' || f.k === 'opening_hours') && !f.conflict) || null : null;
}
export async function loadPref(code) {
  code = Number(code);
  if (state.prefLoaded.has(code)) return;
  const gen = loadGen;
  const doc = await loadJson(`data/hitori/pref/${String(code).padStart(2, '0')}.json`);
  if (isStale(gen)) return;   // 待っている間に別の検索が始まっていたら rows に混ぜない
  for (const r of core.rowsToObjects(doc)) { if (!state.byId.has(r.id)) { r.pref = code; state.byId.set(r.id, r); state.rows.push(r); } }
  state.prefLoaded.add(code);
}
// 読み込み中の約束を覚える。共有URLの復元などで同じ県を同時に2回頼まれても1回しか取りに行かない。
const curatedP = new Map();
export async function loadCurated(code) {
  code = Number(code);
  if (state.curatedByPref.has(code)) return state.curatedByPref.get(code);
  if (!curatedP.has(code)) {
    curatedP.set(code, loadJson(`data/hitori/curated/${String(code).padStart(2, '0')}.json`)
      .then(doc => { state.curatedByPref.set(code, doc); return doc; })
      .catch(e => { curatedP.delete(code); throw e; }));   // 失敗は覚えない（次に呼ばれたら引き直す）
  }
  return curatedP.get(code);
}
function resetRows() { state.rows = []; state.byId = new Map(); state.prefLoaded = new Set(); state.current = null; state.shown = PAGE; moved = false; }

// --- シート ---
export function setSnap(snap) { state.snap = snap; $('sheet').dataset.snap = snap; }
export function setSheet(mode) { state.sheet = mode; render(); }
// ヘッダーの ≡ と ♡ が開く about / saved は、いま見ている画面に重ねる引き出し。
// 閉じたら元の画面・スナップ・選択中の施設に戻す。
// 戻り先は「開くたびに」取り直す。詳細の「‹ 一覧へ」は closeOverlay を通らず state.sheet を
// 直接書き換えるので、覚えっぱなしにすると古い戻り先（別の施設の詳細）が生き残る。
// about→saved と重ねたときだけは、いま見えている引き出しではなく1枚目を開く前の画面を保つ。
let prevView = null;
function openOverlay(sheet) {
  if (state.sheet !== 'about' && state.sheet !== 'saved') prevView = { sheet: state.sheet, snap: state.snap, current: state.current };
  state.sheet = sheet;
}
function closeOverlay() {
  const p = prevView; prevView = null;
  if (p) { state.current = p.current; state.sheet = p.sheet; render(); setSnap(p.snap); return; }
  state.sheet = state.rows.length ? 'list' : 'home'; render(); setSnap('half');
}
function bindSheetDrag() {
  const sheet = $('sheet'), handle = $('sheet-handle');
  let startY = null, startSnap = null;
  handle.addEventListener('click', () => setSnap(state.snap === 'full' ? 'half' : 'full'));
  sheet.addEventListener('pointerdown', e => { if (e.target.closest('#sheet-body') && $('sheet-body').scrollTop > 0) return; startY = e.clientY; startSnap = state.snap; });
  sheet.addEventListener('pointerup', e => {
    if (startY === null) return;
    const dy = e.clientY - startY; startY = null;
    if (Math.abs(dy) < 40) return;
    const order = ['peek', 'half', 'full']; let i = order.indexOf(startSnap);
    i = dy < 0 ? Math.min(2, i + 1) : Math.max(0, i - 1);
    setSnap(order[i]);
  });
}

// --- 描画 ---
let lastView = [];   // 最後に描いた一覧（距離つき）。詳細のピンとカードのクリックが使う。
function viewRows() {
  const ctx = { checked: isChecked, now: new Date(), origin: state.origin, hoursOf: hoursFactOf };
  let rows = state.rows;
  if (state.origin) rows = core.withDistance(rows, state.origin.lat, state.origin.lon);
  let list = mc.applyFilters(rows, { ...state.filters, radiusKm: 0 }, ctx);
  let radiusNote = '';
  if (state.origin) {
    const ex = mc.expandRadius(list, state.filters.radiusKm);
    list = ex.items;
    if (ex.expanded) radiusNote = Number.isFinite(ex.radiusKm) ? `${state.filters.radiusKm}km 以内に該当がないため ${ex.radiusKm}km に広げました` : `半径を制限せずに表示しています`;
  }
  lastView = mc.rankItems(list, ctx);
  return { list: lastView, radiusNote };
}
// カードのチップは一目で読める長さに。事実の全文と出典は詳細シートで見せる。
const CHIP_MAX = 14;
// 「カード不可、電子マネー不可、QRコード決済不可。」のような列挙は、先頭の一句だけで用が足りる。
// 途中で切った文はチップとして読めない（全文と出典は詳細シートで見せる）。
function cutText(t) {
  const v = String(t).trim();
  const head = (v.split(/[、。・]/)[0] || v).trim() || v;
  return head.length > CHIP_MAX ? `${head.slice(0, CHIP_MAX)}…` : head;
}
function soloChip(f) {
  if (f.label === '一人利用') return '一人利用の明記';
  if (f.label === '席') return /^\d+$/.test(String(f.text).trim()) ? `${f.text}席` : cutText(f.text);
  const s = cutText(f.text);
  // 切っても一句にならない文（「公式FAQはHUBHUBのサ…」）はチップとして読めない。
  // 何が分かっているかだけを示し、中身は詳細シートに任せる。
  return s.endsWith('…') ? `${f.label}の記載あり` : s;
}
function cardHtml(r, i) {
  const checked = isChecked(r.id), meta = checked ? state.index.checked[r.id] : null;
  const cur = curatedOf(r.id);
  const g = cur ? mc.groupFacts(cur, mc.displayCat(r.kind, r.cat)) : null;
  const open = mc.openLabel(r, hoursFactOf(r.id), new Date());
  const dist = state.origin && Number.isFinite(r.distM) ? (r.distM < 1000 ? `${Math.max(10, Math.round(r.distM / 10) * 10)}m` : `${(r.distM / 1000).toFixed(r.distM < 10000 ? 1 : 0)}km`) : '';
  const chips = [];
  if (g) for (const s of g.solo.slice(0, 3)) chips.push(`<span>${esc(soloChip(s))}</span>`);
  if (g) { const cd = g.rows.find(x => x.k === 'closed_days'); if (cd && chips.length < 4) chips.push(`<span>${esc(cutText(cd.values[0].text))}</span>`); }
  if (mc.isGem(r)) chips.push('<span class="gem">穴場候補</span>');
  if (r.chain) chips.push('<span class="chain">チェーン</span>');
  const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
  return `<article class="card ${checked ? '' : 'unverified'} ${state.current && state.current.id === r.id ? 'selected' : ''}" data-id="${esc(r.id)}">
    <div class="top">${checked ? `<span class="vmark">✓ 確認済み ${esc(meta[5])} · 公式${meta[2]}</span>` : '<span class="cand">候補 · OSM由来</span>'}
      <button class="heart" type="button" data-want="${esc(r.id)}" aria-pressed="${saved ? 'true' : 'false'}" aria-label="行きたい">♡</button></div>
    <h3><span class="num">${i + 1}</span><button type="button" class="open-detail" data-id="${esc(r.id)}">${esc(r.name)}</button></h3>
    <div class="meta"><span class="kind">${esc(mc.kindJa(r.kind))}</span>${r.city ? `<span>${esc(r.city)}</span>` : ''}${dist ? `<span>${dist}</span>` : ''}<span class="${open.state}">${esc(open.text)}</span></div>
    ${chips.length ? `<div class="facts">${chips.join('')}</div>` : ''}
    ${!checked && mc.fitNote(r.kind) ? `<div class="fit">業態の見立て: ${esc(mc.fitNote(r.kind))}</div>` : ''}
  </article>`;
}
function homeHtml() {
  const idx = state.index;
  // 主張は1文としてつなげて置く（<br> を挟むと読み上げ・inner_text で分断される）。折り返しは幅に任せる。
  return `<h1 class="claim">ひとりで入れるか、<em>根拠つきで。</em></h1>
    <p class="lede"><b>確認済み ${idx.checked_count.toLocaleString()}件</b>は公式情報で裏を取り、出典URLを添えています。全国 ${idx.total.toLocaleString()}施設。</p>
    <div class="ways"><button class="way primary" id="btn-locate" type="button">◎ 現在地から探す</button><button class="way" id="btn-area" type="button">エリアを選んで探す</button></div>
    <p class="sec-label">いまの気分から</p>
    <div class="scenes" id="scenes">${mc.SCENES.map(s => `<button type="button" data-scene="${s.key}">${esc(s.label)}</button>`).join('')}</div>
    <p class="notice ${state.noticeLevel === 'err' ? 'err' : ''}" id="home-notice" role="status" aria-live="polite" style="display:${state.notice ? 'block' : 'none'}">${esc(state.notice)}</p>`;
}
function listHtml(vr) {
  const { list, radiusNote } = vr;
  const f = state.filters, idx = state.index;
  const prefOpts = idx.prefectures.map(p => `<option value="${p.code}" ${p.code === state.pref ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const nVerified = list.filter(r => isChecked(r.id)).length;
  const view = list.slice(0, state.shown);
  // 絞り込みの中身は既定で畳む。開いたままだと 390px 幅ではカードが1枚しか見えない。
  const nActive = [f.openNow, f.verifiedOnly, f.hideChain, f.gemOnly, state.origin && f.radiusKm !== 3].filter(Boolean).length;
  return `<div class="search"><span class="icon">⌕</span><input id="q" type="search" placeholder="施設名・駅名・地名" value="${esc(f.q)}" autocomplete="off"><ul class="suggest" id="suggest"></ul></div>
    <div class="row"><button class="tog" id="btn-locate" type="button" aria-pressed="${state.origin && state.origin.kind === 'geo' ? 'true' : 'false'}">◎ 現在地</button>
      <select class="tog" id="pref" aria-label="都道府県">${prefOpts}</select>
      <button class="tog" id="btn-filters" type="button" aria-expanded="${state.filtersOpen}" aria-controls="more-filters">絞り込み${nActive ? ` <b class="badge">${nActive}</b>` : ''}</button></div>
    <div class="row" id="more-filters" ${state.filtersOpen ? '' : 'hidden'}>
      <button class="tog" id="tog-open" type="button" aria-pressed="${f.openNow}">いま営業中</button>
      <button class="tog" id="tog-verified" type="button" aria-pressed="${f.verifiedOnly}">確認済みのみ</button>
      <button class="tog" id="tog-chain" type="button" aria-pressed="${f.hideChain}">チェーンを隠す</button>
      ${state.origin ? `<select class="tog" id="radius" aria-label="半径"><option value="1" ${f.radiusKm === 1 ? 'selected' : ''}>1km</option><option value="3" ${f.radiusKm === 3 ? 'selected' : ''}>3km</option><option value="10" ${f.radiusKm === 10 ? 'selected' : ''}>10km</option><option value="Infinity" ${!Number.isFinite(f.radiusKm) ? 'selected' : ''}>制限なし</option></select>` : ''}
      <button class="tog" id="btn-reset" type="button">リセット</button></div>
    <div class="chips" id="chips"><button class="chip" data-cat="" aria-pressed="${!f.cat && !f.kinds}">すべて</button>${mc.DISPLAY_CATS.map(c => `<button class="chip" data-cat="${c.key}" aria-pressed="${f.cat === c.key}">${c.label}</button>`).join('')}</div>
    ${state.origin ? `<p class="origin-line"><b>${esc(state.origin.label)}</b> から近い順</p>` : ''}
    ${radiusNote ? `<p class="notice" role="status" aria-live="polite">${esc(radiusNote)}</p>` : ''}
    ${state.notice ? `<p class="notice ${state.noticeLevel === 'err' ? 'err' : ''}" role="status" aria-live="polite">${esc(state.notice)}</p>` : ''}
    <p class="count" id="count"><b class="v">確認済み ${nVerified.toLocaleString()}件</b><span>候補 ${(list.length - nVerified).toLocaleString()}件</span></p>
    <div id="list">${state.loading ? '<div class="skel"></div><div class="skel"></div><div class="skel"></div>' : (view.map(cardHtml).join('') + listTailHtml(list))}</div>`;
}
// 一覧の末尾（0件の言い分と「もっと見る」）。listHtml と refreshList で同じものを出す。
// 片方にしか無いと、検索を打った瞬間に空の理由が消えたり、ボタンが残り続けたりする。
function listTailHtml(list) {
  if (state.loading) return '';
  if (!list.length) {
    const near = state.origin ? mc.nearestChecked(state.rows, state.origin.lat, state.origin.lon, isChecked) : null;
    return `<p class="notice" role="status" aria-live="polite">条件に合う施設がありません。${near ? `このエリアはまだ調査前です。最寄りの確認済み: <button type="button" class="open-detail link" data-id="${esc(near.item.id)}">${esc(near.item.name)}</button>（約${(near.distM / 1000).toFixed(1)}km）` : '条件を緩めてお試しください。'}</p>`;
  }
  return list.length > state.shown ? '<button class="more" id="btn-more" type="button">もっと見る</button>' : '';
}
export function render() {
  const body = $('sheet-body');
  if (!state.index) { body.innerHTML = '<div class="skel"></div>'; return; }
  // viewRows() は全件を回すので、1回の描画で1度だけ。一覧とピンで同じ結果を使う。
  const vr = state.sheet === 'list' ? viewRows() : null;
  if (state.sheet === 'home') body.innerHTML = homeHtml();
  else if (state.sheet === 'list') body.innerHTML = listHtml(vr);
  else if (state.sheet === 'detail') body.innerHTML = detailHtml();
  else if (state.sheet === 'saved') body.innerHTML = savedHtml();
  else if (state.sheet === 'about') body.innerHTML = aboutHtml();
  $('saved-count').textContent = state.saved ? mc.savedCount(state.saved) : 0;
  bindBody();
  if (state.sheet === 'detail') bindDetail();
  if (state.sheet === 'saved') bindSaved();
  if (state.sheet === 'about') bindAbout();
  if (state.sheet === 'list') renderMarkers(vr.list.slice(0, state.shown), vr.list);
  else if (state.sheet === 'detail') { const all = lastView.length ? lastView : viewRows().list; renderMarkers(all.slice(0, state.shown), all); }
  else if (state.sheet === 'saved') renderMarkers(savedRows());
  else renderMarkers([]);
}
// Task 9/10/11 で実装する。ここでは空を返しておく。
let detailHtml = () => '', savedHtml = () => '', aboutHtml = () => '', savedRows = () => [];
export function setRenderers(r) { if (r.detailHtml) detailHtml = r.detailHtml; if (r.savedHtml) savedHtml = r.savedHtml; if (r.aboutHtml) aboutHtml = r.aboutHtml; if (r.savedRows) savedRows = r.savedRows; }

// --- 操作 ---
export async function useArea(code) {
  const gen = beginLoad();
  state.pref = Number(code); state.origin = null; setNotice(''); resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try { await loadPref(state.pref); if (isStale(gen)) return; await loadCurated(state.pref); }
  catch (e) { if (isStale(gen)) return; setNotice(`データを読み込めませんでした（${e.message}）`); }
  if (isStale(gen)) return;
  state.loading = false; moved = false; render();
  location.hash = `pref=${state.pref}`;
}
export async function useOrigin(lat, lon, label, kind) {
  const gen = beginLoad();
  state.origin = { lat, lon, label, kind }; setNotice(''); resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try {
    const geo = await loadJson('data/hitori/prefectures_svg.json');
    if (isStale(gen)) return;
    const code = core.prefectureAt(lat, lon, geo);
    state.pref = code;
    await loadPref(code); if (isStale(gen)) return;
    await loadCurated(code); if (isStale(gen)) return;
    state.loading = false; render();
    const nb = await loadJson('data/hitori/neighbors.json');
    if (isStale(gen)) return;
    await Promise.all((nb[String(code)] || []).map(async c => { await loadPref(c); if (isStale(gen)) return; await loadCurated(c); }));
  } catch (e) { if (isStale(gen)) return; setNotice(`データを読み込めませんでした（${e.message}）`); }
  if (isStale(gen)) return;
  state.loading = false; render();
}
function locate() {
  if (!navigator.geolocation) { setNotice('このブラウザーでは現在地を取得できません。エリアを選んでお探しください。'); render(); return; }
  setNotice('現在地を取得しています…', ''); render();   // 途中経過。失敗ではないので赤くしない
  navigator.geolocation.getCurrentPosition(p => { track('hitori.locate'); useOrigin(p.coords.latitude, p.coords.longitude, '現在地', 'geo'); },
    err => { const m = { 1: '現在地の利用が許可されませんでした。エリアか駅名でお探しください。', 2: '現在地を取得できませんでした。', 3: '現在地の取得が時間切れになりました。' }; setNotice(m[err.code] || '現在地を取得できませんでした。'); render(); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}
export function select(r) { if (!r) return; state.current = r; state.sheet = 'detail'; track('hitori.detail'); render(); setSnap('half'); }
// 結果ではなく「取りに行っている約束」を覚える。結果だけだと、届く前の打鍵ごとに fetch が走る。
let placesP = null;
async function suggest(q) {
  const ul = $('suggest'); if (!ul) return;
  if (!q || q.length < 1) { ul.classList.remove('show'); return; }
  if (!placesP) placesP = loadJson('data/hitori/places.json').then(core.rowsToObjects)
    .catch(e => { placesP = null; throw e; });   // 失敗は覚えない（次の打鍵で引き直す）
  let places;
  try { places = await placesP; } catch (e) { return; }
  const hits = core.searchPlaces(places, q, 6);
  ul.innerHTML = hits.map((p, i) => `<li><button type="button" data-place="${i}">${esc(p.name)}<small>${p.type === 's' ? '駅' : '市区町村'}</small></button></li>`).join('');
  ul.classList.toggle('show', hits.length > 0);
  ul.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { const p = hits[Number(b.dataset.place)]; state.filters.q = ''; useOrigin(p.lat, p.lon, `${p.name}${p.type === 's' ? '駅' : ''}`, 'place'); }));
}
let searchTimer = null;
// root を渡すとその中だけを結び直す。作り直していない要素に二重で結ばないため（refreshList から使う）。
function bindBody(root) {
  const body = root || $('sheet-body');
  const on = (sel, ev, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
  on('#btn-locate', 'click', locate);
  on('#btn-area', 'click', () => useArea(state.pref));
  on('#pref', 'change', e => useArea(e.target.value));
  on('[data-scene]', 'click', e => { const s = mc.SCENES.find(x => x.key === e.currentTarget.dataset.scene); state.filters.cat = s.cat || ''; state.filters.kinds = s.kinds; state.filters.openNow = s.openNow; if (navigator.geolocation) locate(); else useArea(state.pref); });
  // 打鍵のたびに全件を絞り込むと、長い一覧では入力が引っかかる。打ち終わりを 200ms 待つ。
  on('#q', 'input', e => {
    state.filters.q = e.target.value;
    const q = e.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { suggest(q); refreshList(); }, 200);
  });
  on('#btn-filters', 'click', () => { state.filtersOpen = !state.filtersOpen; render(); });
  on('#tog-open', 'click', () => { state.filters.openNow = !state.filters.openNow; render(); });
  on('#tog-verified', 'click', () => { state.filters.verifiedOnly = !state.filters.verifiedOnly; render(); });
  on('#tog-chain', 'click', () => { state.filters.hideChain = !state.filters.hideChain; render(); });
  on('#radius', 'change', e => { state.filters.radiusKm = Number(e.target.value); render(); });
  on('#btn-reset', 'click', () => { state.filters = { q: '', cat: '', kinds: null, verifiedOnly: false, openNow: false, hideChain: false, gemOnly: false, radiusKm: 3 }; state.current = null; render(); });
  on('#chips [data-cat]', 'click', e => { state.filters.cat = e.currentTarget.dataset.cat; state.filters.kinds = null; state.shown = PAGE; render(); });
  on('#btn-more', 'click', () => { state.shown += PAGE; render(); });
  // カード全体を押せる面にする（施設名だけだと当たりが 21px しかなかった）。
  on('.card', 'click', e => { if (e.target.closest('[data-want]')) return; openDetail(e.currentTarget.dataset.id); });
  // カード内の施設名ボタンはキーボード用。クリックはカード側が受けるので二重に開かない。
  on('.open-detail', 'click', e => { if (e.currentTarget.closest('.card')) return; openDetail(e.currentTarget.dataset.id); });
  // 保存シートには未読込の県の施設も並ぶ。byId に無ければ保存時のスナップショットを渡す。
  on('[data-want]', 'click', e => { e.stopPropagation(); const id = e.currentTarget.dataset.want; toggleWant(state.byId.get(id) || savedSnap(id)); });
}
function refreshList() {
  // 入力のたびにシート全体を作り直すと input のフォーカスが飛ぶ。一覧と件数だけ差し替える。
  const { list } = viewRows(); const nV = list.filter(r => isChecked(r.id)).length;
  $('count').innerHTML = `<b class="v">確認済み ${nV.toLocaleString()}件</b><span>候補 ${(list.length - nV).toLocaleString()}件</span>`;
  $('list').innerHTML = list.slice(0, state.shown).map(cardHtml).join('') + listTailHtml(list);
  bindBody($('list')); renderMarkers(list.slice(0, state.shown), list);
}
// 距離つきの複製（lastView）を優先して渡す。byId の元オブジェクトには distM が無い。
// 保存シートには県ファイルを読んでいない施設も並ぶ（別の県に切り替えると byId は入れ替わる）。
// その場合はスナップショットの県だけ読み直してから開く。読んでも無ければ掲載終了として伝える。
async function openDetail(id) {
  const row = lastView.find(x => x.id === id) || state.byId.get(id);
  if (row) { select(row); return; }
  const snap = savedSnap(id);
  if (!snap) return;
  const gen = beginLoad();
  state.loading = true; render();
  try { await loadPref(snap.pref); if (isStale(gen)) return; await loadCurated(snap.pref); }
  catch (e) { if (isStale(gen)) return; state.loading = false; setNotice(`データを読み込めませんでした（${e.message}）`); render(); return; }
  if (isStale(gen)) return;
  state.loading = false;
  const r = state.byId.get(id);
  if (r) select(r); else { setNotice('この施設は現在掲載していません。', ''); render(); }
}
export function toggleWant(r) {
  if (!r || !state.saved || !storage) { setNotice('この端末では保存できません。'); render(); return; }
  state.saved = mc.toggleWant(state.saved, r, r.pref); mc.saveSaved(storage, state.saved); track('hitori.save'); render();
}

// --- 起動 ---
async function boot() {
  initMap(); bindSheetDrag();
  // 共有URLで開いた他人のリストを、自分の♡が開いたときに引きずらない。
  $('btn-saved').addEventListener('click', () => { sharedList = null; openOverlay('saved'); render(); setSnap('half'); });
  $('btn-menu').addEventListener('click', () => { openOverlay('about'); render(); setSnap('full'); });
  $('btn-research').addEventListener('click', () => { moved = false; $('btn-research').classList.remove('show'); const b = map.getBounds(); const c = b.getCenter(); useOrigin(c.lat, c.lng, '地図の中心', 'map'); });
  try { state.index = await loadJson('data/hitori/index.json'); } catch (e) { $('sheet-body').innerHTML = `<p class="notice err">データを読み込めませんでした（${esc(e.message)}）<br><button class="tog" type="button" onclick="location.reload()">再読み込み</button></p>`; return; }
  renderAboutStatic(); loadJournal();
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('facility') && params.get('pref')) { await useArea(params.get('pref')); const r = state.byId.get(params.get('facility')); if (r) select(r); else { setNotice('この施設は現在掲載していません。', ''); render(); } }
  else if (params.get('saved')) { await restoreShared(params.get('saved')); }
  else if (hash.get('pref')) await useArea(hash.get('pref'));
  else render();
  window.__ready = true;
}
let restoreShared = async () => {};   // Task 10 で差し替える
export function setRestoreShared(fn) { restoreShared = fn; }
// --- 詳細 ---
let journal = null;
// index.json が載ってから引く（版の ?v= を付けるため）。boot() から呼ぶ。
function loadJournal() { return loadJson('data/hitori/journal_links.json').then(j => { journal = j; }).catch(() => { journal = {}; }); }
// データの web は scheme の無いもの（men-eiji.com）が19件ある。そのまま href に入れると
// 相対リンクになり、hitori.html の隣を指してしまう。javascript: などの別 scheme は捨てる。
const safeUrl = u => {
  const s = String(u || '').trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  return s ? `https://${s}` : '';
};
// 行った日の初期値。toISOString() は UTC なので、JST の 0:00〜8:59 に開くと前日が入ってしまう。
const localDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 確認した事実。食い違いは本サービスの看板なので畳まない（隠すと「1つの正解」に丸めたのと同じになる）。
// 争いの無い事実だけを畳み、開いた瞬間に長い一覧を浴びせないようにする。
function factRowHtml(row) {
  return `<div class="fact-row ${row.conflict ? 'conflict' : ''}"><b>${esc(row.label)}${row.conflict ? ' <span class="warn">⚠ 出典で食い違い</span>' : ''}</b>${row.values.map(v => {
    const vu = safeUrl(v.url);
    return `<div class="val">${esc(v.text)} <small>← ${vu ? `<a href="${esc(vu)}" target="_blank" rel="noreferrer">${esc(v.domain)}</a>` : esc(v.domain)}${v.official ? '（公式）' : ''}${v.personal ? '（個人訪問記）' : ''}</small></div>`;
  }).join('')}</div>`;
}
function factsHtml(g) {
  if (!g || !g.rows.length) return '';
  const bad = g.rows.filter(r => r.conflict), ok = g.rows.filter(r => !r.conflict);
  const conflicts = bad.length
    ? `<section class="facts-conflict"><p class="sec-label">出典が食い違っている ${bad.length}件</p>${bad.map(factRowHtml).join('')}<p class="ck-legend">どちらかを選んで捨てず、両方を出しています。利用前に公式でご確認ください。</p></section>`
    : '';
  const rest = ok.length
    ? `<details class="fold"><summary><span class="sec-label">確認した事実</span><b>${ok.length}件の根拠と出典を見る</b></summary><div class="fold-body">${ok.map(factRowHtml).join('')}</div></details>`
    : '';
  return conflicts + rest;
}
// ひとりチェック。6つの問いを ●確認済み / ◐根拠は公式以外 / △記載なし / ✕条件あり で一列に出す。
// 長い引用は畳んだ中に置く。開いた瞬間に文章を浴びせないことがこの画面の要件。
const CHECK_MARK = { ok: '●', weak: '◐', unknown: '△', blocked: '✕' };
const CHECK_TITLE = { ok: '公式に記載あり', weak: '記載はあるが公式ではない', unknown: '記載を確認できていない', blocked: 'ひとりで行くのに条件がある' };
function soloCheckHtml(entry, item) {
  const c = mc.soloCheck(entry, item);
  const cells = c.cells.map(x => `<li class="ck ${x.state}">
    <span class="mk" role="img" aria-label="${esc(CHECK_TITLE[x.state])}">${CHECK_MARK[x.state]}</span>
    <span class="lb">${esc(x.label)}</span>
    <span class="sh">${esc(x.short)}</span>
    ${x.quote ? `<button class="why" type="button" data-why="${esc(x.key)}" aria-expanded="false" aria-label="${esc(x.label)}の根拠を見る">根拠</button><p class="qt" id="qt-${esc(x.key)}" hidden>${esc(x.quote)}${x.official ? ' <em>公式</em>' : ''}</p>` : ''}
  </li>`).join('');
  return `<section class="solo-box">
    <p class="sec-label">ひとりチェック <b class="score">${c.known}/${c.total} 確認済み</b></p>
    <ul class="checks">${cells}</ul>
    <p class="ck-legend">● 公式に記載　◐ 公式以外の根拠　△ 記載なし（悪いという意味ではありません）　✕ 条件あり</p>
  </section>`;
}
function detailHtmlImpl() {
  const r = state.current; if (!r) return '';
  const cur = curatedOf(r.id);
  const cat = mc.displayCat(r.kind, r.cat);
  const g = cur ? mc.groupFacts(cur, cat) : null;
  const s = cur ? mc.summarizeCurated(cur) : null;
  const open = mc.openLabel(r, hoursFactOf(r.id), new Date());
  const base = `${location.origin}${location.pathname}`;
  const url = mc.facilityShareUrl(base, r.pref, r.id);
  const saved = state.saved || { want: {}, went: {} };
  const went = saved.went[r.id];
  const dist = state.origin && Number.isFinite(r.distM) ? `${(r.distM / 1000).toFixed(1)}km` : '';
  const jl = journal && journal[String(r.pref)];
  const reportText = `@ViewsEngineer ひとり歓迎マップの「${r.name}」の情報が違います：\n（何がどう違うか）\n${url}`;
  const rLat = Number(r.lat), rLon = Number(r.lon);
  const hasLatLon = Number.isFinite(rLat) && Number.isFinite(rLon);   // 座標が無い施設に経路は出さない
  const web = safeUrl(r.web);
  return `<div id="detail">
    <button class="tog" id="btn-back" type="button">‹ 一覧へ</button>
    ${g && g.warnings.length ? g.warnings.map(w => `<p class="notice ${w.level === 'danger' ? 'err' : ''}" role="status" aria-live="polite">${w.level === 'danger' ? '⚠ ' : ''}${esc(w.text)}</p>`).join('') : ''}
    <h2 style="margin:10px 0 2px;font-family:'Noto Serif JP',serif;font-size:22px;line-height:1.3">${esc(r.name)}</h2>
    <div class="meta" style="color:var(--muted);font-size:12.5px">${esc(mc.kindJa(r.kind))}${r.city ? ` · ${esc(r.city)}` : ''}${dist ? ` · ${dist}` : ''} · <span class="${open.state}" style="font-weight:700;color:${open.state === 'open' ? 'var(--sage)' : open.state === 'closed' ? '#9a6b1d' : 'inherit'}">${esc(open.text)}</span>${open.source ? `<small>（${esc(open.source)}）</small>` : ''}</div>
    ${s ? `<section class="verified-box" style="margin:12px 0;padding:10px 12px;border-radius:12px;background:var(--sage-pale);color:var(--sage);font-size:12.5px"><b>✓ 確認済み ${esc(s.checked)}</b><br><span class="vsub">事実 ${s.nFacts}件 · 公式 ${s.nOfficial}件 · 出典 ${s.nDomains}件 · 食い違い ${s.nConflict}件</span></section>`
        : `<section class="verified-box" style="margin:12px 0;padding:10px 12px;border-radius:12px;background:#f5f0ea;color:#6f655f;font-size:12.5px"><b>未確認</b> — OpenStreetMap の登録情報のみです。利用前に公式情報をご確認ください。${mc.fitNote(r.kind) ? `<br>業態の見立て: ${esc(mc.fitNote(r.kind))}` : ''}</section>`}
    ${soloCheckHtml(cur, r)}
    ${g && g.insight ? `<details class="fold"><summary><span class="sec-label">一人マップのひとこと</span><b>${esc(g.insight.title)}</b></summary><p class="fold-body">${esc(g.insight.insight)}</p></details>` : ''}
    ${factsHtml(g)}
    <div class="row" style="margin-top:14px">
      <button class="tog" type="button" data-want="${esc(r.id)}" aria-pressed="${saved.want[r.id] ? 'true' : 'false'}">♡ 行きたい</button>
      <button class="tog" id="btn-went" type="button" aria-pressed="${went ? 'true' : 'false'}">✓ 行った${went && went.date ? ` ${esc(went.date)}` : ''}</button>
      ${hasLatLon ? `<a class="tog" id="btn-route" href="https://www.google.com/maps/dir/?api=1&destination=${rLat},${rLon}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">経路</a>` : ''}
      ${web ? `<a class="tog" href="${esc(web)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">公式サイト</a>` : ''}
      <button class="tog" id="btn-share" type="button">共有</button>
      <a class="tog" id="btn-report" href="https://x.com/intent/post?text=${encodeURIComponent(reportText)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;text-decoration:none">情報が違う</a>
    </div>
    <form id="went-form" style="display:none;margin:8px 0;padding:10px;border:1px solid var(--line);border-radius:12px;background:#fff">
      <label style="font-size:12px">日付 <input type="date" name="date" value="${esc(went ? went.date : localDay(new Date()))}" style="min-height:40px;border:1px solid var(--line);border-radius:8px;padding:0 8px"></label>
      <label style="display:block;font-size:12px;margin-top:6px">ひとこと <input type="text" name="memo" maxlength="80" value="${esc(went ? went.memo : '')}" placeholder="任意" style="width:100%;min-height:40px;border:1px solid var(--line);border-radius:8px;padding:0 8px"></label>
      <div class="row" style="margin-top:8px"><button class="tog" type="submit">保存</button>${went ? '<button class="tog" type="button" id="btn-unwent">記録を消す</button>' : ''}</div>
    </form>
    ${jl && jl.length ? `<section class="journal" style="margin:16px 0;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff"><p class="sec-label" style="margin:0 0 4px">この土地の一人旅</p>${jl.map(j => `<a href="${esc(j.url)}" style="display:block;color:#8d4734;font-weight:700;font-size:13px;text-decoration:none;margin:4px 0">${esc(j.title)} →</a>`).join('')}</section>` : ''}
  </div>`;
}
function bindDetail() {
  const r = state.current; if (!r || !$('detail')) return;
  $('btn-back').addEventListener('click', () => { state.current = null; state.sheet = 'list'; render(); });
  const route = $('btn-route'); if (route) route.addEventListener('click', () => track('hitori.route'));
  // 根拠ボタン。引用は既定で畳んでおき、押した項目だけ開く。
  document.querySelectorAll('#detail .why').forEach(btn => btn.addEventListener('click', () => {
    const q = $(`qt-${btn.dataset.why}`); if (!q) return;
    const open = q.hasAttribute('hidden');
    if (open) q.removeAttribute('hidden'); else q.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '閉じる' : '根拠';
  }));
  $('btn-went').addEventListener('click', () => { const f = $('went-form'); f.style.display = f.style.display === 'none' ? 'block' : 'none'; });
  $('went-form').addEventListener('submit', e => {
    e.preventDefault(); if (!state.saved || !storage) { setNotice('この端末では保存できません。'); render(); return; }
    const fd = new FormData(e.target);
    state.saved = mc.setWent(state.saved, r, r.pref, { date: fd.get('date'), memo: fd.get('memo') }); mc.saveSaved(storage, state.saved); track('hitori.save'); render();
  });
  const un = $('btn-unwent'); if (un) un.addEventListener('click', () => { state.saved = mc.removeWent(state.saved, r.id); mc.saveSaved(storage, state.saved); render(); });
  $('btn-share').addEventListener('click', async e => {
    const url = mc.facilityShareUrl(`${location.origin}${location.pathname}`, r.pref, r.id);
    const text = `ひとりで行きやすい行き先: 「${r.name}」${r.city ? `（${r.city}）` : ''} — 根拠つきの利用情報はこちら`;
    if (navigator.share) { try { await navigator.share({ title: `${r.name} | ひとり歓迎マップ`, text, url }); return; } catch (err) {} }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); e.currentTarget.textContent = 'コピーしました'; } catch (err) { window.prompt('リンクをコピーしてください', url); }
  });
}
setRenderers({ detailHtml: detailHtmlImpl });

// --- 保存シート ---
let savedTab = 'want', sharedList = null;   // sharedList: 共有URLで開いたときの [{pref,id}]
// 県ファイルを読んでいない施設でも、保存時のスナップショット（名前・座標・種別）だけでカードを描く。
function savedSnap(id) {
  const s = state.saved; if (!s) return null;
  const v = s.want[id] || s.went[id];
  return v ? { id, ...v } : null;
}
function savedRowsImpl() {
  const s = state.saved || { want: {}, went: {} };
  const ids = sharedList ? sharedList.map(x => x.id) : Object.keys(savedTab === 'want' ? s.want : s.went);
  return ids.map(id => state.byId.get(id) || savedSnap(id)).filter(Boolean);
}
function savedHtmlImpl() {
  const s = state.saved || { want: {}, went: {} };
  const rows = savedRowsImpl();
  const shareUrl = `${location.origin}${location.pathname}?saved=${mc.encodeSavedParam(s)}`;
  const tabs = `<div id="saved-tabs" class="row" style="margin:0"><button class="tog" type="button" data-tab="want" aria-pressed="${savedTab === 'want'}">行きたい ${Object.keys(s.want).length}</button><button class="tog" type="button" data-tab="went" aria-pressed="${savedTab === 'went'}">行った ${Object.keys(s.went).length}</button></div>`;
  const emptyText = sharedList ? '共有されたリストに表示できる施設がありません。' : 'まだありません。施設の ♡ で「行きたい」に追加できます。';
  return `<div id="saved">
    <div class="row"><button class="tog" id="btn-back" type="button">‹ 戻る</button>
      ${sharedList ? '<b style="font-size:13px">共有されたリスト</b>' : tabs}</div>
    ${!state.saved ? '<p class="notice err">この端末では保存できません（ブラウザーの設定で保存領域が使えません）。</p>' : ''}
    ${state.notice ? `<p class="notice ${state.noticeLevel === 'err' ? 'err' : ''}" role="status" aria-live="polite">${esc(state.notice)}</p>` : ''}
    ${state.loading ? '<div class="skel"></div><div class="skel"></div>' : (rows.length ? rows.map((r, i) => cardHtml(r, i)).join('') : `<p class="notice">${emptyText}</p>`)}
    ${!sharedList && mc.savedCount(s) ? `<button class="tog" id="btn-share-saved" type="button" data-url="${esc(shareUrl)}">このリストの共有URLをコピー</button>` : ''}
    ${sharedList && rows.length ? '<button class="tog" id="btn-adopt" type="button">自分の「行きたい」に取り込む</button>' : ''}
  </div>`;
}
function bindSaved() {
  if (!$('saved')) return;
  $('btn-back').addEventListener('click', () => { sharedList = null; setNotice(''); closeOverlay(); });
  document.querySelectorAll('#saved-tabs [data-tab]').forEach(b => b.addEventListener('click', () => { savedTab = b.dataset.tab; render(); }));
  const sh = $('btn-share-saved');
  if (sh) sh.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(sh.dataset.url); sh.textContent = 'コピーしました'; }
    catch (err) { window.prompt('URLをコピーしてください', sh.dataset.url); }
  });
  const ad = $('btn-adopt');
  if (ad) ad.addEventListener('click', () => {
    if (!state.saved || !storage) { setNotice('この端末では保存できません。'); render(); return; }
    for (const r of savedRowsImpl()) if (!state.saved.want[r.id]) state.saved = mc.toggleWant(state.saved, r, r.pref);
    mc.saveSaved(storage, state.saved); track('hitori.save');
    sharedList = null; savedTab = 'want'; setNotice(''); render();
  });
}
// 共有URL（?saved=14:n1,13:n2）で開いたとき。県ファイルは載っている分だけ引く。
async function restoreSharedImpl(param) {
  const gen = beginLoad();
  const list = mc.parseSavedParam(param);
  sharedList = list; setNotice(''); state.sheet = 'saved'; state.loading = true; render(); setSnap('half');
  // curated も引く。無いと確認済みの施設がカードでも詳細でも「未確認」に見えてしまう。
  // allSettled: 1県が落ちても残りは出す。読めた県の分だけカードに出す。
  const res = await Promise.allSettled([...new Set(list.map(x => x.pref))]
    .map(async c => { await loadPref(c); if (isStale(gen)) return; await loadCurated(c); }));
  if (isStale(gen)) return;
  const bad = res.find(x => x.status === 'rejected');
  sharedList = list.filter(x => state.byId.has(x.id));
  if (list.length) state.pref = list[0].pref;   // 「戻る」で開く一覧を共有元の県に合わせる
  // 読み込みに失敗した県があるときは、その事実を先に伝える。
  // 「掲載していません」を出すと、落ちた県の施設が消えたように読めてしまう。
  if (bad) setNotice(`データを読み込めませんでした（${(bad.reason && bad.reason.message) || bad.reason}）`);
  else if (sharedList.length < list.length) setNotice(`${list.length - sharedList.length}件は現在掲載していません。`, '');
  state.loading = false; render();
}
setRenderers({ savedHtml: savedHtmlImpl, savedRows: savedRowsImpl });
setRestoreShared(restoreSharedImpl);

// --- このマップについて ---
const REQ_TEXT = '@ViewsEngineer ひとり歓迎マップに載せてほしい店があります：\n店名・エリア：\nひとりで入りやすいと思う理由：';
function aboutHtmlImpl() {
  const idx = state.index;
  const prefs = idx.prefectures.slice().sort((a, b) => b.checked - a.checked);
  return `<div id="about">
    <button class="tog" id="btn-back" type="button">‹ 戻る</button>
    <h2 style="margin:12px 0 4px;font-family:'Noto Serif JP',serif;font-size:20px">情報を、曖昧なままおすすめしない。</h2>
    <p style="font-size:13px;color:#655b55">「ひとりで入れるか」を一本の軸にして、全国 ${idx.total.toLocaleString()} 施設を並べ直した地図です。${idx.checked_count.toLocaleString()} 件は公式情報などで裏を取り、出典URLを添えています。</p>
    <p class="sec-label">三つの決めごと</p>
    <ol style="padding-left:18px;font-size:13px;color:#655b55"><li>店の自己申告に頼らず、観測できる属性（業態・席・営業形態・チェーンか）から組み立てる</li><li>混雑は測れないので、周辺に同業が少ない独立店を「穴場候補」として代理指標にする</li><li>事実には出典・URL・公式かどうかを必ず添え、出典同士の<b>食い違いは消さずに両方見せる</b></li></ol>
    <p><a href="method/hitori-kijun.html" style="color:#8d4734;font-weight:700">この地図の作り方（ひとり基準）→</a></p>
    <p class="sec-label">載っていない店を見つけたら</p>
    <a class="tog" id="btn-request" href="https://x.com/intent/post?text=${encodeURIComponent(REQ_TEXT)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;text-decoration:none;background:var(--accent);color:#fff;border-color:var(--accent)">この店を載せてほしい（Xで送る）</a>
    <p style="font-size:12px;color:var(--muted)">確認できたものから、根拠つきで追加していきます。</p>
    <p class="sec-label">都道府県別の確認済み件数</p>
    <ul class="roadmap" style="columns:2;padding-left:18px;font-size:12px;color:#655b55">${prefs.map(p => `<li>${esc(p.name)} <b>${p.checked}</b> / ${p.count.toLocaleString()}</li>`).join('')}</ul>
    <p class="sec-label">出典</p>
    <p style="font-size:12px;color:var(--muted)">施設データ: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors / ODbL</a> ／ 地図タイル: <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a> ／ 人口: Wikidata (CC0)・令和2年国勢調査 ／ 確認済み情報は各施設に個別出典を表示 ／ <a href="./hitori-legacy.html">旧版</a></p>
    <p class="sec-label">次はこちら</p>
    <a href="hitoritabi/" style="display:flex;align-items:center;min-height:44px;color:#8d4734;font-weight:700;text-decoration:none;margin:4px 0">一人旅ジャーナル — 実際に行った32本 →</a>
    <a href="cabin.html" style="display:flex;align-items:center;min-height:44px;color:#8d4734;font-weight:700;text-decoration:none;margin:4px 0">森の小屋 — 出かけられない日のための、行かなくていい場所 →</a>
    <a href="./" style="display:flex;align-items:center;min-height:44px;color:#8d4734;font-weight:700;text-decoration:none;margin:12px 0">← ひとりぶんの棚（ほかの作品を見る）</a>
  </div>`;
}
function bindAbout() { if ($('about')) $('btn-back').addEventListener('click', closeOverlay); }
// 説明・出典・都道府県別の件数は、シートを開かなくても DOM に在る（spec §2.3）。
// クローラーと、スクリプトの引き出しを開けない読み手のための静的な写し。
// 中のボタンには何も結ばない（読み物としてだけ置く）。id はライブのシートと衝突するので落とす。
function renderAboutStatic() {
  const host = $('about-static');
  if (!host || !state.index) return;
  host.innerHTML = aboutHtmlImpl().replace(/\sid="[^"]*"/g, '');
}
setRenderers({ aboutHtml: aboutHtmlImpl });

// boot() は必ずファイルの最後の行に置く。Task 9〜11 の追記はこの行より前に挿入する
// （setRenderers が初回 render より先に走ることを、評価順で保証するため）。
boot();
