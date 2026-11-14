// 一筆花火 2 — 手続きで描く絵（玉の地図・煙の地図・仮の町の帯）
import { drawHinoko } from '../assets/hitofude/hinoko.js';
export const SHELL_ORDER = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'koori', 'oni', 'shaku', 'nezumi', 'roket', 'oyako', 'ko', 'meoto', 'bake', 'kingyo', 'nige', 'tome', 'juzu1', 'juzu2', 'juzu3', 'juzu4', 'juzu5', 'juzu6'];
export const HINOKO_CELL = SHELL_ORDER.length, CROW_CELL = SHELL_ORDER.length + 2, HUB_CELL = SHELL_ORDER.length + 3;
export const ATLAS_CELLS = SHELL_ORDER.length + 4;
export const cellOf = (s) => SHELL_ORDER.indexOf(s.type === 'juzu' ? 'juzu' + (s.num || 1) : s.type);
const LOOK = {
  kiku: { a: '#ff5d8a', b: '#7a1138', band: '#ffd9e4' },
  ootama: { a: '#58a9ff', b: '#123a84', band: '#d9ecff' },
  kin: { a: '#ffd25e', b: '#8a4a06', band: '#fff3c0' },
  senrin: { a: '#62e38a', b: '#0d5a31', band: '#d6ffe1' },
  chouchin: { a: '#ff7a3a', b: '#8a1f08', band: '#ffe2c4' },
  shime: { a: '#9a86ff', b: '#2c1e78', band: '#e3dcff' },
  koori: { a: '#a8ecff', b: '#1c6b90', band: '#ffffff' },
  oni: { a: '#ff3f4a', b: '#3d0a2d', band: '#ffb1a0' },
  shaku: { a: '#ffc85a', b: '#6a2c04', band: '#fff0c8' },
  nezumi: { a: '#d8d8e8', b: '#4a4a64', band: '#ffffff' },
  roket: { a: '#ff5a48', b: '#6d1014', band: '#ffe0c0' },
  oyako: { a: '#ff9ad0', b: '#7a1f6a', band: '#ffe6f6' },
  ko: { a: '#ffc0a8', b: '#8a3a30', band: '#fff0e0' },
  meoto: { a: '#ff7fb0', b: '#6a1450', band: '#ffd8ec' },
  bake: { a: '#b58cff', b: '#2f1466', band: '#efe4ff' },
  kingyo: { a: '#ff6a2c', b: '#8a1a08', band: '#ffe6c8' },
  nige: { a: '#fff36a', b: '#7a6a04', band: '#ffffff' },
  tome: { a: '#c8c8b4', b: '#54544a', band: '#f4f4e4' },
  juzu1: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' }, juzu2: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' }, juzu3: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' },
  juzu4: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' }, juzu5: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' }, juzu6: { a: '#d0a070', b: '#54300f', band: '#ffe8c8' },
};
const SIGN = { kin: '金', ootama: '大', senrin: '千', chouchin: '灯', shime: '雫', koori: '氷', oni: '鬼', shaku: '尺', nezumi: '鼠', roket: '矢', oyako: '親', meoto: '夫', bake: '？', kingyo: '魚', nige: '逃', tome: '地', juzu1: '1', juzu2: '2', juzu3: '3', juzu4: '4', juzu5: '5', juzu6: '6' };

export function shellAtlas(cell = 144) {
  const c = document.createElement('canvas');
  c.width = cell * ATLAS_CELLS; c.height = cell;
  const g = c.getContext('2d');
  SHELL_ORDER.forEach((id, i) => {
    const L = LOOK[id], cx = cell * i + cell / 2, cy = cell / 2 + 6, r = cell * 0.36;
    g.save();
    // 導火の口
    g.strokeStyle = '#d9b070'; g.lineWidth = cell * 0.022; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy - r); g.quadraticCurveTo(cx + r * 0.1, cy - r * 1.28, cx + r * 0.34, cy - r * 1.3); g.stroke();
    // 球
    const b = g.createRadialGradient(cx - r * 0.35, cy - r * 0.42, r * 0.05, cx, cy, r * 1.04);
    b.addColorStop(0, '#ffffff'); b.addColorStop(0.1, L.band); b.addColorStop(0.34, L.a); b.addColorStop(0.8, L.b); b.addColorStop(1, '#14060e');
    g.fillStyle = b; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    // 紙を貼った継ぎ目
    g.strokeStyle = 'rgba(255,255,255,.17)'; g.lineWidth = cell * 0.008;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.ellipse(cx, cy, Math.abs(k) * r * 0.31 + 1, r, 0, 0, 7); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = cell * 0.014;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(cx, cy + k * r * 0.46, r, r * 0.17, 0, 0, 7); g.stroke(); }
    // 金の帯
    g.strokeStyle = 'rgba(255,224,150,.92)'; g.lineWidth = cell * 0.024;
    g.beginPath(); g.ellipse(cx, cy + r * 0.04, r * 1.02, r * 0.28, 0, 0.05, Math.PI - 0.05); g.stroke();
    g.restore();
    // 種類の印
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,250,235,.95)'; g.strokeStyle = 'rgba(40,10,0,.75)'; g.lineWidth = cell * 0.03;
    const sign = (t, fs = 0.3) => { g.font = `900 ${cell * fs}px "Yuji Boku","Hiragino Mincho ProN","Yu Mincho",serif`; g.strokeText(t, cx, cy + r * 0.02); g.fillText(t, cx, cy + r * 0.02); };
    if (SIGN[id]) sign(SIGN[id], id === 'shaku' ? 0.36 : id.startsWith('juzu') ? 0.42 : 0.3);
    // ハイライト
    const hl = g.createRadialGradient(cx - r * 0.38, cy - r * 0.46, 0, cx - r * 0.38, cy - r * 0.46, r * 0.5);
    hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hl; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    // 縁の光
    g.strokeStyle = 'rgba(255,240,210,.5)'; g.lineWidth = cell * 0.008; g.beginPath(); g.arc(cx, cy, r - 1, 0.2, 2.6); g.stroke();
    g.restore();
  });
  // ヒノコ（火の頭）: ふつうの顔と、熱い顔
  const n = SHELL_ORDER.length;
  try {
    drawHinoko(g, cell * n + cell / 2, cell * 0.58, cell * 0.25, { face: 'idle', still: true, glow: false });
    drawHinoko(g, cell * (n + 1) + cell / 2, cell * 0.58, cell * 0.25, { face: 'wow', still: true, glow: false });
  } catch { /* 無くても遊べる */ }
  // 烏: 暗い空でも見えるように、縁を青白く光らせる
  { const cx = cell * CROW_CELL + cell / 2, cy = cell / 2, u = cell / 100;
    g.save(); g.translate(cx, cy); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-44 * u, -8 * u); g.quadraticCurveTo(-22 * u, -30 * u, -6 * u, -8 * u); g.quadraticCurveTo(0, -4 * u, 6 * u, -8 * u); g.quadraticCurveTo(22 * u, -30 * u, 44 * u, -8 * u); g.quadraticCurveTo(24 * u, -6 * u, 12 * u, 8 * u); g.lineTo(5 * u, 26 * u); g.lineTo(0, 20 * u); g.lineTo(-5 * u, 26 * u); g.lineTo(-12 * u, 8 * u); g.quadraticCurveTo(-24 * u, -6 * u, -44 * u, -8 * u); g.closePath();
    g.fillStyle = '#1a1626'; g.fill(); g.strokeStyle = '#b6c8ff'; g.lineWidth = 3 * u; g.stroke();
    g.beginPath(); g.arc(0, -6 * u, 9 * u, 0, 7); g.fillStyle = '#1a1626'; g.fill(); g.stroke();
    g.fillStyle = '#ff5a30'; g.beginPath(); g.arc(-3 * u, -8 * u, 2.2 * u, 0, 7); g.arc(3 * u, -8 * u, 2.2 * u, 0, 7); g.fill();
    g.fillStyle = '#ffb040'; g.beginPath(); g.moveTo(-3 * u, -3 * u); g.lineTo(3 * u, -3 * u); g.lineTo(0, 4 * u); g.closePath(); g.fill();
    g.restore(); }
  // 風車の芯
  { const cx = cell * HUB_CELL + cell / 2, cy = cell / 2, r = cell * 0.2;
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ff6a50' : '#ffe9b0'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, (i / 8) * 6.283, ((i + 1) / 8) * 6.283); g.closePath(); g.fill(); }
    g.fillStyle = '#3a1a10'; g.beginPath(); g.arc(cx, cy, r * 0.28, 0, 7); g.fill(); }
  return c;
}

export const SHELL_NAME = {
  kiku: ['菊玉', 'Peony'], ootama: ['大玉', 'Big Shell'], kin: ['金の玉', 'Gold Shell'], senrin: ['千輪', 'Crossette'],
  chouchin: ['提灯', 'Lantern'], shime: ['湿り玉', 'Wet Shell'], koori: ['氷玉', 'Ice Shell'], oni: ['鬼玉', 'Oni Shell'], shaku: ['尺玉', 'Grand Shell'], ko: ['子玉', 'Small Shell'],
  nezumi: ['ねずみ花火', 'Whirling Mouse'], roket: ['ロケット花火', 'Bottle Rocket'], oyako: ['親子玉', 'Mother Shell'], bake: ['化け玉', 'Trickster'], tome: ['地蔵玉', 'Jizo Shell'],
  kingyo: ['金魚玉', 'Goldfish'], nige: ['逃げ玉', 'Runaway'], meoto: ['夫婦玉', 'Twin Shell'], juzu: ['数珠玉', 'Prayer Bead'],
};
// 玉の一行説明（屋台の「玉を足す」と玉袋で使う）
export const SHELL_DESC = {
  kiku: ['ふつうの玉。点 10', 'A plain shell. 10 POINTS'], ootama: ['爆風が大きい。点 30', 'Big blast. 30 POINTS'], kin: ['ひらくと 倍率 +1', 'Opens for +1 MULT'],
  senrin: ['八方に火花を飛ばす', 'Shoots sparks in 8 directions'], chouchin: ['このあとひらく玉の点が 2 倍', 'Doubles POINTS of shells opened after it'],
  nezumi: ['走り回って、ふれた玉に火を移す', 'Scurries around, lighting what it touches'], roket: ['矢の向きへ一直線に飛ぶ', 'Flies straight where its arrow points'],
  oyako: ['子玉を 4 つ飛ばす', 'Scatters 4 small shells'], bake: ['何が起きるかは、ひらくまで分からない', 'Who knows what happens'],
  tome: ['線の火でひらくと、火が 1 秒止まる', 'Lit by your line, freezes the flame for 1s'], kingyo: ['泳ぎ回る。ひらけば小判 +1', 'Swims around. +1 coin'],
  nige: ['筆から逃げる。ひらけば倍率 +3', 'Flees your brush. +3 MULT'],
};
const BAG_COLOR = { heat: ['#c8411f', '#6e150a'], chain: ['#c0307a', '#5a1038'], gold: ['#c98f18', '#6a4306'], lantern: ['#d0641e', '#6f2a08'], ink: ['#2c5cb4', '#112c63'], finale: ['#7a46c6', '#32155e'], gimmick: ['#1f8f68', '#0b4632'], star: ['#2f8fc8', '#0f3a5e'] };

// お守り袋: 型の色の錦に、名前の頭の字。稀さで縁を変える
export function drawBag(cv, c) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, [a, b] = BAG_COLOR[c.tag] || BAG_COLOR.ink;
  g.clearRect(0, 0, w, h);
  const x0 = w * 0.1, x1 = w * 0.9, y0 = h * 0.2, y1 = h * 0.95, r = w * 0.09;
  const path = () => { g.beginPath(); g.moveTo(x0 + w * 0.05, y0); g.lineTo(x1 - w * 0.05, y0); g.quadraticCurveTo(x1, y0, x1, y0 + r); g.lineTo(x1, y1 - r); g.quadraticCurveTo(x1, y1, x1 - r, y1); g.lineTo(x0 + r, y1); g.quadraticCurveTo(x0, y1, x0, y1 - r); g.lineTo(x0, y0 + r); g.quadraticCurveTo(x0, y0, x0 + w * 0.05, y0); g.closePath(); };
  const f = g.createLinearGradient(0, y0, w, y1); f.addColorStop(0, a); f.addColorStop(1, b); g.fillStyle = f; path(); g.fill();
  // 織りの柄
  g.save(); path(); g.clip(); g.strokeStyle = 'rgba(255,240,200,.14)'; g.lineWidth = Math.max(1, w * 0.012);
  for (let i = -8; i < 16; i++) { g.beginPath(); g.moveTo(i * w * 0.14, y0); g.lineTo(i * w * 0.14 + h, y0 + h); g.stroke(); g.beginPath(); g.moveTo(i * w * 0.14 + h, y0); g.lineTo(i * w * 0.14, y0 + h); g.stroke(); }
  const hi = g.createLinearGradient(0, y0, 0, y0 + h * 0.34); hi.addColorStop(0, 'rgba(255,255,255,.22)'); hi.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hi; g.fillRect(0, y0, w, h * 0.34);
  g.restore();
  const edge = c.rar === 'l' ? '#ffe28a' : c.rar === 'r' ? '#cfe0ff' : '#e8c98a';
  g.strokeStyle = edge; g.lineWidth = w * (c.rar === 'l' ? 0.05 : 0.03); path(); g.stroke();
  // 紐
  g.strokeStyle = edge; g.lineWidth = w * 0.035; g.lineCap = 'round';
  g.beginPath(); g.moveTo(w * 0.36, y0 + h * 0.01); g.quadraticCurveTo(w * 0.5, h * 0.03, w * 0.64, y0 + h * 0.01); g.stroke();
  g.fillStyle = edge; g.beginPath(); g.arc(w * 0.5, y0 + h * 0.02, w * 0.055, 0, 7); g.fill();
  // 字
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${w * 0.5}px "Yuji Boku","Hiragino Mincho ProN","Yu Mincho",serif`;
  g.lineWidth = w * 0.03; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(c.ja[0], w / 2, h * 0.6);
  g.fillStyle = '#fff4d2'; g.fillText(c.ja[0], w / 2, h * 0.6);
}
let _atlas = null;
export function drawShellIcon(cv, id) {
  if (!_atlas) _atlas = shellAtlas();
  const g = cv.getContext('2d'), cell = _atlas.height, i = SHELL_ORDER.indexOf(id), sz = cv.width;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(_atlas, i * cell, 0, cell, cell, 0, (cv.height - sz) / 2, sz, sz);
}

export function noiseTex(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) { const v = Math.floor(90 + Math.random() * 165); g.fillStyle = `rgba(${v},${v},${v},.1)`; g.beginPath(); g.arc(Math.random() * size, Math.random() * size, 4 + Math.random() * 22, 0, 7); g.fill(); }
  return c;
}

// Blender の帯ができるまでの仮の町
export function placeholderBand() {
  const W = 2048, H = 640;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const n = mk(), f = mk(), a = n.getContext('2d'), b = f.getContext('2d');
  const rnd = ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(1234567);
  const waterTop = H * 0.78;
  const layer = (base, amp, nightC, flashC) => {
    for (const [g, col] of [[a, nightC], [b, flashC]]) {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, waterTop);
      for (let x = 0; x <= W; x += 24) g.lineTo(x, base - Math.sin(x * 0.004 + base) * amp - Math.sin(x * 0.013 + base * 3) * amp * 0.35);
      g.lineTo(W, waterTop); g.fill();
    }
  };
  layer(H * 0.50, 48, '#0e1a33', '#39425a'); layer(H * 0.58, 36, '#0a1226', '#2b3347');
  for (let x = -20; x < W;) {
    const w = 70 + rnd() * 90, h = 40 + rnd() * 54, y = waterTop - h - 22;
    for (const [g, col, roof] of [[a, '#070b16', '#0a0f1e'], [b, '#6a5a4a', '#7c7f8c']]) {
      g.fillStyle = col; g.fillRect(x, y, w, h + 24);
      g.fillStyle = roof; g.beginPath(); g.moveTo(x - 12, y + 4); g.quadraticCurveTo(x + w / 2, y - 8, x + w / 2, y - 26); g.quadraticCurveTo(x + w / 2, y - 8, x + w + 12, y + 4); g.lineTo(x + w + 12, y + 10); g.lineTo(x - 12, y + 10); g.fill();
    }
    for (let i = 0; i < 3; i++) if (rnd() < 0.7) { a.fillStyle = `rgba(255,${150 + rnd() * 50},70,${0.65 + rnd() * 0.3})`; a.fillRect(x + 8 + i * (w / 3), y + 18, w / 3 - 12, 15); }
    x += w + 8;
  }
  // 提灯
  for (let x = 40; x < W; x += 46 + rnd() * 22) { const y = waterTop - 38 + Math.sin(x * 0.02) * 6; a.fillStyle = rnd() < 0.5 ? '#ff5a30' : '#ffc070'; a.beginPath(); a.ellipse(x, y, 6, 8, 0, 0, 7); a.fill(); }
  // 水際より下は抜く（水面）
  a.clearRect(0, waterTop, W, H - waterTop); b.clearRect(0, waterTop, W, H - waterTop);
  // 見物の人影
  for (let x = 20; x < W; x += 16 + rnd() * 34) { const hh = 34 + rnd() * 20, y = H - 8; for (const [g, c] of [[a, '#03050b'], [b, '#322a2a']]) { g.fillStyle = c; g.beginPath(); g.arc(x, y - hh, 6.5, 0, 7); g.fill(); g.fillRect(x - 7.5, y - hh + 6, 15, hh); } }
  return { night: n, flash: f, waterFrac: 1 - waterTop / H };
}
