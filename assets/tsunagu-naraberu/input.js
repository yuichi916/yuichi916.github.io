// キー・タッチ → 1刻みぶんの入力 {left,right,up,down,a,b,downHeld,bHeld}
import { TOP, COLS } from './naraberu.js';

import { DEFAULTS, soloKeys } from './settings.js';

const NAMES = ['left', 'right', 'up', 'down', 'a', 'b'];

// ゲームパッド（standard mapping）→ 操作名の集合
const STICK = 0.5;
export function padButtons(gp) {
  const out = new Set();
  if (!gp || !gp.buttons) return out;
  const on = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
  const ax = gp.axes || [];
  if (on(12) || ax[1] < -STICK) out.add('up');
  if (on(13) || ax[1] > STICK) out.add('down');
  if (on(14) || ax[0] < -STICK) out.add('left');
  if (on(15) || ax[0] > STICK) out.add('right');
  if (on(0) || on(3)) out.add('a');
  if (on(1) || on(2)) out.add('b');
  if (on(9)) out.add('pause');
  return out;
}

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const virt = [new Set(), new Set()];
  const virtPressed = [new Set(), new Set()];
  const padHeld = [new Set(), new Set()], padPrev = [new Set(), new Set()];
  const hold = [{}, {}];
  let keys = DEFAULTS.keys, twoP = false;
  let maps = [soloKeys(keys), keys.p2];
  let DAS = DEFAULTS.das, ARR = DEFAULTS.arr;

  addEventListener('keydown', e => {
    if (e.repeat) return;
    held.add(e.code); pressed.add(e.code);
  });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  function remap() { maps = twoP ? [keys.p1, keys.p2] : [soloKeys(keys), keys.p2]; }
  function setMode(twoPlayer) { twoP = !!twoPlayer; remap(); }
  function setKeys(k) { keys = k; remap(); }
  function setTiming(das, arr) { DAS = Math.max(1, das | 0); ARR = Math.max(1, arr | 0); }

  // 毎刻みの最初に呼ぶ。接続順に 1P・2P（ひとりで遊ぶときは、どのパッドでも 1P）。返り値 {pause}: Start を押した瞬間
  function pollPads(getPads) {
    let pads = [];
    try { pads = Array.from(getPads() || []).filter(g => g && g.connected !== false); } catch { pads = []; }
    pads.sort((x, y) => x.index - y.index);
    let pause = false;
    for (let p = 0; p < 2; p++) {
      padPrev[p] = padHeld[p];
      const list = twoP ? (pads[p] ? [pads[p]] : []) : (p === 0 ? pads : []);
      const now = new Set();
      for (const g of list) for (const n of padButtons(g)) now.add(n);
      padHeld[p] = now;
      if (now.has('pause') && !padPrev[p].has('pause')) pause = true;
    }
    return { pause };
  }

  const isHeld = (p, n) => maps[p][n].some(c => held.has(c)) || virt[p].has(n) || padHeld[p].has(n);
  const wasPressed = (p, n) => maps[p][n].some(c => pressed.has(c)) || virtPressed[p].has(n)
    || (padHeld[p].has(n) && !padPrev[p].has(n));

  function poll(p, repeatDirs) {
    const out = { left: false, right: false, up: false, down: false, a: false, b: false, downHeld: false, bHeld: false };
    for (const n of NAMES) {
      const h = isHeld(p, n), pr = wasPressed(p, n);
      if (pr) { out[n] = true; hold[p][n] = 0; continue; }
      if (!h) { hold[p][n] = 0; continue; }
      hold[p][n] = (hold[p][n] || 0) + 1;
      if (repeatDirs.includes(n) && hold[p][n] >= DAS && (hold[p][n] - DAS) % ARR === 0) out[n] = true;
    }
    out.downHeld = isHeld(p, 'down');
    out.bHeld = isHeld(p, 'b');
    return out;
  }

  // 両プレイヤーの poll が終わってから呼ぶ
  function endFrame() {
    pressed.clear();
    virtPressed[0].clear(); virtPressed[1].clear();
    padPrev[0] = padHeld[0]; padPrev[1] = padHeld[1];
  }

  // 止まっている間（カウントダウン・一時停止）に押したものを捨てる
  function reset() {
    pressed.clear();
    virt[0].clear(); virt[1].clear();
    virtPressed[0].clear(); virtPressed[1].clear();
    hold[0] = {}; hold[1] = {};
    padPrev[0] = padHeld[0]; padPrev[1] = padHeld[1];
  }

  return {
    setMode,
    setKeys,
    setTiming,
    pollPads,
    reset,
    poll,
    endFrame,
    isDown: code => held.has(code),
    press(p, n) { virt[p].add(n); virtPressed[p].add(n); },
    release(p, n) { virt[p].delete(n); },
    tap(p, n) { virtPressed[p].add(n); },
    consumeKey(code) { const had = pressed.has(code); pressed.delete(code); return had; },
  };
}

// ならべる派のなぞり入れ替えを1刻みに1列ずつ進める。
// drag = {col, y, rc, c, target, pending}: col=つかんだパネルの今の列、c=その色、target=指の列
// 返り値が真なら、この刻みで入れ替え(a)を押す。前の刻みの入れ替えが断られていたら追いかけるのをやめる。
export function touchDragStep(b, drag) {
  if (!drag) return false;
  const y = drag.y - (b.riseCount - drag.rc);
  if (y < TOP) { drag.target = drag.col; drag.pending = null; return false; }
  if (drag.pending != null) {
    if (b.C[y * COLS + drag.pending] === drag.c) drag.col = drag.pending;
    else drag.target = drag.col;
    drag.pending = null;
  }
  if (drag.target === drag.col) return false;
  const nc = drag.col + Math.sign(drag.target - drag.col);
  b.cursor = { x: Math.min(nc, drag.col), y };
  drag.pending = nc;
  return true;
}

// つなぐ派のスマホ操作: 盤の上で指を動かした様子 → 1刻みぶんの入力に足すもの。
// 横に1マス分すべるごとに1列（1刻みに1列ずつ出す）／半マス未満の動きで離したらタップ（左半分=左回転・右半分=右回転）
// ／下へ速くはじく=すぐ落とす／ゆっくり下へ1マス以上=離すまで速く落とす
export function createTsunaguGesture({ cell, width }) {
  const queue = [];
  let g = null, soft = false;
  const FLICK = 12; // はじく速さのしきい値（マス/秒）。1.2マスを0.1秒

  function down(x, y, t) { g = { x0: x, y0: y, t0: t, ax: x, moved: false }; soft = false; }
  function move(x, y, t) {
    if (!g) return;
    while (x - g.ax >= cell) { queue.push('right'); g.ax += cell; }
    while (g.ax - x >= cell) { queue.push('left'); g.ax -= cell; }
    if (Math.abs(x - g.x0) >= cell / 2 || Math.abs(y - g.y0) >= cell / 2) g.moved = true;
    const dy = y - g.y0, dt = Math.max(1e-3, t - g.t0);
    soft = dy >= cell && dy / dt / cell < FLICK;
  }
  function up(x, y, t) {
    if (!g) return;
    move(x, y, t);
    const dy = y - g.y0, dt = Math.max(1e-3, t - g.t0);
    if (dy >= cell && dy / dt / cell >= FLICK) queue.push('up');
    else if (!g.moved) queue.push(x < width / 2 ? 'a' : 'b');
    g = null; soft = false;
  }
  function next() {
    const o = { left: false, right: false, up: false, a: false, b: false, downHeld: soft };
    const k = queue.shift();
    if (k) o[k] = true;
    return o;
  }
  return { down, move, up, next, cancel() { g = null; soft = false; queue.length = 0; } };
}
