// 一筆花火 2 — 1 周のルール（夜の並び・目標・屋台・小判）。DOM に触らない
import { CHARMS, CHARM_BY_ID } from './charms.js';
import { rng32, SHELLS, ENGI } from './sim.js';

export const WORLDS = [
  { id: 1, ja: '川辺の夏祭り', en: 'Riverside Festival', theme: 'summer', mix: ['kin', 'ootama', 'senrin', 'chouchin'], rules: ['kasha', 'kaze'] },
  { id: 2, ja: '雪の山里', en: 'Snowy Mountain Village', theme: 'winter', mix: ['kin', 'ootama', 'koori', 'chouchin', 'shime'], rules: ['ame', 'yamiyo'] },
  { id: 3, ja: '百鬼の宵山', en: 'Night of a Hundred Demons', theme: 'demon', mix: ['kin', 'ootama', 'oni', 'senrin', 'koori'], rules: ['kagami', 'ishun'] },
];
export const NIGHTS_PER_WORLD = 8;

export const RULES = {
  kasha: { ja: '鎌鼬', en: 'Kamaitachi', dj: '今夜の火は 1.55 倍速い', de: 'Tonight the flame is 55% faster', cast: 'kamaitachi' },
  kaze: { ja: '天狗', en: 'Tengu', dj: '大うちわの風で、玉が流される', de: 'A great fan blows the shells around', cast: 'tengu' },
  ame: { ja: '雪女', en: 'Yuki-onna', dj: '雪に打たれた線は、そこで切れる', de: 'Falling snow cuts your unburnt fuse', cast: 'yukionna' },
  yamiyo: { ja: '狐', en: 'Kitsune', dj: '玉が闇に沈む。筆先の近くだけ見える', de: 'Shells vanish in the dark, except near your brush', cast: 'kitsune' },
  kagami: { ja: '狸', en: 'Tanuki', dj: '線の鏡写しも燃える', de: 'Your line also burns in mirror image', cast: 'tanuki' },
  ishun: { ja: '山彦', en: 'Yamabiko', dj: '墨がほぼ半分', de: 'Almost half the ink', cast: 'yamabiko' },
};

// 夜ごとの趣向。線の引き方か、爆発のあとの展開が変わるものだけを置く。coin は、その夜を選んだときの上乗せ
export const TWISTS = {
  nezumi: { tier: 1, coin: 1, ja: 'ねずみ花火', en: 'Whirling Mice', dj: '火がつくと走り回って、ふれた玉に火を移す', de: 'Once lit they scurry around, lighting whatever they touch' },
  roket: { tier: 1, coin: 1, ja: 'ロケット花火', en: 'Bottle Rockets', dj: '矢の向きへ一直線に飛んで、道すじの玉を燃やす', de: 'They shoot straight where the arrow points, lighting everything in the way' },
  oyako: { tier: 1, coin: 1, ja: '親子玉', en: 'Mother Shells', dj: 'ひらくと子玉が飛び散る。子玉も線で拾え', de: 'They scatter small shells when they open. Catch those too' },
  kingyo: { tier: 1, coin: 2, ja: '金魚すくい', en: 'Goldfish Scoop', dj: '玉が泳ぎ回る。すくえば小判', de: 'These shells swim around. Scoop them for coins' },
  bake: { tier: 1, coin: 1, ja: '化け玉', en: 'Trickster Shells', dj: '何が起きるかは、ひらくまで分からない', de: 'Nobody knows what happens until they open' },
  katamono: { tier: 1, coin: 2, ja: '型物の夜', en: 'Picture Night', dj: '玉が絵になっている。何筆かけてもいい。全部ひらけば、点が足りなくても突破', de: 'The shells form a picture. Open them all, in as many strokes as you have, and you pass whatever the score' },
  gyoretsu: { tier: 1, coin: 1, ja: '提灯行列', en: 'Lantern Parade', dj: '提灯の列が空を渡っていく', de: 'Rows of lanterns march across the sky' },
  senpatsu: { tier: 1, coin: 1, ja: '千発の夜', en: 'A Thousand Sparks', dj: '小さな玉が空いっぱいに。道をえらんで全部さらえ', de: 'Tiny shells fill the sky. Pick a route and sweep them all' },
  tome: { tier: 2, coin: 1, ja: '地蔵玉', en: 'Jizo Shells', dj: '線の火でひらくと、火が 1 秒止まる。息つぎに使え', de: 'Lit by your line, they freeze the flame for a second. Catch your breath' },
  meoto: { tier: 2, coin: 2, ja: '夫婦玉', en: 'Twin Shells', dj: '片方ひらくと、離れていてももう片方もひらく。倍率 +1', de: 'Open one and its twin opens too, however far away. +1 MULT' },
  nige: { tier: 2, coin: 3, ja: '逃げ玉', en: 'Runaway Shells', dj: '筆が近づくと逃げる。追いつめれば倍率 +3', de: 'They flee from your brush. Corner them for +3 MULT' },
  juzu: { tier: 2, coin: 2, ja: '数珠玉', en: 'Prayer Beads', dj: '1 から順に通すほど倍率が上がる。全部つなげば、さらに +5', de: 'Thread them in order for rising MULT. All six: +5 more' },
  ryusei: { tier: 2, coin: 2, ja: '流れ玉の夜', en: 'Falling Shells', dj: '引いている間、空から玉が降ってくる。墨は多め', de: 'Shells rain down as long as you keep drawing. Extra ink' },
  abura: { tier: 2, coin: 2, ja: '油と水の川', en: 'Oil and Water', dj: '油の上は火が速いが点 ×3。水の上は火が遅い', de: 'On oil the flame races but POINTS ×3. On water it crawls' },
  ippatsu: { tier: 2, coin: 3, ja: '尺玉一発', en: 'One Grand Shell', dj: '尺玉だけ。熱 ×3 以上で火を入れれば、点が足りなくても突破', de: 'Just one Grand Shell. Light it at HOT ×3+ and you pass, whatever the score' },
  kaza: { tier: 3, coin: 3, ja: '風車の夜', en: 'Pinwheels', dj: 'まわる羽根が、まだ燃えていない線を切る', de: 'Spinning blades cut any fuse that has not burned yet' },
  karasu: { tier: 3, coin: 3, ja: '烏の夜', en: 'Crows', dj: '烏が玉をさらう。線を通した玉は無事。筆で追い払える', de: 'Crows steal shells. Threaded ones are safe. Shoo them with your brush' },
};
export const INTRUDES = {
  fuku: { ja: '福の神が乱入！', en: 'A lucky god drops in!', dj: '金の玉が降ってきた', de: 'Gold shells appear' },
  nezumi: { ja: 'ねずみが乱入！', en: 'Mice on the loose!', dj: 'ねずみ花火が上がった', de: 'Whirling mice appear' },
  oyako: { ja: '親子連れが乱入！', en: 'A family drops in!', dj: '親子玉が上がった', de: 'Mother shells appear' },
  bake: { ja: '化け狸が乱入！', en: 'A tanuki drops in!', dj: '化け玉が混ざった', de: 'Trickster shells appear' },
  karasu: { ja: '烏が乱入！', en: 'Crows swoop in!', dj: '玉をさらっていく。筆で追い払え', de: 'They steal shells. Shoo them away' },
  kaza: { ja: '大風車が乱入！', en: 'A pinwheel appears!', dj: '羽根が線を切る', de: 'Its blades cut your fuse' },
};

// ---- 玉袋: 自分の玉が、そのまま夜の盤になる。屋台で玉を足し、菊を間引き、玉に刻印を入れる
export const HAZARDS = ['shime', 'koori', 'oni']; // 世界の邪魔玉（袋に入らない）
// 屋台で買える玉。tier = 出はじめる世界
export const POUCH_SHELLS = {
  kin: { cost: 4, tier: 1 }, ootama: { cost: 3, tier: 1 }, senrin: { cost: 4, tier: 1 }, chouchin: { cost: 4, tier: 1 },
  nezumi: { cost: 4, tier: 1 }, roket: { cost: 4, tier: 1 }, oyako: { cost: 5, tier: 1 }, bake: { cost: 4, tier: 1 },
  tome: { cost: 5, tier: 2 }, kingyo: { cost: 5, tier: 2 }, nige: { cost: 6, tier: 2 },
};
export const MODS = {
  gold: { ja: '金箔', en: 'Gold Leaf', dj: 'ひらくと 倍率 +1', de: 'Opens for +1 MULT', cost: 5, col: '#e8b53a' },
  twice: { ja: '二度咲き', en: 'Double Bloom', dj: 'ひらいたあと、もう一度ひらく', de: 'Opens twice', cost: 6, col: '#f2f2ff' },
  glass: { ja: '硝子', en: 'Glass', dj: '点 ×3。ひらくたび 2 割で割れて袋から消える', de: 'POINTS ×3. 20% chance to shatter each time', cost: 4, col: '#7fe8ff' },
  fuse: { ja: '導火', en: 'Fuse Link', dj: 'ひらくと、いちばん近い 2 つの玉へ火を渡す', de: 'Opens and lights the 2 nearest shells', cost: 5, col: '#ff6a3a' },
  star: { ja: '星宿し', en: 'Star-Bearing', dj: '星屑が 3 倍こぼれる', de: 'Drops 3× star dust', cost: 4, col: '#7fb6ff' },
};
export const POUCH_MIN = 8;
export const ENGI_SLOTS = 2;
export function bossEngi(run) { const ids = Object.keys(ENGI), r = rng32((run.seed * 5 + run.world * 77) >>> 0); return ids[Math.floor(r() * ids.length)]; }
export const startPouch = (extra = []) => [...Array(10).fill('kiku'), 'kin', 'ootama', 'chouchin', ...extra].map((t) => ({ t, m: null }));
export function pouchCount(pouch) { const c = {}; for (const x of pouch || []) c[x.t] = (c[x.t] || 0) + 1; return c; }
// 夜ごとに袋を切る（同じ周回・同じ夜なら同じ順）
export function deckFor(run, seed) {
  const d = (run.pouch || startPouch()).map((x, i) => ({ t: x.t, m: x.m || null, pi: i }));
  const rnd = rng32(seed + 4049);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
// 屋台の品を周回に反映する（画面とボットの両方から呼ぶ）
export function applyItem(run, it) {
  if (it.kind === 'charm') run.charms.push(it.id);
  else if (it.kind === 'recipe') run.recipes[it.id] = (run.recipes[it.id] || 0) + 1;
  else if (it.kind === 'add') run.pouch.push({ t: it.id, m: null });
  else if (it.kind === 'engi') { run.engi = run.engi || []; if (run.engi.length < ENGI_SLOTS) run.engi.push(it.id); }
  else if (it.kind === 'thin') { const i = run.pouch.findIndex((x) => x.t === 'kiku' && !x.m); if (i >= 0 && run.pouch.length > POUCH_MIN) run.pouch.splice(i, 1); run.thinned = (run.thinned || 0) + 1; }
  else if (it.kind === 'engrave') { const x = run.pouch.find((y) => y.t === it.target && !y.m) || run.pouch.find((y) => !y.m); if (x) x.m = it.id; }
}

// 開始の型。夜の形が変わるものだけ
export const FUSES = [
  { id: 'asa', ja: '麻の縄', en: 'Hemp Fuse', dj: 'ふつうの導火線', de: 'The standard fuse', start: [], coins: 4 },
  { id: 'kinshi', ja: '金糸', en: 'Gold Thread', dj: '金運を持って始まる。小判 +4', de: 'Start with Gold Luck and +4 coins', start: ['kinun'], coins: 8, unlock: { wins: 1 } },
  { id: 'hibana', ja: '火花筒', en: 'Spark Tube', dj: '千輪師と飛び火を持つ。墨 0.8 倍', de: 'Crossette Master & Leaping Sparks. Ink ×0.8', start: ['senrin', 'sekirei'], coins: 2, inkX: 0.8, unlock: { best: 8 } },
  { id: 'gouka', ja: '業火', en: 'Hellfire', dj: '鬼火を持つ。火が 1.2 倍速い', de: 'Will-o-wisp. Flame 20% faster', start: ['oniibi'], coins: 4, flameX: 1.2, unlock: { best: 12 } },
  { id: 'hitosuji', ja: '一筋', en: 'One Thread', dj: '一発勝負を持つ。墨 1.5 倍', de: 'All or Nothing. Ink ×1.5', start: ['ippatsu'], coins: 4, inkX: 1.5, unlock: { wins: 2 } },
  { id: 'chouchin', ja: '祭り提灯', en: 'Festival Lantern', dj: '提灯職人と灯りを持つ', de: 'Lantern Maker & Glow', start: ['chouchinshi', 'akari'], coins: 2, unlock: { best: 16 } },
];

// 段位: 上がるごとに 1 つ厳しくなる
export const RANKS = [
  { ja: '見習い', en: 'Apprentice', dj: '', de: '' },
  { ja: '手代', en: 'Journeyman', dj: '目標 +15%', de: 'Targets +15%', target: 1.15 },
  { ja: '職人', en: 'Artisan', dj: '上に加えて 屋台の品 +1 小判', de: '+ Shop items cost +1', target: 1.15, costAdd: 1 },
  { ja: '親方', en: 'Master', dj: '上に加えて 火が 1.1 倍速い', de: '+ Flame 10% faster', target: 1.15, costAdd: 1, flameX: 1.1 },
  { ja: '名人', en: 'Virtuoso', dj: '上に加えて 目標 +40%・灯 2 つ', de: '+ Targets +40%, 2 lights', target: 1.4, costAdd: 1, flameX: 1.1 },
  { ja: '鍵屋', en: 'Grandmaster', dj: '上に加えて 筆 −1 の夜あり（大一番）', de: '+ Boss nights: 1 less stroke', target: 1.4, costAdd: 1, flameX: 1.1, bossStroke: -1 },
  { ja: '玉屋', en: 'Legend', dj: '上に加えて 目標 +80%・灯 1 つ', de: '+ Targets +80%, 1 light', target: 1.8, costAdd: 1, flameX: 1.15, bossStroke: -1 },
  { ja: '花火神', en: 'Fireworks God', dj: '上に加えて 持てるお守り −1', de: '+ One fewer charm slot', target: 1.8, costAdd: 1, flameX: 1.2, bossStroke: -1, slots: -1 },
];

// 目標点。作りが育つ前提で、夜ごとに伸びる（_dev/hanabi-bot.mjs で測る）
const BASE_TARGET = [200, 400, 700, 1200, 1700, 2400, 3300, 5000];
const WORLD_X = [1, 3.7, 12];

// 目標点: 24 夜を通してなめらかに伸びる（ボットの「3 筆の点」の中央値に合わせた曲線 × TARGET_K）。
// 世界の変わり目で目標が下がって楽になる夜をなくした
// はじめの夜はゆるく（×0.45）、終盤ほどきつく（×0.75）。大一番は ×1.35（技のボーナスと第二幕があるぶん）
export const TARGET_K = [0.37, 0.0115];
export function targetFor(i, rank = RANKS[0], boss = false) {
  const k = TARGET_K[0] + TARGET_K[1] * (i - 1);
  return Math.round((k * 1190 * Math.pow(i, 1.12) * (rank.target || 1) * (boss ? 1.35 : 1)) / 10) * 10;
}
// 千秋楽（24 夜のあとに続く祭り）: 世界は 3 つをめぐり、目標は 1 巡ごとに 1.6 倍、火も速くなる
export const worldOf = (w) => WORLDS[(w - 1) % WORLDS.length];
export const endlessX = (w) => (w > WORLDS.length ? Math.pow(1.6, w - WORLDS.length) : 1);
export function startEndless(run) { run.endless = true; run.done = false; run.world = WORLDS.length + 1; run.night = 1; run.retry = 0; run.lives = Math.max(run.lives, 1); }
export function isBoss(night) { return night === 4 || night === 8; }

// 次の夜の座標
export const nextCoord = (run) => (run.night < NIGHTS_PER_WORLD ? [run.world, run.night + 1] : run.world < WORLDS.length ? [run.world + 1, 1] : null);
const allowedTier = (w, n) => (w === 1 ? (n <= 4 ? 1 : 2) : w === 2 ? (n <= 2 ? 2 : 3) : 3);
// 道の分かれ: 次の夜を 2 つから選ぶ。片方は中身の見えない夜のことがある（小判が多い）
export function routeChoices(run) {
  const nx = nextCoord(run);
  if (!nx || isBoss(nx[1]) || nx[1] === 1 || (nx[0] === 1 && nx[1] <= 3)) return []; // 道の分かれは、遊び方を覚えた 4 夜目から
  const rnd = rng32((run.seed * 3 + nx[0] * 211 + nx[1] * 37 + 5) >>> 0), tier = allowedTier(nx[0], nx[1]);
  const all = Object.keys(TWISTS).filter((id) => TWISTS[id].tier <= tier);
  let pool = all.filter((id) => !(run.used || []).includes(id));
  if (pool.length < 2) pool = all;
  const out = [];
  for (let i = 0; i < 2; i++) {
    const [id] = pool.splice(Math.floor(rnd() * pool.length), 1);
    out.push({ id, coin: TWISTS[id].coin, hide: false });
  }
  if ((nx[0] - 1) * NIGHTS_PER_WORLD + nx[1] >= 4 && rnd() < 0.4) { out[1].hide = true; out[1].coin += 2; }
  return out;
}
export function chooseRoute(run, c) {
  const nx = nextCoord(run);
  if (!nx || !c) return;
  run.plan = run.plan || {}; run.used = run.used || [];
  run.plan[`${nx[0]}-${nx[1]}`] = { id: c.id, coin: c.coin, hide: c.hide };
  run.used.push(c.id);
}
// 古い保存にも新しい項目を足す
export function fixRun(run) {
  if (!run) return run;
  run.lives ??= 3; run.retry ??= 0; run.bloomStreak ??= 0; run.plan ??= {}; run.used ??= [];
  run.pv ??= 4; run.dust ??= 0; run.graze ??= 0; run.waitedNights ??= 0; run.spells ??= {};
  run.pouch ??= startPouch(); run.engi ??= [];
  return run;
}
// 1 周で拾った星屑がここに届くたび、提灯が 1 つ増える（5 まで）
export const EXTENDS = [150, 400, 800, 1400, 2200];
export const MAX_LIVES = 5;
// 夜の結果を周回に反映する。'clear' | 'retry' | 'over'
export function afterNight(run, st) {
  run.bloomStreak = st.blooms > 0 ? st.streak : 0;
  // 腕の層は周回をまたいで持ちこす（星の値・星屑・かすり・技の記録）
  fixRun(run);
  const d0 = run.dust; run.dust += st.dustGot; run.graze += st.graze; run.pv = st.pv;
  if (st.waited > 0) run.waitedNights++;
  for (const r of st.spellLog || []) { const x = run.spells[r.id] || (run.spells[r.id] = { t: 0, g: 0 }); x.t++; if (r.got) x.g++; }
  run.lastExt = 0;
  // 割れた硝子は袋から消える（後ろから消して番号をずらさない）
  run.lastBroken = 0;
  for (const i of [...(st.broken || [])].sort((a, b) => b - a)) if (run.pouch?.[i]?.m === 'glass') { run.pouch.splice(i, 1); run.lastBroken++; }
  for (const e of EXTENDS) if (d0 < e && run.dust >= e && run.lives < MAX_LIVES) { run.lives++; run.lastExt++; }
  if (st.cleared) { run.retry = 0; return 'clear'; }
  run.lives--;
  if (run.lives <= 0) return 'over';
  run.retry++;
  return 'retry';
}

export function nightDef(run, world, night) {
  const W = worldOf(world), rank = RANKS[run.rank] || RANKS[0];
  const seed = (run.seed * 31 + world * 1009 + night * 97 + (run.retry || 0) * 7919) >>> 0;
  const rnd = rng32(seed + 13);
  const boss = isBoss(night);
  const mix = {};
  const pool = W.mix.slice(0, Math.min(W.mix.length, 1 + Math.floor((world - 1) * 2 + night / 2)));
  // 盤は玉袋から。世界の邪魔玉（湿り・氷・鬼）だけを、この夜の分だけ混ぜる
  for (const t of pool) if (HAZARDS.includes(t)) mix[t] = 1 + Math.floor(rnd() * (1 + night / 3));
  if (boss) mix.shaku = 1;
  const rule = boss ? W.rules[(night / 4 - 1 + (run.seed % 2)) % W.rules.length] : null;
  const count = 13 + Math.min(14, world * 2 + night);
  const target = Math.round(targetFor((world - 1) * NIGHTS_PER_WORLD + night, rank, boss) * endlessX(world) / 10) * 10;
  const strokes = 3 + (boss && rank.bossStroke ? rank.bossStroke : 0);
  const idx = (world - 1) * NIGHTS_PER_WORLD + night - 1;
  const pl = run.plan?.[`${world}-${night}`];
  // 乱入は予告なし。大一番と、はじめの 2 夜にはこない
  const irnd = rng32(seed + 77);
  let intrude = null;
  if (!boss && idx >= 2 && irnd() < 0.26 + world * 0.08) {
    const kinds = world === 1 ? ['fuku', 'nezumi', 'oyako', 'bake'] : ['fuku', 'nezumi', 'oyako', 'bake', 'karasu', 'kaza'];
    intrude = kinds[Math.floor(irnd() * kinds.length)];
    if (pl && pl.id === intrude) intrude = 'fuku';
  }
  return { endless: world > WORLDS.length, deck: deckFor(run, seed), flame: (1 + Math.min(idx, 23) * 0.022) * (world > WORLDS.length ? 1 + 0.06 * (world - WORLDS.length) : 1), gusts: idx >= 2, id: idx + 1, world, night, seed, count, mix, strokes, refill: 7 + Math.floor(night / 2), target, rule, boss, twist: pl?.id || null, twistCoin: pl?.coin || 0, twistHide: !!pl?.hide, intrude };
}

export function newRun({ seed, fuse = 'asa', rank = 0 } = {}) {
  const f = FUSES.find((x) => x.id === fuse) || FUSES[0];
  return {
    seed: seed ?? (Date.now() % 100000000), fuse: f.id, rank, world: 1, night: 1,
    charms: f.start.slice(), recipes: {}, coins: f.coins, slots: 5 + (RANKS[rank]?.slots || 0), rerolls: 0, totalScore: 0, nightsCleared: 0, bestChain: 0, stars: 0,
    shopRound: 0, done: false, won: false,
    lives: rank >= 6 ? 1 : rank >= 4 ? 2 : 3, retry: 0, bloomStreak: 0, plan: {}, used: [],
    pv: 4, dust: 0, graze: 0, waitedNights: 0, spells: {},
    pouch: startPouch(f.pouch || []), engi: [],
  };
}

export function loadoutFor(run) {
  const f = FUSES.find((x) => x.id === run.fuse) || FUSES[0], rank = RANKS[run.rank] || RANKS[0];
  const charms = run.charms.map((id) => CHARM_BY_ID[id]).filter(Boolean);
  const pre = {
    id: '_fuse', mod: (m) => {
      if (f.inkX) m.ink *= f.inkX;
      if (f.flameX) m.flameX *= f.flameX;
      if (rank.flameX) m.flameX *= rank.flameX;
    },
  };
  return { charms: [pre, ...charms], recipes: run.recipes, coins: run.coins, streak: run.bloomStreak || 0, pv: run.pv ?? 4 };
}

// 夜の報酬: 基本 + 残った筆 + 星
export function rewardFor(st, stars, boss) {
  return { base: boss ? 6 : 3, left: (st.keptStrokes ?? st.strokesLeft) * 1, star: Math.max(0, stars - 1), earned: st.coinsEarned, twist: st.level.twistCoin || 0, interest: 0 };
}
export function interestFor(coins) { return Math.min(3, Math.floor(coins / 5)); }

// 屋台: 持っていないお守り 3 つ + 花火の秘伝 2 つ
const RAR_WEIGHT = { c: 70, r: 25, l: 5 };
export function shopFor(run, unlocked) {
  const rnd = rng32((run.seed * 7 + run.world * 131 + run.night * 17 + run.shopRound * 1013) >>> 0);
  const rank = RANKS[run.rank] || RANKS[0];
  const disc = run.charms.reduce((a, id) => a + (CHARM_BY_ID[id]?.discount || 0), 0);
  const cost = (c) => Math.max(1, c + (rank.costAdd || 0) - disc);
  // その玉が出ない世界・袋に無い玉のためのお守りは並べない
  const hazardWorld = { shime: 2, koori: 2, oni: 3 };
  const usable = (c) => !c.need || (hazardWorld[c.need] ? run.world >= hazardWorld[c.need] : (run.pouch || []).some((x) => x.t === c.need));
  const pool = CHARMS.filter((c) => !run.charms.includes(c.id) && (!unlocked || unlocked.has(c.id)) && usable(c));
  const items = [];
  const taken = new Set();
  // 今の作りに合う型を少し出やすく
  const held = {}; for (const id of run.charms) { const t = CHARM_BY_ID[id]?.tag; if (t) held[t] = (held[t] || 0) + 1; }
  for (let i = 0; i < 3 && pool.length; i++) {
    let total = 0; const w = pool.map((c) => { const v = taken.has(c.id) ? 0 : RAR_WEIGHT[c.rar] * (1 + (held[c.tag] || 0) * 0.45); total += v; return v; });
    if (total <= 0) break;
    let r = rnd() * total, pick = 0; for (let j = 0; j < pool.length; j++) { r -= w[j]; if (r <= 0) { pick = j; break; } }
    taken.add(pool[pick].id);
    items.push({ kind: 'charm', id: pool[pick].id, cost: cost(pool[pick].cost) });
  }
  const pouch = run.pouch || startPouch();
  const shellPool = Object.keys(POUCH_SHELLS).filter((t) => POUCH_SHELLS[t].tier <= run.world);
  // 1) 玉を足す
  const add = shellPool[Math.floor(rnd() * shellPool.length)];
  const bought = Math.max(0, pouch.length - 13 + (run.thinned || 0)), mods = pouch.filter((x) => x.m).length;
  items.push({ kind: 'add', id: add, cost: cost(POUCH_SHELLS[add].cost + Math.floor(bought / 2)) }); // 玉は買うほど高くなる
  // 刻印の候補: 袋のまだ刻印のない玉ひとつ（半分は菊以外を狙う）
  const modIds = Object.keys(MODS), mod = modIds[Math.floor(rnd() * modIds.length)];
  const bare = pouch.filter((x) => !x.m), nonKiku = bare.filter((x) => x.t !== 'kiku');
  const tgt = (nonKiku.length && rnd() < 0.5 ? nonKiku : bare)[Math.floor(rnd() * Math.max(1, (nonKiku.length && rnd() < 0.5 ? nonKiku : bare).length))];
  // 2) 刻印・間引き・秘伝のどれか 1 つ（屋台の札は 6 枚まで）
  const kikuN = pouch.filter((x) => x.t === 'kiku' && !x.m).length, roll = rnd();
  if (tgt && roll < 0.45) items.push({ kind: 'engrave', id: mod, target: tgt.t, cost: cost(MODS[mod].cost + mods) });
  else if (kikuN > 0 && pouch.length > POUCH_MIN && roll < 0.8) items.push({ kind: 'thin', id: 'kiku', cost: cost(2 + (run.thinned || 0)) });
  else { const own = [...new Set(pouch.map((x) => x.t))]; const t = own[Math.floor(rnd() * own.length)] || 'kiku'; if (SHELLS[t]) items.push({ kind: 'recipe', id: t, cost: cost(3 + (run.recipes[t] || 0) * 2) }); }
  // 4) 縁起物（使い切り）。持てるのは 2 つまで
  const eids = Object.keys(ENGI), e = eids[Math.floor(rnd() * eids.length)];
  items.push({ kind: 'engi', id: e, cost: cost(ENGI[e].cost) });
  return items;
}

export function rerollCost(run) {
  const free = run.charms.some((id) => CHARM_BY_ID[id]?.freeReroll) && run.rerolls === 0;
  return free ? 0 : 2 + run.rerolls;
}

export function advance(run) {
  run.rerolls = 0; run.shopRound = 0; run.retry = 0;
  if (run.night < NIGHTS_PER_WORLD) { run.night++; return 'night'; }
  if (run.world < WORLDS.length || run.endless) { run.world++; run.night = 1; return 'world'; } // 千秋楽: 世界 4 から先も続く
  run.done = true; run.won = true;
  return 'won';
}
export const clearedCount = (run) => (run.world - 1) * NIGHTS_PER_WORLD + run.night - 1;

// ---- 周回をまたぐ記録: 周回ごとに経験がたまり、お守りと開始の型が開く
export const START_POOL = 38;
export function unlockedCharms(meta) {
  const xp = meta?.xp || 0, n = Math.min(CHARMS.length, START_POOL + Math.floor(xp / 30));
  const order = CHARMS.slice().sort((a, b) => ({ c: 0, r: 1, l: 2 }[a.rar] - { c: 0, r: 1, l: 2 }[b.rar]));
  return new Set(order.slice(0, n).map((c) => c.id));
}
export function fuseOpen(f, meta) {
  if (!f.unlock) return true;
  return (f.unlock.wins ? (meta?.wins || 0) >= f.unlock.wins : true) && (f.unlock.best ? (meta?.best || 0) >= f.unlock.best : true);
}
export function xpFor(run) { return run.nightsCleared * 5 + (run.won ? 60 : 0) + run.rank * 5; }
