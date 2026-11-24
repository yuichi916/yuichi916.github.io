// 一筆花火 2 — 隠しモード「コンの落書き帳」
// 題名の空に星をひと筆で描くと開く。難しい一筆書き 10 枚。ここは形と判定だけ（画面は main.js）
// 2026-11-25 依頼主「タイトル画面でも線を引けるようにしたい。特定の線を引いたら隠しモードで難しい一筆書きに挑戦してボーナス。やり方はクリア後にヒント」

const ring = (n, r = 1, a0 = -Math.PI / 2) => Array.from({ length: n }, (_, i) => [r * Math.cos(a0 + (i * 2 * Math.PI) / n), r * Math.sin(a0 + (i * 2 * Math.PI) / n)]);
const cyc = (n, step = 1, o = 0) => Array.from({ length: n }, (_, i) => [o + i, o + ((i + step) % n)]);
// 三角の格子（一辺 m）
function uroko(m) {
  const n = [], id = {}, e = [];
  for (let r = 0; r <= m; r++) for (let c = 0; c <= r; c++) { id[r + ',' + c] = n.length; n.push([c - r / 2, r * 0.866]); }
  for (let r = 1; r <= m; r++) for (let c = 0; c <= r; c++) {
    if (c < r) e.push([id[r + ',' + c], id[r + ',' + (c + 1)]]);
    if (c < r) e.push([id[(r - 1) + ',' + c], id[r + ',' + c]]);
    if (c > 0) e.push([id[(r - 1) + ',' + (c - 1)], id[r + ',' + c]]);
  }
  return { n, e };
}
const all = (n) => { const e = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) e.push([i, j]); return e; };

// 10 枚。n=点・e=線（点の番号の組）・d=一方通行（線の番号: 1 は 1 つ目の点→2 つ目、-1 は逆）・m=二度なぞる二重線・s=書き切れる順（お手本）
// でたらめに進んで書き切れる割合は 73% → 1% と、だんだん難しくなる（置き方は探して決めた。tests/hanabi_raku_test.mjs が検査）
export const RAKU = [
  { id: 'chochin', ja: '提灯', en: 'Lantern', n: [[1, 0], [0, 0.9], [2, 0.9], [0, 2.1], [2, 2.1], [1, 3]], e: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [1, 4], [2, 3]], d: {}, m: [], s: [4, 5, 3, 4, 2, 0, 1, 2, 3, 1, 4] },
  { id: 'kingyo', ja: '金魚', en: 'Goldfish', n: [[0, 1.5], [1.4, 0.4], [1.4, 2.6], [2.9, 1.5], [4.2, 0.4], [4.2, 2.6], [3.75, 1.5], [2.05, 1.5]], e: [[0, 1], [1, 3], [3, 2], [2, 0], [3, 4], [4, 6], [6, 5], [5, 3], [1, 2], [1, 7], [2, 7], [7, 3]], d: { 0: 1, 3: 1 }, m: [], s: [3, 2, 7, 3, 4, 6, 5, 3, 1, 2, 0, 1, 7] },
  { id: 'kitsune', ja: '狐の面', en: 'Fox Mask', n: [[0, 0], [1, 0.95], [2.2, 0.95], [3.2, 0], [3.3, 2.1], [1.6, 3.6], [-0.1, 2.1], [1.6, 2.35]], e: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 6], [2, 4], [6, 7], [4, 7], [1, 7], [2, 7]], d: { 1: 1, 10: 1 }, m: [6], s: [0, 6, 0, 1, 2, 4, 5, 6, 7, 2, 3, 4, 7, 1, 6] },
  { id: 'yae', ja: '八つの花火', en: 'Eight Fireworks', n: ring(8), e: [...cyc(8), ...cyc(8, 3)], d: { 3: 1, 4: 1, 6: -1, 8: 1, 9: 1 }, m: [], s: [6, 5, 0, 3, 4, 7, 6, 1, 0, 7, 2, 1, 4, 5, 2, 3, 6] },
  { id: 'uroko', ja: '鱗', en: 'Scales', ...uroko(3), d: { 0: -1, 1: -1, 3: 1, 4: 1, 14: -1 }, m: [10], s: [3, 4, 5, 2, 1, 0, 2, 4, 8, 5, 9, 8, 7, 4, 1, 3, 6, 3, 7, 6] },
  { id: 'kagome', ja: '籠目', en: 'Basket Star', n: [...ring(6), ...ring(6, 0.5774, -Math.PI / 3)], e: [...Array.from({ length: 6 }, (_, i) => [[i, 6 + i], [i, 6 + ((i + 5) % 6)], [6 + i, 6 + ((i + 1) % 6)]]).flat()], d: { 2: -1, 5: 1, 6: -1, 7: 1, 9: -1, 14: -1 }, m: [11], s: [9, 4, 10, 9, 3, 8, 2, 7, 6, 1, 7, 8, 9, 10, 5, 11, 0, 6, 11, 10] },
  { id: 'sakura', ja: '桜', en: 'Cherry Blossom', n: [...ring(5, 0.5), ...ring(5, 1, -Math.PI / 2 + Math.PI / 5)], e: [...Array.from({ length: 5 }, (_, i) => [[i, 5 + i], [i, 5 + ((i + 4) % 5)]]).flat(), ...cyc(5), ...cyc(5, 2)], d: { 0: 1, 4: 1, 5: 1, 11: 1, 13: 1, 16: -1, 17: -1 }, m: [3], s: [1, 2, 7, 3, 1, 0, 4, 2, 6, 1, 4, 9, 0, 3, 4, 8, 3, 2, 0, 5, 1, 5] },
  { id: 'kumo', ja: '蜘蛛の巣', en: 'Spider Web', n: [[0, 0], ...ring(6, 0.5), ...ring(6, 1)], e: [...Array.from({ length: 6 }, (_, i) => [[0, 1 + i], [1 + i, 7 + i], [1 + i, 1 + ((i + 1) % 6)]]).flat(), [7, 8], [9, 10], [11, 12]], d: { 2: 1, 4: -1, 5: 1, 10: 1, 12: 1, 16: -1, 17: 1, 20: 1 }, m: [15], s: [6, 0, 1, 7, 8, 2, 0, 5, 6, 1, 2, 3, 4, 10, 9, 3, 0, 4, 5, 11, 12, 6, 0] },
  { id: 'shichiyo', ja: '七曜', en: 'Seven Lights', n: ring(7), e: all(7), d: { 0: -1, 1: 1, 10: -1, 13: 1, 14: -1, 15: 1, 18: 1, 19: -1 }, m: [4, 9], s: [1, 4, 5, 1, 5, 6, 2, 1, 3, 6, 4, 2, 3, 4, 0, 5, 0, 2, 5, 3, 0, 6, 1, 0] },
  { id: 'ouroko', ja: '大鱗', en: 'Great Scales', ...uroko(4), d: { 0: 1, 3: -1, 4: -1, 8: -1, 9: 1, 10: 1, 19: -1, 20: 1, 22: 1, 23: 1, 26: 1 }, m: [1, 7], s: [4, 7, 11, 12, 13, 14, 9, 8, 12, 7, 8, 5, 2, 4, 1, 4, 5, 9, 13, 8, 4, 3, 6, 11, 10, 6, 7, 3, 1, 2, 0, 1, 0] },
];
export const RAKU_N = RAKU.length;
// 支度金: ★ の数ごとの小判。ためておき、ふつうの祭りの初めに 1 回 12 枚まで受け取る（残りはその次の祭りへ）
export const RAKU_COIN = [0, 2, 4, 6], PURSE_MAX = 12;
export const rakuStars = (fails, demo) => (demo ? 1 : fails === 0 ? 3 : fails <= 2 ? 2 : 1);

export const passes = (fig) => fig.e.map((_, i) => (fig.m.includes(i) ? 2 : 1));
export const total = (fig) => fig.e.length + fig.m.length;
export const degrees = (fig) => { const c = passes(fig), d = fig.n.map(() => 0); fig.e.forEach(([a, b], i) => { d[a] += c[i]; d[b] += c[i]; }); return d; };
// いまの点から j へ進む線。-1: 線が無い / -2: もうなぞった / -3: 矢印が逆
export function edgeTo(fig, left, v, j) {
  let has = -1;
  for (let i = 0; i < fig.e.length; i++) {
    const [a, b] = fig.e[i], fwd = a === v && b === j; if (!fwd && !(b === v && a === j)) continue;
    if (!left[i]) { has = has === -3 ? -3 : -2; continue; }
    const d = fig.d[i] || 0; if ((d === 1 && !fwd) || (d === -1 && fwd)) { has = -3; continue; }
    return i;
  }
  return has;
}
// 順（点の列）どおりに全部なぞれるか
export function checkPath(fig, p) {
  const left = passes(fig);
  for (let k = 1; k < p.length; k++) { const i = edgeTo(fig, left, p[k - 1], p[k]); if (i < 0) return false; left[i]--; }
  return left.every((x) => x === 0);
}
// 火の速さ: 図形の長さに合わせて、書き切るまでの持ち時間（秒）を決める
export const rakuTime = (fig) => 7 + total(fig) * 0.85;

// ---------------------------------------------------------------- 星をひと筆で描いたか
const N = 64;
function resample(p) {
  let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  if (!(L > 0)) return null; const step = L / (N - 1), out = [p[0].slice()]; let acc = 0, prev = p[0];
  for (let i = 1; i < p.length; i++) {
    let cur = p[i], d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (acc + d >= step && d > 0) { const u = (step - acc) / d, q = [prev[0] + (cur[0] - prev[0]) * u, prev[1] + (cur[1] - prev[1]) * u]; out.push(q); prev = q; d = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); acc = 0; if (out.length > N + 2) break; }
    acc += d; prev = cur;
  }
  while (out.length < N) out.push(p[p.length - 1].slice());
  return out.slice(0, N);
}
function fitBox(p) { // 中心と大きさをそろえる（縦横の伸びは 1.8 倍まで許す）
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), w = x1 - x0, h = y1 - y0;
  if (!(w > 0 && h > 0) || w / h > 1.8 || h / w > 1.8) return null;
  const cx = p.reduce((a, q) => a + q[0], 0) / p.length, cy = p.reduce((a, q) => a + q[1], 0) / p.length;
  return p.map((q) => [(q[0] - cx) / w, (q[1] - cy) / h]);
}
const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return p.map(([x, y]) => [x * c - y * s, x * s + y * c]); };
const STAR = (() => { const t = [], v = ring(5); for (let s = 0; s < 5; s++) for (const dir of [2, 3]) { const o = []; for (let i = 0; i <= 5; i++) o.push(v[(s + i * dir) % 5]); t.push(resample(o)); } return t; })();
export function starScore(pts) {
  if (!pts || pts.length < 12) return 0;
  const p = resample(pts); if (!p) return 0;
  const size = Math.max(Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1])));
  if (Math.hypot(p[0][0] - p[N - 1][0], p[0][1] - p[N - 1][1]) > size * 0.42) return 0; // 書き出しへ戻っていない
  // 回った角度の合計（五芒星は 2 周分）
  let turn = 0; for (let i = 3; i < N - 3; i += 3) { const a = Math.atan2(p[i][1] - p[i - 3][1], p[i][0] - p[i - 3][0]), b = Math.atan2(p[i + 3 < N ? i + 3 : N - 1][1] - p[i][1], p[i + 3 < N ? i + 3 : N - 1][0] - p[i][0]); let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; turn += d; }
  turn = Math.abs(turn) * 180 / Math.PI; if (turn < 380 || turn > 900) return 0;
  const b = fitBox(p); if (!b) return 0;
  let best = 9; for (const t of STAR) for (let a = -0.5; a <= 0.5; a += 0.1) { const q = fitBox(rot(t, a)); if (!q) continue; let s = 0; for (let i = 0; i < N; i++) s += Math.hypot(b[i][0] - q[i][0], b[i][1] - q[i][1]); best = Math.min(best, s / N); }
  return Math.max(0, 1 - best / 0.7071);
}
export const STAR_OK = 0.78, STAR_NEAR = 0.64;
