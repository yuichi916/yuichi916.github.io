/* まぜる漢字「役札」— 漢字の手札で熟語をつくる、デッキ構築ローグライトの中身（画面に依存しない）。
 * ブラウザでは window.YakuCore、Node では require / import で使う。
 * 状態（run）は JSON にそのまま保存できる形だけで持つ。乱数も run.rs に入れて持ち運ぶ。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YakuCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ------------------------------------------------------------ 決まり
  var ROUNDS = 8;
  var TARGETS = [80, 140, 200, 290, 420, 600, 850, 1150];
  var HANDS = 4, DISCARDS = 3, HAND_SIZE = 8, DECK_SIZE = 36, MAX_JOKERS = 5, START_MONEY = 4;
  var BASE = { 2: { c: 10, m: 2 }, 3: { c: 30, m: 4 }, 4: { c: 60, m: 8 } };
  var RARE_BASE = { c: 5, m: 1 };            // 辞書にはあるが、ふだんは使わない言葉
  var SEAL_MULT = 4;                          // 朱印の字を使うと 倍+4
  var PRICE = { pack: 3, cut: 2, seal: 3, reroll: 2 };
  var HINTS = 3;

  var NUM = '一二三四五六七八九十百千万億兆';
  var SEASON = '春夏秋冬';
  var COLOR = '赤青白黒緑黄紫茶金銀';
  var BODY = '手足目口耳頭顔首指腕胸腹背肩歯舌鼻骨血';
  var NATURE = '山川海空森林雨雪風雲星月花草木石岩波';

  // 部首の札: [id, 名前, 康煕部首の番号, 見本の字]
  var RADICALS = [
    ['r85', 'さんずい', 85, '水海池港'], ['r75', 'きへん', 75, '木林村板'], ['r9', 'にんべん', 9, '人体休作'],
    ['r149', 'ごんべん', 149, '言語話読'], ['r120', 'いとへん', 120, '糸紙線組'], ['r72', 'ひへん', 72, '日明時晴'],
    ['r140', 'くさかんむり', 140, '花茶草薬'], ['r64', 'てへん', 64, '手持指投'], ['r61', 'こころ', 61, '心思意感'],
    ['r30', 'くち', 30, '口味名器'], ['r32', 'つち', 32, '土地場城'], ['r167', 'かね', 167, '金銀鉄鏡']
  ];

  function has(word, set) { for (var i = 0; i < word.length; i++) if (set.indexOf(word[i]) >= 0) return true; return false; }

  /* 役札。fx(ev, j, run) は効果の配列を返す: {c: 点を足す} {m: 倍を足す} {x: 倍をかける}、t があればその字が光る。
   * ev = { w: 語, chars, len, read, rare, tiles(出した札), prev(この局の前の語), first, last, held(手札に残る枚数), dleft, round }
   */
  var JOKERS = [
    { id: 'len2', name: '二字の札', price: 4, desc: '2字の熟語なら 倍+4', fx: function (ev) { return ev.len === 2 ? [{ m: 4 }] : []; } },
    { id: 'len3', name: '三字の札', price: 5, desc: '3字の熟語なら 倍+12', fx: function (ev) { return ev.len === 3 ? [{ m: 12 }] : []; } },
    { id: 'len4', name: '四字の札', price: 6, desc: '4字の熟語なら 倍×3', fx: function (ev) { return ev.len === 4 ? [{ x: 3 }] : []; } },
    { id: 'num', name: '数の札', price: 4, desc: '数（一〜十・百・千・万…）を含めば 倍+8', fx: function (ev) { return has(ev.w, NUM) ? [{ m: 8 }] : []; } },
    { id: 'season', name: '季節の札', price: 4, desc: '春・夏・秋・冬を含めば 点+80', fx: function (ev) { return has(ev.w, SEASON) ? [{ c: 80 }] : []; } },
    { id: 'color', name: '色の札', price: 4, desc: '赤・青・白・黒・緑・黄・紫・茶・金・銀を含めば 点+60', fx: function (ev) { return has(ev.w, COLOR) ? [{ c: 60 }] : []; } },
    { id: 'body', name: '体の札', price: 4, desc: '手・足・目・口・頭・顔など体の字を含めば 倍+6', fx: function (ev) { return has(ev.w, BODY) ? [{ m: 6 }] : []; } },
    { id: 'nature', name: '自然の札', price: 4, desc: '山・川・海・空・森・雨・風・花など自然の字を含めば 倍+5', fx: function (ev) { return has(ev.w, NATURE) ? [{ m: 5 }] : []; } },
    { id: 'heavy', name: '画数好み', price: 5, desc: '12画以上の字1つにつき 点+25', fx: function (ev) { return perTile(ev, function (t) { return t.s >= 12; }, { c: 25 }); } },
    { id: 'easy', name: 'やさしい字', price: 4, desc: '小学1年で習う字1つにつき 倍+3', fx: function (ev) { return perTile(ev, function (t) { return t.g === 1; }, { m: 3 }); } },
    { id: 'hard', name: '難字の札', price: 7, rare: true, desc: '中学で習う字1つにつき 倍×1.5', fx: function (ev) { return perTile(ev, function (t) { return t.g >= 7; }, { x: 1.5 }); } },
    { id: 'shiri', name: 'しりとり', price: 6, desc: 'この局の前の熟語の最後の字から始まれば 倍×2', fx: function (ev) { return ev.prev && ev.prev[ev.prev.length - 1] === ev.w[0] ? [{ x: 2 }] : []; } },
    { id: 'flip', name: 'ひっくり返し', price: 6, rare: true, desc: '逆から読んでも熟語（会社⇄社会など）なら 倍×3', fx: function (ev) { return ev.flip ? [{ x: 3 }] : []; } },
    { id: 'short', name: '短い読み', price: 4, desc: '読みが3文字以下（「かざん」など）なら 倍+6', fx: function (ev) { return ev.read && ev.read.length <= 3 ? [{ m: 6 }] : []; } },
    { id: 'brush', name: '育つ筆', price: 5, grow: true, desc: '熟語を出すたびに 点+4 ずつ育つ（いま 点+{n}）', fx: function (ev, j) { return j.n ? [{ c: j.n }] : []; }, after: function (ev, j) { j.n = (j.n || 0) + 4; } },
    { id: 'toss', name: '捨て上手', price: 5, grow: true, desc: '捨てるたびに 倍+1 ずつ育つ（いま 倍+{n}）', fx: function (ev, j) { return j.n ? [{ m: j.n }] : []; }, onDiscard: function (j) { j.n = (j.n || 0) + 1; } },
    { id: 'save', name: '節約', price: 4, desc: '残っている「捨て」1回につき 倍+3', fx: function (ev) { return ev.dleft ? [{ m: 3 * ev.dleft }] : []; } },
    { id: 'lasthand', name: '最後の一手', price: 5, desc: 'その局の最後の手なら 倍×2', fx: function (ev) { return ev.last ? [{ x: 2 }] : []; } },
    { id: 'firsthand', name: '先手必勝', price: 4, desc: 'その局の最初の手なら 倍+10', fx: function (ev) { return ev.first ? [{ m: 10 }] : []; } },
    { id: 'climb', name: '昇り調子', price: 5, desc: '何局目かの数だけ 倍+（局1なら+1、局8なら+8）', fx: function (ev) { return [{ m: ev.round }]; } },
    { id: 'held', name: '持ち札', price: 4, desc: '手札に残った字1つにつき 点+6', fx: function (ev) { return ev.held ? [{ c: 6 * ev.held }] : []; } },
    { id: 'safe', name: '金庫', price: 5, desc: '局に勝つたびに 両+3（点には効かない）', fx: function () { return []; }, payout: 3 },
    { id: 'rarew', name: '物知り', price: 5, desc: 'ふだん使わない言葉でも、ふつうの熟語と同じ点になる', fx: function () { return []; } },
    { id: 'seal', name: '朱肉', price: 5, desc: '朱印の字の効果が 倍+4 から 倍+10 になる', fx: function () { return []; } }
  ];
  RADICALS.forEach(function (r) {
    JOKERS.push({
      id: r[0], name: r[1] + 'の札', price: 4, rad: r[2],
      desc: r[1] + '（' + r[3] + ' など）の字1つにつき 倍+3',
      fx: function (ev) { return perTile(ev, function (t) { return t.r === r[2]; }, { m: 3 }); }
    });
  });
  var JMAP = {}; JOKERS.forEach(function (j) { JMAP[j.id] = j; });

  function perTile(ev, pred, eff) {
    var out = [];
    ev.tiles.forEach(function (t, i) { if (pred(t)) { var e = { t: i }; for (var k in eff) e[k] = eff[k]; out.push(e); } });
    return out;
  }

  // ボス局の縛り（局3・局6 はこの中から、局8 は大将）
  var BOSSES = [
    { id: 'futaji', name: '二字封じ', desc: '2字の熟語の倍が 1 になる' },
    { id: 'kiri', name: '重い霧', desc: '10画以上の字は点にならない' },
    { id: 'nosute', name: '捨て一度', desc: 'この局は1回しか捨てられない' },
    { id: 'nana', name: '狭い手', desc: '手札が7枚になる' },
    { id: 'mitte', name: '三手勝負', desc: '出せるのは3回まで' }
  ];
  var FINAL = { id: 'taisho', name: '大将', desc: '手札が7枚になる' };
  var BMAP = {}; BOSSES.concat([FINAL]).forEach(function (b) { BMAP[b.id] = b; });

  // ------------------------------------------------------------ 乱数（状態を run に持つ）
  function hashSeed(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd(run) {
    var t = (run.rs = (run.rs + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rint(run, n) { return Math.floor(rnd(run) * n); }
  function shuffle(run, a) { for (var i = a.length - 1; i > 0; i--) { var j = rint(run, i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ------------------------------------------------------------ 辞書
  /** data = { has(w)→'c'|'r'|null, read(w)→読み, grade{字:学年}, s{字:画数}, r{字:部首}, pool[[字,n]], base"字…" } */
  function makeCtx(data) {
    var poolChars = data.pool.map(function (p) { return p[0]; });
    return { has: data.has, read: data.read, grade: data.grade, s: data.s, r: data.r, pool: poolChars, base: data.base.split('') };
  }
  function tileInfo(ctx, ch) { return { ch: ch, s: ctx.s[ch] || 0, r: ctx.r[ch] || 0, g: ctx.grade[ch] || 0 }; }

  function perms(a) {
    if (a.length <= 1) return [a.slice()];
    var out = [];
    a.forEach(function (x, i) { var rest = a.slice(0, i).concat(a.slice(i + 1)); perms(rest).forEach(function (p) { out.push([x].concat(p)); }); });
    return out;
  }
  /** 選んだ札（選んだ順の位置の配列）から語を探す。選んだ順がそのまま語ならそれ、だめなら並べ替えて探す。 */
  function findWord(ctx, run, sel) {
    if (sel.length < 2 || sel.length > 4) return null;
    var best = null;
    var orders = perms(sel);
    for (var i = 0; i < orders.length; i++) {
      var w = orders[i].map(function (k) { return run.hand[k].ch; }).join('');
      var kind = ctx.has(w);
      if (!kind) continue;
      if (kind === 'c') return { w: w, order: orders[i], kind: 'c' };
      if (!best) best = { w: w, order: orders[i], kind: 'r' };
    }
    return best;
  }

  // ------------------------------------------------------------ 一局の進行
  function newRun(ctx, seed, o) {
    o = o || {};
    var run = { v: 1, seed: String(seed), rs: hashSeed('yaku:' + seed), daily: !!o.daily, round: 1, money: START_MONEY,
      jokers: [], deck: [], nextId: 1, hints: HINTS, score: 0, total: 0, best: null, words: [], over: false, won: false,
      phase: 'round', bosses: {}, endless: 0 };
    var base = shuffle(run, ctx.base.slice()).slice(0, DECK_SIZE);
    base.forEach(function (ch) { run.deck.push({ id: run.nextId++, ch: ch }); });
    // ボス局を先に決めておく（毎日の一局は全員同じ）
    // 局3 は軽い縛り、局6 は重い縛り
    var mild = ['kiri', 'nana', 'nosute'], hard = ['futaji', 'mitte'];
    run.bosses = { 3: mild[rint(run, mild.length)], 6: hard[rint(run, hard.length)], 8: 'taisho' };
    startRound(ctx, run);
    return run;
  }
  function bossOf(run) { return run.endless ? null : (run.bosses[run.round] ? BMAP[run.bosses[run.round]] : null); }
  function target(run) {
    if (run.round <= ROUNDS) return TARGETS[run.round - 1];
    return Math.round(TARGETS[ROUNDS - 1] * Math.pow(1.6, run.round - ROUNDS) / 10) * 10;
  }
  function startRound(ctx, run) {
    var b = bossOf(run);
    run.phase = 'round';
    run.score = 0; run.prev = null; run.played = 0;
    run.handsLeft = b && b.id === 'mitte' ? 3 : HANDS;
    run.discLeft = b && b.id === 'nosute' ? 1 : DISCARDS;
    run.handSize = b && (b.id === 'nana' || b.id === 'taisho') ? 7 : HAND_SIZE;
    run.pile = shuffle(run, run.deck.map(function (t) { return t.id; }));
    run.hand = [];
    draw(ctx, run);
  }
  function tileById(run, id) { for (var i = 0; i < run.deck.length; i++) if (run.deck[i].id === id) return run.deck[i]; return null; }
  function draw(ctx, run) {
    while (run.hand.length < run.handSize && run.pile.length) {
      var t = tileById(run, run.pile.pop());
      run.hand.push({ id: t.id, ch: t.ch, seal: !!t.seal });
    }
  }

  /** 選んだ札で出したときの点の内訳（状態は変えない）。steps は演出の順。 */
  function evaluate(ctx, run, sel) {
    var f = findWord(ctx, run, sel);
    if (!f) return { ok: false };
    var b = bossOf(run);
    var tiles = f.order.map(function (k) { var h = run.hand[k]; var ti = tileInfo(ctx, h.ch); ti.seal = h.seal; ti.k = k; return ti; });
    var rareAsCommon = run.jokers.some(function (j) { return j.id === 'rarew'; });
    var kind = f.kind === 'r' && rareAsCommon ? 'c' : f.kind;
    var base = kind === 'c' ? BASE[f.w.length] : RARE_BASE;
    var chips = base.c, mult = base.m, steps = [];
    if (b && b.id === 'futaji' && f.w.length === 2) { mult = 1; }
    steps.push({ src: 'base', c: base.c, m: mult, text: (kind === 'c' ? f.w.length + '字の熟語' : 'ふだん使わない言葉') });
    tiles.forEach(function (t, i) {
      var c = (b && b.id === 'kiri' && t.s >= 10) ? 0 : t.s;
      chips += c; steps.push({ src: 'tile', t: i, c: c, text: t.ch + ' ' + t.s + '画' + (c ? '' : '（霧）') });
      if (t.seal) { var sm = run.jokers.some(function (j) { return j.id === 'seal'; }) ? 10 : SEAL_MULT; mult += sm; steps.push({ src: 'seal', t: i, m: sm, text: '朱印' }); }
    });
    var rev = f.w.split('').reverse().join('');
    var ev = { w: f.w, len: f.w.length, read: ctx.read(f.w) || '', rare: f.kind === 'r', tiles: tiles, prev: run.prev,
      first: run.played === 0, last: run.handsLeft === 1, held: run.hand.length - sel.length, dleft: run.discLeft, round: run.round,
      flip: rev !== f.w && ctx.has(rev) === 'c' };
    run.jokers.forEach(function (j, slot) {
      var def = JMAP[j.id]; if (!def) return;
      def.fx(ev, j, run).forEach(function (e) {
        if (e.c) chips += e.c;
        if (e.m) mult += e.m;
        if (e.x) mult = mult * e.x;
        steps.push({ src: 'joker', j: slot, t: e.t, c: e.c, m: e.m, x: e.x, text: def.name });
      });
    });
    // 同じ熟語は、この挑戦で2回目から倍が半分
    var repeat = run.words.some(function (x) { return x[0] === f.w; });
    if (repeat) { mult = mult * 0.5; steps.push({ src: 'repeat', x: 0.5, text: '2回目の熟語' }); }
    mult = Math.round(mult * 100) / 100;
    var total = Math.floor(chips * mult);
    return { ok: true, w: f.w, read: ev.read, kind: f.kind, order: f.order, chips: chips, mult: mult, total: total, steps: steps, flip: ev.flip, repeat: repeat, ev: ev };
  }

  function play(ctx, run, sel) {
    if (run.phase !== 'round' || run.handsLeft <= 0) return { ok: false, why: 'phase' };
    var r = evaluate(ctx, run, sel);
    if (!r.ok) return r;
    run.jokers.forEach(function (j) { var d = JMAP[j.id]; if (d && d.after) d.after(r.ev, j); });
    run.score += r.total; run.total += r.total; run.handsLeft--; run.played++; run.prev = r.w;
    run.words.push([r.w, r.total, run.round]);
    if (!run.best || r.total > run.best[1]) run.best = [r.w, r.total, r.read];
    removeFromHand(run, sel);
    draw(ctx, run);
    r.cleared = run.score >= target(run);
    if (r.cleared) finishRound(ctx, run);
    else if (run.handsLeft <= 0) { run.over = true; run.phase = 'over'; }
    else if (!run.hand.length) { run.over = true; run.phase = 'over'; }
    r.run = run;
    return r;
  }
  function removeFromHand(run, sel) {
    var drop = {}; sel.forEach(function (k) { drop[k] = 1; });
    run.hand = run.hand.filter(function (_, k) { return !drop[k]; });
  }
  function discard(ctx, run, sel) {
    if (run.phase !== 'round' || run.discLeft <= 0 || !sel.length || sel.length > 5) return false;
    removeFromHand(run, sel);
    run.discLeft--;
    run.jokers.forEach(function (j) { var d = JMAP[j.id]; if (d && d.onDiscard) d.onDiscard(j); });
    draw(ctx, run);
    if (!run.hand.length) { run.over = true; run.phase = 'over'; }
    return true;
  }
  function interest(money) { return Math.min(5, Math.floor(money / 5)); }
  function finishRound(ctx, run) {
    var pay = { win: 4, hands: run.handsLeft, interest: interest(run.money), jokers: 0 };
    run.jokers.forEach(function (j) { var d = JMAP[j.id]; if (d && d.payout) pay.jokers += d.payout; });
    pay.total = pay.win + pay.hands + pay.interest + pay.jokers;
    run.money += pay.total;
    run.lastPay = pay;
    if (run.round === ROUNDS && !run.endless) { run.won = true; run.phase = 'won'; }
    else { run.phase = 'shop'; makeShop(ctx, run); }
  }

  // ------------------------------------------------------------ 店
  function makeShop(ctx, run) {
    run.shop = { jokers: rollJokers(run, 2), pack: null, rerolls: 0, bought: {} };
  }
  function rollJokers(run, n) {
    var owned = {}; run.jokers.forEach(function (j) { owned[j.id] = 1; });
    var cands = JOKERS.filter(function (j) { return !owned[j.id]; });
    var out = [];
    while (out.length < n && cands.length) {
      // めずらしい札は出にくい
      var k = rint(run, cands.length), c = cands[k];
      if (c.rare && rnd(run) < 0.5) continue;
      out.push(c.id); cands.splice(k, 1);
    }
    return out;
  }
  function rerollCost(run) { return PRICE.reroll + run.shop.rerolls; }
  function reroll(run) {
    var cost = rerollCost(run); if (run.money < cost) return false;
    run.money -= cost; run.shop.rerolls++; run.shop.jokers = rollJokers(run, 2); return true;
  }
  function buyJoker(run, k) {
    var id = run.shop.jokers[k]; if (!id) return false;
    var def = JMAP[id]; if (run.money < def.price || run.jokers.length >= MAX_JOKERS) return false;
    run.money -= def.price; run.jokers.push({ id: id, n: 0 }); run.shop.jokers[k] = null; return true;
  }
  function sellPrice(j) { return Math.max(1, Math.floor(JMAP[j.id].price / 2)); }
  function sellJoker(run, slot) {
    var j = run.jokers[slot]; if (!j) return false;
    run.money += sellPrice(j); run.jokers.splice(slot, 1); return true;
  }
  function moveJoker(run, slot, dir) {
    var to = slot + dir; if (to < 0 || to >= run.jokers.length) return false;
    var t = run.jokers[slot]; run.jokers[slot] = run.jokers[to]; run.jokers[to] = t; return true;
  }
  /** 字札: 3字から1つ選んで山札に足す。池の上位から、山札に少ない字を出す */
  function openPack(ctx, run) {
    if (run.shop.pack || run.shop.bought.pack || run.money < PRICE.pack) return false;
    run.money -= PRICE.pack;
    var cnt = {}; run.deck.forEach(function (t) { cnt[t.ch] = (cnt[t.ch] || 0) + 1; });
    var top = ctx.pool.slice(0, 220).filter(function (c) { return (cnt[c] || 0) < 2; });
    var out = [];
    while (out.length < 3 && top.length) { var k = rint(run, top.length); out.push(top[k]); top.splice(k, 1); }
    run.shop.pack = out; run.shop.bought.pack = true; return out;
  }
  function takeFromPack(run, k) {
    if (!run.shop.pack || !run.shop.pack[k]) return false;
    run.deck.push({ id: run.nextId++, ch: run.shop.pack[k] }); run.shop.pack = null; return true;
  }
  function cutTile(run, id) {
    if (run.shop.bought.cut || run.money < PRICE.cut || run.deck.length <= 20) return false;
    var i = run.deck.findIndex(function (t) { return t.id === id; }); if (i < 0) return false;
    run.money -= PRICE.cut; run.deck.splice(i, 1); run.shop.bought.cut = true; return true;
  }
  function sealTile(run, id) {
    if (run.shop.bought.seal || run.money < PRICE.seal) return false;
    var t = tileById(run, id); if (!t || t.seal) return false;
    run.money -= PRICE.seal; t.seal = true; run.shop.bought.seal = true; return true;
  }
  function nextRound(ctx, run) {
    if (run.phase !== 'shop') return false;
    run.round++; run.shop = null; startRound(ctx, run); return true;
  }
  function continueEndless(ctx, run) {
    if (run.phase !== 'won') return false;
    run.endless = 1; run.phase = 'shop'; makeShop(ctx, run); return true;
  }

  // ------------------------------------------------------------ 補助
  /** 手札で作れる熟語（ふつうの熟語だけ）。ヒントと「作れる数」に使う */
  function formable(ctx, run, limit) {
    var hand = run.hand, n = hand.length, out = [], seen = {};
    function rec(sel, used) {
      if (sel.length >= 2) {
        var w = sel.map(function (k) { return hand[k].ch; }).join('');
        if (!seen[w] && ctx.has(w) === 'c') { seen[w] = 1; out.push({ w: w, sel: sel.slice() }); if (limit && out.length >= limit) return true; }
      }
      if (sel.length === 4) return false;
      for (var k = 0; k < n; k++) {
        if (used[k]) continue;
        used[k] = 1; sel.push(k);
        var stop = rec(sel, used);
        sel.pop(); used[k] = 0;
        if (stop) return true;
      }
      return false;
    }
    rec([], {});
    return out;
  }
  function useHint(ctx, run) {
    if (run.hints <= 0) return null;
    var f = formable(ctx, run);
    if (!f.length) return { none: true };
    run.hints--;
    // いちばん点の高いものを教える
    var best = null;
    f.forEach(function (x) { var e = evaluate(ctx, run, x.sel); if (e.ok && (!best || e.total > best.total)) best = { w: x.w, sel: x.sel, total: e.total }; });
    return best;
  }
  function jokerDesc(j) { var d = JMAP[j.id]; return d.desc.replace('{n}', j.n || 0); }

  function shareText(run, label, url) {
    var cleared = run.won ? ROUNDS : run.round - 1;
    var bar = '';
    for (var i = 1; i <= ROUNDS; i++) bar += i <= cleared ? '🟥' : '⬜';
    var head = run.won ? '8局すべて勝った' + (run.endless ? '（延長' + (run.round - ROUNDS) + '局まで）' : '') : '局' + run.round + 'で散った';
    var lines = ['まぜる漢字「役札」' + (label ? ' ' + label : ''), head + ' ' + bar];
    if (run.best) lines.push('最高の一手「' + run.best[0] + '」' + run.best[1].toLocaleString('ja-JP') + '点');
    if (url) lines.push(url);
    return lines.join('\n');
  }

  return {
    ROUNDS: ROUNDS, TARGETS: TARGETS, HANDS: HANDS, DISCARDS: DISCARDS, HAND_SIZE: HAND_SIZE, MAX_JOKERS: MAX_JOKERS,
    BASE: BASE, PRICE: PRICE, JOKERS: JOKERS, JMAP: JMAP, BOSSES: BOSSES, BMAP: BMAP, RADICALS: RADICALS,
    makeCtx: makeCtx, newRun: newRun, startRound: startRound, target: target, bossOf: bossOf, findWord: findWord,
    evaluate: evaluate, play: play, discard: discard, formable: formable, useHint: useHint, interest: interest,
    makeShop: makeShop, reroll: reroll, rerollCost: rerollCost, buyJoker: buyJoker, sellJoker: sellJoker, sellPrice: sellPrice,
    moveJoker: moveJoker, openPack: openPack, takeFromPack: takeFromPack, cutTile: cutTile, sealTile: sealTile,
    nextRound: nextRound, continueEndless: continueEndless, jokerDesc: jokerDesc, shareText: shareText, tileInfo: tileInfo,
    hashSeed: hashSeed
  };
});
