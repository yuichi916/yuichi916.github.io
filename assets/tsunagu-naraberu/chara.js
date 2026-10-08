// 盤の横のマスコット。つなぐ派「ぷにまる」（スライム）／ならべる派「カクたん」（四角）。
// ゲームの出来事（連鎖・おじゃま・ピンチ・勝ち負け）で表情と動きが変わり、吹き出しでしゃべる。見た目だけで中身は変えない。
const NAME = { tsunagu: 'ぷにまる', naraberu: 'カクたん' };
const COL = { tsunagu: { body: '#ff9a76', dark: '#e0603e', light: '#ffd2bf' }, naraberu: { body: '#5fd6e8', dark: '#1fa3bb', light: '#c9f6fd' } };
const SAY = { c1: 'えいっ！', c2: 'それっ！', c3: 'まだまだ！', c4: 'いっけー！', c5: 'とどめっ！', ouch: 'うわぁっ！', danger: 'あぶないっ！', win: 'やったー！', lose: 'まけたぁ…' };

export function createCharas({ onSay } = {}) {
  const st = [mk(), mk()];
  function mk() { return { mood: 'idle', until: 0, t0: 0, bubble: null, chain: 0, dangerSaid: 0, stars: [] }; }
  function reset() { st[0] = mk(); st[1] = mk(); }

  function set(p, mood, now, dur, say) {
    const s = st[p];
    s.mood = mood; s.t0 = now; s.until = now + dur;
    if (say) { s.bubble = { text: SAY[say], t0: now, dur: Math.max(0.9, dur) }; onSay && onSay(p, say); }
  }

  function onEvents(events, match, now) {
    for (const e of events) {
      if (e.type === 'pop' && e.chain >= 2) {
        const k = Math.min(5, e.chain - 1);
        set(e.p, e.chain >= 4 ? 'super' : 'happy', now, 1.0, `c${k}`);
        if (e.chain >= 4) for (let i = 0; i < 10; i++) st[e.p].stars.push({ a: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.8, t0: now, r: 0.06 + Math.random() * 0.06 });
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

  // ---- 描く ----
  function eyes(ctx, mood, x, y, r, t, blink) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineWidth = r * 0.22; ctx.strokeStyle = '#2b1d33'; ctx.fillStyle = '#2b1d33';
    const dx = r * 0.95;
    for (const sx of [-1, 1]) {
      const ex = x + sx * dx;
      if (mood === 'happy' || mood === 'super' || mood === 'win') {
        ctx.beginPath(); ctx.arc(ex, y + r * 0.25, r * 0.55, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else if (mood === 'ouch') {
        ctx.beginPath(); ctx.moveTo(ex - sx * r * 0.45, y - r * 0.35); ctx.lineTo(ex + sx * r * 0.35, y); ctx.lineTo(ex - sx * r * 0.45, y + r * 0.35); ctx.stroke();
      } else if (mood === 'lose') {
        ctx.beginPath(); ctx.moveTo(ex - r * 0.35, y - r * 0.35); ctx.lineTo(ex + r * 0.35, y + r * 0.35); ctx.moveTo(ex + r * 0.35, y - r * 0.35); ctx.lineTo(ex - r * 0.35, y + r * 0.35); ctx.stroke();
      } else if (blink) {
        ctx.beginPath(); ctx.moveTo(ex - r * 0.45, y + r * 0.1); ctx.lineTo(ex + r * 0.45, y + r * 0.1); ctx.stroke();
      } else {
        const big = mood === 'panic' ? 0.75 : 1;
        ctx.beginPath(); ctx.ellipse(ex, y, r * 0.5 * big, r * 0.62 * big, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(ex + r * 0.16, y - r * 0.22, r * 0.2 * big, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex - r * 0.14, y + r * 0.2, r * 0.09 * big, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2b1d33';
      }
    }
    ctx.restore();
  }
  function mouth(ctx, mood, x, y, r) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = r * 0.16; ctx.strokeStyle = '#2b1d33';
    if (mood === 'happy' || mood === 'super' || mood === 'win') {
      ctx.fillStyle = '#ff5f7a'; ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.45, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (mood === 'ouch' || mood === 'lose') {
      ctx.beginPath(); ctx.moveTo(x - r * 0.45, y + r * 0.1);
      for (let k = 1; k <= 4; k++) ctx.lineTo(x - r * 0.45 + k * r * 0.225, y + r * (k % 2 ? -0.08 : 0.1));
      ctx.stroke();
    } else if (mood === 'panic') {
      ctx.fillStyle = '#2b1d33'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.05, r * 0.2, r * 0.27, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y - r * 0.15, r * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }
  function blush(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,110,140,.45)';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sx * r * 1.7, y + r * 0.55, r * 0.42, r * 0.24, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  function sweat(ctx, x, y, r, t) {
    ctx.fillStyle = 'rgba(140,210,255,.95)';
    const k = (t * 1.6) % 1;
    ctx.beginPath(); ctx.moveTo(x, y + k * r); ctx.quadraticCurveTo(x + r * 0.35, y + r * 0.55 + k * r, x, y + r * 0.75 + k * r);
    ctx.quadraticCurveTo(x - r * 0.35, y + r * 0.55 + k * r, x, y + k * r); ctx.fill();
  }

  function drawOne(ctx, p, kind, cx, baseY, size, now, danger) {
    const s = st[p];
    if (s.mood !== 'win' && s.mood !== 'lose' && now > s.until) s.mood = danger ? 'panic' : 'idle';
    if (danger && s.mood === 'panic' && now - s.dangerSaid > 6) { s.dangerSaid = now; s.bubble = { text: SAY.danger, t0: now, dur: 1.1 }; onSay && onSay(p, 'danger'); }
    const mood = s.mood, u = now - s.t0, c = COL[kind];
    // 体の動き
    let jump = 0, sx = 1, sy = 1, shakeX = 0, tilt = 0;
    const breathe = Math.sin(now * 3 + p) * 0.03;
    sx = 1 + breathe; sy = 1 - breathe;
    if (mood === 'happy' || mood === 'super') { const k = Math.min(1, u / 0.45); jump = Math.sin(k * Math.PI) * size * (mood === 'super' ? 0.55 : 0.35); if (k < 0.15) { sx = 1.15; sy = 0.85; } }
    if (mood === 'win') { const k = (u * 2.2) % 1; jump = Math.sin(k * Math.PI) * size * 0.4; tilt = Math.sin(u * 4.4) * 0.12; }
    if (mood === 'ouch') { shakeX = Math.sin(u * 60) * size * 0.06 * Math.max(0, 1 - u / 0.6); sx = 1.12; sy = 0.86; }
    if (mood === 'panic') { shakeX = Math.sin(now * 45) * size * 0.025; }
    if (mood === 'lose') { const k = Math.min(1, u / 0.5); sx = 1 + 0.25 * k; sy = 1 - 0.3 * k; }
    const x = cx + shakeX, y = baseY - jump;
    const blink = (now + p * 1.7) % 3.4 < 0.12;
    ctx.save();
    // 影
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(cx, baseY + size * 0.02, size * 0.42 * (1 - jump / size * 0.5), size * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(sx, sy);
    const W = size, H = size * 0.86;
    // 体
    const gr = ctx.createLinearGradient(0, -H, 0, 0);
    gr.addColorStop(0, c.light); gr.addColorStop(0.35, c.body); gr.addColorStop(1, c.dark);
    ctx.fillStyle = gr; ctx.strokeStyle = 'rgba(40,20,50,.55)'; ctx.lineWidth = Math.max(2, size * 0.035);
    ctx.beginPath();
    if (kind === 'tsunagu') {
      // しずく形のスライム
      ctx.moveTo(-W * 0.5, -H * 0.18);
      ctx.bezierCurveTo(-W * 0.5, -H * 0.75, -W * 0.18, -H * 1.02, 0, -H * 1.05);
      ctx.bezierCurveTo(W * 0.18, -H * 1.02, W * 0.5, -H * 0.75, W * 0.5, -H * 0.18);
      ctx.bezierCurveTo(W * 0.5, H * 0.02, -W * 0.5, H * 0.02, -W * 0.5, -H * 0.18);
    } else {
      const r = W * 0.18, x0 = -W * 0.46, y0 = -H * 0.98, w = W * 0.92, h = H * 0.98;
      ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // つや
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(-W * 0.22, -H * 0.72, W * 0.12, H * 0.07, -0.6, 0, Math.PI * 2); ctx.fill();
    // 飾り: カクたんは星のアンテナ、ぷにまるは頭のぴょこ
    if (kind === 'naraberu') {
      const sw = Math.sin(now * 5 + p) * 0.25;
      ctx.strokeStyle = c.dark; ctx.lineWidth = Math.max(2, size * 0.04);
      ctx.beginPath(); ctx.moveTo(0, -H * 0.98); ctx.quadraticCurveTo(W * 0.05, -H * 1.18, Math.sin(sw) * W * 0.18, -H * 1.3); ctx.stroke();
      star(ctx, Math.sin(sw) * W * 0.18, -H * 1.32, W * 0.1, '#ffd23f');
    } else {
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.ellipse(W * 0.04, -H * 1.07, W * 0.07, H * 0.06, 0.5, 0, Math.PI * 2); ctx.fill();
    }
    // 顔
    const fr = W * 0.1, fy = -H * 0.48;
    blush(ctx, 0, fy, fr);
    eyes(ctx, mood, 0, fy, fr, now, blink);
    mouth(ctx, mood, 0, fy + fr * 1.35, fr);
    if (mood === 'panic' || mood === 'ouch') sweat(ctx, W * 0.42, -H * 0.85, fr * 1.6, now);
    if (mood === 'lose') { ctx.fillStyle = 'rgba(120,200,255,.9)'; for (const k of [-1, 1]) { ctx.beginPath(); ctx.ellipse(k * fr * 1.1, fy + fr * (0.9 + ((now * 1.5) % 1) * 1.6), fr * 0.18, fr * 0.3, 0, 0, Math.PI * 2); ctx.fill(); } }
    ctx.restore();
    // 星（大連鎖・勝ち）
    for (let i = s.stars.length - 1; i >= 0; i--) {
      const q = s.stars[i], k = (now - q.t0) / 1.1;
      if (k > 1) { s.stars.splice(i, 1); continue; }
      const d = size * (0.4 + k * q.sp);
      ctx.globalAlpha = 1 - k; star(ctx, cx + Math.cos(q.a) * d, baseY - size * 0.5 + Math.sin(q.a) * d, size * q.r * (1 + k), '#fff3a8'); ctx.globalAlpha = 1;
    }
    if (mood === 'win' && Math.random() < 0.25) s.stars.push({ a: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.6, t0: now, r: 0.05 + Math.random() * 0.05 });
    // 名前
    ctx.fillStyle = 'rgba(233,236,255,.85)'; ctx.font = `800 ${Math.round(Math.max(11, size * 0.14))}px "M PLUS Rounded 1c",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(NAME[kind], cx, baseY + size * 0.12);
    // 吹き出し
    if (s.bubble) {
      const b = s.bubble, k = (now - b.t0) / b.dur;
      if (k > 1) s.bubble = null;
      else {
        const sc = k < 0.12 ? 0.6 + 0.4 * (k / 0.12) * 1.1 : 1, a = k > 0.8 ? (1 - k) / 0.2 : 1;
        const fs = Math.round(Math.max(13, size * 0.2));
        ctx.save(); ctx.globalAlpha = a;
        ctx.font = `900 ${fs}px "M PLUS Rounded 1c",sans-serif`;
        const tw = ctx.measureText(b.text).width + fs * 1.1, th = fs * 1.7;
        const bx = cx, by = baseY - size * 1.25 - jump * 0.3;
        ctx.translate(bx, by); ctx.scale(sc, sc);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(40,20,50,.8)'; ctx.lineWidth = 2.5;
        rr(ctx, -tw / 2, -th, tw, th, th * 0.45); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-fs * 0.3, -1); ctx.lineTo(0, fs * 0.55); ctx.lineTo(fs * 0.3, -1); ctx.fill();
        ctx.fillStyle = '#2b1d33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.text, 0, -th / 2 + 1);
        ctx.restore();
      }
    }
  }

  function star(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr2 = k % 2 ? r * 0.45 : r; const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill();
  }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // 盤の外側にキャラを置く（PC: P1 の左・P2 の右。スマホ: 小さく盤の右上）
  function draw(ctx, layout, match, now, W) {
    if (!match || !layout) return;
    match.players.forEach((pl, p) => {
      const L = layout.boards[p], s = L.s;
      const danger = pl.kind === 'naraberu' ? pl.board.grace < match.cfg.topGraceSec * 60 : pl.board.grid[3][2] !== 0;
      let cx, base, size;
      if (layout.mobile) {
        if (p === 1) return;
        size = Math.min(70, s * 2.2); cx = layout.boards[1].X + layout.boards[1].s * 3; base = layout.hud.y + 44 + size * 1.5;   // 時計と攻撃倍率の2行の下に、吹き出しが重ならないよう置く
      } else {
        const room = p === 0 ? L.X - 20 : W - (L.X + s * 6) - 20;
        size = Math.min(s * 3.2, room * 0.8);
        if (size < 50) return;
        cx = p === 0 ? L.X - 14 - room / 2 : L.X + s * 6 + 14 + room / 2;
        base = L.Y + s * 12 - size * 0.25;
      }
      drawOne(ctx, p, pl.kind, cx, base, size, now, danger && !match.result);
    });
  }

  return { reset, onEvents, finish, draw };
}
