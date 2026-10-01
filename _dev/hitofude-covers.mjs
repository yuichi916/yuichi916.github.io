// 一筆花火のゲームサイト用の表紙（CrazyGames: 横 1920×1080・縦 800×1200・正方形 800×800）を、実際のゲーム画面の夜景と花火から書き出す。
// 表紙に入れる字は題名だけ（「NEW」「Play」などは入れない決まり）。3 枚で同じ絵柄にそろえる。
// 使い方: python -m http.server 8765 を立ててから  node _dev/hitofude-covers.mjs assets/covers
//   書体は Google Fonts から、題名の字だけを curl で取ってきて埋め込む（ヘッドレスのブラウザは外に出られないことがあるので）
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const OUT = (process.argv[2] || 'assets/covers').replace(/\/$/, '');
mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const get = (url, bin = false) => execFileSync('curl', ['-sS', '--max-time', '30', '-A', UA, url], { encoding: bin ? 'buffer' : 'utf8', maxBuffer: 64 << 20 });
function fontCss(specs) {
  let out = '';
  for (const { family, wght, text } of specs) {
    const q = `family=${encodeURIComponent(family).replace(/%20/g, '+')}${wght ? ':wght@' + wght : ''}&text=${encodeURIComponent(text)}&display=block`;
    out += get(`https://fonts.googleapis.com/css2?${q}`).replace(/url\((https:[^)]+)\)/g, (m, u) => `url(data:font/woff2;base64,${get(u, true).toString('base64')})`);
  }
  return out;
}
const FONTS = fontCss([{ family: 'Yuji Boku', text: '一筆花火' }, { family: 'Shippori Mincho', wght: '800', text: 'HITOFUDEANB ' }]);

// 絵の置き方（画面の幅・高さに対する割合）。fw: 花火 [x, y, 種類, 大きさ（画面の短い辺に対する半径）, 色, 芯の色]
// hino: ヒノコ [x, y, 大きさ]、stroke: 金の一筆（画素）、title: 題字、moon: 月（割合）
const LAYOUT = {
  landscape: {
    size: [1920, 1080],
    fw: [[0.58, 0.32, 'kin', 0.35, [255, 206, 110], [255, 250, 220]], [0.77, 0.24, 'kiku', 0.22, [255, 110, 170], [255, 220, 240]], [0.36, 0.14, 'botan', 0.16, [110, 205, 255], [230, 250, 255]],
      [0.93, 0.5, 'kiku', 0.17, [150, 255, 150], [240, 255, 230]], [0.12, 0.12, 'botan', 0.12, [255, 180, 90], [255, 240, 200]], [0.66, 0.08, 'senrin', 0.1, [200, 150, 255], [250, 235, 255]]],
    hino: [0.73, 0.62, 118], moon: [0.93, 0.13],
    stroke: 'M 150 842 C 420 770, 700 900, 980 800 S 1260 690, 1330 700',
    tip: [1330, 700], sw: 16,
    title: { x: 0.285, y: 0.44, size: 250, sub: 58, gap: 34 },
  },
  portrait: {
    size: [800, 1200],
    fw: [[0.5, 0.5, 'kin', 0.38, [255, 206, 110], [255, 250, 220]], [0.14, 0.38, 'kiku', 0.22, [255, 110, 170], [255, 220, 240]], [0.86, 0.42, 'botan', 0.2, [110, 205, 255], [230, 250, 255]],
      [0.26, 0.62, 'senrin', 0.12, [150, 255, 150], [240, 255, 230]], [0.8, 0.6, 'botan', 0.14, [200, 150, 255], [250, 235, 255]]],
    hino: [0.66, 0.735, 76], moon: [0.1, 0.05],
    stroke: 'M 60 960 C 200 900, 330 990, 470 910 S 560 870, 528 882',
    tip: [528, 882], sw: 10,
    title: { x: 0.5, y: 0.14, size: 150, sub: 36, gap: 20 },
  },
  square: {
    size: [800, 800],
    fw: [[0.74, 0.4, 'kin', 0.22, [255, 206, 110], [255, 250, 220]], [0.9, 0.12, 'kiku', 0.14, [255, 110, 170], [255, 220, 240]], [0.2, 0.46, 'botan', 0.12, [110, 205, 255], [230, 250, 255]],
      [0.1, 0.62, 'senrin', 0.08, [150, 255, 150], [240, 255, 230]], [0.46, 0.5, 'botan', 0.08, [200, 150, 255], [250, 235, 255]]],
    hino: [0.74, 0.66, 70], moon: [0.9, 0.34],
    stroke: 'M 40 690 C 170 640, 300 720, 430 650 S 560 560, 566 560',
    tip: [566, 560], sw: 10,
    title: { x: 0.34, y: 0.19, size: 116, sub: 28, gap: 14 },
  },
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [name, L] of Object.entries(LAYOUT)) {
  const [W, H] = L.size;
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'ja-JP' });
  await ctx.addInitScript(() => { window.goatcounter = { count: () => {} }; try { localStorage.setItem('hitofude.v1', JSON.stringify({ tutored: true, muted: true, bgmOff: true, runs: 1 })); } catch (e) {} });
  const p = await ctx.newPage();
  await p.route(/goatcounter\.com|gc\.zgo\.at|fonts\.googleapis\.com|fonts\.gstatic\.com/, (r) => r.fulfill({ status: 404, body: '' }));
  await p.goto('http://127.0.0.1:8765/hitofude.html');
  await p.waitForFunction(() => window.HITO && window.HITO.S.mode === 'title');
  await p.addStyleTag({ content: FONTS + '.ov,#hud,#topBtns,#homeBtn,#toast,#hint,#ink,#chips,#chain,#callout,#banner{display:none!important}' });
  await p.evaluate(() => document.fonts.ready);
  // 夜景だけにして（玉は消す）、月を置きなおし、見物客を沸かせる
  await p.evaluate((L) => {
    const H = window.HITO, { S, V } = H;
    document.querySelectorAll('.ov').forEach((o) => { o.hidden = true; });
    S.st = null; S.amb = null; S.mode = 'cover';
    H.F.moon = [(L.moon[0] * innerWidth - V.ox) / V.s, (L.moon[1] * innerHeight - V.oy) / V.s];
    H.drawBackground(); H.scenery.excite(1.5);
  }, L);
  await p.waitForTimeout(400);
  // 花火（表紙のために、筆で描くように 1 発ずつ描く）
  await p.evaluate((L) => {
    const W = innerWidth, H = innerHeight, S0 = Math.min(W, H);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:97;pointer-events:none';
    const g = c.getContext('2d');
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const rgba = (c3, a) => `rgba(${c3[0]},${c3[1]},${c3[2]},${a})`;
    g.globalCompositeOperation = 'lighter';
    for (const [u, v, kind, rr, col, core] of L.fw) {
      const x = u * W, y = v * H, R = rr * S0;
      const gl = g.createRadialGradient(x, y, 0, x, y, R * 1.25);
      gl.addColorStop(0, rgba(col, 0.32)); gl.addColorStop(0.5, rgba(col, 0.1)); gl.addColorStop(1, rgba(col, 0));
      g.fillStyle = gl; g.fillRect(x - R * 1.3, y - R * 1.3, R * 2.6, R * 2.6);
      const n = kind === 'senrin' ? 22 : kind === 'botan' ? 64 : 96;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.06, r2 = R * (0.82 + rnd() * 0.22), r1 = kind === 'botan' ? r2 * 0.86 : R * (0.12 + rnd() * 0.1);
        const sag = kind === 'kin' ? R * 0.34 : R * 0.1;
        const x1 = x + Math.cos(a) * r1, y1 = y + Math.sin(a) * r1, x2 = x + Math.cos(a) * r2, y2 = y + Math.sin(a) * r2 + sag * (r2 / R) ** 2;
        const mx = x + Math.cos(a) * (r1 + r2) / 2, my = y + Math.sin(a) * (r1 + r2) / 2 + sag * 0.2;
        const gr = g.createLinearGradient(x1, y1, x2, y2);
        gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(0.55, rgba(col, 0.5)); gr.addColorStop(1, rgba(core, 0.95));
        g.strokeStyle = gr; g.lineWidth = Math.max(1.2, R * 0.011); g.lineCap = 'round';
        g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
        g.fillStyle = rgba(core, 0.95); g.beginPath(); g.arc(x2, y2, Math.max(1.4, R * 0.014), 0, 7); g.fill();
        if (kind === 'kin') { g.fillStyle = rgba(col, 0.5); for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(x2 + (rnd() - 0.5) * 4, y2 + k * R * 0.05, Math.max(0.8, R * 0.008), 0, 7); g.fill(); } }
      }
      if (kind === 'senrin') for (let j = 0; j < 7; j++) {
        const a = j / 7 * Math.PI * 2, sx = x + Math.cos(a) * R * 1.1, sy = y + Math.sin(a) * R * 1.1, sr = R * 0.32;
        for (let i = 0; i < 14; i++) { const b2 = i / 14 * Math.PI * 2; g.fillStyle = rgba(core, 0.85); g.beginPath(); g.arc(sx + Math.cos(b2) * sr, sy + Math.sin(b2) * sr, Math.max(1.2, R * 0.02), 0, 7); g.fill(); }
      }
      // 芯の光
      const cg = g.createRadialGradient(x, y, 0, x, y, R * 0.2); cg.addColorStop(0, rgba(core, 0.55)); cg.addColorStop(1, rgba(core, 0));
      g.fillStyle = cg; g.beginPath(); g.arc(x, y, R * 0.2, 0, 7); g.fill();
    }
    document.body.appendChild(c);
  }, L);
  // ヒノコ・金の一筆・題字（字は題名だけ）
  await p.evaluate(async (L) => {
    const { drawHinoko } = await import('/assets/hitofude/hinoko.js');
    const W = innerWidth, H = innerHeight;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'position:fixed;left:0;top:0;z-index:98;pointer-events:none;overflow:visible';
    svg.innerHTML = `<defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="#ffb347" stop-opacity=".2"/><stop offset=".35" stop-color="#ffd779"/><stop offset="1" stop-color="#fff6d8"/></linearGradient>
      <radialGradient id="tip"><stop offset="0" stop-color="#fffdf0"/><stop offset=".35" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient></defs>
      <path d="${L.stroke}" fill="none" stroke="#ff9a3d" stroke-opacity=".25" stroke-width="${L.sw * 3}" stroke-linecap="round"/>
      <path d="${L.stroke}" fill="none" stroke="url(#sg)" stroke-width="${L.sw}" stroke-linecap="round" style="filter:drop-shadow(0 0 ${L.sw}px rgba(255,180,70,.95))"/>
      <path d="${L.stroke}" fill="none" stroke="#fffbe8" stroke-opacity=".85" stroke-width="${L.sw * 0.28}" stroke-linecap="round"/>
      <circle cx="${L.tip[0]}" cy="${L.tip[1]}" r="${L.sw * 3.2}" fill="url(#tip)"/>`;
    document.body.appendChild(svg);
    const [hx, hy, hr] = L.hino;
    const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
    hc.style.cssText = 'position:fixed;left:0;top:0;z-index:99;pointer-events:none';
    drawHinoko(hc.getContext('2d'), hx * W, hy * H, hr, { face: 'joy', t: 0.5, glow: true });
    document.body.appendChild(hc);
    const T = L.title, d = document.createElement('div');
    d.style.cssText = `position:fixed;left:${T.x * W}px;top:${T.y * H}px;transform:translate(-50%,-50%);z-index:100;text-align:center;white-space:nowrap;pointer-events:none`;
    d.innerHTML = `<div style="font-family:'Yuji Boku',serif;font-size:${T.size}px;line-height:1;color:#fff;letter-spacing:.02em;text-shadow:0 0 ${T.size * 0.16}px rgba(255,190,100,.85),0 0 ${T.size * 0.05}px rgba(255,230,180,.9),0 ${T.size * 0.03}px ${T.size * 0.08}px rgba(0,0,0,.8)">一筆花火</div>`
      + `<div style="margin-top:${T.gap}px;font-family:'Shippori Mincho',serif;font-weight:800;font-size:${T.sub}px;letter-spacing:.24em;color:#ffd75a;text-shadow:0 0 ${T.sub * 0.4}px rgba(255,170,60,.7),0 2px 8px rgba(0,0,0,.8)">HITOFUDE HANABI</div>`;
    document.body.appendChild(d);
  }, L);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(60);
  const file = `${OUT}/hitofude-${W}x${H}.jpg`;
  await p.screenshot({ path: file, type: 'jpeg', quality: 90 });
  console.log('wrote', file);
  await ctx.close();
}
await b.close();
