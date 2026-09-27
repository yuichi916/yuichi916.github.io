// 花火合戦: 相手（CPU）の線を、画面の裏で考える。相手の線はあなたの線に左右されないので、試合のはじめに 3 番ぶんまとめて頼まれる
import { newVsRound, vsPlan, RIVALS, rng32 } from './core.js';

self.onmessage = (ev) => {
  const { id, opts, rival, rngSeed } = ev.data || {};
  let pts = null;
  try { pts = vsPlan(() => newVsRound(opts), 1, RIVALS[rival], rng32(rngSeed)); } catch (e) { pts = null; }
  self.postMessage({ id, pts });
};
