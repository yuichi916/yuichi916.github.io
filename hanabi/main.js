// 一筆花火 2 — 画面の流れと、入力・描画・音をつなぐ
import * as G from './sim.js';
import * as Run from './run.js';
import { resumeNight } from './verify.js';
import { CHARMS, CHARM_BY_ID, TAG_NAME, TAG_COLOR, TIMES, growText } from './charms.js';
import { createRenderer } from './gl.js';
import { createFx, PALETTES } from './fx.js';
import { createAudio } from './audio.js';
import { shellAtlas, noiseTex, placeholderBand, SHELL_ORDER, ATLAS_CELLS, drawBag, drawShellIcon, SHELL_NAME, SHELL_DESC, cellOf, HINOKO_CELL, CROW_CELL, HUB_CELL } from './art.js';
import { createPlatform } from './platform.js';
import { ACHIEVEMENTS, checkAchievements } from './ach.js';
import { THEMES } from './levels.js';
import { drawCast } from '../assets/hitofude/cast.js';
import { track, share, canShare } from './track.js';
import * as Mem from './memory.js';
import { cleanName } from '../assets/hitofude/names.js';

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
  ['calm', BGM + 'hitofude_calm.mp3', { loopStart: 1.17, gain: 0.5, stream: true }], // 最初に鳴る長い曲は、届いたぶんから流す（全部を変換しない）
  ['burn', BGM + 'hitofude_burn.mp3', { gain: 0.95 }],
  ['finale', BGM + 'hitofude_finale.mp3', { gain: 0.9 }],
]);

const PF = createPlatform();

// ------------------------------------------------------------------ 保存
const SAVE = 'hanabi2';
// Playgama の書き出し（HANABI_PG）では localStorage を使わない（保存は Bridge の storage だけ）
const load = () => { if (window.HANABI_PG) return {}; try { return JSON.parse(localStorage.getItem(SAVE) || '{}'); } catch { return {}; } };
const DB = { meta: { xp: 0, wins: 0, best: 0, runs: 0, rankOpen: 0, taught: {}, seen: {} }, run: null, lang: null, sound: true, music: true, ...load() };
DB.meta.mem = Mem.fixMem(DB.meta.mem);
const mem = () => DB.meta.mem;
const save = () => { const j = JSON.stringify(DB); if (!window.HANABI_PG) { try { localStorage.setItem(SAVE, j); } catch { /* 保存できない環境でも遊べる */ } } PF.write(SAVE, j); };

let lang = q.get('lang') || DB.lang || ((navigator.language || 'en').startsWith('ja') ? 'ja' : 'en');
const JA = () => lang === 'ja';
const tr = (ja, en) => (JA() ? ja : en);
// 音の設定を反映する。場（Playgama・YouTube）が消音している間は、ゲームの設定が ON でも鳴らさない（場の設定を上書きしない）
const applySound = () => { const m = !!PF.muted; audio.setSound(DB.sound && !m); audio.setMusic(DB.music && !m); };
applySound();

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
  b.rect0 = b.rect.slice(); b.water0 = b.waterY; // 上へ昇るとき、町を下へずらす元
}
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const bandCache = {};
async function loadBand(key) {
  if (!bandCache[key]) {
    bandCache[key] = (async () => {
      try {
        const meta = await fetch(`art/${key}/band.json`).then((r) => { if (!r.ok) throw 0; return r.json(); });
        // 夜の絵だけで始め、花火に照らされた絵は届いたら差しかえる（起動を待たせない）
        const a = await img(`art/${key}/band_night.webp`);
        const out = { a, c: a, f: meta.waterFrac };
        img(`art/${key}/band_flash.webp`).then((c) => { out.c = c; if (S.bandKey === key) setBand(out.a, out.c, out.f); }).catch(() => {});
        return out;
      } catch { const ph = placeholderBand(); return { a: ph.night, c: ph.flash, f: ph.waterFrac }; }
    })();
  }
  const b = await bandCache[key];
  S.bandKey = key; setBand(b.a, b.c, b.f);
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
const SCREENS = ['title', 'newrun', 'inter', 'over', 'pause', 'book', 'senko', 'rankScr'];
function show(name) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name); if (name !== 'none') { hideVeil(); /* 盤の上の題名は、ほかの画面を開いたら消す */ $('hand').classList.add('hidden'); S.guide = false; $('guide').classList.add('hidden'); $('guideRing').classList.add('hidden'); } } // 手本の指は遊んでいる間だけ（屋台に残っていた）

function toTitle() {
  PF.stop();
  S.mode = 'title'; S.st = null; S.seq = []; ihenReset(); hideVeil();
  show('title'); $('hud').classList.add('hidden'); $('teach').classList.add('hidden');
  setTheme('summer');
  // 物語の結末を見たあとは、ここが「終わらない祭り」（灯が帰らずに逃げ続けていた世界）になる
  // 前の遊びの終わり方・何日ぶりか・時刻で、一言が変わる（読んだあとで「いま」を記録）
  const tl = Mem.titleLine(DB.meta); $('tagline').textContent = JA() ? tl.ja : tl.en;
  if (!S.titleSeen) { S.titleSeen = 1; mem().lastPlay = Date.now(); save(); }
  $('playBtn').textContent = DB.run ? tr('続きから', 'CONTINUE') : tr('あそぶ', 'PLAY');
  { const ci = $('contInfo'), r = DB.run; ci.classList.toggle('hidden', !r);
    if (r) { const wn = Run.worldOf(r.world), where = r.shopState?.sh && r.shopAt === `${r.world}-${r.night}` ? tr(`第 ${r.night} 夜のあとの屋台`, `stalls after night ${r.night}`) : tr(`第 ${r.night} 夜${r.inNight?.used ? 'の途中' : ''}`, `night ${r.night}${r.inNight?.used ? ' (in progress)' : ''}`);
      ci.innerHTML = (S.savedNote ? `<b>${tr('保存しました。', 'Saved. ')}</b>` : '') + tr(`続き：${JA() ? wn.ja : wn.en} ${where}`, `Continue: ${wn.en}, ${where}`); S.savedNote = 0; } }
  const m = $('titleMenu'); m.innerHTML = '';
  const add = (t, f) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { audio.unlock(); audio.ui('tap'); f(); }; m.append(b); };
  if (DB.meta.runs > 0 || DB.run) add(tr('新しい祭り', 'New Run'), openNewRun);
  if (DB.meta.runs > 0) add(tr('今日の祭り', 'Daily'), startDaily);
  if (S.rankOk) add(tr('世界ランキング', 'World Ranking'), () => openRank(DB.run?.daily ? 'daily' : 'daily'));
  else if (PF.lbType() === 'in_game') add(tr('ランキング', 'Leaderboard'), openPgRank);
  else if (PF.lbType() === 'native_popup') add(tr('ランキング', 'Leaderboard'), () => PF.lbPopup());
  add(tr('お守り帳', 'Charm Book'), openBook);
  // 物語は日本語のみ。ゲームサイト用の書き出し（story.html を入れない）では出さない
  if (!window.HANABI_NO_STORY) add(tr('物語', 'Story (Japanese)'), () => { location.href = 'story.html'; });
  // 初代（旧版）へ。CrazyGames など外へのリンクを禁じる書き出しでは出さない
  if (!window.HANABI_NO_LINKS) add(tr('初代 一筆花火', 'Original Hitofude Hanabi'), () => { const u = window.HANABI_PKG ? 'https://yuichi916.github.io/hitofude.html' : '../hitofude.html'; if (window.HANABI_PKG) window.open(u, '_blank', 'noopener'); else location.href = u; });
  add(tr(`音 ${DB.sound ? 'ON' : 'OFF'}`, `Sound ${DB.sound ? 'ON' : 'OFF'}`), () => { DB.sound = !DB.sound; DB.music = DB.sound; applySound(); save(); toTitle(); });
  add(JA() ? 'English' : '日本語', () => { lang = JA() ? 'en' : 'ja'; DB.lang = lang; save(); toTitle(); });
  audio.scene('calm');
}
// 題名画面で音がまだ止まっている間だけ出す（ブラウザは、画面に一度触れるまで音を出させない）。どこに触れても鳴り始める
setInterval(() => { const e = $('sndHint'); if (!e) return; const need = S.mode === 'title' && DB.sound && !(audio.ctx && audio.ctx.state === 'running'); e.textContent = tr('♪ 画面に触れると音が出ます', '♪ Tap anywhere for sound'); e.classList.toggle('hidden', !need); }, 400);

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
  // 流派: 芯のルールを変える（夜を越えるほど開く）
  $('nrSchoolT').textContent = tr('流派をえらぶ', 'Choose your school');
  const sl = $('schoolList'); sl.innerHTML = ''; S.school = S.school || 'hon';
  for (const f of Run.SCHOOLS) {
    const open = Run.fuseOpen(f, DB.meta);
    const b = document.createElement('button'); b.className = 'fuse school' + (S.school === f.id ? ' on' : ''); b.disabled = !open;
    b.innerHTML = `<b>${open ? (JA() ? f.ja : f.en) : '？？？'}</b><small>${open ? (JA() ? f.dj : f.de) : unlockText(f)}</small>`;
    b.onclick = () => { S.school = f.id; audio.ui('tap'); openNewRun(); };
    sl.append(b);
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
$('nrGo').onclick = () => { audio.ui('tap'); beginRun({ fuse: S.fuse, rank: S.rank, school: S.school }); };

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
  // 点を伸ばす技: 名前・やり方・効き目・これまでの回数。まだなら「？？？」とヒント
  { const tq = DB.meta.tq || {}, got = TECHS.filter((t) => tq[t[0]]).length;
    const th = document.createElement('div'); th.className = 'bookhead'; th.textContent = tr(`点を伸ばす技 ${got} / ${TECHS.length}`, `Scoring techniques ${got} / ${TECHS.length}`); list.prepend(th);
    { const n = Math.max(0, Math.min(4, (mem().sky || 0) - 1)); if (n > 0) { const sk = document.createElement('div'); sk.className = 'bookhead skyword'; sk.textContent = tr('空の字　', 'Sky letters  ') + Mem.SKY_KANA.map((c, i) => (i < n ? c : '＿')).join(' '); th.before(sk); } }
    let after = th;
    for (const t of TECHS) { const n = tq[t[0]] || 0, e = document.createElement('div'); e.className = 'bookitem ach' + (n ? '' : ' locked');
      e.innerHTML = `<span class="seal">${n ? '技' : '・'}</span><div><b>${n ? (JA() ? t[1] : t[2]) : '？？？'}${n ? `<small class="cnt">${tr(`${n} 回`, `×${n}`)}</small>` : ''}</b>${tr('やり方：', 'How: ')}${JA() ? t[3] : t[4]}<br>${tr('効き目：', 'Effect: ')}${JA() ? t[5] : t[6]}</div>`;
      after.after(e); after = e; } }
  // 技帳: 妖怪ごとの技と、取った回数 / 挑んだ回数
  const sp = DB.meta.spells || {};
  const sh = document.createElement('div'); sh.className = 'bookhead'; sh.textContent = tr(`技帳 ${Object.values(sp).filter((x) => x.g > 0).length} / 24`, `Techniques ${Object.values(sp).filter((x) => x.g > 0).length} / 24`); list.append(sh);
  for (const [rule, arr] of Object.entries(G.SPELLS)) {
    const r = Run.RULES[rule];
    arr.forEach(([ja, en], i) => {
      const rec = sp[`${rule}${i}`], seen = !!rec, e = document.createElement('div'); e.className = 'bookitem ach' + (rec?.g ? '' : ' locked');
      e.innerHTML = `<span class="seal">${rec?.g ? '技' : '・'}</span><div><b>${seen ? (JA() ? `${r.ja}「${ja}」` : `${r.en} "${en}"`) : '？？？'}</b>${i === 3 ? tr('奥義 ', 'Secret art ') : ''}${seen ? tr(`取った ${rec.g} / 挑んだ ${rec.t}`, `Captured ${rec.g} / ${rec.t}`) : tr('まだ見ていない', 'Not seen yet')}</div>`;
      list.append(e);
    });
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
  S.run = Run.newRun({ fuse: o.fuse || 'asa', rank: o.rank || 0, seed: o.seed, school: o.daily ? 'hon' : (o.school || q.get('school') || 'hon') });
  S.daily = !!o.daily; S.run.daily = S.daily;
  // 練習の周: 初めの 2 周（今日の祭りは除く）
  S.run.assist = !S.daily && (DB.meta.runs || 0) < 2 ? 1 : 0;
  S.run.grand = 1; // 大仕掛けの夜がある周（2026-11-17〜）
  S.run.rv = 5; // 決まりの版 2: 囲い / 3: 天の川の夜 / 4: 天の川と世界 2 の大一番（練習の周）の目標をゆるめた / 5: 練習の周の第 1〜3 夜は火が遅い
  logStart(S.run);
  PF.ev('run_start', { runs: DB.meta.runs || 0, daily: S.daily ? 1 : 0, assist: S.run.assist });
  track(S.daily ? 'run/daily' : 'run/start');
  DB.run = S.run; save();
  startNight();
}
function startDaily() {
  const d = new Date(); const key = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  beginRun({ seed: key, daily: true });
}
$('playBtn').onclick = () => {
  audio.unlock(); audio.ui('tap');
  if (DB.run) { S.run = Run.fixRun(DB.run); resumeRun(); } else beginRun();
};
// 屋台でやめていたら、同じ屋台を開き直す（前の夜の結果の欄は「続きから」だけ）
function reopenShop() {
  const run = S.run, k = run.shopState;
  S.mode = 'inter'; show('inter'); $('hud').classList.add('hidden'); hideTip();
  S.sh = k.sh; S.route = k.route || Run.routeChoices(run); S.routeSel = k.sel || 0; S.giftInShop = !!k.gift; S.toraLine = k.tora || ''; S.shopBought = !!k.bought; S.shopNudged = !!k.nudged; S.mapPeek = null; S.rec = null;
  $('resTitle').textContent = tr(`第 ${run.night} 夜のあと（続きから）`, `After night ${run.night} (continued)`);
  $('resStars').innerHTML = ''; $('resScore').textContent = ''; $('ledger').innerHTML = ''; $('techSum') && ($('techSum').innerHTML = '');
  $('purse').textContent = run.coins; $('shopTitle').textContent = tr('屋台', 'Festival Stalls'); $('toraSay').textContent = S.toraLine;
  const nk = $('neko'), ng = nk.getContext('2d'); ng.clearRect(0, 0, nk.width, nk.height);
  try { drawCast(ng, 'neko', 70, 76, 96, { face: 'joy', still: true, glow: false }); } catch { /* 絵が無くても遊べる */ }
  renderShop(); $('nextBtn').textContent = nextLabel(); $('shopQuit').textContent = tr('やめる（保存）', 'Quit (saved)'); audio.scene('calm');
}
// 夜の途中で（一筆でも引いたあとに）ページを閉じた・タイトルへ戻ったなら、それを覚えている
function resumeRun() {
  const run = S.run, was = run.inNight;
  // 屋台の途中で閉じていたら、その夜は越えたことにして次へ（ごほうびを二度もらわない）
  if (run.shopAt && run.shopAt === `${run.world}-${run.night}` && run.shopState?.sh) return reopenShop();
  if (run.shopAt && run.shopAt === `${run.world}-${run.night}`) {
    logOp('x'); const res = Run.advance(run); DB.run = run; save();
    if (res === 'won') return runOver(true);
    return res === 'world' ? openSenko() : startNight();
  }
  if (!was || !was.used) return startNight();
  if (was.ev && was.snap && (was.W < was.H) === (W < H)) {
    try {
      const snap = JSON.parse(JSON.stringify(was.snap)), def = Run.nightDef(snap, was.w, was.n);
      const st = resumeNight(def, was.W, was.H, snap, was.ev, 1, S.log ? (S.log.dn ? 1 : 0) : 1);
      if (st && st.phase !== 'over') { track('mem/resume'); return startNight({ def, st, W: was.W, H: was.H, snap: was.snap, ev: was.ev.map((e) => [e[0] / 60, ...e.slice(1)]) }); }
    } catch (e) { console.warn('resume', e); }
  }
  const m = mem(); m.left++; m.lastLeftAt = Date.now();
  const line = Mem.leftLine(m, run.lives);
  if (line.take) run.lives--;
  logOp('L', line.take ? 1 : 0);
  run.inNight = null; DB.run = run; save(); achCheck({});
  track('mem/left');
  showTalk(tr('ねこ屋のトラ', 'Tora the cat'), 'neko', line.take ? 'sad' : 'joy', JA() ? line.ja : line.en, startNight);
}

// ------------------------------------------------------------------ 夜
function startNight(resume = null) {
  const run = S.run, def = resume ? resume.def : Run.nightDef(run, +(q.get('w') || run.world), +(q.get('n') || run.night));
  if (q.get('twist')) def.twist = q.get('twist');
  if (q.get('intrude')) def.intrude = q.get('intrude');
  const W2 = Run.worldOf(def.world);
  setTheme(W2.theme);
  S.st = resume ? resume.st : G.newNight(def, W, H, Run.loadoutFor(run)); ihenReset();
  S.rec = resume ? { def, W: resume.W, H: resume.H, run: resume.snap, ev: resume.ev } : { def, W, H, run: JSON.parse(JSON.stringify({ ...run, inNight: null })), ev: [] }; // 屋台の「試し打ち」用
  S.growBefore = { ...(run.grow || {}) };
  if (!resume) { run.inNight = { w: def.world, n: def.night, used: 0 }; DB.run = run; save(); }
  $('float').replaceChildren();
  S.mode = 'play'; S.crossed = false; S.seq = []; S.endAfterCount = false; R.zoom = 1; S.timeScale = 1; S.hint = 0; S.shown = 0; S.cnt = null;
  PF.start(); PF.level('started', def.world, def.night);
  S.nightT0 = performance.now();
  S.pan = 0; S.panY = 0; S.drag = null; S.panIntro = def.grand && !resume ? 2.4 : 0;
  { const wr = ((def.world - 1) % 3) + 1, hq = !def.endless && wr === 3 && def.night === 5 && lore() >= 2; document.body.classList.toggle('hudq', hq);
    if (hq && !resume) setTimeout(() => banner(`${tr('札隠し', 'NUMBERS HIDDEN')}<small>${tr('今夜は、数が見えない。……数えなくても、わかるはず', 'Tonight the numbers hide. ...You can feel it without counting.')}</small>`, 58, 2600), 900); }
  if (!resume) { if (def.rule) { const st0 = S.st; clearTimeout(S.ncD); S.ncD = setTimeout(() => { if (S.st === st0) nightCard(def); }, 4400); } else nightCard(def); } /* 大一番は静かな間と名前のあとに */
  PF.ev('night_start', { idx: (def.world - 1) * 8 + def.night, world: def.world, night: def.night, boss: def.boss ? 1 : 0, retry: S.run.retry || 0, target: def.target, assist: S.run.assist ? 1 : 0 });
  show('none'); $('hud').classList.remove('hidden');
  $('nWorld').textContent = (JA() ? W2.ja : W2.en) + (def.endless ? tr(`・千秋楽 ${def.world - Run.WORLDS.length} 巡`, ` · Encore ${def.world - Run.WORLDS.length}`) : '');
  $('nName').textContent = tr(`第 ${def.night} 夜`, `Night ${def.night}`);
  { const wr = ((def.world - 1) % 3) + 1, tot = (mem().nights || 0) + 1;
    if (!resume && !def.endless && wr === 1 && def.night === 1 && (DB.meta.runs || 0) >= 1) { $('nName').textContent = tr(`第 ${tot} 夜`, `Night ${tot}`); setTimeout(() => { if (S.st?.level === def) { $('nName').firstChild.textContent = tr(`第 ${def.night} 夜`, `Night ${def.night}`); } }, 700); }
    if (!def.endless && wr === 3 && def.night === 7 && lore() >= 2) { $('nName').textContent = tr(`第 ${tot} 夜`, `Night ${tot}`); const g = document.createElement('i'); g.className = 'goal'; g.textContent = tr('大一番まで あと ？ 夜', 'Boss in ?'); $('nName').append(g); S.noGoal = 1; } else S.noGoal = 0; }
  { const nb = def.night < 4 ? 4 : def.night < 8 ? 8 : 0; if (nb && !def.endless && !S.noGoal) { const g = document.createElement('i'); g.className = 'goal'; g.textContent = def.rule ? tr('今夜は大一番', 'Boss night') : tr(`大一番まで あと ${nb - def.night} 夜`, `Boss in ${nb - def.night}`); $('nName').append(g); } }
  $('gTarget').textContent = fmt(def.target);
  $('combo').classList.remove('on'); $('heat').className = 'heat';
  renderStrokes(); renderBags();
  if (!resume) { G.stageRise(S.st); S.st.shells.forEach((s) => launchFor(s)); } else { S.shown = S.st.score; $('gScore').textContent = fmt(S.st.score); }
  renderLives(); renderStreak(false); renderTech(); renderEngi();
  $('cLabP').textContent = tr('点', 'POINTS'); $('cLabM').textContent = tr('倍率', 'MULT');
  // まだ教えていない数字は出さない（星屑・かすりは 5 夜目、小判は初めての屋台のあと）
  $('hud').classList.toggle('noTech', !DB.meta.taught.dust); $('hud').classList.toggle('noCoins', !DB.meta.taught.shop);
  $('spellBar').className = 'spellbar off'; S.dustAcc = 0; S.dustAt = 0; S.dustSnd = 0;
  const tw = def.twist && Run.TWISTS[def.twist];
  const nodeT = ['shoubu', 'chaya', 'tonya', 'ennichi'].includes(def.node) ? Run.NODES[def.node] : null;
  $('twistTag').textContent = [tw ? (JA() ? tw.ja : tw.en) : '', nodeT ? (JA() ? nodeT.ja : nodeT.en) : '', ...(def.seals || []).map((x) => (JA() ? Run.SEALS[x].ja : Run.SEALS[x].en))].filter(Boolean).join(' ・ ');
  const zl = $('zoneLabels'); zl.innerHTML = '';
  for (const z of S.st.zones) { const e = document.createElement('div'); e.className = 'zl ' + z.kind; e.innerHTML = z.kind === 'oil' ? tr('油<small>火が速い・点 ×3</small>', 'OIL<small>fast flame, POINTS ×3</small>') : tr('水<small>火が遅い</small>', 'WATER<small>slow flame</small>'); e.style.left = (z.x / W) * 100 + '%'; e.style.top = (z.y / H) * 100 + '%'; zl.append(e); }
  // 大一番
  const boss = $('boss');
  if (def.rule) {
    const r = Run.RULES[def.rule];
    drawBoss(r.cast, 'taunt'); boss.classList.remove('hidden'); boss.classList.add('taunt');
    let taunt = Mem.bossTaunt(mem(), def.rule, run);
    const lost = (mem().bossLost || {})[def.rule] || 0, wr = ((def.world - 1) % 3) + 1;
    if (!def.endless && wr === 1 && def.night === 4 && lore() < 1) { taunt = { ja: Mem.STORY.boss14[0], en: Mem.STORY.boss14[1] }; loreUp(1); renderLives(); }
    else if (!def.endless && wr === 3 && def.night === 8 && lore() >= 3) taunt = { ja: `${(DB.meta.runs || 0) + 1} 度目の夏だな、灯。迎え火の主が待っている。`, en: `Your summer number ${(DB.meta.runs || 0) + 1}, Akari. The keeper of the welcoming fire is waiting.` };
    else if (lost >= 1) taunt = { ja: `わたしに ${lost} 度敗れて、まだ来るのね。`, en: `You fell to me ${lost} times, and still you come.` };
    const seals = (def.seals || []).map((x) => `<br><span class="seal">${tr('封じ', 'Seal')}「${JA() ? Run.SEALS[x].ja : Run.SEALS[x].en}」${JA() ? Run.SEALS[x].dj : Run.SEALS[x].de}</span>`).join('');
    // 演出の強弱: 静かな間（暗く・曲を引く）→ 一打と揺れで名前を叩きつける
    const st0 = S.st, slam = () => { document.body.classList.remove('veil'); if (S.st !== st0) return; /* 間のうちに夜を出たら名前は出さない */ audio.boom(1.9, 0); R.shake = Math.max(R.shake, 14); R.flash = Math.max(R.flash, 0.25);
      banner(`${JA() ? r.ja : r.en}<small>${JA() ? r.dj : r.de}${seals}${taunt ? `<br>「${JA() ? taunt.ja : taunt.en}」` : ''}</small>`, 62, taunt || seals ? 3600 : 2600); };
    if (resume) slam(); else { document.body.classList.add('veil'); audio.duck(1.3, 0.12); audio.note(0, { vol: 0.12, dur: 0.9 }); setTimeout(slam, 900); }
  } else {
    boss.classList.add('hidden');
    if (nodeT) banner(`${JA() ? nodeT.ja : nodeT.en}<small>${tw ? (JA() ? tw.ja : tw.en) + ' ・ ' : ''}${tr(`目標 ${fmt(def.target)}`, `Target ${fmt(def.target)}`)}<br>${JA() ? nodeT.dj : nodeT.de}</small>`, 60, 2400);
    else if (tw) banner(`${def.twistHide ? tr('今夜の正体は…', 'Tonight is…') + '<br>' : ''}${JA() ? tw.ja : tw.en}`, 64, 1500);
    else if (def.night === 1 && S.tveil) { /* 題名を重ねている */ }
    else if (def.night === 1) banner(`${JA() ? W2.ja : W2.en}<small>${tr(`第 1 夜 ― 目標 ${fmt(def.target)}`, `Night 1 — Target ${fmt(def.target)}`)}</small>`, 54, 2200);
    else banner(`${tr(`第 ${def.night} 夜`, `Night ${def.night}`)}<small>${tr(`目標 ${fmt(def.target)}`, `Target ${fmt(def.target)}`)}</small>`, 54, 1400);
  }
  teachFor(def);
  if (tw && $('teach').classList.contains('hidden')) { const el = $('teach'); el.innerHTML = `<em>${JA() ? tw.ja : tw.en}</em> ${JA() ? tw.dj : tw.de}`; el.classList.remove('hidden'); }
  audio.scene('calm');
}
function renderLives() { const r = S.run, el = $('lives'); el.dataset.name = lore() >= 1 ? tr('灯', 'Akari') : ''; el.innerHTML = ''; const max = Math.max(r.lives, r.rank >= 6 ? 1 : r.rank >= 4 ? 2 : 3); for (let i = 0; i < max; i++) { const b = document.createElement('i'); if (i >= r.lives) b.className = 'out'; el.append(b); } }
// 腕の欄: 星の値（星屑 1 粒の値）と、かすりの数
function renderTech(bumpPv) {
  const st = S.st; if (!st) return;
  $('tPv').textContent = fmtM(st.pv); $('tGrL').textContent = tr('かすり', 'Graze'); $('tGr').textContent = st.graze;
  $('tPv').previousElementSibling.textContent = tr('星屑の値', 'Dust value') + ' ';
  if (bumpPv) bump($('tPv').parentElement);
}
function renderStreak(up) { const n = S.st?.streak || 0, el = $('streak'); el.textContent = n > 0 ? tr(`連続満開 ${n}（次は ×${S.st.m.bloomX + Math.min(6, n)}）`, `Bloom streak ${n} (next ×${S.st.m.bloomX + Math.min(6, n)})`) : ''; if (up) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); } }
function drawBoss(id, face) {
  const c = $('boss'), g = c.getContext('2d'); g.clearRect(0, 0, 280, 280);
  try { drawCast(g, id, 140, 150, 190, { face, still: true, glow: true }); } catch { /* 絵が無くても遊べる */ }
}
// 教える順: 1 夜に 1 つ。数字は、教えてから出す
const TEACH = {
  draw: ['玉をなぞって<em>線を引こう</em>。線の始まりから<em>火が追いかけてくる</em>！', 'Drag through the shells. <em>The flame chases your line!</em>'],
  score: ['一筆の点は<em>「点 × 倍率」</em>。<em>金の玉</em>をひらくと倍率 +1', 'A stroke scores <em>POINTS × MULT</em>. <em>Gold shells</em> add +1 MULT'],
  heat: ['<em>火を引きつけろ</em>。近いほど熱く、点 ×2〜×4。熱いうちに<em>自分で離す</em>と見切り（倍率 +1）。追いつかれると点が半分', '<em>Let the flame get close</em>: hotter = POINTS ×2–×4. <em>Let go</em> while hot for a Close Call (+1 MULT). Get caught and you lose half'],
  bloom: ['一筆で<em>盤の玉を全部</em>ひらくと<em>満開</em>：倍率 ×2。続けて満開するほど ×3、×4…', 'Open <em>every shell in one stroke</em> for a <em>Full Bloom</em>: MULT ×2, then ×3, ×4 in a row'],
  shaku: ['<em>尺玉</em>は線の火でしかひらかない。妖怪は一筆ごとに<em>技</em>を出す：捕まらずに 6 割ひらけばボーナス', 'The <em>Grand Shell</em> only lights from your line. The yokai casts a <em>technique</em> each stroke: open 60% without being caught for a bonus'],
  dust: ['玉から<em>星屑</em>がこぼれる。筆先でふれて拾え。火のすぐ前を<em>かすめる</em>ほど、星屑の値が上がる', 'Shells drop <em>star dust</em>: touch it with your brush. <em>Graze</em> the flame to raise its value'],
  loop: ['線で<em>輪</em>を作って玉を囲むと、火が輪を閉じたとき中の玉が<em>一斉にひらく</em>（3 つ以上で倍率 +1）', 'Loop your line around shells: when the fire closes the loop they <em>all open at once</em> (3+ = +1 MULT)'],
  tsugi: ['筆を離した所に<em>輪</em>が残る。輪の中から次の一筆を始めると<em>継ぎ火</em>：倍率を持ちこめる', 'Where you let go, a <em>ring</em> stays. Start your next stroke inside it to <em>Relight</em> and carry your MULT'],
  flame: ['火は<em>曲がり角で遅く</em>なり、<em>玉がはじけると跳ねる</em>', 'The flame <em>slows at corners</em> and <em>jumps when shells burst</em>'],
  gust: ['<em>白い輪</em>は突風の合図。先へ逃げろ！', 'A <em>white ring</em> means a gust is coming. Get ahead!'],
  kin: ['<em>金の玉</em>は倍率 +1', '<em>Gold shells</em> add +1 MULT'],
  senrin: ['<em>千輪</em>は八方に火花を飛ばす', '<em>Crossettes</em> shoot sparks in 8 directions'],
  chouchin: ['<em>提灯玉</em>のあとにひらく玉は、点が 2 倍', 'After a <em>Lantern shell</em>, every shell scores double'],
  shime: ['<em>湿った玉</em>は線でふれるか、爆発 2 回', '<em>Wet shells</em> need your line, or two blasts'],
  koori: ['<em>氷玉</em>は線では燃えない。爆発でとかす', '<em>Ice shells</em> ignore your line. Melt them with a blast'],
  oni: ['<em>鬼玉</em>は線で払うと倍率 +3、爆風だと −2', '<em>Oni shells</em>: line = +3 MULT, blast = −2 MULT'],
};
// 夜ごとの教える番（def.id = 通しの夜の番号）。教えたらすぐ覚えたことにする（やり直しの夜でくり返さない）
const TEACH_ORDER = [['heat', 2], ['bloom', 3], ['shaku', 4], ['loop', 5], ['dust', 5], ['tsugi', 6], ['flame', 7]];
function showTeach(key) {
  const el = $('teach'), t = TEACH[key]; if (!t) return;
  el.innerHTML = JA() ? t[0] : t[1]; el.classList.remove('hidden'); S.teachKey = key;
  if (key !== 'draw') DB.meta.taught[key] = 1;
}
function teachFor(def) {
  const el = $('teach'); el.classList.add('hidden'); S.teachKey = null;
  const taught = DB.meta.taught = DB.meta.taught || {};
  const sc = Run.schoolOf(S.run?.school);
  if (sc.id !== 'hon' && def.id === 1 && def.world === 1) { el.innerHTML = `<em>${tr('流派', 'School')}「${JA() ? sc.ja : sc.en}」</em> ${JA() ? sc.dj : sc.de}`; el.classList.remove('hidden'); return; }
  if (!taught.draw) return showTeach('draw');
  for (const [k, n] of TEACH_ORDER) if (!taught[k] && def.id >= n && (k !== 'shaku' || def.boss) && (k !== 'loop' || (S.run?.rv || 1) >= 2)) return showTeach(k);
  for (const t of ['senrin', 'chouchin', 'shime', 'koori', 'oni']) if (!taught[t] && st0HasType(t)) return showTeach(t);
}
const st0HasType = (t) => !!S.st?.shells.some((s) => s.type === t);
function renderStrokes() {
  const st = S.st, el = $('strokes'); el.innerHTML = '';
  for (let i = 0; i < st.maxStrokes; i++) { const b = document.createElement('b'); if (i >= st.strokesLeft) b.className = 'used'; el.append(b); }
}
function bagEl(c, size = 84) {
  const d = document.createElement('div'); d.className = 'bag'; d.dataset.id = c.id;
  const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * 1.25); drawBag(cv, c); d.append(cv);
  const name = JA() ? c.ja : c.en;
  d.addEventListener('pointerenter', (e) => showTip(e, name, charmDesc(c))); d.addEventListener('pointerleave', hideTip);
  if (TIMES.has(c.id)) d.insertAdjacentHTML('beforeend', '<i class="xm">×</i>');
  return d;
}
// 縁起物: 狙いを決めている間だけ押せる。押すと効いて、なくなる
function renderEngi() {
  const el = $('engi'), run = S.run, st = S.st; el.innerHTML = '';
  if (!run?.engi?.length) return;
  run.engi.forEach((id, i) => {
    const E = G.ENGI[id]; if (!E) return;
    const b = document.createElement('button'); b.textContent = JA() ? E.ja : E.en; b.disabled = !st || st.phase !== 'aim';
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(e, JA() ? E.ja : E.en, (JA() ? E.dj : E.de) + tr('<br>狙いを決めている間に押す', '<br>Use while aiming')); });
    b.addEventListener('pointerleave', hideTip);
    b.onclick = (e) => {
      e.stopPropagation();
      if (!S.st || S.st.phase !== 'aim') { showTip(e, JA() ? E.ja : E.en, JA() ? E.dj : E.de); return; }
      if (G.useEngi(S.st, id)) { S.rec?.ev.push([S.st.t, 'e', id]); run.engi.splice(i, 1); hideTip(); DB.run = run; save(); renderEngi(); renderStrokes(); }
    };
    el.append(b);
  });
}
function renderBags() {
  const el = $('bags'); el.innerHTML = '';
  for (const id of S.run.charms) { const c = CHARM_BY_ID[id]; if (c) el.append(bagEl(c)); }
  $('hudCoins').innerHTML = `<span class="coin"></span>${S.run.coins + (S.st?.coinsEarned || 0)}`;
}
// お守りの説明 + いまの育ち（育つお守り）
function charmDesc(c, grow = S.run?.grow) {
  const g = growText(c, (S.st?.grow || grow || {})[c.id], JA());
  return (JA() ? c.dj : c.de) + (g ? `<br><b class="gr">${g}</b>` : '') + (TIMES.has(c.id) ? tr('<br><small>×倍率のお守り。右に置くほど強い（左から順に効く）</small>', '<br><small>A ×MULT charm: stronger further right (charms trigger left to right)</small>') : '');
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
  got.forEach((a, i) => setTimeout(() => achToast(a), 500 + i * 2000)); // 1 枚ずつ（重ねない）
  return got;
}
function achToast(a) {
  const e = document.createElement('div'); e.className = 'achtoast';
  e.innerHTML = `<small>${tr('実績', 'Achievement')}</small><b>${JA() ? a.ja : a.en}</b>`;
  document.body.append(e); audio.note(17, { vol: 0.15, dur: 0.5 }); setTimeout(() => audio.note(20, { vol: 0.14, dur: 0.6 }), 90);
  setTimeout(() => e.remove(), 1900);
}
function nightEnded() {
  const st = S.st, run = S.run, def = st.level;
  hideTip(); PF.stop(); $('teach').classList.add('hidden'); ihenReset(); document.body.classList.remove('hudq', 'veil'); hideVeil();
  $('combo').classList.remove('on'); $('heat').className = 'heat'; // 一筆の箱を夜のあとに残さない
  S.cnt = null; S.endAfterCount = false; S.shown = st.score; $('gScore').textContent = fmt(st.score); S.goalEl?.classList.remove('counting');
  if (st.cleared && (def.boss || G.starsFor(st) === 3)) PF.happy();
  if (S.rec) logOp('n', S.rec.W, S.rec.H, S.rec.ev.map((e) => [Math.round(e[0] * 60), ...e.slice(1)]), st.score);
  const m = mem(); m.graze += st.graze; m.dust += st.dustGot; m.lastPlay = Date.now();
  if (S.teachKey === 'draw' && st.cleared) DB.meta.taught.draw = 1;
  // 届かなかった夜は「あと何点だったか」を見せる（悔しさが次の一回を呼ぶ）
  S.miss = !st.cleared && st.score < st.target ? { n: st.target - st.score, pct: Math.floor((st.score / st.target) * 100) } : null;
  const R2 = Run.settleNight(run, st, def), res = R2.res;
  { const m = mem(); if (res === 'clear') m.nights = (m.nights || 0) + 1; if (def.boss && def.rule && res !== 'clear') { m.bossLost ||= {}; m.bossLost[def.rule] = (m.bossLost[def.rule] || 0) + 1; const rr = Run.RULES[def.rule]; m.lastBoss = { ja: rr.ja, en: rr.en, n: m.bossLost[def.rule] }; } }
  PF.ev('night_end', { idx: (def.world - 1) * 8 + def.night, boss: def.boss ? 1 : 0, res, pct: Math.floor((st.score / Math.max(1, def.target)) * 100), sec: Math.round((performance.now() - (S.nightT0 || performance.now())) / 1000), strokes: st.strokesUsed || 0, caught: st.caughtCount || 0, lives: run.lives, assist: run.assist ? 1 : 0 });
  PF.level(res === 'clear' ? 'completed' : 'failed', def.world, def.night); if (res === 'clear' && def.boss) PF.milestone();
  logSave();
  if (def.boss && (res === 'over' || res === 'retry')) track(`boss/${bossKey(def)}/lose`);
  if (res === 'over') { achCheck({ stars: 0 }); if (PF.rewardedOk && !run.revived && !run.endless) return offerRevive(); return runOver(false); }
  if (res === 'retry') { achCheck({ stars: 0 }); return retryNight(); }
  if (def.boss) track(`boss/${bossKey(def)}/win`);
  const stars = R2.stars, rw = R2.rw, interest = R2.interest, gain = R2.gain;
  if (R2.engi) S.gotEngi = R2.engi;
  achCheck({ stars });
  DB.meta.taught.draw = 1;
  // 屋台: ふつうの品・買い戻し・大勝負のほうび・縁日の取り引き（手続きは run.js。確かめ役も同じものを通る）
  S.sh = Run.openShop(run, Run.unlockedCharms(DB.meta)); S.giftInShop = false;
  const sl = Mem.shopLine(mem(), run, { buyBack: !!S.sh.back, ext: run.lastExt > 0, waited: st.waited > 0 });
  S.toraLine = sl ? (JA() ? sl.ja : sl.en) : '';
  { const wr = ((def.world - 1) % 3) + 1;
    if (!def.endless && wr === 1 && def.night === 2 && DB.meta.taught.shop && once('shop12')) /* はじめての屋台は買い方の一言を先に */ S.toraLine = story('shop12');
    if (S.hosei === 2 && once('hosei2')) { S.toraLine = story('hosei2'); loreUp(2); }
    if (S.hosei === 3 && once('hosei3')) S.toraLine = story('hosei3');
    S.hosei = 0; }
  S.route = Run.routeChoices(run); S.routeSel = 0; S.mapPeek = null;
  if ((DB.meta.runs || 0) < 2 && S.route.length > 1) { const risk = (c) => ({ shoubu: 3, nazo: 1, chaya: -1 }[c.node] || 0); S.route.forEach((c, i) => { if (risk(c) < risk(S.route[S.routeSel])) S.routeSel = i; }); }
  if (S.route.length && !DB.meta.taught.map) { DB.meta.taught.map = 1; S.toraLine = tr('道が分かれたよ。下の地図の丸を押して、次の夜をえらんでね。となりの道までしか移れないから、先の大一番まで見て決めて', 'The road forks! Tap a circle on the map below to pick your next night. You can only shift one lane at a time, so plan toward the boss'); }
  DB.run = run; save();
  // 大一番に勝った瞬間: すぐ屋台を出さず、止め・閃光・ゆっくりの大団円を 1.7 秒見せる
  if (def.boss) { S.mode = 'bosswin'; bossWin(def); setTimeout(() => { if (S.mode === 'bosswin') openInter(def, st, stars, rw, interest, gain); }, 1700); }
  else openInter(def, st, stars, rw, interest, gain);
}
function bossWin(def) {
  const r = def.rule && Run.RULES[def.rule];
  if (r) drawBoss(r.cast, 'sad');
  $('boss').classList.remove('taunt');
  const wr = ((def.world - 1) % 3) + 1; let line = '';
  if (!def.endless && wr === 1 && def.night === 8 && once('win18')) line = story('win18');
  if (!def.endless && wr === 2 && def.night === 8 && lore() >= 2 && once('win28')) { line = story('win28'); loreUp(3); }
  banner(tr('勝 利', 'VICTORY') + (line ? `<small>「${line}」</small>` : ''), 120, line ? 3200 : 1700);
  audio.duck(0.3, 0.4); audio.boom(2, 0); audio.ui('win'); audio.scene('finale', 0.2);
  S.stopT = 0.2; R.flash = 0.7; R.shake = 18; S.timeScale = 0.35; S.slowT = 1.4;
  for (let i = 0; i < 40; i++) {
    const t = 0.15 + i * 0.035 + Math.random() * 0.05, x = W * (0.06 + Math.random() * 0.88), y = H * (0.08 + Math.random() * 0.5);
    const type = SHELL_ORDER[Math.floor(Math.random() * 6)], kind = fx.kinds[Math.floor(Math.random() * 6)];
    S.seq.push({ at: t, f: () => { fx.burst(kind, x, y, 110 + Math.random() * 110, type, 1); if (i % 3 === 0) audio.boom(1, panOf(x)); } });
  }
}
// 夜を越えたあとの、結果と屋台
function openInter(def, st, stars, rw, interest, gain) {
  const run = S.run;
  // はじめての周の第 1 夜のあとは、結果と「次の夜へ」だけ（11/17: 第 1 夜を越えてすぐ帰る人が多い。15 秒遊んだだけで 6 品・引き直し・地図は重い）。屋台は第 2 夜のあとから
  const lite = (DB.meta.runs || 0) === 0 && !run.daily && def.world === 1 && def.night === 1 && !DB.meta.taught.shop; S.interLite = lite;
  S.mode = 'inter'; show('inter'); $('inter').classList.toggle('lite', lite); $('hud').classList.add('hidden'); hideTip(); if (!lite) DB.meta.taught.shop = 1;
  $('resTitle').textContent = def.boss ? tr('大一番、勝利！', 'Boss Defeated!') : tr(`第 ${def.night} 夜 大成功`, `Night ${def.night} Clear`);
  const sEl = $('resStars'); sEl.innerHTML = '<span>★</span><span>★</span><span>★</span>';
  [...sEl.children].forEach((c, i) => { if (i < stars) setTimeout(() => { c.classList.add('on'); audio.note(12 + i * 2, { vol: 0.18, dur: 0.5 }); }, 200 + i * 220); });
  $('resScore').textContent = fmt(st.score);
  renderTechSum(st);
  const rows = [[def.boss ? tr('大一番のごほうび', 'Boss bonus') : tr('今夜のごほうび', 'Night bonus'), rw.base], [tr('残った筆', 'Strokes left'), rw.left], [tr('星', 'Stars'), rw.star], [tr('お守りと玉', 'Charms & shells'), rw.earned], [tr('趣向の上乗せ', 'Twist bonus'), rw.twist], [tr('利息', 'Interest'), interest]].filter((r) => r[1] > 0);
  $('ledger').innerHTML = rows.map(([a, b], i) => `<div style="animation-delay:${0.1 + i * 0.09}s"><span>${a}</span><b>+${b}</b></div>`).join('');
  $('shopTitle').textContent = tr('屋台', 'Festival Stalls');
  S.shopBought = false; S.shopNudged = false;
  if (lite) S.toraLine = tr('おみごと！ 次はもっと大きく咲かせよう。屋台は次の夜のあとに開くよ', 'Nicely done! Go bigger next night. The stalls open after night 2.');
  if (!S.toraLine && !DB.meta.taught.buy) S.toraLine = tr('お守りを買うと点が伸びるよ。「+◯%」が大きい品が効く', 'Charms boost your score. Pick the biggest "+%"');
  $('toraSay').textContent = S.toraLine || '';
  const nk = $('neko'), ng = nk.getContext('2d'); ng.clearRect(0, 0, nk.width, nk.height);
  try { drawCast(ng, 'neko', 70, 76, 96, { face: 'joy', still: true, glow: false }); } catch { /* 絵が無くても遊べる */ }
  $('nextBtn').textContent = tr('次の夜へ', 'NEXT NIGHT'); $('shopQuit').textContent = tr('やめる（保存）', 'Quit (saved)');
  renderShop(); previewShop(); openGift(); PF.ad();
  countUp($('purse'), run.coins - gain, run.coins, 0.35 + rows.length * 0.09);
  audio.ui('win'); if (!def.boss) audio.scene('calm');
}
// 夜の腕前: かすり・星屑・見切り・継ぎ火・技。提灯が増えたら一番前に
function renderTechSum(st) {
  const run = S.run, n = st.spellLog?.length || 0, g = st.spellLog?.filter((x) => x.got).length || 0;
  const items = [
    run?.lastExt ? `<span class="ext">${tr(`灯 +${run.lastExt}！`, `+${run.lastExt} light!`)}</span>` : '',
    S.gotEngi ? `<span class="ext">${tr(`縁起物「${G.ENGI[S.gotEngi].ja}」を授かった`, `Talisman: ${G.ENGI[S.gotEngi].en}`)}</span>` : '',
    run?.lastBroken ? `<span>${tr(`硝子が ${run.lastBroken} つ割れた`, `${run.lastBroken} glass shattered`)}</span>` : '',
    run?.lastNodeGot === 'life' ? `<span class="ext">${tr('茶屋でひと休み：灯 +1', 'Teahouse rest: +1 light')}</span>` : run?.lastNodeGot === 'coin' ? `<span class="ext">${tr('茶屋でひと休み：小判 +4', 'Teahouse rest: +4 coins')}</span>` : '',
    run?.lastNode === 'shoubu' ? `<span class="ext">${tr('大勝負に勝った！', 'High stakes won!')}</span>` : '',
    ...(run ? run.charms.filter((id) => CHARM_BY_ID[id]?.now && (run.grow?.[id] || 0) !== (S.growBefore?.[id] || 0)).map((id) => `<span class="grw">${JA() ? CHARM_BY_ID[id].ja : CHARM_BY_ID[id].en} ${tr('が育った', 'grew')}<b>${growText(CHARM_BY_ID[id], run.grow[id], JA())}</b></span>`) : []),
    DB.meta.taught.dust ? `<span>${tr('星屑の値', 'Dust value')}<b>${fmtM(st.pv)}</b></span>` : '',
    st.graze && DB.meta.taught.dust ? `<span>${tr('かすり', 'Graze')}<b>${st.graze}</b></span>` : '',
    st.dustGot && DB.meta.taught.dust ? `<span>${tr('星屑', 'Dust')}<b>${st.dustGot}${tr(' 粒', '')}</b>（${fmt(st.dustScore || 0)}${tr(' 点', ' pts')}）</span>` : '',
    st.mikiri ? `<span>${tr('見切り', 'Close calls')}<b>${st.mikiri}</b></span>` : '',
    st.tsugiBest ? `<span>${tr('継ぎ火', 'Relight')}<b>${st.tsugiBest}${tr(' 連', '×')}</b></span>` : '',
    n ? `<span>${tr('技', 'Techniques')}<b>${g} / ${n}</b></span>` : '',
  ].filter(Boolean);
  S.gotEngi = null;
  $('techSum').innerHTML = items.map((x, i) => x.replace('<span', `<span style="animation-delay:${0.15 + i * 0.07}s"`)).join('');
}
// 小判を 0.6 秒で数え上げる（帳面の行が出そろうのに合わせて始める）
function countUp(el, from, to, delay = 0) {
  if (to <= from) { el.textContent = to; return; }
  const t0 = performance.now() + delay * 1000, dur = 600; let k = -1, wrote = String(from);
  el.textContent = wrote;
  const go = (now) => {
    if (el.textContent !== wrote) return; // ほかの所が書きかえたら止める（買い物・売り）
    const u = Math.max(0, Math.min(1, (now - t0) / dur)), s = Math.floor(u * 10);
    if (now >= t0 && s > k) { k = s; wrote = String(Math.round(from + (to - from) * s / 10)); el.textContent = wrote; if (s < 10) audio.note(10 + s, { vol: 0.06, dur: 0.07 }); }
    if (u < 1) requestAnimationFrame(go);
  };
  requestAnimationFrame(go);
}
const bossKey = (def) => String((def.rule && (def.rule.id || def.rule)) || 'boss');
// 負けた夜を見て、次に効くひと言を選ぶ
function lossHint() {
  const st = S.st; if (!st) return '';
  if (st.caughtCount >= 2) return tr('追いつかれた一筆は点が半分。熱いうちに自分で離せば「見切り」で倍率 +1', 'Caught strokes score half. Let go while it\'s hot for a Close Call: +1 MULT');
  if ((st.topHeat || 0) < 1) return tr('火を引きつけるほど熱くなり、点が ×2〜×4 になる', 'Let the flame get close: hotter means POINTS ×2 to ×4');
  if (!st.blooms) return tr('一筆で盤の玉を全部ひらくと「満開」で倍率 ×2', 'Open every shell in one stroke for a Full Bloom: MULT ×2');
  return tr('金の玉（倍率 +1）を一筆の中で先に通すと伸びる', 'Thread gold shells (+1 MULT) early in a stroke');
}
// 灯が尽きた: 広告を見れば灯をひとつ取り戻して、この夜をもう一度（1 周に 1 回）。見なければ、いつもの終わり
function offerRevive() {
  S.mode = 'revive'; audio.ui('lose'); hurt();
  const el = $('revive'), miss = S.miss ? tr(`あと ${fmt(S.miss.n)} 点だった（${S.miss.pct}%）`, `Just ${fmt(S.miss.n)} short (${S.miss.pct}%)`) : '';
  el.innerHTML = `<div class="gcard"><h3>${tr('灯が尽きた', 'Out of lights')}</h3>${miss ? `<p class="rvmiss">${miss}</p>` : ''}`
    + `<p>${tr('広告を見ると、灯をひとつ取り戻して<b>この夜をもう一度</b>。（1 周に 1 回）', 'Watch an ad to get a light back and <b>retry this night</b>. (Once per run)')}</p>`
    + `<div class="row"><button class="btn2" id="rvNo">${tr('ここまでにする', 'End run')}</button><button class="bigbtn small" id="rvYes">${tr('▶ 広告を見て続ける', '▶ Watch & continue')}</button></div><p class="rvmsg" id="rvMsg"></p></div>`;
  el.classList.remove('hidden');
  $('rvNo').onclick = () => { audio.ui('tap'); el.classList.add('hidden'); PF.ev('revive', { ok: 0, declined: 1 }); runOver(false); };
  $('rvYes').onclick = async () => {
    audio.ui('tap'); $('rvYes').disabled = true; $('rvNo').disabled = true; $('rvMsg').textContent = '';
    const ok = await PF.rewarded('revive');
    PF.ev('revive', { ok: ok ? 1 : 0 });
    if (S.mode !== 'revive') return;
    if (ok) { const run = S.run; run.lives = 1; run.retry++; run.revived = 1; el.classList.add('hidden'); track('run/revive'); retryNight(); return; }
    $('rvYes').disabled = false; $('rvNo').disabled = false; $('rvMsg').textContent = tr('広告を最後まで見られなかった。もう一度ためせます', 'The ad did not finish. You can try again.');
  };
}
// 失敗しても灯が残っていれば、同じ夜をもう一度（盤は変わる）
function retryNight() {
  S.mode = 'retry'; DB.run = S.run; save();
  renderLives();
  const miss = (S.miss ? tr(`あと ${fmt(S.miss.n)} 点だった（${S.miss.pct}%）`, `Just ${fmt(S.miss.n)} short (${S.miss.pct}%)`) + '<br>' : '') + (S.run.lastExt ? tr(`星屑で提灯 +${S.run.lastExt}`, `Star dust: +${S.run.lastExt} lantern`) + '<br>' : '');
  banner(`${tr('灯がひとつ消えた', 'A light goes out')}<small>${miss}${tr(`もう一度、この夜を。残り ${S.run.lives}`, `Try this night again. ${S.run.lives} left`)}<span class="hint">${lossHint()}</span></small>`, 56, 2400);
  audio.ui('lose'); hurt();
  // 待たせすぎない: 2.4 秒で自動（惜しさと一言を読める長さ）、0.6 秒すぎたら触れればすぐ
  S.retryAt = performance.now();
  setTimeout(() => { if (S.mode === 'retry') startNight(); }, 2400);
}
// 「前の夜なら +38%」。いちばん伸びる品には印
function pvTag(i) {
  const v = S.preview?.[i]; if (v === undefined) return '';
  const best = Math.max(...Object.values(S.preview)), pct = Math.round(v * 100);
  const cls = pct >= 1 ? 'up' : pct <= -1 ? 'down' : 'flat';
  return `<span class="pvt ${cls}${v === best && pct >= 5 ? ' best' : ''}">${pct >= 1 ? tr(`前の夜なら +${pct}%`, `Last night: +${pct}%`) : pct <= -1 ? tr(`前の夜なら ${pct}%`, `Last night: ${pct}%`) : tr('前の夜では 変わらず', 'Last night: no change')}</span>`;
}
function renderShop() {
  const run = S.run, wrap = $('cards'); wrap.innerHTML = ''; wrap.classList.toggle('many', S.sh.items.filter((x) => !x.gift || S.giftInShop).length > 6);
  $('purse').textContent = run.coins;
  S.sh.items.forEach((it, i) => {
    const b = document.createElement('button'); b.className = 'card';
    const can = it.cost <= run.coins && ((it.kind !== 'charm' && it.kind !== 'trade') || (run.charms.length < run.slots && !run.charms.includes(it.id)));
    if (it.gift && (S.sh.giftTaken || !S.giftInShop)) return;
    if (S.sh.sold.includes(i)) { b.classList.add('sold'); wrap.append(b); return; }
    if (it.cost > run.coins) b.classList.add('cant');
    if (it.kind === 'charm' || it.kind === 'trade') {
      const c = CHARM_BY_ID[it.id]; if (c.rar !== 'c') b.classList.add(c.rar);
      const art = document.createElement('div'); art.className = 'art'; const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; drawBag(cv, c); art.append(cv);
      b.innerHTML = it.back ? `<span class="tg back">${tr('買い戻し', 'Buy back')}</span>` : it.gift ? `<span class="tg gift">${tr('大勝負のほうび', 'Reward')}</span>` : it.kind === 'trade' ? `<span class="tg trade">${tr('縁日の取り引き', 'Fair trade')}</span>` : `<span class="tg" style="background:${TAG_COLOR[c.tag]}">${TAG_NAME[c.tag][JA() ? 0 : 1]}</span>`;
      if (it.gift) b.classList.add('gift'); if (it.kind === 'trade') { b.classList.add('trade'); if (run.lives < 2) b.classList.add('cant'); }
      if (TIMES.has(c.id)) b.insertAdjacentHTML('beforeend', '<span class="xm">×</span>');
      b.append(art);
      const g = growText(c, run.grow?.[c.id], JA());
      const price = it.kind === 'trade' ? `<span class="pr life">${tr('灯 1 つ', '1 light')}</span>` : it.gift ? `<span class="pr free">${tr('ただ', 'FREE')}</span>` : `<span class="pr"><i class="coin"></i>${it.cost}</span>`;
      b.insertAdjacentHTML('beforeend', `<span class="nm">${JA() ? c.ja : c.en}</span><span class="ds">${JA() ? c.dj : c.de}${g ? `<br><b class="gr">${g}</b>` : ''}${it.gift ? tr('<br><b>3 つから 1 つ</b>', '<br><b>Pick 1 of 3</b>') : ''}</span>${pvTag(i)}${price}`);
    } else if (it.kind === 'slot') {
      b.innerHTML = `<span class="tg" style="background:#5a4228">${tr('袋を広げる', 'Bigger bag')}</span><div class="art engiart">${tr('枠 +1', '+1 slot')}</div><span class="nm">${tr('お守りの枠 +1', '+1 charm slot')}</span><span class="ds">${tr(`持てるお守りが ${run.slots} → ${run.slots + 1} つに（${Run.MAX_SLOTS} まで）`, `Hold ${run.slots} → ${run.slots + 1} charms (max ${Run.MAX_SLOTS})`)}</span><span class="pr"><i class="coin"></i>${it.cost}</span>`;
    } else if (it.kind === 'engi') {
      const E = G.ENGI[it.id], full = (run.engi || []).length >= Run.ENGI_SLOTS;
      b.innerHTML = `<span class="tg engitag">${tr('縁起物', 'Talisman')}</span><div class="art engiart">${JA() ? E.ja : E.en}</div><span class="nm">${JA() ? E.ja : E.en}</span><span class="ds">${JA() ? E.dj : E.de}${tr('（使い切り）', ' (one use)')}${full ? tr('<br><b>2 つまで。いまは満杯</b>', '<br><b>Max 2 — full</b>') : ''}</span><span class="pr"><i class="coin"></i>${it.cost}</span>`;
      if (full) b.classList.add('cant');
    } else if (it.kind === 'add' || it.kind === 'thin' || it.kind === 'engrave') {
      const art = document.createElement('div'); art.className = 'art'; const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150;
      drawShellIcon(cv, it.kind === 'engrave' ? it.target : it.id); art.append(cv);
      const sn = (SHELL_NAME[it.kind === 'engrave' ? it.target : it.id] || ['', ''])[JA() ? 0 : 1], M = Run.MODS[it.id];
      const [tag, col, nm, ds] = it.kind === 'add' ? [tr('玉を足す', 'Add shell'), '#3a7a4a', sn, (SHELL_DESC[it.id] || ['', ''])[JA() ? 0 : 1]]
        : it.kind === 'thin' ? [tr('間引き', 'Thin out'), '#6a5a4a', tr('菊玉をひとつ抜く', 'Remove a Peony'), tr('袋が濃くなり、ほかの玉が出やすくなる', 'A denser bag: your other shells show up more')]
          : [tr('刻印', 'Engrave'), M.col, tr(`${sn}に「${M.ja}」`, `${M.en} on a ${sn}`), JA() ? M.dj : M.de];
      b.innerHTML = `<span class="tg" style="background:${col}">${tag}</span>`;
      if (it.kind === 'thin') cv.style.opacity = 0.45;
      b.append(art);
      if (it.kind === 'engrave') b.insertAdjacentHTML('beforeend', `<span class="mk" style="background:${M.col};color:${M.col}"></span>`);
      b.insertAdjacentHTML('beforeend', `<span class="nm">${nm}</span><span class="ds">${ds}</span><span class="pr"><i class="coin"></i>${it.cost}</span>`);
    } else {
      const art = document.createElement('div'); art.className = 'art'; const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; drawShellIcon(cv, it.id); art.append(cv);
      const lv = run.recipes[it.id] || 0, sn = SHELL_NAME[it.id][JA() ? 0 : 1];
      b.innerHTML = `<span class="tg" style="background:#4a4a58">${tr('秘伝', 'Recipe')}</span>`;
      b.append(art);
      b.insertAdjacentHTML('beforeend', `<span class="nm">${sn} Lv${lv + 1}</span><span class="ds">${it.id === 'kin' ? tr('金の玉の倍率 +1（いま +' + (1 + lv) + '）', 'Gold MULT +1 (now +' + (1 + lv) + ')') : tr(`この玉の点 +${Math.max(5, Math.round(G.SHELLS[it.id].pts * 0.5))}（いま ${G.SHELLS[it.id].pts + lv * Math.max(5, Math.round(G.SHELLS[it.id].pts * 0.5))}）`, `+${Math.max(5, Math.round(G.SHELLS[it.id].pts * 0.5))} POINTS (now ${G.SHELLS[it.id].pts + lv * Math.max(5, Math.round(G.SHELLS[it.id].pts * 0.5))})`)}</span>${pvTag(i)}<span class="pr"><i class="coin"></i>${it.cost}</span>`);
    }
    b.onclick = () => { if (it.cost > run.coins) { audio.note(1, { vol: 0.1, dur: 0.2 }); return; } if (it.kind === 'trade' && run.lives < 2) { toast(tr('灯が 2 つ以上いる', 'Needs 2+ lights')); return; } if ((it.kind === 'charm' || it.kind === 'trade') && run.charms.includes(it.id)) { toast(tr('もう持っている', 'Already held')); return; } if ((it.kind === 'charm' || it.kind === 'trade') && run.charms.length >= run.slots) { toast(tr('袋がいっぱい。売ってから', 'Bags full. Sell one first')); return; } if (it.kind === 'engi' && (run.engi || []).length >= Run.ENGI_SLOTS) { toast(tr('縁起物は 2 つまで', 'You can hold 2 talismans')); return; } buy(i); };
    wrap.append(b);
  });
  const rc = Run.rerollCost(run), rb = $('reroll');
  rb.textContent = tr(`引き直し  ${rc}`, `Reroll  ${rc}`); rb.disabled = rc > run.coins;
  renderHeld($('held'), true); renderPouch();
  renderMap();
  // 屋台でやめても同じ屋台から続けられるように（品は変わらない＝引き直しのずるにならない）
  run.shopState = { sh: S.sh, route: S.route, sel: S.routeSel || 0, gift: !!S.giftInShop, tora: S.toraLine || '', bought: !!S.shopBought, nudged: !!S.shopNudged };
  DB.run = run; save();
}
// ---- 祭りの地図: この世界の 8 夜。いまいる所・通った道・次に行ける寄り道。丸を押すと中身が読める
function renderMap() {
  const run = S.run, box = $('nextInfo'), nx = Run.nextCoord(run);
  if (!nx) { box.innerHTML = ''; return; }
  const w = nx[0], cols = Run.mapFor(run, w), same = w === run.world, done = same ? run.night : 0;
  const route = S.route || [], sel = route[S.routeSel || 0];
  const laneAt = (n) => (cols[n - 1].length === 1 ? 1 : run.plan?.[`${w}-${n}`]?.lane ?? null);
  const X = (n) => ((n - 0.5) / cols.length) * 100, Y = (col, x) => (col.length === 1 ? 50 : [18, 50, 82][x.lane]);
  const isChoice = (x) => x.n === done + 1 && (cols[x.n - 1].length === 1 || route.some((c) => c.lane === x.lane));
  let lines = '';
  for (let n = 1; n < cols.length; n++) for (const a of cols[n - 1]) for (const b of cols[n]) {
    if (!Run.linked(a, b, cols[n - 1], cols[n])) continue;
    const walked = n + 1 <= done && laneAt(n) === a.lane && laneAt(n + 1) === b.lane;
    const next = n === done && laneAt(n) === a.lane && isChoice(b);
    lines += `<line x1="${X(n)}" y1="${Y(cols[n - 1], a)}" x2="${X(n + 1)}" y2="${Y(cols[n], b)}" class="${walked ? 'walked' : next ? 'next' : ''}" />`;
  }
  const peek = S.mapPeek || (sel ? { n: sel.n, lane: sel.lane } : { n: done + 1, lane: 1 });
  let nodes = '';
  for (const col of cols) for (const x of col) {
    const N = Run.NODES[x.type], past = x.n <= done, here = x.n === done && laneAt(x.n) === x.lane, can = isChoice(x);
    const on = can && (col.length === 1 || (sel && sel.lane === x.lane)), pk = peek.n === x.n && (col.length === 1 || peek.lane === x.lane);
    const seal = x.type === 'boss' && Run.sealsFor(run, w, x.n).length ? '<i class="sl"></i>' : '';
    nodes += `<button class="fn${past ? ' past' : ''}${past && laneAt(x.n) === x.lane ? ' walked' : ''}${here ? ' here' : ''}${can ? ' can' : ''}${on ? ' on' : ''}${pk ? ' pk' : ''}" data-n="${x.n}" data-l="${x.lane}" style="left:${X(x.n)}%;top:${Y(col, x)}%;--c:${N.col}">${x.type === 'nazo' || !past || laneAt(x.n) === x.lane || col.length === 1 ? N.k : '・'}${seal}</button>`;
  }
  const W2 = Run.worldOf(w);
  box.innerHTML = `<div class="fmap"><div class="fmhead"><b>${JA() ? W2.ja : W2.en}</b>${route.length ? tr('　道をえらぶ（となりの道まで移れる）', '  Pick your road (one lane at a time)') : ''}</div><div class="fmbox"><svg viewBox="0 0 100 100" preserveAspectRatio="none">${lines}</svg>${nodes}</div><div class="fmdesc">${mapDesc(cols, w, peek)}</div></div>`;
  box.querySelectorAll('.fn').forEach((el) => {
    el.onclick = () => {
      const n = +el.dataset.n, lane = +el.dataset.l; S.mapPeek = { n, lane };
      const i = route.findIndex((c) => c.n === n && c.lane === lane); if (i >= 0) S.routeSel = i;
      audio.ui('tap'); renderMap(); $('nextBtn').textContent = nextLabel();
    };
  });
  $('nextBtn').textContent = nextLabel();
}
// 地図の丸の中身: 寄り道の名前・目標・ごほうび・趣向・大一番の封じ
function mapDesc(cols, w, peek) {
  const col = cols[peek.n - 1]; if (!col) return '';
  const x = col.length === 1 ? col[0] : col.find((y) => y.lane === peek.lane); if (!x) return '';
  const run = S.run, N = Run.NODES[x.type], key = `${w}-${x.n}`;
  const r2 = { ...run, retry: 0, plan: { ...run.plan, [key]: x.type === 'boss' || x.type === 'plain' ? run.plan?.[key] : { node: x.type, id: x.twist || null, coin: x.coin, hide: x.type === 'nazo', lane: x.lane } } };
  const def = Run.nightDef(r2, w, x.n), tw = x.twist && Run.TWISTS[x.twist];
  const parts = [`<b>${tr(`第 ${x.n} 夜`, `Night ${x.n}`)} ${JA() ? N.ja : N.en}</b>${tr(`目標 ${fmt(def.target)}`, `Target ${fmt(def.target)}`)}${x.coin ? tr(`・小判 +${x.coin}`, ` · +${x.coin} coins`) : ''}`];
  if (x.type === 'boss' && def.rule) { const r = Run.RULES[def.rule]; parts.push(`<em>${JA() ? r.ja : r.en}</em> ${JA() ? r.dj : r.de}`); for (const s of def.seals) parts.push(`<span class="seal">${tr('封じ', 'Seal')}「${JA() ? Run.SEALS[s].ja : Run.SEALS[s].en}」${JA() ? Run.SEALS[s].dj : Run.SEALS[s].de}</span>`); }
  else if (x.type !== 'plain') parts.push(JA() ? N.dj : N.de);
  if (tw && x.type !== 'nazo') parts.push(`<em>${JA() ? tw.ja : tw.en}</em> ${JA() ? tw.dj : tw.de}`);
  return parts.join('<br>');
}
function nextLabel() { const c = S.route?.[S.routeSel || 0]; return c ? tr(`次へ：${Run.NODES[c.node].ja}`, `Go: ${Run.NODES[c.node].en}`) : tr('次の夜へ', 'NEXT NIGHT'); }
// 大勝負のほうび: 屋台の前に「3 つから 1 つ」。枠がいっぱいなら、屋台で売ってから選べるように並べる
function openGift() {
  $('giftOv')?.remove();
  const run = S.run, gifts = S.sh.items.map((it, i) => [it, i]).filter(([it]) => it.gift);
  if (!gifts.length || S.sh.giftTaken || S.giftInShop) return;
  const full = run.charms.length >= run.slots;
  const ov = document.createElement('div'); ov.className = 'giftov'; ov.id = 'giftOv';
  ov.innerHTML = `<div class="giftpanel"><h3>${tr('大勝負のほうび', 'High Stakes Reward')}</h3><p>${full ? tr('お守りの枠がいっぱい。屋台で 1 つ売ってから選べる', 'Your charm slots are full. Sell one in the shop, then choose') : tr('珍しいお守りを 3 つから 1 つ、ただで', 'Take 1 of 3 rare charms, free')}</p><div class="cards"></div><div class="row"></div></div>`;
  const row = ov.querySelector('.row'), cards = ov.querySelector('.cards');
  for (const [it, i] of gifts) {
    const c = CHARM_BY_ID[it.id], b = document.createElement('button'); b.className = 'card gift ' + (c.rar !== 'c' ? c.rar : '');
    const cv = document.createElement('canvas'); cv.width = 120; cv.height = 150; drawBag(cv, c);
    b.innerHTML = `<span class="tg" style="background:${TAG_COLOR[c.tag]}">${TAG_NAME[c.tag][JA() ? 0 : 1]}</span>${TIMES.has(c.id) ? '<span class="xm">×</span>' : ''}`;
    const art = document.createElement('div'); art.className = 'art'; art.append(cv); b.append(art);
    b.insertAdjacentHTML('beforeend', `<span class="nm">${JA() ? c.ja : c.en}</span><span class="ds">${JA() ? c.dj : c.de}</span>${pvTag(i)}`);
    b.dataset.i = i;
    b.onclick = () => { if (full) { toast(tr('枠がいっぱい', 'Slots full')); return; } buy(i); ov.remove(); audio.ui('win'); };
    cards.append(b);
  }
  const later = document.createElement('button'); later.className = 'btn2';
  later.textContent = full ? tr('屋台で枠を空ける', 'Go free a slot') : tr('受け取らない', 'Skip');
  later.onclick = () => { audio.ui('tap'); if (full) S.giftInShop = true; else { S.sh.giftTaken = true; logOp('g'); } ov.remove(); renderShop(); };
  row.append(later);
  $('inter').append(ov);
}
// 試し打ちが出そろったら、ほうびの札にも出す
function refreshGiftTags() { const ov = $('giftOv'); if (!ov) return; ov.querySelectorAll('.card').forEach((b) => { b.querySelector('.pvt')?.remove(); b.querySelector('.ds').insertAdjacentHTML('afterend', pvTag(+b.dataset.i)); }); }
// 玉袋: 種類ごとの数と、刻印の色
function renderPouch() {
  const run = S.run, el = $('pouch'); if (!run?.pouch) { el.innerHTML = ''; return; }
  const groups = {};
  for (const x of run.pouch) { const g = groups[x.t] = groups[x.t] || { n: 0, mods: [] }; g.n++; if (x.m) g.mods.push(x.m); }
  el.innerHTML = `<h4>${tr(`玉袋 ${run.pouch.length}`, `Shell bag ${run.pouch.length}`)}</h4><div class="row"></div>`;
  const row = el.querySelector('.row');
  for (const [t, g] of Object.entries(groups)) {
    const d = document.createElement('span'); d.className = 'pi';
    const cv = document.createElement('canvas'); cv.width = 44; cv.height = 44; drawShellIcon(cv, t); d.append(cv);
    d.insertAdjacentHTML('beforeend', `<b>×${g.n}</b>${g.mods.map((m, i) => `<i style="background:${Run.MODS[m].col};left:${12 + i * 5}px"></i>`).join('')}`);
    const nm = (SHELL_NAME[t] || ['', ''])[JA() ? 0 : 1], ds = (SHELL_DESC[t] || ['', ''])[JA() ? 0 : 1];
    d.addEventListener('pointerenter', (e) => showTip(e, `${nm} ×${g.n}`, ds + (g.mods.length ? '<br>' + g.mods.map((m) => (JA() ? Run.MODS[m].ja : Run.MODS[m].en)).join('・') : '')));
    d.addEventListener('pointerleave', hideTip);
    row.append(d);
  }
}
// ---- 試し打ち: 前の夜と同じ筆の動きで、その品を持っていたら何点だったかを計算し直す（ルールは決定的なので再現できる）
function replayScore(rec, run) {
  const st = G.newNight({ ...rec.def, target: 1e15 }, rec.W, rec.H, Run.loadoutFor(run)); G.stageRise(st);
  const ev = rec.ev, end = (ev.length ? ev[ev.length - 1][0] : 0) + 12;
  let i = 0;
  for (let g = 0; g < 60 * 240 && st.phase !== 'over' && st.t < end; g++) {
    while (i < ev.length && ev[i][0] <= st.t + 1e-9) { const e = ev[i++]; if (e[1] === 'd') G.penDown(st, e[2], e[3]); else if (e[1] === 'm') G.penMove(st, e[2], e[3]); else if (e[1] === 'u') G.penUp(st); else if (e[1] === 'e') G.useEngi(st, e[2]); }
    G.step(st, G.DT); st.events.length = 0;
  }
  return G.liveScore(st);
}
function previewShop() {
  const rec = S.rec, token = (S.pvToken = (S.pvToken || 0) + 1);
  const cw = $('charmWork'); if (cw) cw.innerHTML = '';
  if (!rec || !rec.ev.some((e) => e[1] === 'd')) return;
  const owned = (rec.run.charms || []).filter((id) => CHARM_BY_ID[id]), work = {};
  S.preview = {};
  let base = null;
  const queue = S.sh.items.map((it, i) => [it, i]).filter(([it]) => it.kind === 'charm' || it.kind === 'recipe' || it.kind === 'trade');
  const step = () => {
    if (S.pvToken !== token || S.mode !== 'inter') return;
    if (base === null) { base = Math.max(1, replayScore(rec, rec.run)); setTimeout(step, 0); return; }
    if (owned.length) { const id = owned.shift(), r0 = JSON.parse(JSON.stringify(rec.run)); r0.charms = r0.charms.filter((x) => x !== id); work[id] = base - replayScore(rec, r0); if (!owned.length) renderCharmWork(work); setTimeout(step, 0); return; }
    const next = queue.shift(); if (!next) { renderShop(); refreshGiftTags(); return; }
    const [it, i] = next, r2 = JSON.parse(JSON.stringify(rec.run));
    if ((it.kind === 'charm' || it.kind === 'trade') && r2.charms.length >= r2.slots) r2.charms.shift();
    Run.applyItem(r2, it);
    S.preview[i] = (replayScore(rec, r2) - base) / base;
    setTimeout(step, 0);
  };
  setTimeout(step, 30);
}
// 「お守りの働き（この夜）」: 稼いだ点の多い順。効かなかったものも正直に出す
function renderCharmWork(work) {
  const el = $('charmWork'); if (!el || S.mode !== 'inter') return;
  const rows = Object.entries(work).sort((a, b) => b[1] - a[1]).map(([id, d]) => { const c = CHARM_BY_ID[id], v = Math.round(d);
    return `<div><span>${JA() ? c.ja : c.en}</span><b class="${v > 0 ? 'up' : 'flat'}">${v > 0 ? '+' + fmt(v) + tr(' 点', ' pts') : tr('効かず', 'no effect')}</b></div>`; });
  el.innerHTML = rows.length ? `<h4>${tr('お守りの働き（この夜）', 'What your charms earned tonight')}</h4>${rows.join('')}` : '';
}
function peekNext() { const r = S.run, n = Run.nextCoord(r); return n ? Run.nightDef(r, n[0], n[1]) : null; }
function renderHeld(el, sell) {
  el.innerHTML = '';
  for (let i = 0; i < S.run.slots; i++) {
    const id = S.run.charms[i], d = document.createElement('div'); d.className = 'slot';
    if (id) {
      const c = CHARM_BY_ID[id], cv = document.createElement('canvas'); cv.width = 84; cv.height = 105; drawBag(cv, c); d.append(cv);
      const price = Run.sellPrice(S.run, id);
      if (TIMES.has(id)) d.insertAdjacentHTML('beforeend', '<i class="xm">×</i>');
      const tip = (e, armed) => showTip(e, JA() ? c.ja : c.en, charmDesc(c) + (sell ? (armed ? tr(`<br><em>もう一度押すと ${price} 小判で売る</em>。‹ › で並べ替え（左から順に効く）`, `<br><em>Tap again to sell for ${price}</em>. ‹ › to reorder (left triggers first)`) : tr(`<br>2 回押すと ${price} 小判で売る`, `<br>Tap twice to sell for ${price}`)) : ''));
      if (sell) for (const [dir, ch] of [[-1, '‹'], [1, '›']]) {
        const j = i + dir; if (j < 0 || j >= S.run.charms.length) continue;
        const mv = document.createElement('button'); mv.className = 'mv ' + (dir < 0 ? 'l' : 'r'); mv.textContent = ch;
        mv.onclick = (e) => { e.stopPropagation(); Run.swapCharms(S.run, i, j); logOp('w', i, j); audio.ui('tap'); hideTip(); renderShop(); const nd = $('held').children[j]; nd?.classList.add('armed'); };
        d.append(mv);
      }
      d.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') tip(e, false); });
      d.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hideTip(); d.classList.remove('armed'); } });
      // 指でも説明が読めるように、1 回目は説明と「売る」の合図、2 回目で売る（1 回で売れると誤って手放す）
      d.onclick = (e) => {
        if (sell && d.classList.contains('armed')) { Run.sellCharm(S.run, i); logOp('s', i); mem().sold++; audio.note(8, { vol: 0.14, dur: 0.2 }); hideTip(); renderShop(); return; }
        el.querySelectorAll('.armed').forEach((o) => o.classList.remove('armed'));
        if (sell) d.classList.add('armed');
        tip(e, sell); audio.ui('tap');
      };
    }
    el.append(d);
  }
}
function buy(i) {
  const it = S.sh.items[i], run = S.run;
  if (Run.buyItem(S.sh, run, i)) return; // 買えない（同じお守りを 2 つ持たない・枠・小判）
  logOp('b', i); S.shopBought = true; DB.meta.taught.buy = 1;
  { const c = CHARM_BY_ID[it.id]; if (c && (it.kind === 'charm' || it.kind === 'trade')) { S.toraLine = tr(`「${c.ja}」を買った！ ${c.dj}。次の夜から効くよ`, `Got "${c.en}"! ${c.de}. It works from the next night.`); $('toraSay').textContent = S.toraLine; } }
  if (it.kind === 'trade') { renderLives(); toast(tr('灯をひとつ差し出した', 'You gave up a light')); }
  audio.note(14, { vol: 0.18, dur: 0.3 }); setTimeout(() => audio.note(17, { vol: 0.16, dur: 0.4 }), 70);
  hideTip(); renderShop();
}
$('reroll').onclick = () => { if (!Run.rerollShop(S.sh, S.run, Run.unlockedCharms(DB.meta))) return; logOp('r'); audio.ui('tap'); renderShop(); previewShop(); }; // 買い戻し・ほうびは引き直しても残す
$('shopQuit').onclick = () => { audio.ui('tap'); DB.run = S.run; save(); S.savedNote = 1; toTitle(); };
$('nextBtn').onclick = () => {
  audio.ui('tap');
  // 小判を余らせたまま素通りしがち。初めの 3 周は、買える品があれば 1 回だけ声をかけて、いちばん伸びる品を揺らす
  // 3 回続けて何も買わずに出ようとしたときだけ（毎回聞くのはうっとうしい）
  const noBuy = S.run.noBuy || 0;
  if (S.mode === 'inter' && !S.interLite && !S.shopBought && !S.shopNudged && noBuy % 3 === 2) {
    const run = S.run, can = S.sh.items.some((it) => !it.gift && it.cost <= run.coins && (it.kind !== 'trade') && (it.kind !== 'charm' || (run.charms.length < run.slots && !run.charms.includes(it.id))));
    if (can) {
      S.shopNudged = true;
      $('toraSay').textContent = tr(`小判が ${run.coins} 枚あるよ。買っていく？（もう一度押すと進む）`, `${run.coins} coins left. Buy a charm? (Tap again to go)`);
      const cards = [...$('cards').querySelectorAll('.card')], best = cards.find((c) => c.querySelector('.pvt.best')) || cards.find((c) => !c.classList.contains('cant'));
      if (best) { best.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); best.classList.remove('nudge'); void best.offsetWidth; best.classList.add('nudge'); }
      return;
    }
  }
  const pick = S.route && S.route.length ? S.route[S.routeSel || 0] : null;
  if (!S.interLite) S.run.noBuy = S.shopBought ? 0 : (S.run.noBuy || 0) + 1;
  PF.ev('shop_leave', { idx: (S.run.world - 1) * 8 + S.run.night, bought: S.shopBought ? 1 : 0, coins: S.run.coins, nudged: S.shopNudged ? 1 : 0, lite: S.interLite ? 1 : 0 }); S.interLite = false;
  if (pick) Run.chooseRoute(S.run, pick);
  logOp('a', pick ? pick.lane : -1);
  S.run.shopState = null;
  const res = Run.advance(S.run); logSave();
  if (res === 'won') return runOver(true);
  DB.run = S.run; save();
  if (res === 'world') openSenko(); else startNight();
};

// ------------------------------------------------------------------ 線香花火: 祭りと祭りのあいだの、静かなひととき
const SK = [
  { t: 0, ja: '蕾', en: 'Bud', coin: 0 }, { t: 2.2, ja: '牡丹', en: 'Peony', coin: 3 }, { t: 5, ja: '松葉', en: 'Pine Needles', coin: 6 },
  { t: 8.5, ja: '柳', en: 'Willow', coin: 10 }, { t: 12, ja: '散り菊', en: 'Falling Chrysanthemum', coin: 15 },
];
// ---- 幕間「一筆書きの儀」
const IP_FIGS = [
  { ja: '家', en: 'House', n: [[0, 0.35], [1, 0.35], [1, 1], [0, 1], [0.5, -0.25]], e: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3], [0, 4], [1, 4]] },
  { ja: '星', en: 'Star', n: [0, 1, 2, 3, 4].map((i) => [0.5 + 0.5 * Math.cos(-Math.PI / 2 + i * 1.2566), 0.5 + 0.5 * Math.sin(-Math.PI / 2 + i * 1.2566)]), e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 2], [2, 4], [4, 1], [1, 3], [3, 0]] },
  { ja: '蝶', en: 'Butterfly', n: [[0, 0], [0, 1], [0.5, 0.5], [1, 0], [1, 1]], e: [[0, 1], [1, 2], [2, 0], [3, 4], [4, 2], [2, 3], [0, 3]] },
];
function openIp() {
  const fig = IP_FIGS[((S.run.world || 2) - 2 + 30) % IP_FIGS.length];
  const deg = fig.n.map((_, i) => fig.e.filter((e) => e[0] === i || e[1] === i).length);
  S.ip = { fig, deg, used: [], cur: -1, path: [], len: 0, drawing: false, tries: 0, done: false, fireD: 0, t: 0, hint: false, pts: [] };
  $('teach').classList.add('hidden');
  const figName = fig.ja === '家' && (DB.meta.runs || 0) >= 2 ? tr('灯の家', 'Akari\'s House') : tr(fig.ja, fig.en);
  $('skName').textContent = tr(`一筆書きの儀「${figName}」`, `One-Stroke Rite: ${figName}`);
  $('skMsg').textContent = tr('点から書き始め、すべての線を一度ずつ、指を離さずになぞれ。始まりから火が追ってくる', 'Start on a dot and trace every line exactly once without lifting. Fire chases from the start.');
  $('skNext').textContent = tr('そのまま次の祭りへ', 'Skip to the next festival');
  ipLayout(); requestAnimationFrame(ipLayout); // 題の位置が決まってから
}
function ipLayout() {
  const k = S.ip; if (!k) return; const cv = $('ipCanvas'); cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  // 画面の上 10% から、題の上の端までに収める（図形ごとの縦横の広がりも見る）
  const top = innerHeight * 0.1, nameTop = $('skName').getBoundingClientRect().top, bottom = (nameTop > top + 120 ? nameTop : innerHeight * 0.66) - 28;
  const xs = k.fig.n.map((p) => p[0]), ys = k.fig.n.map((p) => p[1]), mnx = Math.min(...xs), mny = Math.min(...ys), w0 = Math.max(...xs) - mnx || 1, h0 = Math.max(...ys) - mny || 1;
  const sz = Math.min((innerWidth * 0.7) / w0, (bottom - top) / h0), x0 = innerWidth / 2 - (mnx + w0 / 2) * sz, y0 = top + (bottom - top - h0 * sz) / 2 - mny * sz;
  k.pts = k.fig.n.map(([u, v]) => [x0 + u * sz, y0 + v * sz]); k.sz = sz;
}
addEventListener('resize', () => { if (S.ip && !S.ip.drawing) ipLayout(); });
const ipToW = (x, y) => [(x / innerWidth) * W, (y / innerHeight) * H];
function ipEdge(a, b) { return S.ip.fig.e.findIndex((e) => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a)); }
function ipSegDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); }
function ipDown(e) {
  const k = S.ip; if (!k || k.done) return; audio.unlock();
  const j = k.pts.findIndex(([x, y]) => Math.hypot(x - e.clientX, y - e.clientY) < 36);
  if (j < 0) { $('skMsg').textContent = tr('点（光る丸）から書き始める', 'Start on a dot'); return; }
  k.drawing = true; k.cur = j; k.used = []; k.path = [[k.pts[j][0], k.pts[j][1]]]; k.len = 0; k.fireD = 0; k.t = 0;
  audio.note(10, { vol: 0.14, dur: 0.3 });
}
function ipMove(e) {
  const k = S.ip; if (!k || !k.drawing || k.done) return;
  const x = e.clientX, y = e.clientY, last = k.path[k.path.length - 1]; k.len += Math.hypot(x - last[0], y - last[1]); k.path.push([x, y]);
  // 図形から大きくはみ出したら失敗
  const near = Math.min(...k.fig.e.map(([a, b]) => ipSegDist(x, y, k.pts[a][0], k.pts[a][1], k.pts[b][0], k.pts[b][1])));
  if (near > Math.max(46, k.sz * 0.1)) return ipFail(tr('線をはみ出した', 'You left the lines'));
  for (let j = 0; j < k.pts.length; j++) {
    if (j === k.cur || Math.hypot(k.pts[j][0] - x, k.pts[j][1] - y) > 30) continue;
    const ei = ipEdge(k.cur, j); if (ei < 0) continue;
    if (k.used.includes(ei)) return ipFail(tr('同じ線は二度なぞれない', 'No line twice'));
    k.used.push(ei); k.cur = j; audio.note(12 + k.used.length, { vol: 0.15, dur: 0.35 });
    const [wx, wy] = ipToW(k.pts[j][0], k.pts[j][1]); fx.tick(wx, wy, [3, 2, 0.8], 24, 200);
    if (k.used.length === k.fig.e.length) return ipWin();
  }
}
function ipUp() { const k = S.ip; if (k && k.drawing && !k.done) ipFail(tr('指を離した', 'You lifted your finger')); }
function ipFail(why) {
  const k = S.ip; k.drawing = false; k.tries++; k.hint = true; audio.note(1, { vol: 0.14, dur: 0.5 }); hurt();
  if (k.tries >= 3) { k.done = true; return ipReward(3, tr(`${why}……。小判 +3`, `${why}... +3 coins`)); }
  const odd = k.deg.some((d) => d % 2);
  $('skMsg').textContent = `${why}。` + (odd ? tr('光る点は、線が奇数本あつまる所。一筆書きはそこから始まり、もう一方で終わる', 'Glowing dots meet an odd number of lines: a one-stroke path starts at one and ends at the other') : tr('どの点からでも書ける形。同じ点に戻ってくる', 'Any dot works here: you end where you began')) + tr(`（あと ${3 - k.tries} 回）`, ` (${3 - k.tries} left)`);
}
function ipWin() {
  const k = S.ip; k.drawing = false; k.done = true; techCall('hitofude');
  const got = [15, 10, 6][k.tries] ?? 6;
  // 書いた順に、辺が仕掛け花火になって弾ける
  k.used.forEach((ei, i) => setTimeout(() => { const [a, b] = k.fig.e[ei]; for (let s = 1; s <= 3; s++) { const u = s / 4, [wx, wy] = ipToW(k.pts[a][0] + (k.pts[b][0] - k.pts[a][0]) * u, k.pts[a][1] + (k.pts[b][1] - k.pts[a][1]) * u); fx.burst(i % 2 ? 'peony' : 'chrys', wx, wy, 70, i % 3 ? 'kiku' : 'kin', 1); } audio.boom(0.7, 0); }, 120 * i));
  setTimeout(() => { for (const [x, y] of k.pts) { const [wx, wy] = ipToW(x, y); fx.burst('ring', wx, wy, 120, 'kin', 2); } const [cx, cy] = ipToW(innerWidth / 2, innerHeight * 0.45); fx.burst('kamuro', cx, cy, 190, 'ootama', 1); audio.boom(2.4, 0); R.flash = 0.2; }, 120 * k.used.length + 200);
  ipReward(got, tr(`一筆書き、成る！ 小判 +${got}`, `One stroke complete! +${got} coins`) + (k.fig.ja === '家' ? `　${story('house')}` : ''));
}
function ipReward(got, msg) {
  S.run.coins += got; logOp('k', got); logSave(); DB.run = S.run; save(); achCheck({ stars: 0 });
  $('skMsg').textContent = msg; $('skNext').textContent = tr('次の祭りへ', 'On to the next festival'); if (got >= 6) audio.ui('win');
}
function ipFx(dt) {
  const k = S.ip, cv = $('ipCanvas'); if (!k || !cv) return; const g = cv.getContext('2d'), d = devicePixelRatio;
  g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, innerWidth, innerHeight); g.lineCap = 'round';
  // 追いかける火
  if (k.drawing) { k.t += dt; if (k.t > 1.4) { k.fireD += (150 + (k.t - 1.4) * 45) * dt; if (k.fireD >= k.len - 8 && k.len > 20) ipFail(tr('火に追いつかれた', 'The fire caught you')); } }
  k.fig.e.forEach(([a, b], i) => { const on = k.used.includes(i); g.strokeStyle = on ? '#ffb347' : '#f6cf7a66'; g.lineWidth = on ? 7 : 4; g.setLineDash(on ? [] : [8, 10]); g.beginPath(); g.moveTo(...k.pts[a]); g.lineTo(...k.pts[b]); g.stroke(); });
  g.setLineDash([]);
  if (k.path.length > 1 && !k.done) { g.strokeStyle = '#fff4d6aa'; g.lineWidth = 2; g.beginPath(); g.moveTo(...k.path[0]); for (const p of k.path) g.lineTo(...p); g.stroke(); }
  k.pts.forEach(([x, y], i) => { const odd = k.deg[i] % 2 === 1, glow = k.hint && (odd || !k.deg.some((v) => v % 2)); g.fillStyle = i === k.cur && k.drawing ? '#fff' : glow ? '#8ef0a0' : '#ffd27a'; g.beginPath(); g.arc(x, y, glow ? 12 + Math.sin(R.time * 6) * 3 : 10, 0, 7); g.fill(); });
  if (k.drawing && k.t > 1.4) { let acc = 0; for (let i = 1; i < k.path.length; i++) { const [ax, ay] = k.path[i - 1], [bx, by] = k.path[i], l = Math.hypot(bx - ax, by - ay); if (acc + l >= k.fireD) { const u = (k.fireD - acc) / (l || 1), fxp = ax + (bx - ax) * u, fyp = ay + (by - ay) * u; g.fillStyle = '#ff7a2a'; g.beginPath(); g.arc(fxp, fyp, 9, 0, 7); g.fill(); const [wx, wy] = ipToW(fxp, fyp); fx.add(wx, wy, (Math.random() - 0.5) * 60, -40 - Math.random() * 60, 0.4, 2.4, 1, 80, [3, 1.4, 0.3], [1, 0.3, 0.05], 1.3); break; } acc += l; } }
}
function openSenko() {
  if (!q.has('senko')) { S.mode = 'senko'; S.st = null; show('senko'); $('hud').classList.add('hidden'); S.sk = null; openIp(); audio.scene('calm'); return; } // 幕間は一筆書きの儀（?senko で前の線香花火）
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
  S.run.coins += got; logOp('k', got); logSave();
  DB.meta.senko = Math.max(DB.meta.senko || 0, fell ? 0 : st);
  achCheck({ stars: 0 });
  $('skMsg').textContent = (fell ? tr('ぽとり……。', 'It fell...') + ' ' : '') + tr(`小判 +${got}`, `+${got} coins`);
  $('skNext').textContent = tr('次の祭りへ', 'On to the next festival');
  DB.run = S.run; save();
  if (fell) audio.note(1, { vol: 0.14, dur: 0.5 }); else if (got) audio.ui('win');
}
function senkoFx(dt) {
  if (S.ip) return ipFx(dt);
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
$('senko').addEventListener('pointerdown', (e) => { if (e.target.id === 'skNext') return; if (S.ip) return ipDown(e); audio.unlock(); const k = S.sk; if (!k || k.done) return; k.held = true; k.px = e.clientX; k.py = e.clientY; try { $('senko').setPointerCapture(e.pointerId); } catch { /* 無くても動く */ } });
$('senko').addEventListener('pointermove', (e) => { if (S.ip) { for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) ipMove(ev); return; } const k = S.sk; if (!k || !k.held) return; k.shake += Math.hypot(e.clientX - k.px, e.clientY - k.py) * 0.004; k.px = e.clientX; k.py = e.clientY; });
const skUp = () => { const k = S.sk; if (k && k.held && !k.done) { if (k.stage >= 0) endSenko(false); else k.held = false; } };
$('senko').addEventListener('pointerup', () => (S.ip ? ipUp() : skUp())); $('senko').addEventListener('pointercancel', () => (S.ip ? ipUp() : skUp()));
$('skNext').onclick = () => { audio.ui('tap'); S.sk = null; S.ip = null; const cv = $('ipCanvas'); cv?.getContext('2d').clearRect(0, 0, cv.width, cv.height); startNight(); };

function runOver(won) {
  const run = S.run;
  S.mode = 'over'; show('over'); $('hud').classList.add('hidden'); $('teach').classList.add('hidden'); document.body.classList.remove('hudq');
  const meta = DB.meta, prevEnd = meta.mem?.lastEnd, prevBest = meta.best || 0, beforeSet = Run.unlockedCharms(meta), before = beforeSet.size, fuseBefore = Run.FUSES.filter((f) => Run.fuseOpen(f, meta)).length;
  const newBest = meta.runs > 0 && run.nightsCleared > (meta.best || 0);
  meta.runs = (meta.runs || 0) + 1; meta.xp = (meta.xp || 0) + Run.xpFor(run); meta.best = Math.max(meta.best || 0, run.nightsCleared);
  if (won) { meta.wins = (meta.wins || 0) + 1; meta.rankOpen = Math.max(meta.rankOpen || 0, run.rank + 1); }
  achCheck({ stars: 0 });
  const after = Run.unlockedCharms(meta).size, fuseAfter = Run.FUSES.filter((f) => Run.fuseOpen(f, meta)).length;
  const mercy = won && (run.waitedNights || 0) >= Mem.MERCY_NEED, ME = Mem.mercyEnding(mem());
  meta.mem.lastEnd = { nights: run.nightsCleared, won }; meta.mem.lastPlay = Date.now();
  if (mercy) { meta.mem.mercy = 1; achCheck({}); track('mem/mercy'); }
  $('ovTitle').textContent = mercy ? tr(ME.title.ja, ME.title.en) : won ? tr('祭り、大団円！', 'The Festival is Complete!') : tr('今夜はここまで', 'The Night Ends');
  { const t = $('ovTitle'); t.classList.remove('crack', 'burn'); S.crack = !won && lore() >= 3 ? { x0: null, n: 0 } : null; if (S.crack) t.classList.add('crack'); }
  const sub = [newBest ? `<em class="best">${tr('自己ベスト！', 'New Best!')}</em>` : '', !won && S.miss ? tr(`最後の夜は あと ${fmt(S.miss.n)} 点（${S.miss.pct}%）`, `Last night: ${fmt(S.miss.n)} short (${S.miss.pct}%)`) : ''].filter(Boolean).join(' ');
  if (run.endless) meta.endlessBest = Math.max(meta.endlessBest || 0, run.nightsCleared);
  $('ovNights').innerHTML = (run.endless ? tr(`千秋楽 ${run.nightsCleared} 夜（最高 ${meta.endlessBest}）`, `Encore: ${run.nightsCleared} nights (best ${meta.endlessBest})`) : (run.nightsCleared ? tr(`${run.nightsCleared} 夜を越えた`, `${run.nightsCleared} nights cleared`) : tr('第 1 夜で散った', 'Fell on night 1')) + (() => {
      const n = run.nightsCleared, bits = [];
      if (prevEnd && !won) bits.push(n > prevEnd.nights ? tr(`前回より +${n - prevEnd.nights} 夜`, `+${n - prevEnd.nights} vs last run`) : n === prevEnd.nights ? tr('前回と同じ', 'Same as last run') : tr(`前回は ${prevEnd.nights} 夜`, `Last run: ${prevEnd.nights}`));
      if (prevBest && n < prevBest) bits.push(tr(`最高 ${prevBest} 夜`, `Best ${prevBest}`));
      const nb = run.nightsCleared < 4 ? 4 : run.nightsCleared < 8 ? 8 : 0;
      const d = nb - n - 1; // 散った夜（第 n+1 夜）から数える。遊んでいる間の「大一番まで あと N 夜」と同じ数え方
      if (!won && nb && d > 0 && (!prevBest || prevBest < nb)) bits.push(tr(`大一番（第 ${nb} 夜）まで あと ${d} 夜`, `${d} more to the boss (night ${nb})`));
      return bits.length ? `<small class="cmp">${bits.map((x) => `<span>${x}</span>`).join('')}</small>` : '';
    })()) + (sub ? `<small>${sub}</small>` : '') + (!won && S.st ? `<small class="hint">${lossHint()}</small>` : '') + (mercy ? `<small class="mercy">${(JA() ? ME.body.ja : ME.body.en).split('\n').join('<br>')}</small>` : '');
  const sp = Object.values(run.spells || {}), spT = sp.reduce((a, x) => a + x.t, 0), spG = sp.reduce((a, x) => a + x.g, 0);
  meta.bestScore = Math.max(meta.bestScore || 0, run.totalScore);
  PF.lbSet(run.totalScore);
  PF.ev('run_end', { nights: run.nightsCleared, won: won ? 1 : 0, total: run.totalScore, revived: run.revived ? 1 : 0, runs: meta.runs, assist: run.assist ? 1 : 0, daily: S.daily ? 1 : 0 });
  $('ovStats').innerHTML = [[tr('合計の点', 'Total score'), fmt(run.totalScore)], [tr('最大連鎖', 'Best chain'), run.bestChain], ...(DB.meta.taught.dust ? [[tr('星の値', 'Star value'), fmtM(run.pv ?? 4)], [tr('かすり', 'Graze'), fmt(run.graze || 0)], [tr('星屑', 'Star dust'), fmt(run.dust || 0)]] : []), ...(spT ? [[tr('技', 'Techniques'), `${spG} / ${spT}`]] : []), [tr('星', 'Stars'), run.stars], [tr('経験', 'XP'), '+' + Run.xpFor(run)]].map(([a, b], i) => `<div style="animation-delay:${i * 0.1}s"><span>${a}</span><b>${b}</b></div>`).join('');
  const ul = [];
  if (after > before) { const nw = CHARMS.filter((c) => !beforeSet.has(c.id) && Run.unlockedCharms(meta).has(c.id)); ul.push(tr(`新しいお守り「${nw.map((c) => c.ja).join('」「')}」が屋台に並ぶ！`, `New charm${nw.length > 1 ? 's' : ''}: ${nw.map((c) => c.en).join(', ')}!`)); }
  if (fuseAfter > fuseBefore) ul.push(tr('新しい導火線！', 'New fuse!'));
  if (won && run.rank + 1 < Run.RANKS.length) ul.push(tr('次の段位が開いた！', 'Next rank unlocked!'));
  const order = Run.START_POOL, xp = meta.xp, rest = after < CHARMS.length ? 30 - (xp % 30) : 0;
  $('ovUnlocks').innerHTML = (ul.length ? `<div>${ul.join('  ')}</div>` : '') + (rest ? `<div class="nextun"><span>${tr(`次のお守りまで あと ${rest}`, `Next charm in ${rest} XP`)}</span><i style="width:${((30 - rest) / 30) * 100}%"></i></div>` : '');
  $('ovTitleBtn').textContent = tr('タイトル', 'Title'); $('ovAgain').textContent = tr('もう一度', 'PLAY AGAIN');
  // Playgama ではタイトルを通らないので、今日の祭りの入口をここにも置く
  // Playgama のランキング（ovRank は自分のサイトの世界ランキングの欄なので別の名前）
  const orb = $('ovPgRank'); orb.textContent = tr('ランキング', 'Leaderboard'); orb.classList.toggle('hidden', PF.lbType() !== 'in_game'); orb.onclick = () => { audio.ui('tap'); openPgRank(); };
  const od = $('ovDaily'); od.textContent = tr('今日の祭り', 'Daily'); od.classList.toggle('hidden', !!(S.daily || run.endless));
  track(`run/${won ? 'win' : 'over'}/n${run.nightsCleared}${S.daily ? '/daily' : ''}`);
  const sh = $('ovShare'); sh.classList.toggle('hidden', !canShare()); sh.textContent = tr('結果を共有', 'Share');
  const d = new Date(), day = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  const msg = JA()
    ? `${S.daily ? `今日の祭り（${day}）
` : ''}一筆花火2 ${won ? '祭りを大団円！' : `${run.nightsCleared} / 24 夜で散った`}
合計 ${fmt(run.totalScore)} 点・最大連鎖 ${run.bestChain}
線を引け。火が追いかけてくる。 #一筆花火`
    : `${S.daily ? `Daily (${day})
` : ''}Hitofude Hanabi 2 — ${won ? 'festival complete!' : `${run.nightsCleared}/24 nights`}
${fmt(run.totalScore)} pts, best chain ${run.bestChain}
Draw the fuse. The flame is right behind you. #HitofudeHanabi`;
  sh.onclick = () => { audio.ui('tap'); share(msg, S.daily ? 'share-daily' : 'share'); };
  // 24 夜を越えたら、そのまま千秋楽（終わらない祭り）へ続けられる
  const en = $('ovEndless'); en.classList.toggle('hidden', !(won && !run.endless)); en.textContent = tr('千秋楽へ（まだ続ける）', 'ENCORE: keep going');
  // 偽の大団円: 明かし 3 を見たあとに勝つと、題が燃えて問いに変わり、ボタンが「帰る」「帰らない」になる
  if (won && !run.endless && !mercy && lore() >= 3) {
    loreUp(4); const tt = $('ovTitle');
    setTimeout(() => { if (S.mode !== 'over') return; tt.classList.add('burn'); setTimeout(() => { tt.textContent = tr('……大団円？', '...Complete?'); tt.classList.remove('burn');
      $('ovUnlocks').insertAdjacentHTML('afterbegin', `<div class="storyline">${tr('トラ', 'Tora')}「${story('fake')}」</div>`);
      $('ovTitleBtn').textContent = tr('帰る', 'Go home'); en.textContent = tr('帰らない（千秋楽へ）', 'Stay (Encore)'); audio.note(3, { vol: 0.16, dur: 1.2 }); }, 700); }, 2400);
  }

  en.onclick = () => { audio.ui('tap'); Run.startEndless(run); S.log = endLog; logOp('E'); logSave(); S.run = run; DB.run = run; save(); track('run/endless'); startNight(); };
  const endLog = S.log; rankSubmit(run, endLog);
  DB.run = null; S.run = null; save(); S.log = null; if (!window.HANABI_PG) try { localStorage.removeItem(LOGKEY); } catch { /* なくても遊べる */ }
  audio.ui(won ? 'win' : 'lose'); audio.scene(won ? 'finale' : 'calm');
  if (won) grandFinale(); else PF.ad();
}
$('ovTitleBtn').onclick = () => { audio.ui('tap'); toTitle(); };
// 割れる題: 点線の上を指でなぞる（左右に 60% 以上）と、字が燃えて書きかわる。見た目と一言だけ
$('ovTitle').addEventListener('pointerdown', (e) => { if (S.crack) { S.crack.x0 = e.clientX; S.crack.min = e.clientX; S.crack.max = e.clientX; } });
$('ovTitle').addEventListener('pointermove', (e) => { const c = S.crack; if (!c || c.x0 == null) return; c.min = Math.min(c.min, e.clientX); c.max = Math.max(c.max, e.clientX); const w = $('ovTitle').getBoundingClientRect().width;
  if (c.max - c.min > w * 0.6) { S.crack = null; const t = $('ovTitle'); t.classList.remove('crack'); t.classList.add('burn'); audio.boom(1.2, 0);
    setTimeout(() => { t.textContent = tr('まだ、終わってない', 'It isn\'t over yet'); t.classList.remove('burn'); $('ovUnlocks').insertAdjacentHTML('afterbegin', `<div class="storyline hinoko">${tr('火の子「まって」', 'The little flame: "wait"')}</div>`); once('crack'); }, 700); } });
addEventListener('pointerup', () => { if (S.crack) S.crack.x0 = null; });
$('ovDaily').onclick = () => { audio.ui('tap'); startDaily(); };
$('ovAgain').onclick = () => { audio.ui('tap'); beginRun({ fuse: S.fuse, rank: S.rank, school: S.school }); };

// ひと休み
function openPause() {
  if (S.mode !== 'play') return;
  S.paused = true; show('pause'); hideTip(); PF.stop(); if (S.st) PF.level('paused', S.st.level.world, S.st.level.night);
  $('pzTitle').textContent = tr('ひと休み', 'Paused');
  const lab = () => {
    $('pzSound').textContent = tr(`効果音 ${DB.sound ? 'ON' : 'OFF'}`, `Sound ${DB.sound ? 'ON' : 'OFF'}`);
    $('pzMusic').textContent = tr(`音楽 ${DB.music ? 'ON' : 'OFF'}`, `Music ${DB.music ? 'ON' : 'OFF'}`);
    $('pzLang').textContent = JA() ? 'English' : '日本語';
    $('pzTouch').textContent = tr(`指の操作：${['ふつう', '先を上に', '先をもっと上に'][touchMode()]}`, `Touch: ${['normal', 'tip above finger', 'tip far above'][touchMode()]}`);
    $('pzHaptic').textContent = tr(`振動 ${DB.haptic === false ? 'OFF' : 'ON'}`, `Vibration ${DB.haptic === false ? 'OFF' : 'ON'}`); $('pzHaptic').classList.toggle('hidden', !navigator.vibrate);
  };
  lab();
  $('pzSound').onclick = () => { DB.sound = !DB.sound; applySound(); save(); lab(); };
  $('pzMusic').onclick = () => { DB.music = !DB.music; applySound(); save(); lab(); };
  $('pzTouch').onclick = () => { DB.touchMode = (touchMode() + 1) % 3; save(); lab(); };
  $('pzHaptic').onclick = () => { DB.haptic = DB.haptic === false; save(); lab(); buzz(20); };
  $('pzLang').onclick = () => { lang = JA() ? 'en' : 'ja'; DB.lang = lang; save(); openPause(); };
  renderHeld($('pzHeld'), false);
  $('pzQuit').textContent = tr('タイトルへ（続きから遊べます）', 'Title (you can continue later)'); $('pzResume').textContent = tr('つづける', 'RESUME');
}
function closePause() { S.paused = false; show('none'); last = performance.now(); PF.start(); if (S.st) PF.level('resumed', S.st.level.world, S.st.level.night); }
$('pauseBtn').onclick = () => { audio.ui('tap'); openPause(); };
function soundIcon() { $('sndBtn').classList.toggle('off', !DB.sound); }
// 音を出してよい操作（指を離した時・click・キー）のたびに鳴らし直す。最初の pointerdown だけでは、スマホで無音のまま残ることがある
for (const t of ['pointerup', 'touchend', 'click', 'keydown']) addEventListener(t, () => audio.unlock(), { capture: true, passive: true });
$('sndBtn').onclick = () => { audio.unlock(); DB.sound = !DB.sound; DB.music = DB.sound; applySound(); save(); soundIcon(); };
soundIcon();
$('pzResume').onclick = () => { audio.ui('tap'); closePause(); };
$('pzQuit').onclick = () => { audio.ui('tap'); S.paused = false; pid = null; if (S.run) { DB.run = S.run; save(); S.savedNote = 1; } toTitle(); };
addEventListener('keydown', (e) => { if ((e.key === 'Escape' && !window.HANABI_PG) || e.key === 'p') { /* Playgama では Esc を使わない（全画面を抜けるキー） */ if (S.paused) closePause(); else openPause(); } });
function toast(t) { const e = document.createElement('div'); e.className = 'pop gold'; e.textContent = t; e.style.left = '50%'; e.style.top = '30%'; e.style.fontSize = '22px'; e.style.zIndex = 9; document.body.append(e); setTimeout(() => e.remove(), 950); }

// ------------------------------------------------------------------ 入力
const q1 = (v) => Math.round(v * 10) / 10;
// 指で遊ぶとき、線の先を指より上に出す（Potter 1988 の take-off・縦シューティングの自機ずらしと同じ考え）。
// 0: ふつう / 1: 上に 64px / 2: もっと上に 110px。触った直後は 0 から始め、指が 28px 動くまでに満額へ（先が跳ばない）
const TOUCH_OFF = [0, 64, 110];
const touchMode = () => { const qm = q.get('touch'); return qm != null ? Math.max(0, Math.min(2, +qm || 0)) : (DB.touchMode ?? 0); };
const tipOff = (e) => { if (!TOUCH || !S.tip) return 0; const off = TOUCH_OFF[touchMode()] || 0; if (!off) return 0; const d = Math.hypot(e.clientX - S.tip.x, e.clientY - S.tip.y); S.tip.ramp = Math.max(S.tip.ramp || 0, Math.min(1, d / 28)); return off * S.tip.ramp; };
const toWorld = (e, dy = 0) => {
  let [cx, cy] = untilt(e.clientX, e.clientY - dy);
  let x = (cx / innerWidth) * W + (S.pan || 0); const y = (cy / innerHeight) * H - (S.panY || 0);
  if (S.st?.ihen?.id === 'hanten') x = W - x; // 異変「反」: 指と線が左右に入れかわる
  return { x: q1(x), y: q1(y) };
};
let pid = null, TOUCH = false; // 指で遊んでいるか（輪を指の外に出す）
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock(); TOUCH = e.pointerType === 'touch'; hideVeil('board');
  if (S.mode === 'retry' && performance.now() - S.retryAt > 600) { startNight(); return; }
  if (S.mode !== 'play' || !S.st || pid !== null || S.paused) return;
  if (S.cnt) S.cnt.t = S.cnt.dur; // 数え上げの途中でも、触れたらすぐ次へ
  S.tip = { x: e.clientX, y: e.clientY, ramp: 0 };
  if (TOUCH && touchMode() && !DB.meta.taught.tip) { DB.meta.taught.tip = 1; save(); floatText(W / 2, H * 0.3, tr('線の先は、指の少し上に出ます', 'The line tip sits just above your finger'), 'gold', 24, 1800); }
  const p = toWorld(e);
  S.rec?.ev.push([S.st.t, 'd', p.x, p.y]);
  if (G.penDown(S.st, p.x, p.y)) { pid = e.pointerId; S.lastPtr = { clientX: e.clientX, clientY: e.clientY }; try { canvas.setPointerCapture(pid); } catch { /* 無くても動く */ } $('teach').classList.add('hidden'); }
  else if (S.st.level.grand) { S.rec?.ev.pop(); S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: S.pan || 0, panY: S.panY || 0 }; S.panIntro = 0; try { canvas.setPointerCapture(e.pointerId); } catch { /* */ } }
});
canvas.addEventListener('pointermove', (e) => {
  if (S.drag && e.pointerId === S.drag.id) { S.pan = Math.max(0, Math.min(panMax(), S.drag.pan - ((e.clientX - S.drag.x) / innerWidth) * W)); S.panY = Math.max(0, Math.min(panMaxY(), S.drag.panY + ((e.clientY - S.drag.y) / innerHeight) * H)); return; }
  if (e.pointerId !== pid || !S.st) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of (list.length ? list : [e])) { const p = toWorld(ev, tipOff(ev)); S.rec?.ev.push([S.st.t, 'm', p.x, p.y]); G.penMove(S.st, p.x, p.y); }
  tether(e); S.lastPtr = { clientX: e.clientX, clientY: e.clientY };
});
const release = (e) => { if (S.drag && e.pointerId === S.drag.id) { S.drag = null; return; } if (e.pointerId !== pid) return; pid = null; S.tip = null; tether(null); if (S.st) { S.rec?.ev.push([S.st.t, 'u']); G.penUp(S.st); } };
// ---- 大仕掛けの夜: 盤が画面より横に長い。線の先が画面の端に近づくと流れる（指が止まっていても線は伸びる）
const panMax = () => (S.st?.level?.grand ? Math.max(0, S.st.field.x1 + 70 - W) : 0);
const panMaxY = () => (S.st?.level?.grand?.gh > 1 ? Math.max(0, 60 - S.st.field.y0) : 0);
function panFrame(dt) {
  const st = S.st;
  { const b = R.band; if (b?.rect0) { const off = (S.panY || 0) / H; b.rect[1] = b.rect0[1] + off; b.waterY = b.water0 + off; } } // 昇るほど町は下へ消える
  if (!st || !st.level?.grand || S.mode !== 'play') { if ((S.pan || S.panY) && S.mode !== 'play' && S.mode !== 'retry') { S.pan = 0; S.panY = 0; } miniMap(); grandLabels(); return; }
  const maxY = panMaxY();
  if (maxY > 0 && S.panIntro > 0) { S.panIntro = Math.max(0, S.panIntro - dt); const u = S.panIntro / 2.4; S.panY = maxY * Math.min(1, Math.max(0, (u - 0.1) / 0.6)); miniMap(); grandLabels(); return; } // 空の上（星座）から地上へ
  if (maxY > 0 && pid !== null && st.stroke && S.lastPtr) {
    const sy = S.lastPtr.clientY / innerHeight, edge = 0.2; let v = 0;
    if (sy < edge) v = (edge - sy) / edge; else if (sy > 1 - edge) v = -(sy - (1 - edge)) / edge;
    if (v) { const p0 = S.panY || 0; S.panY = Math.max(0, Math.min(maxY, p0 + v * H * 0.8 * dt));
      if (S.panY !== p0) { const p = toWorld(S.lastPtr, tipOff(S.lastPtr)); S.rec?.ev.push([st.t, 'm', p.x, p.y]); G.penMove(st, p.x, p.y); } }
  }
  const max = Math.max(0, st.field.x1 + 70 - W);
  if (S.panIntro > 0) { S.panIntro = Math.max(0, S.panIntro - dt); const u = S.panIntro / 2.4; S.pan = max * Math.min(1, Math.max(0, (u - 0.1) / 0.6)); } // 右端（滝）を見せてから、左の始まりへ
  else if (pid !== null && st.stroke && S.lastPtr) {
    const sx = S.lastPtr.clientX / innerWidth, edge = 0.2; let v = 0;
    if (sx > 1 - edge) v = (sx - (1 - edge)) / edge; else if (sx < edge) v = -(edge - sx) / edge;
    if (v) { const p0 = S.pan || 0; S.pan = Math.max(0, Math.min(max, p0 + v * W * 0.9 * dt));
      if (S.pan !== p0) { const p = toWorld(S.lastPtr, tipOff(S.lastPtr)); S.rec?.ev.push([st.t, 'm', p.x, p.y]); G.penMove(st, p.x, p.y); } }
  } else if (st.taki && st.taki.front !== null) { S.pan += ((Math.max(0, Math.min(max, st.taki.front - W * 0.5))) - S.pan) * Math.min(1, dt * 4); } // 滝を追う
  miniMap(); grandLabels();
}
// 大仕掛けの玉の札（字玉の番号・滝・発射台）。玉について動き、ひらいたら消える
function grandLabels() {
  const box = $('grandLabels'); if (!box) return; const st = S.st;
  if (!st || !st.level?.grand || S.mode !== 'play') { if (box.childElementCount) box.innerHTML = ''; return; }
  const KN = ['壱', '弐', '参', '肆', '伍'], live = new Set();
  for (const s of st.shells) {
    if (!s.mod || !['moji', 'taki', 'renpatsu', 'seiza'].includes(s.mod) || s.state !== 'idle' || s.rise > 0) continue;
    let e = box.querySelector(`[data-id="${s.id}"]`);
    if (!e) { e = document.createElement('div'); e.dataset.id = s.id; e.className = 'gl ' + s.mod; e.textContent = s.mod === 'seiza' ? '★' + ['一', '二', '三', '四', '五', '六', '七'][s.seq - 1] : s.mod === 'moji' ? KN[s.seq - 1] : s.mod === 'taki' ? tr('滝', 'Falls') : tr('発射台', 'Launch'); box.append(e); }
    e.classList.toggle('next', (s.mod === 'moji' && st.moji && st.moji.next === s.seq) || (s.mod === 'seiza' && st.seiza && st.seiza.next === s.seq));
    e.style.left = ((s.x - (S.pan || 0)) / W) * 100 + '%'; e.style.top = ((s.y - s.r - 18 + (S.panY || 0)) / H) * 100 + '%'; live.add(String(s.id));
  }
  for (const e of [...box.children]) if (!live.has(e.dataset.id)) e.remove();
}
// 上の端の細い地図: 盤の全体と、いま見ている範囲
function miniMap() {
  const cv = $('mini'); if (!cv) return; const st = S.st, on = !!(st && st.level?.grand && S.mode === 'play'); cv.classList.toggle('hidden', !on); if (!on) return;
  const vert = st.level.grand.gh > 1; cv.classList.toggle('v', vert);
  if (vert) { const f = st.field, Y0 = f.y0 - 60, Y1 = H, w = cv.width = Math.round(cv.clientWidth * 2) || 24, h = cv.height = Math.round(cv.clientHeight * 2) || 300, g = cv.getContext('2d'), sy = (y) => ((y - Y0) / (Y1 - Y0)) * h;
    g.clearRect(0, 0, w, h); g.fillStyle = '#05070fb0'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff22'; g.fillRect(0, sy(-(S.panY || 0)), w, (H / (Y1 - Y0)) * h);
    for (const s of st.shells) { if (s.state !== 'idle') continue; g.fillStyle = s.mod === 'seiza' ? '#bfe0ff' : s.type === 'kin' ? '#ffd24a' : '#ff8a7a'; g.beginPath(); g.arc((s.x / W) * w * 0.9 + w * 0.05, sy(s.y), s.mod === 'seiza' ? 6 : 3.4, 0, 7); g.fill(); }
    return; }
  const f = st.field, X0 = 0, X1 = f.x1 + 70, w = cv.width = Math.round(cv.clientWidth * 2) || 400, h = cv.height = Math.round(cv.clientHeight * 2) || 24, g = cv.getContext('2d');
  g.clearRect(0, 0, w, h); g.fillStyle = '#05070fb0'; g.fillRect(0, 0, w, h);
  const sx = (x) => ((x - X0) / (X1 - X0)) * w;
  g.fillStyle = '#ffffff22'; g.fillRect(sx(S.pan || 0), 0, (W / (X1 - X0)) * w, h);
  for (const s of st.shells) { if (s.state !== 'idle') continue; g.fillStyle = s.mod === 'taki' ? '#7fd4ff' : s.mod === 'moji' ? '#d6b0ff' : s.mod === 'renpatsu' ? '#8ef0a0' : s.type === 'kin' ? '#ffd24a' : '#ff8a7a'; g.beginPath(); g.arc(sx(s.x), (s.y / H) * h * 0.9 + h * 0.05, s.mod === 'taki' || s.mod === 'moji' || s.mod === 'renpatsu' ? 6 : 3.4, 0, 7); g.fill(); }
  if (st.taki && st.taki.front !== null) { g.fillStyle = '#9fe6ff'; g.fillRect(sx(st.taki.front) - 2, 0, 4, h); }
}
// 指と線の先をつなぐ細い線（先端をずらしているときだけ）
function tether(e) {
  const el = $('tether'); if (!el) return;
  const off = e && S.tip ? (TOUCH_OFF[touchMode()] || 0) * (S.tip.ramp || 0) : 0;
  if (!e || off < 4) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const ln = el.querySelector('line'), c1 = el.querySelector('.fg'), c2 = el.querySelector('.tp');
  ln.setAttribute('x1', e.clientX); ln.setAttribute('y1', e.clientY); ln.setAttribute('x2', e.clientX); ln.setAttribute('y2', e.clientY - off);
  c1.setAttribute('cx', e.clientX); c1.setAttribute('cy', e.clientY); c2.setAttribute('cx', e.clientX); c2.setAttribute('cy', e.clientY - off);
}
// 振動（Android の Chrome。iPhone の Safari は非対応）。指で遊んでいるときだけ
const buzz = (p) => { try { if (TOUCH && DB.haptic !== false && navigator.vibrate) navigator.vibrate(p); } catch { /* */ } };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('visibilitychange', () => { audio.mute(document.hidden); if (document.hidden && S.mode === 'play' && !S.paused && !(S.st && S.st.phase === 'stroke')) openPause(); });

// ------------------------------------------------------------------ 見せ方
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const panOf = (x) => Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1));
const MSG = { live: 0, q: [] };
function floatText(x, y, text, cls = '', size = 22, life = 950) {
  { const p = S.pan || 0; x = Math.max(p + W * 0.14, Math.min(p + W * 0.86, x)); } // 端で字が切れないように（流した盤では見えている範囲で）
  // 「+30」のような数は何個でも出す。言葉の字は同時に 2 つまで、あふれたら 0.3 秒ずつ順に（古いものは捨てる）
  const isMsg = cls !== 'hinoko' && !/^[+×−\-]?[\d,]/.test(String(text));
  if (isMsg) {
    if (MSG.live >= 2) { MSG.q.push([x, y, text, cls, size, life]); if (MSG.q.length > 3) MSG.q.shift(); return; }
    MSG.live++; setTimeout(() => { MSG.live--; const n = MSG.q.shift(); if (n) floatText(...n); }, 320);
  }
  const e = document.createElement('div'); e.className = 'pop ' + cls; e.textContent = text;
  e.style.left = ((x - (S.pan || 0)) / W) * 100 + '%'; e.style.top = ((y + (S.panY || 0)) / H) * 100 + '%'; e.style.fontSize = size * (innerHeight / H) + 'px';
  $('float').append(e); setTimeout(() => e.remove(), life);
}
// トラ（屋台の猫）や妖怪が、画面の下から話しかける。触れると閉じて then へ
function showTalk(who, cast, face, text, then) {
  const t = $('talk'), g = $('talkFace').getContext('2d'); g.clearRect(0, 0, 160, 160);
  try { drawCast(g, cast, 80, 90, 110, { face, still: true, glow: false }); } catch { /* 絵が無くても話せる */ }
  $('talkWho').textContent = who; $('talkMsg').textContent = text; $('talkNext').textContent = tr('触れて つづける', 'Tap to continue');
  t.classList.remove('hidden'); audio.note(12, { vol: 0.12, dur: 0.3 });
  const at = performance.now();
  t.onclick = () => { if (performance.now() - at < 400) return; t.classList.add('hidden'); t.onclick = null; audio.ui('tap'); then?.(); };
}
function banner(html, size = 70, life = 1600, cls = '') {
  $('float').querySelectorAll('.banner').forEach((o) => o.remove());
  const e = document.createElement('div'); e.className = 'banner ' + cls; e.innerHTML = html; e.style.fontSize = size * (Math.min(innerWidth, innerHeight) / 720) + 'px'; e.style.animationDuration = life + 'ms';
  $('float').append(e); setTimeout(() => e.remove(), life);
}
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
// 止め（ヒットストップ）: ルールの時間だけを止め、粒と光は少しだけ動かし続ける。
// 指が触れている間は止めない（線が飛ぶ）。小さな止めは 0.12 秒に 1 回まで、大きな止めは割りこめる
function hitStop(ms) {
  if (S.st?.stroke?.penDown || S.paused) return;
  const s = ms / 1000;
  if (S.stopCool > 0 && s < 0.07) return;
  S.stopT = Math.max(S.stopT || 0, s); S.stopCool = 0.12;
}
// 初めて追いつかれたとき: ゲームの時計を止めて、追いつかれた所に輪を出し、何が起きたか・次にどうするかを見せる（変わったきまりなので、初めての 1 回だけ）。
// 時計を止めるだけなので、点の計算・ランキングの記録には関わらない
const GUIDE_SVG = (a, b, c) => `<svg viewBox="0 0 260 64" aria-hidden="true"><path d="M14 44 C70 10 120 58 176 26 S236 30 246 22" fill="none" stroke="#ffe3a0" stroke-width="4" stroke-linecap="round" stroke-dasharray="2 9"/><path d="M14 44 C70 10 120 58 176 26" fill="none" stroke="#ff7a2a" stroke-width="6" stroke-linecap="round"/><circle cx="176" cy="26" r="11" fill="#ffb347"/><circle cx="176" cy="26" r="6" fill="#fff3c4"/><circle cx="246" cy="22" r="7" fill="#fff"/><circle cx="246" cy="22" r="15" fill="none" stroke="#ff4a3a" stroke-width="3"/><text x="8" y="62" font-size="12" fill="#ffcf8a">${a}</text><text x="${b.length > 2 ? 160 : 170}" y="60" font-size="12" fill="#ffb347">${b}</text><text x="${c.length > 3 ? 214 : 222}" y="60" font-size="12" fill="#fff">${c}</text></svg>`;
// 夜の始まりの札: 大仕掛け・趣向・封じの夜は、何が起きるかと狙いを大きく見せる（触れると閉じる）
function nightCard(def) {
  const el = $('nightCard'); if (!el) return; const items = [];
  if (def.grand?.kind === 'seiza') items.push([tr('大仕掛け「天の川」', 'Grand Set Piece: Milky Way'), tr('盤は空の高みまで続く。線の先を画面の上の端へ運ぶと、夜空へ昇る。<br>空の高い所の<b>北斗七星</b>の星玉を<b>★一から★七まで順に</b>線で通すと、星座が結ばれ<b>満天</b>：倍率 ×2、空の玉がぜんぶ降るようにひらく', 'The board reaches high into the sky: move the tip to the top edge to climb.<br>Thread the <b>Big Dipper</b> stars <b>1 to 7 in order</b> to connect the constellation: <b>Sky Ablaze</b> — MULT ×2 and every shell in the high sky opens.')]);
  else if (def.grand?.kind === 'moji') items.push([tr('大仕掛け「文字花火」', 'Grand Set Piece: Sky Writing'), tr('盤は横に長い。<b>壱・弐・参・肆</b>の字玉を<b>番号の順に</b>線で通すと、夜空に字が浮かんで倍率 ×2。<br>字玉は爆風では燃えない。違う順番の字玉はひらかずに残る', 'The board is wide. Thread the <b>numbered shells 1–4 in order</b> with your line to write a kanji in the sky: MULT ×2.<br>They ignore blasts, and wrong-order ones stay unlit.')]);
  else if (def.grand?.kind === 'renpatsu') items.push([tr('大仕掛け「連発」', 'Grand Set Piece: Starmine'), tr('盤は横に長い。盤の中ほどの<b>発射台</b>へ、<b>一筆で 6 つ以上</b>ひらいてから火を届けると、盤のあちこちへ 16 発が次々に打ち込まれる', 'The board is wide. Open <b>6+ shells in one stroke</b>, then reach the <b>Launcher</b> in the middle: 16 shots rain across the board.')]);
  else if (def.grand) items.push([tr('大仕掛け「火の滝」', 'Grand Set Piece: Fire Falls'), tr('盤は横に長い。線の先を画面の端へ運ぶと、盤が流れる。<br>右端の<b>滝の玉</b>へ、<b>一筆で 6 つ以上</b>ひらいてから火を届けると、火の滝が盤を流れ落ちる', 'The board is wide: move the line tip to the screen edge to scroll.<br>Open <b>6+ shells in one stroke</b>, then reach the <b>Falls shell</b> on the far right to unleash a waterfall of fire.')]);
  const tw = def.twist && Run.TWISTS[def.twist];
  if (tw && !def.twistHide) items.push([tr(`趣向「${tw.ja}」`, `Twist: ${tw.en}`), JA() ? tw.dj : tw.de]);
  for (const x of def.rule ? [] : def.seals || []) { const z = Run.SEALS[x]; /* 大一番の封じは名前の札で言う */ if (z) items.push([tr(`封じ「${z.ja}」`, `Seal: ${z.en}`), JA() ? (z.dj || '') : (z.de || '')]); }
  if (!items.length) { el.classList.add('hidden'); return; }
  el.innerHTML = items.slice(0, 2).map(([a, b]) => `<div class="nc"><h3>${a}</h3><p>${b}</p></div>`).join('') + `<small>${tr('触れると閉じる', 'Tap to close')}</small>`;
  el.classList.remove('hidden'); clearTimeout(S.ncT); S.ncT = setTimeout(() => el.classList.add('hidden'), def.grand ? 5200 : 3600);
}
$('nightCard')?.addEventListener('pointerdown', () => $('nightCard').classList.add('hidden'));
// 夜空に字を描く: 字を小さな画に書いて、字の画素の所に火花を置く
function skyKanji(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 84px "Shippori Mincho", "Yuji Boku", serif'; g.fillText(ch, 48, 50);
  const d = g.getImageData(0, 0, 96, 96).data, cx = (S.pan || 0) + W * 0.5, cy = H * 0.3, k = Math.min(W, H) / 210;
  for (let y = 0; y < 96; y += 3) for (let x = 0; x < 96; x += 3) if (d[(y * 96 + x) * 4 + 3] > 120)
    fx.add(cx + (x - 48) * k, cy + (y - 48) * k, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 2.4 + Math.random() * 0.6, 3.4, 0.6, 8, [3, 2.5, 1.3], [1.8, 0.7, 0.2], 1.5);
}
// ---- 物語の手がかり: 一度だけの一言（seen）と、明かしの段（lore）を順に
const story = (k) => { const s = Mem.STORY[k]; return s ? (JA() ? s[0] : s[1]) : ''; };
const lore = () => mem().lore || 0;
const loreUp = (n) => { const m = mem(); if ((m.lore || 0) === n - 1) { m.lore = n; save(); } };
const once = (k) => { const m = mem(); m.seen ||= {}; if (m.seen[k]) return false; m.seen[k] = 1; save(); return true; };
// ---- 点を伸ばす技
const TECHS = [
  ['mikiri', '見切り', 'Close Call', '火が近い（熱い）うちに、自分で指を離す', 'Let go yourself while the flame is close', '倍率 +1・星屑を回収', '+1 MULT, sweeps star dust'],
  ['bloom', '満開', 'Full Bloom', '一筆で盤の玉を全部ひらく', 'Open every shell in one stroke', '倍率 ×2（続けるほど ×3、×4）', 'MULT ×2 (×3, ×4 in a row)'],
  ['loop', '囲い', 'Encircle', '線で輪を作り、玉を 2 つ以上囲む', 'Close a loop of your line around 2+ shells', '火が輪を閉じると中の玉が一斉にひらく。3 つ以上で倍率 +1', 'When the fire closes the loop they all open; 3+ = +1 MULT'],
  ['tsugi', '継ぎ火', 'Relight', '筆を離した所に残る輪の中から、次の一筆を始める', 'Start the next stroke inside the ring left where you let go', '倍率を持ちこむ', 'Carry your MULT over'],
  ['graze', 'かすり三十', 'Graze 30', '火のすぐ前を細く保ったまま走る（一筆で 30 回）', 'Keep a thin gap just ahead of the flame (30 in one stroke)', '星の値が上がる', 'Raises star value'],
  ['chain', '十五夜', 'Harvest Moon', '一筆で 15 個つなげる', 'Chain 15 shells in one stroke', '小判 +2（25 個で千輪、40 個で満天）', '+2 coins (25: Thousand Rings, 40: Sky Ablaze)'],
  ['knot', '結び', 'Knot', 'お守り「結び」を持って、自分の線と交差させる', 'With the Knot charm, cross your own line', '交点が爆ぜて倍率 +2', 'The crossing bursts: +2 MULT'],
  ['seiza', '満天', 'Sky Ablaze', '天の川の夜、北斗七星の星玉を★一から★七まで順に線で通す', 'On the Milky Way night, thread the Big Dipper stars 1–7 in order', '倍率 ×2、空の高い所の玉がぜんぶ降るようにひらく', 'MULT ×2 and every shell high in the sky opens'],
  ['hitofude', '一筆書き', 'One Stroke', '幕間の儀で、図形のすべての線を指を離さず一度ずつなぞる', 'In the interlude rite, trace every line once without lifting', '仕掛け花火と小判（1 回目なら 15）', 'Set-piece fireworks and coins (15 on the first try)'],
  ['moji', '文字花火', 'Sky Writing', '大仕掛けの夜、壱〜肆の字玉を番号の順に線で通す', 'On a set-piece night, thread the numbered shells 1–4 in order', '夜空に字が浮かび、倍率 ×2', 'A kanji lights the sky: MULT ×2'],
  ['ren', '連発', 'Starmine', '大仕掛けの夜、一筆で 6 つ以上ひらいてから発射台へ', 'On a set-piece night, open 6+ shells then reach the Launcher', '盤のあちこちへ 16 発が次々に', '16 shots rain across the board'],
  ['taki', '火の滝', 'Fire Falls', '大仕掛けの夜、一筆で 6 つ以上ひらいてから右端の滝の玉へ', 'On a set-piece night, open 6+ shells then reach the Falls shell', '火の滝が盤を流れ、通り道の玉が一斉にひらく', 'A waterfall of fire opens everything in its path'],
];
const TECH_BY = Object.fromEntries(TECHS.map((t) => [t[0], t]));
function techCall(id, effect) {
  const t = TECH_BY[id]; if (!t) return;
  const m = DB.meta; m.tq ||= {}; const first = !m.tq[id]; m.tq[id] = (m.tq[id] || 0) + 1;
  const box = $('techFeed'); if (!box) return;
  const e = document.createElement('div'); e.className = 'tf' + (first ? ' first' : '');
  e.innerHTML = `<b>${JA() ? t[1] : t[2]}</b><span>${effect || (JA() ? t[5] : t[6])}</span>${first ? `<i>${tr('はじめて！', 'First!')}</i>` : ''}`;
  box.prepend(e); while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => e.classList.add('out'), 2400); setTimeout(() => e.remove(), 3000);
}
function caughtGuide(ev) {
  if (DB.meta.taught.caught) return;
  DB.meta.taught.caught = 1; save();
  S.guide = true; S.guideAt = performance.now();
  const r = $('guideRing'); r.style.left = (Math.max(0, Math.min(W, ev.x - (S.pan || 0))) / W) * 100 + '%'; r.style.top = (Math.max(0, Math.min(H, ev.y + (S.panY || 0))) / H) * 100 + '%'; r.classList.remove('hidden');
  $('guide').innerHTML = `<div class="gcard"><h3>${tr('火に追いつかれた！', 'The flame caught your line!')}</h3>${GUIDE_SVG(tr('始まり', 'START'), tr('火', 'FIRE'), tr('線の先', 'TIP'))}`
    + `<p>${tr('火は、<b>線の始まり</b>から線を追いかけてくる。', 'The flame chases your line from <b>where you started</b>.')}</p>`
    + `<p>${tr('<b>線の先</b>に追いつかれると、その一筆はおしまい。<em>点は半分</em>。', 'If it reaches <b>your fingertip</b>, the stroke ends and scores <em>half POINTS</em>.')}</p>`
    + `<p>${tr('火が近いほど「熱い」＝点 ×2〜×4。熱いうちに<b>自分で指を離す</b>と「見切り」で倍率 +1。', 'Closer flame = HOT = POINTS ×2–×4. <b>Let go yourself</b> while it\'s hot for a Close Call: +1 MULT.')}</p>`
    + `<button class="bigbtn small" id="guideOk">${tr('わかった', 'Got it')}</button></div>`;
  // 札は、追いつかれた所と反対側に（輪を隠さない）。横長の低い画面は左右、それ以外は上下
  const g = $('guide'), sx = (ev.x - (S.pan || 0)) / W, sy = (ev.y + (S.panY || 0)) / H, wide = innerWidth > innerHeight && innerHeight <= 500;
  g.className = wide ? (sx < 0.5 ? 'right' : 'left') : (sy > 0.5 ? 'top' : 'bottom');
}
function closeGuide() {
  if (!S.guide || performance.now() - S.guideAt < 900) return; // 描いていた指を離した瞬間に閉じないように
  S.guide = false; $('guide').classList.add('hidden'); $('guideRing').classList.add('hidden'); audio.ui('tap');
}
$('guide').addEventListener('click', closeGuide);
// 追いつかれた・提灯が消えた: 画面のふちを一瞬、暗く赤く
function hurt() { const e = $('hurt'); e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); }
// 揺れ: 爆心から外へ押す一発。ばらばらの揺れ（R.shake）より向きがあるぶん、どこで起きたかが分かる
function kick(x, y, px) {
  const dx = W / 2 - x, dy = H / 2 - y, l = Math.hypot(dx, dy) || 1;
  R.kickX += (dx / l) * px; R.kickY += (dy / l) * px;
}
function launchFor(s) { const t = Math.max(0.28, s.rise); fx.launch(s.x + (Math.random() - 0.5) * 60, H * 0.84, s.x, s.y, t, PALETTES[s.type]?.[0] || [1, 0.7, 0.3]); }

function handle(ev) {
  const st = S.st;
  switch (ev.type) {
    case 'penDown': $('engi').querySelectorAll('button').forEach((b) => { b.disabled = true; }); audio.scene('burn', 0.3); audio.note(7, { vol: 0.12, dur: 0.2 }); $('combo').classList.add('on'); $('cPts').textContent = fmt(st.stroke?.chips ?? 0); $('cMult').textContent = fmtM(st.stroke?.mult ?? 1); break;
    case 'ignite': audio.note(2, { vol: 0.14, dur: 0.25 }); fx.tick(ev.x, ev.y, [3, 1.8, 0.7], 26, 220); fx.light(ev.x, ev.y, 0.5, 300, [1, 0.6, 0.25], 6); break;
    case 'thread': {
      buzz(10);
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
      R.shake = Math.min(7, R.shake + 0.9 * size);
      kick(s.x, s.y, 1.5 + Math.min(1, size) * 4.5);
      floatText(s.x, s.y, '+' + fmt(ev.pts), ev.pts >= 60 ? 'big' : '', 20 + Math.min(20, ev.pts / 12));
      if (ev.multUp > 0) { floatText(s.x, s.y - 26, `×${fmtM(ev.mult)}`, 'mult', 30); bump($('cMult')); audio.note(16, { vol: 0.14, dur: 0.3 }); }
      if (ev.multUp < 0) floatText(s.x, s.y - 26, `×${fmtM(ev.mult)}`, 'mult', 30);
      if (d.finale) { R.flash = 0.8; R.shake = 22; S.timeScale = 0.45; S.slowT = 0.5; hitStop(120); }
      else if (ev.pts >= 200 || s.type === 'shaku') { hitStop(70); R.flash = Math.max(R.flash, 0.08); }
      else if (ev.multUp > 0) hitStop(17);
      $('cPts').textContent = fmt(ev.chips); $('cMult').textContent = fmtM(ev.mult); bump($('cPts'));
      break;
    }
    case 'chainMark': // 連鎖の節目: 名前と小判
      if (ev.n === 15) techCall('chain');
      floatText(W / 2, H * 0.36, `${ev.n}${tr('連', ' chain')} ${JA() ? ev.ja : ev.en}！ +${ev.coin}`, 'mark', 34);
      audio.note(18 + Math.min(6, ev.coin), { vol: 0.2, dur: 0.5 }); setTimeout(() => audio.note(21 + Math.min(6, ev.coin), { vol: 0.18, dur: 0.6 }), 80);
      R.flash = Math.max(R.flash, 0.1); hitStop(45); renderBags();
      break;
    case 'takiStart': techCall('taki'); banner(`${tr('火の滝', 'FIRE FALLS')}<small>${tr('盤を流れ落ちる！', 'pouring across the board!')}</small>`, 64, 1500); audio.boom(2.2, 0); audio.duck(0.3, 0.5); R.flash = Math.max(R.flash, 0.4); R.shake = 18; break;
    case 'takiFail': floatText(ev.x, ev.y - 50, tr(`滝には火が足りない（${ev.have}/${ev.need}）`, `Not enough fire for the Falls (${ev.have}/${ev.need})`), 'gold', 22, 1600); break;
    case 'taki': for (let i = 0; i < 6; i++) fx.add(ev.x + (Math.random() - 0.5) * 30, ev.y + Math.random() * 12, (Math.random() - 0.5) * 30, 120 + Math.random() * 240, 1.3, 2.4 + Math.random() * 1.6, 0.4, 420, [3, 2.4, 1.4], [1.6, 0.6, 0.2], 1.1); break;
    case 'takiEnd': break;
    case 'mojiStep': { const KN = ['壱', '弐', '参', '肆', '伍']; floatText(ev.x, ev.y - 46, tr(`字玉 ${KN[ev.n - 1]}（${ev.n}/${ev.need}）`, `Glyph ${ev.n}/${ev.need}`), 'gold', 24); audio.note(10 + ev.n * 2, { vol: 0.16, dur: 0.4 }); break; }
    case 'mojiMiss': { const KN = ['壱', '弐', '参', '肆', '伍']; floatText(ev.x, ev.y - 46, tr(`順番がちがう（次は ${KN[ev.want - 1]}）`, `Wrong order (next: ${ev.want})`), 'gold', 22, 1500); break; }
    case 'mojiDone': { const m = mem(); m.sky = (m.sky || 0) + 1; if (m.sky >= 2 && m.sky <= 5) ev.kanji = Mem.SKY_KANA[m.sky - 2]; if (m.sky >= 5 && (m.lore || 0) >= 4) loreUp(5); save(); }
      techCall('moji'); skyKanji(ev.kanji); banner(`<b class="ik">${ev.kanji}</b><small>${tr('文字花火！ 倍率 ×2', 'Sky writing! MULT ×2')}</small>`, 110, 1900, 'ihen'); audio.boom(2.4, 0); R.flash = Math.max(R.flash, 0.5); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); break;
    case 'renStart': techCall('ren'); banner(`${tr('連発', 'STARMINE')}<small>${tr('16 発が次々に！', '16 shots incoming!')}</small>`, 64, 1400); audio.boom(2, 0); R.shake = 14; break;
    case 'renFail': floatText(ev.x, ev.y - 50, tr(`発射台には火が足りない（${ev.have}/${ev.need}）`, `Not enough fire for the Launcher (${ev.have}/${ev.need})`), 'gold', 22, 1600); break;
    case 'renShot': fx.launch(ev.x + (Math.random() - 0.5) * 120, H * 0.86, ev.x, ev.y, 0.32, [1, 0.75, 0.35]); audio.launch(panOf(ev.x)); break;
    case 'renEnd': break;
    case 'seizaStep': {
      floatText(ev.x, ev.y - 40, `★${['一', '二', '三', '四', '五', '六', '七'][ev.n - 1]}`, 'gold', 26); audio.note(12 + ev.n * 2, { vol: 0.17, dur: 0.6 });
      if (ev.from) { const [fx0, fy0] = ev.from, n = 18; for (let i = 0; i <= n; i++) { const u = i / n; fx.add(fx0 + (ev.x - fx0) * u, fy0 + (ev.y - fy0) * u, 0, 0, 3.2, 2.6, 0, 0, [2.2, 2.6, 3.2], [0.8, 1.1, 1.8], 1.4); } } // 星座の線
      break;
    }
    case 'seizaMiss': floatText(ev.x, ev.y - 46, tr(`順番がちがう（次は ★${['一', '二', '三', '四', '五', '六', '七'][ev.want - 1]}）`, `Wrong order (next: ★${ev.want})`), 'gold', 22, 1500); break;
    case 'seizaDone': {
      const s6 = st.shells.find((s) => s.mod === 'seiza' && s.seq === 6), wr = ((st.level.world - 1) % 3) + 1;
      if (s6 && !st.level.endless) { const hx = s6.x + 26, hy = s6.y - 18;
        if (wr === 2) { S.hosei = 2; for (let i = 0; i < 8; i++) S.seq.push({ at: 0.6 + i * 0.05, f: () => fx.add(hx, hy, 0, 0, 0.12, 4.2 - i * 0.4, 0, 0, [2.6, 2.8, 3.2], [2.6, 2.8, 3.2], 1.6) }); }
        if (wr === 3 && lore() >= 2) { S.hosei = 3; for (let i = 0; i < 40; i++) S.seq.push({ at: 0.6 + i * 0.1, f: () => fx.add(hx, hy, 0, 0, 0.14, 4.4, 0, 0, [3, 2.6, 1.6], [3, 2.6, 1.6], 1.8) }); S.seq.push({ at: 0.8, f: () => floatText(hx, hy - 28, tr('灯', 'Akari'), 'gold', 22, 3800) }); } }
    }
    // fallthrough は使わない
    if (ev.type === 'seizaDone') { techCall('seiza'); banner(`${tr('満天', 'SKY ABLAZE')}<small>${tr('北斗七星が結ばれた！ 倍率 ×2', 'The Big Dipper is complete! MULT ×2')}</small>`, 76, 2000); audio.boom(2.6, 0); audio.duck(0.3, 0.6); R.flash = Math.max(R.flash, 0.6); R.shake = 20; $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); } break;
    case 'charmFire': {
      const b = document.querySelector(`#bags .bag[data-id="${ev.id}"]`);
      if (b) { b.classList.remove('fire'); void b.offsetWidth; b.classList.add('fire'); }
      if (ev.dMult && st.stroke) { $('cMult').textContent = fmtM(st.stroke.mult); bump($('cMult')); }
      if (ev.dCoin) { renderBags(); if (ev.x) floatText(ev.x, ev.y + 26, '+' + ev.dCoin, 'coinp', 22); }
      { const c = CHARM_BY_ID[ev.id], now = performance.now(); S.cfAt ||= {};
        if (c && (now - (S.cfAt[ev.id] || 0)) > 600 && (ev.dMult || ev.dPts)) { S.cfAt[ev.id] = now;
          const what = ev.dMult ? tr(`倍率${ev.dMult > 0 ? '+' : ''}${fmtM(ev.dMult)}`, `MULT ${ev.dMult > 0 ? '+' : ''}${fmtM(ev.dMult)}`) : tr(`点+${fmt(Math.round(ev.dPts))}`, `+${fmt(Math.round(ev.dPts))} pts`);
          const x = ev.x ?? W * 0.5, y = ev.y ?? H * 0.3; floatText(x, Math.max(H * 0.16, y - 54), `${JA() ? c.ja : c.en} ${what}`, 'charm', 19, 1100); } }
      break;
    }
    case 'ihen': { // 異変: 大きな字 1 つと、短い一行だけ
      const I = G.IHEN[ev.id];
      banner(`<b class="ik">${I.k}</b><small>${JA() ? I.ja : I.en}${tr('　点 ×1.5', '  POINTS ×1.5')}</small>`, 120, 1700, 'ihen');
      R.flash = Math.max(R.flash, 0.5); R.shake = 26; hitStop(160); audio.boom(2, 0); audio.duck(0.25, 0.5); audio.note(2, { vol: 0.2, dur: 0.9 });
      document.body.classList.add('ihen-' + ev.id);
      if (ev.id === 'katamuku') S.tilt = { a: S.tilt?.a || 0, to: 36 };
      if (ev.id === 'utsuru' && ev.rule) { const wd = { kaze: 'summer', ame: 'winter', kagami: 'demon' }[ev.rule]; if (wd) setTheme(wd); const r = Run.RULES[ev.rule]; setTimeout(() => banner(`${JA() ? r.ja : r.en}<small>${JA() ? r.dj : r.de}</small>`, 56, 1800, 'top'), 1500); }
      $('twistTag').textContent = [$('twistTag').textContent, `${I.k} ${JA() ? I.ja : I.en}`].filter(Boolean).join(' ・ ');
      track(`ihen/${ev.id}`);
      break;
    }
    case 'burnScore': // 点の箱が燃える。燃え落ちた点は、数字の玉になって落ちてくる
      if (ev.take > 0) { const g = $('gScore'); g.classList.remove('burning'); void g.offsetWidth; g.classList.add('burning'); S.shown = st.score; g.textContent = fmt(st.score); floatText(W / 2, H * 0.34, `−${fmt(ev.take)}`, 'burn', 40, 1400); }
      break;
    case 'kazuBack': floatText(ev.x, ev.y - 30, `+${fmt(ev.val)}`, 'gold', 34, 1100); audio.ui('spell'); bump($('gScore')); break;
    case 'kazuLost': floatText(ev.x, H * 0.7, `−${fmt(ev.val)}`, 'lost', 24, 900); audio.note(1, { vol: 0.12, dur: 0.3 }); break;
    case 'ihenClear': floatText(W / 2, H * 0.3, tr('乗り越えた 倍率 +2', 'Overcome! MULT +2'), 'mark', 30, 1200); if (st.stroke) { $('cMult').textContent = fmtM(st.stroke.mult); bump($('cMult')); } break;
    case 'grow': { // 育つお守りが育った
      const b = document.querySelector(`#bags .bag[data-id="${ev.id}"]`);
      if (b) { b.classList.remove('grew'); void b.offsetWidth; b.classList.add('grew'); }
      if (ev.up && ev.x !== undefined) floatText(ev.x, ev.y - 30, tr('育った！', 'Grew!'), 'grow', 20, 800);
      break;
    }
    case 'sleep': // 封じ「札眠り」: この一筆で眠るお守り
      document.querySelectorAll('#bags .bag').forEach((b) => b.classList.toggle('sleep', b.dataset.id === ev.id));
      break;
    case 'heat': {
      const el = $('heat');
      el.className = 'heat' + (ev.lv ? ' on l' + ev.lv : '');
      // 「×N」だと赤い倍率の箱と取り違えるので、点に掛かることを書く。段が上がる音は段ごとに高く
      if (ev.lv) { $('heatTxt').textContent = tr(`熱い！ 点×${G.heatMult(ev.lv, st)}`, `HOT! POINTS ×${G.heatMult(ev.lv, st)}`); if (ev.up) { audio.note(13 + ev.lv * 3, { vol: 0.2, dur: 0.32 }); bump(el); } }
      break;
    }
    case 'held': if (!DB.meta.taught.leash) { DB.meta.taught.leash = 1; toast(tr('線は火から離れすぎると伸びない', 'Your line waits when it gets too far ahead')); } break;
    case 'gustWarn': audio.gust(0.5); if (!DB.meta.taught.gust) { DB.meta.taught.gust = 1; floatText(ev.x, ev.y - 60, tr('白い輪＝突風の合図。先へ逃げろ！', 'White ring = gust coming. Get ahead!'), 'gold', 24, 2200); hitStop(120); } break;
    case 'gust': audio.gust(1); R.shake = Math.min(14, R.shake + 5); fx.tick(ev.x, ev.y, [2.2, 2.6, 3.2], 34, 330); break;
    case 'brake': fx.tick(ev.x, ev.y, [1.6, 0.9, 0.4], 9, 120); break;
    case 'caught': // 追いつかれた: 一瞬止めて、赤く暗く。火の子が筆先に飛びつく
      audio.ui('caught'); hitStop(110); hurt(); buzz([25, 30, 25]);
      floatText(ev.x, Math.max(H * 0.2, ev.y - 80), tr('追いつかれた！ 点 ½', 'Caught! POINTS ½'), 'caught', 40);
      caughtGuide(ev);
      if (ev.pvLost > 0) floatText(ev.x, Math.max(H * 0.2, ev.y - 80) + 40, tr(`星の値 −${ev.pvLost}`, `Star value −${ev.pvLost}`), 'mult', 20);
      renderTech();
      mem().caught++;
      if (ev.waited) {
        const m = mem(); m.waited++; save(); achCheck({});
        const line = Mem.hinokoLine(m.waited);
        if (line) S.seq.push({ at: 0.5, f: () => floatText(ev.x, Math.max(H * 0.18, ev.y - 30), JA() ? line.ja : line.en, 'hinoko', 30, 2900) });
      }
      fx.tick(ev.x, ev.y, [2.6, 0.6, 0.15], 60, 260); fx.light(ev.x, ev.y, 0.9, 260, [1, 0.25, 0.08], 8);
      R.shake = Math.min(14, R.shake + 6); kick(ev.x, ev.y, 9);
      break;
    case 'mikiri': // 見切り: ぎりぎりで自分から離した。空の星屑がぜんぶ筆先に集まる
      audio.ui('mikiri'); hitStop(60); DB.meta.taught.mikiri = 1;
      floatText(ev.x, ev.y - 44, tr('見切り！ 倍率+1', 'CLOSE CALL! +1 MULT'), 'gold', 30); techCall('mikiri');
      if (ev.dustN) {
        floatText(ev.x, ev.y - 78, tr(`星屑 回収 ${ev.dustN} 粒 +${fmt(ev.dustV)}`, `Dust sweep ×${ev.dustN} +${fmt(ev.dustV)}`), 'dustp', 24);
        for (const [x, y, g] of ev.from) { const c = g ? [3, 2.3, 0.8] : [1.6, 2.3, 3.4]; for (let i = 0; i < 4; i++) { const u = 0.16 + i * 0.03; fx.add(x, y, (ev.x - x) / u, (ev.y - y) / u, u, 3.2 - i * 0.5, 0, 0, c, c, 1.6); } }
        audio.note(22, { vol: 0.16, dur: 0.5 }); $('cPts').textContent = fmt(st.stroke?.chips || 0); bump($('cPts'));
      }
      fx.tick(ev.x, ev.y, [2.6, 2.4, 1.4], 30, 220);
      $('cMult').textContent = fmtM(ev.mult); bump($('cMult'));
      break;
    case 'dust': { // 星屑を拾った: 筆先へ吸いこまれる光と、まとめた「+点」
      const c = [1.6, 2.3, 3.4];
      for (let i = 0; i < 3; i++) { const u = 0.1 + i * 0.03; fx.add(ev.x, ev.y, (ev.tx - ev.x) / u, (ev.ty - ev.y) / u, u, 3 - i * 0.6, 0, 0, c, c, 1.5); }
      S.dustAcc += ev.v; S.dustX = ev.tx; S.dustY = ev.ty;
      const now = performance.now(); if (now - S.dustSnd > 45) { S.dustSnd = now; audio.note(16 + ((S.dustN = (S.dustN || 0) + 1) % 8), { vol: 0.05, dur: 0.09 }); }
      if (st.stroke) $('cPts').textContent = fmt(st.stroke.chips);
      break;
    }
    case 'graze': { // かすり: 火と筆のすき間に白い火花。星の値が上がる
      const p = st.stroke?.pts.at(-1); if (p) for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, v = 80 + Math.random() * 120; fx.add((p.x + ev.x) / 2, (p.y + ev.y) / 2, Math.cos(a) * v, Math.sin(a) * v, 0.18, 1.8, 1, 0, [3, 3, 3.2], [1.2, 1.4, 2], 1.6); }
      if (ev.n % 2 === 0) audio.ui('graze');
      renderTech(ev.k % 10 === 0);
      if (ev.k === 30) techCall('graze');
      if (ev.k === 10 || ev.k === 30 || ev.k === 60) floatText(p?.x ?? ev.x, (p?.y ?? ev.y) - 40, tr(`かすり ${ev.k}！`, `Graze ${ev.k}!`), 'graze', 22 + ev.k / 6);
      break;
    }
    case 'engi': { const E = G.ENGI[ev.id]; banner(`${JA() ? E.ja : E.en}<small>${JA() ? E.dj : E.de}</small>`, 44, 1200, 'top'); audio.ui('tsugi'); R.flash = Math.max(R.flash, 0.1);
      if (ev.id === 'kinka' || ev.id === 'yose') for (const o of st.shells) if (o.state === 'idle') fx.tick(o.x, o.y, [3, 2.4, 0.8], 10, 120);
      break; }
    case 'twice': floatText(ev.x, ev.y - 36, tr('二度咲き！', 'Again!'), 'gold', 24); audio.note(19, { vol: 0.15, dur: 0.4 }); break;
    case 'fuseLink': for (const [tx, ty] of ev.to) { const n = 16; for (let i = 0; i <= n; i++) { const u = i / n; fx.add(ev.x + (tx - ev.x) * u, ev.y + (ty - ev.y) * u, 0, 0, 0.3 + u * 0.15, 3, 0, 0, [3.2, 1.2, 0.4], [1, 0.3, 0.05], 1.6); } } audio.note(14, { vol: 0.13, dur: 0.25 }); break;
    case 'glassBreak': floatText(ev.x, ev.y - 36, tr('硝子が割れた', 'Glass shattered'), 'mult', 22); for (let i = 0; i < 26; i++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 260; fx.add(ev.x, ev.y, Math.cos(a) * v, Math.sin(a) * v, 0.5, 2.2, 1.5, 300, [1.4, 2.8, 3.2], [0.4, 0.8, 1], 1.5); } audio.note(26, { vol: 0.12, dur: 0.3 }); break;
    case 'tsugiOpen': // 継ぎ火の輪: ここから次の一筆を始めれば、倍率を持ちこめる
      floatText(ev.x, ev.y - 52, ev.n > 1 ? tr(`ここから継げる（${ev.n} 連）`, `Relight here (×${ev.n})`) : tr('ここから継げる', 'Relight here'), 'gold', 20);
      break;
    case 'tsugi':
      audio.ui('tsugi'); hitStop(40); techCall('tsugi', tr(`倍率 ×${fmtM(ev.mult)} を持ちこんだ`, `Carried ×${fmtM(ev.mult)} MULT`));
      banner(`${tr('継ぎ火', 'RELIGHT')} ${ev.n > 1 ? ev.n + tr(' 連', ' chain') : ''}<small>${tr(`倍率を持ちこんだ ×${fmtM(ev.mult)}`, `MULT carried ×${fmtM(ev.mult)}`)}</small>`, 52, 1000);
      fx.tick(ev.x, ev.y, [3, 1.6, 0.4], 46, 260); fx.light(ev.x, ev.y, 0.8, 280, [1, 0.55, 0.2], 8);
      $('cMult').textContent = fmtM(ev.mult); bump($('cMult'));
      break;
    case 'tsugiLost': if (ev.n >= 2) floatText(W / 2, H * 0.3, tr(`継ぎ火 ${ev.n} 連で途切れた`, `Relight chain ended at ${ev.n}`), 'mult', 22); break;
    case 'spell': { // 技の名乗り: 右に名前とボーナス。初めの一筆は 技の説明も
      const r = Run.RULES[st.rule], bar = $('spellBar');
      $('spLabel').textContent = (ev.oku ? tr('奥義', 'SECRET ART') : tr(`技 其の${'一二三'[ev.i]}`, `TECHNIQUE ${ev.i + 1}`)) + tr('・捕まらずに 6 割ひらけ', ' · open 60% uncaught');
      $('spName').textContent = JA() ? `${r?.ja || ''}「${ev.ja}」` : `${r?.en || ''} "${ev.en}"`;
      bar.className = 'spellbar declare'; void bar.offsetWidth;
      audio.ui('spell'); R.flash = Math.max(R.flash, 0.12);
      if (ev.i === 0 && !DB.meta.taught.spell) { DB.meta.taught.spell = 1; floatText(W / 2, H * 0.32, tr('技: 捕まらずに 6 割ひらけば、ボーナス', 'Technique: open 60% without getting caught for a bonus'), 'spell', 22); }
      break;
    }
    case 'spellGet': case 'spellFail': {
      const got = ev.type === 'spellGet', bar = $('spellBar'), m = DB.meta.spells = DB.meta.spells || {}, rec = m[ev.id] = m[ev.id] || { t: 0, g: 0 };
      rec.t++; if (got) rec.g++;
      bar.classList.add(got ? 'got' : 'fail');
      $('spBonus').textContent = got ? tr(`取得 +${fmt(ev.bonus)}`, `CAPTURED +${fmt(ev.bonus)}`) : tr('失敗', 'FAILED');
      if (got) { banner(`${tr('技を取った！', 'Technique Captured!')}<small>+${fmt(ev.bonus)}　${tr(`（${rec.g} / ${rec.t}）`, `(${rec.g}/${rec.t})`)}</small>`, 54, 1500); audio.ui('win'); }
      setTimeout(() => { if (S.st === st) bar.classList.add('off'); }, 1400);
      break;
    }
    case 'saved': audio.note(20, { vol: 0.2, dur: 0.4 }); toast(tr('踏みとどまった！', 'Survived!')); break;
    case 'cut': fx.tick(ev.x, ev.y, [0.7, 0.9, 1.3], 18, 120); audio.note(0, { vol: 0.14, dur: 0.2 }); break;
    case 'knot': fx.tick(ev.x, ev.y, [3, 2.4, 1], 18, 180); audio.note(19, { vol: 0.16, dur: 0.3 }); floatText(ev.x, ev.y - 26, tr('結び！', 'Knot!'), 'gold', 22); break;
    case 'loopMade': fx.tick(ev.x, ev.y, [2, 2.6, 3.2], 30, 200); audio.note(16, { vol: 0.12, dur: 0.3 }); floatText(ev.x, ev.y - 30, tr(`囲った ${ev.n}`, `Encircled ${ev.n}`), 'gold', 20); break;
    case 'loopBurst': fx.burst('ring', ev.x, ev.y, 110, 'kin', 1); audio.boom(1.1, panOf(ev.x)); techCall('loop', ev.up ? tr(`${ev.n} 玉が一斉に・倍率 +1`, `${ev.n} at once, +1 MULT`) : tr(`${ev.n} 玉が一斉に`, `${ev.n} at once`)); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); break;
    case 'knotBurst': techCall('knot'); fx.burst('ring', ev.x, ev.y, ev.R, 'kin', 1); audio.boom(0.9, panOf(ev.x)); $('cMult').textContent = fmtM(ev.mult); bump($('cMult')); break;
    case 'charmBlast': fx.burst('peony', ev.x, ev.y, ev.R, 'chouchin', 1); audio.boom(1, panOf(ev.x)); break;
    case 'damp': fx.tick(ev.shell.x, ev.shell.y, [0.6, 0.6, 1.4], 8, 110); break;
    case 'inkOut': if (st.stroke) floatText(st.stroke.pts.at(-1).x, st.stroke.pts.at(-1).y - 30, tr('墨切れ', 'Out of ink'), 'gold', 24); break;
    case 'strokeEnd': {
      audio.fuse(0, 0);
      // 夜がまだ決まっていない一筆だけ「夜の途中」にする（勝ち負けが決まった直後に閉じても罰しない）
      if (S.run?.inNight && !st.failed && st.phase !== 'over' && S.rec) {
        const r = S.rec; S.run.inNight = { w: r.def.world, n: r.def.night, used: 1, W: r.W, H: r.H, snap: r.run, ev: r.ev.map((e) => [Math.round(e[0] * 60), ...e.slice(1)]) };
        DB.run = S.run; save();
      }
      $('heat').className = 'heat';
      $('cMult').textContent = fmtM(ev.mult);
      slam(ev.gained);
      if (ev.bloom) { techCall('bloom'); renderStreak(true); skyLine(st); if (st.shape) skyShape(st); grandFinale(); floatText(W * (0.2 + Math.random() * 0.6), H * 0.7, Math.random() < 0.5 ? tr('たまやー！', 'Tamaya!') : tr('かぎやー！', 'Kagiya!'), 'gold', 40); }
      else if (ev.pops >= 15) floatText(W * (0.2 + Math.random() * 0.6), H * 0.72, tr('たまやー！', 'Tamaya!'), 'gold', 30);
      else audio.scene('calm', 0.8);
      renderStrokes(); renderBags();
      break;
    }
    case 'aim': $('combo').classList.remove('on'); renderEngi(); if (st.strokesLeft === 1 && !st.cleared) banner(tr('最後の一筆', 'Last Stroke'), 46, 1100);
      if (!DB.meta.taught.score && st.strokesUsed >= 1) showTeach('score');
      break;
    case 'rise': launchFor(ev.shell); audio.launch(panOf(ev.shell.x)); break;
    case 'cancel': $('combo').classList.remove('on'); audio.scene('calm');
      // 叩いただけで何も起きないと「壊れている」に見える。なぞり方を言い直す（覚えるまで）
      if (!DB.meta.taught.draw) { S.taps = (S.taps || 0) + 1; showTeach('draw'); floatText(W / 2, H * 0.42, tr('指を離さずに、玉から玉へなぞって', 'Hold and drag through the shells'), 'gold', S.taps > 1 ? 30 : 24); }
      break;
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
      banner(`${tr('第 二 幕', 'ENCORE')}<small>${r ? tr(`${r.ja}が怒った！ `, `${r.en} is furious! `) : ''}${tr('もう勝っている。この一筆は稼ぎ放題', 'You already won. This stroke is pure profit')}</small>`, 56, 2600, 'top');
      if (r) drawBoss(r.cast, 'taunt');
      audio.boom(1.8, 0); R.flash = 0.4; R.shake = 16; renderStrokes(); audio.scene('finale', 0.4);
      break;
    }
    case 'intrude': { const t = Run.INTRUDES[ev.kind]; banner(`${JA() ? t.ja : t.en}<small>${JA() ? t.dj : t.de}</small>`, 58, 1900); audio.boom(1, 0); R.shake = Math.min(14, R.shake + 7); R.flash = Math.max(R.flash, 0.12); break; }
    case 'nightEnd': if (S.cnt) S.endAfterCount = true; else nightEnded(); break; // 数え上げの最中なら、数え終わってから
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
  // 3 拍目: ぶつかったあと一呼吸おいて、上の合計が音を上げながら数え上がる（大きいほど長く、最長 1.2 秒）
  if (S.st) S.cnt = { from: S.shown, to: S.st.score, t: -0.28, dur: 0.4 + big * 0.8, ticks: 6 + Math.round(big * 14), k: -1 };
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
  audio.scene('finale', 0.2); audio.ui('win'); hitStop(150);
  R.flash = 0.18; R.shake = 12; kick(W / 2, H * 0.8, 10); S.timeScale = 0.4; S.slowT = 0.8;
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

const MOD_RGB = { gold: [3, 2.2, 0.6], twice: [2.8, 2.8, 3.2], glass: [1, 2.8, 3.2], fuse: [3.2, 1, 0.4], star: [1.4, 2.2, 3.4], taki: [0.6, 2.2, 3.4], moji: [2.4, 1.6, 3.4], renpatsu: [1, 3, 1.4], seiza: [2.4, 2.8, 3.4] };
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
    // 刻印: 玉のまわりを、刻印の色の輪がめぐる
    for (const s of st.shells) {
      if (!s.mod || s.state !== 'idle' || s.rise > 0) continue;
      const c = MOD_RGB[s.mod], n = 12, rr = s.r + 6; if (!c) continue; // 色の無い刻印で毎コマ例外になり、火花の片付けと描画が止まっていた
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + R.time * (s.mod === 'twice' ? -2 : 1.5); fx.add(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 0, 0, one, i % 3 ? 1.7 : 2.8, 0, 0, c, c, 1.2); }
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
    // 星屑: 新しいほど明るく大きい。消える間ぎわは点滅する。十字のきらめき
    const life = st.m.dustLife * (st.m.dustLifeX || 1);
    for (const d of st.dust) {
      const f = 1 - d.t / life, blink = d.t > life - 0.7 ? (Math.sin(R.time * 32 + d.x) > 0 ? 1 : 0.25) : 1;
      const c = d.gold ? [3.2, 2.4, 0.7] : [1.6, 2.5, 3.6], tw = 0.75 + 0.25 * Math.sin(R.time * 9 + d.x * 0.3), sz = (0.75 + f * 0.5) * blink;
      fx.add(d.x, d.y, 0, 0, one, 5.5 * sz, 0, 0, c, c, 1.6 * blink); // 芯
      fx.add(d.x, d.y, 0, 0, one, 14 * sz, 0, 0, c, c, 0.22 * blink); // にじみ
      // 四方に伸びるきらめき（星の形）
      for (let j = 1; j <= 3; j++) { const r = j * 4.2 * sz * tw, s2 = (2.6 - j * 0.6) * sz; fx.add(d.x + r, d.y, 0, 0, one, s2, 0, 0, c, c, blink); fx.add(d.x - r, d.y, 0, 0, one, s2, 0, 0, c, c, blink); fx.add(d.x, d.y + r, 0, 0, one, s2, 0, 0, c, c, blink); fx.add(d.x, d.y - r, 0, 0, one, s2, 0, 0, c, c, blink); }
    }
    // 継ぎ火の輪: 残り時間だけ弧が残る。中に残り火
    if (G.tsugiOpen(st)) {
      const tg = st.tsugi, u = Math.max(0, (tg.until - st.t) / tg.win), rr = st.m.tsugiR * (st.m.tsugiRX || 1), n = 64, col = [3.4, 1.5, 0.35], dim = [1.2, 0.5, 0.15];
      // 外の輪は残り時間の弧（時計回りに減る）。うすい輪で全体の大きさも見せる
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i / n) * 6.283, on = i / n <= u; fx.add(tg.x + Math.cos(a) * rr, tg.y + Math.sin(a) * rr, 0, 0, one, on ? 4.2 : 2, 0, 0, on ? col : dim, on ? col : dim, on ? 2 : 0.7); }
      const pr = rr * (0.35 + 0.65 * ((R.time * 1.6) % 1)); // 内へ寄せる波（ここに置け）
      for (let i = 0; i < 28; i++) { const a = (i / 28) * 6.283; fx.add(tg.x + Math.cos(a) * pr, tg.y + Math.sin(a) * pr, 0, 0, one, 2.2, 0, 0, col, col, 1.2 * (1 - pr / rr) + 0.2); }
      fx.add(tg.x, tg.y, 0, 0, one, 9 + Math.sin(R.time * 12) * 2, 0, 0, [3, 1.2, 0.3], [3, 1.2, 0.3], 1.6);
      fx.light(tg.x, tg.y, 0.12, 200, [1, 0.5, 0.15], 40);
    }
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
      // 見切りの合図: 熱いまま火がすぐ後ろに来たら、覚えるまで（3 回まで）筆先に出す
      const tg = DB.meta.taught;
      if (k.flameOn && k.heatLv >= 1 && gap < st.m.hotGap * 0.5 && gap > 0 && !tg.mikiri && (tg.mikiriN || 0) < 3 && S.mikiriHintFor !== k) {
        S.mikiriHintFor = k; tg.mikiriN = (tg.mikiriN || 0) + 1;
        floatText(pen.x, pen.y - 64, tr('今 離せば 見切り！', 'Let go now: Close Call!'), 'gold', 24, 1300);
      }
      // 熱の段を筆先で読む: 段の数だけ輪が重なる（目は筆先にあるので、上の字だけでは読めない）
      for (let lv = 1; lv <= k.heatLv; lv++) {
        const rr = 20 + lv * 9 + (TOUCH && !touchMode() ? 30 : 0), col = lv >= 3 ? [2.6, 2.8, 3.4] : lv === 2 ? [3.2, 1.6, 0.4] : [3, 0.9, 0.2], n = 16 + lv * 4;
        for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + R.time * (1.5 + lv) * (lv % 2 ? 1 : -1); fx.add(pen.x + Math.cos(a) * rr, pen.y + Math.sin(a) * rr, 0, 0, one, 1.9, 0, 0, col, col, 1.1); }
      }
      if (k.flameOn && gap < st.m.hotGap * 1.6) {
        const r = 14 + Math.max(0, gap) * 0.26 + (TOUCH && !touchMode() ? 30 : 0), col = gap < st.m.hotGap * 0.45 ? [3, 0.5, 0.15] : gap < st.m.hotGap ? [3, 1.4, 0.3] : [1.2, 1, 0.6];
        const nDots = 22;
        for (let i = 0; i < nDots; i++) { const a = (i / nDots) * 6.283 + R.time * 3; fx.add(pen.x + Math.cos(a) * r, pen.y + Math.sin(a) * r, 0, 0, one, 2.1, 0, 0, col, col, 1.3); }
      }
      audio.fuse(k.flameOn ? 1 : 0, k.heatLv);
    } else audio.fuse(k.flameOn && !k.fuseOut ? 0.7 : 0, k.heatLv);
    R.heat += ((k.penDown ? k.heatLv / 3 : 0) - R.heat) * Math.min(1, dt * 8);
    const inkEl = $('inkBar'); inkEl.parentElement.classList.toggle('on', k.penDown); inkEl.style.transform = `scaleX(${Math.max(0, 1 - k.len / (st.ink + st.carriedInk))})`;
  } else { R.heat *= 0.9; $('inkBar').parentElement.classList.remove('on'); }
}

// 満開までの残り: 一筆で盤の玉を全部ひらけば ×2（玉は一筆ごとに足されるので、いまの数を出す）
function renderRemain() {
  const st = S.st, el = $('remain'); if (!st || !DB.meta.taught.bloom) { el.textContent = ''; return; }
  const n = st.shells.filter((s) => s.state === 'idle' && !s.fall).length, k = st.stroke;
  const key = n + '|' + (k && !k.done ? 1 : 0);
  if (S.remainKey === key) return; S.remainKey = key;
  if (!n) { el.textContent = ''; return; }
  const bx = st.m.bloomX + Math.min(6, st.streak);
  el.className = 'remain' + (n <= 3 && k && !k.done ? ' near' : '');
  el.innerHTML = k && !k.done ? tr(`あと<b>${n}</b>玉で満開`, `<b>${n}</b> left for Full Bloom`) + `<small>${tr(`倍率 ×${bx}`, `MULT ×${bx}`)}</small>` : tr(`盤の玉<b>${n}</b>個 ― 一筆で全部ひらけば満開`, `<b>${n}</b> shells — open them all in one stroke for a Full Bloom`) + `<small>${tr(`倍率 ×${bx}`, `MULT ×${bx}`)}</small>`;
}
function updateHud(dt) {
  const st = S.st; if (!st || S.mode !== 'play') return;
  // 一筆の点は「点 × 倍率」の箱で育て、上の合計には一筆が終わってから数え上げて入れる（精算の 3 拍目）
  const c = S.cnt;
  if (c) {
    c.t += dt;
    const u = Math.max(0, Math.min(1, c.t / c.dur)), e = 1 - (1 - u) ** 3;
    S.shown = c.from + (c.to - c.from) * e;
    const step = Math.floor(u * c.ticks);
    if (c.t > 0 && step > c.k) { c.k = step; audio.note(9 + Math.min(step, 22), { vol: 0.07, dur: 0.09 }); }
    if (u >= 1) { S.cnt = null; S.shown = c.to; if (S.endAfterCount) { S.endAfterCount = false; S.seq.push({ at: S.crossedNow ? 0.6 : 0.25, f: () => { if (S.mode === 'play') nightEnded(); } }); } }
  } else S.shown = st.score;
  renderRemain();
  const live = S.shown, goal = S.goalEl || (S.goalEl = document.querySelector('.goal'));
  goal.classList.toggle('counting', !!S.cnt);
  $('gScore').textContent = fmt(S.shown);
  $('gBar').style.width = Math.min(100, (S.shown / (st.target * 2.5)) * 100) + '%';
  const r = live / st.target, stars = $('gStars').children;
  for (let i = 0; i < 3; i++) stars[i].classList.toggle('on', r >= [1, 1.6, 2.5][i]);
  goal.classList.toggle('fire', r >= 1);
  if (r >= 1) goal.style.setProperty('--fire', Math.min(1.6, 0.5 + Math.log(r) / Math.log(5)).toFixed(2));
  // 技のボーナス: 一筆の間、時間で減っていくのを見せる
  const k = st.stroke;
  if (k?.spell && !k.done) $('spBonus').textContent = tr(`ボーナス ${fmt(G.spellBonus(k))}`, `Bonus ${fmt(G.spellBonus(k))}`);
  // 拾った星屑は 0.3 秒ごとにまとめて「+点」を出す（1 粒ずつだと読めない）
  S.dustAt += dt;
  if (S.dustAcc > 0 && S.dustAt > 0.3) { floatText(S.dustX, S.dustY - 36, '+' + fmt(S.dustAcc), 'dustp', 18 + Math.min(14, S.dustAcc / 40)); S.dustAcc = 0; S.dustAt = 0; }
  S.crossedNow = false;
  if (!S.crossed && live >= st.target) { S.crossed = true; S.crossedNow = true; banner(tr('目標達成！', 'TARGET!'), 58, 1200); audio.ui('win'); R.flash = Math.max(R.flash, 0.06); hitStop(80); }
}

// はじめての夜だけ: 動く手本（玉を順に通る火の粉）
function hintFx(dt) {
  const st = S.st; if (!st || S.mode !== 'play' || S.teachKey !== 'draw' || st.phase !== 'aim' || st.strokesUsed > 0) { $('hand').classList.add('hidden'); return; }
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
  hand.classList.remove('hidden'); hand.style.left = ((hx - (S.pan || 0)) / W) * 100 + '%'; hand.style.top = (hy / H) * 100 + '%';
}
// 盤の上の題名（はじめての人の第 1 夜だけ）。触れない飾りで、最初に盤へ触れたら消す
function titleVeil() { const e = $('tveil'); if (!e) return; $('tveilSub').textContent = tr('線を引け。火が追いかけてくる。', 'Draw the line. The fire is right behind you.') /* やり方は下の札が言う。ここは引き */; e.classList.remove('hidden', 'off'); PF.ev('title_veil', {}); }
function hideVeil(how) { if (!S.tveil) return; S.tveil = 0; const e = $('tveil'); if (e) { e.classList.add('off'); setTimeout(() => e.classList.add('hidden'), 700); } if (how) PF.ev('first_touch', { how, sec: Math.round(performance.now() / 1000) }); }
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
  if (!document.hidden && !S.paused && !S.adPause && S.mode !== 'title') {
    S.activeT = (S.activeT || 0) + dt;
    const MS = [2, 5, 10, 15, 20, 30]; const n = MS.findIndex((m) => m * 60 > S.activeT);
    const passed = n < 0 ? MS.length : n; if (passed > (S.minSent || 0)) { S.minSent = passed; PF.ev('play_min', { m: MS[passed - 1] }); }
  }
  frames++; fpsT += dt; if (fpsT > 0.5) {
    fps = frames / fpsT; frames = 0; fpsT = 0; if (S.fpsEl) S.fpsEl.textContent = `${fps.toFixed(0)} fps ${fx.live()} p x${scaleMax.toFixed(2)}`;
    slowCount = fps < 42 && !document.hidden ? slowCount + 1 : 0;
    if (slowCount >= 6 && scaleMax > 0.6) { scaleMax = Math.max(0.6, scaleMax * 0.75); slowCount = 0; resize(); }
  }
  try {
    if (S.paused || S.adPause) { dt = 0; }
    if (S.stopT > 0) S.stopT -= dt;
    if (S.stopCool > 0) S.stopCool -= dt;
    const stopped = S.stopT > 0;
    if (S.slowT > 0 && !stopped) { S.slowT -= dt; if (S.slowT <= 0) S.timeScale = 1; }
    const sdt = stopped ? dt * 0.08 : dt * S.timeScale;
    if (S.mode === 'play' && S.st && !S.paused && !stopped && !S.guide) {
      acc += sdt;
      while (acc >= G.DT && S.mode === 'play' && !S.guide) { acc -= G.DT; G.step(S.st, G.DT); const evs = S.st.events.splice(0); for (const ev of evs) { try { handle(ev); } catch (e) { console.error('handle', ev.type, e); } } }
      const st = S.st;
      if (st.phase === 'stroke' && st.stroke && !st.stroke.penDown && S.slowT <= 0) {
        const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0).length;
        if (idle === 0 && st.pending.length === 1 && st.stroke.pops > 3) { S.timeScale = 0.3; S.slowT = 0.6; S.focus = st.pending[0].s; }
      }
    }
    // 満開がかかった最後の玉へ、ゆっくり寄る（ゆっくりが終わったら戻る）
    const zt = S.focus && S.slowT > 0 && S.mode === 'play' ? 1.2 : 1;
    if (zt === 1) S.focus = null;
    R.zoom += (zt - R.zoom) * Math.min(1, dt * (zt > 1 ? 5 : 3));
    if (S.focus) { S.fx0 = S.focus.x; S.fy0 = S.focus.y; }
    R.camX = (R.zoom > 1.001 ? -((S.fx0 ?? W / 2) - W / 2) * (R.zoom - 1) : 0) - (S.pan || 0);
    panFrame(dt);
    R.camY = (R.zoom > 1.001 ? -((S.fy0 ?? H / 2) - H / 2) * (R.zoom - 1) : 0) + (S.panY || 0);
    if (S.mode === 'title') titleFx(dt);
    if (S.mode === 'senko' && !S.paused) senkoFx(dt);
    for (let i = S.seq.length - 1; i >= 0; i--) { const e = S.seq[i]; e.at -= dt; if (e.at <= 0) { S.seq.splice(i, 1); e.f(); } }
    if (!S.paused) { perFrameFx(sdt); hintFx(sdt); fx.update(sdt); }
    R.lights = fx.lights;
    R.flash *= Math.exp(-dt * 6); R.shake *= Math.exp(-dt * 9);
    // 蹴りはばねで戻す（行き過ぎて少し揺れ返す）
    S.kvx = ((S.kvx || 0) - R.kickX * 900 * dt) * Math.exp(-dt * 18); S.kvy = ((S.kvy || 0) - R.kickY * 900 * dt) * Math.exp(-dt * 18);
    R.kickX += S.kvx * dt; R.kickY += S.kvy * dt;
    if (Math.abs(R.kickX) + Math.abs(R.kickY) < 0.05 && Math.abs(S.kvx) + Math.abs(S.kvy) < 1) { R.kickX = R.kickY = S.kvx = S.kvy = 0; }
    R.render(sdt, fx, drawWorld);
    updateHud(dt); ihenFrame(dt);
  } catch (err) { if (!S.fatal) { S.fatal = err; console.error(err); } }
}

// ------------------------------------------------------------------ 起動
async function boot() {
  performance.mark('b0');
  await PF.init(); performance.mark('b_pf');
  PF.loadingStart();
  PF.onMute = () => applySound(); // 消音が解けたら効果音も曲も戻す
  applySound();
  // 場の言葉に合わせる（自分で選んだ言葉・?lang= が先）
  if (PF.lang && !q.get('lang') && !DB.lang) lang = PF.lang;
  // 場の一時停止・広告の間は止めて、音を消す
  PF.onPause = (p) => { audio.mute(p); if (p && S.mode === 'play' && !S.paused) openPause(); };
  PF.onAd = (on) => { S.adPause = on; audio.mute(on); };
  if (PF.ready) { const j = await PF.load(SAVE); if (j) { try { const c = JSON.parse(j); if ((c.meta?.xp || 0) >= (DB.meta.xp || 0)) { Object.assign(DB, c); S.run = DB.run; } } catch { /* */ } } }
  // 玉の字の筆文字は 0.25 秒だけ待つ。間に合わなければ、ふつうの字で始めて、届いたら描きなおす（遅い回線で起動を止めない）
  const glyphs = '一筆花火金大千灯雫氷鬼尺' + CHARMS.map((c) => c.ja[0]).join('');
  const fontP = document.fonts.load('900 60px "Yuji Boku"', glyphs).catch(() => null);
  const fontOk = await Promise.race([fontP.then(() => true), new Promise((r) => setTimeout(() => r(false), 250))]);
  performance.mark('b_font'); atlasTex = R.texture(shellAtlas()); performance.mark('b_atlas');
  if (!fontOk) fontP.then(() => { if (document.fonts.check('900 60px "Yuji Boku"', glyphs)) atlasTex = R.texture(shellAtlas()); });
  S.themeKey = 'summer';
  resize();
  performance.mark('b_resize'); await loadBand('summer'); performance.mark('b_band');
  layoutBand();
  toTitle(); performance.mark('b_title');
  if (q.has('debug')) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:8px;top:60px;font:12px monospace;color:#7f7;z-index:9'; document.body.append(d); S.fpsEl = d; }
  requestAnimationFrame(frame);
  PF.loadingStop();
  S.booted = true;
  audio.prefetch(); // 遊べる状態になったら曲を先に読み始める（最初のタップですぐ鳴る）
  // 起動した時点で音の箱を作ってみる。親のページ（Playgama は枠に autoplay を許している）で押して入ってきたなら、題名画面から曲が鳴る。
  // 許されなければ止まったまま待ち、最初に触れたとき（pointerup・click など）に動き出す
  try { audio.unlock(); } catch { /* 無くても遊べる */ }
  if (!window.HANABI_PG) try { sessionStorage.removeItem('hanabiRetry'); } catch { /* 無くても動く */ }
  // 新しい人も題名画面から（何のゲームか分かってから始める。「あそぶ」の 1 回が音を確実に鳴らせる操作にもなる）。撮影などは ?play=1
  // 11/16 の数字: 題名画面から始めると、読み込んだ人の約半分が「あそぶ」を押さずに帰った（その前はほぼ全員が第 1 夜へ）。
  // はじめての人は第 1 夜の盤の上に題名を重ね、玉をなぞると題名が消えてそのまま遊べる。続きのある人・遊んだことのある人は題名画面から。撮影などは ?play=1、題名画面の確認は ?title=1
  const fresh = !DB.run && !(DB.meta.runs > 0) && !q.has('title');
  if ((q.has('play') && !DB.run) || fresh) { if (fresh && !q.has('play')) S.tveil = 1; beginRun(); if (S.tveil) titleVeil(); }
}

// ------------------------------------------------------------------ 世界ランキング
// 1 周の記録（筆の動きと屋台の操作）を残し、終わったら送る。サーバーはありえない点だけを弾き、
// 上位は手元の確かめ役（_dev/hanabi2-verify.mjs → hanabi/verify.js）が本物のルールで流しなおして、合わないものを隠す
const LOGKEY = 'hanabi2_log';
function logStart(run) { S.log = { v: Run.LOG_VERSION, ps: 1, dn: 1, gr: run.grand ? 1 : 0, rv: run.rv || 1, as: run.assist ? 1 : 0, seed: run.seed, fuse: run.fuse, rank: run.rank, school: run.school, daily: !!run.daily, xp: DB.meta.xp || 0, ops: [] }; logSave(); }
function logOp(...op) { if (S.log) S.log.ops.push(op); }
function logSave() { if (!S.log || window.HANABI_PG) return; try { localStorage.setItem(LOGKEY, JSON.stringify(S.log)); } catch { /* 大きすぎる・保存できない環境: ランキングに出ないだけ */ } }
// 読みなおしたときは、続きの周回と同じ種の記録だけを使う
if (!window.HANABI_PG) try { const L = JSON.parse(localStorage.getItem(LOGKEY) || 'null'); if (L && S.run && L.seed === S.run.seed && L.v === Run.LOG_VERSION) S.log = L; } catch { /* なし */ }
const RANK_API = (() => { const o = q.get('rankapi'); return o && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) ? o : 'https://hanabi2-rank.yuichi916.workers.dev'; })();
S.rankOk = false;
// アプリ化（PWA）: 本番のサイトでだけ登録する（ゲームサイトの書き出しでは登録しない）
if (!window.HANABI_PKG && location.hostname === 'yuichi916.github.io' && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* 無くても遊べる */ });
// ランキングを見に行くのは本番のサイトと、?rankapi= を付けた手元の試験だけ（手元の通しでサーバーへ問い合わせない）
if (!window.HANABI_PKG && (location.hostname === 'yuichi916.github.io' || q.get('rankapi'))) fetch(RANK_API + '/health').then((r) => r.json()).then((j) => { S.rankOk = !!j.ok && j.v === Run.LOG_VERSION; if (S.rankOk && S.mode === 'title') toTitle(); }).catch(() => { /* ランキングが無くても遊べる */ });
function playerId() {
  if (!/^[a-f0-9]{32}$/.test(DB.meta.player || '')) { const a = new Uint8Array(16); crypto.getRandomValues(a); DB.meta.player = [...a].map((x) => x.toString(16).padStart(2, '0')).join(''); save(); }
  return DB.meta.player;
}
const dayKey = () => { const d = new Date(); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };
async function gzipB64(text) {
  const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}
const boardName = (b) => (b.daily ? tr(`今日の祭り（${b.day.slice(4, 6)}/${b.day.slice(6)}）`, `Daily (${b.day.slice(4, 6)}/${b.day.slice(6)})`) : tr(`歴代 段位 ${b.rank + 1}・${Run.schoolOf(b.school).ja}`, `All-time Rank ${b.rank + 1} · ${Run.schoolOf(b.school).en}`));
// 終わった周回を送る。名前がまだなら、終わりの画面で聞く
function rankSubmit(run, log) {
  const box = $('ovRank'); if (!box) return;
  box.innerHTML = '';
  if (!S.rankOk || !log || log.as || !log.ops.some((o) => o[0] === 'n')) return; // 練習の周（as）は出さない
  const board = { daily: !!log.daily, day: String(log.seed), rank: run.rank, school: run.school };
  const send = async () => {
    box.innerHTML = `<small>${tr('世界ランキングに送っています…', 'Sending to the world ranking...')}</small>`;
    try {
      const body = { v: Run.LOG_VERSION, player: playerId(), name: DB.meta.rankName, daily: board.daily, day: board.day, rank: run.rank, school: run.school, fuse: run.fuse, score: run.totalScore, nights: run.nightsCleared, won: !!run.won, log: await gzipB64(JSON.stringify(log)) };
      const r = await fetch(RANK_API + '/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'ng');
      box.innerHTML = `<b>${boardName(board)}</b> ${tr(`世界 ${j.place} 位`, `#${j.place} in the world`)} <small>/ ${j.count}${tr(' 人', '')}${j.kept ? tr('（前の記録のほうが上）', ' (your earlier record is higher)') : ''}</small> <button class="btn2" id="ovRankBtn">${tr('ランキングを見る', 'View ranking')}</button>`;
      $('ovRankBtn').onclick = () => { audio.ui('tap'); openRank(board.daily ? 'daily' : 'all', board); };
      track('rank/submit');
    } catch (e) { box.innerHTML = `<small>${tr('ランキングに送れなかった（あとで遊んだ分は送れます）', 'Could not reach the ranking')}</small>`; }
  };
  if (DB.meta.rankName) { send(); return; }
  box.innerHTML = `<div class="rankname"><small>${tr('世界ランキングに載せる名前（12 字まで）', 'Name for the world ranking (max 12)')}</small><input id="rkName" maxlength="12" autocomplete="off"><button class="btn2" id="rkSend">${tr('載せる', 'Submit')}</button><button class="btn2 ghost" id="rkSkip">${tr('載せない', 'Skip')}</button></div>`;
  $('rkSend').onclick = () => {
    const n = cleanName($('rkName').value);
    if (!n) { toast(tr('その名前は使えない', 'That name can\'t be used')); return; }
    DB.meta.rankName = n; save(); audio.ui('tap'); send();
  };
  $('rkSkip').onclick = () => { audio.ui('tap'); box.innerHTML = ''; };
}
// ランキングの画面: 今日の祭り / 歴代（段位・流派ごと）
// Playgama のランキング（Bridge SaaS、1 周の合計の点の自己ベスト）
async function openPgRank() {
  show('rankScr'); $('hud').classList.add('hidden');
  const el = $('rankPanel'); S.pgRankAt = performance.now(); const at = S.pgRankAt;
  el.innerHTML = `<h2>${tr('ランキング', 'Leaderboard')}</h2><p class="rknote">${tr('1 周の合計の点（自己ベスト）', 'Best total score in one run')}</p><div class="rklist"><small>${tr('読みこみ中…', 'Loading...')}</small></div>`
    + `<p class="rknote">${tr(`あなたの自己ベスト ${fmt(DB.meta.bestScore || 0)} 点`, `Your best: ${fmt(DB.meta.bestScore || 0)}`)}</p><div class="row"><button class="btn2" id="rkBack">${tr('もどる', 'Back')}</button></div>`;
  $('rkBack').onclick = () => { audio.ui('tap'); toTitle(); };
  const list = await PF.lbTop(); if (S.pgRankAt !== at) return;
  const me = PF.playerId;
  const rows = (list || []).slice(0, 50).map((r, i) => `<div class="rkrow${me && r.id === me ? ' me' : ''}"><b>${r.rank || i + 1}</b><span class="nm">${esc(r.name || tr('名無し', 'Guest'))}</span><span></span><span class="sc">${fmt(r.score || 0)}</span></div>`).join('');
  el.querySelector('.rklist').innerHTML = rows || `<small>${list ? tr('まだ誰もいない。最初の名前になろう', 'No one yet. Be the first!') : tr('ランキングを読めなかった', 'Could not load the leaderboard')}</small>`;
}
async function openRank(tab = 'daily', pick = null) {
  show('rankScr'); $('hud').classList.add('hidden');
  S.rankView = { tab, rank: pick?.rank ?? S.rankView?.rank ?? 0, school: pick?.school ?? S.rankView?.school ?? 'hon' };
  const v = S.rankView, el = $('rankPanel');
  const tabs = `<div class="rktabs"><button class="${v.tab === 'daily' ? 'on' : ''}" data-t="daily">${tr('今日の祭り', 'Daily')}</button><button class="${v.tab === 'all' ? 'on' : ''}" data-t="all">${tr('歴代', 'All-time')}</button></div>`;
  const sel = v.tab === 'all' ? `<div class="rksel"><select id="rkRank">${Run.RANKS.map((r, i) => `<option value="${i}"${i === v.rank ? ' selected' : ''}>${tr('段位', 'Rank')} ${i + 1} ${JA() ? r.ja : r.en}</option>`).join('')}</select><select id="rkSchool">${Run.SCHOOLS.map((s) => `<option value="${s.id}"${s.id === v.school ? ' selected' : ''}>${JA() ? s.ja : s.en}</option>`).join('')}</select></div>` : `<div class="rksel"><small>${tr('全員が同じ盤。毎日 9 時（日本時間）に入れかわる', 'Everyone plays the same board. Resets daily at 00:00 UTC')}</small></div>`;
  el.innerHTML = `<h2>${tr('世界ランキング', 'World Ranking')}</h2>${tabs}${sel}<div class="rklist"><small>${tr('読みこみ中…', 'Loading...')}</small></div><div class="row"><button class="btn2" id="rkBack">${tr('もどる', 'Back')}</button>${v.tab === 'daily' ? `<button class="bigbtn small" id="rkPlay">${tr('今日の祭りを遊ぶ', 'Play the Daily')}</button>` : ''}</div><small class="rknote">${tr('✓ は、本物のルールで流しなおして確かめた記録', '✓ = replayed and verified with the real rules')}</small>`;
  el.querySelectorAll('.rktabs button').forEach((b) => { b.onclick = () => { audio.ui('tap'); openRank(b.dataset.t); }; });
  if ($('rkRank')) { $('rkRank').onchange = (e) => { v.rank = +e.target.value; openRank('all'); }; $('rkSchool').onchange = (e) => { v.school = e.target.value; openRank('all'); }; }
  $('rkBack').onclick = () => { audio.ui('tap'); toTitle(); };
  if ($('rkPlay')) $('rkPlay').onclick = () => { audio.ui('tap'); startDaily(); };
  const board = v.tab === 'daily' ? `d:${dayKey()}` : `a:${v.rank}:${v.school}`;
  try {
    const j = await (await fetch(`${RANK_API}/top?board=${encodeURIComponent(board)}&player=${playerId()}`)).json();
    if (S.rankView !== v) return;
    const rows = (j.top || []).map((r, i) => `<div class="rkrow${r.me ? ' me' : ''}"><b>${i + 1}</b><span class="nm">${esc(r.name)}${r.verified ? ' <i class="ok">✓</i>' : ''}</span><span>${tr(`${r.nights} 夜`, `${r.nights} nights`)}${r.won ? ' ★' : ''}</span><span class="sc">${fmt(r.score)}</span></div>`).join('');
    const me = j.me && !(j.top || []).some((r) => r.me) ? `<div class="rkrow me"><b>${j.me.place}</b><span class="nm">${esc(j.me.name)}</span><span>${tr(`${j.me.nights} 夜`, `${j.me.nights} nights`)}</span><span class="sc">${fmt(j.me.score)}</span></div>` : '';
    el.querySelector('.rklist').innerHTML = rows ? rows + me : `<small>${tr('まだ誰もいない。最初の名前になろう', 'No one yet. Be the first!')}</small>`;
  } catch { el.querySelector('.rklist').innerHTML = `<small>${tr('ランキングに届かない', 'Could not reach the ranking')}</small>`; }
}
// ------------------------------------------------------------------ 異変の見せ方
// 「傾」は画面（盤・字の層）を奥へ傾ける。角度は毎コマ自分で動かし、指の位置はその角度で逆算して盤にもどす
const TILT_D = 900;
const TILT_EL = () => [$('c'), $('float'), $('zoneLabels'), $('kazuLabels')];
function untilt(cx, cy) {
  const t = S.tilt; if (!t || t.a < 0.05) return [cx, cy];
  const a = (t.a * Math.PI) / 180, ox = innerWidth / 2, oy = innerHeight / 2, U = cx - ox, V = cy - oy;
  const v = (V * TILT_D) / (TILT_D * Math.cos(a) + V * Math.sin(a)), s = TILT_D / (TILT_D - v * Math.sin(a));
  return [ox + U / s, oy + v];
}
function ihenReset() {
  S.tilt = null; for (const el of TILT_EL()) if (el) el.style.transform = '';
  for (const id of Object.keys(G.IHEN)) document.body.classList.remove('ihen-' + id);
  const k = $('kazuLabels'); if (k) k.innerHTML = ''; S.kazuEls = new Map();
}
function ihenFrame(dt) {
  if (S.tilt) {
    const t = S.tilt; t.a += (t.to - t.a) * Math.min(1, dt * 2.2);
    const tf = `perspective(${TILT_D}px) rotateX(${t.a.toFixed(2)}deg)`;
    for (const el of TILT_EL()) if (el) el.style.transform = tf;
  }
  // 数字の玉（燃え落ちた点）に、いくらかを書いた札をつける
  const box = $('kazuLabels'), st = S.st; if (!box) return; S.kazuEls ||= new Map();
  const live = new Set();
  if (st && S.mode === 'play') for (const s of st.shells) if (s.type === 'kazu' && s.state === 'idle') {
    live.add(s.id); let e = S.kazuEls.get(s.id);
    if (!e) { e = document.createElement('div'); e.className = 'kz'; e.textContent = fmt(s.val); box.append(e); S.kazuEls.set(s.id, e); }
    e.style.left = ((s.x - (S.pan || 0)) / W) * 100 + '%'; e.style.top = (s.y / H) * 100 + '%';
  }
  for (const [id, e] of S.kazuEls) if (!live.has(id)) { e.remove(); S.kazuEls.delete(id); }
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

window.HANABI = { PF, nightEnded: () => nightEnded(), rankSubmit, openRank, RANK_API: () => RANK_API, S, G, Run, R, fx, audio, DB, replayScore, startNight, beginRun, grandFinale, openSenko, skyLine, skyShape, get W() { return W; }, get H() { return H; }, toWorld, nightEnded, runOver, peekNext };
boot();
