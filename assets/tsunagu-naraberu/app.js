// 画面遷移とゲームループ。ゲームの中身は match.js、見た目は render.js。
import { CFG, LEVELS } from './config.js';
import { createMatch } from './match.js';
import { createTsunaguAI } from './ai-tsunagu.js';
import { createNaraberuAI } from './ai-naraberu.js';
import { createRenderer } from './render.js';
import { createInput, touchDragStep } from './input.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createCharas } from './chara.js';
import { CHAR, CHARACTERS, hasVoice } from './characters.js';
import { TOP, BOTTOM } from './naraberu.js';

const $ = id => document.getElementById(id);
const canvas = $('stage');
const input = createInput();
const audio = createAudio();
const phys = createFx();
const charas = createCharas({ onSay: (p, key, id) => match && audio.voice(p, id, key, humans.length === 0 || humans.includes(p)) });
const renderer = createRenderer(canvas, { phys, charas });
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
document.body.classList.toggle('mobile', mobile);

const KIND_NAME = { tsunagu: 'つなぐ派', naraberu: 'ならべる派' };
const REPEAT = { tsunagu: ['left', 'right'], naraberu: ['left', 'right', 'up', 'down'] };

const saved = (() => { try { return JSON.parse(localStorage.getItem('tn-settings') || '{}'); } catch { return {}; } })();
const settings = {
  mode: mobile ? 'cpu' : (saved.mode || 'cpu'),
  // キャラで派が決まる。古い保存（kinds）しかなければ、その派の1人目にする
  chars: saved.chars || (saved.kinds || ['tsunagu', 'naraberu']).map((k, i) => CHARACTERS.filter(c => c.faction === k)[i === 1 && (saved.kinds || [])[0] === k ? 1 : 0].id),
  level: saved.level || 'ふつう',
  handicap: saved.handicap || [0, 0],
};
const save = () => { try { localStorage.setItem('tn-settings', JSON.stringify(settings)); } catch { /* 保存できない環境 */ } };

let screen = 'title';
let match = null, ais = [null, null], humans = [0], labels = ['あなた', 'CPU'];
let acc = 0, last = 0, countdown = 0, stats = null, pinchUntil = 0;

function show(id) {
  for (const el of document.querySelectorAll('.overlay')) el.classList.toggle('on', el.id === id);
  screen = id || 'play';
  document.body.dataset.screen = screen;
  // 曲: タイトル・設定はタイトル曲、試合中は対戦曲（ピンチで切り替え）、結果はジングルだけ
  if (screen === 'title' || screen === 'setup') audio.bgm('title');
  else if (screen === 'play' && !audio.bgmName) { pinchUntil = 0; audio.bgm('battle'); }
}

// ---- 設定画面 ----
function renderSetup() {
  for (const btn of document.querySelectorAll('[data-set]')) {
    const [key, idx, val] = btn.dataset.set.split(':');
    let cur;
    if (key === 'mode') cur = settings.mode;
    else if (key === 'char') cur = settings.chars[+idx];
    else if (key === 'level') cur = settings.level;
    else if (key === 'hc') cur = String(settings.handicap[+idx]);
    btn.classList.toggle('sel', cur === val);
  }
  $('levelRow').hidden = settings.mode !== 'cpu';
  $('p2label').textContent = settings.mode === 'cpu' ? 'CPU' : '2P';
  $('p1label').textContent = settings.mode === 'cpu' ? 'あなた' : '1P';
  $('modeRow').hidden = mobile;
  $('keys2p').hidden = settings.mode !== '2p';
  $('keys1').hidden = mobile;
  $('keysTouch').hidden = !mobile;
  $('hcL').textContent = $('p1label').textContent;
  $('hcR').textContent = $('p2label').textContent;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-set]');
  if (!b) return;
  audio.ensure(); audio.move();
  const [key, idx, val] = b.dataset.set.split(':');
  if (key === 'mode') settings.mode = val;
  else if (key === 'char') { settings.chars[+idx] = val; charas.setChars(settings.chars); audio.voice(+idx, val, 'select'); }
  else if (key === 'level') settings.level = val;
  else if (key === 'hc') settings.handicap[+idx] = +val;
  save(); renderSetup();
});

$('btnStart').onclick = () => { audio.ensure(); audio.loadVoices(CHARACTERS.filter(c => hasVoice(c.id)).map(c => c.id)); show('setup'); renderSetup(); };
$('btnGo').onclick = () => { audio.ensure(); startMatch(); };
$('btnAgain').onclick = () => startMatch();
$('btnSetup').onclick = () => { show('setup'); renderSetup(); };
$('btnResume').onclick = () => resume();
$('btnQuit').onclick = () => { match = null; show('setup'); renderSetup(); };
$('btnMute').onclick = () => { audio.ensure(); $('btnMute').textContent = audio.toggle() ? '音 OFF' : '音 ON'; };
$('btnMute').textContent = audio.muted ? '音 OFF' : '音 ON';
$('btnPause').onclick = () => { if (screen === 'play') pause(); else if (screen === 'pause') resume(); };
$('btnHelp').onclick = () => { $('help').classList.toggle('on'); };
$('help').onclick = () => $('help').classList.remove('on');

function startMatch(demo = false) {
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const cfg = CFG;
  const kinds = settings.chars.map(id => CHAR[id].faction);
  match = createMatch({ cfg, kinds, seeds: [seed, seed + 7919], handicap: settings.handicap.slice() });
  const cpu = settings.mode === 'cpu';
  humans = cpu ? [0] : [0, 1];
  labels = cpu ? ['あなた', 'CPU'] : ['1P', '2P'];
  ais = [demo ? makeAI(kinds[0], settings.level, seed + 1) : null, cpu ? makeAI(kinds[1], settings.level, seed) : null];
  if (demo) humans = [];
  input.setMode(!cpu);
  stats = [{ maxChain: 0 }, { maxChain: 0 }];
  countdown = 1.6;
  drag = null;
  input.reset();
  acc = 0; last = performance.now();
  phys.reset(); charas.reset(); charas.setChars(settings.chars); audio.loadVoices(settings.chars.filter(hasVoice));
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

addEventListener('keydown', e => {
  if (e.repeat && ['Escape', 'KeyP', 'Enter'].includes(e.code)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Quote', 'Semicolon'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (screen === 'play') pause(); else if (screen === 'pause') resume();
  }
  if (e.code === 'Enter') {
    if (screen === 'title') $('btnStart').click();
    else if (screen === 'setup') $('btnGo').click();
    else if (screen === 'result') $('btnAgain').click();
  }
  audio.ensure();
});
addEventListener('blur', () => { if (screen === 'play') pause(); });

function finish() {
  const r = match.result;
  const cpu = settings.mode === 'cpu';
  let title;
  if (r.winner === -1) title = '引き分け';
  else if (cpu) title = r.winner === 0 ? 'あなたの勝ち！' : 'CPUの勝ち…';
  else title = `${labels[r.winner]}（${CHAR[settings.chars[r.winner]].name}）の勝ち！`;
  if (cpu && r.winner === 0) audio.win(); else if (cpu && r.winner === 1) audio.lose(); else audio.win();
  charas.finish(match, performance.now() / 1000);
  $('resultTitle').textContent = title;
  const sec = Math.round(r.frames / 60);
  $('resultStats').innerHTML = match.players.map((p, i) => `
    <div class="stat"><b>${labels[i]}・${CHAR[settings.chars[i]].name}（${KIND_NAME[p.kind]}）</b>
    <span>最大 ${stats[i].maxChain} れんさ</span><span>送った攻撃 ${Math.round(p.sent)}</span></div>`).join('')
    + `<div class="stat time">試合時間 ${Math.floor(sec / 60)}分${sec % 60}秒</div>`;
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
let drag = null;
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
canvas.addEventListener('pointerdown', e => {
  if (!match || screen !== 'play' || match.players[0].kind !== 'naraberu') return;
  const c = cellAt(e);
  if (!c) return;
  audio.ensure();
  const b = match.players[0].board;
  b.cursor = { x: Math.min(4, c.x), y: c.y };
  drag = { col: c.x, y: c.y, rc: b.riseCount, c: b.C[c.y * 6 + c.x], target: c.x, pending: null };
  canvas.setPointerCapture(e.pointerId);
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
    const inputs = [0, 1].map(p => (ais[p]
      ? ais[p].next(match.players[p].board, match.players[p].pending.D)
      : input.poll(p, REPEAT[match.players[p].kind])));
    input.endFrame();
    const pre = phys.snapshot(match);
    const ev = match.step(inputs);
    phys.afterStep(match, ev, pre);
    phys.tick();
    charas.onEvents(ev, match, t);
    for (const e of ev) if (e.type === 'pop' && e.chain > stats[e.p].maxChain) stats[e.p].maxChain = e.chain;
    renderer.onEvents(ev, match, t);
    audio.onEvents(ev, humans, match);
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
  } else last = now;
  renderer.draw(match, labels, t, { mobile });
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
  if (!match || match.result) return;
  const watch = humans.length ? humans : [0, 1];
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
show('title');

// デバッグ用
window.__tn = { get match() { return match; }, phys, charas, audio, settings, startMatch, demo: () => startMatch(true), LEVELS,
  // 検証用: 描画ループが止まる環境でも n 刻み進めて描く
  advance(n) { countdown = 0; const t = performance.now() / 1000; simulate(n, t); renderer.draw(match, labels, t, { mobile }); return match && match.frame; } };
