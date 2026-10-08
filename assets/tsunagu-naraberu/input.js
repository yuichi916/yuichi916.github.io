// キー・タッチ → 1刻みぶんの入力 {left,right,up,down,a,b,downHeld,bHeld}
import { TOP, COLS } from './naraberu.js';

const MAPS = {
  p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['KeyF'], b: ['KeyG'] },
  p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Semicolon'], b: ['Quote'] },
  solo: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    a: ['KeyF', 'KeyZ'], b: ['KeyG', 'KeyX'],
  },
};
const NAMES = ['left', 'right', 'up', 'down', 'a', 'b'];
const DAS = 10, ARR = 2;

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const virt = [new Set(), new Set()];
  const virtPressed = [new Set(), new Set()];
  const hold = [{}, {}];
  let maps = [MAPS.solo, MAPS.p2];

  addEventListener('keydown', e => {
    if (e.repeat) return;
    held.add(e.code); pressed.add(e.code);
  });
  addEventListener('keyup', e => held.delete(e.code));
  addEventListener('blur', () => held.clear());

  function setMode(twoPlayer) { maps = twoPlayer ? [MAPS.p1, MAPS.p2] : [MAPS.solo, MAPS.p2]; }
  const isHeld = (p, n) => maps[p][n].some(c => held.has(c)) || virt[p].has(n);
  const wasPressed = (p, n) => maps[p][n].some(c => pressed.has(c)) || virtPressed[p].has(n);

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
  }

  // 止まっている間（カウントダウン・一時停止）に押したものを捨てる
  function reset() {
    pressed.clear();
    virt[0].clear(); virt[1].clear();
    virtPressed[0].clear(); virtPressed[1].clear();
    hold[0] = {}; hold[1] = {};
  }

  return {
    setMode,
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
