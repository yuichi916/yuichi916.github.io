// 画面遷移とゲームループ。ゲームの中身は match.js、見た目は render.js、画面の中身は ui.js。
// 流れ: 読み込み → タイトル → モード選択 → キャラ選択 → VS → 対戦 → 結果（ほかに 練習・あそびかた・戦績・設定）
import { CFG, LEVELS } from './config.js';
import { createMatch } from './match.js';
import { createTsunaguAI } from './ai-tsunagu.js';
import { createNaraberuAI } from './ai-naraberu.js';
import { createRenderer } from './render.js';
import { createInput, touchDragStep, createTsunaguGesture } from './input.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createCharas, loadCharacter } from './chara.js';
import { CHAR, CHARACTERS, hasVoice, charsOf } from './characters.js';
import { TOP, BOTTOM } from './naraberu.js';
import { loadSettings, saveSettings, KEY_V2 } from './settings.js';
import { createPractice } from './practice.js';
import { mountControls } from './controls.js';
import { loadRecords, saveRecords, recordResult } from './records.js';
import { TUTORIALS, tutorialCfg } from './tutorial.js';
import * as ui from './ui.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const input = createInput();
const audio = createAudio();
const phys = createFx();
const store = (() => { try { return window.localStorage; } catch { return null; } })();
const settings = loadSettings(store);
const firstVisit = !(() => { try { return store && store.getItem(KEY_V2); } catch { return null; } })();
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
if (firstVisit && matchMedia('(prefers-reduced-motion: reduce)').matches) settings.reduceMotion = true;
if (mobile && settings.mode === '2p') settings.mode = 'cpu';
const save = () => saveSettings(store, settings);
const records = loadRecords(store);
const calmOrLow = () => settings.reduceMotion || settings.effects === 'low';
const charas = createCharas({
  onSay: (p, key, id) => match && audio.voice(p, id, key, humans.length === 0 || humans.includes(p)),
  effects: () => (calmOrLow() ? 'low' : 'high'),
});
const renderer = createRenderer(canvas, { phys, charas });
document.body.classList.toggle('mobile', mobile);

const KIND_NAME = { tsunagu: 'つなぐ派', naraberu: 'ならべる派' };
const REPEAT = { tsunagu: ['left', 'right'], naraberu: ['left', 'right', 'up', 'down'] };
const LEVEL_NAMES = Object.keys(LEVELS);

function applyInputSettings() { input.setKeys(settings.keys); input.setTiming(settings.das, settings.arr); }
function applyLook() {
  renderer.setCalm(settings.reduceMotion);
  phys.setLevel(calmOrLow() ? 0.5 : 1);
  document.body.classList.toggle('calm', settings.reduceMotion);
  audio.setVolumes(settings.volume);
}
applyInputSettings();
applyLook();

let screen = 'loading';
let match = null, ais = [null, null], humans = [0], labels = ['あなた', 'CPU'];
let acc = 0, last = 0, countdown = 0, stats = null, pinchUntil = 0;
let playChars = settings.chars.slice();   // 試合中のキャラ（おまかせを決めたあと）
let starting = false;                     // VS 演出中・開始処理中（二重に始めない）
let tut = null;                           // チュートリアル中 {kind, idx, events, done}
let ctrlBack = 'setup';                   // 操作の設定から戻る先

// ---- 画面の切り替え ----
const BACK = { menu: 'title', setup: 'menu', records: 'menu', options: 'menu', tutpick: 'menu' };
function show(id) {
  for (const el of document.querySelectorAll('.overlay')) el.classList.toggle('on', el.id === id);
  screen = id || 'play';
  document.body.dataset.screen = screen;
  // 曲: 試合以外はタイトル曲、試合中は対戦曲（ピンチで切り替え）、結果はジングルだけ
  if (['title', 'menu', 'setup', 'records', 'options', 'tutpick', 'controls'].includes(screen)) audio.bgm('title');
  else if (screen === 'play' && !audio.bgmName) { pinchUntil = 0; audio.bgm('battle'); }
  // 画面のいちばん大事なボタンにフォーカス（キーボード・パッドですぐ選べる）
  const el = id && $(id);
  if (el && !mobile) {
    const primary = el.querySelector('.big, .mbtn, .ccard.sel, button');
    if (primary) setTimeout(() => primary.focus({ preventScroll: true }), 30);
  }
}
function back() {
  if (screen === 'controls') { openScreen(ctrlBack); return; }
  if (screen === 'pause') { resume(); return; }
  if (BACK[screen]) openScreen(BACK[screen]);
}
function openScreen(id) {
  if (id === 'setup') renderSetup();
  if (id === 'records') ui.renderRecords($('recBody'), records, LEVEL_NAMES);
  if (id === 'options') ui.renderOptions($('optBody'), settings);
  if (id === 'title') ui.renderTitleCast($('titleCast'));
  show(id);
}

// ---- 読み込み ----
async function boot() {
  const ids = CHARACTERS.map(c => c.id);
  let done = 0;
  const step = () => { done++; $('loadFill').style.width = `${Math.round((done / (ids.length + 1)) * 100)}%`; };
  const timeout = new Promise(res => setTimeout(res, 8000)); // 回線が悪くても8秒で進む
  await Promise.race([Promise.all([
    ...ids.map(id => loadCharacter(id).then(step)),
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(step),
  ]), timeout]);
  $('loadText').textContent = 'じゅんび完了';
  openScreen('title');
}

// ---- キャラ選択 ----
function renderSetup() {
  const practice = settings.mode === 'practice', cpu = settings.mode === 'cpu';
  $('selTitle').textContent = practice ? 'れんしゅうするキャラ' : 'キャラをえらぶ';
  ui.renderCards(document.querySelector('.cards[data-player="0"]'), { player: 0, selected: settings.chars[0] });
  ui.renderCards(document.querySelector('.cards[data-player="1"]'), { player: 1, selected: settings.chars[1], random: cpu && settings.oppRandom, showRandom: cpu });
  for (const btn of document.querySelectorAll('#setup [data-set]')) {
    const [key, idx, val] = btn.dataset.set.split(':');
    if (key === 'level') btn.classList.toggle('sel', settings.level === val);
    if (key === 'hc') btn.classList.toggle('sel', String(settings.handicap[+idx]) === val);
  }
  $('levelRow').hidden = !cpu;
  $('p2row').hidden = practice;
  $('hcRow').hidden = practice;
  $('btnGo').textContent = practice ? 'れんしゅうスタート' : '対戦スタート';
  $('p1label').textContent = cpu || practice ? 'あなた' : '1P';
  $('p2label').textContent = cpu ? 'あいて' : '2P';
  $('keys2p').hidden = settings.mode !== '2p';
  $('keys1').hidden = mobile;
  $('keysTouch').hidden = !mobile;
  $('hcL').textContent = $('p1label').textContent;
  $('hcR').textContent = cpu ? 'CPU' : '2P';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-set]');
  if (!b) return;
  audio.ensure(); audio.move();
  const [key, idx, val] = b.dataset.set.split(':');
  if (key === 'char') {
    if (val === 'random') settings.oppRandom = true;
    else { settings.chars[+idx] = val; if (+idx === 1) settings.oppRandom = false; audio.voice(+idx, val, 'select'); }
  } else if (key === 'level') settings.level = val;
  else if (key === 'hc') settings.handicap[+idx] = +val;
  save(); renderSetup();
  const again = document.querySelector(`[data-set="${b.dataset.set}"]`);
  if (again && !mobile) again.focus({ preventScroll: true });
});

// ---- メニュー ----
for (const b of document.querySelectorAll('[data-menu]')) {
  b.onclick = () => {
    audio.ensure(); audio.move();
    const m = b.dataset.menu;
    if (m === 'cpu' || m === '2p' || m === 'practice') { settings.mode = m; save(); openScreen('setup'); }
    else if (m === 'tutorial') openScreen('tutpick');
    else openScreen(m);
  };
}
$('menu2p').hidden = mobile;
for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { audio.move(); back(); };
for (const b of document.querySelectorAll('[data-tut]')) b.onclick = () => { audio.ensure(); startTutorial(b.dataset.tut); };

// ---- 設定 ----
$('optBody').addEventListener('input', e => {
  const r = e.target.closest('[data-vol]');
  if (!r) return;
  settings.volume[r.dataset.vol] = +r.value;
  r.nextElementSibling.textContent = r.value;
  save(); applyLook();
});
$('optBody').addEventListener('click', e => {
  const o = e.target.closest('[data-opt]');
  if (!o) return;
  const [key, val] = o.dataset.opt.split(':');
  settings[key] = val === 'true' ? true : val === 'false' ? false : val;
  save(); applyLook(); audio.move(); ui.renderOptions($('optBody'), settings);
});
const controls = mountControls({ root: $('ctrlBody'), settings, save, onChange: applyInputSettings, mobile });
$('btnCtrl').onclick = () => { ctrlBack = 'setup'; controls.render(); show('controls'); };
$('btnOptCtrl').onclick = () => { ctrlBack = 'options'; controls.render(); show('controls'); };
$('btnCtrlClose').onclick = () => back();
$('btnCtrlReset').onclick = () => controls.resetDefaults();

// ---- 開始 ----
$('btnStart').onclick = () => goMenu();
$('title').addEventListener('click', e => { if (!e.target.closest('button')) goMenu(); });
function goMenu() {
  audio.ensure();
  audio.loadVoices(CHARACTERS.filter(c => hasVoice(c.id)).map(c => c.id));
  openScreen('menu');
}
$('btnGo').onclick = () => { audio.ensure(); startFlow(); };
$('btnAgain').onclick = () => { if (tut) return; startMatch(); };
$('btnSetup').onclick = () => openScreen('setup');
$('btnMenu').onclick = () => { match = null; openScreen('menu'); };
$('btnResume').onclick = () => resume();
$('btnRetry').onclick = () => { if (tut) startTutStep(); else startMatch(); };
$('btnQuit').onclick = () => quitToMenu();
$('btnMute').onclick = () => { audio.ensure(); $('btnMute').textContent = audio.toggle() ? '音 OFF' : '音 ON'; };
$('btnMute').textContent = audio.muted ? '音 OFF' : '音 ON';
$('btnPause').onclick = () => { if (screen === 'play') pause(); else if (screen === 'pause') resume(); };
$('btnHelp').onclick = () => { $('help').classList.toggle('on'); };
$('help').onclick = () => $('help').classList.remove('on');
for (const b of document.querySelectorAll('[data-garbage]')) b.onclick = () => { if (match && match.practice && !tut) { match.dropGarbage(+b.dataset.garbage); audio.move(); } };
$('btnPracReset').onclick = () => { if (match && match.practice) { match.resetBoard(); phys.reset(); } };
$('btnPracQuit').onclick = () => quitToMenu();
$('btnTutRetry').onclick = () => tut && startTutStep();
$('btnTutSkip').onclick = () => tut && nextTutStep();
$('btnTutQuit').onclick = () => quitToMenu();

function quitToMenu() {
  match = null; tut = null; starting = false;
  $('practiceBar').hidden = true; $('tutBar').hidden = true;
  openScreen('menu');
}

// VS 演出をはさんで始める（練習は演出なし）
let vsTimer = 0;
function startFlow() {
  if (starting) return;
  if (settings.mode === 'practice') { startMatch(); return; }
  starting = true;
  playChars = settings.chars.slice();
  if (settings.mode === 'cpu' && settings.oppRandom) playChars[1] = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
  const cpu = settings.mode === 'cpu';
  ui.setupVS(playChars, cpu ? ['あなた', 'CPU'] : ['1P', '2P']);
  show('vs');
  audio.voice(0, playChars[0], 'select');
  setTimeout(() => audio.voice(1, playChars[1], 'select'), 700);
  clearTimeout(vsTimer);
  vsTimer = setTimeout(() => startMatch(), settings.reduceMotion ? 900 : 2300);
}
$('vs').addEventListener('click', () => { if (screen === 'vs') startMatch(); });

function startMatch(demo = false) {
  clearTimeout(vsTimer);
  starting = false;
  tut = null; $('tutBar').hidden = true;
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const practice = settings.mode === 'practice' && !demo;
  if (!demo && settings.mode !== 'cpu') playChars = settings.chars.slice();
  if (demo) playChars = settings.chars.slice();
  const kinds = playChars.map(id => CHAR[id].faction);
  const cpu = settings.mode === 'cpu' || practice;
  if (practice) {
    match = createPractice({ cfg: CFG, kind: kinds[0], seed });
    ais = [null];
    labels = ['あなた'];
  } else {
    match = createMatch({ cfg: CFG, kinds, seeds: [seed, seed + 7919], handicap: settings.handicap.slice() });
    labels = cpu ? ['あなた', 'CPU'] : ['1P', '2P'];
    ais = [demo ? makeAI(kinds[0], settings.level, seed + 1) : null, cpu ? makeAI(kinds[1], settings.level, seed) : null];
  }
  humans = demo ? [] : cpu ? [0] : [0, 1];
  beginPlay(practice ? [playChars[0], null] : playChars, practice ? 0.8 : 1.6, !cpu);
  $('practiceBar').hidden = !practice;
}

function beginPlay(ids, cd, twoP) {
  applyInputSettings();
  input.setMode(twoP);
  stats = [{ maxChain: 0 }, { maxChain: 0 }];
  countdown = cd;
  drag = null; gesture = null;
  input.reset();
  acc = 0; last = performance.now();
  phys.reset(); charas.reset(); charas.setChars(ids); audio.loadVoices(ids.filter(id => id && hasVoice(id)));
  charas.start(performance.now() / 1000 + 0.4);
  audio.bgm(null); audio.bgm('battle'); pinchUntil = 0;
  show(null);
  setupTouch();
}

function makeAI(kind, level, seed) {
  return kind === 'tsunagu' ? createTsunaguAI(level, CFG, { seed }) : createNaraberuAI(level, CFG, { seed });
}

function pause() { if (!match || match.result) return; show('pause'); }
function resume() { show(null); input.reset(); last = performance.now(); acc = 0; }

// ---- チュートリアル ----
function startTutorial(kind) {
  const mine = CHAR[settings.chars[0]];
  const id = mine && mine.faction === kind ? mine.id : charsOf(kind)[0].id;
  tut = { kind, idx: 0, id };
  startTutStep();
}
function startTutStep() {
  const step = TUTORIALS[tut.kind][tut.idx];
  tut.events = []; tut.done = false;
  match = createPractice({ cfg: tutorialCfg(CFG, tut.kind, step), kind: tut.kind, seed: 7 + tut.idx, setup: step.setup });
  ais = [null]; labels = ['あなた']; humans = [0];
  playChars = [tut.id, null];
  const t = tut;
  beginPlay([tut.id, null], 0, false);
  tut = t;
  $('practiceBar').hidden = true;
  $('tutBar').hidden = false;
  $('tutStep').textContent = `あそびかた（${KIND_NAME[tut.kind]}）${tut.idx + 1} / ${TUTORIALS[tut.kind].length}：${step.title}`;
  $('tutText').textContent = mobile ? step.text.replace(/F（スマホは[^）]*）/, 'パネルを横になぞる').replace(/G（スマホは下のボタン）/, '下のボタン') : step.text;
}
function nextTutStep() {
  tut.idx++;
  if (tut.idx >= TUTORIALS[tut.kind].length) {
    ui.toast('あそびかた クリア！', 1600);
    audio.win();
    setTimeout(() => quitToMenu(), 1700);
    tut.done = true;
    return;
  }
  startTutStep();
}
function checkTutorial(ev) {
  if (!tut || tut.done) return;
  tut.events.push(...ev);
  const step = TUTORIALS[tut.kind][tut.idx];
  if (step.goal(match.players[0].board, tut.events)) {
    tut.done = true;
    ui.toast('できた！');
    audio.move();
    setTimeout(() => { if (tut) nextTutStep(); }, 1400);
  }
}

addEventListener('keydown', e => {
  if (e.repeat && ['Escape', 'KeyP', 'Enter'].includes(e.code)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Quote', 'Semicolon'].includes(e.code) && screen === 'play') e.preventDefault();
  audio.ensure();
  if (screen === 'play') { if (e.code === 'Escape' || e.code === 'KeyP') pause(); return; }
  if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { resume(); return; }
  if (screen === 'loading') return;
  if (screen === 'title') { goMenu(); return; }
  if (screen === 'vs') { if (['Enter', 'Space', 'Escape'].includes(e.code)) startMatch(); return; }
  if (screen === 'controls' && controls.waiting) return;
  // メニュー類: 矢印で選び、Enter/Space で決定（ボタンの標準動作）、Escape で戻る
  const root = $(screen);
  if (!root) return;
  if (e.code === 'Escape' || e.code === 'Backspace') { e.preventDefault(); back(); return; }
  const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.code];
  if (dir && !(document.activeElement && document.activeElement.type === 'range' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) { e.preventDefault(); ui.moveFocus(root, dir); }
});
addEventListener('blur', () => { if (screen === 'play') pause(); });

// ゲームパッドでメニューを操作する（十字キーで選ぶ・A で決定・B で戻る・Start で決定）
function padMenu() {
  if (screen === 'play' || screen === 'loading') return;
  input.pollPads(() => (navigator.getGamepads ? navigator.getGamepads() : []));
  const pr = n => input.padPressed(0, n) || input.padPressed(1, n);
  const root = $(screen);
  if (screen === 'title' && (pr('a') || pr('pause'))) goMenu();
  else if (screen === 'vs' && (pr('a') || pr('pause'))) startMatch();
  else if (screen === 'pause' && pr('pause')) resume();
  else if (root) {
    if (pr('up') || pr('left')) ui.moveFocus(root, -1);
    if (pr('down') || pr('right')) ui.moveFocus(root, 1);
    if (pr('a') || pr('pause')) { const f = document.activeElement; if (f && root.contains(f)) f.click(); }
    if (pr('b')) back();
  }
  input.endFrame();
}

function finish() {
  const r = match.result;
  const cpu = settings.mode === 'cpu';
  let title;
  if (r.winner === -1) title = '引き分け';
  else if (cpu) title = r.winner === 0 ? 'あなたの勝ち！' : 'CPUの勝ち…';
  else title = `${labels[r.winner]}（${CHAR[playChars[r.winner]].name}）の勝ち！`;
  if (cpu && r.winner === 0) audio.win(); else if (cpu && r.winner === 1) audio.lose(); else audio.win();
  charas.finish(match, performance.now() / 1000);
  // 戦績
  const result = r.winner === -1 ? 'draw' : r.winner === 0 ? 'win' : 'lose';
  const best = recordResult(records, { mode: settings.mode, level: settings.level, chars: playChars, result, maxChain: stats[0].maxChain, attack: match.players[0].sent });
  saveRecords(store, records);
  const badges = [];
  if (best.newBestChain) badges.push(`最大連鎖 更新！ ${stats[0].maxChain}れんさ`);
  if (best.newBestAttack) badges.push(`最大攻撃 更新！ ${Math.round(match.players[0].sent)}`);
  const sec = Math.round(r.frames / 60);
  const statsHtml = match.players.map((p, i) => `
    <div class="stat"><b>${labels[i]}・${CHAR[playChars[i]].name}（${KIND_NAME[p.kind]}）</b>
    <span>最大 ${stats[i].maxChain} れんさ</span><span>送った攻撃 ${Math.round(p.sent)}</span></div>`).join('')
    + `<div class="stat time">試合時間 ${Math.floor(sec / 60)}分${sec % 60}秒</div>`;
  const w = r.winner === -1 ? null : r.winner;
  ui.renderResult({
    title, best: badges, statsHtml,
    win: w === null ? { id: playChars[0], expr: 'normal' } : { id: playChars[w], expr: 'win' },
    lose: w === null ? { id: playChars[1], expr: 'normal' } : { id: playChars[1 - w], expr: 'lose' },
  });
  setTimeout(() => show('result'), 900);
}

// ---- タッチ ----
let touchKind = null;
function setupTouch() {
  if (!mobile) return;
  touchKind = match.players[0].kind;
  $('padT').hidden = touchKind !== 'tsunagu';
  $('padN').hidden = touchKind !== 'naraberu';
}
for (const btn of document.querySelectorAll('[data-pad]')) {
  const n = btn.dataset.pad;
  const down = e => { e.preventDefault(); audio.ensure(); input.press(0, n); btn.classList.add('down'); };
  const up = e => { e.preventDefault(); input.release(0, n); btn.classList.remove('down'); };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('pointerleave', up);
}
let drag = null, gesture = null;
// 振動（設定でオフ可）: 入れ替え・消去・おじゃま着地で短く
function buzz(ev) {
  if (!settings.vibrate || !navigator.vibrate || !mobile) return;
  let ms = 0;
  for (const e of ev) {
    if (!humans.includes(e.p)) continue;
    if (e.type === 'garbage') ms = Math.max(ms, 30);
    else if (e.type === 'pop') ms = Math.max(ms, 15);
    else if (e.type === 'swap') ms = Math.max(ms, 8);
  }
  if (ms) try { navigator.vibrate(ms); } catch { /* 振動できない端末 */ }
}
function cellAt(e) {
  const L = renderer.layout?.boards[0];
  if (!L || !match) return null;
  const b = match.players[0].board;
  const r = canvas.getBoundingClientRect();
  const px = e.clientX - r.left - L.X, py = e.clientY - r.top - L.Y + b.rise * L.s;
  const x = Math.floor(px / L.s), y = Math.floor(py / L.s) + TOP;
  if (x < 0 || x > 5 || y < TOP || y > BOTTOM) return null;
  return { x, y };
}
// つなぐ派のジェスチャー（スマホ・設定が gesture のとき）
canvas.addEventListener('pointerdown', e => {
  if (!match || screen !== 'play' || !mobile || settings.touch !== 'gesture' || match.players[0].kind !== 'tsunagu') return;
  const L = renderer.layout?.boards[0];
  if (!L) return;
  audio.ensure();
  if (!gesture) gesture = createTsunaguGesture({ cell: L.s, width: canvas.clientWidth });
  const r = canvas.getBoundingClientRect();
  gesture.down(e.clientX - r.left, e.clientY - r.top, e.timeStamp / 1000);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 指を追えない環境でも操作は続ける */ }
});
canvas.addEventListener('pointermove', e => { if (gesture) { const r = canvas.getBoundingClientRect(); gesture.move(e.clientX - r.left, e.clientY - r.top, e.timeStamp / 1000); } });
canvas.addEventListener('pointerup', e => { if (gesture) { const r = canvas.getBoundingClientRect(); gesture.up(e.clientX - r.left, e.clientY - r.top, e.timeStamp / 1000); } });
canvas.addEventListener('pointercancel', () => gesture && gesture.cancel());
canvas.addEventListener('pointerdown', e => {
  if (!match || screen !== 'play' || match.players[0].kind !== 'naraberu') return;
  const c = cellAt(e);
  if (!c) return;
  audio.ensure();
  const b = match.players[0].board;
  b.cursor = { x: Math.min(4, c.x), y: c.y };
  drag = { col: c.x, y: c.y, rc: b.riseCount, c: b.C[c.y * 6 + c.x], target: c.x, pending: null };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* 指を追えない環境でも操作は続ける */ }
});
// 指の列だけ覚え、実際の入れ替えは simulate で1刻み1列ずつ進める
canvas.addEventListener('pointermove', e => {
  if (!drag || !match) return;
  const c = cellAt(e);
  if (c) drag.target = c.x;
});
const endDrag = () => { /* 指を離しても、なぞった列までは進める */ };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---- ループ ----
function simulate(n, t) {
  for (let k = 0; k < n && match && !match.result; k++) {
    if (drag && match.players[0].kind === 'naraberu' && touchDragStep(match.players[0].board, drag)) input.tap(0, 'a');
    if (input.pollPads(() => (navigator.getGamepads ? navigator.getGamepads() : [])).pause && !match.result) { pause(); return; }
    const inputs = match.players.map((pl, p) => (ais[p]
      ? ais[p].next(match.players[p].board, match.players[p].pending.D)
      : input.poll(p, REPEAT[match.players[p].kind])));
    if (gesture && humans.includes(0)) {
      const g = gesture.next(), o = inputs[0];
      for (const k2 of ['left', 'right', 'up', 'a', 'b']) o[k2] = o[k2] || g[k2];
      o.downHeld = o.downHeld || g.downHeld;
    }
    input.endFrame();
    const pre = phys.snapshot(match);
    const ev = match.step(inputs);
    phys.afterStep(match, ev, pre);
    phys.tick();
    charas.onEvents(ev, match, t);
    for (const e of ev) if (e.type === 'pop' && e.chain > stats[e.p].maxChain) stats[e.p].maxChain = e.chain;
    renderer.onEvents(ev, match, t);
    audio.onEvents(ev, humans, match);
    buzz(ev);
    checkTutorial(ev);
    if (match.result) finish();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const t = now / 1000;
  if (screen === 'play' && match && !match.result) {
    let dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (countdown > 0) { countdown -= dt; dt = 0; }
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 5) { acc -= 1 / 60; steps++; }
    simulate(steps, t);
    updatePinch(t);
  } else { last = now; padMenu(); }
  renderer.draw(match, labels, t, { mobile, topReserve: tut && mobile && screen === 'play' ? $('tutBar').offsetHeight + 6 : 0 });
  if (screen === 'play' && countdown > 0) drawCountdown();
}
// ピンチの曲: 自分の盤が上まで迫ったら切り替え、3秒落ち着いたら戻す
function inDanger(pl) {
  const b = pl.board;
  if (pl.kind === 'tsunagu') return b.grid.slice(1, 4).some(r => r.some(c => c));
  for (let i = TOP * 6; i < (TOP + 2) * 6; i++) if (b.C[i]) return true;
  return false;
}
function updatePinch(t) {
  if (!match || match.result || tut) return;
  const watch = (humans.length ? humans : [0, 1]).filter(p => p < match.players.length);
  if (watch.some(p => inDanger(match.players[p]))) pinchUntil = t + 3;
  const name = t < pinchUntil ? 'pinch' : 'battle';
  if (audio.bgmName !== name) audio.bgm(name);
}

function drawCountdown() {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.font = '900 64px "M PLUS Rounded 1c",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(10,8,30,.9)';
  const txt = countdown > 0.6 ? 'よーい' : 'スタート！';
  ctx.strokeText(txt, canvas.clientWidth / 2, canvas.clientHeight / 2);
  ctx.fillStyle = '#fff3a8';
  ctx.fillText(txt, canvas.clientWidth / 2, canvas.clientHeight / 2);
  ctx.restore();
}
requestAnimationFrame(frame);
show('loading');
boot();

// デバッグ用
window.__tn = {
  get match() { return match; }, get screen() { return screen; }, get tut() { return tut; },
  phys, charas, audio, settings, records, startMatch, startFlow, startTutorial, openScreen, demo: () => startMatch(true), LEVELS,
  // 検証用: 描画ループが止まる環境でも n 刻み進めて描く
  advance(n) { countdown = 0; const t = performance.now() / 1000; simulate(n, t); renderer.draw(match, labels, t, { mobile, topReserve: tut && mobile ? $('tutBar').offsetHeight + 6 : 0 }); return match && match.frame; },
};
