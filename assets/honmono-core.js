/* どっちが本物？ — 出題の選び方と共有文（画面に依らない部分）。
   ブラウザでは window.Honmono、Node では module.exports。 */
(function (root) {
  'use strict';

  // 0 以上 1 未満を返す乱数（テストでは差し替える）
  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // n 問を選ぶ。同じ作品は1回だけ、同じ作家が続かない。左右（原文が左か）はそれぞれ乱数で決める
  function pickRound(pairs, n, rnd) {
    rnd = rnd || Math.random;
    for (let attempt = 0; attempt < 200; attempt++) {
      const pool = shuffle(pairs, rnd);
      const out = [];
      const used = new Set();
      while (out.length < n) {
        const prev = out.length ? out[out.length - 1].pair : null;
        const k = pool.findIndex((p) => !used.has(p.id) && (!prev || (p.author !== prev.author && p.work_id !== prev.work_id)));
        if (k < 0) break;
        const p = pool[k];
        used.add(p.id);
        out.push({ pair: p, originalLeft: rnd() < 0.5 });
      }
      if (out.length === n) return out;
    }
    throw new Error('出題を組めませんでした');
  }

  function shareText(marks, url) {
    const ok = marks.filter(Boolean).length;
    return 'どっちが本物？ — 文豪の原文とAIの文\n' +
      marks.length + '問中' + ok + '問 正解\n' +
      marks.map((m) => (m ? '⭕' : '❌')).join('') + '\n' + url;
  }

  function verdict(ok, n) {
    const r = ok / n;
    if (r === 1) return '全問正解。文豪の手ざわりを見分けられています。';
    if (r >= 0.8) return 'かなりの目利きです。';
    if (r >= 0.6) return '半分より上。AIの文のくせが見えはじめています。';
    if (r >= 0.4) return '五分五分あたり。AIの文も、それらしく書けています。';
    return 'AIの文を本物と思うことが多めでした。解説で見分け方をどうぞ。';
  }

  const api = { shuffle, pickRound, shareText, verdict };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Honmono = api;
})(typeof window !== 'undefined' ? window : globalThis);
