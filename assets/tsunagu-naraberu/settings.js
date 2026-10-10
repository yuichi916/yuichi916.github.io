// 設定の読み書き。localStorage が使えない環境でも既定値で動く。
// 保存先 tn-settings-v2。古い tn-settings（kinds 形式）は読み替える。
import { CHAR, CHARACTERS } from './characters.js';

export const KEY_V2 = 'tn-settings-v2';
export const KEY_V1 = 'tn-settings';
export const ACTIONS = ['left', 'right', 'up', 'down', 'a', 'b'];

export const DEFAULTS = Object.freeze({
  mode: 'cpu',
  chars: ['hinata', 'rin'],
  level: 'ふつう',
  handicap: [0, 0],
  // CPU戦の1Pは p1 と p2 の両方のキーを受け付ける
  keys: {
    p1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], a: ['KeyF', 'KeyZ'], b: ['KeyG', 'KeyX'] },
    p2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], a: ['Semicolon'], b: ['Quote'] },
  },
  das: 10, // 押しっぱなしで連続移動が始まるまで（刻み）
  arr: 2, // 連続移動の間隔（刻み）
  touch: 'gesture', // スマホのつなぐ派: gesture（指でなぞる）/ buttons
  vibrate: true,
  // 第3部（設定画面）で使う
  volume: { bgm: 70, se: 80, voice: 90 },
  effects: 'high',
  reduceMotion: false,
});

const clone = o => JSON.parse(JSON.stringify(o));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// 保存値を既定値にかぶせる（型の違う値・知らない項目は捨てる）
function merge(base, over) {
  const out = clone(base);
  if (!isObj(over)) return out;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k], v = over[k];
    if (isObj(b)) out[k] = merge(b, v);
    else if (Array.isArray(b)) { if (Array.isArray(v)) out[k] = v.slice(); }
    else if (typeof v === typeof b) out[k] = v;
  }
  return out;
}

function charsFromKinds(kinds) {
  return kinds.map((k, i) => {
    const list = CHARACTERS.filter(c => c.faction === k);
    if (!list.length) return DEFAULTS.chars[i];
    return list[i === 1 && kinds[0] === k ? 1 : 0].id;
  });
}

function fixChars(s) {
  s.chars = [0, 1].map(i => (CHAR[s.chars[i]] ? s.chars[i] : DEFAULTS.chars[i]));
  return s;
}

export function loadSettings(storage) {
  let raw = null;
  try { raw = storage && storage.getItem(KEY_V2); } catch { raw = null; }
  try {
    if (raw) return fixChars(merge(DEFAULTS, JSON.parse(raw)));
  } catch { return clone(DEFAULTS); }
  let old = null;
  try { old = JSON.parse((storage && storage.getItem(KEY_V1)) || 'null'); } catch { old = null; }
  if (!isObj(old)) return clone(DEFAULTS);
  const s = merge(DEFAULTS, old);
  if (!Array.isArray(old.chars) && Array.isArray(old.kinds)) s.chars = charsFromKinds(old.kinds);
  return fixChars(s);
}

export function saveSettings(storage, s) {
  try { storage && storage.setItem(KEY_V2, JSON.stringify(s)); } catch { /* 保存できない環境 */ }
}

// action に code を割り当てる。同じ code の古い割り当ては、ほかの操作・プレイヤーから外す
export function rebind(keys, player, action, code) {
  for (const p of Object.keys(keys)) for (const a of ACTIONS) keys[p][a] = keys[p][a].filter(c => c !== code);
  keys[player][action] = [code];
  return keys;
}

// CPU戦の1P: 両方の割り当てを合わせる
export function soloKeys(keys) {
  const out = {};
  for (const a of ACTIONS) out[a] = [...new Set([...keys.p1[a], ...keys.p2[a]])];
  return out;
}
