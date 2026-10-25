/* まぜる漢字: 画面に依存しない純粋な関数（ブラウザと node の両方で動く）。
 * 判定・点・段位・共有文・問題の生成（れんしゅう・プリント）・和同開珎の一意性。
 * 検査: node scripts/kanji/test_core.mjs
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KanjiCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POINTS = { 2: 1, 3: 3, 4: 5 };
  var RANKS = [
    { name: '見習い', p: 0 }, { name: '手習い', p: 0.10 }, { name: '一人前', p: 0.25 },
    { name: '職人', p: 0.40 }, { name: '名人', p: 0.60 }, { name: '達人', p: 0.80 }, { name: '漢字王', p: 1 }
  ];
  var KANJI_RE = /^[一-鿿]+$/;
  var KANA_RE = /[぀-ヿ]/;

  function points(word) { return POINTS[word.length] || 0; }
  function totalPoints(words) { var s = 0; for (var i = 0; i < words.length; i++) s += points(words[i]); return s; }

  /** 段位のしきい値（点）。漢字王は満点。 */
  function rankThresholds(max) {
    return RANKS.map(function (r, i) { return i === RANKS.length - 1 ? max : Math.ceil(r.p * max); });
  }
  /** 今の段位と、次の段位まであと何点か。 */
  function rankOf(score, max) {
    var th = rankThresholds(max), i = 0;
    for (var k = 0; k < th.length; k++) if (score >= th[k]) i = k;
    var next = null, need = 0;
    for (var j = i + 1; j < th.length; j++) { if (th[j] > score) { next = RANKS[j].name; need = th[j] - score; break; } }
    return { i: i, name: RANKS[i].name, next: next, need: need, th: th, max: max };
  }

  /** 辞書の索引。rows = [[語, 読み, 学年, 質], ...]（words.json の common）、grade = kanji.json（字→学年） */
  function makeIndex(rows, proper, grade) {
    var byWord = new Map(), byChar = new Map(), order = new Map();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], w = r[0];
      byWord.set(w, r); order.set(w, i);
      var seen = {};
      for (var k = 0; k < w.length; k++) {
        var ch = w[k];
        if (seen[ch]) continue; seen[ch] = 1;
        if (!byChar.has(ch)) byChar.set(ch, []);
        byChar.get(ch).push(r);
      }
    }
    return { rows: rows, byWord: byWord, byChar: byChar, order: order, proper: new Set(proper || []), grade: grade || {} };
  }

  /** 盤の答え: 7字だけでできた common 語のうち質2でない語（rows の並び順）。
   *  中央の字は必須ではない（daily.json と同じ決まり。質2の語は「辞書にはある言葉」として扱う）。 */
  function answers(idx, center, outer) {
    var letters = center + outer, set = {}, seen = new Set(), out = [];
    for (var i = 0; i < letters.length; i++) set[letters[i]] = 1;
    for (var c = 0; c < letters.length; c++) {
      var list = idx.byChar.get(letters[c]) || [];
      for (var j = 0; j < list.length; j++) {
        var w = list[j][0];
        if (seen.has(w) || list[j][3] === 2) continue;
        var ok = true;
        for (var k = 0; k < w.length; k++) if (!set[w[k]]) { ok = false; break; }
        if (ok) { seen.add(w); out.push(list[j]); }
      }
    }
    out.sort(function (x, y) { return idx.order.get(x[0]) - idx.order.get(y[0]); });
    return out;
  }

  /** 1つの答えを判定する。
   * ctx = { center, letters: 7字の文字列, answerSet: Set, found: Set, isExtra: fn(word)->bool|null }
   * 戻り値 kind: ok / dup / extra / none / badchar / short / long / kana / empty
   * isExtra が null を返したら（辞書の読み込み前）kind は 'pending'。 */
  function judge(raw, ctx) {
    var w = String(raw || '').replace(/\s+/g, '');
    if (!w) return { kind: 'empty', word: w };
    if (KANA_RE.test(w)) return { kind: 'kana', word: w };
    if (!KANJI_RE.test(w)) return { kind: 'badchar', word: w, bad: w.replace(/[一-鿿]/g, '').slice(0, 1) };
    if (w.length < 2) return { kind: 'short', word: w };
    if (w.length > 4) return { kind: 'long', word: w };
    for (var i = 0; i < w.length; i++) if (ctx.letters.indexOf(w[i]) < 0) return { kind: 'badchar', word: w, bad: w[i] };
    if (ctx.found.has(w)) return { kind: 'dup', word: w };
    if (ctx.answerSet.has(w)) return { kind: 'ok', word: w, pts: points(w) };
    var ex = ctx.isExtra ? ctx.isExtra(w) : false;
    if (ex === null) return { kind: 'pending', word: w };
    return { kind: ex ? 'extra' : 'none', word: w };
  }

  /** 見つけた割合を9マスで。1語でも見つけたら1マス以上、全部でなければ8マスまで。 */
  function gauge(found, total) {
    var k = total ? Math.round(found / total * 9) : 0;
    if (found > 0 && k === 0) k = 1;
    if (found < total && k === 9) k = 8;
    return '🟩'.repeat(k) + '⬜'.repeat(9 - k);
  }

  /** 共有文（ネタバレなし。中央の字だけ）。 */
  function shareText(o) {
    var d = o.date.split('-');
    var mmdd = Number(d[1]) + '/' + Number(d[2]);
    return 'まぜる漢字 ' + mmdd + '「' + o.center + '」\n' +
      o.rank + ' ★' + o.found + '語 / ' + o.total + '語\n' +
      gauge(o.found, o.total) + '\n' +
      '#まぜる漢字\n' +
      (o.url || 'https://yuichi916.github.io/mazeru.html?ref=daily');
  }

  /** ヒント表: 頭の字 × 字数 の残りと全部。 */
  function hintGrid(answerWords, found) {
    var heads = [], cells = {}, rest = 0;
    answerWords.forEach(function (w) {
      var h = w[0], n = w.length;
      if (!cells[h]) { cells[h] = { 2: [0, 0], 3: [0, 0], 4: [0, 0] }; heads.push(h); }
      cells[h][n][1]++;
      if (!found.has(w)) { cells[h][n][0]++; rest++; }
    });
    return { heads: heads, cells: cells, rest: rest };
  }

  // ------------------------------------------------------------ 乱数（種から同じ並びを作る）
  function hashSeed(s) {
    s = String(s); var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function rng(seed) {
    var a = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(arr, r) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ------------------------------------------------------------ 盤を作る（れんしゅう・プリントの形式B）
  /** 盤を評価する。条件に合わなければ null（build_daily.py の score_board と同じ考え方）。
   *  o = { min, max, target, maxGrade, needLong, minUse, centerShare, minCenter, maxQ1 } */
  function evalBoard(idx, center, outer, o) {
    var ans = answers(idx, center, outer);
    var n = ans.length;
    if (n < o.min || n > o.max) return null;
    var longs = 0, q1 = 0, prop = 0, withc = 0, uses = {};
    for (var i = 0; i < n; i++) {
      var r = ans[i], w = r[0];
      if (r[3] === 2) return null;
      if (r[2] > o.maxGrade) return null;
      if (w.length >= 3) longs++;
      if (r[3] !== 0) q1++;
      if (idx.proper.has(w)) prop++;
      if (w.indexOf(center) >= 0) withc++;
      var seen = {};
      for (var k = 0; k < w.length; k++) if (!seen[w[k]]) { seen[w[k]] = 1; uses[w[k]] = (uses[w[k]] || 0) + 1; }
    }
    if (prop > 2 || q1 > (o.maxQ1 == null ? 4 : o.maxQ1)) return null;
    if (o.needLong && longs < 1) return null;
    if (withc < (o.minCenter || 3) || withc < (o.centerShare || 0.35) * n) return null;
    var minUse = 99;
    for (var j = 0; j < outer.length; j++) { var u = uses[outer[j]] || 0; if (u < (o.minUse || 1)) return null; if (u < minUse) minUse = u; }
    var score = ((n - q1) / n) * 10 + Math.min(longs, 4) * 0.8 - Math.abs(n - o.target) * 0.2 + Math.min(minUse, 4) * 0.4 + (withc / n) * 3 - prop * 0.8;
    return { score: score, answers: ans };
  }

  /** 学年の範囲で盤を作る（れんしゅう・プリントの形式B）。山登りで探す。
   *  o = evalBoard の条件 + { centerMaxGrade, rng, tries } */
  function makePuzzle(idx, o) {
    var r = o.rng || Math.random;
    var cmax = o.centerMaxGrade || Math.min(o.maxGrade, 6);
    var centers = [];
    idx.byChar.forEach(function (list, ch) { var g = idx.grade[ch]; if (g && g <= cmax) centers.push(ch); });
    centers.sort();
    var best = null, tries = o.tries || 60;
    for (var t = 0; t < tries && !(best && t >= 12); t++) {
      var c = pick(centers, r);
      var nb = new Map();
      (idx.byChar.get(c) || []).forEach(function (row) {
        var w = row[0];
        if (w.length !== 2 || row[3] === 2 || row[2] > o.maxGrade) return;
        for (var k = 0; k < 2; k++) if (w[k] !== c) nb.set(w[k], (nb.get(w[k]) || 0) + 1 + (row[3] === 0 ? 1 : 0));
      });
      var pool = Array.from(nb.keys()).sort(function (a, b) { return nb.get(b) - nb.get(a) || (a < b ? -1 : 1); }).slice(0, 14);
      if (pool.length < 6) continue;
      var soft = function (outer) {
        var ev = evalBoard(idx, c, outer.join(''), o);
        if (ev) return { v: ev.score, ev: ev };
        var a = answers(idx, c, outer.join('')), bad = 0, wc = 0;
        for (var i = 0; i < a.length; i++) { if (a[i][3] === 2 || a[i][2] > o.maxGrade) bad++; if (a[i][0].indexOf(c) >= 0) wc++; }
        return { v: -100 + Math.min(a.length, o.max) - Math.max(0, a.length - o.max) - 6 * bad + wc * 0.5, ev: null };
      };
      for (var rs = 0; rs < 3; rs++) {
        var cur = rs === 0 ? pool.slice(0, 6) : shuffle(pool, r).slice(0, 6), cv = soft(cur), moved = true, steps = 0;
        while (moved && steps++ < 12) {
          moved = false;
          for (var i = 0; i < 6; i++) for (var k = 0; k < pool.length; k++) {
            if (cur.indexOf(pool[k]) >= 0) continue;
            var cand = cur.slice(); cand[i] = pool[k];
            var v = soft(cand);
            if (v.v > cv.v + 1e-9) { cur = cand; cv = v; moved = true; }
          }
        }
        if (cv.ev && (!best || cv.v > best.score)) best = { center: c, outer: shuffle(cur, r).join(''), answers: cv.ev.answers, score: cv.v };
      }
    }
    return best;
  }

  // ------------------------------------------------------------ 和同開珎（プリントの形式A）
  /** 2字の common 語の索引: after[a] = a□ になる□の集合、before[x] = □x になる□の集合。 */
  function makeTwoIndex(rows, filter) {
    var after = new Map(), before = new Map();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], w = r[0];
      if (w.length !== 2 || w[0] === w[1]) continue;
      if (filter && !filter(r)) continue;
      if (!after.has(w[0])) after.set(w[0], new Set());
      after.get(w[0]).add(w[1]);
      if (!before.has(w[1])) before.set(w[1], new Set());
      before.get(w[1]).add(w[0]);
    }
    return { after: after, before: before };
  }
  /** 上・左の字（□の前）と右・下の字（□の後ろ）から、□に入る字の候補をすべて返す。 */
  function wadouCandidates(two, up, left, right, down) {
    var A = two.after.get(up), B = two.after.get(left), C = two.before.get(right), D = two.before.get(down);
    if (!A || !B || !C || !D) return [];
    var out = [];
    A.forEach(function (x) { if (B.has(x) && C.has(x) && D.has(x)) out.push(x); });
    return out.sort();
  }
  /** 問題が1字だけに決まるか（common 全体で確かめる）。 */
  function wadouUnique(twoAll, p) {
    var c = wadouCandidates(twoAll, p.up, p.left, p.right, p.down);
    return c.length === 1 && c[0] === p.x;
  }
  /** 和同開珎の問題を作る。o = { maxGrade, minXGrade, maxQ, rng, avoid:Set(使った□) }
   *  twoOk = 難しさに合う語だけの索引、twoAll = common 全体の索引（一意性の確認用）。 */
  function makeWadou(idx, twoOk, twoAll, o) {
    var r = o.rng || Math.random, avoid = o.avoid || new Set();
    var xs = [];
    twoOk.before.forEach(function (pre, x) {
      var post = twoOk.after.get(x);
      var g = idx.grade[x];
      if (!post || pre.size < 2 || post.size < 2 || avoid.has(x)) return;
      if (!g || g > o.maxGrade || g < (o.minXGrade || 1)) return;
      xs.push(x);
    });
    xs.sort();
    for (var t = 0; t < 400 && xs.length; t++) {
      var x = pick(xs, r);
      var pre = shuffle(Array.from(twoOk.before.get(x)), r), post = shuffle(Array.from(twoOk.after.get(x)), r);
      for (var a = 0; a < Math.min(pre.length, 6); a++) for (var b = a + 1; b < Math.min(pre.length, 6); b++)
        for (var c = 0; c < Math.min(post.length, 6); c++) for (var d = c + 1; d < Math.min(post.length, 6); d++) {
          var p = { x: x, up: pre[a], left: pre[b], right: post[c], down: post[d] };
          var five = [p.x, p.up, p.left, p.right, p.down];
          if (new Set(five).size !== 5) continue;
          if (!wadouUnique(twoAll, p)) continue;
          p.words = [p.up + x, p.left + x, x + p.right, x + p.down];
          return p;
        }
    }
    return null;
  }

  // ------------------------------------------------------------ 日付（日本時間）
  function jstDate(ms) {
    var d = new Date(ms + 9 * 3600000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function addDays(iso, n) {
    var p = iso.split('-').map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function msToNextJstMidnight(ms) {
    var j = ms + 9 * 3600000;
    return 86400000 - (((j % 86400000) + 86400000) % 86400000);
  }
  /** 連続日数: 今日（または昨日）からさかのぼって、遊んだ日が続いている数。 */
  function streak(playedDays, today) {
    var set = new Set(playedDays), d = set.has(today) ? today : addDays(today, -1), n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  return {
    POINTS: POINTS, RANKS: RANKS, points: points, totalPoints: totalPoints,
    rankThresholds: rankThresholds, rankOf: rankOf,
    makeIndex: makeIndex, answers: answers, judge: judge, gauge: gauge, shareText: shareText, hintGrid: hintGrid,
    hashSeed: hashSeed, rng: rng, shuffle: shuffle, evalBoard: evalBoard, makePuzzle: makePuzzle,
    makeTwoIndex: makeTwoIndex, wadouCandidates: wadouCandidates, wadouUnique: wadouUnique, makeWadou: makeWadou,
    jstDate: jstDate, addDays: addDays, daysBetween: daysBetween, msToNextJstMidnight: msToNextJstMidnight, streak: streak
  };
});
