/* まぜる漢字「役札」の画面。中身は yaku-core.js（window.YakuCore）。
 * YakuUI.mount(root, api) で描く。api は mazeru.html の本体から渡す（辞書・保存・音・共有など）。
 */
(function () {
  'use strict';
  var Y = window.YakuCore;
  var RAD_NAME = {}; Y.RADICALS.forEach(function (r) { RAD_NAME[r[2]] = r[1]; });

  function mount(root, api) {
    var esc = api.esc, ctx = api.ctx;
    var S = api.load();               // { run, daily: {日付: 記録}, best: {round, total}, plays }
    var run = S.run && !S.run.over && S.run.phase !== 'won' ? S.run : null;
    var sel = [];                     // 選んだ札（手札の位置、選んだ順）
    var busy = false;                 // 演出中は操作しない
    var picker = null;                // 店で山札から選ぶとき: 'cut' | 'seal'
    var sortBy = null;
    var official = false;             // この挑戦が「きょうの一局」の記録になるか
    if (run) official = !!run.official;

    function save() { S.run = run; api.save(S); }
    function wait(ms) { return new Promise(function (res) { setTimeout(res, api.reduced ? 0 : ms); }); }
    function top() { var y = root.getBoundingClientRect().top + window.scrollY - 70; if (window.scrollY > y) window.scrollTo(0, Math.max(0, y)); }
    function fmt(n) { return Number(n).toLocaleString('ja-JP'); }
    function dailyLabel() { return api.jpDate(api.today()); }

    // ------------------------------------------------------------ はじめ
    function renderTitle() {
      var rec = S.daily && S.daily[api.today()];
      var h = '<div class="y-title">';
      h += '<div class="y-title-txt"><div class="kicker">漢字の手札で、役をつくる</div><h1 class="y-h1">役札<small>やくふだ</small></h1>';
      h += '<p class="y-sub">手札の漢字で熟語をつくり、<b>点×倍</b>で目標をこえる。局の合間に「役札」を集めて、自分だけの点の伸ばし方を組み立てる。8局勝ち抜けば天下一。</p>';
      h += '<div class="y-start">';
      if (run) h += '<button class="go-main" type="button" data-act="resume"><span><b>続きから</b><small>局' + run.round + ' ・ いま ' + fmt(run.score) + '点 ・ ' + (run.official ? 'きょうの一局' : '自由に一局') + '</small></span><span class="arrow" aria-hidden="true">→</span></button>';
      if (rec) {
        h += '<div class="y-rec card"><small>きょうの一局（' + esc(dailyLabel()) + '）の記録</small><b>' + (rec.won ? '8局すべて勝った' : '局' + rec.round + 'で散った') + '</b>' +
          (rec.best ? '<span>最高の一手「' + esc(rec.best[0]) + '」' + fmt(rec.best[1]) + '点</span>' : '') + '<button class="btn small" type="button" data-act="share-rec">結果を共有する</button></div>';
        h += '<button class="go-card" type="button" data-act="daily"><b>きょうの一局をもう一度</b><span>記録は1回目のまま。同じ山札で練習できます</span></button>';
      } else {
        h += '<button class="go-main" type="button" data-act="daily"><span><b>きょうの一局</b><small>' + esc(dailyLabel()) + ' ・ 全員が同じ山札と店</small></span><span class="arrow" aria-hidden="true">→</span></button>';
      }
      h += '<button class="go-card" type="button" data-act="free"><b>自由に一局</b><span>毎回ちがう山札。何度でも</span></button>';
      h += '</div>';
      if (S.best && S.best.total) h += '<p class="home-stat">これまでの最高: <b>' + (S.best.won ? '天下一' : '局' + S.best.round) + '</b>、合計 <b>' + fmt(S.best.total) + '点</b>（' + (S.plays || 0) + '回遊びました）</p>';
      h += '<button class="y-howlink" type="button" data-act="how">遊び方を見る</button></div>';
      h += '<div class="y-demo" aria-hidden="true"><div class="y-demo-hand">' + ['火', '山', '海', '水'].map(function (c, i) { return '<span class="ytile' + (i < 2 ? ' sel' : '') + '"><span class="ch">' + c + '</span><small>' + (ctx.s[c] || '') + '</small>' + (i < 2 ? '<em>' + (i + 1) + '</em>' : '') + '</span>'; }).join('') + '</div>' +
        '<div class="y-demo-word">火山<small>かざん</small></div><div class="y-calc"><span class="c">17</span><i>×</i><span class="m">2</span><i>＝</i><b>34</b></div>' +
        '<div class="y-demo-j"><span class="yj mini"><b>二字の札</b><small>倍+4</small></span><span class="y-demo-arrow">→</span><div class="y-calc"><span class="c">17</span><i>×</i><span class="m">6</span><i>＝</i><b>102</b></div></div></div>';
      h += '</div>';
      root.innerHTML = h;
    }

    function startRun(daily) {
      var seed = daily ? api.today() : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      run = Y.newRun(ctx, seed, { daily: daily });
      official = daily && !(S.daily && S.daily[api.today()]);
      run.official = official;
      S.plays = (S.plays || 0) + 1;
      sel = []; sortBy = null;
      save(); api.gc('mazeru-kanji/yaku/start/' + (daily ? 'daily' : 'free'));
      render(); top();
    }

    // ------------------------------------------------------------ 局
    function jokerCard(j, slot, mode) {
      var d = Y.JMAP[j.id];
      var h = '<div class="yj' + (d.rare ? ' rare' : '') + '" data-slot="' + slot + '"><button type="button" class="yj-face" data-act="jinfo" data-slot="' + slot + '"><b>' + esc(d.name) + '</b><small>' + esc(Y.jokerDesc(j)) + '</small></button>';
      if (mode === 'shop') h += '<div class="yj-ops"><button type="button" class="btn small" data-act="jleft" data-slot="' + slot + '" aria-label="左へ"' + (slot === 0 ? ' disabled' : '') + '>←</button><button type="button" class="btn small" data-act="sell" data-slot="' + slot + '">売る +' + Y.sellPrice(j) + '両</button><button type="button" class="btn small" data-act="jright" data-slot="' + slot + '" aria-label="右へ"' + (slot === run.jokers.length - 1 ? ' disabled' : '') + '>→</button></div>';
      return h + '</div>';
    }
    function jokerRow(mode) {
      var h = '<div class="y-jokers' + (mode === 'shop' ? ' shop' : '') + '" aria-label="役札">';
      run.jokers.forEach(function (j, i) { h += jokerCard(j, i, mode); });
      if (mode === 'shop') { if (!run.jokers.length) h += '<div class="yj empty"><small>まだ役札がありません。下の店で買えます</small></div>'; }
      else for (var k = run.jokers.length; k < Y.MAX_JOKERS; k++) h += '<div class="yj empty"><small>あき</small></div>';
      return h + '</div>';
    }
    function tileHTML(t, k, extra) {
      var n = sel.indexOf(k);
      return '<button type="button" class="ytile' + (n >= 0 ? ' sel' : '') + (t.seal ? ' seal' : '') + (extra || '') + '" data-k="' + k + '" aria-pressed="' + (n >= 0) + '" aria-label="' + esc(t.ch) + '（' + (ctx.s[t.ch] || '') + '画）' + (t.seal ? '、朱印' : '') + '">' +
        '<span class="ch">' + esc(t.ch) + '</span><small>' + (ctx.s[t.ch] || '') + '</small>' + (n >= 0 ? '<em>' + (n + 1) + '</em>' : '') + '</button>';
    }
    function hud() {
      var b = Y.bossOf(run), tg = Y.target(run), pct = Math.min(100, Math.round(100 * run.score / tg));
      var dots = function (n, max, cls) { var s = ''; for (var i = 0; i < max; i++) s += '<i class="' + (i < n ? cls : '') + '"></i>'; return s; };
      var maxH = b && b.id === 'mitte' ? 3 : Y.HANDS, maxD = b && b.id === 'nosute' ? 1 : Y.DISCARDS;
      var h = '<div class="y-hud">';
      h += '<div class="y-round"><b>局' + run.round + '</b><small>' + (run.endless ? '延長' : '／' + Y.ROUNDS) + '</small>' + (b ? '<span class="y-bossname">ボス「' + esc(b.name) + '」</span>' : '') + '</div>';
      h += '<div class="y-target"><div class="y-bar"><i style="width:' + pct + '%"></i></div><span>いま <b id="y-score">' + fmt(run.score) + '</b> ／ 目標 <b>' + fmt(tg) + '</b></span></div>';
      h += '<div class="y-res"><span title="出せる回数">手 <span class="dots">' + dots(run.handsLeft, maxH, 'on') + '</span></span><span title="捨てられる回数">捨て <span class="dots">' + dots(run.discLeft, maxD, 'on d') + '</span></span><span class="y-money">' + run.money + '<small>両</small></span></div>';
      h += '</div>';
      if (b) h += '<div class="y-bossnote"><b>縛り</b>' + esc(b.desc) + '</div>';
      return h;
    }
    function stageHTML() {
      if (!sel.length) return '<div class="y-stage idle"><p>字を2〜4枚えらんで「出す」。並べる順は気にしなくてよい</p></div>';
      if (sel.length < 2) return '<div class="y-stage idle"><p>あと1枚以上えらぶ</p></div>';
      var e = Y.evaluate(ctx, run, sel);
      if (!e.ok) return '<div class="y-stage bad"><div class="y-word">' + esc(sel.map(function (k) { return run.hand[k].ch; }).join('')) + '</div><p>この字では熟語になりません</p></div>';
      var fires = {};
      e.steps.forEach(function (s) { if (s.src === 'joker' || s.src === 'seal') { var key = s.text; fires[key] = fires[key] || { c: 0, m: 0, x: 1 }; if (s.c) fires[key].c += s.c; if (s.m) fires[key].m += s.m; if (s.x) fires[key].x *= s.x; } });
      var fl = Object.keys(fires).map(function (k) { var f = fires[k], p = []; if (f.c) p.push('点+' + f.c); if (f.m) p.push('倍+' + f.m); if (f.x !== 1) p.push('倍×' + Math.round(f.x * 100) / 100); return '<span>' + esc(k) + ' ' + p.join(' ') + '</span>'; }).join('');
      return '<div class="y-stage ok' + (e.kind === 'r' ? ' rarew' : '') + '"><div class="y-word">' + esc(e.w) + '<small>' + esc(e.read) + '</small></div>' +
        (e.kind === 'r' ? '<p class="y-rare">ふだん使わない言葉（点は少なめ）</p>' : '') +
        (e.repeat ? '<p class="y-rare">この挑戦で2回目の熟語（倍が半分）</p>' : '') +
        '<div class="y-calc"><span class="c">' + fmt(e.chips) + '</span><i>×</i><span class="m">' + e.mult + '</span><i>＝</i><b>' + fmt(e.total) + '</b></div>' +
        (fl ? '<div class="y-fires">' + fl + '</div>' : '') + '</div>';
    }
    var canCache = { key: '', n: 0 };
    function canCount() {
      var key = run.hand.map(function (h) { return h.ch; }).join('');
      if (canCache.key !== key) canCache = { key: key, n: Y.formable(ctx, run).length };
      return canCache.n;
    }
    function renderRound() {
      var h = hud() + jokerRow('round');
      h += '<div id="y-stage-wrap">' + stageHTML() + '</div>';
      h += '<div class="y-hand" id="y-hand">' + run.hand.map(function (t, k) { return tileHTML(t, k); }).join('') + '</div>';
      var e = sel.length >= 2 ? Y.evaluate(ctx, run, sel) : { ok: false };
      h += '<div class="y-actions">';
      h += '<button class="btn shu y-play" type="button" data-act="play"' + (e.ok && run.handsLeft > 0 ? '' : ' disabled') + '>出す</button>';
      h += '<button class="btn" type="button" data-act="discard"' + (sel.length && sel.length <= 5 && run.discLeft > 0 ? '' : ' disabled') + '>捨てる' + (sel.length ? '（' + Math.min(sel.length, 5) + '枚）' : '') + '</button>';
      h += '<button class="btn small" type="button" data-act="clear"' + (sel.length ? '' : ' disabled') + '>選び直す</button>';
      h += '<button class="btn small" type="button" data-act="sort">並べ替え</button>';
      h += '<button class="btn small" type="button" data-act="hint"' + (run.hints > 0 ? '' : ' disabled') + '>ヒント（' + run.hints + '）</button>';
      h += '</div>';
      var n = canCount();
      h += '<p class="y-can">この手札で作れる熟語は <b>' + n + '語</b>' + (n === 0 ? '。「捨てる」で入れ替えよう' : '') + '　<span>山札の残り ' + run.pile.length + '枚</span></p>';
      root.innerHTML = '<div class="y-game">' + h + '</div>';
    }
    function refreshSel() {
      var wrap = document.getElementById('y-stage-wrap');
      if (!wrap) return renderRound();
      renderRound();
    }

    async function doPlay() {
      if (busy) return;
      var e = Y.evaluate(ctx, run, sel);
      if (!e.ok) return;
      busy = true;
      root.classList.add('y-busy');
      var wrap = document.getElementById('y-stage-wrap');
      var tilesEls = sel.map(function (k) { return root.querySelector('.ytile[data-k="' + k + '"]'); });
      tilesEls.forEach(function (el) { if (el) el.classList.add('out'); });
      wrap.innerHTML = '<div class="y-stage scoring"><div class="y-word">' + esc(e.w) + '<small>' + esc(e.read) + '</small></div>' +
        '<div class="y-calc"><span class="c" id="y-c">0</span><i>×</i><span class="m" id="y-m">0</span><i>＝</i><b id="y-t">?</b></div><div class="y-fx" id="y-fx"></div></div>';
      var cEl = document.getElementById('y-c'), mEl = document.getElementById('y-m'), fx = document.getElementById('y-fx');
      var c = 0, m = 0;
      api.beep('ok');
      for (var i = 0; i < e.steps.length; i++) {
        var s = e.steps[i];
        if (s.src === 'base') { c = s.c; m = s.m; }
        else { if (s.c) c += s.c; if (s.m) m += s.m; if (s.x) m = Math.round(m * s.x * 100) / 100; }
        cEl.textContent = fmt(c); mEl.textContent = Math.round(m * 100) / 100;
        var tag = [];
        if (s.src === 'base') tag.push(s.text + ' 点' + s.c + ' 倍' + s.m);
        else { if (s.c) tag.push('点+' + s.c); if (s.m) tag.push('倍+' + s.m); if (s.x) tag.push('倍×' + s.x); }
        fx.innerHTML = '<span class="pop ' + s.src + '">' + esc(s.src === 'base' ? tag[0] : s.text + ' ' + tag.join(' ')) + '</span>';
        if (s.src === 'joker') { var jc = root.querySelector('.y-jokers .yj[data-slot="' + s.j + '"]'); if (jc) { jc.classList.remove('fire'); void jc.offsetWidth; jc.classList.add('fire'); } }
        if (s.c) { cEl.classList.remove('bump'); void cEl.offsetWidth; cEl.classList.add('bump'); }
        if (s.m || s.x) { mEl.classList.remove('bump'); void mEl.offsetWidth; mEl.classList.add('bump'); }
        await wait(s.src === 'tile' ? 170 : 300);
      }
      var tEl = document.getElementById('y-t'); tEl.textContent = fmt(e.total); tEl.classList.add('bump');
      await wait(520);
      var res = Y.play(ctx, run, sel);
      sel = []; canCache.key = '';
      api.gc('mazeru-kanji/yaku/word/' + e.w.length);
      save();
      busy = false; root.classList.remove('y-busy');
      if (res.cleared) { api.beep('rank'); render(); top(); }
      else if (run.over) { api.beep('bad'); finish(); top(); }
      else renderRound();
    }
    function doDiscard() {
      if (busy || !sel.length) return;
      Y.discard(ctx, run, sel.slice(0, 5));
      sel = []; canCache.key = '';
      save();
      if (run.over) return finish();
      renderRound();
    }
    function doHint() {
      var r = Y.useHint(ctx, run);
      if (!r) return;
      if (r.none) { api.toast('この手札では熟語が作れません。捨てて入れ替えよう'); return; }
      sel = r.sel.slice(); save(); renderRound();
      api.toast('ヒント:「' + r.w + '」');
    }
    function doSort() {
      sortBy = sortBy === 'stroke' ? 'rad' : 'stroke';
      run.hand.sort(function (a, b) {
        if (sortBy === 'stroke') return (ctx.s[a.ch] || 0) - (ctx.s[b.ch] || 0);
        return (ctx.r[a.ch] || 0) - (ctx.r[b.ch] || 0) || (ctx.s[a.ch] || 0) - (ctx.s[b.ch] || 0);
      });
      sel = []; save(); renderRound();
      api.toast(sortBy === 'stroke' ? '画数の少ない順' : '部首の順');
    }

    // ------------------------------------------------------------ 店
    function renderShop() {
      var p = run.lastPay || { win: 0, hands: 0, interest: 0, jokers: 0, total: 0 };
      var h = '<div class="y-shop">';
      h += '<div class="y-win"><div class="kicker">局' + run.round + ' 勝ち</div><h2>' + fmt(run.score) + '点<small>／ 目標 ' + fmt(Y.target(run)) + '</small></h2>';
      h += '<div class="y-pay"><span>勝ち <b>+' + p.win + '</b></span><span>残りの手 <b>+' + p.hands + '</b></span><span>利子（5両ごとに1） <b>+' + p.interest + '</b></span>' + (p.jokers ? '<span>金庫 <b>+' + p.jokers + '</b></span>' : '') + '<span class="sum">合計 <b>+' + p.total + '両</b> → いま <b>' + run.money + '両</b></span></div></div>';
      h += '<h3 class="y-h3">手持ちの役札 <small>' + run.jokers.length + '／' + Y.MAX_JOKERS + '　左から順に効く</small></h3>' + jokerRow('shop');
      h += '<h3 class="y-h3">店 <small>持ち金 ' + run.money + '両</small></h3><div class="y-offers">';
      run.shop.jokers.forEach(function (id, k) {
        if (!id) { h += '<div class="y-offer sold"><small>売り切れ</small></div>'; return; }
        var d = Y.JMAP[id], can = run.money >= d.price && run.jokers.length < Y.MAX_JOKERS;
        h += '<div class="y-offer' + (d.rare ? ' rare' : '') + '"><b>' + esc(d.name) + '</b><small>' + esc(Y.jokerDesc({ id: id, n: 0 })) + '</small>' +
          '<button class="btn small' + (can ? ' primary' : '') + '" type="button" data-act="buy" data-k="' + k + '"' + (can ? '' : ' disabled') + '>' + d.price + '両で買う</button></div>';
      });
      h += '</div><div class="y-tools">';
      var b = run.shop.bought;
      h += tool('pack', '字札', '3字から1字を山札に足す', Y.PRICE.pack, !b.pack);
      h += tool('cut', '削る', '山札から1字を抜く', Y.PRICE.cut, !b.cut && run.deck.length > 20);
      h += tool('seal', '朱印', '1字に朱印。使うと倍+4', Y.PRICE.seal, !b.seal);
      h += tool('reroll', '引き直し', '役札の品ぞろえを替える', Y.rerollCost(run), true);
      h += '</div>';
      if (run.shop.pack) {
        h += '<div class="y-pack card"><b>山札に足す字を1つ選ぶ</b><div class="y-pack-row">' + run.shop.pack.map(function (ch, k) {
          return '<button type="button" class="ytile big" data-act="take" data-k="' + k + '"><span class="ch">' + esc(ch) + '</span><small>' + (ctx.s[ch] || '') + '</small><i>' + esc(RAD_NAME[ctx.r[ch]] || '') + '</i></button>';
        }).join('') + '</div></div>';
      }
      if (picker) {
        h += '<div class="y-pack card"><b>' + (picker === 'cut' ? '山札から抜く字を選ぶ' : '朱印を押す字を選ぶ') + '</b><button type="button" class="btn small" data-act="picker-cancel">やめる</button><div class="y-deck">' + deckSorted().map(function (t) {
          return '<button type="button" class="ytile sm' + (t.seal ? ' seal' : '') + '" data-act="pick" data-id="' + t.id + '"' + (picker === 'seal' && t.seal ? ' disabled' : '') + '><span class="ch">' + esc(t.ch) + '</span><small>' + (ctx.s[t.ch] || '') + '</small></button>';
        }).join('') + '</div></div>';
      }
      var nb = run.endless ? null : (run.bosses[run.round + 1] ? Y.BMAP[run.bosses[run.round + 1]] : null);
      var nextTarget = Y.target({ round: run.round + 1, endless: run.endless });
      h += '<div class="y-next card"><div><small>次は局' + (run.round + 1) + '</small><b>目標 ' + fmt(nextTarget) + '点</b>' + (nb ? '<span class="y-bossname">ボス「' + esc(nb.name) + '」' + esc(nb.desc) + '</span>' : '') + '</div><button class="btn shu" type="button" data-act="next">次の局へ</button></div>';
      h += '<details class="y-deckview"><summary>山札を見る（' + run.deck.length + '枚）</summary><div class="y-deck">' + deckSorted().map(function (t) { return '<span class="ytile sm' + (t.seal ? ' seal' : '') + '"><span class="ch">' + esc(t.ch) + '</span><small>' + (ctx.s[t.ch] || '') + '</small></span>'; }).join('') + '</div></details>';
      h += '</div>';
      root.innerHTML = h;
    }
    function tool(act, name, desc, price, avail) {
      var can = avail && run.money >= price;
      return '<button type="button" class="y-tool" data-act="' + act + '"' + (can ? '' : ' disabled') + '><b>' + name + '</b><small>' + desc + '</small><span>' + (avail ? price + '両' : '済み') + '</span></button>';
    }
    function deckSorted() { return run.deck.slice().sort(function (a, b) { return (ctx.s[a.ch] || 0) - (ctx.s[b.ch] || 0) || (a.ch < b.ch ? -1 : 1); }); }

    // ------------------------------------------------------------ おわり
    function finish() {
      var rec = { round: run.won ? Y.ROUNDS : run.round, won: !!run.won, best: run.best, total: run.total, endless: run.endless ? run.round - Y.ROUNDS : 0 };
      if (run.official && run.phase !== 'won-continue') {
        S.daily = S.daily || {};
        if (!S.daily[api.today()]) S.daily[api.today()] = rec;
      }
      var cur = S.best || { round: 0, total: 0 };
      if ((rec.won ? 99 : rec.round) > (cur.won ? 99 : cur.round || 0) || rec.total > (cur.total || 0)) S.best = { round: Math.max(rec.round, cur.round || 0), won: rec.won || cur.won, total: Math.max(rec.total, cur.total || 0) };
      api.gc('mazeru-kanji/yaku/end/' + (rec.won ? 'win' : 'r' + rec.round));
      var done = run; run = null; save();
      renderResult(done);
    }
    function shareFor(r) { return Y.shareText(r, r.official || r.daily ? dailyLabel() : '', api.url); }
    function renderResult(r) {
      var h = '<div class="y-result">';
      h += '<div class="kicker">' + (r.daily ? 'きょうの一局' + (r.official ? '' : '（練習）') : '自由に一局') + '</div>';
      h += '<h2>' + (r.won ? '天下一！ 8局すべて勝った' : '局' + r.round + 'で散った') + '</h2>';
      h += '<p class="y-total">合計 <b>' + fmt(r.total) + '点</b>' + (r.best ? '　最高の一手「' + esc(r.best[0]) + '」<small>' + esc(r.best[2] || '') + '</small> ' + fmt(r.best[1]) + '点' : '') + '</p>';
      var text = shareFor(r);
      h += '<pre class="share-pre">' + esc(text) + '</pre><div class="row2"><a class="btn primary" target="_blank" rel="noopener" href="https://x.com/intent/post?text=' + encodeURIComponent(text) + '">X でポストする</a><button class="btn" type="button" data-act="copy">文面をコピー</button></div>';
      if (r.won && !r.endless) h += '<button class="btn shu" type="button" data-act="endless">まだ続ける（延長戦）</button>';
      h += '<div class="y-again"><button class="btn shu" type="button" data-act="free">もう一局（自由に）</button><button class="btn" type="button" data-act="title">はじめの画面へ</button></div>';
      if (r.words && r.words.length) {
        h += '<h3 class="y-h3">今回つくった熟語 <small>' + r.words.length + '語</small></h3><ul class="y-words">' + r.words.map(function (w) {
          return '<li><b>' + esc(w[0]) + '</b><small>' + esc(ctx.read(w[0]) || '') + '</small><span>' + fmt(w[1]) + '</span></li>';
        }).join('') + '</ul>';
      }
      h += '<div class="y-learn card"><b>じっくり漢字を学ぶなら</b><p>点や役札のない、シンプルな遊び方もあります。</p><div class="row2"><button class="btn small" type="button" data-learn="daily">きょうの7字</button><button class="btn small" type="button" data-learn="practice">学年別れんしゅう</button><button class="btn small" type="button" data-learn="print">プリント</button></div></div>';
      if (api.pr) h += '<div class="y-pr">' + api.pr('漢字 熟語 問題集', '熟語をもっと覚えるなら、漢字の問題集', '遊んでいる最中には出ません。') + '</div>';
      h += '</div>';
      root.innerHTML = h;
      root._lastShare = text;
      root._lastRun = r;
    }

    function renderHow() {
      api.openHow();
    }

    function render() {
      if (!run) return renderTitle();
      if (run.phase === 'round') return renderRound();
      if (run.phase === 'shop') return renderShop();
      if (run.phase === 'won') return finish();
      return renderTitle();
    }

    // ------------------------------------------------------------ 操作
    root.addEventListener('click', function (ev) {
      if (busy) return;
      var learn = ev.target.closest('[data-learn]');
      if (learn) { api.learn(learn.dataset.learn); return; }
      var t = ev.target.closest('.ytile[data-k]:not([data-act])');
      if (t && run && run.phase === 'round') {
        var k = Number(t.dataset.k), i = sel.indexOf(k);
        if (i >= 0) sel.splice(i, 1); else if (sel.length < 5) sel.push(k);
        refreshSel(); return;
      }
      var b = ev.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var act = b.dataset.act, slot = Number(b.dataset.slot), k2 = Number(b.dataset.k);
      switch (act) {
        case 'resume': render(); break;
        case 'daily': startRun(true); break;
        case 'free': startRun(false); break;
        case 'title': run = run && !run.over ? run : null; renderTitle(); break;
        case 'how': renderHow(); break;
        case 'play': doPlay(); break;
        case 'discard': doDiscard(); break;
        case 'clear': sel = []; renderRound(); break;
        case 'sort': doSort(); break;
        case 'hint': doHint(); break;
        case 'jinfo': { var j = run && run.jokers[slot]; if (j) api.toast(Y.JMAP[j.id].name + '：' + Y.jokerDesc(j)); break; }
        case 'buy': if (Y.buyJoker(run, k2)) { api.beep('ok'); save(); renderShop(); } break;
        case 'sell': if (Y.sellJoker(run, slot)) { save(); renderShop(); } break;
        case 'jleft': if (Y.moveJoker(run, slot, -1)) { save(); renderShop(); } break;
        case 'jright': if (Y.moveJoker(run, slot, 1)) { save(); renderShop(); } break;
        case 'pack': if (Y.openPack(ctx, run)) { save(); renderShop(); } break;
        case 'take': if (Y.takeFromPack(run, k2)) { api.beep('ok'); save(); renderShop(); } break;
        case 'cut': picker = 'cut'; renderShop(); break;
        case 'seal': picker = 'seal'; renderShop(); break;
        case 'picker-cancel': picker = null; renderShop(); break;
        case 'pick': {
          var id = Number(b.dataset.id);
          if (picker === 'cut' ? Y.cutTile(run, id) : Y.sealTile(run, id)) { picker = null; save(); renderShop(); }
          break;
        }
        case 'reroll': if (Y.reroll(run)) { save(); renderShop(); } break;
        case 'next': picker = null; Y.nextRound(ctx, run); sel = []; save(); renderRound(); top(); break;
        case 'copy': api.copy(root._lastShare || ''); break;
        case 'share-rec': {
          var rec = S.daily[api.today()];
          var fake = { won: rec.won, round: rec.round, best: rec.best, endless: rec.endless ? 1 : 0 };
          api.copy(Y.shareText(fake, dailyLabel(), api.url)); break;
        }
        case 'endless': {
          var r = root._lastRun; if (!r) break;
          run = r; run.over = false; Y.continueEndless(ctx, run); save(); renderShop(); break;
        }
      }
    });
    document.addEventListener('keydown', function (ev) {
      if (!run || run.phase !== 'round' || busy || !root.isConnected || root.closest('[hidden]')) return;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === 'Enter') { ev.preventDefault(); doPlay(); }
      else if (ev.key === 'Escape' || ev.key === 'Backspace') { if (sel.length) { ev.preventDefault(); sel.pop(); renderRound(); } }
    });

    render();
    return {
      state: function () { return { run: run, sel: sel.slice(), S: S }; },
      select: function (arr) { sel = arr.slice(); renderRound(); },
      // 検査用: いちばん点の高い語を出すか、なければ捨てる（機械に遊ばせるとき）
      autoPick: function () {
        if (!run || run.phase !== 'round') return null;
        var best = null;
        Y.formable(ctx, run).forEach(function (x) { var e = Y.evaluate(ctx, run, x.sel); if (e.ok && (!best || e.total > best.total)) best = { sel: x.sel, total: e.total }; });
        var need = Y.target(run) - run.score;
        if (best && (best.total * run.handsLeft >= need * 0.9 || run.discLeft === 0 || best.total >= need)) return { play: true, sel: best.sel };
        if (run.discLeft > 0) { var keep = best ? best.sel : []; return { play: false, sel: run.hand.map(function (_, k) { return k; }).filter(function (k) { return keep.indexOf(k) < 0; }).slice(0, 5) }; }
        return best ? { play: true, sel: best.sel } : null;
      },
      play: doPlay, discard: doDiscard, render: render
    };
  }

  window.YakuUI = { mount: mount };
})();
