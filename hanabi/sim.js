// 一筆花火 2 — 1 夜のルールだけを置く（DOM・描画・音に触らない）。同じ入力なら同じ結果になる。
// 芯: 線を引いている最中に、線の始まりから火が追いかけてくる。火に近いほど熱が上がって点が伸びる。
// 追いつかれると、その一筆はそこで終わる。遊ぶ人は「どこを通るか」と「どこまで火を引きつけるか」を同時に決める。

export const DT = 1 / 60;

export const SHELLS = {
  kiku:     { r: 21, R: 118, pts: 10, kind: 'peony' },
  ootama:   { r: 31, R: 190, pts: 30, kind: 'chrys' },
  kin:      { r: 20, R: 95,  pts: 5,  mult: 1, kind: 'willow' },
  senrin:   { r: 23, R: 70,  pts: 15, sparks: 8, kind: 'crossette' },
  chouchin: { r: 24, R: 95,  pts: 10, lantern: true, kind: 'ring' },
  shime:    { r: 22, R: 118, pts: 25, damp: 2, kind: 'peony' },
  koori:    { r: 22, R: 110, pts: 25, ice: true, kind: 'crossette' },
  oni:      { r: 26, R: 140, pts: 30, oni: true, kind: 'palm' },
  shaku:    { r: 44, R: 340, pts: 200, finale: true, kind: 'kamuro' },
  // 趣向の玉: 線の引き方か、爆発のあとの展開を変える
  nezumi:   { r: 19, R: 60,  pts: 15, runner: 'nezumi', kind: 'crossette' }, // 走り回って火を移す
  roket:    { r: 19, R: 60,  pts: 15, runner: 'roket', kind: 'willow' },     // 矢の向きへ一直線
  oyako:    { r: 27, R: 90,  pts: 20, kids: 4, kind: 'chrys' },              // 子玉が飛び散る
  ko:       { r: 14, R: 70,  pts: 6, kind: 'mini' },
  meoto:    { r: 22, R: 100, pts: 20, kind: 'ring' },                        // 片方ひらくと、もう片方も
  bake:     { r: 23, R: 110, pts: 10, bake: true, kind: 'chrys' },           // 何が起きるか分からない
  kingyo:   { r: 17, R: 70,  pts: 20, coin: 1, kind: 'ring' },               // 泳ぐ
  nige:     { r: 20, R: 120, pts: 40, multAdd: 3, kind: 'chrys' },           // 筆から逃げる
  tome:     { r: 21, R: 90,  pts: 10, tome: true, kind: 'peony' },           // 火が止まる
  juzu:     { r: 20, R: 60,  pts: 15, kind: 'ring' },                        // 順番に通す
};

export const TUNE = {
  ink: 1900,            // 1 本の線の長さの上限
  grace: 0.45,          // 指を置いてから火がつくまで（秒）
  flameV0: 250,         // 火の速さ（論理単位/秒）
  flameVPerPop: 7,      // 玉がひらくたびに火が速くなる分
  flameVMax: 560,
  hotGap: 170,          // この距離より近いと「熱い」
  heatRate: 0.85,       // 熱い間に 1 秒で増える熱
  heatDecay: 0.7,       // 熱くない間に 1 秒で減る熱
  hotShrink: 0.18,      // 熱の段が上がるほど、もっと近づかないと熱を保てない
  // 火の速さ。一定だと距離を保つだけの作業になるので、線の形と出来事で変える
  dyn: true,
  leash: 430,                    // 筆が火より先へ行ける長さ。一気に引いて離す手を封じる
  ageRate: 0.06, ageMax: 1.6,    // 長く燃えるほど速い
  heatSpeed: 0.1,                // 熱の段ごとに速い
  moMin: 0.62, moMax: 1.4,       // 勢い: 直線で増え、曲がり角で減る
  moGain: 0.3, moBrake: 0.34,
  turnMin: 0.3,                  // これより小さい曲がりは数えない（手のぶれ）
  kickLine: 0.4, kickChain: 0.07, kickMax: 1.3, kickDecay: 2.4, // 玉がはじけると火が跳ねる
  gustWarn: 0.55, gustLen: 0.7, gustX: 1.75, lullLen: 0.5, lullX: 0.75, // 突風（予告つき）と、そのあとの凪
  gustGap0: 1.3, gustGapR: 1.7,
  heatLevels: [0.5, 1.6, 3.0], // 熱の段（×2 ×3 ×4）に上がる値
  closeCall: 0.3,       // 火のすぐ前で玉を通したときに足す熱
  closeGap: 95,
  threadR: 7,           // 線が玉に「通った」とみなす余白
  shockV: 720,          // 爆風が広がる速さ
  genDecay: 0.88,
  genMin: 0.5,
  blastR: 1,            // 爆風の大きさの倍率
  pushK: 420,           // 爆風が、まだ線の通っていない玉を押す強さ
  chainEvery: 10,       // この数ひらくごとに倍率 +1
  sparkV: 520,
  sparkLife: 0.55,
  minLen: 40,           // これより短い線は数えない（押し間違い）
  bloomX: 2,            // 満開の倍率
  lanternX: 2,
  dampNeed: 2,
  goldMult: 1,
  chipsX: 1,            // 点全体の倍率
};

export function rng32(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// 盤の大きさ。横長と縦長で別の広さを使い、玉の位置は 0〜1 の割合で持つ（どちらの向きでも同じ並びになる）
export function fieldFor(w, h) {
  return w >= h
    ? { w, h, x0: 70, x1: w - 70, y0: 112, y1: h * 0.62 }
    : { w, h, x0: 60, x1: w - 60, y0: 190, y1: h * 0.72 };
}

// 群れと、離れた玉を混ぜて置く。読みどころは「群れをつなぐ順番」
export function layout(seed, count, mix, field) {
  const rnd = rng32(seed * 2654435761 + 97);
  const nClusters = Math.max(2, Math.round(count / 6));
  const centers = [];
  for (let i = 0; i < nClusters; i++) {
    for (let t = 0; t < 30; t++) {
      const c = { u: 0.08 + rnd() * 0.84, v: 0.1 + rnd() * 0.8 };
      if (centers.every((o) => Math.hypot((o.u - c.u) * (field.x1 - field.x0), (o.v - c.v) * (field.y1 - field.y0)) > 230)) { centers.push(c); break; }
    }
  }
  const types = [];
  for (const [k, n] of Object.entries(mix)) for (let i = 0; i < n; i++) types.push(k);
  while (types.length < count) types.push('kiku');
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const out = [];
  const place = (u, v, type) => {
    const x = field.x0 + u * (field.x1 - field.x0), y = field.y0 + v * (field.y1 - field.y0);
    const r = SHELLS[type].r;
    return out.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + r + 16) ? { x, y } : null;
  };
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    let p = null;
    for (let t = 0; t < 60 && !p; t++) {
      const inCluster = i % 5 !== 4;
      if (inCluster && centers.length) {
        const c = centers[i % centers.length];
        const a = rnd() * Math.PI * 2, d = 40 + rnd() * 120;
        const u = c.u + (Math.cos(a) * d) / (field.x1 - field.x0), v = c.v + (Math.sin(a) * d) / (field.y1 - field.y0);
        if (u < 0 || u > 1 || v < 0 || v > 1) continue;
        p = place(u, v, type);
      } else p = place(rnd(), rnd(), type);
    }
    if (p) out.push({ ...p, type, r: SHELLS[type].r });
  }
  return out;
}

export function newShell(id, x, y, type, rise = 0) {
  const d = SHELLS[type];
  return { id, type, x, y, vx: 0, vy: 0, r: d.r, R: d.R, pts: d.pts, state: 'idle', threaded: false, hits: 0, rise, phase: (id * 0.37) % 6.28, litBy: null, how: null };
}

// level: { seed, count, mix, strokes, refill, target, rule, id }
// loadout: { charms: [def], recipes: { type: lv }, coins }
export function newNight(level, w, h, loadout = {}) {
  const field = fieldFor(w, h);
  const charms = loadout.charms || [];
  const m = { ...TUNE, strokesAdd: 0, refillAdd: 0, countAdd: 0, flameX: 1, startChips: 0, startMult: 0, addMix: {} };
  for (const c of charms) if (c.mod) c.mod(m, loadout);
  if (level.flame) m.flameX *= level.flame;
  if (level.rule === 'kasha') m.flameX *= 1.55;
  if (level.rule === 'ishun') m.ink *= 0.55;
  const mix = { ...(level.mix || {}) };
  for (const [k, n] of Object.entries(m.addMix)) mix[k] = (mix[k] || 0) + n;
  if (m.onlyOneStroke) m.strokesAdd = -99;
  const strokes = Math.max(1, (level.strokes ?? 3) + m.strokesAdd);
  const st = {
    level, field, w, h, t: 0, seed: level.seed, m, loadout, charms,
    recipes: loadout.recipes || {},
    shells: [], nextId: 1, sparks: [], pending: [], drops: [], knots: [],
    maxStrokes: strokes, strokesLeft: strokes, strokesUsed: 0,
    score: 0, target: level.target, cleared: false, failed: false,
    stroke: null, phase: 'aim', events: [], rnd: rng32(level.seed + 5),
    bestChain: 0, blooms: 0, totalPops: 0, coinsEarned: 0, carriedInk: 0, closeCalls: 0, caughtCount: 0, encore: 0,
    ink: m.ink, rule: level.rule || null, dropT: 0,
    twist: level.twist || null, runners: [], crows: [], blades: [], zones: [], shape: null,
    streak: loadout.streak || 0, lastBloom: false, act2: false, goalMet: false, intruded: false, refillTypes: [],
    crowMax: 0, crowLeft: 0, crowT: 0, falling: false, fallT: 0,
  };
  const count = (level.count || 16) + m.countAdd;
  for (const s of layout(level.seed, count, mix, field)) st.shells.push(newShell(st.nextId++, s.x, s.y, s.type));
  if (level.rule === 'kappa') st.shells.forEach((s, i) => { if (i % 2 === 0 && s.type === 'kiku') retype(s, 'shime'); });
  if (st.twist && TWIST_SETUP[st.twist]) TWIST_SETUP[st.twist](st);
  st.startCount = st.shells.length;
  fire(st, 'nightStart', {});
  return st;
}

function retype(s, type) { const d = SHELLS[type]; s.type = type; s.r = d.r; s.R = d.R; s.pts = d.pts; }

const TAU = Math.PI * 2;
function initShell(st, s) {
  if (s.type === 'roket') s.dir = st.rnd() * TAU;
  if (s.type === 'kingyo') s.swim = { a: st.rnd() * TAU, v: 70 + st.rnd() * 50, t: 0 };
  return s;
}
function addShell(st, x, y, type, rise = 0) { const s = initShell(st, newShell(st.nextId++, x, y, type, rise)); st.shells.push(s); return s; }
// ふつうの玉を、趣向の玉に変える
function typeSome(st, type, n) {
  const idle = st.shells.filter((s) => s.state === 'idle' && s.rise >= 0 && s.type !== type && s.type !== 'shaku');
  const pool = [...idle.filter((s) => s.type === 'kiku'), ...idle.filter((s) => s.type !== 'kiku')];
  for (let i = 0; i < n && pool.length; i++) {
    const j = Math.floor(st.rnd() * Math.min(pool.length, 12)), [s] = pool.splice(j, 1);
    retype(s, type); initShell(st, s);
  }
}
// 夫婦玉は、なるべく離れた相手と組む
function pairUp(st) {
  const lone = st.shells.filter((s) => s.type === 'meoto' && s.state === 'idle' && !s.pair);
  while (lone.length >= 2) {
    const a = lone.shift(); let bi = 0, bd = -1;
    lone.forEach((b, i) => { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d > bd) { bd = d; bi = i; } });
    const [b] = lone.splice(bi, 1); a.pair = b.id; b.pair = a.id;
  }
}
function numberJuzu(st) {
  const list = st.shells.filter((s) => s.type === 'juzu' && s.state === 'idle');
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(st.rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  list.slice(0, 6).forEach((s, i) => { s.num = i + 1; });
  list.slice(6).forEach((s) => retype(s, 'kiku'));
  st.juzuN = Math.min(6, list.length);
}
function fieldPoint(st, pad = 0) { const f = st.field; return { x: f.x0 + pad + st.rnd() * (f.x1 - f.x0 - pad * 2), y: f.y0 + pad + st.rnd() * (f.y1 - f.y0 - pad * 2) }; }
function spawnRising(st, type, n) {
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 40; t++) {
      const p = fieldPoint(st);
      if (st.shells.every((s) => s.state !== 'idle' || Math.hypot(s.x - p.x, s.y - p.y) > s.r + SHELLS[type].r + 14)) {
        const s = addShell(st, p.x, p.y, type, 0.1 + i * 0.08);
        st.events.push({ type: 'rise', shell: s });
        break;
      }
    }
  }
}

// 型物: 玉で絵を描く。絵は折れ線（-1〜1）で持ち、同じ間隔で玉を置く（どの向きの盤でも重ならない）
const curve = (n, f) => Array.from({ length: n + 1 }, (_, i) => f((i / n) * TAU));
export const SHAPES = {
  heart: () => [curve(80, (t) => [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17])],
  star: () => { const v = []; for (let i = 0; i <= 10; i++) { const r = i % 2 ? 0.42 : 1, a = (i / 10) * TAU - Math.PI / 2; v.push([Math.cos(a) * r, Math.sin(a) * r]); } return [v]; },
  dai: () => [[[-0.85, -0.4], [0.85, -0.4]], [[0, -1], [0, -0.4], [-0.8, 1]], [[0.1, -0.1], [0.8, 1]]],
  flower: () => [curve(100, (t) => { const r = 0.6 + 0.4 * Math.cos(5 * t); return [Math.cos(t) * r, Math.sin(t) * r]; })],
  neko: () => [[...curve(40, (t) => [Math.cos(t + 2.2) * 0.8, Math.sin(t + 2.2) * 0.68 + 0.3]).slice(0, 26), [0.82, -0.8], [0.3, -0.34], [0, -0.38], [-0.3, -0.34], [-0.82, -0.8], [-0.62, -0.1]], [[-0.3, 0.2]], [[0.3, 0.2]]],
  fish: () => [[...curve(40, (t) => [Math.cos(t + 0.5) * 0.74 - 0.22, Math.sin(t + 0.5) * 0.56]).slice(0, 37), [0.98, 0.74], [0.98, -0.74], [0.42, -0.26]], [[-0.55, -0.1]]],
};
export function shapePoints(name, field, gap = 58) {
  const f = field, cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2, h = (f.y1 - f.y0) * 0.47, w = Math.min((f.x1 - f.x0) * 0.47, h * 1.75);
  const out = [];
  const put = (x, y) => { if (out.every((p) => Math.hypot(p.x - x, p.y - y) >= gap - 8)) out.push({ x, y }); };
  for (const lineP of SHAPES[name]()) {
    let left = 0;
    for (let i = 0; i < lineP.length; i++) {
      const x = cx + lineP[i][0] * w, y = cy + lineP[i][1] * h;
      if (i === 0) { put(x, y); continue; }
      const px = cx + lineP[i - 1][0] * w, py = cy + lineP[i - 1][1] * h, d = Math.hypot(x - px, y - py);
      let at = gap - left;
      while (at <= d) { put(px + ((x - px) * at) / d, py + ((y - py) * at) / d); at += gap; }
      left = (left + d) % gap;
    }
  }
  return out;
}
function shapeBoard(st) {
  const names = Object.keys(SHAPES), name = names[Math.floor(st.rnd() * names.length)];
  st.shells.length = 0;
  const pts = shapePoints(name, st.field);
  pts.forEach((p, i) => addShell(st, p.x, p.y, i % 6 === 0 ? 'kin' : 'kiku'));
  st.shape = { name, pts };
  st.m.blastR *= 0.28;   // なぞらないとつながらない
}

const TWIST_SETUP = {
  nezumi(st) { typeSome(st, 'nezumi', 5); st.refillTypes = ['nezumi']; },
  roket(st) { typeSome(st, 'roket', 6); st.refillTypes = ['roket']; },
  oyako(st) { typeSome(st, 'oyako', 5); st.refillTypes = ['oyako']; },
  kingyo(st) { typeSome(st, 'kingyo', 8); st.refillTypes = ['kingyo']; },
  bake(st) { typeSome(st, 'bake', 7); st.refillTypes = ['bake']; },
  tome(st) { typeSome(st, 'tome', 5); st.refillTypes = ['tome']; },
  nige(st) { typeSome(st, 'nige', 4); st.refillTypes = ['nige']; },
  meoto(st) { typeSome(st, 'meoto', 8); pairUp(st); st.refillTypes = ['meoto']; },
  juzu(st) { typeSome(st, 'juzu', 6); numberJuzu(st); },
  katamono: shapeBoard,
  gyoretsu(st) {
    const f = st.field; st.shells = st.shells.filter((_, i) => i % 3 === 0);
    for (const [v, rate] of [[0.28, 82], [0.74, -66]]) {
      const y0 = f.y0 + (f.y1 - f.y0) * v;
      for (let i = 0; i < 9; i++) {
        const s = addShell(st, f.x0 + ((f.x1 - f.x0) * i) / 9, y0, i % 4 === 0 ? 'kin' : 'chouchin');
        s.parade = { v: rate, y0, amp: 20, ph: i * 0.7 };
      }
    }
    // 列の外の玉は、列にかぶらない所へ
    for (const s of st.shells) if (!s.parade && Math.min(Math.abs(s.y - (f.y0 + (f.y1 - f.y0) * 0.28)), Math.abs(s.y - (f.y0 + (f.y1 - f.y0) * 0.74))) < 40) s.y = f.y0 + (f.y1 - f.y0) * 0.51;
  },
  senpatsu(st) {
    const f = st.field, land = st.w >= st.h, cols = land ? 15 : 8, rows = land ? 4 : 8;
    st.shells.length = 0;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const u = (c + 0.5 + (st.rnd() - 0.5) * 0.3) / cols, v = (r + 0.5 + (st.rnd() - 0.5) * 0.3) / rows;
      addShell(st, f.x0 + u * (f.x1 - f.x0), f.y0 + v * (f.y1 - f.y0), st.rnd() < 0.08 ? 'kin' : 'ko');
    }
  },
  ippatsu(st) {
    const f = st.field; st.shells.length = 0;
    addShell(st, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 'shaku');
    st.m.ink *= 1.5; st.ink = st.m.ink;
  },
  ryusei(st) { st.falling = true; st.m.ink *= 1.7; st.ink = st.m.ink; st.shells = st.shells.filter((_, i) => i % 2 === 0); },
  abura: makeZones,
  kaza(st) { makeBlades(st, 2); },
  karasu(st) { st.crowMax = 4; },
};
function makeZones(st) {
  const f = st.field, land = st.w >= st.h;
  const place = (kind, r) => { for (let t = 0; t < 30; t++) { const p = { x: f.x0 + r * 0.6 + st.rnd() * (f.x1 - f.x0 - r * 1.2), y: f.y0 + r * 0.5 + st.rnd() * (f.y1 - f.y0 - r), r, kind }; if (st.zones.every((z) => Math.hypot(z.x - p.x, z.y - p.y) > z.r + r)) { st.zones.push(p); return; } } };
  place('oil', land ? 170 : 150); place('water', land ? 140 : 125); place('oil', land ? 130 : 115); if (land) place('water', 110);
}
function makeBlades(st, n) {
  const f = st.field;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : 0.25 + (i / (n - 1)) * 0.5;
    st.blades.push({ x: f.x0 + u * (f.x1 - f.x0), y: f.y0 + (f.y1 - f.y0) * (0.35 + st.rnd() * 0.3), len: Math.min(135, (f.y1 - f.y0) * 0.42), a: st.rnd() * TAU, w: (i % 2 ? -1 : 1) * 1.45 });
  }
}
export function zoneAt(st, x, y) { for (const z of st.zones) if (Math.hypot(z.x - x, z.y - y) < z.r) return z; return null; }

// 乱入: 夜の途中で、知らされていないことが起きる
function intrude(st) {
  if (st.intruded || !st.level.intrude) return;
  st.intruded = true;
  const kind = st.level.intrude;
  st.events.push({ type: 'intrude', kind });
  if (kind === 'fuku') spawnRising(st, 'kin', 5);
  if (kind === 'nezumi') spawnRising(st, 'nezumi', 4);
  if (kind === 'oyako') spawnRising(st, 'oyako', 3);
  if (kind === 'bake') spawnRising(st, 'bake', 4);
  if (kind === 'karasu') { st.crowMax = 3; st.crowLeft = 3; st.crowT = 0.2; }
  if (kind === 'kaza') makeBlades(st, 1);
}

// お守りの呼び出し。c にそのときの情報を入れて渡す
function fire(st, name, c) {
  c.st = st; c.k = st.stroke;
  c.coin = (n) => { st.coinsEarned += n; };
  const k = st.stroke;
  for (const ch of st.charms) {
    const f = ch.on && ch.on[name]; if (!f) continue;
    const m0 = k ? k.mult : 0, p0 = c.pts, c0 = st.coinsEarned, s0 = st.strokesLeft;
    f(c, ch);
    const dM = k ? k.mult - m0 : 0, dP = c.pts !== undefined ? c.pts - p0 : 0, dC = st.coinsEarned - c0;
    // お守りが効いた瞬間を画面に見せる（袋がはねて、数字が飛ぶ）
    if (dM || dP || dC || st.strokesLeft !== s0) st.events.push({ type: 'charmFire', id: ch.id, dMult: dM, dPts: dP, dCoin: dC, x: c.s?.x, y: c.s?.y });
  }
  return c;
}

const newStroke = (st) => ({
  pts: [], len: 0, flameS: 0, flameOn: false, age: 0, penDown: true, caught: false, inkOut: false, fuseOut: false,
  heat: 0, heatLv: 0, chips: st.m.startChips, mult: 1 + st.m.startMult, pops: 0, lantern: 0, done: false, idx: 0, mi: 0, fx: 0, fy: 0, fv: st.m.flameV0 * st.m.flameX, threaded: 0, close: 0,
  gens: 0, types: {}, cutS: Infinity, saved: 0, turn: 0, fm: null, stopT: 0, juzu: 0,
  v: st.m.flameV0 * st.m.flameX, mo: 1, kick: 0, ti: 0, gustIn: st.level.gusts ? st.m.gustGap0 + st.rnd() * st.m.gustGapR : Infinity, gustWarnT: 0, gustT: 0, lullT: 0,
});

export function penDown(st, x, y) {
  if (st.phase !== 'aim') return false;
  st.stroke = newStroke(st);
  const k = st.stroke;
  k.pts.push({ x, y, s: 0 });
  k.fx = x; k.fy = y;
  st.phase = 'stroke';
  st.crowLeft = st.crowMax; st.crowT = 0.7; st.fallT = 0;
  fire(st, 'strokeStart', {});
  st.events.push({ type: 'penDown', x, y });
  threadAt(st, x, y);
  return true;
}

const inkLimit = (st) => st.ink + st.carriedInk;

export function penMove(st, x, y) {
  const k = st.stroke;
  if (!k || !k.penDown) return;
  k.want = { x, y };
  extendLine(st);
}

// 指のある所へ線を伸ばす。火から離れすぎると伸びず、火が来ると伸びる（step からも呼ぶ）
function extendLine(st) {
  const k = st.stroke;
  if (!k || !k.penDown || !k.want) return;
  const last = k.pts[k.pts.length - 1];
  let dx = k.want.x - last.x, dy = k.want.y - last.y, d = Math.hypot(dx, dy);
  if (d < 5) { k.held = false; return; }
  let room = inkLimit(st) - k.len;
  if (st.m.dyn) {
    const lead = st.m.leash - (k.len - k.flameS);
    const heldNow = lead < d;
    if (heldNow && !k.held && k.flameOn) st.events.push({ type: 'held' });
    k.held = heldNow;
    if (lead < 5) return;
    room = Math.min(room, lead);
  }
  if (d > room) { dx *= room / d; dy *= room / d; d = room; }
  if (k.pts.length > 2) { const p = k.pts[k.pts.length - 2]; const a0 = Math.atan2(last.y - p.y, last.x - p.x), a1 = Math.atan2(dy, dx); let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; k.turn += Math.abs(da); if (Math.abs(da) >= st.m.turnMin) last.bend = Math.abs(da); }
  const n = Math.max(1, Math.ceil(d / 14));
  for (let i = 1; i <= n; i++) {
    const px = last.x + (dx * i) / n, py = last.y + (dy * i) / n;
    k.len += d / n;
    k.pts.push({ x: px, y: py, s: k.len });
    threadAt(st, px, py);
    if (st.m.knots) checkKnot(st, px, py);
  }
  if (inkLimit(st) - k.len < 1) { k.inkOut = true; penUp(st); st.events.push({ type: 'inkOut' }); }
}

export function penUp(st) {
  const k = st.stroke;
  if (!k || !k.penDown) return;
  k.penDown = false;
  if (k.len < st.m.minLen) { // 押し間違いは数えない
    for (const s of st.shells) s.threaded = false;
    st.stroke = null; st.phase = 'aim';
    st.events.push({ type: 'cancel' });
    return;
  }
  st.events.push({ type: 'penUp', x: k.pts[k.pts.length - 1].x, y: k.pts[k.pts.length - 1].y });
}

function threadAt(st, x, y) {
  const k = st.stroke, m = st.m;
  const check = (px, py) => {
    for (const s of st.shells) {
      if (s.state !== 'idle' || s.threaded || s.rise > 0) continue;
      if (Math.hypot(s.x - px, s.y - py) < s.r + m.threadR) {
        s.threaded = true; s.vx = 0; s.vy = 0; k.threaded++;
        const gap = k.len - k.flameS;
        const close = k.flameOn && gap < m.closeGap;
        if (close) { k.heat += m.closeCall; k.close++; st.closeCalls++; }
        if (s.type === 'juzu' && s.num) {
          if (s.num === k.juzu + 1) {
            k.juzu++; k.mult += k.juzu;
            st.events.push({ type: 'juzu', ok: true, n: k.juzu, x: s.x, y: s.y, mult: k.mult });
            if (k.juzu === st.juzuN) { k.mult += 5; st.events.push({ type: 'juzuDone', x: s.x, y: s.y, mult: k.mult }); }
          } else st.events.push({ type: 'juzu', ok: false, x: s.x, y: s.y });
        }
        const c = fire(st, 'thread', { s, close, gap });
        st.events.push({ type: 'thread', shell: s, n: k.threaded, close, ...(c.x ? { extra: c.x } : {}) });
      }
    }
  };
  check(x, y);
  if (st.rule === 'kagami' || m.mirror) check(st.w - x, y);
}

// 自分の線と交わったら結び目（火が来ると爆ぜる）
function checkKnot(st, x, y) {
  const k = st.stroke; const P = k.pts, n = P.length;
  if (st.knots.length >= (st.m.knots || 0) * 3) return;
  for (let i = 0; i < n - 8; i += 2) {
    if (Math.hypot(P[i].x - x, P[i].y - y) < 7) {
      if (st.knots.some((q) => Math.hypot(q.x - x, q.y - y) < 60)) return;
      st.knots.push({ x, y, s: P[i].s, done: false });
      st.events.push({ type: 'knot', x, y });
      return;
    }
  }
}

function pointAt(k, s) {
  const P = k.pts;
  while (k.idx < P.length - 2 && P[k.idx + 1].s < s) k.idx++;
  const a = P[k.idx], b = P[Math.min(k.idx + 1, P.length - 1)];
  const u = b.s > a.s ? Math.min(1, (s - a.s) / (b.s - a.s)) : 0;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

export const heatMult = (lv, st) => 1 + lv + (lv >= 3 && st ? (st.m.heatTop || 0) : 0);
export const liveScore = (st) => st.score + (st.stroke && !st.stroke.done ? Math.floor(st.stroke.chips * st.stroke.mult) : 0);

function ignite(st, s, gen, how, delay = 0) {
  if (s.state !== 'idle') return;
  const m = st.m;
  if (how !== 'line' && s.type === 'shime') { s.hits++; st.events.push({ type: 'damp', shell: s }); if (s.hits < m.dampNeed) return; }
  if (how === 'line' && s.type === 'koori' && !m.iceLine) return;  // 氷玉は爆風でとかす
  if (s.type === 'shaku' && how !== 'line') return;                 // 尺玉は線の火でひらく
  s.state = 'lit'; s.how = how;
  st.pending.push({ s, gen, how, at: st.t + delay });
}

function burst(st, s, gen, how) {
  const k = st.stroke, d = SHELLS[s.type], m = st.m;
  s.state = 'burst';
  const decay = Math.max(m.genMin, m.genDecay ** gen);
  let R = s.R * decay * m.blastR;
  k.pops++; st.totalPops++;
  k.types[s.type] = (k.types[s.type] || 0) + 1;
  const heatX = heatMult(k.heatLv, st);
  const lvl = st.recipes[s.type] || 0;
  let pts = (s.pts + lvl * Math.max(5, Math.round(d.pts * 0.5))) * heatX;
  if (k.lantern > 0) pts *= m.lanternX;
  if (st.zones.length && zoneAt(st, s.x, s.y)?.kind === 'oil') pts *= 3;
  const mult0 = k.mult;
  const c = fire(st, 'burst', { s, gen, how, pts, R, n: k.pops, heatLv: k.heatLv });
  pts = c.pts * m.chipsX; R = c.R;
  k.chips += Math.round(pts);
  if (d.mult) k.mult += m.goldMult + lvl;
  if (d.lantern) k.lantern++;
  if (d.multAdd) k.mult += d.multAdd;
  if (d.coin) { st.coinsEarned += d.coin; st.events.push({ type: 'coinPop', x: s.x, y: s.y, n: d.coin }); }
  if (d.tome && how === 'line') { k.stopT = 1; st.events.push({ type: 'tome', x: k.fx, y: k.fy }); }
  if (d.finale && st.twist === 'ippatsu' && k.heatLv >= 2 && !st.goalMet) { st.goalMet = true; st.events.push({ type: 'goal', x: s.x, y: s.y }); }
  if (d.oni) k.mult = Math.max(1, k.mult + (how === 'line' ? 3 : (m.oniSafe ? 0 : -2)));
  if (d.finale) k.mult += 1 + Math.round((10 * k.pops) / Math.max(1, st.startCount));
  if (k.pops % m.chainEvery === 0) k.mult += 1;
  k.fv = Math.min(m.flameVMax * m.flameX, k.fv + m.flameVPerPop * m.flameX);
  if (m.dyn) k.kick = Math.min(m.kickMax, k.kick + (how === 'line' ? m.kickLine : m.kickChain));
  st.bestChain = Math.max(st.bestChain, k.pops);
  st.events.push({ type: 'burst', shell: s, gen, how, R, pts: Math.round(pts), chips: k.chips, mult: k.mult, multUp: k.mult - mult0, n: k.pops, heatLv: k.heatLv });
  // 爆風が届いた玉に火を移し、線の通っていない玉は押し出す
  for (const o of st.shells) {
    if (o.state !== 'idle' || o === s || o.rise > 0) continue;
    const dist = Math.hypot(o.x - s.x, o.y - s.y);
    if (dist < R + o.r) ignite(st, o, gen + 1, 'blast', dist / m.shockV + 0.04);
    else if (dist < R * 1.8 && !o.threaded) {
      const f = ((m.pull ? -1 : 1) * m.pushK * (1 - dist / (R * 1.8))) / Math.max(dist, 1);
      o.vx += (o.x - s.x) * f; o.vy += (o.y - s.y) * f;
    }
  }
  // 烏は爆風で落ちる。さらった玉は返ってくる
  for (let i = st.crows.length - 1; i >= 0; i--) {
    const c = st.crows[i];
    if (Math.hypot(c.x - s.x, c.y - s.y) < R) { dropCrow(st, c); st.crows.splice(i, 1); st.coinsEarned += 2; st.events.push({ type: 'crowDown', x: c.x, y: c.y, n: 2 }); }
  }
  if (s.pair) {
    const o = st.shells.find((x) => x.id === s.pair);
    if (o && o.state === 'idle') { ignite(st, o, gen, 'line', 0.14); k.mult += 1; st.events.push({ type: 'meoto', x: s.x, y: s.y, ox: o.x, oy: o.y, mult: k.mult }); }
  }
  if (d.runner) {
    const roket = d.runner === 'roket';
    st.runners.push({ kind: d.runner, x: s.x, y: s.y, a: roket ? s.dir : st.rnd() * TAU, w: 0, v: roket ? 980 : 470, life: roket ? 1.5 : 2.5, gen: gen + 1 });
    st.events.push({ type: 'runner', kind: d.runner, x: s.x, y: s.y });
  }
  if (d.kids) {
    for (let i = 0; i < d.kids; i++) {
      const a = (i / d.kids) * TAU + st.rnd(), v = 300 + st.rnd() * 240, c = addShell(st, s.x, s.y, 'ko');
      c.vx = Math.cos(a) * v; c.vy = Math.sin(a) * v;
    }
    st.events.push({ type: 'kids', x: s.x, y: s.y, n: d.kids });
  }
  if (d.bake) bakeOut(st, s);
  if (d.sparks || m.sparkAll) {
    const cnt = (d.sparks ? d.sparks : 0) + (m.sparkAll || 0) + (d.sparks ? (m.sparkAdd || 0) : 0);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2 + s.id;
      st.sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * m.sparkV, vy: Math.sin(a) * m.sparkV, life: m.sparkLife, gen: gen + 1 });
    }
  }
}

// 化け玉: 開けてみるまで分からない
function bakeOut(st, s) {
  const k = st.stroke, what = ['fuku', 'koban', 'tanuki', 'oni', 'tane', 'kinka'][Math.floor(st.rnd() * 6)];
  if (what === 'fuku') k.mult += 3;
  if (what === 'koban') st.coinsEarned += 3;
  if (what === 'oni') k.kick = st.m.kickMax;
  if (what === 'tane') spawnRising(st, 'kiku', 5);
  if (what === 'tanuki') {
    const list = st.shells.filter((o) => o.state === 'idle' && !o.threaded && o.rise <= 0 && !o.parade);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(st.rnd() * (i + 1)); const a = list[i], b = list[j]; [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y]; }
  }
  if (what === 'kinka') {
    const near = st.shells.filter((o) => o.state === 'idle' && o.type !== 'shaku').sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, 3);
    for (const o of near) { retype(o, 'kin'); o.swim = null; }
  }
  st.events.push({ type: 'bake', what, x: s.x, y: s.y, mult: k.mult });
}

function moveRunners(st, dt) {
  const f = st.field;
  for (let i = st.runners.length - 1; i >= 0; i--) {
    const q = st.runners[i];
    q.life -= dt;
    if (q.kind === 'nezumi') {
      q.w = Math.max(-7, Math.min(7, q.w + (st.rnd() - 0.5) * 60 * dt));
      q.a += q.w * dt;
    }
    q.x += Math.cos(q.a) * q.v * dt; q.y += Math.sin(q.a) * q.v * dt;
    if (q.kind === 'nezumi') { // 壁ではね返る
      if (q.x < f.x0 - 20 || q.x > f.x1 + 20) { q.a = Math.PI - q.a; q.x = Math.max(f.x0 - 20, Math.min(f.x1 + 20, q.x)); }
      if (q.y < f.y0 - 20 || q.y > f.y1 + 20) { q.a = -q.a; q.y = Math.max(f.y0 - 20, Math.min(f.y1 + 20, q.y)); }
    } else if (q.x < -40 || q.x > st.w + 40 || q.y < -40 || q.y > st.h + 40) q.life = 0;
    for (const s of st.shells) if (s.state === 'idle' && s.rise <= 0 && Math.hypot(s.x - q.x, s.y - q.y) < s.r + 12) ignite(st, s, q.gen, 'spark', 0);
    if (q.life <= 0) st.runners.splice(i, 1);
  }
}

// 烏: 線の通っていない玉をさらう。筆で追い払える
function dropCrow(st, c) { if (c.carry) { c.carry.state = 'idle'; c.carry.x = Math.max(st.field.x0, Math.min(st.field.x1, c.x)); c.carry.y = Math.max(st.field.y0, Math.min(st.field.y1, c.y)); c.carry = null; } }
const crowValue = (s) => (s.type === 'kin' ? 3 : s.type === 'shaku' ? 0 : SHELLS[s.type].pts >= 25 ? 2 : 1);
function moveCrows(st, dt) {
  const k = st.stroke;
  if (k && k.penDown && st.crowLeft > 0) {
    st.crowT -= dt;
    if (st.crowT <= 0) {
      st.crowT = 1.5; st.crowLeft--;
      const left = st.rnd() < 0.5;
      st.crows.push({ x: left ? -30 : st.w + 30, y: st.field.y0 + st.rnd() * (st.field.y1 - st.field.y0) * 0.6, target: null, carry: null, away: false });
      st.events.push({ type: 'crowIn' });
    }
  }
  const pen = k && k.penDown && k.pts.length ? k.pts[k.pts.length - 1] : null;
  for (let i = st.crows.length - 1; i >= 0; i--) {
    const c = st.crows[i];
    if (pen && !c.away && Math.hypot(c.x - pen.x, c.y - pen.y) < 46) { c.away = true; dropCrow(st, c); st.coinsEarned += 1; st.events.push({ type: 'shoo', x: c.x, y: c.y, n: 1 }); }
    if (c.away || c.carry) { c.y -= 340 * dt; c.x += (c.x < st.w / 2 ? -1 : 1) * 200 * dt; if (c.y < -40 || c.x < -60 || c.x > st.w + 60) st.crows.splice(i, 1); continue; }
    if (!c.target || c.target.state !== 'idle' || c.target.threaded) {
      let best = null, bv = 0;
      for (const s of st.shells) { if (s.state !== 'idle' || s.threaded || s.rise > 0) continue; const v = crowValue(s) / (120 + Math.hypot(s.x - c.x, s.y - c.y)); if (v > bv) { bv = v; best = s; } }
      c.target = best;
      if (!best) { c.away = true; continue; }
    }
    const dx = c.target.x - c.x, dy = c.target.y - c.y, d = Math.hypot(dx, dy), v = 300;
    if (d < 14) { c.target.state = 'stolen'; c.carry = c.target; c.target = null; st.events.push({ type: 'crowTake', x: c.x, y: c.y }); }
    else { c.x += (dx / d) * v * dt; c.y += (dy / d) * v * dt; }
  }
}

// 風車: まだ燃えていない線を切る
function cutByBlades(st, dt) {
  const k = st.stroke;
  for (const b of st.blades) {
    b.a += b.w * dt;
    if (!k || !k.flameOn || k.fuseOut) continue;
    const ca = Math.cos(b.a), sa = Math.sin(b.a);
    for (let j = k.pts.length - 1; j >= 0; j--) {
      const p = k.pts[j];
      if (p.s <= k.flameS + 30) break;
      if (p.s >= k.cutS) continue;
      const u = (p.x - b.x) * ca + (p.y - b.y) * sa, vv = -(p.x - b.x) * sa + (p.y - b.y) * ca;
      if (Math.abs(u) < b.len && Math.abs(vv) < 8) { k.cutS = p.s; st.events.push({ type: 'cut', x: p.x, y: p.y }); }
    }
  }
}

// いまの火の速さ。指を離したあとは、もう危険がないので急いで燃やす（待たせない）
function flameSpeed(st, k, dt) {
  const m = st.m;
  let v = k.fv;
  if (m.dyn) {
    // 曲がり角を通ると勢いが落ちる。直線では勢いが増す
    let bend = 0;
    while (k.ti < k.pts.length - 1 && k.pts[k.ti].s <= k.flameS) { bend += k.pts[k.ti].bend || 0; k.ti++; }
    if (bend > 0) { const before = k.mo; k.mo = Math.max(m.moMin, k.mo - bend * m.moBrake); if (before - k.mo > 0.08) st.events.push({ type: 'brake', x: k.fx, y: k.fy }); }
    k.mo = Math.min(m.moMax, k.mo + m.moGain * dt);
    k.kick *= Math.exp(-m.kickDecay * dt);
    v *= Math.min(m.ageMax, 1 + m.ageRate * k.age) * (1 + m.heatSpeed * k.heatLv) * k.mo * (1 + k.kick);
    // 突風: 予告 → 速くなる → 凪
    if (k.penDown) {
      if (k.gustT > 0) { k.gustT -= dt; v *= m.gustX; if (k.gustT <= 0) k.lullT = m.lullLen; }
      else if (k.lullT > 0) { k.lullT -= dt; v *= m.lullX; if (k.lullT <= 0) k.gustIn = m.gustGap0 + st.rnd() * m.gustGapR; }
      else if (k.gustWarnT > 0) { k.gustWarnT -= dt; if (k.gustWarnT <= 0) { k.gustT = m.gustLen; st.events.push({ type: 'gust', x: k.fx, y: k.fy }); } }
      else { k.gustIn -= dt; if (k.gustIn <= 0) { k.gustWarnT = m.gustWarn; k.gustIn = Infinity; st.events.push({ type: 'gustWarn', x: k.fx, y: k.fy }); } }
    }
  }
  if (st.zones.length) { const z = zoneAt(st, k.fx, k.fy); if (z && k.penDown) v *= z.kind === 'oil' ? 1.8 : 0.5; }
  return v * (k.penDown ? 1 : 2.6);
}

function moveIdle(st, dt) {
  const f = st.field;
  const wind = st.rule === 'kaze' ? Math.sin(st.t * 0.5) * 70 : 0;
  for (const s of st.shells) {
    if (s.rise > 0) { s.rise -= dt; continue; }
    if (s.state !== 'idle' || s.threaded) continue;
    if (s.swim) {
      const q = s.swim; q.t -= dt;
      if (q.t <= 0) { q.a += (st.rnd() - 0.5) * 2.2; q.t = 0.6 + st.rnd() * 1.2; }
      s.x += Math.cos(q.a) * q.v * dt; s.y += Math.sin(q.a) * q.v * dt;
      if (s.x < f.x0 || s.x > f.x1) { q.a = Math.PI - q.a; s.x = Math.max(f.x0, Math.min(f.x1, s.x)); }
      if (s.y < f.y0 || s.y > f.y1) { q.a = -q.a; s.y = Math.max(f.y0, Math.min(f.y1, s.y)); }
    }
    if (s.parade) {
      const q = s.parade; s.x += q.v * dt; s.y = q.y0 + Math.sin(st.t * 1.4 + q.ph) * q.amp;
      if (s.x > f.x1 + 34) s.x = f.x0 - 34; if (s.x < f.x0 - 34) s.x = f.x1 + 34;
    }
    if (s.type === 'nige' && st.stroke?.penDown && st.stroke.pts.length) {
      const p = st.stroke.pts[st.stroke.pts.length - 1], dx = s.x - p.x, dy = s.y - p.y, d = Math.hypot(dx, dy) || 1;
      if (d < 235) { const v = 130 + (1 - d / 235) * 300; s.x = Math.max(f.x0, Math.min(f.x1, s.x + (dx / d) * v * dt)); s.y = Math.max(f.y0, Math.min(f.y1, s.y + (dy / d) * v * dt)); }
    }
    if (s.fall) { s.y += s.fall * dt; if (s.y > f.y1 + 46) { s.state = 'gone'; continue; } }
    if (wind) { s.x += wind * dt * (0.7 + (s.id % 5) * 0.12); if (s.x < f.x0 - 30) s.x = f.x1 + 20; if (s.x > f.x1 + 30) s.x = f.x0 - 20; }
    if (s.vx || s.vy) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      const fr = Math.exp(-3.2 * dt);
      s.vx *= fr; s.vy *= fr;
      if (Math.abs(s.vx) + Math.abs(s.vy) < 2) { s.vx = 0; s.vy = 0; }
      s.x = Math.max(f.x0 - 30, Math.min(f.x1 + 30, s.x));
      s.y = Math.max(f.y0 - 30, Math.min(f.y1 + 30, s.y));
    }
  }
}

// 雨女: しずくがまだ燃えていない線に当たると、そこで線が切れる
function rain(st, dt) {
  st.dropT -= dt;
  const k = st.stroke;
  if (st.dropT <= 0) {
    st.dropT = 0.1;
    st.drops.push({ x: st.rnd() * st.w, y: -10, vy: 520 + st.rnd() * 180 });
  }
  for (let i = st.drops.length - 1; i >= 0; i--) {
    const q = st.drops[i]; q.y += q.vy * dt;
    if (q.y > st.field.y1 + 60) { st.drops.splice(i, 1); continue; }
    if (k && k.flameOn && !k.penDown === false && k.pts.length) {
      for (let j = k.pts.length - 1; j >= 0; j -= 2) {
        const p = k.pts[j]; if (p.s <= k.flameS + 30) break;
        if (Math.hypot(p.x - q.x, p.y - q.y) < 9) { if (p.s < k.cutS) { k.cutS = p.s; st.events.push({ type: 'cut', x: p.x, y: p.y }); } st.drops.splice(i, 1); break; }
      }
    }
  }
}

// 1/60 秒すすめる
export function step(st, dt = DT) {
  st.t += dt;
  moveIdle(st, dt);
  if (st.rule === 'ame') rain(st, dt);
  const k = st.stroke, m = st.m;
  if (st.crows.length || st.crowLeft > 0) moveCrows(st, dt);
  if (st.blades.length) cutByBlades(st, dt);
  if (st.runners.length) moveRunners(st, dt);
  if (st.phase === 'stroke' && k) {
    k.age += dt;
    if (k.age >= 2.6 && !k.done) intrude(st);
    if (st.falling && k.penDown) {
      st.fallT -= dt;
      if (st.fallT <= 0) {
        st.fallT = 0.4;
        const p = fieldPoint(st), r = st.rnd(), s = addShell(st, p.x, st.field.y0 - 30, r < 0.2 ? 'kin' : r < 0.32 ? 'ootama' : 'kiku');
        s.fall = 100 + st.rnd() * 70;
      }
    }
    extendLine(st);
    if (!k.flameOn && k.age >= m.grace) { k.flameOn = true; st.events.push({ type: 'ignite', x: k.pts[0].x, y: k.pts[0].y }); }
    if (k.flameOn && !k.fuseOut) {
      k.v = flameSpeed(st, k, dt);
      if (k.stopT > 0 && k.penDown) { k.stopT -= dt; k.v = 0; }
      k.flameS += k.v * dt;
      const gap = k.len - k.flameS;
      if (k.flameS >= k.cutS) { // 切れた所で火が止まる
        k.flameS = k.cutS; k.penDown = false; k.fuseOut = true; k.len = Math.min(k.len, k.cutS);
        st.events.push({ type: 'fuseOut', cut: true });
      } else if (k.penDown && gap <= 0) {
        if (k.len < m.minLen) { for (const s of st.shells) s.threaded = false; st.stroke = null; st.phase = 'aim'; st.events.push({ type: 'cancel' }); return; }
        if (k.saved < (m.catchSaves || 0)) { // 追いつかれても 1 度だけ踏みとどまる
          k.saved++; k.flameS = Math.max(0, k.len - 110); st.events.push({ type: 'saved' });
        } else {
          k.flameS = k.len; k.caught = true; k.penDown = false; st.caughtCount++;
          st.events.push({ type: 'caught', x: k.pts[k.pts.length - 1].x, y: k.pts[k.pts.length - 1].y });
        }
      }
      if (!k.penDown && !k.fuseOut && k.flameS >= k.len) {
        k.flameS = k.len; k.fuseOut = true;
        const c = fire(st, 'fuseEnd', { x: k.fx, y: k.fy });
        st.events.push({ type: 'fuseOut' });
      }
      const p = pointAt(k, Math.min(k.flameS, k.len));
      k.fx = p.x; k.fy = p.y;
      // 熱
      const hotNow = m.hotGap * (m.dyn ? 1 - m.hotShrink * k.heatLv : 1);
      if (k.penDown && gap < hotNow) k.heat += m.heatRate * (1 + (hotNow - gap) / hotNow) * dt;
      else if (!m.heatHold) k.heat = Math.max(0, k.heat - m.heatDecay * dt);
      const lv = m.heatLevels.filter((v) => k.heat >= v).length;
      if (lv !== k.heatLv) { const up = lv > k.heatLv; k.heatLv = lv; st.topHeat = Math.max(st.topHeat || 0, lv); st.events.push({ type: 'heat', lv, up }); if (up) fire(st, 'heatUp', { lv }); }
      // 線の火が玉にふれる
      const touch = (x, y) => {
        for (const s of st.shells) {
          if (s.state !== 'idle' || s.rise > 0) continue;
          if (Math.hypot(s.x - x, s.y - y) < s.r + m.threadR + 2) ignite(st, s, 0, 'line', 0);
        }
      };
      touch(p.x, p.y);
      if (st.rule === 'kagami' || m.mirror) touch(st.w - p.x, p.y);
      for (const q of st.knots) if (!q.done && k.flameS >= q.s) { q.done = true; knotBurst(st, q); }
    }
  }
  // 火花
  for (let i = st.sparks.length - 1; i >= 0; i--) {
    const q = st.sparks[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    for (const s of st.shells) if (s.state === 'idle' && s.rise <= 0 && Math.hypot(s.x - q.x, s.y - q.y) < s.r + 6) { ignite(st, s, q.gen, 'spark', 0); q.life = 0; break; }
    if (q.life <= 0) st.sparks.splice(i, 1);
  }
  // 火の移りを、順に爆ぜさせる
  for (let i = st.pending.length - 1; i >= 0; i--) {
    const p = st.pending[i];
    if (st.t >= p.at) { st.pending.splice(i, 1); if (st.stroke) burst(st, p.s, p.gen, p.how); }
  }
  // 一筆の終わり
  if (st.phase === 'stroke' && k && !k.done && !k.penDown && (k.fuseOut || k.caught) && !st.pending.length && !st.sparks.length && !st.runners.length) finishStroke(st);
  if (st.phase === 'settle' && st.t >= st.settleAt) {
    if (st.cleared && st.level.boss && !st.act2) { // 勝ったと思ったら、もう一幕
      st.act2 = true; st.keptStrokes = st.strokesLeft; st.strokesLeft = 1; st.maxStrokes = 1;
      st.stroke = null; st.knots.length = 0; st.lastBloom = true; st.m.flameX *= 1.2;
      refill(st);
      st.phase = 'aim';
      st.events.push({ type: 'act2' });
      return;
    }
    if (st.cleared || st.failed) {
      st.phase = 'over';
      if (st.cleared) fire(st, 'nightWin', {});
      st.events.push({ type: 'nightEnd', cleared: st.cleared, score: st.score, target: st.target });
      return;
    }
    st.stroke = null;
    st.knots.length = 0;
    refill(st);
    st.phase = 'aim';
    st.events.push({ type: 'aim', strokesLeft: st.strokesLeft });
    intrude(st);
  }
}

function knotBurst(st, q) {
  const k = st.stroke, R = 90;
  k.mult += 2; k.chips += 20;
  st.events.push({ type: 'knotBurst', x: q.x, y: q.y, R, mult: k.mult, chips: k.chips });
  for (const o of st.shells) if (o.state === 'idle' && o.rise <= 0 && Math.hypot(o.x - q.x, o.y - q.y) < R + o.r) ignite(st, o, 1, 'blast', 0.05);
}

// 狐火・終わり玉のような、お守りが起こす爆発
export function charmBlast(st, x, y, R, how = 'line') {
  st.events.push({ type: 'charmBlast', x, y, R });
  for (const o of st.shells) if (o.state === 'idle' && o.rise <= 0 && Math.hypot(o.x - x, o.y - y) < R + o.r) ignite(st, o, 1, how, Math.hypot(o.x - x, o.y - y) / st.m.shockV + 0.03);
}

function finishStroke(st) {
  const k = st.stroke;
  k.done = true;
  const c = fire(st, 'strokeEnd', { unused: Math.max(0, inkLimit(st) - k.len), inkLimit: inkLimit(st) });
  const remain = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0 && !s.fall).length;
  st.crows.forEach((c) => dropCrow(st, c)); st.crows.length = 0;
  let bloom = false;
  if (remain === 0 && k.pops > 0) {
    bloom = true; k.mult *= st.m.bloomX + Math.min(6, st.streak); st.streak++; st.blooms++; st.lastBloom = true;
    if (st.twist === 'katamono') st.goalMet = true;
    if (st.act2) st.encoreBloom = true;
    fire(st, 'bloom', {});
  }
  const gained = Math.floor(k.chips * k.mult);
  st.score += gained; st.lastGain = gained;
  st.strokesLeft--; st.strokesUsed++;
  st.events.push({ type: 'strokeEnd', gained, chips: k.chips, mult: k.mult, pops: k.pops, bloom, caught: k.caught, heatLv: k.heatLv, streak: st.streak });
  st.phase = 'settle';
  st.settleAt = st.t + (bloom ? 3.2 : 0.9);
  if (st.act2) st.coinsEarned += Math.ceil(k.pops / 3);
  if (st.score >= st.target || st.goalMet || st.act2) st.cleared = true;
  else if (st.strokesLeft <= 0) st.failed = true;
}

// 一筆が終わるたびに、町から新しい玉が上がってくる。満開のあとは盤がまるごと入れかわる
function refill(st) {
  const bloomed = st.lastBloom; st.lastBloom = false;
  const f = st.field;
  st.shells = st.shells.filter((s) => s.state === 'idle' && !s.fall);
  for (const s of st.shells) s.threaded = false;
  if (st.twist === 'ippatsu') {
    const s = addShell(st, (f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 'shaku', 0.2);
    st.events.push({ type: 'rise', shell: s });
    return;
  }
  if (st.twist === 'katamono' && !bloomed) return;
  if (bloomed) {
    const mix = {}; for (const [t, n] of Object.entries(st.level.mix || {})) if (t !== 'shaku') mix[t] = n;
    if (st.act2) mix.kin = (mix.kin || 0) + 5;
    const cnt = Math.min(26, Math.max(st.level.count || 16, st.act2 ? 22 : 0) + st.m.countAdd);
    for (const p of layout(st.seed + st.strokesUsed * 131 + (st.act2 ? 977 : 0), cnt, mix, f)) {
      if (st.shells.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > o.r + SHELLS[p.type].r + 10)) {
        const s = addShell(st, p.x, p.y, p.type, 0.1 + st.shells.length * 0.022);
        st.events.push({ type: 'rise', shell: s });
      }
    }
    for (const t of st.refillTypes) typeSome(st, t, 5);
    st.events.push({ type: 'okawari' });
  } else {
    const n = (st.level.refill ?? 5) + st.m.refillAdd;
    const types = [...Object.keys(st.level.mix || {}).filter((t) => t !== 'shaku'), ...st.refillTypes, ...st.refillTypes];
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 40; t++) {
        const type = st.rnd() < 0.45 && types.length ? types[Math.floor(st.rnd() * types.length)] : 'kiku';
        const x = f.x0 + st.rnd() * (f.x1 - f.x0), y = f.y0 + st.rnd() * (f.y1 - f.y0);
        if (st.shells.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + SHELLS[type].r + 18)) {
          const s = addShell(st, x, y, type, 0.1 + i * 0.09);
          st.events.push({ type: 'rise', shell: s });
          break;
        }
      }
    }
  }
  if (st.twist === 'meoto') pairUp(st);
  if (st.twist === 'juzu') { typeSome(st, 'juzu', Math.max(0, 6 - st.shells.filter((s) => s.type === 'juzu').length)); numberJuzu(st); }
}

export function starsFor(st) {
  const s = st.score, t = st.target;
  return s >= t * 2.5 ? 3 : s >= t * 1.6 ? 2 : s >= t ? 1 : 0;
}
