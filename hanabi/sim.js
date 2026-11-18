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
  kazu:     { r: 22, R: 80,  pts: 0, kind: 'willow' },                         // 異変「燃」: 燃え落ちた点。拾えば 1.5 倍でもどる
};

// ---- 異変: 夜の途中で、盤そのもの・見え方・決まりが変わる。乗り越える腕を試す（その間は点 ×1.5、捕まらずに一筆を終えると倍率 +2）
// 見た目と入力の変化（傾く・左右反転）は画面の側が受け持ち、ルールの側は点の上乗せと、盤そのものの変化を受け持つ
export const IHEN = {
  katamuku: { k: '傾', ja: '空が傾く', en: 'The sky tilts' },
  uragaeru: { k: '裏', ja: '盤が裏返る', en: 'The board flips' },
  hanten: { k: '反', ja: '左右が入れかわる', en: 'Left and right swap' },
  moeru: { k: '燃', ja: '点が燃え落ちる', en: 'Your score burns and falls' },
  furu: { k: '降', ja: '玉が降りだす', en: 'The shells start to fall' },
  utsuru: { k: '移', ja: '祭りが移る', en: 'The festival moves' }, // 背景が別の世界に変わり、その世界の妖怪の決まりがかかる
};
export const UTSURU_RULES = ['kaze', 'ame', 'kagami'];
// ---- 大妖怪: 各世界の最後の夜（版 6〜）。体力は目標 × hpX。魂（3 つ）が砕けるたびに筆 +1・居場所が変わり・技が増える
// fire = 火の玉の間（秒） / warn = 赤い輪が出てから落ちるまで / sweep = 薙ぎの間（0 は無し）
export const RAID = { hpX: [6.0, 3.4, 1.7], seg: 3, fire: [2.5, 2.0, 1.6], warn: [1.1, 1.0, 0.9], sweep: [0, 5.5, 4.4], sweepWarn: 1.25, ballR: 48, bandHW: 36, orbit: 52, spdHi: 3, spdLo: 1, spdT: 6 };
// 速攻: 指を置いてから早く通した玉ほど強く当たる（×3 → 6 秒で ×1）
export const raidSpd = (age) => Math.max(RAID.spdLo, Math.round((RAID.spdHi - ((RAID.spdHi - RAID.spdLo) * age) / RAID.spdT) * 10) / 10);
export const IHEN_PTS = 1.5, IHEN_CLEAR = 2, MOERU_TAKE = 0.4, MOERU_BACK = 1.5;

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
  // ---- 腕の層: 星屑・かすり・継ぎ火
  dustLife: 3.2,        // 星屑が消えるまで（秒）
  dustG: 70,            // 星屑の落ちる速さ（重さ）
  dustPick: 34,         // 筆先で拾える距離
  dustPickTop: 120,     // 熱 ×4 のときに拾える距離（吸い寄せ）
  dustFade: 0.6,        // 鮮度: 消える間ぎわは値が 1−0.6 = 4 割
  pv0: 4,               // 星の値のはじめ
  grazeGap: 55,         // 火とこれより近いと「かすり」
  grazeEvery: 0.1,      // かすりを数える間隔（秒）
  grazePv: 1,           // かすり 1 回で星の値が増える分
  caughtPv: 0.8,        // 追いつかれると星の値がこの割合に
  tsugiWin: 1.6,        // 継ぎ火の輪が残る時間（秒）
  tsugiR: 64,           // 継ぎ火の輪の大きさ
  tsugiKeep: 0.5,       // 継ぎ火で持ちこむ倍率の割合
  tsugiGrace: 0.15,     // 継ぎ火の一筆は、火がすぐ移る
  spellX: 0.2,          // 技のボーナス（目標に対する割合）
  spellNeed: 0.6,       // 技を取るのに要る、ひらいた玉の割合
};

export function rng32(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// 盤の大きさ。横長と縦長で別の広さを使い、玉の位置は 0〜1 の割合で持つ（どちらの向きでも同じ並びになる）
export function fieldFor(w, h, rs = 1, gw = 1, gh = 1) {
  if (gw > 1 || gh > 1) { const f = fieldFor(w, h, rs); return { ...f, x1: gw > 1 ? w * gw - (w - f.x1) : f.x1, y0: gh > 1 ? f.y0 - (gh - 1) * h : f.y0 }; } // 大仕掛け: 横に長い・上に高い盤
  if (w >= h) return { w, h, x0: 70, x1: w - 70, y0: 140, y1: h * 0.62 };
  // 縦は上の「点×倍率」と「熱い」の字が玉を隠さない所から。玉を大きくした縦（rs > 1）は、そのぶん上と横をあける
  return rs > 1 ? { w, h, x0: 70, x1: w - 70, y0: 440, y1: h * 0.74 } : { w, h, x0: 60, x1: w - 60, y0: 390, y1: h * 0.72 };
}

// 群れと、離れた玉を混ぜて置く。読みどころは「群れをつなぐ順番」
// deck: 玉袋の中身 [{ t, m, pi }]（t=種類 m=刻印 pi=袋の何番目）。あれば菊で埋めずに袋を順にめぐる
export function layout(seed, count, mix, field, deck = null) {
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
  for (const [k, n] of Object.entries(mix)) for (let i = 0; i < n; i++) types.push({ t: k });
  let used = 0;
  if (deck && deck.length) while (types.length < count) types.push(deck[used++ % deck.length]);
  while (types.length < count) types.push({ t: 'kiku' });
  for (let i = types.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
  const out = [];
  const place = (u, v, type) => {
    const x = field.x0 + u * (field.x1 - field.x0), y = field.y0 + v * (field.y1 - field.y0);
    const r = SHELLS[type].r;
    return out.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + r + 16) ? { x, y } : null;
  };
  for (let i = 0; i < types.length; i++) {
    const it = types[i], type = it.t;
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
    if (p) out.push({ ...p, type, r: SHELLS[type].r, mod: it.m || null, pi: it.pi ?? -1 });
  }
  out.deckUsed = used;
  return out;
}

export function newShell(id, x, y, type, rise = 0) {
  const d = SHELLS[type];
  return { id, type, x, y, vx: 0, vy: 0, r: d.r, R: d.R, pts: d.pts, state: 'idle', threaded: false, hits: 0, rise, phase: (id * 0.37) % 6.28, litBy: null, how: null, mod: null, pi: -1 };
}

// level: { seed, count, mix, strokes, refill, target, rule, id }
// loadout: { charms: [def], recipes: { type: lv }, coins }
// 縦画面（スマホ）は玉を 1.3 倍にする。見た目と当たりの両方。並べる間隔は元の大きさで取るので重ならない
export const PORTRAIT_SHELL = 1.3;
export function newNight(level, w, h, loadout = {}) {
  const rs = loadout.rs ?? (w < h ? PORTRAIT_SHELL : 1); // ランキングの旧い記録（ps なし）は 1 で流しなおす
  let field = fieldFor(w, h, rs, level.grand?.gw || 1, level.grand?.gh || 1);
  const rz = level.raid ? raidZone(field, w, h, 1) : null; // 大妖怪の夜: 大妖怪は盤の外（横は右・縦は上）。玉は残りの広い所へ
  if (rz) field = rz.field;
  // dn: 盤の混み方をそろえる（2026-11-16〜）。縦の 16:9 は盤が狭く、1 つの玉から爆風だけで盤の 8〜9 割に火が回っていた
  const dn = loadout.dn ?? 1, kd = dn ? Math.min(1, ((field.x1 - field.x0) * (field.y1 - field.y0)) / 349000) : 1;
  const charms = loadout.charms || [];
  const m = { ...TUNE, strokesAdd: 0, refillAdd: 0, countAdd: 0, flameX: 1, startChips: 0, startMult: 0, addMix: {} };
  for (const c of charms) if (c.mod) c.mod(m, loadout);
  if (level.flame) m.flameX *= level.flame;
  if (level.rule === 'kasha' && !level.raid) m.flameX *= 1.55;
  if (level.rule === 'ishun' && !level.raid) m.ink *= 0.55;
  if ((level.seals || []).includes('sumi')) m.ink *= 0.75; // 封じ: 墨削り
  if (level.grand) m.ink *= (level.grand.gw || 1) * (level.grand.gh || 1); // 大仕掛け: 盤が広いぶん、墨も長く
  const mix = { ...(level.mix || {}) };
  for (const [k, n] of Object.entries(m.addMix)) mix[k] = (mix[k] || 0) + n;
  if (m.onlyOneStroke) m.strokesAdd = -99;
  const strokes = Math.max(1, (level.strokes ?? 3) + m.strokesAdd);
  const st = {
    level, field, w, h, t: 0, seed: level.seed, m, loadout, charms, dn, kd,
    recipes: loadout.recipes || {},
    shells: [], nextId: 1, sparks: [], pending: [], drops: [], knots: [], rv: level.rv || 1,
    maxStrokes: strokes, strokesLeft: strokes, strokesUsed: 0,
    score: 0, target: level.target, cleared: false, failed: false,
    stroke: null, phase: 'aim', events: [], rnd: rng32(level.seed + 5),
    bestChain: 0, blooms: 0, totalPops: 0, coinsEarned: 0, carriedInk: 0, closeCalls: 0, caughtCount: 0, encore: 0,
    ink: m.ink, rule: (!level.raid && level.rule) || null, dropT: 0,
    twist: level.twist || null, runners: [], crows: [], blades: [], zones: [], shape: null,
    streak: loadout.streak || 0, lastBloom: false, act2: false, goalMet: false, intruded: false, refillTypes: [],
    crowMax: 0, crowLeft: 0, crowT: 0, falling: false, fallT: 0,
    // 腕の層
    seals: level.seals || [], grow: { ...(loadout.grow || {}) }, // 大一番の封じ・育つお守りの育ち
    ihen: null, ihenLog: [], ihenDone: {}, // 異変（いま起きているもの）
    dust: [], drnd: rng32(level.seed + 11), pv: loadout.pv ?? m.pv0, graze: 0, dustGot: 0, dustPts: 0, mikiri: 0, tsugi: null, tsugiBest: 0, tsugiCount: 0, waited: 0, spellLog: [], spellDone: {}, rainEvery: 0.2, broken: [], deckI: 0,
  };
  const count = (level.count || 16) + m.countAdd;
  const L = layout(level.seed, count, mix, field, level.deck);
  st.rs = rs;
  for (const s of L) { const sh = newShell(st.nextId++, s.x, s.y, s.type); sh.rs = rs; sh.r *= rs; sh.mod = s.mod; sh.pi = s.pi; if (level.deck) initShell(st, sh); st.shells.push(sh); }
  // 大仕掛け「滝」: いちばん右の玉が滝の玉。一筆で 6 つ以上ひらいたあとに火が届くと、上の端を火の滝が右から左へ流れる
  if (level.grand?.kind === 'taki') {
    const t = st.shells.filter((s) => !['shaku', 'oni', 'koori', 'shime'].includes(s.type)).sort((a, b) => b.x - a.x)[0];
    if (t) { t.mod = 'taki'; st.taki = { id: t.id, x0: field.x0, x1: field.x1, y: field.y0 - 24, front: null, done: false, need: 6, ev: 0 }; }
  }
  // 文字花火: 盤に散らばる 4 つの字玉（壱〜肆）を番号の順に線で通すと、夜空に字が浮かび倍率 ×2。字玉は爆風では燃えない
  if (level.grand?.kind === 'moji') {
    const pool = st.shells.filter((s) => !['shaku', 'oni', 'koori', 'shime'].includes(s.type)).sort((a, b) => a.x - b.x);
    const pick = [0.1, 0.37, 0.63, 0.9].map((u) => pool[Math.min(pool.length - 1, Math.round(u * (pool.length - 1)))]).filter((v, i, a) => v && a.indexOf(v) === i);
    // 並びは左から右。隣り合う 2 つだけ入れ替える（一度だけ引き返す道筋）
    const r = rng32(level.seed + 911), order = pick.slice(); { const j = Math.floor(r() * Math.max(1, order.length - 1)); [order[j], order[j + 1]] = [order[j + 1], order[j]]; }
    order.forEach((s, i) => { s.mod = 'moji'; s.seq = i + 1; });
    const K = ['祭', '華', '夢', '寿', '翔'];
    st.moji = { need: order.length, next: 1, done: false, kanji: K[Math.floor(r() * K.length)], missAt: -1 };
  }
  // 天の川: 空の高い所に北斗七星の形で 7 つの星玉。順にたどると星座の線、7 つで満天
  if (level.grand?.kind === 'seiza') {
    const D = [[0, 0], [0.05, 0.32], [0.42, 0.4], [0.5, 0.12], [0.72, 0.05], [0.92, 0], [1.15, 0.12]];
    const fw = field.x1 - field.x0, sw = fw * 0.7, x0 = field.x0 + fw * 0.15, yTop = field.y0 + 70, shh = Math.min(sw * 0.4, (field.y1 - field.y0) * 0.22);
    const pool = st.shells.filter((s) => !['shaku', 'oni', 'koori', 'shime'].includes(s.type)).slice(0, 7);
    pool.forEach((s, i) => { s.x = x0 + (D[i][0] / 1.15) * sw; s.y = yTop + (D[i][1] / 0.4) * shh; s.mod = 'seiza'; s.seq = i + 1; });
    st.seiza = { need: pool.length, next: 1, done: false, missAt: -1, last: null };
  }
  // 連発（スターマイン）: 盤の中ほどの発射台。一筆で 6 つ以上ひらいてから火が届くと、盤のあちこちへ 16 発が次々に打ち込まれる
  if (level.grand?.kind === 'renpatsu') {
    const mid = (field.x0 + field.x1) / 2, pool = st.shells.filter((s) => !['shaku', 'oni', 'koori', 'shime'].includes(s.type)).sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid));
    if (pool[0]) { pool[0].mod = 'renpatsu'; st.ren = { id: pool[0].id, need: 6, left: 0, t: 0, active: false, done: false }; }
  }
  st.deckI = L.deckUsed || 0;
  if (level.raid) {
    const max = level.raid.hp || Math.max(100, Math.round((level.target * RAID.hpX[Math.min(2, (level.world || 1) - 1)]) / 10) * 10);
    st.raid = { x: rz.x, y: rz.y, r: rz.r, face: rz.face, side: 1, base: rz.base, max, hp: max, ph: 0, atkT: 1.4, swT: 2.6, warns: [], dead: false, moved: false, broke: 0, hitsAll: 0, burns: 0, crits: 0, spdW: 0, spdN: 0 };
    raidClear(st); raidKaku(st);
  }
  if (level.rule === 'kappa') st.shells.forEach((s, i) => { if (i % 2 === 0 && s.type === 'kiku') retype(s, 'shime'); });
  if (st.twist && TWIST_SETUP[st.twist]) TWIST_SETUP[st.twist](st);
  st.startCount = st.shells.length;
  fire(st, 'nightStart', {});
  return st;
}

// 大妖怪の居場所。絵は体の半径 r の 2.5 倍の大きさで描くので、その外に玉の盤を取る
function raidZone(base, w, h, side) {
  const f = base;
  if (w >= h) {
    const fh = f.y1 - f.y0, r = Math.round(Math.min(150, fh * 0.46)), y = Math.round(f.y0 + fh * 0.5);
    const x = side > 0 ? w - r * 1.25 - 24 : r * 1.25 + 24, edge = side > 0 ? x - r * 1.3 - 20 : x + r * 1.3 + 20;
    return { base, x, y, r, face: side > 0 ? Math.PI : 0, field: { ...f, x0: side > 0 ? f.x0 : Math.max(f.x0, edge), x1: side > 0 ? Math.min(f.x1, edge) : f.x1 } };
  }
  const top = 240, y1 = Math.max(f.y1, h * 0.77), r = Math.round(Math.min(110, (f.x1 - f.x0) * 0.19, ((y1 - top) * 0.42) / 2.6)), y = Math.round(top + r * 1.1);
  return { base, x: w / 2, y, r, face: Math.PI / 2, field: { ...f, y0: Math.round(y + r * 1.45 + 20), y1 } };
}
const kakuAt = (Rd, s) => { const a = Rd.face + Math.sin(s.orb) * 1.15, d = Rd.r + RAID.orbit; return [Rd.x + Math.cos(a) * d, Rd.y + Math.sin(a) * d]; };
function raidClear(st) {
  const Rd = st.raid, f = st.field;
  for (const s of st.shells) {
    if (s.state !== 'idle' || s.mod === 'kaku') continue;
    const dx = s.x - Rd.x, dy = s.y - Rd.y, d = Math.hypot(dx, dy), min = Rd.r + s.r + 14;
    if (d >= min) continue;
    const a = d > 1 ? Math.atan2(dy, dx) : (s.id * 2.399) % TAU;
    s.x = Math.max(f.x0, Math.min(f.x1, Rd.x + Math.cos(a) * min)); s.y = Math.max(f.y0, Math.min(f.y1, Rd.y + Math.sin(a) * min));
  }
}
function raidKaku(st) {
  const Rd = st.raid; if (!Rd || Rd.dead || st.shells.some((s) => s.mod === 'kaku' && s.state === 'idle')) return;
  const o = { orb: st.rnd() * TAU }, [x, y] = kakuAt(Rd, o), s = addShell(st, x, y, 'kin', 0.2);
  s.mod = 'kaku'; s.orb = o.orb; st.events.push({ type: 'rise', shell: s });
}
// 一筆の間の妖怪の技: 赤い輪（火の玉）と赤い帯（薙ぎ）。落ちた時に筆先がその中にあれば焼かれる（捕まったのと同じ）。火の玉は落ちた所の玉に火をつける
function raidBurn(st, x, y, kind) {
  const k = st.stroke; if (!k || !k.penDown) return;
  k.flameS = k.len; k.caught = true; k.penDown = false; st.caughtCount++; st.raid.burns++;
  st.events.push({ type: 'raidBurn', x, y, kind }); fire(st, 'caught', {});
}
function raidStep(st, dt) {
  const Rd = st.raid, k = st.stroke, f = st.field;
  for (const s of st.shells) if (s.mod === 'kaku' && s.state === 'idle' && !s.threaded && s.rise <= 0) { s.orb += (0.8 + Rd.ph * 0.35) * dt; [s.x, s.y] = kakuAt(Rd, s); } // 急所は大妖怪の、盤に向いた側をふり子のように行き来する
  const tip = k && k.pts.length ? k.pts[k.pts.length - 1] : null;
  for (let i = Rd.warns.length - 1; i >= 0; i--) {
    const w = Rd.warns[i]; w.t -= dt; if (w.t > 0) continue;
    Rd.warns.splice(i, 1);
    st.events.push({ type: 'raidImpact', kind: w.kind, x: w.x, y: w.y, axis: w.axis });
    if (w.kind === 'ball') {
      if (k && st.phase === 'stroke') for (const o of st.shells) if (o.state === 'idle' && o.rise <= 0 && o.mod !== 'kaku' && Math.hypot(o.x - w.x, o.y - w.y) < w.r + o.r) ignite(st, o, 1, 'blast', 0.05);
      if (tip && Math.hypot(tip.x - w.x, tip.y - w.y) < w.r) raidBurn(st, tip.x, tip.y, 'ball');
    } else if (tip && (w.axis === 'h' ? Math.abs(tip.y - w.y) : Math.abs(tip.x - w.x)) < RAID.bandHW) raidBurn(st, tip.x, tip.y, 'band');
  }
  if (Rd.dead || st.phase !== 'stroke' || !k || !k.penDown || !k.flameOn || !tip) return;
  Rd.atkT -= dt;
  if (Rd.atkT <= 0) {
    Rd.atkT = RAID.fire[Rd.ph];
    const n = Rd.ph >= 2 ? 2 : 1, prev = k.pts[Math.max(0, k.pts.length - 6)], dx = tip.x - prev.x, dy = tip.y - prev.y, dl = Math.hypot(dx, dy) || 1;
    for (let j = 0; j < n; j++) { // 2 つ目は、筆の向かう先へ
      const lead = j === 0 ? 0 : 110, x = Math.max(f.x0, Math.min(f.x1, tip.x + (dx / dl) * lead)), y = Math.max(f.y0, Math.min(f.y1, tip.y + (dy / dl) * lead));
      const w = { kind: 'ball', x, y, r: RAID.ballR * (st.rs || 1) ** 0.5, t: RAID.warn[Rd.ph] + j * 0.25, T: RAID.warn[Rd.ph] + j * 0.25 }; Rd.warns.push(w);
      st.events.push({ type: 'raidWarn', ...w, fx: Rd.x, fy: Rd.y });
    }
  }
  if (RAID.sweep[Rd.ph] > 0) {
    Rd.swT -= dt;
    if (Rd.swT <= 0) {
      Rd.swT = RAID.sweep[Rd.ph]; const axis = st.rnd() < 0.5 ? 'h' : 'v';
      const w = { kind: 'band', axis, x: tip.x, y: tip.y, t: RAID.sweepWarn, T: RAID.sweepWarn }; Rd.warns.push(w);
      st.events.push({ type: 'raidWarn', ...w, fx: Rd.x, fy: Rd.y });
    }
  }
}
// 魂が砕けたあと: 妖怪は別の場所へ移る（盤はまるごと入れかわる）
// 横の画面: 左右が入れかわる（盤ごと反対側へ。残っていた玉は散る）。縦の画面: 上の段で横へ動く
function raidMove(st) {
  const Rd = st.raid, px = Rd.x, py = Rd.y;
  if (st.w >= st.h) {
    Rd.side = -Rd.side; const z = raidZone(Rd.base, st.w, st.h, Rd.side); Rd.x = z.x; Rd.y = z.y; Rd.face = z.face; st.field = z.field;
    const gone = st.shells.filter((s) => s.state === 'idle' && s.mod !== 'kaku').map((s) => [s.x, s.y]);
    st.shells = st.shells.filter((s) => s.state !== 'idle' || s.mod === 'kaku');
    st.events.push({ type: 'raidScatter', pts: gone });
  } else { const xs = [0.3, 0.5, 0.7].map((u) => st.w * u).filter((x) => Math.abs(x - Rd.x) > 40); Rd.x = xs[Math.floor(st.rnd() * xs.length)]; }
  st.events.push({ type: 'raidMove', x0: px, y0: py, x: Rd.x, y: Rd.y }); Rd.moved = false; Rd.warns.length = 0;
}

// 夜のはじめに玉が町から上がってくる時間（画面と、ランキングの動かし直しで同じにする）
export function stageRise(st) { const n = st.shells.length, step = Math.min(0.035, 1.4 / Math.max(1, n)); st.shells.forEach((s, k) => { s.rise = 0.15 + k * step; }); }

function retype(s, type) { const d = SHELLS[type]; s.type = type; s.r = d.r * (s.rs || 1); s.R = d.R; s.pts = d.pts; }

const TAU = Math.PI * 2;
function initShell(st, s) {
  if (s.type === 'roket') s.dir = st.rnd() * TAU;
  if (s.type === 'kingyo') s.swim = { a: st.rnd() * TAU, v: 70 + st.rnd() * 50, t: 0 };
  return s;
}
function addShell(st, x, y, type, rise = 0) { const s = initShell(st, newShell(st.nextId++, x, y, type, rise)); s.rs = st.rs || 1; s.r *= s.rs; st.shells.push(s); return s; }
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
  const k = st.stroke, sleep = name === 'nightWin' || name === 'nightStart' ? null : sleepingCharm(st); // 眠るのは一筆の中だけ
  for (const ch of st.charms) {
    const f = ch.on && ch.on[name]; if (!f || ch === sleep) continue;
    const m0 = k ? k.mult : 0, p0 = c.pts, c0 = st.coinsEarned, s0 = st.strokesLeft;
    f(c, ch);
    const dM = k ? k.mult - m0 : 0, dP = c.pts !== undefined ? c.pts - p0 : 0, dC = st.coinsEarned - c0;
    // お守りが効いた瞬間を画面に見せる（袋がはねて、数字が飛ぶ）
    if (dM || dP || dC || st.strokesLeft !== s0) st.events.push({ type: 'charmFire', id: ch.id, dMult: dM, dPts: dP, dCoin: dC, x: c.s?.x, y: c.s?.y });
  }
  return c;
}

// 封じ「札眠り」: 一筆ごとに、お守りが左から順に 1 つ眠る（開始の型の下ごしらえは眠らない）
export function sleepingCharm(st) {
  if (!st.seals?.includes('nemuri')) return null;
  const real = st.charms.filter((c) => c.id[0] !== '_');
  return real.length ? real[st.strokesUsed % real.length] : null;
}
const newStroke = (st) => ({
  pts: [], len: 0, flameS: 0, flameOn: false, age: 0, penDown: true, caught: false, inkOut: false, fuseOut: false,
  heat: 0, heatLv: 0, chips: st.m.startChips, mult: 1 + st.m.startMult, pops: 0, lantern: 0, done: false, idx: 0, mi: 0, fx: 0, fy: 0, fv: st.m.flameV0 * st.m.flameX, threaded: 0, close: 0,
  gens: 0, types: {}, cutS: Infinity, saved: 0, turn: 0, fm: null, stopT: 0, juzu: 0,
  v: st.m.flameV0 * st.m.flameX, mo: 1, kick: 0, ti: 0, gustIn: st.level.gusts ? st.m.gustGap0 + st.rnd() * st.m.gustGapR : Infinity, gustWarnT: 0, gustT: 0, lullT: 0,
  graze: 0, grazeT: 0, dust: 0, dustPts: 0, vacuum: false, tsugiN: 0, idle0: 0, spell: null, stillT: 0, seenLen: 0,
});

// 継ぎ火の輪の中に置いたか（輪が残っている間だけ）
export const tsugiOpen = (st) => !!st.tsugi && st.t <= st.tsugi.until && !st.cleared && !st.failed && st.strokesLeft > 0;
export function tsugiHit(st, x, y) { return tsugiOpen(st) && Math.hypot(x - st.tsugi.x, y - st.tsugi.y) <= st.m.tsugiR * (st.m.tsugiRX || 1); }

// ---- 縁起物: 狙いを決めている間（aim）に使う、使い切りの札
export const ENGI = {
  kinka: { sj: '金の玉 3', se: '3 gold', ja: '金化け札', en: 'Gilding Charm', dj: '盤のまん中に近い玉 3 つが、金の玉に化ける', de: 'The 3 shells nearest the center turn to gold', cost: 4 },
  atsu: { sj: '熱 ×3', se: 'HOT ×3', ja: '熱燗札', en: 'Hot Start', dj: '次の一筆は 熱 ×3 から始まる', de: 'Your next stroke starts at HOT ×3', cost: 4 },
  osoi: { sj: '火が遅い', se: 'Late fire', ja: '寝坊札', en: 'Late Spark', dj: '次の一筆は、火が 2 秒おそくつく', de: 'Next stroke: the flame lights 2s late', cost: 3 },
  shaku: { sj: '尺玉', se: 'Grand', ja: '尺玉札', en: 'Grand Shell Charm', dj: '盤のまん中に尺玉がひとつ上がる', de: 'A Grand Shell rises in the center', cost: 5 },
  yose: { sj: '玉を寄せる', se: 'Gather', ja: '寄せ札', en: 'Gathering Charm', dj: '盤の玉が、まん中へぐっと寄る', de: 'All shells drift toward the center', cost: 3 },
  hoshi: { sj: '星屑 24', se: '24 dust', ja: '星降り札', en: 'Starfall', dj: '盤いっぱいに星屑が 24 粒降る', de: '24 star dust fall across the sky', cost: 3 },
  fude: { sj: '筆 +1', se: '+1 stroke', ja: '筆札', en: 'Extra Brush', dj: 'この夜の筆が 1 本増える', de: '+1 stroke this night', cost: 6 },
};
export function useEngi(st, id) {
  if (st.phase !== 'aim' || !ENGI[id]) return false;
  const f = st.field, cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
  const idle = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0 && !s.fall && s.type !== 'shaku');
  st.next = st.next || {};
  if (id === 'kinka') for (const s of idle.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, 3)) { retype(s, 'kin'); s.swim = null; }
  if (id === 'atsu') st.next.heat = 1.7;
  if (id === 'osoi') st.next.grace = 2.4;
  if (id === 'shaku') { const s = addShell(st, cx, cy, 'shaku', 0.3); for (const o of st.shells) if (o !== s && o.state === 'idle' && Math.hypot(o.x - cx, o.y - cy) < 70) { o.x += (o.x - cx) * 0.8 + 40; o.y += (o.y - cy) * 0.5; } st.events.push({ type: 'rise', shell: s }); }
  if (id === 'yose') for (const s of idle) { s.x += (cx - s.x) * 0.35; s.y += (cy - s.y) * 0.35; }
  if (id === 'hoshi') for (let i = 0; i < 24; i++) st.dust.push({ x: f.x0 + st.drnd() * (f.x1 - f.x0), y: f.y0 - 20 + st.drnd() * (f.y1 - f.y0) * 0.5, vx: 0, vy: 20, t: 0, gold: i % 6 === 0 });
  if (id === 'fude') { st.strokesLeft++; st.maxStrokes++; }
  st.engiUsed = (st.engiUsed || 0) + 1;
  st.events.push({ type: 'engi', id });
  return true;
}

export function penDown(st, x, y) {
  // 一筆が終わった直後の間（settle）でも、継ぎ火の輪の中なら、すぐ次の一筆に入れる
  const tsugi = tsugiHit(st, x, y) ? st.tsugi : null;
  if (st.phase === 'settle' && tsugi) settleNow(st);
  if (st.phase !== 'aim') return false;
  if (st.level.boss && !st.raid) prepSpell(st); // 技の邪魔（突風・火の速さ）は一筆を作る前に入れる。でないとその一筆に効かない
  st.stroke = newStroke(st);
  const k = st.stroke;
  k.pts.push({ x, y, s: 0 });
  k.fx = x; k.fy = y;
  st.phase = 'stroke';
  st.crowLeft = st.crowMax; st.crowT = 0.7; st.fallT = 0;
  k.idle0 = st.shells.filter((s) => s.state === 'idle' && !s.fall).length;
  if (st.level.boss && !st.raid) startSpell(st, k);
  if (tsugi) { // 前の一筆の倍率の半分と熱を持ちこむ。続けるほど +1
    k.tsugiN = tsugi.n; k.mult += Math.round(tsugi.mult * (st.m.tsugiKeepX || st.m.tsugiKeep)) + tsugi.n - 1; k.heat = Math.max(k.heat, tsugi.heat); k.grace = st.m.tsugiGrace;
    st.tsugiCount++; st.tsugiBest = Math.max(st.tsugiBest, tsugi.n);
    st.events.push({ type: 'tsugi', n: tsugi.n, mult: k.mult, x, y });
  } else if (st.tsugi) st.events.push({ type: 'tsugiLost', n: st.tsugi.n - 1 });
  st.tsugi = null;
  if (st.next) { if (st.next.heat) k.heat = Math.max(k.heat, st.next.heat); if (st.next.grace) k.grace = st.next.grace; st.next = null; } // 縁起物の効き目
  const sl = sleepingCharm(st); if (sl) st.events.push({ type: 'sleep', id: sl.id });
  (st.level.ihen || []).forEach((q, i) => { if (!st.ihenDone[i] && (q.at === 'act2' ? st.act2 : !st.act2 && st.strokesUsed === q.at)) { st.ihenDone[i] = 1; startIhen(st, q.id); } }); // 予定は書きかえない（試し打ちで同じ夜を流しなおすため）
  fire(st, 'strokeStart', {});
  st.events.push({ type: 'penDown', x, y, tsugi: !!tsugi });
  threadAt(st, x, y);
  return true;
}

function startIhen(st, id) {
  const f = st.field;
  st.ihen = { id, t0: st.t }; st.ihenLog.push(id);
  if (id === 'uragaeru') { // 盤が上下に裏返る（0.6 秒かけて動く）
    for (const s of st.shells) if (s.state === 'idle' && !s.threaded) { s.flip = { y0: s.y, y1: f.y0 + f.y1 - s.y, t: 0 }; }
  }
  if (id === 'utsuru') { const opts = UTSURU_RULES.filter((r) => r !== st.rule); st.rule = opts[Math.floor(rng32(st.seed + 9311)() * opts.length)]; }
  if (id === 'furu') for (const s of st.shells) if (s.state === 'idle' && !s.threaded && s.type !== 'shaku') s.fall = 38 + (s.id % 5) * 9;
  if (id === 'moeru') { // 持っている点の 4 割が数字の玉になって、上から落ちてくる
    const take = Math.floor(st.score * MOERU_TAKE), n = Math.max(1, Math.min(7, Math.ceil(take / 400)));
    if (take > 0) {
      st.score -= take; st.burnt = (st.burnt || 0) + take;
      for (let i = 0; i < n; i++) {
        const x = f.x0 + ((i + 0.5) / n) * (f.x1 - f.x0), s = addShell(st, x, f.y0 - 10 - (i % 2) * 40, 'kazu');
        s.val = Math.floor(take / n) + (i === 0 ? take % n : 0); s.fall = 32 + (i % 3) * 8;
      }
    }
    st.events.push({ type: 'burnScore', take, n });
  }
  st.events.push({ type: 'ihen', id, rule: st.rule });
}

// ---- 技: 大一番の妖怪は一筆ごとに名前のある技を出す。捕まらずに盤の 6 割をひらけば取れる
// add: blades=風車の数 / gust=突風の間隔の倍率 / crows=烏の数 / rain=雪の間隔 / bake=化け玉 / flame=火の速さ
export const SPELLS = {
  kasha: [['辻風', 'Crossroad Gale', {}], ['三つ巴', 'Triple Swirl', { blades: 1 }], ['つむじ返し', 'Whirlwind Return', { blades: 2 }], ['千本鎌', 'Thousand Sickles', { blades: 2, flame: 1.1 }]],
  kaze: [['そよぎ団扇', 'Breeze Fan', {}], ['つむじ団扇', 'Whirl Fan', { gust: 0.5 }], ['天狗礫', 'Tengu Hail', { gust: 0.5, crows: 2 }], ['天狗倒し', 'Tengu Topple', { gust: 0.4, crows: 3 }]],
  ame: [['細雪', 'Light Snow', {}], ['六花', 'Six Petals', { rain: 0.13 }], ['しまき', 'Blizzard', { rain: 0.11, blades: 1 }], ['雪見灯籠', 'Snow Lantern', { rain: 0.09 }]],
  yamiyo: [['狐火', 'Foxfire', {}], ['狐の窓', 'Fox Window', { bake: 4 }], ['化け提灯', 'Haunted Lantern', { bake: 4, crows: 2 }], ['嫁入り行列', 'Fox Wedding', { crows: 3, bake: 3 }]],
  kagami: [['腹鼓', 'Belly Drum', {}], ['化かし合い', 'Battle of Wits', { bake: 5 }], ['八百八狸', '808 Tanuki', { bake: 4, gust: 0.6 }], ['月夜の腹鼓', 'Moonlit Drum', { bake: 5, blades: 1 }]],
  ishun: [['こだま', 'Echo', {}], ['呼ばわり', 'Calling Out', { crows: 2 }], ['山返し', 'Mountain Return', { gust: 0.5, crows: 2 }], ['声なき声', 'Voiceless Voice', { blades: 2 }]],
};
export const spellIndex = (st) => (st.act2 ? 3 : Math.min(2, st.strokesUsed));
function prepSpell(st) {
  const list = SPELLS[st.rule]; if (!list) return;
  const i = spellIndex(st), add = list[i][2];
  if (!st.spellDone[i]) { // 邪魔は一度だけ足す（短すぎてやり直した線で重ねない）
    st.spellDone[i] = true;
    const want = add.blades || 0; if (want > st.blades.length) makeBlades(st, want - st.blades.length);
    if (add.gust) { st.m.gustGap0 *= add.gust; st.m.gustGapR *= add.gust; }
    if (add.crows) st.crowMax = Math.max(st.crowMax, add.crows);
    if (add.rain) st.rainEvery = add.rain;
    if (add.bake) typeSome(st, 'bake', add.bake);
    if (add.flame) st.m.flameX *= add.flame;
  }
}
function startSpell(st, k) {
  const list = SPELLS[st.rule]; if (!list) return;
  const i = spellIndex(st), [ja, en] = list[i];
  st.crowLeft = st.crowMax;
  k.spell = { id: `${st.rule}${i}`, i, ja, en, base: Math.round((st.target * st.m.spellX * (i === 3 ? 1.7 : 1)) / 10) * 10, oku: i === 3 };
  st.events.push({ type: 'spell', ...k.spell });
}
// いま取れば入るボーナス（時間で減って、3 割で止まる）
export function spellBonus(k) { return k?.spell ? Math.round((k.spell.base * Math.max(0.3, 1 - k.age / 12)) / 10) * 10 : 0; }

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
  let wx = k.want.x, wy = k.want.y;
  if (st.raid && !st.raid.dead) { const Rd = st.raid, ex = wx - Rd.x, ey = wy - Rd.y, ed = Math.hypot(ex, ey), rr = Rd.r * 0.92; if (ed < rr) { const a = ed > 0.5 ? Math.atan2(ey, ex) : 0; wx = Rd.x + Math.cos(a) * rr; wy = Rd.y + Math.sin(a) * rr; } } // 指が大妖怪の体の中なら、体の縁まで
  let dx = wx - last.x, dy = wy - last.y, d = Math.hypot(dx, dy);
  if (d < 5) { k.held = false; return; }
  let room = inkLimit(st) - k.len;
  if (st.m.dyn && !(st.m.okibi && !k.flameOn)) {
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
    let px = last.x + (dx * i) / n, py = last.y + (dy * i) / n;
    if (st.raid && !st.raid.dead) { const Rd = st.raid, ex = px - Rd.x, ey = py - Rd.y, ed = Math.hypot(ex, ey), rr = Rd.r * 0.92; if (ed < rr) { const a = ed > 0.5 ? Math.atan2(ey, ex) : 0; px = Rd.x + Math.cos(a) * rr; py = Rd.y + Math.sin(a) * rr; } }
    k.len += d / n;
    k.pts.push({ x: px, y: py, s: k.len });
    threadAt(st, px, py);
    if (st.m.knots) checkKnot(st, px, py);
    if (st.rv >= 2) checkLoop(st, px, py);
  }
  if (inkLimit(st) - k.len < 1) { k.inkOut = true; penUp(st, true); st.events.push({ type: 'inkOut' }); }
}

export function penUp(st, auto = false) { // auto: 墨切れで勝手に離れた（見切りは付かない）
  const k = st.stroke;
  if (!k || !k.penDown) return;
  k.penDown = false;
  if (k.len < st.m.minLen) { // 押し間違いは数えない
    for (const s of st.shells) { s.threaded = false; s.spd = 0; }
    st.stroke = null; st.phase = 'aim';
    st.events.push({ type: 'cancel' });
    return;
  }
  st.events.push({ type: 'penUp', x: k.pts[k.pts.length - 1].x, y: k.pts[k.pts.length - 1].y });
  if (st.m.okibi) k.heat = Math.max(k.heat, st.m.heatLevels[1]); // 置き火: 離した瞬間に、熱 ×3 で燃えはじめる
  // 見切り: 熱いまま、火がすぐ後ろにいるうちに自分で離すと倍率 +1。捕まると付かない（危ないほど得）
  if (!auto && k.flameOn && k.heatLv >= 1 && k.len - k.flameS < st.m.hotGap * 0.5) {
    k.mult += 1; st.mikiri = (st.mikiri || 0) + 1;
    const p = k.pts[k.pts.length - 1];
    // 見切り回収: 空の星屑をぜんぶ、鮮度 100% で吸い寄せる。この一筆の残りの星屑も自動で入る
    k.vacuum = true;
    let v = 0;
    const from = st.dust.map((d) => [d.x, d.y, d.gold ? 1 : 0]);
    for (const d of st.dust) v += takeDust(st, k, d, true);
    st.dust.length = 0; st.bestSweep = Math.max(st.bestSweep || 0, from.length);
    st.events.push({ type: 'mikiri', x: p.x, y: p.y, mult: k.mult, dustN: from.length, dustV: Math.round(v), from });
  }
}

// ---- 星屑
function spawnDust(st, s, n, gold) {
  if (st.seals.includes('hoshi')) return; // 封じ: 星隠し
  const k = st.stroke;
  for (let i = 0; i < n; i++) {
    const R = st.drnd, a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = 70 + R() * 120;
    const d = { x: s.x + (R() - 0.5) * s.r, y: s.y + (R() - 0.5) * s.r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, gold };
    if (k && k.vacuum) { const p = k.pts[k.pts.length - 1]; takeDust(st, k, d, true); st.events.push({ type: 'dust', x: d.x, y: d.y, tx: p.x, ty: p.y, v: Math.round(st.pv * (st.m.dustValX || 1) * (gold ? 2 : 1)), auto: true }); }
    else st.dust.push(d);
  }
}
function dustValue(st, d, fresh) { return st.pv * (st.m.dustValX || 1) * (d.gold ? 2 : 1) * (fresh ? 1 : 1 - st.m.dustFade * Math.min(1, d.t / st.m.dustLife)); }
function takeDust(st, k, d, fresh) {
  const v = dustValue(st, d, fresh);
  k.chips += v; k.dust++; k.dustPts += v; st.dustGot++; st.dustPts += v;
  return v;
}
function moveDust(st, dt) {
  const k = st.stroke, m = st.m;
  const pen = k && k.penDown && k.pts.length ? k.pts[k.pts.length - 1] : null;
  const pick = pen ? (k.heatLv >= 3 ? m.dustPickTop : m.dustPick + k.heatLv * 8) * (m.dustPickX || 1) : 0;
  const life = m.dustLife * (m.dustLifeX || 1);
  for (let i = st.dust.length - 1; i >= 0; i--) {
    const d = st.dust[i];
    d.t += dt;
    if (d.t >= life) { st.dust.splice(i, 1); continue; }
    d.vy += m.dustG * dt; const fr = Math.exp(-1.6 * dt); d.vx *= fr; d.vy *= fr;
    d.x += d.vx * dt; d.y += d.vy * dt;
    if (!pen) continue;
    const dx = pen.x - d.x, dy = pen.y - d.y, dist = Math.hypot(dx, dy);
    if (dist < pick) {
      const v = takeDust(st, k, { ...d, t: d.t / (m.dustLifeX || 1) }, false);
      st.dust.splice(i, 1);
      st.events.push({ type: 'dust', x: d.x, y: d.y, tx: pen.x, ty: pen.y, v: Math.round(v) });
    } else if (dist < pick * 2.2) { const f = (1 - dist / (pick * 2.2)) * 900 * dt / Math.max(dist, 1); d.vx += dx * f; d.vy += dy * f; } // 近くの星屑は筆先に寄ってくる
  }
}

function threadAt(st, x, y) {
  const k = st.stroke, m = st.m;
  const check = (px, py) => {
    for (const s of st.shells) {
      if (s.state !== 'idle' || s.threaded || s.rise > 0) continue;
      if (Math.hypot(s.x - px, s.y - py) < s.r + m.threadR) {
        s.threaded = true; s.vx = 0; s.vy = 0; k.threaded++;
        if (st.raid && !st.raid.dead) { s.spd = raidSpd(k.age); st.events.push({ type: 'raidSpd', x: s.x, y: s.y, spd: s.spd }); }
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

// 囲い（決まりの版 2〜）: 自分の線と交わって輪ができたら、輪の中の玉を覚える。火がその交点まで来ると、中の玉が一斉にひらく。
// 2 つ以上囲ったときだけ。1 本の線で 2 回まで。3 つ以上なら倍率 +1
function checkLoop(st, x, y) {
  const k = st.stroke, P = k.pts, n = P.length; k.loops ||= [];
  if (k.loops.length >= 2 || n < 24) return;
  for (let i = 0; i < n - 12; i++) {
    if (Math.abs(P[i].x - x) >= 10 || Math.abs(P[i].y - y) >= 10 || Math.hypot(P[i].x - x, P[i].y - y) >= 10) continue;
    if (k.loops.some((q) => Math.hypot(q.x - x, q.y - y) < 60)) return;
    const poly = P.slice(i);
    const inside = (sx, sy) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const A = poly[a], B = poly[b]; if ((A.y > sy) !== (B.y > sy) && sx < ((B.x - A.x) * (sy - A.y)) / ((B.y - A.y) || 1e-9) + A.x) c = !c; } return c; };
    const ids = st.shells.filter((s) => s.state === 'idle' && s.rise <= 0 && inside(s.x, s.y)).map((s) => s.id);
    if (ids.length < 2) return;
    k.loops.push({ x, y, s: P[i].s, ids, done: false });
    st.events.push({ type: 'loopMade', x, y, n: ids.length });
    return;
  }
}
function loopBurst(st, L) {
  const k = st.stroke; let n = 0;
  for (const s of st.shells) if (L.ids.includes(s.id) && s.state === 'idle') { ignite(st, s, 1, 'blast', 0.05 + n * 0.04); n++; }
  if (n >= 3) k.mult += 1;
  st.events.push({ type: 'loopBurst', x: L.x, y: L.y, n, mult: k.mult, up: n >= 3 });
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
  if (s.mod === 'seiza' && st.seiza && !st.seiza.done) { // 星玉: 自分の線でだけ、順に
    const Z = st.seiza;
    if (how !== 'line') return;
    if (s.seq !== Z.next) { if (Z.missAt !== st.strokesUsed) { Z.missAt = st.strokesUsed; st.events.push({ type: 'seizaMiss', x: s.x, y: s.y, want: Z.next }); } return; }
    st.events.push({ type: 'seizaStep', x: s.x, y: s.y, n: s.seq, need: Z.need, from: Z.last }); Z.last = [s.x, s.y]; Z.next++;
    if (Z.next > Z.need && st.stroke) {
      Z.done = true; st.stroke.mult *= 2; st.stroke.chips += 150 * Z.need;
      st.events.push({ type: 'seizaDone', x: s.x, y: s.y, mult: st.stroke.mult, chips: st.stroke.chips });
      // 満天: 空の高い所（画面の上より上）の玉が、星の雨のように順にひらく
      for (const o of st.shells) if (o !== s && o.state === 'idle' && o.rise <= 0 && o.y < 0 && o.mod !== 'seiza') ignite(st, o, 1, 'blast', 0.3 + ((o.id * 37) % 100) / 70);
    }
  }
  if (s.mod === 'moji' && st.moji && !st.moji.done) {
    const M = st.moji;
    if (how !== 'line') return; // 字玉は自分の線でだけ
    if (s.seq !== M.next) { if (M.missAt !== st.strokesUsed) { M.missAt = st.strokesUsed; st.events.push({ type: 'mojiMiss', x: s.x, y: s.y, want: M.next }); } return; }
    M.next++; st.events.push({ type: 'mojiStep', x: s.x, y: s.y, n: s.seq, need: M.need });
    if (M.next > M.need && st.stroke) { M.done = true; st.stroke.mult *= 2; st.stroke.chips += 120 * M.need; st.events.push({ type: 'mojiDone', kanji: M.kanji, x: s.x, y: s.y, mult: st.stroke.mult, chips: st.stroke.chips }); }
  }
  if (s.mod === 'kaku' && how !== 'line') return; // 急所は自分の線でだけ
  const m = st.m;
  if (how !== 'line' && s.type === 'shime') { s.hits++; st.events.push({ type: 'damp', shell: s }); if (s.hits < m.dampNeed) return; }
  if (how === 'line' && s.type === 'koori' && !m.iceLine) return;  // 氷玉は爆風でとかす
  if (s.type === 'shaku' && how !== 'line') return;                 // 尺玉は線の火でひらく
  s.state = 'lit'; s.how = how;
  st.pending.push({ s, gen, how, at: st.t + delay });
}

// 連鎖の節目には名前と小判。数が「出来事」になる
export const CHAIN_MARKS = [
  { n: 8, ja: '八重芯', en: 'Double Core', coin: 1 },
  { n: 15, ja: '十五夜', en: 'Harvest Moon', coin: 2 },
  { n: 25, ja: '千輪', en: 'Thousand Rings', coin: 3 },
  { n: 40, ja: '満天', en: 'Sky Ablaze', coin: 4 },
];
function burst(st, s, gen, how) {
  const k = st.stroke, d = SHELLS[s.type], m = st.m;
  s.state = 'burst';
  const decay = Math.max(m.genMin, m.genDecay ** gen);
  let R = s.R * decay * m.blastR * (st.kd || 1);
  k.pops++; st.totalPops++;
  k.types[s.type] = (k.types[s.type] || 0) + 1;
  const heatX = heatMult(k.heatLv, st);
  const lvl = st.recipes[s.type] || 0;
  let pts = (s.pts + lvl * Math.max(5, Math.round(d.pts * 0.5))) * heatX;
  const mod = st.seals.includes('kokuin') ? null : s.mod, kinfuu = st.seals.includes('kinfuu'); // 封じ
  if (mod === 'glass') pts *= 3; // 硝子: 点 ×3。ただし割れることがある
  if (k.lantern > 0) pts *= m.lanternX;
  if (st.zones.length && zoneAt(st, s.x, s.y)?.kind === 'oil') pts *= 3;
  if (st.ihen) pts *= IHEN_PTS; // 異変の間は点 ×1.5
  if (s.val) { const back = Math.round(s.val * MOERU_BACK); st.score += back; st.burnt = Math.max(0, (st.burnt || 0) - s.val); st.events.push({ type: 'kazuBack', x: s.x, y: s.y, val: back }); }
  const mult0 = k.mult;
  const c = fire(st, 'burst', { s, gen, how, pts, R, n: k.pops, heatLv: k.heatLv });
  pts = c.pts * m.chipsX; R = c.R;
  k.chips += Math.round(pts);
  if (st.raid && !st.raid.dead) {
    const Rd = st.raid, dd = Math.hypot(s.x - Rd.x, s.y - Rd.y) || 1;
    if (s.mod === 'kaku') { k.crit = (k.crit || 0) + 1; Rd.crits++; st.events.push({ type: 'raidCrit', x: s.x, y: s.y }); }
    // ひらいた花火は全部、大妖怪へ飛んでいく（なぞる＝攻撃）
    // 当たった時の倍率でその場で削れる（rLive）。離した時に、最後の倍率との差が追撃で入る
    // 速攻: 通した時の速攻（爆風で燃えた玉は、ひらいた時の速攻）を掛ける
    const sp = s.spd || raidSpd(k.age), p = Math.round(Math.round(pts) * sp); s.spd = 0;
    k.rPts = (k.rPts || 0) + p; k.rRaw = (k.rRaw || 0) + Math.round(pts); k.rLive = (k.rLive || 0) + p * k.mult; k.rHits = (k.rHits || 0) + 1; Rd.hitsAll++; Rd.spdW += p; Rd.spdN += Math.round(pts);
    st.events.push({ type: 'raidHit', sx: s.x, sy: s.y, x: Rd.x + ((s.x - Rd.x) / dd) * Rd.r * 0.55, y: Rd.y + ((s.y - Rd.y) / dd) * Rd.r * 0.55, pts: p, dmg: Math.round(p * k.mult), spd: sp, n: k.rHits, kaku: s.mod === 'kaku' });
  }
  if (d.mult && !kinfuu) k.mult += m.goldMult + lvl;
  if (mod === 'gold' && !kinfuu) k.mult += 1; // 金箔
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
  // 星屑がこぼれる。大きい玉ほど多い。金の玉の星屑は 2 倍の値
  spawnDust(st, s, (d.finale ? 16 : Math.min(6, 1 + Math.round(s.pts / 12)) + (m.dustAdd || 0)) * (mod === 'star' ? 3 : 1), s.type === 'kin' || s.type === 'kingyo' || mod === 'star');
  const ms = CHAIN_MARKS.find((c) => c.n === k.pops);
  if (ms) { st.coinsEarned += ms.coin; st.events.push({ type: 'chainMark', x: s.x, y: s.y, ...ms }); }
  st.events.push({ type: 'burst', shell: s, gen, how, R, pts: Math.round(pts), chips: k.chips, mult: k.mult, multUp: k.mult - mult0, n: k.pops, heatLv: k.heatLv });
  // 爆風が届いた玉に火を移し、線の通っていない玉は押し出す
  for (const o of st.shells) {
    if (o.state !== 'idle' || o === s || o.rise > 0) continue;
    const dist = Math.hypot(o.x - s.x, o.y - s.y);
    if (dist < R + (st.dn ? o.r / (o.rs || 1) : o.r)) ignite(st, o, gen + 1, 'blast', dist / m.shockV + 0.04);
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
  modAfter(st, s, gen);
  if (d.sparks || m.sparkAll) {
    const cnt = (d.sparks ? d.sparks : 0) + (m.sparkAll || 0) + (d.sparks ? (m.sparkAdd || 0) : 0);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * Math.PI * 2 + s.id;
      st.sparks.push({ x: s.x, y: s.y, vx: Math.cos(a) * m.sparkV, vy: Math.sin(a) * m.sparkV, life: m.sparkLife, gen: gen + 1 });
    }
  }
}

// 刻印のあと始末: 二度咲き・導火・硝子の割れ
function modAfter(st, s, gen) {
  if (st.seals.includes('kokuin')) return;
  if (s.mod === 'twice' && !s.twiced) { // 二度咲き: 0.5 秒後に、もう一度ひらく
    s.twiced = true; s.state = 'lit';
    st.pending.push({ s, gen: gen + 1, how: 'twice', at: st.t + 0.5 });
    st.events.push({ type: 'twice', x: s.x, y: s.y });
  }
  if (s.mod === 'renpatsu' && st.ren && !st.ren.done && !st.ren.active) { // 発射台: 長い一筆の終わりに届けば、連発
    const pops = st.stroke ? st.stroke.pops : 0;
    if (pops >= st.ren.need) { st.ren.active = true; st.ren.left = 16; st.ren.t = 0.3; st.events.push({ type: 'renStart', x: s.x, y: s.y }); }
    else st.events.push({ type: 'renFail', x: s.x, y: s.y, need: st.ren.need, have: pops });
  }
  if (s.mod === 'taki' && st.taki && !st.taki.done && st.taki.front === null) { // 滝の玉: 長い一筆の終わりに届けば、火の滝
    const pops = st.stroke ? st.stroke.pops : 0;
    if (pops >= st.taki.need) { st.taki.front = st.taki.x1; st.events.push({ type: 'takiStart', x: s.x, y: s.y }); }
    else st.events.push({ type: 'takiFail', x: s.x, y: s.y, need: st.taki.need, have: pops });
  }
  if (s.mod === 'fuse') { // 導火: いちばん近い 2 つの玉へ、距離に関係なく火を渡す
    const near = st.shells.filter((o) => o.state === 'idle' && o.rise <= 0 && o.type !== 'shaku').sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y)).slice(0, 2);
    for (const o of near) ignite(st, o, gen + 1, 'blast', 0.15 + Math.hypot(o.x - s.x, o.y - s.y) / 1600);
    if (near.length) st.events.push({ type: 'fuseLink', x: s.x, y: s.y, to: near.map((o) => [o.x, o.y]) });
  }
  if (s.mod === 'glass' && s.pi >= 0 && st.drnd() < 0.2 && !st.broken.includes(s.pi)) { st.broken.push(s.pi); st.events.push({ type: 'glassBreak', x: s.x, y: s.y }); }
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
    if (s.flip) { s.flip.t = Math.min(1, s.flip.t + dt / 0.6); const u = s.flip.t, e = u * u * (3 - 2 * u); s.y = s.flip.y0 + (s.flip.y1 - s.flip.y0) * e; if (u >= 1) s.flip = null; }
    if (s.fall) { s.y += s.fall * dt; if (s.y > f.y1 + 46) { s.state = 'gone'; if (s.val) st.events.push({ type: 'kazuLost', val: s.val, x: s.x }); continue; } }
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
    st.dropT = st.rainEvery;
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
  if (st.dust.length) moveDust(st, dt);
  if (st.raid) raidStep(st, dt);
  if (st.phase === 'stroke' && k) {
    k.age += dt;
    // 筆が止まっている時間（わざと火を待ったか）
    if (k.penDown) { if (k.len - k.seenLen < 2) k.stillT += dt; else { k.stillT = 0; k.seenLen = k.len; } }
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
    if (!k.flameOn && k.age >= (k.grace ?? m.grace) && !(m.okibi && k.penDown)) { k.flameOn = true; st.events.push({ type: 'ignite', x: k.pts[0].x, y: k.pts[0].y }); }
    if (k.flameOn && !k.fuseOut) {
      k.v = flameSpeed(st, k, dt);
      if (k.stopT > 0 && k.penDown) { k.stopT -= dt; k.v = 0; }
      k.flameS += k.v * dt;
      const gap = k.len - k.flameS;
      if (k.flameS >= k.cutS) { // 切れた所で火が止まる
        k.flameS = k.cutS; k.penDown = false; k.fuseOut = true; k.len = Math.min(k.len, k.cutS);
        st.events.push({ type: 'fuseOut', cut: true });
      } else if (k.penDown && gap <= 0) {
        if (k.len < m.minLen) { for (const s of st.shells) { s.threaded = false; s.spd = 0; } st.stroke = null; st.phase = 'aim'; st.events.push({ type: 'cancel' }); return; }
        if (k.saved < (m.catchSaves || 0)) { // 追いつかれても 1 度だけ踏みとどまる
          k.saved++; k.flameS = Math.max(0, k.len - 110); st.events.push({ type: 'saved' });
        } else {
          k.flameS = k.len; k.caught = true; k.penDown = false; st.caughtCount++;
          // 筆を止めて火を待っていたなら「わざと捕まった」。星の値は 2 割減る
          const waited = k.stillT >= 0.7 && k.len > 120;
          if (waited) st.waited++;
          const pv0 = st.pv; st.pv = Math.max(m.pv0, st.pv * m.caughtPv);
          st.events.push({ type: 'caught', x: k.pts[k.pts.length - 1].x, y: k.pts[k.pts.length - 1].y, waited, pvLost: Math.round(pv0 - st.pv) });
          fire(st, 'caught', {});
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
      // かすり: 火とのすき間がごく狭い間、0.1 秒ごとに数えて、星の値を上げる
      if (k.penDown && gap > 0 && gap < m.grazeGap * (m.grazeGapX || 1)) {
        k.grazeT += dt;
        while (k.grazeT >= m.grazeEvery) { k.grazeT -= m.grazeEvery; k.graze++; st.graze++; st.pv += m.grazePv * (m.grazePvX || 1); st.events.push({ type: 'graze', n: st.graze, k: k.graze, pv: st.pv, x: k.fx, y: k.fy }); fire(st, 'graze', { n: k.graze }); }
      }
      const lv = m.heatLevels.filter((v) => k.heat >= v).length;
      k.topLv = Math.max(k.topLv || 0, lv);
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
      if (k.loops) for (const L of k.loops) if (!L.done && k.flameS >= L.s) { L.done = true; loopBurst(st, L); }
    }
  }
  // 火花
  for (let i = st.sparks.length - 1; i >= 0; i--) {
    const q = st.sparks[i];
    q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    for (const s of st.shells) if (s.state === 'idle' && s.rise <= 0 && Math.hypot(s.x - q.x, s.y - q.y) < s.r + 6) { ignite(st, s, q.gen, 'spark', 0); q.life = 0; break; }
    if (q.life <= 0) st.sparks.splice(i, 1);
  }
  // 火の滝: 右から左へ 3.2 秒。通り道の玉に、上から順に火を付ける
  const T = st.taki;
  if (T && T.front !== null && st.stroke) {
    const f0 = T.front; T.front -= ((T.x1 - T.x0) / 3.2) * dt;
    for (const o of st.shells) if (o.state === 'idle' && o.rise <= 0 && o.x <= f0 + 12 && o.x > T.front - 12) ignite(st, o, 1, 'blast', 0.03 + Math.max(0, o.y - T.y) / 1400);
    T.ev += dt; if (T.ev >= 0.05) { T.ev = 0; st.events.push({ type: 'taki', x: T.front, y: T.y }); }
    if (T.front <= T.x0) { T.front = null; T.done = true; st.events.push({ type: 'takiEnd' }); }
  }
  // 連発: 0.2 秒ごとに、盤のどこかの玉へ 1 発（16 発）
  const Rn = st.ren;
  if (Rn && Rn.active && st.stroke) {
    Rn.t -= dt;
    if (Rn.t <= 0) {
      Rn.t = 0.2; Rn.left--;
      const idle = st.shells.filter((o) => o.state === 'idle' && o.rise <= 0 && o.mod !== 'moji');
      if (idle.length) { const o = idle[Math.floor(st.drnd() * idle.length)]; ignite(st, o, 1, 'blast', 0.35); st.events.push({ type: 'renShot', x: o.x, y: o.y }); }
      if (Rn.left <= 0 || !idle.length) { Rn.active = false; Rn.done = true; st.events.push({ type: 'renEnd' }); }
    }
  }
  // 火の移りを、順に爆ぜさせる
  for (let i = st.pending.length - 1; i >= 0; i--) {
    const p = st.pending[i];
    if (st.t >= p.at) { st.pending.splice(i, 1); if (st.stroke) burst(st, p.s, p.gen, p.how); }
  }
  // 一筆の終わり
  if (st.phase === 'stroke' && k && !k.done && !k.penDown && (k.fuseOut || k.caught) && !st.pending.length && !st.sparks.length && !st.runners.length && !(st.taki && st.taki.front !== null) && !(st.ren && st.ren.active)) finishStroke(st);
  if (st.phase === 'settle' && st.t >= st.settleAt) {
    if (st.cleared && st.level.boss && !st.act2 && !st.raid) { // 勝ったと思ったら、もう一幕
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
    settleNow(st);
  }
}
// 一筆のあとの間を終えて、次の一筆を待つ（継ぎ火で早めに入るときも、ここを通る）
function settleNow(st) {
  st.stroke = null;
  st.knots.length = 0;
  refill(st);
  st.phase = 'aim';
  st.events.push({ type: 'aim', strokesLeft: st.strokesLeft });
  intrude(st);
}

function knotBurst(st, q) {
  const k = st.stroke, R = 90;
  k.mult += 2; k.chips += 20;
  st.events.push({ type: 'knotBurst', x: q.x, y: q.y, R, mult: k.mult, chips: k.chips });
  for (const o of st.shells) if (o.state === 'idle' && o.rise <= 0 && Math.hypot(o.x - q.x, o.y - q.y) < R * (st.kd || 1) + (st.dn ? o.r / (o.rs || 1) : o.r)) ignite(st, o, 1, 'blast', 0.05);
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
  const multPre = k.mult; // 継ぎ火で持ちこむのは、満開の掛け算の前の倍率
  if (remain === 0 && k.pops > 0) {
    bloom = true; k.mult *= st.m.bloomX + Math.min(6, st.streak); st.streak++; st.blooms++; st.lastBloom = true;
    if (st.twist === 'katamono') st.goalMet = true;
    if (st.act2) st.encoreBloom = true;
    fire(st, 'bloom', {});
  }
  if (st.ihen && !k.caught && k.pops > 0) { k.mult += IHEN_CLEAR; st.events.push({ type: 'ihenClear', id: st.ihen.id, mult: k.mult }); }
  // 追いつかれた一筆は、点が半分（何を失ったかを、数字で見せる）
  if (k.caught && !st.m.caughtSafe) { k.lostChips = Math.floor(k.chips * 0.5); k.chips -= k.lostChips; }
  const gained = Math.floor(k.chips * k.mult);
  st.score += gained; st.lastGain = gained;
  st.dustScore = (st.dustScore || 0) + Math.floor(k.dustPts * k.mult); // 星屑で稼いだ点（結果の内訳に出す）
  // 技: 捕まらずに、はじめにあった玉の 6 割以上をひらけば取れる。ボーナスは倍率の外で足す
  let spellGot = 0;
  if (k.spell) {
    const got = !k.caught && (bloom || k.pops >= Math.ceil(k.idle0 * st.m.spellNeed));
    if (got) { spellGot = spellBonus(k); st.score += spellGot; }
    st.spellLog.push({ id: k.spell.id, got });
    st.events.push({ type: got ? 'spellGet' : 'spellFail', ...k.spell, bonus: spellGot });
  }
  if (st.raid && !st.raid.dead) {
    const Rd = st.raid, seg = Rd.max / RAID.seg, before = Rd.hp;
    const base = Math.floor((k.rLive || 0) * (k.crit ? 2 : 1)); // 焼かれた・追いつかれた一筆は、追撃が出ない（当てた分だけ）
    const dmg = k.caught && !st.m.caughtSafe ? base : Math.floor((k.rPts || 0) * k.mult * (k.crit ? 2 : 1));
    Rd.hp = Math.max(0, Rd.hp - dmg);
    const n0 = Math.min(RAID.seg, Math.floor((Rd.max - before) / seg + 1e-9)), n1 = Math.min(RAID.seg, Math.floor((Rd.max - Rd.hp) / seg + 1e-9));
    st.events.push({ type: 'raidDmg', dmg, base, mult: k.mult, spd: k.rRaw ? Math.round(((k.rPts || 0) / k.rRaw) * 10) / 10 : 1, hp: Rd.hp, max: Rd.max, crit: !!k.crit, hits: k.rHits || 0, caught: k.caught });
    if (Rd.hp <= 0) { Rd.dead = true; Rd.warns.length = 0; st.events.push({ type: 'raidDown', x: Rd.x, y: Rd.y }); }
    else if (n1 > n0) { Rd.broke = n1; Rd.ph = Math.min(RAID.fire.length - 1, n1); Rd.moved = true; Rd.atkT = 1.4; Rd.swT = 2.4; st.strokesLeft += 1; st.maxStrokes += 1; st.lastBloom = true; if (Rd.ph >= 2) st.m.flameX *= 1.08; st.events.push({ type: 'raidBreak', n: n1, ph: Rd.ph, x: Rd.x, y: Rd.y }); }
    else st.events.push({ type: 'raidCounter', burned: !!k.caught, x: Rd.x, y: Rd.y }); // 魂を砕けなかった一筆のあとは、大妖怪の反撃（命 −1）
  }
  st.strokesLeft--; st.strokesUsed++;
  st.events.push({ type: 'strokeEnd', gained, chips: k.chips, mult: k.mult, pops: k.pops, bloom, caught: k.caught, heatLv: k.heatLv, streak: st.streak, graze: k.graze, dust: k.dust, dustPts: Math.round(k.dustPts), tsugiN: k.tsugiN, spellGot, lost: k.lostChips || 0 });
  st.phase = 'settle';
  st.settleAt = st.t + (bloom ? 3.2 : 0.9);
  if (st.raid?.dead) st.settleAt = st.t + 3.4; // 討ち取りの演出を見せる間
  else if (st.raid) st.settleAt = Math.max(st.settleAt, st.t + 2.2); // 追撃と反撃を見せる間
  if (st.act2) st.coinsEarned += Math.ceil(k.pops / 3);
  if (st.raid) { if (st.raid.dead) st.cleared = true; else if (st.strokesLeft <= 0) st.failed = true; }
  else if (st.score >= st.target || st.goalMet || st.act2) st.cleared = true;
  else if (st.strokesLeft <= 0) st.failed = true;
  // 継ぎ火: 捕まらずに終えたら、離した所に輪が残る。輪の中から次の一筆を始めると倍率を持ちこめる
  const last = k.pts[k.pts.length - 1];
  if (!k.caught && k.pops > 0 && !st.failed && !st.cleared && st.strokesLeft > 0) {
    const win = st.m.tsugiWin * (st.m.tsugiWinX || 1);
    st.tsugi = { x: last.x, y: last.y, until: st.t + win, win, mult: multPre, heat: k.heat, n: (k.tsugiN || 0) + 1 };
    st.events.push({ type: 'tsugiOpen', x: last.x, y: last.y, n: st.tsugi.n, win });
  } else st.tsugi = null;
}

// 一筆が終わるたびに、町から新しい玉が上がってくる。満開のあとは盤がまるごと入れかわる
function refill(st) {
  if (st.raid?.moved) raidMove(st);
  const bloomed = st.lastBloom; st.lastBloom = false;
  const f = st.field;
  st.shells = st.shells.filter((s) => s.state === 'idle' && !s.fall);
  for (const s of st.shells) { s.threaded = false; s.spd = 0; }
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
    const deck = st.level.deck ? rotate(st.level.deck, st.deckI) : null;
    const L = layout(st.seed + st.strokesUsed * 131 + (st.act2 ? 977 : 0), cnt, mix, f, deck);
    st.deckI += L.deckUsed || 0;
    for (const p of L) {
      if (st.shells.every((o) => Math.hypot(o.x - p.x, o.y - p.y) > o.r + SHELLS[p.type].r + 10)) {
        const s = addShell(st, p.x, p.y, p.type, 0.1 + st.shells.length * 0.022); s.mod = p.mod; s.pi = p.pi;
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
        // 玉袋があれば袋の続きから（邪魔玉と趣向の玉はときどき混ざる）。なければ前のとおり
        const deck = st.level.deck, hz = types.filter((x) => !deck || !deck.some((d) => d.t === x));
        let it;
        if (deck && deck.length) it = hz.length && st.rnd() < 0.25 ? { t: hz[Math.floor(st.rnd() * hz.length)] } : deck[st.deckI % deck.length];
        else it = { t: st.rnd() < 0.45 && types.length ? types[Math.floor(st.rnd() * types.length)] : 'kiku' };
        const type = it.t;
        const x = f.x0 + st.rnd() * (f.x1 - f.x0), y = f.y0 + st.rnd() * (f.y1 - f.y0);
        if (st.shells.every((s) => Math.hypot(s.x - x, s.y - y) > s.r + SHELLS[type].r + 18)) {
          if (deck && it === deck[st.deckI % deck.length]) st.deckI++;
          const s = addShell(st, x, y, type, 0.1 + i * 0.09); s.mod = it.m || null; s.pi = it.pi ?? -1;
          st.events.push({ type: 'rise', shell: s });
          break;
        }
      }
    }
  }
  if (st.raid && !st.raid.dead) { raidClear(st); raidKaku(st); }
  if (st.twist === 'meoto') pairUp(st);
  if (st.twist === 'juzu') { typeSome(st, 'juzu', Math.max(0, 6 - st.shells.filter((s) => s.type === 'juzu').length)); numberJuzu(st); }
}

function rotate(a, i) { const k = ((i % a.length) + a.length) % a.length; return a.slice(k).concat(a.slice(0, k)); }

export function starsFor(st) {
  const s = st.score, t = st.target;
  if (st.raid?.dead) return Math.max(1, s >= t * 2.5 ? 3 : s >= t * 1.6 ? 2 : s >= t ? 1 : 0);
  return s >= t * 2.5 ? 3 : s >= t * 1.6 ? 2 : s >= t ? 1 : 0;
}
