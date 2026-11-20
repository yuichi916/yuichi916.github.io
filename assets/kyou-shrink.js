/* きょうの県 — 地図を削る決まり。画面に依存しない。
 * ブラウザでは window.KyouShrink、Node では module.exports。
 * scripts/kyou_no_ken/test_shrink.js がこのファイルをそのまま読み込んで検査する。
 *
 * 決まり:
 *  - 統計のヒント: その統計で、正解の県の全国順位から ±WIDTH[ヒントの番号] 位以内の県だけ残す
 *  - 地方のヒント: 正解と同じ地方の県だけ残す
 *  - 外した答え: 答えた県は消す。答えた県から見た距離の区分（150km以内 / 400km以内 / それより遠い）が
 *    正解と同じ県だけ残す
 *  すべての条件の共通部分が「残りの候補」。正解はどの条件も必ず満たす（tools/test_logic.js で確かめる）。
 */
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./kyou-no-ken-core.js') : root.KyouNoKen);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KyouShrink = api;
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';

  // ヒントの番号（0始まり）ごとの順位の幅。前のヒントほど広く残し、少しずつ削れるようにする。
  // 案の「±4位」のままだと、推測なしでもヒント3で71%の日が1県に決まってしまう（tools/sim_width.js）。
  // この幅だと 47→約28→14→6→2.5→1.4→1.1 県と、ヒントごとに半分くらいずつ削れる。
  const WIDTH = [14, 11, 8, 6, 5];

  function band(km) {
    if (km <= 150) return 0;
    if (km <= 400) return 1;
    return 2;
  }

  /** ヒント1つで残る県の集合（Set） */
  function keepByHint(data, puzzle, k) {
    const h = puzzle.hints[k];
    const a = puzzle.pref;
    const keep = new Set();
    if (h.type === 'region') {
      const reg = data.prefs[a].region;
      data.prefs.forEach((p, i) => { if (p.region === reg) keep.add(i); });
      return keep;
    }
    const ranks = data.indicators[h.index].ranks;
    const w = WIDTH[Math.min(k, WIDTH.length - 1)];
    for (let i = 0; i < ranks.length; i++) if (Math.abs(ranks[i] - ranks[a]) <= w) keep.add(i);
    return keep;
  }

  /** 外した答え1つで残る県の集合（Set） */
  function keepByGuess(data, puzzle, g) {
    const a = puzzle.pref;
    const keep = new Set();
    if (g === a) { keep.add(a); return keep; }
    const target = band(Core.clue(data, g, a).km);
    for (let i = 0; i < data.prefs.length; i++) {
      if (i === g) continue;
      if (band(Core.clue(data, g, i).km) === target) keep.add(i);
    }
    return keep;
  }

  /** 開いたヒントの数と外した答えの列から、残りの候補（添字の配列、昇順） */
  function candidates(data, puzzle, opened, guesses) {
    let cur = data.prefs.map((_, i) => i);
    for (let k = 0; k < opened; k++) {
      const keep = keepByHint(data, puzzle, k);
      cur = cur.filter((i) => keep.has(i));
    }
    for (const g of guesses || []) {
      if (g < 0 || g === puzzle.pref) continue;
      const keep = keepByGuess(data, puzzle, g);
      cur = cur.filter((i) => keep.has(i));
    }
    return cur;
  }

  return { WIDTH, band, keepByHint, keepByGuess, candidates };
});
