// 描画: 盤の状態を読むだけで、ゲームの中身は変えない。
import { TOP, BOTTOM, COLS as NC, GARB } from './naraberu.js';

export const PAL = [
  null,
  { fill: '#ff5d6c', dark: '#b3263a', shape: 'circle' },
  { fill: '#46d483', dark: '#1d8a4c', shape: 'tri' },
  { fill: '#4c9dff', dark: '#1f5fc0', shape: 'square' },
  { fill: '#ffcf3f', dark: '#b88a00', shape: 'diamond' },
  { fill: '#b57bff', dark: '#6d3dc4', shape: 'star' },
];
const FACTION = {
  tsunagu: { name: 'つなぐ派', accent: '#ff8a65' },
  naraberu: { name: 'ならべる派', accent: '#4dd0e1' },
};

function shapePath(ctx, shape, cx, cy, r) {
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (shape === 'tri') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.95, cy + r * 0.75); ctx.lineTo(cx - r * 0.95, cy + r * 0.75); ctx.closePath(); }
  else if (shape === 'square') ctx.rect(cx - r * 0.8, cy - r * 0.8, r * 1.6, r * 1.6);
  else if (shape === 'diamond') { ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath(); }
  else if (shape === 'star') {
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }
}

function star5(ctx, x, y, r, col, rot = 0) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + rot + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMark(ctx, c, cx, cy, s, alpha = 0.85) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  shapePath(ctx, PAL[c].shape, cx, cy, s * 0.17);
  ctx.fill();
  ctx.restore();
}

// 揺れや点滅を抑える設定（設定画面・OS の prefers-reduced-motion）。true なら点滅と画面の揺れを出さない
let CALM = false;

function drawBlob(ctx, c, x, y, s, flash = 0, face = 0, t = 0) {
  const cx = x + s / 2, cy = y + s / 2, r = s * 0.44;
  if (c === 6) {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#d9dbe6'); g.addColorStop(1, '#7c8094');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(40,42,60,.55)'; ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath(); ctx.moveTo(cx - r * 0.35, cy - r * 0.1); ctx.lineTo(cx - r * 0.1, cy - r * 0.1);
    ctx.moveTo(cx + r * 0.1, cy - r * 0.1); ctx.lineTo(cx + r * 0.35, cy - r * 0.1); ctx.stroke();
    return;
  }
  const p = PAL[c];
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, flash ? '#fff' : p.fill); g.addColorStop(1, flash ? p.fill : p.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(cx - r * 0.3, cy - r * 0.42, r * 0.28, r * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
  if (face && s >= 18) drawFace(ctx, cx, cy, s, face, t);
  drawMark(ctx, c, cx, cy + s * (face && s >= 18 ? 0.2 : 0.04), s * (face && s >= 18 ? 0.75 : 1));
}

// つぶの顔: face=1 ふつう（ときどきまばたき）、2 にっこり（消える前）
function drawFace(ctx, cx, cy, s, face, t) {
  const ey = cy - s * 0.08, dx = s * 0.13, er = s * 0.065;
  ctx.save();
  ctx.fillStyle = '#26162e'; ctx.strokeStyle = '#26162e'; ctx.lineWidth = Math.max(1.2, s * 0.045); ctx.lineCap = 'round';
  const blink = ((t * 0.7 + cx * 0.013 + cy * 0.007) % 4) < 0.1;
  for (const k of [-1, 1]) {
    const ex = cx + k * dx;
    if (face === 2) { ctx.beginPath(); ctx.arc(ex, ey + er * 0.4, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    else if (blink) { ctx.beginPath(); ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey); ctx.stroke(); }
    else { ctx.beginPath(); ctx.ellipse(ex, ey, er * 0.8, er, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + er * 0.25, ey - er * 0.35, er * 0.33, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#26162e'; }
  }
  ctx.restore();
}

function drawPanel(ctx, c, x, y, s, { flash = 0, dim = 0, scale = 1 } = {}) {
  const p = PAL[c];
  const m = s * (0.05 + (1 - scale) * 0.45);
  ctx.save();
  if (dim) ctx.globalAlpha *= 0.38;
  const g = ctx.createLinearGradient(x, y, x, y + s);
  g.addColorStop(0, flash ? '#ffffff' : p.fill); g.addColorStop(1, p.dark);
  ctx.fillStyle = g;
  roundRect(ctx, x + m, y + m, s - m * 2, s - m * 2, s * 0.16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.stroke();
  if (scale > 0.4) drawMark(ctx, c, x + s / 2, y + s / 2, s * scale);
  ctx.restore();
}

// ---- 盤 ----
function drawTsunagu(ctx, b, X, Y, s, t, p, fx, popFrames) {
  const g = b.grid;
  const popping = new Set((b.popping || []).map(([x, y]) => y * 6 + x));
  const flash = !CALM && b.phase === 'pop' && Math.floor(b.timer / 4) % 2 === 0;
  const popU = b.phase === 'pop' ? 1 - b.timer / popFrames : 0;   // 消える動きの進み 0→1
  const vis = (x, y) => (fx && fx.tsunaguCell(p, x, y)) || null;
  // つながりの橋
  for (let y = 1; y <= 12; y++) for (let x = 0; x < 6; x++) {
    const c = g[y][x];
    if (c < 1 || c > 5) continue;
    const px = X + x * s, py = Y + (y - 1) * s;
    ctx.fillStyle = PAL[c].dark;
    const v0 = vis(x, y), moving = v0 && (v0.off || v0.sq);   // 落ちている・はねている間は橋をかけない
    if (moving) continue;
    if (x < 5 && g[y][x + 1] === c && !((vis(x + 1, y) || {}).off)) ctx.fillRect(px + s / 2, py + s * 0.24, s, s * 0.52);
    if (y < 12 && g[y + 1][x] === c && !((vis(x, y + 1) || {}).off)) ctx.fillRect(px + s * 0.24, py + s / 2, s * 0.52, s);
  }
  for (let y = 1; y <= 12; y++) for (let x = 0; x < 6; x++) {
    const c = g[y][x];
    if (!c) continue;
    const v = vis(x, y), off = v ? v.off || 0 : 0, sq = v ? v.sq || 0 : 0;
    const pop = popping.has(y * 6 + x);
    let sc = 1, alpha = 1;
    if (pop) { sc = popU < 0.65 ? 1 + 0.07 * Math.sin(popU * 46) : 1 + 0.35 * (popU - 0.65) / 0.35; alpha = popU < 0.75 ? 1 : 1 - (popU - 0.75) / 0.25; }
    const bx = X + x * s, by = Y + (y - 1 + off) * s;
    ctx.save(); ctx.globalAlpha *= alpha;
    // 下の辺を軸に、つぶれ（sq<0 で横に広がり縦に縮む）と、消える前のふくらみ
    ctx.translate(bx + s / 2, by + s); ctx.scale(sc * (1 - 0.6 * sq), sc * (1 + sq)); ctx.translate(-(bx + s / 2), -(by + s));
    if (pop) ctx.translate(0, -s * (sc - 1) * 0.5);
    drawBlob(ctx, c, bx, by, s, pop && flash, c >= 1 && c <= 5 ? (pop ? 2 : 1) : 0, t);
    ctx.restore();
  }
  // 窒息点
  if (g[1][2] === 0) {
    ctx.strokeStyle = g[3][2] ? 'rgba(255,80,80,.9)' : 'rgba(255,255,255,.18)';
    ctx.lineWidth = Math.max(2, s * 0.08);
    const cx = X + 2.5 * s, cy = Y + 0.5 * s, r = s * 0.22;
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  }
  if (b.piece) {
    const pIdx = p, p2 = b.piece;
    { const p = p2;
    const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
    // 落下予測
    let gy = p.y;
    const fits = yy => {
      const cy2 = yy + DY[p.rot], cx2 = p.x + DX[p.rot];
      const ok = (x, y) => x >= 0 && x < 6 && y >= 0 && y < 13 && g[y][x] === 0;
      return ok(p.x, yy) && ok(cx2, cy2);
    };
    while (fits(gy + 1)) gy++;
    ctx.save(); ctx.globalAlpha = 0.25;
    for (const [x, y, c] of [[p.x, gy, p.a], [p.x + DX[p.rot], gy + DY[p.rot], p.b]]) if (y >= 1) drawBlob(ctx, c, X + x * s, Y + (y - 1) * s, s);
    ctx.restore();
    const q = (fx && fx.piece(pIdx)) || { x: p.x, y: p.y, ang: p.rot * Math.PI / 2 };
    const ax = q.x, ay = q.y, chx = q.x + Math.sin(q.ang), chy = q.y - Math.cos(q.ang);
    for (const [x, y, c] of [[ax, ay, p.a], [chx, chy, p.b]]) {
      if (y >= 0.5) drawBlob(ctx, c, X + x * s, Y + (y - 1) * s, s, 0, 1, t);
    }
    // 軸の印
    if (ay >= 0.5) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath(); ctx.arc(X + ax * s + s / 2, Y + (ay - 1) * s + s / 2, s * 0.47, 0, Math.PI * 2); ctx.stroke();
    }
    }
  }
}

function drawGarbageRect(ctx, bx, by, w, h, s, flashOn, rows, single = false) {
  const gr = ctx.createLinearGradient(bx, by, bx, by + h);
  gr.addColorStop(0, flashOn ? '#ffffff' : '#9aa0b8'); gr.addColorStop(1, flashOn ? '#c9d0f0' : '#5c6178');
  ctx.fillStyle = gr;
  roundRect(ctx, bx + 2, by + 2, w - 4, h - 4, s * 0.18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#1b1e2b'; ctx.lineWidth = s * 0.12;
  roundRect(ctx, bx + 2, by + 2, w - 4, h - 4, s * 0.18); ctx.clip();
  const n = Math.round(w / s), r = Math.round(h / s);
  for (let k = -r; k < n + r; k++) { ctx.beginPath(); ctx.moveTo(bx + k * s, by); ctx.lineTo(bx + (k + r) * s, by + h); ctx.stroke(); }
  ctx.restore();
  if (single) { // 変わる直前のマス: 「？」
    ctx.fillStyle = 'rgba(30,32,48,.7)';
    ctx.font = `900 ${Math.round(s * 0.5)}px "M PLUS Rounded 1c",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', bx + w / 2, by + h / 2 + 1);
  }
}

// 消える直前のパネルの「驚いた顔」
function drawPanelFace(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,30,.45)';
  roundRect(ctx, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.16); ctx.fill();
  ctx.fillStyle = '#fff';
  const ey = y + s * 0.42;
  ctx.beginPath(); ctx.arc(x + s * 0.34, ey, s * 0.07, 0, Math.PI * 2); ctx.arc(x + s * 0.66, ey, s * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + s * 0.5, y + s * 0.68, s * 0.08, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawNaraberu(ctx, b, X, Y, s, t, p, fx, cfg) {
  const FL = cfg.naraberuClearFlash, FA = cfg.naraberuClearFace, PO = cfg.naraberuClearPop;
  const lift = b.rise * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, NC * s, 12 * s); ctx.clip();
  const drawnBlocks = new Set();
  for (let y = TOP; y <= BOTTOM; y++) for (let x = 0; x < NC; x++) {
    const i = y * NC + x, c = b.C[i];
    if (!c) continue;
    const px = X + x * s, py = Y + (y - TOP) * s - lift;
    if (c === GARB) {
      const id = b.Gd[i];
      if (drawnBlocks.has(id)) continue;
      drawnBlocks.add(id);
      const bl = b.blocks.get(id);
      if (!bl) continue;
      const bx = X + bl.x * s, by = Y + (bl.y - TOP) * s - lift;
      const el = bl.thaw > 0 ? bl.thawTotal - bl.thaw : -1;
      const flashOn = !CALM && el >= 0 && el < FL && Math.floor(el / 3) % 2 === 0;
      const splitting = el >= FL && bl.reveal;      // 光り終わったら、下の段は1マスずつ描く
      const rh = splitting ? bl.h - 1 : bl.h;
      if (rh > 0) drawGarbageRect(ctx, bx, by, bl.w * s, rh * s, s, flashOn, bl.h);
      if (splitting) {
        const ry = by + (bl.h - 1) * s;
        for (let k = 0; k < bl.w; k++) {
          const cx = bx + k * s, at = FL + FA + k * PO;
          if (el >= at) {
            const u = Math.min(1, (el - at) / 7);
            drawPanel(ctx, bl.reveal[k], cx, ry, s, { scale: 0.35 + 0.65 * u, flash: !CALM && el - at < 3 ? 1 : 0 });
          } else {
            const shiver = el > at - 6 ? Math.sin(el * 2.3) * s * 0.03 : 0;
            drawGarbageRect(ctx, cx + shiver, ry, s, s, s, false, 1, true);
          }
        }
      }
      continue;
    }
    const v = fx && fx.naraberuCell(p, i);
    const hov = b.S[i] === 3 ? Math.sin(t * 22 + x * 1.3) * s * 0.035 - s * 0.03 : 0; // 浮遊中はふわふわ揺れる
    const qx = px + (v && v.ox ? v.ox * s : 0), qy = py + hov + (v && v.oy ? v.oy * s : 0), sq = v && v.sq ? v.sq : 0;
    ctx.save();
    if (sq) { ctx.translate(qx + s / 2, qy + s); ctx.scale(1 - 0.6 * sq, 1 + sq); ctx.translate(-(qx + s / 2), -(qy + s)); }
    if (b.S[i] === 1) {
      const el = b.TT[i] - b.T[i], popAt = FL + FA + b.Q[i] * PO;
      if (el < FL) {
        // 光る: 白く点滅しながら少しふくらむ
        const k = 1 + 0.06 * Math.sin(el * 0.5);
        ctx.translate(qx + s / 2, qy + s / 2); ctx.scale(k, k); ctx.translate(-(qx + s / 2), -(qy + s / 2));
        drawPanel(ctx, c, qx, qy, s, { flash: !CALM && Math.floor(el / 3) % 2 === 0 ? 1 : 0 });
      } else if (el < popAt) {
        // 驚いた顔で、自分の番を待つ（番が近づくと震える）
        const jit = popAt - el < 6 ? Math.sin(el * 2.1) * s * 0.035 : 0;
        drawPanel(ctx, c, qx + jit, qy, s, { dim: 0 });
        drawPanelFace(ctx, qx + jit, qy, s);
      } else {
        // はじけた跡: 広がって消える輪
        const u = (el - popAt) / 12;
        if (u < 1) {
          ctx.globalAlpha = 1 - u;
          ctx.strokeStyle = PAL[c].fill; ctx.lineWidth = Math.max(2, s * 0.1 * (1 - u));
          ctx.beginPath(); ctx.arc(qx + s / 2, qy + s / 2, s * (0.25 + 0.45 * u), 0, Math.PI * 2); ctx.stroke();
        }
      }
    } else drawPanel(ctx, c, qx, qy, s);
    ctx.restore();
  }
  for (let x = 0; x < NC; x++) drawPanel(ctx, b.preview[x], X + x * s, Y + 12 * s - lift, s, { dim: 1 });
  ctx.restore();
  // カーソル
  const cy = Y + (b.cursor.y - TOP) * s - lift, cx = X + b.cursor.x * s;
  const pulse = 0.8 + 0.2 * Math.sin(t * 8);
  ctx.save();
  ctx.shadowColor = 'rgba(255,255,255,.9)'; ctx.shadowBlur = s * 0.35;
  ctx.strokeStyle = `rgba(255,255,255,${pulse})`; ctx.lineWidth = Math.max(3, s * 0.13);
  roundRect(ctx, cx - 1, cy - 1, s * 2 + 2, s + 2, s * 0.22); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.strokeStyle = 'rgba(20,16,50,.85)';
  roundRect(ctx, cx + s * 0.08, cy + s * 0.08, s * 2 - s * 0.16, s - s * 0.16, s * 0.16); ctx.stroke();
}

// 予告の目安アイコン（受ける側の単位で 30 / 6 / 1）
function drawPending(ctx, units, X, Y, s, w, kind) {
  let n = Math.floor(units + 1e-9);
  const icons = [];
  while (n >= 30 && icons.length < 6) { icons.push(30); n -= 30; }
  while (n >= 6 && icons.length < 6) { icons.push(6); n -= 6; }
  while (n >= 1 && icons.length < 6) { icons.push(1); n -= 1; }
  let x = X;
  for (const v of icons) {
    const r = v === 30 ? s * 0.42 : v === 6 ? s * 0.34 : s * 0.2;
    ctx.fillStyle = v === 30 ? '#ff6b6b' : v === 6 ? '#c9cde0' : '#9298b0';
    if (kind === 'tsunagu') { ctx.beginPath(); ctx.arc(x + r, Y, r, 0, Math.PI * 2); ctx.fill(); }
    else { roundRect(ctx, x, Y - r, r * 2, r * 2, r * 0.35); ctx.fill(); }
    if (v >= 6) { ctx.fillStyle = '#1b1e2b'; ctx.font = `700 ${Math.round(r * 0.9)}px "JetBrains Mono",monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(v), x + r, Y + 1); }
    x += r * 2 + s * 0.08;
    if (x > X + w) break;
  }
}

// 天井の猶予と停止時間: 枠のすぐ上にゲージ、盤の上部に暗い札で残り秒数
function drawCeiling(ctx, b, X, Y, s, small, now) {
  const w = s * 6 + 12, h = Math.max(4, Math.round(s * (small ? 0.16 : 0.13)));
  const gy = Y - 6 - h - 3;
  const bar = (frac, color, label) => {
    ctx.fillStyle = 'rgba(8,10,24,.85)';
    roundRect(ctx, X - 6, gy, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, X - 6, gy, Math.max(h, w * Math.max(0, Math.min(1, frac))), h, h / 2); ctx.fill();
    if (small) return;
    const fs = Math.round(Math.max(12, s * 0.36));
    ctx.font = `900 ${fs}px "M PLUS Rounded 1c",sans-serif`;
    const tw = ctx.measureText(label).width + fs * 1.2, th = fs * 1.55;
    const tx = X + s * 3 - tw / 2, ty = Y + s * 0.2;
    ctx.fillStyle = 'rgba(10,8,26,.88)';
    roundRect(ctx, tx, ty, tw, th, th / 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, X + s * 3, ty + th / 2 + 1);
  };
  if (b.stop > 0) bar(Math.min(1, b.stop / 180), '#7fdcff', `せり上がり停止 ${(b.stop / 60).toFixed(1)}秒`);
  else if (b.grace < b.graceMax) {
    const a = 0.7 + 0.3 * Math.sin(now * 14);
    bar(b.grace / b.graceMax, `rgba(255,90,90,${a})`, `天井まで あと${(b.grace / 60).toFixed(1)}秒`);
  }
}

export function createRenderer(canvas, { phys = null, charas = null } = {}) {
  const ctx = canvas.getContext('2d');
  const fx = []; // {kind, p, text, x, y, t0, dur, ...}
  let shake = [0, 0];
  let layout = null;

  // reserve: 盤の上に空ける高さ（スマホのチュートリアルの説明など）
  function computeLayout(W, H, mobile, n = 2, reserve = 0) {
    if (mobile) {
      const ctrlH = 100;
      const miniW = Math.floor(W * 0.24);
      const s = Math.max(6, Math.floor(Math.min((W - 26 - miniW) / 6, (H - 56 - reserve - ctrlH - 20) / 14)));
      const bw = s * 6;
      const X0 = 10;
      const Y0 = 56 + reserve + Math.round(s * 1.95);
      const ms = Math.max(6, Math.floor((W - X0 - bw - 22) / 6));
      return {
        mobile: true, boards: [
          { X: X0, Y: Y0, s },
          { X: X0 + bw + 14, Y: Y0 + 6, s: ms },
        ], hud: { x: X0 + bw + 14, y: n === 1 ? 370 : Y0 + ms * 12 + 16 }, // 練習（1人）は右の列の上にツールバーがあるので、その下から
      };
    }
    const s = Math.max(6, Math.floor(Math.min((H - 56 - 100) / 13.4, (W - 40) / 17.5)));
    const bw = s * 6, gap = s * 4.2;
    // 練習（1人）: 盤を中央より少し右に置き、左に立ち絵、右に時計
    const X0 = n === 1 ? Math.round(W / 2 - bw / 2 + s * 1.5) : Math.round((W - (bw * 2 + gap)) / 2);
    const Y0 = Math.round(56 + (H - 56 - s * 12) / 2 + s * 0.7);
    return { mobile: false, boards: [{ X: X0, Y: Y0, s }, { X: X0 + bw + gap, Y: Y0, s }], hud: { x: n === 1 ? X0 + bw + s * 2.2 : W / 2, y: Y0 } };
  }

  function boardCenter(p) {
    const L = layout.boards[p];
    return { x: L.X + L.s * 3, y: L.Y + L.s * 6 };
  }

  function onEvents(events, match, now) {
    for (const e of events) {
      const L = layout && layout.boards[e.p];
      if (!L) continue;
      if (e.type === 'pop' && e.chain >= 2) {
        // 前の連鎖の文字は消して、新しい数だけを見せる（重なって読めなくなるのを防ぐ）
        for (let k = fx.length - 1; k >= 0; k--) if (fx[k].chainOf === e.p) fx.splice(k, 1);
        fx.push({ chainOf: e.p, kind: 'text', text: `${e.chain}れんさ！`, x: L.X + L.s * 3, y: L.Y + L.s * 4, t0: now, dur: 0.9, size: L.s * (0.8 + Math.min(0.6, e.chain * 0.08)), color: '#fff3a8' });
      }
      if (e.type === 'pop' && e.n >= 4 && match.players[e.p].kind === 'naraberu') {
        fx.push({ kind: 'text', text: `${e.n}どうじ`, x: L.X + L.s * 3, y: L.Y + L.s * 5.2, t0: now, dur: 0.8, size: L.s * 0.6, color: '#bdf6ff' });
      }
      if (e.type === 'attack' && e.D > 0.2) {
        if (match.players.length < 2) continue; // 練習: 相手がいないので攻撃の弾は飛ばさない
        const a = boardCenter(e.p), b = boardCenter(1 - e.p);
        fx.push({ kind: 'orb', x0: a.x, y0: L.Y + L.s * 2, x1: b.x, y1: layout.boards[1 - e.p].Y - layout.boards[1 - e.p].s * 0.6, t0: now, dur: 0.45, r: Math.min(L.s * 0.9, L.s * (0.25 + e.D / 40)), offset: e.sent < e.D - 1e-6 });
      }
      if (e.type === 'garbage') {
        const big = (e.n || (e.w * e.h)) >= 12;
        if (big && !CALM) shake = [now, 0.25];
      }
    }
  }

  function draw(match, labels, now, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    layout = computeLayout(W, H, opts.mobile, match ? match.players.length : 2, opts.topReserve || 0);
    if (!match) return;
    let sx = 0, sy = 0;
    if (shake[1] > 0 && now - shake[0] < shake[1]) { const k = (1 - (now - shake[0]) / shake[1]) * 6; sx = (Math.random() - 0.5) * k; sy = (Math.random() - 0.5) * k; }
    ctx.save(); ctx.translate(sx, sy);

    match.players.forEach((pl, p) => {
      const { X, Y, s } = layout.boards[p];
      const f = FACTION[pl.kind];
      const small = layout.mobile && p === 1;
      // 枠
      ctx.fillStyle = 'rgba(8,10,24,.72)';
      roundRect(ctx, X - 6, Y - 6, s * 6 + 12, s * 12 + 12, 12); ctx.fill();
      let danger = false;
      if (pl.kind === 'naraberu') danger = pl.board.grace < pl.board.graceMax;
      else danger = pl.board.grid[3][2] !== 0;
      ctx.strokeStyle = danger ? `rgba(255,70,70,${0.6 + 0.4 * Math.sin(now * 12)})` : f.accent;
      ctx.lineWidth = small ? 2 : 3;
      roundRect(ctx, X - 6, Y - 6, s * 6 + 12, s * 12 + 12, 12); ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.rect(X, Y, s * 6, s * 12); ctx.clip();
      // 背景の目
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      for (let x = 0; x < 6; x += 2) ctx.fillRect(X + x * s, Y, s, s * 12);
      const bsh = phys ? phys.shake(p) : 0;
      if (bsh && !CALM) ctx.translate(Math.sin(now * 90) * bsh * 0.4, Math.cos(now * 70) * bsh * 0.3);
      if (pl.kind === 'tsunagu') drawTsunagu(ctx, pl.board, X, Y, s, now, p, phys, Math.round(match.cfg.tsunaguPopSec * 60));
      else drawNaraberu(ctx, pl.board, X, Y, s, now, p, phys, match.cfg);
      ctx.restore();
      if (pl.kind === 'naraberu') drawCeiling(ctx, pl.board, X, Y, s, small, now);
      if (pl.board.isDead()) {
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(X, Y, s * 6, s * 12);
      }
      // 見出し
      if (!small) {
        ctx.fillStyle = f.accent;
        ctx.font = `800 ${Math.round(Math.max(13, s * 0.42))}px "M PLUS Rounded 1c",sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(`${labels[p]}  ${f.name}`, X - 4, Y - s * 1.25);
      }
      // 予告
      const conv = pl.kind === 'tsunagu' ? match.cfg.convT : match.cfg.convN;
      const units = pl.pending.D * conv;
      drawPending(ctx, units, X, Y - (small ? 12 : s * 0.62), small ? s * 1.6 : s, s * 6 - (pl.kind === 'tsunagu' && !small ? s * 2.2 : 0), pl.kind);
      // つなぐ派の次の組
      if (pl.kind === 'tsunagu' && !small) {
        const ns = s * 0.5;
        pl.board.next.forEach((n, k) => {
          const nx = X + s * 6 - ns * (2.4 - k * 1.2) - 2, ny = Y - s * 1.0 - ns * 0.6;
          drawBlob(ctx, n.b, nx, ny - ns, ns);
          drawBlob(ctx, n.a, nx, ny, ns);
        });
      }
    });

    // しずく・破片・星（盤の外にも飛ぶ）
    if (phys) for (const q of phys.parts) {
      const L = layout.boards[q.p], pl = match.players[q.p];
      const s = L.s, lift = pl.kind === 'naraberu' ? pl.board.rise * s : 0;
      const x = L.X + q.x * s, y = pl.kind === 'naraberu' ? L.Y + (q.y - TOP) * s - lift : L.Y + q.y * s;
      const a = 1 - q.age / q.life;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      if (q.kind === 'star') { star5(ctx, x, y, q.r * s * (0.6 + 0.4 * Math.sin(q.age * 0.5)), '#fffbe0', q.rot); }
      else if (q.kind === 'drop') {
        const r = q.r * s; ctx.fillStyle = PAL[q.c] ? PAL[q.c].fill : '#ccc';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
      } else {
        const r = q.r * s; ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillStyle = PAL[q.c] ? PAL[q.c].fill : '#ccc';
        roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.35); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
    }
    if (charas) charas.draw(ctx, layout, match, now, W);

    // 中央表示
    const tsec = match.frame / 60;
    const mm = Math.floor(tsec / 60), ss = Math.floor(tsec % 60);
    const fever = match.feverMul();
    ctx.textAlign = layout.mobile ? 'left' : 'center'; ctx.textBaseline = 'top';
    const hx = layout.hud.x, hy = layout.hud.y;
    ctx.fillStyle = '#e9ecff';
    ctx.font = `600 ${layout.mobile ? 15 : 26}px "JetBrains Mono",monospace`;
    ctx.fillText(`${mm}:${String(ss).padStart(2, '0')}`, hx, hy + (layout.mobile ? 0 : 10));
    if (Math.abs(fever - 1) > 1e-6) {
      ctx.fillStyle = fever > 1 ? `rgba(255,${180 - (fever - 1) * 120},80,1)` : '#9fe3ff';
      ctx.font = `800 ${layout.mobile ? 13 : 18}px "M PLUS Rounded 1c",sans-serif`;
      ctx.fillText(layout.mobile ? `攻撃×${fever.toFixed(1)}` : `${fever > 1 ? '攻撃' : '準備中 攻撃'} ×${fever.toFixed(1)}`, hx, hy + (layout.mobile ? 20 : 48));
    }

    // 演出
    for (let k = fx.length - 1; k >= 0; k--) {
      const e = fx[k];
      const u = (now - e.t0) / e.dur;
      if (u >= 1) { fx.splice(k, 1); continue; }
      if (e.kind === 'text') {
        ctx.save();
        ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        ctx.font = `900 ${Math.round(e.size)}px "M PLUS Rounded 1c",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const y = e.y - u * 24;
        const pop = u < 0.18 ? 0.4 + 0.75 * (u / 0.18) : u < 0.28 ? 1.15 - 0.15 * ((u - 0.18) / 0.1) : 1;
        ctx.translate(e.x, y); ctx.scale(pop, pop); ctx.translate(-e.x, -y);
        ctx.lineWidth = Math.max(3, e.size * 0.16); ctx.strokeStyle = 'rgba(20,10,40,.85)';
        ctx.strokeText(e.text, e.x, y);
        ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, y);
        ctx.restore();
      } else if (e.kind === 'orb') {
        const x = e.x0 + (e.x1 - e.x0) * u, y = e.y0 + (e.y1 - e.y0) * u - Math.sin(u * Math.PI) * 60;
        const g = ctx.createRadialGradient(x, y, 0, x, y, e.r * 2);
        g.addColorStop(0, e.offset ? 'rgba(180,255,255,1)' : 'rgba(255,245,200,1)');
        g.addColorStop(0.4, e.offset ? 'rgba(80,200,255,.6)' : 'rgba(255,150,60,.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, e.r * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    if (charas && charas.drawOverlay) charas.drawOverlay(ctx, W, H, now);
  }

  return { draw, onEvents, setCalm(v) { CALM = !!v; }, get layout() { return layout; } };
}
