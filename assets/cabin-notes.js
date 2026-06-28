/* ============================================================
 *  森の小屋 — 灯火の文箱（Letters by the Fire）
 *  匿名・登録不要の共有メモ帳。Supabase をデータ保存先に使う。
 *  cabin.html から  window.CabinNotes.open()  で開く。
 * ============================================================ */
(function () {
  'use strict';

  /* ---- 設定（ここに Supabase の URL と anon 公開キーを貼る）---- */
  const SUPABASE_URL = 'https://yhnuhlatcjcvkwfvgpdy.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlobnVobGF0Y2pjdmt3ZnZncGR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzA4NjYsImV4cCI6MjA5ODIwNjg2Nn0.nc8W6TgplCS_q3QuZeutP6u9NeDeDxVv-CVcV3pa3Lc';
  /* ------------------------------------------------------------ */

  const READY = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const REST = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
  const HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };

  const COOLDOWN_MS = 30000;       // 連投クールダウン
  const MAX_BODY = 500, MAX_NAME = 20;
  const LS_LAST = 'cabinNotesLastPost';
  const LS_HEARTED = 'cabinNotesHearted';
  const LS_REPORTED = 'cabinNotesReported';

  /* ---- NGフィルタ（自分の弱音はブロックしない。他者攻撃・晒し・宣伝・自傷の煽りのみ）---- */
  const NG_PATTERNS = [
    /死ね|しね|氏ね|くたばれ|消えろ|きえろ/i,
    /殺す|ころす|殺して(やる|ほしい)?(?!ほしいくらい)/i,         // 「殺してほしいくらい」等の弱音は緩く許容気味
    /ブス|デブ|キモい|きもい|うざい|ウザい|バカ|馬鹿|アホ|クズ|くず|ゴミ(?!箱)/i,
    /死んだ方がいい|死ねばいい|自殺しろ|飛び降りろ|首吊/i,        // 他者への自傷の煽り
    /https?:\/\/|www\.|\.com|\.net|t\.me|line\.me\/|＠[a-z0-9]/i,  // URL・宣伝・連絡先誘導
    /\b\d{2,4}-\d{2,4}-\d{3,4}\b/,                                  // 電話番号
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,                       // メール
    /セックス|エロ|アダルト|出会い系|稼げ|副業|投資で|儲か/i,        // 性的・スパム
  ];
  function ngReason(text) {
    for (const re of NG_PATTERNS) if (re.test(text)) return true;
    return false;
  }

  /* ---- 小さなユーティリティ ---- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;     // textContent = XSS安全
    return n;
  }
  function timeAgo(iso) {
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'たった今';
    const m = Math.floor(s / 60); if (m < 60) return m + '分前';
    const h = Math.floor(m / 60); if (h < 24) return h + '時間前';
    const d = Math.floor(h / 24); if (d < 30) return d + '日前';
    const mo = Math.floor(d / 30); if (mo < 12) return mo + 'ヶ月前';
    return Math.floor(mo / 12) + '年前';
  }
  function getSet(key) { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (_) { return new Set(); } }
  function addToSet(key, id) { const s = getSet(key); s.add(id); try { localStorage.setItem(key, JSON.stringify([...s].slice(-500))); } catch (_) {} }

  /* ---- スタイル注入（cabin の世界観を継承）---- */
  function injectCSS() {
    if (document.getElementById('cabin-notes-css')) return;
    const css = `
#cn-overlay{position:fixed;inset:0;z-index:90;display:none;flex-direction:column;
  background:radial-gradient(ellipse 80% 60% at 50% 0%, rgba(168,88,32,.16), transparent 60%), rgba(6,5,9,.92);
  backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  font-family:"Shippori Mincho",serif;color:var(--ash,#c9beaa)}
#cn-overlay.on{display:flex;animation:cnFade .5s ease}
@keyframes cnFade{from{opacity:0}to{opacity:1}}
#cn-panel{margin:auto;width:min(680px,94vw);max-height:92vh;display:flex;flex-direction:column;
  background:linear-gradient(180deg, rgba(20,12,9,.96), rgba(12,8,8,.97));
  border:1px solid rgba(240,200,120,.2);border-radius:14px;overflow:hidden;
  box-shadow:0 24px 80px rgba(0,0,0,.7)}
#cn-head{padding:26px 28px 20px;border-bottom:1px solid rgba(201,190,170,.12);position:relative;
  background:radial-gradient(ellipse 70% 90% at 50% 0%, rgba(168,88,32,.16), transparent 70%)}
#cn-head .cn-eye{font-family:"Cormorant Garamond",serif;font-style:italic;font-size:13px;letter-spacing:.26em;
  text-transform:uppercase;color:var(--lantern,#f0c878);margin-bottom:10px}
#cn-head h2{font-weight:700;font-size:clamp(20px,3.4vw,28px);color:var(--paper,#ece2c8);letter-spacing:.05em;margin:0 0 10px}
#cn-head p{font-size:13.5px;line-height:1.85;color:var(--ash,#c9beaa);margin:0}
#cn-close{position:absolute;top:18px;right:18px;width:38px;height:38px;border-radius:50%;cursor:pointer;
  background:rgba(10,7,9,.5);border:1px solid rgba(240,200,120,.22);color:var(--ash,#c9beaa);font-size:18px;line-height:1;
  display:flex;align-items:center;justify-content:center;transition:all .25s}
#cn-close:hover{color:var(--lantern-soft,#f8e0a0);border-color:rgba(240,200,120,.5)}
#cn-crisis{margin-top:14px;font-size:12px;line-height:1.7;color:var(--ash-dim,#897b65);
  padding:10px 14px;border:1px solid rgba(240,200,120,.14);border-radius:8px;background:rgba(168,88,32,.06)}
#cn-crisis b{color:var(--lantern-soft,#f8e0a0);font-weight:700}
#cn-crisis a{color:var(--lantern,#f0c878)}
#cn-body{padding:20px 24px;overflow-y:auto;flex:1}
/* compose */
#cn-form{background:rgba(26,15,10,.5);border:1px solid rgba(201,190,170,.12);border-radius:10px;padding:16px 16px 14px;margin-bottom:22px}
#cn-cat{display:flex;gap:8px;margin-bottom:12px}
.cn-catbtn{flex:1;padding:10px;border-radius:8px;cursor:pointer;font-family:"Shippori Mincho",serif;font-size:14px;
  background:transparent;border:1px solid rgba(201,190,170,.22);color:var(--ash,#c9beaa);transition:all .2s}
.cn-catbtn.on{border-color:var(--lantern,#f0c878);color:var(--lantern,#f0c878);background:rgba(240,200,120,.1)}
#cn-text{width:100%;min-height:84px;resize:vertical;padding:12px 14px;border-radius:8px;
  background:rgba(8,6,8,.6);border:1px solid rgba(201,190,170,.2);color:var(--paper,#ece2c8);
  font-family:"Shippori Mincho",serif;font-size:15px;line-height:1.8;outline:none}
#cn-text:focus{border-color:rgba(240,200,120,.45)}
#cn-row2{display:flex;gap:10px;align-items:center;margin-top:10px}
#cn-name{flex:1;padding:9px 12px;border-radius:8px;background:rgba(8,6,8,.6);border:1px solid rgba(201,190,170,.2);
  color:var(--paper,#ece2c8);font-family:"Shippori Mincho",serif;font-size:13px;outline:none}
#cn-name:focus{border-color:rgba(240,200,120,.45)}
#cn-send{padding:10px 22px;border-radius:999px;cursor:pointer;border:none;white-space:nowrap;
  font-family:"Cormorant Garamond",serif;font-style:italic;font-size:15px;font-weight:600;letter-spacing:.04em;
  background:linear-gradient(180deg,var(--ember-warm,#d97a32),var(--ember,#a85820));color:#0a0608;
  box-shadow:0 0 22px rgba(217,122,50,.3);transition:transform .15s,box-shadow .3s,opacity .3s}
#cn-send:hover{transform:translateY(-1px);box-shadow:0 0 34px rgba(217,122,50,.5)}
#cn-send:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none}
#cn-meta{display:flex;justify-content:space-between;align-items:center;margin-top:8px}
#cn-count{font-size:11px;color:var(--ash-dim,#897b65);font-family:"Inter",sans-serif}
#cn-msg{font-size:12.5px;min-height:16px;margin-top:6px;color:var(--lantern-soft,#f8e0a0)}
#cn-msg.err{color:#e0a07a}
/* filter tabs */
#cn-tabs{display:flex;gap:8px;margin-bottom:16px}
.cn-tab{padding:7px 16px;border-radius:999px;cursor:pointer;font-size:13px;font-family:"Shippori Mincho",serif;
  background:transparent;border:1px solid rgba(201,190,170,.2);color:var(--ash-dim,#897b65);transition:all .2s}
.cn-tab.on{border-color:var(--lantern,#f0c878);color:var(--lantern,#f0c878);background:rgba(240,200,120,.08)}
/* note cards */
#cn-list{display:flex;flex-direction:column;gap:14px}
.cn-note{padding:18px 20px;border-radius:10px;background:rgba(26,15,10,.42);border:1px solid rgba(201,190,170,.1);
  animation:cnRise .5s ease}
@keyframes cnRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.cn-note .cn-tag{display:inline-block;font-size:11px;letter-spacing:.1em;padding:3px 10px;border-radius:999px;margin-bottom:10px;
  font-family:"Inter",sans-serif}
.cn-note .cn-tag.worry{color:#e6c79a;background:rgba(168,88,32,.16);border:1px solid rgba(217,122,50,.3)}
.cn-note .cn-tag.light{color:#bfe0b0;background:rgba(80,140,70,.14);border:1px solid rgba(120,180,110,.3)}
.cn-note .cn-text{font-size:15px;line-height:1.95;color:var(--paper,#ece2c8);white-space:pre-wrap;word-break:break-word}
.cn-note .cn-foot{display:flex;align-items:center;gap:16px;margin-top:14px;font-size:12px;color:var(--ash-dim,#897b65);font-family:"Inter",sans-serif}
.cn-note .cn-name{color:var(--ash,#c9beaa)}
.cn-note .cn-foot .sp{flex:1}
.cn-heart,.cn-report{cursor:pointer;background:transparent;border:none;color:var(--ash-dim,#897b65);font-family:"Inter",sans-serif;
  font-size:12px;display:inline-flex;align-items:center;gap:5px;transition:color .2s;padding:2px}
.cn-heart:hover{color:var(--lantern,#f0c878)}
.cn-heart.on{color:var(--ember-warm,#d97a32)}
.cn-report:hover{color:#e0a07a}
.cn-empty,.cn-loading{text-align:center;padding:40px 10px;color:var(--ash-dim,#897b65);font-size:14px;line-height:1.9}
@media (max-width:560px){
  #cn-row2{flex-wrap:wrap}#cn-name{flex-basis:100%}
  #cn-head{padding:22px 20px 16px}#cn-body{padding:16px 16px}
}`;
    const s = el('style'); s.id = 'cabin-notes-css'; s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---- パネル構築 ---- */
  let built = false, state = { filter: 'all', cat: 'worry', notes: [] };

  function build() {
    if (built) return; built = true;
    injectCSS();
    const ov = el('div'); ov.id = 'cn-overlay';
    const panel = el('div'); panel.id = 'cn-panel';

    // head
    const head = el('div'); head.id = 'cn-head';
    head.appendChild(Object.assign(el('div', 'cn-eye'), { textContent: 'Letters by the Fire' }));
    head.appendChild(el('h2', null, '灯火の文箱'));
    head.appendChild(el('p', null, 'ここは、名前のいらない場所。今かかえている悩みも、乗り越えた言葉も、そっと置いていけます。だれかの手紙が、あなたの灯になりますように。'));
    const close = el('div'); close.id = 'cn-close'; close.textContent = '×'; close.title = '閉じる';
    close.addEventListener('click', api.close);
    head.appendChild(close);
    panel.appendChild(head);

    // body
    const body = el('div'); body.id = 'cn-body';

    // form
    const form = el('div'); form.id = 'cn-form';
    const cat = el('div'); cat.id = 'cn-cat';
    const cw = el('button', 'cn-catbtn on', '🕯 悩みを置いていく'); cw.dataset.cat = 'worry';
    const cl = el('button', 'cn-catbtn', '🌱 乗り越えた言葉'); cl.dataset.cat = 'light';
    [cw, cl].forEach(b => b.addEventListener('click', () => {
      state.cat = b.dataset.cat; cw.classList.toggle('on', state.cat === 'worry'); cl.classList.toggle('on', state.cat === 'light');
    }));
    cat.appendChild(cw); cat.appendChild(cl); form.appendChild(cat);

    const ta = el('textarea'); ta.id = 'cn-text'; ta.maxLength = MAX_BODY;
    ta.placeholder = READY ? 'ここに、いまの気持ちを…（500字まで・匿名でOK）' : '準備中です（管理者がもうすぐ開けます）';
    if (!READY) ta.disabled = true;
    form.appendChild(ta);

    const row2 = el('div'); row2.id = 'cn-row2';
    const name = el('input'); name.id = 'cn-name'; name.type = 'text'; name.maxLength = MAX_NAME;
    name.placeholder = 'なまえ（任意・未記入なら「ななしの旅人」）'; if (!READY) name.disabled = true;
    const send = el('button'); send.id = 'cn-send'; send.textContent = '灯をともす'; if (!READY) send.disabled = true;
    send.addEventListener('click', submit);
    row2.appendChild(name); row2.appendChild(send); form.appendChild(row2);

    const meta = el('div'); meta.id = 'cn-meta';
    const cnt = el('span'); cnt.id = 'cn-count'; cnt.textContent = '0 / ' + MAX_BODY;
    ta.addEventListener('input', () => { cnt.textContent = ta.value.length + ' / ' + MAX_BODY; });
    meta.appendChild(cnt); form.appendChild(meta);
    const msg = el('div'); msg.id = 'cn-msg'; form.appendChild(msg);
    body.appendChild(form);

    // tabs
    const tabs = el('div'); tabs.id = 'cn-tabs';
    [['all', 'すべて'], ['worry', '🕯 悩み'], ['light', '🌱 励まし']].forEach(([k, label]) => {
      const t = el('button', 'cn-tab' + (k === 'all' ? ' on' : ''), label); t.dataset.k = k;
      t.addEventListener('click', () => { state.filter = k; tabs.querySelectorAll('.cn-tab').forEach(x => x.classList.toggle('on', x.dataset.k === k)); render(); });
      tabs.appendChild(t);
    });
    body.appendChild(tabs);

    const list = el('div'); list.id = 'cn-list'; body.appendChild(list);
    panel.appendChild(body);
    ov.appendChild(panel);
    ov.addEventListener('click', (e) => { if (e.target === ov) api.close(); });
    document.body.appendChild(ov);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ov.classList.contains('on')) api.close(); });
  }

  function setMsg(text, isErr) { const m = $('#cn-msg'); if (m) { m.textContent = text || ''; m.classList.toggle('err', !!isErr); } }

  /* ---- 描画 ---- */
  function render() {
    const list = $('#cn-list'); if (!list) return;
    list.innerHTML = '';
    const items = state.notes.filter(n => state.filter === 'all' || n.category === state.filter);
    if (!items.length) {
      const e = el('div', 'cn-empty');
      e.textContent = READY ? 'まだ手紙はありません。最初のひとことを、置いていきませんか。' : '準備中です。管理者が設定を終えると、ここに手紙が並びます。';
      list.appendChild(e); return;
    }
    const hearted = getSet(LS_HEARTED), reported = getSet(LS_REPORTED);
    items.forEach(n => {
      const card = el('div', 'cn-note');
      const tag = el('span', 'cn-tag ' + (n.category === 'light' ? 'light' : 'worry'),
        n.category === 'light' ? '🌱 乗り越えた言葉' : '🕯 悩み');
      card.appendChild(tag);
      card.appendChild(el('div', 'cn-text', n.body));
      const foot = el('div', 'cn-foot');
      foot.appendChild(el('span', 'cn-name', (n.name && n.name.trim()) ? n.name.trim() : 'ななしの旅人'));
      foot.appendChild(el('span', null, '·'));
      foot.appendChild(el('span', null, timeAgo(n.created_at)));
      foot.appendChild(el('span', 'sp'));
      const heart = el('button', 'cn-heart' + (hearted.has(n.id) ? ' on' : ''));
      heart.innerHTML = '<span>♥</span><span class="cn-hc">' + (n.hearts || 0) + '</span>';
      heart.title = '灯をともす';
      heart.addEventListener('click', () => doHeart(n, heart));
      foot.appendChild(heart);
      const rep = el('button', 'cn-report'); rep.textContent = reported.has(n.id) ? '通報済' : '通報';
      rep.title = '不適切な内容を通報';
      if (reported.has(n.id)) rep.disabled = true;
      rep.addEventListener('click', () => doReport(n, rep));
      foot.appendChild(rep);
      card.appendChild(foot);
      list.appendChild(card);
    });
  }

  /* ---- 通信 ---- */
  async function load() {
    if (!READY) { render(); return; }
    const list = $('#cn-list');
    if (list) { list.innerHTML = ''; list.appendChild(Object.assign(el('div', 'cn-loading'), { textContent: '手紙を読み込んでいます…' })); }
    try {
      const res = await fetch(REST + '/cabin_notes?select=*&order=created_at.desc&limit=120', { headers: HEADERS });
      if (!res.ok) throw new Error('http ' + res.status);
      state.notes = await res.json();
      render();
    } catch (e) {
      if (list) { list.innerHTML = ''; list.appendChild(Object.assign(el('div', 'cn-empty'), { textContent: '読み込みに失敗しました。少し時間をおいて、もう一度ひらいてみてください。' })); }
    }
  }

  async function submit() {
    if (!READY) return;
    const ta = $('#cn-text'), nameEl = $('#cn-name'), send = $('#cn-send');
    const bodyText = (ta.value || '').trim();
    const nameText = (nameEl.value || '').trim().slice(0, MAX_NAME);
    if (!bodyText) { setMsg('ひとことだけでも、書いてみてください。', true); return; }
    if (bodyText.length > MAX_BODY) { setMsg('500字まででお願いします。', true); return; }
    const last = parseInt(localStorage.getItem(LS_LAST) || '0', 10);
    if (Date.now() - last < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      setMsg('続けて投稿はできません。あと約' + wait + '秒お待ちください。', true); return;
    }
    if (ngReason(bodyText) || (nameText && ngReason(nameText))) {
      setMsg('この場は、だれかを傷つけない言葉のための場所です。連絡先や宣伝、攻撃的な表現は控えてください。', true); return;
    }
    send.disabled = true; setMsg('そっと、火にくべています…');
    try {
      const res = await fetch(REST + '/cabin_notes', {
        method: 'POST',
        headers: Object.assign({}, HEADERS, { 'Prefer': 'return=representation' }),
        body: JSON.stringify({ category: state.cat, name: nameText || null, body: bodyText }),
      });
      if (!res.ok) throw new Error('http ' + res.status);
      const rows = await res.json();
      if (rows && rows[0]) state.notes.unshift(rows[0]);
      localStorage.setItem(LS_LAST, String(Date.now()));
      ta.value = ''; $('#cn-count').textContent = '0 / ' + MAX_BODY;
      state.filter = 'all'; $('#cn-tabs').querySelectorAll('.cn-tab').forEach(x => x.classList.toggle('on', x.dataset.k === 'all'));
      render();
      if (state.cat === 'worry') {
        setMsg('置いていってくれて、ありがとう。あなたの声は、ちゃんとここに灯っています。');
      } else {
        setMsg('あたたかい言葉を、ありがとう。だれかの灯になります。');
      }
    } catch (e) {
      setMsg('うまく送れませんでした。時間をおいて、もう一度試してみてください。', true);
    } finally {
      send.disabled = false;
    }
  }

  async function doHeart(n, btn) {
    if (!READY) return;
    if (getSet(LS_HEARTED).has(n.id)) return;
    n.hearts = (n.hearts || 0) + 1; addToSet(LS_HEARTED, n.id);
    btn.classList.add('on'); const c = btn.querySelector('.cn-hc'); if (c) c.textContent = n.hearts;
    try { await fetch(REST + '/rpc/cabin_add_heart', { method: 'POST', headers: HEADERS, body: JSON.stringify({ note_id: n.id }) }); }
    catch (_) {}
  }

  async function doReport(n, btn) {
    if (!READY) return;
    if (getSet(LS_REPORTED).has(n.id)) return;
    if (!window.confirm('この手紙を通報しますか？\n（複数の通報が集まると自動的に非表示になります）')) return;
    addToSet(LS_REPORTED, n.id); btn.textContent = '通報済'; btn.disabled = true;
    try { await fetch(REST + '/rpc/cabin_report_note', { method: 'POST', headers: HEADERS, body: JSON.stringify({ note_id: n.id }) }); }
    catch (_) {}
  }

  /* ---- 公開API ---- */
  const api = {
    open() {
      build();
      const ov = $('#cn-overlay'); if (!ov) return;
      ov.classList.add('on');
      try { if (window.CabinRoom && window.CabinRoom.setCapOpen) window.CabinRoom.setCapOpen(true); } catch (_) {}
      load();
    },
    close() {
      const ov = $('#cn-overlay'); if (!ov) return;
      ov.classList.remove('on');
      try { if (window.CabinRoom && window.CabinRoom.setCapOpen) window.CabinRoom.setCapOpen(false); } catch (_) {}
    },
  };
  window.CabinNotes = api;
})();
