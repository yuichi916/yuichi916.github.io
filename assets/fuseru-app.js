/* fuseru-app.js — fuseru.html の画面。検出・置き換えは fuseru-core.js（Fuseru）に任せる。
 * 入力はこのタブのメモリの中だけに置く。localStorage にも保存しない。通信もしない。 */
(function () {
  'use strict';
  var F = window.Fuseru;
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  if (params.get('nofx') === '1') document.body.classList.add('nofx');

  var MAX = 200000;
  var EXAMPLE = [
    '株式会社ミナト企画',
    '営業部 田中 一郎 様',
    '',
    'いつもお世話になっております。さくら坂商事の佐藤です。',
    '先日ご相談した見積の件、担当の鈴木から改めてご連絡いたします。',
    '',
    '■ご依頼者',
    '氏名：山本 花子（ヤマモト ハナコ）',
    '生年月日：1985年3月12日',
    '住所：〒105-0011 東京都港区芝公園9-9-9 ミナトハイツ301',
    '電話：090-0000-1234',
    'メール：hanako.yamamoto@example.jp',
    'マイナンバー：1234 5678 9018',
    '振込先：さくら坂銀行 港南支店 普通 1234567',
    '',
    '納品は2026年11月30日を予定しています。',
    'ご不明点は 03-0000-5678 までお願いいたします。',
    '',
    '--',
    'さくら坂商事株式会社',
    '佐藤 健',
    'sato@example.co.jp'
  ].join('\n');

  var state = {
    enabled: {},
    include: [],          // [{type, value}] 手で足したもの
    exclude: {},          // keyOf(type,value) -> {type, value} 伏せないもの
    spans: [], table: []
  };
  F.TYPES.forEach(function (t) { state.enabled[t.key] = t.on; });

  // ---------------------------------------------------------------- 種類のボタン
  var chips = $('chips'), addType = $('add-type'), chipCnt = {};
  F.TYPES.forEach(function (t) {
    var lab = document.createElement('label');
    lab.className = 'chip t-' + t.key + (t.on ? '' : ' off');
    lab.title = t.desc;
    var inp = document.createElement('input');
    inp.type = 'checkbox'; inp.checked = t.on;
    inp.addEventListener('change', function () {
      state.enabled[t.key] = inp.checked;
      lab.classList.toggle('off', !inp.checked);
      render();
    });
    var dot = document.createElement('span'); dot.className = 'dot';
    var nm = document.createElement('span'); nm.textContent = t.label;
    var cnt = document.createElement('span'); cnt.className = 'cnt'; cnt.textContent = '';
    chipCnt[t.key] = cnt;
    lab.append(inp, dot, nm, cnt);
    chips.appendChild(lab);
    var op = document.createElement('option'); op.value = t.key; op.textContent = t.label;
    addType.appendChild(op);
  });

  // ---------------------------------------------------------------- 描画
  var src = $('src'), out = $('out'), preview = $('preview'), reply = $('reply'), back = $('back');
  function render() {
    var text = src.value;
    var note = $('src-note');
    note.classList.remove('warn');
    if (text.length > MAX) {
      note.textContent = '長すぎます（' + text.length.toLocaleString() + '文字）。' + MAX.toLocaleString() + '文字までにしてください。';
      note.classList.add('warn');
      return;
    }
    var all = F.detect(text, { enabled: state.enabled, include: state.include });
    var active = all.filter(function (s) { return !state.exclude[F.keyOf(s.type, s.value)]; });
    var masked = F.mask(text, active);
    state.spans = all; state.table = masked.table;
    out.value = masked.text;

    if (!text) note.textContent = '';
    else if (F.hasTokenLike(text)) {
      note.textContent = '元の文に「[人名1]」のような書き方がすでにあります。戻すときに区別できないので、書き換えてから使ってください。';
      note.classList.add('warn');
    } else note.textContent = text.length.toLocaleString() + '文字';

    drawPreview(text, all);
    drawCounts(active);
    drawTable(masked.table);
    drawManual();
    doRestore();
  }

  function drawPreview(text, spans) {
    var frag = document.createDocumentFragment(), pos = 0;
    var manualKeys = {};
    state.include.forEach(function (m) { manualKeys[F.keyOf(m.type, m.value)] = true; });
    spans.forEach(function (s) {
      if (s.start > pos) frag.appendChild(document.createTextNode(text.slice(pos, s.start)));
      var k = F.keyOf(s.type, s.value);
      var mk = document.createElement('mark');
      mk.className = 'hl t-' + s.type + (state.exclude[k] ? ' off' : '') + (s.rule === 'manual' ? ' manual' : '');
      mk.textContent = text.slice(s.start, s.end);
      mk.dataset.key = k; mk.dataset.type = s.type; mk.dataset.value = s.value; if (s.rule === 'manual') mk.dataset.manual = '1';
      mk.tabIndex = 0; mk.setAttribute('role', 'button');
      mk.title = F.LABEL[s.type] + (state.exclude[k] ? '（伏せない）' : '') + ' — 押すと切り替え';
      frag.appendChild(mk);
      pos = s.end;
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    preview.replaceChildren(frag);
  }

  function drawCounts(active) {
    var c = {};
    active.forEach(function (s) { c[s.type] = (c[s.type] || 0) + 1; });
    F.TYPES.forEach(function (t) { chipCnt[t.key].textContent = c[t.key] ? String(c[t.key]) : ''; });
    var parts = F.TYPES.filter(function (t) { return c[t.key]; }).map(function (t) { return t.label + ' ' + c[t.key]; });
    $('out-sum').textContent = active.length ? '伏せた所 ' + active.length + 'か所（' + parts.join('・') + '）。貼る前に、残っている名前がないか目で確かめてください。' :
      (src.value ? '伏せる所は見つかりませんでした。見落としは 2 で足せます。' : '');
  }

  function drawTable(table) {
    var tb = $('table-body');
    tb.replaceChildren();
    table.forEach(function (r) {
      var tr = document.createElement('tr');
      var a = document.createElement('td'); a.textContent = r.token; a.className = 't-' + r.type;
      var b = document.createElement('td'); b.textContent = r.value;
      tr.append(a, b); tb.appendChild(tr);
    });
    $('table-count').textContent = String(table.length);
  }

  function drawManual() {
    var box = $('manual');
    box.replaceChildren();
    var ex = Object.keys(state.exclude).map(function (k) { return state.exclude[k]; });
    if (!state.include.length && !ex.length) { box.hidden = true; return; }
    box.hidden = false;
    function tag(prefix, item, onRemove) {
      var t = document.createElement('span'); t.className = 'tag';
      var s = document.createElement('span'); s.textContent = prefix + item.value + '（' + F.LABEL[item.type] + '）';
      var x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', '取り消す');
      x.addEventListener('click', function () { onRemove(); render(); });
      t.append(s, x); box.appendChild(t);
    }
    state.include.forEach(function (m, i) { tag('足した: ', m, function () { state.include.splice(i, 1); }); });
    ex.forEach(function (m) { tag('伏せない: ', m, function () { delete state.exclude[F.keyOf(m.type, m.value)]; }); });
  }

  function doRestore() {
    var r = F.restore(reply.value, state.table);
    back.value = reply.value ? r.text : '';
    var sum = $('back-sum');
    sum.classList.remove('warn');
    if (!reply.value) { sum.textContent = ''; return; }
    if (r.missing.length) {
      sum.textContent = r.count + 'か所を戻しました。対応表にない伏せ字が ' + r.missing.length + 'か所あります（' + r.missing.slice(0, 3).join('、') + (r.missing.length > 3 ? '…' : '') + '）。';
      sum.classList.add('warn');
    } else sum.textContent = r.count ? r.count + 'か所を元に戻しました。' : '戻す伏せ字は見つかりませんでした。';
  }

  // ---------------------------------------------------------------- 操作
  var timer = 0;
  src.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(render, 120); });
  reply.addEventListener('input', doRestore);

  function toggleMark(mk) {
    if (mk.dataset.manual) {
      var t = mk.dataset.type, v = mk.dataset.value;
      state.include = state.include.filter(function (m) { return !(m.type === t && m.value === v); });
    } else {
      var k = mk.dataset.key;
      if (state.exclude[k]) delete state.exclude[k];
      else state.exclude[k] = { type: mk.dataset.type, value: mk.dataset.value };
    }
    render();
  }
  preview.addEventListener('click', function (e) {
    var mk = e.target.closest('mark.hl');
    if (!mk) return;
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed && preview.contains(sel.anchorNode)) return;   // 文字を選んでいる最中は切り替えない
    toggleMark(mk);
  });
  preview.addEventListener('keydown', function (e) {
    var mk = e.target.closest && e.target.closest('mark.hl');
    if (mk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggleMark(mk); }
  });

  function offsetIn(container, node, off) {
    var r = document.createRange();
    r.setStart(container, 0);
    r.setEnd(node, off);
    return r.toString().length;
  }
  $('btn-add').addEventListener('click', function () {
    var sel = window.getSelection(), note = $('src-note');
    if (!sel || sel.isCollapsed || !preview.contains(sel.anchorNode) || !preview.contains(sel.focusNode)) {
      note.textContent = '先に、2 の欄で伏せたい文字を選んでください（スマホは長押しで選べます）。';
      note.classList.add('warn');
      return;
    }
    var a = offsetIn(preview, sel.anchorNode, sel.anchorOffset), b = offsetIn(preview, sel.focusNode, sel.focusOffset);
    var s = Math.min(a, b), e = Math.max(a, b);
    var value = src.value.slice(s, e).trim();
    if (!value) return;
    var type = addType.value;
    delete state.exclude[F.keyOf(type, value)];
    if (!state.include.some(function (m) { return m.type === type && m.value === value; })) state.include.push({ type: type, value: value });
    sel.removeAllRanges();
    render();
  });

  function copyText(text, btn) {
    function ok() { var t = btn.textContent; btn.textContent = 'コピーしました'; btn.classList.add('done'); setTimeout(function () { btn.textContent = t; btn.classList.remove('done'); }, 1400); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'gc';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* 選んだ状態のままにする */ }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }
  $('btn-copy-out').addEventListener('click', function () { if (out.value) copyText(out.value, this); });
  $('btn-copy-back').addEventListener('click', function () { if (back.value) copyText(back.value, this); });
  $('btn-example').addEventListener('click', function () { src.value = EXAMPLE; render(); });
  $('btn-clear').addEventListener('click', function () { src.value = ''; reply.value = ''; render(); src.focus(); });
  $('btn-reset').addEventListener('click', function () {
    state.include = []; state.exclude = {}; reply.value = '';
    render();
  });

  // ---------------------------------------------------------------- 説明の欄
  var meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (meta) $('csp-text').textContent = meta.content.split('; ').join(';\n');
  if (window.FUSERU_PLACES) $('n-munis').textContent = window.FUSERU_PLACES.munis.length.toLocaleString();
  if (window.FUSERU_SURNAMES) $('n-surnames').textContent = window.FUSERU_SURNAMES.length.toLocaleString();

  var M = window.FUSERU_METRICS;
  if (M && M.frozen) {
    var tbl = $('metrics');
    var pct = function (v) { return v == null ? '—' : (v * 100).toFixed(1) + '%'; };
    var head = document.createElement('tr');
    ['種類', '正解の数', '適合率', '再現率', ''].forEach(function (h, i) {
      var th = document.createElement('th'); th.textContent = h; if (i >= 1 && i <= 3) th.className = 'num'; if (i === 4) th.className = 'bar-cell';
      head.appendChild(th);
    });
    var thead = document.createElement('thead'); thead.appendChild(head);
    var tbody = document.createElement('tbody');
    function row(label, r, cls) {
      var tr = document.createElement('tr'); if (cls) tr.className = cls;
      var c0 = document.createElement('td'); c0.textContent = label;
      var c1 = document.createElement('td'); c1.className = 'num'; c1.textContent = String(r.tp + r.fn);
      var c2 = document.createElement('td'); c2.className = 'num'; c2.textContent = pct(r.precision);
      var c3 = document.createElement('td'); c3.className = 'num'; c3.textContent = pct(r.recall);
      var c4 = document.createElement('td'); c4.className = 'bar-cell';
      var mt = document.createElement('div'); mt.className = 'meter' + ((r.recall || 0) < 0.85 ? ' low' : '');
      var bar = document.createElement('i'); bar.style.width = ((r.recall || 0) * 100).toFixed(1) + '%';
      mt.appendChild(bar); c4.appendChild(mt);
      tr.append(c0, c1, c2, c3, c4); tbody.appendChild(tr);
    }
    M.frozen.rows.filter(function (r) { return r.tp + r.fn > 0; })
      .sort(function (a, b) { return (b.tp + b.fn) - (a.tp + a.fn); })
      .forEach(function (r) { row(r.label, r); });
    row('全体', M.frozen.total, 'total');
    tbl.append(thead, tbody);
    var cur = M.current2, person = function (x) { return x.rows.filter(function (r) { return r.type === 'person'; })[0]; };
    $('metrics-note').textContent =
      '75件のうち負例（何も伏せてはいけない文）' + M.frozen.negCases + '件。' +
      '（参考）この75件の外れを見て直した今の版では、全体の適合率 ' + pct(cur.total.precision) + '・再現率 ' + pct(cur.total.recall) +
      '、人名の再現率 ' + pct(person(cur).recall) + ' になりました。ただしこれは答えを見た後の数字なので、表には入れていません。' +
      '調整には、作者が書いた ' + M.dev.cases + '件と、別の担当が書いた1組目の ' + M.current1.cases + '件も使っています（' + M.generated + ' 測定）。';
  }

  if (params.get('example') === '1') src.value = EXAMPLE;
  render();
})();
