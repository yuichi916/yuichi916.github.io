// 一筆花火 2 — 花火の粒。形は物理で作る（抵抗と重力）。見えている大きさと、火が届く大きさをそろえる
const TAU = Math.PI * 2;
export const PALETTES = {
  kiku: [[1.0, 0.09, 0.22], [1.0, 0.45, 0.25]],
  ootama: [[0.08, 0.35, 1.0], [0.45, 0.85, 1.0]],
  kin: [[1.0, 0.55, 0.08], [1.0, 0.8, 0.3]],
  senrin: [[0.1, 1.0, 0.3], [0.8, 1.0, 0.35]],
  chouchin: [[1.0, 0.22, 0.04], [1.0, 0.6, 0.15]],
  shime: [[0.35, 0.18, 1.0], [0.8, 0.45, 1.0]],
  koori: [[0.2, 0.8, 1.0], [0.8, 1.0, 1.0]],
  oni: [[1.0, 0.16, 0.2], [0.75, 0.25, 1.0]],
  shaku: [[1.0, 0.82, 0.42], [1.0, 1.0, 0.92]],
  nezumi: [[0.9, 0.9, 1.0], [1.0, 0.8, 0.3]],
  roket: [[1.0, 0.3, 0.16], [1.0, 0.85, 0.35]],
  oyako: [[1.0, 0.4, 0.75], [1.0, 0.85, 0.95]],
  ko: [[1.0, 0.55, 0.4], [1.0, 0.85, 0.6]],
  meoto: [[1.0, 0.3, 0.6], [1.0, 0.7, 0.85]],
  bake: [[0.6, 0.35, 1.0], [0.9, 0.8, 1.0]],
  kingyo: [[1.0, 0.35, 0.08], [1.0, 0.9, 0.5]],
  nige: [[1.0, 0.95, 0.3], [1.0, 1.0, 0.8]],
  tome: [[0.75, 0.8, 0.65], [1.0, 1.0, 0.85]],
  juzu: [[0.95, 0.65, 0.3], [1.0, 0.9, 0.65]],
};

export function createFx(maxP = 26000, maxS = 260) {
  const N = maxP;
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const life = new Float32Array(N), max = new Float32Array(N), size = new Float32Array(N), drag = new Float32Array(N), grav = new Float32Array(N);
  const c1 = new Float32Array(N * 3), c2 = new Float32Array(N * 3), glow = new Float32Array(N), flag = new Uint8Array(N), seed = new Float32Array(N);
  let n = 0, s = 0;
  const S = { x: new Float32Array(maxS), y: new Float32Array(maxS), vx: new Float32Array(maxS), vy: new Float32Array(maxS), life: new Float32Array(maxS), max: new Float32Array(maxS), size: new Float32Array(maxS), rot: new Float32Array(maxS), a: new Float32Array(maxS) };
  const lights = [];
  const fx = { count: 0, smokeCount: 0, lights };
  const T = { TRAIL: 1, TWINKLE: 2, FALL: 4 };

  function add(px, py, pvx, pvy, l, sz, d, g, a, b, gl = 1, fl = 0) {
    if (n >= N) return -1;
    const i = n++;
    x[i] = px; y[i] = py; vx[i] = pvx; vy[i] = pvy; life[i] = l; max[i] = l; size[i] = sz; drag[i] = d; grav[i] = g;
    c1[i * 3] = a[0]; c1[i * 3 + 1] = a[1]; c1[i * 3 + 2] = a[2];
    c2[i * 3] = b[0]; c2[i * 3 + 1] = b[1]; c2[i * 3 + 2] = b[2];
    glow[i] = gl; flag[i] = fl; seed[i] = Math.random() * 100;
    return i;
  }
  fx.add = add;

  fx.light = (lx, ly, i, r, c, decay = 3.2) => { lights.push({ x: lx, y: ly, i, r, c, decay }); if (lights.length > 16) { lights.sort((a, b) => b.i - a.i); lights.length = 16; } };
  fx.smoke = (sx, sy, sz, a = 0.16) => {
    if (s >= maxS) return;
    const i = s++;
    S.x[i] = sx + (Math.random() - 0.5) * sz * 0.5; S.y[i] = sy + (Math.random() - 0.5) * sz * 0.5; S.vx[i] = 6 + Math.random() * 12; S.vy[i] = -2 - Math.random() * 6;
    S.life[i] = S.max[i] = 3.5 + Math.random() * 3; S.size[i] = sz * (0.6 + Math.random() * 0.6); S.rot[i] = Math.random() * TAU; S.a[i] = a;
  };

  // 破裂の共通: 閃光・光・煙
  function flashAt(px, py, R, col, power) {
    add(px, py, 0, 0, 0.11, R * 0.34, 0, 0, [2.4, 2.2, 1.9], [1.4, 0.9, 0.5], 1.5 * power);
    add(px, py, 0, 0, 0.3, R * 0.9, 0, 0, [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8], [col[0] * 0.12, col[1] * 0.12, col[2] * 0.12], 0.34 * power);
    fx.light(px, py, 1.25 * power, R * 3.2, col);
    for (let i = 0; i < 2 + R / 90; i++) fx.smoke(px, py, R * 0.9, 0.12);
  }

  const sphere = (px, py, count, R, col, col2, o = {}) => {
    const d = o.drag ?? 2.6, v0 = R * d * (o.k ?? 1.04), l = o.life ?? 1.25, sz = o.size ?? 2.5, g = o.grav ?? 60, gl = (o.glow ?? 2.1) * 0.42, fl = o.flag ?? 0;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, u = Math.random();
      const sp = v0 * (o.shell ? 0.92 + u * 0.1 : Math.sqrt(u));
      add(px, py, Math.cos(a) * sp, Math.sin(a) * sp, l * (0.72 + Math.random() * 0.45), sz * (0.75 + Math.random() * 0.5), d, g, col, col2, gl, fl);
    }
  };

  const kinds = {
    peony(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1 + h * 0.3);
      sphere(px, py, 190 + R * 0.9 + h * 90, R, c[0], c[1], { shell: true, life: 1.35, size: 2.6 });
      sphere(px, py, 90, R * 0.52, c[1], [1, 1, 0.9], { shell: true, life: 0.9, size: 2.2, glow: 2.5 });
    },
    chrys(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1.4 + h * 0.3);
      sphere(px, py, 320 + R * 1.1 + h * 110, R, c[0], c[1], { shell: true, life: 1.8, size: 2.8, glow: 2.2, flag: T.TRAIL });
      sphere(px, py, 180, R * 0.6, c[1], [1, 1, 1], { shell: true, life: 1.1, size: 2.3, glow: 2.8 });
      sphere(px, py, 60, R * 0.25, [2.5, 2.4, 2.0], c[0], { life: 0.6, size: 3 });
    },
    willow(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1.1 + h * 0.3);
      sphere(px, py, 240 + R + h * 80, R, c[0], [0.7, 0.28, 0.05], { shell: true, drag: 2.0, life: 2.6, size: 2.4, grav: 120, glow: 1.8, flag: T.TRAIL | T.TWINKLE });
    },
    ring(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1 + h * 0.3);
      const tilt = 0.5 + Math.random() * 0.45, rot = Math.random() * TAU, d = 2.6, v0 = R * d * 1.05;
      for (let i = 0; i < 180 + h * 60; i++) {
        const a = (i / 180) * TAU, ax = Math.cos(a) * v0, ay = Math.sin(a) * v0 * tilt;
        add(px, py, ax * Math.cos(rot) - ay * Math.sin(rot), ax * Math.sin(rot) + ay * Math.cos(rot), 1.3, 2.6, d, 40, c[0], c[1], 1.0);
      }
      sphere(px, py, 80, R * 0.4, c[1], [1, 1, 0.9], { shell: true, life: 1, size: 2.2 });
    },
    crossette(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1 + h * 0.3);
      for (let i = 0; i < 9 + h * 2; i++) {
        const a = (i / 9) * TAU, d = 3.0, v0 = R * 1.5 * d;
        const j = add(px, py, Math.cos(a) * v0, Math.sin(a) * v0, 0.6, 3.6, d, 30, c[1], c[0], 1.5, T.TRAIL);
        if (j >= 0) seed[j] = -1; // 消えるときに十字に割れる
      }
      sphere(px, py, 120, R * 0.6, c[0], c[1], { shell: true, life: 0.9, size: 2.1 });
    },
    palm(px, py, R, c, h) {
      flashAt(px, py, R, c[0], 1.2 + h * 0.3);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU + Math.random() * 0.2, d = 1.6, v0 = R * d * 1.05;
        add(px, py, Math.cos(a) * v0, Math.sin(a) * v0, 1.7, 4, d, 190, c[1], c[0], 1.4, T.TRAIL | T.FALL);
      }
      sphere(px, py, 70, R * 0.35, [2, 1.5, 1], c[0], { life: 0.7, size: 2.6 });
    },
    mini(px, py, R, c, h) { // 千発の夜の小さな玉。数が多いので粒を減らす
      add(px, py, 0, 0, 0.1, R * 0.4, 0, 0, [2.2, 2, 1.7], c[0], 1.2);
      if (Math.random() < 0.35) fx.light(px, py, 0.7, R * 3, c[0]);
      sphere(px, py, 46 + h * 12, R, c[0], c[1], { shell: true, life: 0.85, size: 2.2 });
    },
    kamuro(px, py, R, c, h) {
      flashAt(px, py, R, c[1], 2.5);
      fx.light(px, py, 3.6, R * 3.5, [1, 0.8, 0.5], 1.4);
      sphere(px, py, 1500, R, c[0], [0.6, 0.22, 0.04], { shell: true, drag: 1.8, life: 3.4, size: 2.8, grav: 110, glow: 2.1, flag: T.TRAIL | T.TWINKLE });
      sphere(px, py, 400, R * 0.5, c[1], [1, 0.7, 0.3], { shell: true, life: 1.6, size: 2.4, glow: 2.8 });
    },
  };
  fx.burst = (kind, px, py, R, type, heat = 0) => {
    const c = PALETTES[type] || PALETTES.kiku;
    (kinds[kind] || kinds.peony)(px, py, R, c, heat);
  };
  fx.kinds = Object.keys(kinds).filter((k) => k !== 'mini');

  // 線を走る火の粉
  fx.flame = (px, py, dirx, diry, heat, dt) => {
    const cnt = Math.round((90 + heat * 120) * dt * 2.2);
    const hot = heat >= 2 ? [2.6, 2.6, 3.2] : [3, 1.9, 0.7];
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * TAU, sp = 40 + Math.random() * (130 + heat * 90);
      add(px, py, Math.cos(a) * sp - dirx * 60, Math.sin(a) * sp - diry * 60 - 30, 0.3 + Math.random() * 0.45, 1.8 + Math.random() * 1.4, 2.5, 160, hot, [1, 0.25, 0.05], 2.2, T.TWINKLE);
    }
    add(px, py, 0, 0, 0.1, 15 + heat * 7, 0, 0, hot, [1, 0.5, 0.1], 1.1);
    fx.light(px, py, 0.16 + heat * 0.1, 260, [1, 0.56, 0.2], 40);
  };
  fx.tick = (px, py, col, cnt = 14, sp = 170) => {
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * TAU, v = sp * (0.4 + Math.random());
      add(px, py, Math.cos(a) * v, Math.sin(a) * v, 0.45 + Math.random() * 0.25, 2.2, 3, 80, col, [1, 1, 0.8], 2.4);
    }
  };
  // 打ち上げの筋（下から上へ）
  fx.launch = (fromX, fromY, toX, toY, t, col) => {
    const vx0 = (toX - fromX) / t, vy0 = (toY - fromY) / t;
    const i = add(fromX, fromY, vx0, vy0, t, 3.4, 0, 0, [2.4, 1.8, 1.0], col, 2.6, T.TRAIL);
    return i;
  };

  fx.update = (dt) => {
    for (let i = n - 1; i >= 0; i--) {
      life[i] -= dt;
      if (life[i] <= 0) {
        if (seed[i] === -1) { // 十字に割れる
          const col = [c1[i * 3], c1[i * 3 + 1], c1[i * 3 + 2]], col2 = [c2[i * 3], c2[i * 3 + 1], c2[i * 3 + 2]], a0 = Math.atan2(vy[i], vx[i]);
          const X = x[i], Y = y[i];
          n--; moveLast(i);
          for (let k = 0; k < 4; k++) { const a = a0 + Math.PI / 4 + (k * Math.PI) / 2; add(X, Y, Math.cos(a) * 210, Math.sin(a) * 210, 0.55, 2.3, 2.5, 50, col, col2, 1.1, T.TRAIL); }
          continue;
        }
        n--; moveLast(i);
        continue;
      }
      const fr = Math.exp(-drag[i] * dt);
      vx[i] *= fr; vy[i] = vy[i] * fr + grav[i] * dt;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
    }
    for (let i = s - 1; i >= 0; i--) {
      S.life[i] -= dt;
      if (S.life[i] <= 0) { s--; for (const k of Object.keys(S)) S[k][i] = S[k][s]; continue; }
      S.x[i] += S.vx[i] * dt; S.y[i] += S.vy[i] * dt; S.size[i] += 9 * dt; S.rot[i] += 0.1 * dt;
    }
    for (let i = lights.length - 1; i >= 0; i--) { const L = lights[i]; L.i *= Math.exp(-L.decay * dt); if (L.i < 0.015) lights.splice(i, 1); }
  };
  function moveLast(i) {
    x[i] = x[n]; y[i] = y[n]; vx[i] = vx[n]; vy[i] = vy[n]; life[i] = life[n]; max[i] = max[n]; size[i] = size[n]; drag[i] = drag[n]; grav[i] = grav[n]; glow[i] = glow[n]; flag[i] = flag[n]; seed[i] = seed[n];
    for (let k = 0; k < 3; k++) { c1[i * 3 + k] = c1[n * 3 + k]; c2[i * 3 + k] = c2[n * 3 + k]; }
  }
  let tw = 0;
  fx.fill = (P, maxOut, Q, maxQ) => {
    tw += 0.016;
    const cnt = Math.min(n, maxOut);
    for (let i = 0, o = 0; i < cnt; i++, o += 9) {
      const t = 1 - life[i] / max[i], fade = t < 0.08 ? 1 : (1 - t) ** 1.25;
      let a = fade * glow[i];
      if (flag[i] & T.TWINKLE && t > 0.45) a *= 0.45 + 0.55 * (Math.sin(tw * 44 + seed[i] * 9) > 0.1 ? 1 : 0.18);
      P[o] = x[i]; P[o + 1] = y[i]; P[o + 2] = vx[i]; P[o + 3] = vy[i];
      P[o + 4] = c1[i * 3] + (c2[i * 3] - c1[i * 3]) * t; P[o + 5] = c1[i * 3 + 1] + (c2[i * 3 + 1] - c1[i * 3 + 1]) * t; P[o + 6] = c1[i * 3 + 2] + (c2[i * 3 + 2] - c1[i * 3 + 2]) * t;
      P[o + 7] = a; P[o + 8] = size[i];
    }
    fx.count = cnt;
    const c2n = Math.min(s, maxQ);
    for (let i = 0, o = 0; i < c2n; i++, o += 9) {
      const t = S.life[i] / S.max[i], al = Math.min(1, (1 - t) * 6) * t * S.a[i];
      Q[o] = S.x[i]; Q[o + 1] = S.y[i]; Q[o + 2] = S.vx[i]; Q[o + 3] = S.vy[i]; Q[o + 4] = S.rot[i]; Q[o + 5] = 0; Q[o + 6] = 0; Q[o + 7] = al; Q[o + 8] = S.size[i];
    }
    fx.smokeCount = c2n;
  };
  fx.live = () => n;
  return fx;
}
