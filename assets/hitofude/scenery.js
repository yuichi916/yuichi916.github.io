// 一筆花火の背景の「動くもの」。夜空・川・見物の人たち（見た目だけ）。
// 縦（スマホ）と横（パソコン）で空の高さが違うので、町の屋根の線 hz（論理座標の y）を受け取って、そこを基準に描く。
//   staticSky: 夜ごとに一度だけ描く（天の川の帯・地平の町あかり）
//   drawSky:   またたく星と流れ星
//   drawTown:  屋台の提灯の列（屋台の夜）と、川をゆく屋形船
//   drawCrowd: 手前の見物客。大きな連鎖で手を上げ、スマホを掲げ、「たまや〜」と声が上がる
//   paintLand: 夜ごとに一度だけ描く陸の絵（夜の雲・山の重なり・木立・瓦屋根の町・五重塔・太鼓橋・柳・月の道・紙の質感）

export function createScenery() {
  let excite = 0, nextShoot = 4, twinkleKey = '', twinkles = [], lastV = { L: 0, R: 360, T: 0, B: 640 };
  const shooting = [], cheers = [];
  const rnd = mulberry(20260926);
  const people = Array.from({ length: 30 }, (_, i) => ({ u: (i + rnd() * 0.6) / 30, h: 0.85 + rnd() * 0.35, phone: rnd() < 0.2, kid: rnd() < 0.12, ph: rnd() * 10, arms: 0 }));
  // 灯籠流し: 川をゆっくり流れる灯籠
  const toro = Array.from({ length: 14 }, (_, i) => ({ u: (i + rnd() * 0.7) / 14, lane: rnd(), sp: 3 + rnd() * 3, ph: rnd() * 6.28, warm: rnd() < 0.75 }));

  const api = {
    // 大きな連鎖や尺玉で、見物客が沸く（0〜1 を足す）
    excite(v) { excite = Math.min(1.5, excite + v); },
    cheer(text) {
      // 声は同時に 2 つまで。前の声と離れた人から上げる（重なって読めなくならないように）
      if (cheers.some((c) => c.text === text)) return;
      const far = people.filter((p) => cheers.every((c) => Math.abs(c.u - p.u) > 0.22));
      const pool = far.length ? far : people, p = pool[Math.floor(Math.random() * pool.length)];
      cheers.push({ u: Math.min(0.9, Math.max(0.1, p.u)), text, t: 0, max: 1.6 });
      while (cheers.length > 2) cheers.shift();
    },
    tick(dt) {
      excite = Math.max(0, excite - dt * 0.35);
      nextShoot -= dt;
      if (nextShoot <= 0) {
        nextShoot = 6 + Math.random() * 8;
        const dir = Math.random() < 0.5 ? 1 : -1, w = lastV.R - lastV.L;
        shooting.push({ x: dir > 0 ? lastV.L - 20 + Math.random() * w * 0.55 : lastV.L + w * 0.45 + Math.random() * w * 0.55, y: Math.max(lastV.T, 0) + 20 + Math.random() * 120, vx: dir * (260 + Math.random() * 120), vy: 90 + Math.random() * 60, t: 0, max: 0.7 });
      }
      for (const s of shooting) s.t += dt;
      for (let i = shooting.length - 1; i >= 0; i--) if (shooting[i].t > shooting[i].max) shooting.splice(i, 1);
      for (const c of cheers) c.t += dt;
      for (let i = cheers.length - 1; i >= 0; i--) if (cheers[i].t > cheers[i].max) cheers.splice(i, 1);
      for (const p of people) {
        const want = excite > 0.25 && Math.sin(p.ph * 7.3) + excite > 0.6 ? 1 : 0;
        p.arms += (want - p.arms) * Math.min(1, dt * 6);
      }
    },
    // 夜ごとの背景（キャッシュに一度だけ）
    staticSky(g, v, { milky = 0, hz = 562 } = {}) {
      // 地平の町あかり
      const glow = g.createLinearGradient(0, hz - 132, 0, hz);
      glow.addColorStop(0, 'rgba(255,150,80,0)'); glow.addColorStop(1, 'rgba(255,150,90,.16)');
      g.fillStyle = glow; g.fillRect(v.L, hz - 132, v.R - v.L, 132);
      if (milky <= 0) return;
      // 天の川: 左下から右上へ流れる、ぼんやりした帯と、細かい星
      g.save();
      g.translate((v.L + v.R) / 2, hz * 0.445); g.rotate(-0.55);
      const w = (v.R - v.L) * 1.8;
      const band = g.createLinearGradient(0, -70, 0, 70);
      band.addColorStop(0, 'rgba(160,170,255,0)'); band.addColorStop(0.5, `rgba(200,205,255,${0.13 * milky})`); band.addColorStop(1, 'rgba(160,170,255,0)');
      g.fillStyle = band; g.fillRect(-w / 2, -70, w, 140);
      const r = mulberry(77);
      for (let i = 0; i < 520 * milky; i++) {
        const x = (r() - 0.5) * w, y = ((r() + r() + r()) / 3 - 0.5) * 120;
        g.globalAlpha = 0.25 + r() * 0.6; g.fillStyle = r() < 0.2 ? '#ffe9c9' : '#dfe6ff';
        g.fillRect(x, y, r() < 0.08 ? 1.3 : 0.7, r() < 0.08 ? 1.3 : 0.7);
      }
      g.restore();
    },
    drawSky(g, tt, v, hz = 562) {
      lastV = v;
      const key = `${v.L | 0},${v.R | 0},${v.T | 0},${hz}`;
      if (key !== twinkleKey) {
        twinkleKey = key;
        const r = mulberry(4243), n = Math.round(46 * Math.max(1, (v.R - v.L) / 360));
        twinkles = Array.from({ length: n }, () => ({ x: v.L + r() * (v.R - v.L), y: v.T + r() * (hz - 92 - v.T), s: 0.7 + r() * 1.1, f: 0.6 + r() * 2.2, ph: r() * 6.28 }));
      }
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const s of twinkles) {
        const a = 0.25 + 0.75 * Math.max(0, Math.sin(tt * s.f + s.ph)) ** 3;
        g.fillStyle = `rgba(255,248,230,${a})`;
        g.fillRect(s.x - s.s / 2, s.y - s.s / 2, s.s, s.s);
        if (a > 0.85 && s.s > 1.4) { g.fillRect(s.x - s.s * 1.6, s.y - 0.3, s.s * 3.2, 0.6); g.fillRect(s.x - 0.3, s.y - s.s * 1.6, 0.6, s.s * 3.2); }
      }
      for (const s of shooting) {
        const u = s.t / s.max, x = s.x + s.vx * s.t, y = s.y + s.vy * s.t, a = Math.sin(u * Math.PI);
        const gr = g.createLinearGradient(x, y, x - s.vx * 0.18, y - s.vy * 0.18);
        gr.addColorStop(0, `rgba(255,255,255,${0.9 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x - s.vx * 0.18, y - s.vy * 0.18); g.stroke();
      }
      g.restore();
    },
    drawTown(g, tt, v, { yatai = false, heat = 0, hz = 562 } = {}) {
      // 屋台の夜: 町の上に、提灯の列が揺れる
      if (yatai) {
        const y0 = hz - 56, n = Math.ceil((v.R - v.L) / 24) + 1;
        g.save();
        g.strokeStyle = 'rgba(40,30,30,.9)'; g.lineWidth = 0.8;
        g.beginPath();
        for (let i = 0; i <= n; i++) { const x = v.L + i * 24; g.lineTo(x, y0 + Math.sin(i * 0.9) * 2 + 4 * Math.sin((i % 6) / 6 * Math.PI)); }
        g.stroke();
        for (let i = 0; i < n; i++) {
          const x = v.L + i * 24 + 12, y = y0 + 9 + Math.sin(i * 0.9 + 0.5) * 2 + 4 * Math.sin(((i % 6) + 0.5) / 6 * Math.PI), sw = Math.sin(tt * 1.3 + i) * 1.2;
          const warm = i % 3 === 1 ? [255, 245, 220] : [255, 120, 70];
          g.globalCompositeOperation = 'lighter';
          g.drawImage(halo(warm), x + sw - 12, y - 12, 24, 24);
          g.globalCompositeOperation = 'source-over';
          g.fillStyle = `rgb(${warm})`; g.beginPath(); g.ellipse(x + sw, y, 3.4, 4.4, 0, 0, 7); g.fill();
          g.fillStyle = '#2a1a14'; g.fillRect(x + sw - 2, y - 5, 4, 1.2); g.fillRect(x + sw - 2, y + 4, 4, 1.2);
        }
        g.restore();
      }
      // 灯籠流し（川の幅に合わせて、2〜3 列に）
      const riverH = Math.max(8, Math.min(46, v.B - hz - 30)), span2 = v.R - v.L + 40;
      g.save();
      for (const l of toro) {
        const lx = v.L - 20 + ((l.u * span2 + tt * l.sp) % span2), ly = hz + 5 + l.lane * riverH, bob = Math.sin(tt * 1.4 + l.ph) * 0.6;
        const k = 0.75 + l.lane * 0.5, col = l.warm ? [255, 196, 120] : [255, 150, 110];
        g.globalCompositeOperation = 'lighter';
        g.drawImage(halo(col), lx - 11 * k, ly - 11 * k + bob, 22 * k, 22 * k);
        g.fillStyle = `rgba(${col},${0.16 + 0.06 * Math.sin(tt * 3 + l.ph)})`; g.fillRect(lx - 1.6 * k, ly + 3 * k, 3.2 * k, 5 * k); // 水に落ちる光
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#1a0f0c'; g.fillRect(lx - 3 * k, ly + 1.6 * k + bob, 6 * k, 1.2 * k); // 台
        g.fillStyle = `rgb(${col})`; g.fillRect(lx - 2.3 * k, ly - 2.6 * k + bob, 4.6 * k, 4.2 * k); // 灯
        g.fillStyle = 'rgba(60,20,10,.55)'; g.fillRect(lx - 0.25 * k, ly - 2.6 * k + bob, 0.5 * k, 4.2 * k);
        g.fillStyle = '#1a0f0c'; g.fillRect(lx - 2.8 * k, ly - 3.4 * k + bob, 5.6 * k, 0.9 * k); // 屋根
      }
      g.restore();
      // 屋形船: ゆっくり川をゆく
      const span = v.R - v.L + 160, x = v.L - 80 + ((tt * 7) % span), y = hz + 24;
      g.save();
      g.fillStyle = '#07081a';
      g.beginPath(); g.moveTo(x - 30, y); g.lineTo(x + 34, y); g.lineTo(x + 28, y + 7); g.lineTo(x - 26, y + 7); g.closePath(); g.fill();
      g.fillRect(x - 22, y - 11, 44, 11);
      g.beginPath(); g.moveTo(x - 26, y - 11); g.lineTo(x, y - 17); g.lineTo(x + 26, y - 11); g.closePath(); g.fill();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,${180 + (i % 2) * 30},110,${0.75 + 0.2 * Math.sin(tt * 3 + i)})`; g.fillRect(x - 19 + i * 7, y - 8, 4.5, 5); }
      for (let i = 0; i < 5; i++) { const lx = x - 20 + i * 10; g.fillStyle = 'rgba(255,110,70,.9)'; g.beginPath(); g.arc(lx, y - 13, 1.6, 0, 7); g.fill(); }
      // 水面のゆらぐ映り込み
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,190,110,${0.12 + 0.08 * Math.sin(tt * 4 + i)})`; g.fillRect(x - 19 + i * 7 + Math.sin(tt * 3 + i) * 1.5, y + 9 + (i % 2) * 3, 4.5, 1.2); }
      g.restore();
      void heat;
    },
    // 陸の絵（夜ごとに一度だけ描いて、背景のキャッシュに入れる）。v は見えている範囲、hz は町の屋根の線
    paintLand(g, v, { hz = 562, pagoda = 70, moonX = 300, bridge = 0.74 } = {}) {
      const { L, R } = v, W = R - L, r = mulberry(9090);
      // 夜の雲: 月明かりで上のふちが光る、やわらかい雲（盤のまん中は避けて、左右寄りに）
      g.save();
      for (let i = 0; i < 3; i++) {
        const side = i % 2 ? 1 : -1, cxc = (L + R) / 2 + side * W * (0.22 + r() * 0.2), cyc = hz * (0.58 + i * 0.1) + r() * 12, cw = W * (0.16 + r() * 0.1);
        for (let k = 0; k < 7; k++) {
          const ex = cxc + (k / 6 - 0.5) * cw * 1.6 + (r() - 0.5) * 10, ey = cyc + (r() - 0.5) * 6 - Math.sin(k / 6 * Math.PI) * 6, er = cw * (0.22 + r() * 0.16);
          const gr = g.createRadialGradient(ex, ey - er * 0.35, er * 0.1, ex, ey, er);
          gr.addColorStop(0, 'rgba(170,170,225,.10)'); gr.addColorStop(0.6, 'rgba(110,112,175,.07)'); gr.addColorStop(1, 'rgba(90,90,160,0)');
          g.fillStyle = gr; g.beginPath(); g.ellipse(ex, ey, er, er * 0.42, 0, 0, 7); g.fill();
        }
      }
      g.restore();
      // 遠い山（霧で下がうすくなる）と、近い山（木々のぎざぎざ）
      const far = g.createLinearGradient(0, hz - 110, 0, hz);
      far.addColorStop(0, '#1d2556'); far.addColorStop(1, '#2a3268');
      g.fillStyle = far; g.beginPath(); g.moveTo(L, hz);
      for (let x = Math.floor(L / 10) * 10; x <= R + 10; x += 10) g.lineTo(x, hz - 58 - Math.sin(x / 70 + 0.6) * 18 - Math.sin(x / 23) * 6);
      g.lineTo(R, hz); g.fill();
      const mist = g.createLinearGradient(0, hz - 40, 0, hz);
      mist.addColorStop(0, 'rgba(90,100,170,0)'); mist.addColorStop(1, 'rgba(110,115,185,.35)');
      g.fillStyle = mist; g.fillRect(L, hz - 40, W, 40);
      g.fillStyle = '#131838'; g.beginPath(); g.moveTo(L, hz);
      for (let x = Math.floor(L / 6) * 6; x <= R + 6; x += 6) g.lineTo(x, hz - 34 - Math.sin(x / 40) * 10 - Math.sin(x / 17 + 1) * 5 - (r() < 0.5 ? r() * 3 : 0));
      g.lineTo(R, hz); g.fill();
      // 木立（丸い梢の連なり）
      g.fillStyle = '#0d1030';
      for (let x = L - 10; x < R + 10; x += 7 + r() * 9) { const rr = 5 + r() * 7; g.beginPath(); g.arc(x, hz - 14 - r() * 6, rr, 0, 7); g.fill(); }
      // 町並み: 瓦屋根（反りのある軒）・二階家・灯る障子
      const town = mulberry(99);
      let x = L - 8;
      const glows = [];
      while (x < R + 10) {
        const w = 22 + town() * 26, two = town() < 0.3, h = (two ? 22 : 13) + town() * 8, base = hz, top = base - h;
        g.fillStyle = '#0a0c1f';
        g.fillRect(x, top, w, h);
        // 屋根: 軒が反って張り出す
        const rh = 7 + town() * 4;
        g.beginPath(); g.moveTo(x - 5, top + 1.5); g.quadraticCurveTo(x + 2, top - 1, x + w * 0.18, top - rh); g.lineTo(x + w * 0.82, top - rh); g.quadraticCurveTo(x + w - 2, top - 1, x + w + 5, top + 1.5); g.closePath();
        g.fillStyle = '#080a1a'; g.fill();
        g.strokeStyle = 'rgba(140,150,210,.18)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + w * 0.18, top - rh); g.lineTo(x + w * 0.82, top - rh); g.stroke(); // 棟に月の光
        if (two) { g.fillStyle = '#080a1a'; g.beginPath(); g.moveTo(x - 3, top + 11); g.lineTo(x + w + 3, top + 11); g.lineTo(x + w, top + 8); g.lineTo(x, top + 8); g.closePath(); g.fill(); }
        // 窓（障子に灯り。格子つき）
        const nwin = Math.max(1, Math.floor(w / 11));
        for (let j = 0; j < nwin; j++) {
          if (town() < 0.45) continue;
          const wx = x + 3 + j * (w - 6) / nwin, wy = two && town() < 0.5 ? top + 2.5 : base - 8.5, ww = Math.min(7, (w - 6) / nwin - 2), wh = 5;
          const warm = town() < 0.6 ? '#ffcf73' : '#ff9d4d';
          g.fillStyle = warm; g.globalAlpha = 0.6 + town() * 0.35; g.fillRect(wx, wy, ww, wh); g.globalAlpha = 1;
          g.fillStyle = 'rgba(40,20,10,.55)'; g.fillRect(wx + ww / 2 - 0.3, wy, 0.6, wh); g.fillRect(wx, wy + wh / 2 - 0.3, ww, 0.6);
          glows.push([wx + ww / 2, wy + wh / 2, warm]);
        }
        // 暖簾
        if (town() < 0.35) { g.fillStyle = town() < 0.5 ? '#3a1520' : '#15233d'; for (let k = 0; k < 3; k++) g.fillRect(x + w * 0.3 + k * 4, base - 9, 3.2, 5); }
        x += w + 3;
      }
      // 窓の明かりのにじみ
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [gx, gy, c] of glows) { const gg = g.createRadialGradient(gx, gy, 0, gx, gy, 9); gg.addColorStop(0, c === '#ffcf73' ? 'rgba(255,200,110,.22)' : 'rgba(255,150,80,.22)'); gg.addColorStop(1, 'rgba(255,150,80,0)'); g.fillStyle = gg; g.fillRect(gx - 9, gy - 9, 18, 18); }
      g.restore();
      // 五重塔
      g.fillStyle = '#070918';
      const pb = hz - 6;
      for (let i = 0; i < 5; i++) {
        const w = 30 - i * 4, y = pb - i * 13;
        g.beginPath(); g.moveTo(pagoda - w / 2 - 7, y - 7); g.quadraticCurveTo(pagoda, y - 14, pagoda + w / 2 + 7, y - 7); g.lineTo(pagoda + w / 2, y - 5); g.lineTo(pagoda + w / 2, y + 4); g.lineTo(pagoda - w / 2, y + 4); g.lineTo(pagoda - w / 2, y - 5); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,190,110,.55)'; g.fillRect(pagoda - 1.5, y - 1, 3, 3); g.fillStyle = '#070918';
      }
      g.fillRect(pagoda - 1, pb - 80, 2, 18);
      for (let i = 0; i < 5; i++) g.fillRect(pagoda - 3, pb - 78 + i * 3, 6, 0.8);
      // 太鼓橋（朱の反り橋）と、欄干の灯り
      const bx = L + W * bridge, bw = Math.min(96, W * 0.26), by = hz + 5;
      g.save();
      g.strokeStyle = '#5a1a1e'; g.lineWidth = 3.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(bx - bw / 2, by); g.quadraticCurveTo(bx, by - 22, bx + bw / 2, by); g.stroke();
      g.strokeStyle = '#7a2a28'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(bx - bw / 2, by - 6); g.quadraticCurveTo(bx, by - 28, bx + bw / 2, by - 6); g.stroke();
      for (let i = 0; i <= 6; i++) {
        const u = i / 6, px = bx - bw / 2 + u * bw, py = by - 22 * 2 * u * (1 - u) * 1, py2 = by - 6 - 22 * 2 * u * (1 - u);
        g.strokeStyle = '#6a2224'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py2); g.stroke();
        if (i % 2 === 0) { const gg = g.createRadialGradient(px, py2 - 2, 0, px, py2 - 2, 8); gg.addColorStop(0, 'rgba(255,180,100,.55)'); gg.addColorStop(1, 'rgba(255,140,80,0)'); g.fillStyle = gg; g.fillRect(px - 8, py2 - 10, 16, 16); g.fillStyle = '#ffc070'; g.fillRect(px - 1.2, py2 - 3.5, 2.4, 3); }
      }
      g.restore();
      // 柳（画面の端から垂れる枝）
      const willow = (wx, dir) => {
        g.save(); g.strokeStyle = 'rgba(20,32,40,.95)'; g.lineCap = 'round';
        g.lineWidth = 3; g.beginPath(); g.moveTo(wx, hz + 4); g.quadraticCurveTo(wx + dir * 4, hz - 40, wx + dir * 14, hz - 62); g.stroke();
        const wr = mulberry(dir > 0 ? 31 : 37);
        for (let i = 0; i < 16; i++) {
          const sx = wx + dir * (6 + wr() * 26), sy = hz - 60 + wr() * 18, len = 30 + wr() * 34, sw = dir * (4 + wr() * 8);
          g.lineWidth = 0.9; g.strokeStyle = `rgba(${22 + wr() * 20},${44 + wr() * 30},${46 + wr() * 20},.9)`;
          g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(sx + sw, sy + len * 0.5, sx + sw * 0.6, sy + len); g.stroke();
        }
        g.restore();
      };
      willow(L + 6, 1); willow(R - 6, -1);
      // 川に落ちる月の道
      const mg = g.createLinearGradient(0, hz, 0, v.B);
      mg.addColorStop(0, 'rgba(255,240,200,.16)'); mg.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = mg;
      for (let i = 0; i < 16; i++) { const yy = hz + 3 + i * 5, ww = 26 - i * 1.1 + (i % 3) * 5; g.fillRect(moonX - ww / 2 + ((i * 37) % 11) - 5, yy, ww, 1.3); }
      // 紙の質感（ごく薄い繊維）と、四隅の暗がり
      g.save();
      const fr = mulberry(555), n = Math.round(W * (v.B - v.T) / 900);
      g.strokeStyle = 'rgba(255,245,225,.035)'; g.lineWidth = 0.6;
      g.beginPath();
      for (let i = 0; i < n; i++) { const fx = L + fr() * W, fy = v.T + fr() * (v.B - v.T), a = fr() * 6.28, l = 2 + fr() * 6; g.moveTo(fx, fy); g.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); }
      g.stroke();
      const cx = (L + R) / 2, cy = (v.T + v.B) / 2, rad = Math.hypot(W, v.B - v.T) * 0.62;
      const vg = g.createRadialGradient(cx, cy * 0.9, rad * 0.45, cx, cy, rad);
      vg.addColorStop(0, 'rgba(0,0,12,0)'); vg.addColorStop(1, 'rgba(0,0,12,.38)');
      g.fillStyle = vg; g.fillRect(L, v.T, W, v.B - v.T);
      g.restore();
    },
    // 手前の見物客（画面のいちばん下）
    drawCrowd(g, tt, v, { heat = 0, flash = 0 } = {}) {
      const base = v.B + 2, w = v.R - v.L;
      g.save();
      const rim = Math.min(1, heat * 0.8 + flash);
      for (const p of people) {
        const x = v.L + p.u * w, s = p.kid ? 0.75 : 1, hh = 20 * p.h * s, bob = p.arms * Math.abs(Math.sin(tt * 7 + p.ph)) * 2.5;
        const top = base - hh - bob;
        g.fillStyle = '#04050d';
        // 肩と体
        g.beginPath(); g.ellipse(x, base - hh * 0.35 - bob, 8.5 * s, hh * 0.45, 0, Math.PI, 0); g.lineTo(x + 8.5 * s, base + 4); g.lineTo(x - 8.5 * s, base + 4); g.closePath(); g.fill();
        // 頭
        g.beginPath(); g.arc(x, top + 3 * s, 4.6 * s, 0, 7); g.fill();
        // 手を上げる
        if (p.arms > 0.05) {
          g.strokeStyle = '#04050d'; g.lineWidth = 2.4 * s; g.lineCap = 'round';
          const up = p.arms * 13 * s, wave = Math.sin(tt * 9 + p.ph) * 3 * p.arms;
          g.beginPath(); g.moveTo(x - 6 * s, base - hh * 0.55 - bob); g.lineTo(x - 9 * s + wave, base - hh * 0.55 - bob - up);
          g.moveTo(x + 6 * s, base - hh * 0.55 - bob); g.lineTo(x + 9 * s - wave, base - hh * 0.55 - bob - up); g.stroke();
        }
        // スマホを掲げる人: 画面が光る
        if (p.phone) {
          const px = x + 4 * s, py = top - 7 - p.arms * 4;
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = `rgba(170,210,255,${0.35 + 0.4 * flash})`; g.fillRect(px - 2.2, py - 3.5, 4.4, 7);
          g.globalCompositeOperation = 'source-over';
        }
        // 花火に照らされた輪郭
        if (rim > 0.05) {
          g.strokeStyle = `rgba(255,180,120,${0.35 * rim})`; g.lineWidth = 0.8;
          g.beginPath(); g.arc(x, top + 3 * s, 4.6 * s, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        }
      }
      // 「たまや〜」の声
      g.textAlign = 'center'; g.font = '700 13px "Shippori Mincho", serif'; g.lineJoin = 'round';
      for (const c of cheers) {
        const u = c.t / c.max, x = v.L + c.u * w, y = base - 36 - u * 26;
        g.globalAlpha = Math.sin(Math.min(1, u * 3) * Math.PI / 2) * (1 - u);
        g.strokeStyle = 'rgba(5,6,20,.85)'; g.lineWidth = 3; g.strokeText(c.text, x, y);
        g.fillStyle = '#fff3cf'; g.fillText(c.text, x, y);
      }
      g.restore();
    },
  };
  return api;
}

// 提灯のまわりの光（色ごとに 1 回だけ作る）
const halos = new Map();
function halo(rgb) {
  const key = rgb.join();
  if (halos.has(key)) return halos.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  halos.set(key, c);
  return c;
}
function mulberry(a) {
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
