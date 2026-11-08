// 火の速さを変えたことで「慣れた手」が通じなくなったかを測る。
// 一定の速さで線を引き続ける人（慣れて作業になった人）を走らせ、旧（ほぼ一定の火）と新で比べる。
// node _dev/hanabi-flame.mjs
import * as G from '../hanabi/sim.js';
import * as Run from '../hanabi/run.js';

const OLD = { id: '_old', mod: (m) => { m.dyn = false; } };

function stroke(st, penV, ride = 0, human = null) {
  const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0);
  const start = idle.slice().sort((a, b) => a.x - b.x)[0];
  const path = []; let cur = start; const rest = new Set(idle); rest.delete(start); let used = 0;
  while (rest.size && path.length < 18) {
    let b = null, bd = 1e9; for (const s of rest) { const d = Math.hypot(s.x - cur.x, s.y - cur.y); if (d < bd) { bd = d; b = s; } }
    if (used + bd > st.ink * 0.9) break;
    used += bd; path.push({ x: b.x, y: b.y }); rest.delete(b); cur = b;
  }
  G.penDown(st, start.x, start.y);
  const pen = { x: start.x, y: start.y }, vs = [];
  let seen = st.stroke.v, seenGap = 0;
  const rnd = G.rng32(st.seed + 9); let noise = 1, noiseT = 0;
  let hotT = 0, t = 0;
  while (st.phase === 'stroke' && t < 60) {
    const k = st.stroke; if (!k) break;
    if (k.penDown) {
      const g = path[0];
      if (!g) G.penUp(st);
      else {
        seen += (k.v - seen) * Math.min(1, G.DT / 0.2);
        const realGap = k.len - k.flameS;
        // 人は間合いも遅れて見え、手の速さにもむらがある
        seenGap += (realGap - seenGap) * Math.min(1, G.DT / (human ? human.react : 0.001));
        noiseT -= G.DT; if (noiseT <= 0) { noiseT = 0.15 + rnd() * 0.25; noise = human ? 1 + (rnd() - 0.5) * human.noise : 1; }
        const gap = seenGap, want = (ride ? (gap < ride * 0.55 ? seen * 1.9 : gap < ride ? seen * 1.08 : seen * 0.7) : penV) * noise;
        const dx = g.x - pen.x, dy = g.y - pen.y, d = Math.hypot(dx, dy), v = (ride && k.held ? 0 : want) * G.DT;
        if (d <= v) { pen.x = g.x; pen.y = g.y; path.shift(); } else { pen.x += (dx / d) * v; pen.y += (dy / d) * v; }
        G.penMove(st, pen.x, pen.y);
        if (k.flameOn) { vs.push(k.v); if (k.heatLv > 0) hotT += G.DT; }
      }
    }
    G.step(st, G.DT); t += G.DT;
  }
  const k = st.stroke;
  return { caught: !!k?.caught, vs, hotT, score: k ? k.chips * k.mult : 0, pops: k?.pops || 0 };
}

function measure(charms, night, penV, ride = 0, human = null) {
  let caught = 0, n = 0, hot = 0, score = 0; const cv = [], lo = [], hi = [];
  for (let seed = 1; seed <= 60; seed++) {
    const run = Run.newRun({ seed: seed * 13 });
    const def = { ...Run.nightDef(run, night[0], night[1]), target: 1e12, strokes: 1 };
    if (charms.length) { def.flame = 1; def.gusts = false; }
    const st = G.newNight(def, 1280, 720, { charms });
    const r = stroke(st, penV, ride, human);
    n++; if (r.caught) caught++; hot += r.hotT; score += r.score;
    if (r.vs.length > 5) { const m = r.vs.reduce((a, b) => a + b, 0) / r.vs.length, sd = Math.sqrt(r.vs.reduce((a, b) => a + (b - m) ** 2, 0) / r.vs.length); cv.push(sd / m); lo.push(Math.min(...r.vs)); hi.push(Math.max(...r.vs)); }
  }
  const av = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return { caught: (caught / n) * 100, hot: hot / n, score: score / n, cv: av(cv) * 100, lo: av(lo), hi: av(hi) };
}

console.log('一定の速さで引き続けたとき（各 60 回）');
console.log('夜    筆の速さ | 旧: 追いつかれる 熱い秒 点        | 新: 追いつかれる 熱い秒 点       火の速さ(低〜高) ゆらぎ');
for (const night of [[1, 3], [1, 8], [2, 4], [3, 4]]) {
  for (const penV of [300, 400, 520, 700]) {
    const a = measure([OLD], night, penV), b = measure([], night, penV);
    const f = (x) => x.toFixed(0).padStart(3);
    console.log(`${night[0]}-${night[1]}   ${String(penV).padStart(4)}     | ${f(a.caught)}%            ${a.hot.toFixed(1).padStart(4)}  ${f(a.score).padStart(7)}  | ${f(b.caught)}%            ${b.hot.toFixed(1).padStart(4)}  ${f(b.score).padStart(7)}  ${f(b.lo)}〜${f(b.hi)}  ${f(b.cv)}%`);
  }
}

console.log('\n人に近い遅れ(0.28秒)とむら(±30%)で、間合いごとの危険と得');
const HUMAN = { react: 0.28, noise: 0.6 };
for (const night of [[1, 3], [1, 8], [2, 4], [3, 4]]) {
  const row = [60, 90, 130, 170, 260].map((r) => { const b = measure([], night, 0, r, HUMAN); return `${r}: ${b.caught.toFixed(0)}%/${b.hot.toFixed(1)}s/${b.score.toFixed(0)}`; }).join(' | ');
  console.log(`${night[0]}-${night[1]} 間合い: 追いつかれる/熱/点  ${row}`);
}
