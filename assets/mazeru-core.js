/* まぜる日本: 画面に依存しない計算（ブラウザと node の両方で読む） */
(function (root) {
  'use strict';
  var B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  var SITE_URL = 'https://yuichi916.github.io/mazeru.html';

  function d36(s, i) {
    return B36.indexOf(s[i]) * 1296 + B36.indexOf(s[i + 1]) * 36 + B36.indexOf(s[i + 2]);
  }
  function key(a, b) { return a <= b ? a * 8192 + b : b * 8192 + a; }
  function shardOf(a, b, n) { return Math.min(a, b) % n; }

  /** 1組 = 番号3つ × base36 3桁 の連結テキストを Map(key -> 結果の番号) に */
  function decodeShard(text, map) {
    map = map || new Map();
    var t = String(text).trim();
    if (t.length % 9 !== 0) throw new Error('bad shard length ' + t.length);
    for (var i = 0; i < t.length; i += 9) map.set(key(d36(t, i), d36(t, i + 3)), d36(t, i + 6));
    return map;
  }

  /** 珍しさの順位。深いほど、同じ深さなら表の中の作り方が少ないほど珍しい。
   *  elems[i] = [name, emoji, cat, depth, makes, ...]。返す関数 f(i) は「i と同じか、より珍しい要素の割合」（0〜1） */
  function rarityRanker(elems) {
    var n = elems.length, keyOf = function (e) { return e[3] * 100000 - Math.min(e[4], 99999); };
    var keys = elems.map(keyOf).slice().sort(function (a, b) { return b - a; });
    var atLeast = {};
    for (var k = 0; k < n; k++) atLeast[keys[k]] = (k + 1) / n; // 同じキーの最後の位置で上書き = 同順位は同じ割合
    return function (i) { return elems[i][3] === 0 ? 1 : atLeast[keyOf(elems[i])]; };
  }
  function stars(share) {
    if (share <= 0.03) return 5;
    if (share <= 0.10) return 4;
    if (share <= 0.25) return 3;
    if (share <= 0.50) return 2;
    return 1;
  }
  function pctLabel(share) {
    var p = share * 100;
    if (p < 1) return '上位1%未満';
    return '上位' + (p < 10 ? p.toFixed(1).replace(/\.0$/, '') : Math.round(p)) + '%';
  }

  function shareUrl() { return SITE_URL + '?ref=x'; }
  /** 共有の文面。o = { found, total, deepest: {name, emoji, depth}, rare: n } */
  function shareText(o) {
    var lines = ['「まぜる日本」で ' + o.found + ' 個 見つけた（全 ' + o.total.toLocaleString('ja-JP') + ' 個）'];
    if (o.deepest) lines.push('いちばん深い発見：' + o.deepest.emoji + ' ' + o.deepest.name + '（深さ ' + o.deepest.depth + '）');
    if (o.rare) lines.push('★4以上の珍しい発見：' + o.rare + ' 個');
    lines.push('#まぜる日本');
    lines.push(shareUrl());
    return lines.join('\n');
  }

  var api = { key: key, shardOf: shardOf, decodeShard: decodeShard, rarityRanker: rarityRanker, stars: stars,
              pctLabel: pctLabel, shareText: shareText, shareUrl: shareUrl, SITE_URL: SITE_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Mazeru = api;
})(typeof window !== 'undefined' ? window : globalThis);
