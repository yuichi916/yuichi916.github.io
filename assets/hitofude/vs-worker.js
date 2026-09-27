// 花火合戦: 相手（CPU）の考えを、画面の裏で進める。
// kind 'line' は相手の線（あなたの線に左右されないので、試合のはじめに 3 番ぶんまとめて頼まれる）、
// kind 'ojama' はお邪魔玉の置き所（あなたが線を引いたあとで頼まれる）。lines は置いた順の [持ち主, 線]
import { newVsRound, vsPlace, vsPlan, vsOjamaPlan, RIVALS, rng32 } from './core.js?v=7';

self.onmessage = (ev) => {
  const { id, kind, opts, lines, rival, rngSeed } = ev.data || {};
  let out = null;
  try {
    const make = () => { const st = newVsRound(opts); for (const [o, pts] of lines || []) vsPlace(st, o, pts, { normalized: true }); return st; };
    out = (kind === 'ojama' ? vsOjamaPlan : vsPlan)(make, 1, RIVALS[rival], rng32(rngSeed));
  } catch (e) { out = null; }
  self.postMessage({ id, out });
};
