// 気持ちスタンプのはがき（Shadow DOM でページの CSS から切り離す）と、トップの「みんなの気持ち」ボード。
// ページに置くのは次の 2 行だけ:
//   <div data-feel="hyaku" data-feel-set="story"></div>
//   <script type="module" src="/assets/feel/feel.js"></script>
// 小型版は data-feel-mode="compact"、言語の指定は data-feel-lang="ja|en"。
// JS が後から描く画面では window.Feel.mount(el) を呼ぶ。ボードは <div data-feel-board></div>。
// 設計書: docs/superpowers/specs/2026-09-23-feelings-stamps-design.md
import * as C from './feel-core.js';

const LS_KEY = 'feel.v1';
const SS_KEY = 'feel.cache.v1';

function storage(kind) {
  try { return window[kind] || null; } catch (e) { return null; }
}
function load(kind, key) {
  const s = storage(kind);
  if (!s) return {};
  try { return JSON.parse(s.getItem(key) || '{}') || {}; } catch (e) { return {}; }
}
function save(kind, key, value) {
  const s = storage(kind);
  if (!s) return;
  try { s.setItem(key, JSON.stringify(value)); } catch (e) { /* 保存できなくても画面は動かす */ }
}
function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function today() { return new Date().toISOString().slice(0, 10); }

// count.js は async で遅れて来る。最大 5 秒待ってから送る
function gcCount(path, title) {
  let tries = 0;
  (function attempt() {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') {
      try { gc.count({ path, title, event: true }); } catch (e) { /* 計測の失敗で画面を壊さない */ }
      return;
    }
    if (++tries < 20) setTimeout(attempt, 250);
  })();
}

function rememberCount(path, n) {
  save('sessionStorage', SS_KEY, C.writeCache(load('sessionStorage', SS_KEY), path, n, Date.now()));
}

async function fetchCount(path) {
  const hit = C.readCache(load('sessionStorage', SS_KEY), path, Date.now());
  if (hit != null) return hit;
  try {
    const r = await fetch(C.counterUrl(path), { mode: 'cors' });
    // 公開カウンタは、まだ誰も押していないパスに 404 と "0" を返す。読めなかったのではなく 0 人
    if (r.status === 404) { rememberCount(path, 0); return 0; }
    if (!r.ok) return null;
    const n = C.parseCount(await r.json());
    if (n != null) rememberCount(path, n);
    return n;
  } catch (e) {
    return null;
  }
}

// 画面に入ってから描く。隠れた読了画面・結果画面は、表に出たときに描かれる
function whenVisible(host, fn) {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: '200px 0px' });
  io.observe(host);
}

const CARD_CSS = `
:host{all:initial;display:block;width:100%;visibility:inherit;pointer-events:inherit}
[hidden]{display:none!important}
.card{position:relative;box-sizing:border-box;width:calc(100% - 32px);max-width:560px;margin:40px auto;
  padding:18px 20px 16px;background:#f7f1e3;color:#2b2620;border:1px solid rgba(43,38,32,.28);border-radius:6px;
  box-shadow:0 10px 28px rgba(0,0,0,.18);font-family:"Hiragino Mincho ProN","Yu Mincho","YuMincho","Noto Serif JP",serif;
  font-size:15px;line-height:1.7;text-align:left;letter-spacing:normal;word-break:auto-phrase}
.card *{box-sizing:border-box}
.head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.title{margin:0;font-size:17px;font-weight:700;color:#2b2620;text-wrap:balance}
.sub{margin:2px 0 0;font-size:12.5px;color:#6b6155}
.postmark{flex:none;width:44px;height:52px;border:1.5px dashed rgba(43,38,32,.45);border-radius:3px;
  display:flex;align-items:center;justify-content:center;font-size:22px;color:#6b6155}
.stamps{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 8px}
.stamp{display:inline-flex;align-items:center;gap:6px;min-height:40px;margin:0;padding:6px 12px;font:inherit;
  font-size:14px;line-height:1.3;letter-spacing:normal;color:#2b2620;background:#fffaf0;
  border:1px solid rgba(43,38,32,.35);border-radius:999px;cursor:pointer}
.stamp:hover{background:#fff1d6}
.stamp[aria-pressed="true"]{background:#2b2620;color:#f7f1e3;border-color:#2b2620}
.stamp:focus-visible,.note-toggle:focus-visible,.send:focus-visible{outline:2px solid #b5542c;outline-offset:2px}
.n{font-size:12px;opacity:.8}
.msg{min-height:1.5em;margin:0;font-size:13px;color:#8a3b17}
.note-toggle{margin:6px 0 0;padding:6px 0;font:inherit;font-size:13px;color:#6b6155;background:none;border:0;
  cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.note{margin-top:8px}
textarea{display:block;width:100%;min-height:96px;margin:0;padding:10px;font:inherit;font-size:14px;color:#2b2620;
  background:#fffdf7;border:1px solid rgba(43,38,32,.35);border-radius:4px;resize:vertical}
.hp{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none}
.note-row{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap}
.hint{flex:1 1 220px;font-size:12px;color:#6b6155}
.send{min-height:40px;margin:0;padding:6px 20px;font:inherit;font-size:14px;color:#f7f1e3;background:#2b2620;
  border:0;border-radius:4px;cursor:pointer}
.send:disabled{opacity:.6;cursor:wait}
.note-msg{min-height:1.4em;margin:6px 0 0;font-size:13px;color:#8a3b17}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.card.compact{width:100%;margin:14px auto 4px;padding:12px 14px}
.card.compact .head{justify-content:center}
.card.compact .title{font-size:14px;text-align:center}
.card.compact .stamps{justify-content:center;margin:8px 0 4px}
.card.compact .msg{text-align:center}
`;

const BOARD_CSS = `
:host{display:block}
.board{max-width:760px;margin:0 0 12px}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.chip{min-height:38px;padding:4px 16px;font:inherit;font-size:14px;color:var(--ink,#161510);background:transparent;
  border:1px solid var(--ink,#161510);border-radius:999px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--ink,#161510);color:var(--paper,#f4f0e6)}
.chip:focus-visible,.row:focus-visible{outline:2px solid var(--accent,#c43d2a);outline-offset:2px}
.row{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:4px 12px;padding:14px 2px;
  border-top:1px solid rgba(22,21,16,.18);color:var(--ink,#161510);text-decoration:none}
.row:hover .name{color:var(--accent,#c43d2a)}
.name{font-weight:700}
.extra{margin-left:8px;font-size:12px;font-weight:400;color:var(--ink-3,#6b6759)}
.n{font-size:14px;color:var(--ink-2,#3a3830);white-space:nowrap}
`;

function mount(host, opts = {}) {
  if (!host || host.__feel) return;
  const work = opts.work || host.dataset.feel;
  const set = opts.set || host.dataset.feelSet;
  if (!C.isWorkId(work) || !C.stampsFor(set)) return;
  host.__feel = {
    work,
    set,
    mode: opts.mode || host.dataset.feelMode || 'full',
    lang: opts.lang || host.dataset.feelLang || '',
    title: opts.title || host.dataset.feelTitle || '',
  };
  whenVisible(host, () => renderCard(host));
}

function renderCard(host) {
  const cfg = host.__feel;
  const lang = C.pickLang(cfg.lang || document.documentElement.lang, navigator.language);
  const T = C.TEXT[lang];
  const heading = C.HEADINGS[cfg.set][lang];
  const title = C.workTitle(cfg.work, cfg.title || document.title);
  const compact = cfg.mode === 'compact';

  const card = node('div', compact ? 'card compact' : 'card');
  card.lang = lang;
  const head = node('div', 'head');
  const words = node('div');
  words.append(node('p', 'title', heading));
  if (!compact) words.append(node('p', 'sub', T.sub));
  head.append(words);
  if (!compact) {
    const mark = node('div', 'postmark', '✉');
    mark.setAttribute('aria-hidden', 'true');
    head.append(mark);
  }
  const row = node('div', 'stamps');
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', heading);
  const msg = node('p', 'msg');
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');

  const state = load('localStorage', LS_KEY);
  for (const s of C.stampsFor(cfg.set)) {
    const pressed = C.isPressed(state, C.counterPath(cfg.work, s.key));
    row.append(stampButton(cfg, s, lang, title, msg, pressed));
  }
  card.append(head, row, msg);
  if (!compact) card.append(noteBlock(cfg, T, title));

  const style = node('style');
  style.textContent = CARD_CSS;
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(style, card);
}

function stampButton(cfg, s, lang, title, msg, pressedBefore) {
  const path = C.counterPath(cfg.work, s.key);
  const b = node('button', 'stamp');
  b.type = 'button';
  b.dataset.key = s.key;
  b.setAttribute('aria-pressed', pressedBefore ? 'true' : 'false');
  const n = node('span', 'n');
  b.append(node('span', 'emoji', s.emoji), node('span', 'label', s[lang]), n);
  let count = null;
  let pressedNow = false;
  fetchCount(path).then((v) => {
    // 数が届く前に押された場合は、届いた数に自分の 1 を足す
    if (v != null && pressedNow) { v += 1; rememberCount(path, v); }
    count = v;
    n.textContent = C.countLabel(lang, v);
  });
  b.addEventListener('click', () => {
    const state = load('localStorage', LS_KEY);
    if (b.getAttribute('aria-pressed') === 'true' || C.isPressed(state, path)) {
      msg.textContent = C.TEXT[lang].already;
      return;
    }
    pressedNow = true;
    save('localStorage', LS_KEY, C.markPressed(state, path, today()));
    b.setAttribute('aria-pressed', 'true');
    gcCount(path, `${title} — ${s.ja}`);
    if (count != null) {
      count += 1;
      n.textContent = C.countLabel(lang, count);
      rememberCount(path, count);
    }
    msg.textContent = C.countMessage(lang, count);
  });
  return b;
}

function noteBlock(cfg, T, title) {
  const wrap = node('div', 'notewrap');
  const toggle = node('button', 'note-toggle', T.noteToggle);
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  const box = node('div', 'note');
  box.hidden = true;
  const label = node('label', 'sr', T.noteLabel);
  label.htmlFor = 'feel-note';
  const ta = node('textarea');
  ta.id = 'feel-note';
  ta.maxLength = C.NOTE_MAX;
  ta.placeholder = T.notePlaceholder;
  const hp = node('input', 'hp'); // 人には見えない欄。埋まっていたらボット
  hp.type = 'text';
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  const send = node('button', 'send', T.send);
  send.type = 'button';
  const line = node('div', 'note-row');
  line.append(node('span', 'hint', T.noteHint), send);
  const out = node('p', 'note-msg');
  out.setAttribute('role', 'status');
  out.setAttribute('aria-live', 'polite');
  box.append(label, ta, hp, line, out);
  wrap.append(toggle, box);

  let openedAt = 0;
  const open = () => {
    box.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    openedAt = Date.now();
  };
  ta.value = C.getDraft(load('localStorage', LS_KEY), cfg.work);
  if (ta.value) open(); // 前に送れなかった下書きがあれば開いておく

  toggle.addEventListener('click', () => {
    if (box.hidden) { open(); ta.focus(); return; }
    box.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });
  send.addEventListener('click', async () => {
    const v = C.validateNote(ta.value, Date.now() - openedAt, hp.value);
    if (!v.ok) {
      out.textContent = v.reason === 'bot' ? T.sent : T[v.reason]; // ボットには成功したふりをする
      return;
    }
    send.disabled = true;
    out.textContent = T.sending;
    try {
      await fetch(C.FORM_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: new URLSearchParams(C.formBody(cfg.work, location.pathname, v.text)),
      });
      ta.value = '';
      save('localStorage', LS_KEY, C.setDraft(load('localStorage', LS_KEY), cfg.work, ''));
      out.textContent = T.sent;
      gcCount(`feel/${cfg.work}/note`, `${title} — ひとこと`);
    } catch (e) {
      // 下書きを残すのは送れなかったときだけ（共用の端末で、書きかけが次の人に見えないように）
      save('localStorage', LS_KEY, C.setDraft(load('localStorage', LS_KEY), cfg.work, v.text));
      out.textContent = T.failed;
    } finally {
      send.disabled = false;
    }
  });
  return wrap;
}

function mountBoard(host) {
  if (!host || host.__feelBoard) return;
  host.__feelBoard = true;
  whenVisible(host, () => renderBoard(host));
}

function renderBoard(host) {
  const chips = node('div', 'chips');
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', '気持ちで選ぶ');
  const rows = node('div', 'rows');
  const box = node('div', 'board');
  box.append(chips, rows);
  const style = node('style');
  style.textContent = BOARD_CSS;
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.replaceChildren(style, box);

  const counts = {};
  let current = C.BOARD[0];
  const draw = () => {
    chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === current.id)));
    const list = C.sortRows(current.works.map((w, i) => (
      { work: w, count: counts[C.counterPath(w, current.key)], order: i })));
    rows.replaceChildren(...list.map((r) => boardRow(r, current, counts)));
  };
  for (const g of C.BOARD) {
    const b = node('button', 'chip', g.label);
    b.type = 'button';
    b.dataset.id = g.id;
    b.addEventListener('click', () => { current = g; draw(); });
    chips.append(b);
  }
  draw(); // 数が届く前から、作品へのリンクは出しておく

  const paths = new Set(Object.values(C.CLEAR_PATHS));
  C.BOARD.forEach((g) => g.works.forEach((w) => paths.add(C.counterPath(w, g.key))));
  Promise.all([...paths].map((p) => fetchCount(p).then((n) => { counts[p] = n; }))).then(draw);
}

function boardRow(r, g, counts) {
  const w = C.WORKS[r.work];
  const a = node('a', 'row');
  a.href = w.url;
  const name = node('span', 'name', w.title);
  const cleared = C.CLEAR_PATHS[r.work] ? counts[C.CLEAR_PATHS[r.work]] : null;
  if (cleared) name.append(node('span', 'extra', `最後まで読んだ ${cleared}人`));
  let right = '';
  if (r.count === 0) right = 'まだ誰も押していません';
  else if (r.count != null) right = `${g.emoji} ${g.stamp} ${r.count}人`;
  a.append(name, node('span', 'n', right));
  a.addEventListener('click', () => gcCount(`feel/board/open/${r.work}`, `みんなの気持ち → ${w.title}`));
  return a;
}

function scan(root = document) {
  root.querySelectorAll('[data-feel]').forEach((n) => mount(n));
  root.querySelectorAll('[data-feel-board]').forEach((n) => mountBoard(n));
}

window.Feel = { mount, scan };
scan();
