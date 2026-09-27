// 花火合戦: 相手（CPU）の考えを、画面の裏で進める。
// 相手は 1 番ごとに、線とお邪魔玉を先に見せる（あなたの手に左右されない）ので、試合のはじめに 3 番ぶんまとめて頼まれる。
// 返すのは { pts: 相手の線, ojama: お邪魔玉の置き所 }
import { newVsRound, vsFirstPlan, RIVALS, rng32 } from './core.js?v=8';

self.onmessage = (ev) => {
  const { id, opts, rival, rngSeed } = ev.data || {};
  let out = null;
  try { out = vsFirstPlan(() => newVsRound(opts), 1, RIVALS[rival], rng32(rngSeed)); } catch (e) { out = null; }
  self.postMessage({ id, out });
};
