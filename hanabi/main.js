// 一筆花火 2 — 画面の流れと、入力・描画・音をつなぐ
import * as G from './sim.js';
import * as Run from './run.js';
import { CHARMS, CHARM_BY_ID, TAG_NAME, TAG_COLOR } from './charms.js';
import { createRenderer } from './gl.js';
import { createFx, PALETTES } from './fx.js';
import { createAudio } from './audio.js';
import { shellAtlas, noiseTex, placeholderBand, SHELL_ORDER, ATLAS_CELLS, drawBag, drawShellIcon, SHELL_NAME, cellOf, HINOKO_CELL, CROW_CELL, HUB_CELL } from './art.js';
import { createPlatform } from './platform.js';
import { ACHIEVEMENTS, checkAchievements } from './ach.js';
import { THEMES } from './levels.js';
import { drawCast } from '../assets/hitofude/cast.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const canvas = $('c');
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
const R = createRenderer(canvas, { quality: lowEnd ? 'low' : 'high' });
if (!R) { document.body.innerHTML = '<p style="padding:2em">This game needs WebGL2.</p>'; throw new Error('no webgl2'); }
const fx = createFx(lowEnd ? 7000 : 26000);
R.noiseTex = R.texture(noiseTex(), { repeat: true });
const BGM = q.get('bgm') || '../assets/hitofude/bgm/';
const audio = createAudio([
  ['calm', BGM + 'hitofude_calm.mp3', { loopStart: 1.17, gain: 0.5 }],
  ['burn', BGM + 'hitofude_burn.mp3', { gain: 0.95 }],
  ['finale', BGM + 'hitofude_finale.mp3', { gain: 0.9 }],
]);

const PF = createPlatform();

// ------------------------------------------------------------------ 保存
const SAVE = 'hanabi2';
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch { return {}; } };
const DB = { meta: { xp: 0, wins: 0, best: 0, runs: 0, rankOpen: 0, taught: {}, seen: {} }, run: null, lang: null, sound: true, music: true, ...load() };
const save = () => { const j = JSON.stringify(DB); try { localStorage.setItem(SAVE, j); } catch { /* 保存できない環境でも遊べる */ } PF.write(SAVE, j); };

let lang = q.get('lang') || DB.lang || ((navigator.language || 'en').startsWith('ja') ? 'ja' : 'en');
const JA = () => lang === 'ja';
const tr = (ja, en) => (JA() ? ja : en);
audio.setSound(DB.sound); audio.setMusic(DB.music);

let W = 1280, H = 720, dpr = 1, atlasTex = null, scaleMax = 1;
const S = { mode: 'title', st: null, run: Run.fixRun(DB.run), timeScale: 1, slowT: 0, seq: [], titleT: 0, crossed: false, hint: 0, fuse: 'asa', rank: 0, shop: [], sold: new Set(), themeKey: null, lastStars: 0, daily: false, fatal: null };

// ------------------------------------------------------------------ 帯（町）
function setBand(nightSrc, flashSrc, waterFrac) {
  R.band = { night: R.texture(nightSrc), flash: R.texture(flashSrc), waterFrac, aspect: nightSrc.width / nightSrc.height, rect: [0, 0.5, 1, 0.5], waterY: 0.88 };
  layoutBand();
}
function layoutBand() {
  if (!R.band) return;
  const b = R.band, land = W >= H;
  const hPx = land ? W / b.aspect : Math.max(H * 0.33, 300), wPx = hPx * b.aspect;
  const rw = wPx / W, rh = hPx / H;
  b.rect = [(1 - rw) / 2, 1 - rh, rw, rh];
  b.waterY = 1 - rh * b.waterFrac;
}
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const bandCache = {};
async function loadBand(key) {
  if (!bandCache[key]) {
    bandCache[key] = (async () => {
      try {
        const meta = await fetch(`art/${key}/band.json`).then((r) => { if (!r.ok) throw 0; return r.json(); });
        const [a, c] = await Promise.all([img(`art/${key}/band_night.webp`), img(`art/${key}/band_flash.webp`)]);
        return { a, c, f: meta.waterFrac };
      } catch { const ph = placeholderBand(); return { a: ph.night, c: ph.flash, f: ph.waterFrac }; }
    })();
  }
  const b = await bandCache[key];
  setBand(b.a, b.c, b.f);
}
async function setTheme(key) {
  if (S.themeKey === key) return;
  S.themeKey = key;
  R.bakeSky(THEMES[key] || THEMES.summer, W / H);
  await loadBand(THEMES[key]?.band || key);
}

function resize() {
  const cw = innerWidth, ch = innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75) * scaleMax;
  const pw = W, ph = H;
  if (cw >= ch) { H = 720; W = Math.round((720 * cw) / ch); } else { W = 720; H = Math.round((720 * ch) / cw); }
  R.resize(cw, ch, dpr, W, H);
  if (pw !== W || ph !== H || !R.skyTex) R.bakeSky(THEMES[S.themeKey] || THEMES.summer, W / H);
  layoutBand();
  if ((pw !== W || ph !== H) && S.st && S.mode === 'play' && S.st.phase === 'aim' && S.st.strokesUsed === 0) startNight();
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ 画面の切りかえ
const SCREENS = ['title', 'newrun', 'inter', 'over', 'pause', 'book', 'senko'];
function show(name) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name); }

function toTitle() {
  PF.stop();
  S.mode = 'title'; S.st = null; S.seq = [];
  show('title'); $('hud').classList.add('hidden'); $('teach').classList.add('hidden');
  setTheme('summer');
  // 物語の結末を見たあとは、ここが「終わらない祭り」（灯が帰らずに逃げ続けていた世界）になる
  $('tagline').textContent = DB.meta.storyDone ? tr('終わらない祭り —— それでも、もう一夜だけ。', 'The Endless Festival — just one more night.') : tr('線を引け。火が追いかけてくる。', 'Draw the fuse. The flame is right behind you.');
  $('playBtn').textContent = DB.run ? tr('続きから', 'CONTINUE') : tr('あそぶ', 'PLAY');
  const m = $('titleMenu'); m.innerHTML = '';
  const add = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { audio.unlock(); audio.ui('tap'); f(); }; m.append(b); };
  if (DB.meta.runs > 0 || DB.run) add(tr('新しい祭り', 'New Run'), openNewRun);
  if (DB.meta.runs > 0) add(tr('今日の祭り', 'Daily'), startDaily);
  add(tr('お守り帳', 'Charm Book'), openBook);
  // 物語は日本語のみ。ゲームサイト用の書き出し（story.html を入れない）では出さない
  if (!window.HANABI_NO_STORY) add(tr('物語', 'Story (Japanese)'), () => { location.href = 'story.html'; });
  add(tr(`音 ${DB.sound ? 'ON' : 'OFF'}`, `Sound ${DB.sound ? 'ON' : 'OFF'}`), () => { DB.sound = !DB.sound; DB.music = DB.sound; audio.setSound(DB.sound); audio.setMusic(DB.music); save(); toTitle(); });
  add(JA() ? 'English' : '日本語', () => { lang = JA() ? 'en' : 'ja'; DB.lang = lang; save(); toTitle(); });
  audio.scene('calm');
}

function openNewRun() {
  show('newrun');
  $('nrTitle').textContent = tr('導火線をえらぶ', 'Choose your fuse');
  $('nrBack').textContent = tr('もどる', 'Back'); $('nrGo').textContent = tr('はじめる', 'START');
  const list = $('fuseList'); list.innerHTML = '';
  for (const f of Run.FUSES) {
    const open = Run.fuseOpen(f, DB.meta);
    const b = document.createElement('button'); b.className = 'fuse' + (S.fuse === f.id ? ' on' : ''); b.disabled = !open;
    b.innerHTML = `<b>${open ? (JA() ? f.ja : f.en) : '？？？'}</b><small>${open ? (JA() ? f.dj : f.de) : unlockText(f)}</small>`;
    b.onclick = () => { S.fuse = f.id; audio.ui('tap'); openNewRun(); };
    list.append(b);
  }
  const maxR = Math.min(Run.RANKS.length - 1, DB.meta.rankOpen || 0); S.rank = Math.min(S.rank, maxR);
  const r = Run.RANKS[S.rank];
  $('rankName').textContent = `${tr('段位', 'Rank')} ${S.rank + 1} — ${JA() ? r.ja : r.en}`; $('rankDesc').textContent = (JA() ? r.dj : r.de) || tr('はじめての方はここから', 'A fair start');
  $('rankPrev').disabled = S.rank <= 0; $('rankNext').disabled = S.rank >= maxR;
}
const unlockText = (f) => (f.unlock.wins ? tr(`完走 ${f.unlock.wins} 回で開く`, `Finish ${f.unlock.wins} run(s)`) : tr(`${f.unlock.best} 夜を越えると開く`, `Reach night ${f.unlock.best}`));
$('rankPrev').onclick = () => { S.rank--; audio.ui('tap'); openNewRun(); };
$('rankNext').onclick = () => { S.rank++; audio.ui('tap'); openNewRun(); };
$('nrBack').onclick = () => { audio.ui('tap'); toTitle(); };
$('nrGo').onclick = () => { audio.ui('tap'); beginRun({ fuse: S.fuse, rank: S.rank }); };

function openBook() {
  show('book');
  const un = Run.unlockedCharms(DB.meta);
  $('bkTitle').textContent = tr(`お守り帳 ${un.size} / ${CHARMS.length}`, `Charm Book ${un.size} / ${CHARMS.length}`);
  $('bkBack').textContent = tr('もどる', 'Back');
  const list = $('bookList'); list.innerHTML = '';
  for (const c of CHARMS) {
    const o = un.has(c.id), e = document.createElement('div'); e.className = 'bookitem' + (o ? '' : ' locked');
    const cv = document.createElement('canvas'); cv.width = 84; cv.height = 104; drawBag(cv, c);
    const t = document.createElement('div'); t.innerHTML = `<b>${o ? (JA() ? c.ja : c.en) : '？？？'}</b>${o ? (JA() ? c.dj : c.de) : ''}`;
    e.append(cv, t); list.append(e);
  }
  const got = DB.meta.ach || {}, n = ACHIEVEMENTS.filter((a) => got[a.id]).length;
  const h = document.createElement('div'); h.className = 'bookhead'; h.textContent = tr(`実績 ${n} / ${ACHIEVEMENTS.length}`, `Achievements ${n} / ${ACHIEVEMENTS.length}`); list.append(h);
  for (const a of ACHIEVEMENTS) {
    const e = document.createElement('div'); e.className = 'bookitem ach' + (got[a.id] ? '' : ' locked');
    e.innerHTML = `<span class="seal">${got[a.id] ? '★' : '☆'}</span><div><b>${JA() ? a.ja : a.en}</b>${JA() ? a.dj : a.de}</div>`;
    list.append(e);
  }
}
$('bkBack').onclick = () => { audio.ui('tap'); toTitle(); };

function beginRun(o = {}) {
  S.run = Run.newRun({ fuse: o.fuse || 'asa', rank: o.rank || 0, seed: o.seed });
  S.daily = !!o.daily;
  DB.run = S.run; save();
  startNight();
}
function startDaily() {
  const d = new Date(); const key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  beginRun({ seed: key, daily: true });
}
$('playBtn').onclick = () => {
  audio.unlock(); audio.ui('tap');
  if (DB.run) { S.run = Run.fixRun(DB.run); startNight(); } else beginRun();
};

// ------------------------------------------------------------------ 夜
function startNight() {
  const run = S.run, def = Run.nightDef(run, +(q.get('w') || run.world), +(q.get('n') || run.night));
  if (q.get('twist')) def.twist = q.get('twist');
  if (q.get('intrude')) def.intrude = q.get('intrude');
  const W2 = Run.WORLDS[def.world - 1];
  setTheme(W2.theme);
  S.st = G.newNight(def, W, H, Run.loadoutFor(run));
  S.mode = 'play'; S.crossed = false; S.seq = []; R.zoom = 1; S.timeScale = 1; S.hint = 0; S.shown = 0;
  PF.start();
  show('none'); $('hud').classList.remove('hidden');
  $('nWorld').textContent = JA() ? W2.ja : W2.en;
  $('nName').textContent = tr(`第 ${def.night} 夜`, `Night ${def.night}`);
  $('gTarget').textContent = fmt(def.target);
  $('combo').classList.remove('on'); $('heat').className = 'heat';
  renderStrokes(); renderBags();
  const nS = S.st.shells.length, riseStep = Math.min(0.035, 1.4 / Math.max(1, nS));
  S.st.shells.forEach((s, k) => { s.rise = 0.15 + k * riseStep; launchFor(s); });
  renderLives(); renderStreak(false);
  const tw = def.twist && Run.TWISTS[def.twist];
  $('twistTag').textContent = tw ? (JA() ? tw.ja : tw.en) : '';
  const zl = $('zoneLabels'); zl.innerHTML = '';
  for (const z of S.st.zones) { const e = document.createElement('div'); e.className = 'zl ' + z.kind; e.innerHTML = z.kind === 'oil' ? tr('油<small>火が速い・点 ×3</small>', 'OIL<small>fast flame, POINTS ×3</small>') : tr('水<small>火が遅い</small>', 'WATER<small>slow flame</small>'); e.style.left = (z.x / W) * 100 + '%'; e.style.top = (z.y / H) * 100 + '%'; zl.append(e); }
  // 大一番
  const boss = $('boss');
  if (def.rule) {
    const r = Run.RULES[def.rule];
    drawBoss(r.cast, 'taunt'); boss.classList.remove('hidden'); boss.classList.add('taunt');
    banner(`${JA() ? r.ja : r.en}<small>${JA() ? r.dj : r.de}</small>`, 62, 2600);
    audio.boom(1.4, 0);
  } else {
    boss.classList.add('hidden');
    if (tw) banner(`${def.twistHide ? tr('今夜の正体は…', 'Tonight is…') + '<br>' : ''}${JA() ? tw.ja : tw.en}`, 64, 1500);
    else if (def.night === 1) banner(`${JA() ? W2.ja : W2.en}<small>${tr(`第 1 夜 ― 目標 ${fmt(def.target)}`, `Night 1 — Target ${fmt(def.target)}`)}</small>`, 54, 2200);
    else banner(`${tr(`第 ${def.night} 夜`, `Night ${def.night}`)}<small>${tr(`目標 ${fmt(def.target)}`, `Target ${fmt(def.target)}`)}</small>`, 54, 1400);
  }
  teachFor(def);
  if (tw) { const el = $('teach'), add = el.classList.contains('hidden') ? '' : `<br>${el.innerHTML}`; el.innerHTML = `<em>${JA() ? tw.ja : tw.en}</em> ${JA() ? tw.dj : tw.de}${add}`; el.classList.remove('hidden'); }
  audio.scene('calm');
}
function renderLives() { const r = S.run, el = $('lives'); el.innerHTML = ''; const max = Math.max(r.lives, r.rank >= 6 ? 1 : r.rank >= 4 ? 2 : 3); for (let i = 0; i < max; i++) { const b = document.createElement('i'); if (i >= r.lives) b.className = 'out'; el.append(b); } }
function renderStreak(up) { const n = S.st?.streak || 0, el = $('streak'); el.textContent = n > 0 ? tr(`連続満開 ${n}（次は ×${S.st.m.bloomX + Math.min(6, n)}）`, `Bloom streak ${n} (next ×${S.st.m.bloomX + Math.min(6, n)})`) : ''; if (up) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } }
function drawBoss(id, face) {
  const c = $('boss'), g = c.getContext('2d'); g.clearRect(0, 0, 280, 280);
  try { drawCast(g, id, 140, 150, 190, { face, still: true, glow: true }); } catch { /* 絵が無くても遊べる */ }
}
const TEACH = {
  draw: ['玉をなぞって<em>線を引こう</em>。線の始まりから<em>火が追いかけてくる</em>！', 'Drag through the shells. <em>The flame chases your line!</em>'],
  heat: ['<em>火を引きつけろ</em>。近いほど熱くなって点が伸びる。追いつかれると終わり', '<em>Let the flame get close.</em> Closer = hotter = more points. If it catches you, the stroke ends'],
  flame: ['火は<em>曲がり角で遅く</em>なり、<em>玉がはじけると跳ねる</em>', 'The flame <em>slows at corners</em> and <em>jumps when shells burst</em>'],
  gust: ['<em>白い輪</em>は突風の合図。先へ逃げろ！', 'A <em>white ring</em> means a gust is coming. Get ahead!'],
  kin: ['<em>金の玉</em>は倍率 +1。点は「点 × 倍率」', '<em>Gold shells</em> add +1 MULT. Score = POINTS × MULT'],
  senrin: ['<em>千輪</em>は八方に火花を飛ばす', '<em>Crossettes</em> shoot sparks in 8 directions'],
  chouchin: ['<em>提灯</em>のあとにひらく玉は、点が 2 倍', 'After a <em>Lantern</em>, every shell scores double'],
  shime: ['<em>湿った玉</em>は線でふれるか、爆発 2 回', '<em>Wet shells</em> need your line, or two blasts'],
  koori: ['<em>氷玉</em>は線では燃えない。爆発でとかす', '<em>Ice shells</em> ignore your line. Melt them with a blast'],
  oni: ['<em>鬼玉</em>は線で払うと倍率 +3、爆風だと −2', '<em>Oni shells</em>: line = +3 MULT, blast = −2 MULT'],
  shaku: ['<em>尺玉</em>は線の火でしかひらかない。最後に通すほど倍率が伸びる', 'The <em>Grand Shell</em> lights only from your line. The later, the bigger the MULT'],
};
function teachFor(def) {
  const el = $('teach'); el.classList.add('hidden');
  const taught = DB.meta.taught = DB.meta.taught || {};
  let key = null;
  if (!taught.draw) key = 'draw';
  else if (!taught.heat && (def.night >= 2 || def.world > 1)) key = 'heat';
  else if (!taught.gust && def.gusts) key = 'gust';
  else if (!taught.flame && def.id >= 4) key = 'flame';
  else for (const t of ['kin', 'senrin', 'chouchin', 'shime', 'koori', 'oni', 'shaku']) if (!taught[t] && def.mix[t]) { key = t; break; }
  if (key) { const t = TEACH[key]; el.innerHTML = JA() ? t[0] : t[1]; el.classList.remove('hidden'); S.teachKey = key; } else S.teachKey = null;
}
function renderStrokes() {
  const st = S.st, el = $('strokes'); el.innerHTML = '';
  for (let i = 0; i < st.maxStrokes; i++) { const b = document.createElement('b'); if (i >= st.strokesLeft) b.className = 'used'; el.append(b); }
}
function bagEl(c, size = 84) {
  const d = document.createElement('div'); d.className = 'bag'; d.dataset.id = c.id;
  const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * 1.25); drawBag(cv, c); d.append(cv);
  const name = JA() ? c.ja : c.en, desc = JA() ? c.dj : c.de;
  d.addEventListener('pointerenter', (e) => showTip(e, name, desc)); d.addEventListener('pointerleave', hideTip);
  return d;
}
function renderBags() {
  const el = $('bags'); el.innerHTML = '';
  for (const id of S.run.charms) { const c = CHARM_BY_ID[id]; if (c) el.append(bagEl(c)); }
  $('hudCoins').innerHTML = `<span class="coin"></span>${S.run.coins + (S.st?.coinsEarned || 0)}`;
}
function showTip(e, a, b) { const t = $('tip'); t.innerHTML = `<b>${a}</b>${b}`; t.classList.remove('hidden'); const r = e.currentTarget.getBoundingClientRect(); t.style.left = Math.min(innerWidth - 270, r.left) + 'px'; t.style.top = Math.max(8, r.top - 64) + 'px'; }
function hideTip() { $('tip').classList.add('hidden'); }

// ------------------------------------------------------------------ 幕間
function achCheck(extra = {}) {
  const run = S.run, meta = DB.meta;
  const got = checkAchievements(meta, {
    run, st: S.st, ...extra,
    hasLegend: !!run && run.charms.some((id) => CHARM_BY_ID[id]?.rar === 'l'),
    fusesOpen: Run.FUSES.every((f) => Run.fuseOpen(f, meta)),
    bookFull: Run.unlockedCharms(meta).size >= CHARMS.length,
  });
  got.forEach((a, i) => setTimeout(() => achToast(a), 500 + i * 900));
  return got;
}
function achToast(a) {
  const e = document.createElement('div'); e.className = 'achtoast';
  e.innerHTML = `<small>${tr('実績', 'Achievement')}</small><b>${JA() ? a.ja : a.en}</b>`;
  document.body.append(e); audio.note(17, { vol: 0.15, dur: 0.5 }); setTimeout(() => audio.note(20, { vol: 0.14, dur: 0.6 }), 90);
  setTimeout(() => e.remove(), 2600);
}
function nightEnded() {
  const st = S.st, run = S.run, def = st.level;
  hideTip(); PF.stop(); $('teach').classList.add('hidden');
  if (st.cleared && (def.boss || G.starsFor(st) === 3)) PF.happy();
  run.bestChain = Math.max(run.bestChain, st.bestChain); run.totalScore += st.score;
  if (S.teachKey) DB.meta.taught[S.teachKey] = 1;
  const res = Run.afterNight(run, st);
  if (res === 'over') { achCheck({ stars: 0 }); return runOver(false); }
  if (res === 'retry') { achCheck({ stars: 0 }); return retryNight(); }
  const stars = G.starsFor(st); run.stars += stars; run.nightsCleared++;
  achCheck({ stars });
  const rw = Run.rewardFor(st, stars, def.boss), interest = Run.interestFor(run.coins);
  const gain = rw.base + rw.left + rw.star + rw.earned + rw.twist + interest;
  run.coins += gain;
  DB.meta.taught.draw = 1;
  S.shop = Run.shopFor(run, Run.unlockedCharms(DB.meta)); S.sold = new Set();
  S.route = Run.routeChoices(run); S.routeSel = 0;
  S.mode = 'inter'; show('inter');
  $('resTitle').textContent = def.boss ? tr('大一番、勝利！', 'Boss Defeated!') : tr(`第 ${def.night} 夜 大成功`, `Night ${def.night} Clear`);
  const sEl = $('resStars'); sEl.innerHTML = '<span>★</span><span>★</span><span>★</span>';
  [...sEl.children].forEach((c, i) => { if (i < stars) setTimeout(() => { c.classList.add('on'); audio.note(12 + i * 2, { vol: 0.18, dur: 0.5 }); }, 200 + i * 220); });
  $('resScore').textContent = fmt(st.score);
  const rows = [[def.boss ? tr('大一番のごほうび', 'Boss bonus') : tr('今夜のごほうび', 'Night bonus'), rw.base], [tr('残った筆', 'Strokes left'), rw.left], [tr('星', 'Stars'), rw.star], [tr('お守りと玉', 'Charms & shells'), rw.earned], [tr('趣向の上乗せ', 'Twist bonus'), rw.twist], [tr('利息', 'Interest'), interest]].filter((r) => r[1] > 0);
  $('ledger').innerHTML = rows.map(([a, b], i) => `<div style="animation-delay:${0.1 + i * 0.09}s"><span>${a}</span><b>+${b}</b></div>`).join('');
  $('shopTitle').textContent = tr('屋台', 'Festival Stalls');
  const nk = $('neko'), ng = nk.getContext('2d'); ng.clearRect(0, 0, nk.width, nk.height);
  try { drawCast(ng, 'neko', 70, 76, 96, { face: 'joy', still: true, glow: false }); } catch { /* 絵が無くても遊べる */ }
  $('nextBtn').textContent = tr('次の夜へ', 'NEXT NIGHT');
  renderShop();
  audio.ui('win'); audio.scene('calm');
  DB.run = run; save();
}
// 失敗しても提灯が残っていれば、同じ夜をもう一度（盤は変わる）
function retryNight() {
  S.mode = 'retry'; DB.run = S.run; save();
  renderLives();
  banner(`${tr('提灯がひとつ消えた', 'A lantern goes out')}<small>${tr(`もう一度、この夜を。あと ${S.run.lives} つ`, `Try this night again. ${S.run.lives} left`)}</small>`, 56, 2000);
  audio.ui('lose');
  setTimeout(() => { if (S.mode === 'retry') startNight(); }, 2000);
}
function renderShop() {
  const run = S.run, wrap = $('cards'); wrap.innerHTML = '';
  $('purse').textContent = run.coins;
  S.shop.forEach((it, i) => {
    const b = document.createElement('button'); b.className = 'card';
    const can = it.cost <= run.coins && (it.kind !== 'charm' || run.charms.length < run.slots);
    if (S.sold.has(i)) { b.classList.add('sold'); wrap.append(b); return; }
    if (it.cost > run.coins) b.classList.add('cant');
    if (it.kind === 'charm') {
      const c = CHARM_BY_ID[it.id]; if (c.rar !== 'c') b.classList.add(c.rar);
      const art = document.createElement('div'); art.className = 'art'; const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; drawBag(cv, c); art.append(cv);
      b.innerHTML = `<span class="tg" style="background:${TAG_COLOR[c.tag]}">${TAG_NAME[c.tag][JA() ? 0 : 1]}</span>`;
      b.append(art);
      b.insertAdjacentHTML('beforeend', `<span class="nm">${JA() ? c.ja : c.en}</span><span class="ds">${JA() ? c.dj : c.de}</span><span class="pr"><i class="coin"></i>${it.cost}</span>`);
    } else {
      const art = document.createElement('div'); art.className = 'art'; const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; drawShellIcon(cv, it.id); art.append(cv);
      const lv = run.recipes[it.id] || 0, sn = SHELL_NAME[it.id][JA() ? 0 : 1];
      b.innerHTML = `<span class="tg" style="background:#4a4a58">${tr('秘伝', 'Recipe')}</span>`;
      b.append(art);
      b.insertAdjacentHTML('beforeend', `<span class="nm">${sn} Lv${lv + 1}</span><span class="ds">${it.id === 'kin' ? tr('金の倍率 +1', 'Gold MULT +1') : tr('この玉の点が増える', 'More POINTS from this shell')}</span><span class="pr"><i class="coin"></i>${it.cost}</span>`);
    }
    b.onclick = () => { if (it.cost > run.coins) { audio.note(1, { vol: 0.1, dur: 0.2 }); return; } if (it.kind === 'charm' && run.charms.length >= run.slots) { toast(tr('袋がいっぱい。売ってから', 'Bags full. Sell one first')); return; } buy(i); };
    wrap.append(b);
  });
  const rc = Run.rerollCost(run), rb = $('reroll');
  rb.textContent = tr(`引き直し  ${rc}`, `Reroll  ${rc}`); rb.disabled = rc > run.coins;
  renderHeld($('held'), true);
  const nd = peekNext();
  if (S.route && S.route.length) {
    const box = $('nextInfo');
    box.innerHTML = `<div class="routes-title">${tr('次の夜をえらぶ', 'Choose the next night')}（${tr('目標', 'Target')} ${fmt(nd.target)}）</div>`;
    const row = document.createElement('div'); row.className = 'routes';
    S.route.forEach((c, i) => {
      const t = Run.TWISTS[c.id], b = document.createElement('button'); b.className = 'route' + (i === S.routeSel ? ' on' : '') + (c.hide ? ' hide' : '');
      b.innerHTML = `<em>+${c.coin}</em><b>${c.hide ? tr('？？？', '???') : (JA() ? t.ja : t.en)}</b>${c.hide ? tr('何が出るかは、夜になるまで分からない', 'You find out when night falls') : (JA() ? t.dj : t.de)}`;
      b.onclick = () => { S.routeSel = i; audio.ui('tap'); renderShop(); };
      row.append(b);
    });
    box.append(row);
  } else $('nextInfo').innerHTML = nd ? (nd.rule ? tr(`次は大一番 <b>${Run.RULES[nd.rule].ja}</b>: ${Run.RULES[nd.rule].dj}`, `Next is a boss: <b>${Run.RULES[nd.rule].en}</b> — ${Run.RULES[nd.rule].de}`) : tr(`次の目標 ${fmt(nd.target)}`, `Next target ${fmt(nd.target)}`)) : '';
}
function peekNext() { const r = S.run, n = Run.nextCoord(r); return n ? Run.nightDef(r, n[0], n[1]) : null; }
function renderHeld(el, sell) {
  el.innerHTML = '';
  for (let i = 0; i < S.run.slots; i++) {
    const id = S.run.charms[i], d = document.createElement('div'); d.className = 'slot';
    if (id) {
      const c = CHARM_BY_ID[id], cv = document.createElement('canvas'); cv.width = 84; cv.height = 105; drawBag(cv, c); d.append(cv);
      const price = Math.max(1, Math.floor(c.cost / 2));
      d.addEventListener('pointerenter', (e) => showTip(e, JA() ? c.ja : c.en, (JA() ? c.dj : c.de) + (sell ? tr(`<br>押すと ${price} 小判で売る`, `<br>Click to sell for ${price}`) : '')));
      d.addEventListener('pointerleave', hideTip);
      if (sell) d.onclick = () => { S.run.charms.splice(i, 1); S.run.coins += price; audio.note(8, { vol: 0.14, dur: 0.2 }); hideTip(); renderShop(); };
    }
    el.append(d);
  }
}
function buy(i) {
  const it = S.shop[i], run = S.run;
  run.coins -= it.cost; S.sold.add(i);
  if (it.kind === 'charm') { run.charms.push(it.id); }
  else run.recipes[it.id] = (run.recipes[it.id] || 0) + 1;
  audio.note(14, { vol: 0.18, dur: 0.3 }); setTimeout(() => audio.note(17, { vol: 0.16, dur: 0.4 }), 70);
  hideTip(); renderShop();
}
$('reroll').onclick = () => { const run = S.run, c = Run.rerollCost(run); if (c > run.coins) return; run.coins -= c; run.rerolls++; run.shopRound++; S.shop = Run.shopFor(run, Run.unlockedCharms(DB.meta)); S.sold = new Set(); audio.ui('tap'); renderShop(); };
$('nextBtn').onclick = () => {
  audio.ui('tap');
  if (S.route && S.route.length) Run.chooseRoute(S.run, S.route[S.routeSel || 0]);
  const res = Run.advance(S.run);
  if (res === 'won') return runOver(true);
  DB.run = S.run; save();
  if (res === 'world') openSenko(); else startNight();
};

// ------------------------------------------------------------------ 線香花火: 祭りと祭りのあいだの、静かなひととき
const SK = [
  { t: 0, ja: '蕾', en: 'Bud', coin: 0 }, { t: 2.2, ja: '牡丹', en: 'Peony', coin: 3 }, { t: 5, ja: '松葉', en: 'Pine Needles', coin: 6 },
  { t: 8.5, ja: '柳', en: 'Willow', coin: 10 }, { t: 12, ja: '散り菊', en: 'Falling Chrysanthemum', coin: 15 },
];
function openSenko() {
  S.mode = 'senko'; S.st = null; show('senko'); $('hud').classList.add('hidden');
  S.sk = { t: 0, held: false, done: false, shake: 0, stage: -1, drop: 0, y: 0, px: 0, py: 0 };
  $('skName').textContent = tr('線香花火', 'Sparkler');
  $('skMsg').textContent = tr('押さえたまま、動かさないで。離すと、そこまでの小判をもらえる', 'Press and hold still. Let go to collect your coins');
  $('skNext').textContent = tr('そのまま次の祭りへ', 'Skip to the next festival');
  audio.scene('calm');
}
function endSenko(fell) {
  const k = S.sk; if (!k || k.done) return;
  k.done = true; k.held = false;
  const st = Math.max(0, k.stage), got = fell ? Math.floor(SK[st].coin / 2) : SK[st].coin;
  S.run.coins += got;
  DB.meta.senko = Math.max(DB.meta.senko || 0, fell ? 0 : st);
  achCheck({ stars: 0 });
  $('skMsg').textContent = (fell ? tr('ぽとり……。', 'It fell...') + ' ' : '') + tr(`小判 +${got}`, `+${got} coins`);
  $('skNext').textContent = tr('次の祭りへ', 'On to the next festival');
  DB.run = S.run; save();
  if (fell) audio.note(1, { vol: 0.14, dur: 0.5 }); else if (got) audio.ui('win');
}
function senkoFx(dt) {
  const k = S.sk; if (!k) return;
  const x = W / 2, y0 = H * 0.2, y = H * 0.44 + k.y, one = Math.max(dt, 0.001) * 1.2;
  for (let i = 0; i < 14; i++) fx.add(x, y0 + ((y - y0) * i) / 14, 0, 0, one, 1.3, 0, 0, [0.5, 0.35, 0.25], [0.5, 0.35, 0.25], 0.5);
  if (k.done && k.drop === 0) { if (k.stage >= 0) fx.add(x, y, 0, 0, one, 3, 0, 0, [0.6, 0.2, 0.05], [0.6, 0.2, 0.05], 0.6); return; }
  if (k.drop > 0) { k.y += k.drop * dt; k.drop += 900 * dt; if (y < H) fx.add(x, y, 0, 0, one, 7, 0, 0, [3, 0.9, 0.2], [3, 0.9, 0.2], 1); return; }
  if (!k.held) { fx.add(x, y, 0, 0, one, 3.5, 0, 0, [2, 0.8, 0.2], [2, 0.8, 0.2], 0.8); return; }
  k.t += dt; k.shake = Math.max(0, k.shake - dt * 1.2);
  let st = 0; for (let i = 0; i < SK.length; i++) if (k.t >= SK[i].t) st = i;
  if (st !== k.stage) { k.stage = st; $('skName').textContent = JA() ? SK[st].ja : SK[st].en; $('skMsg').textContent = st ? tr(`いま離すと 小判 +${SK[st].coin}`, `Let go now: +${SK[st].coin} coins`) : ''; if (st) { audio.note(8 + st * 3, { vol: 0.13, dur: 0.9 }); fx.light(x, y, 0.8 + st * 0.3, 360, [1, 0.6, 0.25]); } }
  const size = 4 + Math.min(1, k.t / 2.2) * 7 + Math.sin(R.time * 30) * 0.5;
  fx.add(x, y, 0, 0, one, size, 0, 0, [3.2, 1.2, 0.3], [3.2, 1.2, 0.3], 1.3);
  fx.add(x, y, 0, 0, one, size * 3.2, 0, 0, [1, 0.32, 0.06], [1, 0.32, 0.06], 0.3);
  fx.light(x, y, 0.1 + st * 0.05, 300, [1, 0.56, 0.2], 40);
  const rate = [0, 26, 90, 60, 20][st] * dt;
  for (let i = 0; i < rate; i++) {
    const a = Math.random() * 6.283;
    if (st === 1) { const v = 50 + Math.random() * 90; fx.add(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5, 2.4, 2, 60, [3, 1.6, 0.5], [1, 0.3, 0.05], 1.5, 1); }
    if (st === 2) { const v = 160 + Math.random() * 240; const j = fx.add(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.34, 1.9, 2.4, 40, [3.2, 2.4, 1], [1.4, 0.5, 0.1], 1.8, 1); if (j >= 0 && Math.random() < 0.3) setTimeout(() => { for (let q = 0; q < 3; q++) { const b = Math.random() * 6.283, xx = x + Math.cos(a) * v * 0.24, yy = y + Math.sin(a) * v * 0.24; fx.add(xx, yy, Math.cos(b) * 90, Math.sin(b) * 90, 0.2, 1.5, 3, 30, [3, 2, 0.8], [1, 0.4, 0.1], 1.4); } }, 180); }
    if (st === 3) { const v = 70 + Math.random() * 110; fx.add(x, y, Math.cos(a) * v, Math.abs(Math.sin(a)) * v * 0.4 - 30, 1.0, 1.5, 1.4, 170, [2.6, 1.6, 0.6], [0.9, 0.3, 0.05], 1.1, 1); }
    if (st === 4) { const v = 30 + Math.random() * 60; fx.add(x, y, Math.cos(a) * v, Math.sin(a) * v, 0.5, 1.2, 2, 60, [2.2, 1.2, 0.4], [0.8, 0.2, 0.03], 0.9); }
  }
  const risk = [0, 0, 0.03, 0.09, 0.26][st] + (k.shake > 0.45 ? (k.shake - 0.45) * 2.4 : 0);
  if (Math.random() < risk * dt || k.shake >= 1) { k.drop = 40; endSenko(true); }
  else if (k.t >= 16) endSenko(false);
}
$('senko').addEventListener('pointerdown', (e) => { if (e.target.id === 'skNext') return; audio.unlock(); const k = S.sk; if (!k || k.done) return; k.held = true; k.px = e.clientX; k.py = e.clientY; try { $('senko').setPointerCapture(e.pointerId); } catch { /* 無くても動く */ } });
$('senko').addEventListener('pointermove', (e) => { const k = S.sk; if (!k || !k.held) return; k.shake += Math.hypot(e.clientX - k.px, e.clientY - k.py) * 0.004; k.px = e.clientX; k.py = e.clientY; });
const skUp = () => { const k = S.sk; if (k && k.held && !k.done) { if (k.stage >= 0) endSenko(false); else k.held = false; } };
$('senko').addEventListener('pointerup', skUp); $('senko').addEventListener('pointercancel', skUp);
$('skNext').onclick = () => { audio.ui('tap'); S.sk = null; startNight(); };

function runOver(won) {
  const run = S.run;
  S.mode = 'over'; show('over');
  const meta = DB.meta, before = Run.unlockedCharms(meta).size, fuseBefore = Run.FUSES.filter((f) => Run.fuseOpen(f, meta)).length;
  meta.runs = (meta.runs || 0) + 1; meta.xp = (meta.xp || 0) + Run.xpFor(run); meta.best = Math.max(meta.best || 0, run.nightsCleared);
  if (won) { meta.wins = (meta.wins || 0) + 1; meta.rankOpen = Math.max(meta.rankOpen || 0, run.rank + 1); }
  achCheck({ stars: 0 });
  const after = Run.unlockedCharms(meta).size, fuseAfter = Run.FUSES.filter((f) => Run.fuseOpen(f, meta)).length;
  $('ovTitle').textContent = won ? tr('祭り、大団円！', 'The Festival is Complete!') : tr('今夜はここまで', 'The Night Ends');
  $('ovNights').textContent = tr(`${run.nightsCleared} / 24 夜`, `${run.nightsCleared} / 24 nights`);
  $('ovStats').innerHTML = [[tr('合計の点', 'Total score'), fmt(run.totalScore)], [tr('最大連鎖', 'Best chain'), run.bestChain], [tr('星', 'Stars'), run.stars], [tr('経験', 'XP'), '+' + Run.xpFor(run)]].map(([a, b], i) => `<div style="animation-delay:${i * 0.1}s"><span>${a}</span><b>${b}</b></div>`).join('');
  const ul = [];
  if (after > before) ul.push(tr(`新しいお守り ${after - before} 種！`, `${after - before} new charm(s)!`));
  if (fuseAfter > fuseBefore) ul.push(tr('新しい導火線！', 'New fuse!'));
  if (won && run.rank + 1 < Run.RANKS.length) ul.push(tr('次の段位が開いた！', 'Next rank unlocked!'));
  const order = Run.START_POOL, xp = meta.xp, rest = after < CHARMS.length ? 30 - (xp % 30) : 0;
  $('ovUnlocks').innerHTML = (ul.length ? `<div>${ul.join('  ')}</div>` : '') + (rest ? `<div class="nextun"><span>${tr(`次のお守りまで あと ${rest}`, `Next charm in ${rest} XP`)}</span><i style="width:${((30 - rest) / 30) * 100}%"></i></div>` : '');
  $('ovTitleBtn').textContent = tr('タイトル', 'Title'); $('ovAgain').textContent = tr('もう一度', 'PLAY AGAIN');
  DB.run = null; S.run = null; save();
  audio.ui(won ? 'win' : 'lose'); audio.scene(won ? 'finale' : 'calm');
  if (won) grandFinale();
}
$('ovTitleBtn').onclick = () => { audio.ui('tap'); toTitle(); };
$('ovAgain').onclick = () => { audio.ui('tap'); beginRun({ fuse: S.fuse, rank: S.rank }); };

// ひと休み
function openPause() {
  if (S.mode !== 'play') return;
  S.paused = true; show('pause'); hideTip(); PF.stop();
  $('pzTitle').textContent = tr('ひと休み', 'Paused');
  const lab = () => {
    $('pzSound').textContent = tr(`効果音 ${DB.sound ? 'ON' : 'OFF'}`, `Sound ${DB.sound ? 'ON' : 'OFF'}`);
    $('pzMusic').textContent = tr(`音楽 ${DB.music ? 'ON' : 'OFF'}`, `Music ${DB.music ? 'ON' : 'OFF'}`);
    $('pzLang').textContent = JA() ? 'English' : '日本語';
  };
  lab();
  $('pzSound').onclick = () => { DB.sound = !DB.sound; audio.setSound(DB.sound); save(); lab(); };
  $('pzMusic').onclick = () => { DB.music = !DB.music; audio.setMusic(DB.music); save(); lab(); };
  $('pzLang').onclick = () => { lang = JA() ? 'en' : 'ja'; DB.lang = lang; save(); openPause(); };
  renderHeld($('pzHeld'), false);
  $('pzQuit').textContent = tr('タイトルへ（続きから遊べます）', 'Title (you can continue later)'); $('pzResume').textContent = tr('つづける', 'RESUME');
}
function closePause() { S.paused = false; show('none'); last = performance.now(); PF.start(); }
$('pauseBtn').onclick = () => { audio.ui('tap'); openPause(); };
function soundIcon() { $('sndBtn').classList.toggle('off', !DB.sound); }
$('sndBtn').onclick = () => { audio.unlock(); DB.sound = !DB.sound; DB.music = DB.sound; audio.setSound(DB.sound); audio.setMusic(DB.music); save(); soundIcon(); };
soundIcon();
$('pzResume').onclick = () => { audio.ui('tap'); closePause(); };
$('pzQuit').onclick = () => { audio.ui('tap'); S.paused = false; pid = null; toTitle(); };
addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p') { if (S.paused) closePause(); else openPause(); } });
function toast(t) { const e = document.createElement('div'); e.className = 'pop gold'; e.textContent = t; e.style.left = '50%'; e.style.top = '30%'; e.style.fontSize = '22px'; e.style.zIndex = 9; document.body.append(e); setTimeout(() => e.remove(), 950); }

// ------------------------------------------------------------------ 入力
const toWorld = (e) => ({ x: (e.clientX / innerWidth) * W, y: (e.clientY / innerHeight) * H });
let pid = null;
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (S.mode !== 'play' || !S.st || pid !== null || S.paused) return;
  const p = toWorld(e);
  if (G.penDown(S.st, p.x, p.y)) { pid = e.pointerId; try { canvas.setPointerCapture(pid); } catch { /* 無くても動く */ } $('teach').classList.add('hidden'); }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== pid || !S.st) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (list.length ? list : [e])) { const p = toWorld(ev); G.penMove(S.st, p.x, p.y); }
});
const release = (e) => { if (e.pointerId !== pid) return; pid = null; if (S.st) G.penUp(S.st); };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('visibilitychange', () => { audio.mute(document.hidden); if (document.hidden && S.mode === 'play' && !S.paused && !(S.st && S.st.phase === 'stroke')) openPause(); });

// ------------------------------------------------------------------ 見せ方
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1));
function floatText(x, y, text, cls = '', size = 22) {
  const e = document.createElement('div'); e.className = 'pop ' + cls; e.textContent = text;
  e.style.left = (x / W) * 100 + '%'; e.style.top = (y / H) * 100 + '%'; e.style.fontSize = size * (innerHeight / H) + 'px';
  $('float').append(e); setTimeout(() => e.remove(), 950);
}
function banner(html, size = 70, life = 1600) {
  $('float').querySelectorAll('.banner').forEach((o) => o.remove());
  const e = document.createElement('div'); e.className = 'banner'; e.innerHTML = html; e.style.fontSize = size * (Math.min(innerWidth, innerHeight) / 720) + 'px'; e.style.animationDuration = life + 'ms';
  $('float').append(e); setTimeout(() => e.remove(), life);
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function launchFor(s) { const t = Math.max(0.28, s.rise); fx.launch(s.x + (Math.random() - 0.5) * 60, H * 0.84, s.x, s.y, t, PALETTES[s.type]?.[0] || [1, 0.7, 0.3]); }

function handle(ev) {
  const st = S.st;
  switch (ev.type) {
    case 'penDown': audio.scene('burn', 0.3); audio.note(7, { vol: 0.12, dur: 0.2 }); $('combo').classList.add('on'); $('cPts').textContent = fmt(st.stroke.chips); $('cMult').textContent = fmtM(st.stroke.mult); break;
    case 'ignite': audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(ev.x, ev.y, [3, 1.8, 0.7], 26, 220); fx.light(ev.x, ev.y, 0.5, 300, [1, 0.6, 0.25], 6); break;
    case 'thread': {
      const s = ev.shell, n = ev.n;
      audio.note(9 + n, { vol: ev.close ? 0.2 : 0.11, dur: 0.22, pan: panOf(s.x) });
      fx.tick(s.x, s.y, PALETTES[s.type]?.[1] || [1, 1, 0.8], ev.close ? 22 : 10, ev.close ? 240 : 150);
      if (ev.close) floatText(s.x, s.y - 34, tr('きわどい！', 'Close!'), 'gold', 22);
      break;
    }
    case 'burst': {
      const s = ev.shell, d = G.SHELLS[s.type], size = Math.min(1.8, ev.R / 120);
      fx.burst(d.kind, s.x, s.y, ev.R, s.type, ev.heatLv);
      audio.boom(size * (ev.how === 'line' ? 1 : 0.75), panOf(s.x), 0.015 + ((s.y / H) * 0.02));
      audio.note(Math.min(ev.n, 28) + 3, { vol: 0.16, dur: 0.55, pan: panOf(s.x), up: Math.floor(ev.n / 10) });
      R.shake = Math.min(14, R.shake + 2.2 * size);
      floatText(s.x, s.y, '+' + fmt(ev.pts), ev.pts >= 60 ? 'big' : '', 20 + Math.min(20, ev.pts / 12));
      if (ev.multUp > 0) { floatText(s.x, s.y - 26, `×${fmtM(ev.mult)}`, 'mult', 30); bump($('cMult')); audio.note(16, { vol: 0.14, dur: 0.3 }); }
      if (ev.multUp < 0) floatText(s.x, s.y - 26, `×${fmtM(ev.mult)}`, 'mult', 30);
      if (d.finale) { R.flash = 0.8; R.shake = 22; S.timeScale = 0.45; S.slowT = 0.5; }
      $('cPts').textContent = fmt(ev.chips); $('cMult').textContent = fmtM(ev.mult); bump($('cPts'));
      break;
    }
    case 'charmFire': {
      const b = document.querySelector(`#bags .bag[data-id="${ev.id}"]`);
      if (b) { b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); }
      if (ev.dMult && st.stroke) { $('cMult').textContent = fmtM(st.stroke.mult); bump($('cMult')); }
      if (ev.dCoin) { renderBags(); if (ev.x) floatText(ev.x, ev.y + 26, '+' + ev.dCoin, 'coinp', 22); }
      break;
    }
    case 'heat': {
      const el = $('heat');
      el.className = 'heat' + (ev.lv ? ' on l' + ev.lv : '');
      if (ev.lv) { $('heatTxt').textContent = tr(`熱い ×${G.heatMult(ev.lv, st)}`, `HOT ×${G.heatMult(ev.lv, st)}`); if (ev.up) { audio.ui('heat'); bump(el); } }
      break;
    }
    case 'held': if (!DB.meta.taught.leash) { DB.meta.taught.leash = 1; toast(tr('線は火から離れすぎると伸びない', 'Your line waits when it gets too far ahead')); } break;
    case 'gustWarn': audio.gust(0.5); break;
    case 'gust': audio.gust(1); R.shake = Math.min(14, R.shake + 5); fx.tick(ev.x, ev.y, [2.2, 2.6, 3.2], 34, 330); break;
    case 'brake': fx.tick(ev.x, ev.y, [1.6, 0.9, 0.4], 9, 120); break;
    case 'caught': audio.ui('caught'); floatText(ev.x, ev.y - 30, tr('追いつかれた！', 'Caught!'), 'mult', 30); fx.tick(ev.x, ev.y, [1.2, 0.5, 0.2], 40, 200); R.shake += 8; break;
    case 'saved': audio.note(20, { vol: 0.2, dur: 0.4 }); toast(tr('踏みとどまった！', 'Survived!')); break;
    case 'cut': fx.tick(ev.x, ev.y, [0.7, 0.9, 1.3], 18, 120); audio.note(0, { vol: 0.14, dur: 0.2 }); break;
    case 'knot': fx.tick(ev.x, ev.y, [3, 2.4, 1], 18, 180); audio.note(19, { vol: 0.16, dur: 0.3 }); floatText(ev.x, ev.y - 26, tr('結び！', 'Knot!'), 'gold', 22); break;
    case 'knotBurst': fx.burst('ring', ev.x, ev.y, ev.R, 'kin', 1); audio.boom(0.9, panOf(ev.x)); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); break;
    case 'charmBlast': fx.burst('peony', ev.x, ev.y, ev.R, 'chouchin', 1); audio.boom(1, panOf(ev.x)); break;
    case 'damp': fx.tick(ev.shell.x, ev.shell.y, [0.6, 0.6, 1.4], 8, 110); break;
    case 'inkOut': if (st.stroke) floatText(st.stroke.pts.at(-1).x, st.stroke.pts.at(-1).y - 30, tr('墨切れ', 'Out of ink'), 'gold', 24); break;
    case 'strokeEnd': {
      audio.fuse(0, 0);
      $('heat').className = 'heat';
      $('cMult').textContent = fmtM(ev.mult);
      slam(ev.gained);
      if (ev.bloom) { renderStreak(true); skyLine(st); if (st.shape) skyShape(st); grandFinale(); floatText(W * (0.2 + Math.random() * 0.6), H * 0.7, Math.random() < 0.5 ? tr('たまやー！', 'Tamaya!') : tr('かぎやー！', 'Kagiya!'), 'gold', 40); }
      else if (ev.pops >= 15) floatText(W * (0.2 + Math.random() * 0.6), H * 0.72, tr('たまやー！', 'Tamaya!'), 'gold', 30);
      else audio.scene('calm', 0.8);
      renderStrokes(); renderBags();
      break;
    }
    case 'aim': $('combo').classList.remove('on'); if (st.strokesLeft === 1 && !st.cleared) banner(tr('最後の一筆', 'Last Stroke'), 46, 1100); break;
    case 'rise': launchFor(ev.shell); audio.launch(panOf(ev.shell.x)); break;
    case 'cancel': $('combo').classList.remove('on'); audio.scene('calm'); break;
    case 'runner': audio.launch(panOf(ev.x)); break;
    case 'kids': audio.note(15, { vol: 0.14, dur: 0.3 }); floatText(ev.x, ev.y - 30, tr('子玉！', 'Babies!'), 'gold', 22); break;
    case 'meoto': { const n = 14; for (let i = 0; i <= n; i++) { const u = i / n; fx.add(ev.x + (ev.ox - ev.x) * u, ev.y + (ev.oy - ev.y) * u, 0, 0, 0.35, 3.4, 0, 0, [3, 1.2, 2], [1, 0.3, 0.6], 1.6); } audio.note(19, { vol: 0.17, dur: 0.4 }); floatText(ev.ox, ev.oy - 30, tr('夫婦！', 'Twins!'), 'gold', 24); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); break; }
    case 'bake': { const T = { fuku: ['福！ 倍率 +3', 'Luck! +3 MULT'], koban: ['小判 +3', '+3 coins'], tanuki: ['どろん！ 玉が入れかわった', 'Poof! Shells swapped places'], oni: ['鬼だ！ 火が跳ねる', 'Oni! The flame jumps'], tane: ['玉がわいた！', 'More shells!'], kinka: ['金に化けた！', 'Turned to gold!'] }[ev.what]; floatText(ev.x, ev.y - 40, JA() ? T[0] : T[1], ev.what === 'oni' || ev.what === 'tanuki' ? 'mult' : 'gold', 28); audio.note(ev.what === 'oni' ? 2 : 20, { vol: 0.18, dur: 0.4 }); if (ev.what === 'oni') R.shake += 8; if (ev.what === 'tanuki') for (const o of st.shells) if (o.state === 'idle') fx.tick(o.x, o.y, [1.8, 1.8, 2], 8, 90); renderBags(); $('cMult').textContent = fmtM(ev.mult); break; }
    case 'tome': floatText(ev.x, ev.y - 34, tr('火が止まった！', 'Flame stopped!'), 'gold', 26); audio.note(4, { vol: 0.18, dur: 0.6 }); fx.tick(ev.x, ev.y, [1.6, 1.8, 1.4], 24, 150); break;
    case 'juzu': if (ev.ok) { floatText(ev.x, ev.y - 30, `${ev.n}`, 'gold', 34); audio.note(10 + ev.n * 2, { vol: 0.18, dur: 0.35 }); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); } else { floatText(ev.x, ev.y - 30, tr('順番ちがい', 'Wrong order'), 'mult', 20); audio.note(1, { vol: 0.1, dur: 0.2 }); } break;
    case 'juzuDone': banner(tr('数珠がつながった！', 'Beads complete!'), 48, 1100); audio.ui('win'); $('cMult').textContent = fmtM(ev.mult); break;
    case 'coinPop': floatText(ev.x, ev.y + 26, '+' + ev.n, 'coinp', 24); renderBags(); break;
    case 'crowIn': audio.note(1, { vol: 0.16, dur: 0.18 }); setTimeout(() => audio.note(0, { vol: 0.14, dur: 0.16 }), 120); break;
    case 'crowTake': floatText(ev.x, ev.y - 20, tr('さらわれた！', 'Stolen!'), 'mult', 24); audio.note(2, { vol: 0.14, dur: 0.25 }); break;
    case 'crowDown': case 'shoo': floatText(ev.x, ev.y - 20, (ev.type === 'shoo' ? tr('しっしっ！', 'Shoo!') : tr('撃ち落とした！', 'Shot down!')) + ` +${ev.n}`, 'coinp', 24); fx.tick(ev.x, ev.y, [1.6, 1.6, 2.4], 20, 170); audio.note(17, { vol: 0.15, dur: 0.25 }); renderBags(); break;
    case 'goal': banner(tr('お見事！', 'Splendid!'), 80, 1500); audio.ui('win'); R.flash = Math.max(R.flash, 0.2); break;
    case 'okawari': if (st.act2) break; banner(`${tr('おかわり！', 'One More Round!')}<small>${tr('盤がまるごと入れかわった', 'A whole new sky')}</small>`, 64, 1500); audio.ui('heat'); renderStreak(true); break;
    case 'act2': {
      const r = st.rule && Run.RULES[st.rule];
      banner(`${tr('第 二 幕', 'ENCORE')}<small>${r ? tr(`${r.ja}が怒った！ `, `${r.en} is furious! `) : ''}${tr('もう勝っている。この一筆は稼ぎ放題', 'You already won. This stroke is pure profit')}</small>`, 84, 3000);
      if (r) drawBoss(r.cast, 'taunt');
      audio.boom(1.8, 0); R.flash = 0.4; R.shake = 16; renderStrokes(); audio.scene('finale', 0.4);
      break;
    }
    case 'intrude': { const t = Run.INTRUDES[ev.kind]; banner(`${JA() ? t.ja : t.en}<small>${JA() ? t.dj : t.de}</small>`, 58, 1900); audio.boom(1, 0); R.shake = Math.min(14, R.shake + 7); R.flash = Math.max(R.flash, 0.12); break; }
    case 'nightEnd': nightEnded(); break;
    default:
  }
}
// 点 × 倍率 が一つにまとまって、上の点へ飛んでいく。大きいほど派手に
function slam(gained) {
  const el = $('combo'); el.classList.remove('slam'); void el.offsetWidth; el.classList.add('slam');
  const big = Math.min(1, Math.log10(Math.max(10, gained)) / 5);
  floatText(W / 2, H * 0.27, `+${fmt(gained)}`, 'big', 30 + big * 40);
  audio.boom(0.6 + big * 0.8, 0);
  R.shake = Math.min(20, R.shake + 4 + big * 10);
  R.flash = Math.max(R.flash, 0.03 + big * 0.05);
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 300; fx.add(W / 2, H * 0.2, Math.cos(a) * v, Math.sin(a) * v * 0.5, 0.5 + Math.random() * 0.4, 2.2, 2.4, 90, [3, 2.2, 0.9], [1, 0.4, 0.1], 1.4); }
}
const fmtM = (m) => (Math.abs(m - Math.round(m)) < 0.05 ? String(Math.round(m)) : m.toFixed(1));

// 満開: 自分の引いた線が、そのまま空に光る
function skyLine(st) {
  const P = st.stroke?.pts; if (!P || P.length < 3) return;
  const step = Math.max(1, Math.floor(P.length / 150));
  for (let i = 0; i < P.length; i += step) {
    const p = P[i];
    S.seq.push({ at: 0.1 + (i / P.length) * 0.9, f: () => {
      for (let q = 0; q < 3; q++) { const a = Math.random() * 6.283, v = 12 + Math.random() * 46; fx.add(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v, 1.5 + Math.random() * 0.9, 2.8, 1.1, 42, [3.2, 2.5, 1], [1.2, 0.4, 0.08], 1.7, 2); }
    } });
  }
}
// 型物の夜: 玉の絵が、空いっぱいに開く
function skyShape(st) {
  const P = st.shape.pts, cx = P.reduce((a, p) => a + p.x, 0) / P.length, cy = P.reduce((a, p) => a + p.y, 0) / P.length;
  S.seq.push({ at: 0.55, f: () => {
    audio.boom(2, 0); R.flash = Math.max(R.flash, 0.2);
    for (const p of P) for (let q = 0; q < 26; q++) {
      const j = (Math.random() - 0.5) * 22, k = (Math.random() - 0.5) * 22, gx = p.x + j - cx, gy = p.y + k - cy;
      fx.add(cx, cy, gx * 1.9, gy * 1.9, 2.6, 3.2, 1.05, 12, [3, 2.2, 1.2], [1.4, 0.3, 0.2], 1.8, 2);
    }
  } });
}

// 全部ひらいた: 町じゅうの玉が一斉に上がる
function grandFinale() {
  banner(tr('満 開', 'FULL BLOOM'), 112, 2600);
  audio.scene('finale', 0.2); audio.ui('win');
  R.flash = 0.26; R.shake = 18; S.timeScale = 0.4; S.slowT = 0.8;
  for (let i = 0; i < 26; i++) {
    const t = 0.25 + i * 0.1 + Math.random() * 0.12, x = W * (0.08 + Math.random() * 0.84), y = H * (0.1 + Math.random() * 0.46);
    const type = SHELL_ORDER[Math.floor(Math.random() * 6)], kind = fx.kinds[Math.floor(Math.random() * 6)];
    S.seq.push({ at: t - 0.42, f: () => { fx.launch(x, H * 0.84, x, y, 0.42, PALETTES[type][0]); audio.launch(panOf(x)); } });
    S.seq.push({ at: t, f: () => { fx.burst(kind, x, y, 120 + Math.random() * 90, type, 1); audio.boom(1.2, panOf(x)); R.shake = Math.min(14, R.shake + 4); } });
  }
}

// ------------------------------------------------------------------ 描画の仕上げ
function ribbon(gl, P, vaoF, fuseBuf, cam, VW, VH, k, t, mirror) {
  const P2 = k.pts, n = P2.length, data = new Float32Array(n * 8);
  const wid = 4.6 + k.heatLv * 1.1;
  for (let i = 0; i < n; i++) {
    const a = P2[Math.max(0, i - 1)], b = P2[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const w = wid * (0.82 + 0.25 * Math.sin(P2[i].s * 0.021)), o = i * 8, x = mirror ? VW - P2[i].x : P2[i].x;
    const nx = mirror ? dy : -dy;
    data[o] = x + nx * w; data[o + 1] = P2[i].y + dx * w; data[o + 2] = P2[i].s; data[o + 3] = -1;
    data[o + 4] = x - nx * w; data[o + 5] = P2[i].y - dx * w; data[o + 6] = P2[i].s; data[o + 7] = 1;
  }
  gl.useProgram(P.fuse.p); gl.bindVertexArray(vaoF);
  gl.bindBuffer(gl.ARRAY_BUFFER, fuseBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  const U = P.fuse.u;
  gl.uniform2f(U.uView, VW, VH); gl.uniform3f(U.cam, cam.x, cam.y, cam.z); gl.uniform1f(U.flameS, k.flameS); gl.uniform1f(U.len, k.len); gl.uniform1f(U.time, t); gl.uniform1f(U.heat, k.heatLv); gl.uniform1f(U.on, k.flameOn ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
}
function drawWorld({ gl, cam, P, vaoSpr, vaoF, sprBuf, sprData, fuseBuf, tex, W: VW, H: VH, MAX_SPR }) {
  const st = S.st, t = R.time;
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const k = st && st.stroke;
  if (k && k.pts.length > 1) {
    ribbon(gl, P, vaoF, fuseBuf, cam, VW, VH, k, t, false);
    if (st.rule === 'kagami' || st.m.mirror) ribbon(gl, P, vaoF, fuseBuf, cam, VW, VH, k, t, true);
  }
  if (st) {
    let c = 0;
    const dark = st.rule === 'yamiyo';
    const pen = k && k.pts.length ? k.pts[k.pts.length - 1] : null;
    for (const s of st.shells) {
      if (s.state === 'burst' || s.state === 'stolen' || s.state === 'gone' || s.rise > 0 || c >= MAX_SPR - 12) continue;
      const lit = s.state === 'lit', bob = s.threaded || lit ? 0 : Math.sin(t * 1.3 + s.phase) * 3.2;
      const swell = lit ? 1.16 + Math.sin(t * 60) * 0.06 : s.threaded ? 1.1 : 1 + Math.sin(t * 2 + s.phase) * 0.015;
      let al = 1;
      if (dark && !lit && st.t > 3.5) { const d = pen ? Math.hypot(s.x - pen.x, s.y - pen.y) : 9999; al = Math.max(0.03, 1 - d / 210); }
      const o = c * 8;
      sprData[o] = s.x; sprData[o + 1] = s.y + bob; sprData[o + 2] = (s.r / 0.72) * swell; sprData[o + 3] = 0;
      sprData[o + 4] = cellOf(s); sprData[o + 5] = 0; sprData[o + 6] = lit ? 1.4 : s.threaded ? 0.55 : 0.1; sprData[o + 7] = al;
      c++;
    }
    if (k && k.flameOn && !k.fuseOut) {
      const o = c * 8, hot = k.heatLv >= 2 || k.gustT > 0 || k.gustWarnT > 0;
      sprData[o] = k.fx; sprData[o + 1] = k.fy - 8 + Math.sin(t * 14) * 1.5; sprData[o + 2] = 30 + k.heatLv * 5; sprData[o + 3] = 0;
      sprData[o + 4] = HINOKO_CELL + (hot ? 1 : 0); sprData[o + 5] = 0; sprData[o + 6] = 0.15 + k.heatLv * 0.1; sprData[o + 7] = 1;
      c++;
    }
    const put = (x, y, size, cell, g = 0.1) => { const o = c * 8; sprData[o] = x; sprData[o + 1] = y; sprData[o + 2] = size; sprData[o + 3] = 0; sprData[o + 4] = cell; sprData[o + 5] = 0; sprData[o + 6] = g; sprData[o + 7] = 1; c++; };
    for (const b of st.blades) put(b.x, b.y, 26, HUB_CELL, 0.25);
    for (const q of st.crows) {
      if (q.carry) put(q.x, q.y + 26, 22, cellOf(q.carry), 0.1);
      put(q.x, q.y + Math.sin(t * 16 + q.x) * 3, 40, CROW_CELL, 0.12);
    }
    if (c) {
      gl.useProgram(P.spr.p); gl.bindVertexArray(vaoSpr);
      gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprData, 0, c * 8);
      gl.uniform2f(P.spr.u.uView, VW, VH); gl.uniform3f(P.spr.u.cam, cam.x, cam.y, cam.z); gl.uniform2f(P.spr.u.cell, 1 / ATLAS_CELLS, 1);
      tex(0, atlasTex, P.spr.u.t);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, c);
    }
  }
}

function perFrameFx(dt) {
  const st = S.st, one = Math.max(dt, 0.001) * 1.2;
  if (st) {
    const dark = st.rule === 'yamiyo' && st.t > 3.5;
    if (!dark) for (const s of st.shells) {
      if (s.state !== 'idle' || s.rise > 0) continue;
      const c = PALETTES[s.type]?.[0] || [1, 0.7, 0.4];
      fx.add(s.x, s.y, 0, 0, one, s.r * (s.threaded ? 2.4 : 1.8), 0, 0, c, c, s.threaded ? 0.55 : 0.22);
    }
    // 油と水
    for (const z of st.zones) {
      const col = z.kind === 'oil' ? [1.6, 0.62, 0.08] : [0.22, 0.68, 1.7], sp = 25;
      // 面: 格子の粒をゆっくり揺らす（油は沸き立ち、水はさざ波）
      for (let gx = -z.r; gx <= z.r; gx += sp) for (let gy = -z.r; gy <= z.r; gy += sp) {
        if (gx * gx + gy * gy > z.r * z.r * 0.92) continue;
        const ph = gx * 0.043 + gy * 0.071, wob = Math.sin(R.time * (z.kind === 'oil' ? 2.6 : 1.3) + ph * 3);
        fx.add(z.x + gx + wob * 5, z.y + gy + Math.cos(R.time * 1.1 + ph * 2) * 4, 0, 0, one, 2.3 + wob * 0.5, 0, 0, col, col, 0.42 + wob * 0.16);
      }
      const n = Math.round(z.r / 3);
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + R.time * (z.kind === 'oil' ? 0.35 : -0.25), rr = z.r + Math.sin(a * 5 + R.time * 2) * 3; fx.add(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr, 0, 0, one, 2.6, 0, 0, col, col, 1.5); }
    }
    // 風車の羽根
    for (const b of st.blades) {
      const ca = Math.cos(b.a), sa = Math.sin(b.a), col = [3, 0.7, 0.45];
      for (let i = -14; i <= 14; i++) { const u = (i / 14) * b.len; fx.add(b.x + ca * u, b.y + sa * u, 0, 0, one, 3, 0, 0, col, col, 1.5); }
    }
    // 夫婦の糸・矢の向き
    for (const s of st.shells) {
      if (s.state !== 'idle' || s.rise > 0) continue;
      if (s.type === 'roket' && s.dir !== undefined) { const col = [3, 1.1, 0.5]; for (let i = 1; i <= 4; i++) { const u = s.r + 6 + i * 11 + ((R.time * 40) % 11); fx.add(s.x + Math.cos(s.dir) * u, s.y + Math.sin(s.dir) * u, 0, 0, one, 3.2 - i * 0.4, 0, 0, col, col, 1.6 - i * 0.25); } }
      if (s.pair && s.id < s.pair) {
        const o = st.shells.find((x) => x.id === s.pair); if (!o || o.state !== 'idle' || o.rise > 0) continue;
        const d = Math.hypot(o.x - s.x, o.y - s.y), n = Math.min(18, Math.floor(d / 34)), col = [1.5, 0.5, 1];
        for (let i = 1; i < n; i++) { const u = ((i + (R.time * 0.9) % 1) / n); fx.add(s.x + (o.x - s.x) * u, s.y + (o.y - s.y) * u, 0, 0, one, 1.7, 0, 0, col, col, 0.75); }
      }
    }
    // ねずみとロケットの尾
    for (const q of st.runners) {
      const roket = q.kind === 'roket', col = roket ? [3, 1.6, 0.6] : [2.8, 2.4, 1.2];
      fx.add(q.x, q.y, 0, 0, one, roket ? 7 : 6, 0, 0, [3.2, 2.8, 2], [3.2, 2.8, 2], 1.5);
      for (let i = 0; i < 3; i++) { const a = q.a + Math.PI + (Math.random() - 0.5) * 0.9, v = 60 + Math.random() * 160; fx.add(q.x, q.y, Math.cos(a) * v, Math.sin(a) * v, 0.28 + Math.random() * 0.3, 2.2, 2, 50, col, [1, 0.3, 0.05], 1.8); }
      fx.light(q.x, q.y, 0.18, 240, [1, 0.6, 0.25], 40);
    }
    for (const d of st.drops) fx.add(d.x, d.y, 0, d.vy, one, 1.6, 0, 0, [0.75, 0.9, 1.3], [0.75, 0.9, 1.3], 0.8);
    for (const q2 of st.sparks) fx.add(q2.x, q2.y, q2.vx, q2.vy, 0.05, 2.6, 0, 0, [3, 2.6, 1.3], [1, 0.6, 0.2], 1.3);
  }
  const k = st && st.stroke;
  if (k) {
    const pen = k.pts[k.pts.length - 1];
    if (k.flameOn && !k.fuseOut && k.pts.length > 1) {
      const prev = k.pts[Math.max(0, k.idx)], nx = k.pts[Math.min(k.pts.length - 1, k.idx + 1)], l = Math.hypot(nx.x - prev.x, nx.y - prev.y) || 1;
      fx.flame(k.fx, k.fy, (nx.x - prev.x) / l, (nx.y - prev.y) / l, k.heatLv + (k.gustT > 0 ? 2 : 0), dt);
      if (st.rule === 'kagami' || st.m.mirror) fx.flame(st.w - k.fx, k.fy, -(nx.x - prev.x) / l, (nx.y - prev.y) / l, k.heatLv, dt);
    }
    if (k.gustWarnT > 0 || k.gustT > 0) {
      const warn = k.gustWarnT > 0, r = warn ? 16 + (k.gustWarnT / st.m.gustWarn) * 62 : 24 + Math.sin(R.time * 40) * 5, col = [2.4, 2.8, 3.4];
      for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.283 - R.time * 5; fx.add(k.fx + Math.cos(a) * r, k.fy + Math.sin(a) * r, 0, 0, one, 2.4, 0, 0, col, col, 1.5); }
    }
    if (k.penDown) {
      const gap = k.len - k.flameS, hot = k.flameOn ? Math.max(0, 1 - gap / st.m.hotGap) : 0;
      if (k.held && k.want) {
        const dx = k.want.x - pen.x, dy = k.want.y - pen.y, d = Math.hypot(dx, dy), n = Math.min(14, Math.floor(d / 22));
        for (let i = 1; i <= n; i++) { const u = ((i - 1 + (R.time * 3) % 1) / n); fx.add(pen.x + dx * u, pen.y + dy * u, 0, 0, one, 2.2, 0, 0, [1.3, 1.1, 0.7], [1.3, 1.1, 0.7], 0.55); }
      }
      fx.add(pen.x, pen.y, 0, 0, one, 9 + hot * 6, 0, 0, [2.4, 2, 1.2], [2, 1.5, 0.8], 0.9);
      if (k.flameOn && gap < st.m.hotGap * 1.6) {
        const r = 14 + Math.max(0, gap) * 0.26, col = gap < st.m.hotGap * 0.45 ? [3, 0.5, 0.15] : gap < st.m.hotGap ? [3, 1.4, 0.3] : [1.2, 1, 0.6];
        const nDots = 22;
        for (let i = 0; i < nDots; i++) { const a = (i / nDots) * 6.283 + R.time * 3; fx.add(pen.x + Math.cos(a) * r, pen.y + Math.sin(a) * r, 0, 0, one, 2.1, 0, 0, col, col, 1.3); }
      }
      audio.fuse(k.flameOn ? 1 : 0, k.heatLv);
    } else audio.fuse(k.flameOn && !k.fuseOut ? 0.7 : 0, k.heatLv);
    R.heat += ((k.penDown ? k.heatLv / 3 : 0) - R.heat) * Math.min(1, dt * 8);
    const inkEl = $('inkBar'); inkEl.parentElement.classList.toggle('on', k.penDown); inkEl.style.transform = `scaleX(${Math.max(0, 1 - k.len / (st.ink + st.carriedInk))})`;
  } else { R.heat *= 0.9; $('inkBar').parentElement.classList.remove('on'); }
}

function updateHud() {
  const st = S.st; if (!st || S.mode !== 'play') return;
  const live = G.liveScore(st);
  S.shown = (S.shown || 0) + (live - (S.shown || 0)) * 0.18; if (Math.abs(live - S.shown) < 1) S.shown = live;
  $('gScore').textContent = fmt(S.shown);
  $('gBar').style.width = Math.min(100, (S.shown / (st.target * 2.5)) * 100) + '%';
  if (!S.crossed && live >= st.target) { S.crossed = true; banner(tr('目標達成！', 'TARGET!'), 58, 1200); audio.ui('win'); R.flash = Math.max(R.flash, 0.06); }
}

// はじめての夜だけ: 動く手本（玉を順に通る火の粉）
function hintFx(dt) {
  const st = S.st; if (!st || S.teachKey !== 'draw' || st.phase !== 'aim' || st.strokesUsed > 0) { $('hand').classList.add('hidden'); return; }
  S.hint += dt;
  const idle = st.shells.filter((s) => s.rise <= 0); if (idle.length < 3) return;
  if (!S.hintPath || S.hintFor !== st) {
    let best = idle[0], bn = 0;
    for (const a of idle) { const n = idle.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) < 170).length; if (n > bn) { bn = n; best = a; } }
    S.hintPath = idle.slice().sort((a, b) => Math.hypot(a.x - best.x, a.y - best.y) - Math.hypot(b.x - best.x, b.y - best.y)).slice(0, 5).sort((a, b) => a.x - b.x);
    S.hintFor = st;
  }
  const seedS = S.hintPath;
  const u = (S.hint % 3.2) / 2.4;
  const hand = $('hand');
  if (u > 1) { hand.classList.add('hidden'); return; }
  const seg = u * (seedS.length - 1), i = Math.floor(seg), f = seg - i, a = seedS[i], b = seedS[Math.min(i + 1, seedS.length - 1)];
  const hx = a.x + (b.x - a.x) * f, hy = a.y + (b.y - a.y) * f;
  fx.add(hx, hy, 0, 0, 0.6, 6, 0, 0, [2.6, 2, 1], [1, 0.4, 0.1], 1.4);
  hand.classList.remove('hidden'); hand.style.left = (hx / W) * 100 + '%'; hand.style.top = (hy / H) * 100 + '%';
}
function titleFx(dt) {
  S.titleT -= dt;
  if (S.titleT <= 0) {
    S.titleT = 0.9 + Math.random() * 1.1;
    const x = W * (0.1 + Math.random() * 0.8), y = H * (0.12 + Math.random() * 0.4), type = SHELL_ORDER[Math.floor(Math.random() * 6)], kind = fx.kinds[Math.floor(Math.random() * 6)];
    fx.launch(x, H * 0.84, x, y, 0.55, PALETTES[type][0]);
    S.seq.push({ at: 0.55, f: () => { fx.burst(kind, x, y, 110 + Math.random() * 110, type, 0); audio.boom(0.7, panOf(x)); } });
  }
}

// ------------------------------------------------------------------ 主の繰り返し
let last = performance.now(), acc = 0, frames = 0, fpsT = 0, fps = 0, slowCount = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  frames++; fpsT += dt; if (fpsT > 0.5) {
    fps = frames / fpsT; frames = 0; fpsT = 0; if (S.fpsEl) S.fpsEl.textContent = `${fps.toFixed(0)} fps ${fx.live()} p x${scaleMax.toFixed(2)}`;
    slowCount = fps < 42 && !document.hidden ? slowCount + 1 : 0;
    if (slowCount >= 6 && scaleMax > 0.6) { scaleMax = Math.max(0.6, scaleMax * 0.75); slowCount = 0; resize(); }
  }
  try {
    if (S.paused) { dt = 0; }
    if (S.slowT > 0) { S.slowT -= dt; if (S.slowT <= 0) S.timeScale = 1; }
    const sdt = dt * S.timeScale;
    if (S.mode === 'play' && S.st && !S.paused) {
      acc += sdt;
      while (acc >= G.DT && S.mode === 'play') { acc -= G.DT; G.step(S.st, G.DT); const evs = S.st.events.splice(0); for (const ev of evs) handle(ev); }
      const st = S.st;
      if (st.phase === 'stroke' && st.stroke && !st.stroke.penDown && S.slowT <= 0) {
        const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0).length;
        if (idle === 0 && st.pending.length === 1 && st.stroke.pops > 3) { S.timeScale = 0.3; S.slowT = 0.6; }
      }
    }
    if (S.mode === 'title') titleFx(dt);
    if (S.mode === 'senko' && !S.paused) senkoFx(dt);
    for (let i = S.seq.length - 1; i >= 0; i--) { const e = S.seq[i]; e.at -= dt; if (e.at <= 0) { S.seq.splice(i, 1); e.f(); } }
    if (!S.paused) { perFrameFx(sdt); hintFx(sdt); fx.update(sdt); }
    R.lights = fx.lights;
    R.flash *= Math.exp(-dt * 6); R.shake *= Math.exp(-dt * 9);
    R.render(sdt, fx, drawWorld);
    updateHud();
  } catch (err) { if (!S.fatal) { S.fatal = err; console.error(err); } }
}

// ------------------------------------------------------------------ 起動
async function boot() {
  await PF.init();
  PF.loadingStart();
  PF.onMute = (m) => audio.setSound(m ? false : DB.sound);
  if (PF.muted) { audio.setSound(false); audio.setMusic(false); }
  if (PF.ready) { const j = PF.read(SAVE); if (j) { try { const c = JSON.parse(j); if ((c.meta?.xp || 0) >= (DB.meta.xp || 0)) { Object.assign(DB, c); S.run = DB.run; } } catch { /* */ } } }
  try { await document.fonts.load('900 60px "Yuji Boku"', '一筆花火金大千灯雫氷鬼尺' + CHARMS.map((c) => c.ja[0]).join('')); } catch { /* 字が読めなくても遊べる */ }
  atlasTex = R.texture(shellAtlas());
  S.themeKey = 'summer';
  resize();
  await loadBand('summer');
  layoutBand();
  toTitle();
  if (q.has('debug')) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:8px;top:60px;font:12px monospace;color:#7f7;z-index:9'; document.body.append(d); S.fpsEl = d; }
  requestAnimationFrame(frame);
  PF.loadingStop();
  S.booted = true;
  try { sessionStorage.removeItem('hanabiRetry'); } catch { /* 無くても動く */ }
  if (!DB.run && !(DB.meta.runs > 0) && !q.has('title')) beginRun();
}
window.HANABI = { S, G, Run, R, fx, audio, DB, startNight, beginRun, grandFinale, openSenko, skyLine, skyShape, get W() { return W; }, get H() { return H; }, toWorld, nightEnded, runOver, peekNext };
boot();
