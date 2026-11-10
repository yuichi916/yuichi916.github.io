// 一筆花火 物語モード: 章の型（_dev/hanabi-chapter-contract.md）に沿った章を、順に遊ぶ
// 遊ぶ人は灯（あかり）。姿は出さず、筆そのものとして描く。追ってくる火の子「ヒノコ」は、最後まで口をきかない。
import { createRenderer } from './gl.js';
import { createFx, PALETTES } from './fx.js';
import { createAudio } from './audio.js';
import { shellAtlas, noiseTex, placeholderBand, ATLAS_CELLS, HINOKO_CELL, cellOf, SHELL_ORDER } from './art.js';
import { storyAtlas, STORY_COLS, storyCell } from './story-art.js';
import { THEMES } from './levels.js';
import { drawCast } from '../assets/hitofude/cast.js';
import { drawHinoko } from '../assets/hitofude/hinoko.js';
import { CHAPTERS } from './ch/index.js';
import { SCRIPT, FINALE_PRE, FINALE_END, PROLOGUE } from './script.js';
import { track, share, canShare } from './track.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const canvas = $('c');
const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || /Mobi|Android/i.test(navigator.userAgent);
const R = createRenderer(canvas, { quality: lowEnd ? 'low' : 'high' });
if (!R) { document.body.innerHTML = '<p style="padding:2em">This game needs WebGL2.</p>'; throw new Error('no webgl2'); }
const fx = createFx(lowEnd ? 7000 : 26000);
R.noiseTex = R.texture(noiseTex(), { repeat: true });
const BGM = '../assets/hitofude/bgm/';
const audio = createAudio([
  ['calm', BGM + 'hitofude_calm.mp3', { loopStart: 1.17, gain: 0.5 }],
  ['burn', BGM + 'hitofude_burn.mp3', { gain: 0.8 }],
  ['finale', BGM + 'hitofude_finale.mp3', { gain: 0.9 }],
]);
const SAVE = 'hanabi2story';
const DB = (() => { try { return { done: {}, stars: {}, ...JSON.parse(localStorage.getItem(SAVE) || '{}') }; } catch { return { done: {}, stars: {} }; } })();
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(DB)); } catch { /* 保存できなくても遊べる */ } };

// 夜空。章は CHAPTER.sky に、この名前か THEMES の名前を書く
const SKY = {
  ...THEMES,
  tanabata: { ...THEMES.summer, moon: [1.6, -1], moonR: 0.001, stars: 2.2, seed: 0.53 },
  okuribi: { ...THEMES.summer, hor: [0.07, 0.022, 0.03], moon: [0.18, 0.5], moonR: 0.05, stars: 0.8, seed: 0.91 },
  toro: { ...THEMES.summer, hor: [0.05, 0.03, 0.06], moon: [0.86, 0.14], moonR: 0.045, stars: 1.2, seed: 0.21 },
  yado: { ...THEMES.summer, top: [0.004, 0.003, 0.012], mid: [0.01, 0.006, 0.02], hor: [0.04, 0.02, 0.03], moon: [0.12, 0.16], moonR: 0.04, stars: 0.7, seed: 0.66 },
  yukiyama: { ...THEMES.winter, stars: 1.5, seed: 0.33 },
  kitsune: { ...THEMES.summer, top: [0.012, 0.016, 0.04], mid: [0.03, 0.04, 0.08], hor: [0.09, 0.07, 0.09], moon: [0.5, 0.12], moonR: 0.06, stars: 0.6, seed: 0.44 },
  hyakki: { ...THEMES.demon, stars: 0.8, seed: 0.19 },
  ie: { ...THEMES.summer, hor: [0.06, 0.04, 0.03], moon: [0.8, 0.2], moonR: 0.05, stars: 1.4, seed: 0.77 },
};

let W = 1280, H = 720, atlasTex = null, storyTex = null;
const S = { mode: 'menu', ch: null, st: null, F: null, seq: [], booted: false, onResult: null, talking: null, skipTalk: null, opt: {}, mem: {}, auto: false };

// ------------------------------------------------------------------ 町の帯
function setBand(a, c, waterFrac) { R.band = { night: R.texture(a), flash: R.texture(c), waterFrac, aspect: a.width / a.height, rect: [0, 0.5, 1, 0.5], waterY: 0.88 }; layoutBand(); }
function layoutBand() {
  if (!R.band) return;
  const b = R.band, land = W >= H, hPx = land ? W / b.aspect : Math.max(H * 0.33, 300), wPx = hPx * b.aspect, rw = wPx / W, rh = hPx / H;
  b.rect = [(1 - rw) / 2, 1 - rh, rw, rh]; b.waterY = 1 - rh * b.waterFrac;
}
const img = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
const bandCache = {};
async function loadBand(key) {
  if (!bandCache[key]) bandCache[key] = (async () => {
    try {
      const meta = await fetch(`art/${key}/band.json`).then((r) => { if (!r.ok) throw 0; return r.json(); });
      const [a, c] = await Promise.all([img(`art/${key}/band_night.webp`), img(`art/${key}/band_flash.webp`)]);
      return [a, c, meta.waterFrac];
    } catch { const ph = placeholderBand(); return [ph.night, ph.flash, ph.waterFrac]; }
  })();
  const [a, c, f] = await bandCache[key]; setBand(a, c, f);
}
let skyKey = 'tanabata', bandKey = 'summer';
async function setScene(sky, band) { skyKey = SKY[sky] ? sky : 'summer'; R.bakeSky(SKY[skyKey], W / H); if (band !== bandKey) { bandKey = band; await loadBand(band); } }
function resize() {
  const cw = innerWidth, ch = innerHeight, dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.75);
  const pw = W, ph = H;
  if (cw >= ch) { H = 720; W = Math.round((720 * cw) / ch); } else { W = 720; H = Math.round((720 * ch) / cw); }
  R.resize(cw, ch, dpr, W, H);
  if (pw !== W || ph !== H || !R.skyTex) R.bakeSky(SKY[skyKey], W / H);
  layoutBand();
  if ((pw !== W || ph !== H) && S.ch && S.st && S.st.phase === 'aim') S.st = S.ch.mod.newStage(S.st.lv, W, H, S.opt);
}
addEventListener('resize', resize);

// ------------------------------------------------------------------ 言葉
const WHO = {
  neko: { name: 'ねこ屋のトラ', cast: 'neko' }, tanuki: { name: '宿の狸', cast: 'tanuki' }, yukionna: { name: '雪女', cast: 'yukionna' }, kitsune: { name: '狐', cast: 'kitsune' },
  tengu: { name: '天狗', cast: 'tengu' }, kamaitachi: { name: '鎌鼬', cast: 'kamaitachi' }, yamabiko: { name: '山彦', cast: 'yamabiko' },
  hinoko: { name: '？？？', face: (g, f) => drawHinoko(g, 100, 112, 52, { face: f || 'idle', still: true }) },
  hinoko2: { name: 'ヒノコ', face: (g, f) => drawHinoko(g, 100, 112, 52, { face: f || 'joy', still: true }) },
  book: { name: '秘伝帳', cls: 'book', face: (g) => { g.fillStyle = '#7a2a12'; g.fillRect(52, 40, 96, 128); g.fillStyle = '#efe4cd'; g.fillRect(62, 52, 76, 104); g.fillStyle = '#2a1608'; g.font = '900 34px "Yuji Boku", serif'; g.textAlign = 'center'; g.fillText('秘', 100, 98); g.fillText('伝', 100, 140); } },
  memory: { name: '記憶', cls: 'book', face: (g) => { g.fillStyle = '#fff4d8'; g.fillRect(56, 44, 88, 112); g.fillStyle = '#e07a2a'; g.fillRect(68, 58, 64, 46); } },
  star: { name: '星の声', face: (g) => { const gr = g.createRadialGradient(100, 100, 2, 100, 100, 70); gr.addColorStop(0, '#fff'); gr.addColorStop(0.2, '#bcd8ff'); gr.addColorStop(1, '#bcd8ff00'); g.fillStyle = gr; g.fillRect(0, 0, 200, 200); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 34, a = (i / 10) * 6.283 - 1.57; g.lineTo(100 + Math.cos(a) * r, 100 + Math.sin(a) * r); } g.fill(); } },
  kasasagi: { name: '鵲', face: (g) => { g.fillStyle = '#111a2e'; g.strokeStyle = '#cfe0ff'; g.lineWidth = 4; g.beginPath(); g.moveTo(30, 96); g.quadraticCurveTo(70, 50, 96, 92); g.quadraticCurveTo(130, 50, 170, 96); g.quadraticCurveTo(130, 92, 112, 120); g.lineTo(100, 150); g.lineTo(88, 120); g.quadraticCurveTo(70, 92, 30, 96); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.fillRect(78, 98, 44, 10); } },
  warashi: { name: '座敷わらし', face: (g) => { g.fillStyle = '#d2283a'; g.beginPath(); g.moveTo(66, 180); g.lineTo(80, 120); g.lineTo(120, 120); g.lineTo(134, 180); g.fill(); g.fillStyle = '#ffe2c8'; g.beginPath(); g.arc(100, 96, 30, 0, 7); g.fill(); g.fillStyle = '#1a1018'; g.beginPath(); g.arc(100, 88, 32, Math.PI, 0); g.fill(); g.fillRect(68, 86, 64, 14); g.fillRect(88, 100, 5, 6); g.fillRect(107, 100, 5, 6); } },
};

function say(lines) {
  if (DB.skipTalk || !lines || !lines.length) return Promise.resolve();
  return new Promise((done) => {
    const dlg = $('dlg'), face = $('dFace'), g = face.getContext('2d');
    let i = -1, shown = 0, full = '', tick = null;
    const next = () => {
      if (tick && shown < full.length) { shown = full.length; $('dText').textContent = full; return; }
      i++;
      if (i >= lines.length) { clearInterval(tick); tick = null; dlg.classList.add('hidden'); S.talking = null; S.skipTalk = null; done(); return; }
      const l = lines[i], w = WHO[l.who] || WHO.neko;
      dlg.className = w.cls || (l.who.startsWith('hinoko') ? 'hinoko' : '');
      $('dName').textContent = w.name; g.clearRect(0, 0, 200, 200);
      try { if (w.cast) drawCast(g, w.cast, 100, 106, 150, { face: l.face || 'idle', still: true, glow: false }); else w.face(g, l.face); } catch { /* 絵が無くても読める */ }
      full = l.text; shown = 0; $('dText').textContent = '';
      clearInterval(tick);
      tick = setInterval(() => { shown = Math.min(full.length, shown + 1); $('dText').textContent = full.slice(0, shown); if (shown >= full.length) { clearInterval(tick); tick = null; } if (shown % 3 === 0 && l.who !== 'book' && l.who !== 'memory') audio.note(l.who.startsWith('hinoko') ? 20 : 15, { vol: 0.03, dur: 0.05 }); }, 34);
    };
    S.talking = next;
    S.skipTalk = () => { i = lines.length; clearInterval(tick); tick = null; next(); };
    next();
  });
}
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
function banner(html, size = 70, life = 1800) {
  $('float').querySelectorAll('.banner').forEach((o) => o.remove());
  const e = document.createElement('div'); e.className = 'banner'; e.innerHTML = html; e.style.fontSize = size * (Math.min(innerWidth, innerHeight) / 720) + 'px'; e.style.animationDuration = life + 'ms';
  $('float').append(e); setTimeout(() => e.remove(), life);
}
function floatText(x, y, text, cls = '', size = 24) {
  const e = document.createElement('div'); e.className = 'pop ' + cls; e.textContent = text;
  e.style.left = (x / W) * 100 + '%'; e.style.top = (y / H) * 100 + '%'; e.style.fontSize = size * (innerHeight / H) + 'px';
  $('float').append(e); setTimeout(() => e.remove(), 950);
}
function whisper(x, y, text) { const e = document.createElement('div'); e.className = 'whisper'; e.textContent = text; e.style.left = (x / W) * 100 + '%'; e.style.top = (y / H) * 100 + '%'; $('float').append(e); setTimeout(() => e.remove(), 2600); }
const pan = (x) => Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1));

// 線や星座を、そのまま空いっぱいの花火にする（segs: [[{x,y},{x,y}], ...]、points: [{x,y}]）
function burstShape(segs, points = []) {
  const all = segs.flat(), cx = all.reduce((a, n) => a + n.x, 0) / Math.max(1, all.length), cy = all.reduce((a, n) => a + n.y, 0) / Math.max(1, all.length);
  audio.boom(2, 0); audio.ui('win'); R.flash = Math.max(R.flash, 0.16); R.shake = 12;
  for (const [a, b] of segs) for (let i = 0; i <= 18; i++) { const u = i / 18, x = a.x + (b.x - a.x) * u, y = a.y + (b.y - a.y) * u; for (let k = 0; k < 4; k++) fx.add(x, y, (x - cx) * 0.9 + (Math.random() - 0.5) * 40, (y - cy) * 0.9 + (Math.random() - 0.5) * 40, 1.8 + Math.random() * 0.6, 2.8, 1.1, 30, [2.6, 2.8, 3.2], [0.5, 0.6, 1.4], 1.6, 2); }
  points.slice(0, 14).forEach((n, i) => S.seq.push({ at: 0.15 + i * 0.12, f: () => { fx.burst(fx.kinds[i % fx.kinds.length], n.x, n.y, 110 + Math.random() * 60, ['ootama', 'koori', 'kiku', 'kin'][i % 4], 1); audio.boom(1, pan(n.x)); } }));
}
function bigShow(n = 30) {
  audio.scene('finale', 0.3);
  for (let i = 0; i < n; i++) {
    const t = 0.2 + i * 0.13, x = W * (0.08 + Math.random() * 0.84), y = H * (0.1 + Math.random() * 0.45), type = SHELL_ORDER[Math.floor(Math.random() * 7)], kind = fx.kinds[Math.floor(Math.random() * fx.kinds.length)];
    S.seq.push({ at: t - 0.42, f: () => { fx.launch(x, H * 0.84, x, y, 0.42, PALETTES[type][0]); audio.launch(pan(x)); } });
    S.seq.push({ at: t, f: () => { fx.burst(kind, x, y, 120 + Math.random() * 100, type, 1); audio.boom(1.2, pan(x)); R.shake = Math.min(12, R.shake + 3); } });
  }
}
// 章に渡す道具
const API = { fx, audio, R, floatText, banner, whisper, pan, burstShape, bigShow, HINOKO: HINOKO_CELL, cellOf, PALETTES, get W() { return W; }, get H() { return H; } };

// ------------------------------------------------------------------ メニュー
const KANJI = '一二三四五六七八';
function showMenu() {
  S.mode = 'menu'; S.st = null; S.F = null; S.ch = null;
  for (const id of ['smenu', 'card']) $(id).classList.toggle('hidden', id !== 'smenu');
  $('shud').classList.add('hidden'); $('dlg').classList.add('hidden');
  const m = $('sMenu'); m.innerHTML = '';
  const add = (title, sub, f, cls = '') => { const b = document.createElement('button'); b.className = cls; b.innerHTML = `${title}<small>${sub}</small>`; b.onclick = () => { audio.unlock(); audio.ui('tap'); f(); }; m.append(b); };
  for (const ch of CHAPTERS) {
    const C = ch.mod.CHAPTER, got = ch.mod.LEVELS.reduce((a, l) => a + (DB.stars[`${C.id}:${l.id}`] || 0), 0);
    add(`${C.no === 1 ? '序章・' : ''}第${KANJI[C.no - 1]}章「${C.ja}」${DB.done[C.id] ? ' ✓' : ''}`, `${SCRIPT[C.id]?.tag || ''}　全 ${ch.mod.LEVELS.length} 夜・星 ${got} / ${ch.mod.LEVELS.length * 3}`, () => playChapter(ch));
  }
  add(`最終章「送り火」${DB.done.finale ? ' ✓' : ''}`, '物語の結末', () => finale(), 'spoil');
  add(`会話: ${DB.skipTalk ? '飛ばす' : '表示する'}`, DB.skipTalk ? '物語の会話を毎回飛ばします。押すと、表示に戻す' : '押すと、物語の会話を毎回飛ばす（会話の窓の「スキップ」でも、その場面だけ飛ばせます）', () => { DB.skipTalk = !DB.skipTalk; save(); showMenu(); });
  add('祭りへ戻る', DB.done.finale ? '終わらない祭り' : 'これまでの一筆花火（ローグライク）', () => { location.href = 'index.html'; });
  audio.scene('calm');
}
function hideMenu() { $('smenu').classList.add('hidden'); $('card').classList.add('hidden'); }
function card(main, sub, btn, msg = null) {
  return new Promise((ok) => {
    $('card').classList.remove('hidden'); $('cMain').innerHTML = main; $('cSub').innerHTML = sub; $('cBtn').textContent = btn;
    S.mode = 'card'; $('shud').classList.add('hidden');
    const sh = $('cShare'); sh.classList.toggle('hidden', !msg || !canShare() || S.auto); sh.textContent = '共有する';
    sh.onclick = () => { audio.ui('tap'); share(msg, 'share-story'); };
    $('cBtn').onclick = () => { audio.ui('tap'); $('card').classList.add('hidden'); ok(); };
  });
}

// ------------------------------------------------------------------ 章を遊ぶ
async function playChapter(ch, from = 0) {
  const M = ch.mod, C = M.CHAPTER, sc = SCRIPT[C.id] || {};
  hideMenu(); S.st = null; S.ch = ch; S.mode = 'talk'; // 前の章の盤面を、次の章の描き方で描かない
  if (from === 0) track(`story/${C.id}/start`);
  await setScene(C.sky, C.band || 'summer');
  if (from === 0) await say([...(C.no === 1 ? PROLOGUE : []), ...(sc.open || [])]); // 続けて出る会話は 1 つの場面（スキップ 1 回で飛ぶ）
  for (let i = from; i < M.LEVELS.length; i++) await playLevel(ch, i);
  S.mode = 'talk'; $('shud').classList.add('hidden');
  bigShow(); await wait(S.auto ? 600 : 2600);
  await say(sc.close);
  DB.done[C.id] = 1; save(); track(`story/${C.id}/clear`);
  const nx = CHAPTERS[CHAPTERS.indexOf(ch) + 1];
  const got = M.LEVELS.reduce((a, l) => a + (DB.stars[`${C.id}:${l.id}`] || 0), 0);
  await card(nx ? `第${KANJI[nx.mod.CHAPTER.no - 1]}章「${nx.mod.CHAPTER.ja}」へ` : '最終章「送り火」へ', '', 'つづける',
    `一筆花火2 物語「送り火」\n第${KANJI[C.no - 1]}章「${C.ja}」を越えた（星 ${got} / ${M.LEVELS.length * 3}）\n#一筆花火`);
  if (S.auto) { S.chapterDone = C.id; return; }
  if (nx) return playChapter(nx); else return finale();
}
async function playLevel(ch, i) {
  const M = ch.mod, C = M.CHAPTER, lv = M.LEVELS[i], sc = SCRIPT[C.id] || {};
  let fails = 0; S.opt = M.retry ? M.retry(lv, 0, {}) : {};
  banner(`第 ${i + 1} 夜<small>${lv.ja}</small>`, 64, 1700);
  await wait(S.auto ? 200 : 900);
  S.mode = 'talk'; await say(sc.pre?.[i]);
  for (;;) {
    S.st = M.newStage(lv, W, H, S.opt); S.mem = {}; S.mode = 'play';
    $('shud').classList.remove('hidden'); $('sName').innerHTML = `${lv.ja}<small>第${KANJI[C.no - 1]}章 ${C.ja} — 第 ${i + 1} 夜</small>`;
    audio.scene('calm');
    const res = await new Promise((ok) => { S.onResult = ok; });
    if (res === 'done') {
      const n = M.starsFor(S.st), key = `${C.id}:${lv.id}`; DB.stars[key] = Math.max(DB.stars[key] || 0, n); save();
      S.lastStars = n;
      banner(`${lv.ja}<small>${'★'.repeat(n)}${'☆'.repeat(3 - n)}</small>`, 76, 2300);
      await wait(S.auto ? 900 : 2600);
      S.mode = 'talk'; await say(sc.post?.[i]);
      return;
    }
    if (res === 'retry') continue;
    fails++; S.fails = (S.fails || 0) + 1;
    banner((M.FAIL && M.FAIL[S.st.reason]) || 'しくじった', 46, 1300); audio.ui('lose');
    await wait(1300);
    S.opt = M.retry ? M.retry(lv, fails, S.opt) : S.opt;
    S.mode = 'talk';
    const ev = sc.fail?.[i]; if (ev && fails === (ev.at || 1)) await say(ev.lines);
  }
}
$('sRetry').onclick = () => { if (S.mode === 'play' && S.onResult && S.st && S.st.phase !== 'done') { audio.ui('tap'); const f = S.onResult; S.onResult = null; f('retry'); } };

function onEvents() {
  const st = S.st, M = S.ch.mod;
  for (const ev of st.events.splice(0)) {
    try { M.onEvent && M.onEvent(ev, st, API); } catch (e) { console.error(e); }
    if ((ev.type === 'bloom' || ev.type === 'done') && S.onResult) { const f = S.onResult; S.onResult = null; setTimeout(() => f('done'), 1500); }
    if (ev.type === 'fail' && S.onResult) { const f = S.onResult; S.onResult = null; audio.fuse(0, 0); setTimeout(() => f('fail'), 500); }
  }
}

// ------------------------------------------------------------------ 最終章: 送り火
async function finale() {
  hideMenu(); await setScene('okuribi', 'summer'); S.mode = 'talk'; S.ch = null;
  await say(FINALE_PRE);
  for (;;) {
    S.F = newFinale(); S.mode = 'finale';
    $('shud').classList.remove('hidden'); $('sName').innerHTML = '送り火<small>最終章</small>'; $('sInfo').textContent = '';
    const res = await new Promise((ok) => { S.onResult = ok; });
    if (res === 'end') break;
  }
  await finaleEnding();
}
function newFinale() {
  const f = W >= H ? { x0: 110, x1: W - 110, y0: 118, y1: H * 0.57 } : { x0: 60, x1: W - 60, y0: 230, y1: H * 0.66 };
  return { phase: 'aim', pts: [], len: 0, fireS: 0, fireOn: false, age: 0, v: 0, fx: 0, fy: 0, pen: null, still: 0, said: 0, shell: { x: (f.x0 + f.x1) / 2 + 200, y: (f.y0 + f.y1) / 2 }, f, trigger: null };
}
const WHISPERS = [[3.2, '届かない'], [6.4, '待って'], [9.6, 'じいちゃん、待って'], [12.5, 'どうして、逃げるの']];
function finaleStep(F, dt) {
  if (F.phase !== 'run') return;
  F.age += dt;
  if (!F.fireOn && F.age > 0.6) F.fireOn = true;
  if (F.fireOn) { F.v = Math.min(1150, 170 + 62 * F.age); F.fireS += F.v * dt; }
  // どれだけ速く逃げても、18 秒で火はかならず追いつく
  if (F.age > 13) F.fireS = Math.max(F.fireS, F.len - Math.max(0, 18 - F.age) * 90);
  if (F.len - F.fireS <= 0 && F.fireOn) { F.fireS = F.len; F.trigger = 'caught'; }
  F.still += dt; if (F.still > 2.4 && F.age > 1.5) F.trigger = 'still';
  const p = F.pen, s = F.shell, f = F.f;
  if (p) {
    const dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d < 240) {
      const v = (1 - d / 240) * 1100 + 240; s.x += (dx / d) * v * dt; s.y += (dy / d) * v * dt;
      const cl = (s.x < f.x0 || s.x > f.x1 || s.y < f.y0 || s.y > f.y1);
      s.x = Math.max(f.x0, Math.min(f.x1, s.x)); s.y = Math.max(f.y0, Math.min(f.y1, s.y));
      if (cl && Math.hypot(s.x - p.x, s.y - p.y) < 150) { fx.tick(s.x, s.y, [3, 2.2, 1], 30, 260); s.x = p.x < (f.x0 + f.x1) / 2 ? f.x1 - 40 : f.x0 + 40; s.y = p.y < (f.y0 + f.y1) / 2 ? f.y1 - 30 : f.y0 + 30; audio.launch(pan(s.x)); }
    }
  }
  while (F.said < WHISPERS.length && F.age >= WHISPERS[F.said][0]) { whisper(s.x, s.y - 60, WHISPERS[F.said][1]); F.said++; }
  const P = F.pts; if (P.length > 1) { let i = 0; while (i < P.length - 2 && P[i + 1].s < F.fireS) i++; const a = P[i], b = P[i + 1], u = b.s > a.s ? Math.min(1, Math.max(0, (F.fireS - a.s) / (b.s - a.s))) : 0; F.fx = a.x + (b.x - a.x) * u; F.fy = a.y + (b.y - a.y) * u; }
  if (F.trigger) { F.phase = 'end'; audio.fuse(0, 0); const ok = S.onResult; S.onResult = null; ok && ok('end'); }
}
async function finaleEnding() {
  const F = S.F; S.mode = 'talk';
  audio.scene('calm', 1.2);
  const tip = F.pts.length ? F.pts[F.pts.length - 1] : { x: W / 2, y: H / 2 };
  F.hinoko = { x: F.fx || tip.x, y: F.fy || tip.y };
  await wait(1200);
  await say(FINALE_END);
  const s = F.shell, x0 = s.x, y0 = s.y;
  await new Promise((ok) => { const t0 = performance.now(); const tm = setInterval(() => { const u = Math.min(1, (performance.now() - t0) / 1600), e = u * u * (3 - 2 * u); s.x = x0 + (tip.x - x0) * e; s.y = y0 + (tip.y - 40 - y0) * e; if (u >= 1) { clearInterval(tm); ok(); } }, 16); });
  F.opened = true;
  fx.burst('kamuro', s.x, s.y, 270, 'shaku', 3); audio.boom(2.4, 0); R.flash = 0.14; R.shake = 20;
  bigShow();
  await wait(5200);
  DB.done.finale = 1; save(); track('story/finale/clear');
  // ローグライクの側にも、結末を見たことを知らせる（タイトルの言葉が変わる）
  try { const k = 'hanabi2'; const d = JSON.parse(localStorage.getItem(k) || '{}'); d.meta = d.meta || {}; d.meta.storyDone = 1; localStorage.setItem(k, JSON.stringify(d)); } catch { /* */ }
  await card('ずっと逃げていた火は、<br>あなたを迎えに来ていた。', '一筆花火 —— 送り火', 'メニューへ',
    '一筆花火2 物語「送り火」を、最後まで遊んだ。\n線を引け。火が追いかけてくる。 #一筆花火');
  showMenu();
}

// ------------------------------------------------------------------ 入力（人の指と、通しテストの運転手が同じ道を通る）
const toWorld = (e) => ({ x: (e.clientX / innerWidth) * W, y: (e.clientY / innerHeight) * H });
let pid = null;
function down(p) {
  if (S.mode === 'play' && S.st) return S.ch.mod.penDown(S.st, p.x, p.y);
  if (S.mode === 'finale' && S.F && S.F.phase === 'aim') { const F = S.F; F.phase = 'run'; F.pts = [{ x: p.x, y: p.y, s: 0 }]; F.pen = p; F.fx = p.x; F.fy = p.y; audio.scene('burn', 0.3); return true; }
  return false;
}
function move(p) {
  if (S.mode === 'play' && S.st) S.ch.mod.penMove(S.st, p.x, p.y);
  else if (S.mode === 'finale' && S.F && S.F.phase === 'run') { const F = S.F, l = F.pts[F.pts.length - 1], d = Math.hypot(p.x - l.x, p.y - l.y); if (d > 4) { F.len += d; F.pts.push({ x: p.x, y: p.y, s: F.len }); F.still = 0; } F.pen = p; }
}
function up() {
  if (S.mode === 'play' && S.st) S.ch.mod.penUp(S.st);
  else if (S.mode === 'finale' && S.F && S.F.phase === 'run') { if (S.F.age > 2) S.F.trigger = 'let go'; else S.F = newFinale(); }
}
canvas.addEventListener('pointerdown', (e) => { audio.unlock(); if (pid !== null) return; if (down(toWorld(e))) { pid = e.pointerId; try { canvas.setPointerCapture(pid); } catch { /* */ } } });
canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of (list.length ? list : [e])) move(toWorld(ev)); });
const release = (e) => { if (e.pointerId !== pid) return; pid = null; up(); };
canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);
$('dlg').addEventListener('click', () => { audio.unlock(); if (S.talking) S.talking(); });
$('dSkip').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); audio.ui('tap'); if (S.skipTalk) S.skipTalk(); });
addEventListener('keydown', (e) => {
  if ((e.key === ' ' || e.key === 'Enter') && S.talking) { e.preventDefault(); S.talking(); }
  if (e.key === 'Escape' && S.skipTalk) { e.preventDefault(); S.skipTalk(); }
});
addEventListener('contextmenu', (e) => e.preventDefault());

// 通しテスト用: 章の運転手（bot）に毎コマ操作させる。人と同じ down / move / up を通る
let botDown = false;
function autoTick() {
  if (!S.auto || S.mode !== 'play' || !S.st || !S.ch.mod.bot) return;
  if (S.st.phase === 'aim') botDown = false;
  const a = S.ch.mod.bot(S.st, S.mem); if (!a) return;
  if (a.down) { if (botDown) up(); botDown = !!down({ x: a.down[0], y: a.down[1] }); }
  if (a.move && botDown) move({ x: a.move[0], y: a.move[1] });
  if (a.up && botDown) { botDown = false; up(); }
}

// ------------------------------------------------------------------ 描画
function ribbonGL(gl, P, vaoF, fuseBuf, cam, VW, VH, k, t) {
  const P2 = k.pts, n = P2.length; if (n < 2) return;
  const data = new Float32Array(n * 8), wid = (k.width || 4.4) + (k.heatLv || 0) * 1.1;
  for (let i = 0; i < n; i++) {
    const a = P2[Math.max(0, i - 1)], b = P2[Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = wid * (0.82 + 0.25 * Math.sin(P2[i].s * 0.021)) * (P2[i].jump ? 0.45 : 1), o = i * 8;
    data[o] = P2[i].x - dy * w; data[o + 1] = P2[i].y + dx * w; data[o + 2] = P2[i].s; data[o + 3] = -1;
    data[o + 4] = P2[i].x + dy * w; data[o + 5] = P2[i].y - dx * w; data[o + 6] = P2[i].s; data[o + 7] = 1;
  }
  gl.useProgram(P.fuse.p); gl.bindVertexArray(vaoF);
  gl.bindBuffer(gl.ARRAY_BUFFER, fuseBuf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  const U = P.fuse.u;
  gl.uniform2f(U.uView, VW, VH); gl.uniform3f(U.cam, cam.x, cam.y, cam.z); gl.uniform1f(U.flameS, k.flameS); gl.uniform1f(U.len, k.len); gl.uniform1f(U.time, t); gl.uniform1f(U.heat, k.heatLv || 0); gl.uniform1f(U.on, k.flameOn ? 1 : 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
}
function drawWorld({ gl, cam, P, vaoSpr, vaoF, sprBuf, sprData, fuseBuf, tex, W: VW, H: VH, MAX_SPR }) {
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const t = R.time, sprites = { shell: [], story: [] };
  const api = {
    ...API, t,
    ribbon: (k) => ribbonGL(gl, P, vaoF, fuseBuf, cam, VW, VH, k, t),
    put: (x, y, size, cell, glow = 0.15, atlas = 'story', alpha = 1) => { const c = typeof cell === 'string' ? storyCell(cell) : cell; if (c >= 0) sprites[atlas].push([x, y, size, c, glow, alpha]); },
  };
  if ((S.mode === 'play' || S.mode === 'talk') && S.st && S.ch && S.ch.mod.draw) { try { S.ch.mod.draw(S.st, api); } catch (e) { if (!S.drawErr) { S.drawErr = e; console.error(e); } } }
  const F = S.F;
  if (F) {
    if (F.pts.length > 1 && !F.opened) api.ribbon({ pts: F.pts, len: F.len, flameS: F.fireS, heatLv: 1, flameOn: F.fireOn });
    if (!F.opened) api.put(F.shell.x, F.shell.y + Math.sin(t * 1.6) * 4, 44 / 0.72, cellOf({ type: 'shaku' }), 0.4, 'shell');
    if (F.fireOn && F.phase === 'run') api.put(F.fx, F.fy - 6, 30, HINOKO_CELL + 1, 0.2, 'shell');
    if (F.hinoko) api.put(F.hinoko.x, F.hinoko.y - 10 + Math.sin(t * 2) * 3, 44, HINOKO_CELL, 0.35, 'shell');
  }
  for (const [name, texObj, cols] of [['story', storyTex, STORY_COLS], ['shell', atlasTex, ATLAS_CELLS]]) {
    const list = sprites[name]; if (!list.length) continue;
    const n = Math.min(list.length, MAX_SPR);
    for (let i = 0; i < n; i++) { const [x, y, size, c, g, a] = list[i], o = i * 8; sprData[o] = x; sprData[o + 1] = y; sprData[o + 2] = size; sprData[o + 3] = 0; sprData[o + 4] = c; sprData[o + 5] = 0; sprData[o + 6] = g; sprData[o + 7] = a; }
    gl.useProgram(P.spr.p); gl.bindVertexArray(vaoSpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, sprBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, sprData, 0, n * 8);
    gl.uniform2f(P.spr.u.uView, VW, VH); gl.uniform3f(P.spr.u.cam, cam.x, cam.y, cam.z); gl.uniform2f(P.spr.u.cell, 1 / cols, 1);
    tex(0, texObj, P.spr.u.t);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
  }
}
// 章が出す字（年号・お題の名前など）。[{ x, y, text, cls? }] を毎コマ受け取り、要素を使い回す
function renderLabels(list) {
  const box = $('labels'); while (box.children.length < list.length) { const e = document.createElement('div'); e.className = 'lbl'; box.append(e); }
  [...box.children].forEach((e, i) => { const l = list[i]; if (!l) { e.style.display = 'none'; return; } e.style.display = ''; if (e.textContent !== l.text) e.textContent = l.text; e.className = 'lbl ' + (l.cls || ''); e.style.left = (l.x / W) * 100 + '%'; e.style.top = (l.y / H) * 100 + '%'; });
}
function perFrameFx(dt) {
  const one = Math.max(dt, 0.001) * 1.2, t = R.time;
  if ((S.mode === 'play' || S.mode === 'talk') && S.st && S.ch) {
    try { S.ch.mod.particles && S.ch.mod.particles(S.st, { ...API, fx, one, dt, t }); } catch (e) { if (!S.fxErr) { S.fxErr = e; console.error(e); } }
    if (S.mode === 'play') $('sInfo').innerHTML = S.ch.mod.info ? S.ch.mod.info(S.st) : '';
    renderLabels(S.ch.mod.labels ? S.ch.mod.labels(S.st) : []);
  } else renderLabels([]);
  const F = S.F;
  if (F && (S.mode === 'finale' || S.mode === 'talk')) {
    if (!F.opened) { const s = F.shell; fx.add(s.x, s.y, 0, 0, one, 60, 0, 0, [1, 0.6, 0.2], [1, 0.6, 0.2], 0.25); }
    if (F.phase === 'aim') $('sInfo').innerHTML = '空の<em>尺玉</em>へ、線を引く'; else if (F.phase === 'run') $('sInfo').textContent = '';
    if (F.fireOn && F.phase === 'run') { fx.flame(F.fx, F.fy, 0, -1, 2, dt); audio.fuse(1, 2); }
    if (F.hinoko) fx.add(F.hinoko.x, F.hinoko.y, 0, 0, one, 70, 0, 0, [1.4, 0.7, 0.2], [1.4, 0.7, 0.2], 0.3);
  }
}

let last = performance.now(), acc = 0;
const DT = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try {
    acc += dt;
    while (acc >= DT) {
      acc -= DT;
      if (S.mode === 'play' && S.st) { autoTick(); S.ch.mod.step(S.st, DT); onEvents(); }
      else if (S.mode === 'finale' && S.F) finaleStep(S.F, DT);
    }
    for (let i = S.seq.length - 1; i >= 0; i--) { const e = S.seq[i]; e.at -= dt; if (e.at <= 0) { S.seq.splice(i, 1); e.f(); } }
    perFrameFx(dt); fx.update(dt);
    R.lights = fx.lights; R.flash *= Math.exp(-dt * 6); R.shake *= Math.exp(-dt * 9);
    R.render(dt, fx, drawWorld);
  } catch (err) { if (!S.fatal) { S.fatal = err; console.error(err); } }
}

async function boot() {
  try { await document.fonts.load('900 60px "Yuji Boku"', '一筆花火秘伝灯へ'); } catch { /* */ }
  atlasTex = R.texture(shellAtlas()); storyTex = R.texture(storyAtlas());
  resize(); R.bakeSky(SKY.tanabata, W / H);
  await loadBand('summer'); layoutBand();
  showMenu();
  requestAnimationFrame(frame);
  S.booted = true;
  try { sessionStorage.removeItem('hanabiRetry'); } catch { /* */ }
  // ?ch=<章>&lv=<面>&auto で、その章を運転手に遊ばせる（試し・通しテスト用）
  const go = q.get('ch'); if (q.has('auto')) S.auto = true;
  if (go) { const ch = CHAPTERS.find((c) => c.mod.CHAPTER.id === go); if (ch) playChapter(ch, +(q.get('lv') || 0)); else if (go === 'finale') finale(); }
}
window.STORY = { S, DB, CHAPTERS, say, playChapter, finale, API, showMenu, get W() { return W; }, get H() { return H; } };
boot();
