// 一筆花火の「見た目の花火」。シミュレーション（core.js）とは別で、決定的でなくてよい。
// 玉の種類ごとに、日本の花火の型を写す:
//   菊（色が変わる尾） / 大玉（牡丹の二重の輪 ＋ 金の冠菊が垂れる） / 金（星形の型物 ＋ きらめき） /
//   千輪（遅れてパチパチ咲く小花） / 提灯（まん丸の輪） / 湿った玉（青白い牡丹と湯気） / 尺玉（大きな菊 ＋ 金の柳 ＋ 衝撃の輪）
// 満開のときは、夜空にヒノコの顔とハートを咲かせる（型物）。
//
// 粒の種類: trail（尾を引く線） / dot（光る点・牡丹） / glit（またたく火花） / willow（長く垂れる金の柳）
// ほかに、ring（衝撃の輪）と smoke（ただよう煙）を持つ。

const G = 90;
const WHITE = [255, 250, 235], GOLD = [255, 200, 90], PALE_GOLD = [255, 226, 150];

export function createFx({ max = 3400, onPop = null } = {}) {
  const P = [], rings = [], smokes = [], timers = [];
  const sprites = new Map();
  let smokeSprite = null, t = 0, quality = 1; // quality: 重い端末では粒を減らす（0.4〜1）

  // 光る点の絵（色ごとに 1 回だけ作る）
  function glow(rgb) {
    const key = rgb.join();
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.28, `rgba(${rgb},0.95)`); gr.addColorStop(0.6, `rgba(${rgb},0.25)`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    sprites.set(key, c);
    return c;
  }
  function smokeImg() {
    if (smokeSprite) return smokeSprite;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(190,190,215,0.9)'); gr.addColorStop(0.55, 'rgba(150,150,185,0.35)'); gr.addColorStop(1, 'rgba(120,120,160,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (smokeSprite = c);
  }

  function add(p) {
    if (P.length >= max) return;
    p.px = p.x; p.py = p.y; p.max = p.life;
    if (p.kind === 'willow') p.hist = [];
    P.push(p);
  }
  // 中心から、円く飛ばす。rim が大きいほど、外側（輪の縁）に粒が集まる（球が開いたように見える）
  function radial(x, y, n0, speed, o) {
    const n = Math.max(6, Math.round(n0 * (o.even ? 1 : quality))), off = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * (o.jitter ?? 0.12);
      const u = o.even ? 1 : 1 - (o.rim ?? 0.3) * (1 - Math.sqrt(Math.random()));
      const sp = speed * u * (1 + (Math.random() - 0.5) * (o.spread ?? 0.08));
      add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: o.life * (0.85 + Math.random() * 0.3), rgb: o.rgb, rgb2: o.rgb2 || null,
        kind: o.kind || 'trail', size: o.size || 4, drag: o.drag ?? 3.2, grav: o.grav ?? 1, flick: o.flick || 0 });
    }
  }
  function ring(x, y, R, rgb = PALE_GOLD, width = 2.2) { rings.push({ x, y, R, t: 0, max: 0.4, rgb, width }); }
  function smoke(x, y, R, n = 3) {
    if (quality < 0.7) return;
    for (let i = 0; i < n; i++) smokes.push({ x: x + (Math.random() - 0.5) * R * 0.6, y: y + (Math.random() - 0.5) * R * 0.5, r0: R * (0.5 + Math.random() * 0.3), t: 0, max: 4.5 + Math.random() * 2, a: 0.06 + Math.random() * 0.04, vx: 3 + Math.random() * 4, vy: -4 - Math.random() * 4 });
    if (smokes.length > 40) smokes.splice(0, smokes.length - 40);
  }
  function later(sec, fn) { timers.push({ at: t + sec, fn }); }
  const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));

  // 型物: 点の並び（-1〜1 の座標）を、その形のまま広げる
  function shape(points, x, y, speed, o) {
    for (const [px, py] of points) {
      const j = 1 + (Math.random() - 0.5) * 0.04;
      add({ x, y, vx: px * speed * j, vy: py * speed * j, life: o.life * (0.9 + Math.random() * 0.2), rgb: o.rgb, rgb2: o.rgb2 || null,
        kind: 'dot', size: o.size || 4.5, drag: 2.4, grav: 0.18, flick: o.flick || 0 });
    }
  }

  const api = {
    get count() { return P.length; },
    get quality() { return quality; },
    setQuality(q) { quality = Math.max(0.4, Math.min(1, q)); },
    clear() { P.length = 0; rings.length = 0; smokes.length = 0; timers.length = 0; },
    // 玉がひらいたとき。R は爆発の半径（論理単位）、heat は連鎖の熱（0〜1）
    burst(type, x, y, rgb, rgb2, R, heat = 0) {
      const more = 1 + heat * 0.7, S = R * 2.4;
      if (type === 'shaku') {
        // 尺玉: 大きな菊（色が白へ変わる）＋ 金の柳の冠 ＋ 芯 ＋ 二重の衝撃の輪
        radial(x, y, Math.round(150 * more), S, { rgb, rgb2: WHITE, life: 1.6, rim: 0.2 });
        radial(x, y, 70, S * 0.62, { rgb: GOLD, kind: 'willow', life: 2.8, drag: 1.5, grav: 0.35, rim: 0.4 });
        radial(x, y, 40, S * 0.35, { rgb: WHITE, kind: 'dot', life: 1.1, size: 5, rim: 0.5 });
        ring(x, y, R * 1.3, PALE_GOLD, 3); later(0.12, () => ring(x, y, R * 0.9, rgb, 2));
        later(0.9, () => { for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, d = R * (0.6 + Math.random() * 0.8); api.pop(x + Math.cos(a) * d, y + Math.sin(a) * d, 6, WHITE); } });
        smoke(x, y, R * 1.2, 6);
        return;
      }
      if (type === 'ootama') {
        // 大玉: 牡丹の二重の輪（外と内で色が違う）＋ 金の冠菊がゆっくり垂れる
        radial(x, y, Math.round(76 * more), S, { rgb, kind: 'dot', life: 1.35, size: 4.6, rim: 0.12, drag: 2.9 });
        radial(x, y, 36, S * 0.55, { rgb: rgb2 || WHITE, kind: 'dot', life: 1.1, size: 4, rim: 0.1 });
        radial(x, y, 32, S * 0.8, { rgb: GOLD, kind: 'willow', life: 2.3, drag: 1.8, grav: 0.45, rim: 0.5 });
        ring(x, y, R * 1.1);
        smoke(x, y, R, 4);
        return;
      }
      if (type === 'kin') {
        // 金: 星形の型物 ＋ ちらちら光る金の火花
        shape(STAR, x, y, S * 0.55, { rgb: GOLD, rgb2: WHITE, life: 1.3, size: 4.2 });
        radial(x, y, Math.round(36 * more), S * 0.75, { rgb: PALE_GOLD, kind: 'glit', life: 1.4, rim: 0.5, flick: 1 });
        smoke(x, y, R * 0.8, 2);
        return;
      }
      if (type === 'senrin') {
        // 千輪: 小さな芯のあと、まわりに小花がパチパチ咲く
        radial(x, y, Math.round(34 * more), S * 0.7, { rgb, rgb2: WHITE, life: 0.9, rim: 0.3 });
        const n = 7, off = Math.random() * Math.PI * 2;
        for (let k = 0; k < n; k++) {
          const a = off + k / n * Math.PI * 2, d = R * (0.7 + Math.random() * 0.4);
          later(0.22 + Math.random() * 0.25, () => api.pop(x + Math.cos(a) * d, y + Math.sin(a) * d, 12, k % 2 ? WHITE : rgb));
        }
        smoke(x, y, R * 0.7, 2);
        return;
      }
      if (type === 'chouchin') {
        // 提灯: 同じ速さの粒で、まん丸の輪（型物）
        radial(x, y, 56, S * 0.8, { rgb: [255, 150, 80], rgb2: [255, 90, 70], kind: 'dot', life: 1.4, even: true, jitter: 0, spread: 0, size: 4.8 });
        radial(x, y, 18, S * 0.3, { rgb: WHITE, kind: 'dot', life: 0.9, size: 4 });
        ring(x, y, R, [255, 170, 110]);
        smoke(x, y, R * 0.8, 2);
        return;
      }
      if (type === 'shime') {
        // 湿った玉: 青白い牡丹と、白い湯気
        radial(x, y, Math.round(44 * more), S * 0.85, { rgb: [170, 220, 255], rgb2: WHITE, kind: 'dot', life: 1.1, size: 4 });
        smoke(x, y, R * 0.9, 4);
        return;
      }
      // 菊（ふつうの玉）: 尾を引いて開き、途中で色が変わる（変色）。芯は別の色
      radial(x, y, Math.round(56 * more), S, { rgb, rgb2: rgb2 || mix(rgb, WHITE, 0.7), life: 1.25, rim: 0.28 });
      radial(x, y, 14, S * 0.42, { rgb: rgb2 || WHITE, kind: 'dot', life: 0.8, size: 3.6 });
      if (heat > 0.5) radial(x, y, 16, S * 0.9, { rgb: PALE_GOLD, kind: 'glit', life: 1.2, flick: 1 });
      smoke(x, y, R * 0.7, 1);
    },
    // 小さくはじける（千輪の小花・尺玉のあとのパチパチ）
    pop(x, y, n, rgb) {
      radial(x, y, n, 34 + Math.random() * 16, { rgb, kind: 'glit', life: 0.45, rim: 0.2, flick: 1 });
      if (onPop) onPop();
    },
    sparkle(x, y, n = 2, rgb = [255, 190, 90]) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 60;
        add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.25 + Math.random() * 0.3, rgb, kind: 'trail', size: 1, drag: 3.2, grav: 1, small: true });
      }
    },
    // 満開: 夜空にヒノコの顔と、ハートを咲かせる
    hinokoFace(x, y, scale = 1) {
      const sp = 120 * scale;
      shape(FACE.body, x, y, sp, { rgb: [255, 170, 60], rgb2: [255, 215, 110], life: 2.4, size: 5 });
      shape(FACE.eyes, x, y, sp, { rgb: WHITE, life: 2.4, size: 5.5 });
      shape(FACE.cheeks, x, y, sp, { rgb: [255, 120, 150], life: 2.4, size: 5 });
      shape(FACE.mouth, x, y, sp, { rgb: WHITE, life: 2.4, size: 4.5 });
      ring(x, y, 60 * scale, PALE_GOLD, 3);
    },
    heart(x, y, scale = 1, rgb = [255, 110, 150]) { shape(HEART, x, y, 95 * scale, { rgb, rgb2: [255, 190, 210], life: 2.1, size: 4.6 }); },
    update(dt) {
      t += dt;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= t) { const f = timers[i].fn; timers.splice(i, 1); f(); }
      for (const p of P) {
        p.px = p.x; p.py = p.y;
        const drag = Math.exp(-p.drag * dt);
        p.vx *= drag; p.vy = p.vy * drag + G * p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
        if (p.hist) { p.hist.push(p.x, p.y); if (p.hist.length > 16) p.hist.splice(0, 2); }
      }
      let w = 0;
      for (let i = 0; i < P.length; i++) if (P[i].life > 0) P[w++] = P[i];
      P.length = w;
      for (const r of rings) r.t += dt;
      for (let i = rings.length - 1; i >= 0; i--) if (rings[i].t >= rings[i].max) rings.splice(i, 1);
      for (const s of smokes) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
      for (let i = smokes.length - 1; i >= 0; i--) if (smokes[i].t >= smokes[i].max) smokes.splice(i, 1);
    },
    // 煙は花火の奥に（先に描く）。heat が高いと、火に照らされて少し赤い
    drawSmoke(g, heat = 0) {
      if (!smokes.length) return;
      const img = smokeImg();
      g.save();
      for (const s of smokes) {
        const u = s.t / s.max, r = s.r0 * (1 + u * 1.6);
        g.globalAlpha = s.a * Math.sin(Math.min(1, u * 4) * Math.PI / 2) * (1 - u);
        g.drawImage(img, s.x - r, s.y - r, r * 2, r * 2);
      }
      void heat;
      g.restore();
    },
    draw(g) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      // 尾（線）: 色 × 明るさで束ねて描く
      const buckets = new Map();
      for (const p of P) {
        if (p.kind !== 'trail') continue;
        const a = Math.max(0, p.life / p.max), col = p.rgb2 && a < 0.55 ? p.rgb2 : p.rgb;
        const key = col.join() + '|' + Math.min(3, Math.floor(a * 4)) + (p.small ? 's' : '');
        let b = buckets.get(key); if (!b) { b = []; buckets.set(key, b); } b.push(p);
      }
      for (const [key, list] of buckets) {
        const [rgb, rest] = key.split('|'), lv = +rest[0];
        g.strokeStyle = `rgba(${rgb},${0.25 + lv * 0.25})`; g.lineWidth = rest.includes('s') ? 1.2 : 1.9;
        g.beginPath();
        for (const p of list) { g.moveTo(p.px, p.py); g.lineTo(p.x + (p.x - p.px) * 0.7, p.y + (p.y - p.py) * 0.7); }
        g.stroke();
      }
      // 柳・光る点・またたく火花は、色 × 明るさ 4 段で束ねて描く（1 粒ずつ状態を変えると重い）
      const wB = new Map(), dB = new Map(), gB = new Map();
      for (const p of P) {
        if (p.kind === 'trail') continue;
        const a = Math.max(0, p.life / p.max), lv = Math.min(3, Math.floor(a * 4));
        if (p.kind === 'willow') { if (p.hist.length < 4) continue; (wB.get(lv) || wB.set(lv, []).get(lv)).push(p); continue; }
        const col = p.rgb2 && a < 0.5 ? p.rgb2 : p.rgb, key = col.join() + '|' + lv;
        const m = p.kind === 'dot' ? dB : gB;
        let e = m.get(key); if (!e) { e = { col, lv, list: [] }; m.set(key, e); } e.list.push(p);
      }
      g.lineCap = 'round'; g.lineWidth = 1.4;
      for (const [lv, list] of wB) {
        g.strokeStyle = `rgba(${GOLD},${0.15 + lv * 0.17})`;
        g.beginPath();
        for (const p of list) { g.moveTo(p.hist[0], p.hist[1]); for (let i = 2; i < p.hist.length; i += 2) g.lineTo(p.hist[i], p.hist[i + 1]); }
        g.stroke();
      }
      for (const e of dB.values()) {
        g.globalAlpha = [0.3, 0.5, 0.7, 0.85][e.lv];
        const img = glow(e.col);
        for (const p of e.list) {
          const a = p.life / p.max, s = p.size * (0.55 + a * 0.5) * (p.flick && Math.random() < 0.3 ? 0.5 : 1);
          g.drawImage(img, p.x - s, p.y - s, s * 2, s * 2);
        }
      }
      g.globalAlpha = 1;
      for (const e of gB.values()) {
        g.fillStyle = `rgba(${e.col},${0.5 + e.lv * 0.16})`;
        for (const p of e.list) {
          if (p.flick && p.life / p.max < 0.7 && Math.random() < 0.45) continue;
          g.fillRect(p.x - 0.9, p.y - 0.9, 1.8, 1.8);
        }
      }
      // 衝撃の輪
      for (const r of rings) {
        const u = r.t / r.max;
        g.strokeStyle = `rgba(${r.rgb},${0.4 * (1 - u)})`; g.lineWidth = r.width * (1 - u * 0.6);
        g.beginPath(); g.arc(r.x, r.y, r.R * (0.25 + u * 0.95), 0, Math.PI * 2); g.stroke();
      }
      g.restore();
    },
  };
  return api;
}

// ---------------------------------------------------------------- 型物の形（-1〜1）
function outline(fn, n) { return Array.from({ length: n }, (_, i) => fn(i / n * Math.PI * 2)); }
const STAR = (() => {
  const pts = [];
  for (let k = 0; k < 5; k++) {
    const a1 = -Math.PI / 2 + k * Math.PI * 2 / 5, a2 = a1 + Math.PI / 5, a3 = a1 + Math.PI * 2 / 5;
    const p1 = [Math.cos(a1), Math.sin(a1)], p2 = [Math.cos(a2) * 0.42, Math.sin(a2) * 0.42], p3 = [Math.cos(a3), Math.sin(a3)];
    for (let i = 0; i < 4; i++) { const u = i / 4; pts.push([p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u]); }
    for (let i = 0; i < 4; i++) { const u = i / 4; pts.push([p2[0] + (p3[0] - p2[0]) * u, p2[1] + (p3[1] - p2[1]) * u]); }
  }
  return pts;
})();
const HEART = outline((a) => [Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16], 44);
// ヒノコの顔: しずく形の体・目・ほっぺ・口（hinoko.js と同じ形。体の丸の半径を 0.5 とした座標）
const FACE = (() => {
  const body = [];
  for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI; body.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]); } // 下の丸
  for (let i = 1; i <= 12; i++) { const s = i / 12; const x = 0.5 * (1 - s) * (1 + 0.45 * s); body.push([-x, -1.02 * Math.pow(s, 1.15)]); body.push([x, -1.02 * Math.pow(s, 1.15)]); } // 炎の先
  const circle = (cx, cy, r, n) => outline((a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.5], n);
  return {
    body,
    eyes: [...circle(-0.18, 0.05, 0.05, 6), ...circle(0.18, 0.05, 0.05, 6)],
    cheeks: [[-0.31, 0.22], [-0.27, 0.22], [0.31, 0.22], [0.27, 0.22]],
    mouth: Array.from({ length: 5 }, (_, i) => { const a = Math.PI * (0.2 + i / 4 * 0.6); return [Math.cos(a) * 0.09, 0.2 + Math.sin(a) * 0.05]; }),
  };
})();
