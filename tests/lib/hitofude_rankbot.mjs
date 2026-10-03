// ランキングのテスト用のボット: 「今夜の一筆」をページと同じ手順で遊び（屋台・お守り・やりなおし）、夜ごとに送る中身を作る
import * as K from '../../assets/hitofude/core.js';
import * as T from '../../assets/hitofude/trial.js';

export const ctxFor = (day) => {
  const seed = K.hashStr('hitofude-daily:' + day), moon = K.moonIndex(K.moonPhase(day));
  const wishes = Array.from({ length: K.NIGHTS }, (_, n) => K.wishFor(seed, n, 0, moon));
  return { seed, moon, wishOf: (n) => wishes[n] };
};

// ページと同じ手順で 1 回の祭りを遊ぶ。夜ごとに送る中身（payloads）と、ページが数えた点（total）を返す
export function playRun(day, { weakNight = -1, reroll = true, buyInk = true } = {}) {
  const ctx = ctxFor(day), { seed, moon } = ctx;
  const run = { charms: [], bank: 0, wallet: 0, lives: K.levelFx(0).spare, total: 0 };
  const payloads = []; let events = [];
  for (let n = 0; n < K.NIGHTS; n++) {
    const params = { seed, night: n, charms: run.charms, moon, bank: run.bank, level: 0 };
    let retries = 0, st, res;
    for (;;) {
      st = K.newRound(params);
      const best = T.bestTrial(K, params, [0.9]).route;
      const route = n === weakNight && retries === 0 ? best.slice(0, 2) : best; // わざと短い線で散って、やりなおす夜
      res = K.runToEnd(st, [route]);
      if (res.score >= st.target || run.lives <= 0) break;
      run.lives--; retries++;
    }
    const pass = res.score >= st.target;
    const wish = ctx.wishOf(n), wishOk = !!(wish && K.wishMet(st, wish, st.target));
    run.wallet += [res.score >= st.target, res.score >= st.target * K.levelFx(0).star2, !!res.allClear].filter(Boolean).length + (wishOk ? (wish.stars || 1) : 0);
    if (pass) run.bank = K.inkCarry(st);
    run.total += res.score;
    payloads.push({ n, events, retries, ad: false, strokes: st.strokes.map((s) => s.map((p) => ({ x: p.x, y: p.y }))) });
    events = [];
    if (!pass || n >= K.NIGHTS - 1) break;
    // 屋台とお守り（ページの showPick と同じ順と値段）
    if (buyInk && run.wallet >= 1 && run.bank < K.BASE_INK) { run.wallet -= 1; run.bank = Math.min(K.BASE_INK, run.bank + Math.round(K.BASE_INK / 4)); events.push({ t: 'ink' }); }
    const rounds = K.isBoss(n) ? 2 : 1;
    for (let round = 0; round < rounds; round++) {
      let rr = 0;
      if (reroll && run.wallet >= 1) { run.wallet -= 1; rr = 1; events.push({ t: 'reroll' }); }
      const offer = K.offerCharms(seed, n, run.charms, rr ? 2 + round + 2 * rr : round, { level: 0 });
      if (!offer.length) break;
      const id = offer[0], lv = {}; for (const c of run.charms) lv[c] = (lv[c] || 0) + 1;
      let drop;
      if (!lv[id] && Object.keys(lv).length >= K.slotsFor(0)) { drop = Object.keys(lv)[0]; run.charms = run.charms.filter((x) => x !== drop); run.wallet += lv[drop]; }
      run.charms.push(id); events.push({ t: 'pick', id, ...(drop ? { drop } : {}) });
    }
  }
  return { ctx, payloads, total: run.total };
}
