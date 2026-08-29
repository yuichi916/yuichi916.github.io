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
  current: null, saved: null, sheet: 'home', snap: 'half', shown: PAGE, pref: 14, notice: '', loading: false,
};
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
}
export function renderMarkers(view) {
  if (!map) return;
  layerCand.clearLayers(); layerPin.clearLayers();
  const bounds = [];
  view.forEach((r, i) => {
    const ll = [Number(r.lat), Number(r.lon)];
    if (!Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return;
    bounds.push(ll);
    const checked = isChecked(r.id), selected = state.current && state.current.id === r.id;
    const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
    if (!checked && !selected && !saved) {
      L.circleMarker(ll, { renderer: canvas, radius: 5, color: '#fff', weight: 1.5, fillColor: '#b9ada3', fillOpacity: .85 })
        .on('click', () => select(r)).addTo(layerCand);
      return;
    }
    const icon = L.divIcon({ className: '', html: `<div class="pin ${selected ? 'selected' : ''} ${saved && !selected ? 'saved' : ''}">${i + 1}</div>`,
      iconSize: selected ? [38, 38] : [26, 26], iconAnchor: selected ? [19, 19] : [13, 13] });
    L.marker(ll, { icon, zIndexOffset: selected ? 1000 : checked ? 500 : 0 }).bindTooltip(esc(r.name), { direction: 'top', offset: [0, -14] })
      .on('click', () => select(r)).addTo(layerPin);
  });
  if (originMarker) originMarker.remove();
  if (state.origin) originMarker = L.marker([state.origin.lat, state.origin.lon], { icon: L.divIcon({ className: '', html: '<div class="origin-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
  if (state.current) selfView(() => map.setView([Number(state.current.lat), Number(state.current.lon)], Math.max(map.getZoom(), 15), { animate: true }));
  else if (!moved && bounds.length > 1) selfView(() => map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 }));
  else if (!moved && bounds.length === 1) selfView(() => map.setView(bounds[0], 14));
}

// --- データ ---
const rev = `${Date.now().toString(36)}`;
const loadJson = path => fetch(`${path}?v=${rev}`).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); });
export function isChecked(id) { return !!(state.index && state.index.checked[id]); }
export async function loadPref(code) {
  code = Number(code);
  if (state.prefLoaded.has(code)) return;
  const doc = await loadJson(`data/hitori/pref/${String(code).padStart(2, '0')}.json`);
  for (const r of core.rowsToObjects(doc)) { if (!state.byId.has(r.id)) { r.pref = code; state.byId.set(r.id, r); state.rows.push(r); } }
  state.prefLoaded.add(code);
}
export async function loadCurated(code) {
  code = Number(code);
  if (!state.curatedByPref.has(code)) state.curatedByPref.set(code, await loadJson(`data/hitori/curated/${String(code).padStart(2, '0')}.json`));
  return state.curatedByPref.get(code);
}
function resetRows() { state.rows = []; state.byId = new Map(); state.prefLoaded = new Set(); state.current = null; state.shown = PAGE; moved = false; }

// --- シート ---
export function setSnap(snap) { state.snap = snap; $('sheet').dataset.snap = snap; }
export function setSheet(mode) { state.sheet = mode; render(); }
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
function viewRows() {
  const ctx = { checked: isChecked, now: new Date(), origin: state.origin };
  let rows = state.rows;
  if (state.origin) rows = core.withDistance(rows, state.origin.lat, state.origin.lon);
  let list = mc.applyFilters(rows, { ...state.filters, radiusKm: 0 }, ctx);
  let radiusNote = '';
  if (state.origin) {
    const ex = mc.expandRadius(list, state.filters.radiusKm);
    list = ex.items;
    if (ex.expanded) radiusNote = Number.isFinite(ex.radiusKm) ? `${state.filters.radiusKm}km 以内に該当がないため ${ex.radiusKm}km に広げました` : `半径を制限せずに表示しています`;
  }
  return { list: mc.rankItems(list, ctx), radiusNote };
}
function cardHtml(r, i) {
  const checked = isChecked(r.id), meta = checked ? state.index.checked[r.id] : null;
  const cur = checked ? (state.curatedByPref.get(meta[0]) || {})[r.id] : null;
  const g = cur ? mc.groupFacts(cur, mc.displayCat(r.kind, r.cat)) : null;
  const hoursFact = cur ? (cur.facts || []).find(f => (f.k === 'hours' || f.k === 'opening_hours') && !f.conflict) : null;
  const open = mc.openLabel(r, hoursFact, new Date());
  const dist = state.origin && Number.isFinite(r.distM) ? (r.distM < 1000 ? `${Math.max(10, Math.round(r.distM / 10) * 10)}m` : `${(r.distM / 1000).toFixed(r.distM < 10000 ? 1 : 0)}km`) : '';
  const chips = [];
  if (g) for (const s of g.solo.slice(0, 3)) chips.push(`<span>${esc(s.text)}</span>`);
  if (g) { const cd = g.rows.find(x => x.k === 'closed_days'); if (cd && chips.length < 4) chips.push(`<span>${esc(cd.values[0].text)}</span>`); }
  if (mc.isGem(r)) chips.push('<span class="gem">穴場候補</span>');
  if (r.chain) chips.push('<span class="chain">チェーン</span>');
  const saved = state.saved && (state.saved.want[r.id] || state.saved.went[r.id]);
  return `<article class="card ${checked ? '' : 'unverified'} ${state.current && state.current.id === r.id ? 'selected' : ''}" data-id="${esc(r.id)}">
    <div class="top">${checked ? `<span class="vmark">✓ 確認済み ${esc(meta[5])} · 公式${meta[2]}</span>` : '<span class="cand">候補 · OSM由来</span>'}
      <button class="heart" type="button" data-want="${esc(r.id)}" aria-pressed="${saved ? 'true' : 'false'}" aria-label="行きたい">♡</button></div>
    <h3><span class="num">${i + 1}</span><button type="button" class="open-detail" data-id="${esc(r.id)}" style="all:unset;cursor:pointer">${esc(r.name)}</button></h3>
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
    <p class="notice" id="home-notice" style="display:${state.notice ? 'block' : 'none'}">${esc(state.notice)}</p>`;
}
function listHtml() {
  const { list, radiusNote } = viewRows();
  const f = state.filters, idx = state.index;
  const prefOpts = idx.prefectures.map(p => `<option value="${p.code}" ${p.code === state.pref ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const nVerified = list.filter(r => isChecked(r.id)).length;
  const view = list.slice(0, state.shown);
  let empty = '';
  if (!state.loading && !list.length) {
    const near = state.origin ? mc.nearestChecked(state.rows, state.origin.lat, state.origin.lon, isChecked) : null;
    empty = `<p class="notice">条件に合う施設がありません。${near ? `このエリアはまだ調査前です。最寄りの確認済み: <button type="button" class="open-detail" data-id="${esc(near.item.id)}" style="all:unset;cursor:pointer;color:#8d4734;font-weight:700">${esc(near.item.name)}</button>（約${(near.distM / 1000).toFixed(1)}km）` : '条件を緩めてお試しください。'}</p>`;
  }
  return `<div class="search"><span class="icon">⌕</span><input id="q" type="search" placeholder="施設名・駅名・地名" value="${esc(f.q)}" autocomplete="off"><ul class="suggest" id="suggest"></ul></div>
    <div class="row"><button class="tog" id="btn-locate" type="button" aria-pressed="${state.origin && state.origin.kind === 'geo' ? 'true' : 'false'}">◎ 現在地</button>
      <select class="tog" id="pref" aria-label="都道府県">${prefOpts}</select>
      <button class="tog" id="tog-open" type="button" aria-pressed="${f.openNow}">いま営業中</button>
      <button class="tog" id="tog-verified" type="button" aria-pressed="${f.verifiedOnly}">確認済みのみ</button>
      <button class="tog" id="tog-chain" type="button" aria-pressed="${f.hideChain}">チェーンを隠す</button>
      ${state.origin ? `<select class="tog" id="radius" aria-label="半径"><option value="1" ${f.radiusKm === 1 ? 'selected' : ''}>1km</option><option value="3" ${f.radiusKm === 3 ? 'selected' : ''}>3km</option><option value="10" ${f.radiusKm === 10 ? 'selected' : ''}>10km</option><option value="Infinity" ${!Number.isFinite(f.radiusKm) ? 'selected' : ''}>制限なし</option></select>` : ''}
      <button class="tog" id="btn-reset" type="button">リセット</button></div>
    <div class="chips" id="chips"><button class="chip" data-cat="" aria-pressed="${!f.cat && !f.kinds}">すべて</button>${mc.DISPLAY_CATS.map(c => `<button class="chip" data-cat="${c.key}" aria-pressed="${f.cat === c.key}">${c.label}</button>`).join('')}</div>
    ${state.origin ? `<p class="origin-line"><b>${esc(state.origin.label)}</b> から近い順</p>` : ''}
    ${radiusNote ? `<p class="notice">${esc(radiusNote)}</p>` : ''}
    ${state.notice ? `<p class="notice err">${esc(state.notice)}</p>` : ''}
    <p class="count" id="count">確認済み <b>${nVerified}</b>件 · 候補 <b>${list.length - nVerified}</b>件</p>
    <div id="list">${state.loading ? '<div class="skel"></div><div class="skel"></div><div class="skel"></div>' : (view.map(cardHtml).join('') + empty)}</div>
    ${list.length > state.shown ? '<button class="more" id="btn-more" type="button">もっと見る</button>' : ''}`;
}
export function render() {
  const body = $('sheet-body');
  if (!state.index) { body.innerHTML = '<div class="skel"></div>'; return; }
  if (state.sheet === 'home') body.innerHTML = homeHtml();
  else if (state.sheet === 'list') body.innerHTML = listHtml();
  else if (state.sheet === 'detail') body.innerHTML = detailHtml();
  else if (state.sheet === 'saved') body.innerHTML = savedHtml();
  else if (state.sheet === 'about') body.innerHTML = aboutHtml();
  $('saved-count').textContent = state.saved ? mc.savedCount(state.saved) : 0;
  bindBody();
  if (state.sheet === 'list' || state.sheet === 'detail') renderMarkers(viewRows().list.slice(0, state.shown));
  else if (state.sheet === 'saved') renderMarkers(savedRows());
  else renderMarkers([]);
}
// Task 9/10/11 で実装する。ここでは空を返しておく。
let detailHtml = () => '', savedHtml = () => '', aboutHtml = () => '', savedRows = () => [];
export function setRenderers(r) { if (r.detailHtml) detailHtml = r.detailHtml; if (r.savedHtml) savedHtml = r.savedHtml; if (r.aboutHtml) aboutHtml = r.aboutHtml; if (r.savedRows) savedRows = r.savedRows; }

// --- 操作 ---
export async function useArea(code) {
  state.pref = Number(code); state.origin = null; state.notice = ''; resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try { await loadPref(state.pref); await loadCurated(state.pref); } catch (e) { state.notice = `データを読み込めませんでした（${e.message}）`; }
  state.loading = false; moved = false; render();
  location.hash = `pref=${state.pref}`;
}
export async function useOrigin(lat, lon, label, kind) {
  state.origin = { lat, lon, label, kind }; state.notice = ''; resetRows();
  state.sheet = 'list'; state.loading = true; render(); setSnap('half');
  try {
    const geo = await loadJson('data/hitori/prefectures_svg.json');
    const code = core.prefectureAt(lat, lon, geo);
    state.pref = code;
    await loadPref(code); await loadCurated(code);
    state.loading = false; render();
    const nb = await loadJson('data/hitori/neighbors.json');
    await Promise.all((nb[String(code)] || []).map(async c => { await loadPref(c); await loadCurated(c); }));
  } catch (e) { state.notice = `データを読み込めませんでした（${e.message}）`; }
  state.loading = false; render();
}
function locate() {
  if (!navigator.geolocation) { state.notice = 'このブラウザーでは現在地を取得できません。エリアを選んでお探しください。'; render(); return; }
  state.notice = '現在地を取得しています…'; render();
  navigator.geolocation.getCurrentPosition(p => { track('hitori.locate'); useOrigin(p.coords.latitude, p.coords.longitude, '現在地', 'geo'); },
    err => { const m = { 1: '現在地の利用が許可されませんでした。エリアか駅名でお探しください。', 2: '現在地を取得できませんでした。', 3: '現在地の取得が時間切れになりました。' }; state.notice = m[err.code] || '現在地を取得できませんでした。'; render(); },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}
export function select(r) { if (!r) return; state.current = r; state.sheet = 'detail'; track('hitori.detail'); render(); setSnap('half'); }
let places = null;
async function suggest(q) {
  const ul = $('suggest'); if (!ul) return;
  if (!q || q.length < 1) { ul.classList.remove('show'); return; }
  if (!places) { try { places = core.rowsToObjects(await loadJson('data/hitori/places.json')); } catch (e) { return; } }
  const hits = core.searchPlaces(places, q, 6);
  ul.innerHTML = hits.map((p, i) => `<li><button type="button" data-place="${i}">${esc(p.name)}<small>${p.type === 's' ? '駅' : '市区町村'}</small></button></li>`).join('');
  ul.classList.toggle('show', hits.length > 0);
  ul.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { const p = hits[Number(b.dataset.place)]; state.filters.q = ''; useOrigin(p.lat, p.lon, `${p.name}${p.type === 's' ? '駅' : ''}`, 'place'); }));
}
// root を渡すとその中だけを結び直す。作り直していない要素に二重で結ばないため（refreshList から使う）。
function bindBody(root) {
  const body = root || $('sheet-body');
  const on = (sel, ev, fn) => body.querySelectorAll(sel).forEach(el => el.addEventListener(ev, fn));
  on('#btn-locate', 'click', locate);
  on('#btn-area', 'click', () => useArea(state.pref));
  on('#pref', 'change', e => useArea(e.target.value));
  on('[data-scene]', 'click', e => { const s = mc.SCENES.find(x => x.key === e.currentTarget.dataset.scene); state.filters.cat = s.cat || ''; state.filters.kinds = s.kinds; state.filters.openNow = s.openNow; if (navigator.geolocation) locate(); else useArea(state.pref); });
  on('#q', 'input', e => { state.filters.q = e.target.value; suggest(e.target.value.trim()); refreshList(); });
  on('#tog-open', 'click', () => { state.filters.openNow = !state.filters.openNow; render(); });
  on('#tog-verified', 'click', () => { state.filters.verifiedOnly = !state.filters.verifiedOnly; render(); });
  on('#tog-chain', 'click', () => { state.filters.hideChain = !state.filters.hideChain; render(); });
  on('#radius', 'change', e => { state.filters.radiusKm = Number(e.target.value); render(); });
  on('#btn-reset', 'click', () => { state.filters = { q: '', cat: '', kinds: null, verifiedOnly: false, openNow: false, hideChain: false, gemOnly: false, radiusKm: 3 }; state.current = null; render(); });
  on('#chips [data-cat]', 'click', e => { state.filters.cat = e.currentTarget.dataset.cat; state.filters.kinds = null; state.shown = PAGE; render(); });
  on('#btn-more', 'click', () => { state.shown += PAGE; render(); });
  // 距離つきの複製（viewRows）を優先して渡す。byId の元オブジェクトには distM が無い。
  on('.open-detail', 'click', e => { const id = e.currentTarget.dataset.id; select(viewRows().list.find(x => x.id === id) || state.byId.get(id)); });
  on('[data-want]', 'click', e => { e.stopPropagation(); toggleWant(state.byId.get(e.currentTarget.dataset.want)); });
}
function refreshList() {
  // 入力のたびにシート全体を作り直すと input のフォーカスが飛ぶ。一覧と件数だけ差し替える。
  const { list } = viewRows(); const nV = list.filter(r => isChecked(r.id)).length;
  $('count').innerHTML = `確認済み <b>${nV}</b>件 · 候補 <b>${list.length - nV}</b>件`;
  $('list').innerHTML = list.slice(0, state.shown).map(cardHtml).join('');
  bindBody($('list')); renderMarkers(list.slice(0, state.shown));
}
export function toggleWant(r) {
  if (!r || !state.saved || !storage) { state.notice = 'この端末では保存できません。'; render(); return; }
  state.saved = mc.toggleWant(state.saved, r, r.pref); mc.saveSaved(storage, state.saved); track('hitori.save'); render();
}

// --- 起動 ---
async function boot() {
  initMap(); bindSheetDrag();
  $('btn-saved').addEventListener('click', () => { state.sheet = 'saved'; render(); setSnap('half'); });
  $('btn-menu').addEventListener('click', () => { state.sheet = 'about'; render(); setSnap('full'); });
  $('btn-research').addEventListener('click', () => { moved = false; $('btn-research').classList.remove('show'); const b = map.getBounds(); const c = b.getCenter(); useOrigin(c.lat, c.lng, '地図の中心', 'map'); });
  try { state.index = await loadJson('data/hitori/index.json'); } catch (e) { $('sheet-body').innerHTML = `<p class="notice err">データを読み込めませんでした（${esc(e.message)}）<br><button class="tog" type="button" onclick="location.reload()">再読み込み</button></p>`; return; }
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('facility') && params.get('pref')) { await useArea(params.get('pref')); const r = state.byId.get(params.get('facility')); if (r) select(r); else { state.notice = 'この施設は現在掲載していません。'; render(); } }
  else if (params.get('saved')) { await restoreShared(params.get('saved')); }
  else if (hash.get('pref')) await useArea(hash.get('pref'));
  else render();
  window.__ready = true;
}
let restoreShared = async () => {};   // Task 10 で差し替える
export function setRestoreShared(fn) { restoreShared = fn; }
// boot() は必ずファイルの最後の行に置く。Task 9〜11 の追記はこの行より前に挿入する
// （setRenderers が初回 render より先に走ることを、評価順で保証するため）。
boot();
