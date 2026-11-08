// 一筆花火 2 — 1 周のルール（夜の並び・目標・屋台・小判）。DOM に触らない
import { CHARMS, CHARM_BY_ID } from './charms.js';
import { rng32 } from './sim.js';

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
  { ja: '名人', en: 'Virtuoso', dj: '上に加えて 目標 +40%・提灯 2 つ', de: '+ Targets +40%, 2 lanterns', target: 1.4, costAdd: 1, flameX: 1.1 },
  { ja: '鍵屋', en: 'Grandmaster', dj: '上に加えて 筆 −1 の夜あり（大一番）', de: '+ Boss nights: 1 less stroke', target: 1.4, costAdd: 1, flameX: 1.1, bossStroke: -1 },
  { ja: '玉屋', en: 'Legend', dj: '上に加えて 目標 +80%・提灯 1 つ', de: '+ Targets +80%, 1 lantern', target: 1.8, costAdd: 1, flameX: 1.15, bossStroke: -1 },
  { ja: '花火神', en: 'Fireworks God', dj: '上に加えて 持てるお守り −1', de: '+ One fewer charm slot', target: 1.8, costAdd: 1, flameX: 1.2, bossStroke: -1, slots: -1 },
];

// 目標点。作りが育つ前提で、夜ごとに伸びる（_dev/hanabi-bot.mjs で測る）
const BASE_TARGET = [200, 400, 700, 1200, 1700, 2400, 3300, 5000];
const WORLD_X = [1, 4.2, 13];

export function isBoss(night) { return night === 4 || night === 8; }

// 次の夜の座標
export const nextCoord = (run) => (run.night < NIGHTS_PER_WORLD ? [run.world, run.night + 1] : run.world < WORLDS.length ? [run.world + 1, 1] : null);
const allowedTier = (w, n) => (w === 1 ? (n <= 4 ? 1 : 2) : w === 2 ? (n <= 2 ? 2 : 3) : 3);
// 道の分かれ: 次の夜を 2 つから選ぶ。片方は中身の見えない夜のことがある（小判が多い）
export function routeChoices(run) {
  const nx = nextCoord(run);
  if (!nx || isBoss(nx[1]) || nx[1] === 1) return [];
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
  return run;
}
// 夜の結果を周回に反映する。'clear' | 'retry' | 'over'
export function afterNight(run, st) {
  run.bloomStreak = st.blooms > 0 ? st.streak : 0;
  if (st.cleared) { run.retry = 0; return 'clear'; }
  run.lives--;
  if (run.lives <= 0) return 'over';
  run.retry++;
  return 'retry';
}

export function nightDef(run, world, night) {
  const W = WORLDS[world - 1], rank = RANKS[run.rank] || RANKS[0];
  const seed = (run.seed * 31 + world * 1009 + night * 97 + (run.retry || 0) * 7919) >>> 0;
  const rnd = rng32(seed + 13);
  const boss = isBoss(night);
  const mix = {};
  const pool = W.mix.slice(0, Math.min(W.mix.length, 1 + Math.floor((world - 1) * 2 + night / 2)));
  for (const t of pool) mix[t] = 1 + Math.floor(rnd() * (1 + night / 3));
  if (boss) mix.shaku = 1;
  const rule = boss ? W.rules[(night / 4 - 1 + (run.seed % 2)) % W.rules.length] : null;
  const count = 13 + Math.min(14, world * 2 + night);
  const target = Math.round((BASE_TARGET[night - 1] * WORLD_X[world - 1] * (rank.target || 1) * (boss ? 1.1 : 1)) / 10) * 10;
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
  return { flame: 1 + idx * 0.022, gusts: idx >= 2, id: idx + 1, world, night, seed, count, mix, strokes, refill: 7 + Math.floor(night / 2), target, rule, boss, twist: pl?.id || null, twistCoin: pl?.coin || 0, twistHide: !!pl?.hide, intrude };
}

export function newRun({ seed, fuse = 'asa', rank = 0 } = {}) {
  const f = FUSES.find((x) => x.id === fuse) || FUSES[0];
  return {
    seed: seed ?? (Date.now() % 100000000), fuse: f.id, rank, world: 1, night: 1,
    charms: f.start.slice(), recipes: {}, coins: f.coins, slots: 5 + (RANKS[rank]?.slots || 0), rerolls: 0, totalScore: 0, nightsCleared: 0, bestChain: 0, stars: 0,
    shopRound: 0, done: false, won: false,
    lives: rank >= 6 ? 1 : rank >= 4 ? 2 : 3, retry: 0, bloomStreak: 0, plan: {}, used: [],
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
  return { charms: [pre, ...charms], recipes: run.recipes, coins: run.coins, streak: run.bloomStreak || 0 };
}

// 夜の報酬: 基本 + 残った筆 + 星
export function rewardFor(st, stars, boss) {
  return { base: boss ? 6 : 3, left: (st.keptStrokes ?? st.strokesLeft) * 1, star: Math.max(0, stars - 1), earned: st.coinsEarned, twist: st.level.twistCoin || 0, interest: 0 };
}
export function interestFor(coins) { return Math.min(5, Math.floor(coins / 5)); }

// 屋台: 持っていないお守り 3 つ + 花火の秘伝 2 つ
const RAR_WEIGHT = { c: 70, r: 25, l: 5 };
export function shopFor(run, unlocked) {
  const rnd = rng32((run.seed * 7 + run.world * 131 + run.night * 17 + run.shopRound * 1013) >>> 0);
  const rank = RANKS[run.rank] || RANKS[0];
  const disc = run.charms.reduce((a, id) => a + (CHARM_BY_ID[id]?.discount || 0), 0);
  const cost = (c) => Math.max(1, c + (rank.costAdd || 0) - disc);
  const pool = CHARMS.filter((c) => !run.charms.includes(c.id) && (!unlocked || unlocked.has(c.id)));
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
  const shells = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'koori', 'oni'];
  for (let i = 0; i < 2; i++) { const t = shells[Math.floor(rnd() * shells.length)]; if (items.some((x) => x.kind === 'recipe' && x.id === t)) continue; items.push({ kind: 'recipe', id: t, cost: cost(3 + (run.recipes[t] || 0) * 2) }); }
  return items;
}

export function rerollCost(run) {
  const free = run.charms.some((id) => CHARM_BY_ID[id]?.freeReroll) && run.rerolls === 0;
  return free ? 0 : 2 + run.rerolls;
}

export function advance(run) {
  run.rerolls = 0; run.shopRound = 0; run.retry = 0;
  if (run.night < NIGHTS_PER_WORLD) { run.night++; return 'night'; }
  if (run.world < WORLDS.length) { run.world++; run.night = 1; return 'world'; }
  run.done = true; run.won = true;
  return 'won';
}
export const clearedCount = (run) => (run.world - 1) * NIGHTS_PER_WORLD + run.night - 1;

// ---- 周回をまたぐ記録: 周回ごとに経験がたまり、お守りと開始の型が開く
export const START_POOL = 34;
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
