// お守りを選ぶ画面の「次の夜の目安」を、画面の裏で試し燃やしして返す（重いので、画面を止めないように）。
// 受けとる: { id, base: newRound の条件（charms 以外）, sets: お守りの並びのリスト, budgets }。返す: { id, scores }
import * as K from './core.js';
import { bestTrial } from './trial.js';

self.onmessage = (ev) => {
  const { id, base, sets, budgets } = ev.data || {};
  const scores = [];
  for (const charms of sets || []) {
    let sc = 0;
    try { sc = bestTrial(K, { ...base, charms }, budgets).score; } catch (e) { sc = 0; }
    scores.push(sc);
    self.postMessage({ id, i: scores.length - 1, score: sc }); // 1 つ出るごとに知らせる（ゲージが順に伸びる）
  }
};
