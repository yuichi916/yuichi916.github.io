// 一筆花火の絵（アイコン）。絵文字は OS ごとに見た目が変わるので、画面に出す絵はここで描く
// 24×24 の線画。1 つの絵は部品の列で、部品は { d: SVG のパス, f: 塗り, s: 線, w: 線の太さ }
// f / s が 'cur' なら文字の色（currentColor）、null なら無し。s を省くと 'cur'
// 同じ絵を DOM（SVG）とキャンバス（Path2D）の両方で描ける
const C = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
const STAR4 = (cx, cy, r) => `M${cx} ${cy - r}c${r * 0.1} ${r * 0.62} ${r * 0.38} ${r * 0.9} ${r} ${r}c${-r * 0.62} ${r * 0.1} ${-r * 0.9} ${r * 0.38} ${-r} ${r}c${-r * 0.1} ${-r * 0.62} ${-r * 0.38} ${-r * 0.9} ${-r} ${-r}c${r * 0.62} ${-r * 0.1} ${r * 0.9} ${-r * 0.38} ${r} ${-r}z`;

export const ICONS = {
  // 画面の隅のボタン
  menu: [{ d: 'M5 7h14M5 12h14M5 17h14' }],
  fast: [{ d: 'M4.5 6.5l6.5 5.5-6.5 5.5zM12.5 6.5l6.5 5.5-6.5 5.5z', f: 'cur', w: 1.4 }],
  music: [{ d: 'M9 17.5V6.5l10-2.5v11' }, { d: `${C(6.4, 17.5, 2.6)}${C(16.4, 15, 2.6)}`, f: 'cur', w: 1.2 }],
  sound: [{ d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z', f: 'cur', w: 1.4 }, { d: 'M15.5 9a4.2 4.2 0 0 1 0 6M18.3 6.3a8 8 0 0 1 0 11.4' }],
  mute: [{ d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z', f: 'cur', w: 1.4 }, { d: 'M15.5 9.5l5 5M20.5 9.5l-5 5' }],
  form: [
    { d: 'M4.5 3h5A1.5 1.5 0 0 1 11 4.5v8A1.5 1.5 0 0 1 9.5 14h-5A1.5 1.5 0 0 1 3 12.5v-8A1.5 1.5 0 0 1 4.5 3z' },
    { d: 'M13.5 14h6a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5z' },
    { d: 'M14 4.5a6 6 0 0 1 5.5 5.5M19.5 10l-2.4-1.2M19.5 10l1.1-2.4', w: 1.6 },
  ],
  play: [{ d: 'M8 5.5v13l10.5-6.5z', f: 'cur', w: 1.2 }],
  // ボタンの頭
  swords: [
    { d: 'M3.5 3.5l11.7 10.1-1.6 1.6zM20.5 3.5L8.8 13.6l1.6 1.6z', f: 'cur', w: 1.1 },
    { d: 'M12.2 17.8l5.6-5.6M6.2 12.2l5.6 5.6', w: 2.1 },
    { d: 'M16.3 16.3l3 3M7.7 16.3l-3 3', w: 2.7 },
    { d: `${C(20, 20, 1.4)}${C(4, 20, 1.4)}`, f: 'cur', w: 0.8 },
  ],
  replay: [{ d: 'M5 12a7 7 0 1 0 2.1-5' }, { d: 'M4.5 4v4h4' }, { d: 'M10.5 9.3v5.4l4.5-2.7z', f: 'cur', w: 1.1 }],
  brush: [
    { d: 'M20 3.5c-3.6 1.3-7.8 5.3-9.8 8.9l1.9 1.9c3.6-2 7.6-6.2 8.9-9.8z', f: 'cur', w: 1.2 },
    { d: 'M9.3 13.6c-2.4.1-3.6 1.6-3.8 3.4-.1 1.2-.9 2.1-2.2 2.4 2.9 1.3 7.2.6 7.9-3.5z', f: 'cur', w: 1.2 },
  ],
  book: [{ d: 'M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13' }],
  bomb: [
    { d: C(10.5, 14.5, 6.5), f: '#2b2440', s: 'cur', w: 1.6 },
    { d: 'M7.4 12.4a3.8 3.8 0 0 1 2.6-2.2', s: 'rgba(255,255,255,.55)', w: 1.4 },
    { d: 'M15 10l2-2c.9-.9 2.1-.8 2.8.1', w: 1.6 },
    { d: STAR4(20.3, 5.3, 2.2), f: '#ffd75a', s: null },
  ],
  eye: [{ d: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z' }, { d: C(12, 12, 3), f: 'cur', w: 1 }],
  flame: [
    { d: 'M12 21.5c-3.9 0-6.5-2.7-6.5-6.2 0-3.3 2.4-5.2 3.7-7.6.4 1.7 1.3 2.9 2.4 3.5.2-3.4 1.7-6.3 4.1-7.7-.4 3 1.1 4.9 2.3 6.6 1 1.4 1.5 3 1.5 5 0 3.6-3.1 6.4-7.5 6.4z', f: '#ff8a3d', s: '#ffb347', w: 1.2 },
    { d: 'M12 20.8c-1.9 0-3.1-1.3-3.1-3 0-1.9 1.5-2.8 2.3-4.6.9 1.5 1.3 1.6 2 2.7.6-.8.9-1.4 1-2.3 1 1.2 1.3 2.6 1.3 3.6 0 2.1-1.6 3.6-3.5 3.6z', f: '#ffe07a', s: null },
  ],
  stroke: [
    { d: 'M3.5 18c2.6-5.2 5.2-7.4 8.2-4.3s5.4 1.2 8.1-5.4', w: 2.4 },
    { d: C(3.5, 18, 1.9), f: 'cur', w: 1 },
    { d: STAR4(20.2, 7, 2.8), f: '#fff1c1', s: null },
  ],
  firework: [
    { d: 'M12 2.5v3.8M12 17.7v3.8M2.5 12h3.8M17.7 12h3.8M5.3 5.3l2.7 2.7M16 16l2.7 2.7M5.3 18.7L8 16M16 8l2.7-2.7', w: 1.9 },
    { d: C(12, 12, 2.3), f: 'cur', w: 1 },
  ],
  sparkle: [{ d: STAR4(12, 12, 9), f: 'cur', w: 1 }],
  lantern: [
    { d: 'M8.5 4.5h7M8.5 19.5h7', s: '#3a2216', w: 2.2 },
    { d: 'M12 5.5c4 0 6 2.9 6 6.5s-2 6.5-6 6.5-6-2.9-6-6.5 2-6.5 6-6.5z', f: '#e0553a', s: '#ffb38a', w: 1.1 },
    { d: 'M6.6 10h10.8M6.6 14h10.8', s: 'rgba(90,20,10,.55)', w: 0.9 },
    { d: 'M12 2.5v2', s: '#3a2216', w: 1.4 },
  ],
  star: [{ d: 'M12 2.6l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z', f: 'cur', w: 1.2 }],
  boom: [
    { d: 'M12 2.5l1.9 5.2 5-2.4-2.2 5.1 5.3 1.7-5.3 1.9 2.5 5-5.1-2.2L12 21.5l-2-5.2-5.1 2.3 2.4-5.1-5.3-1.8 5.3-1.8-2.3-5 5 2.2z', f: '#ff7a45', s: '#ffd27a', w: 1.2 },
    { d: 'M12 8.5l1 2.4 2.5-.6-1.4 2.2 2 1.5-2.6.3.3 2.6-1.8-1.9-1.8 1.9.2-2.6-2.5-.4 2.1-1.4-1.3-2.2 2.4.7z', f: '#ffe8a0', s: null },
  ],
  newmoon: [{ d: C(12, 12, 8), f: '#1c2040', s: 'rgba(255,255,255,.35)', w: 1.4 }],
  lock: [{ d: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3' }, { d: 'M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z', f: 'cur', w: 1.2 }],
  bulb: [
    { d: 'M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.4.9 1 .9 1.7v.3h5v-.3c0-.7.3-1.3.9-1.7A5.8 5.8 0 0 0 12 3.5z', f: 'rgba(255,215,90,.28)' },
    { d: 'M9.5 18.5h5M10.5 21h3' },
  ],
  warn: [{ d: 'M12 3.5L21.5 20h-19z', f: 'rgba(255,120,100,.22)', w: 1.7 }, { d: 'M12 9.5v5M12 17.2v.3', w: 2.2 }],
  cut: [{ d: `${C(6.5, 6.9, 2.6)}${C(6.5, 17.1, 2.6)}` }, { d: 'M8.7 8.4L20 17M8.7 15.6L20 7' }],
  dotMe: [{ d: C(12, 12, 6.5), f: '#ff6a3a', s: 'rgba(255,230,190,.8)', w: 1.2 }],
  dotRv: [{ d: C(12, 12, 6.5), f: '#3f86e0', s: 'rgba(200,230,255,.8)', w: 1.2 }],
  dotDraw: [{ d: C(12, 12, 6.5), f: '#c9cedd', s: 'rgba(255,255,255,.8)', w: 1.2 }],
  // お手本の指（人さし指を立てた手）
  hand: [
    { d: 'M8.5 14.5V4a1.5 1.5 0 0 1 3 0v6.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V16c0 3.4-2.5 6-5.9 6h-1.5c-2.1 0-3.5-.7-4.8-2.2l-3.2-3.9a1.5 1.5 0 0 1 2.2-2z', f: '#fffaf0', s: '#1b1a2e', w: 1.3 },
    { d: 'M14.5 11.5v2.2M17.5 12.5v1.8', s: '#1b1a2e', w: 1 },
  ],
  // 筆跡（線の形の占い）
  ty_nyuukon: [{ d: 'M8.5 17L15.5 7.5', w: 3.4 }, { d: C(7.7, 18.2, 1.7), f: 'cur', w: 1 }],
  ty_massugu: [{ d: 'M4.5 19.5L19 5M19 5h-6.5M19 5v6.5', w: 2.2 }],
  ty_wa: [{ d: 'M8 5.1A8 8 0 1 1 4.6 9', w: 2.2 }, { d: C(4.6, 9, 1.6), f: 'cur', w: 1 }],
  ty_uzumaki: [{ d: 'M12.6 12.2c.6-.9-.3-2-1.3-1.7-1.6.4-1.7 2.7-.4 3.5 1.9 1.2 4.4-.3 4.6-2.4.3-2.8-2.5-4.9-5.2-4.4-3.4.6-5.2 4.4-4.1 7.5 1.2 3.6 5.6 5.1 9 3.6 2.7-1.2 4.3-4 4.1-6.9', w: 2 }],
  ty_inazuma: [{ d: 'M4 4.5l7 5.5-4 3 9 5-3 2.5 7-1', w: 2.2 }],
  ty_nami: [{ d: 'M2.5 13c2-4 4.3-4 6.3 0s4.3 4 6.3 0 4.3-4 6.4 0', w: 2.2 }],
  ty_sanpo: [{ d: 'M3 19c2.2-3.8 5.2-1.2 6.2-4.6.9-3.1-2.4-4.9.3-7.5 2.2-2.1 5.4.3 5 2.9-.4 2.8 2.7 4.3 6.5 2.5', w: 2 }],
};

// 月の絵（今夜の月の形で、光っている所を描く）。phase: 0 新月 → 0.5 満月 → 1
export function moonIcon(phase) {
  const r = 8.5, k = Math.cos(2 * Math.PI * phase), rx = Math.abs(k) * r, top = 12 - r, bot = 12 + r;
  const lit = phase <= 0.5
    ? `M12 ${top}A${r} ${r} 0 0 1 12 ${bot}A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 12 ${top}z`
    : `M12 ${bot}A${r} ${r} 0 0 1 12 ${top}A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 12 ${bot}z`;
  return [
    { d: C(12, 12, r), f: '#2a2f55', s: 'rgba(255,241,193,.45)', w: 1 },
    { d: lit, f: '#fff1c1', s: null },
    { d: `${C(9.6, 10, 1.7)}${C(14.2, 14, 1.4)}${C(11, 15.6, 1)}`, f: 'rgba(200,180,120,.38)', s: null },
  ];
}

const NS = 'http://www.w3.org/2000/svg';
// DOM 用: <svg class="ic ..."> を作る（中身は上の決まった形だけで、外から来た文字は入らない）
export function svgIcon(name, cls = '') {
  const parts = Array.isArray(name) ? name : ICONS[name];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `ic${typeof name === 'string' ? ` ic-${name}` : ''}${cls ? ' ' + cls : ''}`);
  for (const p of parts || []) {
    const e = document.createElementNS(NS, 'path');
    e.setAttribute('d', p.d);
    const f = p.f === undefined ? null : p.f, s = p.s === undefined ? 'cur' : p.s;
    e.setAttribute('fill', f == null ? 'none' : f === 'cur' ? 'currentColor' : f);
    if (s) { e.setAttribute('stroke', s === 'cur' ? 'currentColor' : s); e.setAttribute('stroke-width', String(p.w || 1.9)); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); }
    svg.appendChild(e);
  }
  return svg;
}
// キャンバス用: (x, y) を中心に size の大きさで描く。color は 'cur' の色
const P2D = new Map();
export function drawIcon(g, name, x, y, size, color = '#ffd75a') {
  const parts = Array.isArray(name) ? name : ICONS[name];
  if (!parts) return;
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 24, size / 24);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const p of parts) {
    let path = P2D.get(p.d); if (!path) { path = new Path2D(p.d); P2D.set(p.d, path); }
    const f = p.f === undefined ? null : p.f, s = p.s === undefined ? 'cur' : p.s;
    if (f) { g.fillStyle = f === 'cur' ? color : f; g.fill(path); }
    if (s) { g.strokeStyle = s === 'cur' ? color : s; g.lineWidth = p.w || 1.9; g.stroke(path); }
  }
  g.restore();
}

// お守り（お守り袋に漢字ひと文字）。色と字は、お守りの id ごと
export const CHARM_ART = {
  nagafude: ['長', '#3d5a9e'], futofude: ['太', '#2f7a6b'], tairin: ['輪', '#b8436a'], kinun: ['金', '#a8781f'],
  senrin: ['千', '#6a4fb3'], orebi: ['折', '#40689e'], owaridama: ['終', '#3a3c58'], kodou: ['鼓', '#b0432a'],
  mankai: ['満', '#b98d25'], mashidama: ['増', '#c44d36'], nihitsu: ['二', '#3d8250'], nokoribi: ['残', '#c05a26'],
  chouchinshi: ['灯', '#b8352c'], amayoke: ['雨', '#357aa0'], kazekiri: ['風', '#3f8f8c'],
  nokorizumi: ['墨', '#2f3346'], osobi: ['遅', '#6d4a8f'], ichibanboshi: ['星', '#b07a1e'],
  maneki: ['招', '#c38a1c'], hanaikada: ['筏', '#c2557f'], renjishi: ['獅', '#a8302a'], suminagashi: ['流', '#35577a'], senkou: ['線', '#7d3c96'],
  // 伝説（大一番の妖怪に勝つと出る）: 金の袋に、妖怪の字
  tengu: ['天', '#c8901c'], tanuki: ['狸', '#c8901c'], kitsune: ['狐', '#c8901c'], kamaitachi: ['鎌', '#c8901c'],
};
// 伝説のお守りは、後ろに光の輪と、字の色を妖怪の色に
const LEGEND = { tengu: '#e0452c', tanuki: '#7a4a1c', kitsune: '#4b4fb8', kamaitachi: '#1f8f72' };
const MINCHO = '"Shippori Mincho","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif';
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return `rgb(${c.map((v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))).join(',')})`;
};
// (cx, cy) を中心に、高さ h のお守りを描く
export function drawOmamori(g, cx, cy, h, id) {
  const [kanji, col] = CHARM_ART[id] || ['守', '#8a3b3b'];
  const w = h * 0.6, top = cy - h / 2 + h * 0.16, bot = cy + h / 2 - h * 0.02, x0 = cx - w / 2, x1 = cx + w / 2, sh = w * 0.3, rr = h * 0.06;
  const body = () => {
    g.beginPath();
    g.moveTo(x0, top + sh);
    g.quadraticCurveTo(x0, top, cx - w * 0.22, top);
    g.lineTo(cx + w * 0.22, top);
    g.quadraticCurveTo(x1, top, x1, top + sh);
    g.lineTo(x1, bot - rr); g.quadraticCurveTo(x1, bot, x1 - rr, bot);
    g.lineTo(x0 + rr, bot); g.quadraticCurveTo(x0, bot, x0, bot - rr);
    g.closePath();
  };
  g.save();
  const legend = LEGEND[id];
  if (legend) {
    // 後光（細い光の筋）
    const halo = g.createRadialGradient(cx, cy, h * 0.1, cx, cy, h * 0.43);
    halo.addColorStop(0, 'rgba(255,230,140,.55)'); halo.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = halo; g.beginPath(); g.arc(cx, cy, h * 0.43, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,225,140,.5)'; g.lineWidth = Math.max(0.6, h * 0.015);
    g.beginPath();
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.moveTo(cx + Math.cos(a) * h * 0.33, cy + Math.sin(a) * h * 0.33); g.lineTo(cx + Math.cos(a) * h * 0.42, cy + Math.sin(a) * h * 0.42); }
    g.stroke();
  }
  // 影と布
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = h * 0.08; g.shadowOffsetY = h * 0.03;
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, shade(col, 0.25)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.35));
  body(); g.fillStyle = gr; g.fill();
  g.shadowColor = 'transparent';
  // 織り柄（細かい菱）
  g.save(); body(); g.clip();
  g.strokeStyle = 'rgba(255,230,170,.13)'; g.lineWidth = Math.max(0.6, h * 0.012);
  const step = h * 0.09;
  g.beginPath();
  for (let i = -8; i < 16; i++) { g.moveTo(x0 + i * step, top); g.lineTo(x0 + i * step + h, top + h); g.moveTo(x0 + i * step, top); g.lineTo(x0 + i * step - h, top + h); }
  g.stroke();
  // 上の光
  const hl = g.createLinearGradient(x0, 0, x1, 0);
  hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(0.3, 'rgba(255,255,255,.14)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.fillRect(x0, top, w, bot - top);
  g.restore();
  // 金の縁取り（内側）
  const inset = h * 0.055;
  g.strokeStyle = 'rgba(240,200,110,.9)'; g.lineWidth = Math.max(0.8, h * 0.022);
  g.beginPath();
  g.moveTo(x0 + inset, top + sh + inset * 0.3);
  g.quadraticCurveTo(x0 + inset, top + inset, cx - w * 0.2, top + inset);
  g.lineTo(cx + w * 0.2, top + inset);
  g.quadraticCurveTo(x1 - inset, top + inset, x1 - inset, top + sh + inset * 0.3);
  g.lineTo(x1 - inset, bot - inset); g.lineTo(x0 + inset, bot - inset); g.closePath();
  g.stroke();
  // 字（金、黒いふち）
  g.font = `800 ${h * 0.36}px ${MINCHO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = (top + sh * 0.5 + bot) / 2 + h * 0.02;
  g.lineWidth = Math.max(1, h * 0.04); g.strokeStyle = legend ? 'rgba(255,248,220,.85)' : 'rgba(30,14,6,.55)'; g.strokeText(kanji, cx, ty);
  g.fillStyle = legend || '#ffe6a0'; g.fillText(kanji, cx, ty);
  // 結び目とひも
  const ky = top - h * 0.015, kr = h * 0.055;
  g.strokeStyle = '#f3e3b8'; g.lineWidth = Math.max(1, h * 0.03); g.lineCap = 'round';
  g.beginPath(); g.ellipse(cx, top - h * 0.1, w * 0.13, h * 0.075, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8c46a';
  g.beginPath(); g.ellipse(cx - kr * 0.9, ky, kr, kr * 0.7, -0.4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + kr * 0.9, ky, kr, kr * 0.7, 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(cx, ky, kr * 0.55, 0, Math.PI * 2); g.fill();
  g.restore();
}
