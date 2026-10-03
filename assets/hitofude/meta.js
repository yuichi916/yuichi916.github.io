// 一筆花火 — 祭りの外側のしくみ: 花火師の格（XP）・解放・実績・今日のおつかい・続けた日数・図鑑。
// 純関数だけを置く（DOM・storage に触らない）。テストは tests/hitofude_meta_test.mjs。
//
// 使い方（ページの側）
//   起動時:        meta = initMeta(保存してあった値)            … 壊れた値・古い値でも、きれいな meta が返る
//                  （前の版から遊んでいる人には initMeta(null, { runs, cleared }) で 1 度だけおまけ）
//   お守りの候補:   core の offerCharms(..., { pool: charmPool(meta), level })
//   段位えらび:     0〜maxLevel(meta)。features(meta) に 'levels' があるときだけ出す
//   次のごほうび:   upcoming(meta) → [{ ...UNLOCKS の 1 つ, xpLeft }]（「あと 120 XP で招き猫」）
//   見たもの:       meta = noteSeen(meta, { charms: 出た候補, shells: 見た玉の種類, cast: 会った妖怪 })（候補が出るたびに 1 回）
//   祭りが終わったら: r = applyRun(meta, summary, 今日の日付) → meta = r.meta を保存し、
//                  r.parts（XP の内訳）・r.rankBefore / r.rankAfter・r.unlocked・r.achievements・r.quests を順に見せる
// meta は小さな JSON（よく遊んでも 2KB まで）で、ページの保存の中にそのまま入れてよい。
//
// summary（ページが作る、一回の祭りのまとめ）
//   { mode: 'run', daily, level /*段位*/, cleared /*越えた夜 0..8*/, total, bestPops,
//     nights: [{ night, score, target, pass, stars: [b,b,b], allClear, pops, total, twist, boss, wish: { id, met }, toriAdd, maxGen, goldTouched, lineTouched }],
//     charms: { id: lv }（core の並び ['kinun','kinun'] でもよい）, retries /*予備の提灯を使った回数*/, outfit }
//   nights は一夜目から順に並べる。やり直した夜は、最後の 1 回だけ入れる。
//   大一番の妖怪は boss（無ければ twist から）で見る。勝ち = その夜の pass。
//   retries が無いまとめでは「予備いらず」の実績はとれない。今日の日付は core の jstDateKey で作る（壊れた日付なら、続けた日数とおつかいは動かさない）。

export const META_VERSION = 1;

// ---------------------------------------------------------------- 共通の ID（SPEC の「Shared IDs」と同じ）
export const NIGHTS = 8;
export const MAX_LEVEL = 8; // 段位は 0（ふつう）〜 8
// お守り 24 個。並びは図鑑の並び
export const CHARM_IDS = [
  'nagafude', 'nokorizumi', 'tairin', 'kinun', 'osobi', 'ichibanboshi', 'owaridama', 'kodou', 'mankai', 'mashidama',
  'nihitsu', 'nokoribi', 'chouchinshi', 'amayoke', 'kazekiri',
  'maneki', 'hanaikada', 'renjishi', 'suminagashi', 'senkou',
  'tengu', 'tanuki', 'kitsune', 'kamaitachi',
];
// はじめから候補に出る 9 個
export const STARTER_CHARMS = ['nagafude', 'kinun', 'kodou', 'tairin', 'nokoribi', 'chouchinshi', 'mashidama', 'owaridama', 'amayoke'];
// 伝説のお守り。その妖怪に初めて勝つと、候補に入る（ID は妖怪と同じ）
export const BOSSES = ['tengu', 'tanuki', 'kitsune', 'kamaitachi'];
export const LEGEND_CHARMS = BOSSES.slice();
export const TWIST_BOSS = { massugu: 'tengu', kagami: 'tanuki', yamiyo: 'kitsune', isshun: 'kamaitachi' };
export const CAST_IDS = [...BOSSES, 'neko'];
export const OUTFIT_IDS = ['hachimaki', 'kanzashi', 'omen', 'uchiwa', 'kingyo', 'kanmuri'];
export const FEATURE_IDS = ['daily', 'levels'];
export const SHELL_TYPES = ['kiku', 'ootama', 'kin', 'senrin', 'chouchin', 'shime', 'shaku'];
export const WISH_IDS = [
  'w_lantern_first', 'w_all_gold', 'w_spare30', 'w_pops', 'w_touch_few', 'w_double', 'w_damp_all',
  'w_tori8', 'w_rope_all', 'w_no_cloud', 'w_gold_first', 'w_bloom', 'w_short', 'w_big_all',
];

// 解放の知らせに出す名前（core の CHARMS と cast.js の OUTFITS に合わせる。ここは見出しだけ）
const NAMES = {
  nokorizumi: ['残り墨', 'Spare ink'], osobi: ['遅火', 'Slow fuse'], ichibanboshi: ['一番星', 'First star'],
  mankai: ['満開の加護', 'Full bloom'], nihitsu: ['二筆目', 'Second stroke'], kazekiri: ['風切り', 'Wind cutter'],
  maneki: ['招き猫', 'Lucky cat'], hanaikada: ['花筏', 'Petal raft'], renjishi: ['連獅子', 'Lion dance'],
  suminagashi: ['墨流し', 'Ink marbling'], senkou: ['線香花火', 'Sparkler'],
  tengu: ['天狗の団扇', 'Tengu fan'], tanuki: ['狸の葉っぱ', 'Tanuki leaf'], kitsune: ['狐火', 'Foxfire'], kamaitachi: ['鎌鼬の爪', 'Kamaitachi claw'],
  hachimaki: ['はちまき', 'Headband'], kanzashi: ['花かんざし', 'Flower hairpin'], omen: ['狐のお面', 'Fox mask'],
  uchiwa: ['うちわ', 'Paper fan'], kingyo: ['金魚', 'Goldfish'], kanmuri: ['王冠', 'Crown'],
  daily: ['今夜の一筆', 'Tonight\'s Stroke'], levels: ['段位えらび', 'Stakes'],
};
const YOKAI = { tengu: ['天狗', 'Tengu'], tanuki: ['狸', 'Tanuki'], kitsune: ['狐', 'Fox'], kamaitachi: ['鎌鼬', 'Kamaitachi'] };
const TWIST_NAME = { massugu: ['まっすぐ', 'Straight'], kagami: ['鏡', 'Mirror'], yamiyo: ['闇夜', 'Dark night'], isshun: ['一瞬', 'Snap'] };

// ---------------------------------------------------------------- 花火師の格
// 10 の位 × 3 段 = 30。位の名前ごとに、一・二・三と上がる。
// 上がるのに要る XP は 60, 80, 100, 120 … 1060（だんだん増える）。ふつうに遊ぶ人（テストの「50 回」）で、
// 1 回目の祭りで格 2〜3、5 回で 9 前後、10 回で 13 前後（お守りは 16 で出そろう）、50 回ほどで 30 に届く
const TIERS = [
  ['見習い', 'Apprentice'], ['火の番', 'Fire Keeper'], ['玉込め', 'Shell Packer'], ['打ち上げ手', 'Launcher'], ['花火師', 'Hanabi Maker'],
  ['腕利き', 'Expert'], ['親方', 'Master Hand'], ['名人', 'Master'], ['達人', 'Virtuoso'], ['大名人', 'Grand Master'],
];
// 格 lv から lv+1 へ上がるのに要る XP（lv = 1..29）
function rankCost(lv) { return Math.round((40 + 18 * lv + 0.25 * lv * lv) / 10) * 10; }
export const RANKS = (() => {
  const out = [];
  let xp = 0;
  for (let lv = 1; lv <= TIERS.length * 3; lv++) {
    const [ja, en] = TIERS[Math.floor((lv - 1) / 3)], step = (lv - 1) % 3;
    out.push({ lv, xp, ja: `${ja} ${'一二三'[step]}`, en: `${en} ${['I', 'II', 'III'][step]}`, tier: Math.floor((lv - 1) / 3), step: step + 1 });
    xp += rankCost(lv);
  }
  return out;
})();
export const MAX_RANK = RANKS.length;

// 格のいま: lv・名前・この格の中で貯めた XP（cur）と、次の格までの幅（next）。いちばん上では next = 0, frac = 1
export function rankOf(xp) {
  const x = typeof xp === 'number' ? int(xp, 0, XP_MAX, 0) : int(get(xp, 'xp'), 0, XP_MAX, 0);
  let i = 0;
  while (i + 1 < RANKS.length && RANKS[i + 1].xp <= x) i++;
  const r = RANKS[i], top = i + 1 >= RANKS.length;
  const next = top ? 0 : RANKS[i + 1].xp - r.xp, cur = x - r.xp;
  return { lv: r.lv, name: r.ja, nameEn: r.en, tier: r.tier, cur, next, frac: top ? 1 : cur / next, toNext: top ? 0 : next - cur, xp: x, max: top };
}

// ---------------------------------------------------------------- 解放
// 格 2〜16 は、上がるたびに必ず何か 1 つ増える（お守りか、ヒノコの衣装か、遊び方）。
// lv が null のものは格ではなく出来事で開く: by = 'boss'（その妖怪に初めて勝つ）/ 'clear'（八夜を初めて通す）/ 'level'（段位 8 で八夜を通す）
function U(lv, kind, id, extra = {}) {
  const [ja, en] = NAMES[id];
  const how = lv != null ? [`格 ${lv}`, `Rank ${lv}`]
    : extra.by === 'boss' ? [`${YOKAI[extra.boss][0]}に初めて勝つ`, `Beat the ${YOKAI[extra.boss][1]}`]
      : extra.by === 'clear' ? ['八夜を初めて通す', 'Clear all 8 nights']
        : [`段位 ${extra.level} で八夜を通す`, `Clear all 8 nights on Stakes ${extra.level}`];
  return { lv, kind, id, ja, en, by: extra.by || 'rank', ...extra, how: how[0], howEn: how[1] };
}
export const UNLOCKS = [
  U(2, 'charm', 'maneki'), U(2, 'feature', 'daily'),
  U(3, 'outfit', 'hachimaki'),
  U(4, 'charm', 'hanaikada'),
  U(5, 'charm', 'nihitsu'),
  U(6, 'outfit', 'kanzashi'),
  U(7, 'charm', 'renjishi'),
  U(8, 'charm', 'suminagashi'),
  U(9, 'outfit', 'omen'),
  U(10, 'charm', 'senkou'),
  U(11, 'charm', 'osobi'),
  U(12, 'outfit', 'uchiwa'),
  U(13, 'charm', 'ichibanboshi'),
  U(14, 'charm', 'nokorizumi'),
  U(15, 'charm', 'mankai'),
  U(16, 'charm', 'kazekiri'),
  U(18, 'outfit', 'kingyo'),
  U(null, 'feature', 'levels', { by: 'clear' }),
  ...BOSSES.map((b) => U(null, 'charm', b, { by: 'boss', boss: b })),
  U(null, 'outfit', 'kanmuri', { by: 'level', level: MAX_LEVEL }),
];

function unlockedBy(m, u) {
  if (u.by === 'rank') return rankOf(m.xp).lv >= u.lv;
  if (u.by === 'boss') return beatenN(m, u.boss) > 0;
  if (u.by === 'clear') return m.top >= 0;
  return m.top >= u.level;
}
function unlockedSet(meta) {
  const m = initMeta(meta);
  return UNLOCKS.filter((u) => unlockedBy(m, u));
}
// 候補に出してよいお守り（図鑑の並び）
export function charmPool(meta) {
  const got = new Set([...STARTER_CHARMS, ...unlockedSet(meta).filter((u) => u.kind === 'charm').map((u) => u.id)]);
  return CHARM_IDS.filter((id) => got.has(id));
}
export function outfits(meta) {
  const got = new Set(unlockedSet(meta).filter((u) => u.kind === 'outfit').map((u) => u.id));
  return OUTFIT_IDS.filter((id) => got.has(id));
}
export function features(meta) {
  const got = new Set(unlockedSet(meta).filter((u) => u.kind === 'feature').map((u) => u.id));
  return FEATURE_IDS.filter((id) => got.has(id));
}
// えらべる段位のいちばん上。段位 n で八夜を通すと n+1 が開く（まだ通していなければ 0 だけ）
export function maxLevel(meta) { return Math.min(MAX_LEVEL, initMeta(meta).top + 1); }
// 次に格で開くもの（「あと ◯ XP で招き猫」の表示用）。n 個まで、xpLeft つき
export function upcoming(meta, n = 1) {
  const m = initMeta(meta), lv = rankOf(m.xp).lv;
  return UNLOCKS.filter((u) => u.by === 'rank' && u.lv > lv).slice(0, Math.max(0, n | 0))
    .map((u) => ({ ...u, xpLeft: RANKS[u.lv - 1].xp - m.xp }));
}

// ---------------------------------------------------------------- 実績
// やさしいものから順に。hidden は、とるまで名前を「？」にしておくもの
export const ACHIEVEMENTS = [
  { id: 'first_night', xp: 10, ja: '初めての夜', en: 'First Night', desc: '夜を 1 つ越える', descEn: 'Clear your first night' },
  { id: 'first_wish', xp: 10, ja: '願いがひとつ', en: 'A Wish Comes True', desc: '願い札を 1 つ叶える', descEn: 'Fulfil a wish card' },
  { id: 'daily1', xp: 15, ja: '今夜の一筆', en: 'Tonight\'s Stroke', desc: '今夜の一筆を遊ぶ', descEn: 'Play Tonight\'s Stroke' },
  { id: 'star3', xp: 20, ja: '三つ星', en: 'Three Stars', desc: '一夜で ★★★ をとる', descEn: 'Earn ★★★ on a night' },
  { id: 'first_boss', xp: 20, ja: '大一番', en: 'Showdown', desc: '大一番の夜を越える', descEn: 'Win a boss night' },
  { id: 'half', xp: 20, ja: '祭りの折り返し', en: 'Halfway There', desc: '一回の祭りで四夜越える', descEn: 'Clear 4 nights in one run' },
  { id: 'tori8', xp: 25, ja: '大トリ', en: 'Grand Finale', desc: '大トリで倍率 +8 以上', descEn: 'Get +8 mult or more from the grand shell' },
  { id: 'lv3', xp: 25, ja: '磨きぬいたお守り', en: 'Polished Charm', desc: 'お守りを Lv3 にする', descEn: 'Raise a charm to Lv3' },
  { id: 'regular', xp: 30, ja: '祭りの常連', en: 'Regular', desc: '祭りを 10 回遊ぶ', descEn: 'Play 10 runs' },
  ...BOSSES.map((b) => {
    const tw = Object.keys(TWIST_BOSS).find((k) => TWIST_BOSS[k] === b);
    return { id: `beat_${b}`, xp: 30, ja: `${YOKAI[b][0]}に勝つ`, en: `${YOKAI[b][1]} Beaten`, desc: `大一番「${TWIST_NAME[tw][0]}」で${YOKAI[b][0]}に勝つ`, descEn: `Beat the ${YOKAI[b][1]} on a ${TWIST_NAME[tw][1]} night` };
  }),
  { id: 'full_clear', xp: 60, ja: '八夜の花火師', en: 'Full Festival', desc: '一回の祭りで八夜をすべて越える', descEn: 'Clear all 8 nights in one run' },
  { id: 'streak5', xp: 50, ja: '五日つづけて', en: 'Five-Day Streak', desc: '5 日つづけて遊ぶ', descEn: 'Play 5 days in a row' },
  { id: 'pops40', xp: 60, ja: '四十連発', en: 'Forty Bursts', desc: '一夜で 40 発ひらく', descEn: 'Burst 40 shells in one night' },
  { id: 'all_yokai', xp: 80, ja: '妖怪の友だち', en: 'Yokai Friends', desc: '4 匹の妖怪みんなに勝つ', descEn: 'Beat all four yokai' },
  { id: 'level3', xp: 80, ja: '段位三', en: 'Stakes 3', desc: '段位 3 で八夜を通す', descEn: 'Clear all 8 nights on Stakes 3' },
  { id: 'no_retry', xp: 80, ja: '予備いらず', en: 'No Spares Needed', desc: '予備の提灯を使わずに八夜を通す', descEn: 'Clear all 8 nights without a spare lantern', hidden: true },
  { id: 'zukan', xp: 100, ja: 'お守り図鑑', en: 'Charm Collector', desc: 'お守りを 24 種類すべて見る', descEn: 'See all 24 charms' },
  { id: 'wish_all', xp: 100, ja: '願い札あつめ', en: 'Wish Collector', desc: '14 種類の願いを、どれも 1 度は叶える', descEn: 'Fulfil every kind of wish at least once' },
  { id: 'bloom8', xp: 100, ja: '八夜目の満開', en: 'Final Bloom', desc: '八夜目で、夜空の玉を全部ひらく', descEn: 'Burst every shell on night 8', hidden: true },
  { id: 'level6', xp: 120, ja: '段位六', en: 'Stakes 6', desc: '段位 6 で八夜を通す', descEn: 'Clear all 8 nights on Stakes 6' },
  { id: 'stars24', xp: 150, ja: '満天の星', en: 'Starry Sky', desc: '一回の祭りで星を 24 個', descEn: 'Earn all 24 stars in one run', hidden: true },
  { id: 'wishes8', xp: 150, ja: '願いがみんな叶う', en: 'Every Wish', desc: '一回の祭りで、八夜の願いをみんな叶える', descEn: 'Fulfil all 8 wishes in one run', hidden: true },
  { id: 'level8', xp: 250, ja: '王冠の花火師', en: 'Crowned', desc: '段位 8 で八夜を通す（ヒノコに王冠）', descEn: 'Clear all 8 nights on Stakes 8 (Hinoko gets a crown)' },
];
// 実績の条件。c = { s: その回のまとめ（きれいにしたもの）, m: その回を足したあとの meta }
const ACH_TEST = {
  first_night: (c) => c.s.cleared >= 1,
  first_wish: (c) => c.s.wishes >= 1,
  daily1: (c) => c.s.daily,
  star3: (c) => c.s.nights.some((n) => n.stars === 3),
  first_boss: (c) => c.s.beaten.length >= 1,
  half: (c) => c.s.cleared >= 4,
  tori8: (c) => c.s.nights.some((n) => n.toriAdd >= 8),
  lv3: (c) => Object.values(c.s.charms).some((lv) => lv >= 3),
  regular: (c) => c.m.runs >= 10,
  full_clear: (c) => c.s.cleared >= NIGHTS,
  streak5: (c) => c.m.streak.n >= 5,
  pops40: (c) => c.s.nights.some((n) => n.pops >= 40),
  all_yokai: (c) => BOSSES.every((b) => beatenN(c.m, b) > 0),
  level3: (c) => c.m.top >= 3,
  no_retry: (c) => c.s.cleared >= NIGHTS && c.s.retries === 0, // retries が無いまとめでは、とれない
  zukan: (c) => CHARM_IDS.every((id) => c.m.charms[id] && c.m.charms[id][0] > 0),
  wish_all: (c) => WISH_IDS.every((id) => (c.m.wish[id] || 0) > 0),
  bloom8: (c) => c.s.cleared >= NIGHTS && c.s.passed.length >= NIGHTS && c.s.passed[NIGHTS - 1].allClear,
  level6: (c) => c.m.top >= 6,
  stars24: (c) => c.s.stars >= NIGHTS * 3,
  wishes8: (c) => c.s.cleared >= NIGHTS && c.s.wishes >= NIGHTS,
  level8: (c) => c.m.top >= MAX_LEVEL,
};
for (const b of BOSSES) ACH_TEST[`beat_${b}`] = (c) => beatenN(c.m, b) > 0;
const ACH_IDS = ACHIEVEMENTS.map((a) => a.id);

// ---------------------------------------------------------------- 今日のおつかい
// 日付ごとに 3 つ（やさしい・ふつう・むずかしいから 1 つずつ）。その日の祭りを何回やっても、進みは足されていく。
// kind: sum = その日の合計 / max = 一回の祭りでのいちばん / group が同じものは同じ日に並べない
const Q = (tier, id, ja, en, goal, kind, group, stat) => ({ id, tier, ja, en, goal, xp: [25, 40, 60][tier], kind, group, stat });
const QUEST_DEFS = [
  Q(0, 'q_play2', '祭りを 2 回遊ぶ', 'Play 2 runs', 2, 'sum', 'play', () => 1),
  Q(0, 'q_nights6', '夜を合わせて 6 つ越える', 'Clear 6 nights in total', 6, 'sum', 'nights', (s) => s.cleared),
  Q(0, 'q_stars6', '星を合わせて 6 個とる', 'Earn 6 stars in total', 6, 'sum', 'star', (s) => s.stars),
  Q(0, 'q_wish2', '願いを 2 つ叶える', 'Fulfil 2 wishes', 2, 'sum', 'wish', (s) => s.wishes),
  Q(0, 'q_daily', '今夜の一筆を遊ぶ', 'Play Tonight\'s Stroke', 1, 'sum', 'play', (s) => (s.daily ? 1 : 0)),
  Q(1, 'q_run4', '一回の祭りで四夜越える', 'Clear 4 nights in one run', 4, 'max', 'run', (s) => s.cleared),
  Q(1, 'q_boss', '大一番の夜を越える', 'Win a boss night', 1, 'sum', 'boss', (s) => s.bossWins),
  Q(1, 'q_star2', '★★ を 3 回とる', 'Earn ★★ three times', 3, 'sum', 'star', (s) => s.nights.filter((n) => n.stars >= 2).length),
  Q(1, 'q_lv2', 'Lv2 のお守りを持って祭りを終える', 'Finish a run with a Lv2 charm', 1, 'sum', 'charm', (s) => (Object.values(s.charms).some((lv) => lv >= 2) ? 1 : 0)),
  Q(1, 'q_pops', '合わせて 120 発ひらく', 'Burst 120 shells in total', 120, 'sum', 'pops', (s) => s.pops),
  Q(2, 'q_run6', '一回の祭りで六夜越える', 'Clear 6 nights in one run', 6, 'max', 'run', (s) => s.cleared),
  Q(2, 'q_tori', '大トリで倍率 +8 以上', 'Get +8 mult from the grand shell', 1, 'sum', 'tori', (s) => s.nights.filter((n) => n.toriAdd >= 8).length),
  Q(2, 'q_star3', '一夜で ★★★ をとる', 'Earn ★★★ on a night', 1, 'sum', 'star', (s) => s.nights.filter((n) => n.stars === 3).length),
  Q(2, 'q_wish5', '願いを 5 つ叶える', 'Fulfil 5 wishes', 5, 'sum', 'wish', (s) => s.wishes),
  Q(2, 'q_clear', '八夜を通す', 'Clear all 8 nights', 1, 'sum', 'run', (s) => (s.cleared >= NIGHTS ? 1 : 0)),
];
export const QUESTS = QUEST_DEFS.map(({ stat, ...q }) => q);
const QUEST_BY_ID = Object.fromEntries(QUEST_DEFS.map((q) => [q.id, q]));

export function dailyQuests(dateKey) {
  const rnd = rng32(hashStr('hitofude-quest:' + String(dateKey)));
  const out = [], groups = new Set();
  for (let tier = 0; tier < 3; tier++) {
    const list = QUEST_DEFS.filter((q) => q.tier === tier && !groups.has(q.group));
    const q = list[Math.floor(rnd() * list.length)];
    groups.add(q.group);
    out.push({ id: q.id, ja: q.ja, en: q.en, goal: q.goal, xp: q.xp, tier: q.tier });
  }
  return out;
}

// ---------------------------------------------------------------- XP
// 一回の祭りの XP。夜を越えるほど、後の夜ほど多い。星・願い・大一番・完走に少しずつ。段位ひとつにつき +12.5%
export const XP = {
  play: 5, nights: [8, 10, 12, 14, 16, 18, 22, 26], star: 2, wish: 6, boss: 15, clear: 50, levelBonus: 0.125,
  streakStep: 10, streakCap: 7, // 続けた日数のおまけ: その日の初めの 1 回に 10 × 日数（7 日で頭打ち）
};
const PART_NAME = {
  play: ['遊んだ', 'Played'], nights: ['越えた夜', 'Nights cleared'], stars: ['星', 'Stars'], wishes: ['叶った願い', 'Wishes'],
  bosses: ['大一番', 'Boss nights'], clear: ['八夜を通した', 'Full clear'], level: ['段位のおまけ', 'Stakes bonus'], streak: ['つづけて遊んだ日', 'Day streak'],
};
const part = (id, xp, n) => ({ id, ja: PART_NAME[id][0], en: PART_NAME[id][1], xp, n });

export function xpForRun(summary) { return runXp(cleanSummary(summary)); }
function runXp(s) {
  const parts = [part('play', XP.play, 1)];
  if (s.cleared) parts.push(part('nights', XP.nights.slice(0, s.cleared).reduce((a, b) => a + b, 0), s.cleared));
  if (s.stars) parts.push(part('stars', s.stars * XP.star, s.stars));
  if (s.wishes) parts.push(part('wishes', s.wishes * XP.wish, s.wishes));
  if (s.bossWins) parts.push(part('bosses', s.bossWins * XP.boss, s.bossWins));
  if (s.cleared >= NIGHTS) parts.push(part('clear', XP.clear, 1));
  const base = parts.reduce((a, p) => a + p.xp, 0);
  if (s.level) parts.push(part('level', Math.round(base * XP.levelBonus * s.level), s.level));
  return { total: parts.reduce((a, p) => a + p.xp, 0), parts };
}

// ---------------------------------------------------------------- 祭りを足す
export function applyRun(meta, summary, dateKey) {
  const before = initMeta(meta), m = initMeta(meta), s = cleanSummary(summary);
  // まだ開いていない段位は、開いているいちばん上として数える（おかしな値で王冠が開かないように）
  s.level = Math.min(s.level, maxLevel(before));
  const rankBefore = rankOf(before.xp);
  const parts = runXp(s).parts;

  // 数を足す
  m.runs = cap(m.runs + 1);
  m.nights = cap(m.nights + s.cleared);
  m.stars = cap(m.stars + s.stars);
  m.wishes = cap(m.wishes + s.wishes);
  if (s.daily) m.daily = cap(m.daily + 1);
  if (s.cleared >= NIGHTS) { m.clears = cap(m.clears + 1); m.top = Math.max(m.top, s.level); }
  m.best = Math.max(m.best, s.total);
  m.pops = Math.max(m.pops, s.bestPops);
  // 妖怪: 会った・勝った
  const bossesBeaten = [];
  for (const n of s.nights) {
    if (!n.boss) continue;
    const e = m.cast[n.boss] || [0, 0];
    e[0] = cap(e[0] + 1);
    if (n.pass) { if (!e[1] && !bossesBeaten.includes(n.boss)) bossesBeaten.push(n.boss); e[1] = cap(e[1] + 1); }
    m.cast[n.boss] = e;
  }
  // 図鑑: 持っていたお守り（見た・使った・いちばん高い Lv）、叶えた願い
  for (const [id, lv] of Object.entries(s.charms)) {
    const e = m.charms[id] || [0, 0, 0];
    m.charms[id] = [Math.max(1, e[0]), cap(e[1] + 1), Math.max(e[2], lv)];
  }
  for (const n of s.nights) if (n.wish && n.wishMet) m.wish[n.wish] = cap((m.wish[n.wish] || 0) + 1);

  // 続けた日数（日付が前に進んだときだけ）
  let streakXp = 0;
  const day = dayIndex(dateKey);
  if (day != null) {
    const last = dayIndex(m.streak.last);
    if (last == null || day > last) {
      m.streak.n = last != null && day === last + 1 ? Math.min(m.streak.n + 1, COUNT_MAX) : 1;
      m.streak.last = dateKey;
      m.streak.best = Math.max(m.streak.best, m.streak.n);
      streakXp = XP.streakStep * Math.min(m.streak.n, XP.streakCap);
      parts.push(part('streak', streakXp, m.streak.n));
    }
  }

  // 実績（足したあとの meta で見る。一度とったものは二度と数えない）
  const have = new Set(m.ach), achievements = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id) || !ACH_TEST[a.id]({ s, m })) continue;
    achievements.push(a.id); have.add(a.id);
    parts.push({ id: `ach:${a.id}`, ja: `実績「${a.ja}」`, en: `Achievement: ${a.en}`, xp: a.xp, n: 1 });
  }
  m.ach = ACH_IDS.filter((id) => have.has(id));

  // 今日のおつかい
  const quests = [];
  if (day != null) {
    if (m.quest.d !== dateKey) m.quest = { d: dateKey, p: [0, 0, 0] };
    dailyQuests(dateKey).forEach((q, i) => {
      const def = QUEST_BY_ID[q.id], was = m.quest.p[i], v = def.stat(s);
      const now = Math.min(q.goal, def.kind === 'max' ? Math.max(was, v) : was + v);
      m.quest.p[i] = now;
      const done = now >= q.goal, justDone = done && was < q.goal;
      if (justDone) parts.push({ id: `quest:${q.id}`, ja: `おつかい「${q.ja}」`, en: `Quest: ${q.en}`, xp: q.xp, n: 1 });
      quests.push({ id: q.id, ja: q.ja, en: q.en, p: now, goal: q.goal, xp: q.xp, done, justDone });
    });
  }

  const xp = parts.reduce((a, p) => a + p.xp, 0);
  m.xp = Math.min(XP_MAX, m.xp + xp);
  const rankAfter = rankOf(m.xp);
  const had = new Set(UNLOCKS.filter((u) => unlockedBy(before, u)));
  const unlocked = UNLOCKS.filter((u) => !had.has(u) && unlockedBy(m, u));
  return { meta: m, xp, parts, rankBefore, rankAfter, unlocked, achievements, quests, bossesBeaten, streak: { ...m.streak, xp: streakXp } };
}

// ---------------------------------------------------------------- 図鑑
// 見たものを書く: charms = 候補に出たお守り、shells = 見た玉の種類、cast = 会った妖怪・屋台の猫
export function noteSeen(meta, seen) {
  const m = initMeta(meta), charms = get(seen, 'charms'), shells = get(seen, 'shells'), cast = get(seen, 'cast');
  for (const id of list(charms)) if (CHARM_IDS.includes(id)) { const e = m.charms[id] || [0, 0, 0]; e[0] = cap(e[0] + 1); m.charms[id] = e; }
  const sh = new Set(m.shells);
  for (const t of list(shells)) if (SHELL_TYPES.includes(t)) sh.add(t);
  m.shells = SHELL_TYPES.filter((t) => sh.has(t));
  for (const id of list(cast)) if (CAST_IDS.includes(id)) { const e = m.cast[id] || [0, 0]; e[0] = Math.max(1, e[0]); m.cast[id] = e; }
  return m;
}
export function collection(meta) {
  const m = initMeta(meta);
  const charms = {}, cast = {}, achievements = {}, shells = {}, wishes = {};
  for (const id of CHARM_IDS) { const e = m.charms[id] || [0, 0, 0]; charms[id] = { seen: e[0], used: e[1], maxLv: e[2] }; }
  for (const id of CAST_IDS) { const e = m.cast[id] || [0, 0]; cast[id] = { met: e[0], beaten: e[1] }; }
  for (const id of ACH_IDS) achievements[id] = m.ach.includes(id);
  for (const t of SHELL_TYPES) shells[t] = m.shells.includes(t);
  for (const id of WISH_IDS) wishes[id] = m.wish[id] || 0;
  const n = (o, f) => Object.values(o).filter(f).length;
  const counts = {
    charms: n(charms, (c) => c.seen > 0), charmsTotal: CHARM_IDS.length, charmsUsed: n(charms, (c) => c.used > 0),
    cast: n(cast, (c) => c.met > 0), castTotal: CAST_IDS.length, bosses: BOSSES.filter((b) => cast[b].beaten > 0).length, bossesTotal: BOSSES.length,
    achievements: m.ach.length, achievementsTotal: ACH_IDS.length,
    shells: m.shells.length, shellsTotal: SHELL_TYPES.length, wishes: n(wishes, (v) => v > 0), wishesTotal: WISH_IDS.length,
    outfits: outfits(m).length, outfitsTotal: OUTFIT_IDS.length,
    runs: m.runs, nights: m.nights, stars: m.stars, clears: m.clears, best: m.best, bestPops: m.pops,
  };
  return { charms, cast, achievements, shells, wishes, counts };
}

// ---------------------------------------------------------------- 読みこみ（壊れた値に強く）
const XP_MAX = 1e8, COUNT_MAX = 1e7;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function get(o, k) { return isObj(o) && own(o, k) ? o[k] : undefined; }
function int(x, lo, hi, def = lo) { return typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x))) : def; }
const cap = (n) => Math.min(COUNT_MAX, n);
const list = (x) => (Array.isArray(x) ? x.filter((v) => typeof v === 'string') : typeof x === 'string' ? [x] : []);
function beatenN(m, b) { return m.cast[b] ? m.cast[b][1] : 0; }
// 'YYYY-MM-DD' → 日の通し番号（ありえない日付は null）
function dayIndex(key) {
  if (typeof key !== 'string') return null;
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!r) return null;
  const t = Date.UTC(+r[1], +r[2] - 1, +r[3]), d = new Date(t);
  if (d.getUTCFullYear() !== +r[1] || d.getUTCMonth() !== +r[2] - 1 || d.getUTCDate() !== +r[3]) return null;
  return Math.round(t / 86400000);
}
const dateOr = (k, def = null) => (dayIndex(k) != null ? k : def);

// legacy: meta をまだ持たない（前の版から遊んでいる）人への、はじめの 1 回だけのおまけ。
// { runs: これまでの祭りの数, cleared: 八夜を通したことがあるか } → 1 回 50 XP（20 回まで）、通したことがあれば段位えらびも開く
export function initMeta(raw, legacy) {
  const r = isObj(raw) ? raw : {};
  const m = {
    v: META_VERSION,
    xp: int(get(r, 'xp'), 0, XP_MAX, 0),
    runs: int(get(r, 'runs'), 0, COUNT_MAX, 0), nights: int(get(r, 'nights'), 0, COUNT_MAX, 0),
    stars: int(get(r, 'stars'), 0, COUNT_MAX, 0), wishes: int(get(r, 'wishes'), 0, COUNT_MAX, 0),
    clears: int(get(r, 'clears'), 0, COUNT_MAX, 0), daily: int(get(r, 'daily'), 0, COUNT_MAX, 0),
    best: int(get(r, 'best'), 0, Number.MAX_SAFE_INTEGER, 0), pops: int(get(r, 'pops'), 0, 9999, 0),
    top: int(get(r, 'top'), -1, MAX_LEVEL, -1),
    cast: {}, charms: {}, wish: {}, shells: [], ach: [],
    streak: { last: null, n: 0, best: 0 },
    quest: { d: null, p: [0, 0, 0] },
  };
  const cast = get(r, 'cast');
  for (const id of CAST_IDS) {
    const e = get(cast, id);
    if (!Array.isArray(e)) continue;
    const met = int(e[0], 0, COUNT_MAX, 0), won = id === 'neko' ? 0 : int(e[1], 0, COUNT_MAX, 0);
    if (met || won) m.cast[id] = [Math.max(met, won), won];
  }
  const charms = get(r, 'charms');
  for (const id of CHARM_IDS) {
    const e = get(charms, id);
    if (!Array.isArray(e)) continue;
    const used = int(e[1], 0, COUNT_MAX, 0), seen = Math.max(int(e[0], 0, COUNT_MAX, 0), used ? 1 : 0), lv = int(e[2], 0, 3, 0);
    if (seen || used || lv) m.charms[id] = [seen, used, used ? Math.max(1, lv) : lv];
  }
  const wish = get(r, 'wish');
  for (const id of WISH_IDS) { const v = int(get(wish, id), 0, COUNT_MAX, 0); if (v) m.wish[id] = v; }
  const sh = list(get(r, 'shells')), ach = list(get(r, 'ach'));
  m.shells = SHELL_TYPES.filter((t) => sh.includes(t));
  m.ach = ACH_IDS.filter((id) => ach.includes(id));
  const st = get(r, 'streak');
  const last = dateOr(get(st, 'last'));
  if (last) {
    m.streak.last = last;
    m.streak.n = int(get(st, 'n'), 1, COUNT_MAX, 1);
    m.streak.best = Math.max(m.streak.n, int(get(st, 'best'), 0, COUNT_MAX, 0));
  } else m.streak.best = int(get(st, 'best'), 0, COUNT_MAX, 0);
  const q = get(r, 'quest'), qd = dateOr(get(q, 'd'));
  if (qd) {
    const p = get(q, 'p'), qs = dailyQuests(qd);
    m.quest = { d: qd, p: qs.map((x, i) => (Array.isArray(p) ? int(p[i], 0, x.goal, 0) : 0)) };
  }
  // 前の版から遊んでいる人（meta がまだ無いときだけ）
  if (!own(r, 'v') && isObj(legacy)) {
    const runs = int(get(legacy, 'runs'), 0, COUNT_MAX, 0);
    m.runs = Math.max(m.runs, runs);
    m.xp = Math.max(m.xp, Math.min(runs, 20) * 50);
    if (get(legacy, 'cleared') === true) m.top = Math.max(m.top, 0);
  }
  return m;
}

// summary をきれいにする（足りない所は 0、知らない ID は捨てる）
function cleanSummary(raw) {
  const r = isObj(raw) ? raw : {};
  const rawNights = Array.isArray(get(r, 'nights')) ? r.nights.slice(0, NIGHTS * 2) : [];
  const nights = rawNights.map((x) => {
    const n = isObj(x) ? x : {};
    const st = get(n, 'stars');
    const stars = Array.isArray(st) ? st.slice(0, 3).filter(Boolean).length : int(st, 0, 3, 0);
    const tw = get(n, 'twist'), b = get(n, 'boss');
    const twist = typeof tw === 'string' && own(TWIST_BOSS, tw) ? tw : null;
    const boss = typeof b === 'string' && BOSSES.includes(b) ? b : twist ? TWIST_BOSS[twist] : null;
    const w = get(n, 'wish'), wid = get(w, 'id');
    const score = get(n, 'score'), target = get(n, 'target');
    return {
      pass: get(n, 'pass') === true, stars, allClear: get(n, 'allClear') === true,
      pops: int(get(n, 'pops'), 0, 9999, 0), toriAdd: int(get(n, 'toriAdd'), 0, 99, 0),
      score: typeof score === 'number' && Number.isFinite(score) ? Math.max(0, score) : 0,
      target: typeof target === 'number' && Number.isFinite(target) ? Math.max(0, target) : 0,
      twist, boss, wish: typeof wid === 'string' && WISH_IDS.includes(wid) ? wid : null, wishMet: get(w, 'met') === true,
    };
  });
  const passed = nights.filter((n) => n.pass);
  const c = get(r, 'cleared');
  const cleared = typeof c === 'number' && Number.isFinite(c) ? int(c, 0, NIGHTS, 0) : Math.min(NIGHTS, passed.length);
  // お守り: { id: lv } か、core の並び（重なりが Lv）
  const charms = {}, ch = get(r, 'charms');
  if (Array.isArray(ch)) { for (const id of ch) if (CHARM_IDS.includes(id)) charms[id] = Math.min(3, (charms[id] || 0) + 1); } else if (isObj(ch)) {
    for (const id of CHARM_IDS) { const lv = int(get(ch, id), 0, 3, 0); if (lv) charms[id] = lv; }
  }
  const total = get(r, 'total');
  return {
    daily: get(r, 'daily') === true, level: int(get(r, 'level'), 0, MAX_LEVEL, 0), cleared,
    total: typeof total === 'number' && Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0,
    bestPops: Math.max(int(get(r, 'bestPops'), 0, 9999, 0), ...nights.map((n) => n.pops), 0),
    retries: int(get(r, 'retries'), 0, 99, null),
    nights, passed, charms,
    stars: Math.min(NIGHTS * 3, nights.reduce((a, n) => a + n.stars, 0)),
    wishes: Math.min(NIGHTS, nights.filter((n) => n.wishMet).length),
    bossWins: nights.filter((n) => n.boss && n.pass).length,
    beaten: [...new Set(nights.filter((n) => n.boss && n.pass).map((n) => n.boss))],
    pops: nights.reduce((a, n) => a + n.pops, 0),
  };
}

// ---------------------------------------------------------------- 乱数（core.js と同じ式。ここだけで閉じる）
function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
