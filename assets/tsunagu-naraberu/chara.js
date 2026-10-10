// 盤の横のキャラ: 女の子の立ち絵（表情7種）と、足元の相棒マスコット（ぷにまる／カクたん）。
// ゲームの出来事（連鎖・おじゃま・ピンチ・勝ち負け）で表情と動きが変わり、吹き出しでしゃべる。4連鎖以上でカットイン。
// 見た目だけで、ゲームの中身は変えない。キャラ定義は characters.js。
import { CHAR, EXPRESSIONS, spritePath } from './characters.js';

const BASE = new URL('./', import.meta.url).href;
const PARTNER = { tsunagu: { name: 'ぷにまる', body: '#ff9a76', dark: '#e0603e', light: '#ffd2bf' },
  naraberu: { name: 'カクたん', body: '#5fd6e8', dark: '#1fa3bb', light: '#c9f6fd' } };
const MOOD_EXPR = { idle: 'normal', happy: 'happy', super: 'attack', ouch: 'ouch', panic: 'pinch', win: 'win', lose: 'lose' };

// ---- 立ち絵の読み込み（キャラごとに1回） ----
const cache = new Map();
export function loadCharacter(id) {
  if (cache.has(id)) return cache.get(id).ready;
  const imgs = {};
  const names = [...EXPRESSIONS, 'select', 'cutin'];
  const ready = Promise.all(names.map(n => new Promise(res => {
    const im = new Image();
    im.onload = () => { imgs[n] = im; res(); };
    im.onerror = () => res(); // 読めない絵は描かない（相棒だけ描く）
    im.src = BASE + spritePath(id, n);
  })));
  cache.set(id, { imgs, ready });
  return ready;
}
export const charImage = (id, name) => (cache.get(id) || { imgs: {} }).imgs[name] || null;

export function createCharas({ onSay, effects = () => 'high' } = {}) {
  let ids = [null, null];
  const st = [mk(), mk()];
  const cutins = [];
  function mk() { return { mood: 'idle', until: 0, t0: 0, bubble: null, dangerSaid: 0, stars: [], expr: 'normal', prev: null, swT: -9 }; }
  function reset() { st[0] = mk(); st[1] = mk(); cutins.length = 0; }
  function setChars(list) { ids = list.slice(); ids.forEach(id => id && loadCharacter(id)); }

  function say(p, key, now, dur = 1.1) {
    const c = CHAR[ids[p]];
    const text = c ? c.lines[key] : null;
    if (!text) return;
    st[p].bubble = { text, t0: now, dur: Math.max(0.9, dur) };
    onSay && onSay(p, key, ids[p]);
  }
  function set(p, mood, now, dur, key) {
    const s = st[p];
    s.mood = mood; s.t0 = now; s.until = now + dur;
    if (key) say(p, key, now, dur);
  }
  function start(now) { [0, 1].forEach(p => say(p, 'start', now + p * 0.25, 1.2)); }

  function onEvents(events, match, now) {
    for (const e of events) {
      if (e.type === 'pop' && e.chain >= 2) {
        const k = Math.min(5, e.chain - 1);
        set(e.p, e.chain >= 4 ? 'super' : 'happy', now, 1.0, `c${k}`);
        if (e.chain >= 4) {
          for (let i = 0; i < 10; i++) st[e.p].stars.push({ a: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.8, t0: now, r: 0.06 + Math.random() * 0.06 });
          if (effects() !== 'low') cutins.splice(0, cutins.length, { p: e.p, t0: now, id: ids[e.p], text: (CHAR[ids[e.p]] || { lines: {} }).lines[`c${k}`] || '' });
        }
      }
      if (e.type === 'garbage') {
        const big = (e.n || (e.w * e.h) || 0) >= 6;
        if (st[e.p].mood !== 'lose') set(e.p, 'ouch', now, 0.9, big ? 'ouch' : null);
      }
    }
  }

  function finish(match, now) {
    const w = match.result.winner;
    [0, 1].forEach(p => set(p, w === p ? 'win' : w === -1 ? 'idle' : 'lose', now, 999, w === p ? 'win' : w === -1 ? null : 'lose'));
  }

  // ---- 相棒マスコット（canvas で描く） ----
  function mascot(ctx, kind, cx, baseY, size, now, mood, seed) {
    const c = PARTNER[kind];
    const hop = mood === 'happy' || mood === 'super' || mood === 'win' ? Math.abs(Math.sin(now * 9 + seed)) * size * 0.25 : 0;
    const squash = 1 + Math.sin(now * 3.2 + seed) * 0.04;
    const y = baseY - hop, W = size, H = size * 0.86;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(cx, baseY + 2, W * 0.4, W * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx, y); ctx.scale(squash, 2 - squash);
    const gr = ctx.createLinearGradient(0, -H, 0, 0);
    gr.addColorStop(0, c.light); gr.addColorStop(0.4, c.body); gr.addColorStop(1, c.dark);
    ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(40,20,50,.6)'; ctx.lineWidth = Math.max(1.5, size * 0.045);
    ctx.beginPath();
    if (kind === 'tsunagu') {
      ctx.moveTo(-W * 0.5, -H * 0.2);
      ctx.bezierCurveTo(-W * 0.5, -H * 0.78, -W * 0.16, -H * 1.04, 0, -H * 1.06);
      ctx.bezierCurveTo(W * 0.16, -H * 1.04, W * 0.5, -H * 0.78, W * 0.5, -H * 0.2);
      ctx.bezierCurveTo(W * 0.5, H * 0.02, -W * 0.5, H * 0.02, -W * 0.5, -H * 0.2);
    } else {
      const r = W * 0.2, x0 = -W * 0.46, y0 = -H * 0.98, w = W * 0.92, h = H * 0.98;
      ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(-W * 0.2, -H * 0.72, W * 0.12, H * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    // 顔: まばたきする目と、ほっぺ
    const fy = -H * 0.46, er = W * 0.07, blink = (now + seed * 1.7) % 3.1 < 0.12;
    ctx.fillStyle = 'rgba(255,110,140,.5)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * W * 0.24, fy + er * 1.3, er * 1.1, er * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#2b1d33'; ctx.strokeStyle = '#2b1d33'; ctx.lineWidth = Math.max(1.5, er * 0.5); ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      const ex = sx * W * 0.13;
      if (blink || mood === 'happy' || mood === 'super' || mood === 'win') { ctx.beginPath(); ctx.arc(ex, fy + er * 0.4, er * 0.9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      else if (mood === 'ouch' || mood === 'lose') { ctx.beginPath(); ctx.moveTo(ex - er * 0.7, fy - er * 0.7); ctx.lineTo(ex + er * 0.7, fy + er * 0.7); ctx.moveTo(ex + er * 0.7, fy - er * 0.7); ctx.lineTo(ex - er * 0.7, fy + er * 0.7); ctx.stroke(); }
      else { ctx.beginPath(); ctx.ellipse(ex, fy, er * 0.75, er, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + er * 0.25, fy - er * 0.35, er * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#2b1d33'; }
    }
    ctx.restore();
  }

  // ---- 立ち絵 ----
  function portrait(ctx, p, kind, cx, baseY, size, now, danger, dup) {
    const s = st[p];
    if (s.mood !== 'win' && s.mood !== 'lose' && now > s.until) s.mood = danger ? 'panic' : 'idle';
    if (danger && s.mood === 'panic' && now - s.dangerSaid > 6) { s.dangerSaid = now; say(p, 'danger', now); }
    const mood = s.mood, u = now - s.t0;
    const expr = MOOD_EXPR[mood] || 'normal';
    if (expr !== s.expr) { s.prev = s.expr; s.expr = expr; s.swT = now; }
    // 体の動き（立ち絵なので小さめに）
    let jump = 0, shakeX = 0, tilt = 0, sink = 0;
    if (mood === 'happy' || mood === 'super') { const k = Math.min(1, u / 0.45); jump = Math.sin(k * Math.PI) * size * (mood === 'super' ? 0.07 : 0.04); }
    if (mood === 'win') { jump = Math.abs(Math.sin(u * 5)) * size * 0.04; tilt = Math.sin(u * 2.6) * 0.03; }
    if (mood === 'ouch') shakeX = Math.sin(u * 60) * size * 0.02 * Math.max(0, 1 - u / 0.6);
    if (mood === 'panic') shakeX = Math.sin(now * 38) * size * 0.006;
    if (mood === 'lose') sink = Math.min(1, u / 0.6) * size * 0.04;
    const breathe = 1 + Math.sin(now * 2.4 + p) * 0.008;
    const id = ids[p];
    const cur = id && charImage(id, s.expr);
    const x = cx + shakeX, y = baseY - jump + sink;
    ctx.save();
    // 足元の影
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(cx, baseY, size * 0.22, size * 0.025, 0, 0, Math.PI * 2); ctx.fill();
    if (cur) {
      const h = size, w = cur.width * h / cur.height;
      ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(1, breathe);
      if (dup) { ctx.shadowColor = 'rgba(160,140,255,.9)'; ctx.shadowBlur = size * 0.05; }
      const k = Math.min(1, (now - s.swT) / 0.12);
      const prev = s.prev && k < 1 ? charImage(id, s.prev) : null;
      if (prev) { ctx.globalAlpha = 1 - k; ctx.drawImage(prev, -w / 2, -h, w, h); }
      ctx.globalAlpha = prev ? k : 1; ctx.drawImage(cur, -w / 2, -h, w, h);
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    }
    ctx.restore();
    // 相棒は立ち絵の手前、盤から遠い側の足元
    const ms = size * 0.24, side = p === 0 ? -1 : 1;
    mascot(ctx, kind, cx + side * size * 0.22, baseY + 2, ms, now, mood, p * 3.1);
    // 星（大連鎖・勝ち）
    for (let i = s.stars.length - 1; i >= 0; i--) {
      const q = s.stars[i], k = (now - q.t0) / 1.1;
      if (k > 1) { s.stars.splice(i, 1); continue; }
      const d = size * (0.15 + k * q.sp * 0.35);
      ctx.globalAlpha = 1 - k; star(ctx, cx + Math.cos(q.a) * d, baseY - size * 0.6 + Math.sin(q.a) * d, size * q.r * 0.35 * (1 + k), '#fff3a8'); ctx.globalAlpha = 1;
    }
    if (mood === 'win' && Math.random() < 0.25) s.stars.push({ a: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.6, t0: now, r: 0.05 + Math.random() * 0.05 });
    // 名札
    const c = CHAR[id];
    if (c) {
      const fs = Math.round(Math.max(12, size * 0.055));
      ctx.font = `900 ${fs}px "M PLUS Rounded 1c",sans-serif`;
      const label = dup ? `${c.name}（2P）` : c.name;
      const tw = ctx.measureText(label).width + fs * 1.4, th = fs * 1.6;
      ctx.fillStyle = 'rgba(10,8,26,.82)'; rr(ctx, cx - tw / 2, baseY + 6, tw, th, th / 2); ctx.fill();
      ctx.strokeStyle = c.color.main; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, cx, baseY + 6 + th / 2 + 1);
    }
    bubble(ctx, s, cx, baseY - size * 1.02 - jump, Math.max(13, size * 0.06), now);
  }

  function bubble(ctx, s, bx, by, fs, now) {
    if (!s.bubble) return;
    const b = s.bubble, k = (now - b.t0) / b.dur;
    if (k < 0) return;
    if (k > 1) { s.bubble = null; return; }
    const sc = k < 0.12 ? 0.6 + 0.4 * (k / 0.12) * 1.1 : 1, a = k > 0.8 ? (1 - k) / 0.2 : 1;
    fs = Math.round(fs);
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `900 ${fs}px "M PLUS Rounded 1c",sans-serif`;
    const tw = ctx.measureText(b.text).width + fs * 1.1, th = fs * 1.7;
    ctx.translate(bx, by); ctx.scale(sc, sc);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,20,50,.8)'; ctx.lineWidth = 2.5;
    rr(ctx, -tw / 2, -th, tw, th, th * 0.45); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-fs * 0.3, -1); ctx.lineTo(0, fs * 0.55); ctx.lineTo(fs * 0.3, -1); ctx.fill();
    ctx.fillStyle = '#2b1d33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, 0, -th / 2 + 1);
    ctx.restore();
  }

  function star(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r2 = k % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * r2, py = y + Math.sin(a) * r2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill();
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // 相手の顔アイコン（スマホ）
  function faceIcon(ctx, id, cx, cy, r, mood) {
    const im = charImage(id, MOOD_EXPR[mood] || 'normal');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,8,26,.9)'; ctx.fill();
    if (im) {
      ctx.clip();
      const h = r * 5.2, w = im.width * h / im.height;
      ctx.drawImage(im, cx - w / 2, cy - r * 1.55, w, h);
    }
    ctx.restore();
    ctx.strokeStyle = (CHAR[id] || { color: { main: '#fff' } }).color.main; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  // 盤の外側にキャラを置く（PC: P1 の左・P2 の右。スマホ: 自分は右の列に小さく、相手は小さい盤の上に顔アイコン）
  function draw(ctx, layout, match, now, W) {
    if (!match || !layout) return;
    const dup = ids[0] && ids[0] === ids[1];
    match.players.forEach((pl, p) => {
      const L = layout.boards[p], s = L.s;
      const danger = pl.kind === 'naraberu' ? pl.board.grace < pl.board.graceMax : pl.board.grid[3][2] !== 0;
      if (layout.mobile) {
        if (p === 1) { faceIcon(ctx, ids[1], L.X + L.s * 6 - 14, L.Y - 22, 16, st[1].mood); return; }
        const colW = layout.boards[1].s * 6;
        const size = Math.min(colW * 1.45, 200);
        portrait(ctx, 0, pl.kind, layout.boards[1].X + colW / 2, layout.hud.y + 74 + size, size, now, danger && !match.result, false);
        return;
      }
      const room = p === 0 ? L.X - 20 : W - (L.X + s * 6) - 20;
      const size = Math.min(s * 9.5, room * 1.35);
      if (size < 90) return;
      const cx = p === 0 ? L.X - 14 - room / 2 : L.X + s * 6 + 14 + room / 2;
      portrait(ctx, p, pl.kind, cx, L.Y + s * 12 - s * 0.6, size, now, danger && !match.result, dup && p === 1);
    });
  }

  // カットイン（盤や時計より手前に描く）: 帯が横切り、顔と台詞が流れ込む
  function drawOverlay(ctx, W, H, now) {
    for (let i = cutins.length - 1; i >= 0; i--) {
      const c = cutins[i], u = (now - c.t0) / 0.85;
      if (u > 1) { cutins.splice(i, 1); continue; }
      const im = charImage(c.id, 'cutin'), col = (CHAR[c.id] || { color: { main: '#fff', sub: '#fff' } }).color;
      const ease = u < 0.18 ? u / 0.18 : u > 0.82 ? (1 - u) / 0.18 : 1;
      const bh = Math.min(H * 0.26, 220) * ease, by = H * 0.42;
      const dir = c.p === 0 ? 1 : -1;
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = 'rgba(10,8,26,.88)'; ctx.fillRect(0, by - bh / 2, W, bh);
      ctx.beginPath(); ctx.rect(0, by - bh / 2, W, bh); ctx.clip();
      // 集中線
      ctx.strokeStyle = col.main; ctx.globalAlpha = 0.45; ctx.lineWidth = 3;
      for (let k = 0; k < 26; k++) {
        const yy = by - bh / 2 + ((k * 37 + now * 900 * dir) % bh + bh) % bh;
        const len = 80 + (k * 53) % 160, xx = ((k * 97 + now * 1600 * dir) % (W + 400) + W + 400) % (W + 400) - 200;
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len * dir, yy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (im) {
        const ih = bh * 1.05, iw = im.width * ih / im.height;
        const slide = (1 - Math.min(1, u / 0.25)) * W * 0.4 * -dir;
        const ix = (c.p === 0 ? W * 0.08 : W * 0.92 - iw) + slide;
        ctx.drawImage(im, ix, by - ih / 2, iw, ih);
      }
      const fs = Math.round(Math.max(20, bh * 0.22));
      ctx.font = `900 ${fs}px "M PLUS Rounded 1c",sans-serif`;
      ctx.textAlign = c.p === 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
      const tx = c.p === 0 ? W * 0.5 : W * 0.5;
      ctx.lineWidth = Math.max(4, fs * 0.16); ctx.strokeStyle = 'rgba(10,8,26,.95)'; ctx.strokeText(c.text, tx, by);
      ctx.fillStyle = col.sub === '#fff1d6' ? '#fff3a8' : '#fff'; ctx.fillText(c.text, tx, by);
      ctx.restore();
    }
  }

  return { reset, setChars, start, say, onEvents, finish, draw, drawOverlay, get ids() { return ids.slice(); } };
}
