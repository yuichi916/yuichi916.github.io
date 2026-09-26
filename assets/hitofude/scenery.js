// 一筆花火の背景の「動くもの」。夜空・川・見物の人たち（見た目だけ）。
//   staticSky: 夜ごとに一度だけ描く（天の川の帯・地平の町あかり）
//   drawSky:   またたく星と流れ星
//   drawTown:  屋台の提灯の列（屋台の夜）と、川をゆく屋形船
//   drawCrowd: 手前の見物客。大きな連鎖で手を上げ、スマホを掲げ、「たまや〜」と声が上がる

export function createScenery() {
  let excite = 0, nextShoot = 4, twinkleKey = '', twinkles = [];
  const shooting = [], cheers = [];
  const rnd = mulberry(20260926);
  const people = Array.from({ length: 30 }, (_, i) => ({ u: (i + rnd() * 0.6) / 30, h: 0.85 + rnd() * 0.35, phone: rnd() < 0.2, kid: rnd() < 0.12, ph: rnd() * 10, arms: 0 }));

  const api = {
    // 大きな連鎖や尺玉で、見物客が沸く（0〜1 を足す）
    excite(v) { excite = Math.min(1.5, excite + v); },
    cheer(text) {
      const p = people[Math.floor(Math.random() * people.length)];
      cheers.push({ u: p.u, text, t: 0, max: 1.6 });
      if (cheers.length > 5) cheers.shift();
    },
    tick(dt) {
      excite = Math.max(0, excite - dt * 0.35);
      nextShoot -= dt;
      if (nextShoot <= 0) {
        nextShoot = 6 + Math.random() * 8;
        const dir = Math.random() < 0.5 ? 1 : -1;
        shooting.push({ x: dir > 0 ? -20 + Math.random() * 200 : 180 + Math.random() * 200, y: 20 + Math.random() * 120, vx: dir * (260 + Math.random() * 120), vy: 90 + Math.random() * 60, t: 0, max: 0.7 });
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
    staticSky(g, v, { milky = 0 } = {}) {
      // 地平の町あかり
      const hz = g.createLinearGradient(0, 430, 0, 562);
      hz.addColorStop(0, 'rgba(255,150,80,0)'); hz.addColorStop(1, 'rgba(255,150,90,.16)');
      g.fillStyle = hz; g.fillRect(v.L, 430, v.R - v.L, 132);
      if (milky <= 0) return;
      // 天の川: 左下から右上へ流れる、ぼんやりした帯と、細かい星
      g.save();
      g.translate((v.L + v.R) / 2, 250); g.rotate(-0.55);
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
    drawSky(g, tt, v) {
      const key = `${v.L | 0},${v.R | 0},${v.T | 0}`;
      if (key !== twinkleKey) {
        twinkleKey = key;
        const r = mulberry(4243);
        twinkles = Array.from({ length: 46 }, () => ({ x: v.L + r() * (v.R - v.L), y: v.T + r() * (470 - v.T), s: 0.7 + r() * 1.1, f: 0.6 + r() * 2.2, ph: r() * 6.28 }));
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
    drawTown(g, tt, v, { yatai = false, heat = 0 } = {}) {
      // 屋台の夜: 町の上に、提灯の列が揺れる
      if (yatai) {
        const y0 = 506, n = Math.ceil((v.R - v.L) / 24) + 1;
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
      // 屋形船: ゆっくり川をゆく
      const span = v.R - v.L + 160, x = v.L - 80 + ((tt * 7) % span), y = 586;
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
      g.textAlign = 'center'; g.font = '700 11px "Shippori Mincho", serif';
      for (const c of cheers) {
        const u = c.t / c.max, x = v.L + c.u * w, y = base - 34 - u * 26;
        g.globalAlpha = Math.sin(Math.min(1, u * 3) * Math.PI / 2) * (1 - u);
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillText(c.text, x + 1, y + 1);
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
