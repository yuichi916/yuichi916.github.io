// 一筆花火の OGP 画像（1200×630）を、実際のゲーム画面の連鎖の瞬間から書き出す。
// 使い方: python -m http.server 8765 を立ててから  FONT_DIR=<dir> node _dev/hitofude-og.mjs assets/og/hitofude-1200x630.jpg
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
// フォント: Google Fonts の css2 に text= で必要な字だけを頼み、hog-font.css / hog-font-N.woff2 / hog-font-urls.txt として FONT_DIR に置く
// （ヘッドレスのブラウザは外に出られないことがあるので、手元のファイルを返す）
const D = (process.env.FONT_DIR || '.').replace(/\/?$/, '/');
const urls = readFileSync(D + 'hog-font-urls.txt', 'utf8').trim().split('\n');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ja-JP' });
await ctx.addInitScript(() => { window.goatcounter = { count: () => {} }; try { localStorage.setItem('hitofude.v1', JSON.stringify({ tutored: true, muted: true })); } catch (e) {} });
const p = await ctx.newPage();
await p.route(/goatcounter\.com|gc\.zgo\.at/, (r) => r.fulfill({ status: 404, body: '' }));
await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: readFileSync(D + 'hog-font.css', 'utf8') }));
await p.route('https://fonts.gstatic.com/**', (r) => { const i = urls.indexOf(r.request().url()); r.fulfill({ status: 200, contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(D + `hog-font-${Math.max(0, i) + 1}.woff2`) }); });
await p.goto('http://127.0.0.1:8765/hitofude.html'); await p.waitForTimeout(600);
await p.evaluate(() => window.HITO.startFree());
await p.waitForFunction(() => window.HITO.S.phase === 'draw');
// 夜を 5 夜目相当（玉が多い）にして、中央の群れを横切る線を置く
await p.evaluate(() => {
  const { S, K } = window.HITO;
  S.st = K.newRound({ seed: 20260926, night: 5, charms: ['tairin', 'senrin'], moon: 4 });
  const alive = S.st.shells.slice().sort((a, b) => a.x - b.x);
  let cur = alive[0]; const pts = [{ x: cur.x - 8, y: cur.y }]; const seen = new Set([cur.id]); let used = 8;
  while (true) {
    const c = alive.filter((s) => !seen.has(s.id)).map((s) => ({ s, d: Math.hypot(s.x - cur.x, s.y - cur.y) })).sort((a, b) => a.d - b.d)[0];
    if (!c || used + c.d > S.st.ink * 0.9) break; used += c.d; seen.add(c.s.id); cur = c.s; pts.push({ x: cur.x, y: cur.y });
  }
  window.HITO.commitStroke(pts);
});
await p.addStyleTag({ content: '#hud,#chips,#homeBtn,#topBtns,#chain,#callout,#banner,#hint,#ink{display:none!important}' });
await p.waitForFunction(() => window.HITO.S.st.pops >= 13, null, { timeout: 20000 });
await p.waitForTimeout(250);
await p.evaluate(async () => {
  // マスコットのヒノコを、題字の右に大きく
  const { drawHinoko } = await import('/assets/hitofude/hinoko.js');
  const hc = document.createElement('canvas'); hc.width = hc.height = 150;
  hc.style.cssText = 'position:fixed;left:398px;top:62px;width:150px;height:150px;z-index:99';
  drawHinoko(hc.getContext('2d'), 75, 98, 30, { face: 'joy', t: 0.4 });
  document.body.appendChild(hc);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:48px;top:118px;white-space:nowrap;z-index:99;font-family:"Shippori Mincho",serif;color:#fff';
  d.innerHTML = '<div style="font-size:86px;font-weight:800;letter-spacing:.04em;line-height:1;text-shadow:0 0 30px rgba(255,190,100,.6)">一筆花火</div>'
    + '<div style="margin-top:18px;font-size:30px;font-weight:600;color:#ffd75a">線を1本。夜空が全部ひらく</div>'
    + '<div style="margin-top:34px;font-size:22px;line-height:1.75;color:#e9e1cc;font-weight:600">指で引いた線が導火線になる<br>連鎖で点×倍率<br>今夜の月でルールが変わる</div>';
  document.body.appendChild(d);
  const u = document.createElement('div');
  u.style.cssText = 'position:fixed;left:50px;bottom:28px;z-index:99;font:600 20px ui-monospace,monospace;color:#ffd75a';
  u.textContent = 'yuichi916.github.io/hitofude.html'; document.body.appendChild(u);
});
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(120);
await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 88 });
await b.close();
