/* きょうの県 — 画面に依存しない計算（日付→県、ヒントの選び方、距離と方角、共有文）
 * ブラウザでは window.KyouNoKen、Node では module.exports で使う。
 * scripts/kyou_no_ken/test_core.mjs がこのファイルをそのまま読み込んで検査する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KyouNoKen = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAY = 86400000;
  const JST = 9 * 3600000;
  // 第1回の日（日本時間）。この日を #1 とする
  const EPOCH_Y = 2026, EPOCH_M = 10, EPOCH_D = 24;
  const EPOCH_DAYNUM = Math.floor(Date.UTC(EPOCH_Y, EPOCH_M - 1, EPOCH_D) / DAY);
  const N_PREF = 47;
  // 周期の変わり目で同じ県が続かないよう、新しい周期の先頭 GAP 個には前の周期の末尾 GAP 個を入れない。
  // これで同じ県がもう一度出るまで、最悪でも GAP + 1 = 17 日あく（test_core.mjs で確かめる）
  const GAP = 16;
  const SEED = 'kyou-no-ken/v1';

  // ---------------------------------------------------------------- 日付
  /** 日本時間の暦日で数えた通し番号（#1 の日が 0）。ms は UNIX 時刻（ミリ秒） */
  function dayIndexAt(ms) {
    return Math.floor((ms + JST) / DAY) - EPOCH_DAYNUM;
  }
  /** 通し番号 → 'YYYY-MM-DD'（日本時間の日付） */
  function dateOfIndex(i) {
    const d = new Date((EPOCH_DAYNUM + i) * DAY);
    const p = (n) => String(n).padStart(2, '0');
    return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
  }
  /** 次の日本時間 0 時までのミリ秒 */
  function msToNextJstMidnight(ms) {
    const next = (Math.floor((ms + JST) / DAY) + 1) * DAY - JST;
    return next - ms;
  }

  // ---------------------------------------------------------------- 乱数（決定的）
  function hash32(str) { // FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ---------------------------------------------------------------- 日付 → 県
  // 47 日を 1 周期とし、周期ごとに seed 固定でシャッフルした並びを使う。どの周期でも 47 県が 1 回ずつ出る。
  const cycles = [];
  function cycleOrder(c) {
    while (cycles.length <= c) {
      const k = cycles.length;
      const rng = mulberry32(hash32(SEED + '/cycle/' + k));
      const all = Array.from({ length: N_PREF }, (_, i) => i);
      if (k === 0) { cycles.push(shuffle(all, rng)); continue; }
      const prevTail = new Set(cycles[k - 1].slice(N_PREF - GAP));
      const head = shuffle(all.filter((p) => !prevTail.has(p)), rng).slice(0, GAP);
      const headSet = new Set(head);
      const rest = shuffle(all.filter((p) => !headSet.has(p)), rng);
      cycles.push(head.concat(rest));
    }
    return cycles[c];
  }
  /** 通し番号 → 県の添字（0=北海道 … 46=沖縄県）。#1 より前の日は #1 と同じに丸める */
  function prefForDay(i) {
    const d = Math.max(0, i | 0);
    return cycleOrder(Math.floor(d / N_PREF))[d % N_PREF];
  }

  // ---------------------------------------------------------------- ヒントの選び方
  // tier1（当てにくい）から 2 つ、tier2 から 2 つ、tier3 から 1 つ、最後に「地方」。
  // 同じ tier の中では、その県の順位が真ん中に近い（＝決め手になりにくい）ものを先に出す。
  function hintsForDay(i, data) {
    const pref = prefForDay(i);
    const rng = mulberry32(hash32(SEED + '/hints/' + Math.max(0, i | 0)));
    const inds = data.indicators.map((ind, k) => ({ k, ind }));
    const extremeness = (x) => Math.abs(x.ind.ranks[pref] - (N_PREF + 1) / 2);
    const pick = (tier, pool, take) => {
      const cand = shuffle(inds.filter((x) => x.ind.tier === tier), rng).slice(0, pool);
      return cand.sort((a, b) => extremeness(a) - extremeness(b) || a.k - b.k).slice(0, take);
    };
    const chosen = pick(1, 4, 2).concat(pick(2, 3, 2), pick(3, 3, 1));
    const hints = chosen.map((x) => ({ type: 'stat', index: x.k, id: x.ind.id }));
    hints.push({ type: 'region' });
    return { pref, hints };
  }

  // ---------------------------------------------------------------- 距離と方角（GRS80 楕円体、Vincenty の逆解法）
  function geodesic(lat1, lon1, lat2, lon2) {
    const a = 6378137, f = 1 / 298.257222101, b = a * (1 - f);
    const rad = Math.PI / 180;
    const L = (lon2 - lon1) * rad;
    const U1 = Math.atan((1 - f) * Math.tan(lat1 * rad));
    const U2 = Math.atan((1 - f) * Math.tan(lat2 * rad));
    const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
    let lambda = L, prev, iter = 0;
    let sinSigma, cosSigma, sigma, cosSqAlpha, cos2SigmaM, sinLambda, cosLambda;
    do {
      sinLambda = Math.sin(lambda); cosLambda = Math.cos(lambda);
      sinSigma = Math.sqrt((cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2);
      if (sinSigma === 0) return { km: 0, azimuth: 0 };
      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
      sigma = Math.atan2(sinSigma, cosSigma);
      const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha : 0;
      const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      prev = lambda;
      lambda = L + (1 - C) * f * sinAlpha *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    } while (Math.abs(lambda - prev) > 1e-12 && ++iter < 200);
    const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
    const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
    const dSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
      B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    const s = b * A * (sigma - dSigma);
    let az = Math.atan2(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) / rad;
    if (az < 0) az += 360;
    return { km: s / 1000, azimuth: az };
  }
  /** 外した県の庁舎 → 正解の県の庁舎 への距離と方角 */
  function clue(data, guess, answer) {
    const g = data.prefs[guess], t = data.prefs[answer];
    return geodesic(g.lat, g.lon, t.lat, t.lon);
  }
  const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
  const DIR_JA = ['北', '北東', '東', '南東', '南', '南西', '西', '北西'];
  function dir8(az) { return Math.round(((az % 360) + 360) % 360 / 45) % 8; }
  function square(km) {
    if (km === 0) return '🟩';
    if (km <= 150) return '🟨';
    if (km <= 400) return '🟧';
    return '🟥';
  }

  // ---------------------------------------------------------------- 表示の整形
  function formatValue(v, decimals) {
    return Number(v).toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // ---------------------------------------------------------------- 共有文
  // tries: [{guess: 県の添字 | -1(パス)}]、answer: 正解の県
  function shareText(opts) {
    const { data, day, tries, answer, won, url } = opts;
    const cells = tries.map((t) => (t.guess < 0 ? '⬜' : t.guess === answer ? '🟩' : square(clue(data, t.guess, answer).km)));
    const score = won ? tries.length + '/6' : 'X/6';
    const lines = ['きょうの県 #' + (day + 1) + ' ' + score, cells.join('')];
    lines.push(won ? 'ヒント' + tries.length + 'つ目で正解' : '6つのヒントで当てられず');
    lines.push(url);
    return lines.join('\n');
  }

  return {
    DAY, JST, EPOCH_DAYNUM, N_PREF, GAP, ARROWS, DIR_JA,
    dayIndexAt, dateOfIndex, msToNextJstMidnight,
    hash32, mulberry32, shuffle, cycleOrder, prefForDay, hintsForDay,
    geodesic, clue, dir8, square, formatValue, shareText,
  };
});
