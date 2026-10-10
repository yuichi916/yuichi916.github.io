// 画面ごとの中身を組み立てる（DOM だけ。ゲームの中身は知らない）。
import { CHARACTERS, CHAR } from './characters.js';

const BASE = new URL('./', import.meta.url).href;
const img = (id, name) => `${BASE}chara/${id}/${name}.webp`;
const FACTION = { tsunagu: 'つなぐ派', naraberu: 'ならべる派' };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderTitleCast(el) {
  el.innerHTML = ['hinata', 'rin', 'momo', 'suzu'].map(id => `<img src="${img(id, 'select')}" alt="${esc(CHAR[id].name)}">`).join('');
}

// キャラ選択のカード。random=true なら「おまかせ」も出す
export function renderCards(el, { player, selected, random = false, showRandom = false }) {
  const cards = CHARACTERS.map(c => `
    <button class="ccard${!random && selected === c.id ? ' sel' : ''}" data-set="char:${player}:${c.id}" style="--cc:${c.color.main}" title="${esc(c.name)}（${FACTION[c.faction]}・${esc(c.trait)}）" type="button">
      <img src="${img(c.id, 'select')}" alt=""><b>${esc(c.name)}</b><small>${FACTION[c.faction]}</small>
    </button>`).join('');
  el.innerHTML = cards;
  // 「おまかせ」はカードの段の下に小さく（段の列数をそろえる）
  let r = el.parentElement.querySelector('.randrow');
  if (!r) { r = document.createElement('div'); r.className = 'randrow'; el.after(r); }
  r.innerHTML = showRandom ? `<button class="chip${random ? ' sel' : ''}" data-set="char:${player}:random" type="button">？ おまかせ（試合ごとにランダム）</button>` : '';
}

const pct = (w, l) => (w + l ? `${Math.round((w / (w + l)) * 100)}%` : '―');
export function renderRecords(el, rec, levels) {
  const lv = levels.map(name => {
    const r = rec.cpu[name] || { win: 0, lose: 0, draw: 0 };
    return `<tr><th>${esc(name)}</th><td class="num">${r.win}勝</td><td class="num">${r.lose}敗</td><td class="num">${pct(r.win, r.lose)}</td></tr>`;
  }).join('');
  const ch = CHARACTERS.map(c => {
    const r = rec.chars[c.id] || { win: 0, lose: 0, plays: 0 };
    return `<tr><th style="color:${c.color.main}">${esc(c.name)}</th><td class="num">${r.plays}回</td><td class="num">${r.win}勝${r.lose}敗</td><td class="num">${pct(r.win, r.lose)}</td></tr>`;
  }).join('');
  el.innerHTML = `
    <div class="rbig"><div>遊んだ回数<b>${rec.plays}</b></div><div>最大連鎖<b>${rec.bestChain}</b></div><div>最大攻撃<b>${rec.bestAttack}</b></div></div>
    <table class="rtable"><thead><tr><th>CPUの強さ</th><th>勝ち</th><th>負け</th><th>勝率</th></tr></thead><tbody>${lv}</tbody></table>
    <table class="rtable"><thead><tr><th>キャラ</th><th>遊んだ</th><th>CPU戦</th><th>勝率</th></tr></thead><tbody>${ch}</tbody></table>
    <p class="keys" style="margin:0 0 16px">最大連鎖・最大攻撃はCPU戦の記録です。</p>`;
}

export function renderOptions(el, s) {
  const slider = (key, label) => `<div class="slider"><span style="min-width:5em">${label}</span><input type="range" min="0" max="100" step="5" value="${s.volume[key]}" data-vol="${key}"><b>${s.volume[key]}</b></div>`;
  const chip = (key, val, text) => `<button class="chip${s[key] === val ? ' sel' : ''}" type="button" data-opt="${key}:${val}">${text}</button>`;
  el.innerHTML = `
    ${slider('bgm', '曲')}${slider('se', '効果音')}${slider('voice', '声')}
    <div class="row" style="margin-top:14px"><label>演出</label>${chip('effects', 'high', 'ふつう')}${chip('effects', 'low', 'ひかえめ')}</div>
    <p class="keys" style="margin:-6px 0 12px">ひかえめ: カットインなし、破片を減らす（動作が重いときに）</p>
    <div class="row"><label>揺れ・点滅</label>${chip('reduceMotion', false, 'あり')}${chip('reduceMotion', true, 'おさえる')}</div>
    <p class="keys" style="margin:-6px 0 0">おさえる: 画面の揺れや点滅、カットインを出しません</p>`;
}

export function renderResult({ title, win, lose, best, statsHtml }) {
  const $ = id => document.getElementById(id);
  $('resultTitle').textContent = title;
  $('resWin').src = win ? img(win.id, win.expr) : '';
  $('resWin').hidden = !win;
  $('resLose').src = lose ? img(lose.id, lose.expr) : '';
  $('resLose').hidden = !lose;
  $('resultBest').innerHTML = best.map(b => `<span class="badge">${esc(b)}</span>`).join('');
  $('resultStats').innerHTML = statsHtml;
}

export function setupVS([l, r], labels) {
  const $ = id => document.getElementById(id);
  $('vsL').src = img(l, 'select'); $('vsR').src = img(r, 'select');
  $('vsNameL').innerHTML = `${esc(CHAR[l].name)}<small>${esc(labels[0])}</small>`;
  $('vsNameR').innerHTML = `${esc(CHAR[r].name)}<small>${esc(labels[1])}</small>`;
  // アニメをやり直す
  const w = $('vsWrap'); w.style.display = 'none'; void w.offsetWidth; w.style.display = '';
}

let toastTimer = 0;
export function toast(text, ms = 1100) {
  const el = document.getElementById('toast');
  el.textContent = text; el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}

// キーボード・ゲームパッドで、表示中の画面のボタンを選ぶ（左右上下＝前後、決定、戻る）
export function focusables(root) {
  return [...root.querySelectorAll('button, input[type=range], summary')].filter(e => !e.hidden && e.offsetParent !== null && !e.closest('[hidden]'));
}
export function moveFocus(root, dir) {
  const list = focusables(root);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const n = i < 0 ? 0 : (i + dir + list.length) % list.length;
  list[n].focus();
}
