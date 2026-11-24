// コンの落書き帳（隠しモード）: 10 枚が一筆で書ける・点や線が重ならない・指で触れる間隔がある・並びがやさしい順・星の判定
import { RAKU, RAKU_N, checkPath, edgeTo, passes, total, degrees, starScore, STAR_OK, STAR_NEAR, rakuStars } from '../hanabi/raku.js';
let bad = 0; const ok = (c, m, i = '') => { if (!c) bad++; console.log((c ? 'OK  ' : 'NG  ') + m + (i !== '' ? '  ' + i : '')); };
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
ok(RAKU_N === 10, '10 枚'); ok(new Set(RAKU.map((f) => f.id)).size === 10, '名前の重なりなし');
const rates = [];
for (const f of RAKU) {
  const xs = f.n.map((p) => p[0]), ys = f.n.map((p) => p[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  // 幅 360 のスマホ: 図形は幅 70%・高さ 300px まで
  const sc = Math.min((360 * 0.7) / w, 300 / h);
  let dmin = 1e9, emin = 1e9; f.n.forEach((a, i) => f.n.forEach((b, j) => { if (i < j) dmin = Math.min(dmin, Math.hypot(a[0] - b[0], a[1] - b[1])); }));
  f.n.forEach((p, i) => f.e.forEach(([a, b]) => { if (a !== i && b !== i) emin = Math.min(emin, segD(p, f.n[a], f.n[b])); }));
  const keys = f.e.map(([a, b]) => (a < b ? a + '-' + b : b + '-' + a)), path = f.s, odd = degrees(f).filter((d) => d % 2).length;
  let win = 0; const T = 4000;
  for (let t = 0; t < T; t++) { const od = degrees(f).map((d, i) => (d % 2 ? i : -1)).filter((i) => i >= 0); let v = od.length ? od[Math.floor(rnd() * od.length)] : Math.floor(rnd() * f.n.length), left = passes(f), k = 0; for (;;) { const nx = f.n.map((_, j) => [j, edgeTo(f, left, v, j)]).filter((x) => x[1] >= 0); if (!nx.length) break; const [j, i] = nx[Math.floor(rnd() * nx.length)]; left[i]--; k++; v = j; } if (k === total(f)) win++; }
  const rate = win / T; rates.push(rate);
  ok(checkPath(f, path) && path.length === total(f) + 1 && (odd === 0 || odd === 2) && new Set(keys).size === f.e.length && f.e.every(([a, b]) => a !== b && a < f.n.length && b < f.n.length), `${f.ja}: 一筆で書ける・線の重なりなし`, `辺 ${f.e.length} 奇数の点 ${odd} でたらめで書き切れる ${(rate * 100).toFixed(1)}%`);
  ok(dmin * sc >= 44 && emin * sc >= 14, `${f.ja}: 指で触れる間隔（幅 360 のスマホ）`, `点どうし ${(dmin * sc).toFixed(0)}px 点と線 ${(emin * sc).toFixed(0)}px`);
}
ok(rates.every((r, i) => !i || r <= rates[i - 1] + 0.02) && rates[0] > 0.5 && rates[9] < 0.03, 'だんだん難しくなる', rates.map((r) => (r * 100).toFixed(1)).join(' → '));
// 星
const star = (s, dir, o = {}) => { const v = Array.from({ length: 5 }, (_, i) => [Math.cos(-Math.PI / 2 + i * 1.2566 + (o.rot || 0)) * (o.sx || 1), Math.sin(-Math.PI / 2 + i * 1.2566 + (o.rot || 0)) * (o.sy || 1)]), p = []; for (let i = 0; i < 5; i++) { const a = v[(s + i * dir) % 5], b = v[(s + (i + 1) * dir) % 5]; for (let u = 0; u < 1; u += 0.06) p.push([200 + 150 * (a[0] + (b[0] - a[0]) * u) + (rnd() - 0.5) * (o.noise || 0), 200 + 150 * (a[1] + (b[1] - a[1]) * u) + (rnd() - 0.5) * (o.noise || 0)]); } p.push([200 + 150 * v[s][0] + (o.gap || 0), 200 + 150 * v[s][1] + (o.gap || 0)]); // かどを丸める
  return o.smooth ? p.map((_, i) => { const a = p.slice(Math.max(0, i - 2), i + 3); return [a.reduce((x, q) => x + q[0], 0) / a.length, a.reduce((x, q) => x + q[1], 0) / a.length]; }) : p; };
let mn = 1, n = 0, hit = 0;
for (let s = 0; s < 5; s++) for (const d of [2, 3]) for (const o of [{}, { noise: 14 }, { noise: 22, smooth: 1 }, { rot: 0.25, noise: 12 }, { rot: -0.3, noise: 12, smooth: 1 }, { sx: 1.3, noise: 12 }, { sy: 1.35, noise: 12, smooth: 1 }, { gap: 45, noise: 14 }, { gap: -40, noise: 10, smooth: 1 }]) { const v = starScore(star(s, d, o)); mn = Math.min(mn, v); n++; if (v >= STAR_OK) hit++; }
ok(hit === n, `手書きの星 ${n} 通りを全部見分ける`, `${hit}/${n} いちばん低い点 ${mn.toFixed(3)}（合格 ${STAR_OK}）`);
const path = (f, m = 120) => Array.from({ length: m + 1 }, (_, i) => f(i / m)); const C = (x, y) => [200 + 150 * x, 200 + 150 * y];
const poly = (v, cl = 1) => { const p = []; const k = v.length - (cl ? 0 : 1); for (let i = 0; i < k; i++) { const a = v[i], b = v[(i + 1) % v.length]; for (let u = 0; u < 1; u += 0.05) p.push(C(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)); } if (cl) p.push(C(...v[0])); return p; };
const rg = (n0, r = 1) => Array.from({ length: n0 }, (_, i) => [Math.cos(-1.57 + (i * 6.2832) / n0) * r, Math.sin(-1.57 + (i * 6.2832) / n0) * r]);
const others = { 丸: path((u) => C(Math.cos(u * 6.283), Math.sin(u * 6.283))), 二重丸: path((u) => C(Math.cos(u * 12.566), Math.sin(u * 12.566))), 渦: path((u) => C(u * Math.cos(u * 18), u * Math.sin(u * 18))), 八の字: path((u) => C(Math.sin(u * 6.283), Math.sin(u * 12.566) / 2)), 三角: poly(rg(3)), 四角: poly(rg(4)), 五角: poly(rg(5)), 六角: poly(rg(6)), 家の輪郭: poly([[0, 1], [0, 0], [0.5, -0.6], [1, 0], [1, 1]]), ハート: path((u) => { const t = u * 6.283; return C((16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17); }), 三つ輪: path((u) => C(Math.cos(u * 6.283) * (0.6 + 0.4 * Math.cos(u * 18.85)), Math.sin(u * 6.283) * (0.6 + 0.4 * Math.cos(u * 18.85)))), とげとげ星の輪郭: poly(rg(5).flatMap((p, i) => [p, [Math.cos(-1.57 + 0.628 + i * 1.2566) * 0.4, Math.sin(-1.57 + 0.628 + i * 1.2566) * 0.4]])), ぎざぎざ: poly([[-1, 0], [-0.6, -1], [-0.2, 1], [0.2, -1], [0.6, 1], [1, 0]], 0), 七芒星: poly([0, 3, 6, 2, 5, 1, 4].map((i) => rg(7)[i])) };
for (const [k, p] of Object.entries(others)) { const v = starScore(p); ok(v < STAR_OK - 0.04, `星ではない形: ${k}`, v.toFixed(3)); }
let fp = 0, M = 3000, top = 0; for (let t = 0; t < M; t++) { let x = 200, y = 200, a = rnd() * 6.28, p = [[x, y]]; const k = 40 + Math.floor(rnd() * 160), w = 0.2 + rnd() * 1.1; for (let i = 0; i < k; i++) { a += (rnd() - 0.5) * w * 2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; p.push([x, y]); } const v = starScore(p); top = Math.max(top, v); if (v >= STAR_OK) fp++; }
ok(fp === 0, `でたらめな落書き ${M} 本で開かない`, `最高 ${top.toFixed(3)}`);
ok(rakuStars(0) === 3 && rakuStars(2) === 2 && rakuStars(5) === 1 && rakuStars(0, 1) === 1, '★の数');
console.log(bad ? `hanabi_raku_test: FAIL ${bad}` : 'hanabi_raku_test: ALL PASS'); process.exit(bad ? 1 : 0);
