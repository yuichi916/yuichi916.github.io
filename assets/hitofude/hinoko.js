// 一筆花火のマスコット「ヒノコ」。導火線を走る火の粉そのもの。
// Canvas 2D だけで描く（画像ファイルなし）。タイトル・盤面・お知らせカード・結果・シェア画像で同じ関数を使う。
//
// 形は、しずく形の炎 1 つと、顔の中心より下に置いた縦長の目 2 つ・ほっぺ。24px でも読めるよう線は使わない。
// 表情: idle（・・）/ blink / joy（^ ^）/ effort（> <）/ star（★ ★）/ sad（ー ー と汗）/ wow（o o）/ fizzle（× ×）

const INK = '#3a1606';

// (x, y) はからだの丸の中心、r はその半径。t は秒（ゆらぎ用）
export function drawHinoko(g, x, y, r, opts = {}) {
  const { face = 'idle', t = 0, dir = null, stretch = 0, glow = true, still = false } = opts;
  g.save();
  g.translate(x, y);
  // 走っているときは、炎の先を進む向きと逆へなびかせる（顔は正面のまま）
  const lean = dir !== null ? -Math.cos(dir) * Math.min(1, stretch) : 0;
  if (!still && dir === null) {
    const b = Math.sin(t * 3.2) * 0.045; // 息をするように、ゆっくり伸び縮み
    g.translate(0, r * b * 0.6);
    g.scale(1 + b, 1 - b);
  }
  if (glow) {
    const gl = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.6);
    gl.addColorStop(0, 'rgba(255,190,80,.45)'); gl.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 2.6, 0, Math.PI * 2); g.fill();
  }
  // からだ（しずく形。先がゆらゆら揺れる）
  const flick = still ? 0 : Math.sin(t * 5.3) * r * 0.22 + Math.sin(t * 8.1) * r * 0.08;
  const sway = lean * r * 1.25 + flick * (1 - Math.abs(lean) * 0.5);
  const tipX = sway, tipY = -r * (2.05 - Math.abs(lean) * 0.35);
  g.beginPath();
  g.moveTo(tipX, tipY);
  g.bezierCurveTo(r * 0.35 + sway * 0.5, -r * 1.35, r * 1.02, -r * 0.7, r, 0);
  g.arc(0, 0, r, 0, Math.PI, false);
  g.bezierCurveTo(-r * 1.02, -r * 0.7, -r * 0.35 + sway * 0.5, -r * 1.35, tipX, tipY);
  g.closePath();
  const body = g.createRadialGradient(0, r * 0.1, r * 0.1, 0, -r * 0.2, r * 1.9);
  body.addColorStop(0, '#fff6c4'); body.addColorStop(0.45, '#ffc93c'); body.addColorStop(0.8, '#ff8a1e'); body.addColorStop(1, '#f2551a');
  g.fillStyle = body; g.fill();
  // 内側の明るい芯
  g.beginPath(); g.ellipse(-r * 0.25, -r * 0.55, r * 0.22, r * 0.34, -0.3, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,235,.55)'; g.fill();
  drawFace(g, r, face);
  g.restore();
}

function drawFace(g, r, face) {
  const ex = r * 0.36, ey = r * 0.12, ew = r * 0.15, eh = r * 0.25;
  g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = Math.max(1, r * 0.11);
  // ほっぺ
  g.fillStyle = 'rgba(255,90,120,.55)';
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * r * 0.62, ey + r * 0.3, r * 0.17, r * 0.1, 0, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = INK;
  const eyes = (fn) => { for (const s of [-1, 1]) fn(s * ex, ey, s); };
  switch (face) {
    case 'blink':
      eyes((x, y) => { g.beginPath(); g.moveTo(x - ew, y + eh * 0.2); g.quadraticCurveTo(x, y + eh * 0.55, x + ew, y + eh * 0.2); g.stroke(); });
      break;
    case 'joy':
      eyes((x, y) => { g.beginPath(); g.moveTo(x - ew * 1.1, y + eh * 0.3); g.quadraticCurveTo(x, y - eh * 0.9, x + ew * 1.1, y + eh * 0.3); g.stroke(); });
      break;
    case 'effort':
      eyes((x, y, s) => { g.beginPath(); g.moveTo(x + s * ew * 1.1, y - eh * 0.6); g.lineTo(x - s * ew * 0.9, y); g.lineTo(x + s * ew * 1.1, y + eh * 0.6); g.stroke(); });
      break;
    case 'star':
      eyes((x, y) => star(g, x, y, ew * 1.9));
      break;
    case 'sad':
      eyes((x, y, s) => { g.beginPath(); g.moveTo(x - ew * 1.1, y + (s < 0 ? eh * 0.1 : eh * 0.35)); g.lineTo(x + ew * 1.1, y + (s < 0 ? eh * 0.35 : eh * 0.1)); g.stroke(); });
      // 汗
      g.fillStyle = '#9fd8ff';
      g.beginPath(); g.moveTo(r * 0.78, -r * 0.55); g.quadraticCurveTo(r * 0.98, -r * 0.2, r * 0.8, -r * 0.08); g.quadraticCurveTo(r * 0.6, -r * 0.2, r * 0.78, -r * 0.55); g.fill();
      g.fillStyle = INK;
      break;
    case 'fizzle':
      eyes((x, y) => { const k = ew * 0.95; g.beginPath(); g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); g.stroke(); });
      break;
    case 'wow':
      eyes((x, y) => { g.beginPath(); g.ellipse(x, y, ew * 1.2, eh * 1.15, 0, 0, Math.PI * 2); g.fill(); hl(g, x, y, ew); });
      break;
    default:
      eyes((x, y) => { g.beginPath(); g.ellipse(x, y, ew, eh, 0, 0, Math.PI * 2); g.fill(); hl(g, x, y, ew); });
  }
  // 口
  g.beginPath();
  const my = ey + r * 0.34;
  if (face === 'joy' || face === 'star') { g.moveTo(-r * 0.2, my - r * 0.04); g.quadraticCurveTo(0, my + r * 0.34, r * 0.2, my - r * 0.04); g.closePath(); g.fillStyle = '#b3261e'; g.fill(); }
  else if (face === 'wow') { g.ellipse(0, my + r * 0.06, r * 0.1, r * 0.13, 0, 0, Math.PI * 2); g.fillStyle = '#b3261e'; g.fill(); }
  else if (face === 'sad' || face === 'fizzle') { g.moveTo(-r * 0.13, my + r * 0.1); g.quadraticCurveTo(0, my - r * 0.04, r * 0.13, my + r * 0.1); g.lineWidth = Math.max(1, r * 0.08); g.stroke(); }
  else if (face === 'effort') { g.moveTo(-r * 0.15, my + r * 0.04); g.lineTo(r * 0.15, my + r * 0.04); g.lineWidth = Math.max(1, r * 0.08); g.stroke(); }
  else { g.moveTo(-r * 0.14, my); g.quadraticCurveTo(-r * 0.07, my + r * 0.1, 0, my); g.quadraticCurveTo(r * 0.07, my + r * 0.1, r * 0.14, my); g.lineWidth = Math.max(1, r * 0.07); g.stroke(); }
}
function hl(g, x, y, ew) {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x - ew * 0.3, y - ew * 0.55, ew * 0.42, 0, Math.PI * 2); g.fill(); g.fillStyle = INK;
}
function star(g, x, y, R) {
  g.save(); g.fillStyle = '#fff3a0'; g.strokeStyle = INK; g.lineWidth = Math.max(0.8, R * 0.18);
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill(); g.stroke(); g.restore();
}

// まばたき: 2〜6 秒おきに 0.15 秒だけ目を閉じる。ときどき 2 回つづけて
export function blinkAt(t, seed = 0) {
  const period = 4.2 + (seed % 7) * 0.3;
  const p = (t + seed * 1.37) % period;
  return p < 0.15 || (Math.floor((t + seed * 1.37) / period) % 3 === 0 && p > 0.3 && p < 0.45);
}
