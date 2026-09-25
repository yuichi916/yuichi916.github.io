// 化けくらべ — 月夜のたぬき探し。純関数だけを置く（DOM・fetch・storage に触らない）。
// ページは bakekurabe.html、テストは tests/bakekurabe_core_test.mjs。
//
// 場面は W×H のドット絵で、1 画素 = PALETTE の番号 1 つ。たぬきは SPRITE の形をしていて、
// 目（E）以外の画素を好きな色で塗れる。見つける側の手がかりは「塗りのずれ」と「ときどき光る目」。

export const W = 144;
export const H = 216;

// ---------------------------------------------------------------- 色
// 番号は挑戦状の URL に入る。並びを変えると、配った挑戦状の色が変わってしまう。足すのは末尾だけ。
export const PALETTE = [
  [10, 12, 24],    // 0  ink
  [18, 24, 51],    // 1  night1
  [26, 36, 72],    // 2  night2
  [38, 53, 106],   // 3  night3
  [58, 79, 138],   // 4  night4
  [90, 111, 168],  // 5  haze
  [133, 147, 194], // 6  cloud
  [243, 227, 166], // 7  moon
  [255, 246, 210], // 8  moonlite
  [205, 185, 124], // 9  moonshade
  [21, 29, 51],    // 10 mtn1
  [31, 43, 71],    // 11 mtn2
  [19, 35, 28],    // 12 green1
  [29, 53, 39],    // 13 green2
  [44, 77, 51],    // 14 green3
  [70, 108, 64],   // 15 green4
  [79, 70, 48],    // 16 susuki1
  [127, 112, 72],  // 17 susuki2
  [176, 156, 102], // 18 susuki3
  [220, 205, 152], // 19 susuki4
  [36, 24, 15],    // 20 earth1
  [56, 38, 25],    // 21 earth2
  [85, 59, 39],    // 22 earth3
  [122, 87, 56],   // 23 earth4
  [156, 116, 73],  // 24 fur
  [210, 187, 147], // 25 cream
  [236, 229, 212], // 26 white
  [51, 55, 74],    // 27 stone1
  [81, 87, 112],   // 28 stone2
  [122, 129, 152], // 29 stone3
  [94, 26, 31],    // 30 red1
  [168, 47, 40],   // 31 red2
  [217, 112, 44],  // 32 orange
  [238, 189, 74],  // 33 yellow
  [222, 154, 168], // 34 pink
  [122, 158, 85],  // 35 matcha
  [63, 42, 85],    // 36 purple
  [122, 94, 163],  // 37 lav
  [52, 97, 143],   // 38 blue
  [42, 109, 104],  // 39 teal
  [107, 106, 62],  // 40 tatami1
  [140, 138, 82],  // 41 tatami2
];
const C = {
  ink: 0, night1: 1, night2: 2, night3: 3, night4: 4, haze: 5, cloud: 6, moon: 7, moonlite: 8, moonshade: 9,
  mtn1: 10, mtn2: 11, green1: 12, green2: 13, green3: 14, green4: 15,
  susuki1: 16, susuki2: 17, susuki3: 18, susuki4: 19, earth1: 20, earth2: 21, earth3: 22, earth4: 23,
  fur: 24, cream: 25, white: 26, stone1: 27, stone2: 28, stone3: 29, red1: 30, red2: 31, orange: 32,
  yellow: 33, pink: 34, matcha: 35, purple: 36, lav: 37, blue: 38, teal: 39, tatami1: 40, tatami2: 41,
};
export const COLOR = C;
// 夜のたぬきの目は光る（タペタム）。場面には使わない色なので、塗りでは作れない
export const EYE_RGB = [214, 247, 110];

// ---------------------------------------------------------------- たぬき
// . = 透明 / E = 目（塗れない）/ ほかは体。文字は塗る前の毛色
const SPRITE_ROWS = [
  '.DD.....DD....',
  'DFFD...DFFD...',
  'DFFFFFFFFFD...',
  'FKKKFFFKKKF...',
  'FKEKFFFKEKF...',
  'FKKKCNCKKKF...',
  '.FFCCCCCFF....',
  '.DFFCCCFFD.DD.',
  'DFFFCCCFFFDFfD',
  'DfFFCCCFFfDDfD',
  'DffFFFFFffD.DD',
  '.DD.....DD....',
];
const NATURAL = { D: C.earth2, F: C.fur, f: C.earth4, K: C.ink, C: C.cream, N: C.ink };
export const SW = SPRITE_ROWS[0].length;
export const SH = SPRITE_ROWS.length;

// 体の画素（目を除く）を行優先で並べた順番が、塗りの配列の順番になる
export const BODY = [];
export const EYES = [];
for (let y = 0; y < SH; y++) {
  for (let x = 0; x < SW; x++) {
    const ch = SPRITE_ROWS[y][x];
    if (ch === '.') continue;
    if (ch === 'E') EYES.push({ x, y, lid: -1 });
    else BODY.push({ x, y, natural: NATURAL[ch] });
  }
}
// 閉じた目（まぶた）は、すぐ左の体の画素と同じ色になる
for (const e of EYES) e.lid = BODY.findIndex((b) => b.x === e.x - 1 && b.y === e.y);
export const NATURAL_PAINT = BODY.map((b) => b.natural);

// 左右反転を含めて、スプライト内の座標を場面の座標にする
export function spriteToScene(pos, sx, sy) {
  return { x: pos.x + (pos.flip ? SW - 1 - sx : sx), y: pos.y + sy };
}

// ---------------------------------------------------------------- 乱数・日付
export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

// お題は日本時間の 0 時で切り替わる
export function jstDateKey(date) {
  const t = new Date(date.getTime() + 9 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}
const DAY_MS = 86400000;
function keyToUTC(key) { return Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)); }
// 公開した夜（日本時間 2026-09-26）がお題 #1
export const FIRST_DAY = '2026-09-26';
export function dayNumber(key) { return Math.round((keyToUTC(key) - keyToUTC(FIRST_DAY)) / DAY_MS) + 1; }
export function weekday(key) { return new Date(keyToUTC(key)).getUTCDay(); }
export function addDays(key, n) { return new Date(keyToUTC(key) + n * DAY_MS).toISOString().slice(0, 10); }
export function isDateKey(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(keyToUTC(s)); }

// その日の 21 時（日本時間）の月齢。0 = 新月、0.5 = 満月
export function moonPhase(key) {
  const jd = (keyToUTC(key) + 12 * 3600 * 1000) / DAY_MS + 2440587.5;
  const p = ((jd - 2451550.26) / 29.530588853) % 1;
  return p < 0 ? p + 1 : p;
}
// 確かめた日だけ載せる（国立天文台: 2026 年の中秋の名月は 9/25、満月は 9/27）
export const SPECIAL_DAYS = {
  '2026-09-25': { ja: '十五夜', en: 'Harvest Moon', kind: 'susuki' },
  '2026-09-27': { ja: '満月', en: 'Full moon', kind: null },
};

// ---------------------------------------------------------------- 描画の道具
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function dither(x, y) { return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
function put(b, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x >= 0 && y >= 0 && x < W && y < H) b[y * W + x] = c;
}
function get(b, x, y) {
  x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y)));
  return b[y * W + x];
}
function rect(b, x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(b, i, j, c); }
// 色の並び（暗→明）の上を t で選ぶ。つなぎ目はディザで混ぜる
function ramp(colors, t, x, y) {
  const n = colors.length - 1;
  const f = Math.max(0, Math.min(n - 1e-9, t * n));
  const i = Math.floor(f);
  return (f - i) > dither(x, y) ? colors[i + 1] : colors[i];
}
function line(b, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    put(b, x0, y0, typeof c === 'function' ? c(x0, y0) : c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
function disc(b, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) put(b, x, y, typeof c === 'function' ? c(x, y, dx, dy) : c);
    }
  }
}
function ellipse(b, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) put(b, x, y, typeof c === 'function' ? c(x, y, dx, dy) : c);
    }
  }
}
// 値ノイズ（0〜1）。シードごとに別の模様
function valueNoise(seed) {
  const hash = (i, j) => {
    let h = Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(n, x, y, oct = 3) {
  let s = 0, amp = 0.5, f = 1, tot = 0;
  for (let o = 0; o < oct; o++) { s += amp * n(x * f, y * f); tot += amp; amp *= 0.5; f *= 2; }
  return s / tot;
}

// 月。phase は 0 = 新月、0.5 = 満月。北半球の見え方（満ちるときは右から光る）
function drawMoon(b, fx, cx, cy, r, phase, seed) {
  const sky = (x, y) => get(b, x, y);
  // かさ（ぼんやりした光の輪）
  for (let y = Math.floor(cy - r - 9); y <= cy + r + 9; y++) {
    for (let x = Math.floor(cx - r - 9); x <= cx + r + 9; x++) {
      const d = Math.hypot(x - cx, y - cy) - r;
      if (d <= 0 || d > 9) continue;
      const k = (1 - d / 9) * 0.55 * Math.max(0.25, 1 - Math.abs(phase - 0.5) * 1.6);
      if (k > dither(x, y)) put(b, x, y, sky(x, y) <= C.night2 ? C.night3 : C.night4);
      if (d < 2.2 && k > 0.35 && dither(x + 1, y) < 0.5) put(b, x, y, C.haze);
    }
  }
  const n = valueNoise(seed ^ 0x5eed);
  const k = Math.cos(2 * Math.PI * phase);
  disc(b, cx, cy, r, (x, y, dx, dy) => {
    const nx = dx / r, ny = dy / r;
    const half = Math.sqrt(Math.max(0, 1 - ny * ny));
    const lit = phase <= 0.5 ? nx > k * half : nx < -k * half;
    if (!lit) return (dither(x, y) < 0.18) ? C.night4 : C.night3;
    const m = fbm(n, x / 5, y / 5, 2);
    if (m > 0.62) return C.moonshade;
    if (nx * 0.6 - ny * 0.8 > 0.55 && dither(x, y) < 0.7) return C.moonlite;
    return C.moon;
  });
  fx.moon = { x: cx, y: cy, r };
}

function skyGradient(b, y0, y1, colors) {
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, y1 - y0 - 1);
    for (let x = 0; x < W; x++) put(b, x, y, ramp(colors, t, x, y));
  }
}
function stars(b, fx, rng, count, yMax, avoid) {
  for (let i = 0; i < count; i++) {
    const x = rint(rng, 1, W - 2), y = rint(rng, 1, yMax);
    if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoid.r + 11) continue;
    const c = get(b, x, y);
    if (c > C.night3) continue;
    const big = rng() < 0.12;
    put(b, x, y, big ? C.moonlite : (rng() < 0.5 ? C.cloud : C.haze));
    if (big || rng() < 0.35) fx.twinkles.push({ x, y, a: get(b, x, y), b: c, period: 1.6 + rng() * 3, phase: rng() });
  }
}
function ridge(b, rng, seed, baseY, amp, scale, fill, lit, until = H) {
  const n = valueNoise(seed);
  const ys = [];
  for (let x = 0; x < W; x++) ys.push(Math.round(baseY - fbm(n, x / scale, 0.5, 3) * amp));
  for (let x = 0; x < W; x++) {
    for (let y = ys[x]; y < until; y++) put(b, x, y, fill);
    // 月の側を向いた斜面の縁だけ明るくする
    const slope = (ys[Math.min(W - 1, x + 1)] - ys[Math.max(0, x - 1)]);
    if (lit != null && slope > 0) { put(b, x, ys[x], lit); if (slope > 1) put(b, x, ys[x] + 1, lit); }
  }
  return ys;
}

// ---------------------------------------------------------------- 場面 1: 月見のすすき野
function sceneSusuki(seed, phase) {
  const b = new Uint8Array(W * H), fx = { twinkles: [], flames: [] };
  const rng = rng32(seed);
  skyGradient(b, 0, 130, [C.night1, C.night1, C.night2, C.night3, C.night4]);
  const moon = { x: rint(rng, 88, 112), y: rint(rng, 26, 36), r: 14 };
  drawMoon(b, fx, moon.x, moon.y, moon.r, phase, seed);
  stars(b, fx, rng, 70, 100, moon);
  // 薄い雲
  const cn = valueNoise(seed ^ 0xc10d);
  for (let y = 40; y < 95; y++) for (let x = 0; x < W; x++) {
    const v = fbm(cn, x / 26, y / 7, 3);
    if (v > 0.63 && get(b, x, y) <= C.night4 && Math.hypot(x - moon.x, y - moon.y) > moon.r + 1) {
      put(b, x, y, (v - 0.63) * 5 > dither(x, y) ? C.haze : C.night4);
    }
  }
  ridge(b, rng, seed ^ 0x111, 112, 26, 34, C.mtn1, C.mtn2);
  ridge(b, rng, seed ^ 0x222, 138, 14, 22, C.green1, C.green2);
  // 地面
  const gn = valueNoise(seed ^ 0x333);
  for (let y = 138; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(b, x, y) !== C.green1 && y < 150) continue;
    const v = fbm(gn, x / 9, y / 5, 3) + (y - 150) / 300;
    put(b, x, y, ramp([C.green1, C.green2, C.susuki1, C.green2], v, x, y));
  }
  // すすき（奥から手前へ）。月見台は、根元が台より奥のすすきを描いてから置く
  const tx = rint(rng, 12, 34), ty = rint(rng, 178, 188);
  const vx = tx + 20, vy = ty - 1;
  const stalks = [];
  for (let i = 0; i < 95; i++) stalks.push({ x: rint(rng, -6, W + 6), y: rint(rng, 140, H + 8) });
  stalks.sort((p, q) => p.y - q.y);
  const drawStalk = (s) => {
    const near = Math.min(1, (s.y - 140) / (H - 140));
    const h = s.h || Math.round(22 + near * 70 + rng() * 18);
    const bend = (s.vase ? -6 : -4) - rng() * 12 * (0.5 + near);
    drawSusuki(b, rng, s.x, s.y, h, bend, near);
  };
  let k = 0;
  for (; k < stalks.length && stalks[k].y < ty + 12; k++) drawStalk(stalks[k]);
  // 月見台（三方にお団子、花瓶にすすき）
  rect(b, tx - 12, ty, 26, 3, C.earth3); rect(b, tx - 12, ty, 26, 1, C.earth4);
  rect(b, tx - 10, ty + 3, 2, 14, C.earth2); rect(b, tx + 10, ty + 3, 2, 14, C.earth2);
  rect(b, tx - 5, ty - 3, 11, 3, C.earth4); rect(b, tx - 4, ty - 1, 9, 1, C.earth3);
  const dango = [[-4, -5], [0, -5], [4, -5], [-2, -8], [2, -8], [0, -11]];
  for (const [dx, dy] of dango) disc(b, tx + dx, ty + dy, 1.8, (x, y, ex, ey) => (ex + ey > 1.2 ? C.cream : C.white));
  ellipse(b, vx, vy - 4, 3, 5, (x, y, ex) => (ex > 0.3 ? C.stone3 : C.stone2));
  for (const v of [{ x: vx, y: vy - 8, h: 26, vase: true }, { x: vx - 1, y: vy - 8, h: 22, vase: true }, { x: vx + 1, y: vy - 8, h: 20, vase: true }]) {
    drawSusuki(b, rng, v.x, v.y, v.h, -6 - rng() * 6, 0.6);
  }
  for (; k < stalks.length; k++) drawStalk(stalks[k]);
  // 桔梗と、すすきの露（光る粒は目と見分ける練習台）
  for (let i = 0; i < 14; i++) {
    const x = rint(rng, 4, W - 5), y = rint(rng, 160, H - 3);
    put(b, x, y, C.lav); put(b, x - 1, y, C.purple); put(b, x + 1, y, C.purple); put(b, x, y - 1, C.purple); put(b, x, y + 1, C.lav);
  }
  for (let i = 0; i < 16; i++) {
    const x = rint(rng, 2, W - 3), y = rint(rng, 118, H - 3);
    const base = get(b, x, y);
    if (base === C.susuki3 || base === C.susuki4 || base === C.susuki2) {
      fx.twinkles.push({ x, y, a: C.yellow, b: base, period: 2 + rng() * 4, phase: rng(), glint: true });
    }
  }
  return { b, fx };
}
function drawSusuki(b, rng, bx, by, h, bend, near) {
  const pts = [];
  const steps = Math.max(8, Math.round(h * 1.3));
  const cx = bx + bend * 0.15, cy = by - h * 0.65, ex = bx + bend, ey = by - h;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * ex;
    const y = (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ey;
    const p = [Math.round(x), Math.round(y)];
    if (!pts.length || pts[pts.length - 1][0] !== p[0] || pts[pts.length - 1][1] !== p[1]) pts.push(p);
  }
  const stalkC = near > 0.55 ? C.susuki2 : C.susuki1;
  for (const [x, y] of pts) put(b, x, y, stalkC);
  // 穂: 茎の上 3 割から、曲がる向きへ垂れる細い房
  const start = Math.floor(pts.length * (0.66 - rng() * 0.08));
  const dir = bend < 0 ? -1 : 1;
  const hi = near > 0.35 ? C.susuki4 : C.susuki3, lo = near > 0.35 ? C.susuki3 : C.susuki2;
  for (let i = start; i < pts.length; i++) {
    const [x, y] = pts[i];
    const u = (i - start) / Math.max(1, pts.length - start);
    const len = Math.round(1 + (1 - Math.abs(u - 0.45)) * (2 + near * 4) * (0.6 + rng() * 0.6));
    for (let k = 1; k <= len; k++) {
      const px = x + dir * k * 0.7 + (i % 2 ? 1 : -1) * 0.5, py = y + k * 0.8;
      put(b, px, py, (k <= len / 2 || rng() < 0.3) ? hi : lo);
    }
    put(b, x, y, u > 0.2 ? hi : lo);
  }
}

// ---------------------------------------------------------------- 場面 2: 紅葉の神社
function sceneJinja(seed, phase) {
  const b = new Uint8Array(W * H), fx = { twinkles: [], flames: [] };
  const rng = rng32(seed);
  skyGradient(b, 0, 96, [C.night1, C.night2, C.night3, C.night4]);
  const moon = { x: rng() < 0.5 ? rint(rng, 20, 38) : rint(rng, 104, 124), y: rint(rng, 22, 30), r: 12 };
  drawMoon(b, fx, moon.x, moon.y, moon.r, phase, seed);
  stars(b, fx, rng, 45, 70, moon);
  ridge(b, rng, seed ^ 0x444, 92, 18, 30, C.mtn1, C.mtn2, 130);
  // 地面（苔と土）
  const gn = valueNoise(seed ^ 0x555);
  for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) {
    if (y < 110 && get(b, x, y) !== C.mtn1) continue;
    const v = fbm(gn, x / 8, y / 6, 3);
    put(b, x, y, ramp([C.green1, C.green2, C.earth2, C.green2, C.green3], v, x, y));
  }
  // 杉（奥の暗い木）
  for (let i = 0; i < 7; i++) {
    const x = i < 3 ? rint(rng, -4, 30) : (i < 6 ? rint(rng, 112, 148) : rint(rng, 40, 104));
    const top = rint(rng, 18, 48), base = rint(rng, 118, 140);
    rect(b, x - 1, top + 10, 3, base - top - 10, C.earth1);
    for (let y = top; y < base - 18; y += 3) {
      const w = 3 + (y - top) * 0.28;
      for (let dx = -w; dx <= w; dx++) {
        const lit = (moon.x < x ? dx < -w * 0.4 : dx > w * 0.4) && dither(x + dx, y) < 0.5;
        put(b, x + dx, y, lit ? C.green2 : C.green1); put(b, x + dx, y + 1, C.green1);
        if (Math.abs(dx) < w - 1) put(b, x + dx, y + 2, C.green1);
      }
    }
  }
  // 石段（下ほど広い）
  const sx = W / 2 + rint(rng, -6, 6);
  const stepTop = 118;
  for (let y = stepTop; y < H; y++) {
    const half = 12 + (y - stepTop) * 0.34;
    const k = (y - stepTop) % 7;
    for (let x = Math.round(sx - half); x <= Math.round(sx + half); x++) {
      const edge = Math.abs(x - sx) > half - 1.5;
      let c = k === 0 ? C.stone3 : (k === 1 ? C.stone2 : (k === 6 ? C.stone1 : C.stone2));
      if (!edge && k > 1 && k < 6 && dither(x, y) < 0.14) c = C.stone1;
      if (edge) c = C.stone1;
      put(b, x, y, c);
    }
  }
  // 鳥居
  const tx = sx, ty = 70, tw = 30;
  rect(b, tx - tw / 2 - 5, ty, tw + 10, 3, C.ink); rect(b, tx - tw / 2 - 6, ty - 1, 3, 2, C.ink); rect(b, tx + tw / 2 + 3, ty - 1, 3, 2, C.ink);
  rect(b, tx - tw / 2 - 3, ty + 3, tw + 6, 3, C.red2); rect(b, tx - tw / 2 - 3, ty + 5, tw + 6, 1, C.red1);
  rect(b, tx - tw / 2 - 1, ty + 12, tw + 2, 3, C.red2); rect(b, tx - tw / 2 - 1, ty + 14, tw + 2, 1, C.red1);
  rect(b, tx - 2, ty + 6, 5, 6, C.ink); put(b, tx, ty + 8, C.yellow); put(b, tx, ty + 10, C.yellow);
  for (const px of [tx - tw / 2 + 2, tx + tw / 2 - 5]) {
    rect(b, px, ty + 6, 4, 50, C.red2); rect(b, px + 3, ty + 6, 1, 50, C.red1); rect(b, px - 1, ty + 54, 6, 3, C.ink);
  }
  // 灯籠（火袋がゆらぐ）
  for (const side of [-1, 1]) {
    const lx = Math.round(sx + side * (26 + rint(rng, 0, 6))), ly = rint(rng, 140, 150);
    rect(b, lx - 4, ly, 9, 2, C.stone3); rect(b, lx - 3, ly - 2, 7, 2, C.stone2);
    rect(b, lx - 3, ly + 2, 7, 6, C.stone2); rect(b, lx - 1, ly + 3, 3, 4, C.orange);
    put(b, lx, ly + 4, C.yellow); fx.flames.push({ x: lx, y: ly + 4 }, { x: lx - 1, y: ly + 5 }, { x: lx + 1, y: ly + 5 });
    rect(b, lx - 4, ly + 8, 9, 2, C.stone3); rect(b, lx - 1, ly + 10, 3, 10, C.stone2); rect(b, lx - 5, ly + 20, 11, 3, C.stone1);
  }
  // もみじ（手前の枝）
  for (let i = 0; i < 5; i++) {
    const left = i % 2 === 1;
    const cx = left ? rint(rng, -4, 22) : rint(rng, 122, 148), cy = rint(rng, 10, 118);
    const r = rint(rng, 10, 18);
    const n = valueNoise(seed + i * 97);
    const ex = left ? -1 : W, ey = cy + rint(rng, 6, 20);
    line(b, ex, ey, cx, cy, C.earth1); line(b, ex, ey + 1, cx, cy + 1, C.earth1);
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.3) / r;
      const v = fbm(n, x / 4, y / 4, 2);
      if (d + (v - 0.5) * 0.9 > 1) continue;
      const lit = (x - cx) * (moon.x - cx) > 0 ? 0.25 : 0;
      put(b, x, y, ramp([C.red1, C.red2, C.orange, C.yellow], v * 0.9 + lit - d * 0.25, x, y));
    }
  }
  // 散ったもみじ
  for (let i = 0; i < 140; i++) {
    const x = rint(rng, 0, W - 1), y = rint(rng, 104, H - 1);
    put(b, x, y, [C.red2, C.orange, C.red1, C.yellow][rint(rng, 0, 3)]);
  }
  for (let i = 0; i < 10; i++) {
    const x = rint(rng, 2, W - 3), y = rint(rng, 100, H - 3);
    fx.twinkles.push({ x, y, a: C.yellow, b: get(b, x, y), period: 2 + rng() * 4, phase: rng(), glint: true });
  }
  return { b, fx };
}

// ---------------------------------------------------------------- 場面 3: 読書の秋の書斎
function sceneHondana(seed, phase) {
  const b = new Uint8Array(W * H), fx = { twinkles: [], flames: [] };
  const rng = rng32(seed);
  // 壁（板張り）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    put(b, x, y, (x % 12 === 0) ? C.earth1 : ((x % 12 === 1 && dither(x, y) < 0.5) ? C.earth3 : C.earth2));
  }
  // 丸窓と月
  const wx = rng() < 0.5 ? 34 : 110, wy = 30, wr = 22;
  disc(b, wx, wy, wr + 3, C.earth3); disc(b, wx, wy, wr + 1, C.earth1);
  disc(b, wx, wy, wr, (x, y) => ramp([C.night1, C.night2, C.night3], (y - wy + wr) / (2 * wr), x, y));
  const mb = new Uint8Array(W * H); mb.set(b);
  drawMoon(mb, fx, wx + rint(rng, -6, 6), wy - rint(rng, 2, 6), 9, phase, seed);
  disc(b, wx, wy, wr, (x, y) => mb[y * W + x]);
  // 障子の格子（窓の手前）
  for (let x = wx - wr; x <= wx + wr; x += 11) line(b, x, wy - wr, x, wy + wr, (xx, yy) => (Math.hypot(xx - wx, yy - wy) <= wr ? C.earth3 : get(b, xx, yy)));
  line(b, wx - wr, wy + 6, wx + wr, wy + 6, (xx, yy) => (Math.hypot(xx - wx, yy - wy) <= wr ? C.earth3 : get(b, xx, yy)));
  // 本棚（段ごとに本を詰める）
  const shelfX0 = wx < 72 ? 60 : 4, shelfX1 = wx < 72 ? W - 4 : 84;
  const shelves = [[6, 30], [36, 60], [66, 92], [98, 124]];
  const spines = [C.red1, C.red2, C.blue, C.teal, C.matcha, C.purple, C.earth3, C.cream, C.yellow, C.lav, C.green3, C.stone2, C.orange, C.earth4];
  const fillBooks = (x0, x1, top, bottom) => {
    let x = x0;
    while (x < x1 - 2) {
      const w = rint(rng, 2, 6), hgt = rint(rng, Math.max(8, bottom - top - 10), bottom - top - 1);
      if (rng() < 0.08) { x += rint(rng, 2, 5); continue; }
      const c = spines[rint(rng, 0, spines.length - 1)];
      const band = [C.yellow, C.cream, C.white, C.ink][rint(rng, 0, 3)];
      const yTop = bottom - hgt;
      rect(b, x, yTop, Math.min(w, x1 - x), hgt, c);
      if (w > 2) rect(b, x + w - 1, yTop, 1, hgt, c === C.ink ? C.stone1 : C.ink);
      if (rng() < 0.7) rect(b, x, yTop + 2, Math.min(w - 1, x1 - x), 1, band);
      if (rng() < 0.5) rect(b, x, bottom - 3, Math.min(w - 1, x1 - x), 1, band);
      if (rng() < 0.4 && hgt > 12) put(b, x + (w > 3 ? 1 : 0), yTop + Math.round(hgt / 2), band);
      x += w;
    }
  };
  for (const [top, bottom] of shelves) {
    rect(b, shelfX0 - 2, top - 2, shelfX1 - shelfX0 + 4, 2, C.earth4);
    rect(b, shelfX0, top, shelfX1 - shelfX0, bottom - top, C.earth1);
    fillBooks(shelfX0 + 1, shelfX1 - 1, top, bottom);
    rect(b, shelfX0 - 2, bottom, shelfX1 - shelfX0 + 4, 3, C.earth4); rect(b, shelfX0 - 2, bottom + 2, shelfX1 - shelfX0 + 4, 1, C.earth3);
  }
  rect(b, shelfX0 - 3, 4, 2, 124, C.earth3); rect(b, shelfX1 + 1, 4, 2, 124, C.earth3);
  // 窓の下の小さな棚
  const sx0 = wx < 72 ? 6 : 88, sx1 = wx < 72 ? 56 : 138;
  for (const [top, bottom] of [[64, 88], [96, 122]]) {
    rect(b, sx0 - 1, top - 2, sx1 - sx0 + 2, 2, C.earth4);
    rect(b, sx0, top, sx1 - sx0, bottom - top, C.earth1);
    fillBooks(sx0 + 1, sx1 - 1, top, bottom);
    rect(b, sx0 - 1, bottom, sx1 - sx0 + 2, 3, C.earth4);
  }
  // 畳
  for (let y = 132; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = (y === 132) || (x % 48 === 0 && y > 132);
    put(b, x, y, edge ? C.earth1 : ((x + (y >> 1)) % 3 === 0 ? C.tatami1 : ((y % 2) ? C.tatami2 : C.tatami1)));
  }
  rect(b, 0, 132, W, 2, C.ink);
  // 床に積んだ本・座布団・お月見団子・行灯
  for (let k = 0; k < 4; k++) {
    let x = rint(rng, 4, W - 30), y = rint(rng, 190, 208);
    const n = rint(rng, 3, 7);
    for (let i = 0; i < n; i++) {
      const w = rint(rng, 16, 24), c = spines[rint(rng, 0, spines.length - 1)];
      rect(b, x, y - 3, w, 3, c); rect(b, x, y - 3, w, 1, C.cream); rect(b, x + w - 1, y - 3, 1, 3, C.ink);
      y -= 3; x += rint(rng, -2, 2);
    }
  }
  const zx = rint(rng, 40, 90), zy = rint(rng, 150, 168);
  rect(b, zx, zy, 26, 16, C.purple); rect(b, zx + 1, zy + 1, 24, 1, C.lav); rect(b, zx, zy + 15, 26, 1, C.ink);
  put(b, zx + 12, zy + 7, C.yellow); put(b, zx + 13, zy + 8, C.yellow);
  const ax = rint(rng, 8, 24), ay = 140;
  rect(b, ax, ay, 12, 22, C.earth3); rect(b, ax + 1, ay + 2, 10, 17, C.cream);
  for (let y = ay + 2; y < ay + 19; y++) for (let x = ax + 1; x < ax + 11; x++) if (dither(x, y) < 0.35) put(b, x, y, C.yellow);
  fx.flames.push({ x: ax + 5, y: ay + 12 }, { x: ax + 6, y: ay + 12 }, { x: ax + 5, y: ay + 13 });
  const dx = rint(rng, 100, 128), dy = rint(rng, 160, 176);
  ellipse(b, dx, dy + 2, 10, 2, C.white);
  for (const [ox, oy] of [[-4, -1], [0, -1], [4, -1], [-2, -4], [2, -4], [0, -7]]) disc(b, dx + ox, dy + oy, 1.8, C.white);
  for (let i = 0; i < 12; i++) {
    const x = rint(rng, 2, W - 3), y = rint(rng, 6, H - 3);
    fx.twinkles.push({ x, y, a: C.yellow, b: get(b, x, y), period: 2.5 + rng() * 4, phase: rng(), glint: true });
  }
  return { b, fx };
}

export const KINDS = ['susuki', 'jinja', 'hondana'];
export const KIND_NAMES = {
  susuki: { ja: '月見のすすき野', en: 'Pampas field under the moon' },
  jinja: { ja: '紅葉の神社', en: 'Shrine in autumn leaves' },
  hondana: { ja: '読書の秋の書斎', en: 'Reading room on an autumn night' },
};
const MAKERS = { susuki: sceneSusuki, jinja: sceneJinja, hondana: sceneHondana };

export function makeScene(kind, seed, phase = 0.5) {
  const make = MAKERS[kind] || sceneSusuki;
  const { b, fx } = make(seed >>> 0, phase);
  return { kind: MAKERS[kind] ? kind : 'susuki', seed: seed >>> 0, phase, px: b, fx };
}

// ---------------------------------------------------------------- 色の距離と化け度
// 赤の平均で重みを変える近似（redmean）。0〜1
export function colorDist(a, b) {
  const p = PALETTE[a] || EYE_RGB, q = PALETTE[b] || EYE_RGB;
  const rm = (p[0] + q[0]) / 2;
  const dr = p[0] - q[0], dg = p[1] - q[1], db = p[2] - q[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db) / 764.8;
}

export function inBounds(pos) {
  return pos && Number.isInteger(pos.x) && Number.isInteger(pos.y) && pos.x >= 0 && pos.y >= 0 && pos.x + SW <= W && pos.y + SH <= H;
}

// たぬきが隠している背景の色
export function underColors(scenePx, pos) {
  return BODY.map((p) => { const q = spriteToScene(pos, p.x, p.y); return scenePx[q.y * W + q.x]; });
}

// 化け度（0〜100）。体の各画素と、その下の背景との色のずれで決まる。
// 輪郭の画素（外側に透明を持つ画素）は、背景から浮くと目立つので重く数える
const EDGE = BODY.map((p) => {
  const open = (x, y) => x < 0 || y < 0 || x >= SW || y >= SH || SPRITE_ROWS[y][x] === '.';
  return open(p.x - 1, p.y) || open(p.x + 1, p.y) || open(p.x, p.y - 1) || open(p.x, p.y + 1);
});
export function bakeScore(scenePx, pos, paint) {
  const under = underColors(scenePx, pos);
  let sum = 0, wsum = 0;
  for (let i = 0; i < BODY.length; i++) {
    const w = EDGE[i] ? 1.6 : 1;
    sum += w * colorDist(paint[i], under[i]);
    wsum += w;
  }
  const m = sum / wsum;
  // 実測: 塗らない ≒ 0.25 / 1 色で塗る ≒ 0.07 / ほぼ写す ≒ 0.015 / 完全に写す = 0
  return Math.round(100 * (1 - Math.min(1, m / 0.3) ** 0.6));
}

export const RANKS = [
  { min: 98, ja: '伝説の化けだぬき', en: 'Legendary shapeshifter' },
  { min: 90, ja: '化けの名人', en: 'Master of disguise' },
  { min: 75, ja: '化け上手', en: 'Skilled disguiser' },
  { min: 60, ja: '化け見習い', en: 'Apprentice' },
  { min: 40, ja: '半化けだぬき', en: 'Half-hidden' },
  { min: 0, ja: 'まる見えだぬき', en: 'Plain as day' },
];
export function rankFor(score) { return RANKS.find((r) => score >= r.min); }

// 背景の模様の細かさ（たぬき 1 匹ぶんの窓の中で、隣どうしの色がどれだけ違うか）
export function textureAt(scenePx, x0, y0) {
  let s = 0;
  for (let y = y0; y < y0 + SH; y++) for (let x = x0; x < x0 + SW - 1; x++) {
    s += colorDist(scenePx[y * W + x], scenePx[y * W + x + 1]);
  }
  return s / (SH * (SW - 1));
}

// 自動の化け。level 1（塗らない）〜 5（下の背景をそのまま写す）
export function autoPaint(scenePx, pos, level, rng) {
  const under = underColors(scenePx, pos);
  if (level <= 1) return NATURAL_PAINT.slice();
  const counts = new Map();
  for (const c of under) counts.set(c, (counts.get(c) || 0) + 1);
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((e) => e[0]);
  if (level === 2) return under.map(() => common[0]);
  if (level === 3) {
    const top = common.slice(0, 3);
    return under.map((c) => top.reduce((best, t) => (colorDist(c, t) < colorDist(c, best) ? t : best), top[0]));
  }
  if (level === 4) {
    // ほぼ写すが、ところどころ隣の色とずれる
    return under.map((c, i) => {
      if (rng() >= 0.16) return c;
      const p = BODY[i], q = spriteToScene(pos, p.x + (rng() < 0.5 ? -2 : 2), p.y + (rng() < 0.5 ? -1 : 1));
      return scenePx[Math.max(0, Math.min(H - 1, q.y)) * W + Math.max(0, Math.min(W - 1, q.x))];
    });
  }
  return under.slice();
}

// 目が開いている時間。たぬき寝入りをしていて、ときどき薄目をあける
export function peekOpen(peek, t) {
  const u = ((t + peek.offset) % peek.period + peek.period) % peek.period;
  return u < peek.open;
}

function overlaps(a, b, gap) {
  return a.x < b.x + SW + gap && b.x < a.x + SW + gap && a.y < b.y + SH + gap && b.y < a.y + SH + gap;
}

// ---------------------------------------------------------------- 今夜のお題
// 曜日で難しさが上がる（月曜がいちばんやさしく、日曜がいちばん手ごわい）
export const WEEK_LEVELS = {
  1: [1, 2, 2, 3, 3], 2: [1, 2, 3, 3, 4], 3: [2, 2, 3, 4, 4], 4: [2, 3, 3, 4, 4],
  5: [2, 3, 4, 4, 5], 6: [2, 3, 4, 5, 5], 0: [3, 3, 4, 5, 5],
};
export const DAILY_COUNT = 5;

export function peekFor(level, rng) {
  return { period: 3.2 + level * 1.1 + rng() * 1.6, open: Math.max(0.45, 1.05 - level * 0.11), offset: rng() * 10 };
}

export function dailyPuzzle(key) {
  const seed = hashStr('bakekurabe:' + key);
  const rng = rng32(seed);
  const special = SPECIAL_DAYS[key] || null;
  const no = dayNumber(key);
  const kind = (special && special.kind) || KINDS[((no - 1) % KINDS.length + KINDS.length) % KINDS.length];
  const phase = moonPhase(key);
  const scene = makeScene(kind, seed, phase);
  const levels = WEEK_LEVELS[weekday(key)];
  const minY = kind === 'hondana' ? 4 : 50;
  const tanuki = [];
  // 難しい子から場所を決める（模様の細かいところは難しい子に回す）
  const order = levels.map((lv, i) => ({ lv, i })).sort((a, b) => b.lv - a.lv);
  for (const { lv, i } of order) {
    let best = null;
    for (let tries = 0; tries < 60; tries++) {
      const pos = { x: rint(rng, 1, W - SW - 1), y: rint(rng, minY, H - SH - 1), flip: rng() < 0.5 };
      if (tanuki.some((t) => overlaps(t, pos, 4))) continue;
      const tex = textureAt(scene.px, pos.x, pos.y);
      const want = lv >= 4 ? tex : (lv === 1 ? -Math.abs(tex - 0.08) : -Math.abs(tex - 0.14));
      if (!best || want > best.want) best = { pos, want };
    }
    if (!best) continue;
    const t = { ...best.pos, level: lv, idx: i };
    t.paint = autoPaint(scene.px, t, lv, rng);
    t.peek = peekFor(lv, rng);
    tanuki.push(t);
  }
  tanuki.sort((a, b) => a.idx - b.idx);
  return { key, no, kind, seed, phase, special, scene, tanuki };
}

// ---------------------------------------------------------------- 挑戦状（URL の #c= に入れる）
// [版 4bit][場面 4bit][シード 32bit][x 8bit][y 8bit][反転 1bit][月齢 6bit][塗り 6bit × 体の画素数]
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const CHALLENGE_VERSION = 1;
function bitsWriter() {
  const out = []; let acc = 0, n = 0;
  return {
    put(v, bits) { for (let i = bits - 1; i >= 0; i--) { acc = (acc << 1) | ((v >>> i) & 1); if (++n === 6) { out.push(B64[acc]); acc = 0; n = 0; } } },
    done() { if (n) out.push(B64[acc << (6 - n)]); return out.join(''); },
  };
}
function bitsReader(s) {
  const vals = [];
  for (const ch of s) { const v = B64.indexOf(ch); if (v < 0) return null; vals.push(v); }
  let i = 0, bit = 0;
  return {
    get(bits) {
      let v = 0;
      for (let k = 0; k < bits; k++) {
        if (i >= vals.length) throw new Error('short');
        v = (v * 2) + ((vals[i] >>> (5 - bit)) & 1);
        if (++bit === 6) { bit = 0; i++; }
      }
      return v;
    },
  };
}
export function encodeChallenge(ch) {
  const w = bitsWriter();
  w.put(CHALLENGE_VERSION, 4);
  w.put(KINDS.indexOf(ch.kind), 4);
  w.put(ch.seed >>> 0, 32);
  w.put(ch.x, 8); w.put(ch.y, 8); w.put(ch.flip ? 1 : 0, 1);
  w.put(Math.max(0, Math.min(63, Math.round(ch.phase * 63))), 6);
  for (const c of ch.paint) w.put(c, 6);
  return w.done();
}
export function decodeChallenge(s) {
  if (typeof s !== 'string' || s.length < 10 || s.length > 400) return null;
  const r = bitsReader(s);
  if (!r) return null;
  try {
    if (r.get(4) !== CHALLENGE_VERSION) return null;
    const kind = KINDS[r.get(4)];
    const seed = r.get(32) >>> 0;
    const x = r.get(8), y = r.get(8), flip = r.get(1) === 1;
    const phase = r.get(6) / 63;
    const paint = [];
    for (let i = 0; i < BODY.length; i++) {
      const c = r.get(6);
      if (c >= PALETTE.length) return null;
      paint.push(c);
    }
    const ch = { kind, seed, x, y, flip, phase, paint };
    if (!kind || !inBounds(ch)) return null;
    return ch;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- 結果・共有
// 1 匹ごとの見つけ方。見つけるまでにかかった秒（直前の発見から）で色を分ける
export function markFor(t) {
  if (!t || !t.found) return '⬛';
  if (t.hinted) return '🟥';
  if (t.split <= 8) return '🟩';
  if (t.split <= 20) return '🟨';
  if (t.split <= 40) return '🟧';
  return '🟥';
}
export function fmtSec(ms) { return (Math.max(0, ms) / 1000).toFixed(1); }

export const SITE_URL = 'https://yuichi916.github.io/bakekurabe.html';
export const HASHTAG = '#化けくらべ';

// r.practice のときは日付と番号を出さない（練習の夜はみんなと同じお題ではない）
export function dailyShareText(r, lang) {
  const en = lang === 'en';
  let head;
  if (r.practice) head = en ? 'Bakekurabe (practice)' : '化けくらべ（練習）';
  else {
    const md = `${+r.key.slice(5, 7)}/${+r.key.slice(8, 10)}`;
    const sp = r.special ? ` 🌕${en ? r.special.en : r.special.ja}` : '';
    head = `${en ? 'Bakekurabe' : '化けくらべ'} #${r.no} ${md}${sp}`;
  }
  const marks = r.results.map(markFor).join('');
  const found = r.results.filter((t) => t.found).length;
  const stats = `⏱${fmtSec(r.ms)}${en ? 's' : '秒'} ✖️${r.misses}${r.hints ? ` 💡${r.hints}` : ''}`;
  return `${head}\n${marks} ${found}/${r.results.length}${en ? '' : '匹'}\n${stats}\n${SITE_URL}\n${en ? '#bakekurabe' : HASHTAG}`;
}

export function hideShareText(url, lang) {
  if (lang === 'en') return `I disguised myself somewhere in this picture. Can you find me? Only my eyes give me away.\n${url}\n#bakekurabe`;
  return `この絵のどこかに、化けました。見つけられる？（目だけは化けられない）\n${url}\n${HASHTAG}`;
}

export function seekShareText(res, url, lang) {
  if (lang === 'en') {
    return res.found
      ? `Found the tanuki in ${fmtSec(res.ms)}s 🔍 (its disguise: ${res.score})\nYour turn:\n${url}\n#bakekurabe`
      : `Couldn't find the tanuki in time 🍃 (its disguise: ${res.score})\nCan you?\n${url}\n#bakekurabe`;
  }
  return res.found
    ? `${fmtSec(res.ms)}秒で見破った 🔍（相手の化け度 ${res.score}）\nあなたも探して:\n${url}\n${HASHTAG}`
    : `見つけられなかった… 🍃（相手の化け度 ${res.score}）\nあなたなら見つけられる？\n${url}\n${HASHTAG}`;
}

// ---------------------------------------------------------------- 記録
// 連続記録は「遊んだ日」で数える。1 日だけの休みは、7 日に 1 回まで見逃す
export function nextStreak(prev, today) {
  const s = { streak: 0, last: null, freezeOn: null, ...(prev || {}) };
  if (s.last === today) return s;
  if (!s.last) return { ...s, streak: 1, last: today };
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap === 1) return { ...s, streak: s.streak + 1, last: today };
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  if (gap === 2 && freezeOk) return { ...s, streak: s.streak + 1, last: today, freezeOn: addDays(today, -1) };
  return { ...s, streak: 1, last: today };
}

// 今も続いている連続記録（最後に遊んだ日から切れていれば 0）
export function currentStreak(s, today) {
  if (!s || !s.last || !s.streak) return 0;
  const gap = Math.round((keyToUTC(today) - keyToUTC(s.last)) / DAY_MS);
  if (gap <= 1) return s.streak;
  const freezeOk = !s.freezeOn || Math.round((keyToUTC(today) - keyToUTC(s.freezeOn)) / DAY_MS) >= 7;
  return gap === 2 && freezeOk ? s.streak : 0;
}

// 時間の区分（みんなの中での位置を出すための計数用）
export const TIME_BUCKETS = [30, 60, 120];
export function timeBucket(ms) {
  const s = ms / 1000;
  const i = TIME_BUCKETS.findIndex((b) => s < b);
  return i < 0 ? TIME_BUCKETS.length : i;
}
// counts[i] = 区分 i でクリアした人数。自分より速い区分の人数 + 同じ区分の半分 から上位 % を出す
export function topPercent(counts, mine) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total < 10) return null;
  let faster = 0;
  for (let i = 0; i < mine; i++) faster += counts[i];
  const p = Math.round(((faster + counts[mine] / 2) / total) * 100);
  return Math.max(1, Math.min(99, p));
}
